import { describe, expect, it } from 'vitest';
import { toNano } from '@ton/core';
import { webcrypto } from 'crypto';
import { hubTxExit, marketingCell, KIND_PUBLIC, KIND_PRIVATE } from './helpers/vpb2';
import {
  publicPartToken,
  convPartToken,
  anonBatch,
  publicChannelId,
  spendKey,
  bufToInt,
  deployAnonReady,
  fundPool,
  EPOCH_SECONDS,
} from './helpers/anon';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// clean-16 B3 migration of the FIFO auto-eviction coverage onto the permissionless PublishAnonBatch path (the old
// Vault-forwarded batch external is gone). The eviction SEMANTICS are unchanged: each batch evicts up to part_count
// oldest entries of its own kind that are past the 1-year retention window, bounding live on-chain state by
// construction (the immutable-contract longevity fix). Strict oldest-first => only chain TAILS are removed, so walks
// never hit a hole and entry_count stays exact. There is no standalone prune op.
//
// The only read-side change vs the pre-B3 test: the PUBLIC author index is now keyed by
// channel_id = publicChannelId(spend_pubkey), NOT hash(author_wallet). A "same author" is modelled by REUSING one
// spend keypair (the stable-channel opt-in) across every post; each post spends one prepaid credit for its epoch and
// carries a distinct nonce. No removed-semantics assertions live in this file, so nothing here is deleted.

const RETENTION = 31536000;
const T0 = 1_800_000_000;
const HOLD = toNano('0.3'); // gas + ack float; the per-entry endowment is prepaid on-balance, not brought by the relay

const epochOf = (t: number): bigint => BigInt(Math.floor(t / EPOCH_SECONDS));

async function setup() {
  const env: any = await deployAnonReady();
  env.relay = await env.blockchain.treasury('evict-relay');
  return env;
}

// Publish ONE PUBLIC post as `channel` at the given epoch/nonce; asserts exit 0.
async function publishPublic(env: any, channel: any, epoch: bigint, nonce: bigint, opts: { fill?: number; parentLink?: bigint } = {}) {
  const pt = publicPartToken({
    issuer: env.issuer, spend: channel, slot: env.slot, epoch, nonce,
    fill: opts.fill ?? 0, parentLink: opts.parentLink,
  });
  const res = await env.hub.send(env.relay.getSender(), { value: HOLD }, anonBatch({
    parts: pt.part, tokens: pt.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell(),
  }));
  expect(hubTxExit(res, env.hub)).toBe(0);
}

// Publish ONE PRIVATE (CONV) capsule as `channel` at the given epoch/nonce; asserts exit 0.
async function publishPrivate(env: any, channel: any, epoch: bigint, nonce: bigint, opts: { fill?: number } = {}) {
  const pt = convPartToken({
    issuer: env.issuer, spend: channel, slot: env.slot, epoch, nonce, fill: opts.fill ?? 0,
  });
  const res = await env.hub.send(env.relay.getSender(), { value: HOLD }, anonBatch({
    parts: pt.part, tokens: pt.tok, partCount: 1n, kind: KIND_PRIVATE,
  }));
  expect(hubTxExit(res, env.hub)).toBe(0);
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

describe('CapsuleHub FIFO auto-eviction (immutable-state longevity) — B3 anon path', () => {
  it('EVICT-PUBLIC-01: post-retention publishes evict oldest-first, bound state, and keep the channel index exact', async () => {
    const env = await setup();
    const channel = spendKey(0);
    const channelId = publicChannelId(bufToInt(channel.publicKey));

    // Three posts at T0 (entries 0,1,2) by the SAME channel. Fund T0's epoch for exactly three credits.
    env.blockchain.now = T0;
    const E0 = epochOf(T0);
    await fundPool(env.hub, env.creditIssuer, 3n, E0);
    for (let i = 0; i < 3; i += 1) await publishPublic(env, channel, E0, BigInt(100 + i), { fill: i });
    expect((await env.hub.getGetState()).public_live_count).toBe(3n);
    expect((await env.hub.getGetPublicAuthorIndex(channelId)).entry_count).toBe(3n);

    // After retention, two more posts (entries 3,4). Each 1-part batch evicts up to 1 oldest expired entry.
    const T1 = T0 + RETENTION + 60;
    env.blockchain.now = T1;
    const E1 = epochOf(T1);
    await fundPool(env.hub, env.creditIssuer, 2n, E1);
    await publishPublic(env, channel, E1, 103n, { fill: 3 }); // adds 3, evicts 0
    await publishPublic(env, channel, E1, 104n, { fill: 4 }); // adds 4, evicts 1

    // Oldest two gone; newest three live; state held at 3 (bounded by the evict-one-per-publish steady state).
    expect((await env.hub.getGetPublicEntry(0n)).exists).toBe(false);
    expect((await env.hub.getGetPublicEntry(1n)).exists).toBe(false);
    expect((await env.hub.getGetPublicEntry(2n)).exists).toBe(true);
    expect((await env.hub.getGetPublicEntry(4n)).exists).toBe(true);
    expect((await env.hub.getGetState()).public_live_count).toBe(3n);

    // Channel index: latest still points at entry 4, entry_count is EXACT (== reachable), walk stops at the boundary.
    const idx = await env.hub.getGetPublicAuthorIndex(channelId);
    expect(idx.entry_count).toBe(3n);
    expect(idx.latest_entry_link).toBe(5n); // entryLink(4)
    expect(await walk(env.hub, idx.latest_entry_link)).toEqual([4n, 3n, 2n]);
  });

  it('EVICT-PUBLIC-02: entries younger than the retention window are NOT evicted', async () => {
    const env = await setup();
    const channel = spendKey(0);

    env.blockchain.now = T0;
    const E0 = epochOf(T0);
    await fundPool(env.hub, env.creditIssuer, 1n, E0);
    await publishPublic(env, channel, E0, 200n, { fill: 0 });

    // Advance only HALF the window, then publish again -> the loop sees a non-expired oldest entry and stops.
    const THALF = T0 + Math.floor(RETENTION / 2);
    env.blockchain.now = THALF;
    const EHALF = epochOf(THALF);
    await fundPool(env.hub, env.creditIssuer, 1n, EHALF);
    await publishPublic(env, channel, EHALF, 201n, { fill: 1 });

    expect((await env.hub.getGetPublicEntry(0n)).exists).toBe(true);
    expect((await env.hub.getGetPublicEntry(1n)).exists).toBe(true);
    expect((await env.hub.getGetState()).public_live_count).toBe(2n);
  });

  it('EVICT-PRIVATE-01: private publishes auto-evict oldest expired entries symmetrically', async () => {
    const env = await setup();
    const channel = spendKey(0);

    env.blockchain.now = T0;
    const E0 = epochOf(T0);
    await fundPool(env.hub, env.creditIssuer, 2n, E0);
    await publishPrivate(env, channel, E0, 400n, { fill: 0 }); // entry 0
    await publishPrivate(env, channel, E0, 401n, { fill: 1 }); // entry 1
    expect((await env.hub.getGetState()).private_live_count).toBe(2n);

    const T1 = T0 + RETENTION + 60;
    env.blockchain.now = T1;
    const E1 = epochOf(T1);
    await fundPool(env.hub, env.creditIssuer, 2n, E1);
    await publishPrivate(env, channel, E1, 402n, { fill: 2 }); // entry 2, evicts 0
    await publishPrivate(env, channel, E1, 403n, { fill: 3 }); // entry 3, evicts 1

    expect((await env.hub.getGetPrivateEntry(0n)).exists).toBe(false);
    expect((await env.hub.getGetPrivateEntry(1n)).exists).toBe(false);
    expect((await env.hub.getGetPrivateEntry(2n)).exists).toBe(true);
    expect((await env.hub.getGetPrivateEntry(3n)).exists).toBe(true);
    expect((await env.hub.getGetState()).private_live_count).toBe(2n);
  });
});
