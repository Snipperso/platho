// shard-rpc — the two reads the shard lane needs that the app's transport does not already expose.
//
// Everything else the lane needs is already there and reusable: `transport.runGetMethod` feeds the scan-page and
// entry readers directly, and `scheduleToncenterHttpRequest` is a mature per-key priority queue with request
// spacing, 429 backoff, in-flight dedupe and a TTL cache. Two gaps remain, and both are shaped the same way —
// the transport only ever asks about ONE account at a time, while a scan asks about a thousand.
//
//   1. accountStates in BATCH. web/shard-reader.mjs wants `request({ path, addresses, includeBoc })` with a
//      fully-formed query string, because the whole point of the batched read is that 1024 addresses fit under
//      the 64 KiB URL wall in a single request. The transport's getAccountState takes one address and builds its
//      own URL, so there was nothing to call.
//   2. messages for a shard, so a first contact's capsule body can be recovered from the transaction that
//      carried it. The body lives in transaction history rather than in state — that is what keeps shard state
//      thin — so reading it is a `/messages` call, not a getter.
//
// BOTH GO THROUGH THE SHARED PUMP, deliberately. A scan that bypassed it would race the app's own reads for the
// user's toncenter budget, and the whole per-client-key rate model (8 rps under one key, one queue inside one
// client) depends on there being exactly one queue.

import { scheduleToncenterHttpRequest, deriveToncenterV3Endpoint } from './vault-ton-rpc-provider.mjs?v=62';
import { parseBocBase64 } from './pwa-contract-transactions.mjs?v=33';

/** A scan is background work: it must yield to anything the user is waiting on. */
const SCAN_REQUEST_OPTIONS = Object.freeze({
  rateLimitKey: 'shard-scan',
  priority: 'low',
  // A scan pass that cannot get through right now is not worth queueing behind foreground work — the next pass
  // is a minute away and the cursor makes it cheap. Better a skipped pass than a backlog of stale ones.
  skipIfRateLimited: true,
});

/**
 * The v3 endpoint for `leaf`, derived from whatever base is configured.
 *
 * AN EXPLICIT ENDPOINT IS STILL A BASE, not a final URL, and that distinction is the whole point. The first
 * version returned `explicit` verbatim, which broke the moment both readers were given the same configuration:
 * the caller passes ONE endpoint, so the messages reader dutifully asked /accountStates for a shard's history,
 * got an accounts response, found no messages, and every first contact arrived with a null body. The tag matched,
 * the hit was delivered, and the message had no content. In production it would have hidden, because production
 * passes no endpoint at all and each reader derives its own leaf from the globals.
 */
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

/**
 * The `request` function web/shard-reader.readAccountStates expects.
 *
 * It hands us a path with the addresses already encoded, so this only has to put it on the right host, add the
 * key, and go through the pump.
 */
export function createShardStatesRequest({ endpoint, apiKey, fetch: fetchImpl } = {}) {
  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') throw new Error('shard-rpc: fetch is unavailable');
  return async ({ path }) => {
    const base = resolveEndpoint('accountStates', endpoint);
    const key = resolveApiKey(apiKey);
    // `path` already starts with /accountStates?… — take the origin and the directory above the leaf from base.
    const url = new URL(base);
    url.pathname = url.pathname.replace(/\/accountStates$/, '') + path.split('?')[0];
    url.search = path.includes('?') ? path.slice(path.indexOf('?')) : '';
    const headers = { Accept: 'application/json' };
    if (key) headers['X-API-Key'] = key;
    const response = await scheduleToncenterHttpRequest(
      base, key, () => doFetch(url.toString(), { method: 'GET', headers }), SCAN_REQUEST_OPTIONS);
    if (!response) return { accounts: [] };            // skipped by the rate limiter: an empty pass, not an error
    if (!response.ok) throw new Error(`accountStates failed with HTTP ${response.status}`);
    return response.json();
  };
}

/**
 * `readMessages(address)` for web/intro-transport.fetchIntroCapsule: the message bodies a shard has received,
 * as cells, newest first.
 *
 * ABSENCE IS EMPTY, NOT AN ERROR — the same rule the rest of the lane follows. A shard nobody has written to has
 * no messages, and under lazy deploy that is the ordinary case rather than a failure.
 */
export function createShardMessagesReader({ endpoint, apiKey, fetch: fetchImpl, limit = 64 } = {}) {
  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') throw new Error('shard-rpc: fetch is unavailable');
  return async (address) => {
    const base = resolveEndpoint('messages', endpoint);
    const key = resolveApiKey(apiKey);
    const url = new URL(base);
    url.searchParams.set('destination', String(address));
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('sort', 'desc');
    const headers = { Accept: 'application/json' };
    if (key) headers['X-API-Key'] = key;
    const response = await scheduleToncenterHttpRequest(
      base, key, () => doFetch(url.toString(), { method: 'GET', headers }), SCAN_REQUEST_OPTIONS);
    if (!response) return [];
    if (!response.ok) throw new Error(`messages failed with HTTP ${response.status}`);
    const body = await response.json();
    const cells = [];
    for (const message of body?.messages ?? []) {
      const raw = message?.message_content?.body;
      if (!raw) continue;
      // A body that will not parse is not ours to interpret — skip it rather than fail the whole read. A shard's
      // history carries plain top-ups and bounces alongside publishes.
      try { cells.push(parseBocBase64(raw)); } catch { /* not a cell we can read */ }
    }
    return cells;
  };
}
