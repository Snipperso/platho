import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CONV_PUBLISH_VALUE, publicPublishValueForKind } from '../web/publish-price.mjs';
import { PRIVATE_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS } from '../web/message-pricing-policy.mjs';

// The composer quoted a price and a hold that both belonged to Vault, a contract clean-17 deleted.
//
// MEASURED on chain 2026-08-03, owner's wallet UQDU48m…BEOATH: a CONV send settled at 18,865,000 nanotons while the
// composer promised 33,900,000 and additionally named a 162,600,000 "hold". There is no hold under direct-pay — the
// code three lines above the label says so outright — and the price came from a table of observed settlements
// measured against the batch-publish path that no longer exists.
//
// What the send actually attaches lives in publish-price.mjs, pinned by tests/publish-price.test.ts against the .tact
// gates and the live getters. This file pins that the QUOTE comes from there too.
const APP = readFileSync('web/app.js', 'utf8');
const I18N = readFileSync('web/i18n-strings.mjs', 'utf8');

describe('COMPOSER-PRICE — quote what the send attaches, name no hold', () => {
  it('PRICE-01: the direct-pay quote is the attached publish value, not the Vault settlement table', () => {
    const fn = APP.slice(APP.indexOf('function composerProfileNetPriceNanotons'), APP.indexOf('function composerEstimatedNetCostNanotons'));
    expect(fn).toContain('if (privateLaneDirectPayEnabled()) {');
    expect(fn).toContain('const attached = isPublic ? publicPublishValueForKind(0) : CONV_PUBLISH_VALUE;');
  });

  it('PRICE-02: the figures it now quotes are the ones the send really uses', () => {
    // Not a restatement of a literal: both sides are read from the modules the send imports.
    expect(CONV_PUBLISH_VALUE).toBe(19_100_000n);
    expect(publicPublishValueForKind(0)).toBe(20_300_000n);
    // And they are materially different from what was being shown, which is the whole reason this changed.
    const old = BigInt(PRIVATE_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS[1]);
    expect(old).not.toBe(CONV_PUBLISH_VALUE);
    expect(old > CONV_PUBLISH_VALUE).toBe(true);
  });

  it('PRICE-03: the quote never UNDERSTATES what leaves the wallet', () => {
    // The surplus returns by mode-128, so the attached figure is an upper bound on the settled one. Erring high is
    // honest; erring low would promise a send the wallet cannot fund. Measured settled for a 1-part CONV: 18,865,000.
    const settledMeasured = 18_865_000n;
    expect(CONV_PUBLISH_VALUE).toBeGreaterThanOrEqual(settledMeasured);
    // …and not absurdly high either: a quote 2x the truth is its own kind of lie.
    expect(CONV_PUBLISH_VALUE).toBeLessThan(settledMeasured * 2n);
  });

  it('PRICE-04: the direct-pay status line exists in every locale and names no hold', () => {
    const cost = I18N.match(/"composer\.costStatus": "[^"]*"/g) ?? [];
    const costHold = I18N.match(/"composer\.costHoldStatus": "[^"]*"/g) ?? [];
    expect(cost).toHaveLength(costHold.length);          // one per locale, none forgotten
    expect(cost.length).toBeGreaterThanOrEqual(10);
    for (const line of cost) {
      expect(line, `${line} still names a hold`).not.toContain('{hold}');
      expect(line).toContain('{cost}');
      expect(line).toContain('{discount}');
    }
    expect(APP).toContain("? t('composer.costStatus', { cost: formatTonNanotons(price), surcharge: surchargeText, discount: formatAthDiscountLabel() })");
  });
});
