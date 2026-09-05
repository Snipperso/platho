#!/usr/bin/env node
/*
 * What is about to be committed, read as a stranger would read it.
 *
 * THIS REPOSITORY IS PUBLIC — `curl https://api.github.com/repos/Snipperso/platho` answers 200 with no
 * credentials — and a commit cannot be taken back. Removing a secret in a later commit does not unpublish it:
 * the object stays fetchable, forks and code-search indexes keep their copy, and rewriting history breaks every
 * clone and every release tag the delivery-verification chain depends on. So the only cheap moment is BEFORE.
 *
 * On 2026-09-05 two server addresses, both SSH key filenames and the deploy account were found sitting as
 * DEFAULTS in six tracked scripts. Nothing there granted access, but one line mattered: the standby machine's
 * only real property is that it is absent from DNS, and measurement that day showed it really was invisible to
 * an untargeted scan (no certificate without SNI, port 80 says only "Caddy") — the repository was the single
 * channel that tied that address to this project. Nobody put it there maliciously; it was convenient, once.
 *
 * ONLY ADDED LINES ARE SCANNED. A file that already contains something is not re-litigated every time it is
 * touched for an unrelated reason — otherwise the check becomes noise, and a noisy check gets bypassed, which
 * is strictly worse than no check.
 *
 *   node scripts/check_staged_for_secrets.mjs          # what `git commit` runs through the pre-commit hook
 *   node scripts/check_staged_for_secrets.mjs --all    # every tracked file, not just what is staged
 *
 * Exit 0 clean, exit 1 with a named finding and the line it is on.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SCAN_EVERYTHING = process.argv.includes('--all');

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/*
 * Each rule earns its place: it either fires on something that has actually gone wrong somewhere, or it guards
 * the one mistake this particular project cannot survive. `allow` exists so a rule can stay narrow instead of
 * being deleted the first time it is wrong.
 */
const RULES = [
  {
    name: 'private-key',
    why: 'a private key in a public repository is compromised the moment it is pushed',
    pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/,
  },
  {
    name: 'wallet-mnemonic',
    why: 'a BIP39 seed phrase IS the wallet — this project holds real funds',
    // Quoted, and exactly a valid mnemonic length. Prose does not arrive as a quoted run of exactly 12/15/18/24
    // lowercase words, which keeps this from firing on ordinary sentences.
    pattern: /["'`](?:[a-z]{3,8} ){11}(?:[a-z]{3,8}(?: [a-z]{3,8}){2}(?: [a-z]{3,8}){0,9})?[a-z]{3,8}["'`]/,
  },
  {
    name: 'telegram-bot-token',
    why: 'the alerting bot token — whoever holds it can read and post as the bot',
    // {30,} and no trailing \b, deliberately. The first draft pinned the secret part at exactly 35 characters —
    // today's length — and a 36-character probe walked straight past it. A detector that depends on a vendor not
    // changing a field width is a detector that fails silently on the day it matters.
    pattern: /\b\d{8,10}:[A-Za-z0-9_-]{30,}/,
  },
  {
    name: 'aws-access-key',
    why: 'a cloud access key id',
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: 'credential-assignment',
    why: 'a secret assigned a literal value — move it to a file outside git and read it at runtime',
    pattern: /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key)\s*[:=]\s*["'][^"'\n]{8,}["']/i,
    // Placeholders and the words themselves are how you DOCUMENT the rule; they are not the rule being broken.
    allow: /(?:example|placeholder|your[_-]|redacted|xxx+|\.\.\.|<[^>]+>|process\.env|readFileSync|getenv|\$\{)/i,
  },
  {
    name: 'machine-address',
    why: 'a routable address names a real machine — addresses belong in artifacts/local/deploy-hosts.env',
    pattern: /\b(?!0\.0\.0\.0\b)(?!10\.)(?!127\.)(?!169\.254\.)(?!192\.168\.)(?!192\.0\.2\.)(?!198\.51\.100\.)(?!203\.0\.113\.)(?!172\.(?:1[6-9]|2\d|3[01])\.)(?!255\.255\.255\.255\b)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  },
  {
    name: 'home-path',
    why: 'an absolute home path names the operator and their machine layout',
    pattern: /(?:[A-Za-z]:\\Users\\[^\\\s"'`]+|\/home\/[a-zA-Z0-9._-]+\/|\/Users\/[a-zA-Z0-9._-]+\/)/,
    allow: /(?:\$\{?HOME|%USERPROFILE%|<user>|USERNAME)/i,
  },
  {
    name: 'email-address',
    why: 'a personal address, once indexed, is spam and a password-reset target forever',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
    allow: /(?:noreply@|@example\.(?:com|org)|user@host|name@domain)/i,
  },
];

/* Files whose NAME alone says they should never be tracked, whatever is inside them. */
const FORBIDDEN_NAMES = [
  { pattern: /(?:^|\/)id_(?:rsa|dsa|ecdsa|ed25519)$/, why: 'an SSH private key' },
  { pattern: /(?:^|\/)[^/]*_ed25519$/, why: 'an SSH private key' },
  { pattern: /\.(?:pem|pfx|p12|jks|keystore)$/i, why: 'a key or certificate store' },
  { pattern: /(?:^|\/)known_hosts$|_known_hosts$/, why: 'pinned fingerprints of real machines' },
  { pattern: /(?:^|\/)\.env(?:\..*)?$/, why: 'an environment file', allow: /\.example$/ },
  { pattern: /deploy-hosts\.env$/, why: 'machine addresses', allow: /\.example$/ },
];

const findings = [];

const stagedFiles = SCAN_EVERYTHING
  ? git('ls-files').split('\n').filter(Boolean)
  : git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n').filter(Boolean);

if (stagedFiles.length === 0) {
  console.log('[secret-scan] nothing staged.');
  process.exit(0);
}

for (const file of stagedFiles) {
  for (const rule of FORBIDDEN_NAMES) {
    if (rule.pattern.test(file) && !(rule.allow && rule.allow.test(file))) {
      findings.push({ file, line: 0, name: 'forbidden-file', why: rule.why, text: file });
    }
  }
}

/*
 * Added lines only. `-U0` keeps context out of the scan, so a secret that is merely NEAR an edit does not
 * report — the question this check answers is "what am I adding", not "what is in this file".
 */
const scanTargets = [];
if (SCAN_EVERYTHING) {
  for (const file of stagedFiles) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue; // unreadable or gone; not this check's business
    }
    if (text.includes('\0')) continue;
    text.split('\n').forEach((content, index) => scanTargets.push({ file, line: index + 1, content }));
  }
} else {
  let file = null;
  let line = 0;
  for (const raw of git('diff', '--cached', '-U0').split('\n')) {
    if (raw.startsWith('+++ b/')) { file = raw.slice(6); continue; }
    if (raw.startsWith('@@')) {
      const at = /\+(\d+)/.exec(raw.split('@@')[1] ?? '');
      line = at ? Number(at[1]) : 0;
      continue;
    }
    if (file && raw.startsWith('+') && !raw.startsWith('+++')) {
      scanTargets.push({ file, line, content: raw.slice(1) });
      line += 1;
    }
  }
}

for (const target of scanTargets) {
  for (const rule of RULES) {
    if (!rule.pattern.test(target.content)) continue;
    if (rule.allow && rule.allow.test(target.content)) continue;
    findings.push({ file: target.file, line: target.line, name: rule.name, why: rule.why, text: target.content.trim() });
  }
}

if (findings.length === 0) {
  console.log(`[secret-scan] clean — ${scanTargets.length} added line(s) across ${stagedFiles.length} file(s).`);
  process.exit(0);
}

console.error(`\n[secret-scan] ${findings.length} finding(s). THIS REPOSITORY IS PUBLIC; a commit cannot be`
  + ' unpublished.\n');
for (const finding of findings) {
  const where = finding.line > 0 ? `${finding.file}:${finding.line}` : finding.file;
  console.error(`  ${finding.name}  ${where}`);
  console.error(`    ${finding.why}`);
  console.error(`    ${finding.text.slice(0, 160)}\n`);
}
console.error('If a finding is wrong, narrow the rule in scripts/check_staged_for_secrets.mjs — do not reach for');
console.error('`git commit --no-verify`, which turns every future commit into one nobody checked.\n');
process.exit(1);
