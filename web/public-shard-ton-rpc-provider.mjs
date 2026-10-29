
import { computeCellHashAndDepth, beginCell, parseBocBase64, readPublicPartHeaderInfo, bytesToBigUint } from './pwa-contract-transactions.mjs?v=59';
import { parseVaultPublishEnvelope } from './m21c-envelope.mjs?v=5';
import { parseTonAddress } from './crypto/platho-crypto.mjs?v=31';

export class PublicShardTonRpcProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PublicShardTonRpcProviderError';
  }
}

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
  return raw;
}

function cellRefs(cell) {
  return (cell && Array.isArray(cell.refs)) ? cell.refs : [];
}

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

export const PUBLIC_ROW_BITS = 448;
export const HIDDEN_PAGE_CAP = 310;
export const PUBLIC_PUBLISHER_TAG_MOD = 1n << 128n;

export function publisherTagOf(rawAddress) {
  const hex = String(rawAddress).split(':').pop();
  return BigInt(`0x${hex}`) % PUBLIC_PUBLISHER_TAG_MOD;
}

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

async function cellHashBig(cell) {
  if (cell && typeof cell.hash === 'function') {
    return bytesToBigUint(cell.hash());
  }
  const { hash } = await computeCellHashAndDepth(cell);
  return bytesToBigUint(hash);
}

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

    async getHiddenIds(shardAddress, { maxPages = 16, callOptions = {} } = {}) {
      const transport = resolveTransport(options);
      const address = parseTonAddress(shardAddress).raw;
      const hidden = new Set();
      let count = 0;
      let from = 0;
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

    async readPosts(shardAddress, { readMessagesWithSource, fromId = null, maxCount = 96n, callOptions = {}, entryCount = null, messagesEndLt = null, messagesByRowTime = false } = {}) {
      if (typeof readMessagesWithSource !== 'function') {
        throw new PublicShardTonRpcProviderError('readPosts requires a readMessagesWithSource(address) function');
      }
      const raw = parseTonAddress(shardAddress).raw;
      const matchRows = async (rows, messages) => {
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
          if (!parsed) continue;
          const commit = (await publicBodyCommit(parsed.header, parsed.body)).toString();
          const row = commitToRow.get(commit);
          if (!row || claimed.has(commit)) continue;
          if (!message.source) continue;
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
            hidden: row.hidden === true,
            lt: message.createdLt ?? null,
          });
        }
        return out;
      };

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
            startUtime: Math.max(0, Number(minAt) - 600),
            endUtime: Number(maxAt),
          });
          const answered = Number.isFinite(timed?.rawCount) ? timed.rawCount : (timed?.length ?? 0);
          if (!timed || answered === 0) break;
          for (const post of await matchRows(rows, timed)) found.set(String(post.entry_id), post);
          if (found.size >= rows.length) break;
          let oldestLt = null;
          try { if (timed.rawOldestLt != null) oldestLt = BigInt(timed.rawOldestLt); } catch { }
          for (const message of timed) {
            if (message?.createdLt == null) continue;
            try {
              const lt = BigInt(message.createdLt);
              if (oldestLt === null || lt < oldestLt) oldestLt = lt;
            } catch { }
          }
          if (oldestLt === null || oldestLt === 0n) break;
          const next = String(oldestLt - 1n);
          if (next === cursor) break;
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
      for (let pageIndex = 0; pageIndex < 2; pageIndex += 1) {
        const page = await this.getPage(raw, cursor, maxCount, callOptions);
        entryCountSeen = page.entry_count;
        if (page.rows.length === 0) break;
        const merged = new Map();
        for (const post of [...(await matchByTime(page.rows, messagesEndLt)), ...posts]) merged.set(String(post.entry_id), post);
        posts = [...merged.values()];
        if (fromId !== null || cursor === 0n) break;
        if (!hasIncompletePublicStream(posts)) break;
        cursor = cursor > BigInt(maxCount) ? cursor - BigInt(maxCount) : 0n;
      }
      posts.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
      let oldestLt = null;
      for (const post of posts) {
        if (post.lt == null) continue;
        try { if (oldestLt === null || BigInt(post.lt) < BigInt(oldestLt)) oldestLt = String(post.lt); } catch { }
      }
      return { entry_count: entryCountSeen, posts, oldestLt };
    },
  };
}

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

const PUBLIC_PUBLISH_OPCODE = 0x50535031;

export function parsePublicPublish(bodyCell) {
  if (!bodyCell) return null;
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
      publisher: envelope ? envelope.payer : null,
    };
  } catch {
    return null;
  }
}
