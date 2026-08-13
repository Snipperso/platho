#!/usr/bin/env node
/*
 * VERIFY THAT platho.app IS SERVING THE RELEASE IT ANNOUNCED.
 *
 * Platho has no backend, but it still arrives from one domain, and whoever controls that domain controls the code
 * that holds the user's keys. No amount of post-quantum cryptography below the delivery layer survives a swapped
 * app.js. That problem cannot be SOLVED in a browser — but it can be made DETECTABLE, which is what this is for.
 *
 * WHY THIS RUNS OUTSIDE THE APP, AND MUST. A check built into the page is circular: a hostile server simply serves
 * a build whose check lies. Verification only means something when it is performed by someone the server cannot
 * edit — you, from a clone of this repo, on a machine of your choosing.
 *
 * THE CHAIN OF TRUST IS TWO HASHES. Announce sha256(index.html) and sha256(sw.js) somewhere the web server does not
 * control (Platho publishes them on-chain, signed by a wallet that never touches the server), and everything else
 * follows from content addressing that already exists in the bundle:
 *
 *   index.html  names the entry point as  app.js?v=b<8 hex of sha256(app.js)>   -> pins app.js
 *   sw.js       carries CACHE_NAME = 12 hex over every precached asset's URL AND bytes, and the list itself
 *                                                                                -> pins all 158 files
 *
 * So two announced numbers, fetched and checked here, pin the entire executable surface. tests/sw-precache-covers-
 * runtime keeps that true: every module reachable from app.js must be in the precache list, or the chain has holes.
 *
 *   node scripts/verify_released_bundle.mjs --index <sha256> --sw <sha256>
 *   node scripts/verify_released_bundle.mjs                  # no expected hashes: prints what is being served
 *   node scripts/verify_released_bundle.mjs --origin https://platho.app
 *
 * Exit code 0 = everything checked passed. Non-zero = something did not, and the message says which.
 */
import { createHash } from 'node:crypto';
import { appBuildId, cacheIdFromEntries, precacheAssetUrls } from './web_cache_ids.mjs';

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const ORIGIN = (arg('--origin', 'https://platho.app')).replace(/\/+$/, '');
const EXPECT_INDEX = arg('--index');
const EXPECT_SW = arg('--sw');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const failures = [];
const note = (ok, label, detail) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

async function fetchBytes(path) {
  const url = `${ORIGIN}${path}`;
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

console.log(`verifying ${ORIGIN}\n`);

// ---- 1. The two announced files -------------------------------------------------------------------------------
const indexBytes = await fetchBytes('/index.html');
const swBytes = await fetchBytes('/sw.js');
const indexHash = sha256(indexBytes);
const swHash = sha256(swBytes);

console.log(`  index.html  sha256=${indexHash}`);
console.log(`  sw.js       sha256=${swHash}\n`);

if (EXPECT_INDEX || EXPECT_SW) {
  note(!EXPECT_INDEX || EXPECT_INDEX === indexHash, 'index.html matches the announced hash',
    EXPECT_INDEX === indexHash ? null : `announced ${EXPECT_INDEX}`);
  note(!EXPECT_SW || EXPECT_SW === swHash, 'sw.js matches the announced hash',
    EXPECT_SW === swHash ? null : `announced ${EXPECT_SW}`);
} else {
  console.log('  (no --index/--sw given: nothing is being CHECKED, only reported)\n');
}

// ---- 2. index.html pins the entry point by content ------------------------------------------------------------
const indexText = new TextDecoder().decode(indexBytes);
const announcedBuildId = /src="\/app\.js\?v=([A-Za-z0-9]+)"/.exec(indexText)?.[1] ?? null;
note(Boolean(announcedBuildId), 'index.html names the app entry with a build id');
if (announcedBuildId) {
  const appBytes = await fetchBytes(`/app.js?v=${announcedBuildId}`);
  const actual = appBuildId(appBytes);
  note(actual === announcedBuildId, 'app.js content matches the build id index.html asks for',
    actual === announcedBuildId ? `${actual}` : `served ${actual}, requested ${announcedBuildId}`);
}

// ---- 3. sw.js pins every precached asset ----------------------------------------------------------------------
const swText = new TextDecoder().decode(swBytes);
const announcedCacheId = /const CACHE_NAME = 'platho-pwa-([A-Za-z0-9-]+)';/.exec(swText)?.[1] ?? null;
note(Boolean(announcedCacheId), 'sw.js carries a cache id');

const urls = precacheAssetUrls(swText);
console.log(`\n  fetching ${urls.length} precached assets…`);
const entries = [];
for (const url of urls) {
  const path = url.replace(/^\.\//, '/').replace(/^\/\//, '/');
  try {
    entries.push({ url, sha256: sha256(await fetchBytes(path === '/' ? '/' : path)) });
  } catch (error) {
    note(false, `precached asset is not served: ${url}`, error.message);
  }
}

if (announcedCacheId && entries.length === urls.length) {
  const recomputed = cacheIdFromEntries(entries);
  note(recomputed === announcedCacheId, 'every precached asset matches the cache id sw.js declares',
    recomputed === announcedCacheId ? `${recomputed} over ${entries.length} files` : `recomputed ${recomputed}, declared ${announcedCacheId}`);
}

// ---- the announcement to publish -------------------------------------------------------------------------------
// Measured from what production ACTUALLY serves, never from the local build tree: the point of the announcement is
// to describe the bytes users receive, and a local package that was never deployed describes nothing.
if (process.argv.includes('--announce')) {
  const version = /id="appVersionLabel">([0-9.]+)</.exec(indexText)?.[1] ?? '(unknown)';
  console.log('\n--- publish this from Platho, signed by a wallet that never touches the web server ---\n');
  console.log(`Platho ${version} — release hashes`);
  console.log('');
  console.log(`index.html sha256 ${indexHash}`);
  console.log(`sw.js      sha256 ${swHash}`);
  console.log('');
  console.log('Check what you were served:');
  console.log(`node scripts/verify_released_bundle.mjs --index ${indexHash} --sw ${swHash}`);
  console.log('\n--- end ---');
}

// ---- verdict ---------------------------------------------------------------------------------------------------
console.log('');
if (failures.length > 0) {
  console.error(`MISMATCH — ${failures.length} check(s) failed. The served bundle is NOT the announced one.`);
  process.exit(1);
}
if (!EXPECT_INDEX && !EXPECT_SW) {
  console.log('Self-consistent, but UNVERIFIED: no announced hashes were supplied to check against.');
  process.exit(0);
}
console.log('VERIFIED — the served bundle is the announced release, all the way down.');
