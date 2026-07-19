import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { toNano, beginCell, contractAddress, Address } from '@ton/core';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { buildIntroPublish, buildConvPublish } from '../web/publish-builder.mjs';
import { epochOf } from '../web/shard-discovery.mjs';
import { ed25519 } from '@noble/curves/ed25519.js';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// SHARD-FEE-OUTLET — the 0.01 GRAM per-capsule fee must be able to LEAVE the shard.
//
// The fee is not a revenue line, it is the mechanism that funds the pool's TON side: 15,000,000 ATH of airdrop
// at 10 ATH per capsule is 1,500,000 capsules, at 0.01 GRAM each that is exactly the 15,000 GRAM paired against
// the 15,000,000 ATH liquidity allocation. Before this, accrued_fee only ever grew and was only ever reserved —
// an immutable contract would have immured the entire pool across millions of shards.
//
// THE DEFECT THIS FILE EXISTS TO PREVENT. A design panel of four proposals and twelve reading judges scored a
// winner; three attackers then COMPILED it and broke it fatally. It placed the explicit fee send ahead of the
// mode-128 payout with only a `keep < 0` clamp behind it. The clamp does not hold the send back — it merely lets
// the reserve collapse to zero, after which the fee is drawn from the CALLER's attached value. And an
// ACTION-phase failure does not bounce, so the shard would silently absorb a stranger's money. Twelve judges
// reading the code scored it highest; the three who ran it killed it. ATTACK-01/02 below are that attack.
//
// The fix is that affordability is decided in COMPUTE: a shard that cannot afford the remit does not remit.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const cell = (f: number) => beginCell().storeBuffer(Buffer.alloc(64, f)).endCell();

// After the Apr-2026 config-18 switch — before it a cell-year costs 240631 instead of 64962 and every rent
// figure below would be mispriced.
const CLOCK = 1_790_000_000;

const RS_EVICT_BOUNTY = 800_000n;
const IS_EVICT_BOUNTY = 900_000n;
const PROTOCOL_FEE = 10_000_000n;
// What the fee pays for its own extraction: FeeAccumulator's immutable 2_000_000 deposit gate (which settles
// into the sink's balance rather than into accumulated_ton) plus 500_000 of forward-fee reserve. Per SHARD, not
// per capsule. The pool therefore books collected - REMIT_OVERHEAD for every shard that is ever swept.
const REMIT_OVERHEAD = 2_500_000n;

/** What FeeAccumulator books when a shard holding `n` capsules' worth of fee is swept. */
const booked = (n: number) => BigInt(n) * PROTOCOL_FEE - REMIT_OVERHEAD;

// The owner's two wallets that fix FeeAccumulator's address, straight from
// artifacts/deployment_manifest_implemented_subset_m15.json.
const FA_TREASURY = Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH');
const FA_BUYBACK = Address.parse('UQBoOuHT0NhmZfHbm_wOquj3hA1BYUO84EKoqQ-X85UrLYgj');

async function feeAccumulatorAddress(): Promise<Address> {
  return contractAddress(0, await FeeAccumulator.init(FA_TREASURY, FA_BUYBACK));
}

/**
 * Deploy the real FeeAccumulator at its deterministic address, which is what the shards' constant points at.
 * fromInit, not fromAddress: without the StateInit the account is never created, every deposit lands on an
 * uninitialised account and bounces. That mistake made three tests here fail at once and is worth naming — it
 * is the same silent-success family the shard code warns about.
 */
async function deploySink(bc: Blockchain) {
  const sink = bc.openContract(await FeeAccumulator.fromInit(FA_TREASURY, FA_BUYBACK));
  const funder = await bc.treasury('sink-funder');
  await sink.send(
    funder.getSender(),
    { value: toNano('1') },
    { $$type: 'TopUpStorageReserve' } as any,
  );
  expect(sink.address.toRawString(), 'the deployed sink must be at the address the shards target')
    .toBe((await feeAccumulatorAddress()).toRawString());
  return sink;
}

/** Fill a CONV shard with `n` records and return its handle. */
async function fillConv(bc: Blockchain, n: number, seed: number) {
  const epoch = epochOf(bc.now!);
  const payer = await bc.treasury(`conv-payer-${seed}`);
  const secret = new Uint8Array(32).fill(seed);
  const publicKey = ed25519.getPublicKey(secret);
  let to: any = null;
  for (let i = 0; i < n; i += 1) {
    const b = await buildConvPublish({
      writePublicKey: publicKey, writeSecret: secret, seq: BigInt(i + 1), epoch,
      header0: cell(i & 255), header1: cell((i + 1) & 255), body: cell((i + 2) & 255),
      value: toNano('0.05'),
    });
    to = b.to;
    await payer.send({ to: b.to, value: b.value, body: b.body, init: b.init, bounce: true } as any);
  }
  return bc.openContract(RecordShard.fromAddress(to));
}

/** Fill an INTRO shard with `n` intros and return its handle. */
async function fillIntro(bc: Blockchain, n: number, bucket: bigint) {
  const epoch = epochOf(bc.now!);
  const payer = await bc.treasury(`intro-payer-${bucket}`);
  for (let i = 0; i < n; i += 1) {
    const b = await buildIntroPublish({
      epoch, bucket, r: BigInt(i + 1), viewTag: BigInt(i),
      header0: cell(i & 255), body: cell((i + 1) & 255), value: toNano('0.05'),
    });
    await payer.send({ to: b.to, value: b.value, body: b.body, init: b.init, bounce: true } as any);
  }
  return bc.openContract(
    IntroShard.fromAddress(contractAddress(0, await IntroShard.init(BigInt(epoch), bucket))),
  );
}

describe('SHARD-FEE-OUTLET — the protocol fee can leave the shard, and only the shard pays for it', () => {
  it('PIN-01: the hardcoded sink equals a fresh derivation of FeeAccumulator from the owner wallets', async () => {
    // The address is a CONSTANT in immutable contract code, so getting it wrong is unrecoverable and silent:
    // real money would be routed into a dead address a year after genesis. FeeAccumulator.init takes only
    // (treasury_receiver, buyback_burn) — no deployment_id — so the address is a pure function of its code and
    // those two wallets, and can be re-derived here. If FeeAccumulator's code or either wallet ever changes,
    // this fails loudly at build time instead of quietly on mainnet.
    const derived = await feeAccumulatorAddress();
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const conv = await fillConv(bc, 1, 0x11);
    const intro = await fillIntro(bc, 1, 1n);

    expect((await conv.getGetView()).fee_sink.toRawString(), 'RS_FEE_SINK must be the real FeeAccumulator')
      .toBe(derived.toRawString());
    expect((await intro.getGetView()).fee_sink.toRawString(), 'IS_FEE_SINK must be the real FeeAccumulator')
      .toBe(derived.toRawString());
    // And it must agree with the address recorded in the deployment manifest.
    expect(derived.toRawString())
      .toBe('0:126ccfbbfbe08845584b512bd3f44e495714f0511436d00a00a8d8fd20f3fe3e');
  }, 120_000);

  it('PIN-02: the release documents state the same per-shard deduction the contracts actually take', async () => {
    // The pool's TON side is an owner-frozen figure, and the deduction below is the only thing standing between
    // "15,000 GRAM collected" and what FeeAccumulator really books. Release prose that drifts from the contract
    // here is exactly how a stale line ends up driving a decision — it has already happened once on this file's
    // subject, when a superseded runbook sentence about treasury top-ups was taken as current.
    const { readFileSync } = await import('node:fs');
    for (const doc of ['DEPLOYMENT_RUNBOOK.md', 'MAINNET_RELEASE_CHECKLIST.md']) {
      const text = readFileSync(doc, 'utf8');
      expect(text, `${doc} must state the per-shard deduction`).toMatch(/2,500,000/);
      expect(text, `${doc} must say it is per SHARD, not per capsule`).toMatch(/per SHARD/);
    }
    // And the figure must be what the contracts do, proved by a real sweep rather than by reading a constant.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deploySink(bc);
    const shard = await fillConv(bc, 4, 0xB1);
    bc.now = bc.now! + 31536000 + 86400;
    const k = await bc.treasury('pin02');
    await shard.send(k.getSender(), { value: toNano('0.5') }, { $$type: 'EvictRecords', max_count: 4n } as any);
    const collected = 4n * PROTOCOL_FEE;
    expect(collected - (await sink.getGetState()).accumulated_ton, 'the documented deduction is the real one')
      .toBe(2_500_000n);
  }, 300_000);

  it('OUT-01: a swept CONV shard deposits its whole accrued fee into FeeAccumulator, accounted', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deploySink(bc);
    const before = (await sink.getGetState()).accumulated_ton;

    const n = 32;
    const shard = await fillConv(bc, n, 0x21);
    expect((await shard.getGetView()).accrued_fee).toBe(BigInt(n) * PROTOCOL_FEE);

    bc.now = bc.now! + 31536000 + 86400;
    const keeper = await bc.treasury('out01-keeper');
    await shard.send(keeper.getSender(), { value: toNano('0.5') }, { $$type: 'EvictRecords', max_count: BigInt(n) } as any);

    expect((await shard.getGetView()).accrued_fee, 'the shard no longer holds the fee').toBe(0n);
    // ACCOUNTED, not merely delivered. FeeAccumulator.receive() throws 15099 on an empty transfer, so a plain
    // value send would have landed as unaccounted balance with no withdrawal path — the exact defect m31 fixed
    // in CapsuleHub.FlushFees. Only accumulated_ton proves the deposit was booked.
    expect((await sink.getGetState()).accumulated_ton - before, 'the pool was credited the fee less its transfer cost')
      .toBe(booked(n));
  }, 300_000);

  it('OUT-02: a swept INTRO shard deposits its whole accrued fee into FeeAccumulator, accounted', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deploySink(bc);
    const before = (await sink.getGetState()).accumulated_ton;

    const n = 32;
    const shard = await fillIntro(bc, n, 7n);
    expect((await shard.getGetView()).accrued_fee).toBe(BigInt(n) * PROTOCOL_FEE);

    bc.now = bc.now! + 604800 + 86400;
    const keeper = await bc.treasury('out02-keeper');
    await shard.send(keeper.getSender(), { value: toNano('0.5') }, { $$type: 'EvictIntros', max_count: BigInt(n) } as any);

    expect((await shard.getGetView()).accrued_fee).toBe(0n);
    expect((await sink.getGetState()).accumulated_ton - before).toBe(booked(n));
  }, 300_000);

  it('OUT-08: remitting must never strand the NEXT evictor — the bounties the shard still owes outrank the fee', async () => {
    // WRITTEN BECAUSE A MUTATION SURVIVED. Replacing the guard `original - payout - accrued_fee >= accrued_bounty`
    // with `>= 0` left all seventeen other tests green, which means the solvency term was decoration. It is not:
    // RS_EVICT_CAP bounds one sweep at 64 records, so a large shard is swept by SEVERAL callers in turn. If the
    // first sweep hands the fee over while the shard still owes bounties for the records left behind, the next
    // caller is underpaid, stops calling, and the remaining records are never evicted — trading a funded fee
    // outlet for the unbounded state that the bounty exists to prevent.
    //
    // The invariant is asserted DIRECTLY — the shard's balance after a partial sweep must still cover every
    // bounty it owes. Two earlier forms of this test failed to kill the mutation and both are worth recording:
    //   - measuring the second evictor's NET is confounded by dictionary depth (the first sweep works a
    //     128-entry dict, the second a 64-entry one), the same confound that produced a false attack report
    //     in ATTACK-01;
    //   - and the second evictor can still come out ahead while being underpaid, because the clamp hands them
    //     whatever is left rather than nothing, so `net > 0` is simply not the property.
    // The bite is also NARROW: the guard only differs from `>= 0` when the shard can afford the fee but not the
    // fee AND the outstanding bounties. Around a year the shard is rich enough for both; past about four years
    // it cannot afford the fee at all and every version refuses. A spread of [1, 5, 12, 25] therefore missed it
    // entirely and the mutation survived twice.
    for (const idleYears of [1, 2, 3, 4]) {
      const bc = await Blockchain.create();
      bc.now = CLOCK;
      await deploySink(bc);
      const shard = await fillConv(bc, 128, 0xA0 + idleYears);
      bc.now = bc.now! + 31536000 * idleYears + 86400;

      const first = await bc.treasury(`out08-first-${idleYears}`);
      const fb = (await bc.getContract(first.address)).balance;
      await shard.send(first.getSender(), { value: toNano('1') }, { $$type: 'EvictRecords', max_count: 64n } as any);
      const firstNet = (await bc.getContract(first.address)).balance - fb;

      const view = await shard.getGetView();
      const held = (await bc.getContract(shard.address)).balance;
      const remitted = view.accrued_fee === 0n;

      expect(firstNet, `${idleYears}y: the first evictor must be paid`).toBeGreaterThan(0n);
      expect(view.live_count, `${idleYears}y: 64 records remain for the next caller`).toBe(64n);
      // THE LOAD-BEARING ASSERTION. Whatever the first sweep decided about the fee, what it left behind must
      // still honour the bounties owed to whoever sweeps the rest.
      expect(
        held,
        `${idleYears}y: the remit stranded the next evictor — shard holds ${held} but owes ${view.accrued_bounty} in bounties (remitted=${remitted})`,
      ).toBeGreaterThanOrEqual(view.accrued_bounty);
    }
  }, 1_800_000);

  it('OUT-06: the outlet works at EVERY shard size, which the first revision did not', async () => {
    // The version this replaces charged the transfer overhead to the shard's spare balance, and MEASURED that
    // spare balance is far too small: CONV holds 736_636 above its fee at one record and 3_978_604 at 32, while
    // INTRO — whose endowment covers one WEEK — holds ~965_285 at one intro and still only 1_200_181 at 64.
    // Against a 4_000_000 overhead the fee could not leave an IntroShard of ANY size, and left CONV only from
    // about 64 records upward. A test that only exercised a big shard would have shipped that.
    for (const n of [1, 2, 8]) {
      const bc = await Blockchain.create();
      bc.now = CLOCK;
      const sink = await deploySink(bc);
      const base = (await sink.getGetState()).accumulated_ton;

      const conv = await fillConv(bc, n, 0x80 + n);
      const intro = await fillIntro(bc, n, BigInt(200 + n));

      // EACH LANE IS SWEPT AT ITS OWN RETENTION, and getting this wrong once already produced a false failure:
      // an IntroShard is endowed for ONE WEEK (IS_INTRO_ENDOWMENT covers 7/365 of a cell-year), so holding it
      // for a year leaves it genuinely rent-starved and unable to remit. That is correct contract behaviour,
      // not a defect — the test was simply asking the wrong question.
      const k = await bc.treasury(`out06-${n}`);
      bc.now = bc.now! + 604800 + 86400;                       // past the INTRO week
      await intro.send(k.getSender(), { value: toNano('0.5') }, { $$type: 'EvictIntros', max_count: BigInt(n) } as any);
      bc.now = bc.now! + 31536000;                              // and on past the CONV year
      await conv.send(k.getSender(), { value: toNano('0.5') }, { $$type: 'EvictRecords', max_count: BigInt(n) } as any);

      expect((await conv.getGetView()).accrued_fee, `CONV n=${n}: the fee must leave a small shard too`).toBe(0n);
      expect((await intro.getGetView()).accrued_fee, `INTRO n=${n}: the fee must leave a small shard too`).toBe(0n);
      expect((await sink.getGetState()).accumulated_ton - base, `n=${n}: both lanes booked`)
        .toBe(booked(n) * 2n);
    }
  }, 900_000);

  it('OUT-07: a ONE-entry shard is at the edge of being worth sweeping — the open recalibration, pinned', async () => {
    // NOT an assertion that the economics are fine. They are not, and this pin says so with numbers.
    //
    // RS_EVICT_BOUNTY (800_000) and IS_EVICT_BOUNTY (900_000) were calibrated from 64 entries upward, where the
    // call's fixed overhead is amortised. At ONE entry it is not, and the fixed cost of an eviction transaction
    // is roughly 1_150_000 — more than the single bounty it releases. MEASURED 2026-07-19 with the sink live:
    //   CONV, swept one day past retention:   +35_928     (only because the unused forward reserve comes back)
    //   CONV, swept eight days past:          -353_845    (the extra rent pushes it below the remit's solvency
    //                                                      test, so that reserve is not returned either)
    //   INTRO, swept one day past retention: +133_795
    // For comparison, the same one-record CONV sweep netted -229_604 BEFORE this change, when the fee had no way
    // out at all — so the outlet improved the small end rather than causing this. The cause is the bounty.
    //
    // The consequence is real: a rational participant sweeps large shards and leaves one-entry shards standing,
    // and a shard that is never swept never remits its fee. Raising the bounty is the fix, and it is an OWNER
    // decision because the bounty is pre-funded at publish — roughly doubling it would raise the minimum publish
    // from 13_600_000 to about 14_500_000. Until then this pins the magnitude so it cannot drift unnoticed.
    const oneEntry = async (lane: 'conv' | 'intro') => {
      const bc = await Blockchain.create();
      bc.now = CLOCK;
      const sink = await deploySink(bc);
      const base = (await sink.getGetState()).accumulated_ton;
      const shard = lane === 'conv' ? await fillConv(bc, 1, 0x91) : await fillIntro(bc, 1, 301n);
      bc.now = bc.now! + (lane === 'conv' ? 31536000 : 604800) + 86400;

      const k = await bc.treasury(`out07-${lane}`);
      const before = (await bc.getContract(k.address)).balance;
      await (lane === 'conv'
        ? (shard as any).send(k.getSender(), { value: toNano('0.5') }, { $$type: 'EvictRecords', max_count: 1n })
        : (shard as any).send(k.getSender(), { value: toNano('0.5') }, { $$type: 'EvictIntros', max_count: 1n }));
      return {
        net: (await bc.getContract(k.address)).balance - before,
        booked: (await sink.getGetState()).accumulated_ton - base,
      };
    };

    const conv = await oneEntry('conv');
    const intro = await oneEntry('intro');

    // The fee must still get out of a one-entry shard — that is the property this change is responsible for.
    expect(conv.booked, 'a one-record CONV shard still remits').toBe(booked(1));
    expect(intro.booked, 'a one-intro INTRO shard still remits').toBe(booked(1));

    // And the sweep must not be RUINOUS, even where it is unprofitable: the loss is bounded by the call's fixed
    // overhead, not by anything the shard can take from the caller. A regression that billed the caller would
    // blow through this by two orders of magnitude.
    for (const [label, r] of [['CONV', conv], ['INTRO', intro]] as const) {
      expect(r.net, `${label} one-entry sweep loss must stay bounded (net ${r.net})`).toBeGreaterThan(-2_000_000n);
    }
    console.log(`  [OUT-07] one-entry sweep net — CONV ${conv.net}, INTRO ${intro.net} (bounties ${RS_EVICT_BOUNTY}/${IS_EVICT_BOUNTY})`);
  }, 300_000);

  it('ATTACK-01: the evictor does NOT pay for the remit — this is the attack that killed the panel winner', async () => {
    // The defect: the fee left through an explicit send that the CALLER ultimately funded, because a `keep < 0`
    // clamp does not hold the send back — it only lets the reserve collapse, after which the money is drawn
    // from the attached value. Here the fee is 640_000_000, so if it were being billed the evictor would come
    // back roughly 615_000_000 in the red. The bar below is therefore not delicate; it is unmissable.
    //
    // AN EARLIER FORM OF THIS TEST WAS WRONG AND IS WORTH RECORDING. It compared a remitting sweep against a
    // non-remitting one on a pre-drained shard and flagged a 1_089_068 shortfall as billing. It was not: the
    // two runs sweep dictionaries of DIFFERENT DEPTH (64 live entries versus 32), and marginal gas per evicted
    // record grows with depth — the project already measured 283_082 per record at 64 versus 533_186 at 4096.
    // The comparison was uncontrolled, so it measured the depth curve and called it an attack. Judging against
    // the caller's own entitlement needs no control group at all.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deploySink(bc);
    const base = (await sink.getGetState()).accumulated_ton;
    const shard = await fillConv(bc, 64, 0x31);
    bc.now = bc.now! + 31536000 + 86400;

    const keeper = await bc.treasury('atk01-keeper');
    const before = (await bc.getContract(keeper.address)).balance;
    await shard.send(keeper.getSender(), { value: toNano('0.5') }, { $$type: 'EvictRecords', max_count: 32n } as any);
    const net = (await bc.getContract(keeper.address)).balance - before;

    // The remit really did happen in this very transaction — otherwise the assertion below proves nothing.
    expect((await sink.getGetState()).accumulated_ton - base, 'the fee moved during the measured sweep')
      .toBe(booked(64));

    const payout = 32n * RS_EVICT_BOUNTY;
    // Worst-case sweep gas the project has measured is 533_186 per record (at the 4096 SAFE_CAP); allow it in
    // full plus a whole GRAM of slack. Anything that bills the 640_000_000 fee to the caller lands far below.
    const gasCeiling = 32n * 533_186n + 1_000_000n;
    expect(net, 'a sweep that remits must still pay its caller').toBeGreaterThan(0n);
    expect(net, `the evictor was billed for the remit: net ${net} against an entitlement of ${payout}`)
      .toBeGreaterThan(payout - gasCeiling);
  }, 600_000);

  it('ATTACK-02: a shard too poor to remit refuses in COMPUTE, and the refusal costs the evictor nothing', async () => {
    // The graceful-degradation half of the same attack, and the branch that the clamp-based design got fatally
    // wrong. A shard starved by years of rent cannot afford to hand the fee over. The refusal must be silent
    // and free: nothing aborts (an ACTION-phase failure does not bounce, so it would absorb the caller's value),
    // the caller is still paid, and the fee simply stays put.
    //
    // Starvation is produced by IDLE TIME, not by a small batch — an early draft of this test used max_count: 1
    // and never reached the refusal branch at all, because a full shard is RICH: it still holds every record's
    // endowment. The test asserted an invariant that held for the wrong reason, which is the failure mode this
    // whole file exists to avoid.
    const run = async (idleYears: number, seed: number) => {
      const bc = await Blockchain.create();
      bc.now = CLOCK;
      await deploySink(bc);
      const shard = await fillConv(bc, 64, seed);
      bc.now = bc.now! + 31536000 * idleYears + 86400;

      const keeper = await bc.treasury(`atk02-keeper-${idleYears}`);
      const before = (await bc.getContract(keeper.address)).balance;
      const r = await shard.send(keeper.getSender(), { value: toNano('0.5') }, { $$type: 'EvictRecords', max_count: 64n } as any);

      // Only the SHARD's own transaction may be judged here: a deposit to an account that legitimately bounces
      // is itself an "aborted" transaction, so counting every abort in the trace would be meaningless.
      const shardTxs = r.transactions.filter((t: any) => t.inMessage?.info?.dest?.equals?.(shard.address));
      return {
        net: (await bc.getContract(keeper.address)).balance - before,
        aborted: shardTxs.filter((t: any) => t.description?.aborted === true).length,
        feeLeft: (await shard.getGetView()).accrued_fee,
        live: (await shard.getGetView()).live_count,
      };
    };

    const rich = await run(1, 0x41);
    const starved = await run(30, 0x42);

    // The invariant holds on BOTH branches — that is the actual safety property.
    for (const [label, r] of [['rich', rich], ['starved', starved]] as const) {
      expect(r.aborted, `${label}: the shard transaction must not abort — an ACTION failure absorbs caller value`).toBe(0);
      expect(r.net, `${label}: the evictor must be paid`).toBeGreaterThan(0n);
      expect(r.live, `${label}: the sweep did its real work`).toBe(0n);
    }

    // And the refusal branch must actually be reachable, or the assertions above prove nothing about it.
    expect(rich.feeLeft, 'a solvent shard remits').toBe(0n);
    expect(starved.feeLeft, 'a starved shard keeps the fee rather than billing its evictor for it')
      .toBe(64n * PROTOCOL_FEE);
  }, 600_000);

  it('OUT-03: the remit is once-only — a second sweep sends nothing more', async () => {
    // accrued_fee is FINAL from epoch+2 because publish gate 13656 admits only epoch +/-1, so one outbound
    // message per shard is enough forever. A second remit would mean the fee was double-counted somewhere.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deploySink(bc);
    const base = (await sink.getGetState()).accumulated_ton;

    const shard = await fillConv(bc, 64, 0x51);
    bc.now = bc.now! + 31536000 + 86400;
    const keeper = await bc.treasury('out03-keeper');

    await shard.send(keeper.getSender(), { value: toNano('0.5') }, { $$type: 'EvictRecords', max_count: 32n } as any);
    const afterFirst = (await sink.getGetState()).accumulated_ton - base;
    expect(afterFirst, 'the first sweep past the window carries the whole final fee').toBe(booked(64));

    await shard.send(keeper.getSender(), { value: toNano('0.5') }, { $$type: 'EvictRecords', max_count: 32n } as any);
    expect((await sink.getGetState()).accumulated_ton - base, 'the second sweep must remit nothing').toBe(afterFirst);
    expect((await shard.getGetView()).live_count, 'the second sweep still did its real work').toBe(0n);
  }, 300_000);

  it('OUT-04: a bounced deposit restores the debt instead of destroying it', async () => {
    // If the sink refuses or is unreachable, the value comes back — and the accounting must come back with it,
    // or accrued_fee would read 0 while the money still sat in the shard, unaccounted and unsendable. Here the
    // sink is deliberately NOT deployed: a bounceable message to a never-deployed address bounces and returns
    // the value (measured behaviour this project already relies on for name defence).
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const shard = await fillConv(bc, 16, 0x61);      // no deploySink() on purpose
    bc.now = bc.now! + 31536000 + 86400;

    const keeper = await bc.treasury('out04-keeper');
    await shard.send(keeper.getSender(), { value: toNano('0.5') }, { $$type: 'EvictRecords', max_count: 16n } as any);

    // What comes back is the PRINCIPAL the sink would have booked — the transfer cost was really spent and is
    // not conjured back. Restoring more than that would let a shard mint fee out of a failed delivery.
    expect((await shard.getGetView()).accrued_fee, 'a bounced deposit must restore the booked principal')
      .toBe(booked(16));
  }, 300_000);

  it('OUT-05: the bounty is still solvent now that eviction sends a second message', async () => {
    // RS_EVICT_BOUNTY and IS_EVICT_BOUNTY were measured for a path with ONE outbound message. The remit adds a
    // second, so the calibration has to be re-proved rather than assumed — a sweep that stopped paying would
    // silently void the whole retention story.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deploySink(bc);

    const conv = await fillConv(bc, 64, 0x71);
    const intro = await fillIntro(bc, 64, 11n);
    bc.now = bc.now! + 31536000 + 86400;

    const k1 = await bc.treasury('out05-conv');
    const b1 = (await bc.getContract(k1.address)).balance;
    await conv.send(k1.getSender(), { value: toNano('0.5') }, { $$type: 'EvictRecords', max_count: 64n } as any);
    const convNet = (await bc.getContract(k1.address)).balance - b1;

    const k2 = await bc.treasury('out05-intro');
    const b2 = (await bc.getContract(k2.address)).balance;
    await intro.send(k2.getSender(), { value: toNano('0.5') }, { $$type: 'EvictIntros', max_count: 64n } as any);
    const introNet = (await bc.getContract(k2.address)).balance - b2;

    expect(convNet, 'a CONV sweep that also remits must still pay').toBeGreaterThan(0n);
    expect(introNet, 'an INTRO sweep that also remits must still pay').toBeGreaterThan(0n);
    // Report the margins so a future change that erodes them is visible in the run, not just pass/fail.
    console.log(`  [OUT-05] CONV net ${convNet} vs bounty ${64n * RS_EVICT_BOUNTY}; INTRO net ${introNet} vs bounty ${64n * IS_EVICT_BOUNTY}`);
  }, 600_000);
});
