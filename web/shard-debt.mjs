// web/shard-debt.mjs — what a publish must carry for the rent a pre-created shard already owes.
//
// THE SQUAT, IN ONE PARAGRAPH. A shard's address is a pure function of PUBLIC preimages (a channel's partition key
// and era, a beacon's bucket, an INTRO (epoch, bucket)) and the account deploys lazily, so a stranger can bring it
// into being years before its era for a few hundred thousand nanotons. The starved account then owes rent, and the
// FIRST honest publish meets that debt in its storage phase: with bounce=true the storage phase runs before the
// credit phase, finds no balance, books the whole arrear as `due_payment`, and the credit phase leaves it alone
// (MEASURED 2026-09-03 in the sandbox: due 19,471,106 after 24 eras, untouched through the transaction; a bare
// 250,000-nanoton squat deploys the account for 2,894 gas and leaves it active and empty, and with a destroy-on-dust
// receiver in place it ran out of gas at 3,749 and STILL left the account — the StateInit applies before compute —
// so no receiver of the shard's can ever clean it). The clean-18 shards read that figure as `myStorageDue()`, DEMAND it on
// top of the price (PublicShard 13712, RecordShard 13660, IntroShard 13688) and reserve it, so the next storage phase
// takes it from money set aside for it and the endowment underneath survives. Which turns the squat into a matter
// of attaching the right amount — this module's whole job.
//
// TWO PARTS, ONE RULE.
//   * A CUSHION rides every publish: one year of the empty shard's rent. The shard keeps only what it needs and
//     returns the change (mode 128 to the publisher; through the vault door the change comes home the same way), so
//     the cushion costs nothing but a moment of wallet balance, and it covers a squat up to a year old with no
//     reading at all.
//   * An ESTIMATE is added when the account is seen to EXIST: the debt its newest transaction left unpaid
//     (`storage_fees_due` of that transaction's storage phase — the arrear a starved account carries forward,
//     which a squatter poking the account monthly would otherwise hide behind a fresh timestamp) plus the empty
//     shard's rent since that transaction (the storage phase stamps `last_paid` on every transaction and charges
//     the interval), minus what the account holds. For a populated, solvent shard that is zero — its endowment
//     covers the interval by the rent ratchets — so the estimate is exactly what a squat older than the cushion
//     costs, and nothing for anyone else. Two reads at most per address (the account state, then its newest
//     transaction), cached ten minutes; none when the account does not exist. A read that fails falls back to the
//     cushion alone — a publish must not start depending on two more requests succeeding, and the cushion is what
//     covers the common squat anyway. The same path is the RETRY path: a publish refused for the debt is itself
//     the account's newest transaction, and its `storage_fees_due` is the exact figure to bring.
//
// THE NUMBERS ARE THE CHAIN'S. Storage is priced by config 18: since 1,777,500,000 a basechain cell costs 135/65536
// nanotons a second and a bit costs nothing (the sandbox ships that entry; SQUAT-05 pins it and the counts below).
// The empty account of each lane is its code plus StateInit data, measured after a refused first publish on the
// sealed-candidate build: PUBLIC 47 cells / 17,125 bits (every kind), INTRO 24 / 10,684, CONV 20 / 8,555. The fee
// formula reproduces the node's: price per second times the interval, shifted down 16 bits and CEILED — three lanes
// measured at a day, a year, 400 days and 240 days all land one above the floor (PUBLIC over a year: 3,053,222,
// where the floor says 3,053,221; the first probe read 3,053,221 because its 1-nanoton poke had paid one nanoton).
// SQUAT-04 holds the formula exact against the chain on every lane.

import { addrKey } from './shard-discovery.mjs?v=58';
import { readAccountStates, toWireAddress } from './shard-reader.mjs?v=61';
import { createShardStatesRequest, createShardLastTransactionReader } from './shard-rpc.mjs?v=40';

export const LANE_PUBLIC = 'public';
export const LANE_CONV = 'conv';
export const LANE_INTRO = 'intro';
export const LANE_REPORT = 'report';   // ReportShard, the moderation queue lane
export const LANE_SANCTION = 'sanction';   // SanctionShard, a wallet's standing — written only through the ledger and the gate

/** Config 18, basechain, the entry in force — `since` is its utime_since; prices are per second in 1/65536 nanotons. */
export const STORAGE_PRICE = Object.freeze({ since: 1_777_500_000, bitPricePs: 0n, cellPricePs: 135n });

/** The storage an EMPTY shard account occupies — code plus StateInit data — per lane. MEASURED (see the header). */
export const EMPTY_SHARD_STORAGE = Object.freeze({
  [LANE_PUBLIC]: Object.freeze({ cells: 68n, bits: 31_262n }),     // MEASURED 2026-09-05 with the reaction counters (React + get_reactions: 60 -> 68 cells); before: 60/25,842 on 2026-09-04 with the moderation door and the hidden index (SQUAT-05, on a shard that has RUN: a squatted one is one cell smaller)
  [LANE_INTRO]: Object.freeze({ cells: 24n, bits: 10_684n }),
  [LANE_CONV]: Object.freeze({ cells: 20n, bits: 8_555n }),
  [LANE_REPORT]: Object.freeze({ cells: 51n, bits: 18_928n }),     // MEASURED after a refused first report, with the review door and the sunk ladder (RS-SQUAT, SQUAT-05)
  [LANE_SANCTION]: Object.freeze({ cells: 28n, bits: 12_631n }),   // MEASURED 2026-09-04 with prune-by-name and, in round three, the unwarn that ends a leaf (SQUAT-05)
});

export const SECONDS_PER_YEAR = 31_536_000;

/** How long a read verdict about an address is reused before it is asked again. */
export const SHARD_DEBT_CACHE_TTL_MS = 600_000;

function laneStorage(lane) {
  const storage = EMPTY_SHARD_STORAGE[lane];
  if (!storage) throw new Error(`shard-debt: unknown lane "${lane}" (expected "public", "conv", "intro" or "report")`);
  return storage;
}

/**
 * The node's storage fee for `seconds` of holding {cells, bits} at `price`: (cells·cell + bits·bit)·seconds / 2^16,
 * rounded UP (MEASURED: every lane, every span, one above the floor). Negative or non-finite intervals count as zero.
 */
export function storageFeeNanotons({ cells, bits }, seconds, price = STORAGE_PRICE) {
  const span = Number(seconds);
  const delta = Number.isFinite(span) && span > 0 ? BigInt(Math.floor(span)) : 0n;
  return ((BigInt(cells) * price.cellPricePs + BigInt(bits) * price.bitPricePs) * delta + 65_535n) >> 16n;
}

/** One year of an empty shard's rent on the given lane — the cushion every publish carries. */
export function emptyShardRentPerYear(lane) {
  return storageFeeNanotons(laneStorage(lane), SECONDS_PER_YEAR);
}

export function squatCushionNanotons(lane) {
  return emptyShardRentPerYear(lane);
}

/**
 * What an EXISTING account owes at `nowUnix`: the debt its newest transaction carried forward (`dueCarried`, that
 * transaction's `storage_fees_due`) plus the empty shard's rent since it, less the balance it holds. Zero for a
 * solvent shard. `lastTransactionUnix` is the `now` of the account's newest transaction — the storage phase
 * stamped `last_paid` with it.
 */
export function estimateShardDebt({ lane, lastTransactionUnix, nowUnix, balance = 0n, dueCarried = 0n }) {
  const owed = BigInt(dueCarried ?? 0n)
    + storageFeeNanotons(laneStorage(lane), Number(nowUnix) - Number(lastTransactionUnix)) - BigInt(balance ?? 0n);
  return owed > 0n ? owed : 0n;
}

/**
 * A resolver: `(shardAddress, lane, nowUnix) -> { cushion, debt, status }`. `readStates(address)` resolves to the
 * account's state row ({ status, balance }) or null when the account does not exist; `readLastTransaction(address)`
 * resolves to `{ now, storageFeesDue }` of its newest transaction or null. The second read happens only for an
 * account that has code to pay rent on ('active' — or 'frozen', where the formula over-estimates from the
 * pre-freeze size and the shard refunds the difference). Verdicts are cached per address for `cacheTtlMs`.
 */
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
      cache.set(key, seen);
    }
    const cushion = squatCushionNanotons(lane);
    const debt = seen.lastTransactionUnix === null
      ? 0n
      : estimateShardDebt({ lane, lastTransactionUnix: seen.lastTransactionUnix, nowUnix, balance: seen.balance, dueCarried: seen.dueCarried });
    return { cushion, debt, status: seen.status };
  };
}

let defaultResolver = null;

/** The app's resolver: one accountStates read, then one transactions read, both through the shared pump. */
export function defaultShardDebtResolver() {
  if (!defaultResolver) {
    const request = createShardStatesRequest({ strict: true, requestOptions: { skipIfRateLimited: false } });
    const readLastTransaction = createShardLastTransactionReader();
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

/**
 * Raise every prepared wallet message by its shard's surcharge, in place. `prepared` items are what the lane
 * builders return: `message.amount` is what the wallet sends, `to` the destination and — for a message routed
 * through the vault — `shard` the shard the vault forwards to, which is the account whose debt matters. Each shard
 * is resolved once. Returns `{ prepared, cushion, debtTotal }`, each item carrying `surcharge: { cushion, debt }`;
 * the funnel folds `debtTotal` into what it asks its caller to afford (surchargeExtraNanotons).
 */
export async function applyShardSurcharge(lane, prepared, { resolver = null, nowUnix = null } = {}) {
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
        // FAIL-OPEN TO THE CUSHION. The cushion alone covers a squat up to a year old, and a publish must not start
        // failing because a background read did — the chain is the authority; a too-old squat is refused there
        // and the next attempt, with the read back, pays it.
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

/**
 * What a funnel must ask its caller to afford ABOVE the budget the caller already holds — `part.value + cushion`
 * per part: the vault door's overhead on a routed message (its take, the second hop's carriage, the vault's own
 * reserves), a squat debt above the cushion, and a vault deploy riding the same transfer. Zero on the plain direct
 * path. The wallet stamps SendIgnoreErrors on every action, so a wallet short by this much would not fail — it
 * would drop the LAST message of the transfer silently; the caller asserts the sum before anything is signed.
 */
export function surchargeExtraNanotons({ prepared, budgeted, cushion, deploy = null }) {
  const sent = prepared.reduce((sum, item) => sum + BigInt(item?.message?.amount ?? 0), 0n) + BigInt(deploy?.amount ?? 0);
  const budget = budgeted.reduce((sum, value) => sum + BigInt(value ?? 0), 0n) + BigInt(cushion) * BigInt(prepared.length);
  return sent > budget ? sent - budget : 0n;
}
