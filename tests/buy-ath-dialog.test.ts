import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';


const app = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');

describe('buy ATH from the reserve', () => {
  it('BUYATH-01: the row exists, and its status carries the PRICE', () => {
    expect(html).toMatch(/id="buyAthButton"[^>]*>[\s\S]{0,200}id="buyAthStatus"/);
    expect(app).toMatch(/t\('profile\.buyAthFromPrice', \{ price \}\)/);
    expect(app).toMatch(/function marketStabilityUnitPriceLabel/);
  });

  it('BUYATH-02: the footnotes are the two lines that stay true forever', () => {
    expect(app).toMatch(/function buyAthFootnotes\(state\)/);
    expect(app).toMatch(/const lines = \[t\('profile\.buyAthFootStep'/);
    expect(app).toMatch(/lines\.push\(t\('profile\.buyAthFootSpend'\)\);/);
    expect(app).not.toMatch(/airdropStillRunning|buyAthFootPool|buyAthFootAirdrop/);
  });

  it('BUYATH-02B: the CONTROLS come first and the prose sits under the button', () => {
    const dialog = app.indexOf('async function openBuyAthDialog(');
    expect(dialog, 'the buy dialog exists').toBeGreaterThan(0);
    const start = app.indexOf('const fields = [', dialog);
    const fields = app.slice(start, app.indexOf('const proceed = await openActionDialog({', start));
    expect(fields, 'the fields list must hold the inputs and nothing else').toMatch(/type: 'custom',[\s\S]{0,80}buy-ath-inputs/);
    expect(fields, 'no prose above the controls').not.toMatch(/type: 'note'/);
    expect(app).toMatch(/footnotes: \(\) => buyAthFootnotes\(state\),/);
    expect(app).toMatch(/title: t\('profile\.buyAthTitle'\),/);
    expect(app).not.toMatch(/buyAthTitleStar/);
    expect(html).toMatch(/id="actionSubmitButton"[\s\S]{0,700}id="actionFootnotes"/);
  });

  it('BUYATH-04: the amount is clamped by BOTH contract bounds before it can be composed', () => {
    expect(app).toMatch(/const maxAtomic = maxBuyableAtomic\(state\);/);
    expect(app).toMatch(/amountAtomic = atomic < 0n \? 0n : \(atomic > maxAtomic \? maxAtomic : atomic\);/);
  });

  it('BUYATH-05: a busy seller is a QUEUE — we wait, we do not send into it', () => {
    expect(app).toMatch(/async function awaitMarketStabilityIdle\(/);
    expect(app).toMatch(/if \(marketStabilityCanSell\(marketStabilityState\)\) return marketStabilityState;/);
    expect(app).toMatch(/if \(marketStabilityState && maxBuyableAtomic\(marketStabilityState\) <= 0n\) return null;/);
    expect(app).toMatch(/const ready = await awaitMarketStabilityIdle\(\);/);
  });

  it('BUYATH-06: an unreadable seller is "unknown", never "sold out"', () => {
    expect(app).toMatch(/const state = marketStabilityState;\s*\n\s*if \(!state\) \{[\s\S]{0,120}profile\.buyAthUnavailable/);
    expect(app).toMatch(/if \(!marketStabilityState\) \{[\s\S]{0,120}profile\.statusChecking/);
    expect(app).toMatch(/if \(state\.exists\) marketStabilityState = state;/);
  });

  it('BUYATH-06B: a completed buy re-reads the BALANCE, not just the protocol figures', () => {
    const submit = app.slice(app.indexOf('async function submitBuyAth(amountAtomic, quotedMultiplier = null)'), app.indexOf('async function refreshAthProtocolStatsRun()'));
    expect(submit.length, 'the submit slice must not collapse').toBeGreaterThan(400);
    expect(submit).toMatch(/setText\(buyAthStatus, t\('profile\.buyAthSent'\)\);[\s\S]{0,700}?queueAthPostTransactionRefresh\(\);/);
    expect(submit, 'the private one-shot that only refreshed protocol stats must be gone')
      .not.toMatch(/setTimeout\([\s\S]{0,80}?refreshAthProtocolStats/);
    const queue = app.slice(app.indexOf('function queueAthPostTransactionRefresh()'), app.indexOf('function isVaultViewActive()'));
    expect(queue).toContain('refreshAthProtocolStats().catch(() => {});');
    expect(queue).toContain('refreshVaultNavBalanceInBackground().catch(() => {});');
    expect(queue).toMatch(/for \(const delayMs of ATH_POST_TRANSACTION_REFRESH_DELAYS_MS\) setTimeout\(tick, delayMs\);/);
    expect(
      (app.match(/function queueAthPostTransactionRefresh/g) ?? []).length,
      'the shared refresh is defined exactly once',
    ).toBe(1);
    const buySender = app.slice(app.indexOf('async function submitBuyAth'));
    expect(
      buySender.slice(0, buySender.indexOf('\nasync function ')),
      'and the BUY sender is one of its callers',
    ).toContain('queueAthPostTransactionRefresh()');
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
      expect(I18N_STRINGS[locale]['profile.buyAthTitleStar'], `${locale} still has the starred title`).toBeUndefined();
    }
    for (const locale of Object.keys(I18N_STRINGS)) {
      expect(I18N_STRINGS[locale]['profile.buyAthFootStep'], `${locale} step line`).toContain('{price}');
      expect(I18N_STRINGS[locale]['profile.buyAthFootStep'], `${locale} step line`).toContain('{amount}');
    }
  });


});
