import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { shippedBytes } from './lib/strip-comments.mjs';

export const APP_ENTRY = 'web/app.js';
export const SERVICE_WORKER = 'web/sw.js';
export const APP_TOKEN_SITES = ['web/index.html', SERVICE_WORKER];

export const appTokenPattern = () => /((?:\.\/|\/)app\.js\?v=)([A-Za-z0-9]+)/g;
export const cacheNamePattern = () => /(const CACHE_NAME = 'platho-pwa-)([A-Za-z0-9-]+)(';)/;

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha256File(path) {
  return sha256(shippedBytes(path));
}

export function appBuildId(bytes = shippedBytes(APP_ENTRY)) {
  return `b${sha256(bytes).slice(0, 8)}`;
}

export function precacheAssetUrls(swSource = readFileSync(SERVICE_WORKER, 'utf8')) {
  const start = swSource.indexOf('const ASSETS = [');
  const end = swSource.indexOf('];', start);
  if (start < 0 || end < 0) throw new Error(`no ASSETS list in ${SERVICE_WORKER}`);
  return [...swSource.slice(start, end).matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

export function assetSourcePath(url) {
  const clean = url.split('?')[0].replace(/^\.\//, '');
  const path = clean === '' ? 'web/index.html' : `web/${clean}`;
  return existsSync(path) ? path : null;
}

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

export function cacheIdFromEntries(entries) {
  const digest = createHash('sha256');
  for (const entry of entries) digest.update(`${entry.url}\n${entry.sha256}\n`);
  return digest.digest('hex').slice(0, 12);
}

export function cacheId() {
  return cacheIdFromEntries(precacheEntries());
}
