import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sourceBlock } from './helpers/source';
import {
  encodePrefsSnapshotChunks, decodePrefsSnapshotChunk, mergePrefsSnapshotChunks, normalizePublicChannelRegistry,
} from '../web/public-channel-subscriptions.mjs';
import { sealPrefsBlob, openPrefsBlob, PREFS_SEAL_OVERHEAD_BYTES } from '../web/recovery-blob.mjs';
import { preparePrefsBackup, restorePrefsChunks, prefsChunkSlot, PREFS_CHUNK_PLAINTEXT_MAX } from '../web/recovery-lane.mjs';
import {
  PREFS_CHUNK_COUNT, PREFS_NAMED_SLOT_INDEX, PREFS_OVERFLOW_SLOT_BASE, RECOVERY_MAX_SLOTS, RECOVERY_NAMED_SLOTS,
  NOTES_NAMED_SLOT_BASE, NOTES_NAMED_SLOT_COUNT, GROUPS_NAMED_SLOT_BASE, GROUPS_NAMED_SLOT_COUNT, prefsChunkSlotIndex, addrKey,
} from '../web/shard-discovery.mjs';
import { chunkWalletMessages, PLATHO_WALLET_CHUNK_EXTERNAL_BYTE_BUDGET } from '../web/platho-wallet.mjs';
import { tonCell } from '../web/pwa-contract-transactions.mjs';


const RAW = readFileSync('web/app.js', 'utf8');
const fn = (starts: string) => sourceBlock(RAW, starts);
const GLOBALS = new Set(Object.getOwnPropertyNames(globalThis));
function inert(): any {
  const self: any = new Proxy(function () { }, {
    get(_target, key) {
      if (key === Symbol.toPrimitive) return () => '';
      if (key === Symbol.iterator) return function* () { };
      if (key === 'then') return undefined;
      return self;
    },
    apply() { return self; },
    construct() { return self; },
    set() { return true; },
  });
  return self;
}
function inAppScope(sources: string[], exported: string, overrides: Record<string, any>) {
  const scope = new Proxy(overrides, {
    has(target, key) { return typeof key === 'string' && (key in target || !GLOBALS.has(key)); },
    get(target, key) {
      if (key === Symbol.unscopables) return undefined;
      if (typeof key === 'string' && key in target) return (target as any)[key];
      return inert();
    },
    set(target, key, value) { (target as any)[key] = value; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
}

const SEED = new Uint8Array(32).fill(0x5a);
const CAP = 79;
const enc = (text: string) => new TextEncoder().encode(text);
const wallet = (n: number) => `0:${n.toString(16).padStart(64, '0')}`;
const cellsOf = (cell: any) => { let n = 0; for (let cur = cell; cur; cur = cur.refs?.[0] ?? null) n += 1; return n; };
const followed = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ({ w: wallet(from + i), sub: true, name: null }));
const budget = { chunkBytes: PREFS_CHUNK_PLAINTEXT_MAX, maxChunks: PREFS_CHUNK_COUNT };

describe('PREFSV2 — the follow-list backup spans slots', () => {
  it('PREFSV2-01: chunk 0 is the one prefs slot every build wrote; the overflow is the rest of the named block, which is now fully allocated', () => {
    expect(PREFS_CHUNK_COUNT).toBe(4);
    const prefs = Array.from({ length: PREFS_CHUNK_COUNT }, (_, i) => prefsChunkSlotIndex(i));
    expect(prefs).toEqual([PREFS_NAMED_SLOT_INDEX, 269, 270, 271]);
    expect(PREFS_OVERFLOW_SLOT_BASE).toBe(GROUPS_NAMED_SLOT_BASE + GROUPS_NAMED_SLOT_COUNT);
    const notes = Array.from({ length: NOTES_NAMED_SLOT_COUNT }, (_, i) => NOTES_NAMED_SLOT_BASE + i);
    const groups = Array.from({ length: GROUPS_NAMED_SLOT_COUNT }, (_, i) => GROUPS_NAMED_SLOT_BASE + i);
    const named = [...prefs, ...notes, ...groups].sort((a, b) => a - b);
    const block = Array.from({ length: RECOVERY_NAMED_SLOTS }, (_, i) => RECOVERY_MAX_SLOTS + i);
    expect(named, 'every named slot has one owner, and none is outside the block the contract accepts (13576)').toEqual(block);
    expect(() => prefsChunkSlotIndex(PREFS_CHUNK_COUNT)).toThrow(RangeError);
    expect(() => prefsChunkSlotIndex(-1)).toThrow(RangeError);
  });

  it('PREFSV2-02: MEASURED with the real seal — a chunk\'s budget seals to exactly the cap, one more byte overflows it; one slot takes 302 channels, four take 1,208', async () => {
    expect(PREFS_CHUNK_PLAINTEXT_MAX).toBe(CAP * 127 - PREFS_SEAL_OVERHEAD_BYTES);
    expect(cellsOf((await sealPrefsBlob(SEED, new Uint8Array(PREFS_CHUNK_PLAINTEXT_MAX), 3)).body)).toBe(CAP);
    expect(cellsOf((await sealPrefsBlob(SEED, new Uint8Array(PREFS_CHUNK_PLAINTEXT_MAX + 1), 3)).body)).toBe(CAP + 1);
    const snapshot = (n: number) => ({ writtenAt: 1790000000, channels: followed(n), usernames: [], linked: null });
    const one = encodePrefsSnapshotChunks(snapshot(302), budget);
    expect(one.chunks, '302 followed channels fit the one slot every build wrote').toHaveLength(1);
    expect(encodePrefsSnapshotChunks(snapshot(303), budget).chunks, 'the 303rd opens the first overflow slot').toHaveLength(2);
    const named = encodePrefsSnapshotChunks({ ...snapshot(302), usernames: ['someone.ath'], linked: 'someone.ath' }, budget);
    expect(named.chunks.map((chunk) => decodePrefsSnapshotChunk(chunk)!.channels.length)).toEqual([301, 1]);
    expect(decodePrefsSnapshotChunk(named.chunks[1])!.usernames, 'names in chunk 0 only').toEqual([]);
    const full = encodePrefsSnapshotChunks(snapshot(1208), budget);
    expect(full.chunks).toHaveLength(4);
    expect(full.followedOverflow).toBe(0);
    for (const [index, chunk] of full.chunks.entries()) {
      // eslint-disable-next-line no-await-in-loop
      expect(cellsOf((await sealPrefsBlob(SEED, chunk, index)).body), `chunk ${index} within the cap`).toBeLessThanOrEqual(CAP);
    }
    expect(encodePrefsSnapshotChunks(snapshot(1209), budget).followedOverflow, 'the 1,209th is COUNTED, never dropped in silence').toBe(1);
    expect(cellsOf((await sealPrefsBlob(SEED, encodePrefsSnapshotChunks(snapshot(36), budget).chunks[0], 0)).body)).toBeLessThan(CAP / 4);
  });

  it('PREFSV2-03: a chunk carries each channel\'s wallet, flag and typed name, the wallet\'s own names, and steps over a section it does not know', () => {
    const label = String.fromCodePoint(0x43c, 0x43e, 0x439, 0x20, 0x1f4f0);
    const snapshot = {
      writtenAt: 1790000123,
      channels: [
        { w: wallet(1), sub: true, name: null },
        { w: wallet(2), sub: true, name: label },
        { w: `-1:${'ab'.repeat(32)}`, sub: true, name: null },
        { w: wallet(3), sub: false, name: null },
        { w: 'UQ-not-a-raw-address', sub: true, name: null },
      ],
      usernames: ['someone.ath', 'other.ath'],
      linked: 'someone.ath',
    };
    const out = encodePrefsSnapshotChunks(snapshot, budget);
    expect(out.skipped, 'a wallet the form cannot name is counted').toBe(1);
    const chunk = decodePrefsSnapshotChunk(out.chunks[0]);
    expect(chunk).toMatchObject({ version: 2, writtenAt: 1790000123, chunkIndex: 0, chunkCount: 1, usernames: ['someone.ath', 'other.ath'], linked: 'someone.ath' });
    expect(chunk!.channels).toEqual([
      { id: `wallet:${wallet(1)}`, w: wallet(1), sub: true, name: null },
      { id: `wallet:${wallet(2)}`, w: wallet(2), sub: true, name: label },
      { id: `wallet:-1:${'ab'.repeat(32)}`, w: `-1:${'ab'.repeat(32)}`, sub: true, name: null },
      { id: `wallet:${wallet(3)}`, w: wallet(3), sub: false, name: null },
    ]);
    const long = String.fromCodePoint(...Array.from({ length: 120 }, () => 0x439));
    const cut = decodePrefsSnapshotChunk(encodePrefsSnapshotChunks({ writtenAt: 1, channels: [{ w: wallet(9), sub: true, name: long + long }] }, budget).chunks[0]);
    const name = cut!.channels[0].name!;
    expect(enc(name).length).toBeLessThanOrEqual(255);
    expect(name).toBe(String.fromCodePoint(...Array.from({ length: 127 }, () => 0x439)));
    const withFuture = new Uint8Array([...out.chunks[0], 9, 0, 3, 1, 2, 3]);
    expect(decodePrefsSnapshotChunk(withFuture)!.channels).toHaveLength(4);
    expect(decodePrefsSnapshotChunk(out.chunks[0].slice(0, out.chunks[0].length - 1))).toBeNull();
    const badFlag = out.chunks[0].slice();
    badFlag[10] = 0x80;
    expect(decodePrefsSnapshotChunk(badFlag)).toBeNull();
    expect(decodePrefsSnapshotChunk(Uint8Array.of(2, 0, 0, 0, 1, 1, 1))).toBeNull();
    expect(decodePrefsSnapshotChunk(new Uint8Array(0))).toBeNull();
    const json = enc(JSON.stringify({ v: 1, writtenAt: 1758800000, channels: [{ id: `wallet:${wallet(4)}`, w: wallet(4), sub: true, name: 'mine', ts: 1 }], usernames: ['a.ath'], linked: 'a.ath' }));
    expect(decodePrefsSnapshotChunk(json)).toMatchObject({ version: 1, writtenAt: 1758800000, chunkIndex: 0, chunkCount: 1, usernames: ['a.ath'], linked: 'a.ath' });
    expect(decodePrefsSnapshotChunk(json)!.channels).toEqual([{ id: `wallet:${wallet(4)}`, w: wallet(4), sub: true, name: 'mine' }]);
  });

  it('PREFSV2-04: an unfollow marker only takes room the followed channels\' chunks have left — it never buys a slot', () => {
    const unfollowed = (n: number) => Array.from({ length: n }, (_, i) => ({ w: wallet(5000 + i), sub: false, name: null }));
    const tight = encodePrefsSnapshotChunks({ writtenAt: 1, channels: [...followed(290), ...unfollowed(50)] }, budget);
    expect(tight.chunks, 'no second slot for markers').toHaveLength(1);
    expect(tight.markersDropped).toBe(38);
    expect(decodePrefsSnapshotChunk(tight.chunks[0])!.channels.filter((entry: any) => !entry.sub)).toHaveLength(12);
    const onlyMarkers = encodePrefsSnapshotChunks({ writtenAt: 1, channels: unfollowed(3) }, budget);
    expect(onlyMarkers.chunks, 'unfollowing everything still saves: one chunk that says so').toHaveLength(1);
    expect(decodePrefsSnapshotChunk(onlyMarkers.chunks[0])!.channels.every((entry: any) => entry.sub === false)).toBe(true);
    expect(encodePrefsSnapshotChunks({ writtenAt: 1, channels: [] }, budget).chunks, 'an empty list is a save too').toHaveLength(1);
  });

  it('PREFSV2-05: the v2 seal binds its chunk; a v1 record — sealed here the way every earlier build sealed it — still opens, as chunk 0 only', async () => {
    const bytes = encodePrefsSnapshotChunks({ writtenAt: 7, channels: followed(3) }, budget).chunks[0];
    const { body, h0, h1 } = await sealPrefsBlob(SEED, bytes, 2);
    expect(h0).not.toBe(0n);
    expect(h1).not.toBe(0n);
    expect(await openPrefsBlob(SEED, body, 2)).toEqual(bytes);
    expect(await openPrefsBlob(SEED, body, 1), 'a chunk replayed into another slot does not open').toBeNull();
    expect(await openPrefsBlob(new Uint8Array(32).fill(0x99), body, 2), 'a wrong seed does not open').toBeNull();
    const subtle = globalThis.crypto.subtle;
    const material = await subtle.importKey('raw', SEED, 'HKDF', false, ['deriveBits']);
    const bits = await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: enc('PLATHO.RECOVERY.BLOB.SALT.V1'), info: enc('PLATHO.PREFS.BLOB.KEY.V1') }, material, 256);
    const key = await subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt']);
    const nonce = new Uint8Array(12).fill(3);
    const legacy = enc(JSON.stringify({ v: 1, writtenAt: 1758800000, channels: [{ id: `wallet:${wallet(4)}`, w: wallet(4), sub: true, name: null, ts: 1 }], usernames: [], linked: null }));
    const ciphertext = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: enc(JSON.stringify({ domain: 'PLATHO.PREFS.BLOB.SEAL.V1', version: 1 })), tagLength: 128 }, key, legacy));
    const record = enc(JSON.stringify({ version: 1, alg: 'AES-256-GCM', nonce: tonCell.bytesToBase64(nonce), ciphertext: tonCell.bytesToBase64(ciphertext) }));
    const v1Body = tonCell.snakeCellFromBytes(record, 'prefs blob');
    expect(await openPrefsBlob(SEED, v1Body, 0)).toEqual(legacy);
    expect(await openPrefsBlob(SEED, v1Body, 1), 'v1 was only ever written into the one prefs slot').toBeNull();
    expect(mergePrefsSnapshotChunks([{ chunkIndex: 0, bytes: await openPrefsBlob(SEED, v1Body, 0) }])!.channels.map((entry: any) => entry.w)).toEqual([wallet(4)]);
  });

  it('PREFSV2-06: chunk 0 is the commit record — no chunk 0, no snapshot; a tail past its count is not current; a channel met twice comes from the newer chunk', () => {
    const save = (writtenAt: number, channels: any[], maxChunks = PREFS_CHUNK_COUNT) => encodePrefsSnapshotChunks({ writtenAt, channels }, { chunkBytes: 400, maxChunks }).chunks;
    const older = save(100, followed(30));
    const newer = save(200, followed(5));
    expect(older.length).toBeGreaterThan(2);
    expect(newer).toHaveLength(1);
    const shrunk = mergePrefsSnapshotChunks([{ chunkIndex: 0, bytes: newer[0] }, ...older.slice(1).map((bytes, i) => ({ chunkIndex: i + 1, bytes }))]);
    expect(shrunk!.channels.map((entry: any) => entry.w)).toEqual(followed(5).map((entry) => entry.w));
    expect(shrunk!.chunkCount).toBe(1);
    expect(mergePrefsSnapshotChunks(older.slice(1).map((bytes, i) => ({ chunkIndex: i + 1, bytes }))), 'no commit record').toBeNull();
    expect(mergePrefsSnapshotChunks([{ chunkIndex: 1, bytes: older[0] }]), 'a chunk sitting in another chunk\'s slot').toBeNull();
    const small = { chunkBytes: 400, maxChunks: 2 };
    const olderSave = encodePrefsSnapshotChunks({ writtenAt: 250, channels: [...followed(12, 200), { w: wallet(3), sub: false }] }, small);
    const newerSave = encodePrefsSnapshotChunks({ writtenAt: 300, channels: [{ w: wallet(3), sub: true }, ...followed(12, 100)] }, small);
    expect(olderSave.chunks).toHaveLength(2);
    expect(decodePrefsSnapshotChunk(olderSave.chunks[1])!.channels.map((entry: any) => [entry.w, entry.sub])).toContainEqual([wallet(3), false]);
    expect(decodePrefsSnapshotChunk(newerSave.chunks[0])!.chunkCount, 'the newer save names two chunks').toBe(2);
    const merged = mergePrefsSnapshotChunks([{ chunkIndex: 0, bytes: newerSave.chunks[0] }, { chunkIndex: 1, bytes: olderSave.chunks[1] }]);
    expect(merged!.chunksRead, 'the older chunk 1 is inside the newer count: read').toBe(2);
    expect(merged!.channels.find((entry: any) => entry.w === wallet(3))!.sub, 'the newer chunk decides').toBe(true);
    expect(merged!.channels.filter((entry: any) => entry.w === wallet(3)), 'and the channel is listed once').toHaveLength(1);
  });

  it('PREFSV2-07: MEASURED — four FULL chunks with their state inits go out as ONE wallet external, with room to spare', async () => {
    const encoded = encodePrefsSnapshotChunks({ writtenAt: 1, channels: followed(1207), usernames: ['someone.ath'], linked: 'someone.ath' }, budget);
    expect(encoded.chunks).toHaveLength(4);
    expect(encoded.followedOverflow).toBe(0);
    const built = [];
    for (let chunkIndex = 0; chunkIndex < encoded.chunks.length; chunkIndex += 1) {
      // eslint-disable-next-line no-await-in-loop
      built.push(await preparePrefsBackup({ seed: SEED, prefsBytes: encoded.chunks[chunkIndex], chunkIndex, readView: async () => null, value: 44_000_000n }));
    }
    expect(built.map((write: any) => write.cells)).toEqual([79, 79, 79, 79]);
    const messages = [...built].reverse().map((write: any) => ({ address: write.to, amount: write.value, payload: tonCell.bytesToBase64(tonCell.serializeBoc(write.body)), stateInit: write.init, bounce: true }));
    expect(chunkWalletMessages(messages)).toHaveLength(1);
    expect(chunkWalletMessages(messages, 255, Math.floor(PLATHO_WALLET_CHUNK_EXTERNAL_BYTE_BUDGET * 0.8))).toHaveLength(1);
    const blobOf = (write: any) => write.body.refs[write.body.refs.length - 1].refs[0];
    const onChain = new Map(built.map((write: any) => [addrKey(write.to), blobOf(write)]));
    const restored = await restorePrefsChunks({
      seed: SEED,
      readView: async (address: string) => (onChain.has(addrKey(address)) ? { bound: true, seq: 1n } : { bound: false }),
      readBody: async (address: string) => onChain.get(addrKey(address)) ?? null,
    });
    expect(restored.clean).toBe(true);
    const merged = mergePrefsSnapshotChunks(restored.chunks);
    expect(merged!.chunksRead).toBe(4);
    expect(merged!.channels.map((entry: any) => entry.w)).toEqual(followed(1207).map((entry) => entry.w));
    expect(merged!.channels.every((entry: any) => entry.sub === true)).toBe(true);
    expect(merged!.usernames).toEqual(['someone.ath']);
  });

  it('PREFSV2-08: the lane reads the four prefs slots by fixed address, one batch saying which exist, and calls a bound chunk that will not open unclean', async () => {
    const slots = [];
    // eslint-disable-next-line no-await-in-loop
    for (let i = 0; i < PREFS_CHUNK_COUNT; i += 1) slots.push(await prefsChunkSlot(SEED, i));
    const chunk0 = encodePrefsSnapshotChunks({ writtenAt: 9, channels: followed(2) }, budget).chunks[0];
    const bodies = new Map([[slots[0].address, (await sealPrefsBlob(SEED, chunk0, 0)).body]]);
    const views: string[] = [];
    const readView = async (address: string) => { views.push(address); return bodies.has(address) ? { bound: true, seq: 1n } : { bound: false }; };
    const readBody = async (address: string) => bodies.get(address) ?? null;
    const readStates = async () => new Map([[addrKey(slots[0].address), { status: 'active', balance: 1n, lastLt: '5' }]]);
    const restored = await restorePrefsChunks({ seed: SEED, readView, readBody, readStates });
    expect(restored).toEqual({ chunks: [{ chunkIndex: 0, bytes: chunk0 }], clean: true });
    expect(views, 'the batch said only chunk 0 exists: one view, not four').toEqual([slots[0].address]);
    bodies.set(slots[1].address, (await sealPrefsBlob(SEED, chunk0, 2)).body);
    const unclean = await restorePrefsChunks({ seed: SEED, readView, readBody });
    expect(unclean.clean).toBe(false);
    expect(unclean.chunks.map((chunk: any) => chunk.chunkIndex)).toEqual([0]);
  });
});

describe('PREFSV2 — the app', () => {
  function saveWorld({ channels, landed = true }: { channels: any[]; landed?: boolean }) {
    const events: any[] = [];
    const status: string[] = [];
    const prepared: any[] = [];
    const wallet = { address: wallet0, seed: SEED };
    const scope: any = {
      prefsSyncInFlight: false, prefsConfirmGeneration: 0, prefsBackupAllowed: true, prefsEditEpoch: 0,
      plathoWallet: wallet,
      hasActivePlathoAccount: () => true, tonRpcLimited: () => false,
      globalThis: { plathoTonRpcTransport: { runGetMethod: async () => ({}) } },
      savePrefsStatus: {}, setText: (_node: any, text: string) => { status.push(text); }, t: (key: string) => key,
      refreshPrefsSyncUi: () => {}, refreshPrefsSyncButton: () => {}, refreshGlobalSyncIndicator: () => {},
      buildPrefsSnapshot: () => ({ writtenAt: 1790000000, channels, usernames: [], linked: null }),
      encodePrefsSnapshotChunks, PREFS_CHUNK_PLAINTEXT_MAX, PREFS_CHUNK_COUNT,
      createRecoveryViewReader: () => async () => null,
      requireBasechainAddress: () => {}, requirePlathoWalletAddress: () => wallet0,
      preparePrefsBackup: async ({ prefsBytes, chunkIndex }: any) => {
        prepared.push({ chunkIndex, bytes: prefsBytes });
        return { to: `slot-${chunkIndex}`, value: 44n, body: tonCell.snakeCellFromBytes(new Uint8Array(40), 'x'), init: `init-${chunkIndex}`, seq: 3, h1: BigInt(chunkIndex + 1), chunkIndex };
      },
      shardArrearOf: async (address: string) => (address === 'slot-1' ? 5n : 0n), LANE_RECOVERY: 'recovery',
      RECOVERY_PUBLISH_VALUE: 44n,
      walletSendSizeClassForPayloadBytes: () => 1, walletSendFeeReserveNanotons: (classes: number[]) => BigInt(classes.length),
      assertWalletGramAtLeast: async (need: bigint, label: string) => { events.push(['assert', need, label]); },
      tonCell,
      sendPlathoWalletTransaction: async (_wallet: any, { messages }: any) => { events.push(['send', messages.map((m: any) => [m.address, m.amount, m.payload ? 'write' : 'arrear'])]); },
      broadcastMayHaveLanded: () => false,
      confirmRecoverySlotWrites: async ({ writes }: any) => { events.push(['confirm', writes.map((w: any) => [w.address, w.seq, w.h1])]); return { landed, pending: landed ? [] : writes }; },
      setPrefsLastSyncedAt: (sec: number) => { events.push(['synced', sec]); },
      writePrefsDirty: (value: boolean) => { events.push(['dirty', value]); },
      noteTonRpcRateLimit: () => false,
      console: { info: () => {}, error: () => {} },
    };
    const save = inAppScope([fn('async function submitPrefsSnapshotDirect(')], 'submitPrefsSnapshotDirect', scope);
    return { save, events, status, prepared };
  }
  const wallet0 = `0:${'0f'.repeat(32)}`;

  it('PREFSV2-09: a list of two chunks — each chunk prepared for its slot, ONE transaction with the top-ups first and chunk 0 last, every chunk confirmed by content', async () => {
    const world = saveWorld({ channels: followed(400) });
    await world.save();
    expect(world.prepared.map((p: any) => p.chunkIndex)).toEqual([0, 1]);
    expect(decodePrefsSnapshotChunk(world.prepared[0].bytes)!.chunkCount).toBe(2);
    const [assertion, send, confirm, ...rest] = world.events;
    expect(assertion, 'one assert for everything the save pays: two values, one arrear, three messages').toEqual(['assert', 44n + 44n + 5n + 3n, 'prefs snapshot']);
    expect(send).toEqual(['send', [['slot-1', 5n, 'arrear'], ['slot-1', 44n, 'write'], ['slot-0', 44n, 'write']]]);
    expect(confirm).toEqual(['confirm', [['slot-0', 3, 1n], ['slot-1', 3, 2n]]]);
    expect(rest).toEqual([['synced', 1790000000], ['dirty', false]]);
  });

  it('PREFSV2-10: an unconfirmed chunk keeps the save dirty; a followed channel that fits no chunk refuses the save by name, before anything is paid', async () => {
    const unconfirmed = saveWorld({ channels: followed(400), landed: false });
    await unconfirmed.save();
    expect(unconfirmed.events.map((event: any) => event[0])).toEqual(['assert', 'send', 'confirm']);
    expect(unconfirmed.status.at(-1)).toBe('sync.notConfirmed');
    const tooMany = saveWorld({ channels: followed(1209) });
    await tooMany.save();
    expect(tooMany.events, 'nothing prepared, nothing paid').toEqual([]);
    expect(tooMany.prepared).toEqual([]);
    expect(tooMany.status.at(-1)).toBe('sync.saveTooLarge');
  });

  it('PREFSV2-11: applying a snapshot finds a channel by its wallet — one this device holds under another id takes the flag, a new one is registered by its short address or the name the reader typed', () => {
    const KNOWN = wallet(1);
    const NEW = wallet(2);
    const NAMED = wallet(3);
    const writes: any[] = [];
    const scope: any = {
      DEFAULT_PUBLIC_CHANNEL_ID: 'platho.app',
      customPublicChannels: [{ id: 'legacy-id-for-known', name: 'known', authorWallet: KNOWN }],
      publicChannelRegistry: [] as any[],
      publicChannelSubscriptions: { version: 1, activeChannelId: null, channels: [{ id: 'legacy-id-for-known', subscribed: false }] },
      normalizePublicChannelRegistry,
      rawWalletAddress: (value: any) => (/^-?\d:[0-9a-f]{64}$/.test(String(value)) ? String(value) : null),
      sameWalletAddress: (a: any, b: any) => a === b,
      shortAddress: (value: string) => `short(${value.slice(-4)})`,
      writeCustomPublicChannels: () => { writes.push('custom'); },
      rebuildPublicChannelRegistry: () => { scope.publicChannelRegistry = normalizePublicChannelRegistry(scope.customPublicChannels); },
      writePublicChannelSubscriptions: (_storage: any, value: any) => { writes.push(value); },
      setPrefsLastSyncedAt: () => {}, writePrefsDirty: () => {}, restoreKnownUsernamesFromSnapshot: () => {},
      readLinkedPlathoUsername: () => null, rebuildThreadsFromPublicSubscriptions: () => {}, resyncPublicForNewSubscription: () => {},
    };
    scope.rebuildPublicChannelRegistry();
    const apply = inAppScope([fn('function publicChannelMatchesAuthorWallet('), fn('function publicChannelAvatar('), fn('function applyPrefsSnapshot(')], 'applyPrefsSnapshot', scope);
    const snapshot = mergePrefsSnapshotChunks([{ chunkIndex: 0, bytes: encodePrefsSnapshotChunks({ writtenAt: 5, channels: [
      { w: KNOWN, sub: true }, { w: NEW, sub: true }, { w: NAMED, sub: false, name: 'typed by me' },
    ] }, budget).chunks[0] }]);
    expect(apply(snapshot)).toBe(true);
    expect(scope.customPublicChannels.map((channel: any) => [channel.id, channel.name])).toEqual([
      ['legacy-id-for-known', 'known'],
      [`wallet:${NEW}`, `short(${NEW.slice(-4)})`],
      [`wallet:${NAMED}`, 'typed by me'],
    ]);
    const subscriptions = writes.find((entry) => entry?.channels);
    expect(subscriptions.channels).toEqual([
      { id: 'legacy-id-for-known', subscribed: true },
      { id: `wallet:${NEW}`, subscribed: true },
      { id: `wallet:${NAMED}`, subscribed: false },
    ]);
  });

  it('PREFSV2-12: the backup carries a channel\'s name only when the reader typed it — the default short address is derived again on restore', () => {
    const A = wallet(1);
    const B = wallet(2);
    const scope: any = {
      publicChannelSubscriptions: { channels: [{ id: `wallet:${A}`, subscribed: true }, { id: `wallet:${B}`, subscribed: true }] },
      customPublicChannels: [{ id: `wallet:${A}`, authorWallet: A, name: `short(${A.slice(-4)})` }, { id: `wallet:${B}`, authorWallet: B, name: 'my feed' }],
      readPrefsUnfollowedIds: () => new Set(),
      plathoWallet: null,
      DEFAULT_PUBLIC_CHANNEL_ID: 'platho.app',
      rawWalletAddress: (value: any) => value ?? null,
      sameWalletAddress: (a: any, b: any) => a === b,
      shortAddress: (value: string) => `short(${value.slice(-4)})`,
    };
    const snapshot = inAppScope([fn('function buildPrefsSnapshot(')], 'buildPrefsSnapshot', scope)();
    expect(snapshot.channels).toEqual([{ w: A, sub: true, name: null }, { w: B, sub: true, name: 'my feed' }]);
    expect(RAW).not.toContain('serializePrefsSnapshotBytes');
    expect(RAW).not.toContain('parsePrefsSnapshotBytes');
  });
});
