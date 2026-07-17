import { describe, expect, it } from 'vitest';
import { toNano } from '@ton/core';
import { keyPairFromSeed } from '@ton/crypto';
import { deployAnonReady, convPartToken, publicPartToken, anonBatch, EPOCH_SECONDS, PartToken } from './helpers/anon';
import { hubTxExit, SIZE_32K, KIND_PUBLIC, marketingCell } from './helpers/vpb2';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// HUB-GAS-DEGRADE — what MAX_BATCH_PARTS_ANON=4 actually rests on.
//
// The seal gate (HUB-PERM-04) measures a batch on an EMPTY Hub and reports ~62% of the gas limit. Both of its
// assumptions are false in production:
//   1. It rebuilds the Hub per measurement, so there are ZERO live entries and auto-eviction never runs. Eviction
//      is the dominant per-part cost once entries outlive retention — and it only starts a YEAR after launch.
//   2. It measures PUBLIC. CONV is the dearer lane by a flat ~84_737 gas (bigger body overhead + TWO headers).
// So the real steady-state figure is ~96-98% of the limit, not 62%, and the "38% headroom" the constant was
// justified with does not exist.
//
// The constant is nonetheless SAFE, but for a reason nothing tested: an out-of-gas batch REVERTS COMPLETELY —
// the spend tokens are not consumed, so the relay simply re-sends the same capsules in smaller batches. The cap
// is a CEILING, not a mandate: the relay may always choose n=1, which never approaches the limit. That property
// is what makes an irreversible 4 acceptable, so it is pinned here rather than assumed.
//
// Gas depends on the NULLIFIER dict (9-day retention), i.e. on the message RATE — not on accumulated entries.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const PREPAID_UNIT = 10_995_000n;
const YEAR_SECONDS = 31536000;
const GAS_LIMIT = 1_000_000;

const uniqueSpendKey = (i: number) => {
  const seed = Buffer.alloc(32);
  seed.writeUInt32BE(i + 1, 0);
  seed[8] = 0x5a;
  return keyPairFromSeed(seed);
};

async function stand(prefill: number) {
  const s = await deployAnonReady({ credits: 4n });
  const { blockchain, hub, creditIssuer, issuer } = s;
  const fund = (k: number, epoch: bigint) =>
    hub.send(creditIssuer.getSender(), { value: BigInt(k) * PREPAID_UNIT + toNano('2') }, {
      $$type: 'FundAnonPool', credits_k: BigInt(k), epoch, purchase_id: 0n,
    } as any);
  await fund(prefill + 40, s.nowEpoch);
  const relay = await blockchain.treasury('degrade-relay');

  // Fill the Hub so the dicts have real depth AND there is expired material for eviction to chew on.
  for (let i = 0; i < prefill; i++) {
    const pt = convPartToken({
      issuer, spend: uniqueSpendKey(i), slot: 0n, epoch: s.nowEpoch, nonce: BigInt(5000 + i),
      fill: i % 200, sizeClass: SIZE_32K,
    });
    const r = await hub.send(relay.getSender(), { value: toNano('2') }, anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n }));
    expect(hubTxExit(r, hub)).toBe(0);
  }

  // Past retention -> every prefilled entry is now expired, so a publish inserts n AND evicts n (steady state).
  blockchain.now = blockchain.now! + YEAR_SECONDS + 86400;
  const epoch = BigInt(Math.floor(blockchain.now! / EPOCH_SECONDS));
  await fund(60, epoch);   // credits are epoch-bound: fund the NEW epoch
  return { ...s, relay, epoch, fund };
}

function hubGas(res: any, hub: any): number {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === hub.address.toString());
  return Number(tx?.description?.computePhase?.gasUsed ?? 0);
}

describe('HUB-GAS-DEGRADE — the real basis for the irreversible batch cap', () => {
  it('HUB-GAS-DEGRADE-01: an over-limit batch REVERTS and its tokens survive — the relay retries smaller', async () => {
    // THE load-bearing property. If a failed batch consumed its tokens, an out-of-gas batch would destroy paid
    // credits and the cap really would need to be conservative. It does not: state rolls back entirely.
    const s = await deployAnonReady({ credits: 4n });
    const { blockchain, hub, creditIssuer, issuer, nowEpoch } = s;
    await hub.send(creditIssuer.getSender(), { value: 40n * PREPAID_UNIT + toNano('2') }, {
      $$type: 'FundAnonPool', credits_k: 40n, epoch: nowEpoch, purchase_id: 0n,
    } as any);
    const relay = await blockchain.treasury('revert-relay');

    // Build one 4-part CONV batch, then send it with a gas budget too small to finish it.
    const build = () => {
      let chain: PartToken | null = null;
      for (let i = 3; i >= 0; i--) {
        chain = convPartToken({
          issuer, spend: uniqueSpendKey(700 + i), slot: 0n, epoch: nowEpoch, nonce: BigInt(7000 + i),
          fill: i, sizeClass: SIZE_32K, next: chain,
        });
      }
      return chain!;
    };
    const chain = build();
    const before = await hub.getGetState();

    const starved = await hub.send(relay.getSender(), { value: toNano('0.02') }, anonBatch({
      parts: chain.part, tokens: chain.tok, partCount: 4n,
    }));
    expect(hubTxExit(starved, hub)).not.toBe(0);          // it failed...
    const after = await hub.getGetState();
    expect(after.private_live_count).toBe(before.private_live_count);   // ...and stored nothing

    // The SAME capsules now land as four 1-part batches: the tokens were never consumed by the failed attempt.
    for (let i = 0; i < 4; i++) {
      const pt = convPartToken({
        issuer, spend: uniqueSpendKey(700 + i), slot: 0n, epoch: nowEpoch, nonce: BigInt(7000 + i),
        fill: i, sizeClass: SIZE_32K,
      });
      const r = await hub.send(relay.getSender(), { value: toNano('2') }, anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n }));
      expect(hubTxExit(r, hub)).toBe(0);
    }
    expect((await hub.getGetState()).private_live_count).toBe(before.private_live_count + 4n);
  }, 240_000);

  it('HUB-GAS-DEGRADE-02: a LANDED token is truly burnt — the retry above was a real re-spend, not a no-op', async () => {
    // Control for -01: proves the nullifier ledger is actually load-bearing, so -01's success cannot be explained
    // by "the token was never checked in the first place".
    const s = await deployAnonReady({ credits: 4n });
    const { blockchain, hub, creditIssuer, issuer, nowEpoch } = s;
    await hub.send(creditIssuer.getSender(), { value: 20n * PREPAID_UNIT + toNano('2') }, {
      $$type: 'FundAnonPool', credits_k: 20n, epoch: nowEpoch, purchase_id: 0n,
    } as any);
    const relay = await blockchain.treasury('burn-relay');
    const mk = () => convPartToken({
      issuer, spend: uniqueSpendKey(800), slot: 0n, epoch: nowEpoch, nonce: 8000n, fill: 5, sizeClass: SIZE_32K,
    });
    const first = mk();
    expect(hubTxExit(await hub.send(relay.getSender(), { value: toNano('2') },
      anonBatch({ parts: first.part, tokens: first.tok, partCount: 1n })), hub)).toBe(0);
    const again = mk();
    expect(hubTxExit(await hub.send(relay.getSender(), { value: toNano('2') },
      anonBatch({ parts: again.part, tokens: again.tok, partCount: 1n })), hub)).toBe(13604);   // already spent
  }, 240_000);

  it('HUB-GAS-DEGRADE-03: n=1 never approaches the gas limit — the relay always has a safe fallback', async () => {
    // The second reason the irreversible 4 is safe: part_count>=1 is always legal and cheap. Whatever the cap says,
    // a relay under gas pressure can fall back to 1 forever.
    const s = await stand(60);
    const pt = convPartToken({
      issuer: s.issuer, spend: uniqueSpendKey(900), slot: 0n, epoch: s.epoch, nonce: 9000n, fill: 7, sizeClass: SIZE_32K,
    });
    const res = await s.hub.send(s.relay.getSender(), { value: toNano('4') },
      anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n }));
    expect(hubTxExit(res, s.hub)).toBe(0);
    expect(hubGas(res, s.hub)).toBeLessThan(GAS_LIMIT / 2);   // measured ~32%; a wide margin, not a knife-edge
  }, 240_000);

  it('HUB-GAS-DEGRADE-04: steady-state 4-part gas is FAR above the empty-Hub gate figure (documents the real margin)', async () => {
    // Pins the correction itself. The seal gate reports ~62% on an empty Hub; with eviction running, a 4-part CONV
    // batch sits far higher. This test exists so nobody re-derives a "38% headroom" claim from the empty-Hub number.
    const s = await stand(60);
    let chain: PartToken | null = null;
    for (let i = 3; i >= 0; i--) {
      chain = convPartToken({
        issuer: s.issuer, spend: uniqueSpendKey(950 + i), slot: 0n, epoch: s.epoch, nonce: BigInt(9500 + i),
        fill: i, sizeClass: SIZE_32K, next: chain,
      });
    }
    const res = await s.hub.send(s.relay.getSender(), { value: toNano('10') },
      anonBatch({ parts: chain!.part, tokens: chain!.tok, partCount: 4n }));
    expect(hubTxExit(res, s.hub)).toBe(0);
    const gas = hubGas(res, s.hub);
    // eslint-disable-next-line no-console
    console.log(`[HUB-GAS-DEGRADE] CONV 32K 4-part, steady state w/ eviction: gas=${gas} (${(gas / 10000).toFixed(1)}% of limit)`);
    // The empty-Hub gate says ~621k. Steady state is materially worse — assert the gap is real, not cosmetic.
    expect(gas).toBeGreaterThan(700_000);
  }, 240_000);
});
