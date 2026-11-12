import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, webcrypto } from 'node:crypto';
import { Address, Cell, beginCell } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { deployFeeSink } from './helpers/fee-sink-fixture';
import { code, sourceBlock } from './helpers/source';
import { GRAM, swapWorld } from './helpers/swap-window';
import { proveJettonsWhole } from '../scripts/lib/jetton-pays-whole.mjs';
import { JETTON_PROOF, SWAP_LISTS_PROVEN_WHOLE, unprovenSwapLists } from '../scripts/lib/swap-lists-age.mjs';
import { createMessagingIdentity, exportPublicKeyBundle, createEncryptedIntroCapsule } from '../web/crypto/platho-crypto.mjs';
import { adoptKRoot, createMemoryConvKeyStore, signKeyHex } from '../web/conv-key-store.mjs';
import { deserializeConvKeyMap, mergeConvKeyMaps, serializeConvKeyMap } from '../web/conv-key-persist.mjs';
import {
  PEER_KEYS_COPIED, RECIPIENT_NOT_ACTIVATED, resolvePeerBundleFromKeyShardView, resolvePeerReplyBundle, resolveRecipientByWallet,
} from '../web/conv-reply-bundle.mjs';
import { createIntroReceiveHandler } from '../web/intro-receive-handler.mjs';
import { reviveIntroDirectSend, serializeIntroDirectSend } from '../web/intro-send-state.mjs';
import { createPublicShardTonRpcProvider, publicBodyCommit, publisherTagOf } from '../web/public-shard-ton-rpc-provider.mjs';
import { M21C_VAULT_PUBLISH_OPCODE } from '../web/m21c-envelope.mjs';
import { feeVaultAddress, feeVaultCodeBoc } from '../web/shard-address.mjs';
import * as feeVault from '../web/fee-vault.mjs';
import { createPublicLane } from '../web/public-lane.mjs';
import { buildPublicPublishWalletMessage } from '../web/public-lane-send.mjs';
import { createPublicPostPayloadV2, parseBocBase64, readPublicPostPayloadV2, serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { publicPublishValueForKind } from '../web/publish-price.mjs';
import { publicChannelPartitionKey, publicWalletHash, publicEpochTag, publicEraOf, addrKey } from '../web/shard-discovery.mjs';
import { parseRecipientIdentity } from '../web/recipient-identities.mjs';
import { createTonDnsProvider, TON_DNS_NO_WALLET, TON_DNS_NOT_REGISTERED } from '../web/ton-dns-provider.mjs';
import { resolveAuthoritativeUsernameItemOwnership } from '../web/username-ton-rpc-provider.mjs';
import { SWAP_POOLS_TAKEN, SWAP_TOKENS_WHOLE } from '../web/swap-pools.mjs';
import { DEDUST_POOLS_TAKEN, DEDUST_TOKENS, DEDUST_TOKENS_WHOLE } from '../web/dedust-pools.mjs';


if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

const read = (path: string) => readFileSync(path, 'utf8');
const app = read('web/app.js');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const settle = () => new Promise((resolve) => { setTimeout(resolve, 0); });
const hexOf = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const big = (bytes: Uint8Array): bigint => BigInt(`0x${hexOf(bytes)}`);
const sha256Big = (bytes: Uint8Array): bigint => BigInt(`0x${createHash('sha256').update(Buffer.from(bytes)).digest('hex')}`);
const wallet = (byte: string) => `0:${byte.repeat(32)}`;

function mlkemSnakeBoc(buf: Uint8Array): string {
  const chunks: Buffer[] = [Buffer.from(buf.subarray(0, 41))];
  for (let o = 41; o < buf.length; o += 127) chunks.push(Buffer.from(buf.subarray(o, Math.min(o + 127, buf.length))));
  let cursor = beginCell().storeBuffer(chunks[chunks.length - 1]);
  for (let i = chunks.length - 2; i >= 0; i -= 1) cursor = beginCell().storeBuffer(chunks[i]).storeRef(cursor.endCell());
  return cursor.endCell().toBoc().toString('base64');
}
function keyShardViewFor(identity: any, signedBy: any = identity) {
  const kp = identity.encryptionKeyPair;
  return {
    exists: true, enc_pubkey: big(kp.x25519PublicKey), sign_pubkey: big(signedBy.signingPublicKey), scan_pubkey: big(identity.scanPublicKey),
    pq_kem_pubkey_hash: sha256Big(kp.mlKem768PublicKey), pq_kem_pubkey_len: 1184n, pq_kem_pubkey: mlkemSnakeBoc(kp.mlKem768PublicKey), crypto_suite_mask: 2n,
  };
}
const asScanCapsule = (built: any, created_at: number, source: string | null, sourceCandidates: string[] = []) => ({
  r: 0n, view_tag: built.header0.viewTag, epoch: 0, bucket: 0, entryId: 0,
  capsule: { header0: parseBocBase64(built.chainCells.header0.boc), body: parseBocBase64(built.chainCells.body.boc), r: 0n, viewTag: built.header0.viewTag,
    created_at, source, sourceCandidates },
});
const absent = () => Object.assign(new Error('TON RPC get-method exit code -13'), { exitCode: -13 });
const timedOut = () => Object.assign(new Error('the read waited too long in the queue'), { code: 'QUEUE_TIMEOUT' });

describe('client audit round 153', () => {
  it('R153-01 (C1-1, HIGH): a jetton is paid out of the exchange\'s own wallet in a sandbox and back — whole, short, or not proven', async () => {
    const payout = JSON.parse(read('tests/fixtures/jetton-payout.json'));
    const run = async (label: string, { libraries = true } = {}) => {
      const one = payout.wallets.find((entry: any) => entry.label === label);
      const asked: string[] = [];
      const verdicts = await proveJettonsWhole({
        holders: [one.holder],
        readStates: async () => new Map([[one.holder.wallet, one.state]]),
        readLibrary: async (hash: string) => { asked.push(hash); return libraries ? one.libraries[hash] ?? null : null; },
      });
      return { verdict: verdicts.get(`${one.holder.master}|${one.holder.wallet}`), asked };
    };
    expect((await run('whole')).verdict).toEqual({ whole: true, why: '', unproven: false });
    const taxed = (await run('taxed')).verdict;
    expect(taxed.whole).toBe(false);
    expect(taxed.unproven).toBe(false);
    expect(taxed.why).toMatch(/^a payout arrives (29\.9\d*|30)% short$/);
    const library = await run('library');
    expect(library.verdict.whole, 'whole once the library is held').toBe(true);
    expect(library.asked.length, 'the library was asked for').toBeGreaterThan(0);
    const blind = (await run('library', { libraries: false })).verdict;
    expect([blind.whole, blind.unproven]).toEqual([false, true]);
    const one = payout.wallets[0];
    const none = await proveJettonsWhole({ holders: [one.holder], readStates: async () => new Map(), readLibrary: async () => null });
    expect(none.get(`${one.holder.master}|${one.holder.wallet}`)).toMatchObject({ whole: false, unproven: true });
    const foreign = await proveJettonsWhole({ holders: [{ ...one.holder, owner: wallet('77') }], readStates: async () => new Map([[one.holder.wallet, one.state]]),
      readLibrary: async (hash: string) => one.libraries[hash] ?? null });
    expect(foreign.get(`${one.holder.master}|${one.holder.wallet}`)).toMatchObject({ whole: false, unproven: true, why: 'it names another owner than the exchange' });
  }, 120_000);

  it('R153-02 (C1-1): both builders leave out a token that is not whole, the lists say the day they were proven, and a production deploy refuses one that does not', () => {
    for (const script of ['scripts/build_dedust_pools.mjs', 'scripts/build_swap_pools.mjs']) {
      const source = code(read(script));
      expect(source, script).toContain("import { jettonVerdictKey, proveJettonsWhole, toncenterJettonReads } from './lib/jetton-pays-whole.mjs';");
      expect(source, script).toContain('const verdicts = await proveJettonsWhole({ holders, ...toncenterJettonReads(call), log: (line) => console.log(line) });');
      expect(source, `${script}: a token not whole takes its pools out`).toMatch(/if \(!verdict\.whole\) short\.set\(holder\.master, verdict\.why\);/);
      expect(source, script).toMatch(/does not reach a wallet whole/);
      expect(source, script).toMatch(/kept\.splice\(at, 1\);\s*\}\s*console\.log\(`\$\{holders\.length\} jettons run in the sandbox/);
    }
    expect(code(read('scripts/build_dedust_pools.mjs'))).toContain("const named = await get(id, 'get_wallet_address', [sliceArg(beginCell().storeAddress(Address.parse(vault)).endCell())]);");
    expect(code(read('scripts/build_swap_pools.mjs'))).toContain("holders.push({ master: token.id, owner: one.router, wallet, symbol: token.symbol, sale: { dex: 'stonfi', askWallet } });");
    expect(read('scripts/build_dedust_pools.mjs')).toContain("export const DEDUST_TOKENS_WHOLE = '${TAKEN}';");
    expect(read('scripts/build_swap_pools.mjs')).toContain("export const SWAP_TOKENS_WHOLE = '${TAKEN}';");

    expect(SWAP_TOKENS_WHOLE).toBe(SWAP_POOLS_TAKEN);
    expect(DEDUST_TOKENS_WHOLE).toBe(DEDUST_POOLS_TAKEN);
    expect(unprovenSwapLists('web')).toEqual([]);
    const listed = new Set(DEDUST_TOKENS.map((token: any) => token[0]));
    for (const short of ['zlV1lo9AFAq-hDrQDBL9D5uNnAmsHyhR__eLWvMlpQY', 'D1vfH9xu02-Ihhz9X63CiqLMj4UsHoHLCf06Efs8HKo', 'OZFhAjiZ5biEimdaeEz1pxfFlgh4bREXxibQ01sZNh4',
      '3py7eLXOVi_TXXbTnIGgt7BBFzE8PQiFiVX6jLEtwHg', 'vukSlCteMcjdoiZfRxkKysxBTX2Wbw8Mdl9oHBgap3E', 'cYzZsKU80jAyOvv19mne_H8J72V8XR0szcsf9MJeZ9s']) {
      expect(listed.has(short), short).toBe(false);
    }

    const dir = mkdtempSync(join(tmpdir(), 'whole-'));
    try {
      writeFileSync(join(dir, 'swap-pools.mjs'), "export const SWAP_POOLS_TAKEN = '2026-11-10';\n");
      writeFileSync(join(dir, 'dedust-pools.mjs'), "export const DEDUST_POOLS_TAKEN = '2026-11-10';\nexport const DEDUST_TOKENS_WHOLE = '2026-11-09';\n");
      expect(unprovenSwapLists(dir)).toEqual([
        { file: 'swap-pools.mjs', what: "STON.fi's pools", taken: '2026-11-10', whole: '(none)', proof: '(none)' },
        { file: 'dedust-pools.mjs', what: "DeDust's pools", taken: '2026-11-10', whole: '2026-11-09', proof: '(none)' },
      ]);
      writeFileSync(join(dir, 'swap-pools.mjs'), `export const SWAP_POOLS_TAKEN = '2026-11-10';\nexport const SWAP_TOKENS_WHOLE = '2026-11-10';\nexport const SWAP_TOKENS_PROOF = ${JETTON_PROOF};\n`);
      writeFileSync(join(dir, 'dedust-pools.mjs'), `export const DEDUST_POOLS_TAKEN = '2026-11-10';\nexport const DEDUST_TOKENS_WHOLE = '2026-11-10';\nexport const DEDUST_TOKENS_PROOF = ${JETTON_PROOF};\n`);
      expect(unprovenSwapLists(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    expect(SWAP_LISTS_PROVEN_WHOLE.map((list: any) => list.file)).toEqual(['swap-pools.mjs', 'dedust-pools.mjs']);
    if (existsSync('scripts/deploy_static_web.mjs')) {
      const deploy = read('scripts/deploy_static_web.mjs');
      expect(deploy).toContain("const unproven = unprovenSwapLists(prep.outputDir ?? 'web');");
      expect(deploy, 'no flag ships an unproven list to production').toContain("if (unproven.length > 0 && SITE === 'production' && MODE === 'production') {");
      expect(deploy.indexOf('unprovenSwapLists(prep.outputDir'), 'before anything leaves the machine').toBeLessThan(deploy.indexOf("spawnSync('ssh'") > 0 ? deploy.indexOf("spawnSync('ssh'") : deploy.length);
    }
  });

  it('R153-03 (C3-1, HIGH): a conversation keeps its peer\'s signing key once — through adoption, a later INTRO, the disk, another tab and a restored backup', async () => {
    const key = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
    const other = Uint8Array.from({ length: 32 }, (_, i) => 200 - i);
    const pin = hexOf(key);
    for (const form of [key, [...key], big(key), big(key).toString(), `0x${pin}`, pin.toUpperCase(), Buffer.from(key).toString('base64url')]) {
      expect(signKeyHex(form), String(form).slice(0, 24)).toBe(pin);
    }
    for (const none of [null, undefined, '', 0n, '0', new Uint8Array(32), new Uint8Array(31), 'not a key', 1n << 256n]) expect(signKeyHex(none as any)).toBeNull();

    const root = (byte: number) => new Uint8Array(32).fill(byte);
    const nonce = (byte: number) => new Uint8Array(16).fill(byte);
    const peerKeyId = new Uint8Array(32).fill(9);
    const first = { kRoot: root(1), introNonce: nonce(1), createdAt: 100, peerKeyId, peerWallet: wallet('aa'), peerSignPublicKey: key };
    const created = adoptKRoot(null, first);
    expect([created.outcome, created.record.peerSignPublicKey]).toEqual(['created', pin]);
    expect('peerSignPublicKey' in adoptKRoot(null, { ...first, peerSignPublicKey: null }).record).toBe(false);
    const newer = adoptKRoot(created.record, { ...first, kRoot: root(2), introNonce: nonce(2), createdAt: 200, peerSignPublicKey: other });
    expect([newer.outcome, newer.record.peerSignPublicKey, hexOf(newer.record.kRootCurrent)]).toEqual(['adopted', pin, hexOf(root(2))]);
    expect(adoptKRoot(created.record, { ...first, kRoot: root(3), introNonce: nonce(3), createdAt: 50, peerSignPublicKey: other }).record.peerSignPublicKey).toBe(pin);
    expect(adoptKRoot(created.record, { ...first, peerWallet: wallet('bb'), peerSignPublicKey: other }).record.peerSignPublicKey).toBe(pin);
    const legacy = adoptKRoot(null, { ...first, peerSignPublicKey: null }).record;
    for (const next of [first, { ...first, kRoot: root(2), introNonce: nonce(2), createdAt: 200 }, { ...first, kRoot: root(3), introNonce: nonce(3), createdAt: 50 }]) {
      expect(adoptKRoot(legacy, next).record.peerSignPublicKey).toBe(pin);
    }

    const self = new Uint8Array(32).fill(7);
    const store = createMemoryConvKeyStore();
    await store.upsertConversationKRoot(self, peerKeyId, { ...first, peerSignPublicKey: null });
    expect(store.getConversation(self, peerKeyId).peerSignPublicKey).toBeUndefined();
    expect(await store.pinPeerSignKey(self, peerKeyId, key)).toBe(true);
    expect(await store.pinPeerSignKey(self, peerKeyId, other), 'the first kept stands').toBe(false);
    expect(store.getConversation(self, peerKeyId).peerSignPublicKey).toBe(pin);
    expect(await store.pinPeerSignKey(self, new Uint8Array(32).fill(8), key), 'no such conversation').toBe(false);

    const held = store.snapshot();
    const [id] = [...held.keys()];
    const onDisk = deserializeConvKeyMap(JSON.parse(JSON.stringify(serializeConvKeyMap(held))));
    expect(onDisk.get(id).peerSignPublicKey).toBe(pin);
    const olderBuild = new Map([[id, { ...onDisk.get(id) }]]);
    delete olderBuild.get(id)!.peerSignPublicKey;
    expect('peerSignPublicKey' in JSON.parse(JSON.stringify(serializeConvKeyMap(olderBuild)))[id]).toBe(false);
    expect(mergeConvKeyMaps(olderBuild, held).get(id).peerSignPublicKey, 'mine keeps it').toBe(pin);
    expect(mergeConvKeyMaps(held, olderBuild).get(id).peerSignPublicKey, 'theirs keeps it').toBe(pin);
    await store.importConversations(new Map([[id, { ...olderBuild.get(id), kRootCurrent: root(5), adoptedCreatedAt: 900, adoptedIntroNonce: nonce(5) }]]));
    expect([hexOf(store.getConversation(self, peerKeyId).kRootCurrent), store.getConversation(self, peerKeyId).peerSignPublicKey]).toEqual([hexOf(root(5)), pin]);

    const pending = { at: 1, boc: null, kRoot: root(1), introNonce: nonce(1), peerKeyId: 'a'.repeat(43), peerWallet: wallet('aa'), epoch: 1, bucket: 0,
      expectedEntryId: 0n, r: 1n, viewTag: 2n, peerSignKey: pin };
    expect(reviveIntroDirectSend(JSON.parse(JSON.stringify(serializeIntroDirectSend(pending)))).peerSignKey).toBe(pin);
    expect('peerSignKey' in serializeIntroDirectSend({ ...pending, peerSignKey: undefined })!).toBe(false);
  });

  it('R153-04 (C3-1; C3-2): a wallet is the peer only where its shard proves the peer\'s signing key; a read that failed is not a refusal', async () => {
    const victim: any = await createMessagingIdentity();
    const copier: any = await createMessagingIdentity();
    const me: any = await createMessagingIdentity();
    const peerKeyId = victim.encryptionKeyPair.keyId;
    const V = wallet('a1');
    const M = wallet('b2');
    const genuine = keyShardViewFor(victim);
    const copied = keyShardViewFor(victim, copier);
    const pin = hexOf(victim.signingPublicKey);

    expect((await resolvePeerBundleFromKeyShardView(copied, peerKeyId)).keyId, 'the gate before this round').toBe(peerKeyId);
    await expect(resolvePeerBundleFromKeyShardView(copied, peerKeyId, pin)).rejects.toMatchObject({ code: PEER_KEYS_COPIED });
    expect((await resolvePeerBundleFromKeyShardView(genuine, peerKeyId, pin)).keyId).toBe(peerKeyId);
    expect((await resolvePeerBundleFromKeyShardView(genuine, peerKeyId, victim.signingPublicKey)).keyId, 'bytes or hex').toBe(peerKeyId);

    const walk = async (views: Record<string, any>, order: string[], peerSignKey: string | null) => {
      const asked: string[] = [];
      let verified: string | null = null;
      const provider = { getView: async (address: string) => {
        asked.push(address);
        const view = views[address];
        if (typeof view === 'function') throw view();
        return view;
      } };
      const outcome = await resolvePeerReplyBundle({ provider, peerWallet: order[0], peerKeyId, peerWalletCandidates: order.slice(1), peerSignKey,
        onVerifiedWallet: async (address: string) => { verified = address; } }).then((bundle: any) => ({ keyId: bundle.keyId }), (error: any) => ({ error }));
      return { asked, verified, ...outcome } as any;
    };
    expect(await walk({ [M]: copied, [V]: genuine }, [M, V], pin)).toMatchObject({ asked: [M, V], verified: V, keyId: peerKeyId });
    const failed = await walk({ [V]: timedOut, [M]: copied }, [V, M], pin);
    expect([failed.asked, failed.verified, failed.error?.code]).toEqual([[V], null, 'QUEUE_TIMEOUT']);
    const failedLegacy = await walk({ [V]: timedOut, [M]: copied }, [V, M], null);
    expect([failedLegacy.asked, failedLegacy.verified, failedLegacy.error?.code]).toEqual([[V], null, 'QUEUE_TIMEOUT']);
    const beside = await walk({ [V]: timedOut, [M]: absent }, [V, M], pin);
    expect(beside.error?.code).toBe('QUEUE_TIMEOUT');
    expect(await walk({ [M]: absent, [V]: genuine }, [M, V], pin)).toMatchObject({ asked: [M, V], verified: V });
    const onlyCopy = await walk({ [M]: copied }, [M], pin);
    expect([onlyCopy.verified, onlyCopy.error?.code]).toEqual([null, RECIPIENT_NOT_ACTIVATED]);
    expect((await walk({ [M]: copied, [V]: absent }, [M, V], pin)).error?.code).toBe(RECIPIENT_NOT_ACTIVATED);

    const chosen = await resolveRecipientByWallet({ provider: { getView: async () => copied }, wallet: M });
    expect([chosen.bundle.keyId, chosen.signKey]).toEqual([peerKeyId, hexOf(copier.signingPublicKey)]);

    const store = createMemoryConvKeyStore();
    const onIntro = createIntroReceiveHandler({ recipientKeyPair: me.encryptionKeyPair, convKeyStore: store });
    const intro = await createEncryptedIntroCapsule(exportPublicKeyBundle(me.encryptionKeyPair), victim, {});
    const opened = await onIntro(asScanCapsule(intro, 1_790_000_000, M, [M, V]));
    const record = store.getConversation(me.encryptionKeyPair.keyId, opened.senderKeyId);
    expect(record.peerWallet, 'the copy\'s publisher was recorded').toBe(M);
    expect(record.peerSignPublicKey, 'the key the INTRO is signed under — the same in every copy of its bytes').toBe(pin);
    const reply = await walk({ [M]: copied, [V]: genuine }, [record.peerWallet, ...record.peerWalletCandidates], record.peerSignPublicKey);
    expect(reply.verified).toBe(V);
    const flaky = await walk({ [M]: copied, [V]: timedOut }, [record.peerWallet, ...record.peerWalletCandidates], record.peerSignPublicKey);
    expect([flaky.verified, flaky.error?.code], 'never the copier, whatever fails').toEqual([null, 'QUEUE_TIMEOUT']);
  }, 60_000);

  it('R153-05 (C3-1; C3-3): the app hands the kept key to every walk, drops a capsule that states another, learns it where none is kept, and refuses a first contact to copied keys', () => {
    const naming = code(fn('async function resolveInboundPeerWalletIdentity(thread, claimedUsername = null) {'));
    expect(naming).toContain('peerSignKey: rec?.peerSignPublicKey ?? null,');
    const reply = code(fn('async function attemptConvMessagePublishDirect(context, owner = undefined) {'));
    expect(reply).toContain('peerSignKey: rec.peerSignPublicKey ?? null,');
    const pass = code(fn('async function syncConvCapsulesFromShards(options = {}) {'));
    expect(pass).toContain('let peerSignKey = signKeyHex(store.getConversation(selfKeyId, peerKeyId)?.peerSignPublicKey);');
    expect(pass, 'my own copies are not the peer\'s').toMatch(/if \(!ownCopies\) \{\s*const stated = signKeyHex\(opened\.senderSigningPublicKey\);\s*if \(peerSignKey && stated !== peerSignKey\) \{ skipped \+= 1; continue; \}/);
    expect(pass).toMatch(/if \(!peerSignKey && stated && !tornDown\(\)\) \{\s*peerSignKey = stated;\s*try \{ await store\.pinPeerSignKey\(selfKeyId, peerKeyId, stated, \{ persist: false \}\); \}/);
    expect(pass.indexOf('const stated = signKeyHex(opened.senderSigningPublicKey);')).toBeGreaterThan(pass.indexOf('opened = await openPrivateCapsuleChainEntry(found.entry, keyPair, openOptions);'));
    expect(pass.indexOf('const stated = signKeyHex(opened.senderSigningPublicKey);')).toBeLessThan(pass.indexOf('collected.push({ opened, entry:'));

    const first = code(fn('async function attemptIntroFirstContactDirect(context, owner = undefined) {'));
    expect(first).toContain('const { bundle, signKey: shardSignKey } = await resolveRecipientByWallet({ provider, wallet: peerWallet, callOptions: criticalChainReadOptions() });');
    expect(first).toContain('if (heldSignKey && shardSignKey && heldSignKey !== shardSignKey) throw peerKeysCopiedError();');
    expect(first).toContain('const peerSignKey = shardSignKey;');
    expect(first).toContain('...(peerSignKey ? { peerSignKey } : {}),');
    expect(first).toContain('peerSignPublicKey: sendState.peerSignKey ?? null,');
    expect(code(read('web/intro-receive-handler.mjs'))).toContain('peerSignPublicKey: opened.senderSigningPublicKey ?? null,');

    expect(pass).toContain('const backdated = !ownCopies && Number.isFinite(signedAtMs) && Number.isFinite(shardDay) && signedAtMs < (shardDay - 1) * CONV_EPOCH_SECONDS * 1000;');
    expect(pass).toMatch(/if \(backdated\) \{\s*const chainStamp = Number\(found\.createdAt\);\s*collected\[collected\.length - 1\]\.entry\.created_at = Number\.isFinite\(chainStamp\) && chainStamp > 0 \? Math\.trunc\(chainStamp\) : shardDay \* CONV_EPOCH_SECONDS;/);
    const DAY = 86_400;
    const order = lift({ privateEntryIdText: (entry: any) => (entry?.entry_id == null ? null : String(entry.entry_id)) },
      [fn('function privateEntryCreatedAtMs(entry) {'), fn('function capsuleSenderCreatedAtMs(carrier) {'), fn('function privateChainMessageOrderFields(entry, opened = null) {')],
      'privateChainMessageOrderFields');
    const collectedEntry = (signedAtMs: number, epoch: number, chainSec: number | null, ownCopies = false) => {
      const found = { seq: '7', epoch, createdAt: chainSec };
      const backdated = !ownCopies && Number.isFinite(signedAtMs) && Number.isFinite(Number(found.epoch)) && signedAtMs < (Number(found.epoch) - 1) * DAY * 1000;
      return { entry_id: found.seq, address: '0:shard',
        ...(backdated ? { created_at: Number.isFinite(Number(found.createdAt)) && Number(found.createdAt) > 0 ? Math.trunc(Number(found.createdAt)) : Number(found.epoch) * DAY } : {}) };
    };
    const epoch = 20_767;
    const honest = (epoch * DAY + 3600) * 1000;
    const signed = (ms: number) => ({ capsule: { header1: { createdAt: ms } } });
    expect(order(collectedEntry(honest, epoch, epoch * DAY + 3605), signed(honest)).createdAtMs, 'an honest stamp is kept as signed').toBe(honest);
    expect(order(collectedEntry((epoch - 1) * DAY * 1000, epoch, epoch * DAY + 5), signed((epoch - 1) * DAY * 1000)).createdAtMs, 'the day before: the shard takes it').toBe((epoch - 1) * DAY * 1000);
    const y2001 = Date.parse('2001-01-01T00:00:00Z');
    expect(order(collectedEntry(y2001, epoch, epoch * DAY + 3605), signed(y2001)).createdAtMs, 'dated years back: the chain\'s stamp').toBe((epoch * DAY + 3605) * 1000);
    expect(order(collectedEntry(y2001, epoch, null), signed(y2001)).createdAtMs, 'no stamp on the row: the shard\'s day').toBe(epoch * DAY * 1000);
  });

  it('R153-06 (C4-1): a refused envelope carrying an accepted publish under a payer that shares the tag does not re-label the row; a real vault\'s does count', async () => {
    const cell = (fill: number) => beginCell().storeBuffer(Buffer.alloc(48, fill)).endCell();
    const publish = (header: any, body: any) => beginCell().storeUint(0x50535031, 32).storeUint(0, 8).storeUint(0n, 256).storeUint(0, 32).storeRef(header).storeRef(body).endCell();
    const envelope = (payer: string, record: any) => beginCell().storeUint(M21C_VAULT_PUBLISH_OPCODE, 32).storeCoins(1_000_000n).storeAddress(Address.parseRaw(payer)).storeRef(record).endCell();
    const alice = wallet('a7');
    const ghost = `0:${(BigInt(`0x${'a7'.repeat(32)}`) ^ (1n << 255n)).toString(16).padStart(64, '0')}`;
    expect(publisherTagOf(ghost)).toBe(publisherTagOf(alice));
    const carol = wallet('c3');
    const carolVault = await feeVaultAddress(feeVaultCodeBoc(), carol);
    expect(await feeVault.feeVaultAddress(feeVaultCodeBoc(), carol), 'one derivation, wherever it is asked').toBe(carolVault);
    const stranger = wallet('5e');
    const [h0, b0, h1, b1] = [cell(1), cell(2), cell(3), cell(4)];
    const rows = [
      { entry_id: 0n, created_at: 1_790_000_000n, body_commit: await publicBodyCommit(h0, b0), publisher_tag: publisherTagOf(alice), hidden: false },
      { entry_id: 1n, created_at: 1_790_000_100n, body_commit: await publicBodyCommit(h1, b1), publisher_tag: publisherTagOf(carol), hidden: false },
    ];
    const readWith = async (messages: any[]) => {
      const provider: any = createPublicShardTonRpcProvider({ transport: { runGetMethod: async () => { throw new Error('the page is given'); } } });
      provider.getPage = async (_address: string, _from: bigint, max: bigint) => ({ from_id: 0n, count: BigInt(max === 0n ? 0 : rows.length), entry_count: BigInt(rows.length), rows: max === 0n ? [] : rows });
      const { posts } = await provider.readPosts(wallet('d0'), { readMessagesWithSource: async () => messages });
      return Object.fromEntries(posts.map((post: any) => [Number(post.entry_id), post.publisher]));
    };
    const direct = { bodyCell: publish(h0, b0), source: alice, createdLt: '10' };
    const throughVault = { bodyCell: envelope(carol, publish(h1, b1)), source: carolVault, createdLt: '20' };
    expect(await readWith([throughVault, direct]), 'the honest pair').toEqual({ 0: alice, 1: carol });
    const forgedDirect = { bodyCell: envelope(ghost, publish(h0, b0)), source: stranger, createdLt: '30' };
    const forgedVault = { bodyCell: envelope(carol, publish(h1, b1)), source: stranger, createdLt: '31' };
    expect(await readWith([forgedVault, forgedDirect, throughVault, direct])).toEqual({ 0: alice, 1: carol });
    expect(await readWith([forgedVault, forgedDirect])).toEqual({});
    expect(code(read('web/public-shard-ton-rpc-provider.mjs'))).toContain('if (parsed.publisher && (await vaultOf(parsed.publisher)) !== source) continue;');
  });

  it('R153-07 (C4-2): a shard whose marker moved with no new entry is asked its count and nothing more; a new entry is read', async () => {
    const CLOCK = 1_790_000_000;
    const num = (v: bigint) => ({ type: 'num', value: `0x${BigInt(v).toString(16)}` });
    const toCoreCell = (c: any) => Cell.fromBase64(Buffer.from(serializeBoc(c)).toString('base64'));
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'r153-sink' });
    const channel = await bc.treasury('r153-channel');
    const partitionKey = await publicChannelPartitionKey(publicWalletHash(channel.address.toString()), 0);
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));
    const messages: Array<{ body: any; source: string }> = [];
    let dest: Address | null = null;
    const post = async (i: number) => {
      const payload = await createPublicPostPayloadV2({ type: 'post', text: `post #${i}`, streamId: i.toString(16).padStart(4, '0').repeat(8), createdAtSec: CLOCK + i });
      const built = await buildPublicPublishWalletMessage({ kind: 0, keyArg: 0n, header: payload.headerCell, body: payload.bodyCell,
        value: publicPublishValueForKind(0), partitionKey, epochTag, nowUnix: CLOCK });
      dest = Address.parseRaw(built.to);
      const initCore = toCoreCell(built.init);
      const sent = await channel.send({ to: dest, value: built.value, body: toCoreCell(built.body), init: { code: initCore.refs[0], data: initCore.refs[1] }, bounce: true } as any);
      const tx: any = sent.transactions.find((one: any) => one.inMessage?.info?.dest?.toString() === dest!.toString());
      expect(tx?.description?.computePhase?.exitCode ?? 0).toBe(0);
      messages.push({ body: built.body, source: channel.address.toString() });
    };
    for (let i = 0; i < 3; i += 1) await post(i);
    const shard = bc.openContract(PublicShard.fromAddress(dest!));
    const key = addrKey(dest!.toString());
    const asked = { pages: 0, counts: 0, messages: 0 };
    let marker = 1;
    const lane = createPublicLane({
      now: () => CLOCK, endpoint: 'https://x/api/v3/accountStates',
      runGetMethod: async (call: any) => {
        if (addrKey(call.address) !== key || call.method !== 'get_page') throw new Error(`unexpected ${call.method}`);
        const page = await shard.getGetPage(BigInt(call.stack[0].value), BigInt(call.stack[1].value));
        if (BigInt(call.stack[1].value) === 0n) asked.counts += 1; else asked.pages += 1;
        return { stack: [num(page.from_id), num(page.count), num(page.entry_count), ['cell', page.rows]] };
      },
      fetch: async (urlStr: string) => {
        const url = new URL(urlStr);
        if (url.pathname.endsWith('/accountStates')) {
          const accounts = url.searchParams.getAll('address').filter((a) => addrKey(a) === key)
            .map((a) => ({ address: addrKey(a), status: 'active', balance: '1000000', data_hash: 'h', last_transaction_lt: String(marker) }));
          return { ok: true, status: 200, json: async () => ({ accounts }) } as any;
        }
        if (url.pathname.endsWith('/messages')) {
          asked.messages += 1;
          const all = messages.map((m, i) => ({ source: m.source, created_lt: String(1_000 + i), created_at: null, message_content: { body: Buffer.from(serializeBoc(m.body)).toString('base64') } }));
          return { ok: true, status: 200, json: async () => ({ messages: [...all].reverse().slice(0, Number(url.searchParams.get('limit') ?? '128')) }) } as any;
        }
        throw new Error(`unexpected fetch ${urlStr}`);
      },
    });
    const texts = async () => (await lane.readChannelPosts(channel.address.toString()))
      .map((p: any) => readPublicPostPayloadV2({ header: p.header, body: p.body }).text).sort();
    expect(await texts(), 'the first read').toEqual(['post #0', 'post #1', 'post #2']);
    const cold = { ...asked };
    expect(cold.messages, 'the cold read took the bodies').toBeGreaterThan(0);
    expect(await texts()).toEqual(['post #0', 'post #1', 'post #2']);
    expect(asked).toEqual(cold);
    marker = 2;
    expect(await texts()).toEqual(['post #0', 'post #1', 'post #2']);
    expect([asked.counts - cold.counts, asked.pages - cold.pages, asked.messages - cold.messages]).toEqual([1, 0, 0]);
    const stood = { ...asked };
    expect(await texts()).toEqual(['post #0', 'post #1', 'post #2']);
    expect(asked).toEqual(stood);
    await post(3);
    marker = 3;
    expect(await texts()).toEqual(['post #0', 'post #1', 'post #2', 'post #3']);
    expect([asked.counts - stood.counts, asked.messages - stood.messages > 0, asked.pages - stood.pages > 0]).toEqual([1, true, true]);
    expect(code(read('web/public-lane.mjs'))).toMatch(/if \(stood\) \{\s*const hiddenNow = new Set\(\[\.\.\.map\.hidden\]\.map\(Number\)\);\s*for \(const \[id, row\] of rows\) \{\s*const hidden = hiddenNow\.has\(Number\(row\.entry_id\)\);\s*if \(\(hidden \|\| map\.complete\) && hidden !== \(row\.hidden === true\)\) rows\.set\(id, \{ \.\.\.row, hidden \}\);/);
  }, 120_000);

  it('R153-08 (C2-1; C6-1): Telegram is there only where the SDK has a door to it, and a Telegram link is not opened through the SDK outside it', () => {
    const sdk = (platform: string, initData = '') => ({ platform, initData, openTelegramLink: (href: string) => { calls.push(`sdk ${href}`); }, openLink: (href: string) => { calls.push(`sdk link ${href}`); } });
    const calls: string[] = [];
    const world = (windowLike: Record<string, any>) => {
      const window: any = { ...windowLike };
      if (!('parent' in window)) window.parent = window;
      return Object.assign(lift({ window, globalThis: window }, [fn('function telegramWebApp() {'), fn('function telegramBridgePresent() {'), 'let telegramEnvCache;', fn('function isTelegramEnv() {'),
        fn('function openExternalLinkInTelegram(href) {'), fn('function openTelegramDeepLink(href) {')], '{ isTelegramEnv, openTelegramDeepLink, telegramBridgePresent }'), { window });
    };
    expect(world({ Telegram: { WebApp: sdk('unknown') } }).isTelegramEnv()).toBe(false);
    const forged = world({ Telegram: { WebApp: sdk('android') }, external: {} });
    expect([forged.telegramBridgePresent(), forged.isTelegramEnv()]).toEqual([false, false]);
    expect(world({ Telegram: { WebApp: sdk('unknown', 'query_id=1') } }).isTelegramEnv(), 'launch data in the hash, no door').toBe(false);
    expect(world({ Telegram: { WebApp: sdk('android') }, TelegramWebviewProxy: { postEvent() {} } }).isTelegramEnv()).toBe(true);
    expect(world({ Telegram: { WebApp: sdk('weba') }, parent: {} }).isTelegramEnv(), 'a framed page').toBe(true);
    expect(world({ Telegram: { WebApp: sdk('windows_phone') }, external: { notify() {} } }).isTelegramEnv()).toBe(true);
    expect(world({ TelegramWebviewProxy: {} }).isTelegramEnv(), 'a door and no SDK').toBe(false);
    const late = world({ Telegram: { WebApp: sdk('ios') } });
    expect(late.isTelegramEnv()).toBe(false);
    late.window.TelegramWebviewProxy = { postEvent() {} };
    expect(late.isTelegramEnv(), 'the door arrived').toBe(true);
    const browser = world({ Telegram: { WebApp: sdk('unknown') } });
    expect(browser.isTelegramEnv()).toBe(false);
    browser.window.Telegram.WebApp.platform = 'android';
    browser.window.TelegramWebviewProxy = {};
    expect(browser.isTelegramEnv(), 'decided at the first look').toBe(false);
    expect(code(fn('function showOpenElsewhere({ locks, onUseHere, takeIfFree }) {'))).toContain('if (telegramBridgePresent() && globalThis.Telegram?.WebApp?.initData) {');
    expect(code(fn('function syncTelegramChromeColor() {'))).toContain('if (!tg || !telegramBridgePresent() || !(');

    calls.length = 0;
    expect(world({ Telegram: { WebApp: sdk('unknown') } }).openTelegramDeepLink('https://t.me/toncenter')).toBe(false);
    expect(forged.openTelegramDeepLink('https://t.me/toncenter'), 'nor in a tab a link dressed as Telegram').toBe(false);
    expect(calls).toEqual([]);
    expect(world({ Telegram: { WebApp: sdk('ios') }, TelegramWebviewProxy: {} }).openTelegramDeepLink('https://t.me/toncenter')).toBe(true);
    expect(calls).toEqual(['sdk https://t.me/toncenter']);
    expect(code(fn('function openToncenterBotLink() {'))).toMatch(/if \(openTelegramDeepLink\('https:\/\/t\.me\/toncenter'\)\) return;\s*try \{ globalThis\.open\?\.\('https:\/\/t\.me\/toncenter', '_blank', 'noopener'\); \}/);
  });

  it('R153-09 (C6-2): the swap window opens at once with the list held, and under a Buy with none; the read beside it brings the balances', async () => {
    const pairOf = (offer: any, ask: any) => ({ offer, ask, offerSide: 0 });
    const G = { id: GRAM, symbol: 'GRAM', decimals: 9 };
    const T = { id: 'TOK', symbol: 'TOK', decimals: 9 };
    const U = { id: 'NEW', symbol: 'NEW', decimals: 9 };
    const pairs = { [GRAM]: [pairOf(G, T)], TOK: [pairOf(T, G)], NEW: [pairOf(U, G)] };
    const make = (tokens: any, offers: any[]) => {
      let land: () => void = () => {};
      const waited: string[] = [];
      const offered: string[][] = [];
      let now = offers;
      const w = swapWorld({ offers, pairs, env: {
        walletSwapPickerItems: (side: string, list: any[]) => { if (side === 'give') offered.push(list.map((offer) => offer.id)); return []; },
        walletAssetsState: { at: new Map([['tokens', 1]]), tokens },
        loadWalletAssets: () => new Promise<void>((resolve) => { land = resolve; }),
        whileWalletTileBusy: async (_tile: any, work: () => any) => { waited.push('tile'); await work(); return true; },
        walletSwapOffers: () => now,
      } });
      return { w, waited, offered, land: () => land(), offersNow: (next: any[]) => { now = next; } };
    };
    const gramOffer = () => ({ id: GRAM, symbol: 'GRAM', decimals: 9, balance: null });
    const tokOffer = (balance: bigint) => ({ id: 'TOK', symbol: 'TOK', decimals: 9, balance });

    const held = make([], [gramOffer(), tokOffer(5_000_000_000n)]);
    void held.w.open('TOK');
    await held.w.settle();
    expect([held.waited, Boolean(held.w.dialog())], 'a Sell with the list held').toEqual([[], true]);
    held.w.tiles().max.click();
    expect(held.w.tiles().input.value, 'the balance as held').toBe('5');
    held.offersNow([gramOffer(), tokOffer(2_000_000_000n), { id: 'NEW', symbol: 'NEW', decimals: 9, balance: 1n }]);
    held.land();
    await held.w.settle();
    held.w.tiles().max.click();
    expect(held.w.tiles().input.value, 'MAX after the read').toBe('2');
    held.w.tiles().givePick.click();
    expect(held.offered, 'the give list as the window holds it').toEqual([[GRAM, 'TOK', 'NEW']]);
    const gone = make([], [gramOffer(), tokOffer(5_000_000_000n)]);
    void gone.w.open('TOK');
    await gone.w.settle();
    gone.offersNow([gramOffer()]);
    gone.land();
    await gone.w.settle();
    gone.w.tiles().max.click();
    expect([gone.w.tiles().input.value, gone.w.notices], 'sold elsewhere meanwhile: MAX fills nothing and says so').toEqual(['', ['wallet.tokenNotEnough']]);

    const buy = make(null, [gramOffer()]);
    void buy.w.open(GRAM, undefined, 'TOK');
    await buy.w.settle();
    expect([buy.waited, Boolean(buy.w.dialog())], 'a Buy with no list yet').toEqual([[], true]);
    const tile = make(null, [gramOffer()]);
    void tile.w.open(null);
    await tile.w.settle();
    expect([tile.waited, Boolean(tile.w.dialog())], 'the tile waits for the first read').toEqual([['tile'], false]);
    tile.land();
    await tile.w.settle();
    expect(Boolean(tile.w.dialog())).toBe(true);
  });

  it('R153-10 (C7-1; C7-4): a menu opened from the keyboard takes the focus, a pointer\'s press moves nothing; the tab in use is said', () => {
    const focus = lift({}, [fn('function focusOpenedPopover(popover, anchor) {')], 'focusOpenedPopover');
    const item = { focused: 0, focus(options: any) { this.focused += 1; expect(options).toEqual({ preventScroll: true }); } };
    const popover = { asked: [] as string[], querySelector(selector: string) { this.asked.push(selector); return item; } };
    focus(popover, { matches: (selector: string) => selector === ':focus-visible' });
    expect([item.focused, popover.asked]).toEqual([1, ['button:not([disabled])']]);
    focus(popover, { matches: () => false });
    focus(popover, { matches: () => { throw new Error('no such selector here'); } });
    focus({ querySelector: () => null }, { matches: () => true });
    expect(item.focused).toBe(1);
    for (const start of ['function showPopoverAt(popover, anchor) {', 'async function showChannelDescriptionPopover(authorWallet, anchor, options = {}) {', 'function renderDisplayAsPopover({']) {
      expect(code(fn(start)), start).toMatch(/anchor\.setAttribute\('aria-expanded', 'true'\);\s*focusOpenedPopover\(popover, anchor\);/);
    }
    expect(code(fn('async function showChannelDescriptionPopover(authorWallet, anchor, options = {}) {')))
      .toMatch(/renderBody\(resolved\);\s*positionIdentityPopover\(popover, anchor\);\s*if \(document\.activeElement === anchor\) focusOpenedPopover\(popover, anchor\);/);
    expect(code(app)).toMatch(/item\.classList\.toggle\('is-active', active\);\s*if \(active\) item\.setAttribute\('aria-current', 'page'\);\s*else item\.removeAttribute\('aria-current'\);/);
    const rail = read('web/index.html').split('<button class="rail-item ').slice(1).map((item) => item.slice(0, item.indexOf('>')));
    expect(rail.filter((item) => item.includes('aria-current="page"')).length).toBe(1);
    expect(rail.find((item) => item.includes('aria-current="page"'))).toContain('is-active');
  });

  it('R153-11 (C8-1): the boot screen waits out one large file, and comes down by itself when the app says it is up', () => {
    const guard = read('web/boot-guard.js');
    const boot = () => {
      let nowMs = 0;
      let seq = 0;
      const timers: Array<{ id: number; at: number; every: number; run: () => void }> = [];
      const attrs = new Map<string, string>();
      const element = (): any => ({ style: {}, children: [] as any[], parentNode: null as any, listeners: {} as Record<string, () => void>, textContent: '', id: '', type: '',
        appendChild(child: any) { child.parentNode = this; this.children.push(child); return child; },
        removeChild(child: any) { this.children = this.children.filter((one: any) => one !== child); child.parentNode = null; return child; },
        addEventListener(name: string, handler: () => void) { this.listeners[name] = handler; } });
      const body = element();
      const windowListeners: Record<string, () => void> = {};
      let observed: ((list: any) => void) | null = null;
      const document: any = { readyState: 'loading', body, createElement: () => element(),
        documentElement: { style: { setProperty() {} }, getAttribute: (name: string) => attrs.get(name) ?? null, setAttribute: (name: string, value: string) => { attrs.set(name, value); } } };
      const window: any = { addEventListener: (name: string, handler: () => void) => { windowListeners[name] = handler; }, location: { reload() {} }, performance: { getEntriesByType: () => [] } };
      class PerformanceObserver { constructor(callback: (list: any) => void) { observed = callback; } observe() {} }
      const DateAt: any = { now: () => nowMs };
      const setTimeoutAt = (run: () => void, ms: number) => { seq += 1; timers.push({ id: seq, at: nowMs + ms, every: 0, run }); return seq; };
      const setIntervalAt = (run: () => void, ms: number) => { seq += 1; timers.push({ id: seq, at: nowMs + ms, every: ms, run }); return seq; };
      const clearAt = (id: number) => { const at = timers.findIndex((one) => one.id === id); if (at >= 0) timers.splice(at, 1); };
      // eslint-disable-next-line no-new-func
      new Function('localStorage', 'document', 'window', 'navigator', 'PerformanceObserver', 'performance', 'Date', 'setTimeout', 'setInterval', 'clearInterval', 'clearTimeout', guard)(
        { getItem: () => null }, document, window, { userAgent: 'test' }, PerformanceObserver, window.performance, DateAt, setTimeoutAt, setIntervalAt, clearAt, clearAt);
      const advance = (ms: number) => {
        const until = nowMs + ms;
        for (;;) {
          const next = timers.filter((one) => one.at <= until).sort((a, b) => a.at - b.at || a.id - b.id)[0];
          if (!next) break;
          nowMs = next.at;
          if (next.every > 0) next.at += next.every; else clearAt(next.id);
          next.run();
        }
        nowMs = until;
      };
      const screen = () => body.children.find((one: any) => one.id === 'plathoBootGuard') ?? null;
      return { advance, screen, finish: () => observed?.({ getEntries: () => [{}] }), mark: (state: string) => attrs.set('data-platho-app-js', state),
        loaded: () => { document.readyState = 'complete'; windowListeners.load?.(); } };
    };
    const slow = boot();
    slow.advance(500); slow.finish();
    slow.advance(40_000);
    expect(slow.screen(), 'forty seconds of one file arriving is not a stall').toBeNull();
    slow.mark('ready'); slow.loaded();
    slow.advance(120_000);
    expect(slow.screen()).toBeNull();
    const hung = boot();
    hung.advance(500); hung.finish();
    hung.advance(44_000);
    expect(hung.screen()).toBeNull();
    hung.advance(4_000);
    expect(hung.screen(), 'said within 45 s and a tick of the last file').not.toBeNull();
    hung.mark('ready');
    hung.advance(600);
    expect(hung.screen(), 'taken down within its half second').toBeNull();
    const dribble = boot();
    for (let s = 0; s < 170; s += 10) { dribble.advance(10_000); dribble.finish(); }
    expect(dribble.screen()).toBeNull();
    dribble.advance(12_000);
    expect(dribble.screen()).not.toBeNull();
    const dismissed = boot();
    dismissed.advance(60_000);
    const shown = dismissed.screen();
    shown.children.find((one: any) => one.textContent === 'Continue').listeners.click();
    expect(dismissed.screen()).toBeNull();
    dismissed.mark('ready');
    dismissed.advance(5_000);
    expect(dismissed.screen()).toBeNull();
    expect(guard).toMatch(/var STALL_MS = 45000;/);
    expect(guard).toMatch(/var HARD_CAP_MS = 180000;/);
  });

  it('R153-12 (C8-2): the message loop is armed at the delay asked for, whatever the provider\'s state', () => {
    let armedFor: number | null = null;
    const schedule = lift({
      MESSAGE_AUTO_SYNC_MS: 60_000, clearMessageAutoSyncTimer: () => {}, pageOnScreen: () => true, scheduleMessageAutoSyncCountdownUi: () => {},
      messageAutoSyncLastErrorLabel: '', messageAutoSyncLastResult: null, messageAutoSyncPhase: '', messageAutoSyncAt: 0, messageAutoSyncTimer: null,
      window: { setTimeout: (_run: () => void, ms: number) => { armedFor = ms; return 1; } },
      globalThis: { plathoTonRpcTransport: { isDegraded: () => true } },
    }, [fn('function scheduleMessageAutoSync(delayMs = MESSAGE_AUTO_SYNC_MS) {')], 'scheduleMessageAutoSync');
    schedule(12_000);
    expect(armedFor, 'a parked provider no longer stretches it to three minutes').toBe(12_000);
    schedule(2_000);
    expect(armedFor).toBe(2_000);
    schedule();
    expect(armedFor).toBe(60_000);
    schedule(10);
    expect(armedFor, 'the one-second floor stays').toBe(1_000);
    expect(app).not.toContain('MESSAGE_AUTO_SYNC_DEGRADED_MS');
    expect(code(fn('function scheduleMessageAutoSync(delayMs = MESSAGE_AUTO_SYNC_MS) {'))).not.toContain('isDegraded');
  });

  it('R153-13 (C1-2; C1-3): a .ton name the chain answered for is told as an answer; an address in the standard base64 alphabet is the same address', async () => {
    const slice = (bytes: number[]) => beginCell().storeBuffer(Buffer.from(bytes)).endCell();
    const next = (address: string) => ({ type: 'cell', value: beginCell().storeUint(0xba93, 16).storeAddress(Address.parseRaw(address)).endCell().toBoc().toString('base64') });
    const walletRecord = (address: string) => ({ type: 'cell', value: beginCell().storeUint(0x9fd3, 16).storeAddress(Address.parseRaw(address)).storeUint(0, 8).endCell().toBoc().toString('base64') });
    void slice;
    const ROOT = wallet('01');
    const COLLECTION = wallet('02');
    const ITEM = wallet('03');
    const provider = (item: () => any) => createTonDnsProvider({ rootAddress: ROOT, transport: { runGetMethod: async (call: any) => {
      if (call.address === ROOT) return { stack: [{ type: 'num', value: '0x18' }, next(COLLECTION)] };
      if (call.address === COLLECTION) return { stack: [{ type: 'num', value: '0x38' }, next(ITEM)] };
      return item();
    } } });
    await expect(provider(() => ({ stack: [{ type: 'num', value: '0x8' }, { type: 'list', value: [] }] })).resolveWallet('wallet.ton')).rejects.toMatchObject({ code: TON_DNS_NO_WALLET });
    await expect(provider(() => ({ stack: [{ type: 'num', value: '0x8' }, { type: 'null' }] })).resolveWallet('wallet.ton')).rejects.toMatchObject({ code: TON_DNS_NO_WALLET });
    await expect(provider(() => { throw Object.assign(new Error('TON RPC get-method exit code -13'), { exitCode: -13 }); }).resolveWallet('wallet.ton')).rejects.toMatchObject({ code: TON_DNS_NOT_REGISTERED });
    const failed = await provider(() => { throw Object.assign(new Error('HTTP 503'), { status: 503 }); }).resolveWallet('wallet.ton').catch((error: any) => error);
    expect([failed.code, failed.status]).toEqual([undefined, 503]);
    expect(await provider(() => ({ stack: [{ type: 'num', value: '0x8' }, walletRecord(wallet('0d'))] })).resolveWallet('wallet.ton')).toBe(wallet('0d'));
    const told = lift({ UsernameNotRegisteredError: class extends Error {}, TON_DNS_NOT_REGISTERED, TON_DNS_NO_WALLET, console: { error() {} },
      t: (key: string, vars?: any) => `${key}${vars?.name ? `(${vars.name})` : ''}` }, [fn('function transferRecipientError(error, entered) {')], 'transferRecipientError');
    expect(told({ code: TON_DNS_NOT_REGISTERED }, 'nobody.ton')).toBe('chat.usernameNotRegistered(nobody.ton)');
    expect(told({ code: TON_DNS_NO_WALLET }, 'wallet.ton')).toBe('wallet.ton: wallet.statusNoWallet');
    expect(told(new Error('HTTP 503'), 'wallet.ton'), 'a failed lookup is still asked again').toBe('username.recipientUnresolved(wallet.ton)');

    const urlSafe = Address.parseRaw(`0:${'fb'.repeat(16)}${'ef'.repeat(16)}`).toString({ urlSafe: true, bounceable: false });
    const standard = Address.parseRaw(`0:${'fb'.repeat(16)}${'ef'.repeat(16)}`).toString({ urlSafe: false, bounceable: false });
    expect(/[+/]/.test(standard), 'the fixture has a + or a / in it').toBe(true);
    expect(parseRecipientIdentity(standard)).toEqual({ ok: true, identity: { type: 'wallet_address', value: urlSafe, label: urlSafe, entered: standard } });
    expect(parseRecipientIdentity(urlSafe).identity.value).toBe(urlSafe);
    expect(parseRecipientIdentity(`${standard.slice(0, 20)}-${standard.slice(21)}`).ok, 'the two alphabets mixed are no address').toBe(/[+/]/.test(`${standard.slice(0, 20)}${standard.slice(21)}`) ? false : true);
  });

  it('R153-14 (C2-2; C2-3; C5-3; C7-11): the shell is kept only where the answer is the shell; an animated picture is not drawn; dollars only at a fresh rate; comments say what the code does', () => {
    const sw = read('web/sw.js');
    expect(code(sw)).toContain('if (!(await cachedAppShell()) && await isAppShell(response)) await cacheSameOrigin(appShellCacheRequest(), response);');
    expect(code(sw)).toMatch(/async function isAppShell\(response\) \{\s*try \{\s*return \(await response\.clone\(\)\.text\(\)\)\.includes\('id="bootScreen"'\);/);
    expect(read('web/index.html')).toContain('id="bootScreen"');
    for (const page of ['web/privacy.html', 'web/terms.html']) expect(read(page), page).not.toContain('id="bootScreen"');

    const size = lift({}, [fn('function webpCanvasSize(bytes) {')], 'webpCanvasSize');
    const vp8x = (flags: number) => {
      const bytes = new Uint8Array(30);
      bytes.set([...'RIFF'].map((ch) => ch.charCodeAt(0)), 0);
      bytes.set([...'WEBP'].map((ch) => ch.charCodeAt(0)), 8);
      bytes.set([...'VP8X'].map((ch) => ch.charCodeAt(0)), 12);
      bytes[20] = flags;
      bytes[24] = 99; bytes[27] = 49;
      return bytes;
    };
    expect(size(vp8x(0x00))).toEqual({ width: 100, height: 50 });
    expect(size(vp8x(0x10)), 'an alpha flag is no animation').toEqual({ width: 100, height: 50 });
    expect(size(vp8x(0x02)), 'the animation bit: no size, and so the empty pixel').toBeNull();
    expect(size(vp8x(0x12))).toBeNull();

    expect(code(fn('function openWalletNftListing(listing, { back = null } = {}) {')))
      .toContain('const gramPerUsd = usdRead && Date.now() - usdRead.at < 2 * WALLET_MARKET_REFRESH_MS ? walletMarketPrice(usdRoute) : null;');

    const html = read('web/index.html');
    const comments = [...html.matchAll(/<!--[\s\S]*?-->/g)].map((match) => match[0]).join('\n');
    expect(comments).not.toMatch(/\(owner\)|\[owner\b|\bowner:|\bhe (?:disliked|asked|said|wanted)\b|\bwas reported\b/i);
  });

  it('R153-15 (C8-3; C8-4; C8-5; C8-6; C8-7; C8-8; C6-15): what an idle app asks twice, it asks once', async () => {
    const transport = read('web/ton-rpc-transport.mjs');
    expect(code(transport)).toMatch(/tonRpcErrorIsUninitializedAccount\(error\)\s*&& call\?\.stopOnUninitializedAccount !== false && requestOptions\.stopOnUninitializedAccount !== false\s*\) \{\s*throw error;/);
    const drain = code(sourceBlock(transport, 'async function drainToncenterRequestQueue(state) {'));
    expect(drain).toMatch(/logged\.end = String\(response\?\.status \?\? ''\);\s*state\.nextAt = monotonicNow\(\) \+ spacingMs;/);
    expect(drain.match(/state\.nextAt = /g)?.length, 'set in one place').toBe(1);

    const asked: any[] = [];
    const registryProvider = { getUsernameItemAddress: async (hash: any) => { asked.push(hash); return wallet('1e'); } };
    const itemProvider = (nameHash: bigint) => ({ getState: async () => ({ initialized: true, owner_wallet: wallet('0a'), username_registry_address: wallet('4e'), name_hash: nameHash }) });
    const proof = await resolveAuthoritativeUsernameItemOwnership({ registryProvider, itemProvider: itemProvider(77n), itemAddress: wallet('1e'), registryAddress: wallet('4e'),
      derived: { nameHash: 77n, itemAddress: wallet('1e') } });
    expect([proof.authoritative, proof.owner_wallet, asked]).toEqual([true, wallet('0a'), []]);
    await resolveAuthoritativeUsernameItemOwnership({ registryProvider, itemProvider: itemProvider(78n), itemAddress: wallet('1e'), derived: { nameHash: 77n, itemAddress: wallet('1e') } });
    await resolveAuthoritativeUsernameItemOwnership({ registryProvider, itemProvider: itemProvider(77n), itemAddress: wallet('1e'), derived: { nameHash: 77n, itemAddress: wallet('2f') } });
    await resolveAuthoritativeUsernameItemOwnership({ registryProvider, itemProvider: itemProvider(77n), itemAddress: wallet('1e') });
    expect(asked).toEqual([78n, 77n, 77n]);
    expect(code(fn('async function resolvePlathoUsernameOwner(label, { readOptions = null } = {}) {'))).toContain('derived: { nameHash, itemAddress },');

    let reads = 0;
    let nowMs = 1_000_000;
    const recent = lift({ requireAthMasterAddress: () => 'MASTER', Date: { now: () => nowMs } },
      ['const ATH_WALLET_ADDRESS_FRESH_MS = 60_000;', 'const recentAthWalletAddresses = new Map();', 'const sessionAthWalletAddresses = new Map();',
        fn('function recentAthWalletAddress(owner, read, { shown = false } = {}) {')], 'recentAthWalletAddress');
    const readAddress = async () => { reads += 1; return 'ATH-WALLET'; };
    expect(await recent('OWNER', readAddress, { shown: true })).toBe('ATH-WALLET');
    await settle();
    nowMs += 10 * 60_000;
    expect(await recent('OWNER', readAddress, { shown: true }), 'ten minutes on: not asked again').toBe('ATH-WALLET');
    expect(reads).toBe(1);
    expect(await recent('OWNER', readAddress), 'a transaction past its minute asks').toBe('ATH-WALLET');
    expect(reads).toBe(2);
    expect(await recent('ANOTHER', readAddress, { shown: true })).toBe('ATH-WALLET');
    expect(reads, 'another wallet has its own').toBe(3);
    expect(code(fn('async function refreshVaultNavBalanceInBackground(options = {}) {'))).toContain('await loadConnectedAthWalletBalance({ priority, shown: true })');
    expect(code(fn('async function assertConnectedAthAtLeast(')), 'a check before a signature keeps its fresh minute').not.toContain('shown: true');

    expect(code(read('web/sw.js'))).toContain("await cache.add(versioned ? asset : new Request(asset, { cache: 'reload' }));");
    expect(code(app)).toMatch(/const sinceRefresh = Date\.now\(\) - vaultRefreshStartedAt;\s*if \(sinceRefresh >= 0 && sinceRefresh < VAULT_FOCUS_REFRESH_FLOOR_MS\) \{\s*scheduleVaultAutoRefresh\(Math\.max\(1_000, VAULT_FOCUS_REFRESH_FLOOR_MS - sinceRefresh\)\);\s*return;/);
    expect(code(fn('async function refreshVaultNow({ includeActivation = false, includeStats = false } = {}) {'))).toContain('vaultRefreshStartedAt = Date.now();');
    const backup = code(fn('async function backupGroupsIfNeeded() {'));
    expect(backup).toContain('if (Date.now() < groupsBackupNotBefore && groupsBackupWaitsFor === setOf(current().entries) && !toppedUp) return;');
    expect(backup).toMatch(/\} catch \(error\) \{\s*sent = true;[^\n]*\n\s*if \(!broadcastMayHaveLanded\(error\)\) throw error;[^\n]*\n\s*\}\s*sent = true;/);
    expect(backup).toMatch(/if \(written \|\| \(!sent && !short\)\) groupsBackupFailures = 0;\s*else \{\s*groupsBackupFailures \+= 1;\s*groupsBackupNotBefore = Date\.now\(\) \+ GROUPS_BACKUP_RETRY_MS\[Math\.min\(groupsBackupFailures, GROUPS_BACKUP_RETRY_MS\.length\) - 1\];/);
    expect(code(app)).toMatch(/groupsBackupNotBefore = 0;\s*void backupGroupsIfNeeded\(\)\.catch\(/);
    const clock = { t: 1_800_000_000_000 };
    const box = { allowed: true, stored: [] as any[], inFlight: false, notBefore: 0, failures: 0, waitsFor: '', shortAt: null as any, latchAt: 0 };
    const events: string[] = [];
    const chain = { confirms: false, refuses: false, short: false, alreadyWritten: false, readClean: true };
    const pocket = { wallet: { ton_balance: 1_000n } };
    const self = { address: wallet('a'), seed: 'seed' };
    const backupRun = lift({
      box, Date: { now: () => clock.t }, plathoWallet: self, groupRuntimeInstance: { list: () => [{ id: 'g1' }] }, publicGroupRuntimeInstance: null,
      groupsRecoveryEntries: (records: any[]) => records.map((r) => ({ g: r.id })), isPublicGroupRecoveryEntry: () => false,
      groupsRecoveryOverflowIds: new Set(), groupsRecoveryIsStale: (comparable: any[], stored: any[]) => JSON.stringify(comparable) !== JSON.stringify(stored),
      globalThis: { plathoTonRpcTransport: { runGetMethod: async () => ({}) } },
      readSelfSlotLedger: async () => { events.push('read'); return { trusted: true }; },
      restoreGroupsFromRecoveryIfFresh: async () => {
        events.push('restore');
        box.allowed = chain.readClean;
        if (chain.alreadyWritten) box.stored = [{ g: 'g1' }];
      },
      vaultPocketState: pocket,
      packGroupsForRecovery: async (_seed: any, entries: any[]) => ({ chunks: [entries], overflow: [] }), GROUPS_NAMED_SLOT_COUNT: 1, console: { warn: () => {} },
      createRecoveryViewReader: () => async () => null, requireBasechainAddress: () => {}, requirePlathoWalletAddress: () => self.address,
      prepareGroupsBackup: async () => { if ((chain as any).refuseRead) throw new Error('HTTP 429'); return { to: wallet('b'), value: 1n, seq: 1n, body: {}, init: null }; },
      RECOVERY_PUBLISH_VALUE: 1n, LANE_RECOVERY: 'recovery',
      shardArrearOf: async () => 0n, assertWalletGramAtLeast: async () => { if (chain.short) throw new Error('short'); },
      walletSendFeeReserveNanotons: () => 0n, walletSendSizeClassForPayloadBytes: () => 1,
      tonCell: { serializeBoc: () => new Uint8Array(1), bytesToBase64: () => '' },
      sendPlathoWalletTransaction: async () => { events.push('send'); if (chain.refuses) throw new Error('refused'); }, broadcastMayHaveLanded: () => false,
      confirmRecoverySlotWrite: async () => chain.confirms, noteChatKeysBackupShortfall: () => {}, clearChatKeysBackupShortfall: () => {},
      GROUPS_BACKUP_RETRY_MS: [30_000, 60_000, 2 * 60_000, 5 * 60_000, 15 * 60_000],
    }, [fn('async function backupGroupsIfNeeded() {').replace(/\bgroupsBackupAllowed\b/g, 'box.allowed').replace(/\bgroupsRecoveryStored\b/g, 'box.stored')
      .replace(/\bgroupsBackupInFlight\b/g, 'box.inFlight').replace(/\bgroupsBackupNotBefore\b/g, 'box.notBefore').replace(/\bgroupsBackupFailures\b/g, 'box.failures')
      .replace(/\bgroupsBackupWaitsFor\b/g, 'box.waitsFor').replace(/\bgroupsBackupShortBalance\b/g, 'box.shortAt').replace(/\bgroupsBackupLatchAskedAt\b/g, 'box.latchAt')],
    'backupGroupsIfNeeded');
    const passEvents = () => events.filter((event) => event !== 'restore');
    const waits: number[] = [];
    for (let pass = 0; pass < 6; pass += 1) {
      events.length = 0;
      chain.refuses = pass === 1;
      // eslint-disable-next-line no-await-in-loop
      await backupRun().catch(() => {});
      expect(passEvents(), 'a pass whose turn it is reads and sends').toEqual(['read', 'send']);
      waits.push(box.notBefore - clock.t);
      events.length = 0;
      clock.t = box.notBefore - 1;
      // eslint-disable-next-line no-await-in-loop
      await backupRun();
      expect(passEvents(), 'inside the wait: nothing read, nothing sent').toEqual([]);
      clock.t = box.notBefore;
    }
    expect(waits).toEqual([30_000, 60_000, 120_000, 300_000, 900_000, 900_000]);
    chain.short = true;
    await backupRun().catch(() => {});
    expect([box.failures, passEvents(), box.notBefore - clock.t], 'a pass the balance could not pay climbs').toEqual([7, ['read'], 900_000]);
    chain.short = false;
    events.length = 0;
    clock.t += 1_000;
    await backupRun();
    expect(passEvents(), 'the balance as it was: the wait stands').toEqual([]);
    pocket.wallet.ton_balance = 5_000_000_000n;
    const preparing = chain as any;
    preparing.refuseRead = true;
    await backupRun().catch(() => {});
    expect(box.shortAt, 'not asked whether it can pay: the shortfall is kept').not.toBeNull();
    preparing.refuseRead = false;
    events.length = 0;
    await backupRun();
    expect(passEvents(), 'topped up: read and sent at once').toEqual(['read', 'send']);
    expect(box.shortAt, 'a pass the balance could pay forgets the shortfall').toBeNull();
    const backupSource = fn('async function backupGroupsIfNeeded() {');
    expect(backupSource).toContain('if (paid && !short) groupsBackupShortBalance = null;');
    const forget = (paid: boolean, short: boolean) => { let at: any = 5n; if (paid && !short) at = null; return at; };
    expect([forget(true, false), forget(true, true), forget(false, true), forget(false, false)]).toEqual([null, 5n, 5n, 5n]);
    clock.t = box.notBefore;
    events.length = 0;
    chain.alreadyWritten = true;
    await backupRun();
    expect([box.failures, passEvents()], 'a pass that sent nothing does not climb').toEqual([0, ['read']]);
    chain.alreadyWritten = false;
    box.stored = [];
    chain.confirms = true;
    await backupRun();
    expect([box.failures, box.stored, box.inFlight], 'a write that lands is kept, and the ladder starts again').toEqual([0, [{ g: 'g1' }], false]);
    box.allowed = false;
    box.stored = [];
    chain.readClean = false;
    events.length = 0;
    clock.t += 120_000;
    await backupRun();
    expect([events, box.allowed], 'asked again, still refused').toEqual([['restore'], false]);
    chain.readClean = true;
    events.length = 0;
    clock.t += 30_000;
    await backupRun();
    expect(events, 'not again inside the minute').toEqual([]);
    clock.t += 31_000;
    await backupRun();
    expect([events, box.allowed], 'the minute up: read clean, the latch open, the write goes').toEqual([['restore', 'read', 'restore', 'send'], true]);
    expect(code(app)).toContain('const GROUPS_BACKUP_RETRY_MS = Object.freeze([30_000, 60_000, 2 * 60_000, 5 * 60_000, 15 * 60_000]);');
  });
});
