#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Address, Cell, beginCell } from '@ton/core';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import { toncenterAccess } from './lib/toncenter-access.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs), []));
for (const name of ['routers', 'pools', 'assets', 'verified', 'cache']) {
  if (!args[name]) { console.error(`missing --${name}`); process.exit(2); }
}
const FLOOR_USD = Number(args.floor ?? 1000);
const TAKEN = args.taken ?? new Date().toISOString().slice(0, 10);
const PTON_V2_1 = Address.parse('EQBnGWMCf3-FZZq1W4IWcWiGAc3PHuZ0_H-7sad2oY00o83S').toRawString();
const GRAM_IN_LISTS = Address.parse('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c').toRawString();

const read = (path, key) => { const json = JSON.parse(readFileSync(path, 'utf8')); return Array.isArray(json) ? json : json[key]; };
const raw = (value) => { try { return Address.parse(String(value)).toRawString(); } catch { return ''; } };
const clean = (value, max) => Array.from(String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, max).join('');

const routers = new Map(read(args.routers, 'router_list')
  .filter((router) => router.major_version === 2 && router.router_type === 'ConstantProduct' && raw(router.pton_master_address) === PTON_V2_1)
  .map((router) => [raw(router.address), router]));
const verified = new Set(read(args.verified, 'jettons').map((jetton) => raw(jetton.address)).filter(Boolean));
const tonkeeper = new Map(read(args.verified, 'jettons').map((jetton) => [raw(jetton.address), jetton]));
const OWN = new Map([[raw(PLATHO_APP_CONFIG.ath.masterAddress), 'ATH']]);
for (const id of OWN.keys()) verified.add(id);
const assets = new Map(read(args.assets, 'asset_list').map((asset) => [raw(asset.contract_address), asset]));
function tokenOf(address) {
  const id = raw(address);
  if (id === GRAM_IN_LISTS) return { id: 'gram', symbol: 'GRAM', decimals: 9 };
  const asset = assets.get(id);
  if (!verified.has(id) || !asset || asset.kind !== 'Jetton' || asset.blacklisted || asset.deprecated || asset.taxable) return null;
  const decimals = Number(asset.decimals);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null;
  const symbol = clean(OWN.get(id) || tonkeeper.get(id)?.symbol || asset.symbol, 16);
  return symbol ? { id, symbol, decimals } : null;
}
const best = new Map();
for (const pool of read(args.pools, 'pool_list')) {
  if (pool.deprecated || !routers.has(raw(pool.router_address))) continue;
  const usd = Number(pool.lp_total_supply_usd ?? 0);
  if (!(usd >= FLOOR_USD)) continue;
  const token0 = tokenOf(pool.token0_address);
  const token1 = tokenOf(pool.token1_address);
  if (!token0 || !token1 || token0.id === token1.id) continue;
  const pair = [token0.id, token1.id].sort().join('|');
  if (!best.has(pair) || usd > best.get(pair).usd) best.set(pair, { pool: raw(pool.address), router: raw(pool.router_address), token0, token1, usd });
}
const candidates = [...best.values()].sort((a, b) => b.usd - a.usd);
console.log(`${candidates.length} pairs on ${new Set(candidates.map((one) => one.router)).size} routers at >= $${FLOOR_USD}`);

const cache = existsSync(args.cache) ? JSON.parse(readFileSync(args.cache, 'utf8')) : {};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const access = toncenterAccess();
console.log(`toncenter: ${access.keyed ? 'with the key' : 'keyless'}, a call every ${access.spacingMs} ms`);
let nextSlot = 0;
let asked = 0;
const inFlight = new Map();
async function get(address, method, stack = []) {
  const key = `${address} ${method} ${stack.map((item) => item.value).join(',')}`;
  if (cache[key]) return cache[key];
  if (!inFlight.has(key)) inFlight.set(key, ask(key, address, method, stack).finally(() => inFlight.delete(key)));
  return inFlight.get(key);
}
async function ask(key, address, method, stack) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const slot = Math.max(Date.now(), nextSlot);
    nextSlot = slot + access.spacingMs;
    await sleep(slot - Date.now());
    let response;
    try {
      response = await fetch('https://toncenter.com/api/v3/runGetMethod', {
        method: 'POST', headers: { 'content-type': 'application/json', ...access.headers }, body: JSON.stringify({ address, method, stack }),
      });
    } catch { await sleep(3000); continue; }
    if (response.status === 429 || response.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
    const json = await response.json();
    if (typeof json?.exit_code !== 'number') throw new Error(`${method} at ${address}: ${JSON.stringify(json).slice(0, 200)}`);
    cache[key] = { exit_code: json.exit_code, stack: json.stack ?? [] };
    asked += 1;
    if (asked % 20 === 0) { writeFileSync(args.cache, JSON.stringify(cache)); console.log(`  ${asked} reads`); }
    return cache[key];
  }
  throw new Error(`${method} at ${address}: no answer`);
}
const slice = (address) => ({ type: 'slice', value: beginCell().storeAddress(Address.parse(address)).endCell().toBoc().toString('base64') });
const addressAt = (item) => { const found = Cell.fromBase64(item.value).beginParse().loadMaybeAddress(); return found ? found.toRawString() : ''; };
const numberAt = (item) => BigInt(item.value);
const textAt = (item) => Cell.fromBase64(item.value).beginParse().loadStringTail();

const routerVerdict = new Map();
async function routerIsGood(router) {
  if (routerVerdict.has(router)) return routerVerdict.get(router);
  let verdict = '';
  const version = await get(router, 'get_router_version');
  const data = await get(router, 'get_router_data');
  if (version.exit_code !== 0 || numberAt(version.stack[0]) !== 2n) verdict = 'not a 2.x router';
  else if (data.exit_code !== 0 || textAt(data.stack[1]) !== 'constant_product') verdict = 'not constant_product';
  else if (numberAt(data.stack[2]) !== 0n) verdict = 'locked';
  routerVerdict.set(router, verdict);
  return verdict;
}
async function walletOf(master, router) {
  const answer = await get(master === 'gram' ? PTON_V2_1 : master, 'get_wallet_address', [slice(router)]);
  return answer.exit_code === 0 ? addressAt(answer.stack[0]) : '';
}
const kept = [];
async function judge(one) {
  const label = `${one.token0.symbol}/${one.token1.symbol} ${one.pool}`;
  try {
    const refused = await routerIsGood(one.router);
    if (refused) { console.log(`left out ${label}: router ${refused}`); return; }
    const data = await get(one.pool, 'get_pool_data');
    if (data.exit_code !== 0 || data.stack.length < 9) { console.log(`left out ${label}: get_pool_data exit ${data.exit_code}`); return; }
    if (numberAt(data.stack[0]) !== 0n) { console.log(`left out ${label}: locked`); return; }
    if (addressAt(data.stack[1]) !== one.router) { console.log(`left out ${label}: names another router`); return; }
    if (numberAt(data.stack[3]) <= 0n || numberAt(data.stack[4]) <= 0n) { console.log(`left out ${label}: empty`); return; }
    const wallet0 = addressAt(data.stack[5]);
    const wallet1 = addressAt(data.stack[6]);
    const derived = await get(one.router, 'get_pool_address', [slice(wallet0), slice(wallet1)]);
    if (derived.exit_code !== 0 || addressAt(derived.stack[0]) !== one.pool) { console.log(`left out ${label}: the router does not derive it`); return; }
    const of0 = await walletOf(one.token0.id, one.router);
    const of1 = await walletOf(one.token1.id, one.router);
    if (of0 !== wallet0 || of1 !== wallet1) { console.log(`left out ${label}: a wallet is not the router's own for its side`); return; }
    one.wallet0 = wallet0;
    one.wallet1 = wallet1;
    one.good = true;
  } catch (error) {
    console.log(`left out ${label}: ${error.message}`);
  }
}
let cursor = 0;
await Promise.all(Array.from({ length: 3 }, async () => { while (cursor < candidates.length) await judge(candidates[cursor++]); }));
for (const one of candidates) if (one.good) kept.push({ ...one });
const stated = new Map();
const tep64 = new Set();
const masters = [...new Set(kept.flatMap((one) => [one.token0, one.token1]).filter((token) => token.id !== 'gram').map((token) => token.id))];
for (let at = 0; at < masters.length; at += 100) {
  const batch = masters.slice(at, at + 100);
  const key = `metadata|${batch.join(',')}`;
  if (!cache[key]) {
    const slot = Math.max(Date.now(), nextSlot);
    nextSlot = slot + access.spacingMs;
    await sleep(slot - Date.now());
    const query = batch.map((id) => `address=${encodeURIComponent(Address.parse(id).toString({ urlSafe: true, bounceable: true }))}`).join('&');
    const response = await fetch(`https://toncenter.com/api/v3/metadata?${query}`, { headers: { accept: 'application/json', ...access.headers } });
    if (!response.ok) throw new Error(`metadata: HTTP ${response.status} — nothing written`);
    cache[key] = await response.json();
  }
  for (const [address, entry] of Object.entries(cache[key] ?? {})) {
    const info = (entry?.token_info ?? []).find((one) => one?.type === 'jetton_masters');
    const text = info?.extra?.decimals;
    const number = typeof text === 'string' || typeof text === 'number' ? Number(text) : Number.NaN;
    if (Number.isInteger(number) && number >= 0 && number <= 18) stated.set(raw(address), number);
    else if (entry?.is_indexed === true && info?.valid === true && text === undefined) tep64.add(raw(address));
  }
}
const decimalsRefused = new Map();
for (const token of kept.flatMap((one) => [one.token0, one.token1])) {
  if (token.id === 'gram' || decimalsRefused.has(token.id)) continue;
  const chain = stated.get(token.id) ?? (tep64.has(token.id) && token.decimals === 9 ? 9 : null);
  if (chain === null) decimalsRefused.set(token.id, `${token.symbol}: toncenter states no decimals`);
  else if (chain !== token.decimals) decimalsRefused.set(token.id, `${token.symbol}: decimals — toncenter ${chain}, STON.fi ${token.decimals}`);
}
for (let at = kept.length - 1; at >= 0; at -= 1) {
  const reason = decimalsRefused.get(kept[at].token0.id) ?? decimalsRefused.get(kept[at].token1.id);
  if (reason) { console.log(`left out ${kept[at].token0.symbol}/${kept[at].token1.symbol}: ${reason}`); kept.splice(at, 1); }
}
writeFileSync(args.cache, JSON.stringify(cache));

const hashOf = (rawAddress) => Buffer.from(rawAddress.slice(2), 'hex').toString('base64url');
const routerList = [...new Set(kept.map((one) => one.router))];
const tokenList = [{ id: 'gram', symbol: 'GRAM', decimals: 9 }];
const tokenIndex = new Map([['gram', 0]]);
for (const one of kept) {
  for (const token of [one.token0, one.token1]) {
    if (!tokenIndex.has(token.id)) { tokenIndex.set(token.id, tokenList.length); tokenList.push(token); }
  }
}
const tokens = tokenList.slice(1).map((token) => `  [${JSON.stringify(hashOf(token.id))}, ${JSON.stringify(token.symbol)}, ${token.decimals}],`).join('\n');
const pools = kept.map((one) => `  [${JSON.stringify(hashOf(one.pool))}, ${routerList.indexOf(one.router)}, ${tokenIndex.get(one.token0.id)}, ${tokenIndex.get(one.token1.id)}, `
  + `${JSON.stringify(hashOf(one.wallet0))}, ${JSON.stringify(hashOf(one.wallet1))}],`).join('\n');
const out = `/**
 * The pools the wallet swaps through (STON.fi v2 constant-product, direct pairs), as of ${TAKEN}: ${kept.length} pairs among ${tokenList.length} tokens
 * on ${routerList.length} routers, each pair's deepest pool holding at least $${FLOOR_USD}, every router, pool and wallet read back from the chain.
 * Built by scripts/build_swap_pools.mjs — not edited by hand. Account ids are the 32 bytes of a basechain address, base64url.
 */
export const SWAP_POOLS_TAKEN = '${TAKEN}';
/** Each router's account id. */
export const SWAP_ROUTERS = [
${routerList.map((router) => `  ${JSON.stringify(hashOf(router))},`).join('\n')}
];
/** [master's account id, symbol, decimals]; GRAM is index 0 and not listed. */
export const SWAP_TOKENS = [
${tokens}
];
/** [pool, router index, token0 index, token1 index, the router's wallet for token0, for token1], deepest first. */
export const SWAP_POOLS = [
${pools}
];
`;
writeFileSync(new URL('../web/swap-pools.mjs', import.meta.url), out);
console.log(`web/swap-pools.mjs: ${kept.length} pairs, ${tokenList.length} tokens, ${routerList.length} routers (${candidates.length - kept.length} left out), ${asked} reads`);
