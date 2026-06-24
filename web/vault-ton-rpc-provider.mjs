import { parseTonAddress } from './crypto/platho-crypto.mjs?v=12';
import { MLKEM768_PUBLIC_KEY_BYTES, readSnakeCellBytes, tonCell, VAULT_PUBLISH_KIND } from './pwa-contract-transactions.mjs?v=30';
import { BATCH_SHARED_BASE_HOLD_NANOTONS, capsulePerPartHoldNanotons } from './message-pricing-policy.mjs?v=13';

const { parseBocBase64 } = tonCell;

export class VaultTonRpcProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'VaultTonRpcProviderError';
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
const TONCENTER_RUN_GET_METHOD_CACHE_TTL_MS = 15_000;
const TONCENTER_RUN_GET_METHOD_CACHE_MAX_ENTRIES = 512;
const TONCENTER_MESSAGES_CACHE_TTL_MS = 300_000;
const TONCENTER_MESSAGES_CACHE_MAX_ENTRIES = 128;
const TON_RPC_REQUEST_TIMEOUT_MS = 15_000;
// TON aborts a get-method run against an account that has no code (e.g. a
// never-deployed wallet) with this exit code. It is a definitive on-chain
// answer that every node agrees on — not a transport failure — so a caller that
// opts in (the wallet seqno read, which treats it as "seqno 0, deploy on first
// transfer") can stop the multi-transport fallback the moment it sees it,
// instead of spending the censorship-survival transports re-asking a settled
// question.
const TON_GET_METHOD_UNINITIALIZED_EXIT_CODE = -13;
// Anonymous (no-key) toncenter is ~1 rps. A keyed user-toncenter is spaced for 10 rps (100ms); when it runs
// WITHOUT a key it must drop to this keyless spacing or it 429-storms toncenter.com into a perpetual "RPC busy".
const TONCENTER_KEYLESS_REQUEST_SPACING_MS = 1500;
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
  get_user: 10_000,
  // Receipt-ring confirmation polling is on the hot publish path; a stale read
  // can re-confirm a slot the user just learned about, so keep the TTL short.
  get_user_receipts: 5_000,
  get_wallet_data: 10_000,
  get_key_record: 300_000,
  get_receive_intent: 120_000,
  get_receive_intent_id: 120_000,
  get_receive_intent_commitment: 120_000,
  get_ath_withdrawal_id: 120_000,
  get_pending_ath_withdrawal_for: 10_000,
  get_canonical_publish_charge: 60_000,
  get_private_entry: 300_000,
  get_private_recipient_index: 300_000,
  get_private_sender_index: 300_000,
  get_public_entry: 300_000,
  get_jetton_data: 300_000,
  get_wallet_address: 300_000,
  get_username_price: 300_000,
  get_name_record: 120_000,
  get_avatar: 120_000,
});
const TONCENTER_RUN_GET_METHOD_PRIORITIES = Object.freeze({
  get_private_entry: 'messages',
  get_private_recipient_index: 'messages',
  get_private_sender_index: 'messages',
  get_public_entry: 'messages',
  get_global: 'messages',
  get_state: 'messages',
  get_user: 'wallet',
  get_user_receipts: 'wallet',
  get_wallet_data: 'wallet',
  get_pending_ath_withdrawal_for: 'wallet',
  get_key_record: 'profile',
  get_name_record: 'profile',
  get_avatar: 'profile',
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

export function resetTonRpcTransportHealthForTests() {
  tonRpcTransportHealth.clear();
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
  return new VaultTonRpcProviderError(`TON RPC request timed out after ${timeoutMs} ms`, {
    code: 'TIMEOUT',
  });
}

function tonRpcQueueTimeoutError(timeoutMs) {
  return new VaultTonRpcProviderError(`TON RPC queue wait timed out after ${timeoutMs} ms`, {
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

async function fetchWithTonRpcTimeout(fetchImpl, url, init, timeoutMs) {
  const resolvedTimeoutMs = finiteNonNegativeMs(timeoutMs, TON_RPC_REQUEST_TIMEOUT_MS);
  if (resolvedTimeoutMs <= 0) return fetchImpl(url, init);

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

function takeNextToncenterTask(state) {
  let bestIndex = 0;
  for (let index = 1; index < state.pending.length; index += 1) {
    const candidate = state.pending[index];
    const best = state.pending[bestIndex];
    if (
      candidate.priorityWeight < best.priorityWeight
      || (candidate.priorityWeight === best.priorityWeight && candidate.sequence < best.sequence)
    ) {
      bestIndex = index;
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
  return new VaultTonRpcProviderError('TON RPC rate limit backoff active', {
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
  return new VaultTonRpcProviderError(`${label} HTTP ${response.status}`, {
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
  } catch {
    // HTTP status is still enough to classify the error.
  }
  return error;
}

function deriveToncenterV3Endpoint(endpoint, leaf) {
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
  let response = null;
  for (let attempt = 0; attempt <= rateLimitRetries; attempt += 1) {
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
    if (response?.status !== 429) return response;
  }
  return response;
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

function parseStackBigIntValue(value, name) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'boolean') return value ? -1n : 0n;
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^-?0x[0-9a-fA-F]+$/.test(text)) {
      return text.startsWith('-') ? -BigInt(`0x${text.slice(3)}`) : BigInt(text);
    }
    if (/^-?[0-9]+$/.test(text)) return BigInt(text);
  }
  if (value && typeof value.toString === 'function') {
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

function readStackInt(stack, index, name) {
  if (index >= stack.length) throw new Error(`Missing ${name} stack item`);
  return parseStackBigIntValue(stackItemValue(stack[index]), name);
}

function readStackBool(stack, index, name) {
  return readStackInt(stack, index, name) !== 0n;
}

function readStackAddress(stack, index, name) {
  if (index >= stack.length) throw new Error(`Missing ${name} stack item`);
  const item = stack[index];
  const value = stackItemValue(item);
  const type = stackItemType(item);
  if (typeof value === 'string') {
    try {
      return parseTonAddress(value).raw;
    } catch {
      if (type.includes('slice') || type === 'cell') return decodeTonAddressSliceBoc(value);
    }
  }
  if (value && typeof value.toString === 'function') return parseTonAddress(value.toString()).raw;
  throw new Error(`${name} must be a TON address stack item`);
}

function readStackCellBoc(stack, index, name) {
  if (index >= stack.length) throw new Error(`Missing ${name} stack item`);
  const item = stack[index];
  const value = stackItemValue(item);
  const type = stackItemType(item);
  if (typeof value === 'string' && (type.includes('cell') || type.includes('slice'))) return value;
  if (typeof value === 'string' && value.startsWith('te6')) return value;
  throw new Error(`${name} must be a TON cell stack item`);
}

function extractStack(result) {
  const stack = result?.stack ?? result?.result?.stack;
  if (!Array.isArray(stack)) throw new Error('TON get-method response did not include a stack');
  return stack;
}

export function decodeVaultUserViewStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'Vault user exists'),
    ton_balance: readStackInt(stack, 1, 'Vault user ton_balance'),
    ath_balance: readStackInt(stack, 2, 'Vault user ath_balance'),
    current_key_id: readStackInt(stack, 3, 'Vault user current_key_id'),
    auth_pubkey: readStackInt(stack, 4, 'Vault user auth_pubkey'),
    publish_nonce: readStackInt(stack, 5, 'Vault user publish_nonce'),
  };
}

// --- VPB2 batch-publish receipt ring -----------------------------------------------------------
// Mirrors contracts/Vault.tact: RECEIPT_RING_K=20, the ReceiptSlot lifecycle codes, and the
// AUX_BATCH_LEVEL sentinel. Exported so the confirmation reader/interpreter and callers share one
// source of truth for the wire constants (no magic numbers leaking into app code).
export const RECEIPT_RING_K = 20;
export const ACT_PUBLISH_BATCH = 7;
export const RES_PROCESSING = 0x00;
export const RES_CONFIRMED = 0x01;
export const RES_BOUNCED_REFUNDED = 0x02;
export const RES_TOMBSTONED = 0x03;
export const RJ_PART_SHAPE = 0x11;
export const RJ_CLASS_OR_SUITE = 0x12;
export const RJ_HASH_MISMATCH = 0x13;
export const RJ_PAYLOAD_SHAPE = 0x14;
export const RJ_DUPLICATE_ADJACENT = 0x15;
export const RJ_UNDERPRICED = 0x16;
export const RJ_BINDING = 0x17;
export const RJ_ID_ZERO = 0x18;
export const RJ_PENDING_COLLISION = 0x19;
// 2^64-1: a batch-level aux (no specific failing part index).
export const AUX_BATCH_LEVEL = (1n << 64n) - 1n;

function tonCellBitReader(cell) {
  let bitOffset = 0;
  return {
    remaining() {
      return cell.bitLength - bitOffset;
    },
    loadBit() {
      if (bitOffset >= cell.bitLength) throw new Error('TON cell bit underflow');
      const bit = (cell.data[bitOffset >> 3] >> (7 - (bitOffset & 7))) & 1;
      bitOffset += 1;
      return bit;
    },
    loadUint(bitLength) {
      let out = 0n;
      for (let index = 0; index < bitLength; index += 1) out = (out << 1n) | BigInt(this.loadBit());
      return out;
    },
  };
}

// Parse a TON hashmap (Dictionary) directly off its root edge — the layout a Tact getter tuple
// returns for `map<...>` (Dictionary.loadDirect): the root cell IS the top edge, no leading
// present bit. Keys are fixed-width `keyBits`; each value is carried as a single ref cell. Walks
// the labelled patricia tree iteratively. Returns a Map<keyBigInt, valueCell>.
function loadTonHashmapDirect(rootCell, keyBits) {
  const out = new Map();
  if (!rootCell) return out;
  const stack = [{ cell: rootCell, keyPrefix: 0n, keyBitsLeft: keyBits }];
  const seen = new Set();
  while (stack.length > 0) {
    const { cell, keyPrefix, keyBitsLeft } = stack.pop();
    if (seen.has(cell)) throw new Error('TON hashmap has a cycle');
    seen.add(cell);
    const reader = tonCellBitReader(cell);
    // hml_* label: read the prefix that this edge contributes to the key.
    let label = 0n;
    let labelLen = 0;
    if (reader.loadBit() === 0) {
      // hml_short$0: unary length, then `len` label bits.
      let len = 0;
      while (reader.loadBit() === 1) len += 1;
      labelLen = len;
      if (len > 0) label = reader.loadUint(len);
    } else if (reader.loadBit() === 0) {
      // hml_long$10: len as ceil(log2(keyBitsLeft+1)) bits, then `len` label bits.
      const lenBits = Math.ceil(Math.log2(keyBitsLeft + 1));
      const len = Number(reader.loadUint(lenBits));
      labelLen = len;
      if (len > 0) label = reader.loadUint(len);
    } else {
      // hml_same$11: a single repeated bit, then len as ceil(log2(keyBitsLeft+1)) bits.
      const fill = BigInt(reader.loadBit());
      const lenBits = Math.ceil(Math.log2(keyBitsLeft + 1));
      const len = Number(reader.loadUint(lenBits));
      labelLen = len;
      label = fill === 1n ? (1n << BigInt(len)) - 1n : 0n;
    }
    const nextPrefix = (keyPrefix << BigInt(labelLen)) | label;
    const remainingBits = keyBitsLeft - labelLen;
    if (remainingBits === 0) {
      // Leaf: the value is this cell's first ref (dictValueParser stores a ref-cell).
      const valueCell = cell.refs[0];
      if (!valueCell) throw new Error('TON hashmap leaf is missing its value ref');
      out.set(nextPrefix, valueCell);
    } else {
      // Fork: two children (bit 0 / bit 1) consume one more key bit each.
      const left = cell.refs[0];
      const right = cell.refs[1];
      if (!left || !right) throw new Error('TON hashmap fork is missing a child ref');
      stack.push({ cell: left, keyPrefix: nextPrefix << 1n, keyBitsLeft: remainingBits - 1 });
      stack.push({ cell: right, keyPrefix: (nextPrefix << 1n) | 1n, keyBitsLeft: remainingBits - 1 });
    }
  }
  return out;
}

// ReceiptSlot wire layout (contracts/Vault.tact storeReceiptSlot): nonce(64) action(8) result(8)
// aux(64) part_count(8) at(64). The leaf value cell carries the slot inline, byte-aligned.
function decodeReceiptSlotCell(valueCell) {
  const reader = tonCellBitReader(valueCell);
  return {
    nonce: reader.loadUint(64),
    action: reader.loadUint(8),
    result: reader.loadUint(8),
    aux: reader.loadUint(64),
    partCount: reader.loadUint(8),
    at: reader.loadUint(64),
  };
}

// Decode the get_user_receipts getter stack -> { exists, publishNonce, receipts }.
// Stack layout (loadGetterTupleVaultUserReceiptsView): [exists(int/bool), publish_nonce(int),
// receipts(cell|null)]. receipts is the dictionary root cell (`map<uint8, ReceiptSlot>`) or null.
// receipts is keyed by slotKey = nonce % RECEIPT_RING_K (Number), values carry bigints.
export function decodeVaultUserReceiptsViewStack(result) {
  const stack = extractStack(result);
  const exists = readStackBool(stack, 0, 'Vault user receipts exists');
  const publishNonce = readStackInt(stack, 1, 'Vault user receipts publish_nonce');
  const receipts = new Map();
  const dictItem = stack[2];
  const dictValue = dictItem === undefined ? null : stackItemValue(dictItem);
  if (dictValue !== null && dictValue !== undefined) {
    const dictType = stackItemType(dictItem);
    if (typeof dictValue !== 'string' || !(dictType.includes('cell') || dictType.includes('slice'))) {
      throw new Error('Vault user receipts dictionary must be a TON cell stack item');
    }
    const rootCell = parseBocBase64(dictValue);
    for (const [key, valueCell] of loadTonHashmapDirect(rootCell, 8)) {
      receipts.set(Number(key), decodeReceiptSlotCell(valueCell));
    }
  }
  return { exists, publishNonce, receipts };
}

export function decodeVaultKeyRecordViewStack(result) {
  const stack = extractStack(result);
  const pqKemPubkeyBoc = readStackCellBoc(stack, 7, 'Vault key record pq_kem_pubkey');
  return {
    exists: readStackBool(stack, 0, 'Vault key record exists'),
    owner_wallet: readStackAddress(stack, 1, 'Vault key record owner_wallet'),
    key_generation: readStackInt(stack, 2, 'Vault key record key_generation'),
    enc_pubkey: readStackInt(stack, 3, 'Vault key record enc_pubkey'),
    sign_pubkey: readStackInt(stack, 4, 'Vault key record sign_pubkey'),
    pq_kem_pubkey_hash: readStackInt(stack, 5, 'Vault key record pq_kem_pubkey_hash'),
    pq_kem_pubkey_len: readStackInt(stack, 6, 'Vault key record pq_kem_pubkey_len'),
    pq_kem_pubkey: readSnakeCellBytes(pqKemPubkeyBoc, {
      maxBytes: MLKEM768_PUBLIC_KEY_BYTES,
      name: 'Vault key record pq_kem_pubkey',
    }),
    pq_kem_pubkey_boc: pqKemPubkeyBoc,
    crypto_suite_mask: readStackInt(stack, 8, 'Vault key record crypto_suite_mask'),
    created_at: readStackInt(stack, 9, 'Vault key record created_at'),
    created_lt: readStackInt(stack, 10, 'Vault key record created_lt'),
    revoked_at: readStackInt(stack, 11, 'Vault key record revoked_at'),
    revoked_lt: readStackInt(stack, 12, 'Vault key record revoked_lt'),
  };
}

export function decodeVaultReceiveIntentViewStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'Vault receive intent exists'),
    sender_wallet: readStackAddress(stack, 1, 'Vault receive intent sender_wallet'),
    recipient_wallet: readStackAddress(stack, 2, 'Vault receive intent recipient_wallet'),
    asset: readStackInt(stack, 3, 'Vault receive intent asset'),
    amount: readStackInt(stack, 4, 'Vault receive intent amount'),
    commitment: readStackInt(stack, 5, 'Vault receive intent commitment'),
    client_nonce: readStackInt(stack, 6, 'Vault receive intent client_nonce'),
    settlement_reserve_ton: readStackInt(stack, 7, 'Vault receive intent settlement_reserve_ton'),
    created_at: readStackInt(stack, 8, 'Vault receive intent created_at'),
    claimed: readStackBool(stack, 9, 'Vault receive intent claimed'),
  };
}

export function decodeVaultPendingAthWithdrawalViewStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'Vault pending ATH withdrawal exists'),
    owner_wallet: readStackAddress(stack, 1, 'Vault pending ATH withdrawal owner_wallet'),
    recipient: readStackAddress(stack, 2, 'Vault pending ATH withdrawal recipient'),
    recipient_ath_wallet: readStackAddress(stack, 3, 'Vault pending ATH withdrawal recipient_ath_wallet'),
    amount: readStackInt(stack, 4, 'Vault pending ATH withdrawal amount'),
    created_at: readStackInt(stack, 5, 'Vault pending ATH withdrawal created_at'),
  };
}

export function decodeVaultGlobalViewStack(result) {
  const stack = extractStack(result);
  if (stack.length !== 23) {
    throw new VaultTonRpcProviderError(`Vault global stack layout mismatch: expected 23 fields, got ${stack.length}`, {
      code: 'VAULT_GLOBAL_STACK_MISMATCH',
      stackLength: stack.length,
    });
  }
  return {
    sealed: readStackBool(stack, 0, 'Vault global sealed'),
    capsule_hub_bound: readStackBool(stack, 1, 'Vault global capsule_hub_bound'),
    profile_registry_bound: readStackBool(stack, 2, 'Vault global profile_registry_bound'),
    username_registry_bound: readStackBool(stack, 3, 'Vault global username_registry_bound'),
    deployment_manifest_hash: readStackInt(stack, 4, 'Vault global deployment_manifest_hash'),
    capsule_hub_address: readStackAddress(stack, 5, 'Vault global capsule_hub_address'),
    profile_registry_address: readStackAddress(stack, 6, 'Vault global profile_registry_address'),
    username_registry_address: readStackAddress(stack, 7, 'Vault global username_registry_address'),
    vault_ath_wallet_address: readStackAddress(stack, 8, 'Vault global vault_ath_wallet_address'),
    ath_master_address: readStackAddress(stack, 9, 'Vault global ath_master_address'),
    user_count: readStackInt(stack, 10, 'Vault global user_count'),
    key_record_count: readStackInt(stack, 11, 'Vault global key_record_count'),
    receive_intent_count: readStackInt(stack, 12, 'Vault global receive_intent_count'),
    pending_ath_withdrawal_count: readStackInt(stack, 13, 'Vault global pending_ath_withdrawal_count'),
    pending_publish_count: readStackInt(stack, 14, 'Vault global pending_publish_count'),
    pending_profile_avatar_payment_count: readStackInt(stack, 15, 'Vault global pending_profile_avatar_payment_count'),
    pending_username_mint_payment_count: readStackInt(stack, 16, 'Vault global pending_username_mint_payment_count'),
    processed_ath_deposit_count: readStackInt(stack, 17, 'Vault global processed_ath_deposit_count'),
    pending_publish_stale_ttl: readStackInt(stack, 18, 'Vault global pending_publish_stale_ttl'),
    airdrop_remaining_ath: readStackInt(stack, 19, 'Vault global airdrop_remaining_ath'),
    airdrop_distributed_ath: readStackInt(stack, 20, 'Vault global airdrop_distributed_ath'),
    airdrop_reward_per_message_ath: readStackInt(stack, 21, 'Vault global airdrop_reward_per_message_ath'),
    airdrop_total_allocation_ath: readStackInt(stack, 22, 'Vault global airdrop_total_allocation_ath'),
  };
}

// Batch-publish confirmation statuses the interpreter maps the receipt-ring slot onto.
export const BATCH_PUBLISH_RECEIPT_STATUS = Object.freeze({
  PROCESSING: 'processing',
  CONFIRMED: 'confirmed',
  BOUNCED: 'bounced',
  TOMBSTONED: 'tombstoned',
  REJECTED: 'rejected',
  EVICTED: 'evicted',
});

const BATCH_PUBLISH_REJECT_CODES = Object.freeze(new Set([
  RJ_PART_SHAPE,
  RJ_CLASS_OR_SUITE,
  RJ_HASH_MISMATCH,
  RJ_PAYLOAD_SHAPE,
  RJ_DUPLICATE_ADJACENT,
  RJ_UNDERPRICED,
  RJ_BINDING,
  RJ_ID_ZERO,
  RJ_PENDING_COLLISION,
]));

function toReceiptBigInt(value) {
  return typeof value === 'bigint' ? value : BigInt(value);
}

// PURE: classify a single receipt-ring slot for an expected publish nonce. No transport, no state.
// The ring is overwritten every RECEIPT_RING_K nonces, so a slot is only meaningful when it still
// reports the nonce we sent for the batch action — otherwise it was evicted by a newer action.
//   processing -> accepted + forwarded to the Hub, awaiting ACK
//   confirmed  -> Hub stored the batch (firstEntryId = aux = entry id of part 0)
//   bounced    -> Hub bounced, the call value was refunded
//   tombstoned -> a stale pending was pruned (a late ACK can still confirm it)
//   rejected   -> post-accept reject WITH refund (rejectCode = result; failPartIndex = aux, or
//                 null at AUX_BATCH_LEVEL for batch-level failures)
//   evicted    -> slot missing, nonce mismatch, or a non-batch action overwrote the slot
export function interpretBatchPublishReceipt(slot, expectedNonce) {
  const wantNonce = toReceiptBigInt(expectedNonce);
  if (
    !slot
    || toReceiptBigInt(slot.nonce) !== wantNonce
    || toReceiptBigInt(slot.action) !== BigInt(ACT_PUBLISH_BATCH)
  ) {
    return { status: BATCH_PUBLISH_RECEIPT_STATUS.EVICTED };
  }
  const result = Number(toReceiptBigInt(slot.result));
  const aux = toReceiptBigInt(slot.aux);
  const partCount = slot.partCount === undefined || slot.partCount === null
    ? undefined
    : Number(toReceiptBigInt(slot.partCount));
  const base = partCount === undefined ? {} : { partCount };
  if (result === RES_PROCESSING) {
    return { status: BATCH_PUBLISH_RECEIPT_STATUS.PROCESSING, ...base };
  }
  if (result === RES_CONFIRMED) {
    return { status: BATCH_PUBLISH_RECEIPT_STATUS.CONFIRMED, firstEntryId: aux, ...base };
  }
  if (result === RES_BOUNCED_REFUNDED) {
    return { status: BATCH_PUBLISH_RECEIPT_STATUS.BOUNCED, ...base };
  }
  if (result === RES_TOMBSTONED) {
    return { status: BATCH_PUBLISH_RECEIPT_STATUS.TOMBSTONED, ...base };
  }
  if (BATCH_PUBLISH_REJECT_CODES.has(result)) {
    return {
      status: BATCH_PUBLISH_RECEIPT_STATUS.REJECTED,
      rejectCode: result,
      failPartIndex: aux === AUX_BATCH_LEVEL ? null : aux,
      ...base,
    };
  }
  // An unknown/unmapped result code on a matching batch slot: treat as evicted (cannot be trusted).
  return { status: BATCH_PUBLISH_RECEIPT_STATUS.EVICTED };
}

// Transport-thin reader: fetch the receipt ring for `owner`, pick the slot at expectedNonce % K,
// and interpret it. `provider` is anything exposing getUserReceipts (the Vault TON RPC provider).
export async function readBatchPublishReceipt(provider, vaultAddress, owner, expectedNonce, callOptions = {}) {
  if (typeof provider?.getUserReceipts !== 'function') {
    throw new VaultTonRpcProviderError('Vault provider does not expose getUserReceipts');
  }
  const wantNonce = toReceiptBigInt(expectedNonce);
  const view = await provider.getUserReceipts(owner, {
    ...callOptions,
    ...(vaultAddress ? { vaultAddress } : {}),
  });
  const slotKey = Number(wantNonce % BigInt(RECEIPT_RING_K));
  const slot = view?.receipts instanceof Map
    ? view.receipts.get(slotKey)
    : view?.receipts?.[slotKey];
  return interpretBatchPublishReceipt(slot ?? null, wantNonce);
}

export function createTonCenterV3VaultTransport(options = {}) {
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
  if (typeof fetchImpl !== 'function') throw new VaultTonRpcProviderError('fetch is unavailable');
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
            throw new VaultTonRpcProviderError(`TON RPC get-method exit code ${exitCode}`, { exitCode: Number(exitCode) });
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
        throw new VaultTonRpcProviderError('TON sendBoc endpoint is not configured');
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
      if (ok === false) throw new VaultTonRpcProviderError('TON RPC sendBoc rejected message');
      clearToncenterRunGetMethodCache({ endpoint, apiKey, rateLimitKey: options.rateLimitKey });
      clearToncenterMessagesCache();
      return json;
    },
    async getAccountState(input, requestOptions = {}) {
      if (!accountEndpoint) {
        throw new VaultTonRpcProviderError('TON account state endpoint is not configured');
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
        throw new VaultTonRpcProviderError('TON account state did not include a balance');
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
  return new VaultTonRpcProviderError(`TON RPC disagreement for ${method}`, {
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
    throw new VaultTonRpcProviderError(`Unsupported TON RPC provider kind: ${kind}`);
  }
  // A no-key user-toncenter MUST use the keyless ~1 rps spacing, NOT the keyed 100ms (10 rps): anonymous
  // toncenter.com rate-limits at ~1 rps, so 100ms would 429-storm it into a perpetual "RPC busy" /
  // private_index_read_failed. It STILL stays a non-emergency primary (no demotion — see below); when a key
  // is later added, applyToncenterApiKey rebuilds the transport with the full keyed spacing.
  const userKeyMissing = (provider?.useUserApiKey ?? defaults.useUserApiKey) === true
    && !(provider?.apiKey ?? defaults.apiKey)
    && !globalThis.plathoToncenterApiKey;
  const configuredSpacingMs = provider?.requestSpacingMs ?? defaults.requestSpacingMs;
  const effectiveRequestSpacingMs = userKeyMissing
    ? Math.max(Number(configuredSpacingMs ?? 0) || 0, TONCENTER_KEYLESS_REQUEST_SPACING_MS)
    : configuredSpacingMs;
  const transport = createTonCenterV3VaultTransport({
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
    rateLimitKey: provider?.rateLimitKey ?? provider?.id ?? defaults.rateLimitKey,
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
    if (!primaryTransport) throw lastError ?? new VaultTonRpcProviderError(`TON RPC ${methodName} transport is not configured`);
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
      throw new VaultTonRpcProviderError(`TON RPC verification unavailable for ${method}`, {
        code: 'RPC_VERIFICATION_UNAVAILABLE',
        cause: verifyError,
      });
    }
    return primaryResult;
  }

  async function callSend(methodName, args) {
    const operationTimeoutMs = tonRpcOperationTimeoutMs(args[0] ?? {}, options);
    let lastError = null;
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
    throw lastError ?? new VaultTonRpcProviderError(`TON RPC ${methodName} transport is not configured`);
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

function resolveTransport(options) {
  if (options.transport) return options.transport;
  const globalTransport = globalThis.plathoTonRpcTransport;
  if (globalTransport) return globalTransport;
  const endpoint = options.endpoint ?? globalThis.plathoTonRpcEndpoint ?? globalThis.PLATHO_TON_RPC_ENDPOINT;
  if (endpoint) {
    return createTonCenterV3VaultTransport({
      endpoint,
      apiKey: options.apiKey ?? globalThis.plathoTonRpcApiKey ?? globalThis.PLATHO_TON_RPC_API_KEY,
      headers: options.headers,
      fetch: options.fetch,
    });
  }
  return null;
}

function resolveVaultAddress(configured, callOptions) {
  const address = callOptions?.vaultAddress ?? configured ?? globalThis.plathoVaultAddress ?? globalThis.PLATHO_VAULT_ADDRESS;
  if (!address) throw new VaultTonRpcProviderError('Vault contract address is not configured');
  return parseTonAddress(address).raw;
}

function stackAddress(address) {
  return { type: 'slice', value: encodeTonAddressSliceBoc(parseTonAddress(address).raw) };
}

function stackNumber(value) {
  return { type: 'num', value: toStackNumber(value) };
}

function runGetCallOptions(callOptions = {}) {
  const out = {};
  for (const key of ['cacheTtlMs', 'ttlMs', 'priority', 'verify', 'allowUnverifiedCriticalRead', 'requestTimeoutMs', 'timeoutMs', 'queueTimeoutMs']) {
    if (callOptions[key] !== undefined) out[key] = callOptions[key];
  }
  return out;
}

export function createVaultTonRpcProvider(options = {}) {
  return {
    kind: options.kind ?? options.transport?.kind ?? 'ton-rpc',
    async getUser(ownerWallet, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      return decodeVaultUserViewStack(await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_user',
        stack: [stackAddress(ownerWallet)],
        ...runGetCallOptions(callOptions),
      }));
    },
    async getUserReceipts(ownerWallet, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      return decodeVaultUserReceiptsViewStack(await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_user_receipts',
        stack: [stackAddress(ownerWallet)],
        ...runGetCallOptions(callOptions),
      }));
    },
    async getKeyRecord(keyId, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      return decodeVaultKeyRecordViewStack(await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_key_record',
        stack: [stackNumber(keyId)],
        ...runGetCallOptions(callOptions),
      }));
    },
    async getReceiveIntent(intentId, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      return decodeVaultReceiveIntentViewStack(await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_receive_intent',
        stack: [stackNumber(intentId)],
        ...runGetCallOptions(callOptions),
      }));
    },
    async getReceiveIntentId(senderWallet, recipientWallet, asset, amount, clientNonce, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      const result = await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_receive_intent_id',
        stack: [
          stackAddress(senderWallet),
          stackAddress(recipientWallet),
          stackNumber(asset),
          stackNumber(amount),
          stackNumber(clientNonce),
        ],
        ...runGetCallOptions(callOptions),
      });
      return readStackInt(extractStack(result), 0, 'Vault receive intent id');
    },
    async getReceiveIntentCommitment(intentId, recipientWallet, secret32, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      const result = await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_receive_intent_commitment',
        stack: [
          stackNumber(intentId),
          stackAddress(recipientWallet),
          stackNumber(secret32),
        ],
        ...runGetCallOptions(callOptions),
      });
      return readStackInt(extractStack(result), 0, 'Vault receive intent commitment');
    },
    async getAthWithdrawalId(ownerWallet, queryId, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      const result = await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_ath_withdrawal_id',
        stack: [stackAddress(ownerWallet), stackNumber(queryId)],
        ...runGetCallOptions(callOptions),
      });
      return readStackInt(extractStack(result), 0, 'Vault ATH withdrawal id');
    },
    async getPendingAthWithdrawalFor(ownerWallet, queryId, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      return decodeVaultPendingAthWithdrawalViewStack(await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_pending_ath_withdrawal_for',
        stack: [stackAddress(ownerWallet), stackNumber(queryId)],
        ...runGetCallOptions(callOptions),
      }));
    },
    // VPB2: the per-message contract getter get_canonical_publish_charge was removed with the batch redeploy.
    // The single-capsule canonical hold is now a pure client computation from the recalibrated pricing model:
    // SHARED_BASE + perPartHold(kind, size) == the canonical_total (== signed max_charge) of a 1-part batch.
    // No RPC round-trip; callOptions are accepted for signature compatibility but ignored.
    async getCanonicalPublishCharge(ownerWallet, publishKind, sizeClass, _cryptoSuite, _callOptions = {}) {
      const kindLabel = BigInt(publishKind ?? VAULT_PUBLISH_KIND.PRIVATE) === VAULT_PUBLISH_KIND.PUBLIC
        ? 'public'
        : 'private';
      return BATCH_SHARED_BASE_HOLD_NANOTONS + capsulePerPartHoldNanotons(kindLabel, Number(sizeClass ?? 1));
    },
    async getGlobal(callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      return decodeVaultGlobalViewStack(await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_global',
        stack: [],
        ...runGetCallOptions(callOptions),
      }));
    },
  };
}

const defaultProvider = createVaultTonRpcProvider();

export default defaultProvider;
