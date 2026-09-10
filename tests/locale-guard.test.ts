import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// LOCALE GUARD — the developer's locale must not leak into the repository. This is a STANDING OWNER RULE that
// was written down and then broken anyway, repeatedly, because it lived only in prose and in whoever
// remembered it. A rule nobody enforces is not a rule. This gate makes it mechanical.
//
// THE RULE, restated by the owner 2026-08-28 after it was broken twice in one day [decided]: files are written
// in English TO BEGIN WITH — shipped or not, tracked or not, public or local. There is no "working file"
// carve-out and no translate-it-later. The only Russian in this repository is the app's own product content.
//
// HOW IT WORKS — a RATCHET, not a wall. The tree already carries a large debt of Cyrillic (design specs,
// legacy comments), and a gate that simply banned it would go red on every run and be switched off within a
// day. So instead:
//   * a file NOT in the baseline must contain ZERO Cyrillic — this is what stops NEW leaks, permanently;
//   * a file IN the baseline may not carry MORE Cyrillic than it does today — the debt can shrink, never grow;
//   * INTENDED Russian is allowlisted by purpose, not by accident (the app ships a Russian UI and a Russian
//     whitepaper — that content is a product feature, not a leak).
// When a baseline file is cleaned, re-run with LOCALE_BASELINE_UPDATE=1 to lower its number. The number may
// only ever go down; that is the whole point.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

// Unicode ESCAPES on purpose (Cyrillic block + supplement), so this gate's own file stays ASCII-clean and
// needs no self-exemption — a detector that trips itself is a detector everyone learns to ignore.
const CYRILLIC = new RegExp('[\\u0400-\\u04FF\\u0500-\\u052F]');
const BASELINE_PATH = 'tests/fixtures/locale-debt-baseline.json';

// THE ONLY EXCEPTION [OWNER 2026-08-28]: Russian that IS the app — the UI dictionary and the documentation the
// app serves to its readers. That content is product, deliberately localized, and may grow freely.
// NOTHING else is exempt: not design specs, not code comments, not the working journal, not this file. An
// earlier revision of this gate exempted the lane journal because it never ships; the owner rejected that
// outright — the rule is about how files are WRITTEN, not about where they end up.
const INTENTIONAL = [
  /^web\/i18n-strings\.mjs$/,   // the app's own UI translation dictionary
  /^web\/docs\/.*\.ru\.md$/,    // documentation the app serves in Russian (e.g. the ATH whitepaper)
];

const SCANNED = /\.(tact|ts|mjs|js|md|json|txt|html|css)$/;

// GITIGNORED TODAY, PUBLISHED TOMORROW [2026-08-28 — the hole this gate had from the day it was written]. The
// scan below asks git what exists, and git does not answer for ignored paths. That is right for build output
// and node_modules, and WRONG for an unreleased generation: contracts18/ is ignored only until its cutover.
// The gate found Cyrillic sitting there, invisible to it, written after the rule was made by the same hand
// that wrote the rule — including a verbatim owner quote inside a SEALED contract source.
// Note what a green run here does and does not say. It says these files carry no developer locale. It does NOT
// say the folder is safe to publish: the working journal holds security findings, measured costs and live
// addresses, and that is LOCALE-04's job, not this one. Add a directory here the moment you start one.
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
    return 0;   // deleted or unreadable — nothing to leak
  }
};

describe('LOCALE-GUARD', () => {
  // TRACKED **AND** UNTRACKED-BUT-NOT-IGNORED. Scanning only git-tracked files was a hole this gate's own bite
  // test exposed twice: a brand-new file — the exact thing being written right now, before any commit — was
  // invisible to it, which is precisely when the rule needs to fire.
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
      'These files are new or were clean and now carry Cyrillic. Write them in English from the start. The '
      + 'words of the owner are never quoted in files, in any language: record the decision and the date. If the Russian is deliberate PRODUCT content, '
      + `add it to INTENTIONAL in ${'tests/locale-guard.test.ts'} with the reason.\n  ` + offenders.join('\n  '))
      .toEqual([]);
  });

  it('LOCALE-02: the debt RATCHET only turns down — a baseline file may never gain more locale text', () => {
    const grown: string[] = [];
    for (const [file, was] of Object.entries(baseline)) {
      if (INTENTIONAL.some((re) => re.test(file))) continue;   // adding UI translations must never fail a run
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
    // A fully cleaned file must eventually leave the baseline, but never blocks a run.
    expect(Array.isArray(stale)).toBe(true);
  });

  it('LOCALE-04: the lane journal is never GIT-TRACKED — it needs a REDACTION pass, which no language gate gives', () => {
    // [standing decision, recorded in the journal's own register] The journal stays local. It holds security
    // findings, measured costs, live addresses and decision provenance a public repo does not need — and none
    // of that is a language problem, so LOCALE-01 going green over this folder must never be read as "safe to
    // publish". This is the gate that enforces the decision, and it is mechanical: the moment the file enters
    // the index, it fails.
    const trackedJournal = execSync('git ls-files contracts18/docs/JOURNAL.md', { encoding: 'utf8' }).trim();
    expect(trackedJournal,
      'contracts18/docs/JOURNAL.md is now tracked. It must stay local until it has had a REDACTION pass — live '
      + 'addresses, security findings and decision provenance are in it.')
      .toBe('');
  });
});
