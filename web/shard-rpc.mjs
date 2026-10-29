
import { scheduleToncenterHttpRequest, deriveToncenterV2Endpoint, deriveToncenterV3Endpoint, toncenterScanLaneOptions } from './ton-rpc-transport.mjs?v=111';
import { parseBocBase64 } from './pwa-contract-transactions.mjs?v=59';

const SCAN_REQUEST_OPTIONS = Object.freeze({
  priority: 'background',
  skipIfRateLimited: true,
});

function scanRequestOptions(overrides = null) {
  const lane = toncenterScanLaneOptions();
  return overrides
    ? { ...SCAN_REQUEST_OPTIONS, ...lane, ...overrides }
    : { ...SCAN_REQUEST_OPTIONS, ...lane };
}

function resolveEndpoint(leaf, explicit) {
  const base = explicit
    ?? globalThis.plathoTonRpcEndpoint
    ?? globalThis.plathoTonRpcConfig?.endpoint
    ?? globalThis.PLATHO_TON_RPC_ENDPOINT
    ?? null;
  if (!base) throw new Error(`shard-rpc: no TON RPC endpoint configured, cannot derive /${leaf}`);
  return deriveToncenterV3Endpoint(base, leaf);
}

const resolveApiKey = (explicit) => explicit ?? globalThis.plathoToncenterApiKey ?? globalThis.plathoTonRpcApiKey ?? null;

const ACCOUNT_STATES_ERROR_TEXT_MAX = 4096;

export function createToncenterRestFetch({ endpoint, apiKey, fetch: fetchImpl, requestOptions = null } = {}) {
  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') throw new Error('shard-rpc: fetch is unavailable');
  return async (url, init = {}) => {
    const base = resolveEndpoint('accountStates', endpoint);
    const key = resolveApiKey(apiKey);
    const headers = { Accept: 'application/json', ...(init.headers ?? {}) };
    if (key) headers['X-API-Key'] = key;
    let label = 'rest';
    try { label = new URL(String(url)).pathname.replace(/^\/api\//, ''); } catch { }
    const response = await scheduleToncenterHttpRequest(
      base, key, (signal) => doFetch(String(url), { ...init, headers, signal, cache: 'no-store' }), { ...scanRequestOptions(requestOptions), label });
    if (!response) {
      const error = new Error('toncenter REST: the request did not run (rate-limited or dropped)');
      error.status = 429;
      throw error;
    }
    return response;
  };
}

export function toncenterRestOrigin(endpoint = null) {
  try {
    return new URL(resolveEndpoint('accountStates', endpoint)).origin;
  } catch {
    return 'https://toncenter.com';
  }
}

export function createShardStatesRequest({ endpoint, apiKey, fetch: fetchImpl, requestOptions = null, strict = false } = {}) {
  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') throw new Error('shard-rpc: fetch is unavailable');
  return async ({ path }) => {
    const options = scanRequestOptions(requestOptions);
    const base = resolveEndpoint('accountStates', endpoint);
    const key = resolveApiKey(apiKey);
    const url = new URL(base);
    url.pathname = url.pathname.replace(/\/accountStates$/, '') + path.split('?')[0];
    url.search = path.includes('?') ? path.slice(path.indexOf('?')) : '';
    const headers = { Accept: 'application/json' };
    if (key) headers['X-API-Key'] = key;
    const response = await scheduleToncenterHttpRequest(
      base, key, (signal) => doFetch(url.toString(), { method: 'GET', headers, signal, cache: 'no-store' }), options);
    if (!response) {
      if (strict) throw new Error('accountStates: the request did not run (rate-limited or dropped) — absence is not proven');
      return { accounts: [] };
    }
    if (!response.ok) {
      let text = '';
      try { text = typeof response.text === 'function' ? String(await response.text()).slice(0, ACCOUNT_STATES_ERROR_TEXT_MAX) : ''; } catch { text = ''; }
      const detail = text.slice(0, 300);
      const error = new Error(`accountStates failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
      error.status = response.status;
      error.detail = detail;
      error.responseText = text;
      if (response.status === 429) error.code = 'RATE_LIMITED';
      throw error;
    }
    return response.json();
  };
}


const opcodeBits = (opcode) => BigInt.asUintN(32, BigInt(opcode));

const opcodeParam = (opcode) => `0x${opcodeBits(opcode).toString(16).padStart(8, '0')}`;

function normaliseOpcodes(opcode) {
  if (opcode === null || opcode === undefined) return [];
  const list = Array.isArray(opcode) ? opcode : [opcode];
  const seen = new Set();
  const out = [];
  for (const one of list) {
    if (one === null || one === undefined) continue;
    const bits = opcodeBits(one);
    if (seen.has(bits)) continue;
    seen.add(bits);
    out.push(bits);
  }
  return out;
}

function rowIsForeign(row, opcode) {
  const wanted = normaliseOpcodes(opcode);
  if (wanted.length === 0) return false;
  const raw = row?.opcode;
  if (raw === null || raw === undefined || raw === '') return false;
  try {
    const bits = opcodeBits(raw);
    return !wanted.some((one) => one === bits);
  } catch { return false; }
}

async function readOneOpcodeRows({ base, key, doFetch, address, limit, opcode, maxPages, strict = false, endLt = null, startUtime = null, endUtime = null, requestOptions = null }) {
  const headers = { Accept: 'application/json' };
  if (key) headers['X-API-Key'] = key;
  const rows = [];
  let serverFiltered = true;
  let offset = 0;
  let pages = 0;
  let previousPageMark = null;
  const bound = endLt === null || endLt === undefined ? null : BigInt(endLt);
  const fromUtime = Number.isFinite(Number(startUtime)) && startUtime !== null ? Math.floor(Number(startUtime)) : null;
  const toUtime = Number.isFinite(Number(endUtime)) && endUtime !== null ? Math.floor(Number(endUtime)) : null;

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(base);
    url.searchParams.set('destination', String(address));
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('sort', 'desc');
    if (opcode !== null && opcode !== undefined) url.searchParams.set('opcode', opcodeParam(opcode));
    if (bound !== null) url.searchParams.set('end_lt', String(bound));
    if (fromUtime !== null) url.searchParams.set('start_utime', String(fromUtime));
    if (toUtime !== null) url.searchParams.set('end_utime', String(toUtime));
    if (offset > 0) url.searchParams.set('offset', String(offset));

    const response = await scheduleToncenterHttpRequest(
      base, key, (signal) => doFetch(url.toString(), { method: 'GET', headers, signal, cache: 'no-store' }), scanRequestOptions(requestOptions));
    if (!response) {
      if (strict) throw new Error(`messages: the request for ${address} did not run (rate-limited or dropped)`);
      break;
    }
    if (!response.ok) throw new Error(`messages failed with HTTP ${response.status}`);
    const body = await response.json();
    const pageRows = body?.messages ?? [];
    pages += 1;
    if (pageRows.length === 0) break;

    const pageMark = pageRows.map((row) => row?.hash ?? row?.message_content?.body ?? '').join('|');
    if (offset > 0 && pageMark === previousPageMark) break;
    previousPageMark = pageMark;

    const atOf = (row) => {
      const raw = row?.created_at;
      if (raw === null || raw === undefined || raw === '') return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };
    const inBound = pageRows.filter((row) => {
      if (bound !== null) {
        try { if (row?.created_lt != null && BigInt(row.created_lt) > bound) return false; } catch { return false; }
      }
      const at = atOf(row);
      if (at === null) return true;
      if (fromUtime !== null && at < fromUtime) return false;
      if (toUtime !== null && at > toUtime) return false;
      return true;
    });
    const wanted = (opcode === null || opcode === undefined)
      ? inBound
      : inBound.filter((row) => !rowIsForeign(row, opcode));
    if (wanted.length !== pageRows.length) serverFiltered = false;
    rows.push(...wanted);

    if (rows.length >= limit) { rows.length = limit; break; }
    if (pageRows.length < limit) break;
    if (serverFiltered) break;
    offset += pageRows.length;
  }
  return { rows, serverFiltered, pages };
}

export function createShardMessagesReader({ endpoint, apiKey, fetch: fetchImpl, limit = 64, opcode = null, maxPages = 8 } = {}) {
  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') throw new Error('shard-rpc: fetch is unavailable');
  return async (address) => {
    const base = resolveEndpoint('messages', endpoint);
    const key = resolveApiKey(apiKey);
    const { rows } = await readMessageRows({ base, key, doFetch, address, limit, opcode, maxPages });
    const cells = [];
    for (const message of rows) {
      const raw = message?.message_content?.body;
      if (!raw) continue;
      try { cells.push(parseBocBase64(raw)); } catch { }
    }
    return cells;
  };
}

async function readMessageRows({ opcode, limit, ...rest } = {}) {
  const wanted = normaliseOpcodes(opcode);
  if (wanted.length <= 1) {
    return readOneOpcodeRows({ ...rest, limit, opcode: wanted.length === 1 ? wanted[0] : null });
  }
  const reads = [];
  for (const one of wanted) reads.push(await readOneOpcodeRows({ ...rest, limit, opcode: one }));
  const seen = new Set();
  const merged = [];
  for (const read of reads) {
    for (const row of read.rows ?? []) {
      const id = row?.hash ?? `${row?.created_lt ?? ''}:${row?.source ?? ''}:${row?.message_content?.body ?? ''}`;
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(row);
    }
  }
  merged.sort((a, b) => {
    const x = BigInt(a?.created_lt ?? 0);
    const y = BigInt(b?.created_lt ?? 0);
    return x === y ? 0 : (x > y ? -1 : 1);
  });
  return {
    rows: merged.slice(0, limit),
    serverFiltered: reads.every((r) => r.serverFiltered !== false),
    pages: reads.reduce((sum, r) => sum + (r.pages ?? 0), 0),
  };
}

export function createShardMessagesWithSourceReader({ endpoint, apiKey, fetch: fetchImpl, limit = 128, opcode = null, maxPages = 8, strict = false, requestOptions = null } = {}) {
  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') throw new Error('shard-rpc: fetch is unavailable');
  return async (address, { endLt = null, startUtime = null, endUtime = null, opcode: perCall = undefined } = {}) => {
    const base = resolveEndpoint('messages', endpoint);
    const key = resolveApiKey(apiKey);
    const narrowed = normaliseOpcodes(perCall === undefined ? null : perCall);
    const wanted = narrowed.length > 0 ? narrowed : opcode;
    const { rows } = await readMessageRows({ base, key, doFetch, address, limit, opcode: wanted, maxPages, strict, endLt, startUtime, endUtime, requestOptions });
    const out = [];
    for (const message of rows) {
      const raw = message?.message_content?.body;
      if (!raw) continue;
      let bodyCell;
      try { bodyCell = parseBocBase64(raw); } catch { continue; }
      const createdLt = message?.created_lt == null ? null : String(message.created_lt);
      out.push({ bodyCell, source: message?.source ?? null, createdLt, lt: createdLt, createdAt: message?.created_at ?? null });
    }
    let rawOldestLt = null;
    for (const message of rows) {
      try { if (message?.created_lt != null && (rawOldestLt === null || BigInt(message.created_lt) < rawOldestLt)) rawOldestLt = BigInt(message.created_lt); } catch { }
    }
    Object.defineProperty(out, 'rawCount', { value: rows.length });
    Object.defineProperty(out, 'rawOldestLt', { value: rawOldestLt === null ? null : String(rawOldestLt) });
    return out;
  };
}

export function createShardLastTransactionReader({ endpoint, apiKey, fetch: fetchImpl, requestOptions = null, strict = true } = {}) {
  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') throw new Error('shard-rpc: fetch is unavailable');
  return async (address) => {
    const base = resolveEndpoint('transactions', endpoint);
    const key = resolveApiKey(apiKey);
    const url = new URL(base);
    url.searchParams.set('account', String(address));
    url.searchParams.set('limit', '1');
    url.searchParams.set('sort', 'desc');
    const headers = { Accept: 'application/json' };
    if (key) headers['X-API-Key'] = key;
    const options = scanRequestOptions(requestOptions ?? { skipIfRateLimited: false });
    const response = await scheduleToncenterHttpRequest(
      base, key, (signal) => doFetch(url.toString(), { method: 'GET', headers, signal, cache: 'no-store' }), options);
    if (!response) {
      if (strict) throw new Error('transactions: the request did not run (rate-limited or dropped) — the account age is unknown');
      return null;
    }
    if (!response.ok) throw new Error(`transactions failed with HTTP ${response.status}`);
    const body = await response.json();
    const row = Array.isArray(body?.transactions) ? body.transactions[0] : null;
    if (!row) return null;
    const now = Number(row.now ?? row.utime);
    if (!Number.isFinite(now) || now <= 0) return null;
    let storageFeesDue = 0n;
    try { storageFeesDue = BigInt(row.description?.storage_ph?.storage_fees_due ?? 0); } catch { storageFeesDue = 0n; }
    return { now: Math.floor(now), storageFeesDue: storageFeesDue > 0n ? storageFeesDue : 0n };
  };
}



export function createAccountHistoryReader({ endpoint, apiKey, fetch: fetchImpl, requestOptions = null } = {}) {
  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') throw new Error('shard-rpc: fetch is unavailable');
  return async (address, { limit = 64, offset = 0, sort = 'desc' } = {}) => {
    const base = resolveEndpoint('transactions', endpoint);
    const key = resolveApiKey(apiKey);
    const url = new URL(base);
    url.searchParams.set('account', String(address));
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('sort', sort === 'asc' ? 'asc' : 'desc');
    const headers = { Accept: 'application/json' };
    if (key) headers['X-API-Key'] = key;
    const response = await scheduleToncenterHttpRequest(
      base, key, (signal) => doFetch(url.toString(), { method: 'GET', headers, signal, cache: 'no-store' }), scanRequestOptions(requestOptions ?? { skipIfRateLimited: false }));
    if (!response) throw new Error('transactions: the request did not run (rate-limited or dropped)');
    if (!response.ok) throw new Error(`transactions failed with HTTP ${response.status}`);
    const body = await response.json();
    return Array.isArray(body?.transactions) ? body.transactions : [];
  };
}

export function createAccountStateAtReader({ endpoint, apiKey, fetch: fetchImpl, requestOptions = null } = {}) {
  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') throw new Error('shard-rpc: fetch is unavailable');
  return async (address, mcSeqno) => {
    const base = deriveToncenterV2Endpoint(resolveEndpoint('getAddressInformation', endpoint), 'getAddressInformation');
    if (!base) throw new Error('getAddressInformation: this endpoint has no v2 door to ask the archive through');
    const key = resolveApiKey(apiKey);
    const url = new URL(base);
    url.searchParams.set('address', String(address));
    url.searchParams.set('seqno', String(Math.floor(Number(mcSeqno))));
    const headers = { Accept: 'application/json' };
    if (key) headers['X-API-Key'] = key;
    const response = await scheduleToncenterHttpRequest(
      base, key, (signal) => doFetch(url.toString(), { method: 'GET', headers, signal, cache: 'no-store' }), scanRequestOptions(requestOptions ?? { skipIfRateLimited: false }));
    if (!response) throw new Error('getAddressInformation: the request did not run (rate-limited or dropped)');
    if (!response.ok) throw new Error(`getAddressInformation failed with HTTP ${response.status}`);
    const body = await response.json();
    if (body?.ok === false) throw new Error(`getAddressInformation refused: ${String(body?.error ?? '').slice(0, 200)}`);
    return body?.result ?? body;
  };
}
