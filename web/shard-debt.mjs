
import { addrKey } from './shard-discovery.mjs?v=103';
import { readAccountStates, toWireAddress } from './shard-reader.mjs?v=108';
import { createShardStatesRequest, createShardLastTransactionReader } from './shard-rpc.mjs?v=69';

export const LANE_PUBLIC = 'public';
export const LANE_CONV = 'conv';
export const LANE_INTRO = 'intro';
export const LANE_REPORT = 'report';
export const LANE_KEY = 'key';
export const LANE_SANCTION = 'sanction';
export const LANE_RECOVERY = 'recovery';

export const STORAGE_PRICE = Object.freeze({ since: 1_777_500_000, bitPricePs: 0n, cellPricePs: 135n });

export const EMPTY_SHARD_STORAGE = Object.freeze({
  [LANE_PUBLIC]: Object.freeze({ cells: 72n, bits: 31_950n }),
  [LANE_INTRO]: Object.freeze({ cells: 26n, bits: 11_708n }),
  [LANE_CONV]: Object.freeze({ cells: 25n, bits: 10_408n }),
  [LANE_REPORT]: Object.freeze({ cells: 51n, bits: 19_444n }),
  [LANE_SANCTION]: Object.freeze({ cells: 17n, bits: 8_361n }),
  [LANE_KEY]: Object.freeze({ cells: 39n, bits: 25_240n }),
  [LANE_RECOVERY]: Object.freeze({ cells: 23n, bits: 9_119n }),
});

export const SECONDS_PER_YEAR = 31_536_000;
export const SHARD_DEBT_CEILING = 1_000_000_000n;

export const SHARD_DEBT_CACHE_TTL_MS = 600_000;

function laneStorage(lane) {
  const storage = EMPTY_SHARD_STORAGE[lane];
  if (!storage) throw new Error(`shard-debt: unknown lane "${lane}" (expected one of ${Object.keys(EMPTY_SHARD_STORAGE).map((k) => `"${k}"`).join(', ')})`);
  return storage;
}

export function storageFeeNanotons({ cells, bits }, seconds, price = STORAGE_PRICE) {
  const span = Number(seconds);
  const delta = Number.isFinite(span) && span > 0 ? BigInt(Math.floor(span)) : 0n;
  return ((BigInt(cells) * price.cellPricePs + BigInt(bits) * price.bitPricePs) * delta + 65_535n) >> 16n;
}

export function emptyShardRentPerYear(lane) {
  return storageFeeNanotons(laneStorage(lane), SECONDS_PER_YEAR);
}

export function squatCushionNanotons(lane) {
  return emptyShardRentPerYear(lane);
}

export function estimateShardDebt({ lane, lastTransactionUnix, nowUnix, balance = 0n, dueCarried = 0n }) {
  const owed = BigInt(dueCarried ?? 0n)
    + storageFeeNanotons(laneStorage(lane), Number(nowUnix) - Number(lastTransactionUnix)) - BigInt(balance ?? 0n);
  if (owed <= 0n) return 0n;
  return owed > SHARD_DEBT_CEILING ? SHARD_DEBT_CEILING : owed;
}

export function createShardDebtResolver({ readStates, readLastTransaction, cacheTtlMs = SHARD_DEBT_CACHE_TTL_MS, now = () => Date.now() } = {}) {
  if (typeof readStates !== 'function' || typeof readLastTransaction !== 'function') {
    throw new Error('createShardDebtResolver requires readStates and readLastTransaction');
  }
  const cache = new Map();
  return async (address, lane, nowUnix) => {
    const key = addrKey(address);
    let seen = cache.get(key);
    if (!seen || now() - seen.at > cacheTtlMs) {
      const row = await readStates(address);
      const status = row?.status ?? 'nonexist';
      const last = status === 'active' || status === 'frozen' ? await readLastTransaction(address) : null;
      seen = {
        status, balance: BigInt(row?.balance ?? 0n), at: now(),
        lastTransactionUnix: last?.now ?? null, dueCarried: BigInt(last?.storageFeesDue ?? 0n),
      };
      cache.delete(key);
      cache.set(key, seen);
      while (cache.size > SHARD_DEBT_CACHE_MAX) cache.delete(cache.keys().next().value);
    }
    const cushion = squatCushionNanotons(lane);
    const debt = seen.lastTransactionUnix === null
      ? 0n
      : estimateShardDebt({ lane, lastTransactionUnix: seen.lastTransactionUnix, nowUnix, balance: seen.balance, dueCarried: seen.dueCarried });
    return { cushion, debt, status: seen.status };
  };
}

let defaultResolver = null;
const SHARD_DEBT_CACHE_MAX = 1_024;
const SHARD_DEBT_REQUEST_OPTIONS = Object.freeze({ skipIfRateLimited: false, priority: 'critical', queueTimeoutMs: 8_000 });

export function defaultShardDebtResolver() {
  if (!defaultResolver) {
    const request = createShardStatesRequest({ strict: true, requestOptions: SHARD_DEBT_REQUEST_OPTIONS });
    const readLastTransaction = createShardLastTransactionReader({ requestOptions: SHARD_DEBT_REQUEST_OPTIONS });
    defaultResolver = createShardDebtResolver({
      readStates: async (address) => (await readAccountStates([toWireAddress(address)], { request })).get(addrKey(address)) ?? null,
      readLastTransaction,
    });
  }
  return defaultResolver;
}

export function __resetShardDebtResolverForTests() {
  defaultResolver = null;
}

const addNanotons = (amount, extra) => {
  if (typeof amount === 'bigint') return amount + extra;
  if (typeof amount === 'number') return Number(BigInt(amount) + extra);
  return String(BigInt(amount ?? 0) + extra);
};

export async function applyShardSurcharge(lane, prepared, { resolver = null, nowUnix = null, strict = false } = {}) {
  if (!Array.isArray(prepared)) throw new Error('applyShardSurcharge: prepared must be an array of built messages');
  laneStorage(lane);
  const resolve = resolver ?? defaultShardDebtResolver();
  const at = nowUnix !== null && Number.isFinite(Number(nowUnix)) ? Number(nowUnix) : Math.floor(Date.now() / 1000);
  const verdicts = new Map();
  let debtTotal = 0n;
  for (const item of prepared) {
    const shard = item?.shard ?? item?.to ?? item?.message?.address ?? null;
    if (!shard) throw new Error('applyShardSurcharge: a prepared message names no shard');
    const key = addrKey(shard);
    if (!verdicts.has(key)) {
      let verdict;
      try {
        verdict = await resolve(shard, lane, at);
      } catch (error) {
        if (strict) {
          const refused = new Error('the shard account could not be read: nothing was signed');
          refused.code = 'SHARD_DEBT_UNREAD';
          refused.cause = error;
          throw refused;
        }
        console.warn('[shard-debt] the shard account could not be read; publishing with the cushion alone',
          { lane, shard, error: error?.message ?? String(error) });
        verdict = { cushion: squatCushionNanotons(lane), debt: 0n, status: 'unknown' };
      }
      if (verdict.debt > 0n) {
        console.info('[shard-debt] a pre-created shard owes rent; attaching it', { lane, shard, debt: verdict.debt.toString(), status: verdict.status });
      }
      verdicts.set(key, verdict);
    }
    const { cushion, debt } = verdicts.get(key);
    debtTotal += debt;
    item.surcharge = { cushion, debt };
  }
  for (const item of prepared) {
    const extra = item.surcharge.cushion + item.surcharge.debt;
    item.message.amount = addNanotons(item.message.amount, extra);
    if (item.value !== undefined && item.value !== null) item.value = addNanotons(item.value, extra);
  }
  return { prepared, cushion: squatCushionNanotons(lane), debtTotal };
}

export function surchargeExtraNanotons({ prepared, budgeted, cushion, deploy = null }) {
  const sent = prepared.reduce((sum, item) => sum + BigInt(item?.message?.amount ?? 0), 0n) + BigInt(deploy?.amount ?? 0);
  const budget = budgeted.reduce((sum, value) => sum + BigInt(value ?? 0), 0n) + BigInt(cushion) * BigInt(prepared.length);
  return sent > budget ? sent - budget : 0n;
}
