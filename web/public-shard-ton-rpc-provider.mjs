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

import { computeCellHashAndDepth, beginCell, parseBocBase64 } from './pwa-contract-transactions.mjs?v=33';
import { parseTonAddress } from './crypto/platho-crypto.mjs?v=12';

export class PublicShardTonRpcProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PublicShardTonRpcProviderError';
  }
}

// MUST equal PS_BODY_DOMAIN in contracts/PublicShard.tact. The commitment is defined by the contract, so client
// and reader cannot disagree about it — this mirror is what lets the check run in a browser.
const PS_BODY_DOMAIN = 0x50534644n;

function stackItemValue(item) {
  if (Array.isArray(item)) return item[1];
  if (item && typeof item === 'object' && 'value' in item) return item.value;
  if (item && typeof item === 'object' && 'num' in item) return item.num;
  if (item && typeof item === 'object' && 'cell' in item) return item.cell;
  if (item && typeof item === 'object' && 'boc' in item) return item.boc;
  return item;
}

function readInt(stack, index, name) {
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

function readCell(stack, index) {
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
function cellReader(cell) {
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

function extractStack(result) {
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

/** get_page -> the authenticated rows. Walks the ref-chained (commit, created_at) cells, 3 per cell. */
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
  for (let i = 0; i < count; i += 1) {
    if (!reader) break;
    if (reader.remaining() < 320 && reader.refs() > 0) {
      const next = reader.loadRef();
      if (!next) break;
      reader = cellReader(next);
    }
    if (reader.remaining() < 320) break;
    const bodyCommit = reader.loadUint(256);
    const createdAt = reader.loadUint(64);
    rows.push({ entry_id: fromId + BigInt(i), body_commit: bodyCommit, created_at: createdAt });
  }
  return { from_id: fromId, count: BigInt(count), entry_count: entryCount, rows };
}

/** The 256-bit hash of a cell from either world: @ton/core Cell.hash() (a Buffer) or the browser hasher. */
async function cellHashBig(cell) {
  if (cell && typeof cell.hash === 'function') {
    return BigInt('0x' + Buffer.from(cell.hash()).toString('hex'));
  }
  const { hash } = await computeCellHashAndDepth(cell);
  return BigInt('0x' + Buffer.from(hash).toString('hex'));
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
  return BigInt('0x' + Buffer.from(hash).toString('hex'));
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
    async readPosts(shardAddress, { readMessagesWithSource, fromId = 0n, maxCount = 96n, callOptions = {} } = {}) {
      if (typeof readMessagesWithSource !== 'function') {
        throw new PublicShardTonRpcProviderError('readPosts requires a readMessagesWithSource(address) function');
      }
      const raw = parseTonAddress(shardAddress).raw;
      const page = await this.getPage(raw, fromId, maxCount, callOptions);
      if (page.rows.length === 0) return { entry_count: page.entry_count, posts: [] };

      const commitToRow = new Map(page.rows.map((r) => [r.body_commit.toString(), r]));
      const messages = await readMessagesWithSource(raw);
      const posts = [];
      const claimed = new Set();
      for (const message of messages) {
        const parsed = parsePublicPublish(message.bodyCell);
        if (!parsed) continue;                          // a top-up, bounce or foreign message, not a publish
        const commit = (await publicBodyCommit(parsed.header, parsed.body)).toString();
        const row = commitToRow.get(commit);
        if (!row || claimed.has(commit)) continue;      // not an accepted entry, or a duplicate already matched
        claimed.add(commit);
        posts.push({
          entry_id: row.entry_id,
          created_at: row.created_at,
          publisher: message.source ? parseTonAddress(message.source).raw : null,
          header: parsed.header,
          body: parsed.body,
        });
      }
      posts.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
      return { entry_count: page.entry_count, posts };
    },
  };
}

const PUBLIC_PUBLISH_OPCODE = 0x50535031;   // "PSP1" — message(0x50535031) PublicPublish

/**
 * Parse a PublicPublish message body. Tact layout: opcode(32) ‖ kind(8) ‖ key_arg(256) ‖ shard_seq(32) inline,
 * then header and body as refs. Returns null for anything that is not a well-formed publish — a shard's history
 * carries plain top-ups and bounces alongside publishes, and those are simply not ours to render.
 */
export function parsePublicPublish(bodyCell) {
  if (!bodyCell) return null;
  try {
    const r = cellReader(bodyCell);
    if (r.remaining() < 32 + 8 + 256 + 32) return null;
    if (Number(r.loadUint(32)) !== PUBLIC_PUBLISH_OPCODE) return null;
    const kind = Number(r.loadUint(8));
    const keyArg = r.loadUint(256);
    const shardSeq = Number(r.loadUint(32));
    if (r.refs() < 2) return null;
    const header = r.loadRef();
    const body = r.loadRef();
    if (!header || !body) return null;
    return { kind, key_arg: keyArg, shard_seq: shardSeq, header, body };
  } catch {
    return null;
  }
}
