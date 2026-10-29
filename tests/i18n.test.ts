import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { I18N_STRINGS, I18N_LOCALES } from '../web/i18n-strings.mjs';


describe('i18n dictionaries', () => {
  const localeCodes = I18N_LOCALES.map((l: { code: string }) => l.code);

  it('PWA-I18N-01: locale list and dictionary keys agree, en is the base', () => {
    expect(localeCodes[0]).toBe('en');
    expect(new Set(localeCodes).size).toBe(localeCodes.length);
    expect(Object.keys(I18N_STRINGS).sort()).toEqual([...localeCodes].sort());
    expect(localeCodes).toEqual(['en', 'ru', 'zh', 'es', 'pt', 'fr', 'de', 'hi', 'id', 'ja']);
    for (const locale of I18N_LOCALES) {
      expect(locale.native, `endonym for ${locale.code}`).toBeTruthy();
    }
  });

  it('PWA-I18N-12: every key the app CALLS exists, and every key it ships is called', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!['vendor', 'docs'].includes(entry.name)) walk(`${dir}/${entry.name}`);
          continue;
        }
        if (/\.(js|mjs|html)$/.test(entry.name)) files.push(`${dir}/${entry.name}`);
      }
    };
    walk('web');
    expect(files.length, 'the scan found no files — did web/ move?').toBeGreaterThan(50);

    const base = (key: string) => (key.includes('#') ? key.split('#')[0] : key);
    const shipped = new Set(Object.keys(I18N_STRINGS.en).map(base));
    const called = new Set<string>();
    const literalCalls = new Set<string>();
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*(['"`])([^'"`$\n]+)\1/g)) {
        literalCalls.add(m[2]);
        called.add(m[2]);
      }
      for (const m of src.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) called.add(m[1]);
      for (const m of src.matchAll(/(['"`])([a-z][\w.]*\.[\w.]+)\1/gi)) {
        if (shipped.has(m[2])) called.add(m[2]);
      }
    }

    const undefinedKeys = [...literalCalls].filter((key) => !shipped.has(key)).sort();
    expect(undefinedKeys,
      'called with t() but shipped by no dictionary — the user reads the key itself').toEqual([]);

    const deadKeys = [...shipped].filter((key) => !called.has(key)).sort();
    expect(deadKeys, 'shipped in every locale and referenced nowhere in web/').toEqual([]);
  });

  it('PWA-I18N-02: OPSEC key parity — every locale ships the IDENTICAL non-plural key set', () => {
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
    expect(engine).toMatch(/const I18N_STORAGE_KEY = 'platho\.locale\.v1';/);
    expect(engine).toMatch(/localStorage\.getItem\(I18N_STORAGE_KEY\)/);
    expect(engine).toMatch(/Telegram\?\.WebApp\?\.initDataUnsafe\?\.user\?\.language_code/);
    expect(engine).toMatch(/navigator\.languages/);
    expect(engine).toMatch(/return `\[\$\{key\}\]`;/);
    expect(engine).toMatch(/new Intl\.PluralRules\(activeLocale\)\.select\(count\)/);
    expect(engine).toMatch(/\$\{key\}#\$\{category\}/);
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
    expect(app).toMatch(/import \{[\s\S]*?\bt,[\s\S]*?\btPlural,[\s\S]*?\} from '\.\/i18n\.mjs\?v=\d+';/);
    expect(app).toMatch(/initI18n\(\);\s*applyStaticTranslations\(\);/);
    expect(app).toMatch(/function populateLanguageSelect\(select\)/);
    expect(app).toMatch(/populateLanguageSelect\(appLanguageSelect\);/);
    expect(app).toMatch(/populateLanguageSelect\(quickStartLanguageSelect\);/);
    expect(app).toMatch(/appLanguageSelect\?\.addEventListener\('change', \(\) => \{\s*setLocale\(appLanguageSelect\.value\);\s*window\.location\.reload\(\);/);
    expect(app).toMatch(/quickStartLanguageSelect\?\.addEventListener\('change'/);
    expect(html).toMatch(/id="appLanguageSelect"/);
    expect(html).toMatch(/id="quickStartLanguageSelect"/);
    expect(html).toMatch(/<html lang="en" translate="no">/);
    expect(html).toMatch(/<meta name="google" content="notranslate">/);
  });

  it('PWA-I18N-09: locale-sensitive formatting uses the app locale, not the browser', () => {
    expect(app).toContain('function threadListFormatter(kind) {\n  const locale = currentLocale();');
    expect(app).toContain('new Intl.DateTimeFormat(locale, options)');
    expect(app).toMatch(/\/g, '\\u202F'\)/);
  });

  it('PWA-I18N-11: every plural key carries every category its locale actually uses', () => {
    const codes = I18N_LOCALES.map((l: { code: string }) => l.code);
    const pluralKeys = new Map<string, Set<string>>();
    for (const locale of codes) {
      for (const key of Object.keys(I18N_STRINGS[locale as keyof typeof I18N_STRINGS])) {
        const at = key.indexOf('#');
        if (at < 0) continue;
        const base = key.slice(0, at);
        if (!pluralKeys.has(base)) pluralKeys.set(base, new Set());
        pluralKeys.get(base)!.add(`${locale}#${key.slice(at + 1)}`);
      }
    }
    expect(pluralKeys.size, 'the dictionary really has plural keys').toBeGreaterThan(5);
    const missing: string[] = [];
    for (const [base, present] of pluralKeys) {
      for (const locale of codes) {
        const rules = new Intl.PluralRules(locale);
        const used = new Set(Array.from({ length: 201 }, (_, n) => rules.select(n)));
        for (const category of used) {
          if (!present.has(`${locale}#${category}`)) missing.push(`${locale} ${base}#${category}`);
        }
      }
    }
    expect(missing, 'a missing category silently falls back to the form of another number').toEqual([]);
  });

  it('PWA-I18N-10: sync state is never read back out of translated display text', () => {
    expect(app, 'no branch may compare rendered text against a translated string')
      .not.toMatch(/textContent\s*[=!]==\s*t\(/);
    expect(app).toMatch(/dataset\.syncing = active \? 'true' : 'false'/);
    expect(app).not.toMatch(/messageSyncStatus\s*=\s*document\.querySelector/);
    expect(app).not.toMatch(/function setMessageSyncStatus\(/);
  });

  it('PWA-I18N-13: one register per locale — German addresses the reader as Sie, Spanish as tú, Portuguese as você [decided 2026-09-24]', () => {
    const offenders = (locale: string, re: RegExp) => Object.entries((I18N_STRINGS as any)[locale]).filter(([, value]) => re.test(String(value))).map(([key]) => key);
    expect(offenders('de', /\b(du|dich|dir|dein|deine|deinen|deinem|deiner|deines)\b/i)).toEqual([]);
    expect(offenders('de', /(^|[.!?:—–]\s+|„)(Tippe|Speichere|Beschreibe|Entdecke|Trage|Prüfe|Sende|Gib|Öffne|Wähle|Kopiere|Füge|Warte|Bestätige|Lade|Melde|Erstelle|Schreibe|Antworte|Lies|Nutze|Behalte|Notiere|Scanne|Zeige|Schließe|Versuche|Aktiviere|Entsperre|Verbinde|Installiere|Teile|Lösche|Bewahre|Halte|Sieh|Schau|Drücke|Klicke|Setze|Erlaube|Nimm|Komm|Geh|Lass|Denk|Achte|Vergiss|Hol|Leg|Zieh|Mach|Bring)\b(?!\s+Sie\b)/)).toEqual([]);
    expect(offenders('es', /\busted(es)?\b/i)).toEqual([]);
    expect(offenders('es', /(^|[.!?:—–]\s+|«)(Pulse|Introduzca|Escriba|Guarde|Abra|Compruebe|Elija|Seleccione|Toque|Espere|Vuelva|Confirme|Copie|Pegue|Envíe|Añada|Revise|Cierre|Desbloquee|Conecte|Instale|Déjelo|Déjela|Pida|Utilice|Mantenga|Recuerde|Sopese|Anote|Descargue|Quite|Retire|Cambie|Actualice|Reintente|Intente|Continúe|Acepte|Cancele|Borre|Elimine|Busque|Comparta|Firme|Pague|Recargue|Verifique|Tenga|Haga|Vaya)\b/)).toEqual([]);
    expect(offenders('pt', /\b(tu|teu|tua|teus|tuas|contigo)\b/i)).toEqual([]);
  });

});
