import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  PROFILE_FLAGS_MARKER,
  PROFILE_FLAG_BALANCE_CARD,
  PROFILE_GROUPS_MAX,
  decodeProfileBlockContent,
  encodeProfileBlockContent,
} from '../web/capsule-part-policy.mjs';
import { normalizeChannelProfile } from '../web/public-channel-subscriptions.mjs';
import { readCardBalances } from '../web/wallet-assets.mjs';
import { decodeProfileBlockContentOf1424 } from './fixtures/profile-block-decoder-1.4.24.mjs';


const app = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');
const body = (name: string) => { const from = app.indexOf(name); expect(from, name).toBeGreaterThan(-1); return app.slice(from, app.indexOf('\n}\n', from) + 2); };

const gift = `0:${'ab'.repeat(32)}`;
const room = (n: number, keys = false) => ({ groupId: `${n}`.repeat(64).slice(0, 64), name: `Room ${n}`, ...(keys ? { founder: 'cd'.repeat(32), owner: 'ef'.repeat(32) } : {}) });
const SHAPES: Record<string, object> = {
  bare: { description: 'hi', tags: ['a'] },
  named: { description: 'hi', tags: [], ownerUsername: 'admin' },
  'worn gift': { description: '', tags: [], ownerUsername: 'cash', wornGift: gift },
  rooms: { description: 'x', tags: [], wornGift: gift, groups: [room(1), room(2)] },
  'rooms with founders': { description: 'x', tags: [], groups: [room(3, true)] },
  'a gift look': { description: 'x', tags: [], appearance: { kind: 'telegram-gift', itemAddress: gift } },
  'eight rooms': { description: 'x', tags: [], groups: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => room(n)) },
};

describe('PROFILE BALANCE CARD — published with the profile, shown on it', () => {
  it('PROFILE-FLAGS-01: the flag rides a trailer the readers already in production pass over — the same profile for them, the flag for this build', () => {
    expect(PROFILE_FLAGS_MARKER, 'no founders\' count can be read as the marker').toBeGreaterThan(PROFILE_GROUPS_MAX);
    for (const [name, profile] of Object.entries(SHAPES)) {
      const plain = encodeProfileBlockContent(profile);
      const flagged = encodeProfileBlockContent({ ...profile, balanceCard: true });
      const before = decodeProfileBlockContentOf1424(plain);
      expect(before, name).not.toBeNull();
      expect(decodeProfileBlockContentOf1424(flagged), name).toEqual(before);
      const { balanceCard, ...rest } = decodeProfileBlockContent(flagged) as { balanceCard: boolean };
      expect(balanceCard, name).toBe(true);
      expect(rest, name).toEqual(before);
      expect((decodeProfileBlockContent(plain) as { balanceCard: boolean }).balanceCard, name).toBe(false);
      expect(encodeProfileBlockContent({ ...profile, balanceCard: false }), name).toEqual(plain);
      expect(flagged.length - plain.length, name).toBeLessThanOrEqual(6);
      expect([...flagged.slice(-3)], name).toEqual([PROFILE_FLAGS_MARKER, 1, PROFILE_FLAG_BALANCE_CARD]);
    }
    const flagged = encodeProfileBlockContent({ ...SHAPES.named, balanceCard: true });
    for (const cut of [1, 2]) expect((decodeProfileBlockContent(flagged.slice(0, flagged.length - cut)) as { balanceCard: boolean }).balanceCard).toBe(false);
    const stray = new Uint8Array([...flagged.slice(0, -3), 0x00, 1, PROFILE_FLAG_BALANCE_CARD]);
    expect((decodeProfileBlockContent(stray) as { balanceCard: boolean }).balanceCard).toBe(false);
    expect(encodeProfileBlockContent({ ...SHAPES.bare, balanceCard: 'yes' })).toEqual(encodeProfileBlockContent(SHAPES.bare));
  });

  it('PROFILE-FLAGS-02: every place a profile is built, compared, cached, priced and published carries the flag — none can drop it', () => {
    expect(body('function readProfileDocument(documentBytes) {')).toContain('balanceCard: profile.balanceCard === true,');
    expect(body('function setChannelProfileFromWalk(authorWallet, profileBlock, entryId, createdAtSec) {')).toContain('balanceCard: profileBlock?.balanceCard === true,');
    expect(body('function setChannelProfileOptimistic(authorWallet, profile, createdAtSec) {')).toContain('balanceCard: profile?.balanceCard === true,');
    expect(body('function sameChannelProfileContent(a, b) {')).toContain('&& (a?.balanceCard === true) === (b?.balanceCard === true);');
    expect(normalizeChannelProfile({ balanceCard: true }).balanceCard).toBe(true);
    expect(normalizeChannelProfile({ balanceCard: 'true' }).balanceCard).toBe(false);
    expect(normalizeChannelProfile({}).balanceCard).toBe(false);
    for (const signature of [
      'function estimatedChannelProfileChargeNanotons(description, tags, appearance = null, wornGift = null, groups = null, balanceCard = publishedBalanceCard()) {',
      'function channelProfilePriceLine(description, tags, appearance = null, wornGift = null, groups = null, balanceCard = publishedBalanceCard()) {',
      'async function publishChannelProfileDirect(description, tags, appearance = null, wornGift = null, groups = null, balanceCard = publishedBalanceCard()) {',
      'async function publishChannelProfile(description, tags, appearance = null, wornGift = null, groups = null, balanceCard = publishedBalanceCard()) {',
      'async function offerProfileBlockPublish({ title, hint, submitLabel, failure, balanceCard = null, changesWornGift = false }) {',
    ]) expect(app).toContain(signature);
    expect(body('async function publishChannelProfileDirect(')).toContain('return { result, description: desc, tags: normalizedTags, ownerUsername, appearance: look, wornGift: worn, groups: rooms, balanceCard: card, createdAtSec };');
    expect(body('function channelProfilePriceLine(')).toContain('estimatedChannelProfileChargeNanotons(description, tags, appearance, wornGift, groups, balanceCard)');
    expect((app.match(/balanceCard: published\.balanceCard === true/g) ?? []).length).toBe(3);
    expect(body('function publishedBalanceCard() {')).toContain('cachedChannelProfile(own)?.balanceCard === true');
  });

  it('PROFILE-CARD-01: the settings row offers the publication; the profile shows the card in place of the address row, for itself and for others', () => {
    expect(html).toMatch(/<label class="settings-select-row compact-select-row" for="profileBalanceCardSelect">[\s\S]*?<option value="hide" data-i18n="profile\.balanceCardHide">[\s\S]*?<option value="show" data-i18n="profile\.balanceCardShow">/);
    expect(body('function refreshProfileBalanceCardUi() {')).toContain("profileBalanceCardSelect.value = publishedBalanceCard() ? 'show' : 'hide';");
    expect(body('function refreshChannelAppearanceUi() {')).toContain('refreshProfileBalanceCardUi();');
    const change = app.slice(app.indexOf("profileBalanceCardSelect?.addEventListener('change', () => {"), app.indexOf('channelAppearancesSelect?.addEventListener('));
    expect(change).toContain('balanceCard: show,');
    expect(change).toContain('void offerProfileBlockPublish({');
    expect(change).toMatch(/\.finally\(\(\) => \{\s*refreshProfileBalanceCardUi\(\);\s*renderProfileBalanceCard\(\);/);
    expect(html).toMatch(/<div class="wallet-card-stage profile-card-balance" id="profileCardBalance" hidden><\/div>\s*<button class="profile-card-wallet" id="profileCardCopyButton"/);
    const render = body('function renderProfileBalanceCard() {');
    expect(render).toContain('if (profileCardCopyButton) profileCardCopyButton.hidden = shows;');
    expect(body('function profileBalanceCardShows(raw) {')).toContain("sameWalletAddress(raw, plathoWallet?.address ?? '') ? publishedBalanceCard() : cachedChannelProfile(raw)?.balanceCard === true");
    expect(body('function profileBalanceCardName(raw, own) {'), "another's name only as the chain proved it").toContain("cachedChannelProfile(raw)?.verifiedUsername");
    expect(render, "their worn gift, as the hero wears it").toContain('own ? (plathoWallet ? wornGiftTheme : null) : profileCardPeerGiftTheme');
    const node = body('function profileBalanceCardNode() {');
    expect(node).toContain("const card = source.cloneNode(true);");
    expect(node).toContain("for (const node of [card, ...card.querySelectorAll('[id]')]) node.removeAttribute('id');");
    expect(node).toContain("for (const name of ['data-nav-vault-balance', 'data-nav-vault-ton', 'data-nav-vault-ath', 'aria-hidden']) node.removeAttribute(name);");
    expect(node).toContain('profileBalanceCardTilt = installCardTilt(card, profileBalanceCardSeen);');
    expect(body('function dressProfileCardHero(own) {')).toContain('renderProfileBalanceCard();');
    expect(body('async function openProfileCardDialog(subject) {')).toContain('syncProfileBalanceCardLife();');
    expect(body('function closeProfileCardDialog() {')).toContain('hideProfileBalanceCard();');
    expect(body('function redressProfileCardAboutIfOpen(wallet) {')).toContain('renderProfileBalanceCard();');
    expect(body('function refreshNavVaultBalance() {')).toContain('syncProfileBalanceCardBalances();');
    expect(body('function syncProfileBalanceCardBalances() {'), 'nothing before a card was ever made (the boot fills the corner first)').toContain('if (!profileBalanceCard) return;');
    const read = body('async function readProfileBalanceCard(raw) {');
    expect(read).toContain("createToncenterRestFetch({ requestOptions: { priority: 'profile' } })");
    expect(read).toContain('readCardBalances({ owner: raw, jettonMaster: master, ...access })');
    expect(read).toContain('PROFILE_BALANCE_CARD_RETRY_MS[Math.min(profileBalanceCardRetries, PROFILE_BALANCE_CARD_RETRY_MS.length - 1)]');
    const click = body('function onProfileBalanceCardClick(event) {');
    expect(click).toContain('receiveWalletTonButton?.click();');
    expect(click).toContain('void showWalletAddressQrDialog(raw)');
    expect(body('async function showWalletAddressQrDialog(raw) {')).toContain('render: () => createWalletReceiveQrNode(address)');
  });

  it('PROFILE-CARD-02: another wallet\'s balances — its state and its wallet of ATH, read one after the other; none held is 0', async () => {
    const asked: string[] = [];
    const answers: Record<string, object> = {
      walletInformation: { balance: '3061100000', status: 'active' },
      'jetton/wallets': { jetton_wallets: [{ jetton: `0:${'93'.repeat(32)}`, owner: `0:${'b1'.repeat(32)}`, balance: '499102000000000' }] },
    };
    const fetchImpl = async (url: string) => {
      asked.push(url);
      const path = Object.keys(answers).find((key) => url.includes(`/api/v3/${key}?`)) ?? '';
      return { ok: true, status: 200, json: async () => answers[path] };
    };
    const read = await readCardBalances({ owner: `0:${'b1'.repeat(32)}`, jettonMaster: `0:${'93'.repeat(32)}`, fetchImpl, origin: 'https://toncenter.test' });
    expect(read).toEqual({ gram: '3061100000', jetton: '499102000000000' });
    expect(asked).toHaveLength(2);
    expect(asked[0]).toContain('/api/v3/walletInformation?address=');
    expect(asked[1]).toMatch(/\/api\/v3\/jetton\/wallets\?owner_address=[^&]+&jetton_address=/);
    answers['jetton/wallets'] = { jetton_wallets: [] };
    expect(await readCardBalances({ owner: `0:${'b1'.repeat(32)}`, jettonMaster: `0:${'93'.repeat(32)}`, fetchImpl, origin: 'https://toncenter.test' })).toEqual({ gram: '3061100000', jetton: '0' });
    const refused = async () => ({ ok: false, status: 429, json: async () => ({}) });
    await expect(readCardBalances({ owner: `0:${'b1'.repeat(32)}`, jettonMaster: `0:${'93'.repeat(32)}`, fetchImpl: refused, origin: 'https://toncenter.test' })).rejects.toMatchObject({ status: 429 });
  });
  it('PROFILE-CARD-03: a profile\'s card says its amounts as the Wallet tab\'s card does — one writer, short, for one\'s own and for another\'s [2026-10-31: "1101074.1442 ATH" against "1.1M ATH"]', () => {
    const at = (start: string) => { const from = app.indexOf(start); expect(from, start).toBeGreaterThan(-1); return app.slice(from, app.indexOf('\n}\n', from)); };
    expect(at('function walletCardAmount(formatted, symbol) {')).toContain('return `${walletShortAmount(formatted)} ${symbol}`;');
    const wallet = at('function refreshNavVaultBalance(');
    expect(wallet).toContain("const athBalance = walletCardAmount(walletFormattedBalance('ATH'), 'ATH');");
    const profile = at('function writeProfileBalanceCardBalances(raw, own) {');
    expect(profile).toContain("ath = walletCardAmount(walletFormattedBalance('ATH'), 'ATH');");
    expect(profile).toContain("ath = walletCardAmount(formatAthAtomic(BigInt(read.jetton)), 'ATH');");
    expect(profile).toContain("gram = walletCardAmount(formatTonNanotons(BigInt(read.gram)), 'GRAM');");
    expect(profile, 'no amount written past the shared writer').not.toMatch(/\} (GRAM|ATH)`/);
  });
});
