
import { beginCell, bytesToBase64, computeCellHashAndDepth, parseBocBase64, serializeBoc, tonCell } from './pwa-contract-transactions.mjs?v=59';
import { STORAGE_PRICE, storageFeeNanotons } from './shard-debt.mjs?v=83';

export const ACCOUNT_ACTIVE = 'active';
export const ACCOUNT_FROZEN = 'frozen';
export const ACCOUNT_UNINIT = 'uninit';
export const ACCOUNT_NONEXIST = 'nonexist';
export const ACCOUNT_UNKNOWN = 'unknown';

export function accountStatusOf(value) {
  const status = String(value ?? '').trim().toLowerCase();
  if (status === 'active') return ACCOUNT_ACTIVE;
  if (status === 'frozen') return ACCOUNT_FROZEN;
  if (status === 'uninit' || status === 'uninitialized' || status === 'uninitialised') return ACCOUNT_UNINIT;
  if (status === 'nonexist' || status === 'nonexistent' || status === 'none') return ACCOUNT_NONEXIST;
  return ACCOUNT_UNKNOWN;
}

export function hashHex(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value >= 0n && value < (1n << 256n) ? value.toString(16).padStart(64, '0') : null;
  const text = String(value).trim();
  if (/^(0x)?[0-9a-f]{64}$/i.test(text)) return text.replace(/^0x/i, '').toLowerCase();
  try {
    const bytes = tonCell.base64ToBytes(text.replace(/-/g, '+').replace(/_/g, '/'));
    return bytes.length === 32 ? tonCell.bytesToHex(bytes).toLowerCase() : null;
  } catch {
    return null;
  }
}

export function accountStateRow(body) {
  const row = body?.result ?? body ?? {};
  let balance = 0n;
  try { balance = BigInt(row.balance ?? 0); } catch { balance = 0n; }
  return {
    status: accountStatusOf(row.status ?? row.state ?? row.account_status),
    frozenHash: hashHex(row.frozen_hash ?? row.frozenHash ?? null),
    balance: balance > 0n ? balance : 0n,
    code: typeof row.code === 'string' && row.code.length > 0 ? row.code : null,
    data: typeof row.data === 'string' && row.data.length > 0 ? row.data : null,
    lastLt: row.last_transaction_lt ?? row.last_transaction_id?.lt ?? null,
  };
}

export function stateInitCellFromBocs(codeBoc, dataBoc) {
  const state = beginCell();
  state.uint(0, 1, 'split_depth');
  state.uint(0, 1, 'special');
  state.uint(1, 1, 'code present');
  state.uint(1, 1, 'data present');
  state.uint(0, 1, 'library');
  state.ref(parseBocBase64(codeBoc), 'code');
  state.ref(parseBocBase64(dataBoc), 'data');
  return state.endCell();
}

export async function stateInitHashHex(codeBoc, dataBoc) {
  const { hash } = await computeCellHashAndDepth(stateInitCellFromBocs(codeBoc, dataBoc));
  return tonCell.bytesToHex(hash).toLowerCase();
}

export const cellToBoc = (cell) => bytesToBase64(serializeBoc(cell));

export function freezingTransaction(transactions) {
  for (const tx of Array.isArray(transactions) ? transactions : []) {
    if (accountStatusOf(tx?.orig_status) === ACCOUNT_ACTIVE && accountStatusOf(tx?.end_status) === ACCOUNT_FROZEN) return tx;
  }
  return null;
}

export async function matchFrozenState(frozenHash, candidates) {
  const want = hashHex(frozenHash);
  if (!want) return null;
  for (const candidate of candidates ?? []) {
    if (!candidate?.codeBoc || !candidate?.dataBoc) continue;
    try {
      if (await stateInitHashHex(candidate.codeBoc, candidate.dataBoc) === want) return candidate;
    } catch { }
  }
  return null;
}

export const ARCHIVE_PAGE_SIZE = 64;
export const ARCHIVE_MAX_PAGES = 8;
export const ARCHIVE_BISECT_MAX_PROBES = 40;
export const ARCHIVE_NEAR_OFFSETS = Object.freeze([-2, 0]);

function frozenWith(state, want) {
  return state?.status === ACCOUNT_FROZEN && (!state.frozenHash || state.frozenHash === want);
}

function archiveReads(address, readStateAt) {
  const states = new Map();
  const read = async (seqno) => {
    if (!states.has(seqno)) states.set(seqno, await readStateAt(address, seqno));
    return states.get(seqno);
  };
  const cellsOf = (state) => (state?.status === ACCOUNT_ACTIVE && state.code && state.data ? { codeBoc: state.code, dataBoc: state.data } : null);
  return {
    read,
    async match(seqno, want) {
      const cells = cellsOf(await read(seqno));
      return cells && (await matchFrozenState(want, [cells])) ? cells : null;
    },
    async anyMatch(want) {
      for (const [seqno, state] of states) {
        const cells = cellsOf(state);
        // eslint-disable-next-line no-await-in-loop
        if (cells && (await matchFrozenState(want, [cells]))) return { cells, seqno };
      }
      return null;
    },
    refusal: () => ([...states.values()].some((state) => cellsOf(state)) ? 'hash-mismatch' : 'no-state-before'),
  };
}

async function newestFrozenHash(reads, newest) {
  if (!newest) return null;
  const latest = await newest();
  if (!Number.isInteger(latest) || latest <= 0) return null;
  const state = await reads.read(latest);
  return state?.status === ACCOUNT_FROZEN ? hashHex(state.frozenHash) : null;
}

export async function preFreezeStateFromArchive({ address, frozenHash, listTransactions, readStateAt,
  pageSize = ARCHIVE_PAGE_SIZE, maxPages = ARCHIVE_MAX_PAGES, readLatestSeqno = null, maxProbes = ARCHIVE_BISECT_MAX_PROBES }) {
  if (typeof listTransactions !== 'function' || typeof readStateAt !== 'function') throw new Error('preFreezeStateFromArchive needs both readers');
  let freezing = null;
  for (let page = 0; page < maxPages && !freezing; page += 1) {
    const transactions = await listTransactions(address, { limit: pageSize, offset: page * pageSize });
    freezing = freezingTransaction(transactions);
    if (!freezing && (!Array.isArray(transactions) || transactions.length < pageSize)) break;
  }
  const reads = archiveReads(address, readStateAt);
  let latest = null;
  const newest = typeof readLatestSeqno === 'function' ? async () => { latest ??= Number(await readLatestSeqno()); return latest; } : null;
  const want = hashHex(frozenHash) ?? hashHex(freezing?.account_state_after?.frozen_hash ?? null) ?? await newestFrozenHash(reads, newest);
  if (!freezing && newest) return preFreezeStateBisected({ address, want, listTransactions, reads, newest, maxProbes });
  if (!freezing) return { found: null, reason: 'no-freezing-transaction' };
  if (!want) return { found: null, reason: 'no-frozen-hash' };
  const block = Number(freezing.mc_block_seqno);
  if (!Number.isInteger(block) || block <= 1) return { found: null, reason: 'no-block' };
  for (const seqno of [block - 1, ...ARCHIVE_NEAR_OFFSETS.map((offset) => block + offset)]) {
    if (seqno <= 0) continue;
    // eslint-disable-next-line no-await-in-loop
    const cells = await reads.match(seqno, want);
    if (cells) return { found: { ...cells, via: 'archive', freezingLt: String(freezing.lt ?? ''), seqno }, reason: null };
  }
  if (newest) {
    const deep = await preFreezeStateBisected({ address, want, listTransactions, reads, newest, maxProbes });
    if (deep.found || deep.reason === 'no-block') return deep;
  }
  return { found: null, reason: reads.refusal() };
}

async function preFreezeStateBisected({ address, want, listTransactions, reads, newest, maxProbes }) {
  if (!want) return { found: null, reason: 'no-frozen-hash' };
  const first = (await listTransactions(address, { limit: 1, offset: 0, sort: 'asc' }))?.[0] ?? null;
  let lo = Number(first?.mc_block_seqno);
  let hi = await newest();
  if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi <= lo) return { found: null, reason: 'no-block' };
  for (let probe = 0; hi - lo > 1 && probe < maxProbes; probe += 1) {
    const mid = Math.floor((lo + hi) / 2);
    // eslint-disable-next-line no-await-in-loop
    if (frozenWith(await reads.read(mid), want)) hi = mid; else lo = mid;
  }
  const cells = await reads.match(lo, want);
  if (cells) return { found: { ...cells, via: 'bisect', freezingLt: '', seqno: lo }, reason: null };
  const any = await reads.anyMatch(want);
  if (any) return { found: { ...any.cells, via: 'bisect', freezingLt: '', seqno: any.seqno }, reason: null };
  return { found: null, reason: reads.refusal() };
}

export const FROZEN_ACCOUNT_STORAGE = Object.freeze({ cells: 1n, bits: 327n });

export const UNFREEZE_LANDING_SECONDS = 3_600;

export function frozenAccountDebtNanotons({ dueCarried = 0n, lastTransactionAt, nowSec, price = STORAGE_PRICE }) {
  if (lastTransactionAt === null || lastTransactionAt === undefined || !Number.isFinite(Number(lastTransactionAt))) return null;
  const since = Math.max(0, Math.floor(Number(nowSec)) - Math.floor(Number(lastTransactionAt))) + UNFREEZE_LANDING_SECONDS;
  return BigInt(dueCarried ?? 0n) + storageFeeNanotons(FROZEN_ACCOUNT_STORAGE, since, price);
}

export function buildUnfreezeMessage({ address, codeBoc, dataBoc, amount, payload = null }) {
  const value = BigInt(amount);
  if (value <= 0n) throw new RangeError('an unfreeze must carry the debt');
  return { address, amount: value, payload, stateInit: stateInitCellFromBocs(codeBoc, dataBoc), bounce: false };
}
