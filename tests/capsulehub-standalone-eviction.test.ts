import { describe, expect, it } from 'vitest';
import { toNano } from '@ton/core';
import { webcrypto } from 'crypto';
import { hubTxExit, KIND_PRIVATE } from './helpers/vpb2';
import { convPartToken, anonBatch, spendKey, deployAnonReady } from './helpers/anon';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// clean-16 B3 migration of the permissionless standalone-eviction coverage onto the anon-publish path. The old
// seedPrivate drove the Hub via the REMOVED Vault-forwarded PublishBatchToHub (op 0xA4F862D1); private entries are
// now created ONLY through PublishAnonBatch (CONV lane), per-part spend-token authorized against the prepaid pool.
// The eviction semantics under test are UNCHANGED: EvictExpiredCapsules lets anyone reclaim up to
// CAPSULEHUB_STANDALONE_EVICT_CAP (32) expired own-kind entries per call WITHOUT any new publish, and rejects an
// unknown lane kind with 13570. Only the way live entries get SEEDED changed.

const RETENTION = 31536000; // CAPSULEHUB_INDEX_RETENTION_SECONDS (1 year)
const T0 = 1_700_000_000;   // == deployAnonReady's blockchain.now, so nowEpoch funds the seed epoch

// Seed `n` private (CONV) entries at the pool's funded epoch via single-part anon batches (MAX_BATCH_PARTS_ANON=4,
// so a backlog is built one part at a time). Each part carries a distinct spend key + distinct nonce (⇒ distinct
// serial ⇒ distinct nullifier) and a distinct fill (⇒ distinct opaque bucketKey), spending one prepaid credit. The
// relay is any treasury — the publish path is permissionless.
async function seedPrivate(env: any, n: number, nonceBase: number) {
  for (let i = 0; i < n; i += 1) {
    const pt = convPartToken({
      issuer: env.issuer, spend: spendKey(i), slot: env.slot, epoch: env.nowEpoch,
      nonce: BigInt(nonceBase + i), fill: i,
    });
    const res = await env.hub.send(env.relay.getSender(), { value: toNano('0.5') }, anonBatch({
      parts: pt.part, tokens: pt.tok, partCount: 1n, kind: KIND_PRIVATE,
    }));
    expect(hubTxExit(res, env.hub)).toBe(0);
  }
}

async function setup(credits: bigint) {
  const env: any = await deployAnonReady({ credits });
  env.relay = await env.blockchain.treasury('standalone-relay');
  return env;
}

describe('CapsuleHub permissionless standalone eviction (clean-16 L6/#11) — B3 anon path', () => {
  it('EVICT-STANDALONE-01: anyone can reclaim a quiet private lane once its entries expire', async () => {
    const env = await setup(3n);
    env.blockchain.now = T0;
    await seedPrivate(env, 3, 0x111);
    expect((await env.hub.getGetState()).private_live_count).toBe(3n);

    // Before expiry: a standalone evict sweeps nothing.
    const evictor = await env.blockchain.treasury('standalone-evictor');
    env.blockchain.now = T0 + RETENTION - 100;
    await env.hub.send(evictor.getSender(), { value: toNano('0.15') }, { $$type: 'EvictExpiredCapsules', kind: 1n, max_count: 10n } as any);
    expect((await env.hub.getGetState()).private_live_count).toBe(3n); // not yet expired → unchanged

    // After expiry: a permissionless standalone evict reclaims them WITHOUT any new publish.
    env.blockchain.now = T0 + RETENTION + 100;
    await env.hub.send(evictor.getSender(), { value: toNano('0.15') }, { $$type: 'EvictExpiredCapsules', kind: 1n, max_count: 10n } as any);
    expect((await env.hub.getGetState()).private_live_count).toBe(0n);
  });

  it('EVICT-STANDALONE-02: the per-call cap bounds the sweep; keepers repeat to drain a backlog', async () => {
    const env = await setup(8n);
    env.blockchain.now = T0;
    await seedPrivate(env, 8, 0x222); // 8 entries
    env.blockchain.now = T0 + RETENTION + 100;

    const evictor = await env.blockchain.treasury('cap-evictor');
    // max_count=5 (< the 32 cap) → only 5 of the 8 swept this call.
    await env.hub.send(evictor.getSender(), { value: toNano('0.3') }, { $$type: 'EvictExpiredCapsules', kind: 1n, max_count: 5n } as any);
    expect((await env.hub.getGetState()).private_live_count).toBe(3n);
    // A second call drains the rest.
    await env.hub.send(evictor.getSender(), { value: toNano('0.3') }, { $$type: 'EvictExpiredCapsules', kind: 1n, max_count: 5n } as any);
    expect((await env.hub.getGetState()).private_live_count).toBe(0n);
  });

  it('EVICT-STANDALONE-03: unknown lane kind is rejected (13570)', async () => {
    const env = await deployAnonReady();
    const evictor = await env.blockchain.treasury('bad-evictor');
    const res = await env.hub.send(evictor.getSender(), { value: toNano('0.1') }, { $$type: 'EvictExpiredCapsules', kind: 9n, max_count: 1n } as any);
    expect(hubTxExit(res, env.hub)).toBe(13570);
  });
});
