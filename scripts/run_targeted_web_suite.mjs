#!/usr/bin/env node
/*
 * THE FAST GATE FOR A WEB CHANGE — regenerate the deploy artifacts, then run ONLY the tests that read the files a
 * web change can break.
 *
 * WHY THIS EXISTS. On 2026-08-04 the owner asked why a full ten-to-twenty-minute suite ran for a two-line addition to
 * a debug dump. It ran because that is what I always did, not because anything required it: `deploy_static_web.mjs`
 * gates on `prep.blockers` alone and never looks at the run evidence. MEASURED on the same tree — 20 test files,
 * ~300 tests, 26 seconds, and it caught a real defect (a Cyrillic string in a shipped comment) that the full suite
 * would have caught no sooner.
 *
 * I then agreed to this split and ran a full suite on the very next change anyway, which is the reason this is a
 * SCRIPT and not a note: a habit is not fixed by promising, it is fixed by making the right thing the short thing.
 *
 * THE FILE LIST IS DISCOVERED, NOT HARDCODED — every test that reads web/app.js, plus the two whole-bundle guards.
 * A new test that reads app.js joins this gate the moment it is written; a hand-written list would silently rot.
 *
 * WHAT THIS IS NOT: a replacement for `npm run evidence:suite`. The full suite still runs ONCE per batch, before the
 * commit that closes it, because the release evidence artefact must describe a full green run of the current tree.
 *
 *   node scripts/run_targeted_web_suite.mjs
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const VITEST = 'node_modules/vitest/vitest.mjs';
const CONFIG = 'vitest.all.config.ts';
// Whole-bundle guards: they read the shipped file list rather than app.js, so a discovery pass over app.js readers
// would miss them — and they are exactly the two that catch "it builds but must not ship".
const ALWAYS = ['tests/web-no-locale-leak.test.ts', 'tests/static-web-deploy-prep.test.ts'];

const readers = readdirSync('tests')
  .filter((name) => name.endsWith('.test.ts'))
  .map((name) => `tests/${name}`)
  .filter((path) => readFileSync(path, 'utf8').includes("readFileSync('web/app.js'"));

const files = [...new Set([...readers, ...ALWAYS])].sort();
if (readers.length === 0) {
  console.error('ABORT: no test reads web/app.js — the discovery pass is broken, not the tree');
  process.exit(1);
}

// A missing import resolves to nothing at runtime and dies inside whatever `catch` surrounds it — no test that reads
// app.js as TEXT can see that. This ran first because it is instant and its failure invalidates everything after it.
const imports = spawnSync(process.execPath, ['scripts/check_app_imports.mjs'], { stdio: 'inherit' });
if (imports.status !== 0) process.exit(imports.status ?? 1);

// The artefacts FIRST: static-web-deploy-prep pins them, so running it against a stale bundle fails for a reason
// that has nothing to do with the change being made.
const prep = spawnSync(process.execPath, ['scripts/prepare_static_web_deploy.mjs', '--mode', 'both'], { stdio: 'inherit' });
if (prep.status !== 0) process.exit(prep.status ?? 1);

console.log(`\n[targeted] ${files.length} файлов: каждый читает web/app.js, плюс два сторожа бандла\n`);
const run = spawnSync(process.execPath, [VITEST, 'run', '--config', CONFIG, ...files], { stdio: 'inherit' });
if (run.status !== 0) process.exit(run.status ?? 1);
console.log('\n[targeted] зелено. Полная сюита — ОДИН раз на пачку: npm run evidence:suite');
