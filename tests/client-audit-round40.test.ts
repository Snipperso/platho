import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { TELEGRAM_GIFT_COLLECTION_CODE_HASH, telegramGiftCollectionIsAuthentic } from '../web/telegram-gift-nfts.mjs';
import { listedNftCollection, parseJettonBalances, parseNftItems } from '../web/wallet-assets.mjs';
import { BURN_ADDRESS, BURN_VALUE_NANOTONS } from '../web/wallet-transfers.mjs';


const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const SVG_B64 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');
const SVG = `data:image/svg+xml;base64,${SVG_B64}`;
const USDT = '0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe';
const TELEGRAM_USERNAMES = '0:80d78a35f955a14b679faa887ff4cd5bfc0f43b4a4eea2a7e6927f3701b273c2';
const TON_DNS = '0:b774d95eb20543f186c06b371ab88ad704f7e256130caf96189368a7d0cb6ccf';
const ANONYMOUS_NUMBERS = '0:0e41dc1dc3c9067ed24248580e12b3359818d83dee0304fabcf80845eafafdb2';
const DUROVS_CAPS = '0:fd8a466aeb13e02a3ce67411b41b44bcd11bd42636f0807acf6570ca73fc2c13';
const DUROVS_CAPS_DATA_BOC =
  'te6ccgEBBQEArwAESYAAABLfHQ3koaSxignNG3FVwvqf99rxlgTH82d8KEprZvXkTEABAgMEAGYBaHR0cHM6Ly9uZnQu'
  + 'ZnJhZ21lbnQuY29tL2NvbGxlY3Rpb24vZHVyb3ZzY2FwLmpzb24IQgKR2eKsFp/Hhc4A3gqBrydiK5t9F2RBXHdeflDA'
  + 'POmKogAEAQAASwAFAGSADR50Dtpoo0MfqDwLjjaYBAqLqNZOrgycywS72hiTfgWQ';
const addr = (n: number) => `0:${n.toString(16).padStart(64, '0')}`;
const OWNER = addr(0x77);

function burnRig({ owner = OWNER, collection = addr(0x1234), collectionRecord = { codeHash: 'junk', dataBoc: 'te6junk', contentUri: '' } as any,
  collectionThrows = false } = {}) {
  const signed: any[] = [];
  const said: any[] = [];
  const wallet = { address: OWNER };
  const env: Record<string, any> = {
    plathoWallet: wallet,
    walletTransferOnItsWay: () => false,
    walletTonTransfersBusy: new Set(),
    activeWindowHoldsWork: { inHand: 0 },
    refreshMessagingControls: () => {},
    shortAddress: (a: string) => a.slice(0, 8),
    t: (key: string) => key,
    formatTonNanotonsUp: () => '0.05',
    formatUnits: (v: any) => String(v),
    balanceNeededText: () => 'needed',
    walletSendFeeReserveNanotons: () => 10_000_000n,
    walletAddressForCopy: (w: any) => w.address,
    BURN_VALUE_NANOTONS,
    BURN_ADDRESS,
    requireNoPendingServiceWorkerAppShellReload: () => {},
    requirePlathoWallet: () => wallet,
    sameWalletAddress: (a: string, b: string) => String(a).toLowerCase() === String(b).toLowerCase(),
    walletChangedBeforeSigningError: () => new Error('changed'),
    readJettonWalletAddress: async () => addr(0x99),
    criticalChainReadOptions: () => ({}),
    nextTransferQueryId: () => 1n,
    buildJettonTransferBody: (o: any) => ({ kind: 'jetton', ...o }),
    buildNftTransferBody: (o: any) => ({ kind: 'nft', ...o }),
    readNftOwner: async () => owner,
    readNftHolder: async () => ({ owner, collection }),
    parseTelegramGiftCollectionUri: () => null, TELEGRAM_GIFT_COLLECTION_CODE_HASH,
    setWalletAssetHidden: () => {},
    verifyTelegramGiftCollectionOnChain: async () => { if (collectionThrows) throw new Error('no live account state'); return collectionRecord; },
    telegramGiftCollectionIsAuthentic,
    sendWalletAssetMessage: async (_signer: any, message: any) => { signed.push(message); return true; },
    walletAssetSendRefusal: (error: any) => `refused: ${error?.code ?? error?.message}`,
    walletAssetsSent: () => {},
    flashWalletIdentityStatus: () => {},
    console: { error: () => {} },
    spendPasswordFields: () => [], spendPasswordRefusal: async () => '',
    openActionDialog: async ({ validateSubmit, summary }: any) => {
      said.push(...(summary?.() ?? []).map((line: any) => line.label));
      const answer = await validateSubmit({});
      said.push(answer.ok ? 'ok' : answer.error);
      return answer.ok ? answer.result : null;
    },
  };
  const burn = lift(env, [fn('async function runWalletAssetBurn(picked) {')], 'runWalletAssetBurn');
  return { burn, signed, said };
}

describe('client audit round 40', () => {
  it('R40-01 (F3-1): inline pictures only for what the app vouches for itself — ATH and the .ath registry; a listed issuer\'s are not drawn', () => {
    const ath = addr(0x938);
    const tokens = parseJettonBalances({
      jetton_wallets: [{ address: addr(1), balance: '5', jetton: USDT }, { address: addr(2), balance: '5', jetton: ath }],
      metadata: {
        [USDT.toUpperCase()]: { token_info: [{ valid: true, symbol: 'USDT', image: SVG, extra: { decimals: '6', image_data: SVG_B64 } }] },
        [ath.toUpperCase()]: { token_info: [{ valid: true, symbol: 'ATH', image: SVG, extra: { decimals: '9' } }] },
      },
    }, { alsoVerified: [ath] });
    const bySymbol = Object.fromEntries(tokens.map((token: any) => [token.symbol, token]));
    expect(bySymbol.USDT.verified).toBe(true);
    expect(bySymbol.USDT.picture, 'a listed issuer\'s inline bytes').toBe('');
    expect(bySymbol.ATH.picture, 'ATH, the app\'s own').toBe(SVG);
    const proxied = parseJettonBalances({ jetton_wallets: [{ address: addr(1), balance: '5', jetton: USDT }],
      metadata: { [USDT.toUpperCase()]: { token_info: [{ valid: true, symbol: 'USDT', image: 'https://imgproxy.toncenter.com/usdt.png', extra: { decimals: '6' } }] } } });
    expect(proxied[0].picture, 'toncenter\'s proxy still').toBe('https://imgproxy.toncenter.com/usdt.png');
    const registry = addr(0x4444);
    const listedItem = addr(0x5555);
    const ownItem = addr(0x6666);
    const nfts = parseNftItems({
      nft_items: [{ address: listedItem, collection_address: TELEGRAM_USERNAMES }, { address: ownItem, collection_address: registry }],
      metadata: {
        [listedItem.toUpperCase()]: { token_info: [{ valid: true, name: '@someone', extra: { image_data: SVG_B64 } }] },
        [ownItem.toUpperCase()]: { token_info: [{ valid: true, name: 'tiles.ath', extra: { image_data: SVG_B64 } }] },
      },
    }, { verifiedCollections: [registry] });
    expect(nfts.find((item: any) => item.address === listedItem)).toMatchObject({ verified: true, picture: '' });
    expect(nfts.find((item: any) => item.address === ownItem), 'the registry\'s art from the profile\'s list now [round 41 — F3-2]').toMatchObject({ verified: true, picture: '' });
  });

  it('R40-02 (F3-2, F1-1): the bin never burns a Telegram gift — the item is read now and its collection judged at the press', async () => {
    const authentic = { codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: DUROVS_CAPS_DATA_BOC, contentUri: 'https://nft.fragment.com/collection/durovscap.json' };
    expect(telegramGiftCollectionIsAuthentic(authentic), 'the fixture is a genuine gift collection').toBe(true);
    const item = { address: addr(0x7171), collection: DUROVS_CAPS, name: 'Durov\'s Cap #4242', verified: false };
    const gift = burnRig({ collection: DUROVS_CAPS, collectionRecord: authentic });
    await gift.burn({ kind: 'nft', item });
    expect(gift.signed, 'a genuine gift: nothing signed').toEqual([]);
    expect(gift.said).toContain('wallet.burnGift');

    const unread = burnRig({ collectionThrows: true });
    await unread.burn({ kind: 'nft', item: { ...item, collection: addr(0x1234) } });
    expect(unread.signed, 'a collection that cannot be read: nothing burned').toEqual([]);

    const stranger = burnRig({ owner: addr(0x88) });
    await stranger.burn({ kind: 'nft', item: { ...item, collection: addr(0x1234) } });
    expect(stranger.signed, 'no longer this wallet\'s').toEqual([]);

    const junk = burnRig();
    await junk.burn({ kind: 'nft', item: { ...item, collection: addr(0x1234), name: 'junk' } });
    expect(junk.signed).toHaveLength(1);
    expect(junk.signed[0]).toMatchObject({ address: item.address, value: BURN_VALUE_NANOTONS, body: { kind: 'nft', newOwner: BURN_ADDRESS, forwardAmount: 0n } });

    const verified = burnRig();
    await verified.burn({ kind: 'nft', item: { ...item, verified: true } });
    expect(verified.signed, 'a verified row never reaches the bin').toEqual([]);
  });

  it('R40-03 (F5-2): the burn says, as a send does, from where, how much goes and what the balance must hold', async () => {
    const jetton = burnRig();
    await jetton.burn({ kind: 'jetton', token: { master: addr(0x31), wallet: addr(0x99), balance: '123', decimals: 0, symbol: 'JUNK', verified: false } });
    expect(jetton.said.slice(0, 3)).toEqual(['wallet.from', 'wallet.burnAmount', 'common.balanceNeeded']);
    expect(jetton.signed).toHaveLength(1);
  });

  it('R40-04 (F5-1; round 39 F5-1, round 35 F3-2): what a cut proof proved is kept and drawn; "not a gift" is still said only from a whole list', async () => {
    const cache = new Map();
    let answer: any = null;
    const env = {
      telegramGiftListCache: cache, telegramGiftPassesInFlight: new Map(),
      parseTonAddress: (a: string) => ({ raw: a }),
      TELEGRAM_GIFT_CACHE_TTL_MS: 300_000,
      Date,
      discoverTelegramGiftItems: async () => [],
      toncenterRestOrigin: () => '',
      readStoredToncenterApiKey: () => '',
      createToncenterRestFetch: () => null,
      collectOwnedTelegramGifts: async () => answer,
      enqueueGiftChainRead: (f: any) => f(),
      verifyTelegramGiftItemOnChain: null, verifyTelegramGiftCollectionOnChain: null, verifyTelegramGiftMembershipOnChain: null,
      console: { warn: () => {} },
    };
    const sources = [fn('function cachedTelegramGiftsForWallet(wallet) {'), fn('function provenTelegramGiftsForWallet(wallet) {'),
      fn('async function loadTelegramGiftsForWallet(wallet, options = {}) {')];
    const api = lift(env, sources, '{ cached: cachedTelegramGiftsForWallet, proven: provenTelegramGiftsForWallet, load: loadTelegramGiftsForWallet }');
    const gift = { itemAddress: addr(0x12) };
    answer = { gifts: [gift], transferred: [], complete: false };
    await api.load(OWNER);
    expect(api.proven(OWNER)?.gifts, 'the proven gift is kept').toEqual([gift]);
    expect(api.cached(OWNER), 'not a whole list').toBe(null);
    answer = { gifts: [gift], transferred: [], complete: true };
    await api.load(OWNER);
    expect(api.cached(OWNER)?.complete, 'a cut list is read again, and the whole one kept').toBe(true);
    answer = { gifts: [gift], transferred: [], complete: false };
    await api.load(OWNER, { force: true });
    expect(api.cached(OWNER)?.complete, 'a cut pass does not replace a whole list').toBe(true);
    const tab = code(fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {'));
    expect(tab).toContain('?? provenTelegramGiftsForWallet(owner);');
    expect(tab).toContain('if (!(raced ? late?.advanced : ((late?.complete && late !== gifts) || late?.advanced)) || owner !== state.owner) return;');
  });

  it('R40-05 (F6-1): a picture is the icon\'s background, not a node — the grid is not laid out again for each', async () => {
    let created = 0;
    const node: any = { style: {}, classList: { names: new Set(), add(n: string) { this.names.add(n); } }, textContent: '', replaceChildren: () => { throw new Error('no node'); },
      setAttribute: () => {} };
    const env = {
      document: { createElement: (tag: string) => { created += 1; if (tag !== 'span') throw new Error(`no <${tag}>`); return node; } },
      whenWalletIconSeen: (_icon: any, start: () => void) => start(),
      walletPicture: async (url: string) => url,
    };
    const icon = lift(env, [fn("function walletAssetIcon(picture, letter, className = 'wallet-asset-icon', { shared = false } = {}) {"), fn('function paintWalletAssetIcon(icon, picture, { shared = false } = {}) {')], 'walletAssetIcon');
    icon(SVG, 'A', 'wallet-nft-picture');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(created).toBe(1);
    expect(node.style.backgroundImage).toBe(`url("${SVG}")`);
    expect(node.classList.names.has('has-picture')).toBe(true);
    expect(css).toMatch(/\.wallet-nft-picture\.has-picture \{\s*color: transparent;[^}]*background-size: cover;/);
  });

  it('R40-06: .ton domains and +888 numbers are verified — and so carry no bin', () => {
    expect(listedNftCollection(TON_DNS)).toBe(true);
    expect(listedNftCollection(ANONYMOUS_NUMBERS.toUpperCase())).toBe(true);
    expect(listedNftCollection(addr(0x1234))).toBe(false);
    const domain = addr(0xd0);
    const number = addr(0xd1);
    const items = parseNftItems({ nft_items: [{ address: domain, collection_address: TON_DNS }, { address: number, collection_address: ANONYMOUS_NUMBERS }], metadata: {} });
    expect(items.map((item: any) => item.verified)).toEqual([true, true]);
  });

  it('R40-07 (F2-1, F1-2): "Swap ATH" only when ATH is among the offers; the GRAM card\'s Send during a transfer says so', () => {
    expect(code(fn('function openWalletTokenCard(token, { refill = false } = {}) {'))).toContain("walletSwapOffers().some((offer) => offer.id === token.master)");
    expect(code(fn('function openWalletGramCard() {'))).toContain('walletCardSend(() => { if (!walletTransferOnItsWay(plathoWallet?.address ?? null)) sendWalletTonButton?.click(); }),');
  });
});
