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
    expect(app).toMatch(/function buyAthDialogNotes\(state\)/);
    expect(app).toMatch(/const remaining = athPoolState\.remainingBudget;/);
    expect(app).toMatch(/const airdropStillRunning = remaining !== null && remaining !== undefined && nonNegativeBigInt\(remaining\) > 0n;/);
    // The two phase-bound lines ride the SAME condition, and the post-airdrop line is the else branch.
    expect(app).toMatch(/if \(airdropStillRunning\) \{[\s\S]{0,200}profile\.buyAthEarned[\s\S]{0,200}profile\.buyAthNow'\)[\s\S]{0,120}\} else \{[\s\S]{0,160}profile\.buyAthNowAfter/);
    expect(app).toMatch(/if \(airdropStillRunning\) notes\.push\([\s\S]{0,120}profile\.buyAthPoolLine/);
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
      'profile.buyAth', 'profile.buyAthTitle', 'profile.buyAthHint', 'profile.buyAthSubmit',
      'profile.buyAthFromPrice', 'profile.buyAthSoldOut', 'profile.buyAthUnavailable',
      'profile.buyAthWalletRequired', 'profile.buyAthEarned', 'profile.buyAthNow', 'profile.buyAthNowAfter',
      'profile.buyAthPriceLine', 'profile.buyAthPoolLine', 'profile.buyAthAmountLabel', 'profile.buyAthCostLabel',
      'profile.buyAthSummaryAmount', 'profile.buyAthSummaryPrice', 'profile.buyAthSummaryFee',
      'profile.buyAthFeeNote', 'profile.buyAthEnterAmount', 'profile.buyAthLowBalance',
      'profile.buyAthSending', 'profile.buyAthSent', 'profile.buyAthBusy', 'profile.buyAthFailed',
    ];
    for (const locale of Object.keys(I18N_STRINGS)) {
      for (const key of keys) expect(I18N_STRINGS[locale][key], `${locale} is missing ${key}`).toBeTruthy();
    }
    // The interpolations the copy depends on must survive translation, or the sentence loses its number.
    for (const locale of Object.keys(I18N_STRINGS)) {
      expect(I18N_STRINGS[locale]['profile.buyAthPriceLine'], `${locale} price line`).toContain('{price}');
      expect(I18N_STRINGS[locale]['profile.buyAthPriceLine'], `${locale} price line`).toContain('{amount}');
      expect(I18N_STRINGS[locale]['profile.buyAthPoolLine'], `${locale} pool line`).toContain('{price}');
    }
  });

  it('BUYATH-08: the pool launch price is stated, never derived from the seller ladder', () => {
    // 0.001 is the POOL price (15,000,000 ATH against 15,000 GRAM). The seller's ladder starts at x2 = 0.002, so
    // computing "the pool price" from the seller's own multiplier would print the seller's price twice and quietly
    // turn an honest comparison into a tautology.
    expect(app).toMatch(/const POOL_LAUNCH_PRICE_LABEL = '0\.001';/);
    expect(app).toMatch(/profile\.buyAthPoolLine', \{ price: POOL_LAUNCH_PRICE_LABEL \}/);
  });
});
