import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const NL = String.fromCharCode(10);
const S = I18N_STRINGS as Record<string, Record<string, string>>;

describe('a copy says what it copied', () => {
  it('COPYSAID-01: every copy of the wallet\'s address says "wallet address copied"; a token\'s, an NFT\'s and a name\'s say theirs', async () => {
    const said: string[] = [];
    const env: Record<string, any> = { copyTextToClipboard: async () => {}, showAppNotice: (text: string) => said.push(text), t: (key: string) => key };
    const names = Object.keys(env);
    // eslint-disable-next-line no-new-func
    const copy = new Function(...names, [fn('function copyFromWalletCard(text, copied) {'), 'return copyFromWalletCard;'].join(NL))(...names.map((n) => env[n]));
    copy('UQ…', 'wallet.addressCopied');
    copy('sample.ath', 'wallet.nameCopied');
    copy('', 'wallet.addressCopied');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(said).toEqual(['wallet.addressCopied', 'wallet.nameCopied']);
    expect(app).toContain("copyFromWalletCard(event.currentTarget?.dataset?.address, 'wallet.addressCopied')");
    expect(app).toContain("copyFromWalletCard(event.currentTarget?.textContent?.trim(), 'wallet.nameCopied')");
    const qr = code(app.slice(app.indexOf("title: t('profileCard.walletQrTitle'),") - 400, app.indexOf("title: t('profileCard.walletQrTitle'),") + 600));
    expect(qr).toContain("showAppNotice(t('wallet.addressCopied'));");
    expect(qr).not.toContain("t('dialog.shareCopied')");
    expect(app).toContain("{ copy: friendly, copied: 'wallet.tokenAddressCopied' }");
    expect(app).toContain("{ copy: friendly, copied: 'wallet.nftAddressCopied' }");
    expect(code(fn('function walletCardStat(label, value, { copy = \'\', copied = \'dialog.shareCopied\', balanceRow = null } = {}) {'))).toContain('showAppNotice(t(copied))');
    for (const line of code(app).split(NL).filter((one) => /copyTextToClipboard\((address|addressText|addressToCopy)\)/.test(one))) {
      expect(line, line).not.toContain('dialog.shareCopied');
    }
    for (const [locale, strings] of Object.entries(S)) {
      for (const key of ['wallet.addressCopied', 'wallet.tokenAddressCopied', 'wallet.nftAddressCopied', 'wallet.nameCopied']) expect(strings[key], `${locale} ${key}`).toBeTruthy();
    }
    expect(S.en['wallet.tokenAddressCopied']).toBe('Token address copied');
    expect(S.en['wallet.nameCopied']).toBe('Name copied');
  });

  it('COPYSAID-02: the card in another\'s profile says what it copied — its address, its name — never "[undefined]"; every copy names its words', async () => {
    const said: string[] = [];
    const copied: string[] = [];
    const t = (key: unknown) => (typeof key === 'string' && key.startsWith('wallet.') ? key : `[${key}]`);
    const env: Record<string, any> = {
      profileCardSubject: `0:${'ab'.repeat(32)}`, plathoWallet: { address: `0:${'cd'.repeat(32)}` }, sameWalletAddress: (a: string, b: string) => a === b,
      receiveWalletTonButton: null, showWalletAddressQrDialog: async () => {},
      copyTextToClipboard: async (text: string) => { copied.push(text); }, showAppNotice: (text: string) => said.push(text), t,
    };
    const names = Object.keys(env);
    // eslint-disable-next-line no-new-func
    const click = new Function(...names, [fn('function copyFromWalletCard(text, copied) {'), fn('function onProfileBalanceCardClick(event) {'), 'return onProfileBalanceCardClick;'].join(NL))(...names.map((n) => env[n]));
    const press = (hit: Record<string, any>) => click({ target: { closest: (selector: string) => hit[selector] ?? null } });
    press({ '.wallet-card-address': { dataset: { address: 'UQ-their-address' } } });
    press({ '.wallet-card-name': { textContent: ' sample.ath ' } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect([copied, said]).toEqual([['UQ-their-address', 'sample.ath'], ['wallet.addressCopied', 'wallet.nameCopied']]);
    const calls = code(app).split(NL).filter((line) => line.includes('copyFromWalletCard(') && !line.includes('function copyFromWalletCard('));
    expect(calls.length).toBeGreaterThanOrEqual(4);
    for (const line of calls) expect(line, line).toMatch(/, 'wallet\.(address|name)Copied'\)/);
  });
});
