import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { beginCell, Cell } from '@ton/core';
import { code, sourceBlock } from './helpers/source';
import {
  TELEGRAM_GIFT_COLLECTION_CODE_HASH,
  TELEGRAM_GIFT_ITEM_CODE_LIBRARIES,
  readCollectionItemCodeLibrary,
  telegramGiftCollectionIsAuthentic,
} from '../web/telegram-gift-nfts.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const liftWith = (scope: Record<string, any>, sources: string[], exported: string) => {
  // eslint-disable-next-line no-new-func
  return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
};
const settle = () => new Promise((resolve) => { setTimeout(resolve, 0); });
const SELF = `0:${'11'.repeat(32)}`;
const ITEM = `0:${'66'.repeat(32)}`;
const COLLECTION = `0:${'55'.repeat(32)}`;

const DUROVS_CAPS_DATA_BOC =
  'te6ccgEBBQEArwAESYAAABLfHQ3koaSxignNG3FVwvqf99rxlgTH82d8KEprZvXkTEABAgMEAGYBaHR0cHM6Ly9uZnQu'
  + 'ZnJhZ21lbnQuY29tL2NvbGxlY3Rpb24vZHVyb3ZzY2FwLmpzb24IQgKR2eKsFp/Hhc4A3gqBrydiK5t9F2RBXHdeflDA'
  + 'POmKogAEAQAASwAFAGSADR50Dtpoo0MfqDwLjjaYBAqLqNZOrgycywS72hiTfgWQ';
const HANGING_STAR_DATA_BOC =
  'te6ccgEBBQEAsQAESYAAABhfHQ3koaSxignNG3FVwvqf99rxlgTH82d8KEprZvXkTEABAgMEAGoBaHR0cHM6Ly9uZnQuZnJhZ21lbnQuY29tL2NvbGxlY3Rpb24v'
  + 'aGFuZ2luZ3N0YXIuanNvbghCAiSYvWPz6cwsIMeavliJmkgW6hVoVbjU/NR82kuunpEaAAQBAABLAAUAZIANHnQO2mijQx+oPAuONpgECouo1k6uDJzLBLvaGJN+BZA=';

describe('client audit round 36', () => {
  it('R36-01 (F3-1 HIGH, F6-1): both item-code libraries Telegram\'s gift collections name are accepted — a clone with any other is not', () => {
    expect(readCollectionItemCodeLibrary(HANGING_STAR_DATA_BOC)).toBe('2498bd63f3e9cc2c20c79abe58899a4816ea156855b8d4fcd47cda4bae9e911a');
    expect(readCollectionItemCodeLibrary(DUROVS_CAPS_DATA_BOC)).toBe('91d9e2ac169fc785ce00de0a81af27622b9b7d1764415c775e7e50c03ce98aa2');
    for (const boc of [HANGING_STAR_DATA_BOC, DUROVS_CAPS_DATA_BOC]) {
      expect(telegramGiftCollectionIsAuthentic({ codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: boc }), 'a genuine collection, either series').toBe(true);
    }
    expect([...TELEGRAM_GIFT_ITEM_CODE_LIBRARIES].sort()).toEqual(['2498bd63f3e9cc2c20c79abe58899a4816ea156855b8d4fcd47cda4bae9e911a', '91d9e2ac169fc785ce00de0a81af27622b9b7d1764415c775e7e50c03ce98aa2']);
    const root = Cell.fromBase64(HANGING_STAR_DATA_BOC);
    const clone = beginCell().storeBits(root.bits);
    root.refs.forEach((ref, index) => { clone.storeRef(index === 1 ? beginCell().storeUint(2, 8).storeBuffer(Buffer.alloc(32, 0x5c)).endCell({ exotic: true }) : ref); });
    expect(telegramGiftCollectionIsAuthentic({ codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: clone.endCell().toBoc().toString('base64') }), 'the clone').toBe(false);
  });

  it('R36-02 (F3-2, F4-1, F5-1, F6-2): a proof landing while the NFT tab\'s own read runs is read again after it — the gift ends verified', async () => {
    const calls: string[][] = [];
    let releaseRead: () => void = () => {};
    let landProof: (list: any) => void = () => {};
    const proof = new Promise((resolve) => { landProof = resolve; });
    let cached: any = null;
    const state: any = { owner: SELF, tab: 'nft', nfts: null, loading: new Map(), failures: new Map(), retries: new Map(), at: new Map(), stored: {} };
    const scope: Record<string, any> = {
      walletAssetsState: state, WALLET_ASSETS_TTL_MS: 60_000, WALLET_ASSETS_RETRY_MS: [5_000], renderWalletAssets: () => {}, toncenterRestOrigin: () => '',
      readStoredToncenterApiKey: () => '', createToncenterRestFetch: () => null, noteTonRpcRateLimit: () => false, isVaultViewActive: () => true,
      loadTelegramGiftsForWallet: () => (cached ? Promise.resolve(cached) : proof), delay: () => Promise.resolve(), cachedTelegramGiftsForWallet: () => cached, provenTelegramGiftsForWallet: () => cached,
      readStoredWalletAssets: async () => null, writeStoredWalletAssets: async () => {},
      usernameRegistryAddressOrEmpty: () => '', requireUsernameRegistryAddress: () => { throw new Error('none'); },
      rawAccount: (a: string) => a, parseTonAddress: (a: string) => ({ raw: a }),
      readNftItems: async ({ verifiedItems }: any) => {
        calls.push(verifiedItems);
        if (calls.length === 1) await new Promise<void>((resolve) => { releaseRead = resolve; });
        return [{ address: ITEM, verified: verifiedItems.includes(ITEM) }];
      },
    };
    const load = liftWith(scope, [fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {')], 'loadWalletAssets');
    scope.loadWalletAssets = load;
    const first = load('nft');
    await settle();
    expect(calls).toEqual([[]]);
    const list = { complete: true, gifts: [{ itemAddress: ITEM, collectionAddress: COLLECTION }] };
    cached = list;
    landProof(list);
    await settle();
    releaseRead();
    await first;
    for (let i = 0; i < 10 && calls.length < 2; i += 1) await settle();
    expect(calls.length, 'read again after the running read').toBe(2);
    expect(calls[1]).toEqual([ITEM]);
    for (let i = 0; i < 10 && state.loading.size; i += 1) await settle();
    expect(state.nfts[0].verified).toBe(true);
  });

  it('R36-03 (F1-1): a late window opens only on the Wallet tab and never over a field the person is typing in', () => {
    const stands = (env: Record<string, any>) => liftWith({ plathoWallet: { address: SELF }, activeActionDialog: null, sameWalletAddress: (a: string, b: string) => a === b,
      isVaultViewActive: () => true, document: { activeElement: null }, ...env }, [fn('function walletTilePressStands(pressedBy) {')], 'walletTilePressStands');
    expect(stands({})(SELF)).toBe(true);
    expect(stands({ isVaultViewActive: () => false })(SELF), 'gone to Chats').toBe(false);
    const typing = { closest: (selector: string) => (selector.includes('input') ? {} : null) };
    expect(stands({ document: { activeElement: typing } })(SELF), 'typing in a field').toBe(false);
    const button = { closest: () => null };
    expect(stands({ document: { activeElement: button } })(SELF), 'a button has the focus').toBe(true);
  });

  it('R36-04 (F4-2, F6-3; F6 INFO 2): one retry chain per ask — a read from before a lock starts none; no ask without an account', async () => {
    const timers: Array<() => void> = [];
    const answers: Array<(profile: any) => void> = [];
    const marker: any = { wallet: '', timer: 0, ask: null };
    let account = true;
    const scope: Record<string, any> = {
      profileBalanceCardSelect: { value: '', selectedIndex: 0, disabled: false }, plathoWallet: { address: SELF }, rawWalletAddress: (a: string) => a,
      hasActivePlathoAccount: () => account, cachedChannelProfile: () => null, publishedBalanceCard: () => false, ownProfileReadAsked: marker,
      setTimeout: (run: () => void) => { timers.push(run); return timers.length; }, clearTimeout: () => {},
      resolveChannelProfile: () => new Promise((resolve) => { answers.push(resolve); }),
    };
    const ui = liftWith(scope, [fn('function refreshProfileBalanceCardUi() {')], 'refreshProfileBalanceCardUi');
    ui();
    expect(answers).toHaveLength(1);
    marker.wallet = ''; marker.timer = 0; marker.ask = null;
    ui();
    expect(answers).toHaveLength(2);
    answers[0](null);
    answers[1](null);
    await settle();
    expect(timers, 'one retry, the current ask\'s').toHaveLength(1);
    account = false;
    marker.wallet = ''; marker.ask = null;
    ui();
    expect(answers, 'no account, no read').toHaveLength(2);
    const marks = code(fn('function forgetWalletSessionMarks() {'));
    expect(marks).toContain('ownProfileReadAsked.ask = null;');
  });

  it('R36-05 (F2 L1, F6-4): the tiles mirror the Send GRAM button after its busy mark is written', () => {
    const refresh = code(fn('function refreshMessagingControls() {'));
    const mark = refresh.indexOf("sendWalletTonButton.removeAttribute('aria-disabled')");
    expect(mark).toBeGreaterThan(0);
    expect(refresh.indexOf('refreshWalletTabControls();'), 'after the mark').toBeGreaterThan(mark);
    expect(refresh.split('refreshWalletTabControls();').length - 1, 'once').toBe(1);
  });
});
