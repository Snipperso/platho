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
  publicEraGenerations,
  PUBLIC_BEACON_READ_SPACE,
  addrKey,
} from '../web/shard-discovery.mjs';

const legsAt = (kind: number, window: number) => {
  let legs = 0;
  const era = publicEraOf(kind, CLOCK);
  for (let e = era; e > era - window && e >= 0; e -= 1) legs += publicEraGenerations(kind, e).length;
  return legs;
};


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
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pld-04-sink' });
    const commenter = await bc.treasury('pld-04-commenter');
    const channelHash = publicWalletHash((await bc.treasury('pld-04-channel')).address);
    const channelPk = await publicChannelPartitionKey(channelHash, 0);
    const channelTag = publicEpochTag(KIND.CHANNEL, publicEraOf(KIND.CHANNEL, CLOCK));

    const postUid = await publicPostUid(channelPk, channelTag, 0);
    const threadPk = await publicThreadPartitionKey(postUid, 0);
    const shard = await shardAt(bc, threadPk, publicEpochTag(KIND.THREAD, publicEraOf(KIND.THREAD, CLOCK)));
    const dm = (await shard.getGetView()).deploy_min_value;

    const r = await shard.send(commenter.getSender(), { value: dm + toNano('0.02') }, publish(KIND.THREAD, postUid));
    const tx = (r.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(tx?.description?.computePhase?.exitCode, 'the client-derived thread key must satisfy 13702').toBe(0);
  }, 300_000);

  it('PLD-05: the beacon sweep is ONE era-window of buckets, sized to the read budget, and deduped-free', async () => {
    const addrs = await publicBeaconScanAddresses(CLOCK, 3, PUBLIC_BEACON_READ_SPACE);
    expect(legsAt(KIND.BEACON, 3), 'the current BEACON era straddles E').toBe(4);
    expect(addrs.length, '3 eras x 1024 buckets, the straddling era in both generations').toBe(legsAt(KIND.BEACON, 3) * PUBLIC_BEACON_READ_SPACE);
    expect(new Set(addrs.map(addrKey)).size, 'every swept address is distinct — no two buckets collide').toBe(addrs.length);
    const oneEra = await publicBeaconScanAddresses(CLOCK, 1, PUBLIC_BEACON_READ_SPACE);
    expect(oneEra.length).toBe(legsAt(KIND.BEACON, 1) * PUBLIC_BEACON_READ_SPACE);
    expect(PUBLIC_BEACON_READ_SPACE, 'one era-leg = one request').toBeLessThanOrEqual(1149);
  }, 300_000);

  it('PLD-06: a channel sweep and an avatar sweep cover the era window with overflow probing', async () => {
    const hash = publicWalletHash((await (await Blockchain.create()).treasury('pld-06')).address);
    const chan = await publicChannelScanAddresses(hash, CLOCK, 3, 4);
    expect(legsAt(KIND.CHANNEL, 3), 'no CHANNEL era straddles E').toBe(3);
    expect(chan.length, '3 eras x 4 overflow seqs').toBe(12);
    expect(new Set(chan.map(addrKey)).size, 'each (era, seq) is its own shard').toBe(12);
    const av = await publicAvatarScanAddresses(hash, CLOCK, 3);
    expect(av.length, 'current era (both generations) + 2 before').toBe(legsAt(KIND.AVATAR, 3));
    expect(legsAt(KIND.AVATAR, 3)).toBe(4);
    expect(new Set(av.map(addrKey)).size).toBe(av.length);
  }, 300_000);
});
