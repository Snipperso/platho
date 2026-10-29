#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const PREFIX_BITS = 128;
const PREFIX_HEX = PREFIX_BITS / 4;

const [jettonsPath, collectionsPath, taken = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
if (!jettonsPath || !collectionsPath) {
  console.error('usage: node scripts/build_verified_assets.mjs <jettons.json> <collections.json> [YYYY-MM-DD]');
  process.exit(2);
}
function prefixesOf(path, minimum) {
  const list = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(list)) throw new Error(`${path} is not a list`);
  const prefixes = [...new Set(list
    .map((entry) => String(entry?.address ?? '').toLowerCase())
    .filter((address) => /^0:[0-9a-f]{64}$/.test(address))
    .map((address) => address.slice(2, 2 + PREFIX_HEX)))].sort();
  if (prefixes.length < minimum) throw new Error(`${path}: only ${prefixes.length} accounts — not the list`);
  return prefixes;
}
const jettons = prefixesOf(jettonsPath, 100);
const collections = prefixesOf(collectionsPath, 10);
const out = `/**
 * What Tonkeeper's open lists verify (github.com/tonkeeper/ton-assets, copies of ${taken}): ${jettons.length} jetton masters (jettons.json) and
 * ${collections.length} NFT collections (collections.json), each by the first ${PREFIX_BITS} bits of its account id (${PREFIX_HEX} hex digits), sorted —
 * out of a forger's reach even against the whole list at once (scripts/build_verified_assets.mjs says why). Built by that script — not edited
 * by hand.
 */
export const VERIFIED_ASSETS_TAKEN = '${taken}';
export const VERIFIED_JETTON_COUNT = ${jettons.length};
export const VERIFIED_COLLECTION_COUNT = ${collections.length};
const JETTONS = '${jettons.join('')}';
const COLLECTIONS = '${collections.join('')}';
const indexes = new Map();
function onList(packed, rawAddress) {
  const hex = String(rawAddress ?? '').toLowerCase().replace(/^0:/, '');
  if (!/^[0-9a-f]{64}$/.test(hex)) return false;
  if (!indexes.has(packed)) {
    const index = new Set();
    for (let at = 0; at < packed.length; at += ${PREFIX_HEX}) index.add(packed.slice(at, at + ${PREFIX_HEX}));
    indexes.set(packed, index);
  }
  return indexes.get(packed).has(hex.slice(0, ${PREFIX_HEX}));
}
/** Is this jetton master (raw "0:<hex>" or bare hex, any case) on the list? */
export function isVerifiedJettonMaster(rawAddress) {
  return onList(JETTONS, rawAddress);
}
/** Is this NFT collection (raw "0:<hex>" or bare hex, any case) on the list? */
export function isVerifiedNftCollection(rawAddress) {
  return onList(COLLECTIONS, rawAddress);
}
`;
writeFileSync(new URL('../web/verified-assets.mjs', import.meta.url), out);
console.log(`web/verified-assets.mjs: ${jettons.length} jetton masters, ${collections.length} collections, copies of ${taken}`);
