import { describe, expect, it } from 'vitest';
import { toNano } from '@ton/core';
import { KIND_PRIVATE, KIND_PUBLIC, SIZE_1K, partsList, marketingCell, setupHub } from './helpers/vpb2';

// clean-16 L6/#11 — permissionless standalone eviction. A QUIET private/public lane (no new publishes of its kind)
// otherwise never sheds its expired entries, because own-kind FIFO eviction was coupled to publish traffic.
// EvictExpiredCapsules lets anyone reclaim up to CAPSULEHUB_STANDALONE_EVICT_CAP expired entries per call.

const RETENTION = 31536000; // CAPSULEHUB_INDEX_RETENTION_SECONDS (1 year)
const T0 = 1_700_000_000;

async function seedPrivate(hub: any, vault: any, n: number, id: bigint) {
  await hub.send(vault.getSender(), { value: toNano('2') }, {
    $$type: 'PublishBatchToHub',
    bounce_id: id, bounce_tag: id + 1000n, publish_id: id, publish_kind: KIND_PRIVATE,
    part_count: BigInt(n), protocol_fee_total: 0n, author_wallet: vault.address,
    parts: partsList(KIND_PRIVATE, n, SIZE_1K), marketing: null,
  } as any);
}

describe('CapsuleHub permissionless standalone eviction (clean-16 L6/#11)', () => {
  it('EVICT-STANDALONE-01: anyone can reclaim a quiet private lane once its entries expire', async () => {
    const { hub, vault, blockchain } = (await setupHub()) as any;
    blockchain.now = T0;
    await seedPrivate(hub, vault, 3, 0x111n);
    expect((await hub.getGetState()).private_live_count).toBe(3n);

    // Before expiry: a standalone evict sweeps nothing.
    const evictor = await blockchain.treasury('standalone-evictor');
    blockchain.now = T0 + RETENTION - 100;
    await hub.send(evictor.getSender(), { value: toNano('0.15') }, { $$type: 'EvictExpiredCapsules', kind: 1n, max_count: 10n } as any);
    expect((await hub.getGetState()).private_live_count).toBe(3n); // not yet expired → unchanged

    // After expiry: a permissionless standalone evict reclaims them WITHOUT any new publish.
    blockchain.now = T0 + RETENTION + 100;
    await hub.send(evictor.getSender(), { value: toNano('0.15') }, { $$type: 'EvictExpiredCapsules', kind: 1n, max_count: 10n } as any);
    expect((await hub.getGetState()).private_live_count).toBe(0n);
  });

  it('EVICT-STANDALONE-02: the per-call cap bounds the sweep; keepers repeat to drain a backlog', async () => {
    const { hub, vault, blockchain } = (await setupHub()) as any;
    blockchain.now = T0;
    await seedPrivate(hub, vault, 8, 0x222n); // 8 entries
    blockchain.now = T0 + RETENTION + 100;

    const evictor = await blockchain.treasury('cap-evictor');
    // Request more than the cap (32) — but only 8 exist, so all 8 go in one call (8 < 32).
    await hub.send(evictor.getSender(), { value: toNano('0.3') }, { $$type: 'EvictExpiredCapsules', kind: 1n, max_count: 5n } as any);
    // max_count=5 → only 5 of the 8 swept this call.
    expect((await hub.getGetState()).private_live_count).toBe(3n);
    // A second call drains the rest.
    await hub.send(evictor.getSender(), { value: toNano('0.3') }, { $$type: 'EvictExpiredCapsules', kind: 1n, max_count: 5n } as any);
    expect((await hub.getGetState()).private_live_count).toBe(0n);
  });

  it('EVICT-STANDALONE-03: unknown lane kind is rejected (13570)', async () => {
    const { hub, blockchain } = (await setupHub()) as any;
    const evictor = await blockchain.treasury('bad-evictor');
    const res = await hub.send(evictor.getSender(), { value: toNano('0.1') }, { $$type: 'EvictExpiredCapsules', kind: 9n, max_count: 1n } as any);
    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === hub.address.toString());
    expect(Number(tx.description.computePhase.exitCode)).toBe(13570);
  });
});
