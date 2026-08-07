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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THREAD SNAPSHOT CACHE — reopening a post must not re-read comments that cannot have changed.
//
// The CapsuleHub path had incremental reads and the shard loader lost them: every open of a post re-read the
// whole thread, two RPC calls per era shard, for comments nobody had touched.
//
// The cache is keyed on the shard's CHANGE MARKER (last_transaction_lt), not on entry_count as first proposed:
// the marker already arrives in the batched accountStates call the read makes anyway, so proving a thread is
// unchanged costs the one request it takes to prove it — while entry_count would cost a get_page probe per shard.
//
// What these tests must hold down is the pair of failure modes such a cache has: reading MORE than necessary
// (the cache never hits, and the fix is decorative) and reading LESS than necessary (a hit is served after the
// thread actually changed, so a new comment never appears).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const KIND_CHANNEL = 0;
const KIND_THREAD = 1;
const cell = (f: number) => beginCell().storeBuffer(Buffer.alloc(48, f)).endCell();
const num = (v: bigint) => ({ type: 'num', value: '0x' + BigInt(v).toString(16) });
const bocBase64 = (c: any) => c.toBoc().toString('base64');
const publishBody = (kind: number, keyArg: bigint, header: any, body: any) =>
  beginCell().storeUint(0x50535031, 32).storeUint(kind, 8).storeUint(keyArg, 256).storeUint(0, 32)
    .storeRef(header).storeRef(body).endCell();

/** A lane over one live thread shard, counting every read and letting the change marker be moved by hand. */
function countingLane(shard: any, rows: Array<{ header: any; body: any; source: string }>, keyArg: bigint, state: { lt: string }) {
  const counts = { accountStates: 0, getPage: 0, messages: 0 };
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
      counts.getPage += 1;
      const p = await shard.getGetPage(BigInt(call.stack[0].value), BigInt(call.stack[1].value));
      return { stack: [num(p.from_id), num(p.count), num(p.entry_count), ['cell', p.rows]] };
    }
    throw new Error(`unexpected method ${call.method}`);
  };
  const fetchImpl = async (urlStr: string) => {
    const url = new URL(urlStr);
    if (url.pathname.endsWith('/accountStates')) {
      counts.accountStates += 1;
      const accounts = url.searchParams.getAll('address')
        .filter((a) => addrKey(a) === addrKey(shard.address.toString()))
        .map((a) => ({ address: addrKey(a), status: 'active', balance: '1000000', data_hash: 'h', last_transaction_lt: state.lt }));
      return { ok: true, status: 200, json: async () => ({ accounts }) } as any;
    }
    if (url.pathname.endsWith('/messages')) {
      counts.messages += 1;
      const messages = rows.map((r) => ({
        opcode: '0x50535031', source: r.source,
        message_content: { body: bocBase64(publishBody(KIND_THREAD, keyArg, r.header, r.body)) },
      }));
      return { ok: true, status: 200, json: async () => ({ messages }) } as any;
    }
    throw new Error(`unexpected fetch ${urlStr}`);
  };
  const lane = createPublicLane({ runGetMethod, now: () => CLOCK, endpoint: 'https://x/api/v3/accountStates', fetch: fetchImpl });
  return { lane, counts };
}

/** Deploy the thread shard for (channel wallet, entry 0) and publish `n` comments into it. */
async function seedThread(bc: Blockchain, channelWallet: string, commenter: any, n: number) {
  const channelPk = await publicChannelPartitionKey(publicWalletHash(channelWallet), 0);
  const channelEpochTag = publicEpochTag(KIND_CHANNEL, publicEraOf(KIND_CHANNEL, CLOCK));
  const postUid = await publicPostUid(channelPk, channelEpochTag, 0n);
  const threadPk = await publicThreadPartitionKey(postUid, 0);
  const shard = bc.openContract(await PublicShard.fromInit(threadPk, publicEpochTag(KIND_THREAD, publicEraOf(KIND_THREAD, CLOCK))));
  await shard.send(commenter.getSender(), { value: toNano('0.03') }, null);
  const rows: Array<{ header: any; body: any; source: string }> = [];
  for (let i = 0; i < n; i += 1) {
    bc.now = CLOCK + i * 97;
    const header = cell(20 + i);
    const body = cell(60 + i);
    const v = await shard.getGetView();
    const due = v.entry_count === 0n ? v.deploy_min_value : v.min_value;
    await shard.send(commenter.getSender(), { value: due + toNano('0.02') },
      { $$type: 'PublicPublish', kind: BigInt(KIND_THREAD), key_arg: postUid, shard_seq: 0n, header, body } as any);
    rows.push({ header, body, source: commenter.address.toString() });
  }
  return { shard, rows, postUid, channelEpochTag };
}

describe('PUBLIC-LANE — the thread snapshot cache', () => {
  it('PLTC-01: reopening an unchanged thread reads NO bodies — the whole point of the cache', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pltc-01-sink' });
    const channel = await bc.treasury('pltc-01-channel');
    const commenter = await bc.treasury('pltc-01-commenter');
    const { shard, rows, channelEpochTag, postUid } = await seedThread(bc, channel.address.toString(), commenter, 2);

    const marker = { lt: '100' };
    const { lane, counts } = countingLane(shard, rows, postUid, marker);
    const read = async () => (await lane.readThreadComments(channel.address.toString(), channelEpochTag, 0n, { channelShardSeq: 0 })).posts;

    const first = await read();
    expect(first.length, 'both comments come back on the first open').toBe(2);
    const afterFirst = { ...counts };
    expect(afterFirst.getPage, 'the first open really did read the shard').toBeGreaterThan(0);
    expect(afterFirst.messages, 'and really did fetch the bodies').toBeGreaterThan(0);

    const second = await read();
    expect(second.length, 'the same comments come back').toBe(2);
    expect(counts.getPage, 'NO get_page on an unchanged thread').toBe(afterFirst.getPage);
    expect(counts.messages, 'NO body fetch on an unchanged thread').toBe(afterFirst.messages);
    expect(counts.accountStates, 'only the one call that PROVED it unchanged').toBe(afterFirst.accountStates + 1);
  }, 120_000);

  it('PLTC-02: a thread that HAS changed is re-read, and the new comment appears', async () => {
    // The dangerous half. A cache that answers from a snapshot after the shard moved would hide every comment
    // written since — the feed would look settled and quietly stop updating.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pltc-02-sink' });
    const channel = await bc.treasury('pltc-02-channel');
    const commenter = await bc.treasury('pltc-02-commenter');
    const { shard, rows, channelEpochTag, postUid } = await seedThread(bc, channel.address.toString(), commenter, 1);

    const marker = { lt: '100' };
    const { lane, counts } = countingLane(shard, rows, postUid, marker);
    const read = async () => (await lane.readThreadComments(channel.address.toString(), channelEpochTag, 0n, { channelShardSeq: 0 })).posts;

    expect((await read()).length).toBe(1);
    const afterFirst = { ...counts };

    // A new comment lands: the shard stores it AND its last_transaction_lt moves, which is exactly the signal.
    bc.now = CLOCK + 500;
    const header = cell(77);
    const body = cell(88);
    const v = await shard.getGetView();
    await shard.send(commenter.getSender(), { value: v.min_value + toNano('0.02') },
      { $$type: 'PublicPublish', kind: BigInt(KIND_THREAD), key_arg: postUid, shard_seq: 0n, header, body } as any);
    rows.push({ header, body, source: commenter.address.toString() });
    marker.lt = '200';

    const after = await read();
    expect(after.length, 'the new comment is visible — the snapshot did not hide it').toBe(2);
    expect(counts.getPage, 'and the shard really was re-read').toBeGreaterThan(afterFirst.getPage);
  }, 120_000);

  it('PLTC-03: the cache lives on the lane, so a caller that rebuilds the lane gets nothing from it', async () => {
    // This is the trap that would have made the whole fix a silent no-op: app.js used to build a fresh lane on
    // every call, so a cache inside the lane could never hit. The property is pinned here from the lane's side,
    // and on app.js's side by the memoisation guard in tests/pwa-runtime-config.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pltc-03-sink' });
    const channel = await bc.treasury('pltc-03-channel');
    const commenter = await bc.treasury('pltc-03-commenter');
    const { shard, rows, channelEpochTag, postUid } = await seedThread(bc, channel.address.toString(), commenter, 1);

    const marker = { lt: '100' };
    const a = countingLane(shard, rows, postUid, marker);
    await a.lane.readThreadComments(channel.address.toString(), channelEpochTag, 0n, { channelShardSeq: 0 });
    const b = countingLane(shard, rows, postUid, marker);
    await b.lane.readThreadComments(channel.address.toString(), channelEpochTag, 0n, { channelShardSeq: 0 });

    expect(b.counts.getPage, 'a second lane starts cold — nothing is shared behind the lane\'s back').toBeGreaterThan(0);
  }, 120_000);
});
