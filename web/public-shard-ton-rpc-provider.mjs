// public-shard-ton-rpc-provider — the READ side of the clean-17 public/avatar lane.
//
// It turns a PublicShard address into rendered posts, and it is what the feed and the avatar reader call. Three
// facts about the lane shape everything here:
//
//   1. STATE IS THIN. A shard stores only (publisher, body_commit, created_at) per entry; the capsule BYTES ride
//      in the shard's transaction history. So a post is assembled from TWO reads: get_page (the authenticated
//      commits, one runGetMethod for the whole page) and /messages (the bodies). A body is real only when it
//      hashes to a stored commit — forging one is a sha256 preimage — so the match is the authentication.
//
//   2. THE PUBLISHER IS RECOVERED, NOT STORED IN THE PAGE. get_page omits it to stay narrow; the trustworthy
//      publisher is the `source` of the /messages entry whose body matched a commit. For a BEACON that source IS
//      the announcing channel wallet — the whole point of the directory.
//
//   3. RANK BY entry_count, NEVER BY last_transaction_lt. A bucket touched by a value message with no StateInit
//      runs its compute phase skipped and no gate fires, so an attacker moves lt to the top of Discover for a
//      forward fee. entry_count (and data_hash) move only on an accepted, PAID publish. This is mandatory fix #1.
//
// It reuses the shared transport (runGetMethod through the app's pump, readAccountStates for the batched sweep,
// the /messages reader) rather than inventing a path — one queue per client key is what the rate model rests on.

import { computeCellHashAndDepth, beginCell, parseBocBase64, readPublicPartHeaderInfo, bytesToBigUint } from './pwa-contract-transactions.mjs?v=47';
import { parseVaultPublishEnvelope } from './m21c-envelope.mjs?v=3';
import { parseTonAddress } from './crypto/platho-crypto.mjs?v=21';

export class PublicShardTonRpcProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PublicShardTonRpcProviderError';
  }
}

// MUST equal PS_BODY_DOMAIN in contracts/PublicShard.tact. The commitment is defined by the contract, so client
// and reader cannot disagree about it — this mirror is what lets the check run in a browser.
const PS_BODY_DOMAIN = 0x50534644n;

export function stackItemValue(item) {
  if (Array.isArray(item)) return item[1];
  if (item && typeof item === 'object' && 'value' in item) return item.value;
  if (item && typeof item === 'object' && 'num' in item) return item.num;
  if (item && typeof item === 'object' && 'cell' in item) return item.cell;
  if (item && typeof item === 'object' && 'boc' in item) return item.boc;
  return item;
}

export function readInt(stack, index, name) {
  const raw = stackItemValue(stack[index]);
  if (typeof raw === 'bigint') return raw;
  if (typeof raw === 'number' && Number.isSafeInteger(raw)) return BigInt(raw);
  if (typeof raw === 'boolean') return raw ? -1n : 0n;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (/^-?0x[0-9a-fA-F]+$/.test(t)) return t.startsWith('-') ? -BigInt(`0x${t.slice(3)}`) : BigInt(t);
    if (/^-?[0-9]+$/.test(t)) return BigInt(t);
  }
  throw new PublicShardTonRpcProviderError(`${name} is not an integer stack item`);
}

export function readCell(stack, index) {
  const raw = stackItemValue(stack[index]);
  if (!raw) return null;
  if (typeof raw === 'string') { try { return parseBocBase64(raw); } catch { return null; } }
  return raw;   // already a Cell (sandbox test harness)
}

// TWO CELL WORLDS, one reader. get_page rows and message bodies arrive as @ton/core Cells in tests (the compiled
// wrapper / sandbox) and as the client's own { data, bitLength, refs } cells in production (parseBocBase64). This
// is the exact dual-world pattern web/intro-receive.unpackScanPage uses; the alternative — one decoder per world —
// is how the intro page decoder silently broke once.
function cellRefs(cell) {
  return (cell && Array.isArray(cell.refs)) ? cell.refs : [];
}

/** A sequential bit reader over either cell world. Reads big-endian, exactly as Tact stored the fields. */
export function cellReader(cell) {
  if (cell && typeof cell.beginParse === 'function') {
    const slice = cell.beginParse();
    return {
      remaining: () => slice.remainingBits,
      refs: () => slice.remainingRefs,
      loadUint: (w) => slice.loadUintBig(w),
      loadRef: () => slice.loadRef(),
    };
  }
  const bytes = cell?.data ?? new Uint8Array(0);
  const bitLength = Number(cell?.bitLength ?? bytes.length * 8);
  const refs = cellRefs(cell);
  let bit = 0;
  let refIndex = 0;
  return {
    remaining: () => bitLength - bit,
    refs: () => refs.length - refIndex,
    loadUint: (w) => {
      let value = 0n;
      for (let i = 0; i < w; i += 1, bit += 1) {
        value = (value << 1n) | BigInt(((bytes[bit >> 3] ?? 0) >> (7 - (bit & 7))) & 1);
      }
      return value;
    },
    loadRef: () => refs[refIndex++] ?? null,
  };
}

export function extractStack(result) {
  const stack = result?.stack ?? result?.result?.stack;
  if (!Array.isArray(stack)) throw new PublicShardTonRpcProviderError('TON get-method response did not include a stack');
  return stack;
}

/** PublicShardView, in getter stack order. The arity check guards the same drift the registry lanes learned the
 *  hard way — a getter that grew a field would silently shift every value after it. */
export function decodePublicShardView(result, decodeAddressSliceBoc) {
  const stack = extractStack(result);
  if (stack.length !== 13) {
    throw new PublicShardTonRpcProviderError(`PublicShard get_view ABI mismatch: expected 13 stack items, got ${stack.length}`);
  }
  const feeSinkItem = stack[12];
  const feeRaw = stackItemValue(feeSinkItem);
  let feeSink = null;
  if (typeof feeSinkItem?.address === 'string') feeSink = parseTonAddress(feeSinkItem.address).raw;
  else if (typeof feeRaw === 'string') {
    try { feeSink = parseTonAddress(feeRaw).raw; }
    catch { feeSink = typeof decodeAddressSliceBoc === 'function' ? decodeAddressSliceBoc(feeRaw) : null; }
  }
  return {
    partition_key: readInt(stack, 0, 'partition_key'),
    epoch_tag: readInt(stack, 1, 'epoch_tag'),
    kind: readInt(stack, 2, 'kind'),
    era_index: readInt(stack, 3, 'era_index'),
    entry_count: readInt(stack, 4, 'entry_count'),
    safe_cap: readInt(stack, 5, 'safe_cap'),
    era_seconds: readInt(stack, 6, 'era_seconds'),
    retention: readInt(stack, 7, 'retention'),
    min_value: readInt(stack, 8, 'min_value'),
    deploy_min_value: readInt(stack, 9, 'deploy_min_value'),
    protocol_fee: readInt(stack, 10, 'protocol_fee'),
    retire_at: readInt(stack, 11, 'retire_at'),
    fee_sink: feeSink,
  };
}

export const PUBLIC_ROW_BITS = 448;                    // mirrors PS_ROW_BITS in contracts/PublicShard.tact
/** PS_HIDDEN_PAGE_CAP: ids one get_hidden_ids answers (MEASURED 276,019 gas at a full page). */
export const HIDDEN_PAGE_CAP = 310;
export const PUBLIC_PUBLISHER_TAG_MOD = 1n << 128n;    // mirrors PS_PUBLISHER_TAG_MOD

/** The same low-128-bit tag the shard packs, computed from a full raw address ("0:hex64"). */
export function publisherTagOf(rawAddress) {
  const hex = String(rawAddress).split(':').pop();
  return BigInt(`0x${hex}`) % PUBLIC_PUBLISHER_TAG_MOD;
}

/**
 * get_page -> the authenticated rows. Walks the ref-chained (commit, created_at, publisher_tag) cells, 2 per cell.
 *
 * [CHANGED 2026-07-30, wave-8 HIGH] The row grew from 320 to 448 bits, so the packing went from 3 rows per cell to 2.
 * This layout is MIRRORED in contracts/PublicShard.tact (PS_ROW_BITS / PS_PAIRS_PER_CELL) and the two must move
 * together — a width mismatch here reads as an empty or garbled feed, not as an error.
 */
export function decodePublicPage(result) {
  const stack = extractStack(result);
  if (stack.length !== 4) {
    throw new PublicShardTonRpcProviderError(`PublicShard get_page ABI mismatch: expected 4 stack items, got ${stack.length}`);
  }
  const fromId = readInt(stack, 0, 'from_id');
  const count = Number(readInt(stack, 1, 'count'));
  const entryCount = readInt(stack, 2, 'entry_count');
  const rowsCell = readCell(stack, 3);

  const rows = [];
  let reader = rowsCell ? cellReader(rowsCell) : null;
  // THE HIDDEN MASK [2026-09-04, CUTOVER item 15]: a clean-18 cell leads with 2 bits — bit i for row i of the cell —
  // before its 448-bit rows, so it is 450 or 898 bits where a clean-17 cell is 448 or 896. `bits % 448 == 2` tells
  // the generations apart with no other knowledge, and the mask is read once per cell.
  let mask = 0n;
  let rowInCell = 0;
  const openCell = (r) => {
    mask = r.remaining() % PUBLIC_ROW_BITS === 2 ? r.loadUint(2) : 0n;
    rowInCell = 0;
  };
  if (reader) openCell(reader);
  for (let i = 0; i < count; i += 1) {
    if (!reader) break;
    if (reader.remaining() < PUBLIC_ROW_BITS && reader.refs() > 0) {
      const next = reader.loadRef();
      if (!next) break;
      reader = cellReader(next);
      openCell(reader);
    }
    if (reader.remaining() < PUBLIC_ROW_BITS) break;
    const bodyCommit = reader.loadUint(256);
    const createdAt = reader.loadUint(64);
    const publisherTag = reader.loadUint(128);
    const hidden = ((mask >> BigInt(rowInCell)) & 1n) === 1n;
    rowInCell += 1;
    rows.push({
      entry_id: fromId + BigInt(i), body_commit: bodyCommit, created_at: createdAt, publisher_tag: publisherTag, hidden,
    });
  }
  return { from_id: fromId, count: BigInt(count), entry_count: entryCount, rows };
}

/**
 * get_hidden -> the moderation bits of a range of entries [CUTOVER item 15, round 2]: bit i = entry (from_id + i)
 * hidden, 1023 per cell, ref-chained tail first (the head cell holds the first bits). A reader that already holds a
 * shard's rows refreshes their `hidden` from this when the shard moves, instead of re-reading pages it has.
 */
/**
 * The HIDDEN INDEX of a PublicShard, read by position: { count, returned, hidden: Set<entryId> }. `count` is how
 * many entries the shard hides in all, `returned` how many this page named — a caller that reads the whole index
 * (count <= returned) may clear the bit on rows it holds and this answer does not name; one that stopped short
 * may only set it. The bitmap this replaces cost the shard's FILL to answer (measured 6,041,335 gas at 4,096
 * entries, six times what a get-method may spend), so it stopped working exactly where moderation matters.
 */
export function decodeHiddenIds(result) {
  const stack = extractStack(result);
  if (stack.length !== 3) {
    throw new PublicShardTonRpcProviderError(`PublicShard get_hidden_ids ABI mismatch: expected 3 stack items, got ${stack.length}`);
  }
  const count = Number(readInt(stack, 0, 'count'));
  const returned = Number(readInt(stack, 1, 'returned'));
  const hidden = new Set();
  let reader = readCell(stack, 2) ? cellReader(readCell(stack, 2)) : null;
  for (let i = 0; i < returned && reader; i += 1) {
    if (reader.remaining() < 32 && reader.refs() > 0) reader = cellReader(reader.loadRef());
    if (reader.remaining() < 32) break;
    hidden.add(Number(reader.loadUint(32)));
  }
  return { count, returned, hidden, complete: hidden.size >= count };
}

/** The 256-bit hash of a cell from either world: @ton/core Cell.hash() (a Buffer) or the browser hasher. */
async function cellHashBig(cell) {
  if (cell && typeof cell.hash === 'function') {
    return bytesToBigUint(cell.hash());
  }
  const { hash } = await computeCellHashAndDepth(cell);
  return bytesToBigUint(hash);
}

/** Recompute the commitment the CONTRACT stores: H(PS_BODY_DOMAIN ‖ header.hash ‖ body.hash). Mirrors
 *  PublicShard.bodyCommit; mirroring rather than importing is what lets the delivery check run in a browser. */
export async function publicBodyCommit(headerCell, bodyCell) {
  const h = await cellHashBig(headerCell);
  const b = await cellHashBig(bodyCell);
  const preimage = beginCell()
    .uint(PS_BODY_DOMAIN, 32, 'PS_BODY_DOMAIN')
    .uint(h, 256, 'header hash')
    .uint(b, 256, 'body hash')
    .endCell();
  const { hash } = await computeCellHashAndDepth(preimage);
  return bytesToBigUint(hash);
}

function resolveTransport(options) {
  const transport = options.transport ?? globalThis.plathoPublicShardRpcTransport ?? globalThis.plathoTonRpcTransport;
  if (!transport?.runGetMethod) throw new PublicShardTonRpcProviderError('TON RPC transport is not configured');
  return transport;
}

function criticalCallOptions(callOptions = {}) {
  const out = {};
  for (const key of ['cacheTtlMs', 'ttlMs', 'priority', 'verify', 'allowUnverifiedCriticalRead', 'skipIfRateLimited']) {
    if (callOptions[key] !== undefined) out[key] = callOptions[key];
  }
  return out;
}

/**
 * The read provider.
 *
 * `readMessages(address)` must resolve the message bodies delivered to a shard, newest first, each as a Cell —
 * exactly web/shard-rpc.createShardMessagesReader. Its per-message `source` is what recovers the publisher, so
 * this provider takes a `readMessagesWithSource` that returns [{ body, source }]. A plain readMessages (bodies
 * only) still renders posts; it just cannot attribute them, which is fine for a single known channel and wrong
 * for a beacon directory — so the beacon path REQUIRES the source-bearing reader.
 */
export function createPublicShardTonRpcProvider(options = {}) {
  const decodeAddr = options.decodeAddressSliceBoc;
  return {
    kind: options.kind ?? options.transport?.kind ?? 'ton-rpc',

    async getView(shardAddress, callOptions = {}) {
      const transport = resolveTransport(options);
      return decodePublicShardView(await transport.runGetMethod({
        address: parseTonAddress(shardAddress).raw,
        method: 'get_view',
        stack: [],
        ...criticalCallOptions(callOptions),
      }), decodeAddr);
    },

    /** The whole hidden index of a shard, paged: PS_HIDDEN_PAGE_CAP ids a call, at most `maxPages` calls.
     *  `complete` is true only when every hidden id was named — the caller may clear bits only then. */
    async getHiddenIds(shardAddress, { maxPages = 16, callOptions = {} } = {}) {
      const transport = resolveTransport(options);
      const address = parseTonAddress(shardAddress).raw;
      const hidden = new Set();
      let count = 0;
      let from = 0;
      // THE INDEX MAY MOVE BETWEEN PAGES [audit 2026-09-06, round 3]: an unhide swap-deletes — the last position moves
      // into the freed one, so an id already walked past can move into a position already read and never be named,
      // while `count` shrinks by one and the union still equals it. A walk whose `count` changed is not complete.
      let firstCount = null;
      let drifted = false;
      for (let page = 0; page < maxPages; page += 1) {
        const answer = decodeHiddenIds(await transport.runGetMethod({
          address,
          method: 'get_hidden_ids',
          stack: [
            { type: 'num', value: `0x${BigInt(from).toString(16)}` },
            { type: 'num', value: `0x${BigInt(HIDDEN_PAGE_CAP).toString(16)}` },
          ],
          cacheTtlMs: 0,
          ...criticalCallOptions(callOptions),
        }));
        count = answer.count;
        if (firstCount === null) firstCount = count;
        else if (count !== firstCount) drifted = true;
        for (const id of answer.hidden) hidden.add(id);
        from += answer.returned;
        if (answer.returned === 0 || from >= count) break;
      }
      return { count, hidden, complete: !drifted && hidden.size >= count };
    },

    async getPage(shardAddress, fromId = 0n, maxCount = 96n, callOptions = {}) {
      const transport = resolveTransport(options);
      return decodePublicPage(await transport.runGetMethod({
        address: parseTonAddress(shardAddress).raw,
        method: 'get_page',
        stack: [
          { type: 'num', value: `0x${BigInt(fromId).toString(16)}` },
          { type: 'num', value: `0x${BigInt(maxCount).toString(16)}` },
        ],
        ...criticalCallOptions(callOptions),
      }));
    },

    /**
     * Assemble a shard's posts: the authenticated commits from get_page, matched to bodies from /messages. A
     * message is kept ONLY when its (header, body) reproduce a stored commit; the publisher is that message's
     * source. Returns newest-first (by created_at), each { entry_id, created_at, publisher, header, body }.
     *
     * `readMessagesWithSource(address)` must resolve the messages a shard received as [{ bodyCell, source }],
     * newest first — bodyCell is the raw inbound message body, source the sender address. web/shard-rpc's
     * createShardMessagesReader yields the cells; a thin wrapper adds the per-message source.
     */
    // `messagesEndLt`: read the BODIES from the window ending at this lt (inclusive) instead of the newest one. A
    // paged read of older rows needs older bodies — matching rows 58..153 of a 250-row shard against the newest 128
    // messages found nothing, which is how "show earlier comments" worked once and then did nothing (owner,
    // 2026-08-21). The result reports `oldestLt`, the lt of the oldest body it matched, so the caller can ask for
    // the window before it next time.
    // `messagesByRowTime`: aim the /messages window by the ROWS' OWN TIME instead of an lt cursor. A HEAD read
    // (rows [0..N) of an old shard) has no lt to page back from — the bodies it needs are the shard's OLDEST
    // messages, arbitrarily far behind the newest-128 window. The rows carry created_at, so the window is asked
    // by time: [min-600, max+600] — the same measured-honoured start_utime/end_utime technique the INTRO lane
    // uses for bodies beyond the newest window. Requires an explicit fromId (a head read always has one).
    async readPosts(shardAddress, { readMessagesWithSource, fromId = null, maxCount = 96n, callOptions = {}, entryCount = null, messagesEndLt = null, messagesByRowTime = false } = {}) {
      if (typeof readMessagesWithSource !== 'function') {
        throw new PublicShardTonRpcProviderError('readPosts requires a readMessagesWithSource(address) function');
      }
      const raw = parseTonAddress(shardAddress).raw;
      // TAIL-ANCHORED BY DEFAULT. get_page(0, …) returns the OLDEST rows (the contract's own words: "Row i is
      // entry (from_id + i)") while /messages is served NEWEST-first with a limit — two windows anchored at
      // OPPOSITE ends of the same shard. MEASURED against a real PublicShard (tests/public-lane-read-window):
      // at 120 entries the reader returned entries 0..95 and the channel's 24 newest posts were invisible; at
      // 260 the windows stopped overlapping entirely and the shard read back EMPTY — every paid post gone from
      // the feed, silently. A caller that genuinely wants an older slice passes fromId explicitly.
      // DECLARED ABOVE BOTH READERS, not between them. [FOUND 2026-08-29 by PL-WINDOW-03.] This matcher used to
      // sit below the messagesByRowTime branch, and that branch calls it: `const` is hoisted but not initialised,
      // so the row-time path threw ReferenceError on its FIRST line every time it ran — the comment reader's
      // date jump and any deep window whose cursor carries no lt. It is the one path with no test of its own,
      // which is exactly why it could ship broken.
      const matchRows = async (rows, messages) => {
        // [CHANGED 2026-07-30, wave-8 HIGH] On a duplicate body_commit the OLDEST entry wins, not the newest.
        //
        // The publisher tag alone is not enough here, and that is worth spelling out: the shard genuinely accepts both
        // publications, so BOTH rows are valid and each matches its own publisher. Keying by commit collapses them, and
        // `new Map(rows.map(...))` kept the LAST — the squatter's. Lowest entry_id is the original by construction:
        // entries are append-only, ids are contiguous, and nothing removes one, so the first id holding a commit is the
        // publication that came first. The tag then binds the surviving row to the message that actually produced it.
        const commitToRow = new Map();
        for (const r of rows) {
          const key = r.body_commit.toString();
          const prev = commitToRow.get(key);
          if (!prev || r.entry_id < prev.entry_id) commitToRow.set(key, r);
        }
        const out = [];
        const claimed = new Set();
        for (const message of messages) {
          const parsed = parsePublicPublish(message.bodyCell);
          if (!parsed) continue;                          // a top-up, bounce or foreign message, not a publish
          const commit = (await publicBodyCommit(parsed.header, parsed.body)).toString();
          const row = commitToRow.get(commit);
          if (!row || claimed.has(commit)) continue;      // not an accepted entry, or a duplicate already matched
          // [ADDED 2026-07-30, wave-8 HIGH] VERIFY the publisher against the shard's own record instead of inferring it
          // from whichever message happened to match first.
          //
          // Nothing binds sender() when an entry is appended to a BEACON or THREAD view, so anyone may republish
          // someone else's cells byte for byte and create a SECOND entry with the SAME body_commit. Duplicates collapse
          // in commitToRow, and `messages` arrives NEWEST FIRST — so the attacker's copy was always the one that
          // matched, and their address became the channel's in the catalogue for the price of one publish. The shard
          // stores the authoritative publisher; the row now carries a checkable tag of it, so a message whose source
          // does not match the entry simply is not that entry.
          if (!message.source) continue;
          // THE SOURCE IS NOT ALWAYS THE PUBLISHER. Through the M21C door the transaction's source is the
          // sender's VAULT while the row's tag is the PAYER's — so a discounted message failed this check even
          // when it parsed, which is the second, independent half of the same silent loss. The shard is the
          // authority on both: it refuses any VaultPublish whose sender is not vaultAddressOf(payer) (gate
          // 13720) and then stamps that payer as the entry's publisher, so a row carrying this tag can only
          // have come from that payer's own vault. The anti-squatter property is unchanged — see the note in
          // web/m21c-envelope.mjs, including the stronger form available once the vault code ships client-side.
          const source = parseTonAddress(message.source).raw;
          const publisher = parsed.publisher ?? source;
          if (publisherTagOf(publisher) !== row.publisher_tag) continue;
          claimed.add(commit);
          out.push({
            entry_id: row.entry_id,
            created_at: row.created_at,
            publisher,
            header: parsed.header,
            body: parsed.body,
            hidden: row.hidden === true,     // the moderation bit the row carries (clean-18); false on clean-17 rows
            lt: message.createdLt ?? null,   // where in the shard's message history this body sits — for paging back
          });
        }
        return out;
      };

      // THE BODY WINDOW IS AIMED BY THE ROWS, FOR EVERY READ [audit 2026-09-01, round 14]. This used to be the
      // private helper of the messagesByRowTime branch, and the DEFAULT path — the newest window, the one every
      // feed, Discover card and avatar read takes — asked /messages for the plain newest-N instead.
      //
      // MEASURED (tests/public-read-window-poisoning.test.ts, over a real PublicShard and the shipping reader):
      // five paid posts, then 128 well-formed PublicPublish messages from a stranger. The shard REFUSES every
      // one at 13702 and entry_count never moves — but a refused message is still an inbound message of that
      // account, and live toncenter indexes it: of 40 transactions on a real mainnet address, 19 failed in
      // COMPUTE and ALL 19 of their inbound messages came back from /api/v3/messages. The reader's opcode filter
      // could not help, because the opcode is chosen by the SENDER. Result: 64 junk -> 5 posts, 127 -> 1,
      // 128 -> 0. A channel read back completely empty for the price of the griefer's gas, with no error
      // anywhere, and stayed that way until the channel published a fresh window or the era rolled.
      //
      // Aiming by the rows closes it at the root rather than at four call sites: get_page returns the shard's
      // OWN stored entries, and a public entry and the body that produced it are the SAME transaction — the
      // contract stamps the row with now() while handling that very message — so no genuine body can sit above
      // its row's stamp, and everything sent afterwards is outside the window by construction.
      //
      // It costs one /messages call per page instead of one shared across the two straddle pages: at most two
      // where there was one. The bodies can no longer be read once up front, because the window they need is not
      // known until the rows are.
      // HOW MANY EXTRA PAGES A POISONED WINDOW MAY COST. Bounding the window by the rows' own time excludes
      // everything sent AFTER the newest row — but a griefer floods ONCE, and the channel's own next post then
      // lifts `maxAt` back over the flood. MEASURED (PL-POISON-03): five posts, 128 refused messages stamped
      // between them, one more post afterwards — and the reader returned ONE of six. The window was right; the
      // reader simply stopped at the first page of it.
      // So it pages, the way readMessageRows and the CONV lane already do, and it knows when to stop because it
      // knows what it is looking for: get_page named the rows, so a page that leaves some of them unmatched has
      // bodies below it. An honest window matches everything on the first request and costs exactly one.
      const MATCH_EXTRA_PAGES = 6;
      const matchByTime = async (rows, endLtBound = null) => {
          if (rows.length === 0) return [];
          let minAt = rows[0].created_at;
          let maxAt = rows[0].created_at;
          for (const row of rows) {
            if (row.created_at < minAt) minAt = row.created_at;
            if (row.created_at > maxAt) maxAt = row.created_at;
          }
          const found = new Map();
          let cursor = endLtBound === null || endLtBound === undefined ? null : String(endLtBound);
          for (let attempt = 0; attempt <= MATCH_EXTRA_PAGES; attempt += 1) {
          const timed = await readMessagesWithSource(raw, {
            ...(cursor === null ? {} : { endLt: cursor }),
            // THE TOP OF THIS WINDOW IS THE ROWS' OWN NEWEST STAMP, WITH NO SLACK ABOVE IT, and that is not a
            // tightening for its own sake. A public entry and the body that produced it are the SAME transaction:
            // the contract stamps the row with now() while it is handling that very message, so the two carry one
            // value and a body can never sit above its row's stamp. Slack below is free (extra candidates are
            // filtered by body_commit anyway); slack above is not, because /messages is served newest-first under
            // a limit — MEASURED on a channel posting a second apart, ten minutes of slack admitted 600 newer
            // messages and the window's own 128 went entirely to them: 32 rows matched of 96 asked for, and after
            // a relaunch the read below what the reader already held made no progress at all.
            startUtime: Math.max(0, Number(minAt) - 600),
            endUtime: Number(maxAt),
          });
          if (!timed || timed.length === 0) break;                 // the history inside the window ran out
          for (const post of await matchRows(rows, timed)) found.set(String(post.entry_id), post);
          if (found.size >= rows.length) break;                    // every row the getter named has its body
          // Page BELOW the oldest message this page carried. A page of somebody else's traffic is a page to get
          // past, not the end: the rows we still want are older than everything we just saw.
          let oldestLt = null;
          for (const message of timed) {
            if (message?.createdLt == null) continue;
            try {
              const lt = BigInt(message.createdLt);
              if (oldestLt === null || lt < oldestLt) oldestLt = lt;
            } catch { /* not an lt */ }
          }
          if (oldestLt === null || oldestLt === 0n) break;          // nothing to page by
          const next = String(oldestLt - 1n);
          if (next === cursor) break;                               // the endpoint ignored end_lt — stop, do not spin
          cursor = next;
          }
          return [...found.values()];
      };

      if (messagesByRowTime === true) {
        if (fromId === null) throw new PublicShardTonRpcProviderError('messagesByRowTime requires an explicit fromId');
        const page = await this.getPage(raw, BigInt(fromId), maxCount, callOptions);
        const entryCountHead = page.entry_count;
        if (page.rows.length === 0) return { entry_count: entryCountHead, posts: [], oldestLt: null };
        let headPosts = await matchByTime(page.rows);
        // FORWARD STRADDLE: a multipart stream that begins inside the window and ends past it is dropped by every
        // assembler above (incomplete group), and the NEXT forward page drops its head parts the same way — the
        // mirror of the tail path's backward extension, capped identically at one extra page.
        const nextRow = BigInt(fromId) + BigInt(page.rows.length);
        if (hasIncompletePublicStream(headPosts) && nextRow < entryCountHead) {
          const more = await this.getPage(raw, nextRow, maxCount, callOptions);
          if (more.rows.length > 0) {
            const merged = new Map();
            for (const post of [...headPosts, ...(await matchByTime(more.rows))]) merged.set(String(post.entry_id), post);
            headPosts = [...merged.values()];
          }
        }
        headPosts.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
        const oldestHead = headPosts.reduce((acc, post) => {
          if (post.lt === null || post.lt === undefined) return acc;
          try { const lt = BigInt(post.lt); return acc === null || lt < acc ? lt : acc; } catch { return acc; }
        }, null);
        return { entry_count: entryCountHead, posts: headPosts, oldestLt: oldestHead === null ? null : oldestHead.toString() };
      }
      let start;
      let known = entryCount === null ? null : BigInt(entryCount);
      if (fromId === null) {
        if (known === null) {
          // A zero-row page is the cheapest entry_count probe: same getter, no rows, no gas cliff.
          known = BigInt((await this.getPage(raw, 0n, 0n, callOptions)).entry_count ?? 0n);
        }
        if (known <= 0n) return { entry_count: known ?? 0n, posts: [] };
        start = known > BigInt(maxCount) ? known - BigInt(maxCount) : 0n;
      } else {
        start = BigInt(fromId);
      }

      let posts = [];
      let entryCountSeen = 0n;
      let cursor = start;
      // MULTIPART STRADDLE. A tail window can begin in the MIDDLE of a multi-entry post, and every assembler
      // above this layer DROPS a group whose parts are not all present (assemblePublicParts, assembleAvatarParts)
      // — so a large post sitting on the boundary would vanish silently, which is the same class of loss the
      // tail anchoring above exists to stop. Extend one page backwards when a stream in the window is
      // incomplete. ONE extra page always suffices: a message is capped at 16 parts and an avatar at 16, both
      // far below a 96-row page. An explicit fromId means the caller asked for a precise slice — never extend it.
      for (let pageIndex = 0; pageIndex < 2; pageIndex += 1) {
        const page = await this.getPage(raw, cursor, maxCount, callOptions);
        entryCountSeen = page.entry_count;
        if (page.rows.length === 0) break;
        // Pages OVERLAP when the extension clamps to 0 (a window starting at 6 extends to 0..95, re-reading
        // 6..95), so merge by entry_id — a duplicated part would otherwise inflate a stream past its part_count
        // and make an incomplete group look complete.
        const merged = new Map();
        // An explicit messagesEndLt still composes: a caller paging backwards bounds the window from above by lt
        // AND by the rows' own time, and readMessageRows enforces both against the rows it got back.
        for (const post of [...(await matchByTime(page.rows, messagesEndLt)), ...posts]) merged.set(String(post.entry_id), post);
        posts = [...merged.values()];
        if (fromId !== null || cursor === 0n) break;
        if (!hasIncompletePublicStream(posts)) break;
        cursor = cursor > BigInt(maxCount) ? cursor - BigInt(maxCount) : 0n;
      }
      posts.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
      // The oldest body this read matched, as a decimal lt string (null when the endpoint gave no lt, or nothing
      // matched). A caller paging backwards passes `messagesEndLt: oldestLt - 1` next time.
      let oldestLt = null;
      for (const post of posts) {
        if (post.lt == null) continue;
        try { if (oldestLt === null || BigInt(post.lt) < BigInt(oldestLt)) oldestLt = String(post.lt); } catch { /* not an lt */ }
      }
      return { entry_count: entryCountSeen, posts, oldestLt };
    },
  };
}

// Does the window hold a multipart stream whose parts are not all present? Single-part entries (the common
// case: text posts, comments, beacon cards) can never be incomplete, so they cost nothing here.
export function hasIncompletePublicStream(posts) {
  const groups = new Map();
  for (const post of posts) {
    const info = readPublicPartHeaderInfo(post.header);
    if (!info || Number(info.partCount ?? 1) <= 1) continue;
    const key = String(info.streamId ?? '').toLowerCase();
    const group = groups.get(key) ?? { expected: Number(info.partCount), seen: new Set() };
    group.seen.add(Number(info.partIndex ?? 0));
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.seen.size < group.expected) return true;
  }
  return false;
}

const PUBLIC_PUBLISH_OPCODE = 0x50535031;   // "PSP1" — message(0x50535031) PublicPublish

/**
 * Parse a PublicPublish message body. Tact layout: opcode(32) ‖ kind(8) ‖ key_arg(256) ‖ shard_seq(32) inline,
 * then header and body as refs. Returns null for anything that is not a well-formed publish — a shard's history
 * carries plain top-ups and bounces alongside publishes, and those are simply not ours to render.
 */
export function parsePublicPublish(bodyCell) {
  if (!bodyCell) return null;
  // A DISCOUNTED PUBLISH ARRIVES WRAPPED. The user's FeeVault sends it as an M21C VaultPublish; the shard
  // unwraps `record` and stamps `publisher = payer`, so the ENTRY is identical to a direct publish — but this
  // reader walks the shard's message HISTORY, where the envelope is what it meets. Matching the direct opcode
  // alone returned null on every discounted message: on chain, paid for, correctly attributed, shown to nobody.
  // `publisher` rides out with the parse because the second half of the same break lives in matchRows below.
  // See web/m21c-envelope.mjs for the layout and for why trusting `payer` is safe.
  const envelope = parseVaultPublishEnvelope(bodyCell, cellReader);
  const inner = envelope ? envelope.record : bodyCell;
  try {
    const r = cellReader(inner);
    if (r.remaining() < 32 + 8 + 256 + 32) return null;
    if (Number(r.loadUint(32)) !== PUBLIC_PUBLISH_OPCODE) return null;
    const kind = Number(r.loadUint(8));
    const keyArg = r.loadUint(256);
    const shardSeq = Number(r.loadUint(32));
    if (r.refs() < 2) return null;
    const header = r.loadRef();
    const body = r.loadRef();
    if (!header || !body) return null;
    return {
      kind, key_arg: keyArg, shard_seq: shardSeq, header, body,
      // NULL on the direct door, where the transaction's source IS the publisher. Set only through the vault,
      // where it is not.
      publisher: envelope ? envelope.payer : null,
    };
  } catch {
    return null;
  }
}
