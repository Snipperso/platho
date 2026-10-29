#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { toncenterAccess } from './lib/toncenter-access.mjs';
import { ACTIVITY_MONTH_SAMPLE, ACTIVITY_SAMPLE, ACTIVITY_WINDOW_S, gramPrices, newSinceProduction, newToPlathoAndChain, poolDepthGram, tradesInMonth } from './lib/pool-activity-math.mjs';

const args = {};
for (let at = 2; at < process.argv.length; at += 2) args[process.argv[at].replace(/^--/, '')] = process.argv[at + 1];
const TAKEN = args.taken ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(TAKEN)) throw new Error(`--taken must be YYYY-MM-DD, got ${TAKEN}`);
const { SWAP_TOKENS, SWAP_POOLS } = await import('../web/swap-pools.mjs');
const { DEDUST_TOKENS, DEDUST_POOLS } = await import('../web/dedust-pools.mjs');
const rawOf = (id) => `0:${Buffer.from(id, 'base64url').toString('hex')}`;
const stonTokens = ['gram', ...SWAP_TOKENS.map(([id]) => rawOf(id))];
const dedustTokens = ['gram', ...DEDUST_TOKENS.map(([id]) => rawOf(id))];
const pools = [
  ...SWAP_POOLS.map(([id, , t0, t1]) => ({ id, address: rawOf(id), method: 'get_pool_data', at: [3, 4], tokens: [stonTokens[t0], stonTokens[t1]] })),
  ...DEDUST_POOLS.map(([id, , t0, t1]) => ({ id, address: rawOf(id), method: 'get_reserves', at: [0, 1], tokens: [dedustTokens[t0], dedustTokens[t1]] })),
];

const access = toncenterAccess();
console.log(`toncenter: ${access.keyed ? 'with the key' : 'keyless'}, a call every ${access.spacingMs} ms; ${pools.length} pools`);
const cache = args.cache && existsSync(args.cache) ? JSON.parse(readFileSync(args.cache, 'utf8')) : {};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let nextSlot = 0;
let asked = 0;
async function call(url, init) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const slot = Math.max(Date.now(), nextSlot);
    nextSlot = slot + access.spacingMs;
    await sleep(slot - Date.now());
    let response;
    try { response = await fetch(url, { ...init, headers: { accept: 'application/json', ...(init?.headers ?? {}), ...access.headers } }); } catch { await sleep(3000); continue; }
    if (response.status === 429 || response.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
    asked += 1;
    if (asked % 100 === 0) { if (args.cache) writeFileSync(args.cache, JSON.stringify(cache)); console.log(`  ${asked} reads`); }
    return response.json();
  }
  throw new Error(`${url.split('?')[0]}: no answer`);
}
const numberAt = (item) => { const text = String(item?.value ?? '').trim(); return text.startsWith('-') ? -BigInt(text.slice(1)) : BigInt(text); };
async function readPool(pool) {
  if (cache[pool.id]?.readAt !== undefined && cache[pool.id]?.sample === ACTIVITY_MONTH_SAMPLE) return cache[pool.id];
  const state = await call('https://toncenter.com/api/v3/runGetMethod', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: pool.address, method: pool.method, stack: [] }),
  });
  if (state?.exit_code !== 0 || !Array.isArray(state.stack)) throw new Error(`${pool.method} at ${pool.address}: exit ${state?.exit_code}`);
  const sample = ACTIVITY_MONTH_SAMPLE;
  const from = Math.floor(Date.now() / 1000) - ACTIVITY_WINDOW_S;
  const swaps = await call(`https://toncenter.com/api/v3/actions?account=${encodeURIComponent(pool.address)}&action_type=jetton_swap&start_utime=${from}&limit=${sample}&sort=desc`);
  if (!Array.isArray(swaps?.actions)) throw new Error(`the swaps of ${pool.address} did not read`);
  const timeOf = (action) => Number(action.end_utime ?? action.start_utime ?? 0);
  cache[pool.id] = {
    reserves: pool.at.map((index) => String(numberAt(state.stack[index]))),
    times: swaps.actions.filter((action) => action.success !== false).map(timeOf),
    returned: swaps.actions.length,
    readAt: Math.floor(Date.now() / 1000),
    oldest: Math.min(...swaps.actions.map(timeOf).filter((at) => at > 0), Number.POSITIVE_INFINITY),
    sample,
  };
  return cache[pool.id];
}
const read = new Map();
const failed = [];
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < pools.length) {
    const pool = pools[next];
    next += 1;
    try { read.set(pool.id, await readPool(pool)); } catch (error) { failed.push(pool.id); console.log(`  left out ${pool.address}: ${error.message}`); }
  }
}));
if (args.cache) writeFileSync(args.cache, JSON.stringify(cache));
if (failed.length > pools.length / 10) throw new Error(`${failed.length} of ${pools.length} pools did not read — too many to ship`);

const measured = pools.filter((pool) => read.has(pool.id)).map((pool) => ({ ...pool, ...read.get(pool.id), reserves: read.get(pool.id).reserves.map(BigInt) }));
const prices = gramPrices(measured);
const rows = measured.map((pool) => [pool.id, poolDepthGram(pool, prices) ?? 0, tradesInMonth(pool, pool.readAt, pool.sample ?? ACTIVITY_SAMPLE)]);
const PROD = args.prod ?? 'https://platho.app';
async function prodTokens(file, from, to) {
  try {
    let text;
    if (args['prod-dir']) {
      if (!existsSync(join(args['prod-dir'], file))) return null;
      text = readFileSync(join(args['prod-dir'], file), 'utf8');
    } else {
      const response = await fetch(`${PROD}/${file}`, { redirect: 'follow', cache: 'no-store' });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      text = await response.text();
    }
    const part = text.slice(text.indexOf(from), text.indexOf(to));
    return [...part.matchAll(/^\s*\["([A-Za-z0-9_-]{43})", "/gm)].map((match) => match[1]);
  } catch (error) {
    console.log(`  production's ${file} did not read (${error.message}): no token is named new`);
    return undefined;
  }
}
const prodSton = await prodTokens('swap-pools.mjs', 'SWAP_TOKENS', 'SWAP_POOLS =');
const prodDedust = await prodTokens('dedust-pools.mjs', 'DEDUST_TOKENS', 'DEDUST_POOLS =');
const candidates = prodSton === undefined || prodSton === null || prodDedust === undefined ? []
  : newSinceProduction({ ston: SWAP_TOKENS.map(([id]) => id), dedust: DEDUST_TOKENS.map(([id]) => id), prodSton, prodDedust });
const SHIPPED = new URL('../artifacts/swap-tokens-shipped.json', import.meta.url);
const shippedFile = existsSync(SHIPPED) ? JSON.parse(readFileSync(SHIPPED, 'utf8')) : { tokens: {} };
const shipped = shippedFile.tokens ?? {};
for (const id of [...(prodSton ?? []), ...(prodDedust ?? [])]) shipped[id] ??= TAKEN;
const symbolOf = new Map([...SWAP_TOKENS, ...DEDUST_TOKENS].map(([id, symbol]) => [id, symbol]));
const nowS = Math.floor(Date.now() / 1000);
const fresh = [];
for (const id of candidates) {
  const key = `first:${id}`;
  if (cache[key] === undefined) {
    const first = await call(`https://toncenter.com/api/v3/transactions?account=${encodeURIComponent(rawOf(id))}&sort=asc&limit=1`);
    cache[key] = Number(first?.transactions?.[0]?.now ?? 0);
  }
  if (newToPlathoAndChain(id, { shipped, firstAt: cache[key], nowS })) fresh.push(id);
  else console.log(`  ${symbolOf.get(id) ?? id} is not new: ${Object.hasOwn(shipped, id) ? `shipped on ${shipped[id]}` : cache[key] ? `its master is ${Math.round((nowS - cache[key]) / 86_400)} days old` : 'its age did not read'}`);
}
if (args.cache) writeFileSync(args.cache, JSON.stringify(cache));
writeFileSync(SHIPPED, `${JSON.stringify({ ...shippedFile, tokens: Object.fromEntries(Object.entries(shipped).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) }, null, 1)}\n`);
const out = `/**
 * How deep and how busy each swap pool is, as of ${TAKEN}: [pool's account id (base64url), depth in whole GRAM, swaps in the last thirty days]
 * for ${rows.length} pools of web/swap-pools.mjs and web/dedust-pools.mjs — reserves read from each pool, swaps from toncenter's index.
 * Built by scripts/build_pool_activity.mjs — not edited by hand.
 */
export const POOL_ACTIVITY_TAKEN = '${TAKEN}';
/** The tokens new in this release — in the lists and not in production's (${PROD}) when they were built. */
export const POOL_ACTIVITY_NEW = ${JSON.stringify(fresh)};
export const POOL_ACTIVITY = [
${rows.map((row) => `  ${JSON.stringify(row)},`).join('\n')}
];
`;
writeFileSync(new URL('../web/pool-activity.mjs', import.meta.url), out);
const lively = rows.filter(([, depth, trades]) => depth >= 5_000 && trades >= 30).length;
console.log(`web/pool-activity.mjs: ${rows.length} pools (${failed.length} left out), ${lively} at 5 000 GRAM and 30 swaps a month or more, ${fresh.length} tokens new since production, ${asked} reads`);
