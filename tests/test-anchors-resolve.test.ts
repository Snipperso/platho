import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A SOURCE PIN THAT LOST ITS ANCHOR STOPS TESTING AND SAYS NOTHING.
//
// Most guards in this suite scope themselves with `source.slice(source.indexOf(A), source.indexOf(B))`. When the
// function they name is renamed, deleted, or merely loses an `async`, indexOf returns -1 and String.slice does
// not complain: `slice(-1, n)` yields '' and `slice(n, -1)` yields everything from n to the end of the file. The
// assertions that follow then either vanish (a falsy scope guarded by `if (scope)`) or widen to the whole file,
// where almost any regex finds a match somewhere. The gate stays green for the wrong reason, sometimes for
// months, and nobody learns that the property it is named for has no coverage at all.
//
// MEASURED 2026-08-29 across all 1,056 resolvable anchors: 41 were dead. The clearest was FOLLOW-03, "nothing
// follows on RECEIPT — that is the spam door", whose two assertions sit behind `if (adopt)` and were skipped
// entirely because `adoptIncomingIntro` no longer exists — the anti-spam property it guards had zero coverage.
// Another, PWA-PREFS-NO-SILENT-FLUSH-01, widened to the rest of app.js and was satisfied by the DECLARATION of
// the function whose CALL it was written to require.
//
// This gate closes the class: an anchor that names text absent from the file it was read from is a defect, and
// the 31 that already exist are listed below and may only ever shrink.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = `${dir}/${name}`;
  return statSync(path).isDirectory() ? walk(path) : [path];
});

/**
 * Decode the escapes a JS single-quoted literal carries, so the needle compared is the one indexOf would use.
 * ONE pass with a callback, deliberately: the first version staged a double backslash through a placeholder and
 * then restored it, which silently rewrote every SPACE in a needle into a backslash and reported a live anchor
 * as dead. A single pass has no ordering to get wrong.
 */
const unescape = (s: string): string => s.replace(/\\(.)/g, (_m, c: string) => {
  if (c === 'n') return '\n';
  if (c === 't') return '\t';
  if (c === 'r') return '\r';
  return c;
});

/**
 * THE DEBT THAT ALREADY EXISTED, enumerated so it cannot grow and cannot be forgotten. Every entry is a scope
 * anchor whose subject is gone from web/app.js. Three shapes, and the fix differs by shape:
 *   - the subject was DELETED with the Vault era (submitVault*, tonBalanceValue, messageDiscountUnlocked,...):
 *     the assertions it scoped are testing a feature that no longer exists — delete them with it;
 *   - the subject was RENAMED (resumePendingPrivatePublishConfirmations -> resumePendingPrivateSendRetries,...):
 *     re-aim the anchor and check the assertions still mean what their titles claim;
 *   - the subject merely lost an `async` (openImageLightbox): fix the anchor.
 * Removing a line here without repairing its site turns this gate red from the other side, which is the point.
 */
const KNOWN_DEAD: Array<[string, string[]]> = [
  ['tests/conversation-channel-follow.test.ts', [
  ]],
  ['tests/pwa-runtime-config.test.ts', [
    'async function assertVaultHasPrivatePublishHold',
    'async function readCurrentProfileAvatarPointerFromChain',
    'async function resolvePaymentCheckRecipientWallet',
    'async function runPrivatePublishConfirmationRetry',
    'async function submitAthDueFlush',
    'async function submitVaultAuthExternalWithNonceConfirmation',
    'async function submitVaultMessage',
    'async function submitVaultUsernameMint',
    'function configuredCapsuleHubAddress',
    'function formatBasisPointsPercent',
    'function isAmbiguousTonRpcBroadcastError',
    'function isBodyHistoryUnavailableError',
    'function markPublishStateAwaitingPartsForRetry',
    'function markStaleUnconfirmedPublishPartsForRetry',
    'function messageDiscountUnlocked',
    'function normalizePublicSyncWindow',
    'function privateDebugPublishMessages',
    'function privateIndexLinkValue',
    'function queueAthProtocolStatsRefresh',
    'function readPublicReadCursors(',
    'function refreshVaultTabLock',
    'function requireUsernameRegistryVaultRoute(',
    'function requireUsernameRegistryVaultRouteForOwnVaultAction(',
    'function resumePendingPrivatePublishConfirmations',
    'function schedulePrivatePublishConfirmationRetry',
    'function tonBalanceValue',
    'function updatePrivateComposerState',
  ]],
];

interface Anchor { file: string; line: number; needle: string; target: string; }

function collectDeadAnchors(): { dead: Anchor[]; total: number } {
  const dead: Anchor[] = [];
  let total = 0;
  for (const file of [...walk('tests'), ...walk('contracts18/tests')].filter((f) => f.endsWith('.test.ts'))) {
    const src = readFileSync(file, 'utf8');
    // Which local const holds which file's text, and whether that read NORMALISES line endings.
    //
    // The distinction is not pedantry. This repository stores some files CRLF and some LF, and an anchor like
    // '\n\n' is absent from a CRLF file — DEPLOYMENT_RUNBOOK.md is 559 CRLF and zero bare LF, so a blank-line
    // bound there silently returned -1 and handed the test the whole rest of the document. If the gate normalised
    // unconditionally it would call that anchor alive and miss the very defect it exists for; if it never
    // normalised it would condemn every correctly-written test that does normalise. So it does exactly what the
    // reading test does.
    const reads = new Map<string, { path: string; normalised: boolean }>();
    for (const m of src.matchAll(
      /const\s+(\w+)\s*=\s*readFileSync\(\s*['"`]([^'"`]+)['"`][^;]*?;/g)) {
      reads.set(m[1], { path: m[2], normalised: /\\r\\n/.test(m[0]) });
    }
    // AND THE FILES THAT READ THROUGH A HELPER [audit 2026-09-02 — the first of two blind spots]. A test writing
    // `const app = read('web/app.js')` bound nothing in the map above, so EVERY anchor in that file was skipped
    // by the `if (!read) continue` below — silently, with no count and no complaint. MEASURED: 20 test files
    // read that way, and one of them (spec-onchain-message-source.test.ts) was carrying a dead anchor that let a
    // slice cover 61.4% of web/app.js. The helper's own body is what says which path it opens.
    for (const m of src.matchAll(
      /const\s+(\w+)\s*=\s*read\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) {
      if (!reads.has(m[1])) reads.set(m[1], { path: m[2], normalised: false });
    }
    // DOUBLE-QUOTED ANCHORS COUNT TOO [the second blind spot]. The scan below was single-quote only, so an
    // anchor written with `"` — which is exactly what a needle containing an apostrophe must use — was invisible.
    // MEASURED: 68 such anchors across the suite, one of them dead and letting a 340-character handler read as
    // 11,461. The two passes are separate rather than one regex because the escape rules differ per quote.
    for (const m of src.matchAll(/(\w+)\.indexOf\(\s*"((?:[^"\\]|\\.)*)"/g)) {
      const read = reads.get(m[1]);
      if (!read) continue;
      total += 1;
      let text: string;
      try { text = readFileSync(read.path, 'utf8'); } catch { continue; }
      if (read.normalised) text = text.replace(/\r\n/g, '\n');
      if (!text.includes(unescape(m[2]))) {
        dead.push({ file, line: src.slice(0, m.index).split('\n').length, needle: m[2], target: read.path });
      }
    }
    for (const m of src.matchAll(/(\w+)\.indexOf\(\s*'((?:[^'\\]|\\.)*)'/g)) {
      const read = reads.get(m[1]);
      if (!read) continue;
      total += 1;
      let text: string;
      try { text = readFileSync(read.path, 'utf8'); } catch { continue; }
      if (read.normalised) text = text.replace(/\r\n/g, '\n');
      if (!text.includes(unescape(m[2]))) {
        dead.push({ file, line: src.slice(0, m.index).split('\n').length, needle: m[2], target: read.path });
      }
    }
  }
  return { dead, total };
}

describe('TEST-ANCHORS', () => {
  it('ANCHOR-01: every source-scope anchor names text that is really in the file it was read from', () => {
    const { dead, total } = collectDeadAnchors();
    // The sweep must find anchors at all — a regex that stopped matching would make this gate vacuous, which is
    // the very failure it exists to catch.
    expect(total, 'no resolvable indexOf anchors found — this gate has stopped seeing the suite')
      .toBeGreaterThan(500);

    const allowed = new Map(KNOWN_DEAD.map(([f, needles]) => [f, new Set(needles)]));
    const fresh = dead.filter((a) => !allowed.get(a.file)?.has(a.needle));
    expect(fresh.map((a) => `${a.file}:${a.line} -> '${a.needle}' is not in ${a.target}`),
      'a NEW dead anchor appeared: the scope it opens is empty or runs to the end of the file, so the '
      + 'assertions under it test nothing or everything').toEqual([]);
  });

  it('ANCHOR-02: the debt list only turns down — a repaired anchor must leave it', () => {
    const { dead } = collectDeadAnchors();
    const stillDead = new Set(dead.map((a) => `${a.file} ${a.needle}`));
    const repaired: string[] = [];
    for (const [file, needles] of KNOWN_DEAD) {
      for (const needle of needles) {
        if (!stillDead.has(`${file} ${needle}`)) repaired.push(`${file} :: '${needle}'`);
      }
    }
    expect(repaired, 'these anchors resolve again — delete them from KNOWN_DEAD so the list keeps shrinking')
      .toEqual([]);
  });
});
