#!/usr/bin/env node
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toncenterAccess } from './lib/toncenter-access.mjs';
import { GETGEMS_SALE_DEPLOYER } from '../web/nft-market.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = {};
for (let at = 2; at < process.argv.length; at += 2) args[process.argv[at].replace(/^--/, '')] = process.argv[at + 1];
const TAKEN = args.taken ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(TAKEN)) throw new Error(`--taken must be YYYY-MM-DD, got ${TAKEN}`);
const CACHE = args.cache ?? join(ROOT, 'artifacts', 'local', 'lists', 'cache', 'nft-deployer.json');
const OUT = join(ROOT, 'web', 'nft-collections.mjs');
const TONCENTER = 'https://toncenter.com/api/v3';
const TONAPI = 'https://tonapi.io/v2';
const DAY_S = 86_400;
const WINDOW_DAYS = 30;
const KEEP_DAYS = 60;
const FIRST_DAYS = 400;
const SLICE_DAYS = 30;
const SLICES_AT_ONCE = 4;
const PAGE = 1000;
const TONAPI_BATCH = 100;
const UNANSWERED_MAX = 0.02;
const APPROVED_MIN = 100;
const access = toncenterAccess();
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const dayOf = (unix) => new Date(unix * 1000).toISOString().slice(0, 10);

async function ask(url, options = {}, spacingMs = access.spacingMs) {
  let last = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(180_000) });
      if (response.ok) {
        await sleep(spacingMs);
        return await response.json();
      }
      last = new Error(`HTTP ${response.status}`);
    } catch (error) {
      last = error;
    }
    await sleep(2000 * (attempt + 1));
  }
  throw new Error(`${url.split('?')[0]}: ${last?.message ?? 'no answer'}`);
}

async function listingsBetween({ startLt = null, startUtime = null, endUtime = null }, onRows) {
  let endLt = null;
  for (;;) {
    const range = `${startLt ? `&start_lt=${BigInt(startLt) + 1n}` : ''}${startUtime ? `&start_utime=${startUtime}` : ''}${endUtime ? `&end_utime=${endUtime}` : ''}`;
    const body = await ask(`${TONCENTER}/nft/transfers?owner_address=${GETGEMS_SALE_DEPLOYER}&direction=out${range}&sort=desc&limit=${PAGE}${endLt ? `&end_lt=${endLt}` : ''}`,
      { headers: access.headers });
    const rows = Array.isArray(body?.nft_transfers) ? body.nft_transfers : [];
    onRows(rows.filter((row) => row?.transaction_aborted !== true && row?.nft_collection));
    if (rows.length < PAGE) return;
    endLt = (BigInt(rows.at(-1).transaction_lt) - 1n).toString();
  }
}

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : { newestLt: null, collections: {} };
let read = 0;
const take = (rows) => {
  for (const row of rows) {
    const key = String(row.nft_collection).toLowerCase();
    const at = Number(row.transaction_now) || 0;
    const one = cache.collections[key] ?? (cache.collections[key] = { total: 0, last: 0, days: {} });
    one.total += 1;
    one.last = Math.max(one.last, at);
    const day = dayOf(at);
    one.days[day] = (one.days[day] ?? 0) + 1;
    if (!cache.newestLt || BigInt(row.transaction_lt) > BigInt(cache.newestLt)) cache.newestLt = String(row.transaction_lt);
  }
  read += rows.length;
  if (read && read % 20_000 < rows.length) console.log(`  ${read} listings read`);
};
console.log(`the deployer's listings: ${cache.newestLt ? `since lt ${cache.newestLt}` : `the first run, ${FIRST_DAYS} days back`} (toncenter ${access.keyed ? 'with the key' : 'keyless — slow'})`);
if (cache.newestLt) {
  await listingsBetween({ startLt: cache.newestLt }, take);
} else {
  const now = Math.floor(Date.now() / 1000);
  const slices = [];
  for (let end = now; end > now - FIRST_DAYS * DAY_S; end -= SLICE_DAYS * DAY_S) slices.push({ startUtime: Math.max(now - FIRST_DAYS * DAY_S, end - SLICE_DAYS * DAY_S) + 1, endUtime: end });
  for (let at = 0; at < slices.length; at += SLICES_AT_ONCE) await Promise.all(slices.slice(at, at + SLICES_AT_ONCE).map((slice) => listingsBetween(slice, take)));
}
const oldest = dayOf(Math.floor(Date.now() / 1000) - KEEP_DAYS * DAY_S);
for (const one of Object.values(cache.collections)) for (const day of Object.keys(one.days)) if (day < oldest) delete one.days[day];
writeFileSync(`${CACHE}.tmp`, JSON.stringify(cache));
renameSync(`${CACHE}.tmp`, CACHE);
const ids = Object.keys(cache.collections);
console.log(`  ${read} new listings; ${ids.length} collections ever listed`);

const approved = [];
let unanswered = 0;
const cut = (value) => (typeof value === 'string'
  ? Array.from(value.replace(/[\u0000-\u001f\u007f-\u009f​‎‏‪-‮⁠⁦-⁩﻿]/g, '').trim()).slice(0, 64).join('') : '');
for (let at = 0; at < ids.length; at += TONAPI_BATCH) {
  const asked = ids.slice(at, at + TONAPI_BATCH);
  const body = await ask(`${TONAPI}/nfts/collections/_bulk`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account_ids: asked }) }, 1100);
  const answered = new Map((Array.isArray(body?.nft_collections) ? body.nft_collections : []).map((row) => [String(row?.address ?? '').toLowerCase(), row]));
  for (const id of asked) {
    const row = answered.get(id);
    if (!row) { unanswered += 1; continue; }
    if (/^0:[0-9a-f]{64}$/.test(id) && Array.isArray(row.approved_by) && row.approved_by.includes('getgems')) approved.push({ id, name: cut(row.metadata?.name) });
  }
}
if (unanswered > ids.length * UNANSWERED_MAX) throw new Error(`tonapi left ${unanswered} of ${ids.length} collections unanswered — nothing was written`);
if (approved.length < APPROVED_MIN) throw new Error(`only ${approved.length} approved collections — not a list; nothing was written`);
const since = dayOf(Date.parse(`${TAKEN}T00:00:00Z`) / 1000 - WINDOW_DAYS * DAY_S);
const listed = (id) => Object.entries(cache.collections[id].days).reduce((sum, [day, count]) => (day > since ? sum + count : sum), 0);
const rows = approved.map((one) => ({ ...one, listed: listed(one.id), total: cache.collections[one.id].total }))
  .sort((a, b) => b.listed - a.listed || b.total - a.total || a.id.localeCompare(b.id));

const ascii = (text) => JSON.stringify(text).replace(/[\u007f-\uffff]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
const lines = rows.map((one) => `  [${JSON.stringify(one.id.replace(/^0:/, ''))}, ${ascii(one.name)}, ${one.listed}],`);
writeFileSync(OUT, `/**
 * The NFT collections Getgems verifies among those ever listed through its sale deployer (tonapi's \`approved_by\`, asked ${TAKEN}): ${rows.length},
 * each as [its account id, its name as its collection gives it, its listings in the ${WINDOW_DAYS} days before] — most listed first. Built by
 * scripts/build_nft_collections.mjs — not edited by hand.
 */
export const NFT_COLLECTIONS_TAKEN = '${TAKEN}';
export const NFT_COLLECTIONS_COUNT = ${rows.length};
const ROWS = [
${lines.join('\n')}
];
let held = null;
const index = () => (held ??= new Map(ROWS.map(([id, name, listed]) => [id, { collection: \`0:\${id}\`, name, listed }])));
/** The collections, most listed first: [{ collection (raw), name, listed }]. */
export function approvedNftCollections() {
  return [...index().values()];
}
/** Is this NFT collection (raw "0:<hex>", any case) one Getgems verifies? */
export function isApprovedNftCollection(rawAddress) {
  const hex = String(rawAddress ?? '').toLowerCase().replace(/^0:/, '');
  return /^[0-9a-f]{64}$/.test(hex) && index().has(hex);
}
`);
console.log(`  ${rows.length} approved (${unanswered} unanswered) -> web/nft-collections.mjs`);
