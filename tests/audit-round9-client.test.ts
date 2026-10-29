import { afterEach, describe, expect, it } from 'vitest';
import {
  createPlathoWallet,
  noteChainTime,
  sendPlathoWalletTransaction,
  walletExternalSignedFields,
  __resetWalletSeqnoFloorsForTests,
  __resetWalletSendLanesForTests,
} from '../web/platho-wallet.mjs';
import { createWalletTransaction, beginCell, serializeBoc, parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { avatarRecordFromKeyShardView } from '../web/key-shard-ton-rpc-provider.mjs';
import { createConvReadLane } from '../web/conv-lane.mjs';
import { CAPSULE_PUBLISH_OPCODE } from '../web/conv-lane-read.mjs';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { testMnemonic } from './helpers/test-mnemonic';

const TEST_WALLET_MNEMONIC = await testMnemonic('wallet-a');


const MNEMONIC = TEST_WALLET_MNEMONIC;
const MESSAGE = { address: `0:${'11'.repeat(32)}`, amount: '19100000', payload: null };

function laggingChain(startSeqno: number, lagReads: number) {
  const sent: any[] = [];
  let seqno = startSeqno;
  let pending: number[] = [];
  return {
    sent,
    transport: {
      async runGetMethod() {
        const current = seqno;
        pending = pending.filter((countdown) => {
          if (countdown <= 1) { seqno += 1; return false; }
          return true;
        }).map((countdown) => countdown - 1);
        return { stack: [{ type: 'num', value: `0x${current.toString(16)}` }] };
      },
      async sendBoc(input: any) {
        sent.push(input);
        if (lagReads > 0) pending.push(lagReads);
        return { ok: true };
      },
    },
  };
}

function skewDevice(skewMs: number) {
  noteChainTime((Date.now() + skewMs) / 1000, Date.now());
}

describe('R9 M-6/M-8 — a skewed device clock must not reach a signed deadline or the seqno floor', () => {
  afterEach(() => {
    noteChainTime(Date.now() / 1000, Date.now());
    __resetWalletSeqnoFloorsForTests();
    __resetWalletSendLanesForTests();
  });

  it('R9-M6-01: a transaction built without a deadline carries none, so the lane signs one on the CHAIN clock', async () => {
    expect(createWalletTransaction(MESSAGE), 'no caller-named deadline, none invented').toEqual({ messages: [MESSAGE] });
    expect(createWalletTransaction(MESSAGE, { nowMs: 1_700_000_000_000, ttlSeconds: 60 }).validUntil,
      'a pinned clock still gets its exact deadline').toBe(1_700_000_060);

    skewDevice(600_000);
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = laggingChain(3, 1);
    await sendPlathoWalletTransaction(wallet, createWalletTransaction(MESSAGE), { transport: chain.transport, seqnoCatchupMs: 0 });
    const signed = walletExternalSignedFields(chain.sent[0].boc);
    const chainNowS = Math.floor((Date.now() + 600_000) / 1000);
    expect(Number(signed?.validUntil), 'signed on the chain clock: alive for ~300 s of CHAIN time')
      .toBeGreaterThanOrEqual(chainNowS + 290);
  });

  it('R9-M8-01: on a device 10 minutes slow two back-to-back sends still sign different seqnos', async () => {
    skewDevice(600_000);
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = laggingChain(5, 1);
    const opts = { transport: chain.transport, seqnoCatchupMs: 0 };
    const first = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE] }, opts);
    const second = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE] }, opts);
    expect([first.seqno, second.seqno], 'the floor must hold across the skew').toEqual([5, 6]);
  });

  it('R9-M8-02: on a device 10 minutes FAST a lost external is still re-broadcast while the next send waits for it', async () => {
    skewDevice(-600_000);
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = laggingChain(9, 0);
    await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE] }, { transport: chain.transport, seqnoCatchupMs: 0 });
    expect(chain.sent).toHaveLength(1);
    await expect(sendPlathoWalletTransaction(wallet, { messages: [MESSAGE] }, {
      transport: chain.transport, seqnoCatchupMs: 0, seqnoCatchupAttempts: 3, rebroadcastIntervalMs: 0,
    })).rejects.toThrow(/did not reach/);
    expect(chain.sent.length, 'the waiting send re-offered the lost bytes').toBeGreaterThan(1);
    expect(new Set(chain.sent.map((s: any) => s.boc)).size, 'the same bytes, never a second signature').toBe(1);
  });
});

describe('R9 M-1 — an avatar is never bought for a wallet whose KeyShard cannot take the pointer', () => {
  it("R9-M1-01: the avatar record carries the shard's registration, whatever the avatar state", () => {
    const owner = `0:${'ab'.repeat(32)}`;
    expect(avatarRecordFromKeyShardView({ exists: false, avatar_version: 0n }, owner).registered).toBe(false);
    expect(avatarRecordFromKeyShardView({ exists: true, avatar_version: 0n }, owner).registered).toBe(true);
    expect(avatarRecordFromKeyShardView({
      exists: true, avatar_version: 2n, owner_wallet: owner, avatar_hash: 1n, avatar_entry_id: 0n,
      avatar_stream_id: 1n, avatar_part_count: 1n, avatar_media_format: 1n, avatar_updated_at: 1n,
    }, owner).registered).toBe(true);
  });

  it('R9-M1-02: the purchase refuses an absent or unregistered shard BEFORE the request is built or anything is signed', () => {
    const app = code(readFileSync('web/app.js', 'utf8'));
    const submit = sourceBlock(app, 'async function submitProfileAvatarDirect(');
    const refusal = submit.search(/currentRead\.absent === true \|\| currentRead\.record\?\.registered === false/);
    expect(refusal, 'the refusal exists').toBeGreaterThan(0);
    expect(refusal, 'before the ATH request is built').toBeLessThan(submit.indexOf("createAthWalletMessage('ATHTransferRequestRegistryProfileAvatar'"));
    expect(submit.slice(refusal, refusal + 400)).toContain("error.code = 'PLATHO_AVATAR_NEEDS_ACTIVATION'");
    const handler = app.slice(app.indexOf("profileAvatarInput?.addEventListener('change'"));
    expect(handler.slice(0, 2500)).toMatch(/error\?\.code === 'PLATHO_AVATAR_NEEDS_ACTIVATION'\)\s*\{\s*setProfileAvatarStatus\(String\(error\.message\), 'error'\)/);
  });
});

describe('R9 M-2 — a channel-profile save whose bytes may have landed is not a failed save', () => {
  it('R9-M2-01: the one publisher answers an ambiguous broadcast as submitted, so no caller can invite a second paid save', () => {
    const app = code(readFileSync('web/app.js', 'utf8'));
    const publisher = sourceBlock(app, 'async function publishChannelProfileDirect(');
    const call = publisher.indexOf('await publishPublicLaneParts(');
    expect(call, 'the publisher broadcasts').toBeGreaterThan(0);
    const tryAt = publisher.lastIndexOf('try {', call);
    expect(tryAt, 'the broadcast sits inside a try').toBeGreaterThan(0);
    const catchBody = publisher.slice(publisher.indexOf('} catch (error) {', call));
    expect(catchBody.slice(0, 200), 'and only a broadcast that provably did not land is rethrown')
      .toMatch(/^\} catch \(error\) \{\s*if \(!broadcastMayHaveLanded\(error\)\) throw error;/);
    expect(publisher, 'the result still reaches the caller').toMatch(/return \{ result, description: desc,/);
  });

  it('R9-M2-02: a GRAM shortfall is shown with its amount on all three saves, not as "try again"', () => {
    const app = code(readFileSync('web/app.js', 'utf8'));
    const saves = app.split('await publishChannelProfile(').slice(1).map((after) => after.slice(0, 2200));
    expect(saves.length, 'three callers of the profile publisher').toBe(3);
    for (const save of saves) {
      expect(save).toMatch(/error\?\.code === 'PLATHO_WALLET_GRAM_REQUIRED'\) return \{ ok: false, error: String\(error\.message\) \}/);
    }
  });
});

describe('R9 M-7 — my notes are quoted as the recovery-slot write they are', () => {
  it('R9-M7-01: the quote bounds every single-slot pre-flight, whatever the chunk already holds', async () => {
    const { NOTES_SLOT_MAX_BLOB_BYTES } = await import('../web/notes-lane.mjs');
    const { capsuleSizeClassForUsefulBytes, minimalCapsuleUsefulBytesForLength } = await import('../web/capsule-part-policy.mjs');
    const { walletSendFeeNanotons } = await import('../web/wallet-send-fee.mjs');
    expect(NOTES_SLOT_MAX_BLOB_BYTES, 'RS_MAX_BLOB_CELLS snake cells of 127 bytes').toBe(79 * 127);
    const classOf = (bytes: number) => capsuleSizeClassForUsefulBytes(minimalCapsuleUsefulBytesForLength(bytes));
    const quoted = walletSendFeeNanotons([classOf(NOTES_SLOT_MAX_BLOB_BYTES)]);
    for (const blobBytes of [1, 127, 900, 2_000, 4_096, 8_000, 9_999, NOTES_SLOT_MAX_BLOB_BYTES]) {
      expect(walletSendFeeNanotons([classOf(blobBytes)]) <= quoted, `a ${blobBytes}-byte slot costs no more than the quote`).toBe(true);
    }
  });

  it('R9-M7-02: the composer routes the Saved thread to the notes quote, ahead of the private-message quote', () => {
    const app = code(readFileSync('web/app.js', 'utf8'));
    const refresh = sourceBlock(app, 'function refreshComposerCostStatus(');
    const saved = refresh.indexOf('isRealSavedThread(activeThread())');
    expect(saved, 'the Saved thread is recognised').toBeGreaterThan(0);
    expect(refresh.slice(saved, saved + 120)).toMatch(/\?\s*selfNotesComposerCostLine\(\)/);
    expect(saved, 'before the CONV-priced line').toBeLessThan(refresh.indexOf('privateComposerFinalCostLine('));
    const line = sourceBlock(app, 'function selfNotesComposerCostLine(');
    expect(line).toContain('const hold = RECOVERY_PUBLISH_VALUE + walletSendFeeReserveNanotons([sizeClass]);');
    expect(line).toContain('composerCostAndHoldLine({ cost, hold, parts: 1, upTo: true })');
    const both = sourceBlock(app, 'function composerCostAndHoldLine(');
    expect(both).toMatch(/balance < hold\) \{[\s\S]{0,200}?return \{\s*text: t\(upTo \? 'composer\.needHoldStatusUpTo' : 'composer\.needHoldStatus'/);
    expect(line).toMatch(/recoveryWriteFinalCost\(\{[\s\S]*blobBytes: NOTES_SLOT_MAX_BLOB_BYTES/);
    expect(line).toContain('NOTES_SLOT_MAX_BLOB_BYTES');
  });
});

const PAGE = 128;
const onWire = (cell: any) => parseBocBase64(Buffer.from(serializeBoc(cell)).toString('base64'));
function bodyForSeq(seq: number) {
  const sig = beginCell().bytesValue(new Uint8Array(64), 64, 'sig').endCell();
  const bodySig = beginCell().ref(beginCell().endCell()).ref(sig).endCell();
  return onWire(beginCell().uint(CAPSULE_PUBLISH_OPCODE, 32).uint(BigInt(seq), 64)
    .ref(beginCell().endCell()).ref(beginCell().endCell()).ref(bodySig).endCell());
}
function junkBody() { return onWire(beginCell().uint(CAPSULE_PUBLISH_OPCODE, 32).uint(0n, 64).endCell()); }

type Row = { body: any; createdLt: bigint };
function shardRows(plan: Array<['seq' | 'junk', number]>): Row[] {
  const rows: Row[] = [];
  let lt = 1n;
  let seq = 0;
  for (const [kind, count] of plan) {
    for (let i = 0; i < count; i += 1) {
      rows.push({ body: kind === 'seq' ? bodyForSeq(seq += 1) : junkBody(), createdLt: lt });
      lt += 1n;
    }
  }
  return rows;
}
const SHARD_A = `0:${'cd'.repeat(32)}`;
const SHARD_B = `0:${'ce'.repeat(32)}`;
const bucketOf = (address: string) => ({ epoch: 20_700, dir: 0, bucketKey: 1n, writePublicKey: new Uint8Array(32), address });

function laneOver(shards: Record<string, Row[]>) {
  const reads: Array<{ address: string; endLt: string | null }> = [];
  const lane = createConvReadLane({
    verifyWriteSig: false,
    readMessagesWithSource: async (address: string, options: any = {}) => {
      reads.push({ address, endLt: options?.endLt ?? null });
      const rows = shards[address] ?? [];
      const endLt = options?.endLt == null ? null : BigInt(options.endLt);
      const visible = endLt === null ? rows : rows.filter((r) => r.createdLt <= endLt);
      return visible.slice(-PAGE).reverse().map((r) => ({ bodyCell: r.body, createdLt: String(r.createdLt) }));
    },
  });
  const pass = async (opts: { addresses?: string[]; known?: number; fullWalk?: any; marker?: string } = {}) => {
    const addresses = opts.addresses ?? [SHARD_A];
    const gaps: string[] = [];
    const readsOf: Array<[string, boolean]> = [];
    const before = reads.length;
    const states = new Map(addresses.map((a) => [a.toLowerCase(), { lastLt: opts.marker ?? '1', dataHash: 'h' }]));
    const out = await lane.readIncoming({
      kRoot: new Uint8Array(32), selfKeyId: new Uint8Array(32), peerKeyId: new Uint8Array(32), epochNow: 20_700, windowW: 0,
      shards: addresses.map(bucketOf), states,
      knownSeqOf: () => opts.known ?? 0,
      onShardGap: (address: string) => gaps.push(address),
      onShardRead: (address: string, info: any) => readsOf.push([address, info.gap]),
      fullWalk: opts.fullWalk ?? false,
    });
    return { seqs: out.map((e: any) => Number(e.seq)).sort((a: number, b: number) => a - b), gaps, readsOf, reads: reads.length - before };
  };
  return { lane, pass };
}

describe('R9 D9-1 — an open read gap outlives the tab', () => {
  const SELF = new Uint8Array(32).fill(0x11);
  const PEER = new Uint8Array(32).fill(0x22);
  const candidate = (root: number, at: number) => ({
    kRoot: new Uint8Array(32).fill(root), introNonce: new Uint8Array(16).fill(root), createdAt: at,
    peerKeyId: PEER, peerEncPublicKey: null, peerWallet: `0:${'ab'.repeat(32)}`,
  });

  it('R9-D91-01: the store keeps the LOWEST floor per shard, clears it on request, and a restored root does not wipe it', async () => {
    const { createMemoryConvKeyStore, conversationId } = await import('../web/conv-key-store.mjs');
    const store = createMemoryConvKeyStore();
    await store.upsertConversationKRoot(SELF, PEER, candidate(1, 100));
    await store.noteConvShardGap(SELF, PEER, SHARD_A, 20);
    await store.noteConvShardGap(SELF, PEER, SHARD_A, 35);
    await store.noteConvShardGap(SELF, PEER, SHARD_B, -1);
    expect(store.getConversation(SELF, PEER).gapFloors).toEqual({ [SHARD_A]: 20, [SHARD_B]: -1 });
    await store.importConversations(new Map([[conversationId(SELF, PEER), { ...candidate(2, 200), kRootCurrent: new Uint8Array(32).fill(2), kRootsForRead: [], adoptedCreatedAt: 200, adoptedIntroNonce: new Uint8Array(16).fill(2), outgoingSeq: {} }]]));
    expect(store.getConversation(SELF, PEER).gapFloors).toEqual({ [SHARD_A]: 20, [SHARD_B]: -1 });
    await store.clearConvShardGap(SELF, PEER, SHARD_A);
    expect(store.getConversation(SELF, PEER).gapFloors).toEqual({ [SHARD_B]: -1 });
  });

  it('R9-D91-02: the sealed form carries the floors, and two tabs merge to the union at the lower floor', async () => {
    const { serializeConvKeyMap, deserializeConvKeyMap, mergeConvKeyMaps } = await import('../web/conv-key-persist.mjs');
    const record = (floors: Record<string, number>) => ({
      kRootCurrent: new Uint8Array(32).fill(1), kRootsForRead: [], peerKeyId: PEER, peerEncPublicKey: null, peerWallet: null,
      peerWalletCandidates: [], adoptedCreatedAt: 100, adoptedIntroNonce: new Uint8Array(16).fill(1), outgoingSeq: {},
      lastScannedEpoch: 5, lastScannedGeneration: 17, gapFloors: floors,
    });
    const back = deserializeConvKeyMap(serializeConvKeyMap(new Map([['c', record({ [SHARD_A]: 7 })]])));
    expect(back.get('c')!.gapFloors, 'the strict whitelist carries the field').toEqual({ [SHARD_A]: 7 });
    const merged = mergeConvKeyMaps(new Map([['c', record({ [SHARD_A]: 3, [SHARD_B]: 9 })]]), new Map([['c', record({ [SHARD_A]: 7 })]]));
    expect(merged.get('c')!.gapFloors).toEqual({ [SHARD_A]: 3, [SHARD_B]: 9 });
  });

  it('R9-D91-03: the reader never trusts a high-water above an open floor, while the raw mark keeps what the device holds', () => {
    const APP = readFileSync('web/app.js', 'utf8');
    const src = [sourceBlock(APP, 'function convBucketSeqHighWater('), sourceBlock(APP, 'function advanceConvBucketSeqHighWater(')].join('\n');
    const h = new Function(`const convBucketSeqMarks = new Map(); const convGapFloors = new Map(); const CONV_BUCKET_SEQ_MARK_LIMIT = 512;
      ${src}
      return { convBucketSeqHighWater, advanceConvBucketSeqHighWater, convGapFloors };`)();
    h.advanceConvBucketSeqHighWater(SHARD_A, 30);
    h.convGapFloors.set(SHARD_A, 0);
    expect(h.convBucketSeqHighWater(SHARD_A), 'MEASURED before: 30, and seq 1..20 were skipped at the pre-decrypt gate').toBe(0);
    h.advanceConvBucketSeqHighWater(SHARD_A, 35);
    expect(h.convBucketSeqHighWater(SHARD_A), 'still floored while the gap is open').toBe(0);
    h.convGapFloors.delete(SHARD_A);
    expect(h.convBucketSeqHighWater(SHARD_A), 'closed: the raw mark was never lowered').toBe(35);
  });

  it('R9-D91-04: the pass records a gap with the floor the device held, closes it only on a bottom-reaching read, and the unlock hydrates it first', () => {
    const app = code(readFileSync('web/app.js', 'utf8'));
    const sync = sourceBlock(app, 'async function syncConvCapsulesFromShards(');
    expect(sync).toContain('if (!gapsOpened.has(address)) gapsOpened.set(address, convBucketSeqHighWater(address));');
    expect(sync).toMatch(/onShardRead: \(address, info\) => \{ if \(info\?\.gap === false && convGapFloors\.has\(address\)\) gapsClosed\.add\(address\); \}/);
    expect(sync).toMatch(/await store\.noteConvShardGap\(selfKeyId, peerKeyId, address, floor\)/);
    expect(sync).toMatch(/if \(gapsOpened\.has\(address\) \|\| bucketTransient\.has\(address\)\) continue;[\s\S]{0,120}convGapFloors\.delete\(address\);[\s\S]{0,40}await store\.clearConvShardGap\(selfKeyId, peerKeyId, address\)/);
    const boot = sourceBlock(app, 'async function bootConvKeyStore(');
    const hydrated = boot.indexOf('hydrateConvGapFloors(convKeyStore)');
    expect(hydrated, 'the unlock hydrates the floors (a missing call reads -1, which is "before" everything)').toBeGreaterThan(0);
    expect(hydrated, 'hydrated before the recovery restores and before any pass').toBeLessThan(boot.indexOf('readSelfSlotLedger'));
    expect(app, 'a wallet switch drops the mirror with the marks').toMatch(/convBucketSeqMarks\.clear\(\);\s*convGapFloors\.clear\(\);/);
  });
});

describe('R9 D9-2 — a group lane read short is walked deep and the day stays unread until it is read to the bottom', () => {
  it('R9-D92-01: the real group runtime over flooded lanes: pass 2 walks deep (it made 0 reads before), and no day is called read early', async () => {
    const { createGroupRuntime } = await import('../web/group-runtime.mjs');
    const { createMemoryGroupRecordStore } = await import('../web/group-record-store.mjs');
    const { addrKey } = await import('../web/shard-discovery.mjs');
    const { x25519 } = await import('../web/vendor/@noble/curves/ed25519.js');
    const { ml_kem768 } = await import('../web/vendor/@noble/post-quantum/ml-kem.js');
    const kem = ml_kem768.keygen(new Uint8Array(64).fill(0x31));
    const xSecret = new Uint8Array(32).fill(0x31 ^ 0x5a);
    const identity = {
      vaultSeed: new Uint8Array(32).fill(0x31), wallet: `0:${'31'.repeat(32)}`, keyId: 'key-31', name: 'member-31',
      x25519SecretKey: xSecret, x25519PublicKey: x25519.getPublicKey(xSecret), mlKem768SecretKey: kem.secretKey, mlKem768PublicKey: kem.publicKey,
    };
    const CLOCK = 1_790_000_000;
    const flood = shardRows([['junk', 12_000]]);
    const readsBy = new Map<string, number>();
    const runtime = createGroupRuntime({
      store: createMemoryGroupRecordStore(),
      identity,
      send: async () => {},
      vaultRouting: async () => ({ vaultAddress: `0:${'aa'.repeat(32)}`, feeDue: 10_000_000n }),
      readMessagesWithSource: async (address: string, options: any = {}) => {
        readsBy.set(address, (readsBy.get(address) ?? 0) + 1);
        const endLt = options?.endLt == null ? null : BigInt(options.endLt);
        const visible = endLt === null ? flood : flood.filter((r) => r.createdLt <= endLt);
        return visible.slice(-PAGE).reverse().map((r) => ({ bodyCell: r.body, createdLt: String(r.createdLt) }));
      },
      readStates: async (addresses: string[]) => new Map(addresses.map((a) => [addrKey(a), { lastLt: '7', dataHash: 'h' }])),
      publishValue: 19_100_000n,
      now: () => CLOCK,
      random: (n: number) => new Uint8Array(n).fill(0x5c),
    });
    const created = await runtime.create({ name: 'the flooded kitchen' });
    const today = (rec: any) => rec.epochs.find((e: any) => Number(e.epoch) === Math.floor(CLOCK / 86_400));
    const pass = async () => {
      readsBy.clear();
      await runtime.sync();
      const record = runtime.list().find((r: any) => Buffer.from(r.groupId).equals(Buffer.from(created.groupId)));
      return { reads: Math.max(0, ...readsBy.values()), read: today(record)?.read === true };
    };
    const first = await pass();
    expect(first.reads, 'pass 1: the routine cap (newest window + four older pages)').toBe(5);
    expect(first.read, 'and the day is not read').toBe(false);
    const second = await pass();
    expect(second.reads, 'pass 2 walks the short lane DEEP — MEASURED before the fix: 0 reads, the lane skipped as unchanged').toBe(33);
    expect(second.read, 'still short: still unread (before the fix pass 2 marked it read)').toBe(false);
    let passes = 2;
    let closed = false;
    while (passes < 40 && !closed) {
      passes += 1;
      const next = await pass();
      expect(next.reads, 'every later pass is bounded').toBeLessThanOrEqual(33);
      closed = next.read;
    }
    expect(closed, 'the lane is walked to its end across passes, and only then is the day read').toBe(true);
  });

  it("R9-D92-02: a newcomer's snapshot read walks the admin's roster lane deep, not the routine five pages", async () => {
    const { createGroupReadLane } = await import('../web/group-lane-read.mjs');
    const flood = shardRows([['junk', 12_000]]);
    let reads = 0;
    const lane = createGroupReadLane({
      verifyWriteSig: false,
      readMessagesWithSource: async (_address: string, options: any = {}) => {
        reads += 1;
        const endLt = options?.endLt == null ? null : BigInt(options.endLt);
        const visible = endLt === null ? flood : flood.filter((r) => r.createdLt <= endLt);
        return visible.slice(-PAGE).reverse().map((r) => ({ bodyCell: r.body, createdLt: String(r.createdLt) }));
      },
    });
    const { groupMemberPublicKey, groupMemberSeed } = await import('../web/crypto/group-lane.mjs');
    const groupId = new Uint8Array(32).fill(0x42);
    const admin = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: new Uint8Array(32).fill(0x43), groupId }));
    const snapshot = await lane.readSnapshot({
      rosterKey: new Uint8Array(32).fill(0x41), groupId,
      pointer: { admin, epoch: 20_700, generation: 0, seq: 1 },
    });
    expect(snapshot, 'nothing but junk here').toBeNull();
    expect(reads, 'the newest window and thirty-two older pages').toBe(33);
  });
});

describe('R9 PS-1 / D9-3 — a replayed INTRO moves nothing, and a copy is never the source', () => {
  const G = `0:${'61'.repeat(32)}`;
  const G0 = `0:${'60'.repeat(32)}`;
  const E = `0:${'e5'.repeat(32)}`;
  const root = (n: number) => new Uint8Array(32).fill(n);
  const nonceOf = (n: number) => new Uint8Array(16).fill(n);
  const PEER = new Uint8Array(32).fill(0x22);
  const intro = (r: number, at: number, wallet: string) => ({ kRoot: root(r), introNonce: nonceOf(r), createdAt: at, peerKeyId: PEER, peerWallet: wallet });

  it('R9-PS1-01: the same INTRO never re-roots a conversation; an older copy corrects the source; a retired INTRO is a replay', async () => {
    const { adoptKRoot } = await import('../web/conv-key-store.mjs');
    let { record, outcome } = adoptKRoot(null, intro(1, 100, G));
    expect(outcome).toBe('created');
    const replay = adoptKRoot(record, intro(1, 300, E));
    expect(replay.outcome).toBe('replayed');
    expect(replay.record.peerWallet, 'the replayer is not the peer').toBe(G);
    expect(replay.record.adoptedCreatedAt, 'and the stamp does not move').toBe(100);
    expect(replay.record.peerWalletCandidates, 'a candidate at most, after the wallet held').toEqual([G, E]);
    const older = adoptKRoot(record, intro(1, 90, G0));
    expect(older.outcome).toBe('resourced');
    expect([older.record.peerWallet, older.record.adoptedCreatedAt]).toEqual([G, 90]);
    expect(older.record.peerWalletCandidates).toEqual([G, G0]);
    ({ record, outcome } = adoptKRoot(record, intro(2, 400, G)));
    expect(outcome).toBe('adopted');
    expect(record.retiredIntroNonces.map((n: Uint8Array) => n[0])).toEqual([1]);
    const rollback = adoptKRoot(record, intro(1, 500, E));
    expect(rollback.outcome).toBe('replayed');
    expect(rollback.record.kRootCurrent).toEqual(root(2));
    const restored = { ...record, kRootsForRead: [] };
    expect(adoptKRoot(restored, intro(1, 500, E)).outcome).toBe('replayed');
    const third = adoptKRoot(record, intro(3, 600, G0));
    expect(third.outcome).toBe('adopted');
    expect(third.record.peerWallet).toBe(G);
    expect(third.record.peerWalletCandidates).toEqual(expect.arrayContaining([G, G0]));
  });

  it('R9-PS1-02: the retired nonces ride the recovery blob, and an import never rolls a conversation back to a retired root', async () => {
    const { serializeRecoveryMap, deserializeRecoveryMap } = await import('../web/recovery-blob.mjs');
    const { adoptKRoot, createMemoryConvKeyStore, conversationId } = await import('../web/conv-key-store.mjs');
    let { record } = adoptKRoot(null, intro(1, 100, G));
    ({ record } = adoptKRoot(record, intro(2, 400, G)));
    const back = deserializeRecoveryMap(serializeRecoveryMap(new Map([['c', record]]))).get('c')!;
    expect(back.retiredIntroNonces.map((n: Uint8Array) => n[0]), 'carried by the blob').toEqual([1]);
    const legacy = deserializeRecoveryMap({ c: { k: Buffer.from(root(2)).toString('base64'), p: Buffer.from(PEER).toString('base64'), w: G, c: 400, n: Buffer.from(nonceOf(2)).toString('base64'), e: null } }).get('c')!;
    expect(legacy.retiredIntroNonces, 'a blob from an older build reads as none').toEqual([]);

    const SELF = new Uint8Array(32).fill(0x11);
    const store = createMemoryConvKeyStore();
    await store.upsertConversationKRoot(SELF, PEER, intro(1, 100, G));
    await store.upsertConversationKRoot(SELF, PEER, intro(2, 400, G));
    const poisoned = { kRootCurrent: root(1), kRootsForRead: [], peerKeyId: PEER, peerWallet: E, adoptedCreatedAt: 900, adoptedIntroNonce: nonceOf(1), outgoingSeq: {}, lastScannedEpoch: null };
    expect(await store.importConversations(new Map([[conversationId(SELF, PEER), poisoned]])), 'refused').toBe(0);
    expect(store.getConversation(SELF, PEER).kRootCurrent).toEqual(root(2));
  });

  it("R9-PS1-03: a replay is not a first contact — no message shown as new, no backup, no dialog woken", () => {
    const handler = code(readFileSync('web/intro-receive-handler.mjs', 'utf8'));
    expect(handler).toMatch(/if \(typeof onFirstContact === 'function' && adoption !== 'replayed'\) await onFirstContact\(result, capsule\);/);
    const store = code(readFileSync('web/conv-key-store.mjs', 'utf8'));
    expect(store, 'and nothing is persisted for it').toMatch(/if \(\(outcome !== 'duplicate' && outcome !== 'replayed'\) \|\| record !== held \|\| dirty\) \{ byConv\.set\(id, record\); await persistAndAdopt\(\); \}/);
  });

  it('R9-D93-01: a copy stamped after the entry, in the newest window, is never the source — the entry\'s own window is read', async () => {
    const { createMessagingIdentity, exportPublicKeyBundle, createEncryptedIntroCapsule } = await import('../web/crypto/platho-crypto.mjs');
    const { buildIntroPublishBrowser } = await import('../web/intro-publish-browser.mjs');
    const { fetchIntroCapsule, introBodyCommitBrowser } = await import('../web/intro-transport.mjs');
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    const header0 = parseBocBase64(built.chainCells.header0.boc);
    const body = parseBocBase64(built.chainCells.body.boc);
    const publish = await buildIntroPublishBrowser({ epoch: 20000, bucket: 0, r: 1n, viewTag: built.header0.viewTag, header0, body, value: 0n });
    const commit = await introBodyCommitBrowser(header0, body);
    const STAMP = 1_790_000_000;
    const reads: any[] = [];
    const readEntry = async () => ({ exists: true, body_commit: commit, created_at: STAMP });
    const readMessages = async (_address: string, options: any = {}) => {
      reads.push(options);
      if (options?.endUtime == null) return [{ bodyCell: publish.body, source: E, createdAt: STAMP + 25 }];
      return [{ bodyCell: publish.body, source: G, createdAt: STAMP - 3 }];
    };
    const fetched = await fetchIntroCapsule({ address: `0:${'33'.repeat(32)}`, entryId: 0n, readEntry, readMessages });
    expect(reads.length, 'the entry-time window was read too').toBeGreaterThanOrEqual(2);
    expect(fetched.source, 'the publisher at or below the stamp').toBe(G);
    expect(fetched.sourceCandidates, 'the copy is kept, last').toEqual([G, E]);
  });
});

describe('R9 U-1 — a pass that knew it was short does not say "Synced"', () => {
  it('R9-U1-01: an unclean private pass is a failure for the corner, unless the shortfall is the design', () => {
    const APP = readFileSync('web/app.js', 'utf8');
    const start = APP.indexOf('const PRIVATE_SYNC_SHORT_BY_DESIGN');
    const src = APP.slice(start, APP.indexOf('\n}\n', APP.indexOf('function completeMessageSyncUi(')) + 3);
    const h = new Function(`let messageAutoSyncLastResult = null, messageAutoSyncPhase = 'idle', messageAutoSyncLastErrorLabel = null, messageAutoSyncFailed = false;
      const privateSyncStatusText = () => 'sync incomplete'; const refreshConversationSubtitle = () => {};
      ${src}
      return (result) => { completeMessageSyncUi(result); return { phase: messageAutoSyncPhase, failed: messageAutoSyncFailed }; };`)();
    expect(h({ ok: true, scanComplete: false, reason: null }), 'a shard read short').toEqual({ phase: 'delayed', failed: true });
    expect(h({ ok: true, scanComplete: true, historyUnavailableCount: 2 }).failed, 'history the endpoint no longer holds').toBe(true);
    expect(h({ ok: false }).failed).toBe(true);
    expect(h({ ok: true, scanComplete: true, rateLimited: true }).failed).toBe(true);
    expect(h({ ok: true, scanComplete: false, reason: 'catch_up_pending' }).failed, 'an offline catch-up walks across passes by design').toBe(false);
    expect(h({ ok: true, scanComplete: false, reason: 'partial_stream_pending' }).failed, 'parts still landing').toBe(false);
    expect(h({ ok: true, scanComplete: true }), 'clean').toEqual({ phase: 'synced', failed: false });
  });

  it('R9-U1-02: a followed channel that could not be read leaves the public phase delayed, and the dead branch is gone', () => {
    const app = code(readFileSync('web/app.js', 'utf8'));
    const shards = sourceBlock(app, 'async function syncPublicChannelFromShards(');
    expect(shards).toMatch(/onChannelError: \(wallet, error\) => \{\s*(?:\/\/[^\n]*\n\s*)*if \(error\?\.code === 'PUBLIC_CHANNEL_STATE_UNKNOWN'\) return;\s*failedChannels \+= 1;/);
    expect(shards).toContain('failedChannelCount: failedChannels');
    const run = sourceBlock(app, 'async function syncPublicChannelsRun(');
    expect(run).toContain("setPublicSyncPhase(failedChannels > 0 ? 'delayed' : 'synced');");
    expect(app, 'nothing reads counters nobody writes').not.toMatch(/plathoLastPublicSync\?\.(historyUnavailableCount|incompleteChannelCount)/);
  });
});

describe('R9 U-2 — a key backup refused for money says so, with the figure, until every key is on chain', () => {
  it('R9-U2-01: the row shows the asked figure per lane and disappears when both lanes are backed up', () => {
    const APP = readFileSync('web/app.js', 'utf8');
    const src = ['function noteChatKeysBackupShortfall(', 'function clearChatKeysBackupShortfall(', 'function renderChatKeysBackupWarning(']
      .map((head) => sourceBlock(APP, head)).join('\n');
    const h = new Function(`let chatKeysBackupShortfall = { conv: null, groups: null };
      const chatKeysBackupWarning = { hidden: true }; const chatKeysBackupStatus = { textContent: '' };
      const t = (key, p) => key === 'errors.walletNeedsGram' ? 'Wallet needs ~' + p.amount + ' GRAM' : key;
      const formatTonNanotonsUp = (n) => (Number(n) / 1e9).toFixed(4);
      ${src}
      return { note: noteChatKeysBackupShortfall, clear: clearChatKeysBackupShortfall, row: chatKeysBackupWarning, status: chatKeysBackupStatus };`)();
    expect(h.row.hidden).toBe(true);
    h.note('conv', { code: 'PLATHO_WALLET_GRAM_REQUIRED', requiredNanotons: 48_400_000n });
    expect(h.row.hidden, 'MEASURED before: a console warning and nothing else').toBe(false);
    expect(h.status.textContent).toBe('Wallet needs ~0.0484 GRAM');
    h.note('groups', { code: 'PLATHO_WALLET_GRAM_REQUIRED', requiredNanotons: 51_620_000n });
    expect(h.status.textContent, 'the larger of the two asks').toBe('Wallet needs ~0.0516 GRAM');
    h.note('conv', { code: 'SOMETHING_ELSE' });
    expect(h.row.hidden, 'only a refusal for money shows here').toBe(false);
    h.clear('conv');
    expect(h.row.hidden, 'groups still owed').toBe(false);
    h.clear('groups');
    expect(h.row.hidden).toBe(true);
  });

  it('R9-U2-02: both backups report a refusal and clear it only on a confirmed write; a wallet switch resets it', () => {
    const app = code(readFileSync('web/app.js', 'utf8'));
    const conv = sourceBlock(app, 'async function runRecoveryBackupLocked(');
    expect(conv).toMatch(/\} catch \(error\) \{\s*noteChatKeysBackupShortfall\('conv', error\);/);
    expect(conv).toContain("if (convRecoveryDirtySlots.size === 0) clearChatKeysBackupShortfall('conv');");
    const groups = sourceBlock(app, 'async function backupGroupsIfNeeded(');
    expect(groups).toMatch(/\} catch \(error\) \{\s*noteChatKeysBackupShortfall\('groups', error\);\s*throw error;/);
    expect(groups).toMatch(/groupsRecoveryStored = chunks\.flat\(\);\s*clearChatKeysBackupShortfall\('groups'\);/);
    expect(app).toMatch(/chatKeysBackupShortfall = \{ conv: null, groups: null \};\s*renderChatKeysBackupWarning\(\);/);
    const html = readFileSync('web/index.html', 'utf8');
    expect(html).toMatch(/<button id="chatKeysBackupWarning" class="wallet-backup-warning" type="button" hidden><span data-i18n="wallet\.chatKeysNotBackedUp">/);
  });
});

describe('R9 PS-3 — a file chip shows and saves the same, honest name', () => {
  it('R9-PS3-01: bidirectional controls are stripped, executables and scriptable documents get .txt, and a declared type is not trusted', async () => {
    const { BIDI_CONTROLS_RE } = await import('../web/group-protocol.mjs');
    const APP = readFileSync('web/app.js', 'utf8');
    const src = [sourceBlock(APP, 'function safeDownloadName('), sourceBlock(APP, 'function safeDownloadMime(')].join('\n');
    const h = new Function('BIDI_CONTROLS_RE', `${src}\nreturn { safeDownloadName, safeDownloadMime };`)(BIDI_CONTROLS_RE);
    const RLO = String.fromCharCode(0x202e);
    const LRI = String.fromCharCode(0x2066);
    expect(h.safeDownloadName(`Photo_${RLO}gpj.chm`)).toBe('Photo_gpj.chm.txt');
    expect(h.safeDownloadName(`invoice${LRI}.pdf`)).toBe('invoice.pdf');
    for (const ext of ['chm', 'cpl', 'url', 'vbe', 'wsh', 'msc', 'iso', 'img', 'html', 'svg', 'mht', 'jnlp', 'docm', 'exe', 'lnk']) {
      expect(h.safeDownloadName(`a.${ext}`), ext).toBe(`a.${ext}.txt`);
    }
    for (const ok of ['a.pdf', 'a.png', 'a.zip', 'a.docx', 'a.mp3', 'a.txt']) expect(h.safeDownloadName(ok), ok).toBe(ok);
    expect(h.safeDownloadMime('text/html'), 'a sender-declared html is saved as bytes').toBe('application/octet-stream');
    expect(h.safeDownloadMime('image/svg+xml'), 'svg scripts').toBe('application/octet-stream');
    expect(h.safeDownloadMime('image/png')).toBe('image/png');
    expect(h.safeDownloadMime('application/pdf')).toBe('application/pdf');
    expect(sourceBlock(code(APP), 'async function downloadFileBlock(')).toContain('new Blob([bytes], { type: safeDownloadMime(block?.mime) })');
    const chip = sourceBlock(code(APP), 'function buildFileBlockChip(');
    expect(chip).toMatch(/const shown = block\.name == null \? t\('chat\.fileFallbackName'\) : safeDownloadName\(block\.name\);/);
  });
});

describe('R9 PS-5 — one wallet\'s trusted link domains are not another\'s', () => {
  it('R9-PS5-02: trusted external-link domains are read and written under the wallet-scoped key', () => {
    const app = code(readFileSync('web/app.js', 'utf8'));
    expect(sourceBlock(app, 'function readTrustedExternalDomains(')).toContain('walletScopedStorageKey(EXTERNAL_LINK_TRUSTED_DOMAINS_KEY)');
    expect(sourceBlock(app, 'function trustExternalDomain(')).toContain('walletScopedStorageKey(EXTERNAL_LINK_TRUSTED_DOMAINS_KEY)');
  });
});

describe("R9 PS-2 — a private group's picture is keyed to a secret the roster carries, not to the public group id", () => {
  const groupId = new Uint8Array(32).fill(0x42);
  const secretA = new Uint8Array(32).fill(0x5a);
  const secretB = new Uint8Array(32).fill(0x5b);
  const hexOf = (b: Uint8Array) => Buffer.from(b).toString('hex');

  it('R9-PS2-01: the pointer carries the secret through a PROFILE row and a roster snapshot; a pointer from before it is unchanged', async () => {
    const { encodeGroupProfile, encodeGroupRoster, decodeGroupPayload, GROUP_KIND } = await import('../web/group-protocol.mjs');
    const pointer = { epoch: 20_700, seq: 1, parts: 2, hash: 'ab'.repeat(32), width: 256, height: 256, key: hexOf(secretA) };
    const profile = decodeGroupPayload(GROUP_KIND.PROFILE, encodeGroupProfile({ avatar: pointer, sentAt: 1 }));
    expect(profile.avatar).toEqual(pointer);
    const roster = decodeGroupPayload(GROUP_KIND.ROSTER, encodeGroupRoster({ members: [], admins: [], avatar: pointer, sentAt: 1 }));
    expect(roster.avatar, 'a newcomer reads the secret in the snapshot the invite points at').toEqual(pointer);
    const legacy = { epoch: 20_700, seq: 1, parts: 2, hash: 'ab'.repeat(32), width: 256, height: 256 };
    const back = decodeGroupPayload(GROUP_KIND.PROFILE, encodeGroupProfile({ avatar: legacy, sentAt: 1 }));
    expect(back.avatar, 'no key field appears on an old pointer (records compared as JSON do not change)').toEqual(legacy);
    const junk = decodeGroupPayload(GROUP_KIND.PROFILE, new TextEncoder().encode(JSON.stringify({ v: 1, avatar: { ...legacy, k: '00'.repeat(32) }, sentAt: 1 })));
    expect('key' in junk.avatar, 'a zero or malformed secret is not a secret').toBe(false);
  });

  it('R9-PS2-02: the secret — not the id — decides the key and the lane, and it is bound to its group', async () => {
    const { groupAvatarKey, groupAvatarLanePublicKey } = await import('../web/crypto/group-lane.mjs');
    const epoch = 20_700;
    expect(hexOf(await groupAvatarKey(groupId, secretA)), 'the id alone no longer derives the key').not.toBe(hexOf(await groupAvatarKey(groupId)));
    expect(hexOf(await groupAvatarLanePublicKey({ groupId, epoch, secret: secretA })), 'nor the lane').not.toBe(hexOf(await groupAvatarLanePublicKey({ groupId, epoch })));
    expect(hexOf(await groupAvatarLanePublicKey({ groupId, epoch, secret: secretA }))).not.toBe(hexOf(await groupAvatarLanePublicKey({ groupId, epoch, secret: secretB })));
    const otherGroup = new Uint8Array(32).fill(0x43);
    expect(hexOf(await groupAvatarKey(otherGroup, secretA)), 'the same secret in another group is another key').not.toBe(hexOf(await groupAvatarKey(groupId, secretA)));
  });

  it('R9-PS2-03: a member reads the new picture through the pointer; a stranger holding only the id finds and opens nothing', async () => {
    const { buildGroupAvatarPublishMessages } = await import('../web/group-lane-send.mjs');
    const { createGroupReadLane, groupAvatarBucket } = await import('../web/group-lane-read.mjs');
    const { encodeGroupAvatar } = await import('../web/group-protocol.mjs');
    const { CONV_PUBLISH_VALUE } = await import('../web/publish-price.mjs');
    const EPOCH = 20_700;
    const BOUNDARY = 20_730;
    const image = new Uint8Array(3_000);
    for (let i = 0; i < image.length; i += 1) image[i] = (i * 29) & 0xff;
    const built = await buildGroupAvatarPublishMessages({
      groupId, epoch: EPOCH, payload: encodeGroupAvatar({ bytes: image, width: 64, height: 64, sentAt: 1 }), firstSeq: 1, sentAt: 1,
      secret: secretA, door: 'direct', value: CONV_PUBLISH_VALUE, boundary: BOUNDARY,
    });
    const chain = new Map<string, any[]>();
    for (const message of built.messages) {
      const key = String(message.shard ?? message.address).toLowerCase();
      if (!chain.has(key)) chain.set(key, []);
      chain.get(key)!.push({ bodyCell: parseBocBase64(message.payload), source: null });
    }
    const lane = createGroupReadLane({ readMessagesWithSource: async (address: string) => chain.get(String(address).toLowerCase()) ?? [] });
    const hash = Buffer.from(await crypto.subtle.digest('SHA-256', image)).toString('hex');
    const pointer = { epoch: EPOCH, seq: 1, parts: built.count, hash, width: 64, height: 64 };
    const picture: any = await lane.readAvatar({ groupId, pointer: { ...pointer, key: hexOf(secretA) }, boundary: BOUNDARY });
    expect(picture?.bytes?.length, 'a member, holding the pointer the roster carried').toBe(image.length);
    const legacyLane = (await groupAvatarBucket({ groupId, epoch: EPOCH, boundary: BOUNDARY })).address;
    expect(chain.has(String(legacyLane).toLowerCase()), 'the lane the id derives holds nothing').toBe(false);
    expect(await lane.readAvatar({ groupId, pointer, boundary: BOUNDARY }), 'and the id-derived key opens nothing').toBeNull();
    expect(await lane.readAvatar({ groupId, pointer: { ...pointer, key: hexOf(secretB) }, boundary: BOUNDARY }), 'nor does another secret').toBeNull();
  });

  it('R9-PS2-04: an admin setting a picture draws a fresh secret, publishes into ITS lane, and the price counts the pointer as sent', async () => {
    const { createGroupRuntime } = await import('../web/group-runtime.mjs');
    const { createMemoryGroupRecordStore } = await import('../web/group-record-store.mjs');
    const { groupAvatarBucket } = await import('../web/group-lane-read.mjs');
    const { encodeGroupProfile } = await import('../web/group-protocol.mjs');
    const { x25519 } = await import('../web/vendor/@noble/curves/ed25519.js');
    const { ml_kem768 } = await import('../web/vendor/@noble/post-quantum/ml-kem.js');
    const kem = ml_kem768.keygen(new Uint8Array(64).fill(0x35));
    const xSecret = new Uint8Array(32).fill(0x35 ^ 0x5a);
    const identity = {
      vaultSeed: new Uint8Array(32).fill(0x35), wallet: `0:${'35'.repeat(32)}`, keyId: 'key-35', name: 'admin',
      x25519SecretKey: xSecret, x25519PublicKey: x25519.getPublicKey(xSecret), mlKem768SecretKey: kem.secretKey, mlKem768PublicKey: kem.publicKey,
    };
    const CLOCK = 1_790_000_000;
    const sent: any[] = [];
    let draws = 0;
    const runtime = createGroupRuntime({
      store: createMemoryGroupRecordStore(), identity,
      send: async (messages: any[]) => { sent.push(...messages); },
      vaultRouting: async () => ({ vaultAddress: `0:${'aa'.repeat(32)}`, feeDue: 10_000_000n }),
      readMessagesWithSource: async () => [], readStates: async () => new Map(),
      publishValue: 19_100_000n, now: () => CLOCK,
      random: (n: number) => { draws += 1; return new Uint8Array(n).fill(0x60 + (draws % 16)); },
    });
    const record = await runtime.create({ name: 'a private room' });
    const id = Buffer.from(record.groupId).toString('hex');
    sent.length = 0;
    const image = new Uint8Array(5_000).fill(7);
    const first = await runtime.setAvatar(id, { bytes: image, width: 32, height: 32 });
    expect(first.avatar.key, 'a 32-byte secret rides the pointer').toMatch(/^[0-9a-f]{64}$/);
    const secret = Uint8Array.from(Buffer.from(first.avatar.key, 'hex'));
    const epoch = first.avatar.epoch;
    const ownLane = (await groupAvatarBucket({ groupId: record.groupId, epoch, secret })).address.toLowerCase();
    const idLane = (await groupAvatarBucket({ groupId: record.groupId, epoch })).address.toLowerCase();
    const pictureShards = sent.filter((m: any) => String(m.shard ?? '').toLowerCase() === ownLane);
    expect(pictureShards.length, 'the picture went into the lane its secret names').toBe(first.avatar.parts);
    expect(sent.some((m: any) => String(m.shard ?? '').toLowerCase() === idLane), 'and nothing into the lane the id names').toBe(false);
    const second = await runtime.setAvatar(id, { bytes: new Uint8Array(5_000).fill(9), width: 32, height: 32 });
    expect(second.avatar.key, 'every picture draws its own').not.toBe(first.avatar.key);
    const planSource = code(sourceBlock(readFileSync('web/group-runtime.mjs', 'utf8'), 'avatarPlan(groupId, byteLength) {'));
    expect(planSource).toContain("const pointer = { epoch: 0, seq: 0, parts: picture.count, hash: '00'.repeat(32), width: 0, height: 0, key: 'ff'.repeat(32) };");
    const planned = encodeGroupProfile({ avatar: { epoch: 0, seq: 0, parts: 1, hash: '00'.repeat(32), width: 0, height: 0, key: 'ff'.repeat(32) }, sentAt: CLOCK }).length;
    const real = encodeGroupProfile({ avatar: second.avatar, sentAt: CLOCK }).length;
    expect(Math.abs(planned - real), 'the priced PROFILE row is the size of the real one, secret included').toBeLessThanOrEqual(24);
    expect(runtime.avatarPlan(id, image.length).profile.count, 'one PROFILE capsule').toBe(1);
  });

  it('R9-PS2-06: a build that predates the secret names the same picture without it — the held secret is kept, not stripped', async () => {
    const { avatarPointerKeepingSecret } = await import('../web/group-store.mjs');
    const held = { epoch: 20_700, seq: 1, parts: 2, hash: 'ab'.repeat(32), width: 64, height: 64, key: 'cd'.repeat(32) };
    const { key: _drop, ...stripped } = held;
    expect(avatarPointerKeepingSecret(stripped, held), 'an old build\'s snapshot: the same picture, secret dropped').toEqual(held);
    const other = { ...stripped, hash: 'ef'.repeat(32) };
    expect(avatarPointerKeepingSecret(other, held), 'another picture replaces it whole').toEqual(other);
    expect(avatarPointerKeepingSecret(null, held), 'a PROFILE that removes the picture removes it').toBeNull();
    const fresh = { ...held, seq: 1, key: '12'.repeat(32) };
    expect(avatarPointerKeepingSecret(fresh, held), 'a pointer with its own secret is taken as it is').toEqual(fresh);
    const store = code(readFileSync('web/group-store.mjs', 'utf8'));
    expect(store, 'the ROSTER fold').toContain('avatar: avatarPointerKeepingSecret(row.payload.avatar ?? next.avatar, next.avatar),');
    expect(store, 'the PROFILE fold').toContain("...('avatar' in row.payload ? { avatar: avatarPointerKeepingSecret(row.payload.avatar, next.avatar) } : {}),");
  });

  it("R9-PS2-05: the pin says the picture is readable only while the group's picture predates its secret", () => {
    const APP = readFileSync('web/app.js', 'utf8');
    const h = (avatar: any) => new Function('t', 'publicGroupRuntimeInstance', 'groupRuntimeInstance',
      `${sourceBlock(APP, 'function groupProfilePinHint(')}\nreturn groupProfilePinHint('g', false);`)(
      (k: string) => k, { get: () => null }, { get: () => ({ avatar }) });
    expect(h(null), 'no picture').toBe('group.profilePinHint');
    expect(h({ hash: 'ab', key: 'cd'.repeat(32) }), 'a picture with its own secret').toBe('group.profilePinHint');
    expect(h({ hash: 'ab' }), 'a picture set before PS-2: the id still opens it, and the card says so').toBe('group.profilePinHintOpenPicture');
  });
});

describe('R9 READ-GAP — a shard read short is read again, and a flood is walked, not restarted', () => {
  it('R9-GAP-01: a gapped shard is never marked read, so an unchanged marker cannot skip it on the next pass (D9-2)', async () => {
    const { pass } = laneOver({ [SHARD_A]: shardRows([['seq', 3], ['junk', PAGE * 40]]) });
    const first = await pass();
    expect(first.gaps, 'pass 1 is short').toEqual([SHARD_A]);
    expect(first.readsOf, 'and says so to the caller that keeps a durable record').toEqual([[SHARD_A, true]]);
    const second = await pass();
    expect(second.reads, 'the same marker must not skip a shard that was read short').toBeGreaterThan(0);
  });

  it('R9-GAP-02: a flood deeper than any single pass is walked a page cap further on every pass, and the capsules under it arrive (C4-4)', async () => {
    const { pass } = laneOver({ [SHARD_A]: shardRows([['seq', 3], ['junk', PAGE * 40]]) });
    let got: number[] = [];
    let passes = 0;
    let maxReads = 0;
    while (passes < 20) {
      passes += 1;
      const result = await pass();
      maxReads = Math.max(maxReads, result.reads);
      if (result.seqs.length > 0) { got = result.seqs; expect(result.gaps, 'the pass that reaches them is clean').toEqual([]); break; }
      expect(result.gaps, `pass ${passes} is short and says so`).toEqual([SHARD_A]);
    }
    expect(got, 'the three capsules under the flood').toEqual([1, 2, 3]);
    expect(maxReads, 'no pass reads more than the routine bound (newest window + four older pages)').toBeLessThanOrEqual(5);
    expect(passes, '40 junk pages at 4 fresh pages a pass').toBeLessThanOrEqual(11);
    expect((await pass()).reads, 'closed: the gate works again').toBe(0);
  });

  it('R9-GAP-03: nothing genuine is ever stepped over — capsules between junk blocks all arrive (only all-junk pages are skipped)', async () => {
    const { pass } = laneOver({ [SHARD_A]: shardRows([['seq', 3], ['junk', 700], ['seq', 3], ['junk', 700], ['seq', 3]]) });
    let closing: any = null;
    for (let i = 0; i < 6; i += 1) {
      const result = await pass({ known: -1 });
      if (result.gaps.length === 0) { closing = result; break; }
    }
    expect(closing, 'the walk closes within a few passes').not.toBeNull();
    expect(closing.seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('R9-GAP-04: the deep walk can be asked for ONE shard, not the whole room', async () => {
    const { pass } = laneOver({
      [SHARD_A]: shardRows([['seq', 3], ['junk', PAGE * 20]]),
      [SHARD_B]: shardRows([['seq', 3], ['junk', PAGE * 20]]),
    });
    const result = await pass({ addresses: [SHARD_A, SHARD_B], fullWalk: (address: string) => address === SHARD_A });
    expect(result.seqs, 'A (deep) reaches its capsules; B (routine) cannot in one pass').toEqual([1, 2, 3]);
    expect(result.gaps).toEqual([SHARD_B]);
  });
});
