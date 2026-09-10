import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// WHAT THE USERNAME DIALOGS SAY WHEN THEY REFUSE.
//
// Owner, 2026-08-13: a user "tried to create a username, got some vague errors, and actually he just had no ATH"
// — then, a minute later: "he mixed it up, he was pressing LINK username, not create."
//
// Both halves were broken, in the same way and for the same reason: a message that was written for a world that
// no longer exists, and never re-read since.
//
//   LINK  — the dialog printed resolvePlathoUsernameOwner's raw internals ("<name>.ath is not registered",
//           "belongs to another wallet", "ownership is not authoritative") straight into its hint. English
//           sentences on a Russian screen, naming a contract concept instead of a next step. Every OTHER caller
//           of that resolver already mapped UsernameNotRegisteredError to a localized line; this one did not.
//           And a wallet owning NO names opened onto a bare text field with nothing saying so — which is exactly
//           how someone ends up in this dialog when they meant the other one.
//
//   MINT  — two dead checks. The affordability line and the up-front gate both read the SYNTHESIZED Vault user,
//           whose ATH is always 0, so both were switched off under direct pay and the dialog said nothing about
//           ATH at all. And usernameMintStatusText bucketed the shortfall by the SUBSTRING "not enough vault
//           ath имя заблокировано:...".
//
// The rule underneath all of it: a message shown to a user is classified by the CODE the thrower sets, never by
// matching English words that translation and refactoring both move.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');
const LOCALES = Object.keys(I18N_STRINGS);

function everyLocaleHas(key: string) {
  return LOCALES.every((code) => Boolean(I18N_STRINGS[code][key]));
}

// "This wording must be GONE" assertions have to read CODE, not prose: the note explaining why a dead string was
// removed quotes the dead string, and a gate that cannot tell the two apart fails on its own explanation.
function codeOnly(slice: string) {
  return slice.split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*')).join('\n');
}

describe('username dialogs: mint', () => {
  it('UNAME-MINT-01: affordability is read from the WALLET, and an unread balance is not zero', () => {
    // The Vault-user reading returned 0n for everyone under direct pay, which is why both checks below had been
    // switched off — leaving the dialog silent about ATH entirely.
    const balance = app.slice(
      app.indexOf('function connectedWalletAthBalanceAtomic()'),
      app.indexOf('function connectedWalletAthBalanceAtomic()') + 400,
    );
    expect(balance).toContain('vaultPocketState?.wallet?.ath_balance');
    expect(balance).toContain('return raw === null || raw === undefined ? null : nonNegativeBigInt(raw);');

    const dialog = app.slice(app.indexOf('async function requestUsernameMintName()'), app.indexOf('function avatarCompressionOptions()'));
    expect(dialog.length, 'the mint dialog slice must not collapse').toBeGreaterThan(1500);
    // (a) The balance line is back for everyone, gated on KNOWN rather than on a lane flag.
    expect(dialog).toContain('const athBalance = connectedWalletAthBalanceAtomic();');
    expect(dialog).toMatch(/if \(athBalance !== null\) \{/);
    expect(dialog, 'the direct-pay opt-out that silenced the whole line must be gone')
      .not.toMatch(/currentVaultUserSource\(\) && !privateLaneDirectPayEnabled\(\)/);
    // The dead Vault-user reader went with it — everywhere, not just here. It answered 0n to every caller, so
    // leaving it in the tree is leaving a trap for whoever reaches for "the ATH balance" next.
    expect(codeOnly(app), 'the Vault-user ATH reader must be deleted, not merely unused')
      .not.toContain('function currentAthBalanceAtomic(');
    expect(codeOnly(app)).not.toContain('currentAthBalanceAtomic()');
    // (b) The up-front gate, on the same source, refusing only against a KNOWN shortfall.
    expect(dialog).toMatch(/if \(priceAtomic !== null && athBalance !== null && athBalance < priceAtomic\) \{/);
    expect(dialog).toMatch(/error\.code = 'PLATHO_ATH_REQUIRED';/);
    // (c) ONE sentence for one condition — the same one the authoritative mint-time check raises.
    expect(dialog).toContain("t('errors.notEnoughAth', { need: formatAthAtomic(priceAtomic), have: formatAthAtomic(athBalance) })");
    expect(codeOnly(dialog), 'the hand-built English string is gone').not.toMatch(/Insufficient ATH:/);
    // ...and with it the place it named. The Vault was removed with clean-17; advice pointing there is a dead end.
    expect(codeOnly(dialog), 'no advice may name the removed Vault').not.toMatch(/top up ATH in Vault/);
    // (d) The number the dialog turns on is read BEFORE the first paint — the summary is synchronous and can only
    // show what is already cached, which is how a stale/absent balance let this reach the mint.
    expect(dialog).toMatch(/await refreshVaultNavBalanceInBackground\(\)\.catch\(\(\) => null\);\s*while \(true\) \{/);
    // (e) A shortfall gets the one thing the shared sentence cannot carry: where to get ATH.
    expect(dialog).toMatch(/error\?\.code === 'PLATHO_ATH_REQUIRED'\s*\?\s*`\$\{error\.message\} \$\{t\('errors\.buyAthHint'\)\}`/);
    expect(everyLocaleHas('errors.buyAthHint')).toBe(true);
    // WALLET, not Profile: the Buy ATH button has been in the wallet pane for a while and this sentence still
    // pointed at the profile — fixed 2026-09-07, when the profile stopped being a tab at all.
    expect(I18N_STRINGS.en['errors.buyAthHint']).toMatch(/Wallet/);
  });

  it('UNAME-MINT-02: the status bucket keys on the CODE, never on English words', () => {
    const status = app.slice(app.indexOf('function usernameMintStatusText(error)'), app.indexOf('async function showReceiveWalletTonDialog()'));
    expect(status.length, 'the status slice must not collapse').toBeGreaterThan(300);
    expect(status).toContain("if (error?.code === 'PLATHO_ATH_REQUIRED' || error?.code === 'PLATHO_WALLET_GRAM_REQUIRED') return message;");
    // The stale substrings named a balance the app stopped having and a wording it stopped using — they could not
    // match in ANY language, so the shortfall was wrapped as a generic "blocked".
    expect(codeOnly(status), 'the Vault-era substring test must be gone').not.toMatch(/not enough vault ath|not enough vault ton/i);
    // Counter-case: the wrapper still exists for everything genuinely unclassified, or every internal error would
    // be shown bare.
    expect(status).toContain("return t('username.blockedWithDetail', { message });");
    // Both money lanes classify the same way. The avatar one was fixed first and this one was left behind; a gate
    // that only checked one of them would have passed throughout.
    expect(app).toMatch(/} else if \(error\?\.code === 'PLATHO_ATH_REQUIRED' \|\| error\?\.code === 'PLATHO_WALLET_GRAM_REQUIRED'\) \{[\s\S]{0,220}?setProfileAvatarStatus\(String\(error\.message\), 'error'\);/);
    // ...and the thrower is the single place that decides a shortfall is a shortfall.
    expect(
      (app.match(/error\.code = 'PLATHO_ATH_REQUIRED';/g) ?? []).length,
      'the shared pre-flight, plus the mint dialog gate that reuses its wording',
    ).toBe(2);
  });
});
