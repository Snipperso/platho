import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { formatUnits, parseJettonBalances } from '../web/wallet-assets.mjs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const html = readFileSync('web/index.html', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const NL = String.fromCharCode(10);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(NL))(...names.map((n) => env[n]));
};
const S = I18N_STRINGS as Record<string, Record<string, string>>;

describe('the blind audit\'s LOW findings', () => {
  it('LOWS-01 (B1-3, B4-5): a figure there is drawn to its first digit, never as 0; a zero is 0; the rest as before', () => {
    expect(formatUnits('1', 9)).toBe('0.000000001');
    expect(formatUnits('42000', 9)).toBe('0.00004');
    expect(formatUnits('5', 6)).toBe('0.000005');
    expect(formatUnits('-1', 9)).toBe('-0.000000001');
    expect(formatUnits('0', 9)).toBe('0');
    expect(formatUnits('123456789', 9)).toBe('0.1234');
    expect(formatUnits('99990000', 9)).toBe('0.0999');
    expect(formatUnits('1500000000', 9)).toBe('1.5');
    expect(formatUnits('7', 0)).toBe('7');
  });

  it('LOWS-02 (B1-4, B4-9): a stranger\'s name loses what turns text round; an emoji\'s joiner stays', () => {
    const RLO = String.fromCharCode(0x202e);
    const PDF = String.fromCharCode(0x202c);
    const ZWSP = String.fromCharCode(0x200b);
    const ISOLATE = String.fromCharCode(0x2067);
    const ZWJ = String.fromCharCode(0x200d);
    const family = `👨${ZWJ}👩${ZWJ}👧`;
    const owner = `0:${'11'.repeat(32)}`;
    const master = `0:${'22'.repeat(32)}`;
    const [token] = parseJettonBalances({
      jetton_wallets: [{ address: `0:${'33'.repeat(32)}`, owner, jetton: master, balance: '5' }],
      metadata: { [master]: { token_info: [{ name: `${RLO}evil${PDF} ${ISOLATE}x${ZWSP}y ${family}`, symbol: `${RLO}DTSU`, extra: { decimals: '9' } }] } },
    });
    expect(token.name).toBe(`evil xy ${family}`);
    expect(token.symbol).toBe('DTSU');
  });

  it('LOWS-03 (B1-2): a .ath name sent from the NFT tab opens its window by its name — as the chain-read list has it', async () => {
    const REGISTRY = `0:${'aa'.repeat(32)}`;
    const ITEM = `0:${'bb'.repeat(32)}`;
    const opened: any[] = [];
    const send = (stored: any) => lift({
      plathoWallet: { address: 'W' }, walletTransferOnItsWay: () => false, rawAccount: (v: string) => v, parseTonAddress: (v: string) => ({ raw: v }),
      requireUsernameRegistryAddress: () => REGISTRY, readStoredUsernameNftList: async (key: string) => (key === 'W' ? stored : null),
      openUsernameNftTransferDialog: async (nft: any) => { opened.push(nft); return true; }, walletAssetsSent: () => {},
    }, [fn('async function runWalletAssetSend(picked) {')], 'runWalletAssetSend');
    await send({ owned: [{ label: 'other', itemAddress: `0:${'cc'.repeat(32)}` }, { label: 'cash2', itemAddress: ITEM }] })({ kind: 'nft', item: { address: ITEM, collection: REGISTRY } });
    await send(null)({ kind: 'nft', item: { address: ITEM, collection: REGISTRY } });
    expect(opened).toEqual([{ itemAddress: ITEM, label: 'cash2' }, { itemAddress: ITEM, label: null }]);
  });

  it('LOWS-04 (B2-3, B2-2): the comment is said to be public; forgetting a wallet says what stays here until the clear', () => {
    expect(S.en['wallet.commentOptional']).toBe('Comment (optional, visible to everyone)');
    for (const [locale, strings] of Object.entries(S)) {
      expect(strings['wallet.commentOptional'], `${locale}: the label goes on to say who sees it`).toMatch(/[,，・]/);
      for (const key of ['wallet.forgetWalletHint', 'wallet.forgetWalletBothHint']) {
        expect(strings[key], `${locale} ${key} names the clear`).toContain(strings['wallet.clearLocalData']);
        expect(strings[key], `${locale} ${key} names the 24 words`).toContain('24');
      }
    }
  });

  it('LOWS-05 (B4-7): a modal nested in the shell holds what is beside it at every level, the way down to it live; one at the top as before', () => {
    const node = (name: string, parent: any = null): any => {
      const one: any = { name, children: [], parentElement: parent, inert: false, hidden: false, isConnected: true,
        contains(other: any) { for (let at = other; at; at = at.parentElement) if (at === one) return true; return false; } };
      parent?.children.push(one);
      return one;
    };
    const shell = node('shell');
    const rail = node('rail', shell);
    const main = node('main', shell);
    const pane = node('pane', main);
    const walletDialog = node('walletDialog', main);
    const dialog = node('dialog', shell);
    const api = lift({ appShell: shell }, ['const modalHolds = [];', 'let modalInertNodes = [];', fn('function holdPageBehindModal(modal) {'), fn('function releaseModalHold(modal) {'), fn('function applyModalHold() {')],
      '{ holdPageBehindModal, releaseModalHold }');
    const inert = () => [rail, main, pane, walletDialog, dialog].filter((one) => one.inert).map((one) => one.name);
    api.holdPageBehindModal(walletDialog);
    expect(inert(), 'the rail, the pane beside it and the dialog at the top — not main, not itself').toEqual(['rail', 'pane', 'dialog']);
    api.releaseModalHold(walletDialog);
    expect(inert()).toEqual([]);
    api.holdPageBehindModal(dialog);
    expect(inert(), 'a modal at the top holds its siblings, as before').toEqual(['rail', 'main']);
    api.holdPageBehindModal(walletDialog);
    expect(inert(), 'the newest holds').toEqual(['rail', 'pane', 'dialog']);
    api.releaseModalHold(walletDialog);
    expect(inert(), 'and gives the hold back to the one under it').toEqual(['rail', 'main']);
  });

  it('LOWS-06 (B4-7): the wallet\'s window takes the focus at its title, holds the page, and gives both back at its close', () => {
    const calls: string[] = [];
    const title = { focus: () => calls.push('title focus') };
    const back = { hidden: true };
    const dialog: any = { hidden: true, querySelectorAll: () => [], classList: { contains: () => false, remove: () => {} } };
    const opener = { id: 'opener' };
    const api = lift({
      walletGroupDialog: dialog, t: (key: string) => key, setText: () => {}, fitWalletGroupTitle: () => {}, document: { querySelector: (id: string) => (id === '#walletGroupTitle' ? title : id === '#walletGroupBackButton' ? back : null) },
      dialogReturnFocusTarget: () => (dialog.hidden ? opener : { id: 'a button inside the window' }), holdPageBehindModal: () => calls.push('hold'), releaseModalHold: () => calls.push('release'),
      hideDialogAnimated: (one: any) => { one.hidden = true; calls.push('hide'); }, restoreDialogFocus: (target: any) => calls.push(`restore ${target?.id}`),
      stopWalletNftHero: () => {},
    }, ['let walletGroupReturnFocus = null;', fn('function openWalletGroup(group, { title = t(\'wallet.groupSettings\'), back = false, also = [] } = {}) {'), fn('function closeWalletGroup() {')],
    '{ openWalletGroup, closeWalletGroup }');
    api.openWalletGroup('menu');
    api.openWalletGroup('privacy', { back: true });
    expect(calls).toEqual(['hold', 'title focus', 'hold', 'title focus']);
    calls.length = 0;
    api.closeWalletGroup();
    expect(calls, 'the hold before the focus: an inert opener cannot take it').toEqual(['release', 'hide', 'restore opener']);
    calls.length = 0;
    api.closeWalletGroup();
    expect(calls, 'closed: nothing').toEqual([]);
    expect(html).toContain('<h1 id="walletGroupTitle" tabindex="-1">');
    expect(code(fn('function forgetWalletGroup() {'))).toContain('try { if (dialog) releaseModalHold(dialog); walletGroupReturnFocus = null; } catch {');
  });

  it('LOWS-07 (B4-6, B4-8): titles wrap at 320 px; the copy door is a finger\'s; small green text is the ink colour', () => {
    expect(css).toMatch(/\.wallet-group-dialog \.pane-header h1 \{\s*white-space: normal;\s*overflow-wrap: anywhere;\s*\}/);
    expect(css).toMatch(/\.wallet-history-row \.wallet-asset-name \{\s*white-space: normal;\s*overflow-wrap: anywhere;\s*\}/);
    expect(css).toMatch(/\.wallet-card-copy \{\s*padding: 6px 0;/);
    expect(css).toMatch(/\.wallet-history-row\.is-in \.wallet-asset-amount \{\s*color: var\(--accent-ink\);/);
    expect(css).toMatch(/\.rail-vault-balance span \{\s*color: var\(--accent-ink\);/);
  });
});
