import { describe, expect, it } from 'vitest';
import { Address, Cell, beginCell } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { deployFeeSink } from './helpers/fee-sink-fixture';
import { createPublicLane } from '../web/public-lane.mjs';
import { buildPublicPublishWalletMessage } from '../web/public-lane-send.mjs';
import { createPublicPostPayloadV2, readPublicPostPayloadV2, readPublicPartHeaderInfo, serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { publicPublishValueForKind } from '../web/publish-price.mjs';
import { publicChannelPartitionKey, publicWalletHash, publicEpochTag, publicEraOf, addrKey } from '../web/shard-discovery.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// FOLLOWING THE POINTER A REPOST CARRIES.
//
// Owner, 2026-08-07: "а почему репост публичного поста отправляется не полностью и без картинок?"
//
// It is a REFERENCE by design — entry id, body hash, author wallet, a 4KB text snapshot and a "has image" flag —
// and copying the picture would republish it on chain at full price. What was missing is the other half: nothing
// ever followed the reference. The only resolver looked in the reader's LOCAL feed cache, and the recipient of a
// repost is by definition someone who probably does not follow that channel, so the image never appeared and the
// text stayed a fragment.
//
// readPostAt is the follow. Measured here against real PublicShard accounts in a sandbox, not stubbed: the
// coordinates in the share block must land on the exact shard row, and a post with an image (multipart) must come
// back with EVERY part, from a channel far too large for its newest-window read to reach.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const num = (v: bigint) => ({ type: 'num', value: '0x' + BigInt(v).toString(16) });
const toCoreCell = (c: any) => Cell.fromBase64(Buffer.from(serializeBoc(c)).toString('base64'));
const bocBase64 = (c: any) => Buffer.from(serializeBoc(c)).toString('base64');

async function sendBuilt(payer: any, built: any) {
  const dest = Address.parseRaw(built.to);
  const initCore = toCoreCell(built.init);
  const res = await payer.send({
    to: dest, value: built.value, body: toCoreCell(built.body),
    init: { code: initCore.refs[0], data: initCore.refs[1] }, bounce: true,
  } as any);
  const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === dest.toString());
  expect(tx?.description?.computePhase?.exitCode ?? 0, 'publish compute exit').toBe(0);
  return dest;
}

/** Same shipping-shaped harness as public-lane-read-window: /messages is newest-first and truncated to `limit`. */
function laneOverShards(entries: Map<string, { shard: any; messages: Array<{ body: any; source: string }> }>, counters = { getPage: 0, states: 0, messages: 0 }) {
  const runGetMethod = async (call: any) => {
    const entry = entries.get(addrKey(call.address));
    if (!entry) throw new Error(`no shard for ${call.address}`);
    if (call.method === 'get_view') {
      const v = await entry.shard.getGetView();
      return { stack: [
        num(v.partition_key), num(v.epoch_tag), num(v.kind), num(v.era_index), num(v.entry_count),
        num(v.safe_cap), num(v.era_seconds), num(v.retention), num(v.min_value), num(v.deploy_min_value),
        num(v.protocol_fee), num(v.retire_at), ['cell', beginCell().storeAddress(v.fee_sink).endCell()],
      ] };
    }
    if (call.method === 'get_page') {
      counters.getPage += 1;
      const p = await entry.shard.getGetPage(BigInt(call.stack[0].value), BigInt(call.stack[1].value));
      return { stack: [num(p.from_id), num(p.count), num(p.entry_count), ['cell', p.rows]] };
    }
    throw new Error(`unexpected method ${call.method}`);
  };
  const fetchImpl = async (urlStr: string) => {
    const url = new URL(urlStr);
    if (url.pathname.endsWith('/accountStates')) {
      counters.states += 1;
      const accounts = url.searchParams.getAll('address')
        .filter((a) => entries.has(addrKey(a)))
        .map((a) => ({ address: addrKey(a), status: 'active', balance: '1000000', data_hash: 'h', last_transaction_lt: '1' }));
      return { ok: true, status: 200, json: async () => ({ accounts }) } as any;
    }
    if (url.pathname.endsWith('/messages')) {
      counters.messages += 1;
      const entry = entries.get(addrKey(url.searchParams.get('destination') ?? ''));
      const limit = Number(url.searchParams.get('limit') ?? '128');
      const all = (entry?.messages ?? []).map((m) => ({ source: m.source, message_content: { body: bocBase64(m.body) } }));
      const messages = url.searchParams.get('sort') === 'desc' ? [...all].reverse().slice(0, limit) : all.slice(0, limit);
      return { ok: true, status: 200, json: async () => ({ messages }) } as any;
    }
    throw new Error(`unexpected fetch ${urlStr}`);
  };
  return createPublicLane({ runGetMethod, now: () => CLOCK, endpoint: 'https://x/api/v3/accountStates', fetch: fetchImpl });
}

describe('PL-POSTAT — one shared post, read by the coordinates the repost carries', () => {
  it('PL-POSTAT-01: a multipart post comes back WHOLE from a channel whose window cannot reach it', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pl-postat-sink' });
    const channel = await bc.treasury('pl-postat-channel');

    const ownerHash = publicWalletHash(channel.address.toString());
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));

    const messages: Array<{ body: any; source: string }> = [];
    let dest: Address | null = null;
    const publish = async (payload: any) => {
      const built = await buildPublicPublishWalletMessage({
        kind: 0, keyArg: 0n, header: payload.headerCell, body: payload.bodyCell,
        value: publicPublishValueForKind(0), partitionKey, epochTag,
      });
      dest = await sendBuilt(channel, built);
      messages.push({ body: built.body, source: channel.address.toString() });
    };

    // The SHARED post sits at entries 2..4 — a 3-part post, the shape any post with an image has. Then a hundred
    // newer posts bury it: the channel read anchors at the tail (96 rows) and cannot see entry 2 at any price.
    for (let i = 0; i < 2; i += 1) {
      await publish(await createPublicPostPayloadV2({ type: 'post', text: `older #${i}`, streamId: '11'.repeat(16), createdAtSec: CLOCK + i }));
    }
    const SHARED_STREAM = `0x${'5e'.repeat(16)}`;
    const SHARED_ENTRY = 2;
    for (let part = 0; part < 3; part += 1) {
      await publish(await createPublicPostPayloadV2({
        type: 'post', text: `shared part ${part}`, streamId: '5e'.repeat(16),
        partIndex: part, partCount: 3, createdAtSec: CLOCK + 5,
      }));
    }
    for (let i = 0; i < 100; i += 1) {
      await publish(await createPublicPostPayloadV2({ type: 'post', text: `newer #${i}`, streamId: '22'.repeat(16), createdAtSec: CLOCK + 20 + i }));
    }

    const shard = bc.openContract(PublicShard.fromAddress(dest!));
    expect((await shard.getGetView()).entry_count, 'shard holds every entry').toBe(105n);
    const shards = new Map([[addrKey(dest!.toString()), { shard, messages }]]);

    // FIRST, THE FAILURE THIS FIXES: the whole-channel read genuinely cannot return it.
    const byChannel = await laneOverShards(shards).readChannelPosts(channel.address.toString());
    const foundByChannel = byChannel.filter((p: any) => readPublicPartHeaderInfo(p.header)?.streamId?.toLowerCase() === SHARED_STREAM);
    expect(foundByChannel.length, 'the buried post is out of the channel window — that is the premise').toBe(0);

    // NOW THE POINTER. Same channel, same shard, addressed by (epochTag, shardSeq, entryId).
    const lane = laneOverShards(shards);
    const posts = await lane.readPostAt(channel.address.toString(), epochTag, 0, SHARED_ENTRY);
    const parts = posts.filter((p: any) => readPublicPartHeaderInfo(p.header)?.streamId?.toLowerCase() === SHARED_STREAM);
    expect(parts.length, 'every part of the shared post').toBe(3);
    expect(parts.map((p: any) => Number(readPublicPartHeaderInfo(p.header).partIndex)).sort()).toEqual([0, 1, 2]);
    const texts = parts
      .sort((a: any, b: any) => Number(readPublicPartHeaderInfo(a.header).partIndex) - Number(readPublicPartHeaderInfo(b.header).partIndex))
      .map((p: any) => readPublicPostPayloadV2({ header: p.header, body: p.body }).text);
    expect(texts).toEqual(['shared part 0', 'shared part 1', 'shared part 2']);

    // And every post it returns carries the coordinates the feed identity is built from, so the caller can key the
    // result the same way a synced post is keyed (epochTag.shardSeq.entryId) instead of inventing a second scheme.
    expect(String(parts[0].channelEpochTag)).toBe(String(epochTag));
    expect(parts[0].channelShardSeq).toBe(0);
  }, 600_000);

  it('PL-POSTAT-02: it costs ONE shard, not the channel — the point of an addressed read', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pl-postat-cost-sink' });
    const channel = await bc.treasury('pl-postat-cost-channel');

    const ownerHash = publicWalletHash(channel.address.toString());
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));

    const messages: Array<{ body: any; source: string }> = [];
    let dest: Address | null = null;
    for (let i = 0; i < 3; i += 1) {
      const payload = await createPublicPostPayloadV2({ type: 'post', text: `p#${i}`, streamId: `0${i}`.repeat(16), createdAtSec: CLOCK + i });
      const built = await buildPublicPublishWalletMessage({
        kind: 0, keyArg: 0n, header: payload.headerCell, body: payload.bodyCell,
        value: publicPublishValueForKind(0), partitionKey, epochTag,
      });
      dest = await sendBuilt(channel, built);
      messages.push({ body: built.body, source: channel.address.toString() });
    }
    const shard = bc.openContract(PublicShard.fromAddress(dest!));
    const shards = new Map([[addrKey(dest!.toString()), { shard, messages }]]);

    const addressed = { getPage: 0, states: 0, messages: 0 };
    const one = await laneOverShards(shards, addressed).readPostAt(channel.address.toString(), epochTag, 0, 1);
    expect(one.length).toBeGreaterThan(0);

    const whole = { getPage: 0, states: 0, messages: 0 };
    await laneOverShards(shards, whole).readChannelPosts(channel.address.toString());

    // The channel walk probes 14 eras x 4 overflow shards; the addressed read asks about exactly one account. Both
    // batch their accountStates into a single request, so the honest comparison is the ADDRESS COUNT, which the
    // counters cannot see — what they do show is that the addressed read never grows past one shard's reads.
    expect(addressed.states, 'one liveness batch').toBe(1);
    expect(addressed.messages, 'one history read').toBe(1);
    expect(addressed.getPage, 'one page — an explicit fromId never extends backwards').toBe(1);
    expect(whole.getPage, 'the channel walk pays the entry_count probe on top').toBeGreaterThan(addressed.getPage);
  }, 600_000);

  it('PL-POSTAT-03: an untouched shard answers empty instead of throwing exit -13', async () => {
    // A public shard address is DERIVABLE by anyone, so a share block can name an account that was never deployed
    // (a fabricated reference, or a post whose era rolled past retention). get_page on an uninit account throws
    // -13; the card must fall back to the sender's snapshot, not to an error.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const stranger = await bc.treasury('pl-postat-absent');
    const lane = laneOverShards(new Map());
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));
    await expect(lane.readPostAt(stranger.address.toString(), epochTag, 0, 0)).resolves.toEqual([]);
  }, 600_000);
});
