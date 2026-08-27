import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The buy dialog says things about the PROJECT, not just about the transaction: that ATH is earned by writing, that
// short names are still available, that the exchange pool will open at 0.001. The owner caught this before a single
// line was translated — "after the airdrop is handed out, part of this text stops being true" — and prose about a
// phase goes stale in silence, in ten languages at once.
//
// So the phase is READ, not written. This gate pins that, and pins the direction of the unknown case, which is the
// part that is easy to get backwards: a pool read that FAILS must fall to the SHORT version. The short one asserts
// strictly less, so it cannot be the wrong thing to say when we do not know; the long one makes two claims we would
// be guessing at.

const app = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');

describe('buy ATH from the reserve', () => {
  it('BUYATH-01: the row exists, and its status carries the PRICE', () => {
    expect(html).toMatch(/id="buyAthButton"[^>]*>[\s\S]{0,200}id="buyAthStatus"/);
    expect(app).toMatch(/t\('profile\.buyAthFromPrice', \{ price \}\)/);
    // A control that spends money must say how much BEFORE it is pressed.
    expect(app).toMatch(/function marketStabilityUnitPriceLabel/);
  });

  it('BUYATH-02: the footnotes are the two lines that stay true forever', () => {
    // The dialog used to carry two more, PHASE-BOUND lines — the airdrop earning line and the coming pool's
    // launch terms — gated on the airdrop pool's remaining budget so they would end themselves when it did
    // ("prose about a phase goes stale in silence"). The budget IS spent (2026-08-26: remaining 0, all
    // 15,000,000 ATH delivered) and the airdrop UI plus its pool/ticket reads were removed wholesale [OWNER
    // 2026-08-27], so the ended-phase branch is deleted rather than kept eternally false (PWA-AIRDROP-GONE-01).
    expect(app).toMatch(/function buyAthFootnotes\(state\)/);
    expect(app).toMatch(/const lines = \[t\('profile\.buyAthFootStep'/);
    expect(app).toMatch(/lines\.push\(t\('profile\.buyAthFootSpend'\)\);/);
    expect(app).not.toMatch(/airdropStillRunning|buyAthFootPool|buyAthFootAirdrop/);
  });

  it('BUYATH-02B: the CONTROLS come first and the prose sits under the button', () => {
    // OWNER 2026-08-09: "не нравится стена текста над кнопками". The dialog opened with four paragraphs and buried
    // the inputs below them. Nothing was cut — the prose became footnotes below the button —
    // but the order is now load-bearing and easy to undo by adding one more explanatory `note` field.
    const start = app.indexOf('const fields = [');
    const fields = app.slice(start, app.indexOf('const proceed = await openActionDialog({', start));
    expect(fields, 'the fields list must hold the inputs and nothing else').toMatch(/type: 'custom',[\s\S]{0,80}buy-ath-inputs/);
    expect(fields, 'no prose above the controls').not.toMatch(/type: 'note'/);
    expect(app).toMatch(/footnotes: \(\) => buyAthFootnotes\(state\),/);
    // [OWNER 2026-08-09] The title carried an asterisk pointing at footnotes that are rendered as BULLETS. A mark
    // promising a matching footnote, with no matching footnote anywhere below it, is a small broken promise —
    // and the bullets read fine without it. Assert it stays gone rather than dropping the line: the starred key
    // is retired in every locale, so a reappearance would be someone reintroducing the mismatch.
    expect(app).toMatch(/title: t\('profile\.buyAthTitle'\),/);
    expect(app).not.toMatch(/buyAthTitleStar/);
    // The footnote list renders AFTER the submit button in the markup, not before it.
    expect(html).toMatch(/id="actionSubmitButton"[\s\S]{0,700}id="actionFootnotes"/);
  });

  it('BUYATH-04: the amount is clamped by BOTH contract bounds before it can be composed', () => {
    // Gate 23215 caps at the tranche remainder and 23216 at the undelivered reserve; offering more composes a
    // transaction the contract refuses, and the user sees a bounce with nothing to explain it.
    expect(app).toMatch(/const maxAtomic = maxBuyableAtomic\(state\);/);
    expect(app).toMatch(/amountAtomic = atomic < 0n \? 0n : \(atomic > maxAtomic \? maxAtomic : atomic\);/);
  });

  it('BUYATH-05: a busy seller is a QUEUE — we wait, we do not send into it', () => {
    // One sale in flight at a time (23211). Sending anyway bounces the money back with a red row; a dust buy can
    // hold the slot for one round trip, which is seconds.
    expect(app).toMatch(/async function awaitMarketStabilityIdle\(/);
    expect(app).toMatch(/if \(marketStabilityCanSell\(marketStabilityState\)\) return marketStabilityState;/);
    // Sold out is NOT busy — that loop must exit rather than poll forever.
    expect(app).toMatch(/if \(marketStabilityState && maxBuyableAtomic\(marketStabilityState\) <= 0n\) return null;/);
    expect(app).toMatch(/const ready = await awaitMarketStabilityIdle\(\);/);
  });

  it('BUYATH-06: an unreadable seller is "unknown", never "sold out"', () => {
    // The dialog refuses to open on an unread seller; the ROW meanwhile says "checking", not "sold out".
    expect(app).toMatch(/const state = marketStabilityState;\s*\n\s*if \(!state\) \{[\s\S]{0,120}profile\.buyAthUnavailable/);
    expect(app).toMatch(/if \(!marketStabilityState\) \{[\s\S]{0,120}profile\.statusChecking/);
    // And a failed read never overwrites a good state with zeros.
    expect(app).toMatch(/if \(state\.exists\) marketStabilityState = state;/);
  });

  it('BUYATH-06B: a completed buy re-reads the BALANCE, not just the protocol figures', () => {
    // [OWNER 2026-08-13] "я купил себе 200 атх. Был статус отправляется... типа купил, но в балансе ничего не
    // обновилось."
    //
    // The CLAIM lane was cured of exactly this on 2026-08-03 and queueAthPostTransactionRefresh was written for it.
    // The BUY lane kept a one-shot of its own: a single 8s call to refreshAthProtocolStats, which reads PROTOCOL
    // figures (supply, multiplier) and never touches the wallet's ATH balance — the number the user is watching is
    // fed by refreshVaultNavBalanceInBackground. So the balance waited for a background tick up to three minutes
    // away. One lane fixed, its twin missed: both now queue the same ladder.
    const submit = app.slice(app.indexOf('async function submitBuyAth(amountAtomic)'), app.indexOf('async function refreshAthProtocolStatsRun()'));
    expect(submit.length, 'the submit slice must not collapse').toBeGreaterThan(400);
    expect(submit).toMatch(/setText\(buyAthStatus, t\('profile\.buyAthSent'\)\);[\s\S]{0,700}?queueAthPostTransactionRefresh\(\);/);
    expect(submit, 'the private one-shot that only refreshed protocol stats must be gone')
      .not.toMatch(/setTimeout\([\s\S]{0,80}?refreshAthProtocolStats/);
    // The shared ladder is what makes the fix real: it refreshes BOTH sides, and starts before the user looks away.
    const queue = app.slice(app.indexOf('function queueAthPostTransactionRefresh()'), app.indexOf('function isVaultViewActive()'));
    expect(queue).toContain('refreshAthProtocolStats().catch(() => {});');
    expect(queue).toContain('refreshVaultNavBalanceInBackground().catch(() => {});');
    expect(queue).toMatch(/for \(const delayMs of ATH_POST_TRANSACTION_REFRESH_DELAYS_MS\) setTimeout\(tick, delayMs\);/);
    // Counter-case: both money lanes must go through it, or the next one drifts the same way.
    // The claim lane left with the spent airdrop (2026-08-27): definition + the BUY sender remain, and pinning
    // the exact count is what makes a silently-dropped sender (or a resurrected one) visible.
    expect(
      (app.match(/queueAthPostTransactionRefresh\(\)/g) ?? []).length,
      'the shared refresh has exactly its definition and the BUY sender',
    ).toBe(2);
  });

  it('BUYATH-07: every user-visible string goes through t(), in all ten locales', async () => {
    const { I18N_STRINGS } = await import('../web/i18n-strings.mjs');
    const keys = [
      'profile.buyAth', 'profile.buyAthTitle', 'profile.buyAthSubmit',
      'profile.buyAthFromPrice', 'profile.buyAthSoldOut', 'profile.buyAthUnavailable',
      'profile.buyAthWalletRequired', 'profile.buyAthTitle', 'profile.buyAthAmountLabel',
      'profile.buyAthCostLabel', 'profile.buyAthFootStep', 'profile.buyAthFootSpend',
      'profile.buyAthSummaryAmount', 'profile.buyAthSummaryPrice', 'profile.buyAthSummaryFee',
      'profile.buyAthSummaryBalance', 'profile.buyAthEnterAmount', 'profile.buyAthLowBalance',
      'profile.buyAthSending', 'profile.buyAthSent', 'profile.buyAthBusy', 'profile.buyAthFailed',
    ];
    for (const locale of Object.keys(I18N_STRINGS)) {
      for (const key of keys) expect(I18N_STRINGS[locale][key], `${locale} is missing ${key}`).toBeTruthy();
      // [OWNER 2026-08-09] The starred variant is retired in EVERY locale, not just English: the title's
      // asterisk promised a footnote that is rendered as a bullet, and a mark with nothing to point at is a
      // small broken promise repeated ten times.
      expect(I18N_STRINGS[locale]['profile.buyAthTitleStar'], `${locale} still has the starred title`).toBeUndefined();
    }
    // The interpolations the copy depends on must survive translation, or the sentence loses its number.
    for (const locale of Object.keys(I18N_STRINGS)) {
      expect(I18N_STRINGS[locale]['profile.buyAthFootStep'], `${locale} step line`).toContain('{price}');
      expect(I18N_STRINGS[locale]['profile.buyAthFootStep'], `${locale} step line`).toContain('{amount}');
    }
  });


});
