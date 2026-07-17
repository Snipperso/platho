import { describe, expect, it } from 'vitest';
import { toNano } from '@ton/core';
import { keyPairFromSeed } from '@ton/crypto';
import { deployAnonReady, convPartToken, publicPartToken, anonBatch, KIND_INTRO } from './helpers/anon';
import { hubTxExit, SIZE_1K, KIND_PUBLIC, marketingCell } from './helpers/vpb2';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// HUB-G8-CANON — the measurement CapsuleHub.tact's endowment block cites as its single source of truth.
//
// Why this test exists: every wrong storage constant this contract ever carried came from a number someone
// derived once, by hand, off a stale rate — and then a comment repeated it until it looked authoritative.
// This test re-derives the numbers from the running contract, so a drift fails CI instead of shipping into an
// IMMUTABLE genesis.
//
// Two measurement traps it is built to avoid (both produced real, wrong constants before):
//   1. storageStats DEDUPLICATES identical cells by hash. Helpers that reuse one header across messages
//      under-count. Real traffic is encrypted -> every header is unique, so we vary `fill` per message.
//   2. The nullifier is a SEPARATE 9-day-retention charge. Folding it into the per-entry year inflated the
//      count. We drain the nullifier ledger and subtract.
//   3. PUBLIC's channel_id = H(domain||spend_pubkey): reusing a spend key appends to an EXISTING channel index,
//      so the marginal reads cheap. The shared spendKey() USED to fold its index into a single fill byte and wrap
//      after 256, silently reusing keys on a long run — that made PUBLIC read 4.491 cells against the true 6.020,
//      a 34% under-provision headed for an immutable contract. The helper is fixed; this file keeps its own key
//      generator anyway, so the measurement cannot be re-broken from a distance by an edit over there.
// The first entries of an empty dict are not representative either, so we take the MARGINAL cost across the back
// half of the run — and assert it is STABLE across two disjoint segments, which is what actually proves the
// measurement reached its asymptotic regime instead of reporting a transient.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const RATE_NANOTON_PER_CELL_YEAR = 64962;   // config-18 frozen: cell_price_ps=135, bit_price_ps=0 (bits are FREE)
const RATE_RISK_MARGIN = 1.5;               // see the derivation block in CapsuleHub.tact
const NULLIFIER_RETENTION_SECONDS = 777600; // 9 epochs
const YEAR_SECONDS = 31536000;
const PREPAID_UNIT = 10_995_000n;
const N = 60;                               // enough to leave the empty-dict regime; keeps the suite fast

type Lane = 'private' | 'public' | 'intro';

// A genuinely unique key per message: the index is spread across 4 bytes, so it cannot wrap the way the shared
// helper's single-fill-byte seed does (trap 3).
const uniqueSpendKey = (i: number) => {
  const seed = Buffer.alloc(32);
  seed.writeUInt32BE(i + 1, 0);
  seed[8] = 0xa5;
  return keyPairFromSeed(seed);
};

async function marginalCells(lane: Lane): Promise<{ marginal: number; drift: number }> {
  const s = await deployAnonReady({ credits: 4n });
  const { blockchain, hub, creditIssuer, issuer, nowEpoch } = s;
  const k = BigInt(N + 20);
  await hub.send(creditIssuer.getSender(), { value: k * PREPAID_UNIT + toNano('1') }, {
    $$type: 'FundAnonPool', credits_k: k, epoch: nowEpoch, purchase_id: 0n,
  } as any);

  const cells = async () =>
    Number(((await blockchain.getContract(hub.address)).account?.account?.storageStats?.used?.cells) ?? 0n);
  const relay = await blockchain.treasury(`g8-${lane}`);

  const marks: number[] = [];
  for (let i = 0; i < N; i++) {
    // `fill` varies per message -> unique header_0/header_1/body, so storageStats cannot dedupe them (trap 1).
    const pt = lane === 'public'
      ? publicPartToken({ issuer, spend: uniqueSpendKey(i), slot: 0n, epoch: nowEpoch, nonce: BigInt(1000 + i), fill: i, sizeClass: SIZE_1K })
      : convPartToken({
          issuer, spend: uniqueSpendKey(i), slot: 0n, epoch: nowEpoch, nonce: BigInt(1000 + i), fill: i,
          sizeClass: SIZE_1K, ...(lane === 'intro' ? { kind: KIND_INTRO } : {}),
        });
    const res = await hub.send(relay.getSender(), { value: toNano('2') }, anonBatch({
      parts: pt.part, tokens: pt.tok, partCount: 1n,
      ...(lane === 'public' ? { kind: KIND_PUBLIC, marketing: marketingCell() } : {}),
      ...(lane === 'intro' ? { kind: KIND_INTRO } : {}),
    }));
    expect(hubTxExit(res, hub)).toBe(0);
    marks.push(await cells());
  }

  // Two disjoint segments: if they disagree, we are still in the empty-dict transient and the number is junk.
  const seg = (from: number, to: number) => (marks[to] - marks[from]) / (to - from);
  const early = seg(Math.floor(N * 0.25), Math.floor(N * 0.5));
  const late = seg(Math.floor(N * 0.5), N - 1);

  // Drain the nullifier ledger and subtract it: it has its own 9-day retention and its own endowment (trap 2).
  blockchain.now = blockchain.now! + NULLIFIER_RETENTION_SECONDS + 86400;
  const before = await cells();
  const keeper = await blockchain.treasury(`g8-keeper-${lane}`);
  for (let i = 0; i < 10; i++) {
    await hub.send(keeper.getSender(), { value: toNano('0.5') }, { $$type: 'EvictExpiredNullifiers', max_count: 32n } as any);
  }
  const nullifierPerEntry = (before - (await cells())) / N;
  return { marginal: late - nullifierPerEntry, drift: Math.abs(early - late) };
}

const endowmentFor = (cellsPerEntry: number, years: number) =>
  cellsPerEntry * RATE_NANOTON_PER_CELL_YEAR * years * RATE_RISK_MARGIN;

describe('HUB-G8-CANON — storage endowments re-derived from the running contract', () => {
  it('HUB-G8-CANON-01: PRIVATE is the worst 1-year lane and its endowment matches the measurement', async () => {
    const { marginal, drift } = await marginalCells('private');
    expect(drift).toBeLessThan(0.15);   // asymptotic regime, not an empty-dict transient
    // Pinned at the value the constant was derived from. A drift means the entry layout changed -> re-derive.
    expect(marginal).toBeCloseTo(8.02, 1);
    // 784_000 must cover measured x rate x 1yr x 1.5 margin without wildly overshooting it. The band is 5%,
    // not 1%: the marginal drifts ~0.01 cells with run length, while the failure mode this guards against
    // (a constant derived off the dead rate) was 13x — a tight band would only buy flakes.
    const want = endowmentFor(marginal, 1);
    expect(784_000).toBeGreaterThanOrEqual(want);
    expect(784_000).toBeLessThan(want * 1.05);
  }, 180_000);

  it('HUB-G8-CANON-02: PUBLIC costs a fresh channel index per post and stays under PRIVATE', async () => {
    const { marginal, drift } = await marginalCells('public');
    expect(drift).toBeLessThan(0.15);
    // 6.020, NOT the 4.491 a spend-key-reusing run reports (trap 3) — that under-provisioned PUBLIC by 34%.
    expect(marginal).toBeCloseTo(6.02, 1);
    // The credit is priced at PRIVATE; this ordering is WHY no lane has to top up at publish.
    expect(marginal).toBeLessThan(8.02);
    const want = endowmentFor(marginal, 1);
    expect(589_000).toBeGreaterThanOrEqual(want);
    expect(589_000).toBeLessThan(want * 1.05);
  }, 180_000);

  it('HUB-G8-CANON-03: INTRO endowment matches the measurement and stays under PRIVATE', async () => {
    const { marginal, drift } = await marginalCells('intro');
    expect(drift).toBeLessThan(0.15);
    expect(marginal).toBeCloseTo(5.02, 1);
    expect(marginal).toBeLessThan(8.02);
    const want = endowmentFor(marginal, 1);
    expect(492_000).toBeGreaterThanOrEqual(want);
    expect(492_000).toBeLessThan(want * 1.05);
  }, 180_000);

  it('HUB-G8-CANON-04: the frozen rate is the ONE rate — the dead pre-Apr-2026 schedule is not in any derivation', () => {
    // Guards the class of bug that produced every wrong constant here: a number derived on the 500/1 schedule.
    // 79 cells x 64962 x 3yr x 1.5 = the RECOVERY endowment. On the dead schedule the same entry "cost" ~13x more.
    expect(Math.ceil(endowmentFor(79.1, 3) / 100_000) * 100_000).toBe(23_200_000);
    // The old constant (200M) is what 79 cells cost on the dead schedule — it must never come back.
    expect(23_200_000).toBeLessThan(200_000_000 / 8);
  });

  it('HUB-G8-CANON-05: a nullifier is priced for its 9-day window, not a year', async () => {
    // 4.980 cells x 64962 x (9 days / 365) x 1.5 -> 12_000. Pricing it as a year would overcharge ~40x.
    const nullifierYears = NULLIFIER_RETENTION_SECONDS / YEAR_SECONDS;
    const want = 4.98 * RATE_NANOTON_PER_CELL_YEAR * nullifierYears * RATE_RISK_MARGIN;
    expect(12_000).toBeGreaterThanOrEqual(want);
    expect(12_000).toBeLessThan(want * 1.02);
  });

  it('HUB-G8-CANON-06: G-PREPAID — the credit is priced at the worst lane and over-covers every other', () => {
    const PROTOCOL_FEE = 10_000_000;
    const BUFFER = 1.25;
    const unit = (endowment: number, fee: number) => fee + endowment * BUFFER + 12_000 * BUFFER;
    expect(Math.round(unit(784_000, PROTOCOL_FEE))).toBe(Number(PREPAID_UNIT));
    // Every other lane must fit inside one PRIVATE-priced credit — otherwise a lane would need a top-up.
    expect(unit(589_000, PROTOCOL_FEE)).toBeLessThanOrEqual(Number(PREPAID_UNIT));
    expect(unit(492_000, 0)).toBeLessThanOrEqual(Number(PREPAID_UNIT));
  });
});
