import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { TELEGRAM_GIFT_COLLECTION_CODE_HASH, collectOwnedTelegramGifts } from '../web/telegram-gift-nfts.mjs';
import { WALLET_NFT_PAGE, inlinePictureOf, parseJettonBalances, parseNftItems } from '../web/wallet-assets.mjs';
import { ASSET_PICTURES } from '../web/asset-pictures.mjs';
import { DEDUST_TOKENS } from '../web/dedust-pools.mjs';
import { SWAP_TOKENS } from '../web/swap-pools.mjs';
import { BURN_ADDRESS, BURN_VALUE_NANOTONS } from '../web/wallet-transfers.mjs';


const app = readFileSync('web/app.js', 'utf8');
const appCode = code(app);
const css = readFileSync('web/styles.css', 'utf8');
const html = readFileSync('web/index.html', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const OWNER = `0:${'11'.repeat(32)}`;
const DUROVS_CAPS = '0:fd8a466aeb13e02a3ce67411b41b44bcd11bd42636f0807acf6570ca73fc2c13';
const DUROVS_CAPS_DATA_BOC =
  'te6ccgEBBQEArwAESYAAABLfHQ3koaSxignNG3FVwvqf99rxlgTH82d8KEprZvXkTEABAgMEAGYBaHR0cHM6Ly9uZnQu'
  + 'ZnJhZ21lbnQuY29tL2NvbGxlY3Rpb24vZHVyb3ZzY2FwLmpzb24IQgKR2eKsFp/Hhc4A3gqBrydiK5t9F2RBXHdeflDA'
  + 'POmKogAEAQAASwAFAGSADR50Dtpoo0MfqDwLjjaYBAqLqNZOrgycywS72hiTfgWQ';
const addr = (n: number) => `0:${n.toString(16).padStart(64, '0')}`;
const SVG_B64 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');

describe('client audit round 39', () => {
  it('R39-01 (F3-1, F6-1): a collection whose read fails is asked once a pass and counted — a thousand items naming a dead one cost one read', async () => {
    const reads = { items: 0, collections: new Map<string, number>() };
    const GENUINE = `0:${'aa'.repeat(32)}`;
    const result = await collectOwnedTelegramGifts({
      ownerWallet: OWNER,
      indexerItems: [...Array.from({ length: 998 }, (_unused, i) => ({ itemAddress: addr(0x1000 + i), collectionAddress: addr(0xdead) })),
        { itemAddress: GENUINE, collectionAddress: DUROVS_CAPS }],
      verifyItem: async () => { reads.items += 1; return { index: 37n, collectionAddress: DUROVS_CAPS, ownerWallet: OWNER, contentUri: 'https://nft.fragment.com/gift/durovscap-37.json' }; },
      verifyCollection: async (address: string) => {
        reads.collections.set(address, (reads.collections.get(address) ?? 0) + 1);
        if (address !== DUROVS_CAPS) throw new Error('no such account');
        return { codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: DUROVS_CAPS_DATA_BOC, contentUri: 'https://nft.fragment.com/collection/durovscap.json' };
      },
      verifyMembership: async () => GENUINE,
    });
    expect(result.gifts.map((gift: any) => gift.itemAddress)).toEqual([GENUINE]);
    expect([reads.collections.get(addr(0xdead)), reads.collections.get(DUROVS_CAPS), reads.items]).toEqual([1, 1, 1]);
    expect(result.complete, 'a failed read proves nothing: incomplete, never "no gifts"').toBe(false);
  });

  it('R39-02 (F4-1, F6-3): every fetch the app makes says no-store — nothing it reads is left in the browser\'s disk cache', () => {
    for (const file of ['web/app.js', 'web/wallet-assets.mjs', 'web/telegram-gift-nfts.mjs', 'web/username-nft-owned.mjs', 'web/shard-rpc.mjs']) {
      const text = code(readFileSync(file, 'utf8'));
      const calls = [...text.matchAll(/(?<![\w.])(fetch|fetchImpl|doFetch)\(/g)].map((m) => {
        const tail = text.slice(m.index!, m.index! + 420);
        const end = tail.indexOf(');');
        return end > 0 ? tail.slice(0, end) : tail;
      });
      expect(calls.length, file).toBeGreaterThan(0);
      const shared = calls.filter((call) => call.includes("cache: shared ? 'default' : 'no-store'"));
      expect(shared.length, `${file}: the one shared-picture fetch`).toBe(file === 'web/app.js' ? 1 : 0);
      for (const call of calls) if (!shared.includes(call)) expect(call, `${file}: ${call.slice(0, 90)}`).toContain("cache: 'no-store'");
    }
    const transport = code(readFileSync('web/ton-rpc-transport.mjs', 'utf8'));
    const sites = [...transport.matchAll(/(?<!function )fetchWithTonRpcTimeout\(/g)].map((m) => transport.slice(m.index!, transport.indexOf('Ms)', m.index!)));
    expect(sites.length).toBeGreaterThan(5);
    for (const site of sites) {
      const options = site.includes('fetchOptions') ? transport.match(/const fetchOptions = \{[^}]*\}/)?.[0] ?? '' : site;
      expect(/cache: 'no-store'|method: 'POST'/.test(options), `ton-rpc-transport: ${site.slice(0, 90)}`).toBe(true);
    }
  });

  it('R39-03 (F6-2): with no disk cache, the in-memory pictures hold a whole page', () => {
    expect(code(fn('function walletPicture(url, { shared = false } = {}) {'))).toContain('rememberInBoundedCache(walletPictureCache, url, pending, WALLET_NFT_PAGE);');
    expect(WALLET_NFT_PAGE).toBe(1000);
  });

  it('R39-04: verified assets draw the image they carry on chain — own .ath names, ATH; unverified ones still draw none', () => {
    expect(inlinePictureOf({ extra: { image_data: SVG_B64 } })).toBe(`data:image/svg+xml;base64,${SVG_B64}`);
    expect(inlinePictureOf({ image: `data:image/svg+xml;base64,${SVG_B64}` })).toBe(`data:image/svg+xml;base64,${SVG_B64}`);
    expect(inlinePictureOf({ extra: { image_data: 'iVBORw0KGgoAAAA' } })).toBe('data:image/png;base64,iVBORw0KGgoAAAA');
    expect(inlinePictureOf({ extra: { image_data: 'AAAAAAAA' } }), 'an unknown kind').toBe('');
    expect(inlinePictureOf({ extra: { image_data: 'P'.repeat(70_000) } }), 'too big').toBe('');
    expect(inlinePictureOf({ image: 'javascript:alert(1)' })).toBe('');
    const registry = addr(0x4444);
    const item = addr(0x5555);
    const payload = { nft_items: [{ address: item, collection_address: registry }], metadata: { [item.toUpperCase()]: { token_info: [{ valid: true, name: 'tiles.ath', extra: { image_data: SVG_B64 } }] } } };
    expect(parseNftItems(payload, { verifiedCollections: [registry] })[0].picture, 'no inline art for an NFT').toBe('');
    expect(parseNftItems(payload)[0].picture, 'unverified: none').toBe('');
    const ath = addr(0x938);
    const tokens = parseJettonBalances({ jetton_wallets: [{ address: addr(1), balance: '5', jetton: ath }],
      metadata: { [ath.toUpperCase()]: { token_info: [{ valid: true, symbol: 'ATH', image: `data:image/svg+xml;base64,${SVG_B64}`, extra: { decimals: '9' } }] } } }, { alsoVerified: [ath] });
    expect(tokens[0].picture).toBe(`data:image/svg+xml;base64,${SVG_B64}`);
    const picture = lift({ walletPictureCache: new Map(), fetch: () => { throw new Error('no request for a data image'); } }, [fn('function walletPicture(url, { shared = false } = {}) {')], 'walletPicture');
    return picture(`data:image/svg+xml;base64,${SVG_B64}`).then((url: string) => expect(url).toBe(`data:image/svg+xml;base64,${SVG_B64}`));
  });

  it('R39-05: the swap list, ATH and GRAM have pictures; rows ask for theirs as they come into view; the picker scrolls', () => {
    expect(ASSET_PICTURES['0:938738adccf5e6d9d1fda6c69591996401c1eacc2263701a43dbd6f9725a2c35'], 'ATH, carried on chain').toMatch(/^data:image\//);
    expect(Object.values(ASSET_PICTURES).every((url) => /^(data:image\/|https:\/\/(img)?proxy\.toncenter\.com\/)/.test(url)), 'toncenter\'s proxy or inline only').toBe(true);
    expect(readFileSync('scripts/build_asset_pictures.mjs', 'utf8')).toContain('...DEDUST_TOKENS.map(([id]) => fromId(id))');
    const rawOf = (id: string) => `0:${Buffer.from(id, 'base64url').toString('hex')}`;
    const stonfi = new Set(SWAP_TOKENS.map(([id]: any) => rawOf(id)));
    const dedustOnly = DEDUST_TOKENS.map(([id]: any) => rawOf(id)).filter((id: string) => !stonfi.has(id));
    expect(dedustOnly.filter((id: string) => ASSET_PICTURES[id]).length, 'of the tokens DeDust alone lists').toBeGreaterThan(150);
    expect(code(fn('function walletSwapPickerItems(side, offers, offerId) {'))).toContain('picture: token?.picture || (item.id === GRAM ? gramPicture() : assetPicture(item.id)),');
    expect(code(fn('function gramPicture() {'))).toMatch(/return 'data:image\/svg\+xml;base64,/);
    const seen: Array<() => void> = [];
    let started = 0;
    class FakeObserver { cb: any; constructor(cb: any) { this.cb = cb; seen.push(() => cb([{ isIntersecting: true }])); } observe() {} disconnect() {} }
    const whenSeen = lift({ IntersectionObserver: FakeObserver }, [fn('function whenWalletIconSeen(icon, start) {')], 'whenWalletIconSeen');
    whenSeen({}, () => { started += 1; });
    expect(started, 'not before it is seen').toBe(0);
    seen[0]();
    expect(started).toBe(1);
    expect(css).toMatch(/\.wallet-asset-list\.swap-picker-list \{\s*align-content: start;\s*min-height: 0;\s*overflow-y: auto;\s*\}/);
  });

  it('R39-06: a bin beside Send for unverified tokens and NFTs only — a transfer of it to the zero address, 0.05 GRAM, one at a time', () => {
    expect(BURN_ADDRESS).toBe(`0:${'0'.repeat(64)}`);
    expect(BURN_VALUE_NANOTONS).toBe(50_000_000n);
    expect(code(fn('function openWalletTokenCard(token, { refill = false } = {}) {'))).toContain('token.verified ? null : walletCardBurn(() => runWalletAssetBurn({ kind: \'jetton\', token }))');
    expect(code(fn('function walletCardNftActions(item) {'))).toContain('item.verified === false ? walletCardBurn(() => runWalletAssetBurn({ kind: \'nft\', item })) : null');
    const burn = code(fn('async function runWalletAssetBurn(picked) {'));
    expect(burn).toContain('if (!pressedBy || walletTransferOnItsWay(pressedBy)) return;');
    expect(burn).toContain("if (picked.kind === 'jetton' ? picked.token?.verified : picked.item?.verified !== false) return;");
    expect(burn).toContain('buildJettonTransferBody({ queryId: nextTransferQueryId(), amount, destination: BURN_ADDRESS, responseDestination: signer.address, forwardTonAmount: 0n })');
    expect(burn).toContain('buildNftTransferBody({ queryId: nextTransferQueryId(), newOwner: BURN_ADDRESS, responseDestination: signer.address, forwardAmount: 0n })');
    expect(burn, 'the NFT still this wallet\'s, read now').toMatch(/readNftHolder\(\{[\s\S]{0,300}?\}\);[^\n]*\n\s*if \(!sameWalletAddress\(held\.owner, signer\.address\)\) throw/);
    expect(burn.split('sendWalletAssetMessage(signer,').length - 1, 'signed through the one path that checks the wallet and the GRAM').toBe(2);
    expect(burn).toMatch(/try \{\s*refreshMessagingControls\(\);/);
    expect(burn).toMatch(/finally \{[\s\S]*walletTonTransfersBusy\.delete\(pressedBy\);/);
  });

  it('R39-07: GRAM\'s row opens its card with Send and Swap; ATH\'s group starts with Send and Swap; a swap through too shallow a pool is refused', () => {
    expect(appCode).toContain("balanceRow: 'TON', onOpen: () => openWalletGramCard() }));");
    const gram = code(fn('function openWalletGramCard() {'));
    expect(gram).toContain('walletCardSend(() => { if (!walletTransferOnItsWay(plathoWallet?.address ?? null)) sendWalletTonButton?.click(); }),');
    expect(gram).toContain("...(swapRoutesFrom(GRAM).length ? [walletCardSend(() => runWalletSwap(GRAM), t('wallet.actionSwap'), 'is-secondary')] : []),");
    expect(appCode).toContain("balanceRow: 'ATH', onOpen: () => openWalletAthCard() }));");
    expect(code(fn('function openWalletAthCard() {'))).toContain('if (token) openWalletTokenCard(token);');
    const swap = code(fn('async function openWalletSwapDialog(start, hold, asked = null) {'));
    expect(appCode).toContain('const WALLET_SWAP_IMPACT_MAX_BPS = 1500;');
    expect(swap).toContain("if (quoted.impactBps >= WALLET_SWAP_IMPACT_MAX_BPS) return { ok: false, error: t('wallet.swapTooShallow', { percent: walletSwapPercent(quoted.impactBps) }) };");
    expect(swap).toMatch(/const pressQuote = await estimateRoute\(\{ transport: transport\(\), route, pool: fresh, amountIn: amount, callOptions: criticalChainReadOptions\(\) \}\);\s*if \(!onScreen\(\)\) return \{ ok: false, error: t\('wallet\.swapPriceMoved'\) \};\s*if \(pressQuote\.out <= 0n\) return \{ ok: false, error: t\('wallet\.swapNothingOut'\) \};\s*if \(pressQuote\.impactBps >= WALLET_SWAP_IMPACT_MAX_BPS\) \{/);
    expect(swap.indexOf('pressQuote.impactBps >= WALLET_SWAP_IMPACT_MAX_BPS'), 'before anything is signed').toBeLessThan(swap.indexOf('const message = buildRouteMessage('));
  });
});
