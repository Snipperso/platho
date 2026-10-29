import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { parseTonAddress } from '../web/crypto/platho-crypto.mjs';
import { decodeNftAddressByIndexStack } from '../web/telegram-gift-nfts.mjs';


const app = readFileSync('web/app.js', 'utf8');
const appCode = code(app);
const css = readFileSync('web/styles.css', 'utf8');
const lane = readFileSync('web/public-lane.mjs', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const t = (key: string) => key;
const SELF = `0:${'11'.repeat(32)}`;
const OTHER = `0:${'22'.repeat(32)}`;
const COLLECTION = `0:${'55'.repeat(32)}`;
const ITEM = `0:${'66'.repeat(32)}`;

describe('client audit round 34', () => {
  it('R34-01 (F3-1, F4-1, F6-1): no wallet surface waits for every gift-shaped NFT to be proven — History and the NFT send read the list already proved', () => {
    const list = { gifts: [{ itemAddress: ITEM }], complete: true };
    const cache = new Map<string, any>([[parseTonAddress(SELF).raw, { at: 1, result: list }]]);
    const cached = lift({ telegramGiftListCache: cache, parseTonAddress }, [fn('function cachedTelegramGiftsForWallet(wallet) {'), fn('function provenTelegramGiftsForWallet(wallet) {')], 'cachedTelegramGiftsForWallet');
    expect(cached(SELF)).toBe(list);
    expect(cached(OTHER), 'never proved: nothing, at once').toBeNull();
    expect(cached('nonsense')).toBeNull();
    const load = code(fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {'));
    const history = load.slice(load.indexOf('readWalletHistory') - 400, load.indexOf('readWalletHistory'));
    expect(history).toContain('const gifts = cachedTelegramGiftsForWallet(owner);');
    expect(history, 'History asks for no proof').not.toContain('loadTelegramGiftsForWallet(');
    expect(load, 'the NFT tab waits 8 s at most, then shows what is known').toContain(
      'const raced = await Promise.race([proof.then((late) => ({ late })), delay(8_000).then(() => null)]);');
    expect(load).toContain('const gifts = raced?.late ?? provenTelegramGiftsForWallet(owner);');
    const send = code(fn('async function runWalletAssetSend(picked) {'));
    expect(send).toContain('const gifts = provenTelegramGiftsForWallet(pressedBy);');
    expect(send).not.toContain('loadTelegramGiftsForWallet(');
  });

  it('R34-02 (F4-2): the collection is asked which item holds the index — remembered, as it never changes; both proofs ask it', async () => {
    const calls: any[] = [];
    (globalThis as any).plathoTonRpcTransport = { runGetMethod: async (call: any) => { calls.push(call); return { stack: [{ address: ITEM }] }; } };
    try {
      const memberships = new Map();
      const ask = lift({ telegramGiftMemberships: memberships, giftChainReadOptions: () => ({ priority: 'profile' }), decodeNftAddressByIndexStack,
        decodeTonAddressSliceBoc: () => { throw new Error('not reached'); } }, [fn('async function verifyTelegramGiftMembershipOnChain(collectionAddress, index) {')],
        'verifyTelegramGiftMembershipOnChain');
      expect(await ask(COLLECTION, 37n)).toBe(ITEM);
      expect(await ask(COLLECTION, 37n), 'remembered').toBe(ITEM);
      expect(calls).toHaveLength(1);
      expect([calls[0].address, calls[0].method, calls[0].stack]).toEqual([COLLECTION, 'get_nft_address_by_index', [{ type: 'num', value: '0x25' }]]);
    } finally {
      delete (globalThis as any).plathoTonRpcTransport;
    }
    const both = [...appCode.matchAll(/collectOwnedTelegramGifts\(\{[\s\S]*?\}\);/g)].map((m) => m[0]);
    expect(both).toHaveLength(2);
    for (const call of both) expect(call).toContain('verifyMembership: (collection, index) => enqueueGiftChainRead(() => verifyTelegramGiftMembershipOnChain(collection, index)),');
  });

  it('R34-03 (F6-2): a channel with a shard nobody answered about is reported as not read whole — never taken for "no profile"', () => {
    const many = code(sourceBlock(lane, 'async function readChannelPostsManyImpl('));
    expect(many).toMatch(/out\.set\(wallet, await readChannelPostsFromStates\([^\n]*\n\s*if \(\(coordsByWallet\.get\(wallet\) \?\? \[\]\)\.some\(\(coord\) => isUnknownAccountState\(live\.get\(addrKey\(coord\.address\)\)\)\)\s*&& typeof onChannelError === 'function'\) \{\s*try \{ onChannelError\(wallet, Object\.assign\(new Error\([^)]*\), \{ code: 'PUBLIC_CHANNEL_STATE_UNKNOWN' \}\)\); \} catch \{/);
    expect(code(fn('async function resolveChannelProfile(authorWallet, options = {}) {'))).toContain('if (failed) return cachedChannelProfile(key);');
  });

  it('R34-04 (F2-1, F1-2, F5-4; F2 LOW): the swap window says what it could not read; the press answers for the screen up to the signature', () => {
    const swap = code(fn('async function openWalletSwapDialog(start, hold, asked = null) {'));
    expect(swap).toContain("hint: walletAssetsState.at.has('tokens') ? '' : t('wallet.tokensStillReading'),");
    const guard = 'if (!onScreen()) return { ok: false, error: t(\'wallet.swapPriceMoved\') };';
    expect(swap.split(guard).length - 1, 'after the password [2026-10-27], the pool read, the press\'s own quote [2026-10-24] and the jetton wallet read').toBe(4);
    expect(swap.lastIndexOf(guard)).toBeGreaterThan(swap.indexOf('readJettonWalletAddress('));
    expect(swap.lastIndexOf(guard)).toBeLessThan(swap.indexOf('const message = buildRouteMessage('));
  });

  it('R34-05 (F1-1): a press that meets a GRAM transfer on its way says so', () => {
    const flashes: string[] = [];
    const busy = new Set<string>([SELF]);
    const onItsWay = lift({ walletTonTransfersBusy: busy, sameWalletAddress: (a: string, b: string) => a === b, t,
      flashWalletIdentityStatus: (text: string) => { flashes.push(text); } }, [fn('function walletTransferOnItsWay(address) {')], 'walletTransferOnItsWay');
    expect([onItsWay(SELF), flashes]).toEqual([true, ['wallet.gramTransferSending']]);
    expect([onItsWay(OTHER), onItsWay(''), flashes.length], 'another wallet, or none: not busy, nothing said').toEqual([false, false, 1]);
    expect(code(fn('async function runWalletAssetSend(picked) {'))).toContain('if (!pressedBy || walletTransferOnItsWay(pressedBy)) return;');
    expect(code(fn('async function runWalletSwap(start = null, ask = null) {'))).toContain('if (!pressedBy || walletTransferOnItsWay(pressedBy)) return;');
    expect(code(fn('async function openWalletSendChooser() {'))).toContain('if (!plathoWallet || walletTransferOnItsWay(plathoWallet.address)) return;');
  });

  it('R34-06 (F2-2, F5-1, F5-2): the inks that win the cascade, and an ordinary balance whole', () => {
    const lastColour = (selector: string) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rules = [...code(css).matchAll(new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`, 'g'))].map((m) => m[1]);
      return rules.map((body) => body.match(/(?:^|;|\n)\s*color: ([^;]+);/)?.[1]).filter(Boolean).at(-1);
    };
    expect(lastColour('.wallet-card-send.is-secondary'), 'the token window\'s Swap: the panel\'s ink, since the window has its panel back [2026-10-23]').toBe('var(--text)');
    expect(lastColour('.wallet-card-copy'), 'the address to check').toBe('var(--text)');
    expect(lastColour('.wallet-card-send')).toBe('var(--cta-ink)');
    expect(css).toMatch(/\.wallet-asset-amount \{\s*max-width: 100%;/);
  });

  it('R34-07 (F4 L-2): the Settings row\'s read marker goes with the lock', () => {
    expect(code(fn('function forgetWalletSessionMarks() {'))).toContain("ownProfileReadAsked.wallet = '';");
  });
});
