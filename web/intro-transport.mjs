// intro-transport — the real wires for the INTRO receive path: read shard states, page a shard, fetch a body.
//
// The scan logic in intro-receive.mjs takes its transport injected, so this module is the one place that knows
// about toncenter. Everything here goes through the shared rate-limited pump rather than calling fetch directly,
// so the scan competes fairly with sends and reads from the rest of the app instead of starving them.
//
// THE THIRD FUNCTION IS THE ONE THAT COMPLETES THE LANE. A hit tells you an intro is yours; it does not give you
// the message. State stores only (r, view_tag, body_commit, created_at) — the capsule cells ride in the publish
// TRANSACTION and live in the shard's history. So delivery ends by fetching that transaction and checking the
// cells against the commitment the CONTRACT computed. That check is what makes the fetch safe: an RPC endpoint
// that lies about the body produces a different commit and is rejected, so the body needs no trust in the reader.

// No @ton/core and no build/*.ts here on purpose: this module runs in the browser, where neither loads. Cells are
// the client's own records, parsed by its own reader — see web/intro-codec.mjs and web/shard-address.mjs, each
// pinned against the reference implementation because a divergence here fails silently.
import { readAccountStates, toWireAddress } from './shard-reader.mjs?v=11';
import { parseIntroPublish, parseIntroEntryStack } from './intro-codec.mjs?v=2';
import { stackNumOr0 } from './ton-stack-num.mjs?v=1';
import { parseBocBase64, computeCellHashAndDepth, beginCell, bytesToBigUint } from './pwa-contract-transactions.mjs?v=35';

/**
 * Bind the batched state read to a request function.
 *
 * `sendRequest({ path })` must perform the GET and resolve the parsed JSON. In the app that is a thin wrapper over
 * the shared toncenter pump; in tests it is whatever stands in for the network.
 */
export function createShardStateReader(sendRequest) {
  if (typeof sendRequest !== 'function') throw new Error('createShardStateReader requires a request function');
  return (addresses) => readAccountStates(addresses, { request: sendRequest });
}

/**
 * Bind the per-shard scan page to a get-method runner.
 *
 * `runGetMethod({ address, method, stack })` must resolve toncenter's runGetMethod response, or null/throw for an
 * account that does not exist. An absent shard returns null rather than raising: under lazy deploy most buckets
 * have never been written to, and that is the normal case, not a failure.
 */
export function createScanPageReader(runGetMethod, { parseStack } = {}) {
  if (typeof runGetMethod !== 'function') throw new Error('createScanPageReader requires runGetMethod');
  return async (address, fromId, maxCount) => {
    let raw;
    try {
      raw = await runGetMethod({
        address: toWireAddress(address),
        method: 'get_scan_page',
        stack: [{ type: 'num', value: String(fromId) }, { type: 'num', value: String(maxCount) }],
      });
    } catch (error) {
      // "THIS ACCOUNT DOES NOT EXIST" AND "I COULD NOT READ IT" ARE NOT THE SAME ANSWER, and collapsing them was
      // a real defect: the scanner reads null as "empty bucket", so a rate limit, a proxy error page or a hostile
      // endpoint could declare any bucket empty and the intros in it were silently and permanently lost.
      // Absence is recognised ONLY from a structured signal, never from prose an endpoint controls. Anything else
      // is rethrown, and the scanner leaves that bucket's cursor alone so the next pass retries it.
      if (isStructurallyAbsent(error)) return null;
      throw error;
    }
    if (!raw) throw new Error('runGetMethod returned no response');
    // A code-less account aborts the get-method with -13 (production) or -256 (sandbox) = genuine absence. Every other
    // non-zero exit means the account EXISTS and the call failed, which must not be mistaken for an empty bucket.
    if (raw.exit_code === -256 || raw.exit_code === -13) return null;
    if (raw.exit_code !== 0) throw new Error(`get_scan_page failed with exit_code ${raw.exit_code}`);
    return (parseStack ?? parseScanPageStack)(raw.stack);
  };
}

/** Absence must come from the non-spoofable TVM abort code for a code-less account, never a transport status an
 *  intermediary controls. Through this transport that code is -13 in production (TON_GET_METHOD_UNINITIALIZED_EXIT_CODE,
 *  as matched by isAthWalletNotDeployedError) and -256 under the @ton/sandbox emulator, so BOTH count. A bare HTTP 404 is
 *  NOT absence: toncenter returns an uninitialised account as HTTP 200 + that exit code, so a 404 only ever means an
 *  endpoint/proxy/gateway failure — reading it as "empty bucket" is exactly the silent-loss this function's callers warn
 *  against. Rethrow it as transient so the scanner retries. [confirm review: uninit code -13, 404 false-absence] */
function isStructurallyAbsent(error) {
  const code = Number(error?.exit_code ?? error?.exitCode ?? error?.body?.exit_code);
  return code === -13 || code === -256;
}

/**
 * IntroScanPage comes back as FOUR stack items in declaration order: from_id, count, next_id, pairs.
 *
 * IT WAS FIVE UNTIL 2026-07-19, when per-entry eviction was deleted and `evict_cursor` went with it — nothing
 * removes an intro any more, so the live floor is always 0 and the field carried no information. That dropped
 * `pairs` from index 4 to index 3.
 *
 * THIS FUNCTION IS WHY THAT CHANGE WAS DANGEROUS. It is the DEFAULT decoder on the production scan path, and
 * every test in the suite stubs `readScanPage` a level above it — so a stale index here would have thrown on
 * every bucket, stopping all first contacts, while the whole suite stayed green. tests/intro-scan-page.test.ts
 * now drives it against a REAL getter stack from the compiled contract instead of a hand-written fixture.
 */
export function parseScanPageStack(stack) {
  if (!Array.isArray(stack) || stack.length < 4) throw new Error(`get_scan_page returned ${stack?.length ?? 0} stack items, expected 4`);
  const num = (i) => stackNumOr0(stack[i]?.value, `get_scan_page[${i}]`);
  const cell = (i) => {
    const value = stack[i]?.value;
    if (!value) return beginCell().endCell();
    return typeof value === 'string' ? cellFromBase64(value) : value;
  };
  return { from_id: num(0), count: num(1), next_id: num(2), pairs: cell(3) };
}

const cellFromBase64 = (value) => parseBocBase64(value);

/**
 * Recompute the commitment the CONTRACT stores for an intro: H(IS_BODY_DOMAIN ‖ header_0.hash ‖ body.hash).
 * Mirrors IntroShard.bodyCommit — and mirroring it here rather than importing the reference is what lets the
 * whole delivery check run in a browser. tests/intro-codec.test.ts pins the pieces it is built from.
 */
const IS_BODY_DOMAIN = 0x49534243;
export async function introBodyCommitBrowser(header0, body) {
  const h0 = (await computeCellHashAndDepth(header0)).hash;
  const bodyHash = (await computeCellHashAndDepth(body)).hash;
  const preimage = beginCell();
  preimage.uint(IS_BODY_DOMAIN, 32, 'IS_BODY_DOMAIN');
  preimage.uint(bytesToBigUint(h0), 256, 'header_0 hash');
  preimage.uint(bytesToBigUint(bodyHash), 256, 'body hash');
  const { hash } = await computeCellHashAndDepth(preimage.endCell());
  return bytesToBigUint(hash);
}

/**
 * Fetch and VERIFY the capsule of one intro.
 *
 * `readMessages(address)` must resolve the message bodies delivered to that shard, newest first, each as a Cell
 * (toncenter returns them base64 in message_content.body). The body is accepted only when the cells reproduce the
 * `body_commit` the contract stored for this entry — so a wrong, stale or hostile response is rejected rather
 * than shown to the user as a message.
 */
export async function fetchIntroCapsule({ address, entryId, readEntry, readMessages }) {
  if (typeof readEntry !== 'function' || typeof readMessages !== 'function') {
    throw new Error('fetchIntroCapsule requires readEntry and readMessages');
  }
  const entry = await readEntry(address, entryId);
  if (!entry?.exists) return null;
  const wanted = BigInt(entry.body_commit);

  // EVERY matching row is collected, not just the first, and the OLDEST one wins. Rows arrive newest-first, so the
  // last match in this loop is the earliest publish.
  //
  // WHY (wave-7 audit): IntroShard does not store the publisher, so the sender's wallet can only come from the shard's
  // message history — and anyone who reads a published INTRO off the chain can re-publish those exact bytes into the
  // same shard. Their row hashes to the SAME body_commit and, being newer, used to win. The reply then resolved the
  // WRONG KeyShard; resolvePeerBundleFromKeyShardView fails closed on the keyId mismatch, so nothing is impersonated —
  // but the responder could never reply, permanently, for the price of one publish.
  //
  // Oldest-wins is not a heuristic, it is the ordering the attack cannot beat: a copy must be READ before it can be
  // made, so a replay is always strictly newer than the genuine publish. The cells themselves are interchangeable —
  // every match reproduces the same body_commit, hence the same header0/body — so only the source differs.
  let capsuleCells = null;
  const sources = [];
  for (const item of await readMessages(address)) {
    // readMessages may yield plain body Cells (source-free reader) or { bodyCell, source } (with-source reader). The
    // source is the INTRO publish transaction's src = the SENDER's wallet (direct-pay), which the responder needs to
    // read the sender's KeyShard and resolve their full bundle for a reply. It is a HINT: verified downstream against
    // the sender keyId, never trusted on its own. [clean17-private-lane-plan: Y reply-bundle resolution]
    const message = item?.bodyCell ?? item;
    const source = item?.source ?? null;
    let parsed;
    try { parsed = parseIntroPublish(message); } catch { continue; }            // not an IntroPublish; skip
    if ((await introBodyCommitBrowser(parsed.header0, parsed.body)) !== wanted) continue;
    if (!capsuleCells) capsuleCells = { header0: parsed.header0, body: parsed.body, r: parsed.r, viewTag: parsed.viewTag };
    if (source) sources.push(source);
  }
  if (!capsuleCells) return null;   // the entry exists but its transaction is beyond what this endpoint retains

  // created_at is the CONTRACT-STAMPED time from the entry (IntroShard stamps now(); get_entry returns it). It MUST
  // be surfaced: re-INTRO K_root adoption orders on it, and it is the only recency value BOTH sides read identically
  // — a local clock would let the two sides disagree on which re-INTRO is newest and silently fork the conversation.
  //
  // sourceCandidates is oldest-first, so a reply that still fails the keyId check (the genuine row aged out of this
  // endpoint's window, leaving only replays) has somewhere to look instead of dying silently.
  const candidates = [...sources].reverse();
  return {
    ...capsuleCells,
    bodyCommit: wanted,
    created_at: entry.created_at,
    source: candidates.length ? candidates[0] : null,
    sourceCandidates: candidates,
  };
}

/**
 * Read one entry's stored fields — including body_commit, which the scan page deliberately omits and which the
 * delivery check rests on. Goes through runGetMethod like everything else here, so no contract wrapper is needed.
 */
export function createEntryReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createEntryReader requires runGetMethod');
  return async (address, entryId) => {
    const raw = await runGetMethod({
      address: toWireAddress(address),
      method: 'get_entry',
      stack: [{ type: 'num', value: String(entryId) }],
    });
    if (!raw || raw.exit_code !== 0) return { exists: false };
    return parseIntroEntryStack(raw.stack);
  };
}
