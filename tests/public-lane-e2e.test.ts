import { describe, expect, it } from 'vitest';
import { Address, Cell, beginCell } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { deployFeeSink } from './helpers/fee-sink-fixture';
import { createPublicLane } from '../web/public-lane.mjs';
import { buildPublicPublishWalletMessage } from '../web/public-lane-send.mjs';
import { createPublicPostPayloadV2, readPublicPostPayloadV2, serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { publicPublishValueForKind } from '../web/publish-price.mjs';
import {
  publicChannelPartitionKey, publicThreadPartitionKey, publicBeaconPartitionKey, publicPostUid,
  publicWalletHash, publicEpochTag, publicEraOf, PUBLIC_BEACON_READ_SPACE, addrKey,
} from '../web/shard-discovery.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLIC-LANE END-TO-END — the WHOLE clean-17 public loop, in a sandbox, with NO mainnet genesis required.
//
// This is the validation that matters and the one I wrongly kept deferring to a "live run" that cannot exist
// before the clean-17 genesis: the sandbox IS where the clean-17 contracts run. Content is composed with the
// SHIPPING browser path (createPublicPostPayloadV2 → buildPublicPublishWalletMessage), sent to a REAL PublicShard,
// then read back through the SHIPPING read path (public-lane → readPublicPostPayloadV2). If the PPH2 codec, the
// browser builder's commit, the contract's stored commit, and the reader's re-derived commit did not all agree, the
// content would not come back — so green here is proof the client lane round-trips against the real contract.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const THREAD_ERA_SECONDS = 2_592_000;   // 30 days (PS_ERA_SHORT) — measured from get_view.era_seconds
const num = (v: bigint) => ({ type: 'num', value: '0x' + BigInt(v).toString(16) });
const toCoreCell = (c: any) => Cell.fromBase64(Buffer.from(serializeBoc(c)).toString('base64'));
const bocBase64 = (c: any) => Buffer.from(serializeBoc(c)).toString('base64');

/** Send a browser-built wallet message ({to, value, body, init}) from a treasury to a real shard, assert exit 0. */
async function sendBuilt(payer: any, built: any) {
  const dest = Address.parseRaw(built.to);
  const initCore = toCoreCell(built.init);
  const res = await payer.send({
    to: dest, value: built.value, body: toCoreCell(built.body),
    init: { code: initCore.refs[0], data: initCore.refs[1] }, bounce: true,
  } as any);
  const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === dest.toString());
  expect(Number(tx?.description?.computePhase?.exitCode), 'the real shard accepted the browser-built message').toBe(0);
  return dest;
}

/** A read lane whose get_view/get_page come live from the given shards and whose accountStates/messages are served
 *  from the published bodies — the real read stack, not a re-decode. `entries` maps a shard's raw key to its opened
 *  contract and the { body, source } messages published to it. */
function laneOverShards(bc: Blockchain, entries: Map<string, { shard: any; messages: Array<{ body: any; source: string }> }>, nowUnix = CLOCK) {
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
      const messages = (entry?.messages ?? []).map((m) => ({ source: m.source, message_content: { body: bocBase64(m.body) } }));
      return { ok: true, status: 200, json: async () => ({ messages }) } as any;
    }
    throw new Error(`unexpected fetch ${urlStr}`);
  };
  return createPublicLane({ runGetMethod, now: () => nowUnix, endpoint: 'https://x/api/v3/accountStates', fetch: fetchImpl });
}

describe('PUBLIC-LANE END-TO-END (sandbox, no genesis)', () => {
  it('PLE2E-01: a PPH2 post published via the browser path is read back and decodes to the original text', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'ple2e-post-sink' });
    const channel = await bc.treasury('ple2e-channel');

    const ownerHash = publicWalletHash(channel.address.toString());
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));
    const text = 'clean-17 lives — round-tripped through PPH2 and a real shard';

    const payload = await createPublicPostPayloadV2({ type: 'post', text, streamId: 'cd'.repeat(16), createdAtSec: CLOCK });
    const built = await buildPublicPublishWalletMessage({
      kind: 0, keyArg: 0n, header: payload.headerCell, body: payload.bodyCell,
      value: publicPublishValueForKind(0), partitionKey, epochTag,
    });
    const dest = await sendBuilt(channel, built);

    const shard = bc.openContract(PublicShard.fromAddress(dest));
    expect((await shard.getGetView()).entry_count, 'one entry stored').toBe(1n);

    const lane = laneOverShards(bc, new Map([[addrKey(dest.toString()), { shard, messages: [{ body: built.body, source: channel.address.toString() }] }]]));
    const posts = await lane.readChannelPosts(channel.address.toString());

    expect(posts.length, 'the post came back through the read path').toBe(1);
    expect(addrKey(posts[0].publisher), 'attributed to the channel wallet').toBe(addrKey(channel.address.toString()));
    const decoded = readPublicPostPayloadV2({ header: posts[0].header, body: posts[0].body });
    expect(decoded.type).toBe('post');
    expect(decoded.text, 'the exact text survived compose → shard → read → decode').toBe(text);
  }, 300_000);

  it('PLE2E-02: a comment published to the post\'s THREAD shard is read back by readThreadComments', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'ple2e-comment-sink' });
    const channel = await bc.treasury('ple2e-c-channel');
    const commenter = await bc.treasury('ple2e-c-commenter');

    // The post the comment hangs off: entry 0 of the channel shard.
    const channelPk = await publicChannelPartitionKey(publicWalletHash(channel.address.toString()), 0);
    const channelEpochTag = publicEpochTag(0, publicEraOf(0, CLOCK));
    const post = await createPublicPostPayloadV2({ type: 'post', text: 'a post that gets a reply', streamId: '01'.repeat(16), createdAtSec: CLOCK });
    await sendBuilt(channel, await buildPublicPublishWalletMessage({
      kind: 0, keyArg: 0n, header: post.headerCell, body: post.bodyCell,
      value: publicPublishValueForKind(0), partitionKey: channelPk, epochTag: channelEpochTag,
    }));

    // The comment: THREAD shard = f(post_uid), post_uid folds (channel_pk, channel epoch_tag, entry_id=0).
    const postUid = await publicPostUid(channelPk, channelEpochTag, 0n);
    const threadPk = await publicThreadPartitionKey(postUid, 0);
    const threadEpochTag = publicEpochTag(1, publicEraOf(1, CLOCK));
    const commentText = 'a reply that must come back through the thread shard';
    const comment = await createPublicPostPayloadV2({ type: 'comment', text: commentText, streamId: '02'.repeat(16), createdAtSec: CLOCK });
    const builtComment = await buildPublicPublishWalletMessage({
      kind: 1, keyArg: postUid, header: comment.headerCell, body: comment.bodyCell,
      value: publicPublishValueForKind(1), partitionKey: threadPk, epochTag: threadEpochTag,
    });
    const threadDest = await sendBuilt(commenter, builtComment);

    const threadShard = bc.openContract(PublicShard.fromAddress(threadDest));
    expect((await threadShard.getGetView()).entry_count, 'the comment is stored in the thread shard').toBe(1n);

    const lane = laneOverShards(bc, new Map([[addrKey(threadDest.toString()), { shard: threadShard, messages: [{ body: builtComment.body, source: commenter.address.toString() }] }]]));
    const { posts: comments } = await lane.readThreadComments(channel.address.toString(), channelEpochTag, 0n, { channelShardSeq: 0 });

    expect(comments.length, 'the comment came back via the thread derivation').toBe(1);
    expect(addrKey(comments[0].publisher), 'attributed to the commenter, not the channel').toBe(addrKey(commenter.address.toString()));
    const decoded = readPublicPostPayloadV2({ header: comments[0].header, body: comments[0].body });
    expect(decoded.type).toBe('comment');
    expect(decoded.text, 'the comment text survived the full loop').toBe(commentText);
  }, 300_000);

  it('PLE2E-03: a comment written in an earlier thread era is STILL read a era later (the era-window fix)', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'ple2e-era-sink' });
    const channel = await bc.treasury('ple2e-era-channel');
    const commenter = await bc.treasury('ple2e-era-commenter');

    const channelPk = await publicChannelPartitionKey(publicWalletHash(channel.address.toString()), 0);
    const channelEpochTag = publicEpochTag(0, publicEraOf(0, CLOCK));
    const post = await createPublicPostPayloadV2({ type: 'post', text: 'an old post', streamId: '03'.repeat(16), createdAtSec: CLOCK });
    await sendBuilt(channel, await buildPublicPublishWalletMessage({
      kind: 0, keyArg: 0n, header: post.headerCell, body: post.bodyCell,
      value: publicPublishValueForKind(0), partitionKey: channelPk, epochTag: channelEpochTag,
    }));

    // Comment published NOW, into THIS thread era.
    const postUid = await publicPostUid(channelPk, channelEpochTag, 0n);
    const threadPk = await publicThreadPartitionKey(postUid, 0);
    const threadEpochTag = publicEpochTag(1, publicEraOf(1, CLOCK));
    const comment = await createPublicPostPayloadV2({ type: 'comment', text: 'written last era', streamId: '04'.repeat(16), createdAtSec: CLOCK });
    const builtComment = await buildPublicPublishWalletMessage({
      kind: 1, keyArg: postUid, header: comment.headerCell, body: comment.bodyCell,
      value: publicPublishValueForKind(1), partitionKey: threadPk, epochTag: threadEpochTag,
    });
    const threadDest = await sendBuilt(commenter, builtComment);
    const threadShard = bc.openContract(PublicShard.fromAddress(threadDest));

    // Read ONE THREAD ERA LATER: a current-era-only reader would derive the next era's (empty) thread shard and see
    // nothing; the era-window scan must still reach this shard. Mutation: revert readThreadComments to current-era
    // only and this returns 0.
    const laterClock = CLOCK + THREAD_ERA_SECONDS;
    const lane = laneOverShards(bc, new Map([[addrKey(threadDest.toString()), { shard: threadShard, messages: [{ body: builtComment.body, source: commenter.address.toString() }] }]]), laterClock);
    const { posts: comments } = await lane.readThreadComments(channel.address.toString(), channelEpochTag, 0n, { channelShardSeq: 0 });

    expect(comments.length, 'the prior-era comment is still found via the era window').toBe(1);
    expect(readPublicPostPayloadV2({ header: comments[0].header, body: comments[0].body }).text).toBe('written last era');
  }, 300_000);

  it('PLE2E-05: a thread spanning two eras is reported shard by shard — the newer era first, the whole at the end', async () => {
    // OWNER 2026-08-21: comments should load progressively, like the channel search and the feed. A thread keeps one
    // shard per 30-day era; the reader walks them newest first and used to hand everything over only after the last
    // one. Two comments, two eras: the first report must carry the newer era's comment alone, the second both, and
    // the final return must equal the last report.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'ple2e-stream-sink' });
    const channel = await bc.treasury('ple2e-stream-channel');
    const commenter = await bc.treasury('ple2e-stream-commenter');

    const channelPk = await publicChannelPartitionKey(publicWalletHash(channel.address.toString()), 0);
    const channelEpochTag = publicEpochTag(0, publicEraOf(0, CLOCK));
    const post = await createPublicPostPayloadV2({ type: 'post', text: 'a post read across eras', streamId: '05'.repeat(16), createdAtSec: CLOCK });
    await sendBuilt(channel, await buildPublicPublishWalletMessage({
      kind: 0, keyArg: 0n, header: post.headerCell, body: post.bodyCell,
      value: publicPublishValueForKind(0), partitionKey: channelPk, epochTag: channelEpochTag,
    }));
    const postUid = await publicPostUid(channelPk, channelEpochTag, 0n);
    const threadPk = await publicThreadPartitionKey(postUid, 0);

    // Comment A in THIS thread era, comment B one thread era later — two live thread shards.
    const shards = new Map<string, any>();
    const publishComment = async (text: string, streamSeed: string, at: number) => {
      bc.now = at;
      const threadEpochTag = publicEpochTag(1, publicEraOf(1, at));
      const comment = await createPublicPostPayloadV2({ type: 'comment', text, streamId: streamSeed.repeat(16), createdAtSec: at });
      const built = await buildPublicPublishWalletMessage({
        kind: 1, keyArg: postUid, header: comment.headerCell, body: comment.bodyCell,
        value: publicPublishValueForKind(1), partitionKey: threadPk, epochTag: threadEpochTag,
      });
      const dest = await sendBuilt(commenter, built);
      shards.set(addrKey(dest.toString()), { shard: bc.openContract(PublicShard.fromAddress(dest)), messages: [{ body: built.body, source: commenter.address.toString() }] });
      return dest;
    };
    const destA = await publishComment('written in the older era', '06', CLOCK);
    const laterClock = CLOCK + THREAD_ERA_SECONDS;
    const destB = await publishComment('written in the newer era', '07', laterClock);
    expect(addrKey(destA.toString()) !== addrKey(destB.toString()), 'two eras, two thread shards').toBe(true);

    const lane = laneOverShards(bc, shards, laterClock + 60);
    const reports: any[] = [];
    const { posts: comments } = await lane.readThreadComments(channel.address.toString(), channelEpochTag, 0n, {
      channelShardSeq: 0,
      onProgress: (partial: any) => { reports.push({ n: partial.posts.length, texts: partial.posts.map((p: any) => readPublicPostPayloadV2({ header: p.header, body: p.body }).text), hasMore: partial.hasMore, shardsSeen: partial.shardsSeen }); },
    });

    expect(reports.length, 'one report per live shard').toBe(2);
    expect(reports[0].n, 'the FIRST report is the newest era alone').toBe(1);
    expect(reports[0].texts, 'and it is the newer comment').toEqual(['written in the newer era']);
    expect(reports[0].shardsSeen).toBe(1);
    expect(reports[1].n, 'the second report is the whole thread').toBe(2);
    expect(reports[1].texts.sort()).toEqual(['written in the newer era', 'written in the older era']);
    expect(reports[1].shardsSeen).toBe(2);
    expect(comments.length, 'the final return is the last report').toBe(2);
    expect(reports[1].hasMore, 'two single-row shards have nothing before them').toBe(false);
  }, 300_000);

  it('PLE2E-04: a channel that announces to its beacon bucket is found by sweepChannelCatalog', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'ple2e-beacon-sink' });
    const channel = await bc.treasury('ple2e-beacon-channel');

    // The announce: a BEACON PublicPublish into the deterministic bucket = walletHash % PUBLIC_BEACON_READ_SPACE.
    const walletHash = publicWalletHash(channel.address.toString());
    const bucket = Number(walletHash % BigInt(PUBLIC_BEACON_READ_SPACE));
    const beaconPk = await publicBeaconPartitionKey(bucket);
    const beaconEpochTag = publicEpochTag(2, publicEraOf(2, CLOCK));
    const card = await createPublicPostPayloadV2({ type: 'document', bytes: new Uint8Array(64).fill(0x7a), streamId: '05'.repeat(16), createdAtSec: CLOCK });
    const built = await buildPublicPublishWalletMessage({
      kind: 2, keyArg: BigInt(bucket), header: card.headerCell, body: card.bodyCell,
      value: publicPublishValueForKind(2), partitionKey: beaconPk, epochTag: beaconEpochTag,
    });
    const dest = await sendBuilt(channel, built);
    const beaconShard = bc.openContract(PublicShard.fromAddress(dest));
    expect((await beaconShard.getGetView()).entry_count, 'the announcement is stored in the beacon bucket').toBe(1n);

    const lane = laneOverShards(bc, new Map([[addrKey(dest.toString()), { shard: beaconShard, messages: [{ body: built.body, source: channel.address.toString() }] }]]));
    const catalog = await lane.sweepChannelCatalog({ eraWindow: 1, topBuckets: 32 });

    const found = catalog.find((c: any) => addrKey(c.channelWallet) === addrKey(channel.address.toString()));
    expect(found, 'the announcing channel appears in the catalogue, attributed to its own wallet').toBeTruthy();
    // the card is the beacon body — the app decodes it into a profile; here we assert it round-trips as the doc body
    const decoded = readPublicPostPayloadV2({ header: card.headerCell, body: found.card });
    expect(decoded.type).toBe('document');
  }, 300_000);
});
