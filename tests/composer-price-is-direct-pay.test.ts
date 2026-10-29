import { describe, expect, it } from 'vitest';

const NEWLINE = String.fromCharCode(10);
import { readFileSync } from 'node:fs';
import { CONV_PUBLISH_VALUE, publicPublishValueForKind } from '../web/publish-price.mjs';
import { walletSendFeeNanotons } from '../web/wallet-send-fee.mjs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';

const APP = readFileSync('web/app.js', 'utf8');
const I18N = readFileSync('web/i18n-strings.mjs', 'utf8');

describe('COMPOSER-PRICE — quote what the send attaches, name no hold', () => {
  it('PRICE-01: the direct-pay quote is the attached publish value, not the Vault settlement table', () => {
    const fn = APP.slice(APP.indexOf('function composerProfileNetPriceNanotons'), APP.indexOf('function composerEstimatedNetCostNanotons'));
    expect(fn).not.toContain('privateLaneDirectPayEnabled');
    expect(fn).toContain('const attached = isPublic ? publicPublishValueForKind(Number(profile?.publicKind ?? 0)) : CONV_PUBLISH_VALUE;');
    expect(APP).toContain('publicComposerPublishProfilesForPlan(plan, 3)');
  });

  it('PRICE-02: the figures it now quotes are the ones the send really uses', () => {
    expect(CONV_PUBLISH_VALUE).toBe(19_100_000n);
    expect(publicPublishValueForKind(0, 17)).toBe(20_300_000n);
    expect(publicPublishValueForKind(0, 18)).toBe(23_600_000n);
    const old = 33_900_000n;
    expect(old).not.toBe(CONV_PUBLISH_VALUE);
    expect(old > CONV_PUBLISH_VALUE).toBe(true);
  });

  it('PRICE-03: the quote never UNDERSTATES what leaves the wallet', () => {
    const walletDebitMeasured = 22_300_000n;
    const quoted = CONV_PUBLISH_VALUE + walletSendFeeNanotons([1]);
    expect(quoted).toBeGreaterThanOrEqual(walletDebitMeasured);
    expect(quoted).toBeLessThan(walletDebitMeasured * 2n);
    expect(CONV_PUBLISH_VALUE).toBeLessThan(walletDebitMeasured);
  });

  it('PRICE-05: the cost line says the figure is a MAXIMUM, in every locale', () => {
    const upTo: Record<string, string> = {
      en: 'up to', ru: 'до', zh: '最多', es: 'hasta', pt: 'até',
      fr: "jusqu'à", de: 'bis zu', hi: 'तक', id: 'hingga', ja: '最大',
    };
    for (const [locale, token] of Object.entries(upTo)) {
      const line = I18N_STRINGS[locale]?.['composer.costStatus'];
      expect(line, `${locale} has no composer.costStatus`).toBeTruthy();
      expect(line, `${locale} states an exact cost: ${line}`).toContain(token);
    }
    expect(Object.keys(upTo).sort()).toEqual(Object.keys(I18N_STRINGS).sort());
  });

  it('PRICE-04: the direct-pay status line exists in every locale and names the price AND the hold [2026-09-30]', () => {
    const cost = I18N.match(/"composer\.costStatus": "[^"]*"/g) ?? [];
    const costHold = I18N.match(/"composer\.costHoldStatus": "[^"]*"/g) ?? [];
    expect(cost).toHaveLength(costHold.length);
    expect(cost.length).toBeGreaterThanOrEqual(10);
    for (const line of cost) {
      expect(line, `${line} must name the hold too`).toContain('{hold}');
      expect(line).toContain('{cost}');
      expect(line, `${line} still names a discount`).not.toContain('{discount}');
    }
    for (const key of ['composer.costFinal', 'composer.needHoldStatus']) {
      const lines = I18N.match(new RegExp(`"${key.replace('.', '\\.')}": "[^"]*"`, 'g')) ?? [];
      expect(lines, key).toHaveLength(cost.length);
      for (const line of lines) {
        expect(line).toContain('{cost}');
        expect(line, `${line} must name the hold`).toContain('{hold}');
        expect(line, `${line} names a discount`).not.toContain('{discount}');
      }
    }
    expect(APP).toContain("const params = { cost: formatTonNanotonsUp(cost), setup: setupText, surcharge: setupText, hold: formatTonNanotonsUp(hold) };");
  });

  it('PRICE-06: a group row pays no INTRO and no recovery surcharge', () => {
    const start = APP.indexOf('function privateFirstContactExtraNanotons');
    expect(start, 'privateFirstContactExtraNanotons is gone or renamed').toBeGreaterThan(0);
    const end = APP.indexOf('function privateFirstContactRecoveryExtraNanotons', start);
    expect(end).toBeGreaterThan(start);
    const body = APP.slice(start, end).split(NEWLINE).map((line) => line.replace(/\/\/.*$/, '')).join(NEWLINE);
    expect(body, 'a group thread is not excluded from the first-contact surcharge').toContain('isGroupThread(thread)');
    expect(body.indexOf('isGroupThread(thread)')).toBeLessThan(body.indexOf('INTRO_PUBLISH_VALUE'));
    expect(APP).toContain('composerEstimatedNetCostNanotons(privateComposerPublishProfilesForPlan(plan), 1, { afterDeploy }) + privateFirstContactExtraNanotons(thread)');
    const line = APP.slice(APP.indexOf('function privateComposerFinalCostLine('), APP.indexOf('function composerChannelShardFact('));
    expect(line).toContain('const firstContact = !group && Boolean(thread) && !thread.convPeerKeyId;');
    expect(line).toContain('const extra = firstContact ? composerFirstContactExtraNanotons(thread, generation, prices) : 0n;');
  });
});
