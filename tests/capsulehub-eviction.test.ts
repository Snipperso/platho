import { describe, expect, it } from 'vitest';
import { Cell, external, toNano } from '@ton/core';
import { webcrypto } from 'crypto';
import {
  KIND_PUBLIC,
  KIND_PRIVATE,
  MANIFEST_HASH,
  publicPart,
  partsList,
  addressCellHash,
  batchExternalBody,
  computeBatchPublishId,
  bounceIdOf,
  registerHybrid,
  depositTon,
  deployBoundSealedPair,
} from './helpers/vpb2';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// FIFO auto-eviction folded into the publish path: each batch evicts up to part_count oldest entries of its own
// kind that are past the 1-year retention window, bounding live on-chain state by construction (the immutable-
// contract longevity fix). Strict oldest-first => only chain TAILS are removed, so walks never hit a hole and
// entry_count stays exact. There is no standalone prune op.

const RETENTION = 31536000;
const T0 = 1_800_000_000;
const MAX_CHARGE = toNano('3'); // far above canonical for a 1-part batch; eviction gas is folded into the hold

async function sendBatch(ctx: any, partsRoot: Cell, partCount: bigint, kind: bigint) {
  const { blockchain, vault, user } = ctx;
  const nonce = (await vault.getGetUser(user.address)).publish_nonce;
  const body = batchExternalBody({
    vaultAddr: vault.address, owner: user.address, nonce,
    maxCharge: MAX_CHARGE, partCount, partsRoot, kind, genesisHash: MANIFEST_HASH,
  });
  const res = await blockchain.sendMessage(external({ to: vault.address, body }));
  const publishId = computeBatchPublishId({ owner: user.address, nonce, partsRoot, kind, partCount, genesisHash: MANIFEST_HASH });
  return { nonce, publishId, bounceId: bounceIdOf(publishId), res };
}

// Walk the backward chain, STOPPING at the first non-existent id (the eviction boundary). Returns visited ids.
async function walk(hub: any, latestLink: bigint): Promise<bigint[]> {
  const out: bigint[] = [];
  let link = latestLink;
  for (let g = 0; g < 1000 && link > 0n; g += 1) {
    const e = await hub.getGetPublicEntry(link - 1n);
    if (!e.exists) break;
    out.push(link - 1n);
    link = e.prev_link;
  }
  return out;
}

describe('CapsuleHub FIFO auto-eviction (immutable-state longevity)', () => {
  it('EVICT-PUBLIC-01: post-retention publishes evict oldest-first, bound state, and keep the author index exact', async () => {
    const ctx = await deployBoundSealedPair();
    const { blockchain, hub, user } = ctx;
    await registerHybrid(ctx.vault, user);
    await depositTon(ctx.vault, user, toNano('40'));
    const keyId = addressCellHash(user.address);

    // Three posts at T0 (entries 0,1,2).
    blockchain.now = T0;
    for (let i = 0; i < 3; i += 1) await sendBatch(ctx, publicPart({ fillBase: i }), 1n, KIND_PUBLIC);
    expect((await hub.getGetState()).public_live_count).toBe(3n);
    expect((await hub.getGetPublicAuthorIndex(keyId)).entry_count).toBe(3n);

    // After retention, two more posts (entries 3,4). Each 1-part batch evicts up to 1 oldest expired entry.
    blockchain.now = T0 + RETENTION + 60;
    await sendBatch(ctx, publicPart({ fillBase: 3 }), 1n, KIND_PUBLIC); // adds 3, evicts 0
    await sendBatch(ctx, publicPart({ fillBase: 4 }), 1n, KIND_PUBLIC); // adds 4, evicts 1

    // Oldest two gone; newest three live; state held at 3 (bounded by the evict-one-per-publish steady state).
    expect((await hub.getGetPublicEntry(0n)).exists).toBe(false);
    expect((await hub.getGetPublicEntry(1n)).exists).toBe(false);
    expect((await hub.getGetPublicEntry(2n)).exists).toBe(true);
    expect((await hub.getGetPublicEntry(4n)).exists).toBe(true);
    expect((await hub.getGetState()).public_live_count).toBe(3n);

    // Author index: latest still points at entry 4, entry_count is EXACT (== reachable), walk stops at the boundary.
    const idx = await hub.getGetPublicAuthorIndex(keyId);
    expect(idx.entry_count).toBe(3n);
    expect(idx.latest_entry_link).toBe(5n); // entryLink(4)
    expect(await walk(hub, idx.latest_entry_link)).toEqual([4n, 3n, 2n]);
  });

  it('EVICT-PUBLIC-02: entries younger than the retention window are NOT evicted', async () => {
    const ctx = await deployBoundSealedPair();
    const { blockchain, hub, user } = ctx;
    await registerHybrid(ctx.vault, user);
    await depositTon(ctx.vault, user, toNano('20'));

    blockchain.now = T0;
    await sendBatch(ctx, publicPart({ fillBase: 0 }), 1n, KIND_PUBLIC);

    // Advance only HALF the window, then publish again -> the loop sees a non-expired oldest entry and stops.
    blockchain.now = T0 + Math.floor(RETENTION / 2);
    await sendBatch(ctx, publicPart({ fillBase: 1 }), 1n, KIND_PUBLIC);

    expect((await hub.getGetPublicEntry(0n)).exists).toBe(true);
    expect((await hub.getGetPublicEntry(1n)).exists).toBe(true);
    expect((await hub.getGetState()).public_live_count).toBe(2n);
  });

  it('EVICT-PRIVATE-01: private publishes auto-evict oldest expired entries symmetrically', async () => {
    const ctx = await deployBoundSealedPair();
    const { blockchain, hub, user } = ctx;
    await registerHybrid(ctx.vault, user);
    await depositTon(ctx.vault, user, toNano('40'));

    blockchain.now = T0;
    await sendBatch(ctx, partsList(KIND_PRIVATE, 1, 1n), 1n, KIND_PRIVATE); // entry 0
    await sendBatch(ctx, partsList(KIND_PRIVATE, 1, 1n), 1n, KIND_PRIVATE); // entry 1
    expect((await hub.getGetState()).private_live_count).toBe(2n);

    blockchain.now = T0 + RETENTION + 60;
    await sendBatch(ctx, partsList(KIND_PRIVATE, 1, 1n), 1n, KIND_PRIVATE); // entry 2, evicts 0
    await sendBatch(ctx, partsList(KIND_PRIVATE, 1, 1n), 1n, KIND_PRIVATE); // entry 3, evicts 1

    expect((await hub.getGetPrivateEntry(0n)).exists).toBe(false);
    expect((await hub.getGetPrivateEntry(1n)).exists).toBe(false);
    expect((await hub.getGetPrivateEntry(2n)).exists).toBe(true);
    expect((await hub.getGetPrivateEntry(3n)).exists).toBe(true);
    expect((await hub.getGetState()).private_live_count).toBe(2n);
  });
});
