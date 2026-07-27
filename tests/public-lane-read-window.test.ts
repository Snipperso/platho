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
// PUBLIC READ WINDOW — how much of a shard the shipping read path can actually see.
//
// A PublicShard accepts entries up to PS_SAFE_CAP (4096) but its get_page getter is capped at PS_PAGE_CAP (96)
// rows per call, and /messages is served newest-first with a limit. Those two windows anchor at OPPOSITE ends,
// so past the page cap they drift apart and their intersection — which is what the reader returns — shrinks.
// This file MEASURES that boundary against the real contract instead of reasoning about it.
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

/** Read lane over real sandbox shards. The /messages stub honours toncenter's limit + newest-first sort, so the
 *  measured window is the SHIPPING one (get_page from the head, messages from the tail), not a friendlier stub. */
function laneOverShards(bc: Blockchain, entries: Map<string, { shard: any; messages: Array<{ body: any; source: string }> }>) {
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
      const all = (entry?.messages ?? []).map((m) => ({ source: m.source, message_content: { body: bocBase64(m.body) } }));
      // toncenter serves newest-first and truncates to `limit` — reproduce both, or the harness would hide the
      // very window this file exists to measure.
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

    const TOTAL = 260;   // > PS_PAGE_CAP (96) AND > the /messages limit (128)
    const messages: Array<{ body: any; source: string }> = [];
    let dest: Address | null = null;
    for (let i = 0; i < TOTAL; i += 1) {
      const payload = await createPublicPostPayloadV2({
        type: 'post', text: `post #${i}`, streamId: i.toString(16).padStart(4, '0').repeat(8), createdAtSec: CLOCK + i,
      });
      const built = await buildPublicPublishWalletMessage({
        kind: 0, keyArg: 0n, header: payload.headerCell, body: payload.bodyCell,
        value: publicPublishValueForKind(0), partitionKey, epochTag,
      });
      dest = await sendBuilt(channel, built);
      messages.push({ body: built.body, source: channel.address.toString() });
    }

    const shard = bc.openContract(PublicShard.fromAddress(dest!));
    expect((await shard.getGetView()).entry_count, 'the shard really holds them all').toBe(BigInt(TOTAL));

    const lane = laneOverShards(bc, new Map([[addrKey(dest!.toString()), { shard, messages }]]));
    const posts = await lane.readChannelPosts(channel.address.toString());
    const texts = posts.map((p: any) => readPublicPostPayloadV2({ header: p.header, body: p.body }).text);

    // THE INVARIANT THAT MATTERS: the freshest post a channel published must be readable. A feed that silently
    // freezes at the page cap is indistinguishable, to its author, from a feed nobody reads.
    expect(texts, `read ${posts.length}/${TOTAL} entries`).toContain(`post #${TOTAL - 1}`);
    expect(texts).toContain(`post #${TOTAL - 2}`);
  }, 600_000);

  it('PL-WINDOW-02: a multipart post straddling the window boundary comes back WHOLE', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pl-straddle-sink' });
    const channel = await bc.treasury('pl-straddle-channel');

    const ownerHash = publicWalletHash(channel.address.toString());
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));

    // Layout: 4 filler posts, then a 3-part post, then 95 fillers. entry_count = 102, so the 96-row tail window
    // starts at entry 6 — right THROUGH the middle of the multipart post (its parts are entries 4, 5, 6).
    // Without the straddle extension the assembler sees one orphan part of three and drops the post silently.
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
});
