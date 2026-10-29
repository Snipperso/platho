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

function laneOverShards(bc: Blockchain, entries: Map<string, { shard: any; messages: Array<{ body: any; source: string; createdAt?: number }> }>) {
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
      const p = await entry.shard.getGetPage(BigInt(call.stack[0].value), BigInt(call.stack[1].value));
      return { stack: [num(p.from_id), num(p.count), num(p.entry_count), ['cell', p.rows]] };
    }
    throw new Error(`unexpected method ${call.method}`);
  };
  const fetchImpl = async (urlStr: string) => {
    const url = new URL(urlStr);
    if (url.pathname.endsWith('/accountStates')) {
      const accounts = url.searchParams.getAll('address')
        .filter((a) => entries.has(addrKey(a)))
        .map((a) => ({ address: addrKey(a), status: 'active', balance: '1000000', data_hash: 'h', last_transaction_lt: '1' }));
      return { ok: true, status: 200, json: async () => ({ accounts }) } as any;
    }
    if (url.pathname.endsWith('/messages')) {
      const entry = entries.get(addrKey(url.searchParams.get('destination') ?? ''));
      const limit = Number(url.searchParams.get('limit') ?? '128');
      const endLt = url.searchParams.get('end_lt');
      const startUtime = url.searchParams.get('start_utime');
      const endUtime = url.searchParams.get('end_utime');
      const all = (entry?.messages ?? [])
        .map((m, i) => ({
          source: m.source,
          created_lt: String(1_000 + i),
          created_at: m.createdAt ?? null,
          message_content: { body: bocBase64(m.body) },
        }))
        .filter((m) => endLt === null || BigInt(m.created_lt) <= BigInt(endLt))
        .filter((m) => startUtime === null || m.created_at === null || m.created_at >= Number(startUtime))
        .filter((m) => endUtime === null || m.created_at === null || m.created_at <= Number(endUtime));
      const messages = url.searchParams.get('sort') === 'desc' ? [...all].reverse().slice(0, limit) : all.slice(0, limit);
      return { ok: true, status: 200, json: async () => ({ messages }) } as any;
    }
    throw new Error(`unexpected fetch ${urlStr}`);
  };
  return createPublicLane({ runGetMethod, now: () => CLOCK, endpoint: 'https://x/api/v3/accountStates', fetch: fetchImpl });
}

describe('public read window (sandbox, real PublicShard)', () => {
  it('PL-WINDOW-01: a channel past the page cap still reads back its NEWEST posts', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pl-window-sink' });
    const channel = await bc.treasury('pl-window-channel');

    const ownerHash = publicWalletHash(channel.address.toString());
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));

    const TOTAL = 260;
    const messages: Array<{ body: any; source: string }> = [];
    let dest: Address | null = null;
    for (let i = 0; i < TOTAL; i += 1) {
      const payload = await createPublicPostPayloadV2({
        type: 'post', text: `post #${i}`, streamId: i.toString(16).padStart(4, '0').repeat(8), createdAtSec: CLOCK + i,
      });
      const built = await buildPublicPublishWalletMessage({
        kind: 0, keyArg: 0n, header: payload.headerCell, body: payload.bodyCell,
        value: publicPublishValueForKind(0), partitionKey, epochTag, nowUnix: CLOCK,
      });
      dest = await sendBuilt(channel, built);
      messages.push({ body: built.body, source: channel.address.toString() });
    }

    const shard = bc.openContract(PublicShard.fromAddress(dest!));
    expect((await shard.getGetView()).entry_count, 'the shard really holds them all').toBe(BigInt(TOTAL));

    const lane = laneOverShards(bc, new Map([[addrKey(dest!.toString()), { shard, messages }]]));
    const posts = await lane.readChannelPosts(channel.address.toString());
    const texts = posts.map((p: any) => readPublicPostPayloadV2({ header: p.header, body: p.body }).text);

    expect(texts, `read ${posts.length}/${TOTAL} entries`).toContain(`post #${TOTAL - 1}`);
    expect(texts).toContain(`post #${TOTAL - 2}`);
  }, 600_000);

  it('PL-WINDOW-03: a channel deeper than one page is READABLE TO ITS FIRST POST, a page at a time', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pl-depth-sink' });
    const channel = await bc.treasury('pl-depth-channel');

    const ownerHash = publicWalletHash(channel.address.toString());
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));

    const TOTAL = 260;
    const messages: Array<{ body: any; source: string; createdAt: number }> = [];
    let dest: Address | null = null;
    for (let i = 0; i < TOTAL; i += 1) {
      bc.now = CLOCK + i;
      const payload = await createPublicPostPayloadV2({
        type: 'post', text: `post #${i}`, streamId: i.toString(16).padStart(4, '0').repeat(8), createdAtSec: CLOCK + i,
      });
      const built = await buildPublicPublishWalletMessage({
        kind: 0, keyArg: 0n, header: payload.headerCell, body: payload.bodyCell,
        value: publicPublishValueForKind(0), partitionKey, epochTag, nowUnix: CLOCK,
      });
      dest = await sendBuilt(channel, built);
      messages.push({ body: built.body, source: channel.address.toString(), createdAt: CLOCK + i });
    }

    const shard = bc.openContract(PublicShard.fromAddress(dest!));
    const lane = laneOverShards(bc, new Map([[addrKey(dest!.toString()), { shard, messages }]]));
    const textsOf = (posts: any[]) => posts.map((p: any) => readPublicPostPayloadV2({ header: p.header, body: p.body }).text);

    const shallow = await lane.readChannelPosts(channel.address.toString());
    expect(shallow.length, 'the default read takes the newest window only').toBe(96);
    expect(textsOf(shallow)).toContain(`post #${TOTAL - 1}`);
    expect(textsOf(shallow)).not.toContain('post #0');

    const seen = new Map<string, any>();
    const collect = (posts: any[]) => { for (const post of posts) seen.set(String(post.entry_id), post); };
    collect(shallow);
    collect(await lane.readChannelPosts(channel.address.toString(), { backfillPages: 1 }));
    expect(seen.size, 'one page of backfill is one page deeper').toBe(192);
    collect(await lane.readChannelPosts(channel.address.toString(), { backfillPages: 1 }));
    expect(seen.size, 'the second page reaches entry 0').toBe(TOTAL);

    const whole = [...seen.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    const texts = textsOf(whole);
    expect(texts).toContain('post #0');
    expect(texts).toContain('post #1');
    expect(new Set(texts).size, 'no entry read twice').toBe(TOTAL);
    expect(texts[0]).toBe(`post #${TOTAL - 1}`);
    expect(texts[texts.length - 1]).toBe('post #0');

    const again = await lane.readChannelPosts(channel.address.toString(), { backfillPages: 4 });
    expect(again.length, 'a walked-out shard costs its newest window, not its history').toBe(96);
  }, 900_000);

  it('PL-WINDOW-02: a multipart post straddling the window boundary comes back WHOLE', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pl-straddle-sink' });
    const channel = await bc.treasury('pl-straddle-channel');

    const ownerHash = publicWalletHash(channel.address.toString());
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));

    const messages: Array<{ body: any; source: string }> = [];
    let dest: Address | null = null;
    const publish = async (payload: any) => {
      const built = await buildPublicPublishWalletMessage({
        kind: 0, keyArg: 0n, header: payload.headerCell, body: payload.bodyCell,
        value: publicPublishValueForKind(0), partitionKey, epochTag, nowUnix: CLOCK,
      });
      dest = await sendBuilt(channel, built);
      messages.push({ body: built.body, source: channel.address.toString() });
    };

    for (let i = 0; i < 4; i += 1) {
      await publish(await createPublicPostPayloadV2({ type: 'post', text: `filler-a #${i}`, streamId: 'a1'.repeat(16), createdAtSec: CLOCK + i }));
    }
    const STRADDLE_STREAM = `0x${'be'.repeat(16)}`;
    for (let part = 0; part < 3; part += 1) {
      await publish(await createPublicPostPayloadV2({
        type: 'post', text: `straddle part ${part}`, streamId: 'be'.repeat(16),
        partIndex: part, partCount: 3, createdAtSec: CLOCK + 10,
      }));
    }
    for (let i = 0; i < 95; i += 1) {
      await publish(await createPublicPostPayloadV2({ type: 'post', text: `filler-b #${i}`, streamId: 'b2'.repeat(16), createdAtSec: CLOCK + 20 + i }));
    }

    const shard = bc.openContract(PublicShard.fromAddress(dest!));
    expect((await shard.getGetView()).entry_count, 'shard holds every entry').toBe(102n);

    const lane = laneOverShards(bc, new Map([[addrKey(dest!.toString()), { shard, messages }]]));
    const posts = await lane.readChannelPosts(channel.address.toString());
    const straddleParts = posts.filter((p: any) => readPublicPartHeaderInfo(p.header)?.streamId?.toLowerCase() === STRADDLE_STREAM);

    expect(straddleParts.length, 'all three parts of the boundary post are in the window').toBe(3);
    const indices = straddleParts.map((p: any) => Number(readPublicPartHeaderInfo(p.header).partIndex)).sort();
    expect(indices).toEqual([0, 1, 2]);
  }, 600_000);

  it('PL-WINDOW-04: a reader that comes back gets the burst it missed AND the history below it', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pl-return-sink' });
    const channel = await bc.treasury('pl-return-channel');

    const ownerHash = publicWalletHash(channel.address.toString());
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));

    const TOTAL = 270;
    const messages: Array<{ body: any; source: string; createdAt: number }> = [];
    let dest: Address | null = null;
    for (let i = 0; i < TOTAL; i += 1) {
      bc.now = CLOCK + i;
      const payload = await createPublicPostPayloadV2({
        type: 'post', text: `post #${i}`, streamId: i.toString(16).padStart(4, '0').repeat(8), createdAtSec: CLOCK + i,
      });
      const built = await buildPublicPublishWalletMessage({
        kind: 0, keyArg: 0n, header: payload.headerCell, body: payload.bodyCell,
        value: publicPublishValueForKind(0), partitionKey, epochTag, nowUnix: CLOCK,
      });
      dest = await sendBuilt(channel, built);
      messages.push({ body: built.body, source: channel.address.toString(), createdAt: CLOCK + i });
    }
    const shard = bc.openContract(PublicShard.fromAddress(dest!));
    const shards = new Map([[addrKey(dest!.toString()), { shard, messages }]]);

    const held = { min: 24, max: 119 };
    const seen = new Set<number>();
    const collect = (posts: any[]) => { for (const post of posts) seen.add(Number(post.entry_id)); };
    collect(await laneOverShards(bc, shards).readChannelPosts(channel.address.toString(), {
      backfillPages: 1, knownRange: () => held,
    }));
    expect([...seen].sort((a, b) => a - b)[0], 'the burst between the caller and the window is read').toBe(120);
    expect(seen.has(173)).toBe(true);
    expect(seen.has(269)).toBe(true);
    expect(seen.size, 'one page of budget buys the 54-entry burst and the 96-row window').toBe(150);

    const merged = { min: 24, max: 269 };
    collect(await laneOverShards(bc, shards).readChannelPosts(channel.address.toString(), {
      backfillPages: 1, knownRange: () => merged,
    }));
    expect(seen.has(0), 'the first post of the channel is reachable after a relaunch').toBe(true);
    expect(seen.has(23)).toBe(true);
  }, 900_000);

  it('PL-WINDOW-05: a background read spends its burst budget on the rows above what the caller holds, and reports what it could not reach', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pl-gap-sink' });
    const channel = await bc.treasury('pl-gap-channel');
    const ownerHash = publicWalletHash(channel.address.toString());
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));
    const TOTAL = 270;
    const messages: Array<{ body: any; source: string; createdAt: number }> = [];
    let dest: Address | null = null;
    for (let i = 0; i < TOTAL; i += 1) {
      bc.now = CLOCK + i;
      const payload = await createPublicPostPayloadV2({
        type: 'post', text: `post #${i}`, streamId: i.toString(16).padStart(4, '0').repeat(8), createdAtSec: CLOCK + i,
      });
      const built = await buildPublicPublishWalletMessage({
        kind: 0, keyArg: 0n, header: payload.headerCell, body: payload.bodyCell,
        value: publicPublishValueForKind(0), partitionKey, epochTag, nowUnix: CLOCK,
      });
      dest = await sendBuilt(channel, built);
      messages.push({ body: built.body, source: channel.address.toString(), createdAt: CLOCK + i });
    }
    const shard = bc.openContract(PublicShard.fromAddress(dest!));
    const shards = new Map([[addrKey(dest!.toString()), { shard, messages }]]);
    const entries = (posts: any[]) => [...new Set(posts.map((post) => Number(post.entry_id)))].sort((a, b) => a - b);
    const noBudget = await laneOverShards(bc, shards).readChannelPosts(channel.address.toString(), { knownRange: () => ({ min: 24, max: 119 }) });
    expect(entries(noBudget)[0], 'nothing to spend: only the window').toBe(174);
    expect((noBudget as any).gaps.map((gap: any) => [gap.floor, gap.top]), 'and the gap is SAID, not left to be hidden by a merge').toEqual([[120, 174]]);
    const onePage = await laneOverShards(bc, shards).readChannelPosts(channel.address.toString(), { burstPages: 1, knownRange: () => ({ min: 24, max: 119 }) });
    expect(entries(onePage)[0], 'one burst page buys the 54 rows').toBe(120);
    expect((onePage as any).gaps, 'nothing left unread above the caller').toEqual([]);
    expect(entries(onePage).length, 'and no history below it was read on the burst budget').toBe(150);
    const long = await laneOverShards(bc, shards).readChannelPosts(channel.address.toString(), { burstPages: 1, knownRange: () => ({ min: 24, max: 50 }) });
    expect(entries(long)[0]).toBe(78);
    expect((long as any).gaps.map((gap: any) => [gap.floor, gap.top])).toEqual([[51, 78]]);
  }, 900_000);
});
