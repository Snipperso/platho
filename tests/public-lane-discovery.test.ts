import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { deployFeeSink } from './helpers/fee-sink-fixture';
import {
  publicChannelPartitionKey,
  publicThreadPartitionKey,
  publicBeaconPartitionKey,
  publicAvatarPartitionKey,
  publicPostUid,
  publicWalletHash,
  publicEpochTag,
  publicEraOf,
  publicBeaconScanAddresses,
  publicChannelScanAddresses,
  publicAvatarScanAddresses,
  PUBLIC_BEACON_READ_SPACE,
  addrKey,
} from '../web/shard-discovery.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLIC-LANE-DISCOVERY — the client derives the SAME partition_key the CONTRACT recomputes, or the publish
// bounces at gate 13702 (and, worse, a scan looks at an address nobody wrote to).
//
// shard-browser-address.test.ts already pins publicShardAddressBytes against @ton/core. What it CANNOT check is
// whether the client computes the right partition_key to feed it — that preimage lives in the contract
// (claimedPartitionKey). So the test here is end to end: derive the address entirely client-side, publish to it,
// and assert the contract ACCEPTED it. A one-bit disagreement in any domain tag or field width bounces at 13702.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const KIND = { CHANNEL: 0, THREAD: 1, BEACON: 2, AVATAR: 3 } as const;
const cell = (f: number) => beginCell().storeBuffer(Buffer.alloc(64, f)).endCell();

const publish = (kind: number, keyArg = 0n, shardSeq = 0) => ({
  $$type: 'PublicPublish' as const,
  kind: BigInt(kind),
  key_arg: keyArg,
  shard_seq: BigInt(shardSeq),
  header: cell(1),
  body: cell(2),
});

/** Open the shard at a CLIENT-derived (partition_key, epoch_tag) and top it up so get_view is callable. */
async function shardAt(bc: Blockchain, partitionKey: bigint, epochTag: bigint) {
  const shard = bc.openContract(await PublicShard.fromInit(partitionKey, epochTag));
  const funder = await bc.treasury(`pld-fund-${partitionKey % 9973n}-${epochTag % 9973n}`);
  await shard.send(funder.getSender(), { value: toNano('0.03') }, null);
  return shard;
}

describe('PUBLIC-LANE-DISCOVERY — client derivation matches the contract preimage', () => {
  it('PLD-01: a CHANNEL post to a CLIENT-derived address is accepted (13702 agrees)', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pld-01-sink' });
    const owner = await bc.treasury('pld-01-owner');
    const era = publicEraOf(KIND.CHANNEL, CLOCK);
    const pk = await publicChannelPartitionKey(publicWalletHash(owner.address), 0);
    const tag = publicEpochTag(KIND.CHANNEL, era);
    const shard = await shardAt(bc, pk, tag);

    const v = await shard.getGetView();
    expect(v.kind).toBe(0n);
    const dm = v.deploy_min_value;
    const r = await shard.send(owner.getSender(), { value: dm + toNano('0.02') }, publish(KIND.CHANNEL));
    const tx = (r.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(tx?.description?.computePhase?.exitCode, 'the client-derived channel key must satisfy gate 13702').toBe(0);
    expect((await shard.getGetView()).entry_count).toBe(1n);
  }, 300_000);

  it('PLD-02: a BEACON to a CLIENT-derived bucket address is accepted', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pld-02-sink' });
    const anyone = await bc.treasury('pld-02-anyone');
    const era = publicEraOf(KIND.BEACON, CLOCK);
    const bucket = 517n;
    const pk = await publicBeaconPartitionKey(bucket);
    const shard = await shardAt(bc, pk, publicEpochTag(KIND.BEACON, era));
    const dm = (await shard.getGetView()).deploy_min_value;

    const r = await shard.send(anyone.getSender(), { value: dm + toNano('0.02') }, publish(KIND.BEACON, bucket));
    const tx = (r.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(tx?.description?.computePhase?.exitCode, 'the client-derived beacon bucket key must satisfy 13702').toBe(0);
  }, 300_000);

  it('PLD-03: an AVATAR shard address derived from the wallet is accepted', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pld-03-sink' });
    const owner = await bc.treasury('pld-03-owner');
    const era = publicEraOf(KIND.AVATAR, CLOCK);
    const pk = await publicAvatarPartitionKey(publicWalletHash(owner.address));
    const shard = await shardAt(bc, pk, publicEpochTag(KIND.AVATAR, era));
    const dm = (await shard.getGetView()).deploy_min_value;

    const r = await shard.send(owner.getSender(), { value: dm + toNano('0.02') }, publish(KIND.AVATAR));
    const tx = (r.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(tx?.description?.computePhase?.exitCode, 'the client-derived avatar key must satisfy 13702').toBe(0);
  }, 300_000);

  it('PLD-04: a THREAD address derived from a post_uid the client itself computed is accepted', async () => {
    // The end-to-end path a comment travels: a reader who rendered a CHANNEL post derives post_uid from
    // (channel_partition_key, epoch_tag, entry_id) — all on screen — then derives the thread shard from it.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pld-04-sink' });
    const commenter = await bc.treasury('pld-04-commenter');
    const channelHash = publicWalletHash((await bc.treasury('pld-04-channel')).address);
    const channelPk = await publicChannelPartitionKey(channelHash, 0);
    const channelTag = publicEpochTag(KIND.CHANNEL, publicEraOf(KIND.CHANNEL, CLOCK));

    const postUid = await publicPostUid(channelPk, channelTag, 0);   // commenting on entry 0 of that channel
    const threadPk = await publicThreadPartitionKey(postUid, 0);
    const shard = await shardAt(bc, threadPk, publicEpochTag(KIND.THREAD, publicEraOf(KIND.THREAD, CLOCK)));
    const dm = (await shard.getGetView()).deploy_min_value;

    const r = await shard.send(commenter.getSender(), { value: dm + toNano('0.02') }, publish(KIND.THREAD, postUid));
    const tx = (r.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(tx?.description?.computePhase?.exitCode, 'the client-derived thread key must satisfy 13702').toBe(0);
  }, 300_000);

  it('PLD-05: the beacon sweep is ONE era-window of buckets, sized to the read budget, and deduped-free', async () => {
    const addrs = await publicBeaconScanAddresses(CLOCK, 3, PUBLIC_BEACON_READ_SPACE);
    expect(addrs.length, '3 eras x 1024 buckets').toBe(3 * PUBLIC_BEACON_READ_SPACE);
    expect(new Set(addrs.map(addrKey)).size, 'every swept address is distinct — no two buckets collide').toBe(addrs.length);
    // One era's worth fits a single accountStates request (1024 < the ~1149-address URL budget).
    const oneEra = await publicBeaconScanAddresses(CLOCK, 1, PUBLIC_BEACON_READ_SPACE);
    expect(oneEra.length).toBe(PUBLIC_BEACON_READ_SPACE);
    expect(PUBLIC_BEACON_READ_SPACE, 'one era = one request').toBeLessThanOrEqual(1149);
  }, 300_000);

  it('PLD-06: a channel sweep and an avatar sweep cover the era window with overflow probing', async () => {
    const hash = publicWalletHash((await (await Blockchain.create()).treasury('pld-06')).address);
    const chan = await publicChannelScanAddresses(hash, CLOCK, 3, 4);
    expect(chan.length, '3 eras x 4 overflow seqs').toBe(12);
    expect(new Set(chan.map(addrKey)).size, 'each (era, seq) is its own shard').toBe(12);
    const av = await publicAvatarScanAddresses(hash, CLOCK, 3);
    expect(av.length, 'current era + 2 before').toBe(3);
    expect(new Set(av.map(addrKey)).size).toBe(3);
  }, 300_000);
});
