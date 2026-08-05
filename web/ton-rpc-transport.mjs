import { parseTonAddress } from './crypto/platho-crypto.mjs?v=13';


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
const TONCENTER_RATE_LIMIT_BACKOFF_MS = 60_000;
const TONCENTER_MAX_RETRY_AFTER_MS = 120_000;
const TONCENTER_RATE_LIMIT_RETRIES = 0;
// Backoff STEP for a 5xx retry (multiplied by the attempt: 400 / 800 / 1200 ms). Short on purpose — a broadcast that
// waits seconds has already lost the race with the user's patience, and the whole point is to beat the app-level
// retry ladder to the punch.
const TONCENTER_SERVER_ERROR_BACKOFF_MS = 400;
// Broadcast only. Reads keep 0: a read is cheap to repeat on the next tick, a lost broadcast costs a message.
const TONCENTER_SEND_BOC_SERVER_ERROR_RETRIES = 3;
const TONCENTER_RUN_GET_METHOD_CACHE_TTL_MS = 15_000;
const TONCENTER_RUN_GET_METHOD_CACHE_MAX_ENTRIES = 512;
const TONCENTER_MESSAGES_CACHE_TTL_MS = 300_000;
const TONCENTER_MESSAGES_CACHE_MAX_ENTRIES = 128;
// Exported: app.js's size-scaled sendBoc ceiling (vaultSendBocRequestTimeoutMs) uses this as its base
// for callers that pass no explicit ceiling — importing it keeps the two from silently diverging.
export const TON_RPC_REQUEST_TIMEOUT_MS = 15_000;
// TON aborts a get-method run against an account that has no code (e.g. a
// never-deployed wallet) with this exit code. It is a definitive on-chain
// answer that every node agrees on — not a transport failure — so a caller that
// opts in (the wallet seqno read, which treats it as "seqno 0, deploy on first
// transfer") can stop the multi-transport fallback the moment it sees it,
// instead of spending the censorship-survival transports re-asking a settled
// question.
const TON_GET_METHOD_UNINITIALIZED_EXIT_CODE = -13;
// Anonymous (no-key) toncenter is a HARD ~1 rps per-IP limit with NO burst grace. The shared anonymous budget
// (#F: all 'toncenter.com|public' traffic) is paced at this spacing; a keyed user-toncenter uses its own 125ms
// (8 rps) bucket. 1100ms = ~0.91 rps leaves ~100ms headroom for RTT jitter under the 1 rps ceiling (tuned up
// from the original conservative 1500ms/0.67 rps "forsazh" experiment). If 429s reappear on no-key bursts,
// raise this back toward 1250-1500ms; the ceiling is empirical per-network (client spacing + RTT jitter).
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
  messages: 1,
  wallet: 2,
  profile: 3,
  background: 4,
});
const toncenterRequestStates = new Map();
const toncenterRunGetMethodInFlight = new Map();
const toncenterRunGetMethodCache = new Map();
const toncenterMessagesInFlight = new Map();
const toncenterMessagesCache = new Map();
// Censorship-survival transport health: a primary provider that hard-fails
// repeatedly (blocked host, DNS reset, 5xx) is parked for a retry window and
// verifier-only providers are promoted to full emergency duty meanwhile.
const TON_RPC_TRANSPORT_HARD_FAILURE_THRESHOLD = 2;
const TON_RPC_TRANSPORT_DEAD_RETRY_MS = 30_000;
// A verifier-only transport that answers 401/403 is denied by policy for this
// network (e.g. keyless toncenter blocked in a region). Park it for minutes,
// not seconds: a short window makes every sync cycle re-probe it, eat the
// verification failure on its first critical read, and fail the whole cycle -
// the "perpetually syncing, never loads" symptom. A long park keeps reads in
// the clean degraded path and re-probes only occasionally.
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

export function isTonRpcTransportDead(transport, now = Date.now()) {
  const state = tonRpcTransportHealth.get(transport);
  return Boolean(state && state.deadUntil > now);
}

function isTonRpcHardTransportError(error) {
  // Rate limiting and local queue congestion mean the provider is alive;
  // only connectivity-level failures count toward parking a transport.
  const status = Number(error?.status ?? 0);
  const code = String(error?.code ?? '').toUpperCase();
  if (status === 429 || code === 'RATE_LIMITED' || code === 'QUEUE_TIMEOUT' || code === 'RPC_DISAGREEMENT') return false;
  if (code === 'TIMEOUT' || code === 'NETWORK_ERROR') return true;
  if (status >= 400) return true;
  if (String(error?.name ?? '') === 'TypeError') return true;
  return /failed to fetch|network|dns|connection|load failed/i.test(String(error?.message ?? error ?? ''));
}

function tonRpcErrorIsUninitializedAccount(error) {
  return Number(error?.exitCode) === TON_GET_METHOD_UNINITIALIZED_EXIT_CODE;
}

function noteTonRpcTransportFailure(transport, error, deadRetryMs = TON_RPC_TRANSPORT_DEAD_RETRY_MS) {
  if (!transport) return;
  const status = Number(error?.status ?? 0);
  const code = String(error?.code ?? '').toUpperCase();
  // A verifier-only transport is unusable as the second verifier when it answers
  // 401/403 (policy denial, e.g. keyless toncenter blocked for this network) OR
  // 429/rate-limited (keyless toncenter is ~1 rps and cannot keep up as a live
  // verifier under sync load). Either way, park it at once so dual-provider
  // verification degrades to the live gateway via criticalChainReadOptions
  // instead of throwing "verification unavailable" on every critical read and
  // re-hammering the throttled host each cycle. Primaries keep the failure
  // threshold so an app-level 4xx -- or a transient 429 -- cannot park the main
  // gateway by accident (429 is never a hard error for a non-verifier transport).
  const verifierUnavailable = transport?.verifierOnly === true
    && (status === 401 || status === 403 || status === 429 || code === 'RATE_LIMITED');
  if (!verifierUnavailable && !isTonRpcHardTransportError(error)) return;
  const state = tonRpcTransportHealthState(transport);
  state.consecutiveHardFailures += 1;
  state.lastHardFailureAt = Date.now();
  if (verifierUnavailable) {
    state.deadUntil = Date.now() + Math.max(
      finiteNonNegativeMs(deadRetryMs, TON_RPC_TRANSPORT_DEAD_RETRY_MS),
      TON_RPC_VERIFIER_DENIAL_PARK_MS,
    );
  } else if (state.consecutiveHardFailures >= TON_RPC_TRANSPORT_HARD_FAILURE_THRESHOLD) {
    state.deadUntil = Date.now() + finiteNonNegativeMs(deadRetryMs, TON_RPC_TRANSPORT_DEAD_RETRY_MS);
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
  // Park a verifier-only read transport that just rate-limited (429) on a code
  // path that calls it DIRECTLY (e.g. CapsuleHub message-history getMessages)
  // rather than through callRead. Without this, that path keeps hammering the
  // throttled keyless verifier (~1 rps) every cycle — the direct toncenter
  // /api/v3/messages 429 storm seen under burst load. Reuses the same health map
  // + verifier-denial park window as the get-method read path; a non-verifier
  // (gateway) 429 is a no-op here (429 never parks a primary), so it is safe to
  // call for any history transport.
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

/**
 * EVERY toncenter request this client makes passes through fetchWithTonRpcTimeout, which is what makes it the one
 * place worth counting. The counters are cumulative and free (two increments); a caller snapshots them around a
 * phase and reports the delta, so "where did the minute go" is answered by subtraction instead of by argument.
 *
 * Added 2026-08-04, after a boot that still felt slow with the decryption already down to zero and two rounds of
 * reasoning failing to say why. The endpoint LEAF is the useful grain — /messages is history, /runGetMethod is a
 * getter, /accountStates is a batched probe — and it costs nothing to keep.
 */
export const tonRpcRequestCounters = { total: 0, ms: 0, byLeaf: Object.create(null) };

function noteTonRpcRequest(url, startedAt) {
  const ms = Date.now() - startedAt;
  tonRpcRequestCounters.total += 1;
  tonRpcRequestCounters.ms += ms;
  let leaf = 'other';
  try { leaf = new URL(String(url)).pathname.split('/').pop() || 'other'; } catch { /* keep 'other' */ }
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
        // Ignore abort wiring failures and still reject with a typed timeout.
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
    timeoutId = setTimeout(() => reject(tonRpcTimeoutError(resolvedTimeoutMs)), resolvedTimeoutMs);
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
    priority: options.priority ?? null,
    queueTimeoutMs: options.queueTimeoutMs ?? null,
    requestTimeoutMs: options.requestTimeoutMs ?? null,
    timeoutMs: options.timeoutMs ?? null,
    verify: options.verify === false ? false : (options.verify === true ? true : null),
  });
}

function tonRpcInFlightKey(cacheKey, cacheTtlMs, options = {}) {
  if (cacheTtlMs === 0) return `${cacheKey}|fresh|${tonRpcFreshInFlightOptionsKey(options)}`;
  return `${cacheKey}|cached`;
}

function resolveRunGetMethodPriority(method, callOptions, transportOptions) {
  const priorities = mergeRunGetMethodPriorities(transportOptions.runGetMethodPriorities);
  return String(callOptions?.priority ?? priorities[method] ?? 'background');
}

function toncenterPriorityWeight(priority) {
  return TONCENTER_REQUEST_PRIORITY_WEIGHTS[priority] ?? TONCENTER_REQUEST_PRIORITY_WEIGHTS.background;
}

function pruneExpiredRunGetMethodCache(now = Date.now()) {
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
  toncenterRunGetMethodCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function readRunGetMethodCache(key) {
  const entry = toncenterRunGetMethodCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    toncenterRunGetMethodCache.delete(key);
    return null;
  }
  return entry.value;
}

function pruneExpiredMessagesCache(now = Date.now()) {
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
  toncenterMessagesCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function readMessagesCache(key) {
  const entry = toncenterMessagesCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    toncenterMessagesCache.delete(key);
    return null;
  }
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

/**
 * Test seam: every limiter key the pump has ever created.
 *
 * ONE key means ONE queue with ONE worker, which is the property that keeps two fetches from racing the WebKit run
 * loop (the iPhone freeze). A caller that omits rateLimitKey does NOT fail — it silently lands on the derived
 * `origin|key-mode` key and gets a SECOND queue. That already happened once to the shard scan, which ran on a
 * module-default pacing in a queue of its own until it was measured.
 */
export function __toncenterLimiterKeysForTests() {
  return [...toncenterRequestStates.keys()];
}

function toncenterRequestState(key) {
  const existing = toncenterRequestStates.get(key);
  if (existing) return existing;
  const state = {
    pending: [],
    processing: false,
    sequence: 0,
    nextAt: 0,
    backoffUntil: 0,
  };
  toncenterRequestStates.set(key, state);
  return state;
}

// Starvation guard for the strict-priority queue: a SUSTAINED stream of higher-priority arrivals must
// not starve a queued task forever (observed 2026-07-11: during an 8-part file send the background
// heal sendBoc waited out its ENTIRE 30s queue budget behind critical nonce/sync reads, QUEUE_TIMEOUT
// on every heal pass — zero forward progress while the pump was never idle). Aging promotes a waiting
// task one priority class per step waited, so the worst-case wait for the lowest class is bounded at
// ~3 steps (15s) plus one in-flight request, instead of unbounded. Ordering within a class stays FIFO
// (sequence), and a task that just arrived is unaffected — healthy scheduling is unchanged. Promotion
// FLOORS at weight 1 (never reaches 'critical'): after a long in-flight POST everything queued behind
// it has aged >= 3 steps, and letting that herd tie at weight 0 would put a FRESH interactive critical
// read (activation/balance, 8s queue budget) at the BACK of a global-FIFO tail — fresh criticals must
// always preempt aged observational work.
const TONCENTER_QUEUE_AGING_STEP_MS = 5_000;
const TONCENTER_QUEUE_AGING_FLOOR_WEIGHT = 1;

function toncenterEffectiveTaskWeight(task, now) {
  const waitedMs = Math.max(0, now - task.enqueuedAt);
  const agedWeight = task.priorityWeight - Math.floor(waitedMs / TONCENTER_QUEUE_AGING_STEP_MS);
  return Math.max(Math.min(task.priorityWeight, TONCENTER_QUEUE_AGING_FLOOR_WEIGHT), agedWeight);
}

function takeNextToncenterTask(state) {
  const now = Date.now();
  let bestIndex = 0;
  let bestWeight = toncenterEffectiveTaskWeight(state.pending[0], now);
  for (let index = 1; index < state.pending.length; index += 1) {
    const candidate = state.pending[index];
    const best = state.pending[bestIndex];
    const candidateWeight = toncenterEffectiveTaskWeight(candidate, now);
    if (
      candidateWeight < bestWeight
      || (candidateWeight === bestWeight && candidate.sequence < best.sequence)
    ) {
      bestIndex = index;
      bestWeight = candidateWeight;
    }
  }
  return state.pending.splice(bestIndex, 1)[0];
}

async function drainToncenterRequestQueue(state) {
  try {
    while (state.pending.length > 0) {
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
        const now = Date.now();
        if (task.options.skipIfRateLimited === true && state.backoffUntil > now) {
          // iOS DEAD-FREEZE ROOT FIX (slow-device-freeze-iphone-se2): this single shared RPC pump is the one
          // construct every Vault / activation / send / confirm read flows through. Its only macrotask yield
          // (`await delay(waitMs)` below) is SKIPPED for skipIfRateLimited reads (waitMs<=0 because backoff is
          // excluded from waitUntil). So during a 429 backoff the drain loop rejected every queued read through
          // MICROTASKS ONLY — the microtask queue never emptied, so setInterval / rendering / the setTimeout
          // send-retry never ran = the whole app dead until the upstream confirm/broadcast budget stopped feeding
          // it. On fast V8 the burst drains in ~ms (invisible); on slow iOS JSC the same burst pins the run loop
          // for the whole budget = the iPhone-only permanent freeze. The fix: yield ONE real macrotask before
          // rejecting, so the run loop breathes between rejects on every engine. Scheduling-only — the read still
          // rejects (skip semantics preserved), just one macrotask later; no send/nonce/double-spend change.
          await delay(0);
          throw toncenterBackoffError(state.backoffUntil - now);
        }
        if (queueDeadlineAt > 0 && now >= queueDeadlineAt) {
          throw tonRpcQueueTimeoutError(queueTimeoutMs);
        }
        const waitUntil = Math.max(
          state.nextAt,
          task.options.skipIfRateLimited === true ? 0 : state.backoffUntil,
        );
        const waitMs = waitUntil - Date.now();
        if (waitMs > 0) {
          if (queueDeadlineAt > 0) {
            const remainingQueueMs = queueDeadlineAt - Date.now();
            if (remainingQueueMs <= 0) {
              throw tonRpcQueueTimeoutError(queueTimeoutMs);
            }
            if (waitMs > remainingQueueMs) {
              await delay(remainingQueueMs);
              throw tonRpcQueueTimeoutError(queueTimeoutMs);
            }
          }
          await delay(waitMs);
        }
        const response = await task.request();
        state.nextAt = Date.now() + spacingMs;
        if (response?.status === 429) {
          const backoff = retryAfterMs(response) ?? finiteNonNegativeMs(
            task.options.rateLimitBackoffMs,
            TONCENTER_RATE_LIMIT_BACKOFF_MS,
          );
          state.backoffUntil = Date.now() + backoff;
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
      enqueuedAt: Date.now(),
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
    }
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
  // A 429 WITHOUT a Retry-After header should carry the transport's CONFIGURED rate-limit backoff (the
  // keyless ~7s), not a hardcoded 60s. The error's retryAfterMs propagates up to the app-level limiter and
  // the higher retry loops; the old hardcode made them sleep a full minute per 429, so a keyless send idled
  // for ~10 min issuing almost no requests. A real Retry-After header still wins.
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
    // Fall through to the raw upstream body.
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
    // Carry the CONTRACT's verdict, not just the HTTP status: the caller decides re-broadcast vs re-sign from it.
    const exitCode = toncenterBroadcastExitCode(body);
    if (exitCode != null) error.chainExitCode = exitCode;
  } catch {
    // HTTP status is still enough to classify the error.
  }
  return error;
}

// A toncenter 5xx on /message is TWO different failures wearing one status code, and telling them apart is the
// whole point of this parser.
//
// MEASURED 2026-08-04 from the owner's console: twelve `POST /api/v3/message 500` in a row, every one carrying
// `LITE_SERVER_UNKNOWN: cannot apply external message ... terminating vm with exit code 133`. That is NOT toncenter
// breaking — it is the lite-server reporting that the wallet contract rejected these exact bytes. Re-POSTing them
// can never succeed: the external is signed, so every copy is rejected identically. Retrying only burns the budget
// and hammers the endpoint while the user's message sits on "sending".
//
// A 5xx with NO exit code is the other failure — toncenter's own broadcast endpoint erroring — and that one is
// worth retrying, which is why this is a classifier instead of a blanket "never retry a 5xx broadcast".
const TONCENTER_EXIT_CODE_PATTERN = /exit[ _]?code[^0-9-]{0,8}(-?\d+)/i;

/** The TVM exit code a broadcast rejection carries, or null when the failure is not a chain verdict. */
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
    // An unreadable body proves nothing — fall through to the retry, which is the right default for a bare 5xx.
    return false;
  }
}

// Exported for web/shard-rpc.mjs, which needs the accountStates and messages leaves of the same v3 base the
// transport uses. Deriving them independently would be a second place to get the endpoint wrong.
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

export async function scheduleToncenterHttpRequest(endpoint, apiKey, request, options = {}) {
  const limiterKey = toncenterLimiterKey(endpoint, apiKey, options.rateLimitKey);
  const requestSpacingMs = finiteNonNegativeMs(options.requestSpacingMs, TONCENTER_REQUEST_SPACING_MS);
  const rateLimitBackoffMs = finiteNonNegativeMs(options.rateLimitBackoffMs, TONCENTER_RATE_LIMIT_BACKOFF_MS);
  const rateLimitRetries = finiteNonNegativeMs(options.rateLimitRetries, TONCENTER_RATE_LIMIT_RETRIES);
  // Opt-in, and OFF for reads. A failed read is cheap to repeat later; a failed BROADCAST costs the user a message.
  const serverErrorRetries = finiteNonNegativeMs(options.serverErrorRetries, 0);
  const serverErrorBackoffMs = finiteNonNegativeMs(options.serverErrorBackoffMs, TONCENTER_SERVER_ERROR_BACKOFF_MS);
  let response = null;
  let rateLimited = 0;
  let serverErrors = 0;
  while (true) {
    response = await scheduleToncenterRequest(
      limiterKey,
      request,
      {
        spacingMs: requestSpacingMs,
        rateLimitBackoffMs,
        skipIfRateLimited: options.skipIfRateLimited,
        priority: options.priority,
        queueTimeoutMs: options.queueTimeoutMs,
      },
    );
    if (response?.status === 429) {
      if (rateLimited >= rateLimitRetries) return response;
      rateLimited += 1;
      continue;
    }
    // MEASURED 2026-08-03, from the owner's console: eight `POST /api/v3/message 500 (Internal Server Error)` in a
    // row while sending a burst. toncenter 5xx-es its own broadcast endpoint, and this loop used to hand a 500
    // straight back — one POST, no second try. The message then fell into the app-level retry ladder with its
    // multi-second backoff, which is what a message stuck on "sending" looks like from the outside.
    //
    // Re-POSTing is SAFE, and that is the whole reason this is allowed to retry at all: the external is already
    // signed and bound to one wallet seqno, so the chain runs it AT MOST ONCE however many copies arrive. The same
    // property the ambiguous-broadcast re-broadcast has relied on all along.
    //
    // There is no second provider to fall back to, and that is a TECHNICAL fact rather than a preference: the old
    // Orbs (ton-access) path was removed because it is stuck on toncenter API v2 and lags the 2026-04 sub-second TON
    // upgrade, so it cannot confirm a just-sent message and reintroducing it would add real latency, not resilience.
    // Retrying the one modern provider we have is therefore the whole available answer here. A DIFFERENT, v3-capable
    // provider would be a legitimate second lane — Orbs specifically is not.
    if (response && response.status >= 500 && serverErrors < serverErrorRetries) {
      // A chain verdict is DEFINITIVE: the same signed bytes are rejected identically forever. Hand it straight
      // back so the caller re-SIGNS instead of re-POSTing a corpse.
      if (await toncenterResponseCarriesChainRejection(response)) return response;
      serverErrors += 1;
      await delay(serverErrorBackoffMs * serverErrors);   // 400ms, 800ms, 1200ms — bounded, never a hammer
      continue;
    }
    return response;
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
  boc[offset] = 0x01; offset += 1; // no index, no CRC, one-byte counters
  boc[offset] = 0x01; offset += 1; // one-byte total cell size
  boc[offset] = 0x01; offset += 1; // cells count
  boc[offset] = 0x01; offset += 1; // roots count
  boc[offset] = 0x00; offset += 1; // absent cells
  boc[offset] = cell.length; offset += 1;
  boc[offset] = 0x00; offset += 1; // root cell index
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
  offset += 1; // absent cells
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
  bitOffset = writeBit(data, bitOffset, false); // no anycast
  bitOffset = writeUint(data, bitOffset, signedWorkchainByte(parsed.workchain), 8);
  for (const byte of parsed.hash) {
    bitOffset = writeUint(data, bitOffset, byte, 8);
  }
  bitOffset = writeBit(data, bitOffset, true); // top-up bit
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
    // A string that is not a decimal/hex integer is simply not an integer stack item: fall through to the
    // throw below. It MUST NOT reach the value.toString() branch — String.prototype.toString returns the
    // SAME string, so recursing on it re-enters with an identical argument = infinite self-recursion. On V8
    // that overflows the stack fast and throws (caught by tryParseStackBigIntValue -> null, so reads work),
    // but JavaScriptCore (Safari/iOS) implements proper tail calls for this strict-mode ES module: the
    // self-recursive tail call never grows the stack and becomes an INFINITE LOOP that hard-freezes the run
    // loop. That was the permanent iPhone-ONLY freeze on every verify:true compare (normalizeTonRpcResult-
    // ForCompare) of a read whose stack carries a non-numeric string cell/slice — e.g. the get_user_receipts
    // confirm read (receipts dict cell) and get_global (address slices). See slow-device-freeze-iphone-se2.
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
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new TonRpcTransportError('fetch is unavailable');
  // The per-user toncenter key is injected at runtime (no key ever ships in the bundle): a provider
  // marked useUserApiKey reads the key the app stored from local storage into globalThis. Captured at
  // build (the app re-resolves the transport when the user adds/changes a key); anonymous until then.
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
    supportsMessageHistory: Boolean(messagesEndpoint),
    supportsSendBoc: Boolean(sendBocEndpoint),
    async runGetMethod({ address, method, stack, cacheTtlMs, ttlMs, priority, verify, allowUnverifiedCriticalRead, requestTimeoutMs, timeoutMs, queueTimeoutMs }) {
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
        const cached = readRunGetMethodCache(cacheKey);
        if (cached) return cached;
      }
      const inFlightKey = tonRpcInFlightKey(cacheKey, resolvedCacheTtlMs, {
        allowUnverifiedCriticalRead,
        priority: resolvedPriority,
        queueTimeoutMs,
        requestTimeoutMs,
        timeoutMs,
        verify,
      });
      const existing = toncenterRunGetMethodInFlight.get(inFlightKey);
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
              rateLimitBackoffMs,
              rateLimitRetries,
              skipIfRateLimited: options.skipRateLimitedGetMethods ?? true,
              priority: resolvedPriority,
              queueTimeoutMs,
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
          toncenterRunGetMethodInFlight.delete(inFlightKey);
        }
      })();
      toncenterRunGetMethodInFlight.set(inFlightKey, promise);
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
      const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) };
      if (apiKey) headers['X-API-Key'] = apiKey;
      const resolvedRequestTimeoutMs = resolveTonRpcRequestTimeoutMs({ priority, requestTimeoutMs, timeoutMs }, {
        ...options,
        requestTimeoutMs: options.sendBocRequestTimeoutMs ?? options.requestTimeoutMs,
      });
      const response = await scheduleToncenterHttpRequest(
        endpointForSend,
        apiKey,
        () => fetchWithTonRpcTimeout(fetchImpl, endpointForSend, {
          method: 'POST',
          headers,
          body: JSON.stringify({ boc }),
        }, resolvedRequestTimeoutMs),
        {
          rateLimitKey: options.rateLimitKey,
          requestSpacingMs,
          rateLimitBackoffMs,
          rateLimitRetries: finiteNonNegativeMs(options.sendBocRateLimitRetries, Math.max(rateLimitRetries, 1)),
          // The ONLY caller that opts into 5xx retries — see the note in scheduleToncenterHttpRequest. Safe because
          // the external is signed against one seqno, so the chain runs it at most once however many copies arrive.
          serverErrorRetries: finiteNonNegativeMs(
            options.sendBocServerErrorRetries, TONCENTER_SEND_BOC_SERVER_ERROR_RETRIES,
          ),
          skipIfRateLimited: skipIfRateLimited === true,
          priority,
          queueTimeoutMs,
        },
      );
      if (!response.ok) {
        throw await toncenterHttpErrorWithBody('TON RPC sendBoc', response, rateLimitBackoffMs);
      }
      const json = await response.json();
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
          rateLimitBackoffMs,
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
    async getMessages(params = {}, requestOptions = {}) {
      const query = stableQueryObject(params);
      const cacheKey = toncenterMessagesCacheKey(messagesEndpoint, apiKey, options.rateLimitKey, query);
      const resolvedCacheTtlMs = finiteNonNegativeMs(
        requestOptions.cacheTtlMs ?? requestOptions.ttlMs,
        TONCENTER_MESSAGES_CACHE_TTL_MS,
      );
      const bypassCache = resolvedCacheTtlMs === 0;
      if (!bypassCache) {
        const cached = readMessagesCache(cacheKey);
        if (cached) return cached;
      }
      const inFlightKey = tonRpcInFlightKey(cacheKey, resolvedCacheTtlMs, requestOptions);
      const existing = toncenterMessagesInFlight.get(inFlightKey);
      if (existing) return existing;
      const requestTimeoutMs = resolveTonRpcRequestTimeoutMs(requestOptions, options);
      const headers = { ...(options.headers ?? {}) };
      if (apiKey) headers['X-API-Key'] = apiKey;
      const url = appendQueryParams(messagesEndpoint, query);
      const fetchOptions = { method: 'GET', headers };
      if (bypassCache) fetchOptions.cache = 'no-store';
      const promise = (async () => {
        try {
          const response = await scheduleToncenterHttpRequest(
            messagesEndpoint,
            apiKey,
            () => fetchWithTonRpcTimeout(fetchImpl, url, fetchOptions, requestTimeoutMs),
            {
              rateLimitKey: options.rateLimitKey,
              requestSpacingMs,
              rateLimitBackoffMs,
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
        // Fall through to slice/cell normalization.
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
      // Cross-verify ONLY the stable, security-relevant fields of the user view. The per-user
      // counters are inherently volatile: ton_balance[1] / ath_balance[2] change on every
      // credit/withdraw/publish and publish_nonce[5] increments on every publish, so two HONEST
      // RPC replicas observed at different block heights legitimately disagree on them during the
      // hot send/confirm window. Including them here turned every keyed (verify:true) hot read into
      // a spurious RPC_DISAGREEMENT, dropping the private send into the [8,20,45,60]s retry ladder
      // (the dominant send-latency bottleneck — and WORSE with a key, since a key supplies the
      // second non-emergency verifier that makes the dual-read fire at all). We therefore compare
      // only exists[0], current_key_id[3] and auth_pubkey[4] — the signing-key identity that a lying
      // RPC must NOT be able to fake. This mirrors the get_global treatment just below, which already
      // excludes its own volatile counters. No-double-spend is unaffected: the returned nonce/balance
      // are still the primary (toncenter) values, guarded by the monotonic publish-nonce floor +
      // verified-absence-before-resign, and the contract independently enforces nonce-equality
      // (throwUnless 16xxx) and balance sufficiency on-chain.
      return stableJsonString([
        stack[0] ?? null,
        stack[3] ?? null,
        stack[4] ?? null,
      ]);
    }
    if (methodName === 'get_global') {
      return stableJsonString([
        ...stack.slice(0, 10),
        stack[18] ?? null,
        stack[21] ?? null,
        stack[22] ?? null,
      ]);
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

/**
 * The request spacing one provider must actually run at.
 *
 * A no-key user-toncenter MUST use the keyless ~1 rps spacing, NOT the keyed 125ms (8 rps): anonymous
 * toncenter.com rate-limits at ~1 rps, so 125ms would 429-storm it into a perpetual "RPC busy" /
 * private_index_read_failed. It STILL stays a non-emergency primary (no demotion — see createTonRpcTransportFromConfig);
 * when a key is later added, applyToncenterApiKey rebuilds the transport with the full keyed spacing.
 *
 * ONE implementation, two callers: the transport factory below and the SHARD SCAN LANE (web/shard-rpc.mjs), which
 * issues its own /accountStates and /messages requests outside any transport object. A second copy of this rule is
 * the shape of defect that hid for a whole release — see toncenterScanLaneOptions.
 */
export function effectiveToncenterRequestSpacingMs(provider = {}, defaults = {}) {
  const userKeyMissing = (provider?.useUserApiKey ?? defaults.useUserApiKey) === true
    && !(provider?.apiKey ?? defaults.apiKey)
    && !globalThis.plathoToncenterApiKey;
  const configuredSpacingMs = provider?.requestSpacingMs ?? defaults.requestSpacingMs;
  return userKeyMissing
    ? Math.max(Number(configuredSpacingMs ?? 0) || 0, TONCENTER_KEYLESS_REQUEST_SPACING_MS)
    : configuredSpacingMs;
}

/**
 * The limiter key and spacing the SHARD SCAN LANE must use, taken from the PRIMARY provider — i.e. the same pump,
 * at the same cadence, as every other read this client makes.
 *
 * MEASURED 2026-08-04 against live toncenter, six consecutive shard reads: 1775 / 1605 / 1619 / 1588 / 1602 ms
 * apart, 8.3s for six requests. The lane passed no spacing at all, so it inherited this module's 1500ms module
 * default while the configured keyed spacing was 125ms — a 12x pacing penalty on the ENTIRE receive path (every
 * CONV history read, every INTRO scan, every PUBLIC channel read, every avatar part). That is what a 20-second
 * "syncing" spinner over one quiet conversation was made of: about a dozen requests, each waiting 1.6s for its turn.
 *
 * The limiter key matters just as much. The lane used its own 'shard-scan' key, i.e. a SECOND single-worker queue
 * running in parallel with 'toncenter-shared' — and platho-config calls that shared key load-bearing precisely
 * because iOS WebKit stalls its run loop on parallel connections to one host (the iPhone freeze). Dropping the
 * spacing without merging the queues would also have put two lanes x 8 rps against a 10 rps key cap.
 */
/**
 * A per-phase stopwatch: wall time AND toncenter requests spent, by phase. ONE primitive for every lane that wants
 * to answer "where did the seconds go" — the sync tick has used this shape since the 71-second phantom spinner, and
 * the send path needs the identical breakdown.
 *
 * The request count is the half that matters. Wall time alone cannot separate "this phase is doing work" from "this
 * phase is queued behind someone else's work in the shared serial pump" — and the pump's spacing differs by an order
 * of magnitude between a keyed client (125ms) and a KEYLESS one (1100ms), so the same phase costs wildly different
 * wall time for two users doing the same thing. `spacingMs` is recorded with the profile for exactly that reason:
 * without it a number here cannot be compared against a number from another device.
 */
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
      // A phase marked twice (per-chunk work) ACCUMULATES rather than overwriting — otherwise a two-external send
      // reports only its last chunk and the total stops adding up.
      phases[name] = prior
        ? { ms: prior.ms + span.ms, req: prior.req + span.req, netMs: prior.netMs + span.netMs, n: (prior.n ?? 1) + 1 }
        : span;
      cursor = now;
    },
    summary() {
      return {
        at: new Date().toISOString(),
        totalMs: Date.now() - startedAt,
        // The pump cadence this ran at: 125ms keyed vs 1100ms keyless changes every number above.
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

// Which door the NEXT retry knocks on. Module state, because the point is to move on from whichever one just
// failed to deliver — a per-call counter would restart at the primary every time and never rotate.
let broadcastDoorCursor = 0;

/** Test seam — the cursor is module state, and a test that cannot reset it cannot prove the rotation. */
export function __resetBroadcastDoorCursorForTests() {
  broadcastDoorCursor = 0;
}

export function broadcastDoors(config = null) {
  const resolved = config ?? globalThis.plathoTonRpcConfig ?? null;
  const doors = Array.isArray(resolved?.broadcastDoors) ? resolved.broadcastDoors : [];
  return doors.filter((door) => typeof door?.sendBocEndpoint === 'string' && door.sendBocEndpoint);
}

/**
 * Broadcast an ALREADY SIGNED external through the next retry door.
 *
 * Best-effort by construction: the caller never learns whether this worked, because the answer must not influence
 * anything. Delivery is decided by reading the shard, and these bytes are seqno-bound, so the chain runs them at
 * most once however many doors accept them.
 *
 * ON THE SHARED PUMP KEY, always. A door is a different HOST but must not be a different QUEUE: two queues mean two
 * workers mean two simultaneous connections, which is what stalled the WebKit run loop on the iPhone. One worker
 * alternating addresses is fine; two workers are not. Background priority + skipIfRateLimited keep it behind every
 * read and send, and drop it outright when the lane is busy.
 */
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
    return { door: door.id, status: response?.status ?? null };
  } catch {
    // Swallowed on purpose. A door that refuses proves nothing about delivery — the earlier copy may still land,
    // and the next retry simply moves to the next door.
    return { door: door.id, status: null };
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
    // #F shared per-IP budget: do NOT default the limiter key to provider.id. With provider.id, the keyed
    // user-toncenter and the anonymous keyless-toncenter sat in SEPARATE client queues even though they hit
    // the SAME toncenter.com from ONE IP — on a no-key wallet (both anonymous, 1500ms each) their two queues
    // together exceeded toncenter's per-IP ~1 rps limit during concurrent sync+send -> 429 bursts. Falling
    // through to toncenterLimiterKey's origin|key-mode keying merges all ANONYMOUS toncenter traffic into one
    // 'toncenter.com|public' budget (single nextAt/backoff, paced at the keyless spacing) while keyed traffic
    // keeps its own 'toncenter.com|api-key' budget — toncenter rate-limits keyed per-key and anonymous
    // per-IP, i.e. different buckets, so only the anonymous side must share. An explicit provider.rateLimitKey
    // still wins if a config ever needs to force-separate.
    rateLimitKey: provider?.rateLimitKey ?? defaults.rateLimitKey,
  });
  // TONCENTER-ONLY topology (Orbs removed): user-toncenter is the sole primary read/send/history source.
  // When the user has NO key it runs anonymous (~1 rps, 429-prone) but MUST stay a non-emergency primary
  // and is NOT demoted to verifierOnly/emergencyFallback. Demoting it (the old Orbs-present behaviour, when
  // Orbs was the real primary and a keyless user-toncenter was a redundant second source) would now leave
  // keyless-toncenter as the only emergency transport and ZERO live primaries -> orderedTonRpcTransportCandidates
  // has no alivePrimary -> the first 429 parks everything -> perpetual "syncing". It also never fail-closes as
  // a verifier: the only other transport (keyless-toncenter) is emergencyFallback and is skipped by the
  // verifier loop, so a verify:true read finds no eligible verifier and self-trusts the lone primary
  // (isVerificationDegraded()===true is the intended steady state — both transports are the same toncenter.com
  // backend, so there is no independent source to cross-verify against, and the app-side no-double-spend guard
  // stays fail-closed on that degraded signal). Adding a key rebuilds the transport (applyToncenterApiKey) and
  // restores the full 10 rps budget.
  return withRunGetMethodCapabilities(transport, provider, defaults);
}

function orderedTonRpcTransportCandidates(transports, isEligible) {
  const now = Date.now();
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
  // Verifier-only transports stay out of normal duty while a primary is
  // healthy, then serve as the censorship-survival path when primaries fail.
  // Parked transports come last so the app never strands itself entirely.
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
    const operationTimeoutMs = tonRpcOperationTimeoutMs(requestOptions, options);
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
          () => transport[methodName](...args),
          operationTimeoutMs,
        );
        noteTonRpcTransportSuccess(transport);
        primaryTransport = transport;
        break;
      } catch (error) {
        lastError = error;
        // A get-method abort on a code-less account (TON exit_code -13) is a
        // definitive on-chain answer, not a transport miss — every node agrees
        // the account has no code. When the caller opts in (the wallet seqno
        // read, which treats it as "deploy on first transfer"), surface it at
        // once instead of exhausting — and loading — the censorship-survival
        // fallback transports on a settled question. It is not a transport
        // failure, so the primary is intentionally left unparked.
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
      // The keyless emergency-fallback transport (e.g. keyless toncenter, ~1 rps) is NEVER an
      // "on equal footing" routine verifier — it is reserved strictly for primary reads/sends/
      // history when the gateway is wholly unreachable. So a critical read is cross-verified only
      // against another gateway transport, never against the keyless host while the gateway lives.
      if (isEmergencyFallbackTransport(transport)) continue;
      // A parked verifier would add a full request timeout to every critical
      // read; let callers fall back to unverified reads instead.
      if (isTonRpcTransportDead(transport)) continue;
      eligibleVerifierTried = true;
      try {
        const verifierResult = await withTonRpcOperationTimeout(
          () => transport[methodName](...args),
          operationTimeoutMs,
        );
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
      // No eligible verifier was even tried → cross-read verification is STRUCTURALLY impossible: the
      // primary is the sole live read transport (the keyless emergency host is never a routine verifier,
      // and no second non-emergency transport exists). In the TONCENTER-ONLY model that primary is the
      // user's keyed toncenter v3 (or the anonymous toncenter when no key) — a single host by design, and
      // both transports share the same toncenter.com backend so there is no independent source to
      // cross-verify against anyway. A single primary read IS the trusted result: self-trust it and return,
      // rather than failing closed and bricking the reads that hardcode verify:true (Vault balance/activation,
      // publish charge/nonce). Message bodies still self-verify against CapsuleHub hashes, so a single read
      // cannot poison them. This is the "1 live source → trust it, stay alive" degrade verifyCriticalReads:false
      // intends; the app-side double-spend guard independently observes isVerificationDegraded()===true (now the
      // steady state) and stays fail-closed, so self-trusting reads here does NOT weaken the no-double-publish
      // invariant. We fail closed ONLY when an eligible verifier WAS tried but could not confirm — a genuinely
      // inconclusive cross-read.
      if (!eligibleVerifierTried) return primaryResult;
      throw new TonRpcTransportError(`TON RPC verification unavailable for ${method}`, {
        code: 'RPC_VERIFICATION_UNAVAILABLE',
        cause: verifyError,
      });
    }
    return primaryResult;
  }

  async function callSend(methodName, args) {
    // The operation bound wraps the WHOLE transport call: serial-pump queue wait + upload + answer.
    // requestTimeoutMs must bound only the fetch (the transport's own AbortController does that);
    // without the queue allowance a busy pump eats the upload budget — a size-scaled 20s send that
    // spent 12s queued behind sync reads was operation-aborted with only 8s of wire time, reproducing
    // the endless client-abort loop the scaled ceiling exists to close. The queue wait itself is
    // separately bounded by the queue timer, so the sum stays a hard bound.
    const requestTimeoutMs = tonRpcOperationTimeoutMs(args[0] ?? {}, options);
    const queueAllowanceMs = finiteNonNegativeMs(args[0]?.queueTimeoutMs, 0);
    const operationTimeoutMs = requestTimeoutMs > 0 ? requestTimeoutMs + queueAllowanceMs : 0;
    let lastError = null;
    // Delivery ambiguity ACROSS send attempts: a TIMEOUT'd / connection-dropped upload can still have
    // been DELIVERED (an aborted upload has been observed to land later), so once any attempt of this
    // external ends with unknown delivery, every LATER transport's definitive-looking reject (e.g. a
    // lagging node's pre-accept nonce bounce) must not be taken as proof that no copy is in flight.
    // Stamped onto the surfaced error; callers gate "definitively not relayed" conclusions on it.
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
          try { error.tonRpcPriorDeliveryAmbiguous = true; } catch { /* frozen error object — flag lost, fail-safe stays ambiguous upstream */ }
        }
        if (methodName === 'sendBoc') {
          const status = Number(error?.status ?? error?.response?.status ?? 0);
          // An HTTP answer (4xx/5xx) or a local queue expiry means THIS attempt provably did not
          // deliver; anything without a status (client abort mid-upload, network death, TypeError)
          // leaves delivery unknown.
          if (status < 400 && String(error?.code ?? '') !== 'QUEUE_TIMEOUT') priorDeliveryAmbiguous = true;
        }
        noteTonRpcTransportFailure(transport, error, transportDeadRetryMs);
        // A PRIMARY (non-emergency) toncenter that answered with an HTTP 5xx is
        // reachable and has accepted the external into its pipeline. Falling through
        // to the keyless emergency toncenter here only re-broadcasts the same external
        // to the SAME backend — burning its ~1 rps quota (which the confirmation reads
        // need) and producing a second 500. The external is idempotent (fixed nonce)
        // and may already be on-chain, so stop and let the caller confirm via a nonce
        // read instead of dual-broadcasting. Connectivity death (a blocked host: no
        // HTTP status) is NOT caught here and still falls through to the emergency send
        // path — the survival invariant.
        if (
          methodName === 'sendBoc'
          && !isEmergencyFallbackTransport(transport)
          && Number(error?.status ?? error?.response?.status ?? 0) >= 500
        ) throw error;
        // Re-broadcasting the same BOC is idempotent on TON, so connectivity
        // failures (including 4xx host blocks) fall through to the next
        // transport; only definitive application-level rejections stop here.
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
      // Cross-read verification runs ONLY between gateway (non-emergency) read transports — the
      // keyless emergency fallback is never a verifier (see callRead). So verification is
      // structurally degraded when fewer than two NON-emergency read transports are alive, even
      // if the keyless emergency transport is reachable. This keeps the app-side degraded gate
      // consistent with callRead, so explicit verify:true callers fall back to unverified /
      // inconclusive instead of waiting on a non-existent second gateway verifier.
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
    async getAccountState(input, requestOptions = {}) {
      return callRead('getAccountState', [input, requestOptions], requestOptions);
    },
    async getAccountBalance(address, requestOptions = {}) {
      return callRead('getAccountBalance', [address, requestOptions], requestOptions);
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

