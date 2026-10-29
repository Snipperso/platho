import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { WALLET_NFT_PAGE, WALLET_TOKEN_PAGE, decimalsOf, parseJettonBalances, parseNftItems, parseWalletHistory } from '../web/wallet-assets.mjs';
import { I18N_LOCALES, I18N_STRINGS } from '../web/i18n-strings.mjs';


const app = readFileSync('web/app.js', 'utf8');
const appCode = code(app);
const css = readFileSync('web/styles.css', 'utf8');
const verified = readFileSync('web/verified-assets.mjs', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const t = (key: string) => key;
const USDT = '0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe';
const SELF = `0:${'11'.repeat(32)}`;
const OTHER = `0:${'22'.repeat(32)}`;
const FAKE = `0:${'33'.repeat(32)}`;
const master = (symbol: string, extra: Record<string, any> = {}, rest: Record<string, any> = {}) => ({
  token_info: [{ valid: true, type: 'jetton_masters', name: symbol, symbol, extra, ...rest }],
});

describe('client audit round 32 — what a wallet signs', () => {
  it('R32-01 (F3-1, HIGH): the verified list holds 128 bits of every id, so a look-alike must match all of them', () => {
    const packed = [...verified.matchAll(/const (JETTONS|COLLECTIONS) = '([0-9a-f]*)';/g)].map((m) => m[2]);
    expect(packed).toHaveLength(2);
    for (const list of packed) expect(list.length % 32, 'whole 32-hex entries').toBe(0);
    expect(packed[0].length / 32).toBe(Number(verified.match(/VERIFIED_JETTON_COUNT = (\d+)/)?.[1]));
    expect(packed[1].length / 32).toBe(Number(verified.match(/VERIFIED_COLLECTION_COUNT = (\d+)/)?.[1]));
    expect(verified).toContain('indexes.get(packed).has(hex.slice(0, 32))');
  });

  it('R32-02 (F2-1): decimals nobody states are unknown, never 9 — and nothing is signed with unknown decimals', () => {
    expect([decimalsOf({ extra: { decimals: '6' } }), decimalsOf({ extra: { decimals: 6 } }), decimalsOf({ extra: { decimals: ' 9 ' } })]).toEqual([6, 6, 9]);
    expect([decimalsOf({ extra: { decimals: '' } }), decimalsOf({ extra: { decimals: null } }), decimalsOf({}), decimalsOf({ extra: { decimals: '37' } }),
      decimalsOf({ extra: { decimals: '6.5' } }), decimalsOf({ extra: { decimals: '-1' } })]).toEqual([null, null, null, null, null, null]);
    const tokens = parseJettonBalances({
      jetton_wallets: [{ address: OTHER, balance: '5', jetton: FAKE }, { address: SELF, balance: '7', jetton: USDT }],
      metadata: { [FAKE.toUpperCase()]: master('ODD'), [USDT.toUpperCase()]: master('USD₮', { decimals: '6' }) },
    });
    expect(tokens.map((one: any) => [one.symbol, one.decimals, one.decimalsKnown])).toEqual([['USD₮', 6, true], ['ODD', 9, false]]);
    const listed = new Map([[USDT, { decimals: 6, symbol: 'USD₮' }]]);
    const walletTokenDecimals = lift({ swapListedToken: (id: string) => listed.get(id) ?? null }, [fn('function walletTokenDecimals(token) {')], 'walletTokenDecimals');
    expect(walletTokenDecimals({ master: USDT, decimals: 9, decimalsKnown: true }), 'the snapshot over the index').toBe(6);
    expect(walletTokenDecimals({ master: FAKE, decimals: 9, decimalsKnown: false }), 'unstated').toBeNull();
    expect(walletTokenDecimals({ master: FAKE, decimals: 4, decimalsKnown: true })).toBe(4);
    expect(walletTokenDecimals({ master: FAKE, decimals: 'x' })).toBeNull();
    expect(walletTokenDecimals({ master: FAKE, decimals: 40 })).toBeNull();
    const send = code(fn('async function openWalletJettonTransferDialog(token, hold) {'));
    expect(send).toMatch(/const decimals = walletTokenDecimals\(token\);\s*if \(decimals === null\) return t\('wallet\.tokenDecimalsUnknown'\);/);
    expect(send, 'no other source of decimals in the dialog').not.toMatch(/token\.decimals/);
    const offers = code(fn('function walletSwapOffers() {'));
    expect(offers).toContain('const listed = swapListedToken(token.master);');
    expect(offers).toContain('decimals: listed?.decimals ?? walletTokenDecimals(token) ?? 9');
    expect(offers, 'a swap offer only where a snapshot has routes, so listed is there').toContain('!swapRoutesFrom(token.master).length) continue;');
  });

  it('R32-03 (F1-1/F5-1): the comment of a token or NFT send is optional, as its label says', () => {
    for (const start of ['async function openWalletJettonTransferDialog(token, hold) {', 'async function openWalletNftTransferDialog(item, hold) {']) {
      expect(code(fn(start))).toContain("{ id: 'comment', label: t('wallet.commentOptional'), type: 'text', autocomplete: 'off', required: false }");
    }
  });

  it('R32-04 (F1-2): what was broadcast is "submitted", never "sent" — the token, the item and the router each run later and may bounce', () => {
    expect(code(fn('async function openWalletJettonTransferDialog(token, hold) {'))).toContain("outcome = t('wallet.tokenSubmitted', { symbol });");
    expect(code(fn('async function openWalletNftTransferDialog(item, hold) {'))).toContain("outcome = t('wallet.nftSubmitted');");
    expect(appCode).toContain("outcome = t('wallet.swapSubmitted');");
    for (const retired of ['wallet.tokenSent', 'wallet.nftSent', 'wallet.swapSent']) {
      expect(appCode, retired).not.toContain(`'${retired}'`);
      for (const locale of I18N_LOCALES) expect((I18N_STRINGS as any)[locale.code][retired], `${retired} retired`).toBeUndefined();
    }
  });

  it('R32-05 (F1-2): ATH at zero is not offered to send; its balance is the corner\'s when the index has no row', () => {
    const walletAthToken = (held: any, tokens: any[] = []) => lift({
      walletAthMaster: () => FAKE, vaultPocketState: { wallet: { ath_balance: held } }, walletAssetsState: { tokens },
    }, [fn('function walletAthToken() {')], 'walletAthToken')();
    expect(walletAthToken(0n).balance).toBe(0n);
    expect(walletAthToken(12n).balance).toBe(12n);
    expect(walletAthToken(undefined).balance, 'unknown, not zero').toBeNull();
    expect(walletAthToken(0n, [{ master: FAKE, balance: '9' }]).balance, 'the index row first').toBe('9');
    const chooser = code(fn('async function openWalletSendChooser() {'));
    expect(chooser).toMatch(/const athHeld = ath && ath\.balance !== null && ath\.balance !== undefined \? BigInt\(ath\.balance\) : null;\s*if \(ath && athHeld !== 0n\) \{/);
  });

  it('R32-06 (F1-5), as round 33 rebuilt it (F1-1): the token\'s own contract gets no token or NFT — by comparison, no seqno probe', () => {
    const recipient = code(fn('async function walletTransferRecipient(entered, seenRecipient, ownContracts = []) {'));
    expect(recipient).not.toContain('transferRecipientAccountKind');
    expect(recipient).toContain('const refusal = await transferRecipientRefusal(resolved, entered, seenRecipient, { ownContracts });');
    expect(code(fn('async function openWalletJettonTransferDialog(token, hold) {'))).toContain('walletTransferRecipient(');
    expect(code(fn('async function openWalletNftTransferDialog(item, hold) {'))).toContain('walletTransferRecipient(');
  });
});

describe('client audit round 32 — what a wallet shows', () => {
  it('R32-07 (F3-2): a scam token\'s transfer is not history, and an unverified one says so', () => {
    const rows = parseWalletHistory({
      actions: [
        { type: 'jetton_transfer', success: true, end_utime: 300, action_id: 'scam', details: { asset: FAKE, sender: OTHER, receiver: SELF, amount: '5' } },
        { type: 'jetton_transfer', success: true, end_utime: 200, action_id: 'odd', details: { asset: OTHER, sender: OTHER, receiver: SELF, amount: '5' } },
        { type: 'jetton_transfer', success: true, end_utime: 100, action_id: 'usdt', details: { asset: USDT, sender: OTHER, receiver: SELF, amount: '5' } },
      ],
      metadata: { [FAKE.toUpperCase()]: master('USD₮', { decimals: '6' }, { is_scam: true }), [OTHER.toUpperCase()]: master('ODD'), [USDT.toUpperCase()]: master('USD₮', { decimals: '6' }) },
    }, SELF);
    expect(rows.map((row: any) => [row.id, row.verified])).toEqual([['odd', false], ['usdt', true]]);
    expect(parseWalletHistory({ actions: [{ type: 'jetton_transfer', end_utime: 1, action_id: 'a', details: { asset: OTHER, sender: OTHER, receiver: SELF, amount: '1' } }],
      metadata: { [OTHER.toUpperCase()]: master('ATH') } }, SELF, { alsoVerified: [OTHER] })[0].verified, 'the app\'s own ATH').toBe(true);
    expect(code(fn('function renderWalletHistory(panel) {')))
      .toContain("const unverified = (row.kind === 'jetton' || (row.kind === 'nft' && incoming)) && row.verified === false && !stranger ? t('wallet.tokenUnverified') : '';");
  });

  it('R32-08 (F3-3): the index is read 1000 rows at a time — its maximum (1001 is refused)', () => {
    expect([WALLET_TOKEN_PAGE, WALLET_NFT_PAGE]).toEqual([1000, 1000]);
  });

  it('R32-09 (F3-4): the app\'s own .ath names are verified NFTs — the registry is passed as a verified collection', () => {
    const registry = `0:${'44'.repeat(32)}`;
    const payload = { nft_items: [{ address: OTHER, collection_address: registry }], metadata: {} };
    expect(parseNftItems(payload)[0].verified).toBe(false);
    expect(parseNftItems(payload, { verifiedCollections: [registry] })[0].verified).toBe(true);
    expect(parseNftItems({ ...payload, metadata: { [OTHER.toUpperCase()]: { token_info: [{ valid: true, is_scam: true }] } } }, { verifiedCollections: [registry] })[0].verified,
      'scam still loses').toBe(false);
    expect(appCode).toContain('verifiedCollections: [registry].filter(Boolean)');
  });

  it('R32-10 (F5-2): a balance row shows the corner\'s figure, or a dash while it is not known — never "0 GRAM" or the last wallet\'s', () => {
    const row = (known: boolean) => lift({ navVaultBalanceShowable: () => known, walletFormattedBalance: (asset: string) => (asset === 'ATH' ? '3' : '1.5') },
      [fn('function walletBalanceRowText(asset) {')], 'walletBalanceRowText');
    expect([row(true)('TON'), row(true)('ATH'), row(false)('TON'), row(false)('ATH')]).toEqual(['1.5 GRAM', '3 ATH', '—', '—']);
    const corner = code(fn('function refreshNavVaultBalance() {'));
    expect(corner).toContain("for (const node of document.querySelectorAll('[data-wallet-balance-row]')) {");
    expect(corner).toContain('setText(node, walletBalanceRowText(node.dataset.walletBalanceRow));');
    const chooser = code(fn('async function openWalletSendChooser() {'));
    expect(chooser).toContain("amount: walletBalanceRowText('TON'), balanceRow: 'TON'");
    expect(chooser).toContain("amount: walletBalanceRowText('ATH'), balanceRow: 'ATH'");
  });

  it('R32-11 (F4-1/F1-4/F5-3): the token window leaves with a lock and with the wallet', () => {
    expect(code(fn('function closeSessionOverlays() {'))).toContain('forgetWalletGroup();');
    expect(code(fn('function resetWalletAssets(owner) {'))).toContain('forgetWalletGroup();');
    const forget = code(fn('function forgetWalletGroup() {'));
    expect(forget).toContain("const dialog = document.querySelector('#walletGroupDialog');");
    expect(forget).toContain('if (dialog) dialog.hidden = true;');
    expect(forget).toContain("document.querySelector('#walletTokenCardHead')?.replaceChildren();");
    expect(forget).toContain("document.querySelector('#walletTokenCardStats')?.replaceChildren();");
  });

  it('R32-12 (F6-3): a pressed Send or Swap shows it is busy, waits 8 s at most, and a second press does nothing', async () => {
    const tile = () => { const attrs = new Map<string, string>(); return { attrs, getAttribute: (k: string) => attrs.get(k) ?? null,
      setAttribute: (k: string, v: string) => { attrs.set(k, v); }, removeAttribute: (k: string) => { attrs.delete(k); } }; };
    let release: () => void = () => {};
    const capped: number[] = [];
    const busy = lift({ delay: (ms: number) => { capped.push(ms); return new Promise<void>((resolve) => { release = resolve; }); } },
      [fn('async function whileWalletTileBusy(tile, work) {')], 'whileWalletTileBusy');
    const one = tile();
    let worked = 0;
    const first = busy(one, () => new Promise(() => { worked += 1; }));
    expect(one.getAttribute('aria-busy')).toBe('true');
    expect(await busy(one, async () => { worked += 10; }), 'the second press').toBe(false);
    expect(worked, 'its work never ran').toBe(1);
    release();
    expect(await first).toBe(true);
    expect(capped).toEqual([8_000]);
    expect(one.getAttribute('aria-busy')).toBeNull();
    const failed = tile();
    expect(await busy(failed, async () => { throw new Error('read failed'); }), 'a failed read still opens the window').toBe(true);
    expect(failed.getAttribute('aria-disabled')).toBeNull();
    expect(code(fn('async function openWalletSendChooser() {'))).not.toContain('whileWalletTileBusy(');
    expect(code(fn('async function openWalletSendChooser() {'))).toContain("note.textContent = t('wallet.tokensStillReading');");
    expect(appCode).toMatch(/whileWalletTileBusy\(walletSwapAction,/);
  });

  it('R32-13 (F5-5): a long name stays inside the token window', () => {
    expect(css).toMatch(/\.wallet-group-dialog,\s*\.wallet-group-body,\s*\.wallet-asset-list,\s*\.action-dialog \{\s*grid-template-columns: minmax\(0, 1fr\);\s*\}/);
  });
});

describe('client audit round 32 — the profile and its card', () => {
  it('R32-14 (F5-4): a profile not read is not published over — the person is told, nothing is signed', async () => {
    const notices: string[] = [];
    const read = (cached: any, resolved: () => Promise<any>) => lift({ cachedChannelProfile: () => cached, resolveChannelProfile: resolved,
      showAppNotice: (text: string) => { notices.push(text); }, t }, [fn('async function readOwnProfileForPublish(wallet) {')], 'readOwnProfileForPublish');
    expect(await read(null, async () => { throw new Error('offline'); })(SELF)).toBeNull();
    expect(await read({ description: '' }, async () => ({ description: '' }))(SELF), 'an answer that was never a read').toBeNull();
    expect(notices).toEqual(['profile.publishUnread', 'profile.publishUnread']);
    const fresh = { description: 'mine', fetchedAt: 5 };
    expect(await read(null, async () => fresh)(SELF)).toBe(fresh);
    expect(await read(fresh, async () => { throw new Error('not asked'); })(SELF), 'a read profile in the cache').toBe(fresh);
    expect(notices).toHaveLength(2);
    expect(code(fn('async function offerProfileBlockPublish('))).toMatch(/const current = await readOwnProfileForPublish\(wallet\);\s*if \(!current\) return false;/);
    expect(code(fn('async function openEditChannelProfileDialog('))).toMatch(/const current = await readOwnProfileForPublish\(wallet\);\s*if \(!current\) return null;/);
  });

  it('R32-15 (F6-2): only wearing or taking off a gift publishes this device\'s gift — every other publish keeps the chain\'s', () => {
    const offer = code(fn('async function offerProfileBlockPublish('));
    expect(offer).toContain('const wornGift = changesWornGift ? wornGiftClaimAddress() : normalizeProfileWornGift(current?.wornGift ?? null);');
    const callers = [...appCode.matchAll(/offerProfileBlockPublish\(\{[^}]*\}/g)].map((m) => m[0]).filter((call) => !call.includes('title, hint'));
    const wearing = callers.filter((call) => call.includes('changesWornGift: true'));
    expect(wearing.length, 'the wear and take-off publish').toBe(1);
    expect(code(fn('async function offerWornGiftPublish(gift, { remove = false } = {}) {'))).toContain('changesWornGift: true');
    const reads = appCode.split(String.fromCharCode(10)).filter((one) => one.includes('wornGiftClaimAddress()') && !one.includes('function wornGiftClaimAddress()'));
    expect(reads.map((one) => one.trim())).toEqual([
      "itemAddress: state.gift === 'gift' ? wornGiftClaimAddress() : null,",
      'if (editor.wantsGift() && !wornGiftClaimAddress()) {',
      'const wornGift = changesWornGift ? wornGiftClaimAddress() : normalizeProfileWornGift(current?.wornGift ?? null);',
    ]);
  });

  it('R32-16 (F6-1): the gift canvas does not remount for a box of nothing (a hidden tab at dpr >= 1.25 looped)', () => {
    expect(app).toMatch(/observer = new ResizeObserver\(\(entries\) => \{[\s\S]{0,260}?if \(!\(entries\[entries\.length - 1\]\?\.contentRect\?\.width > 0\)\) return;/);
    expect(app).toContain('canvas.dataset.giftSide');
  });

  it('R32-17 (F6-4): the card works only while seen — its lean and its gift stop otherwise; its light has no clock of its own', () => {
    const seen = (env: Record<string, any>) => lift({ isVaultViewActive: () => true, plathoWallet: { address: SELF }, walletCardInView: true,
      document: { querySelectorAll: () => [] }, ...env }, [fn('function modalOnScreen() {'), fn('function walletCardSeen(viewIsWallet = isVaultViewActive()) {')], 'walletCardSeen')();
    expect(seen({})).toBe(true);
    expect(seen({ isVaultViewActive: () => false }), 'another tab').toBe(false);
    expect(seen({ plathoWallet: null }), 'locked').toBe(false);
    expect(seen({ walletCardInView: false }), 'scrolled away').toBe(false);
    expect(seen({ document: { querySelectorAll: () => [{ getClientRects: () => [{}] }] } }), 'a modal over it, the profile card one of them').toBe(false);
    const life = code(fn('function syncWalletCardLife(viewIsWallet = isVaultViewActive()) {'));
    expect(life).toContain('walletCardTilt?.setActive(seen);');
    expect(life).toContain('setWalletCardGiftMotionPlaying(seen);');
    expect(css).not.toMatch(/@keyframes [\w-]*shine/i);
    expect(css).not.toMatch(/\.wallet-card[^{]*\{[^}]*animation:[^}]*shine/);
  });

  it('R32-18: every new word is in every language', () => {
    for (const key of ['wallet.tokenDecimalsUnknown', 'wallet.tokensStillReading', 'wallet.recipientContractAddress', 'profile.publishUnread']) {
      for (const locale of I18N_LOCALES) {
        const value = (I18N_STRINGS as any)[locale.code][key];
        expect(typeof value === 'string' && value.length > 10, `${key} in ${locale.code}`).toBe(true);
      }
    }
  });
});
