import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


const app = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const fn = (start: string, source = app) => sourceBlock(source, start);

function storage({ refuse = false } = {}) {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => { if (refuse) throw new Error('SecurityError'); return map.get(key) ?? null; },
    setItem: (key: string, value: string) => { if (refuse) throw new Error('QuotaExceededError'); map.set(key, value); },
  };
}

function button(key: string) {
  const attrs = new Map<string, string>([['aria-expanded', 'true']]);
  const section = { dataset: {} as Record<string, string> };
  let onClick: (() => void) | null = null;
  return {
    section,
    dataset: { foldKey: key },
    title: '',
    getAttribute: (name: string) => attrs.get(name) ?? null,
    setAttribute: (name: string, value: string) => { attrs.set(name, value); },
    closest: () => section,
    addEventListener: (_type: string, handler: () => void) => { onClick = handler; },
    press: () => onClick?.(),
  };
}

function boot(localStorage: ReturnType<typeof storage>, source = app) {
  const buttons = [button('names'), button('gifts')];
  const document = { querySelectorAll: () => buttons };
  // eslint-disable-next-line no-new-func
  new Function('document', 'localStorage', 't', `
    const PROFILE_CARD_FOLDS_STORAGE_KEY = 'platho.profileCardFolded';
    const PROFILE_CARD_FOLD_KEYS = ['names', 'gifts'];
    ${fn('function readProfileCardFolds() {', source)}
    ${fn('function paintProfileCardFold(button, folded) {', source)}
    ${fn('function initProfileCardFolds() {', source)}
    initProfileCardFolds();`)(document, localStorage, (key: string) => `t:${key}`);
  const [names, gifts] = buttons;
  return { names, gifts };
}

const state = (b: ReturnType<typeof button>) => [b.section.dataset.folded, b.getAttribute('aria-expanded'), b.getAttribute('aria-label'), b.getAttribute('data-i18n-aria-label')];

describe('The profile card\'s lists fold under their headings', () => {
  it('FOLD-01: a press folds one list and labels its button for the next press; the other list is untouched', () => {
    const { names, gifts } = boot(storage());
    expect(state(names)).toEqual(['false', 'true', 't:profileCard.collapse', 'profileCard.collapse']);
    names.press();
    expect(state(names), 'folded: the press now opens it').toEqual(['true', 'false', 't:profileCard.expand', 'profileCard.expand']);
    expect(state(gifts)).toEqual(['false', 'true', 't:profileCard.collapse', 'profileCard.collapse']);
    names.press();
    expect(state(names)).toEqual(['false', 'true', 't:profileCard.collapse', 'profileCard.collapse']);
  });

  it('FOLD-02: the choice stays on this device — the next start opens the card as it was left', () => {
    const device = storage();
    boot(device).gifts.press();
    expect(device.getItem('platho.profileCardFolded')).toBe('["gifts"]');
    const again = boot(device);
    expect([again.names.section.dataset.folded, again.gifts.section.dataset.folded]).toEqual(['false', 'true']);
    device.setItem('platho.profileCardFolded', '["gifts","settings",7]');
    expect(boot(device).gifts.section.dataset.folded).toBe('true');
    device.setItem('platho.profileCardFolded', '{not json');
    expect(boot(device).gifts.section.dataset.folded, 'an unreadable value folds nothing').toBe('false');
  });

  it('FOLD-03: with storage refused the button still folds and opens — the screen decides, not the store', () => {
    const { names } = boot(storage({ refuse: true }));
    names.press();
    expect(names.section.dataset.folded).toBe('true');
    names.press();
    expect(names.section.dataset.folded, 'opened again').toBe('false');

    const asked = boot(storage({ refuse: true }), app.replace(
      "const fold = button.getAttribute('aria-expanded') === 'true';",
      'const fold = !readProfileCardFolds().has(key);'));
    asked.names.press();
    asked.names.press();
    expect(asked.names.section.dataset.folded, 'MEASURED with the store deciding: the second press folded it again').toBe('true');
  });

  it('FOLD-04: both headings carry the button, and folding hides the list and its note — not the heading, not the mint row', () => {
    for (const [key, list, title] of [['names', 'profileCardNames', 'profileCardNamesTitle'], ['gifts', 'profileCardGifts', 'profileCardGiftsTitle']]) {
      expect(html).toContain(`<button class="profile-card-fold" id="${list}Fold" type="button" data-fold-key="${key}" aria-labelledby="${list}Fold ${title}" aria-controls="${list}" aria-expanded="true"`);
      expect(html).toMatch(new RegExp(`<h3 id="${title}" data-i18n=`));
    }
    const rules = code(css);
    expect(rules).toMatch(/\.profile-card-section\[data-folded="true"\] > \.profile-card-note,\s*\.profile-card-section\[data-folded="true"\] > \.profile-card-rows,\s*\.profile-card-section\[data-folded="true"\] > \.profile-card-gifts \{\s*display: none;\s*\}/);
    expect(rules, 'the mint row is not folded away').not.toMatch(/data-folded="true"\][^{]*discovery-cta-actions/);
    expect(app).toMatch(/\ninitProfileCardFolds\(\);\n/);
  });

  it('FOLD-05: the button\'s words are in every locale', () => {
    const locales = Object.keys(I18N_STRINGS);
    expect(locales.length).toBeGreaterThanOrEqual(10);
    for (const locale of locales) {
      const strings = (I18N_STRINGS as any)[locale];
      expect([Boolean(strings['profileCard.collapse']), Boolean(strings['profileCard.expand'])], locale).toEqual([true, true]);
    }
  });
});
