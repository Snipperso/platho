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
//           ath" — Vault-era English, from before the sentence became t('errors.notEnoughAth') — so the one
//           message worth reading arrived wrapped as "имя заблокировано: ...".
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

describe('username dialogs: link', () => {
  it('UNAME-LINK-01: the three refusals are localized and DISTINCT', () => {
    const classifier = app.slice(
      app.indexOf('function usernameLinkErrorText(error, chosen)'),
      app.indexOf('async function requestWalletDisplayIdentity(mode)'),
    );
    expect(classifier.length, 'the classifier slice must not collapse').toBeGreaterThan(200);
    expect(classifier).toContain("if (error instanceof UsernameNotRegisteredError) return t('username.linkNoSuchName'");
    expect(classifier).toContain("if (error?.code === 'PLATHO_USERNAME_OTHER_WALLET') return t('username.linkOtherWallet'");
    // The fall-through must NOT claim the name is bad: a provider that is not configured, a rate limit or an
    // inconclusive proof all land here, and none of them means the name does not exist.
    expect(classifier).toContain("return t('username.linkCouldNotVerify'");
    for (const key of ['username.linkNoSuchName', 'username.linkOtherWallet', 'username.linkCouldNotVerify']) {
      expect(everyLocaleHas(key), `${key} in every locale`).toBe(true);
      expect(I18N_STRINGS.en[key], `${key} must name the name`).toContain('{name}');
    }
    // Three sentences, three meanings — a copy-paste that collapsed two of them would defeat the whole point.
    const en = ['username.linkNoSuchName', 'username.linkOtherWallet', 'username.linkCouldNotVerify']
      .map((key) => I18N_STRINGS.en[key]);
    expect(new Set(en).size, 'the three refusals must not say the same thing').toBe(3);
    // The "could not verify" one must read as retryable, not as a verdict on the name.
    expect(I18N_STRINGS.en['username.linkCouldNotVerify']).toMatch(/try again/i);
  });

  it('UNAME-LINK-02: the dialog shows that line, not the contract\'s own English', () => {
    const validateStart = app.indexOf('const result = await verifyWalletDisplayIdentity(normalizedMode, chosen, plathoWallet);');
    const validate = app.slice(validateStart, app.indexOf('\n    },', validateStart));
    expect(validate.length, 'the validate slice must not collapse').toBeGreaterThan(100);
    expect(validate).toContain('return { ok: false, error: usernameLinkErrorText(error, chosen) };');
    expect(validate, 'the raw message must not reach the screen').not.toMatch(/error: error\?\.message/);
    // ...and it still reaches the console, which is where an English diagnostic belongs.
    expect(validate).toContain('console.error(error);');
    // The thrower has to CARRY the distinction, or the classifier has nothing to read.
    const verify = app.slice(
      app.indexOf('async function verifyWalletDisplayIdentity(mode, label, wallet = plathoWallet)'),
      app.indexOf('function readWalletDisplayIdentity('),
    );
    expect(verify).toContain("error.code = 'PLATHO_USERNAME_OTHER_WALLET';");
  });

  it('UNAME-LINK-03: owning NO names is stated up front — but only when we actually know it', () => {
    const dialog = app.slice(
      app.indexOf('async function requestWalletDisplayIdentity(mode)'),
      app.indexOf('async function requestUsernameMintName()'),
    );
    expect(dialog.length, 'the dialog slice must not collapse').toBeGreaterThan(1000);
    expect(dialog).toMatch(/if \(normalizedMode === WALLET_DISPLAY_MODES\.PLATHO_NFT && ownedNames !== null && knownNames\.length === 0\) \{\s*feedback = t\('username\.linkNoNamesYet'\);/);
    expect(everyLocaleHas('username.linkNoNamesYet')).toBe(true);
    // It has to point at the way OUT — the user who hit this had pressed the wrong button of the two.
    expect(I18N_STRINGS.en['username.linkNoNamesYet']).toMatch(/create/i);
    expect(I18N_STRINGS.en['username.linkNoNamesYet']).toMatch(/ATH/);
    // COUNTER-CASE, and the load-bearing half: `ownedNames === null` means the CHAIN READ FAILED. Telling someone
    // they own nothing on the strength of a failed read is a false statement about their property — and the
    // remembered-names fallback exists precisely for that case.
    expect(dialog).toMatch(/const knownNames = normalizedMode === WALLET_DISPLAY_MODES\.PLATHO_NFT\s*\?\s*\(ownedNames \?\? readKnownPlathoUsernames\(/);
    expect(dialog).toMatch(/\.catch\(\(\) => null\);/);
  });
});

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
    expect(dialog, 'and the dead Vault-user balance with it').not.toContain('currentAthBalanceAtomic()');
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
    expect(I18N_STRINGS.en['errors.buyAthHint']).toMatch(/Profile/);
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
