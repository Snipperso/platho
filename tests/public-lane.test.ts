import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { deployFeeSink } from './helpers/fee-sink-fixture';
import { createPublicLane } from '../web/public-lane.mjs';
import {
  publicChannelPartitionKey,
  publicBeaconPartitionKey,
  publicWalletHash,
  publicEpochTag,
  publicEraOf,
  addrKey,
} from '../web/shard-discovery.mjs';


const CLOCK = 1_790_000_000;
const KIND = { CHANNEL: 0, BEACON: 2 } as const;
const cell = (f: number) => beginCell().storeBuffer(Buffer.alloc(48, f)).endCell();

const publicPublishBody = (kind: number, keyArg: bigint, header: any, body: any) =>
  beginCell().storeUint(0x50535031, 32).storeUint(kind, 8).storeUint(keyArg, 256).storeUint(0, 32)
    .storeRef(header).storeRef(body).endCell();

async function seedShard(bc: Blockchain, sender: any, kind: number, era: number, pk: bigint, keyArg: bigint, n: number, seed: number, baseNow: number = CLOCK) {
  const shard = bc.openContract(await PublicShard.fromInit(pk, publicEpochTag(kind, era)));
  bc.now = baseNow;
  await shard.send(sender.getSender(), { value: toNano('0.03') }, null);
  const built: Array<{ header: any; body: any }> = [];
  for (let i = 0; i < n; i++) {
    bc.now = baseNow + seed * 1000 + i * 97;
    const header = cell(seed * 10 + i);
    const body = cell(seed * 10 + 100 + i);
    built.push({ header, body });
    const v = await shard.getGetView();
    const due = v.entry_count === 0n ? v.deploy_min_value : v.min_value;
    await shard.send(sender.getSender(), { value: due + toNano('0.02') },
      { $$type: 'PublicPublish', kind: BigInt(kind), key_arg: keyArg, shard_seq: 0n, header, body } as any);
  }
  return { shard, built };
}

describe('PUBLIC-LANE — the read assembly', () => {
  it('PL-01: readChannelPosts returns a channel\'s authenticated posts newest-first', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pl-01-sink' });
    const owner = await bc.treasury('pl-01-owner');
    const era = publicEraOf(KIND.CHANNEL, CLOCK);
    const pk = await publicChannelPartitionKey(publicWalletHash(owner.address), 0);
    const { shard, built } = await seedShard(bc, owner, KIND.CHANNEL, era, pk, 0n, 3, 1);

    const shardKey = addrKey(shard.address.toString());
    const lane = makeLane(bc, {
      pages: new Map([[shardKey, shard]]),
      messages: new Map([[shardKey, built.slice().reverse().map(({ header, body }) => ({
        bodyCell: publicPublishBody(KIND.CHANNEL, 0n, header, body), source: owner.address.toString(),
      }))]]),
      liveShards: [shard.address.toString()],
    });

    const posts = await lane.readChannelPosts(owner.address.toString());
    expect(posts.length, 'all three posts, authenticated').toBe(3);
    expect(posts[0].created_at > posts[2].created_at, 'newest first').toBe(true);
    for (const p of posts) expect(addrKey(p.publisher), 'attributed to the channel wallet').toBe(addrKey(owner.address.toString()));
  }, 300_000);

  it('PL-FLIP06-01: a generation-17 shard is asked ONE opcode on the flip build — the vault door it does not have is not asked [FLIP-06]', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pl-flip06-sink' });
    const owner = await bc.treasury('pl-flip06-owner');
    const era = publicEraOf(KIND.CHANNEL, CLOCK);
    const pk = await publicChannelPartitionKey(publicWalletHash(owner.address), 0);
    const { shard, built } = await seedShard(bc, owner, KIND.CHANNEL, era, pk, 0n, 2, 3);
    const shardKey = addrKey(shard.address.toString());
    const urls: string[] = [];
    const lane = makeLane(bc, {
      pages: new Map([[shardKey, shard]]),
      messages: new Map([[shardKey, built.slice().reverse().map(({ header, body }) => ({
        bodyCell: publicPublishBody(KIND.CHANNEL, 0n, header, body), source: owner.address.toString(),
      }))]]),
      liveShards: [shard.address.toString()],
      onUrl: (url) => urls.push(url),
    });
    const posts = await lane.readChannelPosts(owner.address.toString());
    expect(posts.length, 'the posts are read').toBe(2);
    const asked = urls.filter((u) => new URL(u).pathname.endsWith('/messages'))
      .filter((u) => addrKey(new URL(u).searchParams.get('destination') ?? '') === shardKey)
      .map((u) => new URL(u).searchParams.get('opcode'));
    expect(asked.length, 'the generation-17 shard was read').toBeGreaterThan(0);
    expect([...new Set(asked)], 'PublicPublish alone — never the vault door a clean-17 shard does not have').toEqual(['0x50535031']);
  }, 300_000);

  it('PL-YEAR-01: a channel is read over the RETENTION year, and an unchanged shard is never re-read', async () => {
    const ERA_SECONDS = 2_592_000;
    const era = publicEraOf(KIND.CHANNEL, CLOCK);
    const oldEra = era - 10;
    const oldEraStart = oldEra * ERA_SECONDS + 1000;

    const bc = await Blockchain.create();
    bc.now = oldEraStart;
    await deployFeeSink(bc, { funderSeed: 'pl-year-sink' });
    const owner = await bc.treasury('pl-year-owner');
    const pk = await publicChannelPartitionKey(publicWalletHash(owner.address), 0);
    const { shard, built } = await seedShard(bc, owner, KIND.CHANNEL, oldEra, pk, 0n, 2, 7, oldEraStart);
    bc.now = CLOCK;

    const shardKey = addrKey(shard.address.toString());
    const rows = built.slice().reverse().map(({ header, body }) => ({
      bodyCell: publicPublishBody(KIND.CHANNEL, 0n, header, body), source: owner.address.toString(),
    }));
    let messageReads = 0;
    let markerLt = '1';
    const lane = makeLane(bc, {
      pages: new Map([[shardKey, shard]]),
      messages: new Map([[shardKey, rows]]),
      liveShards: [shard.address.toString()],
      onMessages: () => { messageReads += 1; },
      lt: () => markerLt,
    });

    const first = await lane.readChannelPosts(owner.address.toString());
    expect(first.length, 'a shard ten eras old is still inside the window').toBe(2);
    expect(messageReads, 'first read fetches the history').toBe(1);

    const second = await lane.readChannelPosts(owner.address.toString());
    expect(second.length, 'served from the snapshot, identical').toBe(2);
    expect(messageReads, 'the marker did not move, so nothing was re-fetched').toBe(1);

    markerLt = '2';
    const third = await lane.readChannelPosts(owner.address.toString());
    expect(third.length).toBe(2);
    expect(messageReads, 'a moved marker re-reads exactly once').toBe(2);
  }, 300_000);

  it('PL-02: sweepChannelCatalog reads EVERY live bucket, most recently touched first, and dedups a channel to its newest announcement', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pl-02-sink' });
    const chanA = await bc.treasury('pl-02-chanA');
    const chanB = await bc.treasury('pl-02-chanB');
    const era = publicEraOf(KIND.BEACON, CLOCK);

    const pk1 = await publicBeaconPartitionKey(1n);
    const b1 = await seedShard(bc, chanA, KIND.BEACON, era, pk1, 1n, 1, 2);
    const pk2 = await publicBeaconPartitionKey(2n);
    const shard2 = bc.openContract(await PublicShard.fromInit(pk2, publicEpochTag(KIND.BEACON, era)));
    await shard2.send(chanB.getSender(), { value: toNano('0.03') }, null);
    const built2: Array<{ header: any; body: any; who: any }> = [];
    for (const [who, seed] of [[chanB, 3], [chanA, 4]] as const) {
      bc.now = CLOCK + seed * 1000;
      const header = cell(seed); const body = cell(seed + 50);
      built2.push({ header, body, who });
      const v = await shard2.getGetView();
      const due = v.entry_count === 0n ? v.deploy_min_value : v.min_value;
      await shard2.send(who.getSender(), { value: due + toNano('0.02') },
        { $$type: 'PublicPublish', kind: 2n, key_arg: 2n, shard_seq: 0n, header, body } as any);
    }

    const k1 = addrKey(b1.shard.address.toString());
    const k2 = addrKey(shard2.address.toString());
    const getters: string[] = [];
    let messageReads = 0;
    const lts = new Map([[k1, '5'], [k2, '9']]);
    const lane = makeLane(bc, {
      pages: new Map([[k1, b1.shard], [k2, shard2]]),
      messages: new Map([
        [k1, [{ bodyCell: publicPublishBody(KIND.BEACON, 1n, b1.built[0].header, b1.built[0].body), source: chanA.address.toString() }]],
        [k2, built2.slice().reverse().map(({ header, body, who }) => ({
          bodyCell: publicPublishBody(KIND.BEACON, 2n, header, body), source: who.address.toString(),
        }))],
      ]),
      liveShards: [b1.shard.address.toString(), shard2.address.toString()],
      lt: (key?: string) => lts.get(key ?? '') ?? '1',
      onGetMethod: (call: any) => { getters.push(call.method); },
      onMessages: () => { messageReads += 1; },
    });

    const readsAtFirstReport: number[] = [];
    const firstReport: string[][] = [];
    const catalog = await lane.sweepChannelCatalog({
      onProgress: (partial: any[]) => {
        if (firstReport.length === 0) {
          readsAtFirstReport.push(messageReads);
          firstReport.push(partial.map((c: any) => addrKey(c.channelWallet)));
        }
      },
    });
    expect(readsAtFirstReport, 'the first report came after exactly one bucket was read').toEqual([1]);
    expect(firstReport[0], 'and that bucket was the most recently touched one (bucket 2)')
      .toEqual([addrKey(chanA.address.toString()), addrKey(chanB.address.toString())]);

    const wallets = catalog.map((c: any) => addrKey(c.channelWallet));
    expect(wallets.includes(addrKey(chanA.address.toString())), 'chanA is listed').toBe(true);
    expect(wallets.includes(addrKey(chanB.address.toString())), 'chanB is listed').toBe(true);
    expect(wallets.filter((w: string) => w === addrKey(chanA.address.toString())).length,
      'chanA appears ONCE despite announcing in two buckets').toBe(1);
    const a = catalog.find((c: any) => addrKey(c.channelWallet) === addrKey(chanA.address.toString()));
    expect(a.announcedAt, 'and it is chanA\'s NEWER announcement that survived').toBe(BigInt(CLOCK + 4 * 1000));
    expect(wallets, 'arrival order is kept: the most recently touched bucket first, newest card within it first')
      .toEqual([addrKey(chanA.address.toString()), addrKey(chanB.address.toString())]);

    expect(getters.filter((m) => m === 'get_view'), 'no get_view ranking pass').toEqual([]);
    expect(getters.filter((m) => m === 'get_page').length, 'one page per bucket, no entry_count probe').toBe(2);
    expect(messageReads, 'one history read per bucket').toBe(2);

    const again = await lane.sweepChannelCatalog({});
    expect(again.map((c: any) => addrKey(c.channelWallet)), 'identical catalog').toEqual(wallets);
    expect(messageReads, 'served from the snapshot cache — no history re-read').toBe(2);
    expect(getters.filter((m) => m === 'get_page').length, 'and no getter either').toBe(2);

    lts.set(k1, '6');
    const third = await lane.sweepChannelCatalog({});
    expect(third.length).toBe(2);
    expect(messageReads, 'a moved marker re-reads exactly the moved bucket').toBe(3);

    lts.set(k1, '7');
    lts.set(k2, '10');
    const readsAtTurn: number[] = [];
    let release: () => void = () => {};
    let hold = true;
    const fourth = lane.sweepChannelCatalog({
      waitForTurn: async () => {
        readsAtTurn.push(messageReads);
        if (hold) { hold = false; await new Promise<void>((resolve) => { release = resolve; }); }
      },
    });
    for (let waited = 0; waited < 5_000 && readsAtTurn.length === 0; waited += 50) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    for (let waited = 0; waited < 5_000 && readsAtTurn.length === 1; waited += 100) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(readsAtTurn, 'held at its first turn, before the state read: no further turn is asked for while it is held').toEqual([3]);
    expect(messageReads, 'and nothing was read while it was held').toBe(3);
    release();
    expect((await fourth).length).toBe(2);
    expect(readsAtTurn, 'then a turn before each of the two buckets').toEqual([3, 3, 4]);
    expect(messageReads).toBe(5);
  }, 300_000);

  it('PL-HIJACK-01: republishing an announcement BYTE FOR BYTE does not take over the catalogue entry', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pl-hijack-sink' });
    const chanA = await bc.treasury('pl-hijack-chanA');
    const attacker = await bc.treasury('pl-hijack-attacker');
    const era = publicEraOf(KIND.BEACON, CLOCK);
    const pk = await publicBeaconPartitionKey(7n);
    const shard = bc.openContract(await PublicShard.fromInit(pk, publicEpochTag(KIND.BEACON, era)));
    await shard.send(chanA.getSender(), { value: toNano('0.03') }, null);

    const header = cell(11); const body = cell(61);
    for (const [who, at] of [[chanA, CLOCK + 1000], [attacker, CLOCK + 2000]] as const) {
      bc.now = at;
      const v = await shard.getGetView();
      const due = v.entry_count === 0n ? v.deploy_min_value : v.min_value;
      await shard.send(who.getSender(), { value: due + toNano('0.02') },
        { $$type: 'PublicPublish', kind: 2n, key_arg: 7n, shard_seq: 0n, header, body } as any);
    }
    expect((await shard.getGetView()).entry_count, 'the shard accepted BOTH — the duplicate is not refused on chain').toBe(2n);

    const k = addrKey(shard.address.toString());
    const lane = makeLane(bc, {
      pages: new Map([[k, shard]]),
      messages: new Map([[k, [
        { bodyCell: publicPublishBody(KIND.BEACON, 7n, header, body), source: attacker.address.toString() },
        { bodyCell: publicPublishBody(KIND.BEACON, 7n, header, body), source: chanA.address.toString() },
      ]]]),
      liveShards: [shard.address.toString()],
    });

    const catalog = await lane.sweepChannelCatalog({ topBuckets: 16 });
    const wallets = catalog.map((c: any) => addrKey(c.channelWallet));
    expect(wallets.includes(addrKey(attacker.address.toString())), 'the squatter must NOT own the entry').toBe(false);
    expect(wallets.includes(addrKey(chanA.address.toString())), 'the genuine channel keeps its catalogue entry').toBe(true);
  }, 300_000);

  it('PL-LATEST-01: readLatestChannelPosts reads only the newest live era, a small tail window, and never shrinks the shared snapshot', async () => {
    const ERA_SECONDS = 2_592_000;
    const era = publicEraOf(KIND.CHANNEL, CLOCK);
    const oldEra = era - 2;
    const oldEraStart = oldEra * ERA_SECONDS + 1000;
    const bc = await Blockchain.create();
    bc.now = oldEraStart;
    await deployFeeSink(bc, { funderSeed: 'pl-latest-sink' });
    const owner = await bc.treasury('pl-latest-owner');
    const pk = await publicChannelPartitionKey(publicWalletHash(owner.address), 0);
    const old = await seedShard(bc, owner, KIND.CHANNEL, oldEra, pk, 0n, 2, 3, oldEraStart);
    bc.now = CLOCK;
    const cur = await seedShard(bc, owner, KIND.CHANNEL, era, pk, 0n, 5, 5);
    const rowsOf = (built: Array<{ header: any; body: any }>) => built.slice().reverse().map(({ header, body }) => ({
      bodyCell: publicPublishBody(KIND.CHANNEL, 0n, header, body), source: owner.address.toString(),
    }));
    const oldKey = addrKey(old.shard.address.toString());
    const curKey = addrKey(cur.shard.address.toString());
    let messageReads = 0;
    const lane = makeLane(bc, {
      pages: new Map([[oldKey, old.shard], [curKey, cur.shard]]),
      messages: new Map([[oldKey, rowsOf(old.built)], [curKey, rowsOf(cur.built)]]),
      liveShards: [old.shard.address.toString(), cur.shard.address.toString()],
      onMessages: () => { messageReads += 1; },
    });

    const latest = await lane.readLatestChannelPosts(owner.address.toString(), { maxCount: 2n });
    expect(latest.era, 'the newest live era').toBe(era);
    expect(latest.posts.length, 'the tail window only, not the shard').toBe(2);
    expect(latest.posts[0].created_at > latest.posts[1].created_at, 'newest first').toBe(true);
    expect(String(latest.posts[0].channelEpochTag), 'tagged like readChannelPosts tags').toBe(String(publicEpochTag(KIND.CHANNEL, era)));
    expect(messageReads, 'ONE history read — the older era was not touched').toBe(1);
    expect(latest.exhausted, 'an older era remains in the window').toBe(false);

    const again = await lane.readLatestChannelPosts(owner.address.toString(), { maxCount: 2n });
    expect(again.posts.length).toBe(2);
    expect(messageReads, 'a repeat is served from the small cache').toBe(1);

    const older = await lane.readLatestChannelPosts(owner.address.toString(), { maxCount: 2n, beforeEra: era });
    expect(older.era, 'one era back on request').toBe(oldEra);
    expect(older.posts.length).toBe(2);
    expect(messageReads).toBe(2);

    const full = await lane.readChannelPosts(owner.address.toString());
    const thisEra = full.filter((p: any) => String(p.channelEpochTag) === String(publicEpochTag(KIND.CHANNEL, era)));
    expect(thisEra.length, 'all five posts — not the two-row card window').toBe(5);
    const reads = messageReads;
    const served = await lane.readLatestChannelPosts(owner.address.toString(), { maxCount: 2n });
    expect(served.posts.length, 'a full snapshot IS the answer').toBe(5);
    expect(messageReads).toBe(reads);
  }, 300_000);

  it('PL-HEADS-01: the All feed probes many channels in ONE state read, reads one shard\'s tail at the class it is asked, and keeps no cache', async () => {
    const ERA_SECONDS = 2_592_000;
    const era = publicEraOf(KIND.CHANNEL, CLOCK);
    const oldEra = era - 2;
    const oldEraStart = oldEra * ERA_SECONDS + 1000;
    const bc = await Blockchain.create();
    bc.now = oldEraStart;
    await deployFeeSink(bc, { funderSeed: 'pl-heads-sink' });
    const owner = await bc.treasury('pl-heads-owner');
    const quiet = await bc.treasury('pl-heads-quiet');
    const pk = await publicChannelPartitionKey(publicWalletHash(owner.address), 0);
    const old = await seedShard(bc, owner, KIND.CHANNEL, oldEra, pk, 0n, 2, 3, oldEraStart);
    bc.now = CLOCK;
    const cur = await seedShard(bc, owner, KIND.CHANNEL, era, pk, 0n, 5, 5);
    const rowsOf = (built: Array<{ header: any; body: any }>) => built.slice().reverse().map(({ header, body }) => ({
      bodyCell: publicPublishBody(KIND.CHANNEL, 0n, header, body), source: owner.address.toString(),
    }));
    const oldKey = addrKey(old.shard.address.toString());
    const curKey = addrKey(cur.shard.address.toString());
    let messageReads = 0;
    const getPageCalls: any[] = [];
    const lane = makeLane(bc, {
      pages: new Map([[oldKey, old.shard], [curKey, cur.shard]]),
      messages: new Map([[oldKey, rowsOf(old.built)], [curKey, rowsOf(cur.built)]]),
      liveShards: [old.shard.address.toString(), cur.shard.address.toString()],
      onMessages: () => { messageReads += 1; },
      lt: (key) => (key === curKey ? '50' : '20'),
      onGetMethod: (call) => { if (call.method === 'get_page') getPageCalls.push(call); },
    });

    const heads = await lane.probeChannelHeads([owner.address.toString(), quiet.address.toString()]);
    const head = heads.get(owner.address.toString());
    expect(head.unknown).toBe(false);
    expect(head.shards.map((shard: any) => [shard.key, shard.era, shard.marker]), 'both live shards of the window, newest era first')
      .toEqual([[curKey, era, '50'], [oldKey, oldEra, '20']]);
    expect(String(head.shards[0].epochTag)).toBe(String(publicEpochTag(KIND.CHANNEL, era)));
    expect(heads.get(quiet.address.toString()), 'a channel with nothing live is empty, not unknown').toEqual({ shards: [], unknown: false });
    expect(messageReads, 'the probe reads no history').toBe(0);

    const read = await lane.readChannelHead(owner.address.toString(), head.shards[0], { maxCount: 2n, requestOptions: { priority: 'background', skipIfRateLimited: true } });
    expect(read.posts.length, 'the tail window asked for').toBe(2);
    expect(read.entryCount).toBe(5);
    expect(read.posts[0].created_at > read.posts[1].created_at, 'newest first').toBe(true);
    expect(String(read.posts[0].channelEpochTag)).toBe(String(publicEpochTag(KIND.CHANNEL, era)));
    expect(read.posts[0].generation).toBe(head.shards[0].generation);
    expect(messageReads).toBe(1);
    expect(getPageCalls.length).toBeGreaterThan(0);
    for (const call of getPageCalls) {
      expect([call.priority, call.skipIfRateLimited], 'get_page at the class the pass asked').toEqual(['background', true]);
    }

    const card = await lane.readLatestChannelPosts(owner.address.toString(), { maxCount: 2n });
    expect(card.posts.length).toBe(2);
    expect(messageReads, 'the All feed read left no snapshot behind').toBe(2);
    const full = await lane.readChannelPosts(owner.address.toString());
    expect(full.filter((p: any) => String(p.channelEpochTag) === String(publicEpochTag(KIND.CHANNEL, era))).length).toBe(5);

    const deaf = createPublicLane({
      runGetMethod: async () => { throw new Error('no getter expected'); },
      now: () => CLOCK,
      endpoint: 'https://pl-heads-deaf.invalid/api/v3/accountStates',
      fetch: async () => ({ ok: false, status: 429, headers: { get: () => null }, json: async () => ({}), text: async () => 'rate limited' }),
    });
    const unanswered = await deaf.probeChannelHeads([owner.address.toString()], { requestOptions: { priority: 'background', skipIfRateLimited: true } });
    expect(unanswered.get(owner.address.toString())?.unknown, 'not measured this pass — never "no posts"').toBe(true);
    expect(unanswered.get(owner.address.toString())?.shards).toEqual([]);
  }, 300_000);

  it('PL-HEADS-02: a head read pays only for what is new — no body when the count stands, the rows above the held count when it grew, a snapshot trimmed to the window', async () => {
    const era = publicEraOf(KIND.CHANNEL, CLOCK);
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pl-heads2-sink' });
    const owner = await bc.treasury('pl-heads2-owner');
    const pk = await publicChannelPartitionKey(publicWalletHash(owner.address), 0);
    const cur = await seedShard(bc, owner, KIND.CHANNEL, era, pk, 0n, 5, 5);
    const rowsOf = (built: Array<{ header: any; body: any }>) => built.slice().reverse().map(({ header, body }) => ({
      bodyCell: publicPublishBody(KIND.CHANNEL, 0n, header, body), source: owner.address.toString(),
    }));
    const curKey = addrKey(cur.shard.address.toString());
    let messageReads = 0;
    const pages: any[] = [];
    const lane = makeLane(bc, {
      pages: new Map([[curKey, cur.shard]]),
      messages: new Map([[curKey, rowsOf(cur.built)]]),
      liveShards: [cur.shard.address.toString()],
      onMessages: () => { messageReads += 1; },
      lt: () => '50',
      onGetMethod: (call) => { if (call.method === 'get_page') pages.push(call); },
    });
    const wallet = owner.address.toString();
    const head = (await lane.probeChannelHeads([wallet])).get(wallet).shards[0];
    const entries = (read: any) => read.posts.map((row: any) => Number(row.entry_id)).sort((a: number, b: number) => a - b);
    pages.length = 0;
    expect(await lane.readChannelHead(wallet, head, { maxCount: 32, heldCount: 5 })).toMatchObject({ unchanged: true, posts: [], entryCount: 5, fresh: 0 });
    expect(pages.length, 'one get_page (0, 0)').toBe(1);
    expect(messageReads, 'and no body').toBe(0);
    const grown = await lane.readChannelHead(wallet, head, { maxCount: 32, heldCount: 3 });
    expect([grown.fresh, grown.entryCount, entries(grown)]).toEqual([2, 5, [3, 4]]);
    expect(messageReads).toBe(1);
    const whole = await lane.readChannelHead(wallet, head, { maxCount: 32, heldCount: null });
    expect([whole.fresh, entries(whole)]).toEqual([null, [0, 1, 2, 3, 4]]);
    const byDefault = await lane.readChannelHead(wallet, head, { heldCount: 4 });
    expect([byDefault.fresh, entries(byDefault)]).toEqual([1, [4]]);
    expect((await lane.readChannelHead(wallet, head, { maxCount: 32, heldCount: 9 })).fresh).toBeNull();
    await lane.readChannelPosts(wallet);
    const reads = messageReads;
    const snap = await lane.readChannelHead(wallet, head, { maxCount: 2 });
    expect([entries(snap), snap.entryCount, messageReads - reads]).toEqual([[3, 4], 5, 0]);
  }, 300_000);

  it('PL-03: readThreadComments returns [] for a post whose thread shard was never deployed (no comments)', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const lane = makeLane(bc, { pages: new Map(), messages: new Map(), liveShards: [] });
    const chTag = publicEpochTag(KIND.CHANNEL, publicEraOf(KIND.CHANNEL, CLOCK));
    const { posts: comments } = await lane.readThreadComments('EQBOSbFHf8Iqe390MhsuN8RywBimRbzTwq8dtnN9fN4MyZOP', chTag, 0n, { channelShardSeq: 0 });
    expect(comments, 'an uncommented post yields no comments, not a throw').toEqual([]);
  }, 60_000);
});

function makeLane(bc: Blockchain, fixture: { pages: Map<string, any>; messages: Map<string, any[]>; liveShards: string[]; onMessages?: () => void; onUrl?: (url: string) => void; lt?: (key?: string) => string; onGetMethod?: (call: any) => void }) {
  const shardByKey = fixture.pages;
  const runGetMethod = async (call: any) => {
    fixture.onGetMethod?.(call);
    const shard = shardByKey.get(addrKey(call.address));
    if (!shard) throw new Error(`no fixture shard for ${call.address}`);
    if (call.method === 'get_view') {
      const v = await shard.getGetView();
      return { stack: [
        num(v.partition_key), num(v.epoch_tag), num(v.kind), num(v.era_index), num(v.entry_count),
        num(v.safe_cap), num(v.era_seconds), num(v.retention), num(v.min_value), num(v.deploy_min_value),
        num(v.protocol_fee), num(v.retire_at), ['cell', beginCell().storeAddress(v.fee_sink).endCell()],
      ] };
    }
    if (call.method === 'get_page') {
      const p = await shard.getGetPage(BigInt(call.stack[0].value), BigInt(call.stack[1].value));
      return { stack: [num(p.from_id), num(p.count), num(p.entry_count), ['cell', p.rows]] };
    }
    throw new Error(`unexpected method ${call.method}`);
  };
  return createPublicLane({ runGetMethod, now: () => CLOCK, endpoint: 'https://x/api/v3/accountStates', fetch: makeFakeFetch(bc, fixture) });
}

function makeFakeFetch(bc: Blockchain, fixture: { messages: Map<string, any[]>; liveShards: string[]; onMessages?: () => void; lt?: (key?: string) => string; onUrl?: (url: string) => void }) {
  const liveKeys = new Set(fixture.liveShards.map(addrKey));
  return async (urlStr: string) => {
    fixture.onUrl?.(urlStr);
    const url = new URL(urlStr);
    if (url.pathname.endsWith('/accountStates')) {
      const requested = url.searchParams.getAll('address');
      const accounts = requested
        .filter((a) => liveKeys.has(addrKey(a)))
        .map((a) => ({ address: addrKey(a), status: 'active', balance: '1000000', data_hash: 'h', last_transaction_lt: fixture.lt ? fixture.lt(addrKey(a)) : '1' }));
      return { ok: true, status: 200, json: async () => ({ accounts }) };
    }
    if (url.pathname.endsWith('/messages')) {
      fixture.onMessages?.();
      const dest = addrKey(url.searchParams.get('destination') ?? '');
      const rows = fixture.messages.get(dest) ?? [];
      const messages = rows.map((r: any) => ({
        source: r.source,
        message_content: { body: bocBase64(r.bodyCell) },
      }));
      return { ok: true, status: 200, json: async () => ({ messages }) };
    }
    throw new Error(`unexpected fetch ${urlStr}`);
  };
}

const num = (v: bigint) => ({ type: 'num', value: '0x' + BigInt(v).toString(16) });
const bocBase64 = (cellObj: any) => cellObj.toBoc().toString('base64');
