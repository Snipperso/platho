
import { addrKey } from './shard-discovery.mjs?v=104';

export const ACCOUNT_STATES_MAX_PER_CALL = 1024;

export const ACCOUNT_STATES_URL_MAX = 65_553;
export const ACCOUNT_STATES_URL_RESERVE = 1_024;
export const ACCOUNT_STATES_URL_BUDGET = ACCOUNT_STATES_URL_MAX - ACCOUNT_STATES_URL_RESERVE;

export function accountStatesAddressCost(wire) {
  return 'address='.length + encodeURIComponent(String(wire)).length + 1;
}

export function chunkAddresses(addresses, size = ACCOUNT_STATES_MAX_PER_CALL, maxBytes = ACCOUNT_STATES_URL_BUDGET) {
  if (!Number.isInteger(size) || size < 1) throw new Error(`chunk size must be a positive integer, got ${size}`);
  const out = [];
  let group = [];
  let bytes = 0;
  for (const address of addresses) {
    const cost = accountStatesAddressCost(toWireAddress(address));
    if (group.length > 0 && (group.length >= size || bytes + cost > maxBytes)) {
      out.push(group);
      group = [];
      bytes = 0;
    }
    group.push(address);
    bytes += cost;
  }
  if (group.length > 0) out.push(group);
  return out;
}

export function toWireAddress(address) {
  if (typeof address === 'string') return address;
  return address.toString({ urlSafe: true, bounceable: true });
}

const refusedWire = new Set();
let unnamedRefusalReported = false;

export function isDeadlineDetail(detail) {
  return /deadline exceeded|timed? ?out/i.test(String(detail ?? ''));
}
export const STATES_BATCH_FLOOR = 32;
export const STATES_BATCH_RECOVERY_AFTER = 16;
let statesBatchCeiling = ACCOUNT_STATES_MAX_PER_CALL;
let statesBatchCleanRun = 0;
let deadlineReported = false;
export function currentStatesBatchCeiling() { return statesBatchCeiling; }
function noteBatchTimedOut(size) {
  if (size <= STATES_BATCH_FLOOR) return;
  const next = Math.max(STATES_BATCH_FLOOR, Math.min(statesBatchCeiling, Math.floor(size / 2)));
  statesBatchCleanRun = 0;
  if (next === statesBatchCeiling) return;
  statesBatchCeiling = next;
  publishCeiling();
}
function noteBatchAnswered() {
  if (statesBatchCeiling >= ACCOUNT_STATES_MAX_PER_CALL) return;
  statesBatchCleanRun += 1;
  if (statesBatchCleanRun >= STATES_BATCH_RECOVERY_AFTER) {
    statesBatchCeiling = Math.min(ACCOUNT_STATES_MAX_PER_CALL, statesBatchCeiling * 2);
    statesBatchCleanRun = 0;
    publishCeiling();
  }
}
export function __statesBatchCeilingForTests() { return statesBatchCeiling; }

const ceilingListeners = new Set();
function publishCeiling() {
  for (const listener of ceilingListeners) {
    try { listener(statesBatchCeiling); } catch { }
  }
}
export function seedStatesBatchCeiling(value) {
  if (value === null || value === undefined || value === '') return statesBatchCeiling;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return statesBatchCeiling;
  statesBatchCeiling = Math.max(STATES_BATCH_FLOOR, Math.min(ACCOUNT_STATES_MAX_PER_CALL, Math.floor(n)));
  statesBatchCleanRun = 0;
  return statesBatchCeiling;
}
export function subscribeStatesBatchCeiling(listener) {
  if (typeof listener !== 'function') return () => {};
  ceilingListeners.add(listener);
  return () => ceilingListeners.delete(listener);
}

export function __resetRefusedAddressesForTests() {
  refusedWire.clear();
  unnamedRefusalReported = false;
  statesBatchCeiling = ACCOUNT_STATES_MAX_PER_CALL;
  statesBatchCleanRun = 0;
  deadlineReported = false;
  ceilingListeners.clear();
}

const refusedRow = (wire) => ({ address: wire, status: 'unknown', reason: 'refused', balance: 0n, dataHash: null, codeHash: null, lastLt: null, dataBoc: null, refused: true });
const unansweredRow = (wire) => ({ address: wire, status: 'unknown', reason: 'unanswered', balance: 0n, dataHash: null, codeHash: null, lastLt: null, dataBoc: null, refused: false, unanswered: true });
const deferredRow = (wire) => ({ ...unansweredRow(wire), reason: 'deferred', deferred: true });

export const isUnknownAccountState = (state) => state?.status === 'unknown';

export function unprocessableBodyMayNameAddress(bodyText) {
  const raw = String(bodyText ?? '').trim();
  if (!raw) return true;
  let json;
  try { json = JSON.parse(raw); } catch { return true; }
  const details = Array.isArray(json?.detail)
    ? json.detail
    : (json?.detail && typeof json.detail === 'object' ? [json.detail] : []);
  if (details.length === 0) return true;
  return details.some((item) =>
    (Array.isArray(item?.loc) && item.loc.some((part) => String(part).toLowerCase() === 'address'))
    || typeof item?.input === 'string');
}

export function refusedIndexFromBody(bodyText, wireAddresses = []) {
  const raw = String(bodyText ?? '').trim();
  if (!raw) return -1;
  let json;
  try { json = JSON.parse(raw); } catch { return -1; }
  const details = Array.isArray(json?.detail)
    ? json.detail
    : (json?.detail && typeof json.detail === 'object' ? [json.detail] : []);
  for (const item of details) {
    const loc = Array.isArray(item?.loc) ? item.loc : null;
    let index = -1;
    if (loc) {
      const at = loc.findIndex((part) => String(part).toLowerCase() === 'address');
      const next = at >= 0 ? loc[at + 1] : undefined;
      if (Number.isInteger(next) && next >= 0 && next < wireAddresses.length) index = next;
      else if (typeof next === 'string' && /^\d+$/.test(next) && Number(next) < wireAddresses.length) index = Number(next);
    }
    const input = typeof item?.input === 'string' ? item.input : null;
    if (input !== null) {
      const byInput = wireAddresses.indexOf(input);
      if (index < 0) index = byInput;
      else if (byInput >= 0 && byInput !== index) index = -1;
    }
    if (index >= 0) return index;
  }
  return -1;
}

export function refusedIndexFromDetail(detail) {
  const m = /index (\d+) of \\?"address\\?"/.exec(String(detail ?? ''));
  return m ? Number(m[1]) : -1;
}

export async function readAccountStates(addresses, { request, includeBoc = false, chunkSize, deferOnTransient = false } = {}) {
  if (typeof request !== 'function') throw new Error('readAccountStates requires a `request` function');
  const out = new Map();
  const noteRefused = (wire, detail) => {
    if (!refusedWire.has(wire)) console.error('[states] the endpoint refused one address — left UNKNOWN, not absent:', wire, detail ?? '');
    refusedWire.add(wire);
    out.set(addrKey(wire), refusedRow(wire));
  };
  const readGroup = async (group) => {
    const wire = [];
    for (const address of group) {
      const w = toWireAddress(address);
      if (refusedWire.has(w)) out.set(addrKey(w), refusedRow(w));
      else wire.push(w);
    }
    if (wire.length === 0) return;
    const qs = wire.map((a) => `address=${encodeURIComponent(a)}`).join('&');
    const path = `/accountStates?${qs}&include_boc=${includeBoc ? 'true' : 'false'}`;
    let body;
    try {
      body = await request({ path, addresses: wire, includeBoc });
    } catch (error) {
      if (error?.status === 414 && wire.length > 1) {
        console.error(`[shard-reader] HTTP 414 on ${wire.length} addresses — the request URL exceeded the endpoint `
          + 'limit; splitting. This means the byte budget is stale or a caller passed a longer address form.');
        noteBatchTimedOut(wire.length);
        const half = Math.max(1, Math.floor(wire.length / 2));
        await readGroup(wire.slice(0, half));
        await readGroup(wire.slice(half));
        return;
      }
      if (error?.status === 422) {
        const bodyText = error?.responseText ?? error?.detail ?? '';
        const namedIndex = refusedIndexFromDetail(error?.detail);
        const index = namedIndex >= 0 ? namedIndex : refusedIndexFromBody(bodyText, wire);
        if (index >= 0 && index < wire.length) {
          noteRefused(wire[index], error?.detail);
          if (wire.length > 1) await readGroup([...wire.slice(0, index), ...wire.slice(index + 1)]);
          return;
        }
        if (isDeadlineDetail(error?.detail) || isDeadlineDetail(bodyText)) {
          noteBatchTimedOut(wire.length);
          if (!deadlineReported) {
            deadlineReported = true;
            console.warn(`[states] the endpoint ran out of time on a batch of ${wire.length} addresses — splitting it and asking in smaller batches from now on; it said:`, error?.detail ?? '');
          }
          if (wire.length > STATES_BATCH_FLOOR) {
            const half = Math.ceil(wire.length / 2);
            for (let off = 0; off < wire.length;) {
              const part = wire.slice(off, off + Math.max(1, Math.min(half, statesBatchCeiling)));
              off += part.length;
              await readGroup(part);
            }
            return;
          }
          for (const w of wire) out.set(addrKey(w), unansweredRow(w));
          return;
        }
        if (!unprocessableBodyMayNameAddress(bodyText)) throw error;
        if (wire.length > 1) {
          if (!unnamedRefusalReported) {
            unnamedRefusalReported = true;
            console.error(`[states] HTTP 422 on a batch of ${wire.length} addresses and the body names no position — splitting it; the endpoint said:`, error?.detail ?? '(empty body)');
          }
          const mid = Math.ceil(wire.length / 2);
          await readGroup(wire.slice(0, mid));
          await readGroup(wire.slice(mid));
          return;
        }
        noteRefused(wire[0], error?.detail);
        return;
      }
      if (deferOnTransient) {
        for (const w of wire) out.set(addrKey(w), deferredRow(w));
        return;
      }
      throw error;
    }
    noteBatchAnswered();
    for (const account of body?.accounts ?? []) {
      if (!account?.address) continue;
      out.set(addrKey(account.address), {
        address: account.address,
        status: account.status,
        balance: BigInt(account.balance ?? 0),
        dataHash: account.data_hash ?? null,
        codeHash: account.code_hash ?? null,
        lastLt: account.last_transaction_lt ?? null,
        dataBoc: account.data_boc ?? null,
      });
    }
  };
  for (const group of chunkAddresses(addresses, Math.min(chunkSize ?? ACCOUNT_STATES_MAX_PER_CALL, statesBatchCeiling))) await readGroup(group);
  return out;
}

export function changedSince(states, seen = new Map()) {
  const changed = [];
  for (const [key, state] of states) {
    if (isUnknownAccountState(state)) { changed.push({ key, state }); continue; }
    const previous = seen.get(key);
    if (previous === undefined || previous === null) { changed.push({ key, state }); continue; }
    if (String(state.lastLt ?? state.dataHash) !== String(previous)) changed.push({ key, state });
  }
  return changed;
}

export const changeMarkerOf = (state) => (isUnknownAccountState(state) ? null : String(state.lastLt ?? state.dataHash));

export const isActiveAccountState = (state) => state?.status === 'active';

export async function probeActiveAddresses(addresses, readStates) {
  if (typeof readStates !== 'function') return null;
  if (!Array.isArray(addresses) || addresses.length === 0) return new Set();
  let states;
  try {
    states = await readStates(addresses);
  } catch {
    return null;
  }
  if (!(states instanceof Map)) return null;
  const active = new Set();
  for (const [key, state] of states) {
    if (state?.status === 'unknown') { active.add(key); continue; }
    if (isActiveAccountState(state)) active.add(key);
  }
  return active;
}
