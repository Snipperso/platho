import { describe, expect, it } from 'vitest';
import { beginCell, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { deployFeeSink } from './helpers/fee-sink-fixture';
import { createPublicLane } from '../web/public-lane.mjs';
import {
  publicChannelPartitionKey, publicThreadPartitionKey, publicPostUid,
  publicWalletHash, publicEpochTag, publicEraOf, addrKey,
} from '../web/shard-discovery.mjs';


const CLOCK = 1_790_000_000;
const KIND_CHANNEL = 0;
const KIND_THREAD = 1;
const PAGE_CAP = 96;

const cell = (f: number) => beginCell().storeBuffer(Buffer.alloc(48, f)).endCell();
const num = (v: bigint) => ({ type: 'num', value: '0x' + BigInt(v).toString(16) });
const bocBase64 = (c: any) => c.toBoc().toString('base64');
const publishBody = (keyArg: bigint, header: any, body: any) =>
  beginCell().storeUint(0x50535031, 32).storeUint(KIND_THREAD, 8).storeUint(keyArg, 256).storeUint(0, 32)
    .storeRef(header).storeRef(body).endCell();

function laneOverThread(shard: any, rows: Array<{ header: any; body: any; source: string }>, keyArg: bigint) {
  const runGetMethod = async (call: any) => {
    if (addrKey(call.address) !== addrKey(shard.address.toString())) throw new Error(`no shard for ${call.address}`);
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
  const fetchImpl = async (urlStr: string) => {
    const url = new URL(urlStr);
    if (url.pathname.endsWith('/accountStates')) {
      const accounts = url.searchParams.getAll('address')
        .filter((a) => addrKey(a) === addrKey(shard.address.toString()))
        .map((a) => ({ address: addrKey(a), status: 'active', balance: '1000000', data_hash: 'h', last_transaction_lt: '1' }));
      return { ok: true, status: 200, json: async () => ({ accounts }) } as any;
    }
    if (url.pathname.endsWith('/messages')) {
      const limit = Number(url.searchParams.get('limit') ?? '128');
      const offset = Number(url.searchParams.get('offset') ?? '0');
      const endLt = url.searchParams.get('end_lt');
      const all = rows.map((r, i) => ({
        opcode: '0x50535031', source: r.source, created_lt: String(1_000 + i),
        message_content: { body: bocBase64(publishBody(keyArg, r.header, r.body)) },
      })).filter((m) => endLt === null || BigInt(m.created_lt) <= BigInt(endLt));
      const ordered = url.searchParams.get('sort') === 'desc' ? [...all].reverse() : all;
      return { ok: true, status: 200, json: async () => ({ messages: ordered.slice(offset, offset + limit) }) } as any;
    }
    throw new Error(`unexpected fetch ${urlStr}`);
  };
  return createPublicLane({ runGetMethod, now: () => CLOCK, endpoint: 'https://x/api/v3/accountStates', fetch: fetchImpl });
}

async function seedThread(bc: Blockchain, channelWallet: string, commenter: any, n: number) {
  const channelPk = await publicChannelPartitionKey(publicWalletHash(channelWallet), 0);
  const channelEpochTag = publicEpochTag(KIND_CHANNEL, publicEraOf(KIND_CHANNEL, CLOCK));
  const postUid = await publicPostUid(channelPk, channelEpochTag, 0n);
  const threadPk = await publicThreadPartitionKey(postUid, 0);
  const shard = bc.openContract(await PublicShard.fromInit(threadPk, publicEpochTag(KIND_THREAD, publicEraOf(KIND_THREAD, CLOCK))));
  await shard.send(commenter.getSender(), { value: toNano('0.05') }, null);
  const rows: Array<{ header: any; body: any; source: string }> = [];
  for (let i = 0; i < n; i += 1) {
    bc.now = CLOCK + i * 97;
    const header = beginCell().storeUint(i, 32).storeBuffer(Buffer.alloc(44, 20)).endCell();
    const body = beginCell().storeUint(i, 32).storeBuffer(Buffer.alloc(44, 60)).endCell();
    const v = await shard.getGetView();
    const due = v.entry_count === 0n ? v.deploy_min_value : v.min_value;
    await shard.send(commenter.getSender(), { value: due + toNano('0.02') },
      { $$type: 'PublicPublish', kind: BigInt(KIND_THREAD), key_arg: postUid, shard_seq: 0n, header, body } as any);
    rows.push({ header, body, source: commenter.address.toString() });
  }
  return { shard, rows, postUid, channelEpochTag };
}

describe('PCWINDOW — a post keeps its newest comments and loses sight of the older ones', () => {
  it('PCWINDOW-01: under the page cap every comment is readable', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pcwindow-01-sink' });
    const channel = await bc.treasury('pcwindow-01-channel');
    const commenter = await bc.treasury('pcwindow-01-commenter');
    const N = 12;
    const { shard, rows, postUid, channelEpochTag } = await seedThread(bc, channel.address.toString(), commenter, N);

    const lane = laneOverThread(shard, rows, postUid);
    const { posts: comments } = await lane.readThreadComments(channel.address.toString(), channelEpochTag, 0n, { channelShardSeq: 0 });
    expect(comments.length, 'a normal thread reads back whole').toBe(N);
  }, 600_000);

  it('PCWINDOW-02: past the page cap the OLDEST comments become unreachable — measured, not assumed', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pcwindow-02-sink' });
    const channel = await bc.treasury('pcwindow-02-channel');
    const commenter = await bc.treasury('pcwindow-02-commenter');
    const N = 120;
    const { shard, rows, postUid, channelEpochTag } = await seedThread(bc, channel.address.toString(), commenter, N);

    expect((await shard.getGetView()).entry_count, 'the shard really holds them all').toBe(BigInt(N));

    const lane = laneOverThread(shard, rows, postUid);
    const first = await lane.readThreadComments(channel.address.toString(), channelEpochTag, 0n, { channelShardSeq: 0 });

    expect(first.posts.length, `read ${first.posts.length} of ${N}`).toBe(PAGE_CAP);
    const span = (posts: any[]) => posts.map((c) => (Number(c.created_at) - CLOCK) / 97).sort((a, b) => a - b);
    const firstSpan = span(first.posts);
    expect(firstSpan[0], 'the oldest of the first page').toBe(N - PAGE_CAP);
    expect(firstSpan[firstSpan.length - 1], 'the newest comment is always there').toBe(N - 1);

    expect(first.hasMore, 'the reader must know something older is there').toBe(true);
    expect(first.shardsSeen, 'a live thread shard is proof somebody commented').toBe(1);
  }, 600_000);

  it('PCWINDOW-04: past 128 comments the BODIES page back with the rows — every press yields the page before', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pcwindow-04-sink' });
    const channel = await bc.treasury('pcwindow-04-channel');
    const commenter = await bc.treasury('pcwindow-04-commenter');
    const N = 260;
    const { shard, rows, postUid, channelEpochTag } = await seedThread(bc, channel.address.toString(), commenter, N);
    expect((await shard.getGetView()).entry_count).toBe(BigInt(N));

    const lane = laneOverThread(shard, rows, postUid);
    const read = (olderThan: any = null) =>
      lane.readThreadComments(channel.address.toString(), channelEpochTag, 0n, { channelShardSeq: 0, olderThan });
    const span = (posts: any[]) => posts.map((c) => (Number(c.created_at) - CLOCK) / 97).sort((a, b) => a - b);

    const first = await read();
    expect(span(first.posts), 'open: the newest page').toEqual(Array.from({ length: PAGE_CAP }, (_, i) => N - PAGE_CAP + i));
    expect(first.hasMore).toBe(true);
    const cursor1 = Object.values(first.cursors)[0] as any;
    expect(cursor1.oldestLt, 'the cursor remembers where the bodies ended').toBe(String(1_000 + (N - PAGE_CAP)));

    const second = await read(first.cursors);
    expect(span(second.posts), 'press 1: the full page before — bodies included').toEqual(Array.from({ length: PAGE_CAP }, (_, i) => N - 2 * PAGE_CAP + i));
    expect(second.hasMore).toBe(true);

    const third = await read(second.cursors);
    expect(span(third.posts), 'press 2: the remaining oldest comments, not an empty answer').toEqual(Array.from({ length: N - 2 * PAGE_CAP }, (_, i) => i));
    expect(third.hasMore, 'the thread is exhausted').toBe(false);

    const all = [...span(first.posts), ...span(second.posts), ...span(third.posts)];
    expect(new Set(all).size, 'every comment exactly once').toBe(N);
  }, 600_000);

  it('PCWINDOW-03: reading with the returned cursors yields the page BEFORE — not the same rows again', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pcwindow-03-sink' });
    const channel = await bc.treasury('pcwindow-03-channel');
    const commenter = await bc.treasury('pcwindow-03-commenter');
    const N = 120;
    const { shard, rows, postUid, channelEpochTag } = await seedThread(bc, channel.address.toString(), commenter, N);

    const lane = laneOverThread(shard, rows, postUid);
    const read = (olderThan: any = null) =>
      lane.readThreadComments(channel.address.toString(), channelEpochTag, 0n, { channelShardSeq: 0, olderThan });
    const span = (posts: any[]) => posts.map((c) => (Number(c.created_at) - CLOCK) / 97).sort((a, b) => a - b);

    const first = await read();
    const older = await read(first.cursors);

    const olderSpan = span(older.posts);
    expect(olderSpan[0], 'starts at the very first comment').toBe(0);
    expect(olderSpan[olderSpan.length - 1], 'ends where the first page began').toBe(N - PAGE_CAP - 1);
    expect(olderSpan.length).toBe(N - PAGE_CAP);
    expect(olderSpan.filter((i) => span(first.posts).includes(i)), 'no overlap between the pages').toEqual([]);

    expect(older.hasMore, 'nothing older remains').toBe(false);
    const again = await read(older.cursors);
    expect(again.posts.length, 'an exhausted shard is not read again').toBe(0);
    expect(again.hasMore).toBe(false);
  }, 600_000);
});
