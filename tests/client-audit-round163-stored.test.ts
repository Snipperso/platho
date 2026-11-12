import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createMessagingIdentity, exportPublicKeyBundle, createEncryptedConvCapsule } from '../web/crypto/platho-crypto.mjs';
import { outgoingRecordShard, incomingRecordShards } from '../web/conv-discovery.mjs';
import { buildConvPublishWalletMessage } from '../web/conv-lane-send.mjs';
import { createConvReadLane } from '../web/conv-lane.mjs';
import { parseCapsulePublishBody, convFrameCommitOfParsed } from '../web/conv-lane-read.mjs';
import { CONV_PUBLISH_VALUE } from '../web/publish-price.mjs';
import { addrKey } from '../web/shard-discovery.mjs';
import { serializeBoc, parseBocBase64 } from '../web/pwa-contract-transactions.mjs';


const kRoot = new Uint8Array(32).fill(0x5a);
const keyIdA = new Uint8Array(32).fill(0x11);
const keyIdB = new Uint8Array(32).fill(0x22);
const CREATED = 1_790_000_000;
const EPOCH = Math.floor(CREATED / 86400);
const onWire = (cell: any) => parseBocBase64(Buffer.from(serializeBoc(cell)).toString('base64'));

describe('C3-4: the reader returns what the shard kept', () => {
  it('R163-STORED-01: a refused row is not a message; a young one keeps the shard unread; the commits are read once and then from where they stood', async () => {
    const A: any = await createMessagingIdentity();
    const B: any = await createMessagingIdentity();
    const bBundle = exportPublicKeyBundle(B.encryptionKeyPair);
    const route = await outgoingRecordShard({ kRoot, selfKeyId: keyIdA, peerKeyId: keyIdB, createdAtSec: CREATED });
    const publish = async (seq: number, text: string) => {
      const capsule = await createEncryptedConvCapsule(text, bBundle, A, route.bucketKey, {});
      const built = await buildConvPublishWalletMessage({ writePublicKey: route.writePublicKey, writeSecret: route.writeSecret, seq, epoch: route.epoch, capsule, value: CONV_PUBLISH_VALUE });
      const cell = onWire(built.body);
      return { cell, to: built.to, commit: await convFrameCommitOfParsed(parseCapsulePublishBody(cell)) };
    };
    const one = await publish(1, 'kept');
    const two = await publish(2, 'refused long ago');
    const three = await publish(3, 'not in the records yet');
    const four = await publish(4, 'refused for good');
    const key = addrKey(one.to);
    const rows = [
      { bodyCell: three.cell, source: null, createdAt: CREATED + 900, createdLt: '30' },
      { bodyCell: two.cell, source: null, createdAt: CREATED, createdLt: '20' },
      { bodyCell: one.cell, source: null, createdAt: CREATED - 100, createdLt: '10' },
    ];
    let historyReads = 0;
    const lane = createConvReadLane({
      readMessagesWithSource: async (address: string) => { if (addrKey(address) !== key) return []; historyReads += 1; return rows; },
      readRecordPage: async (_address: string, fromId: number, maxCount: number) => {
        pageCalls.push([fromId, maxCount]);
        const all = stored.slice(fromId, fromId + maxCount);
        return { exists: true, fromId, count: all.length, recordCount: stored.length, rows: all.map((frameCommit) => ({ frameCommit, createdAt: 0 })) };
      },
    });
    const stored: bigint[] = [one.commit];
    const pageCalls: Array<[number, number]> = [];
    const all = await incomingRecordShards({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 0 });
    const shards = all.filter((bucket: any) => addrKey(bucket.address) === key).map((bucket: any) => ({ ...bucket, laneGeneration: 18 }));
    expect(shards.length).toBe(1);
    const states = new Map([[key, { lastLt: '30' }]]);
    const read = () => lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 0, shards, states, nowSec: CREATED + 1000 });

    const first = await read();
    expect(first.map((entry: any) => entry.seq), 'MEASURED before: all three, the two the shard refused among them').toEqual(['1']);
    expect(pageCalls, 'the records read from the first').toEqual([[0, 256]]);
    await read();
    expect(historyReads, 'not marked over a row that may still be a record').toBe(2);

    stored.push(three.commit);
    const third = await read();
    expect(third.map((entry: any) => entry.seq).sort(), 'the record arrived: its row is a message').toEqual(['1', '3']);
    expect(pageCalls.slice(-1), 'only the records added since').toEqual([[1, 256]]);
    await read();
    expect(historyReads, 'everything settled: the shard is marked and skipped while unchanged').toBe(3);
    states.set(key, { lastLt: '31' });
    const calls = pageCalls.length;
    const fourth = await read();
    expect([fourth.map((entry: any) => entry.seq).sort(), pageCalls.length - calls], 'every row already checked — the refused one by its row: no getter').toEqual([['1', '3'], 0]);
    rows.unshift({ bodyCell: two.cell, source: null, createdAt: CREATED + 950, createdLt: '40' });
    stored.push(two.commit);
    states.set(key, { lastLt: '40' });
    const fifth = await read();
    expect([fifth.map((entry: any) => entry.seq).sort(), pageCalls.length - calls], 'the taken copy: asked once, a message').toEqual([['1', '2', '3'], 1]);
    rows.shift();

    const gone = createConvReadLane({ readMessagesWithSource: async () => rows,
      readRecordPage: async () => ({ exists: false, fromId: 0, count: 0, recordCount: 0, rows: [] }) });
    const retired = await gone.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 0, shards, nowSec: CREATED + 1000 });
    expect(retired.length, 'MEASURED before: a retired room picture read as nothing').toBe(3);

    let clockReads = 0;
    let clockedHistory = 0;
    const clocked = createConvReadLane({ readMessagesWithSource: async () => { clockedHistory += 1; return rows; }, nowSec: () => { clockReads += 1; return CREATED + 1000; },
      readRecordPage: async (_a: string, fromId: number) => ({ exists: true, fromId, count: fromId === 0 ? 1 : 0, recordCount: 1, rows: fromId === 0 ? [{ frameCommit: one.commit, createdAt: 0 }] : [] }) });
    let clockedReads = 0;
    const clockedStates = new Map([[key, { lastLt: '30' }]]);
    const wrapped = async () => { clockedReads += 1; return clocked.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 0, shards, states: clockedStates }); };
    expect((await wrapped()).map((entry: any) => entry.seq)).toEqual(['1']);
    expect(clockReads, 'the lane asked its clock').toBeGreaterThan(0);
    const again = await wrapped();
    expect([again.map((entry: any) => entry.seq), clockedReads, clockedHistory], 'seq 3 young by the lane\'s clock: the shard unmarked, its history read again').toEqual([['1'], 2, 2]);

    rows.unshift({ bodyCell: four.cell, source: null, createdAt: CREATED - 50, createdLt: '41' });
    states.set(key, { lastLt: '41' });
    let before = pageCalls.length;
    await read();
    expect(pageCalls.length - before, 'a new row: asked once').toBe(1);
    states.set(key, { lastLt: '42' });
    before = pageCalls.length;
    await read();
    expect(pageCalls.length - before, 'judged refused for good: not asked again').toBe(0);
    lane.forgetShard(one.to);
    before = pageCalls.length;
    await read();
    expect(pageCalls.length - before, 'an ordinary forget (a failed open): the refused row still settled — no getter [round 166 — Q1-2]').toBe(0);
    lane.forgetShard(one.to, { refused: true });
    before = pageCalls.length;
    await read();
    expect(pageCalls.length - before, 'a manual rescan: the refused row asked about again').toBe(1);
    rows.shift();

    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toContain('for (const plan of plans) for (const root of plan.rootShards) for (const shard of root.shards) lane.forgetShard(shard.address, { refused: true });');
    expect(app).toContain('for (const bucket of bucketBlocked) lane.forgetShard(bucket);');

    const backwards = (pages: any[]) => {
      let at = 0;
      return createConvReadLane({ readMessagesWithSource: async () => rows,
        readRecordPage: async () => pages[Math.min(at++, pages.length - 1)] });
    };
    const page = (fromId: number, total: number, commits: bigint[]) => ({ exists: true, fromId, count: commits.length, recordCount: total, rows: commits.map((frameCommit) => ({ frameCommit, createdAt: 0 })) });
    const failedWith: string[] = [];
    const shortRead = backwards([page(0, 5, [one.commit]), page(1, 5, [])]);
    const partial = await shortRead.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 0, shards, nowSec: CREATED + 1000,
      onShardFailed: (_address: string, error: any) => failedWith.push(String(error?.message)) });
    expect([partial.length, failedWith.length], 'read to 1 of 5: no verdict, the shard not read').toEqual([0, 1]);

    const failed: string[] = [];
    const broken = createConvReadLane({
      readMessagesWithSource: async () => rows,
      readRecordPage: async () => { throw Object.assign(new Error('429'), { code: 'RATE_LIMITED' }); },
    });
    const none = await broken.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 0, shards, states, nowSec: CREATED + 1000, onShardFailed: (address: string) => failed.push(addrKey(address)) });
    expect([none.length, failed], 'a failed page read is a shard not read this pass').toEqual([0, [key]]);

    let asked = 0;
    const old = createConvReadLane({ readMessagesWithSource: async () => rows, readRecordPage: async () => { asked += 1; throw new Error('no such getter'); } });
    const seventeen = await old.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 0, shards: shards.map((bucket: any) => ({ ...bucket, laneGeneration: 17 })), nowSec: CREATED + 1000 });
    expect([seventeen.length, asked]).toEqual([3, 0]);
  }, 180_000);
});
