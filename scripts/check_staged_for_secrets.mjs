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

/*
 * Vendored third-party code is not scanned for CONTENT. We did not write it, a "secret" published in a public
 * npm package is neither ours nor secret, and the noise was overwhelming: four-part RFC section numbers in the
 * Argon2 and NIST-curve comments are shaped exactly like addresses, and the ciphers README demonstrates
 * encryption with a well-known joke passphrase. Seventeen of eighteen address findings came from here.
 * Filenames are still checked, so a key smuggled in under a vendor path is still refused.
 *
 * The literal examples are described rather than quoted ON PURPOSE. The first draft of this comment pasted them
 * in, and the scanner then reported its own documentation — which would have blocked every future commit of this
 * very file. Comments are NOT stripped before scanning, because a comment is a perfectly good place to leak a
 * real secret; the fix is to not write specimens down.
 */
const NOT_OUR_CODE = /^web\/vendor\//;

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/*
 * The real word list, so the mnemonic rule can tell a seed phrase from an English sentence. Without it the
 * rule fired on `expect(body, 'the first text block must reach the renderer with its markers intact')` —
 * twelve lowercase words, which is a sentence, not a wallet.
 */
const MNEMONIC_WORDS = (() => {
  try {
    const raw = readFileSync('web/ton-mnemonic-wordlist.mjs', 'utf8');
    const words = new Set((raw.match(/"[a-z]{3,8}"/g) ?? []).map((quoted) => quoted.slice(1, -1)));
    return words.size >= 2000 ? words : null;
  } catch {
    return null; // list moved or gone: fall back to shape alone rather than silently dropping the rule
  }
})();

/* These name a public service, not one of ours. netwatch and the uptime watch use one as a network canary. */
const PUBLIC_RESOLVERS = new Set(['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4', '9.9.9.9', '149.112.112.112']);

/*
 * Each rule earns its place: it either fires on something that has actually gone wrong somewhere, or it guards
 * the one mistake this particular project cannot survive. `allow` (tested against the whole line) keeps a rule
 * narrow instead of it being deleted the first time it is wrong; `confirm` decides on the match itself, for the
 * cases where a regex cannot tell a secret from a coincidence.
 */
const RULES = [
  {
    name: 'private-key',
    why: 'a private key in a public repository is compromised the moment it is pushed',
    pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g,
  },
  {
    name: 'wallet-mnemonic',
    why: 'a BIP39/TON seed phrase IS the wallet — this project holds real funds',
    // Shape first (a quoted run of lowercase words), then the actual word list. Shape alone was not enough:
    // English prose is also lowercase words, and it fired on ordinary test descriptions.
    pattern: /["'`]([a-z]{3,8}(?: [a-z]{3,8}){11,23})["'`]/g,
    confirm: (match) => {
      const words = match[1].split(' ');
      if (![12, 15, 18, 21, 24].includes(words.length)) return false;
      if (!MNEMONIC_WORDS) return true;
      // A real phrase is 100% from the list. A sentence shares a few common words with it and no more.
      return words.filter((word) => MNEMONIC_WORDS.has(word)).length / words.length >= 0.9;
    },
  },
  {
    name: 'telegram-bot-token',
    why: 'the alerting bot token — whoever holds it can read and post as the bot',
    // {30,} and no trailing \b, deliberately. The first draft pinned the secret part at exactly 35 characters —
    // today's length — and a 36-character probe walked straight past it. A detector that depends on a vendor not
    // changing a field width is a detector that fails silently on the day it matters.
    pattern: /\b\d{8,10}:[A-Za-z0-9_-]{30,}/g,
  },
  {
    name: 'aws-access-key',
    why: 'a cloud access key id',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    name: 'credential-assignment',
    why: 'a secret assigned a literal value — move it to a file outside git and read it at runtime',
    pattern: /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key)\s*[:=]\s*["'][^"'\n]{8,}["']/gi,
    // Placeholders, obvious fixtures, and the words themselves are how you DOCUMENT the rule; they are not the
    // rule being broken. `test`/`fake`/`dummy` were added after this fired on `apiKey: 'test-api-key'` in two
    // suites — a gate that shouts at every test double is a gate somebody turns off.
    allow: /(?:example|placeholder|your[_-]|redacted|xxx+|\btest\b|test[_-]|[_-]test|fake|dummy|sample|\.\.\.|<[^>]+>|process\.env|readFileSync|getenv|\$\{)/i,
  },
  {
    name: 'machine-address',
    why: 'a routable address names a real machine — addresses belong in artifacts/local/deploy-hosts.env',
    // The boundaries matter more than the digits: without them this matched four-part SLICES of longer dotted
    // runs and reported OIDs out of the vendored crypto as machines ("2.16.840.1" from 1.2.840.113549...).
    pattern: /(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.])/g,
    confirm: (match) => {
      const [a, b, c] = [match[1], match[2], match[3]].map(Number);
      if ([match[1], match[2], match[3], match[4]].some((part) => Number(part) > 255)) return false; // a version
      if (PUBLIC_RESOLVERS.has(match[0])) return false;
      if (a === 0 || a === 10 || a === 127 || a >= 224) return false;          // unspecified, private, loopback, multicast
      if (a === 169 && b === 254) return false;                                 // link-local
      if (a === 172 && b >= 16 && b <= 31) return false;                        // private
      if (a === 192 && b === 168) return false;                                 // private
      if (a === 192 && b === 0 && c === 2) return false;                        // RFC 5737 documentation
      if (a === 198 && b === 51 && c === 100) return false;                     // RFC 5737 documentation
      if (a === 203 && b === 0 && c === 113) return false;                      // RFC 5737 documentation
      return true;
    },
  },
  {
    name: 'home-path',
    why: 'an absolute home path names the operator and their machine layout',
    // The Windows branch takes either slash. A drive-letter path written with forward slashes was already
    // caught by the third alternative, so this is consistency rather than a hole that was closed.
    pattern: /(?:[A-Za-z]:[\\/]Users[\\/][^\\/\s"'`]+|\/home\/[a-zA-Z0-9._-]+\/|\/Users\/[a-zA-Z0-9._-]+\/)/g,
    allow: /(?:\$\{?HOME|%USERPROFILE%|<user>|USERNAME|os\.homedir|USERPROFILE)/i,
  },
  {
    name: 'email-address',
    why: 'a personal address, once indexed, is spam and a password-reset target forever',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
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
  if (NOT_OUR_CODE.test(target.file)) continue;
  for (const rule of RULES) {
    if (rule.allow && rule.allow.test(target.content)) continue;
    // Every match on the line, not just the first: a line can hold a harmless OID and a real address, and
    // stopping at the first one would let the second through.
    for (const match of target.content.matchAll(rule.pattern)) {
      if (rule.confirm && !rule.confirm(match)) continue;
      findings.push({
        file: target.file,
        line: target.line,
        name: rule.name,
        why: rule.why,
        text: target.content.trim(),
        match: match[0],
      });
      break; // one finding per rule per line is enough to make somebody look at the line
    }
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
  if (finding.match) console.error(`    matched: ${finding.match.slice(0, 120)}`);
  console.error(`    ${finding.text.slice(0, 160)}\n`);
}
console.error('If a finding is wrong, narrow the rule in scripts/check_staged_for_secrets.mjs — do not reach for');
console.error('`git commit --no-verify`, which turns every future commit into one nobody checked.\n');
process.exit(1);
