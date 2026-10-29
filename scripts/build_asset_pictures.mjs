#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { Address } from '@ton/core';
import { SWAP_TOKENS } from '../web/swap-pools.mjs';
import { DEDUST_TOKENS } from '../web/dedust-pools.mjs';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import { toncenterAccess } from './lib/toncenter-access.mjs';

const argv = process.argv.slice(2);
const OUT = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : new URL('../web/asset-pictures.mjs', import.meta.url);
const PROXY_HOSTS = ['proxy.toncenter.com', 'imgproxy.toncenter.com'];
const INLINE_MAX = 16 * 1024;
const BATCH = 50;
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const raw = (address) => Address.parse(address).toRawString().toLowerCase();
const fromId = (id) => `0:${Buffer.from(id, 'base64url').toString('hex')}`;
const masters = [...new Set([...SWAP_TOKENS.map(([id]) => fromId(id)), ...DEDUST_TOKENS.map(([id]) => fromId(id)), raw(PLATHO_APP_CONFIG.ath.masterAddress)])];

const proxied = (value) => {
  try {
    const url = new URL(String(value ?? ''));
    return url.protocol === 'https:' && !url.username && !url.password && PROXY_HOSTS.includes(url.hostname.toLowerCase()) ? url.href : '';
  } catch { return ''; }
};
const inline = (value) => {
  const text = String(value ?? '').trim();
  return /^data:image\/(svg\+xml|png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(text) && text.length <= INLINE_MAX ? text : '';
};

const access = toncenterAccess();
const pictures = {};
let asked = 0;
for (let at = 0; at < masters.length; at += BATCH) {
  const chunk = masters.slice(at, at + BATCH);
  const query = chunk.map((address) => `address=${encodeURIComponent(address)}`).join('&');
  let body = null;
  for (let attempt = 0; attempt < 4 && !body; attempt += 1) {
    if (asked > 0) await sleep(attempt === 0 ? access.spacingMs + 200 : 5000);
    asked += 1;
    const response = await fetch(`https://toncenter.com/api/v3/metadata?${query}`, { headers: { accept: 'application/json', ...access.headers } });
    if (response.ok) body = await response.json();
    else console.error(`metadata ${at}: ${response.status}${attempt < 3 ? ', asked again' : ''}`);
  }
  if (!body) throw new Error(`metadata ${at}: no answer — nothing written`);
  for (const [address, entry] of Object.entries(body)) {
    const info = (entry?.token_info ?? []).find((one) => one?.valid !== false) ?? (entry?.token_info ?? [])[0] ?? null;
    const picture = proxied(info?.extra?._image_small) || proxied(info?.extra?._image_medium) || inline(info?.image);
    if (picture) pictures[raw(address)] = picture;
  }
}
const taken = new Date().toISOString().slice(0, 10);
const keys = Object.keys(pictures).sort();
const out = `/**
 * The pictures of the tokens the wallet offers — the swap lists' ${masters.length - 1} (STON.fi's and DeDust's) and ATH — as toncenter's index
 * described them on ${taken}:
 * ${keys.length} of ${masters.length} have one the app may draw (toncenter's image proxy, or an image the token carries on chain). Built by
 * scripts/build_asset_pictures.mjs — not edited by hand. Keys: a master's raw address, lower case.
 */
export const ASSET_PICTURES_TAKEN = '${taken}';
export const ASSET_PICTURES = Object.freeze({
${keys.map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(pictures[key])},`).join('\n')}
});
`;
writeFileSync(OUT, out);
console.log(`asset pictures: ${keys.length} of ${masters.length} tokens, ${asked} requests, ${Buffer.byteLength(out)} bytes`);
