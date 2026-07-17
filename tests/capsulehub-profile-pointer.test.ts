import { describe, expect, it } from 'vitest';
import { toNano } from '@ton/core';
import { webcrypto } from 'crypto';
import { hubTxExit, KIND_PUBLIC, marketingCell } from './helpers/vpb2';
import {
  publicPartToken,
  anonBatch,
  publicChannelId,
  spendKey,
  bufToInt,
  deployAnonReady,
} from './helpers/anon';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// clean-16 B3 migration of the clean-11 profile-pointer G8 GAS GATE + threading invariants onto the permissionless
// PublishAnonBatch path (the old Vault-forwarded PublishBatchToHub is GONE). The mainnet seal is immutable, so the
// profile publish path (reserved bit0 = is_profile -> extra public_profile_index.set + public_profile_head store +
// profile_prev_link thread) MUST fit HUB_PART_GAS_PUBLIC (180000) with margin, and the on-chain threading must be
// exactly what the client discovery/resolve walk expects. The threading logic is UNCHANGED from the Vault path; only
// the per-channel profile index KEY moved from hash(author_wallet) to channel_id = H(PUBLIC_CHANNEL_DOMAIN ‖ spend_pub).
// A "same author / same channel" is modelled by REUSING one spend keypair across posts (each spends one credit and
// carries a distinct nonce). This runs in the sandbox (faithful TVM gas) in lieu of the (owner-declined) mainnet fork.

const HUB_PART_GAS_PUBLIC = 180000n; // must stay in lockstep with contracts/CapsuleHub.tact

function hubGasUsed(res: any, hub: any): bigint {
  const cp: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === hub.address.toString())?.description?.computePhase;
  return cp?.gasUsed ?? -1n;
}

// Publish ONE PUBLIC post/profile/comment as `channel` at the given epoch/nonce via the anon path. Returns the tx
// result so callers can assert the exit code (0 for accepted, a 135xx lane-parse code for the reject matrix).
async function publishPublic(
  env: any,
  channel: any,
  epoch: bigint,
  nonce: bigint,
  opts: { fill?: number; reserved?: bigint; parentLink?: bigint } = {},
) {
  const pt = publicPartToken({
    issuer: env.issuer, spend: channel, slot: env.slot, epoch, nonce,
    fill: opts.fill ?? Number(nonce % 90n), reserved: opts.reserved, parentLink: opts.parentLink,
  });
  return env.hub.send(env.relay.getSender(), { value: toNano('0.3') }, anonBatch({
    parts: pt.part, tokens: pt.tok, partCount: 1n, kind: KIND_PUBLIC, marketing: marketingCell(),
  }));
}

async function setup(credits: bigint) {
  const env: any = await deployAnonReady({ credits });
  env.relay = await env.blockchain.treasury('profile-relay');
  return env;
}

describe('CapsuleHub clean-11 profile-pointer — B3 anon path', () => {
  it('CAPHUB-PROFILE-GAS-01: a profile (reserved=1) publish is clean, fits HUB_PART_GAS_PUBLIC, and costs ~the same as a normal post', async () => {
    const env = await setup(2n);
    const channel = spendKey(0);
    // Same channel + same body fill for both; differ ONLY in the reserved byte, so the gas delta isolates the
    // is_profile threading (the token-verify cost is identical for both and cancels in the delta).
    const normalRes = await publishPublic(env, channel, env.nowEpoch, 400n, { fill: 0, reserved: 0n });
    const profileRes = await publishPublic(env, channel, env.nowEpoch, 401n, { fill: 0, reserved: 1n });

    const gNormal = hubGasUsed(normalRes, env.hub);
    const gProfile = hubGasUsed(profileRes, env.hub);
    // eslint-disable-next-line no-console
    console.log(`[CAPHUB-PROFILE-GAS-01] normal=${gNormal} profile=${gProfile} delta=${gProfile - gNormal} budget=${HUB_PART_GAS_PUBLIC}`);

    expect(hubTxExit(normalRes, env.hub)).toBe(0);
    expect(hubTxExit(profileRes, env.hub)).toBe(0);              // profile publish did NOT abort/OOG
    expect(gProfile).toBeGreaterThan(0n);
    expect(gProfile).toBeLessThanOrEqual(HUB_PART_GAS_PUBLIC);   // fits the immutable per-part budget
    expect(gProfile - gNormal).toBeLessThan(15_000n);           // the extra dict.set + head store is cheap
  });

  it('CAPHUB-PROFILE-THREAD-02: profile publishes thread the global chain + per-channel index exactly as the client walk expects', async () => {
    const env = await setup(3n);
    const channel = spendKey(0);
    const key = publicChannelId(bufToInt(channel.publicKey)); // per-channel profile index key (was hash(author_wallet))

    // First profile -> entry id 0, link 1. head=1, index[channel]=1, profile_prev_link=0 (first ever).
    expect(hubTxExit(await publishPublic(env, channel, env.nowEpoch, 500n, { fill: 0, reserved: 1n }), env.hub)).toBe(0);
    expect(await env.hub.getGetPublicProfileHead()).toBe(1n);
    const idx1 = await env.hub.getGetPublicProfileIndex(key);
    expect(idx1.exists).toBe(true);
    expect(idx1.latest_entry_link).toBe(1n);
    const e0 = await env.hub.getGetPublicEntry(0n);
    expect(e0.exists).toBe(true);
    expect(e0.profile_prev_link).toBe(0n);

    // A NORMAL post in between (id 1) must NOT touch the profile chain.
    expect(hubTxExit(await publishPublic(env, channel, env.nowEpoch, 501n, { fill: 1, reserved: 0n }), env.hub)).toBe(0);
    expect(await env.hub.getGetPublicProfileHead()).toBe(1n);   // unchanged
    expect((await env.hub.getGetPublicEntry(1n)).profile_prev_link).toBe(0n);

    // Second profile -> entry id 2, link 3. head=3, index[channel]=3, profile_prev_link=1 (points back to the 1st).
    expect(hubTxExit(await publishPublic(env, channel, env.nowEpoch, 502n, { fill: 2, reserved: 1n }), env.hub)).toBe(0);
    expect(await env.hub.getGetPublicProfileHead()).toBe(3n);
    expect((await env.hub.getGetPublicProfileIndex(key)).latest_entry_link).toBe(3n);
    const e2 = await env.hub.getGetPublicEntry(2n);
    expect(e2.exists).toBe(true);
    expect(e2.profile_prev_link).toBe(1n);                      // global chain: newest (link 3) -> prev (link 1)
  });

  it('CAPHUB-PROFILE-REJECT-03: is_profile on a COMMENT (parent_link != 0) is rejected (13529), reserved high bits rejected (13521)', async () => {
    const env = await setup(2n);
    const channel = spendKey(0);
    // The spend-token is VALID for each (publicPartToken commits the reserved/parent_link scalars into the spend
    // digest); the receiver reaches the PUBLIC lane-parse and fail-closes there — token verify precedes lane-parse.
    // is_profile + parent_link=2 (a comment) -> fail-closed 13529.
    const commentProfile = await publishPublic(env, channel, env.nowEpoch, 600n, { fill: 0, reserved: 1n, parentLink: 2n });
    expect(hubTxExit(commentProfile, env.hub)).toBe(13529);
    // reserved with a high bit set (2 = bit1) -> fail-closed 13521.
    const badReserved = await publishPublic(env, channel, env.nowEpoch, 601n, { fill: 1, reserved: 2n });
    expect(hubTxExit(badReserved, env.hub)).toBe(13521);
    // Nothing stored (both aborted before spendPoolCredit / the entry store).
    expect(await env.hub.getGetPublicProfileHead()).toBe(0n);
  });
});
