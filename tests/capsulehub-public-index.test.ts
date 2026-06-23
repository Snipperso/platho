import { describe, expect, it } from 'vitest';
import { Cell, external, toNano } from '@ton/core';
import { webcrypto } from 'crypto';
import {
  KIND_PUBLIC,
  SIZE_1K,
  MANIFEST_HASH,
  publicPart,
  addressCellHash,
  batchExternalBody,
  computeBatchPublishId,
  bounceIdOf,
  registerHybrid,
  depositTon,
  deployBoundSealedPair,
} from './helpers/vpb2';
import { computePublicAuthorKeyId } from '../web/pwa-contract-transactions.mjs';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// Public read-side index coverage: proves a client can walk only ONE author's posts (or one post's comments)
// via the on-chain index, exactly as the private side walks recipient_prev_link — no global scan. This is the
// core of the scalability fix; without it the public feed degrades with the GLOBAL post count.

const PUBLIC_MAX_CHARGE = toNano('2');

// Sends one public batch (the parts root) on the user's current nonce and returns its ids + send result.
async function sendPublicBatch(ctx: any, partsRoot: Cell, partCount: bigint) {
  const { blockchain, vault, user } = ctx;
  const nonce = (await vault.getGetUser(user.address)).publish_nonce;
  const body = batchExternalBody({
    vaultAddr: vault.address, owner: user.address, nonce,
    maxCharge: PUBLIC_MAX_CHARGE, partCount, partsRoot, kind: KIND_PUBLIC, genesisHash: MANIFEST_HASH,
  });
  const res = await blockchain.sendMessage(external({ to: vault.address, body }));
  const publishId = computeBatchPublishId({
    owner: user.address, nonce, partsRoot, kind: KIND_PUBLIC, partCount, genesisHash: MANIFEST_HASH,
  });
  return { nonce, publishId, bounceId: bounceIdOf(publishId), res };
}

// Walks the backward link chain (latestLink -> prev_link -> ...) and returns the visited entry ids, newest first.
async function walkChain(hub: any, latestLink: bigint): Promise<bigint[]> {
  const visited: bigint[] = [];
  let link = latestLink;
  // Bounded by the live count; a malformed cycle would otherwise loop. 1000 is far above any test fixture.
  for (let guard = 0; guard < 1000 && link > 0n; guard += 1) {
    const entryId = link - 1n; // entryIdFromLink
    const entry = await hub.getGetPublicEntry(entryId);
    expect(entry.exists).toBe(true);
    visited.push(entryId);
    link = entry.prev_link;
  }
  return visited;
}

describe('CapsuleHub public read-side index (author + parent)', () => {
  it('CAPSULEHUB-PUBINDEX-01: a single author\'s posts form a backward chain walkable by author key only', async () => {
    const ctx = await deployBoundSealedPair();
    const { hub, user } = ctx;
    await registerHybrid(ctx.vault, user);
    await depositTon(ctx.vault, user, toNano('8'));

    // Three top-level posts (parent_link 0) by the same author, distinct bodies.
    for (let i = 0; i < 3; i += 1) {
      await sendPublicBatch(ctx, publicPart({ fillBase: i }), 1n);
    }
    expect((await hub.getGetState()).public_latest_id).toBe(3n);

    const keyId = addressCellHash(user.address);
    const idx = await hub.getGetPublicAuthorIndex(keyId);
    expect(idx.exists).toBe(true);
    expect(idx.entry_count).toBe(3n);
    expect(idx.latest_entry_link).toBe(3n); // entryLink(2)
    expect(idx.latest_entry_id).toBe(2n);

    // The author chain walks exactly this author's 3 posts, newest first, then terminates (prev_link 0).
    expect(await walkChain(hub, idx.latest_entry_link)).toEqual([2n, 1n, 0n]);

    // The on-chain author key is hash(storeAddress(author)): a different key resolves to nothing.
    const stranger = addressCellHash(hub.address);
    expect((await hub.getGetPublicAuthorIndex(stranger)).exists).toBe(false);
  });

  it('CAPSULEHUB-PUBINDEX-02: comments index by parent; posts and comments land in different chains', async () => {
    const ctx = await deployBoundSealedPair();
    const { hub, user } = ctx;
    await registerHybrid(ctx.vault, user);
    await depositTon(ctx.vault, user, toNano('8'));

    // entry 0: a post. entries 1 & 2: comments on entry 0 (parent_link == entryLink(0) == 1).
    await sendPublicBatch(ctx, publicPart({ fillBase: 0 }), 1n);
    await sendPublicBatch(ctx, publicPart({ fillBase: 1, parentLink: 1n }), 1n);
    await sendPublicBatch(ctx, publicPart({ fillBase: 2, parentLink: 1n }), 1n);
    expect((await hub.getGetState()).public_latest_id).toBe(3n);

    // The parent index for entry 0 holds the two comments and walks them newest first.
    const parentIdx = await hub.getGetPublicParentIndex(0n);
    expect(parentIdx.exists).toBe(true);
    expect(parentIdx.entry_count).toBe(2n);
    expect(parentIdx.latest_entry_link).toBe(3n); // entryLink(2)
    expect(await walkChain(hub, parentIdx.latest_entry_link)).toEqual([2n, 1n]);

    // The comments carry parent_link 1; the post carries parent_link 0.
    expect((await hub.getGetPublicEntry(0n)).parent_link).toBe(0n);
    expect((await hub.getGetPublicEntry(1n)).parent_link).toBe(1n);
    expect((await hub.getGetPublicEntry(2n)).parent_link).toBe(1n);

    // Crucially: the author index holds ONLY the post (entry 0), not the comments — they are a separate chain.
    const authorIdx = await hub.getGetPublicAuthorIndex(addressCellHash(user.address));
    expect(authorIdx.exists).toBe(true);
    expect(authorIdx.entry_count).toBe(1n);
    expect(authorIdx.latest_entry_link).toBe(1n); // entryLink(0)
    expect(await walkChain(hub, authorIdx.latest_entry_link)).toEqual([0n]);
  });

  it('CAPSULEHUB-PUBINDEX-03: auto-eviction drops an expired post and un-pushes the author index on the next publish', async () => {
    const ctx = await deployBoundSealedPair();
    const { blockchain, hub, user } = ctx;
    await registerHybrid(ctx.vault, user);
    await depositTon(ctx.vault, user, toNano('8'));

    const RETENTION = 31536000;
    const keyId = addressCellHash(user.address);

    // entry 0 at T0.
    blockchain.now = 1_800_000_000;
    await sendPublicBatch(ctx, publicPart({ fillBase: 0 }), 1n);
    expect((await hub.getGetPublicAuthorIndex(keyId)).entry_count).toBe(1n);
    expect((await hub.getGetPublicEntry(0n)).exists).toBe(true);

    // entry 1 published AFTER the retention window -> the same publish auto-evicts the now-expired entry 0.
    blockchain.now = 1_800_000_000 + RETENTION + 60;
    await sendPublicBatch(ctx, publicPart({ fillBase: 1 }), 1n);

    // Entry 0 gone (FIFO oldest), entry 1 live; author index holds ONLY entry 1 and entry_count is exact.
    expect((await hub.getGetPublicEntry(0n)).exists).toBe(false);
    expect((await hub.getGetPublicEntry(1n)).exists).toBe(true);
    expect((await hub.getGetState()).public_live_count).toBe(1n);
    const idx = await hub.getGetPublicAuthorIndex(keyId);
    expect(idx.exists).toBe(true);
    expect(idx.entry_count).toBe(1n);
    expect(idx.latest_entry_link).toBe(2n); // entryLink(1)
  });

  it('CAPSULEHUB-PUBINDEX-04: client computePublicAuthorKeyId matches the contract key and resolves the on-chain author index', async () => {
    const ctx = await deployBoundSealedPair();
    const { hub, user } = ctx;
    await registerHybrid(ctx.vault, user);
    await depositTon(ctx.vault, user, toNano('8'));

    await sendPublicBatch(ctx, publicPart({ fillBase: 0 }), 1n);

    // The client helper must byte-for-byte equal the contract's beginCell().storeAddress(addr).endCell().hash()
    // (== the test kit's addressCellHash, which the on-chain index is keyed by). Closes the HIGH spec-drift finding.
    const clientKey = await computePublicAuthorKeyId(user.address.toString());
    expect(clientKey).toBe(addressCellHash(user.address));

    // ...and that key actually resolves the author's posts on-chain (not a silent "no posts").
    const idx = await hub.getGetPublicAuthorIndex(clientKey);
    expect(idx.exists).toBe(true);
    expect(idx.entry_count).toBe(1n);
  });
});
