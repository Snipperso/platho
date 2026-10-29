#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import {
  APP_TOKEN_SITES,
  SERVICE_WORKER,
  appBuildId,
  appTokenPattern,
  cacheId,
  cacheNamePattern,
} from './web_cache_ids.mjs';
import { shippedBytes } from './lib/strip-comments.mjs';

const RUN = process.argv.includes('--run');
const BASELINE = 'artifacts/module-version-content-baseline.json';

function sourceFiles() {
  const files = ['web/index.html'];
  for (const dir of ['web', 'web/crypto']) {
    for (const name of readdirSync(dir)) {
      if (/\.(mjs|js)$/.test(name)) files.push(`${dir}/${name}`);
    }
  }
  return [...new Set(files)].filter((f) => existsSync(f));
}

const REF = /['"`](\.[^'"`]*?\/?([A-Za-z0-9._-]+\.(?:mjs|js|css)))\?v=(\d+)['"`]/g;

function versionedModules() {
  const out = new Map();
  for (const file of sourceFiles()) {
    for (const m of readFileSync(file, 'utf8').matchAll(REF)) out.set(m[2], m[3]);
  }
  return out;
}

function versionSkew() {
  const votes = new Map();
  for (const file of sourceFiles()) {
    for (const m of readFileSync(file, 'utf8').matchAll(REF)) {
      if (!votes.has(m[2])) votes.set(m[2], new Map());
      const per = votes.get(m[2]);
      if (!per.has(m[3])) per.set(m[3], []);
      per.get(m[3]).push(file);
    }
  }
  const skewed = [];
  for (const [mod, per] of votes) {
    if (per.size < 2) continue;
    const spread = [...per.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([v, files]) => `v${v} (${files.join(', ')})`)
      .join(' vs ');
    skewed.push(`${mod}: imported at two versions — ${spread}`);
  }
  return skewed;
}

const RELEASE_VERSIONED = new Set(['app.js']);

function resolveModulePath(name) {
  if (RELEASE_VERSIONED.has(name)) return null;
  for (const candidate of [`web/${name}`, `web/crypto/${name}`]) {
    if (existsSync(candidate)) return candidate;
  }
  return vendorPathFor(name);
}

function vendorPathFor(name) {
  const stack = ['web/vendor'];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) stack.push(path);
      else if (entry.name === name) return path;
    }
  }
  return null;
}


function sha256(path) {
  return createHash('sha256').update(shippedBytes(path)).digest('hex');
}

function rewrite(name, from, to) {
  const pattern = new RegExp(`([./])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?v=${from}\\b`, 'g');
  let touched = 0;
  for (const file of sourceFiles()) {
    const before = readFileSync(file, 'utf8');
    const after = before.replace(pattern, `$1${name}?v=${to}`);
    if (after !== before) {
      writeFileSync(file, after, 'utf8');
      touched += 1;
    }
  }
  return touched;
}

if (!existsSync(BASELINE)) {
  console.error(`no baseline ${BASELINE} — write it first with a MODCONTENT run with --update`);
  process.exit(1);
}
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

const bumped = [];
for (let round = 1; round <= 50; round += 1) {
  const stale = [];
  for (const [name, version] of [...versionedModules()].sort()) {
    const path = resolveModulePath(name);
    if (!path) continue;
    const was = baseline[name];
    if (!was) continue;
    if (sha256(path) === was.sha256) continue;
    if (version !== was.version) continue;
    stale.push({ name, version });
  }
  if (stale.length === 0) break;
  if (!RUN) {
    for (const { name, version } of stale) console.log(`round ${round}: ${name} ?v=${version} -> ${Number(version) + 1}`);
    console.log(`\nthis round: ${stale.length}. Run with --run to apply it and finish the cascade.`);
    process.exit(1);
  }
  for (const { name, version } of stale) {
    const to = String(Number(version) + 1);
    const files = rewrite(name, version, to);
    bumped.push(`${name}: ${version} -> ${to} (${files} file(s))`);
  }
  console.log(`round ${round}: bumped ${stale.length}`);
}

function appTokensInUse() {
  const out = [];
  for (const file of APP_TOKEN_SITES) {
    for (const m of readFileSync(file, 'utf8').matchAll(appTokenPattern())) out.push({ file, token: m[2] });
  }
  return out;
}

function writeAppBuildId(to) {
  const touched = [];
  for (const file of APP_TOKEN_SITES) {
    const before = readFileSync(file, 'utf8');
    const after = before.replace(appTokenPattern(), `$1${to}`);
    if (after !== before) {
      writeFileSync(file, after, 'utf8');
      touched.push(file);
    }
  }
  return touched;
}

const wantBuildId = appBuildId();
const staleBuildSites = appTokensInUse().filter((site) => site.token !== wantBuildId);

if (!RUN) {
  const problems = [];
  for (const site of staleBuildSites) problems.push(`${site.file}: ./app.js?v=${site.token} -> ${wantBuildId}`);
  if (problems.length === 0) {
    const haveCacheId = readFileSync(SERVICE_WORKER, 'utf8').match(cacheNamePattern())?.[2];
    const wantCacheId = cacheId();
    if (haveCacheId !== wantCacheId) problems.push(`${SERVICE_WORKER}: CACHE_NAME platho-pwa-${haveCacheId} -> platho-pwa-${wantCacheId}`);
  } else {
    problems.push(`${SERVICE_WORKER}: CACHE_NAME is recomputed with it`);
  }
  const skewed = versionSkew();
  if (skewed.length > 0) {
    for (const line of skewed) console.log(`SKEW ${line}`);
    console.log(`\nmodules imported at two versions: ${skewed.length}. --run does NOT repair this: it rewrites `
      + 'importers by exact old-version match, which a drifted importer no longer carries. Point the laggard at '
      + 'the version the others use.');
  }
  if (problems.length > 0) {
    for (const line of problems) console.log(line);
    console.log(`\ntotal: ${problems.length}. Run with --run to apply.`);
  }
  if (problems.length > 0 || skewed.length > 0) process.exit(1);
  console.log('all good: no changed module kept an old ?v=, and the build and cache ids match');
  process.exit(0);
}

const buildSitesTouched = writeAppBuildId(wantBuildId);
if (buildSitesTouched.length > 0) console.log(`build id: ${wantBuildId} (${buildSitesTouched.join(', ')})`);

const swBefore = readFileSync(SERVICE_WORKER, 'utf8');
if (!cacheNamePattern().test(swBefore)) throw new Error(`no CACHE_NAME line in ${SERVICE_WORKER}`);
const swAfter = swBefore.replace(cacheNamePattern(), `$1${cacheId()}$3`);
if (swAfter !== swBefore) {
  writeFileSync(SERVICE_WORKER, swAfter, 'utf8');
  console.log(`cache id: ${swAfter.match(cacheNamePattern())[2]}`);
}

const current = {};
for (const [name, version] of [...versionedModules()].sort()) {
  const path = resolveModulePath(name);
  if (!path) continue;
  current[name] = { version, sha256: sha256(path) };
}
writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
console.log(`\nmodules bumped: ${bumped.length}`);
for (const line of bumped) console.log(`  ${line}`);
console.log(`baseline updated: ${BASELINE} (${Object.keys(current).length} modules)`);
