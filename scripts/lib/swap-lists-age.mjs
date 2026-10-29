import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const SWAP_LISTS = Object.freeze([
  { file: 'verified-assets.mjs', constant: 'VERIFIED_ASSETS_TAKEN', what: "Tonkeeper's verified tokens" },
  { file: 'swap-pools.mjs', constant: 'SWAP_POOLS_TAKEN', what: "STON.fi's pools" },
  { file: 'dedust-pools.mjs', constant: 'DEDUST_POOLS_TAKEN', what: "DeDust's pools" },
  { file: 'asset-pictures.mjs', constant: 'ASSET_PICTURES_TAKEN', what: "the tokens' pictures" },
  { file: 'pool-activity.mjs', constant: 'POOL_ACTIVITY_TAKEN', what: "the pools' depth and swaps" },
]);
export const SWAP_LISTS_MAX_AGE_DAYS = 7;

export function swapListTaken(dir, list) {
  try {
    const text = readFileSync(join(dir, list.file), 'utf8');
    return new RegExp(`export const ${list.constant} = '(\\d{4}-\\d{2}-\\d{2})';`).exec(text)?.[1] ?? '';
  } catch {
    return '';
  }
}

export function staleSwapLists(dir, nowMs = Date.now(), maxDays = SWAP_LISTS_MAX_AGE_DAYS) {
  const stale = [];
  for (const list of SWAP_LISTS) {
    const taken = swapListTaken(dir, list);
    const at = taken ? Date.parse(`${taken}T00:00:00Z`) : Number.NaN;
    const days = Number.isFinite(at) ? Math.floor((nowMs - at) / 86_400_000) : Number.POSITIVE_INFINITY;
    if (!(days <= maxDays)) stale.push({ ...list, taken: taken || '(unreadable)', days });
  }
  return stale;
}
