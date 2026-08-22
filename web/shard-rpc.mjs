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

import { scheduleToncenterHttpRequest, deriveToncenterV3Endpoint, toncenterScanLaneOptions } from './ton-rpc-transport.mjs?v=78';
import { parseBocBase64 } from './pwa-contract-transactions.mjs?v=37';

/**
 * A scan is background work: it must yield to anything the user is waiting on.
 *
 * `background` IS THE LOW TIER — it is the largest weight in TONCENTER_REQUEST_PRIORITY_WEIGHTS, i.e. the last to
 * be served. This used to say 'low', which is not in that table at all and silently fell through to `background`:
 * the intent survived by accident, and the name promised a tier that does not exist.
 */
const SCAN_REQUEST_OPTIONS = Object.freeze({
  priority: 'background',
  // A scan pass that cannot get through right now is not worth queueing behind foreground work — the next pass
  // is a minute away and the cursor makes it cheap. Better a skipped pass than a backlog of stale ones.
  skipIfRateLimited: true,
});

/**
 * The scan options for RIGHT NOW: the shared defaults above plus the pump coordinates of the configured primary
 * provider — its limiter key and its request spacing.
 *
 * RESOLVED PER CALL, not frozen at module load, for the same reason the endpoint and the key are: the transport is
 * rebuilt when the user adds their toncenter key (applyToncenterApiKey), and a lane holding the pre-key spacing
 * would keep the whole receive path at the keyless ~1 rps forever.
 *
 * See toncenterScanLaneOptions for what this cost before it existed — the header above claims the whole rate model
 * "depends on there being exactly one queue", and this lane was quietly running a second one at 12x the spacing.
 */
function scanRequestOptions(overrides = null) {
  const lane = toncenterScanLaneOptions();
  return overrides
    ? { ...SCAN_REQUEST_OPTIONS, ...lane, ...overrides }
    : { ...SCAN_REQUEST_OPTIONS, ...lane };
}

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
 *
 * TWO CALLERS WITH OPPOSITE NEEDS, WHICH IS WHY THE OPTIONS EXIST.
 *
 *   A background SCAN (INTRO, PUBLIC) wants to be skippable: a pass that cannot get through right now is not
 *   worth queueing behind the user's own reads, and an empty pass costs nothing because the next pass is a
 *   minute away and the cursor makes it cheap. That is the default.
 *
 *   A SELF-LANE PROBE (recovery restore, notes restore) uses absence as PROOF that a slot was never written, and
 *   then skips reading it. For that caller an empty answer is not a cheap non-event — it is a claim about the
 *   user's data, and a wrong one destroys it. `strict` makes this reader refuse to manufacture that claim: a
 *   request that did not actually run THROWS instead of resolving to an empty account list, so the caller's
 *   fail-safe (probeActiveAddresses -> null -> probe everything) engages. Pair it with
 *   `requestOptions: { skipIfRateLimited: false }` so the request waits its turn rather than being dropped.
 */
export function createShardStatesRequest({ endpoint, apiKey, fetch: fetchImpl, requestOptions = null, strict = false } = {}) {
  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') throw new Error('shard-rpc: fetch is unavailable');
  return async ({ path }) => {
    const options = scanRequestOptions(requestOptions);
    const base = resolveEndpoint('accountStates', endpoint);
    const key = resolveApiKey(apiKey);
    // `path` already starts with /accountStates?… — take the origin and the directory above the leaf from base.
    const url = new URL(base);
    url.pathname = url.pathname.replace(/\/accountStates$/, '') + path.split('?')[0];
    url.search = path.includes('?') ? path.slice(path.indexOf('?')) : '';
    const headers = { Accept: 'application/json' };
    if (key) headers['X-API-Key'] = key;
    // The pump hands the thunk an AbortSignal tied to its request deadline — a hung connection is cancelled, not
    // waited on for as long as the browser cares to.
    const response = await scheduleToncenterHttpRequest(
      base, key, (signal) => doFetch(url.toString(), { method: 'GET', headers, signal }), options);
    if (!response) {
      // The request never ran. For a scan that is an empty pass; for a strict caller it must NOT look like
      // "these accounts do not exist" — that is the exact shape of a silent data loss.
      if (strict) throw new Error('accountStates: the request did not run (rate-limited or dropped) — absence is not proven');
      return { accounts: [] };
    }
    if (!response.ok) {
      // SAY WHY. The owner's console, 2026-08-21: "accountStates failed with HTTP 422" for a probe over every
      // conversation's shards — and nothing more, so the cause (toncenter's own `detail`) was thrown away with the
      // body. The status rides on the error too, so a reader can tell a 422 (the request itself was refused: the
      // batch is bisected) from a 5xx/429 (the endpoint is unwell: the caller falls back).
      let detail = '';
      try { detail = typeof response.text === 'function' ? String(await response.text()).slice(0, 300) : ''; } catch { detail = ''; }
      const error = new Error(`accountStates failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
      error.status = response.status;
      error.detail = detail;
      throw error;
    }
    return response.json();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// THE HISTORY WINDOW, AND WHY IT IS FILTERED SERVER-SIDE.
//
// Capsule bodies live in a shard's inbound transaction history, so a lane reads them with /messages?limit=N,
// newest first. That window used to accept ANY inbound message, and a shard address is derivable by anyone —
// a PublicShard's from the channel wallet plus the epoch tag, an IntroShard's from (epoch, bucket), which is
// exactly what lets a stranger send a first contact at all. So a griefer could push N cheap junk messages at a
// shard and shove the real publishes out of the window: the channel feed shows only the newest posts or
// nothing, and on the INTRO lane fetchIntroCapsule stops finding the body for an entry that IS on chain and
// paid for — a first contact lost silently, which is worse.
//
// MEASURED against live toncenter v3 on 2026-07-28, because neither fix could be written blind:
//   • `opcode` IS a real server-side filter, and rows come back with message_content.body and source intact.
//     It filters over the WHOLE history, not just the first page: asking for one opcode returned 50 matching
//     rows where the unfiltered first 50 held only 40 of them.
//   • `op`, `op_code`, `message_opcode` are SILENTLY IGNORED — FastAPI drops unknown query params, so a request
//     that "succeeds" can be completely unfiltered. That is why support is proven by checking the ROWS, never
//     the status code.
//   • The opcode must be hex ("0x50535031"); a decimal value is rejected with 422.
//   • `offset` paginates and composes with `opcode`; `limit` is accepted up to at least 1000.
//   • An opcode no message carries returns an empty list with HTTP 200 — a clean empty, not an error.
//
// So the window asks for one opcode and then VERIFIES the rows. If the endpoint honoured it, one request
// returns a window of nothing but real publishes and the griefing vector is closed at the source. If it did
// not (a proxy, a self-hosted indexer, a future API change), the mismatch is visible in the rows themselves,
// and the reader pages with `offset` to fill the window with real publishes instead. Both paths were listed as
// candidates; they turn out to compose into one self-detecting reader rather than being alternatives.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

// Opcodes arrive here as a Number from one lane and a BigInt from another (each lane mirrors the constant its
// contract declares), and an indexer may report a high opcode as a NEGATIVE int32. asUintN(32) is the one
// normalisation that makes all three comparable — and it is why this is a helper rather than an inline compare.
const opcodeBits = (opcode) => BigInt.asUintN(32, BigInt(opcode));

/** The wire form toncenter wants: lower-case hex, 0x-prefixed. MEASURED: a decimal opcode is rejected with 422. */
const opcodeParam = (opcode) => `0x${opcodeBits(opcode).toString(16).padStart(8, '0')}`;

/**
 * Is this row PROVABLY not ours? Only a row whose opcode is present AND different qualifies.
 *
 * THE ASYMMETRY IS DELIBERATE AND IT IS THE SAFETY PROPERTY. A row with no opcode field is AMBIGUOUS: if the
 * endpoint honoured our filter it is one of ours and the field simply was not decoded; if it ignored the filter
 * it is junk. Dropping the ambiguous case would let an indexer that does not decode opcodes blind the lane
 * completely — every real publish discarded, the feed empty, no error. Keeping it costs at worst a slot of
 * window budget, which is exactly today's behaviour, and the body parse downstream rejects foreign bodies
 * anyway. So the filter may only ever remove something that has identified itself as belonging to someone else.
 */
function rowIsForeign(row, opcode) {
  const raw = row?.opcode;
  if (raw === null || raw === undefined || raw === '') return false;   // ambiguous — never dropped
  try { return opcodeBits(raw) !== opcodeBits(opcode); } catch { return false; }
}

/**
 * One shard's inbound message rows, newest first, restricted to `opcode` when one is given.
 *
 * Returns `{ rows, serverFiltered, pages }`. `serverFiltered` is false when the endpoint handed back rows we
 * did not ask for — the caller may want to know its window was assembled the expensive way.
 */
// `endLt`, when given, moves the window BACK in time: only messages with created_lt <= endLt are returned (toncenter
// v3 `end_lt`, inclusive — MEASURED 2026-08-21 against the live endpoint, honoured). It is what lets a reader page
// a shard's bodies backwards in step with get_page: without it every page of older ROWS was matched against the
// NEWEST 128 bodies, so "show earlier comments" worked exactly once per 128 comments and then matched nothing.
// An endpoint that ignored the parameter would hand the newest window back under an older name, so rows above the
// bound are dropped here rather than trusted.
// `startUtime` / `endUtime` (unix seconds, inclusive) bound the window by TIME instead: an entry whose created_at the
// contract stamped can have its body fetched from the minute it was written rather than from the newest-N window —
// which is how an INTRO that landed while the recipient was offline for hours stays readable (owner's console,
// 2026-08-21: "entry 20685:0:375 is on chain but no message in its shard window reproduces the stored body_commit" —
// the 375th of 648 that day, long past the newest 128). toncenter v3 `start_utime`/`end_utime`, MEASURED honoured.
async function readMessageRows({ base, key, doFetch, address, limit, opcode, maxPages, strict = false, endLt = null, startUtime = null, endUtime = null, requestOptions = null }) {
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
      base, key, (signal) => doFetch(url.toString(), { method: 'GET', headers, signal }), scanRequestOptions(requestOptions));
    if (!response) {
      // DECLINED BY THE PUMP (a 429 backoff, with skipIfRateLimited set) — the request never ran.
      //
      // For a lane that re-reads its whole window every pass, treating that as "no messages" is harmless: the next
      // pass reads it again anyway. For a lane that REMEMBERS what it read it is a silent loss — conv-lane's change
      // marker would record the shard as read at its current marker, and skip it until somebody writes to it again.
      // A capsule sitting in that shard would never be delivered, and every counter would say the pass was clean.
      // Strict callers get a throw, which their per-shard catch turns into "not read, try next pass".
      if (strict) throw new Error(`messages: the request for ${address} did not run (rate-limited or dropped)`);
      break;
    }
    if (!response.ok) throw new Error(`messages failed with HTTP ${response.status}`);
    const body = await response.json();
    const pageRows = body?.messages ?? [];
    pages += 1;
    if (pageRows.length === 0) break;

    // `offset` CAN BE IGNORED TOO, and then paging turns into an infinite supply of the same rows — the window
    // fills with duplicates of whatever is newest, which reads as a channel repeating one post. The tell is a
    // page identical to the one before it.
    //
    // FINGERPRINT THE WHOLE PAGE, NOT ITS FIRST ROW. Comparing first rows looked equivalent and was not: a flood
    // makes consecutive pages START with indistinguishable junk, so the reader declared "no more history" and
    // stopped one page short of the real publishes it was paging towards — the very rows it went looking for.
    const pageMark = pageRows.map((row) => row?.hash ?? row?.message_content?.body ?? '').join('|');
    if (offset > 0 && pageMark === previousPageMark) break;
    previousPageMark = pageMark;

    const inBound = bound === null
      ? pageRows
      : pageRows.filter((row) => { try { return row?.created_lt == null || BigInt(row.created_lt) <= bound; } catch { return false; } });
    const wanted = (opcode === null || opcode === undefined)
      ? inBound
      : inBound.filter((row) => !rowIsForeign(row, opcode));
    // A row belonging to someone else is the ONLY proof that the filter was ignored — the status code says
    // nothing, since an unknown query parameter is dropped silently and still answers 200.
    if (wanted.length !== pageRows.length) serverFiltered = false;
    rows.push(...wanted);

    if (rows.length >= limit) { rows.length = limit; break; }
    if (pageRows.length < limit) break;         // the endpoint ran out of history, filtered or not
    if (serverFiltered) break;                  // a full page of ours IS the window; nothing to page for
    offset += pageRows.length;                  // junk in the window — page past it to fill up on real rows
  }
  return { rows, serverFiltered, pages };
}

/**
 * `readMessages(address)` for web/intro-transport.fetchIntroCapsule: the message bodies a shard has received,
 * as cells, newest first.
 *
 * ABSENCE IS EMPTY, NOT AN ERROR — the same rule the rest of the lane follows. A shard nobody has written to has
 * no messages, and under lazy deploy that is the ordinary case rather than a failure.
 *
 * `opcode` restricts the window to one message type (see the block above). Omitting it keeps the old
 * take-everything behaviour, which is what the tests that stub the transport rely on.
 */
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
      // A body that will not parse is not ours to interpret — skip it rather than fail the whole read. A shard's
      // history carries plain top-ups and bounces alongside publishes.
      try { cells.push(parseBocBase64(raw)); } catch { /* not a cell we can read */ }
    }
    return cells;
  };
}

/**
 * `readMessagesWithSource(address) -> [{ bodyCell, source }]`, newest first — the reader the PUBLIC lane needs.
 *
 * WHY A SECOND READER RATHER THAN A FLAG ON THE FIRST. The CONV/INTRO/RECOVERY lanes never need the sender: a
 * private capsule authenticates by a signature carried IN the body, so who sent the transaction is irrelevant
 * (and deliberately unlinkable). The PUBLIC lane is the opposite — a post's AUTHOR is the whole point, and it is
 * recovered from the transaction's source, because get_page omits the publisher to stay narrow. Keeping the
 * source-free reader source-free preserves that separation.
 *
 * `source` is a TOP-LEVEL field of each message object, raw `0:HEX`, alongside message_content.body — MEASURED
 * against live toncenter v3 2026-07-21 (not message.in_msg.source, which does not exist on this shape). A message
 * whose body will not parse is skipped, exactly like the source-free reader; absence is [], not an error.
 */
// limit 128 (not 64): readPosts matches /messages bodies against get_page commits, and get_page returns up to 96 per
// page (PS_PAGE_CAP). At 64 a shard holding 65-96 live entries would leave the oldest in-page posts with no body to
// match, silently dropping them. 128 covers the page cap plus top-up/bounce noise; a shard busier than that needs
// message pagination (a later refinement — logged, not silent).
//
// `opcode` is what keeps that budget spent on real publishes rather than on whatever a stranger chose to send —
// see the measured block above. Each lane passes its own: PSP1 for public posts, ISP1 for first contacts, RSP1
// for CONV capsules. Omitting it preserves the take-everything behaviour.
// `endLt` (second argument, optional) moves the window back in time — see readMessageRows. Each row carries its
// `createdLt` (toncenter's created_lt, a decimal string, or null) so a reader can record where its window ended and
// ask for what lies before it next time.
// `requestOptions` overrides the pump coordinates for THIS reader (priority, skipIfRateLimited) — the same knob
// createShardStatesRequest has, for the same reason: a reader built for something the user is looking at must not
// queue behind a background sweep, nor be dropped by it.
export function createShardMessagesWithSourceReader({ endpoint, apiKey, fetch: fetchImpl, limit = 128, opcode = null, maxPages = 8, strict = false, requestOptions = null } = {}) {
  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') throw new Error('shard-rpc: fetch is unavailable');
  return async (address, { endLt = null, startUtime = null, endUtime = null } = {}) => {
    const base = resolveEndpoint('messages', endpoint);
    const key = resolveApiKey(apiKey);
    const { rows } = await readMessageRows({ base, key, doFetch, address, limit, opcode, maxPages, strict, endLt, startUtime, endUtime, requestOptions });
    const out = [];
    for (const message of rows) {
      const raw = message?.message_content?.body;
      if (!raw) continue;
      let bodyCell;
      try { bodyCell = parseBocBase64(raw); } catch { continue; }
      out.push({ bodyCell, source: message?.source ?? null, createdLt: message?.created_lt == null ? null : String(message.created_lt) });
    }
    return out;
  };
}
