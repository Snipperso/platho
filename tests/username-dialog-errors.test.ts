import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


const app = readFileSync('web/app.js', 'utf8');
const LOCALES = Object.keys(I18N_STRINGS);

function everyLocaleHas(key: string) {
  return LOCALES.every((code) => Boolean(I18N_STRINGS[code][key]));
}

function codeOnly(slice: string) {
  return slice.split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*')).join('\n');
}

describe('username dialogs: mint', () => {
  it('UNAME-MINT-01: affordability is read from the WALLET, and an unread balance is not zero', () => {
    const balance = app.slice(
      app.indexOf('function connectedWalletAthBalanceAtomic()'),
      app.indexOf('function connectedWalletAthBalanceAtomic()') + 400,
    );
    expect(balance).toContain('vaultPocketState?.wallet?.ath_balance');
    expect(balance).toContain('return raw === null || raw === undefined ? null : nonNegativeBigInt(raw);');

    const dialog = app.slice(app.indexOf('async function requestUsernameMintName()'), app.indexOf('function avatarCompressionOptions()'));
    expect(dialog.length, 'the mint dialog slice must not collapse').toBeGreaterThan(1500);
    expect(dialog).toContain('const athBalance = connectedWalletAthBalanceAtomic();');
    expect(dialog).toMatch(/if \(athBalance !== null\) \{/);
    expect(dialog, 'the direct-pay opt-out that silenced the whole line must be gone')
      .not.toMatch(/currentVaultUserSource\(\) && !privateLaneDirectPayEnabled\(\)/);
    expect(codeOnly(app), 'the Vault-user ATH reader must be deleted, not merely unused')
      .not.toContain('function currentAthBalanceAtomic(');
    expect(codeOnly(app)).not.toContain('currentAthBalanceAtomic()');
    expect(dialog).toMatch(/if \(priceAtomic !== null && athBalance !== null && athBalance < priceAtomic\) \{/);
    expect(dialog).toMatch(/error\.code = 'PLATHO_ATH_REQUIRED';/);
    expect(dialog).toContain("t('errors.notEnoughAth', { need: formatAthAtomic(priceAtomic), have: formatAthAtomic(athBalance) })");
    expect(codeOnly(dialog), 'the hand-built English string is gone').not.toMatch(/Insufficient ATH:/);
    expect(codeOnly(dialog), 'no advice may name the removed Vault').not.toMatch(/top up ATH in Vault/);
    expect(dialog).toMatch(/await refreshVaultNavBalanceInBackground\(\)\.catch\(\(\) => null\);\s*let hintAction = null;\s*while \(true\) \{/);
    expect(dialog).toContain("hintAction = error?.code === 'PLATHO_ATH_REQUIRED' && buyAthButton ? { label: t('profile.buyAth'), run: doorPress(openBuyAthDialog, { money: true }) } : null;");
    expect(I18N_STRINGS.en['errors.buyAthHint'], 'the plate is gone with its uses').toBeUndefined();
  });

  it('UNAME-MINT-02: the status bucket keys on the CODE, never on English words', () => {
    const status = app.slice(app.indexOf('function usernameMintStatusText(error)'), app.indexOf('async function showReceiveWalletTonDialog()'));
    expect(status.length, 'the status slice must not collapse').toBeGreaterThan(300);
    expect(status).toContain("if (error?.code === 'PLATHO_ATH_REQUIRED' || error?.code === 'PLATHO_WALLET_GRAM_REQUIRED') return message;");
    expect(codeOnly(status), 'the Vault-era substring test must be gone').not.toMatch(/not enough vault ath|not enough vault ton/i);
    expect(status).toContain("return t('username.blockedWithDetail', { message });");
    expect(app).toMatch(/} else if \(error\?\.code === 'PLATHO_ATH_REQUIRED' \|\| error\?\.code === 'PLATHO_WALLET_GRAM_REQUIRED'\s*\|\| error\?\.code === 'PLATHO_AVATAR_NEEDS_ACTIVATION'\) \{[\s\S]{0,220}?setProfileAvatarStatus\(String\(error\.message\), 'error'\);/);
    expect(
      (app.match(/error\.code = 'PLATHO_ATH_REQUIRED';/g) ?? []).length,
      'the shared pre-flight, plus the mint dialog gate that reuses its wording',
    ).toBe(2);
  });
});
