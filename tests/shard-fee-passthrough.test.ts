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
import { FA_BUYBACK } from './helpers/fee-sink-fixture';


const cell = (f: number) => beginCell().storeBuffer(Buffer.alloc(64, f)).endCell();

const CLOCK = 1_790_000_000;

const PROTOCOL_FEE = 10_000_000n;
const RS_MIN_VALUE = 15_600_000n;
const RS_DEPLOY_MIN_VALUE = 19_100_000n;
const IS_MIN_VALUE = 15_310_000n;

const FA_TREASURY = Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH');
const FA_POOL = Address.parse('UQBZ8Lh9AuO1e9XcFBJ0NmE10IY9FoVpQeoABd9V5ninPATH');

const ticketData = (owner: Address) => beginCell().storeUint(0, 1).storeAddress(owner).endCell();

async function deploySink(bc: Blockchain, opts: { bind?: boolean } = {}) {
  const sink = bc.openContract(await FeeAccumulator.fromInit(FA_TREASURY, FA_BUYBACK));
  const funder = await bc.treasury('sink-funder');
  await sink.send(funder.getSender(), { value: toNano('1') }, { $$type: 'TopUpStorageReserve' } as any);
  if (opts.bind === false) return sink;

  const gov = bc.sender(FA_TREASURY);
  const send = (body: any) => sink.send(gov, { value: toNano('0.1') }, body);
  await send({ $$type: 'BindShardCode', shard_code: (await RecordShard.init(1n, 1n)).code } as any);
  await send({ $$type: 'BindIntroShardCode', intro_shard_code: (await IntroShard.init(1n, 1n)).code } as any);
  await send({ $$type: 'BindTicketCode', ticket_code: (await AirdropTicket.init(FA_TREASURY)).code } as any);
  await send({ $$type: 'BindAirdropPool', airdrop_pool_address: FA_POOL } as any);
  return sink;
}

async function creditsOf(bc: Blockchain, owner: Address) {
  const addr = contractAddress(0, { code: (await AirdropTicket.init(FA_TREASURY)).code, data: ticketData(owner) });
  if ((await bc.getContract(addr)).accountState?.type !== 'active') return 0n;
  return (await bc.openContract(AirdropTicket.fromAddress(addr)).getGetTicket()).credits;
}

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

    expect((await sink.getGetState()).accumulated_ton - before, 'the pool books the fee whole')
      .toBe(5n * PROTOCOL_FEE);
    expect((await shard.getGetView()).record_count).toBe(5n);
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
    expect(await creditsOf(bc, payer.address), 'INTRO capsules earn the same credit').toBe(5n);
  }, 300_000);

  it('PT-03: the shard holds ONLY its rent — no fee sits in it', async () => {
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
    expect(mirrors[0], 'both lanes must carry the same deposit reserve').toBe(mirrors[1]);

    const creditValue = /FEEACCUMULATOR_TICKET_CREDIT_VALUE:\s*Int\s*=\s*(\d+)/.exec(fa)?.[1];
    expect(Number(capsuleReserve), 'the reserve must cover the deposit execution plus the credit it carries')
      .toBeGreaterThanOrEqual(199_068 + Number(creditValue));
  });

  it('PT-04c: MEASURED — the sink does not lose money on a capsule, credit and all', async () => {
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

    expect((await shard.getGetView()).record_count, 'the publish itself still succeeded').toBe(1n);
    expect((await bc.getContract(shard.address)).balance, 'the refused fee is held, not lost')
      .toBeGreaterThan(PROTOCOL_FEE);
  }, 300_000);

  it('PT-04b: the hardcoded sink address IS the current FeeAccumulator — this exact bug already happened', async () => {
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
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deploySink(bc);

    const n = 20;
    await publishConv(bc, n, 0x91);
    const booked = (await sink.getGetState()).accumulated_ton;
    expect(booked, 'the principal is booked whole').toBe(BigInt(n) * PROTOCOL_FEE);

    const anyone = await bc.treasury('pt09-passerby');
    await sink.send(anyone.getSender(), { value: toNano('0.05') }, { $$type: 'SweepUnaccounted' } as any);
    const swept = (await sink.getGetState()).accumulated_ton - booked;
    expect(swept, 'the unburnt part of each deposit reserve is reclaimed').toBeGreaterThan(0n);

    const r2 = await sink.send(anyone.getSender(), { value: toNano('0.05') }, { $$type: 'SweepUnaccounted' } as any);
    const secondTx = (r2.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(sink.address));
    expect(secondTx?.description?.computePhase?.exitCode, 'a second sweep finds no surplus and refuses').toBe(15040);
    expect((await sink.getGetState()).accumulated_ton - booked, 'and credits nothing more').toBe(swept);

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
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deploySink(bc);
    const { shard } = await publishConv(bc, 8, 0x61);
    const booked = (await sink.getGetState()).accumulated_ton;

    bc.now = Number((await shard.getGetView()).retire_at) + 1;
    const keeper = await bc.treasury('pt07-keeper');
    const b = (await bc.getContract(keeper.address)).balance;
    await shard.send(keeper.getSender(), { value: toNano('0.5') }, { $$type: 'RetireShard' } as any);
    const net = (await bc.getContract(keeper.address)).balance - b;

    expect(net, 'retiring the shard still pays its caller').toBeGreaterThan(0n);
    expect((await sink.getGetState()).accumulated_ton, 'retirement moves no protocol money at all').toBe(booked);
    expect((await bc.getContract(shard.address)).accountState?.type, 'and the account is gone').not.toBe('active');
  }, 600_000);

  it('PT-08: the publish minimum as quoted — 0.0156 CONV, 0.01531 INTRO', async () => {
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
