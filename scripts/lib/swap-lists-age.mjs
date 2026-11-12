import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const SWAP_LISTS = Object.freeze([
  { file: 'verified-assets.mjs', constant: 'VERIFIED_ASSETS_TAKEN', what: "Tonkeeper's verified tokens" },
  { file: 'swap-pools.mjs', constant: 'SWAP_POOLS_TAKEN', what: "STON.fi's pools" },
  { file: 'dedust-pools.mjs', constant: 'DEDUST_POOLS_TAKEN', what: "DeDust's pools" },
  { file: 'asset-pictures.mjs', constant: 'ASSET_PICTURES_TAKEN', what: "the tokens' pictures" },
  { file: 'pool-activity.mjs', constant: 'POOL_ACTIVITY_TAKEN', what: "the pools' depth and swaps" },
  { file: 'nft-collections.mjs', constant: 'NFT_COLLECTIONS_TAKEN', what: 'the NFT collections Getgems verifies' },
]);
export const SWAP_LISTS_MAX_AGE_DAYS = 7;
export const JETTON_PROOF = 2;
export const SWAP_LISTS_PROVEN_WHOLE = Object.freeze([
  { file: 'swap-pools.mjs', taken: 'SWAP_POOLS_TAKEN', whole: 'SWAP_TOKENS_WHOLE', proof: 'SWAP_TOKENS_PROOF', what: "STON.fi's pools" },
  { file: 'dedust-pools.mjs', taken: 'DEDUST_POOLS_TAKEN', whole: 'DEDUST_TOKENS_WHOLE', proof: 'DEDUST_TOKENS_PROOF', what: "DeDust's pools" },
]);

const dayStated = (text, constant) => new RegExp(`^export const ${constant} = '(\\d{4}-\\d{2}-\\d{2})';`, 'm').exec(text)?.[1] ?? '';
const numberStated = (text, constant) => new RegExp(`^export const ${constant} = (\\d+);`, 'm').exec(text)?.[1] ?? '';

export function swapListTaken(dir, list) {
  try {
    return dayStated(readFileSync(join(dir, list.file), 'utf8'), list.constant);
  } catch {
    return '';
  }
}

export function unprovenSwapLists(dir) {
  const unproven = [];
  for (const list of SWAP_LISTS_PROVEN_WHOLE) {
    let text = '';
    try { text = readFileSync(join(dir, list.file), 'utf8'); } catch { text = ''; }
    const taken = dayStated(text, list.taken);
    const whole = dayStated(text, list.whole);
    const proof = numberStated(text, list.proof);
    if (!taken || whole !== taken || proof !== String(JETTON_PROOF)) {
      unproven.push({ file: list.file, what: list.what, taken: taken || '(unreadable)', whole: whole || '(none)', proof: proof || '(none)' });
    }
  }
  return unproven;
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
