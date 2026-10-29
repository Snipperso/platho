import { atRestTag, base64urlToBytes, bytesToBase64url, generateRandomAtRestKeys, openAtRest, sealAtRest, withAtRestLock } from './at-rest-seal.mjs?v=5';

const DEFAULT_DB_NAME = 'platho-local-message-history-v1';
const KEY_STORE_NAME = 'historyKeys';
const MESSAGE_STORE_NAME = 'encryptedMessages';
const LEGACY_KEY_ID = 'device-history-key-v1';
const LEGACY_RECORD_VERSION = 1;
export const MESSAGE_HISTORY_RECORD_VERSION = 2;
export const MESSAGE_HISTORY_DB_VERSION = 4;
const ORDER_INDEX = 'convOrder';
export const COMPACT_PAGE = 100;
const HEADERS_REWRITTEN_MARK = 'headers-rewritten-v1';
const CAPSULE_TAG_INDEX = 'capTag';
const LEGACY_THREAD_TIME_INDEX = 'threadCreated';
const LEGACY_CAPSULE_INDEX = 'capsuleId';
const RETIRED_INDEXES = Object.freeze(['threadId', 'createdAt']);
const LEGACY_DOMAIN = 'PLATHO.LOCAL.MESSAGE_HISTORY.V1';
const RECORD_DOMAIN = 'PLATHO.LOCAL.MESSAGE_HISTORY.V2';
const RECORD_PAD_BYTES = 256;
const AES_GCM_NONCE_BYTES = 12;
export const DEFAULT_MESSAGE_HISTORY_MAX_PER_THREAD = 2000;
const SUMMARY_PROBE_RECORDS = 4;
const NEAR_SCAN_SLACK_RECORDS = 4;
const NEAR_SCAN_MAX_RECORDS = 64;

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function safeClone(value) {
  return JSON.parse(JSON.stringify(value, (_key, item) => (
    typeof item === 'bigint' ? item.toString() : item
  )));
}

function cryptoApi() {
  const crypto = globalThis.crypto;
  if (!crypto?.subtle || !crypto?.getRandomValues) {
    throw new Error('WebCrypto is unavailable');
  }
  return crypto;
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  cryptoApi().getRandomValues(bytes);
  return bytes;
}

function randomId() {
  if (cryptoApi().randomUUID) return cryptoApi().randomUUID();
  return bytesToBase64url(randomBytes(16));
}

export const ORDER_BASE_SPAN = 2 ** 24;
export function randomOrderBase() {
  const word = new Uint32Array(1);
  cryptoApi().getRandomValues(word);
  return word[0] % ORDER_BASE_SPAN;
}

const CAPSULE_TAG_BYTES = 16;
function randomCapsuleTag() {
  return bytesToBase64url(randomBytes(CAPSULE_TAG_BYTES));
}

function utf8(value) {
  return new TextEncoder().encode(value);
}

function text(bytes) {
  return new TextDecoder().decode(bytes);
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

const THREAD_FACE_FIELDS = Object.freeze(['avatarImageUrl']);

function threadWithoutFace(thread) {
  if (!thread || typeof thread !== 'object') return null;
  if (!THREAD_FACE_FIELDS.some((field) => field in thread)) return thread;
  const light = { ...thread };
  for (const field of THREAD_FACE_FIELDS) delete light[field];
  return light;
}

function normalizeMessageRecordInput(input) {
  assertObject(input, 'message history input');
  const message = assertObject(input.message, 'message history input.message');
  const createdAt = Number(input.createdAt ?? Date.now());
  if (!Number.isFinite(createdAt)) throw new Error('message history input.createdAt must be a finite number');
  return {
    id: input.id ?? randomId(),
    threadId: assertString(input.threadId, 'message history input.threadId'),
    createdAt,
    thread: input.thread && typeof input.thread === 'object' ? threadWithoutFace(safeClone(input.thread)) : null,
    type: assertString(message.type, 'message.type'),
    capsuleId: message.capsule?.id ?? (typeof message.groupRowId === 'string' && /^grp:[0-9a-f]{40}$/.test(message.groupRowId) ? message.groupRowId : null),
    message: safeClone(message),
  };
}

export function conversationTag(keys, threadId) {
  return atRestTag(keys.index, 'history.conversation', threadId);
}

export function capsuleTag(keys, capsuleId) {
  return atRestTag(keys.index, 'history.capsule', capsuleId);
}

const recordAad = (record) => ({ v: MESSAGE_HISTORY_RECORD_VERSION, id: record.id, t: record.t, c: record.c ?? null });

export async function sealMessageHistoryRecord(keys, input, { order = 0, tags = null } = {}) {
  if (!keys?.seal || !keys?.index) throw new Error('the message history needs the wallet\'s at-rest keys');
  const normalized = normalizeMessageRecordInput(input);
  if (!Number.isFinite(Number(order))) throw new Error('a history record\'s order must be a finite number');
  const t = tags?.t ?? await conversationTag(keys, normalized.threadId);
  const c = normalized.capsuleId ? (tags?.c ?? await capsuleTag(keys, normalized.capsuleId)) : randomCapsuleTag();
  const header = { id: normalized.id, v: MESSAGE_HISTORY_RECORD_VERSION, t, o: Number(order), c };
  const sealed = await sealAtRest(keys.seal, {
    domain: RECORD_DOMAIN,
    aad: recordAad(header),
    value: {
      v: MESSAGE_HISTORY_RECORD_VERSION,
      threadId: normalized.threadId,
      createdAt: normalized.createdAt,
      type: normalized.type,
      capsuleId: normalized.capsuleId,
      thread: normalized.thread,
      message: normalized.message,
    },
    padTo: RECORD_PAD_BYTES,
  });
  return { ...header, n: sealed.n, x: sealed.x };
}

export async function openMessageHistoryRecord(keys, record) {
  assertObject(record, 'message history record');
  if (record.v !== MESSAGE_HISTORY_RECORD_VERSION) throw new Error('Unsupported Platho message history record');
  const payload = assertObject(await openAtRest(keys.seal, { domain: RECORD_DOMAIN, aad: recordAad(record), sealed: { n: record.n, x: record.x } }), 'message history payload');
  if (payload.v !== MESSAGE_HISTORY_RECORD_VERSION) throw new Error('Unsupported message history payload');
  if (typeof payload.threadId !== 'string' || !Number.isFinite(payload.createdAt)) throw new Error('Message history payload metadata is invalid');
  const thread = payload.thread && typeof payload.thread === 'object' ? payload.thread : null;
  const light = threadWithoutFace(thread);
  return {
    id: record.id,
    threadId: payload.threadId,
    createdAt: payload.createdAt,
    type: payload.type,
    capsuleId: payload.capsuleId ?? null,
    thread: light,
    message: assertObject(payload.message, 'message history payload.message'),
    ...(light !== thread ? { faceDropped: true } : {}),
  };
}

function legacyRecordAad(record) {
  return utf8(stableStringify({
    domain: LEGACY_DOMAIN,
    version: LEGACY_RECORD_VERSION,
    id: record.id,
    threadId: record.threadId,
    createdAt: record.createdAt,
    type: record.type,
    capsuleId: record.capsuleId ?? null,
  }));
}

export async function sealLegacyMessageHistoryRecord(key, input) {
  const normalized = normalizeMessageRecordInput(input);
  const nonce = randomBytes(AES_GCM_NONCE_BYTES);
  const payload = utf8(JSON.stringify({
    version: LEGACY_RECORD_VERSION,
    threadId: normalized.threadId,
    createdAt: normalized.createdAt,
    thread: normalized.thread,
    message: normalized.message,
  }));
  const header = {
    version: LEGACY_RECORD_VERSION,
    alg: 'AES-256-GCM',
    keyId: LEGACY_KEY_ID,
    id: normalized.id,
    threadId: normalized.threadId,
    createdAt: normalized.createdAt,
    type: normalized.type,
    capsuleId: normalized.capsuleId,
    nonce: bytesToBase64url(nonce),
  };
  const ciphertext = await cryptoApi().subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: legacyRecordAad(header), tagLength: 128 }, key, payload);
  return { ...header, ciphertext: bytesToBase64url(new Uint8Array(ciphertext)) };
}

export async function openLegacyMessageHistoryRecord(key, record) {
  assertObject(record, 'message history record');
  if (record.version !== LEGACY_RECORD_VERSION || record.alg !== 'AES-256-GCM') {
    throw new Error('Unsupported Platho message history record');
  }
  const nonce = base64urlToBytes(record.nonce);
  if (nonce.length !== AES_GCM_NONCE_BYTES) throw new Error('Invalid message history nonce');
  const plaintext = await cryptoApi().subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: legacyRecordAad(record), tagLength: 128 }, key, base64urlToBytes(record.ciphertext));
  const payload = assertObject(JSON.parse(text(new Uint8Array(plaintext))), 'message history payload');
  if (payload.version !== LEGACY_RECORD_VERSION) throw new Error('Unsupported message history payload');
  if (payload.threadId !== record.threadId || payload.createdAt !== record.createdAt) {
    throw new Error('Message history payload metadata mismatch');
  }
  return {
    id: record.id,
    threadId: record.threadId,
    createdAt: record.createdAt,
    type: record.type,
    capsuleId: record.capsuleId ?? null,
    thread: payload.thread && typeof payload.thread === 'object' ? payload.thread : null,
    message: assertObject(payload.message, 'message history payload.message'),
  };
}

async function assignOrder(view, open, tag, at, memo = null) {
  const newest = await view.edge(tag, 'prev');
  if (!newest) return { order: randomOrderBase() };
  const newestOpened = await open(newest);
  if (!newestOpened || at >= newestOpened.createdAt) return { order: Number(newest.o) + 1 };
  if (memo && memo.tag === tag && at >= memo.at && at < memo.aboveAt && typeof view.recordsFrom === 'function') {
    const [first, second] = await view.recordsFrom(tag, memo.o, 2);
    const next = first && String(first.id) === memo.id ? second : first;
    if (next && String(next.id) === memo.aboveId && Number(next.o) === memo.aboveO) {
      const order = positionBetween(memo.o, memo.at, memo.aboveO, memo.aboveAt, at);
      if (order !== null) return { order, above: { id: memo.aboveId, o: memo.aboveO, at: memo.aboveAt } };
    }
  }
  const oldest = await view.edge(tag, 'next');
  const oldestOpened = oldest ? await open(oldest) : null;
  if (oldestOpened && at < oldestOpened.createdAt) {
    return { order: Number(oldest.o) - 1, above: { id: String(oldest.id), o: Number(oldest.o), at: Number(oldestOpened.createdAt) } };
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const placed = await placeBetween(view, open, tag, at);
    if (placed !== null) return placed;
    // eslint-disable-next-line no-await-in-loop
    await view.renumber(tag);
  }
  return { order: Number(newest.o) + 1 };
}

function positionBetween(lo, loAt, hi, hiAt, at) {
  const low = Number(lo);
  const high = Number(hi);
  if (!(high > low)) return null;
  const span = Number(hiAt) - Number(loAt);
  let share = Number.isFinite(span) && span > 0 ? (Number(at) - Number(loAt)) / span : 0.5;
  if (!Number.isFinite(share)) share = 0.5;
  share = Math.min(1 - 1 / 1024, Math.max(1 / 1024, share));
  const order = low + (high - low) * share;
  return order > low && order < high ? order : null;
}

async function firstIndexByTime(view, open, ids, reached) {
  let lo = 0;
  let hi = ids.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    // eslint-disable-next-line no-await-in-loop
    const record = await view.get(ids[mid]);
    // eslint-disable-next-line no-await-in-loop
    const opened = record ? await open(record) : null;
    if (opened && reached(Number(opened.createdAt))) hi = mid; else lo = mid + 1;
  }
  return lo;
}
const atOrAfter = (at) => (time) => time >= at;
const after = (at) => (time) => time > at;

async function placeBetween(view, open, tag, at) {
  const ids = await view.idsInOrder(tag);
  if (ids.length === 0) return { order: randomOrderBase() };
  const index = await firstIndexByTime(view, open, ids, after(at));
  if (index <= 0) {
    const first = await view.get(ids[0]);
    if (!first) return null;
    const firstOpened = await open(first);
    return { order: Number(first.o) - 1, above: firstOpened ? { id: String(first.id), o: Number(first.o), at: Number(firstOpened.createdAt) } : null };
  }
  if (index >= ids.length) {
    const last = await view.get(ids[ids.length - 1]);
    return last ? { order: Number(last.o) + 1 } : null;
  }
  const [below, above] = await Promise.all([view.get(ids[index - 1]), view.get(ids[index])]);
  if (!below || !above) return null;
  const [belowOpened, aboveOpened] = await Promise.all([open(below), open(above)]);
  const order = positionBetween(below.o, belowOpened ? belowOpened.createdAt : NaN, above.o, aboveOpened ? aboveOpened.createdAt : NaN, at);
  if (order === null) return null;
  return { order, above: aboveOpened ? { id: String(above.id), o: Number(above.o), at: Number(aboveOpened.createdAt) } : null };
}

async function openMessageHistoryRecords(open, records) {
  const opened = [];
  const failed = [];
  for (const record of records) {
    // eslint-disable-next-line no-await-in-loop
    const item = await open(record, { reason: true });
    if (item?.message) opened.push(item);
    else failed.push({ id: record?.id ?? null, threadId: null, createdAt: null, error: String(item?.error ?? 'record blocked') });
  }
  opened.sort((a, b) => a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id)));
  return { messages: opened, failed };
}

function createHistoryStoreApi(keys, backend, { maxPerThread, type, persistent }) {
  const tags = new Map();
  const tagOf = async (threadId) => {
    let tag = tags.get(threadId);
    if (!tag) { tag = await conversationTag(keys, threadId); tags.set(threadId, tag); }
    return tag;
  };
  const heavyTags = new Set();
  let compacting = null;
  let compactionGate = Promise.resolve();
  const compactPage = async (tag, after) => {
    let page = [];
    for (let attempt = 0; attempt < 3 && !closing; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      page = await backend.recordsPage(tag, after, COMPACT_PAGE);
      const next = [];
      const expected = [];
      for (const record of page) {
        if (!record || record.v !== MESSAGE_HISTORY_RECORD_VERSION || record.t !== tag) continue;
        let item = null;
        // eslint-disable-next-line no-await-in-loop
        try { item = await openMessageHistoryRecord(keys, record); } catch { continue; }
        if (!item.faceDropped) continue;
        // eslint-disable-next-line no-await-in-loop
        next.push(await sealMessageHistoryRecord(keys, { id: item.id, threadId: item.threadId, createdAt: item.createdAt, thread: item.thread, message: item.message }, { order: Number(record.o), tags: { t: tag } }));
        expected.push([record.id, record.n ?? null]);
      }
      if (next.length === 0 || closing) return { page, rewritten: 0 };
      // eslint-disable-next-line no-await-in-loop
      if (await serially(() => backend.rewritePageIfUnchanged(expected, next))) return { page, rewritten: next.length };
    }
    return { page, rewritten: 0 };
  };
  const compactConversation = async (tag) => {
    let rewritten = 0;
    let after = -Infinity;
    while (!closing) {
      // eslint-disable-next-line no-await-in-loop
      const done = await compactPage(tag, after);
      if (done.page.length === 0) break;
      after = Number(done.page[done.page.length - 1].o);
      rewritten += done.rewritten;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => { setTimeout(resolve, 0); });
    }
    return rewritten;
  };
  const compactHeavy = () => {
    if (compacting || heavyTags.size === 0 || closing) return compacting ?? Promise.resolve();
    compacting = (async () => {
      await compactionGate;
      while (heavyTags.size > 0 && !closing) {
        const tag = heavyTags.values().next().value;
        heavyTags.delete(tag);
        // eslint-disable-next-line no-await-in-loop
        await compactConversation(tag).catch(() => 0);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => { setTimeout(resolve, 0); });
      }
    })().finally(() => { compacting = null; });
    return compacting;
  };
  const open = async (record, { reason = false } = {}) => {
    try {
      const item = await openMessageHistoryRecord(keys, record);
      if (item.faceDropped) {
        delete item.faceDropped;
        if (record?.t) { heavyTags.add(record.t); void compactHeavy(); }
      }
      return item;
    } catch (error) { return reason ? { error: error?.message ?? String(error) } : null; }
  };
  let writes = Promise.resolve();
  const serially = (work) => {
    const run = writes.then(work, work);
    writes = run.catch(() => {});
    return run;
  };
  let lastPlaced = null;
  let closing = false;
  const orderCache = new Map();
  const ORDER_CACHE_MAX = 32;
  const ORDER_CACHE_MS = 30_000;
  const idsInOrderOf = async (tag) => {
    const held = orderCache.get(tag);
    if (held && Date.now() - held.at < ORDER_CACHE_MS && Number(await backend.count(tag)) === held.ids.length) return held.ids;
    const ids = await backend.idsInOrder(tag);
    orderCache.delete(tag);
    orderCache.set(tag, { ids, at: Date.now() });
    while (orderCache.size > ORDER_CACHE_MAX) orderCache.delete(orderCache.keys().next().value);
    return ids;
  };
  const limitOf = (filter) => (Number.isFinite(filter?.limit) && filter.limit >= 0 ? Math.floor(filter.limit) : null);

  const upperBoundOf = async (tag, filter) => {
    if (filter?.beforeId) {
      const record = await backend.get(String(filter.beforeId));
      if (record && record.v === MESSAGE_HISTORY_RECORD_VERSION && record.t === tag) return { bound: { o: Number(record.o), id: String(record.id) }, byTime: false };
      if (!Number.isFinite(filter?.before)) return { bound: { o: -Infinity, id: '' }, byTime: false };
    }
    if (Number.isFinite(filter?.before)) {
      const ids = await backend.idsInOrder(tag);
      const index = await firstIndexByTime(backend, open, ids, atOrAfter(Number(filter.before)));
      if (index >= ids.length) return { bound: null, byTime: true };
      const record = await backend.get(ids[index]);
      return { bound: record ? { o: Number(record.o), id: String(record.id) } : null, byTime: true };
    }
    return { bound: null, byTime: false };
  };

  return {
    async rewriteHeadersOnce() {
      if (typeof backend.readMark !== 'function' || await backend.readMark(HEADERS_REWRITTEN_MARK)) return 0;
      let rewritten = 0;
      let unfinished = false;
      for (const { tag } of await backend.summaries(1)) {
        if (closing) return rewritten;
        const doneMark = `${HEADERS_REWRITTEN_MARK}:${tag}`;
        // eslint-disable-next-line no-await-in-loop
        if (await backend.readMark(doneMark)) continue;
        // eslint-disable-next-line no-await-in-loop
        rewritten += await serially(async () => {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            // eslint-disable-next-line no-await-in-loop
            const records = await backend.recordsInOrder(tag);
            const base = randomOrderBase();
            const next = [];
            for (let rank = 0; rank < records.length; rank += 1) {
              const record = records[rank];
              if (!record || record.v !== MESSAGE_HISTORY_RECORD_VERSION || record.t !== tag) continue;
              // eslint-disable-next-line no-await-in-loop
              const item = record.c ? null : await open(record);
              if (!item) { next.push({ ...record, o: base + rank }); continue; }
              // eslint-disable-next-line no-await-in-loop
              next.push(await sealMessageHistoryRecord(keys, { id: item.id, threadId: item.threadId, createdAt: item.createdAt, thread: item.thread, message: item.message }, { order: base + rank, tags: { t: tag } }));
            }
            // eslint-disable-next-line no-await-in-loop
            if (await backend.rewriteIfUnchanged(tag, records.map((record) => [record.id, record.n ?? null]), next)) {
              orderCache.delete(tag);
              lastPlaced = null;
              await backend.writeMark(doneMark);
              return next.length;
            }
          }
          unfinished = true;
          return 0;
        });
      }
      if (!closing && !unfinished) await backend.writeMark(HEADERS_REWRITTEN_MARK);
      return rewritten;
    },
    deferCompaction(until) {
      compactionGate = Promise.resolve(until).catch(() => {});
    },
    async putMessage(input) {
      if (closing) throw new Error('the message history is closed');
      const normalized = normalizeMessageRecordInput(input);
      return serially(async () => {
        const tag = await tagOf(normalized.threadId);
        let order = null;
        if (input?.id) {
          const existing = await backend.get(String(normalized.id));
          if (existing?.v === MESSAGE_HISTORY_RECORD_VERSION && existing.t === tag && Number.isFinite(Number(existing.o))) {
            const before = await open(existing);
            if (!before || Number(before.createdAt) === normalized.createdAt) order = Number(existing.o);
          }
        }
        if (order === null) {
          const placed = await assignOrder(backend, open, tag, normalized.createdAt, lastPlaced);
          order = placed.order;
          lastPlaced = placed.above && Number.isFinite(Number(placed.above.at))
            ? { tag, id: String(normalized.id), o: order, at: normalized.createdAt, aboveId: String(placed.above.id), aboveO: Number(placed.above.o), aboveAt: Number(placed.above.at) }
            : null;
        }
        const record = await sealMessageHistoryRecord(keys, normalized, { order, tags: { t: tag } });
        await backend.put(record, { tag, maxPerThread });
        orderCache.delete(tag);
        return { id: record.id, threadId: normalized.threadId, createdAt: normalized.createdAt };
      });
    },
    async listThreadSummaries() {
      const rows = await backend.summaries(SUMMARY_PROBE_RECORDS);
      const summaries = [];
      for (const row of rows) {
        let newest = null;
        for (const record of row.newest) {
          // eslint-disable-next-line no-await-in-loop
          newest = await open(record);
          if (newest) break;
        }
        if (!newest) continue;
        summaries.push({ threadId: newest.threadId, count: row.count, newestCreatedAt: Number(newest.createdAt) });
      }
      return summaries.sort((a, b) => b.newestCreatedAt - a.newestCreatedAt || String(a.threadId).localeCompare(String(b.threadId)));
    },
    async countThreadMessages(threadId) {
      if (typeof threadId !== 'string' || threadId.length === 0) return 0;
      return backend.count(await tagOf(threadId));
    },
    async hasCapsule(capsuleId) {
      if (typeof capsuleId !== 'string' || capsuleId.length === 0) return false;
      return backend.hasCapsuleTag(await capsuleTag(keys, capsuleId));
    },
    async hasOwnSendNear(threadId, atMs, slackMs) {
      const at = Number(atMs);
      const slack = Number(slackMs);
      if (!threadId || !Number.isFinite(at) || !Number.isFinite(slack) || slack < 0) return false;
      const ids = await idsInOrderOf(await tagOf(threadId));
      if (ids.length === 0) return false;
      const index = await firstIndexByTime(backend, open, ids, atOrAfter(at - slack));
      for (let i = Math.max(0, index - NEAR_SCAN_SLACK_RECORDS), steps = 0; i < ids.length && steps < NEAR_SCAN_MAX_RECORDS; i += 1, steps += 1) {
        // eslint-disable-next-line no-await-in-loop
        const record = await backend.get(ids[i]);
        // eslint-disable-next-line no-await-in-loop
        const item = record ? await open(record) : null;
        if (!item) continue;
        if (item.createdAt > at + slack && i >= index + NEAR_SCAN_SLACK_RECORDS) break;
        if (item.type === 'out' && Math.abs(item.createdAt - at) <= slack) return true;
      }
      return false;
    },
    async listMessageHeaders() {
      const { messages } = await openMessageHistoryRecords(open, await backend.all());
      return messages.map((item) => ({ id: item.id, threadId: item.threadId, createdAt: Number(item.createdAt), type: item.type, capsuleId: item.capsuleId ?? null }));
    },
    async listMessages(filter = {}) {
      return (await this.listMessagesDetailed(filter)).messages;
    },
    async listMessagesDetailed(filter = {}) {
      const limit = limitOf(filter);
      if (filter.threadId) {
        if (limit === 0) return { messages: [], failed: [], cursor: null };
        const tag = await tagOf(filter.threadId);
        const { bound, byTime } = await upperBoundOf(tag, filter);
        const records = await backend.windowBelow(tag, bound, limit);
        const page = await openMessageHistoryRecords(open, records);
        const messages = byTime ? page.messages.filter((item) => item.createdAt < Number(filter.before)) : page.messages;
        return { messages, failed: page.failed, cursor: records[0]?.id ?? null };
      }
      const page = await openMessageHistoryRecords(open, await backend.all());
      let messages = page.messages;
      if (Number.isFinite(filter.before)) messages = messages.filter((item) => item.createdAt < Number(filter.before));
      if (limit !== null && messages.length > limit) messages = messages.slice(messages.length - limit);
      return { messages, failed: page.failed, cursor: null };
    },
    async getMessage(id) {
      if (!id) return null;
      const record = await backend.get(String(id));
      if (!record) return null;
      const page = await openMessageHistoryRecords(open, [record]);
      if (page.failed.length > 0 || page.messages.length === 0) throw new Error('the record is there but could not be opened');
      return page.messages[0];
    },
    async deleteMessage(id) {
      if (!id || closing) return false;
      return serially(async () => { await backend.remove(String(id)); orderCache.clear(); return true; });
    },
    close() {
      if (closing) return writes;
      closing = true;
      writes = writes.then(() => { try { backend.close?.(); } catch { } });
      return writes;
    },
    get closed() { return closing; },
    facesCompacted() { return compactHeavy(); },
    get type() { return type; },
    get maxPerThread() { return maxPerThread; },
    get persistent() { return persistent; },
  };
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

const HISTORY_OPEN_BLOCKED_MS = 10_000;

async function openHistoryDb(dbName, factory = globalThis.indexedDB, { onVersionChange = null, blockedMs = HISTORY_OPEN_BLOCKED_MS } = {}) {
  if (!factory) throw new Error('IndexedDB is unavailable');
  const openRequest = factory.open(dbName, MESSAGE_HISTORY_DB_VERSION);
  openRequest.onupgradeneeded = () => {
    const db = openRequest.result;
    if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
      db.createObjectStore(KEY_STORE_NAME, { keyPath: 'id' });
    }
    const store = db.objectStoreNames.contains(MESSAGE_STORE_NAME)
      ? openRequest.transaction.objectStore(MESSAGE_STORE_NAME)
      : db.createObjectStore(MESSAGE_STORE_NAME, { keyPath: 'id' });
    const has = (name) => store.indexNames?.contains?.(name) === true;
    for (const retired of RETIRED_INDEXES) if (has(retired)) store.deleteIndex(retired);
    if (!has(LEGACY_THREAD_TIME_INDEX)) store.createIndex(LEGACY_THREAD_TIME_INDEX, ['threadId', 'createdAt']);
    if (!has(LEGACY_CAPSULE_INDEX)) store.createIndex(LEGACY_CAPSULE_INDEX, 'capsuleId');
    if (!has(ORDER_INDEX)) store.createIndex(ORDER_INDEX, ['t', 'o']);
    if (!has(CAPSULE_TAG_INDEX)) store.createIndex(CAPSULE_TAG_INDEX, 'c');
  };
  let blockedTimer = null;
  const blocked = new Promise((_resolve, reject) => {
    openRequest.onblocked = () => {
      console.warn('[history] another tab holds this store at an older version; waiting for it to let go');
      if (blockedTimer !== null) return;
      blockedTimer = setTimeout(() => {
        const error = new Error('the message history is held open by another tab');
        error.code = 'PLATHO_HISTORY_BLOCKED';
        reject(error);
      }, blockedMs);
    };
  });
  let db;
  try {
    db = await Promise.race([requestToPromise(openRequest), blocked]);
  } catch (error) {
    if (error?.code === 'PLATHO_HISTORY_BLOCKED') {
      requestToPromise(openRequest).then((late) => { try { late.close(); } catch { } }).catch(() => {});
    }
    throw error;
  } finally {
    if (blockedTimer !== null) clearTimeout(blockedTimer);
  }
  db.onversionchange = () => {
    try { db.close(); } catch { }
    try { onVersionChange?.(); } catch { }
  };
  return db;
}

function pruneInTransaction(store, indexName, maxPerThread, range) {
  return new Promise((resolve, reject) => {
    if (!Number.isFinite(maxPerThread) || maxPerThread <= 0) { resolve(0); return; }
    const index = store.index(indexName);
    const counting = index.count(range);
    counting.onerror = () => reject(counting.error);
    counting.onsuccess = () => {
      const excess = Number(counting.result) - maxPerThread;
      if (excess <= 0) { resolve(0); return; }
      const oldest = index.getAllKeys(range, excess);
      oldest.onerror = () => reject(oldest.error);
      oldest.onsuccess = () => {
        for (const id of oldest.result) store.delete(id);
        resolve(oldest.result.length);
      };
    };
  });
}

function indexedDbBackend(db, keyRangeApi) {
  const range = (tag) => keyRangeApi().bound([tag, -Infinity], [tag, Infinity]);
  const readonly = async (run) => {
    const tx = db.transaction(MESSAGE_STORE_NAME, 'readonly');
    const result = await run(tx.objectStore(MESSAGE_STORE_NAME));
    await transactionDone(tx);
    return result;
  };
  const firstValue = (source, keyRange, direction) => new Promise((resolve, reject) => {
    const request = source.openCursor(keyRange, direction);
    request.onsuccess = () => resolve(request.result ? request.result.value : null);
    request.onerror = () => reject(request.error);
  });
  const backend = {
    get: (id) => readonly((store) => requestToPromise(store.get(id))),
    edge: (tag, direction) => readonly((store) => firstValue(store.index(ORDER_INDEX), range(tag), direction)),
    idsInOrder: (tag) => readonly((store) => requestToPromise(store.index(ORDER_INDEX).getAllKeys(range(tag)))),
    recordsFrom: (tag, o, count) => readonly((store) => new Promise((resolve, reject) => {
      const held = [];
      const request = store.index(ORDER_INDEX).openCursor(keyRangeApi().bound([tag, Number(o)], [tag, Infinity]), 'next');
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || held.length >= count) { resolve(held); return; }
        held.push(cursor.value);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    })),
    count: async (tag) => Number(await readonly((store) => requestToPromise(store.index(ORDER_INDEX).count(range(tag))))),
    hasCapsuleTag: async (c) => (await readonly((store) => requestToPromise(store.index(CAPSULE_TAG_INDEX).getKey(c)))) !== undefined,
    windowBelow: (tag, upper, limit) => readonly((store) => new Promise((resolve, reject) => {
      const keyRange = upper ? keyRangeApi().bound([tag, -Infinity], [tag, upper.o]) : range(tag);
      const held = [];
      const request = store.index(ORDER_INDEX).openCursor(keyRange, 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || (limit !== null && held.length >= limit)) { resolve(held.reverse()); return; }
        const value = cursor.value;
        if (!(upper && Number(value.o) === upper.o && String(value.id) >= upper.id)) held.push(value);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    })),
    async put(record, { tag, maxPerThread }) {
      const tx = db.transaction(MESSAGE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(MESSAGE_STORE_NAME);
      store.put(record);
      await pruneInTransaction(store, ORDER_INDEX, maxPerThread, range(tag));
      await transactionDone(tx);
    },
    async remove(id) {
      const tx = db.transaction(MESSAGE_STORE_NAME, 'readwrite');
      tx.objectStore(MESSAGE_STORE_NAME).delete(id);
      await transactionDone(tx);
    },
    async renumber(tag) {
      const ids = await backend.idsInOrder(tag);
      const base = randomOrderBase();
      const tx = db.transaction(MESSAGE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(MESSAGE_STORE_NAME);
      ids.forEach((id, rank) => {
        const request = store.get(id);
        request.onsuccess = () => {
          const value = request.result;
          if (value?.v === MESSAGE_HISTORY_RECORD_VERSION && value.t === tag && value.o !== base + rank) store.put({ ...value, o: base + rank });
        };
      });
      await transactionDone(tx);
    },
    async rewrite(records) {
      const tx = db.transaction(MESSAGE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(MESSAGE_STORE_NAME);
      for (const record of records) store.put(record);
      await transactionDone(tx);
    },
    recordsInOrder: (tag) => readonly((store) => requestToPromise(store.index(ORDER_INDEX).getAll(range(tag)))),
    recordsPage: (tag, after, limit) => readonly((store) => requestToPromise(store.index(ORDER_INDEX).getAll(
      keyRangeApi().bound([tag, after], [tag, Infinity], true, false), limit))),
    async rewritePageIfUnchanged(expected, records) {
      const tx = db.transaction(MESSAGE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(MESSAGE_STORE_NAME);
      let same = true;
      for (const [id, seal] of expected) {
        // eslint-disable-next-line no-await-in-loop
        const now = await requestToPromise(store.get(id));
        if (String(now?.n ?? null) !== String(seal ?? null)) { same = false; break; }
      }
      if (same) for (const record of records) store.put(record);
      await transactionDone(tx);
      return same;
    },
    async rewriteIfUnchanged(tag, expected, records) {
      const tx = db.transaction(MESSAGE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(MESSAGE_STORE_NAME);
      const now = await requestToPromise(store.index(ORDER_INDEX).getAll(range(tag)));
      const same = now.length === expected.length
        && now.every((record, at) => String(record?.id) === String(expected[at][0]) && String(record?.n ?? null) === String(expected[at][1] ?? null));
      if (same) for (const record of records) store.put(record);
      await transactionDone(tx);
      return same;
    },
    readMark: async (id) => {
      const tx = db.transaction(KEY_STORE_NAME, 'readonly');
      const value = await requestToPromise(tx.objectStore(KEY_STORE_NAME).get(id));
      await transactionDone(tx);
      return Boolean(value);
    },
    writeMark: async (id) => {
      const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
      tx.objectStore(KEY_STORE_NAME).put({ id });
      await transactionDone(tx);
    },
    all: async () => (await readonly((store) => requestToPromise(store.getAll())))
      .filter((record) => record?.v === MESSAGE_HISTORY_RECORD_VERSION),
    summaries: (perTag) => readonly(async (store) => {
      const index = store.index(ORDER_INDEX);
      const firstKeyAfter = (tag) => new Promise((resolve, reject) => {
        const cursor = index.openKeyCursor(tag === null ? null : keyRangeApi().lowerBound([tag, Infinity], true));
        cursor.onsuccess = () => resolve(cursor.result ? cursor.result.key : null);
        cursor.onerror = () => reject(cursor.error);
      });
      const newestOf = (tag) => new Promise((resolve, reject) => {
        const held = [];
        const request = index.openCursor(range(tag), 'prev');
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor || held.length >= perTag) { resolve(held); return; }
          held.push(cursor.value);
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      });
      const rows = [];
      let key = await firstKeyAfter(null);
      while (key) {
        const tag = key[0];
        // eslint-disable-next-line no-await-in-loop
        const [count, newest] = await Promise.all([requestToPromise(index.count(range(tag))), newestOf(tag)]);
        rows.push({ tag, count: Number(count), newest });
        // eslint-disable-next-line no-await-in-loop
        key = await firstKeyAfter(tag);
      }
      return rows;
    }),
    close: () => db.close(),
  };
  return backend;
}

const MOVE_PARALLEL = 32;

async function inBatches(items, size, run) {
  const out = [];
  for (let at = 0; at < items.length; at += size) {
    // eslint-disable-next-line no-await-in-loop
    out.push(...await Promise.all(items.slice(at, at + size).map((item) => run(item))));
  }
  return out;
}
async function migrateLegacyHistory(db, keys, keyRangeApi, { lockName = null, onProgress = null } = {}) {
  return withAtRestLock(lockName, async () => {
    const readonly = async (names, run) => {
      const tx = db.transaction(names, 'readonly');
      const result = await run(tx);
      await transactionDone(tx);
      return result;
    };
    const legacyKey = (await readonly(KEY_STORE_NAME, (tx) => requestToPromise(tx.objectStore(KEY_STORE_NAME).get(LEGACY_KEY_ID))))?.key ?? null;
    const legacyIndexOf = (tx) => tx.objectStore(MESSAGE_STORE_NAME).index(LEGACY_THREAD_TIME_INDEX);
    const legacyThreads = await readonly(MESSAGE_STORE_NAME, async (tx) => {
      const index = legacyIndexOf(tx);
      const firstKeyAfter = (threadId) => new Promise((resolve, reject) => {
        const cursor = index.openKeyCursor(threadId === null ? null : keyRangeApi().lowerBound([threadId, Infinity], true));
        cursor.onsuccess = () => resolve(cursor.result ? cursor.result.key : null);
        cursor.onerror = () => reject(cursor.error);
      });
      const out = [];
      let key = await firstKeyAfter(null);
      while (key) {
        out.push(key[0]);
        // eslint-disable-next-line no-await-in-loop
        key = await firstKeyAfter(key[0]);
      }
      return out;
    });
    const result = { conversations: legacyThreads.length, moved: 0, unreadable: 0, failed: 0, keyRetired: false };
    const backend = indexedDbBackend(db, keyRangeApi);
    const legacyRange = (threadId) => keyRangeApi().bound([threadId, -Infinity], [threadId, Infinity]);
    const moveConversation = async (threadId) => {
      const legacy = await readonly(MESSAGE_STORE_NAME, (tx) => requestToPromise(legacyIndexOf(tx).getAll(legacyRange(threadId))));
      const openedLegacy = await inBatches(legacy, MOVE_PARALLEL, (record) => openLegacyMessageHistoryRecord(legacyKey, record)
        .then((item) => ({ item, record }), () => ({ item: null, record })));
      const opened = openedLegacy.filter((entry) => entry.item).map((entry) => entry.item);
      const unreadableIds = openedLegacy.filter((entry) => !entry.item && entry.record?.id != null).map((entry) => entry.record.id);
      result.unreadable += unreadableIds.length;
      if (opened.length === 0 && unreadableIds.length === 0) return;
      const tag = await conversationTag(keys, threadId);
      const currentRecords = (await inBatches(await backend.idsInOrder(tag), MOVE_PARALLEL, (id) => backend.get(id))).filter(Boolean);
      const current = (await inBatches(currentRecords, MOVE_PARALLEL, async (record) => ({ record, item: await openMessageHistoryRecord(keys, record).catch(() => null) })))
        .filter((entry) => entry.item);
      const all = [...current.map((entry) => ({ ...entry, legacy: false })), ...opened.map((item) => ({ item, legacy: true }))]
        .sort((a, b) => a.item.createdAt - b.item.createdAt || String(a.item.id).localeCompare(String(b.item.id)));
      const base = randomOrderBase();
      const ranked = all.map((entry, rank) => ({ entry, rank: base + rank }));
      const sealedLegacy = await inBatches(ranked.filter(({ entry }) => entry.legacy), MOVE_PARALLEL, async ({ entry: { item }, rank }) => {
        const sealed = await sealMessageHistoryRecord(keys, { id: item.id, threadId: item.threadId, createdAt: item.createdAt, thread: item.thread, message: item.message }, { order: rank, tags: { t: tag } });
        await openMessageHistoryRecord(keys, sealed);
        return sealed;
      });
      const puts = [...sealedLegacy, ...ranked.filter(({ entry, rank }) => !entry.legacy && Number(entry.record.o) !== rank).map(({ entry, rank }) => ({ ...entry.record, o: rank }))];
      const tx = db.transaction(MESSAGE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(MESSAGE_STORE_NAME);
      for (const record of puts) store.put(record);
      for (const id of unreadableIds) store.delete(id);
      await transactionDone(tx);
      result.moved += opened.length;
      try { onProgress?.({ ...result }); } catch { }
    };
    if (legacyThreads.length > 0 && legacyKey) {
      const failedThreads = [];
      for (const threadId of legacyThreads) {
        // eslint-disable-next-line no-await-in-loop
        try { await moveConversation(threadId); } catch { failedThreads.push(threadId); }
      }
      for (const threadId of failedThreads) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await moveConversation(threadId);
        } catch (error) {
          result.failed += 1;
          console.warn('[history] a conversation could not be moved to the wallet\'s key yet; the next unlock tries again', error);
        }
      }
    } else if (legacyThreads.length > 0) {
      for (const threadId of legacyThreads) {
        // eslint-disable-next-line no-await-in-loop
        const ids = await readonly(MESSAGE_STORE_NAME, (tx) => requestToPromise(legacyIndexOf(tx).getAllKeys(legacyRange(threadId))));
        const tx = db.transaction(MESSAGE_STORE_NAME, 'readwrite');
        for (const id of ids ?? []) tx.objectStore(MESSAGE_STORE_NAME).delete(id);
        // eslint-disable-next-line no-await-in-loop
        await transactionDone(tx);
        result.unreadable += (ids ?? []).length;
      }
    }
    const legacyLeft = await readonly(MESSAGE_STORE_NAME, (tx) => requestToPromise(legacyIndexOf(tx).count()));
    if (Number(legacyLeft) === 0 && legacyKey) {
      const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
      tx.objectStore(KEY_STORE_NAME).delete(LEGACY_KEY_ID);
      await transactionDone(tx);
      result.keyRetired = true;
    }
    return result;
  });
}

export async function createIndexedDbEncryptedMessageHistoryStore(options = {}) {
  const keys = options.keys;
  if (!keys?.seal || !keys?.index) throw new Error('the message history needs the wallet\'s at-rest keys');
  const keyRangeApi = () => {
    const api = options.IDBKeyRange ?? globalThis.IDBKeyRange;
    if (!api) throw new Error('IDBKeyRange is unavailable');
    return api;
  };
  const dbName = options.dbName ?? DEFAULT_DB_NAME;
  const db = await openHistoryDb(dbName, options.indexedDB ?? globalThis.indexedDB, { onVersionChange: options.onVersionChange ?? null, blockedMs: options.openBlockedMs ?? HISTORY_OPEN_BLOCKED_MS });
  const backend = indexedDbBackend(db, keyRangeApi);
  let currentBefore = null;
  try { currentBefore = (await backend.summaries(1)).length; } catch { currentBefore = null; }
  const migration = await migrateLegacyHistory(db, keys, keyRangeApi, { lockName: `platho.history.migrate.${dbName}`, onProgress: options.onMigrationProgress ?? null });
  if (currentBefore === 0 && Number(migration?.failed ?? 0) === 0) await backend.writeMark(HEADERS_REWRITTEN_MARK).catch(() => {});
  const maxPerThread = options.maxPerThread ?? options.maxRecords ?? DEFAULT_MESSAGE_HISTORY_MAX_PER_THREAD;
  const api = createHistoryStoreApi(keys, backend, { maxPerThread, type: 'indexeddb', persistent: true });
  return Object.defineProperty(api, 'migration', { value: migration, enumerable: false });
}

function memoryBackend(records) {
  const byOrder = (a, b) => Number(a.o) - Number(b.o) || (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
  const ofTag = (tag) => [...records.values()].filter((record) => record?.v === MESSAGE_HISTORY_RECORD_VERSION && record.t === tag).sort(byOrder);
  const backend = {
    get: async (id) => records.get(id),
    edge: async (tag, direction) => { const list = ofTag(tag); return (direction === 'prev' ? list[list.length - 1] : list[0]) ?? null; },
    idsInOrder: async (tag) => ofTag(tag).map((record) => record.id),
    recordsFrom: async (tag, o, count) => ofTag(tag).filter((record) => Number(record.o) >= Number(o)).slice(0, count),
    count: async (tag) => ofTag(tag).length,
    hasCapsuleTag: async (c) => [...records.values()].some((record) => record?.c === c),
    windowBelow: async (tag, upper, limit) => {
      const below = ofTag(tag).filter((record) => !upper || Number(record.o) < upper.o || (Number(record.o) === upper.o && String(record.id) < upper.id));
      return limit === null ? below : below.slice(Math.max(0, below.length - limit));
    },
    put: async (record, { tag, maxPerThread }) => {
      records.set(record.id, record);
      const list = ofTag(tag);
      if (Number.isFinite(maxPerThread) && maxPerThread > 0) for (const old of list.slice(0, Math.max(0, list.length - maxPerThread))) records.delete(old.id);
    },
    remove: async (id) => { records.delete(id); },
    renumber: async (tag) => { const base = randomOrderBase(); ofTag(tag).forEach((record, rank) => { records.set(record.id, { ...record, o: base + rank }); }); },
    rewrite: async (list) => { for (const record of list) records.set(record.id, record); },
    recordsInOrder: async (tag) => ofTag(tag),
    recordsPage: async (tag, after, limit) => ofTag(tag).filter((record) => Number(record.o) > after).slice(0, limit),
    rewritePageIfUnchanged: async (expected, list) => {
      if (!expected.every(([id, seal]) => String(records.get(String(id))?.n ?? null) === String(seal ?? null))) return false;
      for (const record of list) records.set(record.id, record);
      return true;
    },
    rewriteIfUnchanged: async (tag, expected, list) => {
      const now = ofTag(tag);
      if (now.length !== expected.length
        || !now.every((record, at) => String(record.id) === String(expected[at][0]) && String(record.n ?? null) === String(expected[at][1] ?? null))) return false;
      for (const record of list) records.set(record.id, record);
      return true;
    },
    all: async () => [...records.values()].filter((record) => record?.v === MESSAGE_HISTORY_RECORD_VERSION),
    summaries: async (perTag) => {
      const tags = [...new Set([...records.values()].filter((record) => record?.v === MESSAGE_HISTORY_RECORD_VERSION).map((record) => record.t))].sort();
      return tags.map((tag) => { const list = ofTag(tag); return { tag, count: list.length, newest: list.slice(-perTag).reverse() }; });
    },
  };
  return backend;
}

export async function createMemoryEncryptedMessageHistoryStore(options = {}) {
  const keys = options.keys ?? (await generateRandomAtRestKeys()).history;
  const records = new Map();
  const maxPerThread = options.maxPerThread ?? options.maxRecords ?? DEFAULT_MESSAGE_HISTORY_MAX_PER_THREAD;
  const backend = typeof options.watchBackend === 'function' ? options.watchBackend(memoryBackend(records)) : memoryBackend(records);
  const api = createHistoryStoreApi(keys, backend, { maxPerThread, type: 'memory', persistent: false });
  api.dumpEncryptedRecords = () => safeClone([...records.values()]);
  api.replaceEncryptedRecords = (recordsInput = []) => {
    records.clear();
    for (const record of recordsInput ?? []) {
      if (!record?.id) continue;
      records.set(record.id, safeClone(record));
    }
  };
  return api;
}
