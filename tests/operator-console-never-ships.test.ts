import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE OPERATOR CONSOLE AND ITS OUTPUT NEVER REACH THE PUBLIC REPOSITORY.
//
// `tools/admin/` holds what only the owner should run: mainnet census walks, the migration driver, the refund
// driver, chain watchers. `artifacts/local/` holds what they write — chain readings, receipts, an API key.
// Neither belongs in a repository anyone else can read.
//
// A.gitignore line is a RULE, NOT A GUARD [2026-09-02, decided 2026-09-02]. A rule can be edited away in a tidy-up, and `git add -f` walks straight past it
// with no warning at all. So this asks git itself, on every canonical run, on every machine: is anything from
// those two trees tracked right now?
//
// It names the two directories and nothing inside them. Both names are already in the public.gitignore, so this
// gate discloses nothing that file does not — which is the whole point of asserting the boundary rather than
// describing what sits behind it.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const LOCAL_ONLY = ['tools/admin', 'artifacts/local'];

/** What git currently tracks under a path. Empty when the tree is absent, which is the normal case on a machine
 *  that never had the console — the assertion is about what is TRACKED, not about what exists. */
function trackedUnder(path: string): string[] {
  return execFileSync('git', ['ls-files', '--', path], { encoding: 'utf8' })
    .split('\n').map((l) => l.trim()).filter(Boolean);
}

describe('OPERATOR-CONSOLE — the local-only trees stay out of the repository', () => {
  it('OPCON-01: git tracks nothing under tools/admin or artifacts/local', () => {
    for (const path of LOCAL_ONLY) {
      const tracked = trackedUnder(path);
      expect(tracked, `${path} has ${tracked.length} tracked file(s) — ${tracked.slice(0, 5).join(', ')}. `
        + 'These are operator-only: mainnet drivers, chain watchers and their readings. Remove them from the '
        + 'index (git rm --cached) before this is pushed anywhere.')
        .toEqual([]);
    }
  });

  it('OPCON-02: the ignore rules that hold them there are still in .gitignore', () => {
    // Belt to OPCON-01's braces: a deleted rule tracks nothing until the next `git add`, so the first gate would
    // stay green through the whole window in which the mistake is easy to make and easy to miss.
    const gitignore = readFileSync('.gitignore', 'utf8')
      .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    for (const path of LOCAL_ONLY) {
      expect(gitignore, `.gitignore no longer ignores ${path}/ — the operator console would be added by the next `
        + '`git add .`').toContain(`${path}/`);
    }
  });

  it('OPCON-03: git itself agrees the rule is in force, not merely written down', () => {
    // check-ignore is the only authority on whether a rule actually applies: a later negation (!tools/admin/x)
    // or a nested.gitignore can undo a line that is still present above. Exit 0 means ignored, 1 means NOT.
    for (const path of LOCAL_ONLY) {
      let ignored = false;
      try {
        execFileSync('git', ['check-ignore', '-q', '--', `${path}/`], { stdio: 'ignore' });
        ignored = true;
      } catch { ignored = false; }
      expect(ignored, `git does not ignore ${path}/ despite the .gitignore line — something later in the ignore `
        + 'chain is negating it').toBe(true);
    }
  });
});
