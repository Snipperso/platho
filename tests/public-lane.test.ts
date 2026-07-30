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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLIC-LANE — the read assembly the app calls. Wires the tested pieces into sweepChannelCatalog /
// readChannelPosts. Driven against REAL PublicShards in a sandbox for the get_page + /messages paths, with the
// beacon-sweep accountStates mocked. The two things it must prove are the mandatory fixes:
//   * the catalogue ranks live buckets by entry_count, NOT last_transaction_lt (the beacon-firehose defence);
//   * a channel that announced in more than one bucket appears ONCE, newest announcement winning.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const KIND = { CHANNEL: 0, BEACON: 2 } as const;
const cell = (f: number) => beginCell().storeBuffer(Buffer.alloc(48, f)).endCell();

const publicPublishBody = (kind: number, keyArg: bigint, header: any, body: any) =>
  beginCell().storeUint(0x50535031, 32).storeUint(kind, 8).storeUint(keyArg, 256).storeUint(0, 32)
    .storeRef(header).storeRef(body).endCell();

/** Deploy a PublicShard, publish `n` entries as `sender`, and remember the built (header, body) cells. */
async function seedShard(bc: Blockchain, sender: any, kind: number, era: number, pk: bigint, keyArg: bigint, n: number, seed: number) {
  const shard = bc.openContract(await PublicShard.fromInit(pk, publicEpochTag(kind, era)));
  await shard.send(sender.getSender(), { value: toNano('0.03') }, null);
  const built: Array<{ header: any; body: any }> = [];
  for (let i = 0; i < n; i++) {
    bc.now = CLOCK + seed * 1000 + i * 97;
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

    // The lane's transport: get_page/get_view served from the live contract; the /messages reader replayed from
    // the built posts. Everything else (address derivation) runs for real.
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

  it('PL-02: sweepChannelCatalog ranks by entry_count and dedups a channel to its newest announcement', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pl-02-sink' });
    const chanA = await bc.treasury('pl-02-chanA');
    const chanB = await bc.treasury('pl-02-chanB');
    const era = publicEraOf(KIND.BEACON, CLOCK);

    // Bucket 1: chanA announces once (entry_count 1). Bucket 2: chanB announces, and chanA announces AGAIN later
    // (entry_count 2). Ranking by entry_count puts bucket 2 first; dedup must fold chanA to its newer card.
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
    const lane = makeLane(bc, {
      pages: new Map([[k1, b1.shard], [k2, shard2]]),
      messages: new Map([
        [k1, [{ bodyCell: publicPublishBody(KIND.BEACON, 1n, b1.built[0].header, b1.built[0].body), source: chanA.address.toString() }]],
        [k2, built2.slice().reverse().map(({ header, body, who }) => ({
          bodyCell: publicPublishBody(KIND.BEACON, 2n, header, body), source: who.address.toString(),
        }))],
      ]),
      liveShards: [b1.shard.address.toString(), shard2.address.toString()],
    });

    const catalog = await lane.sweepChannelCatalog({ topBuckets: 16 });
    const wallets = catalog.map((c: any) => addrKey(c.channelWallet));
    expect(wallets.includes(addrKey(chanA.address.toString())), 'chanA is listed').toBe(true);
    expect(wallets.includes(addrKey(chanB.address.toString())), 'chanB is listed').toBe(true);
    expect(wallets.filter((w: string) => w === addrKey(chanA.address.toString())).length,
      'chanA appears ONCE despite announcing in two buckets').toBe(1);
    const a = catalog.find((c: any) => addrKey(c.channelWallet) === addrKey(chanA.address.toString()));
    expect(a.announcedAt, 'and it is chanA\'s NEWER announcement that survived').toBe(BigInt(CLOCK + 4 * 1000));
  }, 300_000);

  it('PL-HIJACK-01: republishing an announcement BYTE FOR BYTE does not take over the catalogue entry', async () => {
    // Wave-8 HIGH. Nothing binds sender() when an entry is appended to a BEACON view — gate 13702 folds only the
    // bucket number — so anyone may resend another wallet's exact cells and create a SECOND entry with the SAME
    // body_commit and publisher = themselves. The client keys rows by commit, collapses duplicates, and walks
    // /messages NEWEST FIRST, so the attacker's copy was always the one that matched and their address became the
    // channel's in the catalogue, for the price of one publish. The page row now carries the authoritative
    // publisher's tag, so the client VERIFIES instead of inferring.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pl-hijack-sink' });
    const chanA = await bc.treasury('pl-hijack-chanA');
    const attacker = await bc.treasury('pl-hijack-attacker');
    const era = publicEraOf(KIND.BEACON, CLOCK);
    const pk = await publicBeaconPartitionKey(7n);
    const shard = bc.openContract(await PublicShard.fromInit(pk, publicEpochTag(KIND.BEACON, era)));
    await shard.send(chanA.getSender(), { value: toNano('0.03') }, null);

    // The genuine announcement, then the SAME header and body resent by a stranger one second later.
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
      // NEWEST FIRST, exactly as the real reader receives them: the attacker's copy comes first.
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

  it('PL-03: readThreadComments returns [] for a post whose thread shard was never deployed (no comments)', async () => {
    // The ordinary case: a post nobody has commented on has no THREAD shard, so a bare get_page would hit an
    // uninitialised account and throw exit -13. The liveness guard must turn that into a clean empty list. With the
    // guard removed, this throws "no fixture shard" (get_page on the absent thread) — that is the mutation check.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const lane = makeLane(bc, { pages: new Map(), messages: new Map(), liveShards: [] });
    const chTag = publicEpochTag(KIND.CHANNEL, publicEraOf(KIND.CHANNEL, CLOCK));
    const comments = await lane.readThreadComments('EQBOSbFHf8Iqe390MhsuN8RywBimRbzTwq8dtnN9fN4MyZOP', chTag, 0n, { channelShardSeq: 0 });
    expect(comments, 'an uncommented post yields no comments, not a throw').toEqual([]);
  }, 60_000);
});

/**
 * A lane whose transport serves get_page/get_view from the given live contracts and whose beacon sweep and
 * /messages are the given fixtures. This is how the assembly is tested without a real endpoint.
 */
function makeLane(bc: Blockchain, fixture: { pages: Map<string, any>; messages: Map<string, any[]>; liveShards: string[] }) {
  const shardByKey = fixture.pages;
  const runGetMethod = async (call: any) => {
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
  // The sweep's accountStates + /messages are stubbed at the transport boundary: the lane builds its readers from
  // (endpoint, fetch), so a fake fetch answers both. get_page/get_view go through runGetMethod, served live.
  return createPublicLane({ runGetMethod, now: () => CLOCK, endpoint: 'https://x/api/v3/accountStates', fetch: makeFakeFetch(bc, fixture) });
}

/** A fetch that answers /accountStates with the live shards present, and /messages with the fixture bodies. */
function makeFakeFetch(bc: Blockchain, fixture: { messages: Map<string, any[]>; liveShards: string[] }) {
  const liveKeys = new Set(fixture.liveShards.map(addrKey));
  return async (urlStr: string) => {
    const url = new URL(urlStr);
    if (url.pathname.endsWith('/accountStates')) {
      const requested = url.searchParams.getAll('address');
      const accounts = requested
        .filter((a) => liveKeys.has(addrKey(a)))
        .map((a) => ({ address: addrKey(a), status: 'active', balance: '1000000', data_hash: 'h', last_transaction_lt: '1' }));
      return { ok: true, status: 200, json: async () => ({ accounts }) };
    }
    if (url.pathname.endsWith('/messages')) {
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
