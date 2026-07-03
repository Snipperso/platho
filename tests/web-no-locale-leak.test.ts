import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { shouldIncludeWebRuntimeFile } from '../scripts/prepare_static_web_deploy.mjs';

// OPSEC invariant for an anonymous, censorship-resistant messenger: the shipped
// PWA must not leak the team's locale. Any user worldwide can fetch these files
// (and the boot watchdog overlay renders to everyone, regardless of browser
// language), so a hardcoded Russian string would reveal the developers' origin.
// Shipped runtime copy is English-only. This regression was real: the boot
// watchdog shipped bilingual RU/EN text.
//
// i18n era (v655): the ONE exemption is the locale dictionary file, where Russian
// is one of ten equal languages. The anti-leak invariant moves to key parity —
// every locale carries the identical key set (tests/i18n.test.ts), so the ru
// dictionary can never be more complete (i.e. more loved) than the others.

const WEB_ROOT = resolve('web');
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.html', '.css', '.json', '.md', '.webmanifest', '.svg', '.txt']);
// The only file allowed to carry non-English (incl. Cyrillic) text.
const I18N_DICTIONARY_FILE = 'i18n-strings.mjs';
// Cyrillic + Cyrillic Supplement; the only locale we actually risk leaking.
const CYRILLIC = /[Ѐ-ӿԀ-ԯ]/;

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

describe('shipped PWA leaks no developer locale', () => {
  it('OPSEC-LOCALE-01: no production-bundled web file contains Cyrillic text', () => {
    const offenders: string[] = [];

    for (const abs of walk(WEB_ROOT)) {
      const rel = toPosix(relative(WEB_ROOT, abs));
      if (!shouldIncludeWebRuntimeFile(rel)) continue; // only inspect what actually ships
      if (rel === I18N_DICTIONARY_FILE) continue; // the locale dictionaries — parity-guarded instead
      if (!TEXT_EXTENSIONS.has(extname(abs).toLowerCase())) continue; // skip binaries

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
});
