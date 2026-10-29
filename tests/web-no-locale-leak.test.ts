import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { shouldIncludeWebRuntimeFile } from '../scripts/prepare_static_web_deploy.mjs';


const WEB_ROOT = resolve('web');
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.html', '.css', '.json', '.md', '.webmanifest', '.svg', '.txt']);
const I18N_DICTIONARY_FILE = 'i18n-strings.mjs';
const CYRILLIC = /[Ѐ-ӿԀ-ԯ]/;

const NON_EN_LOCALES = ['ru', 'zh', 'es', 'pt', 'fr', 'de', 'hi', 'id', 'ja'] as const;
const LOCALIZED_DOC = new RegExp(`^docs/[^/]+\\.(${NON_EN_LOCALES.join('|')})\\.md$`);

const toPosix = (p: string): string => p.replace(/\\/g, '/');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

describe('shipped PWA text outside the dictionaries is English', () => {
  it('OPSEC-LOCALE-01: no production-bundled web file contains Cyrillic text', () => {
    const offenders: string[] = [];

    for (const abs of walk(WEB_ROOT)) {
      const rel = toPosix(relative(WEB_ROOT, abs));
      if (!shouldIncludeWebRuntimeFile(rel)) continue;
      if (rel === I18N_DICTIONARY_FILE) continue;
      if (LOCALIZED_DOC.test(rel)) continue;
      if (!TEXT_EXTENSIONS.has(extname(abs).toLowerCase())) continue;

      const src = readFileSync(abs, 'utf8');
      const match = src.match(CYRILLIC);
      if (match) {
        const idx = src.indexOf(match[0]);
        const snippet = src.slice(Math.max(0, idx - 40), idx + 40).replace(/\s+/g, ' ').trim();
        offenders.push(`${rel}: ...${snippet}...`);
      }
    }

    expect(offenders, `Cyrillic text found in shipped runtime files:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('OPSEC-LOCALE-02: every doc is translated into all locales (parity — no language more complete than another)', () => {
    const docsDir = join(WEB_ROOT, 'docs');
    const allMd = readdirSync(docsDir).filter((name) => name.endsWith('.md'));
    const localeSuffix = new RegExp(`\\.(${NON_EN_LOCALES.join('|')})\\.md$`);
    const baseDocs = allMd.filter((name) => !localeSuffix.test(name));
    expect(baseDocs.length, 'expected at least one English base doc under web/docs').toBeGreaterThan(0);

    const missing: string[] = [];
    for (const base of baseDocs) {
      for (const locale of NON_EN_LOCALES) {
        const localized = base.replace(/\.md$/, `.${locale}.md`);
        let ok = false;
        try { ok = readFileSync(join(docsDir, localized), 'utf8').trim().length > 0; } catch { ok = false; }
        if (!ok) missing.push(`docs/${localized}`);
      }
    }
    expect(missing, `missing or empty localized docs (every base doc must exist in every locale):\n${missing.join('\n')}`).toEqual([]);
  });
});
