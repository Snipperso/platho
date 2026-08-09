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

  it('BUYATH-02: the copy is assembled from the airdrop pool state, not hardcoded', () => {
    expect(app).toMatch(/function buyAthFootnotes\(state\)/);
    expect(app).toMatch(/const remaining = athPoolState\.remainingBudget;/);
    expect(app).toMatch(/const airdropStillRunning = remaining !== null && remaining !== undefined && nonNegativeBigInt\(remaining\) > 0n;/);
    // The two PHASE-BOUND footnotes — a pool that does not exist yet and an airdrop still paying out — ride the same
    // condition, because they stop being true on the same event. The step price and "you can already spend it" are
    // unconditional: both stay true forever.
    expect(app).toMatch(/if \(airdropStillRunning\) \{[\s\S]{0,400}profile\.buyAthFootPool[\s\S]{0,300}profile\.buyAthFootAirdrop[\s\S]{0,40}\}/);
    expect(app, 'the step line is unconditional').toMatch(/const lines = \[t\('profile\.buyAthFootStep'/);
    expect(app, 'so is the spend line').toMatch(/\}\s*\n\s*lines\.push\(t\('profile\.buyAthFootSpend'\)\);/);
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

  it('BUYATH-03: an UNREADABLE pool falls to the SHORT copy, never the long one', () => {
    // The pool reader leaves remainingBudget null when the read fails, and null must NOT read as "still running".
    // Getting this backwards would print "ATH is earned by writing" at a user for whom it may already be false.
    expect(app).toMatch(/remainingBudget: pool\.remainingBudget,/);
    expect(app).toMatch(/remainingBudget: null \}/);
    expect(app, 'null must fail the running test, not pass it').toMatch(/remaining !== null && remaining !== undefined && nonNegativeBigInt\(remaining\) > 0n/);
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

  it('BUYATH-07: every user-visible string goes through t(), in all ten locales', async () => {
    const { I18N_STRINGS } = await import('../web/i18n-strings.mjs');
    const keys = [
      'profile.buyAth', 'profile.buyAthTitle', 'profile.buyAthSubmit',
      'profile.buyAthFromPrice', 'profile.buyAthSoldOut', 'profile.buyAthUnavailable',
      'profile.buyAthWalletRequired', 'profile.buyAthTitle', 'profile.buyAthAmountLabel',
      'profile.buyAthCostLabel', 'profile.buyAthFootStep', 'profile.buyAthFootPool',
      'profile.buyAthFootAirdrop', 'profile.buyAthFootSpend',
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
      expect(I18N_STRINGS[locale]['profile.buyAthFootPool'], `${locale} pool line`).toContain('{price}');
      expect(I18N_STRINGS[locale]['profile.buyAthFootPool'], `${locale} pool line`).toContain('{liquidityAth}');
    }
  });

  it('BUYATH-08: the pool launch price is stated, never derived from the seller ladder', () => {
    // 0.001 is the POOL price (15,000,000 ATH against 15,000 GRAM). The seller's ladder starts at x2 = 0.002, so
    // computing "the pool price" from the seller's own multiplier would print the seller's price twice and quietly
    // turn an honest comparison into a tautology.
    expect(app).toMatch(/const POOL_LAUNCH_PRICE_LABEL = '0\.001';/);
    expect(app).toMatch(/price: POOL_LAUNCH_PRICE_LABEL,/);
    expect(app).toMatch(/const POOL_LIQUIDITY_ATH_LABEL = '15 000 000';/);
  });
});
