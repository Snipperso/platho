import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_LOCALES, I18N_STRINGS } from '../web/i18n-strings.mjs';

const HTML = readFileSync('web/index.html', 'utf8');

describe('VAULTWORD — nothing shown to a user names the retired Vault', () => {
  it('VAULTWORD-01: no localized string names it, in any of the ten locales', () => {
    const offenders: string[] = [];
    for (const { code } of I18N_LOCALES as Array<{ code: string }>) {
      for (const [key, value] of Object.entries(I18N_STRINGS[code] as Record<string, string>)) {
        const text = String(value).replace(/\{[^}]*\}/g, '');
        if (/\bVault\b/.test(text)) offenders.push(`${code}:${key} :: ${value}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('VAULTWORD-02: no fallback text or label in the markup names it either', () => {
    const withoutComments = HTML.replace(/<!--[\s\S]*?-->/g, '');
    const offenders: string[] = [];
    for (const match of withoutComments.matchAll(/>([^<>]*\bVault\b[^<>]*)</g)) offenders.push(`text: ${match[1].trim()}`);
    for (const match of withoutComments.matchAll(/\b(aria-label|title|placeholder|alt)="([^"]*\bVault\b[^"]*)"/g)) {
      offenders.push(`${match[1]}: ${match[2]}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('VAULTWORD-03: the strings that carried it are still there, saying something true', () => {
    const en = I18N_STRINGS.en as Record<string, string>;
    for (const key of [
      'composer.needHoldStatus', 'nav.vaultBalance', 'profile.clearKeepsList', 'send.vaultHoldRequired',
      'vault.afterActivationValue', 'wallet.localWalletNotVault', 'wallet.receiveGramHint', 'wallet.sendGramHint',
    ]) {
      expect(typeof en[key], `${key} was dropped rather than corrected`).toBe('string');
      expect(en[key].trim().length, `${key} is empty`).toBeGreaterThan(0);
    }
    expect(en['vault.afterActivationValue']).toContain('.ath name');
  });
});
