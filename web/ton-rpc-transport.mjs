import { parseTonAddress } from './crypto/platho-crypto.mjs?v=31';


export class TonRpcTransportError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'TonRpcTransportError';
    if (options.status !== undefined) this.status = options.status;
    if (options.code !== undefined) this.code = options.code;
    if (options.retryAfterMs !== undefined) this.retryAfterMs = options.retryAfterMs;
    if (options.exitCode !== undefined) this.exitCode = options.exitCode;
  }
}

const BOC_MAGIC = [0xb5, 0xee, 0x9c, 0x72];
const ADDRESS_SLICE_BITS = 267;
const ADDRESS_CELL_DATA_BYTES = 34;
const TONCENTER_REQUEST_SPACING_MS = 1_500;
const TONCENTER_RATE_LIMIT_BACKOFF_STEPS_MS = Object.freeze([2_000, 5_000, 15_000, 40_000, 60_000]);
const TONCENTER_RATE_LIMIT_BACKOFF_MS = 60_000;
const TONCENTER_MAX_RETRY_AFTER_MS = 120_000;
const TONCENTER_RATE_LIMIT_RETRIES = 0;
const TONCENTER_SERVER_ERROR_BACKOFF_MS = 400;
const TONCENTER_SEND_BOC_SERVER_ERROR_RETRIES = 3;
const TONCENTER_RUN_GET_METHOD_CACHE_TTL_MS = 15_000;
const TONCENTER_RUN_GET_METHOD_CACHE_MAX_ENTRIES = 512;
const TONCENTER_MESSAGES_CACHE_TTL_MS = 300_000;
const TONCENTER_MESSAGES_CACHE_MAX_ENTRIES = 128;
export const TON_RPC_REQUEST_TIMEOUT_MS = 15_000;
export const TON_RPC_MAX_QUEUE_WAIT_MS = TONCENTER_RATE_LIMIT_BACKOFF_MS + TON_RPC_REQUEST_TIMEOUT_MS;
const TON_GET_METHOD_UNINITIALIZED_EXIT_CODE = -13;
const TONCENTER_KEYLESS_REQUEST_SPACING_MS = 1100;
const TON_RPC_CRITICAL_METHODS = Object.freeze([
  'get_global',
  'get_state',
  'get_user',
  'get_user_receipts',
  'get_key_record',
  'get_canonical_publish_charge',
  'get_name_record',
  'get_avatar',
  'get_username_price',
]);
const TONCENTER_RUN_GET_METHOD_CACHE_TTLS_MS = Object.freeze({
  get_global: 10_000,
  get_state: 10_000,
  get_wallet_data: 10_000,
  get_jetton_data: 300_000,
  get_wallet_address: 300_000,
  get_username_price: 300_000,
});
const TONCENTER_RUN_GET_METHOD_PRIORITIES = Object.freeze({
  get_global: 'messages',
  get_state: 'messages',
  get_wallet_data: 'wallet',
});
const TONCENTER_REQUEST_PRIORITY_WEIGHTS = Object.freeze({
  critical: 0,
  asked: 0.25,
  focus: 0.5,
  messages: 1,
  wallet: 2,
  profile: 3,
  background: 4,
  idle: 5,
});
const TONCENTER_REQUEST_HARD_TIMEOUT_MS = 30_000;
const monotonicNow = typeof globalThis.performance?.now === 'function'
  ? () => globalThis.performance.now()
  : () => Date.now();
const toncenterRequestStates = new Map();
const toncenterRunGetMethodInFlight = new Map();
const toncenterRunGetMethodCache = new Map();
const toncenterMessagesInFlight = new Map();
const toncenterMessagesCache = new Map();
const TON_RPC_TRANSPORT_HARD_FAILURE_THRESHOLD = 2;
const TON_RPC_TRANSPORT_DEAD_RETRY_MS = 30_000;
const TON_RPC_VERIFIER_DENIAL_PARK_MS = 300_000;
const tonRpcTransportHealth = new Map();

function tonRpcTransportHealthState(transport) {
  let state = tonRpcTransportHealth.get(transport);
  if (!state) {
    state = { consecutiveHardFailures: 0, deadUntil: 0, lastHardFailureAt: 0, lastOkAt: 0 };
    tonRpcTransportHealth.set(transport, state);
  }
  return state;
}

export function isTonRpcTransportDead(transport, now = monotonicNow()) {
  const state = tonRpcTransportHealth.get(transport);
  return Boolean(state && state.deadUntil > now);
}

function isTonRpcHardTransportError(error) {
  const status = Number(error?.status ?? 0);
  const code = String(error?.code ?? '').toUpperCase();
  if (status === 429 || code === 'RATE_LIMITED' || code === 'QUEUE_TIMEOUT' || code === 'RPC_DISAGREEMENT') return false;
  if (code === 'TIMEOUT' || code === 'NETWORK_ERROR') return true;
  if (status >= 400) return true;
  if (String(error?.name ?? '') === 'TypeError') return true;
  return /failed to fetch|network|dns|connection|load failed/i.test(String(error?.message ?? error ?? ''));
}

const TON_GET_METHOD_UNINITIALIZED_EXIT_CODES = new Set([TON_GET_METHOD_UNINITIALIZED_EXIT_CODE, -256]);
function tonRpcErrorIsUninitializedAccount(error) {
  const code = error?.exitCode;
  return code !== undefined && code !== null && TON_GET_METHOD_UNINITIALIZED_EXIT_CODES.has(Number(code));
}

function noteTonRpcTransportFailure(transport, error, deadRetryMs = TON_RPC_TRANSPORT_DEAD_RETRY_MS) {
  if (!transport) return;
  const status = Number(error?.status ?? 0);
  const code = String(error?.code ?? '').toUpperCase();
  const verifierUnavailable = transport?.verifierOnly === true
    && (status === 401 || status === 403 || status === 429 || code === 'RATE_LIMITED');
  if (!verifierUnavailable && !isTonRpcHardTransportError(error)) return;
  const state = tonRpcTransportHealthState(transport);
  state.consecutiveHardFailures += 1;
  state.lastHardFailureAt = Date.now();
  if (verifierUnavailable) {
    state.deadUntil = monotonicNow() + Math.max(
      finiteNonNegativeMs(deadRetryMs, TON_RPC_TRANSPORT_DEAD_RETRY_MS),
      TON_RPC_VERIFIER_DENIAL_PARK_MS,
    );
  } else if (state.consecutiveHardFailures >= TON_RPC_TRANSPORT_HARD_FAILURE_THRESHOLD) {
    state.deadUntil = monotonicNow() + finiteNonNegativeMs(deadRetryMs, TON_RPC_TRANSPORT_DEAD_RETRY_MS);
  }
}

function noteTonRpcTransportSuccess(transport) {
  if (!transport) return;
  const state = tonRpcTransportHealthState(transport);
  state.consecutiveHardFailures = 0;
  state.deadUntil = 0;
  state.lastOkAt = Date.now();
}

export function noteTonRpcReadTransportRateLimited(transport, error) {
  noteTonRpcTransportFailure(transport, error);
}

function isEmergencyFallbackTransport(transport) {
  return transport?.verifierOnly === true && transport?.emergencyFallback !== false;
}

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function bytesToBase64(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof Buffer !== 'undefined') return Buffer.from(input).toString('base64');
  let binary = '';
  for (const byte of input) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  assertString(value, 'base64');
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function hexToBytes(value) {
  const text = assertString(value, 'hex').replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]*$/.test(text) || text.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const out = new Uint8Array(text.length / 2);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = Number.parseInt(text.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function finiteNonNegativeMs(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.floor(number);
}

function finitePositiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.floor(number);
}

function retryAfterMs(response) {
  const header = response?.headers?.get?.('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.floor(seconds * 1000), TONCENTER_MAX_RETRY_AFTER_MS);
  }
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) {
    return Math.min(Math.max(0, dateMs - Date.now()), TONCENTER_MAX_RETRY_AFTER_MS);
  }
  return null;
}

function tonRpcTimeoutError(timeoutMs) {
  return new TonRpcTransportError(`TON RPC request timed out after ${timeoutMs} ms`, {
    code: 'TIMEOUT',
  });
}

function tonRpcNotWantedError() {
  return new TonRpcTransportError('TON RPC read no longer wanted', { code: 'NOT_WANTED' });
}
function toncenterTaskUnwanted(task) {
  try { return typeof task.options.wanted === 'function' && task.options.wanted() === false; } catch { return false; }
}

function tonRpcQueueTimeoutError(timeoutMs) {
  return new TonRpcTransportError(`TON RPC queue wait timed out after ${timeoutMs} ms`, {
    code: 'QUEUE_TIMEOUT',
  });
}

function resolveTonRpcRequestTimeoutMs(requestOptions, transportOptions) {
  return finiteNonNegativeMs(
    requestOptions?.requestTimeoutMs
      ?? requestOptions?.timeoutMs
      ?? transportOptions.requestTimeoutMs,
    TON_RPC_REQUEST_TIMEOUT_MS,
  );
}

export const tonRpcRequestCounters = { total: 0, ms: 0, byLeaf: Object.create(null) };

function noteTonRpcRequest(url, startedAt) {
  const ms = Date.now() - startedAt;
  tonRpcRequestCounters.total += 1;
  tonRpcRequestCounters.ms += ms;
  let leaf = 'other';
  try { leaf = new URL(String(url)).pathname.split('/').pop() || 'other'; } catch { }
  const bucket = tonRpcRequestCounters.byLeaf[leaf] ?? (tonRpcRequestCounters.byLeaf[leaf] = { n: 0, ms: 0 });
  bucket.n += 1;
  bucket.ms += ms;
}

async function fetchWithTonRpcTimeout(fetchImpl, url, init, timeoutMs) {
  const startedAt = Date.now();
  const resolvedTimeoutMs = finiteNonNegativeMs(timeoutMs, TON_RPC_REQUEST_TIMEOUT_MS);
  if (resolvedTimeoutMs <= 0) {
    try { return await fetchImpl(url, init); } finally { noteTonRpcRequest(url, startedAt); }
  }

  let timeoutId = null;
  let timedOut = false;
  let controller = null;
  let requestInit = init;
  if (typeof AbortController !== 'undefined') {
    controller = new AbortController();
    requestInit = { ...init, signal: controller.signal };
  }
  const timeout = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      try {
        controller?.abort?.();
      } catch {
      }
      reject(tonRpcTimeoutError(resolvedTimeoutMs));
    }, resolvedTimeoutMs);
  });
  const request = Promise.resolve()
    .then(() => fetchImpl(url, requestInit))
    .catch((error) => {
      if (timedOut || String(error?.name ?? '') === 'AbortError') {
        throw tonRpcTimeoutError(resolvedTimeoutMs);
      }
      throw error;
    });
  try {
    return await Promise.race([request, timeout]);
  } finally {
    noteTonRpcRequest(url, startedAt);
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

async function withTonRpcOperationTimeout(operation, timeoutMs) {
  const resolvedTimeoutMs = finiteNonNegativeMs(timeoutMs, 0);
  if (resolvedTimeoutMs <= 0) return operation();
  let timeoutId = null;
  const timeout = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(Object.assign(tonRpcTimeoutError(resolvedTimeoutMs), { operationBound: true })), resolvedTimeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(operation), timeout]);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

function tonRpcOperationTimeoutMs(requestOptions = {}, defaults = {}) {
  return finiteNonNegativeMs(
    requestOptions?.requestTimeoutMs
      ?? requestOptions?.timeoutMs
      ?? defaults.requestTimeoutMs
      ?? defaults.timeoutMs,
    0,
  );
}

function toncenterLimiterKey(endpoint, apiKey, explicitKey) {
  if (explicitKey) return String(explicitKey);
  try {
    return `${new URL(endpoint).origin}|${apiKey ? 'api-key' : 'public'}`;
  } catch {
    return `${endpoint}|${apiKey ? 'api-key' : 'public'}`;
  }
}

function stableJsonString(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === 'bigint') return { __type: 'bigint', value: item.toString() };
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    if (seen.has(item)) throw new Error('TON RPC cache key cannot contain circular values');
    seen.add(item);
    const sorted = {};
    for (const key of Object.keys(item).sort()) sorted[key] = item[key];
    return sorted;
  });
}

function toncenterRunGetMethodScopeKey(endpoint, apiKey, explicitKey) {
  return `${toncenterLimiterKey(endpoint, apiKey, explicitKey)}|${endpoint}|${apiKey ? 'api-key' : 'public'}`;
}

function toncenterRunGetMethodCacheKey(endpoint, apiKey, explicitKey, call) {
  return [
    toncenterRunGetMethodScopeKey(endpoint, apiKey, explicitKey),
    call.address,
    call.method,
    stableJsonString(call.stack ?? []),
  ].join('|');
}

function stableQueryObject(params = {}) {
  const out = {};
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value === undefined || value === null || value === '') continue;
    out[key] = Array.isArray(value) ? value.map(String) : String(value);
  }
  return out;
}

function toncenterMessagesScopeKey(endpoint, apiKey, explicitKey) {
  return `${toncenterLimiterKey(endpoint, apiKey, explicitKey)}|${endpoint}|${apiKey ? 'api-key' : 'public'}|messages`;
}

function toncenterMessagesCacheKey(endpoint, apiKey, explicitKey, params) {
  return [
    toncenterMessagesScopeKey(endpoint, apiKey, explicitKey),
    stableJsonString(stableQueryObject(params)),
  ].join('|');
}

function mergeRunGetMethodCacheTtls(overrides) {
  if (!overrides || typeof overrides !== 'object') return TONCENTER_RUN_GET_METHOD_CACHE_TTLS_MS;
  return { ...TONCENTER_RUN_GET_METHOD_CACHE_TTLS_MS, ...overrides };
}

function mergeRunGetMethodPriorities(overrides) {
  if (!overrides || typeof overrides !== 'object') return TONCENTER_RUN_GET_METHOD_PRIORITIES;
  return { ...TONCENTER_RUN_GET_METHOD_PRIORITIES, ...overrides };
}

function resolveRunGetMethodCacheTtlMs(method, callOptions, transportOptions) {
  const explicit = callOptions?.cacheTtlMs ?? callOptions?.ttlMs;
  if (explicit !== undefined && explicit !== null) return finiteNonNegativeMs(explicit, 0);
  const baseTtl = finiteNonNegativeMs(
    transportOptions.runGetMethodCacheTtlMs,
    TONCENTER_RUN_GET_METHOD_CACHE_TTL_MS,
  );
  if (baseTtl === 0) return 0;
  const ttlByMethod = mergeRunGetMethodCacheTtls(transportOptions.runGetMethodCacheTtls);
  return finiteNonNegativeMs(ttlByMethod[method], baseTtl);
}

function tonRpcFreshInFlightOptionsKey(options = {}) {
  return stableJsonString({
    allowUnverifiedCriticalRead: options.allowUnverifiedCriticalRead === true,
    skipIfRateLimited: options.skipIfRateLimited === false ? false : null,
    priority: options.priority ?? null,
    queueTimeoutMs: options.queueTimeoutMs ?? null,
    requestTimeoutMs: options.requestTimeoutMs ?? null,
    timeoutMs: options.timeoutMs ?? null,
    verify: options.verify === false ? false : (options.verify === true ? true : null),
  });
}

function tonRpcInFlightKey(cacheKey, cacheTtlMs, options = {}) {
  if (cacheTtlMs === 0) return `${cacheKey}|fresh|${tonRpcFreshInFlightOptionsKey(options)}`;
  return `${cacheKey}|cached|${options.skipIfRateLimited === false ? 'wait' : 'skip'}`;
}

function resolveRunGetMethodPriority(method, callOptions, transportOptions) {
  const priorities = mergeRunGetMethodPriorities(transportOptions.runGetMethodPriorities);
  return String(callOptions?.priority ?? priorities[method] ?? 'background');
}

function toncenterPriorityWeight(priority) {
  return TONCENTER_REQUEST_PRIORITY_WEIGHTS[priority] ?? TONCENTER_REQUEST_PRIORITY_WEIGHTS.background;
}

function pruneExpiredRunGetMethodCache(now = monotonicNow()) {
  for (const [key, entry] of toncenterRunGetMethodCache) {
    if (entry.expiresAt <= now) toncenterRunGetMethodCache.delete(key);
  }
}

function writeRunGetMethodCache(key, value, ttlMs, maxEntries) {
  if (ttlMs <= 0) return;
  pruneExpiredRunGetMethodCache();
  while (toncenterRunGetMethodCache.size >= maxEntries) {
    const oldestKey = toncenterRunGetMethodCache.keys().next().value;
    if (oldestKey === undefined) break;
    toncenterRunGetMethodCache.delete(oldestKey);
  }
  const now = monotonicNow();
  toncenterRunGetMethodCache.set(key, { value, expiresAt: now + ttlMs, writtenAt: now });
}

function readRunGetMethodCache(key, maxAgeMs = Infinity) {
  const entry = toncenterRunGetMethodCache.get(key);
  if (!entry) return null;
  const now = monotonicNow();
  if (entry.expiresAt <= now) {
    toncenterRunGetMethodCache.delete(key);
    return null;
  }
  if (Number.isFinite(maxAgeMs) && now - Number(entry.writtenAt ?? 0) > maxAgeMs) return null;
  return entry.value;
}

function pruneExpiredMessagesCache(now = monotonicNow()) {
  for (const [key, entry] of toncenterMessagesCache) {
    if (entry.expiresAt <= now) toncenterMessagesCache.delete(key);
  }
}

function writeMessagesCache(key, value, ttlMs, maxEntries) {
  if (ttlMs <= 0) return;
  pruneExpiredMessagesCache();
  while (toncenterMessagesCache.size >= maxEntries) {
    const oldestKey = toncenterMessagesCache.keys().next().value;
    if (oldestKey === undefined) break;
    toncenterMessagesCache.delete(oldestKey);
  }
  const now = monotonicNow();
  toncenterMessagesCache.set(key, { value, expiresAt: now + ttlMs, writtenAt: now });
}

function readMessagesCache(key, maxAgeMs = Infinity) {
  const entry = toncenterMessagesCache.get(key);
  if (!entry) return null;
  const now = monotonicNow();
  if (entry.expiresAt <= now) {
    toncenterMessagesCache.delete(key);
    return null;
  }
  if (Number.isFinite(maxAgeMs) && now - Number(entry.writtenAt ?? 0) > maxAgeMs) return null;
  return entry.value;
}

export function clearToncenterRunGetMethodCache(options = {}) {
  if (!options?.endpoint) {
    const count = toncenterRunGetMethodCache.size;
    toncenterRunGetMethodCache.clear();
    return count;
  }
  const prefix = `${toncenterRunGetMethodScopeKey(
    options.endpoint,
    options.apiKey ?? null,
    options.rateLimitKey,
  )}|`;
  let count = 0;
  for (const key of [...toncenterRunGetMethodCache.keys()]) {
    if (key.startsWith(prefix)) {
      toncenterRunGetMethodCache.delete(key);
      count += 1;
    }
  }
  return count;
}

export function clearToncenterMessagesCache() {
  const count = toncenterMessagesCache.size;
  toncenterMessagesCache.clear();
  return count;
}

export function __toncenterLimiterKeysForTests() {
  return [...toncenterRequestStates.keys()];
}

const TONCENTER_PUMP_LOG_SIZE = 200;
const toncenterPumpLog = [];
function notePumpRequest(entry) {
  toncenterPumpLog.push(entry);
  if (toncenterPumpLog.length > TONCENTER_PUMP_LOG_SIZE) toncenterPumpLog.splice(0, toncenterPumpLog.length - TONCENTER_PUMP_LOG_SIZE);
}
export function toncenterPumpSnapshot() {
  const queues = [...toncenterRequestStates.values()].map((state) => {
    const waiting = {};
    for (const task of state.pending) waiting[task.options.priority ?? 'background'] = (waiting[task.options.priority ?? 'background'] ?? 0) + 1;
    return { averageMs: Math.round(state.averageMs), slow: toncenterPumpSlow(state), waiting };
  });
  return { at: new Date().toISOString(), queues, log: toncenterPumpLog.slice() };
}
try { globalThis.plathoPump = Object.freeze({ snapshot: toncenterPumpSnapshot }); } catch { }

const TONCENTER_SLOW_MS = 1_000;
function toncenterPumpSlow(state) {
  return Number(state?.averageMs ?? 0) > TONCENTER_SLOW_MS;
}

function toncenterRequestState(key) {
  const existing = toncenterRequestStates.get(key);
  if (existing) return existing;
  const state = {
    pending: [],
    processing: false,
    sequence: 0,
    nextAt: 0,
    averageMs: 0,
    backoffs: new Map(),
    agedLast: false,
  };
  toncenterRequestStates.set(key, state);
  return state;
}

const TONCENTER_QUEUE_AGING_STEP_MS = 5_000;
const TONCENTER_QUEUE_AGING_FLOOR_WEIGHT = 1;

function toncenterEffectiveTaskWeight(task, now, slow = false) {
  const waitedMs = Math.max(0, now - task.enqueuedAt);
  const step = slow && task.priorityWeight >= TONCENTER_REQUEST_PRIORITY_WEIGHTS.idle ? TONCENTER_QUEUE_AGING_STEP_MS * 4 : TONCENTER_QUEUE_AGING_STEP_MS;
  const agedWeight = task.priorityWeight - Math.floor(waitedMs / step);
  return Math.max(Math.min(task.priorityWeight, TONCENTER_QUEUE_AGING_FLOOR_WEIGHT), agedWeight);
}

function toncenterBackoffFor(state, scope) {
  const key = String(scope ?? '');
  let backoff = state.backoffs.get(key);
  if (!backoff) { backoff = { until: 0, streak: 0 }; state.backoffs.set(key, backoff); }
  return backoff;
}

function toncenterTaskRunnable(state, task, now) {
  return task.options.skipIfRateLimited === true || toncenterBackoffFor(state, task.options.backoffScope).until <= now;
}

function takeNextToncenterTask(state) {
  const now = monotonicNow();
  const anyRunnable = state.pending.some((task) => toncenterTaskRunnable(state, task, now));
  let bestIndex = -1;
  let bestWeight = Infinity;
  let classIndex = -1;
  for (let index = 0; index < state.pending.length; index += 1) {
    const candidate = state.pending[index];
    if (anyRunnable && !toncenterTaskRunnable(state, candidate, now)) continue;
    const candidateWeight = toncenterEffectiveTaskWeight(candidate, now, toncenterPumpSlow(state));
    if (
      bestIndex < 0
      || candidateWeight < bestWeight
      || (candidateWeight === bestWeight && candidate.sequence < state.pending[bestIndex].sequence)
    ) {
      bestIndex = index;
      bestWeight = candidateWeight;
    }
    const classBest = classIndex < 0 ? null : state.pending[classIndex];
    if (!classBest || candidate.priorityWeight < classBest.priorityWeight
      || (candidate.priorityWeight === classBest.priorityWeight && candidate.sequence < classBest.sequence)) classIndex = index;
  }
  if (state.agedLast && classIndex >= 0 && state.pending[classIndex].priorityWeight < state.pending[bestIndex].priorityWeight) {
    bestIndex = classIndex;
  }
  state.agedLast = classIndex >= 0 && state.pending[bestIndex].priorityWeight > state.pending[classIndex].priorityWeight;
  return state.pending.splice(bestIndex, 1)[0];
}

async function drainToncenterRequestQueue(state) {
  try {
    while (state.pending.length > 0) {
      const idleNow = monotonicNow();
      if (!state.pending.some((waiting) => toncenterTaskRunnable(state, waiting, idleNow))) {
        const firstFree = Math.min(...state.pending.map((waiting) => toncenterBackoffFor(state, waiting.options.backoffScope).until));
        await sleepUntilWoken(state, firstFree - idleNow);
        continue;
      }
      const task = takeNextToncenterTask(state);
      task.started = true;
      if (task.queueTimeoutId !== null) {
        clearTimeout(task.queueTimeoutId);
        task.queueTimeoutId = null;
      }
      try {
        const spacingMs = finiteNonNegativeMs(task.options.spacingMs, TONCENTER_REQUEST_SPACING_MS);
        const queueTimeoutMs = finiteNonNegativeMs(task.options.queueTimeoutMs, 0);
        const queueDeadlineAt = queueTimeoutMs > 0 ? task.enqueuedAt + queueTimeoutMs : 0;
        const now = monotonicNow();
        const backoff = toncenterBackoffFor(state, task.options.backoffScope);
        if (task.options.skipIfRateLimited === true && backoff.until > now) {
          await delay(0);
          throw toncenterBackoffError(backoff.until - now);
        }
        if (toncenterTaskUnwanted(task)) { await delay(0); throw tonRpcNotWantedError(); }
        if (queueDeadlineAt > 0 && now >= queueDeadlineAt) {
          throw tonRpcQueueTimeoutError(queueTimeoutMs);
        }
        const waitUntil = Math.max(
          state.nextAt,
          task.options.skipIfRateLimited === true ? 0 : backoff.until,
        );
        const waitMs = waitUntil - monotonicNow();
        if (waitMs > 0) {
          if (queueDeadlineAt > 0) {
            const remainingQueueMs = queueDeadlineAt - monotonicNow();
            if (remainingQueueMs <= 0) {
              throw tonRpcQueueTimeoutError(queueTimeoutMs);
            }
            if (waitMs > remainingQueueMs) {
              await delay(remainingQueueMs);
              throw tonRpcQueueTimeoutError(queueTimeoutMs);
            }
          }
          await delay(waitMs);
          if (toncenterTaskUnwanted(task)) throw tonRpcNotWantedError();
        }
        const requestedTimeoutMs = finiteNonNegativeMs(task.options.requestTimeoutMs, TONCENTER_REQUEST_HARD_TIMEOUT_MS);
        const requestTimeoutMs = requestedTimeoutMs > 0
          ? Math.min(requestedTimeoutMs, TONCENTER_REQUEST_HARD_TIMEOUT_MS)
          : TONCENTER_REQUEST_HARD_TIMEOUT_MS;
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        let requestTimer = null;
        const startedAt = monotonicNow();
        const logged = { label: String(task.options.label ?? ''), cls: task.options.priority ?? 'background', waitedMs: Math.round(startedAt - task.enqueuedAt) };
        const response = await Promise.race([
          task.request(controller?.signal),
          new Promise((_, rejectTimeout) => {
            requestTimer = setTimeout(() => {
              try { controller?.abort(); } catch { }
              rejectTimeout(tonRpcTimeoutError(requestTimeoutMs));
            }, requestTimeoutMs);
          }),
        ]).finally(() => {
          if (requestTimer !== null) clearTimeout(requestTimer);
          const tookMs = monotonicNow() - startedAt;
          state.averageMs = state.averageMs > 0 ? state.averageMs * 0.8 + tookMs * 0.2 : tookMs;
          logged.ms = Math.round(tookMs);
          notePumpRequest(logged);
        }).catch((error) => { logged.end = String(error?.code ?? error?.name ?? 'error'); throw error; });
        logged.end = String(response?.status ?? '');
        state.nextAt = monotonicNow() + spacingMs;
        if (response?.status === 429) {
          backoff.streak = Number(backoff.streak ?? 0) + 1;
          const grown = TONCENTER_RATE_LIMIT_BACKOFF_STEPS_MS[
            Math.min(backoff.streak - 1, TONCENTER_RATE_LIMIT_BACKOFF_STEPS_MS.length - 1)
          ];
          const parkMs = retryAfterMs(response)
            ?? (task.options.rateLimitBackoffMs !== undefined
              ? finiteNonNegativeMs(task.options.rateLimitBackoffMs, grown)
              : grown);
          backoff.until = monotonicNow() + parkMs;
        } else if (response?.status !== undefined && response.status < 500) {
          backoff.streak = 0;
        }
        task.resolve(response);
      } catch (error) {
        task.reject(error);
      }
    }
  } finally {
    state.processing = false;
    if (state.pending.length > 0) {
      state.processing = true;
      void drainToncenterRequestQueue(state);
    }
  }
}

async function scheduleToncenterRequest(key, request, options = {}) {
  const state = toncenterRequestState(key);
  return new Promise((resolve, reject) => {
    const queueTimeoutMs = finiteNonNegativeMs(options.queueTimeoutMs, 0);
    const task = {
      request,
      options,
      enqueuedAt: monotonicNow(),
      started: false,
      queueTimeoutId: null,
      resolve(value) {
        if (task.queueTimeoutId !== null) {
          clearTimeout(task.queueTimeoutId);
          task.queueTimeoutId = null;
        }
        resolve(value);
      },
      reject(error) {
        if (task.queueTimeoutId !== null) {
          clearTimeout(task.queueTimeoutId);
          task.queueTimeoutId = null;
        }
        reject(error);
      },
      priorityWeight: toncenterPriorityWeight(options.priority),
      sequence: state.sequence,
    };
    if (queueTimeoutMs > 0) {
      task.queueTimeoutId = setTimeout(() => {
        if (task.started) return;
        const index = state.pending.indexOf(task);
        if (index >= 0) state.pending.splice(index, 1);
        task.reject(tonRpcQueueTimeoutError(queueTimeoutMs));
      }, queueTimeoutMs);
    }
    state.pending.push(task);
    state.sequence += 1;
    if (!state.processing) {
      state.processing = true;
      void drainToncenterRequestQueue(state);
    } else {
      state.wake?.();
    }
  });
}

function sleepUntilWoken(state, ms) {
  return new Promise((resolve) => {
    let timer = null;
    const done = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (state.wake === done) state.wake = null;
      resolve();
    };
    timer = setTimeout(done, Math.max(1, Math.ceil(ms)));
    state.wake = done;
  });
}

function toncenterBackoffError(retryAfterMs) {
  return new TonRpcTransportError('TON RPC rate limit backoff active', {
    status: 429,
    code: 'RATE_LIMITED',
    retryAfterMs,
  });
}

function toncenterHttpError(label, response, fallbackBackoffMs = TONCENTER_RATE_LIMIT_BACKOFF_MS) {
  const retryMs = response?.status === 429 ? retryAfterMs(response) ?? fallbackBackoffMs : undefined;
  return new TonRpcTransportError(`${label} HTTP ${response.status}`, {
    status: response.status,
    code: response.status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR',
    retryAfterMs: retryMs,
  });
}

function toncenterHttpErrorDetail(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return '';
  try {
    const json = JSON.parse(raw);
    const detail = json?.upstream_error
      ?? json?.upstreamError
      ?? json?.upstream?.error
      ?? json?.upstream?.message
      ?? json?.error
      ?? json?.message
      ?? json?.description
      ?? json?.result?.error
      ?? json?.result?.message
      ?? json?.result?.description;
    if (detail !== undefined && detail !== null) return String(detail).slice(0, 1000);
  } catch {
  }
  return raw.slice(0, 1000);
}

async function toncenterHttpErrorWithBody(label, response, fallbackBackoffMs = TONCENTER_RATE_LIMIT_BACKOFF_MS) {
  const error = toncenterHttpError(label, response, fallbackBackoffMs);
  try {
    const body = typeof response?.clone === 'function' ? await response.clone().text() : await response.text();
    const detail = toncenterHttpErrorDetail(body);
    if (detail) {
      error.message = `${error.message}: ${detail}`;
      error.responseBody = detail;
    }
    const exitCode = toncenterBroadcastExitCode(body);
    if (exitCode != null) error.chainExitCode = exitCode;
  } catch {
  }
  return error;
}

const TONCENTER_EXIT_CODE_PATTERN = /exit[ _]?code[^0-9-]{0,8}(-?\d+)/i;

export function toncenterBroadcastExitCode(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  const found = TONCENTER_EXIT_CODE_PATTERN.exec(text);
  if (!found) return null;
  const code = Number(found[1]);
  return Number.isFinite(code) ? code : null;
}

async function toncenterResponseCarriesChainRejection(response) {
  try {
    const text = typeof response?.clone === 'function' ? await response.clone().text() : null;
    return text != null && toncenterBroadcastExitCode(text) != null;
  } catch {
    return false;
  }
}

export function deriveToncenterV3Endpoint(endpoint, leaf) {
  const url = new URL(assertString(endpoint, 'TON RPC endpoint'));
  const parts = url.pathname.split('/');
  if (parts.length === 0 || parts[parts.length - 1] === '') {
    parts.push(leaf);
  } else {
    parts[parts.length - 1] = leaf;
  }
  url.pathname = parts.join('/');
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function deriveToncenterV2Endpoint(endpoint, leaf) {
  const url = new URL(deriveToncenterV3Endpoint(endpoint, leaf));
  if (!url.pathname.includes('/api/v3/')) return null;
  url.pathname = url.pathname.replace('/api/v3/', '/api/v2/');
  return url.toString();
}

function appendQueryParams(endpoint, params = {}) {
  const url = new URL(assertString(endpoint, 'TON RPC endpoint'));
  for (const [key, value] of Object.entries(stableQueryObject(params))) {
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function toncenterBackoffScope(endpoint) {
  try { return new URL(endpoint).origin; } catch { return String(endpoint ?? ''); }
}

function toncenterEndpointLabel(endpoint) {
  try { return new URL(String(endpoint)).pathname.replace(/^\/api\//, ''); } catch { return 'request'; }
}

export async function scheduleToncenterHttpRequest(endpoint, apiKey, request, options = {}) {
  const limiterKey = toncenterLimiterKey(endpoint, apiKey, options.rateLimitKey);
  const requestSpacingMs = finiteNonNegativeMs(options.requestSpacingMs, TONCENTER_REQUEST_SPACING_MS);
  const rateLimitBackoffMs = finiteNonNegativeMs(options.rateLimitBackoffMs, TONCENTER_RATE_LIMIT_BACKOFF_MS);
  const rateLimitRetries = finiteNonNegativeMs(options.rateLimitRetries, TONCENTER_RATE_LIMIT_RETRIES);
  const serverErrorRetries = finiteNonNegativeMs(options.serverErrorRetries, 0);
  const serverErrorBackoffMs = finiteNonNegativeMs(options.serverErrorBackoffMs, TONCENTER_SERVER_ERROR_BACKOFF_MS);
  let response = null;
  let rateLimited = 0;
  let serverErrors = 0;
  let earlierAttemptUnknown = false;
  const markUnknown = (value) => {
    if (earlierAttemptUnknown && value && typeof value === 'object') { try { value.plathoPriorDeliveryAmbiguous = true; } catch { } }
    return value;
  };
  while (true) {
    response = await scheduleToncenterRequest(
      limiterKey,
      request,
      {
        spacingMs: requestSpacingMs,
        rateLimitBackoffMs: options.rateLimitBackoffMs,
        skipIfRateLimited: options.skipIfRateLimited,
        priority: options.priority,
        queueTimeoutMs: options.queueTimeoutMs,
        requestTimeoutMs: options.requestTimeoutMs,
        backoffScope: toncenterBackoffScope(endpoint),
        wanted: options.wanted,
        label: options.label ?? toncenterEndpointLabel(endpoint),
      },
    ).catch((error) => {
      if (earlierAttemptUnknown && error && typeof error === 'object') { try { error.tonRpcPriorDeliveryAmbiguous = true; } catch { } }
      throw error;
    });
    if (response?.status === 429) {
      if (rateLimited >= rateLimitRetries) return markUnknown(response);
      rateLimited += 1;
      continue;
    }
    if (response && response.status >= 500 && serverErrors < serverErrorRetries) {
      if (await toncenterResponseCarriesChainRejection(response)) return markUnknown(response);
      serverErrors += 1;
      earlierAttemptUnknown = true;
      await delay(serverErrorBackoffMs * serverErrors);
      continue;
    }
    return response && !response.ok ? markUnknown(response) : response;
  }
}

function writeBit(bytes, bitOffset, bit) {
  if (bit) bytes[bitOffset >> 3] |= 1 << (7 - (bitOffset & 7));
  return bitOffset + 1;
}

function writeUint(bytes, bitOffset, value, bitLength) {
  let next = bitOffset;
  const bigint = BigInt(value);
  for (let shift = bitLength - 1; shift >= 0; shift -= 1) {
    next = writeBit(bytes, next, ((bigint >> BigInt(shift)) & 1n) === 1n);
  }
  return next;
}

function readUint(bytes, bitOffset, bitLength) {
  let out = 0n;
  for (let index = 0; index < bitLength; index += 1) {
    const bit = (bytes[(bitOffset + index) >> 3] >> (7 - ((bitOffset + index) & 7))) & 1;
    out = (out << 1n) | BigInt(bit);
  }
  return out;
}

function signedWorkchainByte(workchain) {
  if (!Number.isInteger(workchain) || workchain < -128 || workchain > 127) {
    throw new Error('TON workchain must fit int8');
  }
  return workchain < 0 ? 0x100 + workchain : workchain;
}

function unsignedByteToSigned(value) {
  return value > 0x7f ? value - 0x100 : value;
}

function singleCellBoc(dataBytes, dataBits) {
  const cell = new Uint8Array(2 + dataBytes.length);
  cell[0] = 0;
  cell[1] = Math.floor(dataBits / 8) + Math.ceil(dataBits / 8);
  cell.set(dataBytes, 2);

  const boc = new Uint8Array(11 + cell.length);
  let offset = 0;
  boc.set(BOC_MAGIC, offset); offset += 4;
  boc[offset] = 0x01; offset += 1;
  boc[offset] = 0x01; offset += 1;
  boc[offset] = 0x01; offset += 1;
  boc[offset] = 0x01; offset += 1;
  boc[offset] = 0x00; offset += 1;
  boc[offset] = cell.length; offset += 1;
  boc[offset] = 0x00; offset += 1;
  boc.set(cell, offset);
  return bytesToBase64(boc);
}

function readSingleCellBoc(bocBase64) {
  const bytes = base64ToBytes(bocBase64);
  if (bytes.length < 13 || !BOC_MAGIC.every((byte, index) => bytes[index] === byte)) {
    throw new Error('Invalid TON BoC magic');
  }
  let offset = 4;
  const flags = bytes[offset]; offset += 1;
  const sizeBytes = flags & 0x07;
  if (sizeBytes !== 1) throw new Error('Unsupported TON BoC size bytes');
  const hasIndex = (flags & 0x80) !== 0;
  const hasCrc32 = (flags & 0x40) !== 0;
  const offsetBytes = bytes[offset]; offset += 1;
  if (offsetBytes !== 1) throw new Error('Unsupported TON BoC offset bytes');
  const cells = bytes[offset]; offset += 1;
  const roots = bytes[offset]; offset += 1;
  offset += 1;
  const totalCellSize = bytes[offset]; offset += 1;
  if (cells !== 1 || roots !== 1) throw new Error('Expected a single-root single-cell BoC');
  offset += roots * sizeBytes;
  if (hasIndex) offset += cells * offsetBytes;
  const cellEnd = offset + totalCellSize;
  if (cellEnd > bytes.length - (hasCrc32 ? 4 : 0)) throw new Error('Invalid TON BoC cell size');
  const refsDescriptor = bytes[offset]; offset += 1;
  const bitsDescriptor = bytes[offset]; offset += 1;
  if ((refsDescriptor & 0x07) !== 0) throw new Error('Address slice BoC must not contain refs');
  const dataBytes = Math.ceil(bitsDescriptor / 2);
  if (offset + dataBytes > cellEnd) throw new Error('Invalid TON cell data size');
  return bytes.subarray(offset, offset + dataBytes);
}

export function encodeTonAddressSliceBoc(address) {
  const parsed = parseTonAddress(address);
  const data = new Uint8Array(ADDRESS_CELL_DATA_BYTES);
  let bitOffset = 0;
  bitOffset = writeBit(data, bitOffset, true);
  bitOffset = writeBit(data, bitOffset, false);
  bitOffset = writeBit(data, bitOffset, false);
  bitOffset = writeUint(data, bitOffset, signedWorkchainByte(parsed.workchain), 8);
  for (const byte of parsed.hash) {
    bitOffset = writeUint(data, bitOffset, byte, 8);
  }
  bitOffset = writeBit(data, bitOffset, true);
  if (bitOffset > data.length * 8) throw new Error('TON address slice overflow');
  return singleCellBoc(data, ADDRESS_SLICE_BITS);
}

export function decodeTonAddressSliceBoc(bocBase64) {
  const data = readSingleCellBoc(bocBase64);
  if (data.length < ADDRESS_CELL_DATA_BYTES) throw new Error('Address slice BoC is too short');
  let bitOffset = 0;
  const tag = readUint(data, bitOffset, 2); bitOffset += 2;
  const anycast = readUint(data, bitOffset, 1); bitOffset += 1;
  if (tag !== 2n || anycast !== 0n) throw new Error('Unsupported TON address slice');
  const workchain = unsignedByteToSigned(Number(readUint(data, bitOffset, 8))); bitOffset += 8;
  const hash = new Uint8Array(32);
  for (let index = 0; index < hash.length; index += 1) {
    hash[index] = Number(readUint(data, bitOffset, 8));
    bitOffset += 8;
  }
  return `${workchain}:${bytesToHex(hash)}`;
}

function toStackNumber(value) {
  const bigint = typeof value === 'bigint' ? value : BigInt(value);
  return bigint < 0n ? `-0x${(-bigint).toString(16)}` : `0x${bigint.toString(16)}`;
}

export function parseStackBigIntValue(value, name) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'boolean') return value ? -1n : 0n;
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^-?0x[0-9a-fA-F]+$/.test(text)) {
      return text.startsWith('-') ? -BigInt(`0x${text.slice(3)}`) : BigInt(text);
    }
    if (/^-?[0-9]+$/.test(text)) return BigInt(text);
  } else if (value && typeof value.toString === 'function') {
    return parseStackBigIntValue(value.toString(), name);
  }
  throw new Error(`${name} must be an integer stack item`);
}

function stackItemValue(item) {
  if (Array.isArray(item)) return item[1];
  if (item && typeof item === 'object' && 'value' in item) return item.value;
  return item;
}

function stackItemType(item) {
  if (Array.isArray(item)) return String(item[0] ?? '').toLowerCase();
  if (item && typeof item === 'object' && 'type' in item) return String(item.type ?? '').toLowerCase();
  return typeof item;
}

export const RJ_UNDERPRICED = 0x16;

export function createTonCenterV3Transport(options = {}) {
  const endpoint = assertString(options.endpoint, 'TON RPC endpoint');
  const messagesEndpoint = options.messagesEndpoint === false
    ? null
    : options.messagesEndpoint
    ?? globalThis.plathoTonMessagesEndpoint
    ?? globalThis.PLATHO_TON_MESSAGES_ENDPOINT
    ?? deriveToncenterV3Endpoint(endpoint, 'messages');
  const accountEndpoint = options.accountEndpoint
    ?? options.walletBalanceEndpoint
    ?? globalThis.plathoWalletBalanceEndpoint
    ?? globalThis.PLATHO_WALLET_BALANCE_ENDPOINT
    ?? null;
  const sendBocEndpoint = options.sendBocEndpoint
    ?? globalThis.plathoTonSendBocEndpoint
    ?? globalThis.PLATHO_TON_SEND_BOC_ENDPOINT
    ?? null;
  const masterchainInfoEndpoint = options.masterchainInfoEndpoint ?? deriveToncenterV3Endpoint(endpoint, 'masterchainInfo');
  const configParamEndpoint = options.configParamEndpoint ?? deriveToncenterV2Endpoint(endpoint, 'getConfigParam');
  const transactionsEndpoint = options.transactionsEndpoint ?? deriveToncenterV3Endpoint(endpoint, 'transactions');
  const liveTransactionsEndpoint = options.liveTransactionsEndpoint ?? deriveToncenterV2Endpoint(endpoint, 'getTransactions');
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new TonRpcTransportError('fetch is unavailable');
  const apiKey = options.apiKey
    ?? (options.useUserApiKey ? (globalThis.plathoToncenterApiKey ?? null) : null);
  const requestSpacingMs = finiteNonNegativeMs(options.requestSpacingMs, TONCENTER_REQUEST_SPACING_MS);
  const rateLimitBackoffMs = finiteNonNegativeMs(options.rateLimitBackoffMs, TONCENTER_RATE_LIMIT_BACKOFF_MS);
  const rateLimitRetries = finiteNonNegativeMs(options.rateLimitRetries, TONCENTER_RATE_LIMIT_RETRIES);
  const runGetMethodCacheMaxEntries = finitePositiveInteger(
    options.runGetMethodCacheMaxEntries,
    TONCENTER_RUN_GET_METHOD_CACHE_MAX_ENTRIES,
  );
  const messagesCacheMaxEntries = finitePositiveInteger(
    options.messagesCacheMaxEntries,
    TONCENTER_MESSAGES_CACHE_MAX_ENTRIES,
  );
  return {
    kind: 'toncenter-v3',
    queuesRequests: true,
    supportsMessageHistory: Boolean(messagesEndpoint),
    supportsSendBoc: Boolean(sendBocEndpoint),
    async runGetMethod({ address, method, stack, cacheTtlMs, ttlMs, priority, verify, allowUnverifiedCriticalRead,
      requestTimeoutMs, timeoutMs, queueTimeoutMs, skipIfRateLimited, rateLimitBackoffMs: callRateLimitBackoffMs, wanted = null }) {
      const call = {
        address: assertString(address, 'TON RPC address'),
        method: assertString(method, 'TON RPC method'),
        stack: Array.isArray(stack) ? stack : [],
      };
      const cacheKey = toncenterRunGetMethodCacheKey(endpoint, apiKey, options.rateLimitKey, call);
      const resolvedPriority = resolveRunGetMethodPriority(call.method, { priority }, options);
      const resolvedCacheTtlMs = resolveRunGetMethodCacheTtlMs(call.method, { cacheTtlMs, ttlMs }, options);
      const bypassCache = resolvedCacheTtlMs === 0;
      if (!bypassCache) {
        const cached = readRunGetMethodCache(cacheKey, resolvedCacheTtlMs);
        if (cached) return cached;
      }
      const inFlightKey = typeof wanted === 'function' ? null : tonRpcInFlightKey(cacheKey, resolvedCacheTtlMs, {
        allowUnverifiedCriticalRead,
        skipIfRateLimited: skipIfRateLimited ?? options.skipRateLimitedGetMethods ?? true,
        priority: resolvedPriority,
        queueTimeoutMs,
        requestTimeoutMs,
        timeoutMs,
        verify,
      });
      const existing = inFlightKey === null ? null : toncenterRunGetMethodInFlight.get(inFlightKey);
      if (existing) return existing;
      const resolvedRequestTimeoutMs = resolveTonRpcRequestTimeoutMs({
        cacheTtlMs,
        ttlMs,
        priority,
        requestTimeoutMs,
        timeoutMs,
      }, options);
      const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) };
      if (apiKey) headers['X-API-Key'] = apiKey;
      const promise = (async () => {
        try {
          const response = await scheduleToncenterHttpRequest(
            endpoint,
            apiKey,
            () => fetchWithTonRpcTimeout(fetchImpl, endpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify(call),
            }, resolvedRequestTimeoutMs),
            {
              rateLimitKey: options.rateLimitKey,
              requestSpacingMs,
              rateLimitBackoffMs: callRateLimitBackoffMs,
              rateLimitRetries,
              skipIfRateLimited: skipIfRateLimited ?? options.skipRateLimitedGetMethods ?? true,
              priority: resolvedPriority,
              queueTimeoutMs,
              wanted,
              label: `get:${String(call?.method ?? '')}`,
            },
          );
          if (!response.ok) {
            throw toncenterHttpError('TON RPC get-method', response, rateLimitBackoffMs);
          }
          const json = await response.json();
          const exitCode = json.exit_code ?? json.exitCode ?? json.result?.exit_code ?? json.result?.exitCode ?? 0;
          if (Number(exitCode) !== 0) {
            throw new TonRpcTransportError(`TON RPC get-method exit code ${exitCode}`, { exitCode: Number(exitCode) });
          }
          writeRunGetMethodCache(cacheKey, json, resolvedCacheTtlMs, runGetMethodCacheMaxEntries);
          return json;
        } finally {
          if (inFlightKey !== null) toncenterRunGetMethodInFlight.delete(inFlightKey);
        }
      })();
      if (inFlightKey !== null) toncenterRunGetMethodInFlight.set(inFlightKey, promise);
      return promise;
    },
    async sendBoc(input = {}) {
      const {
        boc,
        requestTimeoutMs,
        timeoutMs,
        queueTimeoutMs,
        skipIfRateLimited,
        priority = 'critical',
      } = input;
      const endpointForSend = sendBocEndpoint;
      if (!endpointForSend) {
        throw new TonRpcTransportError('TON sendBoc endpoint is not configured');
      }
      const resolvedRequestTimeoutMs = resolveTonRpcRequestTimeoutMs({ priority, requestTimeoutMs, timeoutMs }, {
        ...options,
        requestTimeoutMs: options.sendBocRequestTimeoutMs ?? options.requestTimeoutMs,
      });
      const postThrough = (endpointToUse, oneShot = false) => {
        const keyForHost = endpointToUse === endpointForSend ? apiKey : null;
        const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) };
        if (keyForHost) headers['X-API-Key'] = keyForHost;
        return scheduleToncenterHttpRequest(
          endpointToUse,
          keyForHost,
          () => fetchWithTonRpcTimeout(fetchImpl, endpointToUse, {
            method: 'POST',
            headers,
            body: JSON.stringify({ boc }),
          }, resolvedRequestTimeoutMs),
          {
            rateLimitKey: options.rateLimitKey,
            requestSpacingMs,
            rateLimitBackoffMs: input.rateLimitBackoffMs,
            rateLimitRetries: oneShot
              ? 0
              : finiteNonNegativeMs(options.sendBocRateLimitRetries, Math.max(rateLimitRetries, 1)),
            serverErrorRetries: oneShot ? 0 : finiteNonNegativeMs(
              options.sendBocServerErrorRetries, TONCENTER_SEND_BOC_SERVER_ERROR_RETRIES,
            ),
            skipIfRateLimited: skipIfRateLimited === true,
            priority,
            queueTimeoutMs,
          },
        );
      };

      const alternate = firstBroadcastDoorForBytes(approximateBocBytes(boc), options.config ?? null);
      let response = null;
      let priorDeliveryAmbiguous = false;
      if (alternate && alternate.sendBocEndpoint !== endpointForSend) {
        try {
          const viaAlternate = await postThrough(alternate.sendBocEndpoint, true);
          if (viaAlternate?.ok) response = viaAlternate;
          else if (viaAlternate && Number(viaAlternate.status) >= 500 && !(await toncenterResponseCarriesChainRejection(viaAlternate))) {
            priorDeliveryAmbiguous = true;
          }
        } catch (error) {
          const status = Number(error?.status ?? error?.response?.status ?? 0);
          if (!(status >= 400) && String(error?.code ?? '') !== 'QUEUE_TIMEOUT') priorDeliveryAmbiguous = true;
        }
      }
      if (!response) {
        try {
          response = await postThrough(endpointForSend);
        } catch (error) {
          if (priorDeliveryAmbiguous && error && typeof error === 'object') { try { error.tonRpcPriorDeliveryAmbiguous = true; } catch { } }
          throw error;
        }
      }
      if (!response.ok) {
        const error = await toncenterHttpErrorWithBody('TON RPC sendBoc', response, rateLimitBackoffMs);
        if (response.plathoPriorDeliveryAmbiguous === true) priorDeliveryAmbiguous = true;
        if (priorDeliveryAmbiguous) { try { error.tonRpcPriorDeliveryAmbiguous = true; } catch { } }
        error.broadcastVerdict = classifyBroadcastDoorAnswer({
          status: response.status,
          body: typeof error.responseBody === 'string' ? error.responseBody : '',
          exitCode: error.chainExitCode ?? null,
        }).verdict;
        throw error;
      }
      let json = {};
      try { json = await response.json(); } catch { json = {}; }
      const ok = json.ok ?? json.result?.ok ?? true;
      if (ok === false) throw new TonRpcTransportError('TON RPC sendBoc rejected message');
      clearToncenterRunGetMethodCache({ endpoint, apiKey, rateLimitKey: options.rateLimitKey });
      clearToncenterMessagesCache();
      return json;
    },
    async getAccountState(input, requestOptions = {}) {
      if (!accountEndpoint) {
        throw new TonRpcTransportError('TON account state endpoint is not configured');
      }
      const address = typeof input === 'string' ? input : input?.address;
      const url = appendQueryParams(accountEndpoint, { address: assertString(address, 'TON account address') });
      const headers = { Accept: 'application/json', ...(options.headers ?? {}) };
      if (apiKey) headers['X-API-Key'] = apiKey;
      const requestTimeoutMs = resolveTonRpcRequestTimeoutMs(requestOptions, options);
      const response = await scheduleToncenterHttpRequest(
        accountEndpoint,
        apiKey,
        () => fetchWithTonRpcTimeout(fetchImpl, url, {
          method: 'GET',
          headers,
          cache: 'no-store',
        }, requestTimeoutMs),
        {
          rateLimitKey: options.rateLimitKey,
          requestSpacingMs,
          rateLimitBackoffMs: requestOptions.rateLimitBackoffMs,
          rateLimitRetries,
          skipIfRateLimited: requestOptions.skipIfRateLimited ?? true,
          priority: requestOptions.priority ?? 'wallet',
          queueTimeoutMs: requestOptions.queueTimeoutMs,
        },
      );
      if (!response.ok) {
        throw toncenterHttpError('TON RPC account state', response, rateLimitBackoffMs);
      }
      return response.json();
    },
    async getMasterchainInfo(requestOptions = {}) {
      const headers = { Accept: 'application/json', ...(options.headers ?? {}) };
      if (apiKey) headers['X-API-Key'] = apiKey;
      const requestTimeoutMs = resolveTonRpcRequestTimeoutMs(requestOptions, options);
      const response = await scheduleToncenterHttpRequest(
        masterchainInfoEndpoint,
        apiKey,
        () => fetchWithTonRpcTimeout(fetchImpl, masterchainInfoEndpoint, { method: 'GET', headers, cache: 'no-store' }, requestTimeoutMs),
        {
          rateLimitKey: options.rateLimitKey,
          requestSpacingMs,
          rateLimitBackoffMs: requestOptions.rateLimitBackoffMs,
          rateLimitRetries,
          skipIfRateLimited: requestOptions.skipIfRateLimited ?? false,
          priority: requestOptions.priority ?? 'critical',
          queueTimeoutMs: requestOptions.queueTimeoutMs,
        },
      );
      if (!response.ok) throw toncenterHttpError('TON RPC masterchain info', response, rateLimitBackoffMs);
      return response.json();
    },
    async getConfigParam(configId, requestOptions = {}) {
      if (!configParamEndpoint) throw new TonRpcTransportError('this TON RPC endpoint serves no config parameters');
      const headers = { Accept: 'application/json', ...(options.headers ?? {}) };
      if (apiKey) headers['X-API-Key'] = apiKey;
      const url = appendQueryParams(configParamEndpoint, { config_id: String(Number(configId)) });
      const requestTimeoutMs = resolveTonRpcRequestTimeoutMs(requestOptions, options);
      const response = await scheduleToncenterHttpRequest(
        configParamEndpoint,
        apiKey,
        () => fetchWithTonRpcTimeout(fetchImpl, url, { method: 'GET', headers, cache: 'no-store' }, requestTimeoutMs),
        {
          rateLimitKey: options.rateLimitKey,
          requestSpacingMs,
          rateLimitBackoffMs: requestOptions.rateLimitBackoffMs,
          rateLimitRetries,
          skipIfRateLimited: requestOptions.skipIfRateLimited ?? false,
          priority: requestOptions.priority ?? 'critical',
          queueTimeoutMs: requestOptions.queueTimeoutMs,
        },
      );
      if (!response.ok) throw toncenterHttpError('TON RPC config param', response, rateLimitBackoffMs);
      const body = await response.json();
      const bytes = body?.result?.config?.bytes;
      if (typeof bytes !== 'string' || bytes.length === 0) throw new TonRpcTransportError(`TON config param ${configId} came back without a cell`);
      return bytes;
    },
    async getAccountTransactionsLive(params = {}, requestOptions = {}) {
      if (!liveTransactionsEndpoint) throw new TonRpcTransportError('this TON RPC endpoint serves no live transaction list');
      const headers = { Accept: 'application/json', ...(options.headers ?? {}) };
      if (apiKey) headers['X-API-Key'] = apiKey;
      const query = { address: params.address, limit: String(Number(params.limit) || 8), archival: 'false' };
      if (params.lt && params.hash) { query.lt = String(params.lt); query.hash = String(params.hash); }
      const url = appendQueryParams(liveTransactionsEndpoint, query);
      const requestTimeoutMs = resolveTonRpcRequestTimeoutMs(requestOptions, options);
      const response = await scheduleToncenterHttpRequest(
        liveTransactionsEndpoint,
        apiKey,
        () => fetchWithTonRpcTimeout(fetchImpl, url, { method: 'GET', headers, cache: 'no-store' }, requestTimeoutMs),
        {
          rateLimitKey: options.rateLimitKey,
          requestSpacingMs,
          rateLimitBackoffMs: requestOptions.rateLimitBackoffMs,
          rateLimitRetries,
          skipIfRateLimited: requestOptions.skipIfRateLimited ?? false,
          priority: requestOptions.priority ?? 'critical',
          queueTimeoutMs: requestOptions.queueTimeoutMs,
        },
      );
      if (!response.ok) throw toncenterHttpError('TON RPC live transactions', response, rateLimitBackoffMs);
      const body = await response.json();
      if (body?.ok !== true || !Array.isArray(body?.result)) throw new TonRpcTransportError('the live transaction list came back without a list');
      return body.result;
    },
    async getAccountBalance(address, requestOptions = {}) {
      const state = await this.getAccountState({ address }, requestOptions);
      const value = state?.balance
        ?? state?.result?.balance
        ?? state?.account?.balance
        ?? state?.result?.account?.balance;
      if (value === undefined || value === null) {
        throw new TonRpcTransportError('TON account state did not include a balance');
      }
      return value;
    },
    async getAccountTransactions(params = {}, requestOptions = {}) {
      const query = stableQueryObject(params);
      const requestTimeoutMs = resolveTonRpcRequestTimeoutMs(requestOptions, options);
      const headers = { ...(options.headers ?? {}) };
      if (apiKey) headers['X-API-Key'] = apiKey;
      const url = appendQueryParams(transactionsEndpoint, query);
      const response = await scheduleToncenterHttpRequest(
        transactionsEndpoint,
        apiKey,
        () => fetchWithTonRpcTimeout(fetchImpl, url, { method: 'GET', headers, cache: 'no-store' }, requestTimeoutMs),
        {
          rateLimitKey: options.rateLimitKey,
          requestSpacingMs,
          rateLimitBackoffMs: requestOptions.rateLimitBackoffMs,
          rateLimitRetries,
          skipIfRateLimited: requestOptions.skipIfRateLimited ?? false,
          priority: requestOptions.priority ?? 'critical',
          queueTimeoutMs: requestOptions.queueTimeoutMs,
        },
      );
      if (!response.ok) throw toncenterHttpError('TON RPC transactions', response, rateLimitBackoffMs);
      return response.json();
    },
    async getMessages(params = {}, requestOptions = {}) {
      const query = stableQueryObject(params);
      const cacheKey = toncenterMessagesCacheKey(messagesEndpoint, apiKey, options.rateLimitKey, query);
      const resolvedCacheTtlMs = finiteNonNegativeMs(
        requestOptions.cacheTtlMs ?? requestOptions.ttlMs,
        TONCENTER_MESSAGES_CACHE_TTL_MS,
      );
      const bypassCache = resolvedCacheTtlMs === 0;
      if (!bypassCache) {
        const cached = readMessagesCache(cacheKey, resolvedCacheTtlMs);
        if (cached) return cached;
      }
      const inFlightKey = tonRpcInFlightKey(cacheKey, resolvedCacheTtlMs, requestOptions);
      const existing = toncenterMessagesInFlight.get(inFlightKey);
      if (existing) return existing;
      const requestTimeoutMs = resolveTonRpcRequestTimeoutMs(requestOptions, options);
      const headers = { ...(options.headers ?? {}) };
      if (apiKey) headers['X-API-Key'] = apiKey;
      const url = appendQueryParams(messagesEndpoint, query);
      const fetchOptions = { method: 'GET', headers, cache: 'no-store' };
      const promise = (async () => {
        try {
          const response = await scheduleToncenterHttpRequest(
            messagesEndpoint,
            apiKey,
            () => fetchWithTonRpcTimeout(fetchImpl, url, fetchOptions, requestTimeoutMs),
            {
              rateLimitKey: options.rateLimitKey,
              requestSpacingMs,
              rateLimitBackoffMs: requestOptions.rateLimitBackoffMs,
              rateLimitRetries,
              skipIfRateLimited: requestOptions.skipIfRateLimited ?? true,
              priority: requestOptions.priority ?? 'messages',
              queueTimeoutMs: requestOptions.queueTimeoutMs,
            },
          );
          if (!response.ok) {
            throw toncenterHttpError('TON RPC messages', response, rateLimitBackoffMs);
          }
          const json = await response.json();
          writeMessagesCache(cacheKey, json, resolvedCacheTtlMs, messagesCacheMaxEntries);
          return json;
        } finally {
          toncenterMessagesInFlight.delete(inFlightKey);
        }
      })();
      toncenterMessagesInFlight.set(inFlightKey, promise);
      return promise;
    },
  };
}

function isRetryableTonRpcError(error) {
  const status = Number(error?.status ?? error?.response?.status ?? 0);
  const code = String(error?.code ?? '').toUpperCase();
  const name = String(error?.name ?? '');
  return status === 429
    || status >= 500
    || code === 'RATE_LIMITED'
    || code === 'TIMEOUT'
    || code === 'NETWORK_ERROR'
    || name === 'TypeError'
    || /rate limit|timeout|network|failed to fetch/i.test(String(error?.message ?? error ?? ''));
}

function isSendBocTransportUnavailableError(error) {
  return /sendBoc (endpoint|transport) is not configured/i.test(String(error?.message ?? error ?? ''));
}

function tryParseStackBigIntValue(value) {
  try {
    return parseStackBigIntValue(value, 'TON RPC compare value');
  } catch {
    return null;
  }
}

function normalizeTonRpcGenericForCompare(value) {
  if (typeof value === 'bigint') return { type: 'int', value: value.toString() };
  if (Array.isArray(value)) return value.map((item) => normalizeTonRpcGenericForCompare(item));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = normalizeTonRpcGenericForCompare(value[key]);
  }
  return out;
}

function normalizeTonRpcStackItemForCompare(item) {
  const type = stackItemType(item);
  const value = stackItemValue(item);
  const typedInt = tryParseStackBigIntValue(value);
  if (type.includes('bool')) {
    return { type: 'bool', value: typedInt !== null ? typedInt !== 0n : Boolean(value) };
  }
  if (
    typedInt !== null
    && (
      type.includes('num')
      || type.includes('int')
      || type === 'number'
      || typeof value === 'bigint'
      || typeof value === 'number'
    )
  ) {
    return { type: 'int', value: typedInt.toString() };
  }
  if (typeof value === 'boolean') {
    return { type: 'bool', value };
  }
  if (typeof value === 'string') {
    if (type.includes('addr') || /^-?\d+:[0-9a-fA-F]{64}$/.test(value.trim())) {
      try {
        return { type: 'address', value: parseTonAddress(value).raw };
      } catch {
      }
    }
    if (type.includes('slice')) {
      try {
        return { type: 'address', value: decodeTonAddressSliceBoc(value) };
      } catch {
        return { type: 'slice', value };
      }
    }
    if (type.includes('cell')) return { type: 'cell', value };
  }
  if (Array.isArray(value)) {
    return { type: type || 'tuple', value: value.map((nested) => normalizeTonRpcStackItemForCompare(nested)) };
  }
  return normalizeTonRpcGenericForCompare(item);
}

function normalizeTonRpcStackForCompare(result) {
  const stack = result?.stack ?? result?.result?.stack;
  if (Array.isArray(stack)) {
    return stack.map((item) => normalizeTonRpcStackItemForCompare(item));
  }
  return null;
}

function normalizeTonRpcResultForCompare(result, method = null) {
  const stack = normalizeTonRpcStackForCompare(result);
  if (Array.isArray(stack)) {
    const methodName = String(method);
    if (methodName === 'get_user') {
      return stableJsonString([
        stack[0] ?? null,
        stack[3] ?? null,
        stack[4] ?? null,
      ]);
    }
    if (methodName === 'get_global') {
      return stableJsonString(stack.slice(0, 6));
    }
    return stableJsonString(stack);
  }
  return stableJsonString(normalizeTonRpcGenericForCompare(result));
}

function tonRpcDisagreementError(method, primaryKind, verifierKind) {
  return new TonRpcTransportError(`TON RPC disagreement for ${method}`, {
    code: 'RPC_DISAGREEMENT',
    primaryKind,
    verifierKind,
  });
}

function configuredProviderList(config = {}) {
  const providers = Array.isArray(config.providers) && config.providers.length > 0
    ? [...config.providers]
    : [config];
  const byId = new Map(providers.map((provider, index) => [String(provider?.id ?? index), provider]));
  const ordered = [];
  const pushId = (id) => {
    if (id === undefined || id === null) return;
    const provider = byId.get(String(id));
    if (provider && !ordered.includes(provider)) ordered.push(provider);
  };
  pushId(config.primaryProviderId ?? config.primaryProvider);
  for (const id of config.fallbackProviderIds ?? config.fallbackProviders ?? []) pushId(id);
  for (const provider of providers) {
    if (!ordered.includes(provider)) ordered.push(provider);
  }
  return ordered;
}

export function effectiveToncenterRequestSpacingMs(provider = {}, defaults = {}) {
  const userKeyMissing = (provider?.useUserApiKey ?? defaults.useUserApiKey) === true
    && !(provider?.apiKey ?? defaults.apiKey)
    && !globalThis.plathoToncenterApiKey;
  const configuredSpacingMs = provider?.requestSpacingMs ?? defaults.requestSpacingMs;
  return userKeyMissing
    ? Math.max(Number(configuredSpacingMs ?? 0) || 0, TONCENTER_KEYLESS_REQUEST_SPACING_MS)
    : configuredSpacingMs;
}

export function beginTonRpcPhaseProfile() {
  const startedAt = Date.now();
  const before = { at: startedAt, n: tonRpcRequestCounters.total, ms: tonRpcRequestCounters.ms };
  const phases = {};
  let cursor = before;
  return {
    startedAt,
    phases,
    mark(name) {
      const now = { at: Date.now(), n: tonRpcRequestCounters.total, ms: tonRpcRequestCounters.ms };
      const prior = phases[name];
      const span = { ms: now.at - cursor.at, req: now.n - cursor.n, netMs: now.ms - cursor.ms };
      phases[name] = prior
        ? { ms: prior.ms + span.ms, req: prior.req + span.req, netMs: prior.netMs + span.netMs, n: (prior.n ?? 1) + 1 }
        : span;
      cursor = now;
    },
    summary() {
      return {
        at: new Date().toISOString(),
        totalMs: Date.now() - startedAt,
        spacingMs: toncenterScanLaneOptions()?.requestSpacingMs ?? null,
        phases,
        sinceLoad: {
          req: tonRpcRequestCounters.total,
          netMs: tonRpcRequestCounters.ms,
          byLeaf: { ...tonRpcRequestCounters.byLeaf },
        },
      };
    },
  };
}

let broadcastDoorCursor = 0;

export function __resetBroadcastDoorCursorForTests() {
  broadcastDoorCursor = 0;
}

export function broadcastDoors(config = null) {
  const resolved = config ?? globalThis.plathoTonRpcConfig ?? null;
  const doors = Array.isArray(resolved?.broadcastDoors) ? resolved.broadcastDoors : [];
  return doors.filter((door) => typeof door?.sendBocEndpoint === 'string' && door.sendBocEndpoint);
}

export function approximateBocBytes(boc) {
  if (typeof boc !== 'string' || boc.length === 0) return 0;
  return Math.ceil((boc.length * 3) / 4);
}

function isToncenterHost(endpoint) {
  try {
    return /(^|\.)toncenter\.com$/i.test(new URL(endpoint).hostname);
  } catch {
    return false;
  }
}

let firstBroadcastDoorCursor = -1;

export function __resetFirstBroadcastDoorCursorForTests() {
  firstBroadcastDoorCursor = -1;
}

export function firstBroadcastDoorForBytes(bocBytes, config = null) {
  const resolved = config ?? globalThis.plathoTonRpcConfig ?? null;
  const threshold = Number(resolved?.firstBroadcastAlternateDoorAboveBytes ?? 0);
  if (!Number.isFinite(threshold) || threshold <= 0) return null;
  if (!(Number(bocBytes) > threshold)) return null;
  const alternates = broadcastDoors(resolved).filter((door) => !isToncenterHost(door.sendBocEndpoint));
  if (alternates.length === 0) return null;
  firstBroadcastDoorCursor = (firstBroadcastDoorCursor + 1) % alternates.length;
  return alternates[firstBroadcastDoorCursor];
}

export function classifyBroadcastDoorAnswer({ status, body, exitCode = null } = {}) {
  const code = status === null || status === undefined ? NaN : Number(status);
  const text = typeof body === 'string' ? body : '';
  const chainExitCode = exitCode ?? toncenterBroadcastExitCode(text);
  const rejectedByChain = code === 406
    || chainExitCode != null
    || /cannot apply external message/i.test(text);
  return {
    status: Number.isFinite(code) ? code : null,
    chainExitCode,
    exitCode: chainExitCode,
    rejectedByChain,
    verdict: broadcastVerdictOf({ status: code, rejectedByChain }),
    detail: toncenterHttpErrorDetail(text).slice(0, 200) || null,
  };
}

export const BROADCAST_VERDICT = Object.freeze({
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  BROKEN: 'broken',
  REFUSED: 'refused',
  UNKNOWN: 'unknown',
});

function broadcastVerdictOf({ status, rejectedByChain }) {
  const code = Number(status);
  if (!Number.isFinite(code) || code <= 0) return BROADCAST_VERDICT.UNKNOWN;
  if (code >= 200 && code < 300) return BROADCAST_VERDICT.ACCEPTED;
  if (rejectedByChain) return BROADCAST_VERDICT.REJECTED;
  if (code >= 500) return BROADCAST_VERDICT.BROKEN;
  return BROADCAST_VERDICT.REFUSED;
}

export async function broadcastThroughNextDoor(boc, options = {}) {
  const doors = broadcastDoors(options.config ?? null);
  if (doors.length === 0 || typeof boc !== 'string' || !boc) return null;
  broadcastDoorCursor = (broadcastDoorCursor + 1) % doors.length;
  const door = doors[broadcastDoorCursor];
  const lane = toncenterScanLaneOptions(options.config ?? null);
  try {
    const response = await scheduleToncenterHttpRequest(
      door.sendBocEndpoint,
      null,
      () => fetchWithTonRpcTimeout(fetchImplFor(options), door.sendBocEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boc }),
      }, finiteNonNegativeMs(door.requestTimeoutMs, BROADCAST_DOOR_TIMEOUT_MS)),
      {
        ...lane,
        priority: 'background',
        skipIfRateLimited: true,
      },
    );
    const status = response?.status ?? null;
    const seqno = options.seqno ?? null;
    if (response && response.ok === false) {
      let body = '';
      try { body = typeof response.text === 'function' ? await response.text() : ''; } catch { body = ''; }
      return { door: door.id, seqno, ...classifyBroadcastDoorAnswer({ status, body }) };
    }
    return { door: door.id, seqno, ...classifyBroadcastDoorAnswer({ status, body: '' }) };
  } catch {
    return { door: door.id, seqno: options.seqno ?? null, ...classifyBroadcastDoorAnswer({ status: null, body: '' }) };
  }
}

const BROADCAST_DOOR_TIMEOUT_MS = 8_000;

function fetchImplFor(options) {
  return options.fetch ?? options.fetchImpl ?? globalThis.fetch;
}

export function toncenterScanLaneOptions(config = null) {
  const resolved = config ?? globalThis.plathoTonRpcConfig ?? null;
  if (!resolved) return {};
  const provider = configuredProviderList(resolved)[0] ?? {};
  const rateLimitKey = provider.rateLimitKey ?? resolved.rateLimitKey ?? null;
  const requestSpacingMs = effectiveToncenterRequestSpacingMs(provider, resolved);
  return {
    ...(rateLimitKey ? { rateLimitKey } : {}),
    ...(Number.isFinite(Number(requestSpacingMs)) ? { requestSpacingMs: Number(requestSpacingMs) } : {}),
  };
}

function stringSet(value) {
  if (!Array.isArray(value)) return null;
  const out = new Set(value.map((item) => String(item)).filter(Boolean));
  return out.size > 0 ? out : null;
}

function withRunGetMethodCapabilities(transport, provider = {}, defaults = {}) {
  if (!transport) return transport;
  const supportedGetMethods = stringSet(provider.supportedGetMethods ?? provider.allowedGetMethods ?? defaults.supportedGetMethods ?? defaults.allowedGetMethods);
  const unsupportedGetMethods = stringSet(provider.unsupportedGetMethods ?? provider.blockedGetMethods ?? defaults.unsupportedGetMethods ?? defaults.blockedGetMethods);
  const verifierOnly = provider.verifierOnly === true || provider.verifyOnly === true || transport.verifierOnly === true;
  const emergencyFallback = provider.emergencyFallback ?? transport.emergencyFallback;
  if (!verifierOnly && !supportedGetMethods && !unsupportedGetMethods && typeof transport.supportsRunGetMethod === 'function') return transport;
  const baseSupports = typeof transport.supportsRunGetMethod === 'function'
    ? (method) => transport.supportsRunGetMethod(method)
    : () => true;
  return {
    ...transport,
    verifierOnly,
    ...(emergencyFallback === undefined ? {} : { emergencyFallback: emergencyFallback === true }),
    supportedGetMethods: supportedGetMethods ? [...supportedGetMethods] : transport.supportedGetMethods,
    unsupportedGetMethods: unsupportedGetMethods ? [...unsupportedGetMethods] : transport.unsupportedGetMethods,
    supportsRunGetMethod(method) {
      const name = String(method ?? '');
      if (!name) return false;
      if (supportedGetMethods && !supportedGetMethods.has(name)) return false;
      if (unsupportedGetMethods?.has(name)) return false;
      return baseSupports(name) !== false;
    },
  };
}

function transportSupportsReadMethod(transport, methodName, call = {}) {
  if (typeof transport?.[methodName] !== 'function') return false;
  if (methodName !== 'runGetMethod') return true;
  if (typeof transport.supportsRunGetMethod !== 'function') return true;
  return transport.supportsRunGetMethod(call?.method) !== false;
}

export function createTonRpcTransportFromConfig(provider = {}, defaults = {}) {
  if (provider?.runGetMethod || provider?.sendBoc || provider?.getMessages) {
    return withRunGetMethodCapabilities(provider, provider, defaults);
  }
  if (provider?.globalName && globalThis[provider.globalName]) {
    return withRunGetMethodCapabilities(globalThis[provider.globalName], provider, defaults);
  }
  const kind = String(provider?.kind ?? provider?.type ?? 'toncenter-v3').toLowerCase();
  if ((kind === 'custom' || kind === 'user' || kind === 'external') && provider?.globalName) {
    return null;
  }
  const endpoint = provider?.runGetMethodEndpoint
    ?? provider?.endpoint
    ?? defaults.runGetMethodEndpoint
    ?? defaults.endpoint;
  if (!endpoint) return null;
  if (!['toncenter-v3', 'toncenter', 'platho-rpc', 'json-rpc-compatible'].includes(kind)) {
    throw new TonRpcTransportError(`Unsupported TON RPC provider kind: ${kind}`);
  }
  const effectiveRequestSpacingMs = effectiveToncenterRequestSpacingMs(provider, defaults);
  const transport = createTonCenterV3Transport({
    endpoint,
    messagesEndpoint: provider?.messagesEndpoint ?? defaults.messagesEndpoint,
    sendBocEndpoint: provider?.sendBocEndpoint ?? defaults.sendBocEndpoint,
    accountEndpoint: provider?.accountEndpoint ?? provider?.walletBalanceEndpoint ?? defaults.accountEndpoint ?? defaults.walletBalanceEndpoint,
    apiKey: provider?.apiKey ?? defaults.apiKey ?? null,
    useUserApiKey: provider?.useUserApiKey ?? defaults.useUserApiKey,
    headers: provider?.headers ?? defaults.headers,
    fetch: provider?.fetch ?? defaults.fetch,
    requestSpacingMs: effectiveRequestSpacingMs,
    rateLimitBackoffMs: provider?.rateLimitBackoffMs ?? defaults.rateLimitBackoffMs,
    rateLimitRetries: provider?.rateLimitRetries ?? defaults.rateLimitRetries,
    sendBocRateLimitRetries: provider?.sendBocRateLimitRetries ?? defaults.sendBocRateLimitRetries,
    requestTimeoutMs: provider?.requestTimeoutMs ?? defaults.requestTimeoutMs,
    sendBocRequestTimeoutMs: provider?.sendBocRequestTimeoutMs ?? defaults.sendBocRequestTimeoutMs,
    skipRateLimitedGetMethods: provider?.skipRateLimitedGetMethods ?? defaults.skipRateLimitedGetMethods,
    runGetMethodCacheTtlMs: provider?.runGetMethodCacheTtlMs ?? defaults.runGetMethodCacheTtlMs,
    runGetMethodCacheMaxEntries: provider?.runGetMethodCacheMaxEntries ?? defaults.runGetMethodCacheMaxEntries,
    runGetMethodCacheTtls: provider?.runGetMethodCacheTtls ?? defaults.runGetMethodCacheTtls,
    runGetMethodPriorities: provider?.runGetMethodPriorities ?? defaults.runGetMethodPriorities,
    messagesCacheMaxEntries: provider?.messagesCacheMaxEntries ?? defaults.messagesCacheMaxEntries,
    rateLimitKey: provider?.rateLimitKey ?? defaults.rateLimitKey,
  });
  return withRunGetMethodCapabilities(transport, provider, defaults);
}

function orderedTonRpcTransportCandidates(transports, isEligible) {
  const now = monotonicNow();
  const alivePrimary = [];
  const aliveEmergency = [];
  const deadPrimary = [];
  const deadEmergency = [];
  for (const transport of transports) {
    if (!isEligible(transport)) continue;
    if (transport?.verifierOnly === true && !isEmergencyFallbackTransport(transport)) continue;
    const dead = isTonRpcTransportDead(transport, now);
    if (isEmergencyFallbackTransport(transport)) {
      (dead ? deadEmergency : aliveEmergency).push(transport);
    } else {
      (dead ? deadPrimary : alivePrimary).push(transport);
    }
  }
  return [...alivePrimary, ...aliveEmergency, ...deadPrimary, ...deadEmergency];
}

export function createFallbackTonRpcTransport(options = {}) {
  const transports = (options.transports ?? [])
    .map((transport) => transport?.transport ?? transport)
    .filter(Boolean);
  if (transports.length === 0) return null;
  const criticalMethods = new Set((options.criticalMethods ?? TON_RPC_CRITICAL_METHODS).map(String));
  const verifyCriticalReads = options.verifyCriticalReads === true;
  const transportDeadRetryMs = finiteNonNegativeMs(options.transportDeadRetryMs, TON_RPC_TRANSPORT_DEAD_RETRY_MS);
  const kind = options.kind ?? `fallback(${transports.map((transport) => transport.kind ?? 'ton-rpc').join(',')})`;

  async function callRead(methodName, args, requestOptions = {}) {
    const requestTimeoutMs = tonRpcOperationTimeoutMs(requestOptions, options);
    const givenQueueMs = requestOptions?.queueTimeoutMs ?? args[0]?.queueTimeoutMs;
    const queueAllowanceMs = finiteNonNegativeMs(givenQueueMs, TON_RPC_MAX_QUEUE_WAIT_MS);
    const operationTimeoutMs = requestTimeoutMs > 0 ? requestTimeoutMs + queueAllowanceMs : 0;
    const boundedArgs = givenQueueMs !== undefined && givenQueueMs !== null ? args
      : (methodName === 'runGetMethod' || methodName === 'getMasterchainInfo'
        ? [{ ...(args[0] ?? {}), queueTimeoutMs: queueAllowanceMs }, ...args.slice(1)]
        : [args[0], { ...(args[1] ?? {}), queueTimeoutMs: queueAllowanceMs }, ...args.slice(2)]);
    const boundFor = (transport) => (transport?.queuesRequests === true ? operationTimeoutMs : requestTimeoutMs);
    const congestionBound = (error, transport) => {
      if (transport?.queuesRequests === true && error?.code === 'TIMEOUT' && error?.operationBound === true) {
        try { error.code = 'QUEUE_TIMEOUT'; } catch { }
      }
      return error;
    };
    let primaryResult = null;
    let primaryTransport = null;
    let lastError = null;
    const call = args[0] ?? {};
    const candidates = orderedTonRpcTransportCandidates(
      transports,
      (transport) => transportSupportsReadMethod(transport, methodName, call),
    );
    for (const transport of candidates) {
      try {
        primaryResult = await withTonRpcOperationTimeout(
          () => transport[methodName](...boundedArgs),
          boundFor(transport),
        ).catch((error) => { throw congestionBound(error, transport); });
        noteTonRpcTransportSuccess(transport);
        primaryTransport = transport;
        break;
      } catch (error) {
        if (error?.code === 'NOT_WANTED') throw error;
        if (!tonRpcErrorIsUninitializedAccount(lastError) || tonRpcErrorIsUninitializedAccount(error)) lastError = error;
        if (
          tonRpcErrorIsUninitializedAccount(error)
          && (call?.stopOnUninitializedAccount === true || requestOptions.stopOnUninitializedAccount === true)
        ) {
          throw error;
        }
        noteTonRpcTransportFailure(transport, error, transportDeadRetryMs);
      }
    }
    if (!primaryTransport) throw lastError ?? new TonRpcTransportError(`TON RPC ${methodName} transport is not configured`);
    const method = call?.method ?? methodName;
    const allowUnverifiedCriticalRead = requestOptions.allowUnverifiedCriticalRead === true
      || call?.allowUnverifiedCriticalRead === true;
    const mustVerify = !allowUnverifiedCriticalRead && (
      requestOptions.verify === true
      || call?.verify === true
      || (verifyCriticalReads && criticalMethods.has(String(method)))
    );
    if (!mustVerify) return primaryResult;
    const primaryComparable = normalizeTonRpcResultForCompare(primaryResult, method);
    let verified = false;
    let verifyError = null;
    let eligibleVerifierTried = false;
    for (const transport of transports) {
      if (transport === primaryTransport || !transportSupportsReadMethod(transport, methodName, call)) continue;
      if (isEmergencyFallbackTransport(transport)) continue;
      if (isTonRpcTransportDead(transport)) continue;
      eligibleVerifierTried = true;
      try {
        const verifierResult = await withTonRpcOperationTimeout(
          () => transport[methodName](...boundedArgs),
          boundFor(transport),
        ).catch((error) => { throw congestionBound(error, transport); });
        noteTonRpcTransportSuccess(transport);
        verified = true;
        if (normalizeTonRpcResultForCompare(verifierResult, method) !== primaryComparable) {
          throw tonRpcDisagreementError(method, primaryTransport.kind, transport.kind);
        }
        break;
      } catch (error) {
        verifyError = error;
        if (error?.code === 'RPC_DISAGREEMENT') throw error;
        noteTonRpcTransportFailure(transport, error, transportDeadRetryMs);
      }
    }
    if (mustVerify && !verified) {
      if (!eligibleVerifierTried) return primaryResult;
      throw new TonRpcTransportError(`TON RPC verification unavailable for ${method}`, {
        code: 'RPC_VERIFICATION_UNAVAILABLE',
        cause: verifyError,
      });
    }
    return primaryResult;
  }

  async function callSend(methodName, args) {
    const requestTimeoutMs = tonRpcOperationTimeoutMs(args[0] ?? {}, options);
    const queueAllowanceMs = finiteNonNegativeMs(args[0]?.queueTimeoutMs, 0);
    const operationTimeoutMs = requestTimeoutMs > 0 ? requestTimeoutMs + queueAllowanceMs : 0;
    let lastError = null;
    let priorDeliveryAmbiguous = false;
    const candidates = orderedTonRpcTransportCandidates(transports, (transport) => {
      if (typeof transport?.[methodName] !== 'function') return false;
      if (methodName === 'sendBoc' && transport.supportsSendBoc === false) return false;
      return true;
    });
    for (const transport of candidates) {
      try {
        const result = await withTonRpcOperationTimeout(
          () => transport[methodName](...args),
          operationTimeoutMs,
        );
        noteTonRpcTransportSuccess(transport);
        clearToncenterRunGetMethodCache();
        clearToncenterMessagesCache();
        return result;
      } catch (error) {
        lastError = error;
        if (methodName === 'sendBoc' && isSendBocTransportUnavailableError(error)) continue;
        if (methodName === 'sendBoc' && priorDeliveryAmbiguous) {
          try { error.tonRpcPriorDeliveryAmbiguous = true; } catch { }
        }
        if (methodName === 'sendBoc') {
          const status = Number(error?.status ?? error?.response?.status ?? 0);
          if (status < 400 && String(error?.code ?? '') !== 'QUEUE_TIMEOUT') priorDeliveryAmbiguous = true;
        }
        noteTonRpcTransportFailure(transport, error, transportDeadRetryMs);
        if (
          methodName === 'sendBoc'
          && !isEmergencyFallbackTransport(transport)
          && Number(error?.status ?? error?.response?.status ?? 0) >= 500
        ) throw error;
        if (!isRetryableTonRpcError(error) && !isTonRpcHardTransportError(error)) throw error;
      }
    }
    throw lastError ?? new TonRpcTransportError(`TON RPC ${methodName} transport is not configured`);
  }

  return {
    kind,
    transports,
    isDegraded() {
      return transports.some((transport) => transport?.verifierOnly !== true && isTonRpcTransportDead(transport));
    },
    isVerificationDegraded() {
      const aliveReadCapable = transports.filter(
        (transport) => typeof transport?.runGetMethod === 'function'
          && !isEmergencyFallbackTransport(transport)
          && !isTonRpcTransportDead(transport),
      );
      return aliveReadCapable.length < 2;
    },
    healthSnapshot() {
      return transports.map((transport) => ({
        kind: transport?.kind ?? 'ton-rpc',
        verifierOnly: transport?.verifierOnly === true,
        emergencyFallback: isEmergencyFallbackTransport(transport),
        dead: isTonRpcTransportDead(transport),
        consecutiveHardFailures: tonRpcTransportHealth.get(transport)?.consecutiveHardFailures ?? 0,
      }));
    },
    async runGetMethod(call) {
      return callRead('runGetMethod', [call], call ?? {});
    },
    async getMessages(params = {}, requestOptions = {}) {
      return callRead('getMessages', [params, requestOptions], requestOptions);
    },
    async getAccountTransactions(params = {}, requestOptions = {}) {
      return callRead('getAccountTransactions', [params, requestOptions], requestOptions);
    },
    async getAccountState(input, requestOptions = {}) {
      return callRead('getAccountState', [input, requestOptions], requestOptions);
    },
    async getAccountBalance(address, requestOptions = {}) {
      return callRead('getAccountBalance', [address, requestOptions], requestOptions);
    },
    async getMasterchainInfo(requestOptions = {}) {
      return callRead('getMasterchainInfo', [requestOptions], requestOptions);
    },
    async getConfigParam(configId, requestOptions = {}) {
      return callRead('getConfigParam', [configId, requestOptions], requestOptions);
    },
    async getAccountTransactionsLive(params = {}, requestOptions = {}) {
      return callRead('getAccountTransactionsLive', [params, requestOptions], requestOptions);
    },
    async sendBoc(input) {
      return callSend('sendBoc', [input]);
    },
  };
}

export function createTonRpcTransport(config = {}, options = {}) {
  const providerConfigs = configuredProviderList(config);
  const transports = providerConfigs
    .map((provider) => createTonRpcTransportFromConfig(provider, { ...config, ...options }))
    .filter(Boolean);
  return createFallbackTonRpcTransport({
    transports,
    verifyCriticalReads: config.verifyCriticalReads,
    criticalMethods: config.criticalMethods,
    requestTimeoutMs: config.requestTimeoutMs,
    transportDeadRetryMs: config.transportDeadRetryMs ?? options.transportDeadRetryMs,
  });
}

