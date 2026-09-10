import { describe, expect, it } from 'vitest';
import { Address, Cell, beginCell } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { deployFeeSink } from './helpers/fee-sink-fixture';
import { createPublicLane } from '../web/public-lane.mjs';
import { buildPublicPublishWalletMessage } from '../web/public-lane-send.mjs';
import { createPublicPostPayloadV2, readPublicPostPayloadV2, serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { publicPublishValueForKind } from '../web/publish-price.mjs';
import { publicChannelPartitionKey, publicWalletHash, publicEpochTag, publicEraOf, addrKey } from '../web/shard-discovery.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A CHANNEL MUST NOT BE BLANKABLE BY MESSAGES THE SHARD REFUSED.
//
// A shard's address is derivable by anyone — that is what lets a stranger comment, and on INTRO what lets a
// stranger make first contact at all. So anyone can also send a shard a message it REFUSES. The chain handles
// that correctly: gate 13702 throws in COMPUTE, nothing is stored, the sender pays and gets a bounce.
//
// The reader is the part that has to be careful, because a refused message is still an inbound message of that
// account. MEASURED against live toncenter v3 on 2026-09-01: of 40 transactions on a real mainnet address, 19
// failed in COMPUTE (exit 130, aborted) — and ALL 19 of their inbound messages were returned by
// /api/v3/messages. Refused messages are indexed exactly like accepted ones.
//
// The reader's defence was an `opcode` query filter plus "a full page of ours IS the window; nothing to page
// for" (web/shard-rpc.mjs). That defends against junk carrying a DIFFERENT opcode. The opcode is chosen by the
// sender, so a griefer simply carries the right one: the window fills with refused messages, the reader sees no
// foreign row, concludes the page is genuine, and stops — returning nothing, with no error anywhere.
//
// This file drives the SHIPPING reader over a REAL PublicShard and measures where its window collapses.
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

/** The same faithful toncenter model the read-window file uses: newest-first, `limit`, and the three windows the
 *  endpoint is MEASURED to honour. Rows carry no `opcode` field, which is the honest worst case — the shipping
 *  reader treats a row with no opcode as AMBIGUOUS and never drops it, deliberately (see rowIsForeign). */
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

describe('public read window under refused-message flooding', () => {
  /** Five real posts on a real shard, then `junk` refused messages sent AFTER them. Returns what the feed reads. */
  async function scene(junkCount: number) {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: `poison-sink-${junkCount}` });
    const channel = await bc.treasury(`poison-channel-${junkCount}`);
    const griefer = await bc.treasury(`poison-griefer-${junkCount}`);

    const ownerHash = publicWalletHash(channel.address.toString());
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));

    // A ROW AND ITS BODY CARRY ONE STAMP, because they are one transaction: the contract writes the row with
    // now while it is handling that very message. So the harness advances the sandbox clock per publish and
    // gives the message the SAME second the row will get. Stamping the message ahead of its row models a chain
    // that cannot exist, and would make any window aimed by row time look broken.
    const REAL = 5;
    const messages: Array<{ body: any; source: string; createdAt: number }> = [];
    let dest: Address | null = null;
    for (let i = 0; i < REAL; i += 1) {
      bc.now = CLOCK + i;
      const payload = await createPublicPostPayloadV2({
        type: 'post', text: `post #${i}`, streamId: i.toString(16).padStart(4, '0').repeat(8), createdAtSec: CLOCK + i,
      });
      const built = await buildPublicPublishWalletMessage({
        kind: 0, keyArg: 0n, header: payload.headerCell, body: payload.bodyCell,
        value: publicPublishValueForKind(0), partitionKey, epochTag, nowUnix: CLOCK + i,
      });
      dest = await sendBuilt(channel, built);
      messages.push({ body: built.body, source: channel.address.toString(), createdAt: CLOCK + i });
    }
    const shard = bc.openContract(PublicShard.fromAddress(dest!));
    expect((await shard.getGetView()).entry_count, 'the shard holds the real posts').toBe(BigInt(REAL));

    // THE FLOOD. Well-formed PublicPublish bodies, the reader's own opcode, from a stranger — the shard REFUSES
    // every one at 13702 (the partition key folds the channel owner's hash, not the griefer's) so `entry_count`
    // never moves. They are appended to the message history because that is what the chain does with a refused
    // message, and what toncenter is measured to index.
    for (let i = 0; i < junkCount; i += 1) {
      const payload = await createPublicPostPayloadV2({
        type: 'post', text: `junk #${i}`, streamId: 'ff'.repeat(16), createdAtSec: CLOCK + 1000 + i,
      });
      const built = await buildPublicPublishWalletMessage({
        kind: 0, keyArg: 0n, header: payload.headerCell, body: payload.bodyCell,
        value: publicPublishValueForKind(0), partitionKey, epochTag, nowUnix: CLOCK + 1000 + i,
      });
      messages.push({ body: built.body, source: griefer.address.toString(), createdAt: CLOCK + 1000 + i });
    }
    expect((await shard.getGetView()).entry_count, 'and the flood stored NOTHING').toBe(BigInt(REAL));

    const lane = laneOverShards(bc, new Map([[addrKey(dest!.toString()), { shard, messages }]]));
    const posts = await lane.readChannelPosts(channel.address.toString());
    return posts.map((p: any) => readPublicPostPayloadV2({ header: p.header, body: p.body }).text);
  }

  it('PL-POISON-01: five paid posts survive a flood of refused messages that fills the whole window', async () => {
    const clean = await scene(0);
    expect(clean, 'the control: with no flood the channel reads back whole').toHaveLength(5);
    expect(clean).toContain('post #4');

    // 128 is the reader's own /messages limit — one window's worth, and the cheapest amount that fills it.
    const flooded = await scene(128);
    // eslint-disable-next-line no-console
    console.log(`[PL-POISON-01] clean ${clean.length}/5 | after 128 refused messages ${flooded.length}/5`);
    expect(flooded, 'a channel whose posts are on chain and paid for must not read back EMPTY because a '
      + 'stranger paid gas to have messages refused at its shard').toHaveLength(5);
    expect(flooded, 'and the newest post is the one a reader opens the channel for').toContain('post #4');
    expect(flooded).toContain('post #0');
  }, 900_000);

  it('PL-POISON-03: a flood stamped BETWEEN the posts, with the channel posting again after it', async () => {
    // THE CASE PL-POISON-01 DOES NOT COVER, and the one that decides whether aiming the window at the rows'
    // own time closes this or only narrows it. The window is [minAt - 600, maxAt]. A griefer who floods AFTER
    // the newest post is excluded by maxAt — that is what PL-POISON-01 measures. But a griefer floods ONCE,
    // and the channel's own next post then pulls maxAt ABOVE the flood, taking it back into the window.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'poison3-sink' });
    const channel = await bc.treasury('poison3-channel');
    const griefer = await bc.treasury('poison3-griefer');
    const ownerHash = publicWalletHash(channel.address.toString());
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));
    const messages: Array<{ body: any; source: string; createdAt: number }> = [];
    let dest: Address | null = null;
    const post = async (i: number, at: number) => {
      bc.now = at;
      const payload = await createPublicPostPayloadV2({
        type: 'post', text: `post #${i}`, streamId: i.toString(16).padStart(4, '0').repeat(8), createdAtSec: at });
      const built = await buildPublicPublishWalletMessage({
        kind: 0, keyArg: 0n, header: payload.headerCell, body: payload.bodyCell,
        value: publicPublishValueForKind(0), partitionKey, epochTag, nowUnix: at });
      dest = await sendBuilt(channel, built);
      messages.push({ body: built.body, source: channel.address.toString(), createdAt: at });
    };
    for (let i = 0; i < 5; i += 1) await post(i, CLOCK + i);
    // The flood, stamped between the posts already made and the one to come.
    for (let i = 0; i < 128; i += 1) {
      const payload = await createPublicPostPayloadV2({
        type: 'post', text: `junk #${i}`, streamId: 'ee'.repeat(16), createdAtSec: CLOCK + 10 + i });
      const built = await buildPublicPublishWalletMessage({
        kind: 0, keyArg: 0n, header: payload.headerCell, body: payload.bodyCell,
        value: publicPublishValueForKind(0), partitionKey, epochTag, nowUnix: CLOCK + 10 + i });
      messages.push({ body: built.body, source: griefer.address.toString(), createdAt: CLOCK + 10 + i });
    }
    // …and the channel posts once more, which lifts the window's ceiling over the flood.
    await post(5, CLOCK + 200);
    const shard = bc.openContract(PublicShard.fromAddress(dest!));
    expect((await shard.getGetView()).entry_count, 'six real posts, nothing else stored').toBe(6n);
    const lane = laneOverShards(bc, new Map([[addrKey(dest!.toString()), { shard, messages }]]));
    const texts = (await lane.readChannelPosts(channel.address.toString()))
      .map((p: any) => readPublicPostPayloadV2({ header: p.header, body: p.body }).text);
    // eslint-disable-next-line no-console
    console.log(`[PL-POISON-03] flood inside the row range, then one more post: ${texts.length}/6 read`);
    expect(texts, 'a flood the channel itself pulls back into the window must not hide its earlier posts')
      .toHaveLength(6);
  }, 900_000);

  it('PL-POISON-02: the flood does not have to be a whole window to matter', async () => {
    // The boundary is worth pinning: a partial flood must cost partial visibility at worst, never all of it.
    const results: Array<[number, number]> = [];
    for (const junk of [64, 127]) results.push([junk, (await scene(junk)).length]);
    // eslint-disable-next-line no-console
    console.log('[PL-POISON-02] ' + results.map(([j, n]) => `${j} junk -> ${n}/5 posts`).join(' | '));
    for (const [junk, seen] of results) {
      expect(seen, `${junk} refused messages must not hide paid posts`).toBe(5);
    }
  }, 900_000);
});
