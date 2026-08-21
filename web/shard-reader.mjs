// shard-reader — batched reads of clean-17 shard accounts.
//
// WHY THIS EXISTS AS ITS OWN MODULE. The INTRO lane's receive path is a leak-free scan: the recipient cannot ask
// "which entries are mine" without revealing exactly the who-contacts-whom graph the lane exists to hide, so it
// must look at EVERY bucket. That makes the cost of asking about a bucket the whole ballgame, and MEASURED against
// live toncenter v3 on 2026-07-18 the two ways of asking are two orders of magnitude apart:
//
//   runGetMethod   one address per call. An array of addresses is rejected (422). No batch form exists.
//   accountStates  1149 addresses per call, capped by URL LENGTH (64 KiB), not by any address count.
//
// So the scan is driven by batched accountStates, and the per-bucket getter (IntroShard.get_scan_page) is used
// only where it wins: fetching the NEW entries of a bucket already known to have changed, since a state read
// returns the whole dictionary while the getter takes a cursor.
//
// THE MEASURED FACTS THIS MODULE ENCODES — do not "simplify" any of them away:
//   1. The ceiling is 1149 addresses (URL 65_553 B); 1150 is refused with HTTP 414. It is a byte limit, so it
//      moves with the address form.
//   2. The wire form is worth 35%. A url-safe friendly address encodes to 48 chars with NO percent-escaping
//      (url-safe base64 uses - and _), i.e. 57.1 B per address including "address=" and "&". Raw hex costs
//      77.1 B and only 850 fit. ALWAYS send url-safe friendly.
//   3. Uninitialised accounts are OMITTED from the response entirely. An empty bucket therefore costs zero bytes
//      and MUST be read as "empty", never as an error — with lazy deploy, most buckets are legitimately absent.
//      (A live bucket costs ~439 B without BOC.)
//   4. include_boc is all-or-nothing: with it on you also download code_boc, which is identical for every shard.
//      The cheap pass therefore runs with it OFF and uses data_hash / last_transaction_lt to spot changes.

import { addrKey } from './shard-discovery.mjs?v=20';

// One request covers a full 1024-bucket read space with headroom under the measured 1149 ceiling. Deliberately
// NOT set to 1149: the limit is in bytes, so a longer address form or an extra query parameter would silently
// push a maximal request over the wall and turn a scan into an HTTP 414.
export const ACCOUNT_STATES_MAX_PER_CALL = 1024;

/** Split addresses into request-sized groups. */
export function chunkAddresses(addresses, size = ACCOUNT_STATES_MAX_PER_CALL) {
  if (!Number.isInteger(size) || size < 1) throw new Error(`chunk size must be a positive integer, got ${size}`);
  const out = [];
  for (let i = 0; i < addresses.length; i += size) out.push(addresses.slice(i, i + size));
  return out;
}

/** The wire form. url-safe friendly, bounceable — see fact (2) above; this is worth 35% of the request budget. */
export function toWireAddress(address) {
  if (typeof address === 'string') return address;
  return address.toString({ urlSafe: true, bounceable: true });
}

/**
 * Read many shard accounts in as few requests as possible.
 *
 * `request` is injected rather than imported so this module stays transport-agnostic: the app supplies the shared
 * rate-limited pump, tests supply a stub or a sandbox-backed reader. It is called as
 * `request({ path, addresses, includeBoc })` and must resolve to the parsed `accountStates` response.
 *
 * Returns a Map keyed by the canonical address string. ABSENT MEANS EMPTY: a bucket nobody has written to has no
 * account, which is the normal case under lazy deploy, not a failure.
 */
// ADDRESSES THE ENDPOINT HAS REFUSED THIS SESSION, by wire form. A refusal is a verdict about the address, not about
// the moment: the same probe runs every pass (the conversation sweep, the recovery-slot check), and a refused address
// asked again is the same 422 again — the owner's console, 2026-08-21, was a column of identical red rows. Once
// refused, an address is answered from here as UNKNOWN and never put on the wire again until reload.
const refusedWire = new Set();
// Whether a 422 whose body does NOT name the position has been reported this session. One line, red, with the
// endpoint's own words: the owner reads the console by its red rows, and a handled-but-unexplained refusal that
// only ever warned in yellow stayed invisible to them (2026-08-21, twice).
let unnamedRefusalReported = false;
export function __resetRefusedAddressesForTests() { refusedWire.clear(); unnamedRefusalReported = false; }

const refusedRow = (wire) => ({ address: wire, status: 'unknown', balance: 0n, dataHash: null, codeHash: null, lastLt: null, dataBoc: null, refused: true });

/**
 * Which address a 422 is about, when the endpoint says. toncenter v3 names the culprit by position:
 *   {"error":"failed to decode: schema: error converting value for index 7 of \"address\""}
 * -1 when the body does not say (an older endpoint, a proxy, a different reason) — the caller then bisects.
 */
export function refusedIndexFromDetail(detail) {
  const m = /index (\d+) of \\?"address\\?"/.exec(String(detail ?? ''));
  return m ? Number(m[1]) : -1;
}

export async function readAccountStates(addresses, { request, includeBoc = false, chunkSize } = {}) {
  if (typeof request !== 'function') throw new Error('readAccountStates requires a `request` function');
  const out = new Map();
  const noteRefused = (wire, detail) => {
    // Red on purpose, once per address per session: this is an address the app built and the endpoint will not
    // parse, which is either a client bug or an endpoint change — both need a human, and the human reads red rows.
    if (!refusedWire.has(wire)) console.error('[states] the endpoint refused one address — left UNKNOWN, not absent:', wire, detail ?? '');
    refusedWire.add(wire);
    out.set(addrKey(wire), refusedRow(wire));
  };
  const readGroup = async (group) => {
    const wire = [];
    for (const address of group) {
      const w = toWireAddress(address);
      if (refusedWire.has(w)) out.set(addrKey(w), refusedRow(w));   // answered from memory, not from the wire
      else wire.push(w);
    }
    if (wire.length === 0) return;
    const qs = wire.map((a) => `address=${encodeURIComponent(a)}`).join('&');
    const path = `/accountStates?${qs}&include_boc=${includeBoc ? 'true' : 'false'}`;
    let body;
    try {
      body = await request({ path, addresses: wire, includeBoc });
    } catch (error) {
      // A 422 IS ABOUT THE REQUEST, NOT THE ENDPOINT. The owner's console, 2026-08-21: one probe over every
      // conversation's shards answered 422, and the whole probe was abandoned — every shard then read the slow way,
      // every pass. Whatever the endpoint refused, the rest of the batch is still answerable. When the body NAMES
      // the position, that one address is excised and the rest asked again in ONE request; when it does not, the
      // batch is split and asked again, down to single addresses. A refused address is recorded as UNKNOWN — not
      // omitted, because for the lanes that read this map an omitted address means "never written, skip it", and
      // that is the silent-loss shape. An unknown row carries no marker, which every lane already treats as "read
      // it, remember nothing".
      if (error?.status === 422) {
        const index = refusedIndexFromDetail(error?.detail);
        if (index >= 0 && index < wire.length) {
          noteRefused(wire[index], error?.detail);
          if (wire.length > 1) await readGroup([...wire.slice(0, index), ...wire.slice(index + 1)]);
          return;
        }
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
      throw error;
    }
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
  for (const group of chunkAddresses(addresses, chunkSize ?? ACCOUNT_STATES_MAX_PER_CALL)) await readGroup(group);
  return out;
}

/**
 * Which of `addresses` changed since the caller last looked.
 *
 * `seen` maps address key -> the last `lastLt` (or dataHash) the caller processed. An address absent from the
 * chain is absent from the result: there is nothing to read. An address the caller has never seen counts as
 * changed, which is what makes a cold start work without any special case.
 */
export function changedSince(states, seen = new Map()) {
  const changed = [];
  for (const [key, state] of states) {
    const previous = seen.get(key);
    if (previous === undefined || previous === null) { changed.push({ key, state }); continue; }
    if (String(state.lastLt ?? state.dataHash) !== String(previous)) changed.push({ key, state });
  }
  return changed;
}

/** The marker to remember for `changedSince` — kept in one place so the two sides cannot drift apart. */
export const changeMarkerOf = (state) => String(state.lastLt ?? state.dataHash);

/**
 * A LIVE account — one that actually carries code, so a get-method against it will run.
 *
 * ACTIVE, NOT MERELY PRESENT. readAccountStates reports touched-but-uninit accounts too: anyone can send a
 * coin to a publicly-derivable address and leave a 525 B row behind, and a get-method on that row still aborts
 * with exit -13. A bare presence check would therefore be spoofable by a stranger. Frozen counts as not-live for
 * the same reason — a frozen account has no code either. One definition, used by every lane, so the public feed
 * and the self lanes cannot drift into disagreeing about what "exists" means.
 */
export const isActiveAccountState = (state) => state?.status === 'active';

/**
 * Which of `addresses` are live, in ONE request — the pre-pass that turns an N-address probe into 1 + (however
 * many are real). Returns a Set of addrKeys, or **null when the answer must not be trusted**.
 *
 * NULL IS THE WHOLE SAFETY CONTRACT, so read this before using it. Callers use this to SKIP work, and the skips
 * are irreversible in the worst way: a self-lane restore that wrongly skips a bound slot reports "nothing was
 * backed up" and the next backup then overwrites the chain with a partial map — silent, permanent loss of the
 * user's conversations. So absence from the response may only mean "not on chain" when the response is KNOWN
 * COMPLETE. Every failure path (throw, rate-limit skip, a non-Map answer from a stubbed reader) returns null
 * instead, and null means "I learned nothing — probe everything the slow way". The optimisation can then only
 * ever change the COST of an answer, never the answer.
 *
 * The counterpart obligation lives in the transport: the request this runs on must be built strict, so that a
 * skipped request throws rather than resolving to an empty account list. See shard-rpc.createShardStatesRequest.
 */
export async function probeActiveAddresses(addresses, readStates) {
  if (typeof readStates !== 'function') return null;
  if (!Array.isArray(addresses) || addresses.length === 0) return new Set();
  let states;
  try {
    states = await readStates(addresses);
  } catch {
    return null;                       // a read I could not complete is NEVER "these addresses are empty"
  }
  if (!(states instanceof Map)) return null;
  const active = new Set();
  for (const [key, state] of states) if (isActiveAccountState(state)) active.add(key);
  return active;
}
