import { describe, expect, it } from 'vitest';
import { toNano } from '@ton/core';
import { webcrypto } from 'crypto';
import { hubTxExit, marketingCell, KIND_PUBLIC } from './helpers/vpb2';
import {
  publicPartToken,
  anonBatch,
  publicChannelId,
  spendKey,
  bufToInt,
  deployAnonReady,
  fundPool,
} from './helpers/anon';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// clean-16 B3 migration of the public read-side index coverage onto the permissionless anon-publish path. The index
// STRUCTURE (author chain of posts, parent chain of comments, FIFO eviction un-push) is unchanged; only its KEY moved
// from hash(author_wallet) to channel_id = H(PUBLIC_CHANNEL_DOMAIN ‖ spend_pubkey). A "same author / same channel" is
// modelled by REUSING one spend keypair across posts (the stable-channel opt-in, §12); each post spends one credit and
// carries a distinct nonce. This proves a client can still walk only ONE channel's posts via the on-chain index.

// Walk the backward link chain (latestLink -> prev_link -> ...) and return the visited entry ids, newest first.
async function walkChain(hub: any, latestLink: bigint): Promise<bigint[]> {
  const visited: bigint[] = [];
  let link = latestLink;
  for (let guard = 0; guard < 1000 && link > 0n; guard += 1) {
    const entryId = link - 1n; // entryIdFromLink
    const entry = await hub.getGetPublicEntry(entryId);
    expect(entry.exists).toBe(true);
    visited.push(entryId);
    link = entry.prev_link;
  }
  return visited;
}

// Publish ONE PUBLIC post/comment as `channel` at the given epoch/nonce. Returns nothing; asserts exit 0.
async function publishPublic(env: any, channel: any, epoch: bigint, nonce: bigint, opts: { fill?: number; parentLink?: bigint } = {}) {
  const pt = publicPartToken({
    issuer: env.issuer, spend: channel, slot: env.slot, epoch, nonce,
    fill: opts.fill ?? Number(nonce % 90n), parentLink: opts.parentLink,
  });
  const res = await env.hub.send(env.relay.getSender(), { value: toNano('0.3') }, anonBatch({
    parts: pt.part, tokens: pt.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell(),
  }));
  expect(hubTxExit(res, env.hub)).toBe(0);
}

async function setup(credits: bigint) {
  const env: any = await deployAnonReady({ credits });
  env.relay = await env.blockchain.treasury('pub-relay');
  return env;
}

describe('CapsuleHub public read-side index (channel + parent) — B3 anon path', () => {
  it('CAPSULEHUB-PUBINDEX-01: a single channel\'s posts form a backward chain walkable by channel key only', async () => {
    const env = await setup(3n);
    const channel = spendKey(0);

    // Three top-level posts (parent_link 0) by the SAME channel (same spend key), distinct nonces/bodies.
    for (let i = 0; i < 3; i += 1) await publishPublic(env, channel, env.nowEpoch, BigInt(100 + i), { fill: i });
    expect((await env.hub.getGetState()).public_latest_id).toBe(3n);

    const channelId = publicChannelId(bufToInt(channel.publicKey));
    const idx = await env.hub.getGetPublicAuthorIndex(channelId);
    expect(idx.exists).toBe(true);
    expect(idx.entry_count).toBe(3n);
    expect(idx.latest_entry_link).toBe(3n); // entryLink(2)
    expect(idx.latest_entry_id).toBe(2n);

    // The channel chain walks exactly this channel's 3 posts, newest first, then terminates (prev_link 0).
    expect(await walkChain(env.hub, idx.latest_entry_link)).toEqual([2n, 1n, 0n]);

    // A DIFFERENT channel key resolves to nothing (no cross-channel bleed).
    const stranger = publicChannelId(bufToInt(spendKey(9).publicKey));
    expect((await env.hub.getGetPublicAuthorIndex(stranger)).exists).toBe(false);
  });

  it('CAPSULEHUB-PUBINDEX-02: comments index by parent; posts and comments land in different chains', async () => {
    const env = await setup(3n);
    const channel = spendKey(0);

    // entry 0: a post. entries 1 & 2: comments on entry 0 (parent_link == entryLink(0) == 1).
    await publishPublic(env, channel, env.nowEpoch, 200n, { fill: 0 });
    await publishPublic(env, channel, env.nowEpoch, 201n, { fill: 1, parentLink: 1n });
    await publishPublic(env, channel, env.nowEpoch, 202n, { fill: 2, parentLink: 1n });
    expect((await env.hub.getGetState()).public_latest_id).toBe(3n);

    // The parent index for entry 0 holds the two comments and walks them newest first.
    const parentIdx = await env.hub.getGetPublicParentIndex(0n);
    expect(parentIdx.exists).toBe(true);
    expect(parentIdx.entry_count).toBe(2n);
    expect(parentIdx.latest_entry_link).toBe(3n); // entryLink(2)
    expect(await walkChain(env.hub, parentIdx.latest_entry_link)).toEqual([2n, 1n]);

    // The comments carry parent_link 1; the post carries parent_link 0.
    expect((await env.hub.getGetPublicEntry(0n)).parent_link).toBe(0n);
    expect((await env.hub.getGetPublicEntry(1n)).parent_link).toBe(1n);
    expect((await env.hub.getGetPublicEntry(2n)).parent_link).toBe(1n);

    // Crucially: the channel index holds ONLY the post (entry 0), not the comments — they are a separate chain.
    const channelIdx = await env.hub.getGetPublicAuthorIndex(publicChannelId(bufToInt(channel.publicKey)));
    expect(channelIdx.exists).toBe(true);
    expect(channelIdx.entry_count).toBe(1n);
    expect(channelIdx.latest_entry_link).toBe(1n); // entryLink(0)
    expect(await walkChain(env.hub, channelIdx.latest_entry_link)).toEqual([0n]);
  });

  it('CAPSULEHUB-PUBINDEX-03: auto-eviction drops an expired post and un-pushes the channel index on the next publish', async () => {
    const env = await setup(1n);
    const channel = spendKey(0);
    const channelId = publicChannelId(bufToInt(channel.publicKey));
    const RETENTION = 31536000;

    // entry 0 at T0 — fund + publish for T0's epoch.
    env.blockchain.now = 1_800_000_000;
    const E0 = BigInt(Math.floor(1_800_000_000 / 86400));
    await fundPool(env.hub, env.creditIssuer, 1n, E0);
    await publishPublic(env, channel, E0, 300n, { fill: 0 });
    expect((await env.hub.getGetPublicAuthorIndex(channelId)).entry_count).toBe(1n);
    expect((await env.hub.getGetPublicEntry(0n)).exists).toBe(true);

    // entry 1 published AFTER the retention window -> the same publish auto-evicts the now-expired entry 0.
    env.blockchain.now = 1_800_000_000 + RETENTION + 60;
    const E1 = BigInt(Math.floor((1_800_000_000 + RETENTION + 60) / 86400));
    await fundPool(env.hub, env.creditIssuer, 1n, E1);
    await publishPublic(env, channel, E1, 301n, { fill: 1 });

    // Entry 0 gone (FIFO oldest), entry 1 live; channel index holds ONLY entry 1 and entry_count is exact.
    expect((await env.hub.getGetPublicEntry(0n)).exists).toBe(false);
    expect((await env.hub.getGetPublicEntry(1n)).exists).toBe(true);
    expect((await env.hub.getGetState()).public_live_count).toBe(1n);
    const idx = await env.hub.getGetPublicAuthorIndex(channelId);
    expect(idx.exists).toBe(true);
    expect(idx.entry_count).toBe(1n);
    expect(idx.latest_entry_link).toBe(2n); // entryLink(1)
  });
});
