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
      // created_lt grows with publish order and created_at carries the send clock, so the two windows toncenter v3
      // is MEASURED to honour are honoured here too: `end_lt` (inclusive, how a backward walk aims its bodies) and
      // `start_utime`/`end_utime` (how a walk with no lt aims them instead). A stub that ignored them would model
      // an endpoint that does not exist and would report every backward page as bodyless.
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

    // THE INVARIANT THAT MATTERS: the freshest post a channel published must be readable. A feed that silently
    // freezes at the page cap is indistinguishable, to its author, from a feed nobody reads.
    expect(texts, `read ${posts.length}/${TOTAL} entries`).toContain(`post #${TOTAL - 1}`);
    expect(texts).toContain(`post #${TOTAL - 2}`);
  }, 600_000);

  it('PL-WINDOW-03: a channel deeper than one page is READABLE TO ITS FIRST POST, a page at a time', async () => {
    // THE HALF OF "posts hang for a year" THAT WAS MISSING. The era window already spans a year; each era shard
    // was still read exactly one page deep, so entries below the newest 96 were on chain, paid for, retained, and
    // reachable by nothing. MEASURED here before the fix: 260 entries in, 96 out (164..259), post #0 invisible.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'pl-depth-sink' });
    const channel = await bc.treasury('pl-depth-channel');

    const ownerHash = publicWalletHash(channel.address.toString());
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));

    const TOTAL = 260;   // 2 pages + 68 rows: the walk has to take three windows to reach entry 0
    const messages: Array<{ body: any; source: string; createdAt: number }> = [];
    let dest: Address | null = null;
    for (let i = 0; i < TOTAL; i += 1) {
      // ON A MOVING CLOCK, unlike the two measurements above: a real channel's entries are stamped minutes and days
      // apart, and both of the windows a backward walk can aim its bodies with (created_lt, created_at) are only
      // meaningful when they differ per entry. 260 seconds stays well inside the same 30-day era.
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

    // THE DEFAULT IS STILL ONE PAGE — the background feed pass over every followed channel must not silently
    // start paying for a year of history. This is the old cost, asserted so a later change has to mean it.
    const shallow = await lane.readChannelPosts(channel.address.toString());
    expect(shallow.length, 'the default read takes the newest window only').toBe(96);
    expect(textsOf(shallow)).toContain(`post #${TOTAL - 1}`);
    expect(textsOf(shallow)).not.toContain('post #0');

    // A PAGE AT A TIME, RESUMING where the previous call stopped — and the lane HANDS OVER what it read rather
    // than accumulating it. A public part is up to 32 KiB and a shard holds up to PS_SAFE_CAP = 4096 of them, so a
    // fully walked shard would be ~128 MiB in a map that holds 512 shards; the caller's feed cache is durable and
    // merge-only, which makes it the ledger. What a reader ends up with is therefore the UNION across passes, and
    // that union is what has to reach entry 0.
    const seen = new Map<string, any>();
    const collect = (posts: any[]) => { for (const post of posts) seen.set(String(post.entry_id), post); };
    collect(shallow);
    collect(await lane.readChannelPosts(channel.address.toString(), { backfillPages: 1 }));
    expect(seen.size, 'one page of backfill is one page deeper').toBe(192);
    collect(await lane.readChannelPosts(channel.address.toString(), { backfillPages: 1 }));
    expect(seen.size, 'the second page reaches entry 0').toBe(TOTAL);

    // THE BODIES CAME WITH THE ROWS. Reading the oldest post's TEXT is the proof: the rows come from get_page and
    // the bodies from /messages newest-first, so a deep page matched against the newest bodies would return rows
    // with nothing in them (PCWINDOW-04's defect, and MEASURED here as 32 of 68 before the walk carried its own
    // body anchor down with it). Every post, in order, all the way to the first.
    const whole = [...seen.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    const texts = textsOf(whole);
    expect(texts).toContain('post #0');
    expect(texts).toContain('post #1');
    expect(new Set(texts).size, 'no entry read twice').toBe(TOTAL);
    expect(texts[0]).toBe(`post #${TOTAL - 1}`);
    expect(texts[texts.length - 1]).toBe('post #0');

    // AND AN EXHAUSTED SHARD IS NOT WALKED AGAIN. The rows are all with the caller, the shard has not moved, and a
    // further call with a budget to spend spends none of it: back to the newest window and nothing more.
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

    // Layout: 4 filler posts, then a 3-part post, then 95 fillers. entry_count = 102, so the 96-row tail window
    // starts at entry 6 — right THROUGH the middle of the multipart post (its parts are entries 4, 5, 6).
    // Without the straddle extension the assembler sees one orphan part of three and drops the post silently.
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
    // THE OTHER TWO WAYS A SHARD CAN BE MISSING ENTRIES, both of which a single "how deep have I been" mark hides.
    // A device that was away long enough for more than one page to arrive has a hole ABOVE what it holds: the
    // newest window no longer touches its newest post, and nothing would ever ask for what fell in between. And a
    // device that comes back at all has lost the lane's in-memory anchors, so the history BELOW what it holds has
    // to be aimed by the rows' own time — the path that shipped as a ReferenceError until PL-WINDOW-03 ran it.
    // Both are measured here on a channel posting a second apart, which is where the aiming is hardest.
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

    // A DEVICE COMING BACK: its durable cache holds entries 24..119 and the lane knows nothing (a fresh lane is a
    // fresh launch). The newest window is 174..269, so 120..173 belongs to no read at all unless the burst above
    // what the caller holds is treated as its own range.
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

    // AND THE HISTORY BELOW IT, on the next pass, with the caller's mark now covering everything it has merged.
    // Nothing carries an lt here — the lane restarted — so this is the rows'-own-time path end to end.
    const merged = { min: 24, max: 269 };
    collect(await laneOverShards(bc, shards).readChannelPosts(channel.address.toString(), {
      backfillPages: 1, knownRange: () => merged,
    }));
    expect(seen.has(0), 'the first post of the channel is reachable after a relaunch').toBe(true);
    expect(seen.has(23)).toBe(true);
  }, 900_000);
});
