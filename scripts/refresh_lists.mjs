#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Address } from '@ton/core';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import { toncenterAccess } from './lib/toncenter-access.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LISTS = join(ROOT, 'artifacts', 'local', 'lists');
const DAY = new Date().toISOString().slice(0, 10);
const argv = process.argv.slice(2);
const given = argv.includes('--sources') ? argv[argv.indexOf('--sources') + 1] : null;
const TAKEN = argv.includes('--taken') ? argv[argv.indexOf('--taken') + 1] : null;
if (given && !/^\d{4}-\d{2}-\d{2}$/.test(TAKEN ?? '')) { console.error('--sources needs --taken YYYY-MM-DD: the day those copies were downloaded'); process.exit(2); }
const STAMP = TAKEN ?? new Date().toISOString().slice(0, 10);
const SOURCES_DIR = given ?? join(LISTS, 'sources', DAY);
const KEEP_SOURCE_DAYS = 3;
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const listOf = (json, key) => (Array.isArray(json) ? json : json?.[key]);
const SOURCES = [
  { name: 'tonkeeper-jettons.json', url: 'https://raw.githubusercontent.com/tonkeeper/ton-assets/main/jettons.json', valid: (json) => listOf(json, 'jettons')?.length > 1000 },
  { name: 'tonkeeper-collections.json', url: 'https://raw.githubusercontent.com/tonkeeper/ton-assets/main/collections.json', valid: (json) => listOf(json, 'collections')?.length > 10 },
  { name: 'stonfi-routers.json', url: 'https://api.ston.fi/v1/routers', valid: (json) => listOf(json, 'router_list')?.length > 0 },
  { name: 'stonfi-pools.json', url: 'https://api.ston.fi/v1/pools', valid: (json) => listOf(json, 'pool_list')?.length > 100 },
  { name: 'stonfi-assets.json', url: 'https://api.ston.fi/v1/assets', valid: (json) => listOf(json, 'asset_list')?.length > 100 },
  { name: 'dedust-pools.json', url: 'https://api.dedust.io/v2/pools', valid: (json) => listOf(json, 'pools')?.length > 100 },
];
const MAX_SOURCE_BYTES = 256 * 1024 * 1024;

async function source({ name, url, valid }) {
  const path = join(SOURCES_DIR, name);
  if (existsSync(path)) {
    try { if (valid(JSON.parse(readFileSync(path, 'utf8')))) return path; } catch { }
  }
  if (given) throw new Error(`${path}: missing or not the expected list`);
  let last = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(180_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text.length > MAX_SOURCE_BYTES) throw new Error('larger than 256 MB');
      if (!valid(JSON.parse(text))) throw new Error('not the expected list');
      writeFileSync(path, text);
      console.log(`  ${name}: ${(text.length / 1024 / 1024).toFixed(1)} MB`);
      return path;
    } catch (error) {
      last = error;
      await sleep(3000 * (attempt + 1));
    }
  }
  throw new Error(`${name} (${url}): ${last?.message ?? 'no answer'} — nothing was rebuilt`);
}

function build(script, args) {
  console.log(`\n== ${script}`);
  const run = spawnSync(process.execPath, [join(ROOT, 'scripts', script), ...args], { cwd: ROOT, stdio: 'inherit' });
  if (run.status !== 0) throw new Error(`${script} failed (exit ${run.status}) — the lists built before it stand; run again to resume`);
}

async function snapshot(label) {
  const dir = join(LISTS, 'compare', label);
  mkdirSync(dir, { recursive: true });
  const out = {};
  for (const file of ['verified-assets.mjs', 'swap-pools.mjs', 'dedust-pools.mjs', 'asset-pictures.mjs', 'pool-activity.mjs']) {
    const copy = join(dir, file);
    copyFileSync(join(ROOT, 'web', file), copy);
    out[file] = await import(`${pathToFileURL(copy).href}?${label}-${Date.now()}`);
  }
  return out;
}
const rawOf = (id) => `0:${Buffer.from(id, 'base64url').toString('hex')}`;
function tokensOf(lists) {
  const tokens = new Map();
  for (const [id, symbol] of lists['swap-pools.mjs'].SWAP_TOKENS) tokens.set(rawOf(id), symbol);
  for (const [id, symbol] of lists['dedust-pools.mjs'].DEDUST_TOKENS) tokens.set(rawOf(id), symbol);
  return tokens;
}
function change(label, before, after) {
  const added = [...after.keys()].filter((key) => !before.has(key)).map((key) => after.get(key));
  const gone = [...before.keys()].filter((key) => !after.has(key)).map((key) => before.get(key));
  const names = (list) => (list.length > 12 ? `${list.slice(0, 12).join(', ')} … (${list.length})` : list.join(', '));
  return `  ${label}: ${before.size} -> ${after.size}${added.length ? `; new: ${names(added)}` : ''}${gone.length ? `; gone: ${names(gone)}` : ''}`;
}

console.log(`lists refresh, ${DAY}: sources in ${SOURCES_DIR}`);
mkdirSync(SOURCES_DIR, { recursive: true });
const paths = {};
for (const entry of SOURCES) paths[entry.name] = await source(entry);
const access = toncenterAccess();
console.log(`toncenter: ${access.keyed ? 'with the key' : 'keyless — the pools take about half an hour'}`);
const before = await snapshot('before');
const LIST_FILES = ['verified-assets.mjs', 'swap-pools.mjs', 'dedust-pools.mjs', 'asset-pictures.mjs', 'pool-activity.mjs'];
const kept = new Map(LIST_FILES.map((file) => [file, readFileSync(join(ROOT, 'web', file))]));
const restore = () => { for (const [file, bytes] of kept) writeFileSync(join(ROOT, 'web', file), bytes); };
const cacheDir = join(LISTS, 'cache');
mkdirSync(cacheDir, { recursive: true });
try {
  build('build_verified_assets.mjs', [paths['tonkeeper-jettons.json'], paths['tonkeeper-collections.json'], STAMP]);
  build('build_swap_pools.mjs', ['--routers', paths['stonfi-routers.json'], '--pools', paths['stonfi-pools.json'], '--assets', paths['stonfi-assets.json'],
    '--verified', paths['tonkeeper-jettons.json'], '--cache', join(cacheDir, `stonfi-${DAY}.json`), '--taken', STAMP]);
  build('build_dedust_pools.mjs', ['--pools', paths['dedust-pools.json'], '--verified', paths['tonkeeper-jettons.json'], '--stonfi', paths['stonfi-assets.json'],
    '--cache', join(cacheDir, `dedust-${DAY}.json`), '--taken', STAMP]);
  build('build_asset_pictures.mjs', []);
  build('build_pool_activity.mjs', ['--cache', join(cacheDir, `activity-${DAY}.json`), '--taken', STAMP]);
} catch (error) {
  restore();
  console.error(`\n${error.message}\nthe four lists stand as they were before this run`);
  process.exit(1);
}
const after = await snapshot('after');

const verifiedNow = after['verified-assets.mjs'];
const offeredBefore = tokensOf(before);
const ath = Address.parse(PLATHO_APP_CONFIG.ath.masterAddress).toRawString().toLowerCase();
const unverified = [...offeredBefore.entries()].filter(([id]) => id !== ath && !verifiedNow.isVerifiedJettonMaster(id));
console.log(`\nlists refreshed (sources of ${STAMP}):`);
if (unverified.length) console.log(`  !! no longer verified by Tonkeeper, and so out of the swap lists: ${unverified.map(([, symbol]) => symbol).join(', ')}`);
console.log(`  Tonkeeper's verified tokens: ${before['verified-assets.mjs'].VERIFIED_JETTON_COUNT} -> ${verifiedNow.VERIFIED_JETTON_COUNT}`);
const poolsOf = (list, symbolOf) => new Map(list.map((row) => [row[0], symbolOf(row)]));
const stonSymbol = (lists) => (row) => {
  const symbol = (index) => (index === 0 ? 'GRAM' : lists['swap-pools.mjs'].SWAP_TOKENS[index - 1]?.[1] ?? '?');
  return `${symbol(row[2])}/${symbol(row[3])}`;
};
const dedustSymbol = (lists) => (row) => {
  const symbol = (index) => (index === 0 ? 'GRAM' : lists['dedust-pools.mjs'].DEDUST_TOKENS[index - 1]?.[1] ?? '?');
  return `${symbol(row[2])}/${symbol(row[3])}${row[1] ? ' stable' : ''}`;
};
console.log(change("STON.fi's pools", poolsOf(before['swap-pools.mjs'].SWAP_POOLS, stonSymbol(before)), poolsOf(after['swap-pools.mjs'].SWAP_POOLS, stonSymbol(after))));
console.log(change("DeDust's pools", poolsOf(before['dedust-pools.mjs'].DEDUST_POOLS, dedustSymbol(before)), poolsOf(after['dedust-pools.mjs'].DEDUST_POOLS, dedustSymbol(after))));
console.log(change('tokens offered', offeredBefore, tokensOf(after)));
console.log(`  pictures: ${Object.keys(before['asset-pictures.mjs'].ASSET_PICTURES).length} -> ${Object.keys(after['asset-pictures.mjs'].ASSET_PICTURES).length}`);
console.log('\nnext, as every release: node scripts/bump_module_versions.mjs --run (twice), npm run web:deploy:prepare, the tests');

for (const day of existsSync(join(LISTS, 'sources')) ? readdirSync(join(LISTS, 'sources')).sort().slice(0, -KEEP_SOURCE_DAYS) : []) {
  rmSync(join(LISTS, 'sources', day), { recursive: true, force: true });
}
rmSync(join(LISTS, 'compare'), { recursive: true, force: true });
