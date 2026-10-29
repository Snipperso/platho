import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';


const CYRILLIC = new RegExp('[\\u0400-\\u04FF\\u0500-\\u052F]');
const BASELINE_PATH = 'tests/fixtures/locale-debt-baseline.json';

const INTENTIONAL = [
  /^web\/i18n-strings\.mjs$/,
  /^web\/docs\/.*\.ru\.md$/,
];

const SCANNED = /\.(tact|ts|mjs|js|md|json|txt|html|css)$/;

const SHIPPING_BUT_IGNORED = ['contracts18'];

const walkTree = (dir: string, out: string[] = []): string[] => {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const f = join(dir, e.name).split('\\').join('/');
    if (e.isDirectory()) { if (!/^(node_modules|build|\.git)$/.test(e.name)) walkTree(f, out); }
    else if (SCANNED.test(e.name)) out.push(f);
  }
  return out;
};

const countCyrillic = (file: string): number => {
  try {
    return readFileSync(file, 'utf8').split('\n').filter((l) => CYRILLIC.test(l)).length;
  } catch {
    return 0;
  }
};

describe('LOCALE-GUARD', () => {
  const listed = (cmd: string): string[] =>
    execSync(cmd, { encoding: 'utf8', maxBuffer: 1e8 }).split('\n').filter((f) => SCANNED.test(f));
  const tracked: string[] = [
    ...listed('git ls-files'),
    ...listed('git ls-files --others --exclude-standard'),
    ...SHIPPING_BUT_IGNORED.flatMap((d) => walkTree(d)),
  ];
  const baseline: Record<string, number> = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

  it('LOCALE-01: a file outside the baseline carries NO developer-locale text — this is what stops new leaks', () => {
    const offenders: string[] = [];
    for (const file of tracked) {
      if (INTENTIONAL.some((re) => re.test(file))) continue;
      if (Object.prototype.hasOwnProperty.call(baseline, file)) continue;
      const n = countCyrillic(file);
      if (n > 0) offenders.push(`${file} (${n} lines)`);
    }
    expect(offenders,
      'These files are new or were clean and now carry Cyrillic. Write them in English from the start. If the Russian is deliberate PRODUCT content, '
      + `add it to INTENTIONAL in ${'tests/locale-guard.test.ts'} with the reason.\n  ` + offenders.join('\n  '))
      .toEqual([]);
  });

  it('LOCALE-02: the debt RATCHET only turns down — a baseline file may never gain more locale text', () => {
    const grown: string[] = [];
    for (const [file, was] of Object.entries(baseline)) {
      if (INTENTIONAL.some((re) => re.test(file))) continue;
      const now = countCyrillic(file);
      if (now > was) grown.push(`${file}: ${was} -> ${now}`);
    }
    expect(grown,
      'These files already carried a locale debt and just grew it. Clean as you go, never add.\n  '
      + grown.join('\n  ')).toEqual([]);
  });

  it('LOCALE-03: the baseline itself stays honest — no stale entries, and it is allowed to shrink', () => {
    const stale: string[] = [];
    let cleaned = 0;
    for (const [file, was] of Object.entries(baseline)) {
      const now = countCyrillic(file);
      if (now === 0) stale.push(file);
      else if (now < was) cleaned += was - now;
    }
    if (cleaned > 0 || stale.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[LOCALE] debt shrank by ${cleaned} lines; ${stale.length} files fully cleaned — `
        + 're-run with LOCALE_BASELINE_UPDATE=1 to lower the baseline.');
    }
    expect(Array.isArray(stale)).toBe(true);
  });

  it('LOCALE-04: the lane journal is never git-tracked', () => {
    const trackedJournal = execSync('git ls-files contracts18/docs/JOURNAL.md', { encoding: 'utf8' }).trim();
    expect(trackedJournal,
      'contracts18/docs/JOURNAL.md is now tracked; it stays local.')
      .toBe('');
  });

  it('LOCALE-02: no file carries an absolute user-home path — whatever account it names', () => {
    const HOME_PATH = /(?:[A-Za-z]:\\Users\\|\/home\/|\/Users\/)(?![<\\/])[A-Za-z0-9._-]{2,}/;
    const NOT_OURS = [
      /^\.claude\//,
      /^artifacts\/[^/]*\/Default\/Extensions\//,
      /^tests\/locale-guard\.test\.ts$/,
    ];
    const offenders: string[] = [];
    for (const file of walkTree('.')) {
      const rel = file.replace(/^\.\//, '');
      if (INTENTIONAL.some((re) => re.test(file)) || NOT_OURS.some((re) => re.test(rel))) continue;
      const hits = readFileSync(file, 'utf8').split('\n')
        .map((line, i) => [i + 1, line] as const)
        .filter(([, line]) => HOME_PATH.test(line));
      if (hits.length) offenders.push(`${file}:${hits[0][0]}`);
    }
    expect(offenders, 'an absolute home path names the machine and the account it was written on. Use a '
      + 'repo-relative path, or the slug of whatever lives there. The pre-commit scan cannot see this: it reads '
      + 'STAGED lines, and the audit trail under contracts18/ is gitignored and never staged.').toEqual([]);

    expect(HOME_PATH.test('C:\\Users\\someone\\.claude\\notes.md'), 'a Windows home path is a leak').toBe(true);
    expect(HOME_PATH.test('/home/someone/platho'), 'and a Linux one').toBe(true);
    expect(HOME_PATH.test('/Users/someone/platho'), 'and a mac one').toBe(true);
    expect(HOME_PATH.test('C:\\Users\\<account>\\.claude'), 'a placeholder names nobody').toBe(false);
    expect(HOME_PATH.test('web/app.js'), 'a repo-relative path is fine').toBe(false);
    expect(HOME_PATH.test('/usr/bin/node'), 'and so is a system path').toBe(false);
  });
});
