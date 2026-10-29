import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createMessagingIdentity,
  exportPublicKeyBundle,
  createEncryptedConvCapsule,
  openPrivateCapsuleChainEntry,
  PLATHO_CAPSULE_CLOCK_SKEW_CODE,
} from '../web/crypto/platho-crypto.mjs';
import { outgoingRecordShard } from '../web/conv-discovery.mjs';
import { buildConvPublishWalletMessage } from '../web/conv-lane-send.mjs';
import { createConvReadLane } from '../web/conv-lane.mjs';
import { convHeader0BucketKey } from '../web/conv-lane-read.mjs';
import { CONV_PUBLISH_VALUE } from '../web/publish-price.mjs';
import { addrKey, publicBeaconScanAddresses } from '../web/shard-discovery.mjs';
import { serializeBoc, parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const onWire = (cell: any) => parseBocBase64(Buffer.from(serializeBoc(cell)).toString('base64'));
const kRoot = new Uint8Array(32).fill(0x5a);
const kRootOther = new Uint8Array(32).fill(0x3c);
const keyIdA = new Uint8Array(32).fill(0x11);
const keyIdB = new Uint8Array(32).fill(0x22);
const keyIdC = new Uint8Array(32).fill(0x33);
const CREATED = 1_790_000_000;
const EPOCH = Math.floor(CREATED / 86400);

describe('R55 — the private lane: one row a seq, and a conversation\'s own capsules only [C3-1, C3-2, C3-3]', () => {
  it('R55-LANE-01: a later copy of a body (the shard refused it, the index lists it) is not read beside the original', async () => {
    const A: any = await createMessagingIdentity();
    const B: any = await createMessagingIdentity();
    const route = await outgoingRecordShard({ kRoot, selfKeyId: keyIdA, peerKeyId: keyIdB, createdAtSec: CREATED });
    const publish = async (text: string, seq: number) => buildConvPublishWalletMessage({ writePublicKey: route.writePublicKey, writeSecret: route.writeSecret,
      seq, epoch: route.epoch, capsule: await createEncryptedConvCapsule(text, exportPublicKeyBundle(B.encryptionKeyPair), A, route.bucketKey, {}), value: CONV_PUBLISH_VALUE });
    const first = await publish('part one', 1);
    const second = await publish('part two', 2);
    const rows = [
      { bodyCell: onWire(first.body), source: null, createdLt: '3005', createdAt: 1_790_000_900 },
      { bodyCell: onWire(second.body), source: null, createdLt: '2002', createdAt: 1_790_000_200 },
      { bodyCell: onWire(first.body), source: null, createdLt: '2001', createdAt: 1_790_000_100 },
    ];
    const lane = createConvReadLane({ readMessagesWithSource: async (address: string) => (addrKey(address) === addrKey(first.to) ? rows : []) });
    const entries = await lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2 });
    expect(entries.map((entry: any) => entry.seq).sort(), 'MEASURED before: seq 1 twice — the message never assembled').toEqual(['1', '2']);
    expect(entries.find((entry: any) => entry.seq === '1').createdAt, 'the stamp of the body the shard stored, not the copy\'s').toBe(1_790_000_100);
  }, 120_000);

  it('R55-LANE-02: a capsule sealed for another conversation, re-signed into this one\'s shard, is not this conversation\'s', async () => {
    const A: any = await createMessagingIdentity();
    const B: any = await createMessagingIdentity();
    const C: any = await createMessagingIdentity();
    const bBundle = exportPublicKeyBundle(B.encryptionKeyPair);
    const route = await outgoingRecordShard({ kRoot, selfKeyId: keyIdA, peerKeyId: keyIdB, createdAtSec: CREATED });
    const elsewhere = await outgoingRecordShard({ kRoot: kRootOther, selfKeyId: keyIdC, peerKeyId: keyIdB, createdAtSec: CREATED });
    const honest = await buildConvPublishWalletMessage({ writePublicKey: route.writePublicKey, writeSecret: route.writeSecret, seq: 1, epoch: route.epoch,
      capsule: await createEncryptedConvCapsule('from A', bBundle, A, route.bucketKey, {}), value: CONV_PUBLISH_VALUE });
    const moved = await buildConvPublishWalletMessage({ writePublicKey: route.writePublicKey, writeSecret: route.writeSecret, seq: 2, epoch: route.epoch,
      capsule: await createEncryptedConvCapsule('C to B: meet on Friday', bBundle, C, elsewhere.bucketKey, {}), value: CONV_PUBLISH_VALUE });
    const rows = [
      { bodyCell: onWire(moved.body), source: null, createdLt: '2002' },
      { bodyCell: onWire(honest.body), source: null, createdLt: '2001' },
    ];
    const lane = createConvReadLane({ readMessagesWithSource: async (address: string) => (addrKey(address) === addrKey(honest.to) ? rows : []) });
    const loose = await lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2 });
    const opened = await openPrivateCapsuleChainEntry(loose.find((entry: any) => entry.seq === '2').entry, B.encryptionKeyPair, { enforceExpiry: false });
    expect(opened.plaintext, 'MEASURED before: C\'s words read in A\'s conversation').toBe('C to B: meet on Friday');
    const bound = await lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2, bindBucket: true });
    expect(bound.map((entry: any) => entry.seq)).toEqual(['1']);
    await expect(lane.readIncoming({ kRoot: null, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2, bindBucket: true })).rejects.toThrow(/bindBucket needs kRoot/);
    expect(convHeader0BucketKey({ data: new Uint8Array(42), bitLength: 336, refs: [] })).toBeNull();
    expect(code(sourceBlock(app, 'async function syncConvCapsulesFromShards('))).toContain('bindBucket: true,');
    expect(readFileSync('web/group-lane-read.mjs', 'utf8')).not.toContain('bindBucket');
  }, 120_000);
});

describe('R55 — a capsule from a day no writer could stamp, a room\'s dropped external, a note deleted over another device\'s [C3-4, C3-5, C3-6]', () => {
  it('R55-SKEW-01: the refusal carries its stamp, and one past the day after its shard\'s is unreadable for good', async () => {
    const A: any = await createMessagingIdentity();
    const B: any = await createMessagingIdentity();
    const route = await outgoingRecordShard({ kRoot, selfKeyId: keyIdA, peerKeyId: keyIdB, createdAtSec: CREATED });
    const far = Date.UTC(2100, 0, 1);
    const built = await buildConvPublishWalletMessage({ writePublicKey: route.writePublicKey, writeSecret: route.writeSecret, seq: 1, epoch: route.epoch,
      capsule: await createEncryptedConvCapsule('from 2100', exportPublicKeyBundle(B.encryptionKeyPair), A, route.bucketKey, { now: far }), value: CONV_PUBLISH_VALUE });
    const lane = createConvReadLane({ readMessagesWithSource: async (address: string) => (addrKey(address) === addrKey(built.to) ? [{ bodyCell: onWire(built.body), source: null, createdLt: '1' }] : []) });
    const [entry] = await lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2 });
    const refused: any = await openPrivateCapsuleChainEntry(entry.entry, B.encryptionKeyPair, { enforceExpiry: false, now: CREATED * 1000 }).then(() => null, (error) => error);
    expect(refused?.code).toBe(PLATHO_CAPSULE_CLOCK_SKEW_CODE);
    expect(refused.createdAt).toBe(far);
    const pass = code(sourceBlock(app, 'async function syncConvCapsulesFromShards('));
    expect(pass).toContain('const hopeless = error?.code === PLATHO_CAPSULE_CLOCK_SKEW_CODE');
    expect(pass).toContain('&& Number(error.createdAt) > (Number(found.epoch) + 2) * CONV_EPOCH_SECONDS * 1000;');
    expect(pass).toContain('if (hopeless || isPrivateUnreadableCapsuleError(error)) {');
    expect(far > (entry.epoch + 2) * 86_400_000).toBe(true);
  }, 120_000);

  it('R55-ROOM-01: a room\'s message and a public room\'s post are waited out and offered again; a note\'s delete reads the chunks first', () => {
    expect(app).toContain('{ transport: globalThis.plathoWalletRpcTransport ?? globalThis.plathoTonRpcTransport, awaitOutcome: true })');
    expect(app).toContain("{ assertAffordable: (extra) => assertWalletGramAtLeast(need + extra, 'group'), awaitOutcome: true });");
    const del = code(sourceBlock(app, 'async function deleteSelfNoteFromUi('));
    const read = del.indexOf("await restoreSelfNotesFromRecovery(await readSelfSlotLedger({ force: true, only: 'notes' }));");
    expect(read).toBeGreaterThan(-1);
    expect(read).toBeLessThan(del.indexOf('thread.messages.splice(index, 1);'));
    expect(read).toBeLessThan(del.indexOf('await publishSelfNotesSnapshotForThread(thread, owner);'));
    expect(del.indexOf("if (selfNotesRestoreIncomplete) { flashWalletIdentityStatus(t('notes.restoreIncomplete')); return; }", read)).toBeGreaterThan(read);
  });
});

describe('R55 — a channel from All, a new wallet\'s first step, the chat\'s title [C4-1, C6-1, C6-2]', () => {
  it('R55-CHANNEL-01: a channel not followed opens on what All already read of it', () => {
    const open = code(sourceBlock(app, 'function openPublicChannelView('));
    const seed = open.indexOf('if (!followed && publicChannelViewWallet) seedFollowingCacheFromAllFeed(publicChannelViewWallet);');
    expect(seed).toBeGreaterThan(-1);
    expect(seed).toBeLessThan(open.indexOf('publicChannelViewSyncPending = !followed;'));
  });

  it('R55-CREATE-01: the Quick start\'s Create moves on when the wallet is written, not after its whole first sync', async () => {
    const did: string[] = [];
    const env: any = {
      closeQuickStart: Object.assign(() => {}, { closings: 0 }), awaitTelegramWalletsOnEmptyDevice: async () => {},
      hasStoredPlathoWalletRecord: () => false, plathoWallet: null, t: (key: string) => key, promptStoredWalletUnlockOnStartup: async () => {},
      createPlathoWallet: async () => ({ address: 'EQ_NEW', networkGlobalId: -239 }), plathoWalletNetworkOptions: () => ({}),
      requestNewWalletStoragePassword: async () => 'pw',
      setPlathoWallet: async (_wallet: unknown, { afterWrite }: any) => { did.push('written'); await afterWrite(); await new Promise(() => {}); },
      markWalletKeyBackupPending: () => did.push('owed noted'), enforceTelegramSeedBackupGate: async () => {},
      flashWalletIdentityStatus: () => did.push('ready said'), refreshMessagingControls: () => {}, console: { error: () => {} },
    };
    const create = new Function(...Object.keys(env), `${sourceBlock(app, 'async function runQuickStartCreateWallet(')}; return runQuickStartCreateWallet;`)(...Object.values(env));
    const outcome = await Promise.race([create('pw'), new Promise((resolve) => setTimeout(() => resolve('still waiting'), 1_000))]);
    expect(outcome, 'MEASURED before: ~20 s of "Processing…" — the step waited for the whole first sync').toBe(true);
    expect(did).toEqual(['written', 'owed noted', 'ready said']);
    env.setPlathoWallet = async () => { throw new Error('storage full'); };
    const failing = new Function(...Object.keys(env), `${sourceBlock(app, 'async function runQuickStartCreateWallet(')}; return runQuickStartCreateWallet;`)(...Object.values(env));
    await expect(failing('pw')).rejects.toThrow('storage full');
  });

  it('R55-TITLE-01: a short address too wide for the header keeps its head and its tail; a name is cut at its end as before', () => {
    const run = (full: string, room: number) => {
      const node: any = { style: { fontSize: '' }, textContent: full, clientWidth: room };
      const attrs = new Map<string, string>();
      const activeTitle: any = { dataset: { fullTitle: full }, querySelector: () => node, style: { fontSize: '' },
        setAttribute: (k: string, v: string) => attrs.set(k, v), removeAttribute: (k: string) => attrs.delete(k) };
      const getComputedStyle = () => ({ fontWeight: '800', fontSize: '18px', fontFamily: 'x' });
      let font = 18;
      const document = { createElement: () => ({ getContext: () => ({
        set font(value: string) { font = parseFloat(value.split(' ')[1]); }, get font() { return ''; },
        measureText: (text: string) => ({ width: text.length * 8 * font / 16 }),
      }) }) };
      new Function('activeTitle', 'getComputedStyle', 'document', `${sourceBlock(app, 'function fitConversationTitle(')}; fitConversationTitle();`)(activeTitle, getComputedStyle, document);
      return { shown: node.textContent, size: node.style.fontSize, heard: attrs.get('aria-label') ?? null };
    };
    expect(run('UQDDw8...PDw3U5', 66), 'MEASURED before: "UQD…" at 320 px').toEqual({ shown: 'UQD...3U5', size: '13px', heard: 'UQDDw8...PDw3U5' });
    expect(run('UQDDw8...PDw3U5', 120), 'MEASURED before: "UQDDw8...P…" at 390 px').toEqual({ shown: 'UQDDw8...PDw3U5', size: '16px', heard: null });
    expect(run('UQDDw8...PDw3U5', 400)).toEqual({ shown: 'UQDDw8...PDw3U5', size: '', heard: null });
    expect(run('Alice in Wonderland and friends', 66)).toEqual({ shown: 'Alice in Wonderland and friends', size: '13px', heard: null });
    expect(code(sourceBlock(app, 'function renderConversationIdentity('))).toContain('activeTitle.dataset.fullTitle = labelText;');
    expect(code(sourceBlock(app, 'function showNoConversation('))).toContain('delete activeTitle.dataset.fullTitle;');
  });
});

describe('R55 — the catalogue\'s addresses, a minimised Mini App, a price read\'s 429 [C8-1, C8-2, C8-3]', () => {
  it('R55-BEACON-01: an era\'s beacon addresses are derived once; each caller gets its own copy', async () => {
    const at = 1_790_000_000;
    const t0 = performance.now();
    const first = await publicBeaconScanAddresses(at);
    const t1 = performance.now();
    const second = await publicBeaconScanAddresses(at + 60);
    const t2 = performance.now();
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(t2 - t1, `MEASURED before: every sweep derived them again (${Math.round(t1 - t0)} ms here)`).toBeLessThan(Math.max(50, (t1 - t0) / 5));
    second.pop();
    expect(await publicBeaconScanAddresses(at)).toEqual(first);
  }, 120_000);

  it('R55-MINIMISED-01: the message and balance loops stand while the Mini App is minimised, and come back with it', () => {
    expect(code(sourceBlock(app, 'function scheduleVaultAutoRefresh('))).toContain('if (!pageOnScreen() || !plathoWallet?.address) return;');
    expect(code(sourceBlock(app, 'function scheduleMessageAutoSync('))).toContain('if (!pageOnScreen()) return;');
    expect(code(sourceBlock(app, 'function checkWalletIncoming('))).toContain('if (!plathoWallet || !walletAssetsState.owner || !pageOnScreen()) return;');
    expect(code(app)).toContain('scheduleMessageAutoSync(2_000);\n      scheduleVaultAutoRefresh(2_000);\n      armIntroReceiveLane()');
    expect(app).toContain("tg.onEvent('activated', resumeReads);");
  });

  it('R55-PRICE-429-01: the Market\'s and the chart\'s periodic reads keep a 429 to themselves (no app-wide refusal of Send)', () => {
    expect(code(sourceBlock(app, 'async function walletMarketRead('))).not.toContain('noteTonRpcRateLimit');
    expect(code(sourceBlock(app, 'function walletPriceChart('))).not.toContain('noteTonRpcRateLimit');
  });
});
