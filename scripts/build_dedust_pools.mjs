#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Address, Cell, beginCell } from '@ton/core';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import { toncenterAccess } from './lib/toncenter-access.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs), []));
for (const name of ['pools', 'verified', 'stonfi', 'cache']) {
  if (!args[name]) { console.error(`missing --${name}`); process.exit(2); }
}
const FLOOR_USD = Number(args.floor ?? 1000);
const TAKEN = args.taken ?? new Date().toISOString().slice(0, 10);
const access = toncenterAccess();
const SPACING_MS = Math.max(access.spacingMs, Number(args.spacing ?? access.spacingMs));
const DEDUST_FACTORY = Address.parse('EQBfBWT7X2BHg9tXAxzhz2aKiNTU1tpt5NsiK0uSDW_YAJ67').toRawString();
const BLANK_CODE = Cell.fromBase64('te6ccgEBBAEAlgABFP8A9KQT9LzyyAsBAgJwAwIACb8pMvg8APXeA6DprkP0gGBB2onai9qPHDK3AgFA4LEAIZGWCgOeLAP0BQDXnoGSA/YB2s/ay9rI4v/aIxx72omh9IGmDqJljgvlwgcIHgmmPgMEITZ1R/V0K+XoB6Z+AmGpph4CA6hD9ghDodo92qYgjCCLBAHKTdqHsdqD2+ID5f8=');
const VAULT_CONTRACT_TYPE = 1;
const POOL_CONTRACT_TYPE = 2;

const read = (path, key) => { const json = JSON.parse(readFileSync(path, 'utf8')); return Array.isArray(json) ? json : json[key]; };
const raw = (value) => { try { return Address.parse(String(value)).toRawString(); } catch { return ''; } };
const clean = (value, max) => Array.from(String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, max).join('');
const decimalsText = (value) => { const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : ''; return /^\d{1,2}$/.test(text) && Number(text) <= 18 ? Number(text) : null; };

console.log(`toncenter: ${access.keyed ? 'with the key' : 'keyless'}, a call every ${SPACING_MS} ms`);
const cache = existsSync(args.cache) ? JSON.parse(readFileSync(args.cache, 'utf8')) : {};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let nextSlot = 0;
let asked = 0;
async function call(url, init) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const slot = Math.max(Date.now(), nextSlot);
    nextSlot = slot + SPACING_MS;
    await sleep(slot - Date.now());
    let response;
    try { response = await fetch(url, { ...init, headers: { ...(init?.headers ?? {}), ...access.headers } }); } catch { await sleep(3000); continue; }
    if (response.status === 429 || response.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
    asked += 1;
    if (asked % 20 === 0) { writeFileSync(args.cache, JSON.stringify(cache)); console.log(`  ${asked} reads`); }
    return response.json();
  }
  throw new Error(`${url}: no answer`);
}
async function get(address, method, stack = []) {
  const key = `${address}|${method}|${JSON.stringify(stack)}`;
  if (cache[key]) return cache[key];
  const json = await call('https://toncenter.com/api/v3/runGetMethod', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address, method, stack }) });
  if (typeof json?.exit_code !== 'number') throw new Error(`${method} at ${address}: ${JSON.stringify(json).slice(0, 200)}`);
  cache[key] = { exit_code: json.exit_code, stack: json.stack ?? [] };
  return cache[key];
}
const assetCell = (id) => (id === 'gram'
  ? beginCell().storeUint(0, 4).endCell()
  : (() => { const address = Address.parse(id); return beginCell().storeUint(1, 4).storeInt(address.workChain, 8).storeBuffer(address.hash).endCell(); })());
const sliceArg = (cell) => ({ type: 'slice', value: cell.toBoc().toString('base64') });
const numberAt = (item) => { const text = String(item.value).trim(); return text.startsWith('-') ? -BigInt(text.slice(1)) : BigInt(text); };
const addressAt = (item) => { const found = Cell.fromBase64(item.value).beginParse().loadMaybeAddress(); return found ? found.toRawString() : ''; };
const assetAt = (item) => {
  const slice = Cell.fromBase64(item.value).beginParse();
  const type = slice.loadUint(4);
  if (type === 0) return 'gram';
  if (type === 1) return new Address(slice.loadInt(8), slice.loadBuffer(32)).toRawString();
  return '';
};
function proofAddress(contractType, params) {
  const data = params(beginCell().storeAddress(Address.parse(DEDUST_FACTORY)).storeUint(contractType, 8)).endCell();
  return `0:${beginCell().storeUint(0, 2).storeMaybeRef(BLANK_CODE).storeMaybeRef(data).storeDict(null).endCell().hash().toString('hex')}`;
}
function derivedVault(id) {
  return proofAddress(VAULT_CONTRACT_TYPE, (builder) => builder.storeSlice(assetCell(id).beginParse()));
}
function derivedPool(stable, a, b) {
  return proofAddress(POOL_CONTRACT_TYPE, (builder) => builder.storeUint(stable ? 1 : 0, 1).storeSlice(assetCell(a).beginParse()).storeSlice(assetCell(b).beginParse()));
}

const listedPools = read(args.pools, 'pools');
const tonkeeper = new Map(read(args.verified, 'jettons').map((jetton) => [raw(jetton.address), jetton]).filter(([id]) => id));
const stonfi = new Map(read(args.stonfi, 'asset_list').map((asset) => [raw(asset.contract_address), asset]).filter(([id]) => id));
const OWN = new Map([[raw(PLATHO_APP_CONFIG.ath.masterAddress), 'ATH']]);
const idOf = (asset) => (asset?.type === 'native' ? 'gram' : asset?.type === 'jetton' ? raw(asset.address) : '');
function eligible(id) {
  if (id === 'gram') return true;
  if (!id || (!tonkeeper.has(id) && !OWN.has(id))) return false;
  const known = stonfi.get(id);
  return !(known && (known.blacklisted || known.taxable || known.deprecated));
}
const USDT = raw('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs');
const found = new Map();
const note = (pool, stable, a, b, listed) => { if (!found.has(pool)) found.set(pool, { pool, stable, ids: [a, b], listed }); };
for (const pool of listedPools) {
  if (pool.type !== 'volatile' && pool.type !== 'stable') continue;
  const ids = (pool.assets ?? []).map(idOf);
  if (ids.length !== 2 || ids[0] === ids[1] || !ids.every(eligible)) continue;
  const address = raw(pool.address);
  const stable = pool.type === 'stable';
  if (derivedPool(stable, ids[0], ids[1]) === address) note(address, stable, ids[0], ids[1], pool.assets);
  else if (derivedPool(stable, ids[1], ids[0]) === address) note(address, stable, ids[1], ids[0], [...pool.assets].reverse());
}
const fromList = found.size;
const verifiedTokens = [...new Set([...tonkeeper.keys(), ...OWN.keys()])].filter(eligible);
const probe = [];
for (const base of ['gram', USDT]) {
  for (const id of verifiedTokens) {
    if (id === base) continue;
    for (const stable of [false, true]) {
      for (const [a, b] of [[base, id], [id, base]]) {
        const pool = derivedPool(stable, a, b);
        if (!found.has(pool)) probe.push({ pool, stable, a, b });
      }
    }
  }
}
for (let at = 0; at < probe.length; at += 1000) {
  const batch = probe.slice(at, at + 1000);
  const key = `states|${batch[0].pool}|${batch.length}`;
  if (!cache[key]) {
    const query = batch.map((one) => `address=${Address.parse(one.pool).toString({ urlSafe: true, bounceable: true })}`).join('&');
    const answer = await call(`https://toncenter.com/api/v3/accountStates?${query}&include_boc=false`, {});
    if (!Array.isArray(answer?.accounts)) throw new Error(`accountStates: ${JSON.stringify(answer).slice(0, 200)}`);
    cache[key] = answer.accounts.filter((one) => one?.status === 'active').map((one) => raw(one.address));
  }
  const active = new Set(cache[key]);
  for (const one of batch) if (active.has(one.pool)) note(one.pool, one.stable, one.a, one.b, null);
}
console.log(`${found.size} pools of verified tokens: ${fromList} in DeDust's list, ${found.size - fromList} more found on chain (${probe.length} addresses asked)`);

const pools = [...found.values()];
let reading = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (reading < pools.length) {
    const one = pools[reading++];
    const reserves = await get(one.pool, 'get_reserves');
    one.reserves = reserves.exit_code === 0 && reserves.stack.length >= 2 ? [numberAt(reserves.stack[0]), numberAt(reserves.stack[1])] : [0n, 0n];
  }
}));
const perUnit = new Map();
for (const one of pools) {
  const side = one.ids.indexOf('gram');
  if (side < 0) continue;
  const gram = one.reserves[side];
  const other = one.reserves[1 - side];
  if (gram <= 0n || other <= 0n) continue;
  const id = one.ids[1 - side];
  const held = perUnit.get(id);
  const better = !held || (held.stable && !one.stable) || (held.stable === one.stable && held.depth < gram);
  if (better) perUnit.set(id, { depth: gram, stable: one.stable, value: Number(gram) / Number(other) });
}
const usdPerGram = 1000 / (perUnit.get(USDT)?.value ?? Infinity);
if (!(usdPerGram > 0)) { console.error('no GRAM/USD₮ pool on chain to value the floor by'); process.exit(1); }
for (const [id, held] of perUnit) if ((Number(held.depth) / 1e9) * usdPerGram < FLOOR_USD / 2) perUnit.delete(id);
const usdOf = (id, units) => {
  if (id === 'gram') return (Number(units) / 1e9) * usdPerGram;
  if (id === USDT) return Number(units) / 1e6;
  const price = perUnit.get(id)?.value;
  return price === undefined ? null : ((Number(units) * price) / 1e9) * usdPerGram;
};
const best = new Map();
for (const one of pools) {
  if (one.reserves[0] <= 0n || one.reserves[1] <= 0n) continue;
  const sides = one.ids.map((id, index) => usdOf(id, one.reserves[index]));
  const known = sides.filter((value) => value !== null);
  if (known.length === 0) continue;
  const usd = known.length === 2 ? known[0] + known[1] : known[0] * 2;
  if (!(usd >= FLOOR_USD)) continue;
  const key = `${[...one.ids].sort().join('|')}|${one.stable ? 'stable' : 'volatile'}`;
  const held = best.get(key);
  if (!held || held.usd < usd) best.set(key, { ...one, usd });
}
const candidates = [...best.values()].sort((a, b) => b.usd - a.usd);
console.log(`${candidates.length} candidate pools (${candidates.filter((one) => one.stable).length} stable) at $${FLOOR_USD}+ as they stand, GRAM at $${usdPerGram.toFixed(4)} on chain`);

const decimals = new Map([['gram', 9]]);
const defaulted = new Set();
const masters = [...new Set(candidates.flatMap((one) => one.ids))].filter((id) => id !== 'gram');
for (let at = 0; at < masters.length; at += 100) {
  const batch = masters.slice(at, at + 100);
  const key = `metadata|${batch.join(',')}`;
  let answer = cache[key];
  if (!answer) {
    const query = batch.map((id) => `address=${encodeURIComponent(Address.parse(id).toString({ urlSafe: true, bounceable: true }))}`).join('&');
    answer = await call(`https://toncenter.com/api/v3/metadata?${query}`, {});
    cache[key] = answer;
  }
  for (const [address, entry] of Object.entries(answer ?? {})) {
    const info = (entry?.token_info ?? []).find((one) => one?.type === 'jetton_masters');
    const stated = decimalsText(info?.extra?.decimals);
    if (stated !== null) decimals.set(raw(address), stated);
    else if (entry?.is_indexed === true && info?.valid === true && info?.extra?.decimals === undefined) defaulted.add(raw(address));
  }
}
function tokenOf(id, listed) {
  if (id === 'gram') return { id, symbol: 'GRAM', decimals: 9 };
  const dedust = decimalsText(listed?.metadata?.decimals);
  const stated = decimals.get(id) ?? (defaulted.has(id) && dedust === 9 ? 9 : null);
  if (stated === null) return { refused: defaulted.has(id) ? 'no decimals stated, and DeDust does not say 9' : 'toncenter states no decimals' };
  if (dedust !== null && dedust !== stated) return { refused: `decimals: toncenter ${stated}, DeDust ${dedust}` };
  const ston = decimalsText(stonfi.get(id)?.decimals);
  if (ston !== null && ston !== stated) return { refused: `decimals: toncenter ${stated}, STON.fi ${ston}` };
  const symbol = clean(OWN.get(id) || tonkeeper.get(id)?.symbol || listed?.metadata?.symbol, 16);
  return symbol ? { id, symbol, decimals: stated } : { refused: 'no symbol' };
}

const vaultVerdict = new Map();
async function vaultOf(id) {
  if (vaultVerdict.has(id)) return vaultVerdict.get(id);
  let verdict;
  const named = await get(DEDUST_FACTORY, 'get_vault_address', [sliceArg(assetCell(id))]);
  const vault = named.exit_code === 0 ? addressAt(named.stack[0]) : '';
  if (!vault || vault !== derivedVault(id)) verdict = { refused: 'the factory names a vault the proof does not derive' };
  else if (id !== 'gram') {
    const ready = await get(vault, 'is_ready');
    verdict = ready.exit_code === 0 && numberAt(ready.stack[0]) !== 0n ? { vault } : { refused: 'the vault is not ready' };
  } else {
    const asset = await get(vault, 'get_asset');
    verdict = asset.exit_code === 0 && assetAt(asset.stack[0]) === 'gram' ? { vault } : { refused: 'the GRAM vault names another asset' };
  }
  vaultVerdict.set(id, verdict);
  return verdict;
}

const kept = [];
async function judge(one) {
  const label = `${one.ids.map((id) => (id === 'gram' ? 'GRAM' : tonkeeper.get(id)?.symbol ?? id.slice(0, 10))).join('/')} ${one.stable ? 'stable' : 'volatile'} ${one.pool}`;
  try {
    const tokens = one.ids.map((id, index) => tokenOf(id, one.listed?.[index]));
    const refusedToken = tokens.find((token) => token.refused);
    if (refusedToken) { console.log(`left out ${label}: ${refusedToken.refused}`); return; }
    const assets = await get(one.pool, 'get_assets');
    if (assets.exit_code !== 0 || assets.stack.length < 2) { console.log(`left out ${label}: get_assets exit ${assets.exit_code}`); return; }
    const named = [assetAt(assets.stack[0]), assetAt(assets.stack[1])];
    if (named[0] === one.ids[1] && named[1] === one.ids[0]) { one.ids.reverse(); one.listed = one.listed ? [...one.listed].reverse() : null; tokens.reverse(); }
    if (named[0] !== one.ids[0] || named[1] !== one.ids[1]) { console.log(`left out ${label}: the pool names other assets`); return; }
    const stable = await get(one.pool, 'is_stable');
    if (stable.exit_code !== 0 || (numberAt(stable.stack[0]) !== 0n) !== one.stable) { console.log(`left out ${label}: is_stable disagrees`); return; }
    const reserves = await get(one.pool, 'get_reserves');
    if (reserves.exit_code !== 0 || numberAt(reserves.stack[0]) <= 0n || numberAt(reserves.stack[1]) <= 0n) { console.log(`left out ${label}: empty`); return; }
    const fee = await get(one.pool, 'get_trade_fee');
    if (fee.exit_code !== 0 || numberAt(fee.stack[1]) <= 0n || numberAt(fee.stack[0]) < 0n || numberAt(fee.stack[0]) >= numberAt(fee.stack[1])) {
      console.log(`left out ${label}: no trade fee below one`); return;
    }
    const derived = await get(DEDUST_FACTORY, 'get_pool_address', [{ type: 'num', value: one.stable ? '1' : '0' }, sliceArg(assetCell(one.ids[0])), sliceArg(assetCell(one.ids[1]))]);
    if (derived.exit_code !== 0 || addressAt(derived.stack[0]) !== one.pool) { console.log(`left out ${label}: the factory does not derive it`); return; }
    for (const side of [0, 1]) {
      const amount = numberAt(reserves.stack[side]) / 100n || 1n;
      const estimate = await get(one.pool, 'estimate_swap_out', [sliceArg(assetCell(one.ids[side])), { type: 'num', value: `0x${amount.toString(16)}` }]);
      if (estimate.exit_code !== 0 || assetAt(estimate.stack[0]) !== one.ids[1 - side] || numberAt(estimate.stack[1]) <= 0n) {
        console.log(`left out ${label}: estimate_swap_out does not answer from side ${side}`); return;
      }
    }
    for (const id of one.ids) {
      const vault = await vaultOf(id);
      if (vault.refused) { console.log(`left out ${label}: ${id === 'gram' ? 'GRAM' : id}: ${vault.refused}`); return; }
    }
    kept.push({ ...one, tokens });
  } catch (error) {
    console.log(`left out ${label}: ${error.message}`);
  }
}
let cursor = 0;
await Promise.all(Array.from({ length: 3 }, async () => { while (cursor < candidates.length) await judge(candidates[cursor++]); }));
writeFileSync(args.cache, JSON.stringify(cache));
kept.sort((a, b) => b.usd - a.usd);

const hashOf = (rawAddress) => Buffer.from(rawAddress.slice(2), 'hex').toString('base64url');
const tokenList = [{ id: 'gram', symbol: 'GRAM', decimals: 9 }];
const tokenIndex = new Map([['gram', 0]]);
for (const one of kept) {
  for (const token of one.tokens) {
    if (!tokenIndex.has(token.id)) { tokenIndex.set(token.id, tokenList.length); tokenList.push(token); }
  }
}
const vaults = tokenList.map((token) => vaultVerdict.get(token.id).vault);
const literal = (text) => JSON.stringify(text).replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
const tokens = tokenList.slice(1).map((token, index) => `  [${JSON.stringify(hashOf(token.id))}, ${literal(token.symbol)}, ${token.decimals}, ${JSON.stringify(hashOf(vaults[index + 1]))}],`).join('\n');
const poolLines = kept.map((one) => `  [${JSON.stringify(hashOf(one.pool))}, ${one.stable ? 1 : 0}, ${tokenIndex.get(one.ids[0])}, ${tokenIndex.get(one.ids[1])}],`).join('\n');
const out = `/**
 * The DeDust v2 pools the wallet swaps through (volatile and stable, direct pairs), as of ${TAKEN}: ${kept.length} pools among ${tokenList.length} tokens,
 * each pair's deepest pool of its type holding at least $${FLOOR_USD} as it stands on chain, every pool, vault and decimals read back from the chain.
 * Built by scripts/build_dedust_pools.mjs — not edited by hand. Account ids are the 32 bytes of a basechain address, base64url.
 */
export const DEDUST_POOLS_TAKEN = '${TAKEN}';
/** The factory's account id, and its vault for GRAM. */
export const DEDUST_FACTORY = ${JSON.stringify(hashOf(DEDUST_FACTORY))};
export const DEDUST_GRAM_VAULT = ${JSON.stringify(hashOf(vaults[0]))};
/** [master's account id, symbol, decimals, its DeDust vault's account id]; GRAM is index 0 and not listed. */
export const DEDUST_TOKENS = [
${tokens}
];
/** [pool, 1 when stable, token0 index, token1 index — in the pool's own order], deepest first. */
export const DEDUST_POOLS = [
${poolLines}
];
`;
writeFileSync(new URL('../web/dedust-pools.mjs', import.meta.url), out);
console.log(`web/dedust-pools.mjs: ${kept.length} pools (${kept.filter((one) => one.stable).length} stable), ${tokenList.length} tokens (${candidates.length - kept.length} left out), ${asked} reads`);
