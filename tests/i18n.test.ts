import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_STRINGS, I18N_LOCALES } from '../web/i18n-strings.mjs';

// The i18n engine (web/i18n.mjs) touches document/localStorage at import time only inside functions,
// so it is importable in node — but its behavior tests run through a locale-pinned copy of the pure
// helpers here via the dictionary contract instead. Engine wiring is pinned in pwa-runtime-config tests.

describe('i18n dictionaries', () => {
  const localeCodes = I18N_LOCALES.map((l: { code: string }) => l.code);

  it('PWA-I18N-01: locale list and dictionary keys agree, en is the base', () => {
    expect(localeCodes[0]).toBe('en');
    expect(new Set(localeCodes).size).toBe(localeCodes.length);
    expect(Object.keys(I18N_STRINGS).sort()).toEqual([...localeCodes].sort());
    // Ten launch locales, endonym labels present.
    expect(localeCodes).toEqual(['en', 'ru', 'zh', 'es', 'pt', 'fr', 'de', 'hi', 'id', 'ja']);
    for (const locale of I18N_LOCALES) {
      expect(locale.native, `endonym for ${locale.code}`).toBeTruthy();
    }
  });

  it('PWA-I18N-02: OPSEC key parity — every locale ships the IDENTICAL non-plural key set', () => {
    // This is the anti-locale-leak invariant in the i18n era (see web-no-locale-leak.test.ts): no
    // dictionary may be more complete than the others, so no language reveals the team's origin.
    // Plural BASES are excluded here (a base's variant set is fixed by the language's grammar, not by how
    // much a locale is loved — ru carries #few/#many, zh only #other); PWA-I18N-04 guards their coverage.
    const nonPlural = (dict: Record<string, string>) => Object.keys(dict).filter((k) => !k.includes('#')).sort();
    const enKeys = nonPlural(I18N_STRINGS.en);
    expect(enKeys.length).toBeGreaterThan(0);
    for (const code of localeCodes) {
      if (code === 'en') continue;
      expect(nonPlural(I18N_STRINGS[code]), `${code} non-plural key set`).toEqual(enKeys);
    }
  });

  it('PWA-I18N-02b: every plural base present in en exists in every locale, with valid CLDR categories', () => {
    const CLDR = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
    const basesOf = (dict: Record<string, string>) =>
      new Set(Object.keys(dict).filter((k) => k.includes('#')).map((k) => k.split('#')[0]));
    const enBases = basesOf(I18N_STRINGS.en);
    for (const code of localeCodes) {
      const bases = basesOf(I18N_STRINGS[code]);
      for (const base of enBases) {
        expect(bases.has(base), `${code} missing plural base ${base}`).toBe(true);
      }
      for (const key of Object.keys(I18N_STRINGS[code])) {
        if (!key.includes('#')) continue;
        expect(CLDR.has(key.split('#')[1]), `${code}:${key} category`).toBe(true);
      }
    }
  });

  it('PWA-I18N-03: every dictionary value is a non-empty string with balanced {params}', () => {
    const paramsOf = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const code of localeCodes) {
      const dict = I18N_STRINGS[code] as Record<string, string>;
      for (const [key, value] of Object.entries(dict)) {
        expect(typeof value, `${code}:${key} type`).toBe('string');
        expect(value.length, `${code}:${key} empty`).toBeGreaterThan(0);
        // A translation must consume exactly the params the English source defines — a dropped {count}
        // or an invented {name} breaks interpolation silently at runtime. Plural variants (base#category)
        // compare against the en base#other form, since en carries only #one/#other but locales like ru add
        // #few/#many that have no direct en counterpart.
        if (code !== 'en') {
          const enKey = key.includes('#') ? `${key.split('#')[0]}#other` : key;
          const enValue = (I18N_STRINGS.en as Record<string, string>)[enKey];
          expect(paramsOf(value), `${code}:${key} params`).toEqual(paramsOf(enValue ?? ''));
        }
      }
    }
  });

  it('PWA-I18N-04: plural keys carry #other in every locale (the engine fallback category)', () => {
    const enKeys = Object.keys(I18N_STRINGS.en);
    const pluralBases = new Set(
      enKeys.filter((k) => k.includes('#')).map((k) => k.split('#')[0]),
    );
    for (const base of pluralBases) {
      for (const code of localeCodes) {
        expect(
          (I18N_STRINGS[code] as Record<string, string>)[`${base}#other`],
          `${code}:${base}#other`,
        ).toBeTruthy();
      }
    }
  });

  it('PWA-I18N-05: no locale but ru contains Cyrillic; en contains no CJK/Devanagari', () => {
    // Sanity direction check — catches a paste-shifted dictionary (e.g. zh strings under es).
    const cyrillic = /[Ѐ-ӿԀ-ԯ]/;
    for (const code of localeCodes) {
      if (code === 'ru') continue;
      const joined = Object.values(I18N_STRINGS[code] as Record<string, string>).join('\n');
      expect(cyrillic.test(joined), `${code} carries Cyrillic`).toBe(false);
    }
    const enJoined = Object.values(I18N_STRINGS.en as Record<string, string>).join('\n');
    expect(/[一-鿿ऀ-ॿ぀-ヿ]/.test(enJoined)).toBe(false);
  });
});

describe('i18n engine source pins', () => {
  const engine = readFileSync('web/i18n.mjs', 'utf8');

  it('PWA-I18N-06: engine detection order, storage key, and fallback chain', () => {
    // stored choice -> Telegram profile language -> browser languages -> en.
    expect(engine).toMatch(/const I18N_STORAGE_KEY = 'platho\.locale\.v1';/);
    expect(engine).toMatch(/localStorage\.getItem\(I18N_STORAGE_KEY\)/);
    expect(engine).toMatch(/Telegram\?\.WebApp\?\.initDataUnsafe\?\.user\?\.language_code/);
    expect(engine).toMatch(/navigator\.languages/);
    // Missing keys fall back en -> visible [key] marker (never a blank UI).
    expect(engine).toMatch(/return `\[\$\{key\}\]`;/);
    // Plurals go through Intl.PluralRules with #other as the guaranteed fallback.
    expect(engine).toMatch(/new Intl\.PluralRules\(activeLocale\)\.select\(count\)/);
    expect(engine).toMatch(/\$\{key\}#\$\{category\}/);
    // The document language follows the app locale (screen readers, hyphenation).
    expect(engine).toMatch(/document\.documentElement\.lang = activeLocale;/);
  });

  it('PWA-I18N-07: static translation attributes cover text + placeholder/title/aria-label/alt', () => {
    expect(engine).toMatch(/\[data-i18n\]/);
    for (const attr of ['placeholder', 'title', 'aria-label', 'alt']) {
      expect(engine).toContain(`['data-i18n-${attr}', '${attr}']`);
    }
  });
});

describe('i18n app integration', () => {
  const app = readFileSync('web/app.js', 'utf8');
  const html = readFileSync('web/index.html', 'utf8');

  it('PWA-I18N-08: app boots the engine before rendering and wires both language selects', () => {
    // Locale resolves + static HTML is translated at import time, before the shell renders.
    expect(app).toMatch(/import \{[\s\S]*?\bt,[\s\S]*?\btPlural,[\s\S]*?\} from '\.\/i18n\.mjs\?v=25';/);
    expect(app).toMatch(/initI18n\(\);\s*applyStaticTranslations\(\);/);
    // Both selects populated with endonyms and wired.
    expect(app).toMatch(/function populateLanguageSelect\(select\)/);
    expect(app).toMatch(/populateLanguageSelect\(appLanguageSelect\);/);
    expect(app).toMatch(/populateLanguageSelect\(quickStartLanguageSelect\);/);
    // Profile switch reloads (only provably-clean way to purge baked-in dynamic renders); quick-start applies
    // in place (nothing dynamic pre-wallet, a reload would restart the dialog).
    expect(app).toMatch(/appLanguageSelect\?\.addEventListener\('change', \(\) => \{\s*setLocale\(appLanguageSelect\.value\);\s*window\.location\.reload\(\);/);
    expect(app).toMatch(/quickStartLanguageSelect\?\.addEventListener\('change'/);
    // The two language rows exist in the static shell.
    expect(html).toMatch(/id="appLanguageSelect"/);
    expect(html).toMatch(/id="quickStartLanguageSelect"/);
    // The app owns its translations — opt OUT of browser / Google auto-translate so it can't double-translate
    // and mangle the already-localized UI.
    expect(html).toMatch(/<html lang="en" translate="no">/);
    expect(html).toMatch(/<meta name="google" content="notranslate">/);
  });

  it('PWA-I18N-09: locale-sensitive formatting uses the app locale, not the browser', () => {
    // Thread-list dates follow the chosen UI language.
    expect(app).toMatch(/toLocaleTimeString\(currentLocale\(\)/);
    expect(app).toMatch(/toLocaleDateString\(currentLocale\(\)/);
    // Amount grouping uses a narrow no-break space (never ',', which reads as a decimal mark in ru/de).
    expect(app).toMatch(/\/g, '\\u202F'\)/);
  });

  it('PWA-I18N-10: messageSyncStatus state is decoupled from its translated display text', () => {
    // The node is read as state elsewhere; with i18n the text is translated, so state lives in a marker.
    expect(app).toMatch(/function setMessageSyncStatus\(text, state = ''\)/);
    expect(app).toMatch(/function messageSyncStatusState\(\)/);
    expect(app).toMatch(/messageSyncStatus\.dataset\.syncState/);
    // No call site reads the translated textContent as state anymore.
    expect(app).not.toMatch(/messageSyncStatus\?\.textContent === 'syncing'/);
    expect(app).not.toMatch(/messageSyncStatus\?\.textContent !== 'sync delayed'/);
    expect(app).toMatch(/messageSyncStatusState\(\) === 'syncing'/);
    expect(app).toMatch(/messageSyncStatusState\(\) !== 'delayed'/);
  });
});
