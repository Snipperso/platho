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
import { readAccountStates, toWireAddress } from './shard-reader.mjs';
import { parseIntroPublish, parseIntroEntryStack } from './intro-codec.mjs?v=1';
import { parseBocBase64, computeCellHashAndDepth, beginCell } from './pwa-contract-transactions.mjs?v=1';

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
    // TVM -256 is "account is not initialised", which is genuine absence. Every other non-zero exit means the
    // account EXISTS and the call failed, which must not be mistaken for an empty bucket.
    if (raw.exit_code === -256) return null;
    if (raw.exit_code !== 0) throw new Error(`get_scan_page failed with exit_code ${raw.exit_code}`);
    return (parseStack ?? parseScanPageStack)(raw.stack);
  };
}

/** Absence must come from a structured field, never from a substring of an endpoint-controlled message. */
function isStructurallyAbsent(error) {
  const code = error?.exit_code ?? error?.exitCode ?? error?.body?.exit_code;
  if (code === -256) return true;
  const status = error?.status ?? error?.response?.status;
  return status === 404;
}

/** IntroScanPage comes back as five stack items in declaration order. */
export function parseScanPageStack(stack) {
  if (!Array.isArray(stack) || stack.length < 5) throw new Error(`get_scan_page returned ${stack?.length ?? 0} stack items, expected 5`);
  const num = (i) => BigInt(stack[i]?.value ?? 0);
  const cell = (i) => {
    const value = stack[i]?.value;
    if (!value) return beginCell().endCell();
    return typeof value === 'string' ? cellFromBase64(value) : value;
  };
  return { from_id: num(0), count: num(1), next_id: num(2), evict_cursor: num(3), pairs: cell(4) };
}

const cellFromBase64 = (value) => parseBocBase64(value);

/**
 * Recompute the commitment the CONTRACT stores for an intro: H(IS_BODY_DOMAIN ‖ header_0.hash ‖ body.hash).
 * Mirrors IntroShard.bodyCommit — and mirroring it here rather than importing the reference is what lets the
 * whole delivery check run in a browser. tests/intro-codec.test.ts pins the pieces it is built from.
 */
const IS_BODY_DOMAIN = 0x49534243;
async function introBodyCommitBrowser(header0, body) {
  const h0 = (await computeCellHashAndDepth(header0)).hash;
  const bodyHash = (await computeCellHashAndDepth(body)).hash;
  const preimage = beginCell();
  preimage.uint(IS_BODY_DOMAIN, 32, 'IS_BODY_DOMAIN');
  preimage.uint(BigInt('0x' + Buffer.from(h0).toString('hex')), 256, 'header_0 hash');
  preimage.uint(BigInt('0x' + Buffer.from(bodyHash).toString('hex')), 256, 'body hash');
  const { hash } = await computeCellHashAndDepth(preimage.endCell());
  return BigInt('0x' + Buffer.from(hash).toString('hex'));
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

  for (const message of await readMessages(address)) {
    let parsed;
    try { parsed = parseIntroPublish(message); } catch { continue; }            // not an IntroPublish; skip
    if ((await introBodyCommitBrowser(parsed.header0, parsed.body)) !== wanted) continue;
    return { header0: parsed.header0, body: parsed.body, r: parsed.r, viewTag: parsed.viewTag, bodyCommit: wanted };
  }
  return null;   // the entry exists but its transaction is beyond what this endpoint retains
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
