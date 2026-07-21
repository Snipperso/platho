import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { toNano, beginCell, contractAddress, Address } from '@ton/core';
import { readFileSync } from 'node:fs';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { AirdropTicket } from '../build/AirdropTicket/AirdropTicket_AirdropTicket';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { buildIntroPublish, buildConvPublish } from '../web/publish-builder.mjs';
import { epochOf } from '../web/shard-discovery.mjs';
import { ed25519 } from '@noble/curves/ed25519.js';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// SHARD-FEE-PASSTHROUGH — the fee does not live in a shard; it passes through on the way to FeeAccumulator.
//
// [OWNER 2026-07-19: "в шарде должна быть только его рента на год, а моя комиссия это моя комиссия".]
//
// This replaces an accumulate-then-remit design that was, in the end, an architecture built around another
// contract's wrong constant: FeeAccumulator demanded 2_000_000 of execution reserve per deposit, so the fee was
// pooled inside each shard and remitted once, purely to pay that constant once instead of a million times.
// Measuring the deposit at 199_068 — against the LIVE mainnet gas config, after a recalled "400 nanoton per gas
// unit" nearly caused the correct measurement to be thrown away — and fixing it at the source removed the reason
// for the whole mechanism.
//
// The publisher pays transport, so the pool receives the fee whole. [OWNER: "естественно платит публикатор".]
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const cell = (f: number) => beginCell().storeBuffer(Buffer.alloc(64, f)).endCell();

// After the Apr-2026 config-18 switch; before it a cell-year costs 240631 instead of 64962 and every rent figure
// here would be mispriced. Gas needs no such care — @ton/sandbox prices it at the live mainnet rate (verified:
// config-21 predicts 199_067 for the deposit, the sandbox charges 199_068).
const CLOCK = 1_790_000_000;

const PROTOCOL_FEE = 10_000_000n;
// Fee transport rose 600_000 -> 2_800_000 (deposit reserve 400_000 -> 2_600_000) when the deposit began carrying
// an airdrop credit. The intermediate 1_400_000 was REASONED and wrong; 2_600_000 is measured — see PT-04c and
// the comment on FEEACCUMULATOR_CAPSULE_FEE_EXEC_RESERVE. The 10_000_000 protocol fee is unchanged and still
// reaches the pool whole; only the publisher's transport grew.
const RS_MIN_VALUE = 15_600_000n;        // 300_000 + 2_500_000 + 10_000_000 + 2_800_000
const RS_DEPLOY_MIN_VALUE = 19_100_000n; // + RS_BASE_ENDOWMENT 3_500_000, charged on the FIRST publish only
const IS_MIN_VALUE = 15_310_000n;        //    10_000 + 2_500_000 + 10_000_000 + 2_800_000

const FA_TREASURY = Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH');
const FA_BUYBACK = Address.parse('UQBoOuHT0NhmZfHbm_wOquj3hA1BYUO84EKoqQ-X85UrLYgj');
const FA_POOL = Address.parse('UQBZ8Lh9AuO1e9XcFBJ0NmE10IY9FoVpQeoABd9V5ninPATH');

/** The data cell of an AirdropTicket owned by `owner` — lazy-init flag plus the single init argument. */
const ticketData = (owner: Address) => beginCell().storeUint(0, 1).storeAddress(owner).endCell();

/**
 * The sink as GENESIS leaves it: deployed AND bound. Binding is not test scaffolding — an unbound sink refuses
 * every capsule deposit at gate 15055, because the gate authenticates a shard by rebuilding its address from the
 * bound code, and with nothing bound there is nothing to rebuild against. That refusal is correct behaviour and
 * PT-11 asserts it directly; every other test here needs the sink a live network would actually have.
 */
async function deploySink(bc: Blockchain, opts: { bind?: boolean } = {}) {
  const sink = bc.openContract(await FeeAccumulator.fromInit(FA_TREASURY, FA_BUYBACK));
  const funder = await bc.treasury('sink-funder');
  await sink.send(funder.getSender(), { value: toNano('1') }, { $$type: 'TopUpStorageReserve' } as any);
  if (opts.bind === false) return sink;

  // The binds are treasury-only and one-shot (gates 15050 / 15051 / 15052 / 15053 / 15057), so this mirrors the
  // ceremony exactly: four messages from the treasury wallet, once, before any publish exists.
  const gov = bc.sender(FA_TREASURY);
  const send = (body: any) => sink.send(gov, { value: toNano('0.1') }, body);
  await send({ $$type: 'BindShardCode', shard_code: (await RecordShard.init(1n, 1n)).code } as any);
  await send({ $$type: 'BindIntroShardCode', intro_shard_code: (await IntroShard.init(1n, 1n)).code } as any);
  await send({ $$type: 'BindTicketCode', ticket_code: (await AirdropTicket.init(FA_TREASURY)).code } as any);
  await send({ $$type: 'BindAirdropPool', airdrop_pool_address: FA_POOL } as any);
  return sink;
}

/** How many airdrop credits a publisher's ticket holds — 0 if the ticket was never deployed. */
async function creditsOf(bc: Blockchain, owner: Address) {
  const addr = contractAddress(0, { code: (await AirdropTicket.init(FA_TREASURY)).code, data: ticketData(owner) });
  if ((await bc.getContract(addr)).accountState?.type !== 'active') return 0n;
  return (await bc.openContract(AirdropTicket.fromAddress(addr)).getGetTicket()).credits;
}

/** One publish at EXACTLY the given value, with no deploy-price correction — for testing the gate itself. */
async function publishConvRaw(bc: Blockchain, seed: number, value: bigint) {
  const epoch = epochOf(bc.now!);
  const payer = await bc.treasury(`pt-raw-${seed}`);
  const secret = new Uint8Array(32).fill(seed);
  const publicKey = ed25519.getPublicKey(secret);
  const b = await buildConvPublish({
    writePublicKey: publicKey, writeSecret: secret, seq: 1n, epoch,
    header0: cell(1), header1: cell(2), body: cell(3), value,
  });
  const last = await payer.send({ to: b.to, value, body: b.body, init: b.init, bounce: true } as any);
  return { shard: bc.openContract(RecordShard.fromAddress(b.to)), payer, last };
}

async function publishConv(bc: Blockchain, n: number, seed: number, value = toNano('0.05')) {
  const epoch = epochOf(bc.now!);
  const payer = await bc.treasury(`pt-conv-${seed}`);
  const secret = new Uint8Array(32).fill(seed);
  const publicKey = ed25519.getPublicKey(secret);
  let to: any = null;
  let last: any = null;
  for (let i = 0; i < n; i += 1) {
    const b = await buildConvPublish({
      writePublicKey: publicKey, writeSecret: secret, seq: BigInt(i + 1), epoch,
      header0: cell(i & 255), header1: cell((i + 1) & 255), body: cell((i + 2) & 255), value,
    });
    to = b.to;
    // The first publish into a fresh shard funds the account's life and its retirement, so it costs more. A
    // client learns which price applies from get_view().deploy_min_value, or from the account being absent.
    const due = i === 0 && value < RS_DEPLOY_MIN_VALUE ? RS_DEPLOY_MIN_VALUE : value;
    last = await payer.send({ to: b.to, value: due, body: b.body, init: b.init, bounce: true } as any);
  }
  return { shard: bc.openContract(RecordShard.fromAddress(to)), payer, last };
}

describe('SHARD-FEE-PASSTHROUGH — the shard keeps its rent, the fee goes straight to the pool', () => {
  it('PT-01: a CONV publish books the WHOLE fee at FeeAccumulator, in the same transaction', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deploySink(bc);
    const before = (await sink.getGetState()).accumulated_ton;

    const { shard, payer } = await publishConv(bc, 5, 0x21);

    // WHOLE, not net of transport: the publisher funds the transfer so the pool's arithmetic stays exact.
    // 1.5M capsules x 0.01 GRAM must be 15_000 GRAM, not 15_000 minus a per-message shave.
    expect((await sink.getGetState()).accumulated_ton - before, 'the pool books the fee whole')
      .toBe(5n * PROTOCOL_FEE);
    expect((await shard.getGetView()).record_count).toBe(5n);
    // And the same deposit earned the publisher their airdrop — one credit per capsule, 10 ATH each.
    expect(await creditsOf(bc, payer.address), 'one airdrop credit per capsule').toBe(5n);
  }, 300_000);

  it('PT-02: an INTRO publish does the same', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deploySink(bc);
    const before = (await sink.getGetState()).accumulated_ton;

    const epoch = epochOf(bc.now!);
    const payer = await bc.treasury('pt-intro');
    for (let i = 0; i < 5; i += 1) {
      const b = await buildIntroPublish({
        epoch, bucket: 3n, r: BigInt(i + 1), viewTag: BigInt(i),
        header0: cell(i), body: cell(i + 1), value: toNano('0.05'),
      });
      await payer.send({ to: b.to, value: b.value, body: b.body, init: b.init, bounce: true } as any);
    }
    expect((await sink.getGetState()).accumulated_ton - before).toBe(5n * PROTOCOL_FEE);
    // The INTRO lane derives through a DIFFERENT bound code and a different pair of init arguments (epoch,
    // bucket instead of pubkey, epoch). It was a positional mix-up here that would have authenticated the wrong
    // addresses for the whole lane while compiling cleanly, so the credit is asserted, not assumed.
    expect(await creditsOf(bc, payer.address), 'INTRO capsules earn the same credit').toBe(5n);
  }, 300_000);

  it('PT-03: the shard holds ONLY its rent — no fee sits in it', async () => {
    // The property the owner asked for, asserted as an equation rather than a vibe. What a shard holds after n
    // publishes must be exactly the per-record storage endowment plus its own base endowment — which since
    // 2026-07-19 also funds the single call that retires it. If any fee were retained this would be short by
    // n x 10_000_000.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deploySink(bc);
    const n = 5;
    const { shard } = await publishConv(bc, n, 0x31);

    const held = (await bc.getContract(shard.address)).balance;
    const expected = BigInt(n) * 300_000n + 3_500_000n;
    expect(held, `shard holds ${held}, expected exactly rent+bounty+base = ${expected}`).toBe(expected);

    const view = await shard.getGetView();
    expect(view.record_count, 'and the records are all there').toBe(BigInt(n));
  }, 300_000);

  it('PT-04: the shards carry what gate 15056 demands — a drift refuses every deposit', async () => {
    // RETARGETED 2026-07-20. This used to pin the mirrors against FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE and gate
    // 15002, which is the PERMISSIONLESS DepositProtocolFee path. The shards no longer travel that path: a capsule
    // fee now carries an airdrop credit, so it goes through DepositCapsuleFee and is gated by 15056, which demands
    // amount + FEEACCUMULATOR_CAPSULE_FEE_EXEC_RESERVE. Left pointing at the old constant this test would have
    // gone on passing while every publish bounced — the same shape of failure it was written to catch.
    //
    // The relation is >= rather than ==, and deliberately so: the shard's surplus is recoverable through
    // SweepUnaccounted (PT-09), while a shortfall is quietly paid by the owner on every one of 1.5M capsules.
    const fa = readFileSync('contracts/FeeAccumulator.tact', 'utf8');
    const capsuleReserve = /FEEACCUMULATOR_CAPSULE_FEE_EXEC_RESERVE:\s*Int\s*=\s*(\d+)/.exec(fa)?.[1];
    expect(capsuleReserve, 'FeeAccumulator must declare a capsule-fee reserve').toBeDefined();

    const mirrors: number[] = [];
    for (const [file, name] of [
      ['contracts/RecordShard.tact', 'RS_FEE_SINK_DEPOSIT_RESERVE'],
      ['contracts/IntroShard.tact', 'IS_FEE_SINK_DEPOSIT_RESERVE'],
    ] as const) {
      const src = readFileSync(file, 'utf8');
      const mirror = new RegExp(`${name}:\\s*Int\\s*=\\s*(\\d+)`).exec(src)?.[1];
      expect(mirror, `${file} must declare ${name}`).toBeDefined();
      expect(Number(mirror), `${name} must cover FeeAccumulator's gate-15056 reserve`)
        .toBeGreaterThanOrEqual(Number(capsuleReserve));
      mirrors.push(Number(mirror));
    }
    // Both lanes pay the same fee into the same receiver, so a difference between them is a mistake, not a choice.
    expect(mirrors[0], 'both lanes must carry the same deposit reserve').toBe(mirrors[1]);

    // And the reserve must cover what the receiver really spends: the deposit's own execution plus the ticket
    // credit it now sends. PT-04c measures that end to end; this is the cheap source-level guard beside it.
    const creditValue = /FEEACCUMULATOR_TICKET_CREDIT_VALUE:\s*Int\s*=\s*(\d+)/.exec(fa)?.[1];
    expect(Number(capsuleReserve), 'the reserve must cover the deposit execution plus the credit it carries')
      .toBeGreaterThanOrEqual(199_068 + Number(creditValue));
  });

  it('PT-04c: MEASURED — the sink does not lose money on a capsule, credit and all', async () => {
    // The property the source-level pin above can only approximate. FeeAccumulator now SPENDS on every deposit:
    // it forwards FEEACCUMULATOR_TICKET_CREDIT_VALUE to the publisher's ticket and pays that message's fees. If
    // the arriving transport does not cover both, the sink bleeds a little on each of 1.5M capsules and the
    // shortfall lands on the owner. Balance is measured against the BOOKED figure, because accumulated_ton is a
    // liability: everything above it is the sink's own, everything below it is money it owes and does not have.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deploySink(bc);
    const balBefore = (await bc.getContract(sink.address)).balance;

    const n = 10;
    const { payer } = await publishConv(bc, n, 0xA1);
    const booked = (await sink.getGetState()).accumulated_ton;
    expect(booked, 'the principal is booked whole').toBe(BigInt(n) * PROTOCOL_FEE);

    const balAfter = (await bc.getContract(sink.address)).balance;
    const surplus = balAfter - balBefore - booked;

    // eslint-disable-next-line no-console
    console.log([
      '[PT-04c] what a capsule fee really leaves at the sink',
      `  balance grew      ${balAfter - balBefore} over ${n} capsules`,
      `  of which booked   ${booked} (the owner's, whole)`,
      `  sink's own margin ${surplus} = ${surplus / BigInt(n)} per capsule`,
    ].join('\n'));

    expect(surplus, 'the sink must not fund the airdrop credit out of the fee it owes').toBeGreaterThanOrEqual(0n);
    expect(await creditsOf(bc, payer.address), 'and every capsule credited its publisher').toBe(BigInt(n));
  }, 300_000);

  it('PT-11: an UNBOUND sink refuses the capsule fee — the airdrop gate is not decorative', async () => {
    // The inverse of the binding this suite now performs, kept explicit so nobody concludes the binds are
    // scaffolding. Gate 15055 authenticates a shard by rebuilding its address from the bound code; with no code
    // bound there is no shard it can accept, and 10 ATH per call stays shut. The fee bounces home rather than
    // being swallowed, which is why an unbound genesis is recoverable rather than fatal.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deploySink(bc, { bind: false });
    const { shard, payer, last } = await publishConv(bc, 1, 0xB1);

    const sinkTx = (last.transactions as any[])
      .find((t) => t.inMessage?.info?.dest?.equals?.(sink.address) && !t.inMessage?.info?.bounced);
    expect(sinkTx?.description?.computePhase?.exitCode, 'gate 15055 must refuse an unauthenticated deposit')
      .toBe(15055);
    expect((await sink.getGetState()).accumulated_ton, 'and nothing is booked').toBe(0n);
    expect(await creditsOf(bc, payer.address), 'and no credit is minted').toBe(0n);

    // The record still stored, and the refused fee came back to the shard rather than vanishing.
    expect((await shard.getGetView()).record_count, 'the publish itself still succeeded').toBe(1n);
    expect((await bc.getContract(shard.address)).balance, 'the refused fee is held, not lost')
      .toBeGreaterThan(PROTOCOL_FEE);
  }, 300_000);

  it('PT-04b: the hardcoded sink address IS the current FeeAccumulator — this exact bug already happened', async () => {
    // WRITTEN BECAUSE IT BIT. Earlier today I measured that FeeAccumulator.init carries no deployment_id and
    // concluded its address could never move, then lowered a constant inside it — which changed its code hash
    // and therefore its address — while the shards went on pointing at the old one. Every publish's fee bounced
    // straight back into the shard. The ordering constraint is real: FeeAccumulator code -> its address ->
    // shard code -> shard addresses.
    //
    // Derived fresh from the built FeeAccumulator rather than compared against a literal, so that changing that
    // contract again fails here instead of silently routing real money to a dead address a year after genesis.
    const derived = contractAddress(0, await FeeAccumulator.init(FA_TREASURY, FA_BUYBACK));

    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deploySink(bc);
    const { shard } = await publishConv(bc, 1, 0x61 + 30);
    expect((await shard.getGetView()).fee_sink.toRawString(), 'RS_FEE_SINK must be the current FeeAccumulator')
      .toBe(derived.toRawString());

    const epoch = epochOf(bc.now!);
    const payer = await bc.treasury('pt04b-intro');
    const b = await buildIntroPublish({
      epoch, bucket: 12n, r: 1n, viewTag: 0n, header0: cell(1), body: cell(2), value: toNano('0.05'),
    });
    await payer.send({ to: b.to, value: b.value, body: b.body, init: b.init, bounce: true } as any);
    const intro = bc.openContract(IntroShard.fromAddress(contractAddress(0, await IntroShard.init(BigInt(epoch), 12n))));
    expect((await intro.getGetView()).fee_sink.toRawString(), 'IS_FEE_SINK must be the current FeeAccumulator')
      .toBe(derived.toRawString());
  }, 300_000);

  it('PT-05: a minimum-funded publish succeeds and nothing aborts — the ACTION phase cannot fail', async () => {
    // THE ATTACK, moved to the publish path. The fee now leaves through an explicit send, and an explicit send
    // that loses to the reserve fails the ACTION phase — which does NOT bounce, so the shard would silently
    // swallow the publisher's whole value. The defence is ordering: the deposit is queued BEFORE the reserve, so
    // it draws on the value gate 13652 has already checked. The tightest case is a publish funded at exactly
    // RS_MIN_VALUE, where there is no slack anywhere.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deploySink(bc);
    const before = (await sink.getGetState()).accumulated_ton;

    const { shard, last } = await publishConv(bc, 1, 0x41, RS_DEPLOY_MIN_VALUE);

    const aborted = (last.transactions as any[]).filter((t) => t.description?.aborted === true);
    expect(aborted.length, 'no transaction may abort on a minimum-funded publish').toBe(0);
    expect((await shard.getGetView()).record_count, 'the record was stored').toBe(1n);
    expect((await sink.getGetState()).accumulated_ton - before, 'and the fee still reached the pool whole')
      .toBe(PROTOCOL_FEE);
  }, 300_000);

  it('PT-06: one nanoton below the minimum is REFUSED in COMPUTE, and refunded', async () => {
    // The gate must be the thing that stops an underfunded publish, not the action phase. A COMPUTE throw
    // bounces and returns the value; an ACTION failure would absorb it.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deploySink(bc);
    const { shard, last } = await publishConvRaw(bc, 0x51, RS_DEPLOY_MIN_VALUE - 1n);

    const shardTx = (last.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(shardTx?.description?.computePhase?.exitCode, 'gate 13652 must refuse in COMPUTE').toBe(13652);
    expect((last.transactions as any[]).some((t) => t.inMessage?.info?.bounced === true), 'and it must bounce')
      .toBe(true);
  }, 300_000);

  it('PT-09: the deposit surplus is RECOVERABLE and reaches the treasury wallet', async () => {
    // [OWNER 2026-07-19: "разве нельзя вывести и излишки, если они будут? ... лишние деньги я могу потратить".]
    // Before SweepUnaccounted the answer was NO, and that was the whole reason a thin reserve looked prudent:
    // FlushTreasuryDue can only send what SplitAccumulated moved out of accumulated_ton, which only ever comes
    // from a DECLARED deposit amount. Every nanoton of the execution reserve that the gas did not burn was
    // immured — a few hundred GRAM across the airdrop. This asserts the whole path, not just the bookkeeping:
    // surplus -> accumulated_ton -> treasury_due_ton -> the owner's wallet.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deploySink(bc);

    // Real publishes, so the surplus is the genuine article rather than a hand-placed donation.
    const n = 20;
    await publishConv(bc, n, 0x91);
    const booked = (await sink.getGetState()).accumulated_ton;
    expect(booked, 'the principal is booked whole').toBe(BigInt(n) * PROTOCOL_FEE);

    const anyone = await bc.treasury('pt09-passerby');
    await sink.send(anyone.getSender(), { value: toNano('0.05') }, { $$type: 'SweepUnaccounted' } as any);
    const swept = (await sink.getGetState()).accumulated_ton - booked;
    expect(swept, 'the unburnt part of each deposit reserve is reclaimed').toBeGreaterThan(0n);

    // A second sweep must find nothing — the floor is respected and the surplus is not double-counted.
    const r2 = await sink.send(anyone.getSender(), { value: toNano('0.05') }, { $$type: 'SweepUnaccounted' } as any);
    const secondTx = (r2.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(sink.address));
    expect(secondTx?.description?.computePhase?.exitCode, 'a second sweep finds no surplus and refuses').toBe(15040);
    expect((await sink.getGetState()).accumulated_ton - booked, 'and credits nothing more').toBe(swept);

    // END TO END: it actually leaves for the owner's wallet, which is the only test that answers the question.
    await sink.send(anyone.getSender(), { value: toNano('0.05') }, { $$type: 'SplitAccumulated' } as any);
    const due = (await sink.getGetState()).treasury_due_ton;
    expect(due, 'split moves the swept surplus into the treasury bucket too').toBe(booked + swept);

    const before = (await bc.getContract(FA_TREASURY)).balance;
    await sink.send(anyone.getSender(), { value: toNano('0.05') }, { $$type: 'FlushTreasuryDue', amount: due } as any);
    expect((await bc.getContract(FA_TREASURY)).balance - before, 'the owner receives principal AND surplus')
      .toBe(due);
    expect((await sink.getGetState()).treasury_due_ton).toBe(0n);
  }, 600_000);

  it('PT-10: SweepUnaccounted cannot invent money — an under-funded sink refuses', async () => {
    // The receiver is permissionless, so it must be impossible to use it to credit money that is not there.
    // A sink with NO publishes behind it has nothing that is genuinely the protocol's.
    //
    // The first sweep is not a formality: genesis binding itself leaves change in the account (four messages from
    // the treasury wallet), and that change is real unaccounted money the owner is entitled to. Sweeping it is
    // correct. What must be impossible is the sweep AFTER that one — a second call finding a second surplus would
    // mean the receiver can be pumped for money that was never deposited.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deploySink(bc);
    const anyone = await bc.treasury('pt10');
    await sink.send(anyone.getSender(), { value: toNano('0.05') }, { $$type: 'SweepUnaccounted' } as any);
    const credited = (await sink.getGetState()).accumulated_ton;

    const r = await sink.send(anyone.getSender(), { value: toNano('0.05') }, { $$type: 'SweepUnaccounted' } as any);
    const tx = (r.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(sink.address));
    expect(tx?.description?.computePhase?.exitCode, 'no surplus above the floor -> refuse').toBe(15040);
    expect((await sink.getGetState()).accumulated_ton, 'and nothing further is credited').toBe(credited);
  }, 300_000);

  it('PT-07: retiring a shard moves no protocol money — the fee left long ago at publish time', async () => {
    // Everything the fee used to force onto this receiver is gone: no remit, no solvency test, no ordering
    // against outstanding bounties, no fee stranded because nobody swept. What remains must still pay its caller.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deploySink(bc);
    const { shard } = await publishConv(bc, 8, 0x61);
    const booked = (await sink.getGetState()).accumulated_ton;

    // Read the retire instant from the CHAIN rather than recomputing it here. A test that mirrors the contract's
    // arithmetic proves only that I can copy; reading get_view().retire_at is also exactly what a client must do.
    bc.now = Number((await shard.getGetView()).retire_at) + 1;
    const keeper = await bc.treasury('pt07-keeper');
    const b = (await bc.getContract(keeper.address)).balance;
    await shard.send(keeper.getSender(), { value: toNano('0.5') }, { $$type: 'RetireShard' } as any);
    const net = (await bc.getContract(keeper.address)).balance - b;

    expect(net, 'retiring the shard still pays its caller').toBeGreaterThan(0n);
    expect((await sink.getGetState()).accumulated_ton, 'retirement moves no protocol money at all').toBe(booked);
    expect((await bc.getContract(shard.address)).accountState?.type, 'and the account is gone').not.toBe('active');
  }, 600_000);

  it('PT-08: the publish minimum is what the owner was told — 0.0156 CONV, 0.01531 INTRO', async () => {
    // The owner priced this decision in GRAM and agreed to it. Pin the number so it cannot drift silently.
    // MOVED 2026-07-20 from 0.0134 / 0.013110: the airdrop credit's real cost, measured, is 1.2M more per capsule
    // than the figure it was first quoted at. The protocol fee inside it is untouched at 0.01 GRAM.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deploySink(bc);
    const { shard } = await publishConv(bc, 1, 0x71);
    expect((await shard.getGetView()).min_value, 'CONV minimum publish').toBe(RS_MIN_VALUE);

    const epoch = epochOf(bc.now!);
    const payer = await bc.treasury('pt08-intro');
    const b = await buildIntroPublish({
      epoch, bucket: 8n, r: 1n, viewTag: 0n, header0: cell(1), body: cell(2), value: toNano('0.05'),
    });
    await payer.send({ to: b.to, value: b.value, body: b.body, init: b.init, bounce: true } as any);
    const intro = bc.openContract(IntroShard.fromAddress(contractAddress(0, await IntroShard.init(BigInt(epoch), 8n))));
    expect((await intro.getGetView()).min_value, 'INTRO minimum publish').toBe(IS_MIN_VALUE);
  }, 300_000);

  it('PT-12: every baked FEE SINK constant equals the address the CURRENT build actually produces', async () => {
    // A shard proves the fee sink by NAME: RecordShard, IntroShard and AirdropTicket each carry FeeAccumulator's
    // address as a compile-time constant, because a shard has nothing to bind and nobody to ask. That makes the
    // three constants a hand-maintained copy of a derived value — and a copy that goes stale does not fail loudly:
    // deposits land on an address nobody occupies, or authentication refuses a genuine shard.
    //
    // It has already gone stale twice. The three contract constants were rebaked on 2026-07-20 when the sink's
    // code moved; the MIRRORS of the same address inside tests/airdrop-ticket.test.ts and
    // tests/fee-accumulator-accrual.test.ts were not, and eleven tests stayed red for a day looking like a
    // protocol defect. This pins the invariant at its source instead of at any one copy of it.
    const { readFileSync } = await import('node:fs');
    const live = contractAddress(0, await FeeAccumulator.init(FA_TREASURY, FA_BUYBACK)).toString();
    const baked: Array<[string, string]> = [
      ['contracts/RecordShard.tact', 'RS_FEE_SINK'],
      ['contracts/IntroShard.tact', 'IS_FEE_SINK'],
      ['contracts/AirdropTicket.tact', 'AT_FEE_SINK'],
    ];
    for (const [file, name] of baked) {
      const match = new RegExp(`const ${name}: Address = address\\("([^"]+)"\\)`).exec(readFileSync(file, 'utf8'));
      expect(match, `${name} must be a baked address constant in ${file}`).toBeTruthy();
      expect(Address.parse(match![1]).toString(),
        `${name} is stale — rebake it to the address the current FeeAccumulator build produces`).toBe(live);
    }
  }, 300_000);
});
