import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Address } from '@ton/core';
import {
  createPlathoWallet,
  buildPlathoWalletExternalBoc,
  sendPlathoWalletTransaction,
  walletExternalSignedFields,
  PLATHO_WALLET_NETWORK_GLOBAL_IDS,
  __resetWalletSeqnoFloorsForTests,
  __resetWalletSendLanesForTests,
  __resetWalletPendingExternalsForTests,
  WALLET_EXTERNAL_DEATH_GRACE_MS,
  WALLET_EXTERNAL_VALIDITY_S,
} from '../web/platho-wallet.mjs';
const GRACE = WALLET_EXTERNAL_DEATH_GRACE_MS;
const WINDOW = WALLET_EXTERNAL_VALIDITY_S * 1000 + GRACE;
import { parseBocBase64, beginCell } from '../web/pwa-contract-transactions.mjs';
import { parseTonAddress } from '../web/crypto/platho-crypto.mjs';
import { RECIPIENT_IDENTITY_TYPES } from '../web/recipient-identities.mjs';
import { confirmIntroCreatedAt, INTRO_CONFIRM_MAX_PAGES } from '../web/intro-send-coords.mjs';
import { INTRO_EPOCH_SIGNED_FROM } from '../web/crypto/intro-handshake.mjs';
import { introShardAddress } from '../web/shard-discovery.mjs';
import { serializeIntroDirectSend, reviveIntroDirectSend } from '../web/intro-send-state.mjs';
import { VERDICT_ACTION } from '../web/moderation.mjs';
import { WALLET_SEND_FIRST_EXTERNAL_EXTRA_NANOTONS } from '../web/wallet-send-fee.mjs';
import { scaleByNetworkPrices } from '../web/fee-vault.mjs';
import { testMnemonic } from './helpers/test-mnemonic';

const TEST_WALLET_MNEMONIC = await testMnemonic('wallet-a');


const app = readFileSync('web/app.js', 'utf8');
const fn = (declaration: string) => {
  const at = app.indexOf(declaration);
  if (at < 0) throw new Error(`${declaration} not found`);
  if (app.indexOf(declaration, at + 1) >= 0) throw new Error(`${declaration} is not unique`);
  return app.slice(at, app.indexOf('\n}', at) + 2);
};
const line = (prefix: string) => {
  const match = app.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^;]*;`, 'm'));
  if (!match) throw new Error(`${prefix} not found`);
  return match[0];
};
function appFunctions(env: Record<string, any>, sources: string[], exported: string) {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `${sources.join('\n')}\nreturn ${exported};`)(...names.map((n) => env[n]));
}
const tKey = (key: string, params?: any) => (params ? `${key}|${JSON.stringify(params, (_k, v) => (typeof v === 'bigint' ? String(v) : v))}` : key);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const MNEMONIC = TEST_WALLET_MNEMONIC;
const MESSAGE = { address: `0:${'11'.repeat(32)}`, amount: '19100000', payload: null };
const validUntil = () => Math.floor(Date.now() / 1000) + 300;
let walletPromise: Promise<any> | null = null;
const testWallet = () => (walletPromise ??= createPlathoWallet({ mnemonic: MNEMONIC }));
const resetWalletState = () => { __resetWalletSeqnoFloorsForTests(); __resetWalletSendLanesForTests(); __resetWalletPendingExternalsForTests(); };
const rootRefs = (boc: string) => (parseBocBase64(boc) as any).refs.length;
const seqnoOf = (boc: string) => walletExternalSignedFields(boc)?.seqno;
const seqnoStack = (value: number) => ({ stack: [{ type: 'num', value: `0x${value.toString(16)}` }] });

describe('AUDIT ROUND 7 — money: the wallet lane', () => {
  it('M7-01: seqno 0 is signed with a real deadline, like every other seqno — and the deadline reads back out of the bytes', async () => {
    const wallet = await testWallet();
    for (const seqno of [0, 7]) {
      const built = await buildPlathoWalletExternalBoc(wallet, [MESSAGE], { seqno, timeout: 1_790_000_123 });
      expect(walletExternalSignedFields(built.boc), `seqno ${seqno}: the deadline signed is the one booked, never "never"`)
        .toEqual({ validUntil: 1_790_000_123, seqno });
    }
    expect(rootRefs((await buildPlathoWalletExternalBoc(wallet, [MESSAGE], { seqno: 0, timeout: 1 })).boc)).toBe(2);
    expect(walletExternalSignedFields('not a boc')).toBeNull();
    expect(walletExternalSignedFields(null)).toBeNull();
  }, 60_000);

  it('M7-02: a send while this device\'s own deploying external is in flight waits for seqno 1 — never a second seqno 0', async () => {
    resetWalletState();
    const wallet = await testWallet();
    let deployed = false;
    let readsAfterSend = -1;
    const sent: string[] = [];
    const transport = {
      async runGetMethod() {
        if (readsAfterSend >= 0) readsAfterSend += 1;
        if (!deployed && readsAfterSend >= 3) deployed = true;
        if (!deployed) throw Object.assign(new Error('exit -13'), { exitCode: -13 });
        return seqnoStack(1);
      },
      async sendBoc({ boc }: any) { sent.push(boc); if (readsAfterSend < 0) readsAfterSend = 0; return { ok: true }; },
    };
    const options = { transport, seqnoCatchupMs: 0, rebroadcastIntervalMs: 0 };
    await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: validUntil() }, options);
    await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: validUntil() }, options);
    const first = sent[0];
    const second = sent[sent.length - 1];
    expect(seqnoOf(first)).toBe(0);
    expect(seqnoOf(second), 'the second send waited for the deploy and signed seqno 1').toBe(1);
    expect(rootRefs(second), 'and carries no StateInit — the wallet exists by then').toBe(1);
    expect(sent.filter((boc) => seqnoOf(boc) === 0 && boc !== first), 'no other bytes were ever signed on seqno 0').toEqual([]);
    expect(sent.filter((boc) => boc === first).length, 'the deploying bytes were re-offered while it waited').toBeGreaterThan(1);
  }, 60_000);

  it('M7-03: an ambiguous broadcast keeps its seqno — the next send waits for those bytes instead of signing beside them', async () => {
    resetWalletState();
    const wallet = await testWallet();
    let current = 5;
    const sent: string[] = [];
    const transport = {
      async runGetMethod() { return seqnoStack(current); },
      async sendBoc({ boc }: any) {
        sent.push(boc);
        if (sent.length === 1) throw Object.assign(new Error('the POST timed out mid-upload'), { code: 'TIMEOUT' });
        if (boc === sent[0]) current = 6;
        return { ok: true };
      },
    };
    const options = { transport, seqnoCatchupMs: 0, rebroadcastIntervalMs: 0 };
    const error: any = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: validUntil() }, options).catch((e) => e);
    expect(error?.builtBoc, 'the bytes ride the error: they may land').toBe(sent[0]);
    expect(error?.builtValidUntil, 'with the deadline signed into them').toBe(walletExternalSignedFields(sent[0])?.validUntil);
    await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: validUntil() }, options);
    expect(seqnoOf(sent[sent.length - 1]), 'the next send took seqno 6, after the first bytes consumed 5').toBe(6);
    expect(sent.filter((boc) => seqnoOf(boc) === 5).every((boc) => boc === sent[0]), 'nothing else was signed on 5').toBe(true);
  }, 60_000);

  it('M7-04: a broadcast provably undelivered frees its seqno and carries no bytes — unless an earlier door\'s answer was lost', async () => {
    const wallet = await testWallet();
    const cases: Array<[string, any, boolean]> = [
      ['a local queue expiry never POSTed', { code: 'QUEUE_TIMEOUT' }, false],
      ['every door refused the request', { broadcastVerdict: 'refused', status: 429 }, false],
      ['the chain rejected these bytes', { broadcastVerdict: 'rejected' }, false],
      ['a refusal after a lost answer', { broadcastVerdict: 'refused', tonRpcPriorDeliveryAmbiguous: true }, true],
    ];
    for (const [label, shape, ambiguous] of cases) {
      resetWalletState();
      let current = 5;
      const sent: string[] = [];
      const transport = {
        async runGetMethod() { return seqnoStack(current); },
        async sendBoc({ boc }: any) {
          sent.push(boc);
          if (sent.length === 1) throw Object.assign(new Error(label), shape);
          if (boc === sent[0]) current = 6;
          return { ok: true };
        },
      };
      const options = { transport, seqnoCatchupMs: 0, rebroadcastIntervalMs: 0 };
      const error: any = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: validUntil() }, options).catch((e) => e);
      expect(Boolean(error?.builtBoc), `${label}: bytes attached`).toBe(ambiguous);
      await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: validUntil() }, options);
      expect(seqnoOf(sent[sent.length - 1]), `${label}: the next send's seqno`).toBe(ambiguous ? 6 : 5);
    }
  }, 120_000);

  it('M7-05: the balance is read INSIDE the lane, after the send ahead of it spent — and a balance that cannot be read sends nothing', async () => {
    resetWalletState();
    const wallet = await testWallet();
    let balance = 100_000_000n;
    let current = 5;
    const sent: string[] = [];
    const transport: any = {
      async runGetMethod() { return seqnoStack(current); },
      async getAccountState() { return { balance: String(balance) }; },
      async sendBoc({ boc }: any) { sent.push(boc); balance -= 50_000_000n; current += 1; return { ok: true }; },
    };
    const options = { transport, seqnoCatchupMs: 0, rebroadcastIntervalMs: 0, requiredBalance: 60_000_000n };
    const [a, b]: any[] = await Promise.allSettled([
      sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: validUntil() }, options),
      sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: validUntil() }, options),
    ]);
    expect(a.status).toBe('fulfilled');
    expect(b.status, 'the second saw what the first spent').toBe('rejected');
    expect(b.reason?.code).toBe('PLATHO_WALLET_GRAM_REQUIRED');
    expect(b.reason?.requiredNanotons).toBe(60_000_000n);
    expect(b.reason?.balanceNanotons).toBe(50_000_000n);
    expect(sent.length, 'nothing signed for the one the wallet could not cover').toBe(1);

    for (const broken of [
      { ...transport, async getAccountState() { throw new Error('429'); } },
      { runGetMethod: transport.runGetMethod, sendBoc: transport.sendBoc },
      { ...transport, async getAccountState() { return {}; } },
    ]) {
      resetWalletState();
      const before = sent.length;
      const error: any = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: validUntil() }, { ...options, transport: broken }).catch((e) => e);
      expect(error?.code, 'fails CLOSED').toBe('PLATHO_WALLET_BALANCE_UNREAD');
      expect(sent.length).toBe(before);
    }
  }, 60_000);
});

describe('AUDIT ROUND 7 — money: what the app says about a send', () => {
  const broadcastMayHaveLanded = appFunctions({}, [fn('function broadcastMayHaveLanded(error) {')], 'broadcastMayHaveLanded');

  it('M7-06: a refused request and an expired queue are not "may have landed"; a lost answer before them still is', () => {
    const bytes = { builtBoc: 'te6' };
    expect(broadcastMayHaveLanded({ ...bytes })).toBe(true);
    expect(broadcastMayHaveLanded({})).toBe(false);
    expect(broadcastMayHaveLanded({ ...bytes, broadcastVerdict: 'rejected' })).toBe(false);
    expect(broadcastMayHaveLanded({ ...bytes, broadcastVerdict: 'refused' })).toBe(false);
    expect(broadcastMayHaveLanded({ ...bytes, code: 'QUEUE_TIMEOUT' })).toBe(false);
    for (const shape of [{ broadcastVerdict: 'rejected' }, { broadcastVerdict: 'refused' }, { code: 'QUEUE_TIMEOUT' }]) {
      expect(broadcastMayHaveLanded({ ...bytes, ...shape, tonRpcPriorDeliveryAmbiguous: true }), JSON.stringify(shape)).toBe(true);
    }
    expect(broadcastMayHaveLanded({ ...bytes, walletExternalExpired: true })).toBe(false);
    expect(broadcastMayHaveLanded({ ...bytes, walletExternalExpired: true, seqnoReadFailed: true })).toBe(true);
  });

  it('M7-07: a name is shown as the address it resolves to before anything is sent; a contract and a testnet address are refused', async () => {
    const raw = `0:${'2a'.repeat(32)}`;
    const other = `0:${'3b'.repeat(32)}`;
    const build = ({ status = 'active', seqno = 'wallet', network = 'MAINNET' }: any = {}) => appFunctions({
      RECIPIENT_IDENTITY_TYPES, parseTonAddress, PLATHO_WALLET_NETWORK_GLOBAL_IDS, t: tKey,
      plathoWallet: { networkGlobalId: PLATHO_WALLET_NETWORK_GLOBAL_IDS[network] },
      transferRecipientAccountStatus: async () => { if (status === 'throw') throw new Error('rpc'); return status; },
      displayWalletAddress: (wallet: string) => `D(${wallet})`,
      globalThis: { plathoWalletRpcTransport: { runGetMethod: async () => {
        if (seqno === 'contract') throw Object.assign(new Error('exit 11'), { exitCode: 11 });
        if (seqno === 'fail') throw new Error('network');
        return seqnoStack(3);
      } } },
    }, [fn('async function transferRecipientRefusal(resolved, entered, seen, { ownContracts = [] } = {}) {'), fn('async function transferRecipientAccountKind(address) {')], 'transferRecipientRefusal');
    const named = { type: RECIPIENT_IDENTITY_TYPES.USERNAME, label: 'alice.ath' };
    const typed = { type: RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS };

    const testnet = Address.parseRaw(raw).toString({ testOnly: true, bounceable: false });
    expect(await build()({ wallet: raw, identity: typed }, testnet, { value: null })).toBe('wallet.recipientTestnet');
    expect(await build({ network: 'TESTNET' })({ wallet: raw, identity: typed }, testnet, { value: null })).toBeNull();
    expect(await build()({ wallet: raw, identity: typed }, Address.parseRaw(raw).toString(), { value: null })).toBeNull();

    const seen = { value: null };
    const refuse = build();
    expect(await refuse({ wallet: raw, identity: named }, 'alice.ath', seen)).toBe(tKey('wallet.recipientConfirmAddress', { name: 'alice.ath', address: `D(${raw})` }));
    expect(await refuse({ wallet: raw, identity: named }, 'alice.ath', seen), 'seen: the next press sends').toBeNull();
    expect(await refuse({ wallet: other, identity: named }, 'alice.ath', seen), 'the name moved: shown again').toBe(tKey('wallet.recipientConfirmAddress', { name: 'alice.ath', address: `D(${other})` }));
    expect(await build({ seqno: 'contract' })({ wallet: raw, identity: named }, 'alice.ath', { value: null })).toBe(tKey('wallet.recipientIsContract', { name: 'alice.ath' }));
    expect(await build({ seqno: 'fail' })({ wallet: raw, identity: named }, 'alice.ath', { value: null })).toBe(tKey('username.recipientUnresolved', { name: 'alice.ath' }));
    expect(await build({ status: 'throw' })({ wallet: raw, identity: named }, 'alice.ath', { value: null })).toBe(tKey('username.recipientUnresolved', { name: 'alice.ath' }));
    const fresh = { value: null };
    expect(await build({ status: 'uninit' })({ wallet: raw, identity: named }, 'alice.ath', fresh)).toContain('wallet.recipientConfirmAddress');
    expect(await build({ status: 'uninit' })({ wallet: raw, identity: named }, 'alice.ath', fresh)).toBeNull();
  });

  it('M7-08: a name or gift transfer that may have landed is not "blocked" — the dialog closes as sent and the name leaves this device', async () => {
    for (const [declaration, exported] of [
      ['async function submitUsernameNftTransfer(nft, recipient) {', 'submitUsernameNftTransfer'],
      ['async function submitTelegramGiftTransfer(gift, recipient) {', 'submitTelegramGiftTransfer'],
    ]) {
      const left: string[] = [];
      const build = (failure: any) => appFunctions({
        requireNoPendingServiceWorkerAppShellReload: () => {}, requirePlathoWallet: () => ({ address: `0:${'44'.repeat(32)}` }), requireSameWallet: (signer: any) => signer,
        assertWalletGramAtLeast: async () => {}, walletSendFeeReserveNanotons: () => 1n,
        USERNAME_NFT_TRANSFER_VALUE_NANOTONS: 20_000_000n, TELEGRAM_GIFT_TRANSFER_VALUE_NANOTONS: 50_000_000n,
        buildUsernameNftTransferBody: () => ({}), buildTelegramGiftTransferBody: () => ({}), buildNftTransferBody: () => ({}),
        nextUsernameNftTransferQueryId: () => 1n, nextQueryId: () => 1n,
        createWalletTransaction: (m: any) => ({ messages: m }), tonCell: { bytesToBase64: () => '' }, serializeBoc: () => new Uint8Array(1),
        sendPlathoWalletTransaction: async () => { if (failure) throw failure; return {}; },
        broadcastMayHaveLanded,
        verifyOwnedUsernameNft: async () => ({ authoritative: true, owner_wallet: `0:${'44'.repeat(32)}` }),
        verifyTelegramGiftItemOnChain: async () => ({ ownerWallet: `0:${'44'.repeat(32)}` }), sameWalletAddress: (a: any, b: any) => Boolean(a) && a === b,
        canonicalUsernameDisplay: (v: any) => String(v ?? ''), readLinkedPlathoUsername: () => null, clearLinkedPlathoUsername: () => {},
        removeKnownPlathoUsername: (label: string) => { left.push(`name ${label}`); }, deleteStoredUsernameNftList: async () => {},
        telegramGiftListCache: { delete: () => { left.push('gift cache'); } }, deleteStoredTelegramGiftList: async () => {},
        wornGiftTheme: null, unwearTelegramGift: () => {},
        parseTonAddress, ownedUsernameNftsVerified: true, renderWalletIdentity: () => {}, console: { warn: () => {}, error: () => {} },
        t: tKey,
      }, [fn(declaration)], exported);
      const item = { itemAddress: `0:${'55'.repeat(32)}`, label: 'bob.ath', address: `0:${'55'.repeat(32)}` };
      await expect(build(Object.assign(new Error('timeout'), { builtBoc: 'te6' }))(item, `0:${'66'.repeat(32)}`), `${exported}: may have landed`).resolves.not.toThrow();
      expect(left.length, `${exported}: the item left this device's lists`).toBeGreaterThan(0);
      left.length = 0;
      await expect(build(new Error('the wallet refused before signing'))(item, `0:${'66'.repeat(32)}`)).rejects.toThrow();
      expect(left, `${exported}: a clear refusal keeps everything`).toEqual([]);
    }
  });

  it('M7-09: the GRAM transfer hands the lane its balance floor, says "submitted" only when the bytes may land, and names the shortfall', async () => {
    const calls: any[] = [];
    const build = (outcome: any) => appFunctions({
      requestWalletTonTransferDetails: async () => ({ recipient: `0:${'77'.repeat(32)}`, amount: 50n }),
      setVaultStatus: () => {}, transferRecipientAccountStatus: async () => 'active',
      TRANSFER_BOUNCE_ACCOUNT_STATUSES: new Set(['active', 'frozen']),
      createWalletTransaction: (m: any) => ({ messages: [m] }), assertWalletGramAtLeast: async () => {},
      walletSendFeeReserveNanotons: () => 7n, requirePlathoWallet: () => ({ address: 'W' }), requireSameWallet: (signer: any) => signer,
      plathoWallet: { address: 'W' }, sameWalletAddress: (a: any, b: any) => Boolean(a) && a === b,
      sendPlathoWalletTransaction: async (_w: any, _tx: any, options: any) => { calls.push(options); if (outcome) throw outcome; return { ok: true }; },
      broadcastMayHaveLanded, globalThis: {}, flashWalletIdentityStatus: (text: string) => { calls.push(text); }, t: tKey,
      queueVaultPostTransactionRefresh: () => {},
      setText: () => {}, sendWalletTonStatus: null, walletTransferNotRun: () => false,
      watchWalletTonTransfer: () => {},
      speakToScreenReader: () => {},
    }, [fn('function transferBounceForStatus(status) {'), fn('async function submitWalletTonTransfer(hold = null) {')], 'submitWalletTonTransfer');
    await build(null)();
    expect(calls.find((one: any) => typeof one === 'object')?.requiredBalance, 'amount + the send reserve, asserted in the lane').toBe(57n);
    calls.length = 0;
    await expect(build(Object.assign(new Error('timeout'), { builtBoc: 'te6' }))()).resolves.toBeNull();
    expect(calls).toContain('wallet.gramTransferSubmitted');
    calls.length = 0;
    await expect(build(Object.assign(new Error('refused'), { builtBoc: 'te6', broadcastVerdict: 'refused' }))()).rejects.toThrow('refused');
    expect(calls, 'a refused request is not "submitted"').not.toContain('wallet.gramTransferSubmitted');

    const shortfall = appFunctions({ t: tKey, formatTonNanotonsUp: (v: bigint) => `up(${v})` }, [fn('function gramShortfallText(error) {')], 'gramShortfallText');
    expect(shortfall({ code: 'PLATHO_WALLET_GRAM_REQUIRED', requiredNanotons: 60n })).toBe(tKey('errors.walletNeedsGram', { amount: 'up(60)' }));
    expect(shortfall({ code: 'OTHER' })).toBeNull();
  });
});

function scanPairsCell(pairs: Array<{ r: bigint; tag: bigint }>) {
  let cell: any = null;
  for (let start = Math.floor((pairs.length - 1) / 3) * 3; start >= 0; start -= 3) {
    const builder = beginCell();
    for (const pair of pairs.slice(start, start + 3)) builder.uint(pair.r, 256, 'r').uint(pair.tag, 16, 'view_tag');
    if (cell) builder.ref(cell, 'next');
    cell = builder.endCell();
  }
  return cell ?? beginCell().endCell();
}

function pagedIntroBucket(address: string, entries: Array<{ r: bigint; tag: bigint; createdAt: number }>, faults: any = {}) {
  const reads = { pages: 0, entries: 0 };
  const readScanPage = async (addr: string, from: number, max: number) => {
    reads.pages += 1;
    if (faults.pageThrows) throw new Error('429');
    if (addr !== address) return null;
    const start = Math.max(0, Number(from));
    const nextId = faults.nextIdOffset ? entries.length + faults.nextIdOffset : entries.length;
    const count = faults.overCount ? Math.min(Number(max), 256) + 1 : Math.max(0, Math.min(Number(max), 256, entries.length - start));
    if (faults.endless) return { from_id: BigInt(start), count: 256n, next_id: BigInt(start + 1_000_000), pairs: scanPairsCell(Array.from({ length: 256 }, () => ({ r: 1n, tag: 1n }))) };
    const packed = entries.slice(start, start + Math.max(0, count) - (faults.shortPairs ? 1 : 0));
    return { from_id: BigInt(start), count: BigInt(count), next_id: BigInt(nextId), pairs: scanPairsCell(packed) };
  };
  const readEntry = async (addr: string, id: number) => {
    reads.entries += 1;
    if (faults.entryGone) return { exists: false };
    const entry = addr === address ? entries[id] : undefined;
    return entry ? { exists: true, r: entry.r, view_tag: entry.tag, created_at: entry.createdAt } : { exists: false };
  };
  return { readScanPage, readEntry, reads };
}

const E = Math.floor(1_790_000_000 / 86400);
const OLD_R = (1n << 250n) + 11n;
const OLD_TAG = 0x2222n;

describe('AUDIT ROUND 7 — money: a first contact is looked for before a second is paid for', () => {
  it('M7-10: the confirm walks scan pages to the bucket\'s end, and tells "not there" from "could not look"', async () => {
    const address = await introShardAddress(E, 0);
    const raced = Array.from({ length: 300 }, (_, i) => ({ r: BigInt(1000 + i), tag: 7n, createdAt: 1_790_000_000 + i }));
    const lane = pagedIntroBucket(address, [...raced, { r: OLD_R, tag: OLD_TAG, createdAt: 1_790_000_400 }]);
    expect(await confirmIntroCreatedAt({ ...lane, epoch: E, bucket: 0, fromEntryId: 0, r: OLD_R, viewTag: OLD_TAG })).toEqual({ entryId: 300, createdAt: 1_790_000_400 });
    expect(lane.reads, 'two pages and one entry — not three hundred requests').toEqual({ pages: 2, entries: 1 });

    expect(await confirmIntroCreatedAt({ ...pagedIntroBucket(address, raced), epoch: E, bucket: 0, fromEntryId: 0, r: OLD_R, viewTag: OLD_TAG }), 'read to the end: not there').toBeNull();
    expect(await confirmIntroCreatedAt({ ...pagedIntroBucket('elsewhere', raced), epoch: E, bucket: 0, fromEntryId: 0, r: OLD_R, viewTag: OLD_TAG }), 'no such shard holds nothing').toBeNull();
    for (const [label, faults, from] of [
      ['a failed read', { pageThrows: true }, 0],
      ['an endpoint behind the fill the send was placed at', {}, 350],
      ['a page longer than the bucket', { overCount: true }, 0],
      ['a bucket that never ends', { endless: true }, 0],
      ['a page short of its own count', { shortPairs: true }, 0],
    ] as const) {
      await expect(confirmIntroCreatedAt({ ...pagedIntroBucket(address, raced, faults), epoch: E, bucket: 0, fromEntryId: from, r: OLD_R, viewTag: OLD_TAG }), label).rejects.toThrow();
    }
    const mine = [...raced, { r: OLD_R, tag: OLD_TAG, createdAt: 1_790_000_400 }];
    await expect(confirmIntroCreatedAt({ ...pagedIntroBucket(address, mine, { entryGone: true }), epoch: E, bucket: 0, fromEntryId: 0, r: OLD_R, viewTag: OLD_TAG })).rejects.toThrow();
    expect(INTRO_CONFIRM_MAX_PAGES * 256, 'the page budget covers a bucket filled to its daily cap').toBeGreaterThanOrEqual(8000);
  });

  const NOW = 1_790_000_900_000;
  let chainLead = 0;
  const deadEnv = (now: number) => ({
    WALLET_EXTERNAL_DEATH_GRACE_MS, WALLET_EXTERNAL_VALIDITY_S, walletClockInDoubt: () => false,
    Date: { now: () => now }, walletExternalSignedFields, walletChainClockOffsetMs: () => chainLead,
    walletChainNowMs: () => now + chainLead, chainNowSec: () => Math.floor((now + chainLead) / 1000),
  });
  const deadSources = [
    line('const DIRECT_SEND_REBROADCAST_WINDOW_MS'), line('const DIRECT_SEND_EXPIRY_GRACE_MS'), line('const CONV_CONFIRM_SEQNO_CONSUMED_TERMINAL_MS'),
    fn('function introSendBytesDead(send, now = Date.now()) {'),
  ];

  it('M7-11: the old bytes are dead by the deadline SIGNED into them (or the chain moving past their seqno), not by a clock stamped before the lane', async () => {
    const dead = appFunctions(deadEnv(NOW), deadSources, 'introSendBytesDead');
    const at = NOW - WINDOW - 1_000;
    const signed = Math.floor(NOW / 1000) + 29;
    expect(dead({ boc: null }), 'nothing signed: nothing to wait for').toBe(true);
    expect(dead({ boc: 'x', at, validUntil: signed }), 'the signed deadline is a minute away').toBe(false);
    expect(dead({ boc: 'x', at, validUntil: signed }, signed * 1000 + GRACE - 1_000), 'within the margin').toBe(false);
    expect(dead({ boc: 'x', at, validUntil: signed }, signed * 1000 + GRACE + 1_000)).toBe(true);
    const wallet = await testWallet();
    const boc = (await buildPlathoWalletExternalBoc(wallet, [MESSAGE], { seqno: 9, timeout: signed })).boc;
    expect(dead({ boc, at }), 'legacy record: the deadline read from the bytes').toBe(false);
    expect(dead({ boc, at }, signed * 1000 + GRACE + 1_000)).toBe(true);
    expect(dead({ boc: 'unreadable', at })).toBe(true);
    expect(dead({ boc: 'unreadable', at: NOW - 100_000 })).toBe(false);
    expect(dead({ boc: 'x', at, validUntil: signed, seqnoConsumedAt: NOW - 9_000 })).toBe(false);
    expect(dead({ boc: 'x', at, validUntil: signed, seqnoConsumedAt: NOW - 10_000 })).toBe(true);
    chainLead = 600_000;
    expect(dead({ boc: 'x', at, validUntil: signed }, signed * 1000 - 600_000 + GRACE - 1_000), 'within the margin, on the chain clock').toBe(false);
    expect(dead({ boc: 'x', at, validUntil: signed }, signed * 1000 - 600_000 + GRACE + 1_000)).toBe(true);
    chainLead = 0;
    expect(reviveIntroDirectSend(JSON.parse(JSON.stringify(serializeIntroDirectSend({ at, boc: 'x', validUntil: signed }))))?.validUntil).toBe(signed);
  }, 60_000);

  async function introHarness({ prior = null, bucket = [] as any[], faults = {} as any, publish = null as any, outcome = 'expired' } = {}) {
    const address = await introShardAddress(E, 0);
    const entries = [...bucket];
    const lane = pagedIntroBucket(address, entries, faults);
    const calls = { mints: 0, publishes: 0, rebroadcasts: 0, adopted: [] as any[] };
    const message: any = { introDirectSend: prior };
    const run = appFunctions({
      ...deadEnv(NOW),
      localRecipientKeyPair: { keyId: 'SELF' }, localIdentity: {}, globalThis: { plathoWalletRpcTransport: { runGetMethod: async () => ({}) } },
      convKeyStore: { upsertConversationKRoot: async (_self: string, _peer: string, record: any) => { calls.adopted.push(record); } },
      createMemoryConvKeyStore: () => null,
      sameWalletAddress: (a: any, b: any) => a === b, convKeyStoreWallet: new WeakMap(),
      createEntryReader: () => lane.readEntry, createScanPageReader: () => lane.readScanPage, confirmIntroCreatedAt,
      rebroadcastSignedExternal: async () => { calls.rebroadcasts += 1; return { verdict: 'accepted' }; },
      BROADCAST_VERDICT: { REJECTED: 'rejected', ACCEPTED: 'accepted' }, directSendSeqnoConsumed: async () => false,
      requireBasechainAddress: (v: any) => v, resolveRecipientWalletForThread: async () => 'PEER_WALLET', requireProfileRegistryAddress: () => 'REG', configuredProfileRegistryPredecessorAddress: () => 'REG17',
      createKeyShardTonRpcProvider: () => ({}), decodeTonAddressSliceBoc: () => null, resolveRecipientBundleByWallet: async () => ({ keyId: 'PEER' }),
      criticalChainReadOptions: () => ({}), messageDocumentBytesFromDraft: () => new Uint8Array([1]),
      privateReplyDraft: null, privateFileAttachments: [], privateShareDraft: null,
      createEncryptedIntroCapsule: async () => { calls.mints += 1; return { kRoot: new Uint8Array(32).fill(0x4e), introNonce: new Uint8Array(16), header0: { sizeClass: 1 } }; },
      currentProfilePointerFields: () => ({}), introCapsuleStealthFields: () => ({ r: 77n, viewTag: 0x77n }),
      pickIntroSendSlot: async () => ({ epoch: E, bucket: 0, expectedEntryId: entries.length }), INTRO_EPOCH_SIGNED_FROM,
      INTRO_PUBLISH_VALUE: 1n, squatCushionNanotons: () => 0n, LANE_INTRO: 'intro', walletSendFeeReserveNanotons: () => 0n, INTRO_CAPSULE_SIZE_CLASS: 1,
      assertWalletGramAtLeast: async () => {},
      publishIntroLane: async () => {
        calls.publishes += 1;
        if (publish?.throws) throw publish.throws;
        entries.push({ r: 77n, tag: 0x77n, createdAt: 1_790_000_800 });
        return { result: { boc: 'NEWBOC', seqno: 10, pendingValidUntil: 1_790_001_200 } };
      },
      plathoWallet: { address: 'WALLET_A' }, delay: async () => {}, noteTonRpcRateLimit: () => false, console: { warn: () => {} },
      dropEmptyAnonymousTwin: () => {}, scheduleRecoveryBackup: () => {}, conversationId: () => 'c', followContactPublicChannel: () => {},
      attemptConvMessagePublishDirect: async () => 'CONV',
      pricedGenerationMovedAt: () => false, pricesMovedError: () => new Error('moved'), messageNetworkPrices: async () => null,
      updateMessageInEncryptedHistory: async () => {},
      walletSessionGeneration: 1, requireSameWallet: (signer: any) => signer,
      awaitWalletChainClock: async () => {},
      firstContactOwnerOf: () => null, firstContactCarrierCanFinish: () => true,
      walletExternalOutcomeNow: async () => outcome, convIntroPendingError: () => Object.assign(new Error('the first contact is still on its way'), { code: 'CONV_INTRO_PENDING' }),
    }, [...deadSources, fn('function walletOfSend(owner = undefined) {'), line('const INTRO_SHARD_RETIRABLE_AFTER_EPOCH_START_SEC = '),
      fn('function introShardMayBeRetired(epoch, nowSec = chainNowSec()) {'), fn('async function attemptIntroFirstContactDirect(context, owner = undefined) {')], 'attemptIntroFirstContactDirect');
    return { calls, message, run: () => run({ thread: {}, message, text: 'hi' }) };
  }
  const priorState = (extra: any = {}) => ({
    at: NOW - 400_000, boc: 'OLDBOC', kRoot: new Uint8Array(32).fill(0x0d), introNonce: new Uint8Array(16), peerKeyId: 'PEER', peerWallet: 'PW',
    epoch: E, bucket: 0, expectedEntryId: 0n, r: OLD_R, viewTag: OLD_TAG, seqno: 9, seqnoConsumedAt: 0, validUntil: Math.floor((NOW - 400_000) / 1000) + 300, ...extra,
  });

  it('M7-12: a retry past the old deadline adopts the INTRO the chain holds; mints only on a walk that proves it absent; never on a failed read', async () => {
    {
      const h = await introHarness({ prior: priorState(), bucket: [{ r: 5n, tag: 5n, createdAt: 1 }, { r: OLD_R, tag: OLD_TAG, createdAt: 1_790_000_050 }] });
      expect(await h.run()).toBe('CONV');
      expect(h.calls.mints + h.calls.publishes, 'nothing minted, nothing paid again').toBe(0);
      expect(h.calls.adopted[0]?.createdAt).toBe(1_790_000_050);
      expect([...h.calls.adopted[0]?.kRoot], 'the FIRST INTRO\'s root').toEqual([...new Uint8Array(32).fill(0x0d)]);
    }
    {
      const h = await introHarness({ prior: priorState(), bucket: [{ r: 5n, tag: 5n, createdAt: 1 }] });
      expect(await h.run()).toBe('CONV');
      expect(h.calls.publishes).toBe(1);
      expect(h.calls.adopted[0]?.createdAt).toBe(1_790_000_800);
      expect(h.message.introDirectSend.validUntil, 'the signed deadline rides the record').toBe(1_790_001_200);
    }
    {
      const h = await introHarness({ prior: priorState(), bucket: [], faults: { pageThrows: true } });
      await expect(h.run()).rejects.toThrow();
      expect(h.calls.mints + h.calls.publishes).toBe(0);
    }
  });

  it('M7-12b: bytes the old window called dead but whose SIGNED deadline is ahead are re-offered, never minted beside — record or bytes', async () => {
    const at = NOW - WINDOW - 1_000;
    const signed = Math.floor(NOW / 1000) + 29;
    const wallet = await testWallet();
    const legacyBoc = (await buildPlathoWalletExternalBoc(wallet, [MESSAGE], { seqno: 9, timeout: signed })).boc;
    for (const [label, prior] of [
      ['recorded deadline', priorState({ at, validUntil: signed })],
      ['legacy record, deadline in the bytes', priorState({ at, validUntil: null, boc: legacyBoc })],
    ] as const) {
      const h = await introHarness({ prior, bucket: [{ r: OLD_R, tag: OLD_TAG, createdAt: 1_790_000_070 }] });
      expect(await h.run(), label).toBe('CONV');
      expect(h.calls.rebroadcasts, `${label}: the same bytes, re-offered`).toBe(1);
      expect(h.calls.mints + h.calls.publishes, `${label}: no second INTRO`).toBe(0);
    }
    const h = await introHarness({ publish: { throws: Object.assign(new Error('timeout'), { builtBoc: 'B', builtSeqno: 11, builtValidUntil: 1_790_001_300 }) } });
    await expect(h.run()).rejects.toThrow('timeout');
    expect({ boc: h.message.introDirectSend.boc, seqno: h.message.introDirectSend.seqno, validUntil: h.message.introDirectSend.validUntil })
      .toEqual({ boc: 'B', seqno: 11, validUntil: 1_790_001_300 });
  }, 60_000);
});

describe('AUDIT ROUND 7 — money: one verdict, one report, one door payment per press', () => {
  const holdSources = [
    line('const DIRECT_SEND_REBROADCAST_WINDOW_MS'), line('const DIRECT_SEND_EXPIRY_GRACE_MS'),
    fn('function moderationFlightHeld(flights, key, now = walletChainNowMs()) {'), 'function walletClockInDoubt() { return false; }' , fn('function unconfirmedSendHoldUntil(validUntil, now = walletChainNowMs()) {'),
    fn('function broadcastMayHaveLanded(error) {'),
  ];

  it('M7-13: a second press of a verdict on the same target cannot pass while the first is in flight, nor while an unconfirmed one may land', async () => {
    const clock = { now: 1_790_000_000_000 };
    const shown: string[] = [];
    let sends = 0;
    let effect: (value: boolean) => void = () => {};
    let outcome: any = { seen: 'deferred', validUntil: 1_790_000_300 };
    const sendVerdict = appFunctions({
      WALLET_EXTERNAL_DEATH_GRACE_MS, WALLET_EXTERNAL_VALIDITY_S,
      Date: { now: () => clock.now }, walletChainClockOffsetMs: () => 0, verdictsInFlight: new Map(), VERDICT_ACTION, t: tKey, MODERATION_CONFIRM_MS: 90_000, MODERATION_SENDING_TTL_MS: 150_000,
      walletChainNowMs: () => clock.now,
      moderationRuntimeFor: () => ({ ledgerAddress: 'L', ledgerView: { entry_min_value: 1n, wallet_min_value: 2n, review_min_value: 3n } }),
      plathoWallet: { address: 'W' }, showModerationStatus: (text: string) => { shown.push(text); }, refreshModerationLedger: async () => {},
      buildVerdictMessage: () => ({ amount: 5n }), assertWalletGramAtLeast: async () => {}, walletSendFeeReserveNanotons: () => 0n, globalThis: {},
      verdictNetworkPrices: async () => null, verdictLiveSurchargeNanotons: () => 0n,
      moderationLedgerTrusted: () => true, verdictMinimumCeiling: () => 10n ** 18n, NETWORK_PRICES_PLAUSIBLE_RATIO: 10n,
      sendPlathoWalletTransaction: async () => { sends += 1; if (outcome.throws) throw outcome.throws; return { pendingValidUntil: outcome.validUntil }; },
      requireSameWallet: (signer: any) => signer,
      awaitModerationEffect: () => (outcome.seen === 'deferred' ? new Promise((resolve) => { effect = resolve as any; }) : Promise.resolve(outcome.seen)),
      noteTonRpcRateLimit: () => false, console: { warn: () => {} },
    }, [...holdSources, fn('function refusalError('), fn('function refusalTextFor('), fn('function errorTextForPerson('),
      fn('async function sendVerdict({ action, reason = 0, shard = null, entryId = 0n, key = 0n, extra = 0n, confirm = null }) {')], 'sendVerdict');
    const warn = { action: VERDICT_ACTION.WARN_WALLET, key: 42n, confirm: async () => true };

    const first = sendVerdict(warn);
    await settle();
    expect(await sendVerdict(warn)).toBe(false);
    expect(sends).toBe(1);
    expect(shown).toContain('moderation.verdictSending');
    outcome = { seen: true };
    expect(await sendVerdict({ ...warn, key: 43n })).toBe(true);
    expect(sends).toBe(2);
    effect(true);
    expect(await first).toBe(true);
    expect(await sendVerdict(warn)).toBe(true);
    expect(sends).toBe(3);

    outcome = { seen: false, validUntil: 1_790_000_300 };
    expect(await sendVerdict(warn)).toBe(false);
    expect(sends).toBe(4);
    shown.length = 0;
    outcome = { seen: true };
    clock.now = 1_790_000_300_000 + GRACE - 1_000;
    expect(await sendVerdict(warn), 'the first may still land').toBe(false);
    expect(shown).toContain('moderation.unconfirmed');
    expect(sends).toBe(4);
    clock.now = 1_790_000_300_000 + GRACE + 1_000;
    expect(await sendVerdict(warn), 'its bytes are dead: a new verdict may go').toBe(true);
    expect(sends).toBe(5);
    outcome = { throws: new Error('refused before signing') };
    expect(await sendVerdict(warn)).toBe(false);
    outcome = { seen: true };
    expect(await sendVerdict(warn)).toBe(true);
  });

  it('M7-14: an unconfirmed report is held until its bytes are dead — a second press does not file and pay for a second row', async () => {
    const clock = { now: 1_790_000_000_000 };
    const shown: string[] = [];
    let sends = 0;
    const target = { generation: 18, kind: 0, epochTag: 1n, shardSeq: 0, entryId: 5n, partitionKey: 9n };
    const submitReport = appFunctions({
      WALLET_EXTERNAL_DEATH_GRACE_MS, WALLET_EXTERNAL_VALIDITY_S,
      Date: { now: () => clock.now }, walletChainClockOffsetMs: () => 0, reportsInFlight: new Map(), pendingReport: { item: {}, kind: 'post' }, closeReportDialog: () => {},
      walletChainNowMs: () => clock.now,
      chainNowSec: () => Math.floor(clock.now / 1000),
      plathoWallet: { address: 'W' }, showModerationStatus: (text: string) => { shown.push(text); }, t: tKey,
      publicItemModerationTarget: async () => target, moderationRuntimeFor: () => ({ runGetMethod: async () => ({}) }),
      buildReportMessage: async () => ({ to: 'SHARD', key: 1n, value: 3n, message: { amount: '3' } }),
      reportShardPrices: async () => ({ live: false }), reportRowCount: async () => 0, openActionDialog: async () => true,
      reportAttachValue: () => 3n, formatGramNanotonsUp: String, MODERATION_CONFIRM_MS: 90_000, MODERATION_SENDING_TTL_MS: 150_000,
      applyShardSurcharge: async () => ({ cushion: 0n }), LANE_REPORT: 'report', surchargeExtraNanotons: () => 0n,
      walletSendFeeReserveNanotons: () => 0n, assertWalletGramAtLeast: async () => {}, globalThis: {},
      sendPlathoWalletTransaction: async () => { sends += 1; return { pendingValidUntil: 1_790_000_300 }; },
      requireSameWallet: (signer: any) => signer,
      awaitModerationEffect: async () => false, noteTonRpcRateLimit: () => false, console: { warn: () => {} },
      reportDirectLiveExtraNanotons: () => 0n, messageNetworkPrices: async () => null,
    }, [...holdSources, line('const reportFlightKey'), fn('async function submitReport(reason) {')], 'submitReport');
    await submitReport(1);
    expect(sends).toBe(1);
    expect(shown).toContain('moderation.unconfirmed');
    shown.length = 0;
    await submitReport(1);
    expect(sends, 'held: the first may still land').toBe(1);
    expect(shown).toContain('moderation.unconfirmed');
    clock.now = 1_790_000_300_000 + GRACE + 1_000;
    await submitReport(1);
    expect(sends, 'its bytes are dead: a new report may go').toBe(2);
  });

  it('M7-15: a door payment is remembered per wallet and across a reload — and the device\'s storage does not say who paid for which room', async () => {
    const storage = new Map<string, string>();
    const localStorage = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); } };
    const chainReads: string[] = [];
    const sent: string[] = [];
    const room = 'ab'.repeat(32);
    const build = (wallet: string) => appFunctions({
      Date, localStorage, scopedStorageKey: (k: string) => `S:${k}`, TextEncoder, JSON,
      pendingGroupEntryPayments: new Map(),
      rawWalletAddress: (w: string) => w, bytesToHex: (b: Uint8Array) => Buffer.from(b).toString('hex'), globalThis,
      requirePlathoWalletAddress: () => wallet, requireBasechainAddress: (v: string) => v,
      tonCell: { hexToBytes: (h: string) => Buffer.from(h, 'hex') },
      readGroupEntryPayment: async () => { chainReads.push(wallet); return { paid: false }; },
      groupEntryShares: () => ({ owner: 5n, burn: 5n }), assertConnectedAthAtLeast: async () => {}, loadConnectedAthWalletAddress: async () => 'ATHW',
      priceGroupEntryLegs: async () => ({ values: null, topUp: null }),
      groupEntryPaymentMessages: () => [{ amount: '40000000' }], groupEntryQueryId: () => 1n,
      assertWalletGramAtLeast: async () => {}, walletSendFeeReserveNanotons: () => 0n,
      sendPlathoWalletTransaction: async () => { sent.push(wallet); return {}; }, requirePlathoWallet: () => ({}), requireSameWallet: (signer: any) => signer,
      broadcastMayHaveLanded: () => false, t: tKey,
      withAtRestLock: async (_name: string, run: () => any) => run(),
    }, [
      line('const GROUP_ENTRY_PAYMENT_PENDING_MS'), line('const GROUP_ENTRY_PAYMENTS_PENDING_STORAGE_KEY'),
      fn('async function sha256Hex(bytes) {'), fn('async function groupEntryPaymentPendingKey(wallet, groupIdHex) {'),
      fn('function pendingGroupEntryPaymentMarks(now = Date.now()) {'), fn('function persistPendingGroupEntryPayments({ drop = null } = {}) {'),
      fn('async function payGroupEntry(runtime, pointer, held, options = {}) {'),
      fn('async function payGroupEntryLocked(runtime, pointer, held, pendingKey, { payAgain = false, reserveAfter = 0n } = {}) {'),
    ], 'payGroupEntry');
    const runtime = { memberKeyFor: async () => new Uint8Array(32) };
    const pointer = { groupId: room, ownerWallet: 'OWNER', entryFee: '10' };
    expect(await build('WALLET_A')(runtime, pointer, null)).toEqual({ alreadyPaid: false });
    expect(sent).toEqual(['WALLET_A']);
    expect(await build('WALLET_A')(runtime, pointer, null)).toEqual({ alreadyPaid: true });
    expect(sent).toEqual(['WALLET_A']);
    expect(chainReads).toEqual(['WALLET_A']);
    expect(await build('WALLET_B')(runtime, pointer, null)).toEqual({ alreadyPaid: false });
    expect(sent).toEqual(['WALLET_A', 'WALLET_B']);
    const stored = [...storage.values()].join('');
    expect(stored).not.toContain('WALLET_A');
    expect(stored).not.toContain(room);
  });

  it('M7-16: the door and the invitation say the GRAM of the send — the request as the composer prices it, the first contact when there is one', async () => {
    const asked: any[] = [];
    const price = appFunctions({
      privateComposerSendPlan: (token: string) => Array.from({ length: Math.ceil(token.length / 1000) }, () => ({ sizeClass: 2 })),
      currentPrivateSenderOptions: () => ({}), currentOutgoingPrivateSuite: () => 'hybrid',
      privateMessagePriceAndHold: (thread: any, plan: any[]) => { asked.push({ thread, parts: plan.length }); return { cost: BigInt(plan.length) * 100n, deposit: 0n, hold: BigInt(plan.length) * 150n }; },
    }, [fn('function groupTokenMessagePrice(peerThread, token, { afterDeploy = false } = {}) {')], 'groupTokenMessagePrice');
    const peer = { convPeerKeyId: 'k' };
    expect(price(peer, 'x'.repeat(1700))).toEqual({ cost: 200n, deposit: 0n, hold: 300n });
    expect(asked, 'priced over the token\'s own parts, for that person').toEqual([{ thread: peer, parts: 2 }]);
    const both = fn('function privateMessagePriceAndHold(thread, plan, { afterDeploy = false } = {}) {');
    expect(both).toContain('composerEstimatedNetCostNanotons(privateComposerPublishProfilesForPlan(plan), 1, { afterDeploy }) + privateFirstContactExtraNanotons(thread)');
    expect(both).toContain('const { cost, deposit } = privateMessageFinalCost(thread, plan, { afterDeploy });');
    const ask = fn('async function requestGroupJoin(');
    expect(ask).toContain('const hintFor = (again) => joinHintSentences(...(paying(again) ? paidLines : freeLines), gramLine(again));');
    expect(ask).toContain('? composerCostAndHoldLine({ cost: message.cost + groupEntryPaymentCostNanotons(), setup: message.deposit,');
    expect(ask).toContain('hold: message.hold + groupEntryPaymentGramNanotons(), upTo: true })');
    expect(ask).toContain(': composerCostAndHoldLine({ cost: message.cost, setup: message.deposit, hold: message.hold, upTo: true })).text;');
    expect(ask, 'asked again at every paint [round 11 - flip-1]').toContain('hint: () => hintFor(payAgainChosen),');
    expect(ask).toContain('const token = askToken;');

    const lines: string[] = [];
    let priced = 0;
    const el = () => ({ className: '', textContent: '', type: '', dataset: {}, children: [] as any[], append(...nodes: any[]) { this.children.push(...nodes); nodes.forEach((n) => n.textContent && lines.push(n.textContent)); }, addEventListener() {}, querySelector: () => null });
    const card = appFunctions({
      document: { createElement: el }, t: tKey, groupInviteTitleText: () => 'title', acceptGroupInvite: () => {},
      threads: [{ id: 'dm' }], activeThreadId: 'dm', isGroupThread: () => false,
      groupRuntimeInstance: { askTokenFor: async () => { priced += 1; return 'TOKEN'; } }, groupInviteAnswerTokens: new Map(),
      groupTokenMessagePrice: () => ({ cost: 1234n, deposit: 0n, hold: 2000n }),
      composerCostAndHoldLine: ({ cost, hold }: any) => ({ text: `C${cost}H${hold}` }),
      writeGenerationNow: () => 18, joinHintSentences: (...parts: string[]) => parts.join(' '), speakToScreenReader: () => {},
    }, [fn('function buildGroupInviteCard(secret, mine) {'), fn('function fillGroupInviteAnswerFee(secret, card, { moved = false } = {}) {')], 'buildGroupInviteCard');
    card({ groupId: 'aa', name: 'Room' }, false);
    await settle();
    expect(lines).toContain(tKey('group.inviteAnswerFee', { price: 'C1234H2000' }));
    card({ groupId: 'aa', name: 'Room' }, false);
    await settle();
    expect(priced, 'the second render reads the cached token').toBe(1);
    lines.length = 0;
    card({ groupId: 'bb', name: 'Room', admitted: true }, false);
    await settle();
    expect(lines.some((text) => text.startsWith('group.inviteAnswerFee')), 'a key-only card sends nothing and says no fee').toBe(false);
  });
});

describe('AUDIT ROUND 7 — money: the figures, the wallet, the arrear', () => {
  it('M7-17: a figure the wallet must cover is printed rounded up, with what the check demands; the cost note has its unit in every language', async () => {
    expect(app).toContain("t('profile.buyAthLowBalance', { amount: formatGramNanotonsUp(total + walletSendFeeReserveNanotons()) })");
    expect(app).not.toContain("t('profile.buyAthLowBalance', { amount: formatGramNanotons(total) })");
    expect(app).toContain("t('username.transferCostNote', { amount: formatGramNanotonsUp(USERNAME_NFT_TRANSFER_VALUE_NANOTONS + walletSendFeeReserveNanotons()) })");
    expect(app).toContain("t('username.transferCostNote', { amount: formatGramNanotonsUp(TELEGRAM_GIFT_TRANSFER_VALUE_NANOTONS + walletSendFeeReserveNanotons()) })");
    for (const charge of [
      'vaultTakeFor(verdict.feeDue ?? 0n)',
    ]) expect(app, charge).toContain(`formatGramNanotonsUp(${charge})`);
    expect(app).toContain('channelProfilePriceLine(description, tags, appearance, worn, next)');
    expect(app).toContain("...(price.cost === null ? [] : [{ label: t('common.costLabel'), value: `${formatGramNanotonsUp(price.cost)} GRAM${setup}` }]),");
    expect(app).toContain("{ label: t('common.balanceNeeded'), value: balanceNeededText(price.hold) },");
    expect(app).toContain("hint: t('moderation.reportPriceHint', { price: formatGramNanotonsUp(price), premium: formatGramNanotonsUp(premium) }),");
    expect(app).toContain('const cost = reactionFinalCost({ lane, newLeaf, prices: composerNetworkPrices() });');
    expect(app).toContain("{ label: t('common.costLabel'), value: `${formatTonNanotonsUp(cost)} GRAM` },");
    expect(app).toContain("{ label: t('common.balanceNeeded'), value: balanceNeededText(hold) },");
    const { I18N_STRINGS } = await import('../web/i18n-strings.mjs');
    for (const [locale, strings] of Object.entries(I18N_STRINGS as Record<string, any>)) {
      expect(strings['username.transferCostNote'], `${locale}: the unit is said`).toContain('{amount} GRAM');
      if (locale !== 'en') expect(strings['username.transferCostNote'], `${locale}: not English`).not.toBe(I18N_STRINGS.en['username.transferCostNote']);
      expect(strings['group.askGramCost'], locale).toBeUndefined();
      expect(strings['group.inviteAnswerFee'], locale).toContain('{price}');
      expect(strings['moderation.verdictSending'], locale).toBeTruthy();
      expect(strings['errors.walletChangedNothingSent'], locale).toBeTruthy();
    }
  });

  it('M7-18: one wallet from the quote to the signature — a name mint refuses a switch before it signs; the room signs with its own wallet', async () => {
    const sends: any[] = [];
    const names = ['requireBasechainAddress', 'requirePlathoWalletAddress', 'requireUsernameRegistryAddress', 'resolveUsernameRegistryProvider',
      'readUsernameMintPriceForOwnVaultAction', 'setUsernameMintStatus', 't', 'readUsernameMintAvailabilityForOwnVaultAction',
      'assertNoPendingUsernameMintRetry', 'assertConnectedAthAtLeast', 'assertWalletGramAtLeast', 'USERNAME_MINT_DIRECT_REQUEST_VALUE',
      'walletSendFeeReserveNanotons', 'requirePlathoWallet', 'loadConnectedAthWalletAddress', 'createAthWalletMessage', 'nextQueryId',
      'USERNAME_MINT_DIRECT_NOTIFY_VALUE', 'globalThis', 'sendPlathoWalletTransaction', 'rememberPendingUsernameMint', 'autoLinkMintedUsername',
      'USERNAME_MINT_BACKGROUND_CONFIRM_ATTEMPTS', 'USERNAME_MINT_BACKGROUND_CONFIRM_DELAY_MS', 'console', 'athRequestTopUpMessage'];
    const A = { address: 'A' };
    const B = { address: 'B' };
    const build = (switchAt: string | null) => {
      let api: any = null;
      const env: Record<string, any> = {
        requireBasechainAddress: (v: any) => v, requirePlathoWalletAddress: () => api.wallet().address, requireUsernameRegistryAddress: () => 'REG',
        resolveUsernameRegistryProvider: async () => ({}), readUsernameMintPriceForOwnVaultAction: async () => 10n, setUsernameMintStatus: () => {}, t: tKey,
        readUsernameMintAvailabilityForOwnVaultAction: async () => {}, assertNoPendingUsernameMintRetry: () => {}, assertConnectedAthAtLeast: async () => {},
        assertWalletGramAtLeast: async () => {}, USERNAME_MINT_DIRECT_REQUEST_VALUE: 1n, walletSendFeeReserveNanotons: () => 0n,
        requirePlathoWallet: () => api.wallet(),
        loadConnectedAthWalletAddress: async () => { if (switchAt === 'ath') api.setWallet(B); return 'ATHW'; },
        createAthWalletMessage: () => { if (switchAt === 'build') api.setWallet(B); return {}; }, nextQueryId: () => 1n,
        USERNAME_MINT_DIRECT_NOTIFY_VALUE: 1n, globalThis: {}, sendPlathoWalletTransaction: async (wallet: any) => { sends.push(wallet.address); return {}; },
        rememberPendingUsernameMint: () => {}, autoLinkMintedUsername: async () => {}, USERNAME_MINT_BACKGROUND_CONFIRM_ATTEMPTS: 1,
        USERNAME_MINT_BACKGROUND_CONFIRM_DELAY_MS: 1, console: { error: () => {} },
        athRequestTopUpMessage: async () => null,
      };
      // eslint-disable-next-line no-new-func
      api = new Function(...names, `let plathoWallet = null; let walletSessionGeneration = 1;
        ${fn('function walletChangedBeforeSigningError() {')}
        ${fn('function broadcastMayHaveLanded(error) {')}
        ${fn('async function submitUsernameMintDirect(username) {')}
        return { run: submitUsernameMintDirect, wallet: () => plathoWallet, setWallet: (w) => { plathoWallet = w; walletSessionGeneration += 1; }, init: (w) => { plathoWallet = w; } };`)(...names.map((n) => env[n]));
      api.init(A);
      return api;
    };
    await build(null).run('alice');
    expect(sends).toEqual(['A']);
    for (const at of ['ath', 'build']) {
      const error: any = await build(at).run('alice').catch((e: any) => e);
      expect(error?.code, `a switch at ${at}`).toBe('PLATHO_WALLET_CHANGED');
    }
    expect(sends, 'B never paid for a name minted to A').toEqual(['A']);

    const runtime = app.slice(app.indexOf('    send: async (messages, route = {}) => {'), app.indexOf('    readLastSeq: (address) => {'));
    expect(runtime).toContain('buildVaultDeployMessage(feeVaultCodeBoc(), wallet.address, route.vaultAddress)');
    expect(runtime.indexOf('if (plathoWallet !== wallet) throw walletChangedBeforeSigningError();')).toBeLessThan(runtime.indexOf('sendPlathoWalletTransaction(wallet,'));
    expect(runtime).toContain('if (deploy) noteFeeVaultDeployed(wallet.address, route.vaultAddress, route.deployFlight ?? null, { unconfirmed: unconfirmedExternalOf(result) });');
    const code = runtime.split('\n').map((row) => row.replace(/\/\/.*$/, '')).join('\n');
    expect(code, 'no live wallet read in the code (the comment may name it)').not.toMatch(/plathoWallet\.address/);
  });

  it('M7-19: the notepad pays each slot\'s arrear in a message of its own ahead of the write, and reserves the fee for it', async () => {
    const sent: any[] = [];
    let need = 0n;
    let classes: number[] = [];
    let duringArrear: () => void = () => {};
    const names = ['t', 'globalThis', 'selfNotesForBackup', 'createRecoveryViewReader', 'prepareNotesBackup', 'RECOVERY_PUBLISH_VALUE',
      'createSelfSlotStatesReader', 'shardArrearOf', 'LANE_RECOVERY', 'assertWalletGramAtLeast', 'walletSendFeeReserveNanotons',
      'capsuleSizeClassForUsefulBytes', 'minimalCapsuleUsefulBytesForLength', 'sendPlathoWalletTransaction', 'tonCell', 'broadcastMayHaveLanded', 'sameWalletAddress'];
    const env: Record<string, any> = {
      t: tKey, globalThis: { plathoTonRpcTransport: { runGetMethod: async () => ({}) } }, selfNotesForBackup: async () => [],
      createRecoveryViewReader: () => async () => null,
      prepareNotesBackup: async () => ({ publishes: [
        { to: 'S0', value: 10n, body: {}, init: null, blobBytes: 100, seq: 1, h1: 1n },
        { to: 'S1', value: 10n, body: {}, init: null, blobBytes: 100, seq: 1, h1: 2n },
      ] }),
      RECOVERY_PUBLISH_VALUE: 10n, createSelfSlotStatesReader: () => null,
      shardArrearOf: async (to: string) => { duringArrear(); return to === 'S1' ? 5n : 0n; }, LANE_RECOVERY: 'recovery',
      assertWalletGramAtLeast: async (value: bigint) => { need = value; },
      walletSendFeeReserveNanotons: (list: number[]) => { classes = list; return 0n; },
      capsuleSizeClassForUsefulBytes: () => 1, minimalCapsuleUsefulBytesForLength: () => 1024,
      sendPlathoWalletTransaction: async (wallet: any, tx: any) => { sent.push({ wallet: wallet.address, messages: tx.messages }); return {}; },
      tonCell: { bytesToBase64: () => 'B', serializeBoc: () => new Uint8Array(1) }, broadcastMayHaveLanded: () => false,
      sameWalletAddress: (a: any, b: any) => a === b,
    };
    // eslint-disable-next-line no-new-func
    const api = new Function(...names, `let plathoWallet = { address: 'A', seed: new Uint8Array(32) }; let walletSessionGeneration = 1;
      ${fn('function walletChangedBeforeSigningError() {')}
      ${fn('function walletOfSend(owner = undefined) {')}
      ${fn('async function publishSelfNotesSnapshotForThread(thread, owner = undefined) {')}
      return { run: publishSelfNotesSnapshotForThread, lock: () => { walletSessionGeneration += 1; } };`)(...names.map((n) => env[n]));
    await api.run({});
    expect(sent[0].messages.map((m: any) => `${m.address}:${m.amount}:${m.bounce}`)).toEqual(['S0:10:true', 'S1:5:false', 'S1:10:true']);
    expect(need, 'the arrear is in the sum').toBe(25n);
    expect(classes, 'and its message in the fee reserve').toEqual([1, 1, 1]);
    sent.length = 0;
    duringArrear = () => api.lock();
    const error: any = await api.run({}).catch((e: any) => e);
    expect(error?.code).toBe('PLATHO_WALLET_CHANGED');
    expect(sent, 'nothing signed').toEqual([]);

    for (const [name, label] of [['arrear', 'groups backup'], ['backupArrear', 'recovery backup']]) {
      const at = app.indexOf(`'${label}');`);
      expect(app.slice(at - 400, at), label).toContain(`walletSendFeeReserveNanotons([...(${name} > 0n ? [1] : []), walletSendSizeClassForPayloadBytes(`);
    }
    const prefsAt = app.indexOf('const prefsHold = prefsNeed + walletSendFeeReserveNanotons(prefsSizeClasses);');
    expect(prefsAt, 'prefs snapshot').toBeGreaterThan(-1);
    expect(app.slice(app.lastIndexOf('async function submitPrefsSnapshotDirect(', prefsAt), prefsAt)).toContain('if (prefsArrears[index] > 0n) prefsSizeClasses.push(1);');
  });

  it('M7-20: until the wallet is seen activated, the reserve carries the import of its own code — the first external pays for it', () => {
    const build = (activated: boolean) => appFunctions({
      walletSendFeeNanotons: () => 13_220_000n, hasActivePlathoAccount: () => activated, WALLET_SEND_FIRST_EXTERNAL_EXTRA_NANOTONS,
      scaleByNetworkPrices, networkPricesCache: null,
    }, [line('const WALLET_FEE_HEADROOM_NANOTONS'), fn('function walletSendFeeReserveNanotons(sizeClasses = []) {')], 'walletSendFeeReserveNanotons');
    expect(build(true)([8])).toBe(13_220_000n);
    expect(build(false)([8])).toBe(13_220_000n + WALLET_SEND_FIRST_EXTERNAL_EXTRA_NANOTONS);
    expect(WALLET_SEND_FIRST_EXTERNAL_EXTRA_NANOTONS, 'the measured 470,401, rounded up').toBeGreaterThanOrEqual(470_401n);
  });
});
