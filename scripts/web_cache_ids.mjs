/*
 * THE TWO DERIVED CACHE KEYS OF THE WEB CLIENT, DEFINED ONCE.
 *
 * Both used to be hand-bumped counters, and both shipped stale at least once: a release moved `./app.js?v=` and left
 * the version label behind (devices never reloaded), and a missed CACHE_NAME bump meant a changed icon reached no
 * device at all. They are derived from content now, so nobody has to remember them.
 *
 *   appBuildId()  — `b<8 hex of sha256(web/app.js)>`, the `?v=` on the app entry point in index.html and sw.js.
 *   cacheId()     — 12 hex over every precached asset's URL AND bytes, the tail of the service worker CACHE_NAME.
 *
 * Neither is circular: web/app.js never names its own token, and sw.js is not one of the assets it precaches.
 *
 * scripts/bump_module_versions.mjs WRITES them; tests/module-version-follows-content.test.ts CHECKS the files still
 * carry them. One definition with two readers, so the gate cannot certify a value the tool never produced.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

export const APP_ENTRY = 'web/app.js';
export const SERVICE_WORKER = 'web/sw.js';
/** Both places the app entry point's `?v=` is written. */
export const APP_TOKEN_SITES = ['web/index.html', SERVICE_WORKER];

/* A fresh RegExp per call — a shared global one carries `lastIndex` between callers.
 * Both spellings: index.html loads the entry ROOT-ABSOLUTE (`/app.js`) so a post permalink served at
 * /<name>/<post> still resolves it, while sw.js keeps `./app.js` (resolved against the worker's own scope). */
export const appTokenPattern = () => /((?:\.\/|\/)app\.js\?v=)([A-Za-z0-9]+)/g;
export const cacheNamePattern = () => /(const CACHE_NAME = 'platho-pwa-)([A-Za-z0-9-]+)(';)/;

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha256File(path) {
  return sha256(readFileSync(path));
}

/**
 * The build id, over the given bytes (the app entry point by default).
 *
 * The `b` prefix is load-bearing, not decoration: an all-digit hash — about one run in 44 — would be
 * indistinguishable from a module `?v=` counter to every `(\d+)` scan in the project, and app.js would drift in and
 * out of the counter machinery at random. A leading letter makes that structurally impossible.
 */
export function appBuildId(bytes = readFileSync(APP_ENTRY)) {
  return `b${sha256(bytes).slice(0, 8)}`;
}

/** The precache URLs, read out of the ASSETS list the service worker actually ships. */
export function precacheAssetUrls(swSource = readFileSync(SERVICE_WORKER, 'utf8')) {
  const start = swSource.indexOf('const ASSETS = [');
  const end = swSource.indexOf('];', start);
  if (start < 0 || end < 0) throw new Error(`no ASSETS list in ${SERVICE_WORKER}`);
  return [...swSource.slice(start, end).matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** `./assets/icons/copy.svg` -> `web/assets/icons/copy.svg`; the bare `./` navigation entry -> the app shell. */
export function assetSourcePath(url) {
  const clean = url.split('?')[0].replace(/^\.\//, '');
  const path = clean === '' ? 'web/index.html' : `web/${clean}`;
  return existsSync(path) ? path : null;
}

/** [{ url, path, sha256 }] for every precached asset. Throws if the worker precaches a URL with no file behind it. */
export function precacheEntries() {
  const entries = [];
  const missing = [];
  for (const url of precacheAssetUrls()) {
    const path = assetSourcePath(url);
    if (!path) missing.push(url);
    else entries.push({ url, path, sha256: sha256File(path) });
  }
  if (missing.length > 0) throw new Error(`the service worker precaches URLs with no file behind them:\n  ${missing.join('\n  ')}`);
  return entries;
}

/**
 * The URL goes into the digest as well as the bytes: adding, removing or re-versioning an entry must move the cache
 * id even when not one file's content changed.
 */
export function cacheIdFromEntries(entries) {
  const digest = createHash('sha256');
  for (const entry of entries) digest.update(`${entry.url}\n${entry.sha256}\n`);
  return digest.digest('hex').slice(0, 12);
}

export function cacheId() {
  return cacheIdFromEntries(precacheEntries());
}
