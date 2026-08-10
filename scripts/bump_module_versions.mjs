#!/usr/bin/env node
/*
 * MAKE EVERY CACHE KEY MATCH THE CONTENT IT KEYS. Three phases, in this order:
 *
 *   1. module `?v=` counters — bumped to their fixed point (the cascade described below);
 *   2. the app build id — `./app.js?v=b<hash>` in index.html and sw.js, DERIVED from web/app.js;
 *   3. the service-worker cache id — `CACHE_NAME`, DERIVED from every precached asset's content.
 *
 * Phases 2 and 3 replaced two hand-maintained counters that both shipped stale at least once: a release moved
 * `./app.js?v=` and left the version label behind (devices never reloaded), and a CACHE_NAME bump was missed so a
 * changed icon reached nobody. A derived key cannot be forgotten, because it is not written by anyone. Neither is
 * circular: web/app.js never names its own token, and sw.js is not one of the assets it precaches.
 *
 * The product version is NOT touched here and is not a cache key — see PLATHO_APP_RUNTIME_VERSION.
 *
 * A cached browser keeps serving a module until its `?v=` moves — that is what MODCONTENT-01 guards, after two profile
 * rows shipped as raw i18n keys because i18n-strings.mjs changed and stayed at ?v=33.
 *
 * The part that is easy to get wrong by hand is the CASCADE. Bumping pwa-contract-transactions.mjs edits the import
 * line in each of its ~20 importers, which changes THEIR content, which means each of them now needs a bump too, which
 * edits THEIR importers. Doing one round by hand leaves the second round undone and the suite red for a reason that
 * looks unrelated to the change being made. This runs the rounds until nothing is left.
 *
 * Termination: a module is bumped at most once per run (after the bump its version no longer matches the baseline, so
 * the rule that selected it is satisfied), so the fixed point is reached in at most one round per module.
 *
 *   node scripts/bump_module_versions.mjs          report what needs bumping, change nothing
 *   node scripts/bump_module_versions.mjs --run    apply the bumps and refresh the baseline
 */
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

const RUN = process.argv.includes('--run');
const BASELINE = 'artifacts/module-version-content-baseline.json';

/** Every file that can carry a `?v=` reference — the same shape MODCONTENT scans. */
function sourceFiles() {
  const files = ['web/index.html'];
  for (const dir of ['web', 'web/crypto']) {
    for (const name of readdirSync(dir)) {
      if (/\.(mjs|js)$/.test(name)) files.push(`${dir}/${name}`);
    }
  }
  return [...new Set(files)].filter((f) => existsSync(f));
}

// .css is included on purpose: a stylesheet is cached exactly like a module, and styles.css shipped changed with a
// stale ?v= on 2026-08-03 because both this tool and the MODCONTENT guard only looked at .mjs/.js.
const REF = /['"`](\.[^'"`]*?\/?([A-Za-z0-9._-]+\.(?:mjs|js|css)))\?v=(\d+)['"`]/g;

/** module file name -> the `?v=` its importers use. */
function versionedModules() {
  const out = new Map();
  for (const file of sourceFiles()) {
    for (const m of readFileSync(file, 'utf8').matchAll(REF)) out.set(m[2], m[3]);
  }
  return out;
}

// app.js is not a COUNTER-versioned module: phase 2 gives it a content-derived build id instead. The counter rule
// cannot apply to it. It once had to equal the version label living inside app.js, so bumping the counter edited
// app.js, which made the counter stale again — a circle that cost a release cycle on 2026-08-04. A hash has no such
// circle (app.js never contains its own token), which is exactly why phase 2 can do automatically what no counter
// could. The exclusion stays so the two phases can never both claim app.js.
const RELEASE_VERSIONED = new Set(['app.js']);

function resolveModulePath(name) {
  if (RELEASE_VERSIONED.has(name)) return null;
  for (const candidate of [`web/${name}`, `web/crypto/${name}`]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Rewrite `<name>?v=<from>` to `<name>?v=<to>` everywhere. Anchored on the path separator so `crypto.mjs` cannot
 *  match inside `platho-crypto.mjs`. */
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
  console.error(`нет базовой линии ${BASELINE} — сначала запиши её прогоном MODCONTENT с --update`);
  process.exit(1);
}
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

const bumped = [];
for (let round = 1; round <= 50; round += 1) {
  const stale = [];
  for (const [name, version] of [...versionedModules()].sort()) {
    const path = resolveModulePath(name);
    if (!path) continue;                       // vendor entries outside web/ and web/crypto
    const was = baseline[name];
    if (!was) continue;                        // a new module has nothing to drift from
    if (sha256(path) === was.sha256) continue; // unchanged
    if (version !== was.version) continue;     // changed AND already bumped
    stale.push({ name, version });
  }
  if (stale.length === 0) break;
  if (!RUN) {
    for (const { name, version } of stale) console.log(`круг ${round}: ${name} ?v=${version} -> ${Number(version) + 1}`);
    console.log(`\nвсего в этом круге: ${stale.length}. Запусти с --run, чтобы применить и докрутить каскад.`);
    process.exit(1);
  }
  for (const { name, version } of stale) {
    const to = String(Number(version) + 1);
    const files = rewrite(name, version, to);
    bumped.push(`${name}: ${version} -> ${to} (${files} файл(ов))`);
  }
  console.log(`круг ${round}: поднято ${stale.length}`);
}

// ── PHASE 2: the app build id, and PHASE 3: the service-worker cache id ─────────────────────────────────────────
// Both are DERIVED from content — see scripts/web_cache_ids.mjs for what from and why. The order between them is
// mandatory: the cache id is computed AFTER the build id is written, because index.html is a precached asset and
// carries the build id.
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
    // The build id is not written yet, so the exact cache id cannot be computed here — it will move regardless.
    problems.push(`${SERVICE_WORKER}: CACHE_NAME пересчитается вместе с ним`);
  }
  if (problems.length > 0) {
    for (const line of problems) console.log(line);
    console.log(`\nвсего: ${problems.length}. Запусти с --run, чтобы применить.`);
    process.exit(1);
  }
  console.log('всё в порядке: ни один изменённый модуль не остался со старой ?v=, идентификаторы сборки и кэша совпадают');
  process.exit(0);
}

const buildSitesTouched = writeAppBuildId(wantBuildId);
if (buildSitesTouched.length > 0) console.log(`идентификатор сборки: ${wantBuildId} (${buildSitesTouched.join(', ')})`);

const swBefore = readFileSync(SERVICE_WORKER, 'utf8');
if (!cacheNamePattern().test(swBefore)) throw new Error(`no CACHE_NAME line in ${SERVICE_WORKER}`);
const swAfter = swBefore.replace(cacheNamePattern(), `$1${cacheId()}$3`);
if (swAfter !== swBefore) {
  writeFileSync(SERVICE_WORKER, swAfter, 'utf8');
  console.log(`идентификатор кэша: ${swAfter.match(cacheNamePattern())[2]}`);
}

// Refresh the baseline to the state that now holds. Doing it here rather than by a separate --update run is the point:
// the baseline must record the versions this cascade just settled on, not an intermediate round.
const current = {};
for (const [name, version] of [...versionedModules()].sort()) {
  const path = resolveModulePath(name);
  if (!path) continue;
  current[name] = { version, sha256: sha256(path) };
}
writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
console.log(`\nподнято модулей: ${bumped.length}`);
for (const line of bumped) console.log(`  ${line}`);
console.log(`базовая линия обновлена: ${BASELINE} (${Object.keys(current).length} модулей)`);
