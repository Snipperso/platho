import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_LOCALES, I18N_STRINGS } from '../web/i18n-strings.mjs';

// THE VAULT IS GONE FROM THE PRODUCT AND WAS STILL IN THE COPY.
//
// Owner, 2026-08-07, asking for a review of the quick start: "квикстарт был написан в дошардовую эпоху, там был шаг
// с переводом денег в волт". The STEP had gone with the code — but eight visible strings had not, and one of them
// sat in the activation confirmation itself, promising that activation "unlocks the Vault tab". A user reading that
// looks for a tab that cannot exist, and the one place they are certain to read carefully was telling them a story
// about an architecture that was deleted.
//
// Text outlives the code it describes, because nothing breaks when it stops being true.
const HTML = readFileSync('web/index.html', 'utf8');

describe('VAULTWORD — nothing shown to a user names the retired Vault', () => {
  it('VAULTWORD-01: no localized string names it, in any of the ten locales', () => {
    const offenders: string[] = [];
    for (const { code } of I18N_LOCALES as Array<{ code: string }>) {
      for (const [key, value] of Object.entries(I18N_STRINGS[code] as Record<string, string>)) {
        // Placeholders are code, not copy: {vault} would be a parameter name, invisible to the reader. Stripped so
        // the gate speaks about what is READ. (It is named {available} today — this keeps the rule about the text.)
        const text = String(value).replace(/\{[^}]*\}/g, '');
        if (/\bVault\b/.test(text)) offenders.push(`${code}:${key} :: ${value}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('VAULTWORD-02: no fallback text or label in the markup names it either', () => {
    // The English text inside a data-i18n element ships as-is and is what a reader sees before the dictionary is
    // applied — and an aria-label is read out whether or not it was ever translated. That is exactly how
    // aria-label="Vault balance" survived on the balance card in the rail.
    const withoutComments = HTML.replace(/<!--[\s\S]*?-->/g, '');
    const offenders: string[] = [];
    // Visible text between tags.
    for (const match of withoutComments.matchAll(/>([^<>]*\bVault\b[^<>]*)</g)) offenders.push(`text: ${match[1].trim()}`);
    // Human-facing attributes only: ids, data-* hooks and class names are internal plumbing, and renaming those
    // would churn app.js and every guard that addresses them for nothing a user can see.
    for (const match of withoutComments.matchAll(/\b(aria-label|title|placeholder|alt)="([^"]*\bVault\b[^"]*)"/g)) {
      offenders.push(`${match[1]}: ${match[2]}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('VAULTWORD-03: the strings that carried it are still there, saying something true', () => {
    // Deleting a key instead of correcting it would ALSO satisfy the two rules above while leaving the UI with a
    // blank where an explanation used to be. These are the eight that were rewritten; they must still exist.
    const en = I18N_STRINGS.en as Record<string, string>;
    for (const key of [
      'composer.needHoldStatus', 'nav.vaultBalance', 'profile.clearKeepsList', 'send.vaultHoldRequired',
      'vault.afterActivationValue', 'wallet.localWalletNotVault', 'wallet.receiveGramHint', 'wallet.sendGramHint',
    ]) {
      expect(typeof en[key], `${key} was dropped rather than corrected`).toBe('string');
      expect(en[key].trim().length, `${key} is empty`).toBeGreaterThan(0);
    }
    // And the activation confirmation still tells the user what activation gives them.
    expect(en['vault.afterActivationValue']).toContain('.ath name');
  });
});
