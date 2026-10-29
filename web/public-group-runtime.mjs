
import { parseTonAddress, randomBytes, sha256Sync } from './crypto/platho-crypto.mjs?v=31';
import { readPublicPostPayloadV2 } from './pwa-contract-transactions.mjs?v=59';
import { createPerKeyLock } from './group-store.mjs?v=42';
import {
  isPublicGroupBanned,
  PUBLIC_GROUP_ID_BYTES, PUBLIC_GROUP_KIND, applyPublicGroupRows, createPublicGroupRecord, decodePublicGroupControl,
  encodePublicGroupControl, isPublicGroupAdmin, isPublicGroupOwner, isPublicGroupMuted, isPublicGroupRowKey, publicGroupExcerptIn, publicGroupHiddenIn, isValidPublicGroupKey, parsePublicGroupRecord,
  publicGroupKeyHex, publicGroupMember, serializePublicGroupRecord,
} from './public-group-protocol.mjs?v=11';

const encoder = new TextEncoder();
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const bytesToBig = (bytes) => [...bytes].reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n);

const CONTROL_UID_DOMAIN = 'PLATHO.PUBLIC.GROUP.CONTROL.V1';
const CHAT_UID_DOMAIN = 'PLATHO.PUBLIC.GROUP.CHAT.V1';

function uidOf(domain, groupId, founder) {
  if (!(groupId instanceof Uint8Array) || groupId.length !== PUBLIC_GROUP_ID_BYTES) throw new TypeError('a public group id is 32 bytes');
  if (!isValidPublicGroupKey(founder)) throw new TypeError('a public group thread is addressed by the founder');
  const material = new Uint8Array(domain.length + groupId.length + founder.length);
  material.set(encoder.encode(domain), 0);
  material.set(groupId, domain.length);
  material.set(founder, domain.length + groupId.length);
  return bytesToBig(sha256Sync(material));
}

export function publicGroupChatUid(groupId, founder) { return uidOf(CHAT_UID_DOMAIN, groupId, founder); }

export function publicGroupControlUid(groupId, founder) { return uidOf(CONTROL_UID_DOMAIN, groupId, founder); }

export function publicGroupStreamKey(streamId, senderHex) {
  return `stream:${String(senderHex ?? '').toLowerCase()}:${String(streamId ?? '').toLowerCase().replace(/^0x/, '')}`;
}

export const PUBLIC_GROUP_CONTROL_CONFIRM_S = 600;

export const PUBLIC_GROUP_REANCHOR_S = 300 * 86400;

export const PUBLIC_GROUP_PAGES_PER_PASS = 6;

export const PUBLIC_GROUP_BUFFER_MAX = 4096;
export const PUBLIC_GROUP_REANCHOR_RETRY_S = 3600;
export const PUBLIC_GROUP_PENDING_MAX = 64;
export const PUBLIC_GROUP_CONTROL_ABANDON_S = 7 * 86_400;
export const PUBLIC_GROUP_BUFFER_MAX_BYTES = 4 * 1024 * 1024;
export const PUBLIC_GROUP_BUFFER_ROW_MAX_BYTES = 256 * 1024;

export const PUBLIC_GROUP_PARTS_MAX = 64;
export const PUBLIC_GROUP_PARTS_MAX_BYTES = 4 * 1024 * 1024;
export const PUBLIC_GROUP_PARTS_MAX_AGE_S = 86_400;
export const PUBLIC_GROUP_TEXT_MAX_CHARS = 65_536;

export const PUBLIC_GROUP_MAX_PARTS = 64;

export const PUBLIC_GROUP_LEFT_READ_S = 15 * 60;

export function publicGroupKeyOfWallet(address) {
  try { return parseTonAddress(String(address)).hash; } catch { return null; }
}

export function publicGroupRawWallet(address) {
  try { return parseTonAddress(String(address)).raw; } catch { return null; }
}

const eraOfTag = (tag) => Number(BigInt(tag ?? 0) & 0xFFFFFFFFn);


function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(text) {
  const s = atob(String(text ?? ''));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}

function liteOf(post, documentBytes, streamId, hidden) {
  return {
    publisher: post.publisher, created_at: String(post.created_at ?? 0), entry_id: String(post.entry_id ?? 0), hidden: hidden === true,
    thread_epoch_tag: String(post.thread_epoch_tag ?? ''), thread_seq: Number(post.thread_seq ?? 0), thread_generation: Number(post.thread_generation ?? 17),
    thread_pk: String(post.thread_pk ?? ''), shard_key: post.shard_key ?? null, streamId: String(streamId ?? ''), documentBytes: toBase64(documentBytes),
  };
}

function docOfLite(lite) {
  return {
    documentBytes: fromBase64(lite.documentBytes), streamId: lite.streamId, publisher: lite.publisher, hidden: lite.hidden === true,
    post: { ...lite, created_at: BigInt(lite.created_at || 0), entry_id: BigInt(lite.entry_id || 0) },
  };
}

export function assemblePublicGroupDocuments(posts, readPayload, { parts: held = {}, now = 0 } = {}) {
  const streams = new Map();
  for (const [key, entry] of Object.entries(held ?? {})) {
    streams.set(key, { expected: Number(entry.expected ?? 1), publisher: entry.publisher, streamId: entry.streamId, at: Number(entry.at ?? 0), parts: new Map(Object.entries(entry.parts ?? {}).map(([i, lite]) => [Number(i), { lite, index: Number(i) }])) });
  }
  const out = [];
  for (const post of posts ?? []) {
    let payload;
    try { payload = readPayload({ header: post.header, body: post.body }); } catch { continue; }
    if (payload?.type !== 'document_comment' && payload?.type !== 'document') continue;
    const bytes = payload.documentBytes ?? payload.document_bytes;
    if (!bytes) continue;
    const count = Math.max(1, Number(payload.partCount ?? payload.part_count ?? 1));
    const index = Number(payload.partIndex ?? payload.part_index ?? 0);
    if (!Number.isInteger(count) || count > PUBLIC_GROUP_MAX_PARTS || !Number.isInteger(index) || index < 0 || index >= count) continue;
    const publisher = publicGroupRawWallet(post.publisher);
    if (!publisher) continue;
    const streamId = String(payload.stream_id ?? payload.streamId ?? '').toLowerCase().replace(/^0x/, '');
    if (count <= 1) {
      out.push({ documentBytes: bytes, streamId, publisher, post, hidden: post.hidden === true, partsAt: [{ shardKey: post.shard_key ?? null, entryId: Number(post.entry_id ?? 0) }] });
      continue;
    }
    const key = `${publisher}:${streamId}`;
    const group = streams.get(key) ?? { expected: count, parts: new Map(), publisher, streamId, at: now };
    group.expected = Math.max(group.expected, count);
    if (!group.parts.has(index)) group.parts.set(index, { lite: liteOf(post, bytes, streamId, post.hidden === true), index });
    streams.set(key, group);
  }
  const parts = {};
  for (const [key, group] of streams) {
    if (group.parts.size === group.expected) {
      const ordered = [...group.parts.values()].sort((a, b) => a.index - b.index);
      if (ordered.every((part, at) => part.index === at)) {
        const chunks = ordered.map((part) => fromBase64(part.lite.documentBytes));
        const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const documentBytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) { documentBytes.set(chunk, offset); offset += chunk.length; }
        const first = docOfLite(ordered[0].lite);
        const partsAt = ordered.map((part) => ({ shardKey: part.lite.shard_key ?? null, entryId: Number(part.lite.entry_id ?? 0) }));
        out.push({ documentBytes, streamId: group.streamId, publisher: group.publisher, post: first.post, hidden: ordered.some((part) => part.lite.hidden), partsAt });
        continue;
      }
    }
    parts[key] = { expected: group.expected, publisher: group.publisher, streamId: group.streamId, at: group.at, parts: Object.fromEntries([...group.parts.values()].map((part) => [String(part.index), part.lite])) };
  }
  const keys = Object.keys(parts).sort((a, b) => Number(parts[a].at) - Number(parts[b].at));
  while (keys.length > PUBLIC_GROUP_PARTS_MAX) delete parts[keys.shift()];
  const bytesOf = (stream) => Object.values(stream?.parts ?? {}).reduce((sum, lite) => sum + Math.ceil(String(lite?.documentBytes ?? '').length * 3 / 4), 0);
  for (const key of [...keys]) {
    if (Number(now) > 0 && Number(now) - Number(parts[key]?.at ?? now) > PUBLIC_GROUP_PARTS_MAX_AGE_S) { delete parts[key]; keys.splice(keys.indexOf(key), 1); }
  }
  let total = keys.reduce((sum, key) => sum + bytesOf(parts[key]), 0);
  while (keys.length > 0 && total > PUBLIC_GROUP_PARTS_MAX_BYTES) { total -= bytesOf(parts[keys[0]]); delete parts[keys.shift()]; }
  return { docs: out, parts };
}

function rowOf(doc, { decodeDocument, onAvatarBytes }) {
  let blocks;
  try { blocks = decodeDocument(doc.documentBytes); } catch { return null; }
  if (!Array.isArray(blocks)) return null;
  const senderKey = publicGroupKeyOfWallet(doc.publisher);
  if (!senderKey) return null;
  const post = doc.post;
  const coords = {
    era: eraOfTag(post.thread_epoch_tag),
    seq: Number(post.thread_seq ?? 0),
    entryId: Number(post.entry_id ?? 0),
    generation: Number(post.thread_generation ?? 17),
    epochTag: String(post.thread_epoch_tag ?? ''),
    partitionKey: String(post.thread_pk ?? ''),
    shardKey: post.shard_key ?? null,
  };
  const base = {
    key: publicGroupStreamKey(doc.streamId, hex(senderKey)),
    senderKey,
    senderWallet: doc.publisher,
    createdAt: Number(post.created_at ?? 0n),
    coords,
    hidden: doc.hidden === true,
    partsAt: Array.isArray(doc.partsAt) ? doc.partsAt : [{ shardKey: coords.shardKey, entryId: coords.entryId }],
  };
  const control = blocks.find((block) => block?.type === 'group');
  if (control) {
    const decoded = decodePublicGroupControl(control.bytes instanceof Uint8Array ? control.bytes : new Uint8Array(control.bytes ?? []));
    if (!decoded) return null;
    const image = decoded.kind === PUBLIC_GROUP_KIND.PROFILE && decoded.avatar?.hash ? blocks.find((block) => block?.type === 'image' && block.bytes) : null;
    const imageBytes = image ? (image.bytes instanceof Uint8Array ? image.bytes : new Uint8Array(image.bytes ?? [])) : null;
    return { ...base, control: decoded, ...(imageBytes ? { avatarBytes: imageBytes } : {}) };
  }
  const text = blocks.filter((block) => block?.type === 'text').map((block) => String(block.text ?? '')).join('\n').trim().slice(0, PUBLIC_GROUP_TEXT_MAX_CHARS);
  if (!text) return null;
  const username = blocks.find((block) => block?.type === 'sender')?.username ?? null;
  return { ...base, text, ...(username ? { senderUsername: String(username).slice(0, 64) } : {}) };
}

function avatarBytesFor(record, rows) {
  const hash = record?.avatar?.hash;
  if (!hash) return null;
  const adminHex = new Set((record.admins ?? []).map(hex));
  for (const row of rows) {
    if (!row?.avatarBytes || row.control?.kind !== PUBLIC_GROUP_KIND.PROFILE || row.control?.avatar?.hash !== hash) continue;
    if (!adminHex.has(hex(row.senderKey))) continue;
    if (hex(sha256Sync(row.avatarBytes)) !== hash) continue;
    return { hash, bytes: row.avatarBytes, width: row.control.avatar.width, height: row.control.avatar.height };
  }
  return null;
}


const blocksOf = (marks, key) => (Array.isArray(marks?.[key]) ? marks[key] : (marks?.[key] ? [marks[key]] : []))
  .map((b) => ({ bottom: Number(b.bottom ?? 0), top: Number(b.top ?? 0), oldestLt: b.oldestLt ?? null }))
  .filter((b) => b.top > b.bottom)
  .sort((a, b) => b.top - a.top);

const merged = (list) => {
  const out = [];
  for (const block of list.sort((a, b) => b.top - a.top)) {
    const last = out[out.length - 1];
    if (last && block.top >= last.bottom) {
      const lower = block.bottom < last.bottom;
      last.bottom = Math.min(last.bottom, block.bottom);
      if (lower) last.oldestLt = block.oldestLt ?? last.oldestLt;
    } else out.push({ ...block });
  }
  return out;
};

const countByShard = (posts) => {
  const counts = new Map();
  for (const post of posts ?? []) counts.set(post.shard_key, (counts.get(post.shard_key) ?? 0) + 1);
  return counts;
};

async function readThreadCaughtUp(lane, uid, { firstEra, marks, budget, states = null }) {
  const options = { ...(firstEra === null ? {} : { firstEra }), ...(states instanceof Map ? { states } : {}) };
  const read = await lane.readThreadByUid(uid, options);
  const live = read?.states instanceof Map ? read.states : states;
  const posts = [...(read?.posts ?? [])];
  const hidden = [...(read?.hidden ?? [])];
  const shards = {};
  const delivered = countByShard(read?.posts ?? []);
  let anyRead = Object.keys(read?.cursors ?? {}).length === 0;
  const declined = [];
  for (const [key, cursor] of Object.entries(read?.cursors ?? {})) {
    const from = Number(cursor.from ?? 0);
    const entryCount = Number(cursor.entryCount ?? 0);
    const windowHasRows = entryCount - from > 0;
    const readable = !windowHasRows || (delivered.get(key) ?? 0) > 0;
    if (readable) anyRead = true; else declined.push(key);
    const window = { bottom: from, top: entryCount, oldestLt: cursor.oldestLt ?? null };
    shards[key] = { blocks: readable ? merged([window, ...blocksOf(marks, key)]) : blocksOf(marks, key), entryCount, readable };
  }
  let rounds = 0;
  while (rounds < budget) {
    const older = {};
    let wanted = 0;
    for (const [key, shard] of Object.entries(shards)) {
      const top = shard.blocks[0];
      if (shard.readable && top && top.bottom > 0) {
        older[key] = { from: top.bottom, entryCount: shard.entryCount, oldestLt: top.oldestLt };
        wanted += 1;
      } else {
        older[key] = { from: 0, entryCount: shard.entryCount };
      }
    }
    if (wanted === 0) break;
    const page = await lane.readThreadByUid(uid, { ...options, ...(live instanceof Map ? { states: live } : {}), olderThan: older });
    rounds += 1;
    const pageDelivered = countByShard(page?.posts ?? []);
    posts.push(...(page?.posts ?? []));
    hidden.push(...(page?.hidden ?? []));
    let moved = false;
    for (const [key, cursor] of Object.entries(page?.cursors ?? {})) {
      const shard = shards[key];
      if (!shard || !older[key] || older[key].from === 0) continue;
      const top = shard.blocks[0];
      const from = Number(cursor.from ?? 0);
      if (from >= top.bottom) continue;
      if ((pageDelivered.get(key) ?? 0) === 0) { shard.readable = false; continue; }
      top.bottom = from;
      top.oldestLt = cursor.oldestLt ?? top.oldestLt;
      shard.blocks = merged(shard.blocks);
      moved = true;
    }
    if (!moved) break;
  }
  const nextMarks = {};
  for (const [key, shard] of Object.entries(shards)) if (shard.blocks.length > 0) nextMarks[key] = shard.blocks.slice(0, 8);
  for (const key of Object.keys(marks ?? {})) { if (nextMarks[key]) continue; const kept = blocksOf(marks, key); if (kept.length > 0) nextMarks[key] = kept; }
  return { posts, hidden, marks: nextMarks, rounds, delivered: anyRead, states: live, declined };
}

const bufferKeyOf = (lite) => `${String(lite?.publisher ?? '').toLowerCase()}:${lite?.streamId ? String(lite.streamId).toLowerCase() : `@${lite?.shard_key ?? ''}.${lite?.entry_id ?? ''}`}`;
const bufferBytesOf = (lite) => Math.ceil(String(lite?.documentBytes ?? '').length * 3 / 4);
const bufferOrderOf = (lite) => [Number(lite?.created_at ?? 0), eraOfTag(lite?.thread_epoch_tag || 0), Number(lite?.thread_seq ?? 0), Number(lite?.entry_id ?? 0)];
const bufferBefore = (a, b) => { const x = bufferOrderOf(a); const y = bufferOrderOf(b); for (let i = 0; i < 4; i += 1) if (x[i] !== y[i]) return x[i] < y[i]; return false; };
const bufferSenderOf = (lite) => lite?.sender ?? (() => { const key = publicGroupKeyOfWallet(lite?.publisher); return key ? hex(key) : ''; })();

function boundBuffer(buffer, founderHex) {
  let rows = buffer;
  let bytes = rows.reduce((sum, lite) => sum + bufferBytesOf(lite), 0);
  const within = () => rows.length <= PUBLIC_GROUP_BUFFER_MAX && bytes <= PUBLIC_GROUP_BUFFER_MAX_BYTES;
  if (within()) return rows;
  const membership = (lite) => lite?.kind === PUBLIC_GROUP_KIND.JOIN || lite?.kind === PUBLIC_GROUP_KIND.LEAVE;
  const newest = new Map();
  for (const lite of rows) {
    if (!membership(lite)) continue;
    const held = newest.get(bufferSenderOf(lite));
    if (!held || bufferBefore(held, lite)) newest.set(bufferSenderOf(lite), lite);
  }
  rows = rows.filter((lite) => !membership(lite) || newest.get(bufferSenderOf(lite)) === lite);
  bytes = rows.reduce((sum, lite) => sum + bufferBytesOf(lite), 0);
  if (within()) return rows;
  const dropped = new Set();
  const drop = (lite) => { dropped.add(lite); bytes -= bufferBytesOf(lite); };
  const left = () => rows.length - dropped.size;
  const over = () => left() > PUBLIC_GROUP_BUFFER_MAX || bytes > PUBLIC_GROUP_BUFFER_MAX_BYTES;
  const bySender = new Map();
  for (const lite of rows) {
    const sender = bufferSenderOf(lite);
    if (sender === founderHex) continue;
    if (!bySender.has(sender)) bySender.set(sender, []);
    bySender.get(sender).push(lite);
  }
  for (const list of bySender.values()) list.sort((a, b) => (bufferBefore(a, b) ? -1 : bufferBefore(b, a) ? 1 : 0));
  while (over()) {
    let heaviest = null;
    for (const list of bySender.values()) if (list.length > 1 && (!heaviest || list.length > heaviest.length)) heaviest = list;
    if (!heaviest) break;
    drop(heaviest.shift());
  }
  if (over()) {
    const rest = rows.filter((lite) => !dropped.has(lite) && bufferSenderOf(lite) !== founderHex)
      .sort((a, b) => (Number(membership(b)) - Number(membership(a))) || (bufferBefore(a, b) ? -1 : bufferBefore(b, a) ? 1 : 0));
    for (const lite of rest) { if (!over()) break; drop(lite); }
  }
  return rows.filter((lite) => !dropped.has(lite));
}

function threadConnected(marks) {
  return Object.values(marks ?? {}).every((blocks) => blocks.length <= 1 && Number(blocks[0]?.bottom ?? 0) === 0);
}

export function createPublicGroupRuntime({
  store, self = null, lane, publish: publishDocument, decodeDocument, readPayload = readPublicPostPayloadV2, threadEraOf,
  now = () => Math.floor(Date.now() / 1000), random = randomBytes, onError = null, onAvatarBytes = null,
  pagesPerPass = PUBLIC_GROUP_PAGES_PER_PASS,
}) {

  if (!store) throw new Error('createPublicGroupRuntime requires a record store');
  if (!lane || typeof lane.readThreadByUid !== 'function') throw new Error('createPublicGroupRuntime requires a lane with readThreadByUid');
  if (typeof publishDocument !== 'function') throw new Error('createPublicGroupRuntime requires publish()');
  if (typeof decodeDocument !== 'function') throw new Error('createPublicGroupRuntime requires decodeDocument()');
  if (typeof threadEraOf !== 'function') throw new Error('createPublicGroupRuntime requires threadEraOf()');
  if (self && !isValidPublicGroupKey(self.hash)) throw new TypeError('self.hash must be a wallet hash');

  const records = new Map();
  const reanchorFailedAt = new Map();
  const quietSignatures = new Map();
  let dropped = false;
  const locked = createPerKeyLock();
  const passLocked = createPerKeyLock();
  const askedAt = new Map();
  const askedKey = (groupId) => (groupId instanceof Uint8Array ? hex(groupId) : String(groupId).toLowerCase());
  const publish = (args) => publishDocument({ ...args, askedAt: askedAt.get(askedKey(args.groupId)) ?? null });
  const note = (where, error) => { try { onError?.(where, error); } catch { } };
  const persist = async (record) => {
    if (dropped) return record;
    records.set(hex(record.groupId), record);
    try { await store.put(hex(record.groupId), serializePublicGroupRecord(record)); } catch (error) { note('persist', error); }
    return record;
  };
  const requireSelf = () => {
    if (!self?.hash) throw new Error('a wallet is needed to write to a public group');
    return self;
  };
  const requireRecord = (groupId) => {
    const record = records.get(String(groupId));
    if (!record) throw new Error('no such group');
    if (!isValidPublicGroupKey(record.founder)) throw new Error('this group names no founder and cannot be addressed');
    return record;
  };
  const streamHex = () => hex(random(16));

  const plant = (groupId, { founder, foundedEra = null, name = null } = {}) => {
    const me = requireSelf();
    const id = groupId instanceof Uint8Array ? groupId : null;
    if (!id) throw new TypeError('a group is named by its id bytes');
    if (!isValidPublicGroupKey(founder)) throw new TypeError('a pointer without a founder points at nothing');
    const held = records.get(hex(id)) ?? null;
    if (held && isValidPublicGroupKey(held.founder) && hex(held.founder) !== hex(founder)) throw new Error('this pointer names another founder for a group already held');
    if (held && isValidPublicGroupKey(held.founder)) {
      return { held, record: held.leftAt ? { ...held, leftAt: null, pending: [], openedAt: now(), self: me.hash, selfWallet: me.wallet ?? held.selfWallet ?? null } : held };
    }
    return {
      held,
      record: createPublicGroupRecord({
        groupId: id, self: me.hash, selfWallet: me.wallet ?? null, name: name ?? held?.name ?? null, founder,
        foundedEra: foundedEra === null || foundedEra === undefined ? (held?.foundedEra ?? null) : Number(foundedEra),
        openedAt: now(),
      }),
    };
  };

  const control = async (record, kind, payload, { blocks: extraBlocks = [], revert = null, after: afterFold = null } = {}) => {
    const me = requireSelf();
    const sentAt = now();
    const bytes = encodePublicGroupControl(kind, { ...payload, sentAt });
    const streamId = streamHex();
    try {
      await publish({
        groupId: record.groupId,
        uid: publicGroupControlUid(record.groupId, record.founder),
        blocks: [{ type: 'group', bytes }, ...extraBlocks],
        streamId,
      });
    } catch (error) {
      if (!error?.builtBoc) throw error;
    }
    const pendingEntry = { kind, streamId, at: sentAt, sender: hex(me.hash), body: toBase64(bytes) };
    const ghost = ghostOf(pendingEntry, record);
    let after = ghost ? applyPublicGroupRows(record, [ghost]).record : record;
    if (typeof afterFold === 'function') after = afterFold(after);
    if (revert) { pendingEntry.revert = revert; pendingEntry.applied = snapshotFields(after, Object.keys(revert)); }
    return persist({ ...after, pending: [...(record.pending ?? []), pendingEntry] });
  };

  const api = {
    async load() {
      records.clear();
      quietSignatures.clear();
      let stored = [];
      try { stored = await store.list(); } catch (error) { note('load', error); }
      for (const row of stored) {
        try {
          const record = parsePublicGroupRecord(row);
          records.set(hex(record.groupId), record);
        } catch (error) { note('parse', error); }
      }
      return this.list();
    },

    drop() { dropped = true; },
    list() { return [...records.values()]; },
    get(groupId) { return records.get(String(groupId)) ?? null; },
    has(groupId) { return records.has(String(groupId)); },

    uidsOf(groupId) {
      const record = requireRecord(groupId);
      return { chat: publicGroupChatUid(record.groupId, record.founder), control: publicGroupControlUid(record.groupId, record.founder) };
    },

    pointerOf(groupId) {
      const record = requireRecord(groupId);
      return { groupId: record.groupId, founder: record.founder, owner: record.owner ?? null, foundedEra: record.foundedEra ?? null, name: record.name ?? null };
    },

    async create({ name = null } = {}) {
      const me = requireSelf();
      const groupId = random(PUBLIC_GROUP_ID_BYTES);
      const record = createPublicGroupRecord({
        groupId, self: me.hash, selfWallet: me.wallet ?? null, name: name ?? null, founder: me.hash, owner: me.hash,
        foundedEra: threadEraOf(now()), foundedAt: now(), openedAt: now(),
      });
      return control(record, PUBLIC_GROUP_KIND.FOUND, { name: name ?? '' });
    },

    async join(groupId, { founder, owner = null, foundedEra = null, name = null, displayName = null } = {}) {
      const me = requireSelf();
      void owner;
      const { held, record } = plant(groupId, { founder, foundedEra, name });
      return control(record, PUBLIC_GROUP_KIND.JOIN, displayName ? { name: displayName } : {}, {
        revert: {
          ...(publicGroupMember(record, me.hash) ? {} : { members: [hex(me.hash)] }),
          ...(held?.leftAt ? { rejoinedFrom: held.leftAt } : {}),
        },
      });
    },

    async adopt(groupId, { founder, foundedEra = null, name = null } = {}) {
      const { held, record } = plant(groupId, { founder, foundedEra, name });
      if (held && isValidPublicGroupKey(held.founder)) return held;
      return persist(record);
    },

    async leave(groupId) {
      const me = requireSelf();
      const record = requireRecord(groupId);
      if (isPublicGroupOwner(record, me.hash)) throw new Error('the owner hands the group over before leaving');
      return control(record, PUBLIC_GROUP_KIND.LEAVE, {}, { revert: { leftAt: true } });
    },

    async rereadChat(groupId) {
      const record = requireRecord(groupId);
      return persist({ ...record, read: { ...(record.read ?? {}), chat: {} } });
    },

    async say(groupId, text, { onSealed = null } = {}) {
      const me = requireSelf();
      const record = requireRecord(groupId);
      if (record.leftAt) throw new Error('this device left the group');
      if (isPublicGroupBanned(record, me.hash)) throw new Error('this wallet is banned from the group');
      const body = String(text ?? '');
      if (!body.trim()) throw new Error('an empty message is not sent');
      const streamId = streamHex();
      const key = publicGroupStreamKey(streamId, hex(record.self));
      if (typeof onSealed === 'function') await onSealed({ key, streamId });
      let sent = null;
      try {
        sent = await publish({
          groupId: record.groupId,
          uid: publicGroupChatUid(record.groupId, record.founder),
          blocks: [{ type: 'text', text: body }],
          streamId,
        });
      } catch (error) {
        if (!error?.builtBoc) throw error;
      }
      return { record, key, streamId, createdAtSec: Number(sent?.createdAtSec ?? now()) };
    },

    async setName(groupId, name) {
      const me = requireSelf();
      const record = requireRecord(groupId);
      if (!isPublicGroupAdmin(record, me.hash)) throw new Error('only an admin renames the group');
      const next = String(name ?? '').trim();
      if (!next) throw new Error('a group keeps a name');
      const before = record.name;
      return control(record, PUBLIC_GROUP_KIND.PROFILE, { name: next }, { revert: { name: before } });
    },

    async setAvatar(groupId, { bytes, width = 0, height = 0 }) {
      const me = requireSelf();
      const record = requireRecord(groupId);
      if (!isPublicGroupAdmin(record, me.hash)) throw new Error('only an admin sets the picture');
      if (!(bytes instanceof Uint8Array) || bytes.length === 0) throw new TypeError('a picture is bytes');
      const hash = hex(sha256Sync(bytes));
      const avatar = { hash, width: Number(width) >>> 0, height: Number(height) >>> 0 };
      const before = record.avatar;
      return control(record, PUBLIC_GROUP_KIND.PROFILE, { avatar }, {
        blocks: [{ type: 'image', bytes, width: avatar.width, height: avatar.height }],
        revert: { avatar: before },
      });
    },

    async setAdmins(groupId, admins) {
      const me = requireSelf();
      const record = requireRecord(groupId);
      if (!isPublicGroupOwner(record, me.hash)) throw new Error('only the owner names admins');
      const set = (admins ?? []).filter(isValidPublicGroupKey);
      if (!set.some((a) => hex(a) === hex(record.owner))) set.push(record.owner);
      const before = record.admins;
      return control(record, PUBLIC_GROUP_KIND.ADMIN, { admins: set, owner: record.owner }, { revert: { admins: before.map(hex) } });
    },

    async transferOwnership(groupId, newOwner) {
      const me = requireSelf();
      const record = requireRecord(groupId);
      if (!isPublicGroupOwner(record, me.hash)) throw new Error('only the owner hands the group over');
      if (!isValidPublicGroupKey(newOwner)) throw new TypeError('the new owner is a wallet hash');
      if (!publicGroupMember(record, newOwner)) throw new Error('the new owner must be a member');
      const admins = record.admins.some((a) => hex(a) === hex(newOwner)) ? record.admins : [...record.admins, newOwner];
      const before = { admins: record.admins, owner: record.owner };
      return control(record, PUBLIC_GROUP_KIND.ADMIN, { admins, owner: newOwner }, {
        revert: { admins: before.admins.map(hex), owner: hex(before.owner) },
      });
    },

    async ban(groupId, target, { lift = false } = {}) {
      const me = requireSelf();
      const record = requireRecord(groupId);
      if (!isPublicGroupAdmin(record, me.hash)) throw new Error('only an admin bans');
      if (!isValidPublicGroupKey(target)) throw new TypeError('the target is a wallet hash');
      if (isPublicGroupOwner(record, target)) throw new Error('the owner cannot be banned');
      if (isPublicGroupAdmin(record, target) && !isPublicGroupOwner(record, me.hash)) throw new Error('only the owner bans an admin');
      return control(record, PUBLIC_GROUP_KIND.BAN, { groupKey: target, lift }, {
        revert: { banned: record.banned.map(hex) },
        after: lift ? (r) => ({ ...r, read: { ...(r.read ?? {}), chat: {} } }) : null,
      });
    },

    async mute(groupId, target, { lift = false } = {}) {
      const me = requireSelf();
      const record = requireRecord(groupId);
      if (!isPublicGroupAdmin(record, me.hash)) throw new Error('only an admin mutes');
      if (!isValidPublicGroupKey(target)) throw new TypeError('the target is a wallet hash');
      if (!lift) {
        if (isPublicGroupOwner(record, target)) throw new Error('the owner cannot be muted');
        if (isPublicGroupAdmin(record, target) && !isPublicGroupOwner(record, me.hash)) throw new Error('only the owner mutes an admin');
      }
      if (isPublicGroupMuted(record, target) === !lift) return record;
      return control(record, PUBLIC_GROUP_KIND.MUTE, { groupKey: target, lift }, {
        revert: { muted: (record.muted ?? []).map(hex) },
        after: lift ? (r) => ({ ...r, read: { ...(r.read ?? {}), chat: {} } }) : null,
      });
    },

    async hide(groupId, key, { lift = false, excerpt = '' } = {}) {
      const me = requireSelf();
      const record = requireRecord(groupId);
      if (!isPublicGroupAdmin(record, me.hash)) throw new Error('only an admin hides a message');
      if (!isPublicGroupRowKey(key)) throw new TypeError('a hidden row is named by its key');
      if (Boolean(record.hidden?.[key]) === !lift) return record;
      return control(record, PUBLIC_GROUP_KIND.HIDE, { key, lift, excerpt: publicGroupExcerptIn(excerpt) }, {
        revert: { hidden: publicGroupHiddenIn(record.hidden) },
        after: lift ? (r) => ({ ...r, read: { ...(r.read ?? {}), chat: {} } }) : null,
      });
    },

    async sync({ groupIds = null, deliver = null } = {}) {
      const out = [];
      const due = this.list().filter((record) => (!groupIds || groupIds.includes(hex(record.groupId)))
        && (!record.leftAt || now() - Number(record.leftAt) <= PUBLIC_GROUP_LEFT_READ_S
          || (record.pending ?? []).some((p) => p.kind === PUBLIC_GROUP_KIND.JOIN && Number(p.at ?? 0) >= Number(record.leftAt))));
      let states = null;
      if (typeof lane.threadCoordsByUid === 'function' && typeof lane.readStates === 'function') {
        try {
          const addresses = [];
          for (const record of due) {
            if (!isValidPublicGroupKey(record.founder)) continue;
            const firstEra = record.foundedAt > 0 && record.foundedEra !== null ? Number(record.foundedEra) : null;
            for (const uid of [publicGroupControlUid(record.groupId, record.founder), publicGroupChatUid(record.groupId, record.founder)]) {
              const { coords } = await lane.threadCoordsByUid(uid, { ...(firstEra === null ? {} : { firstEra }) });
              addresses.push(...coords);
            }
          }
          if (addresses.length > 0) states = await lane.readStates(addresses);
        } catch (error) { note('states', error); states = null; }
      }
      for (const record of due) {
        const id = hex(record.groupId);
        if (!isValidPublicGroupKey(record.founder)) { note(`group ${id}`, new Error('no founder')); continue; }
        try {
          await passLocked(id, async () => {
          const firstEra = record.foundedAt > 0 && record.foundedEra !== null ? Number(record.foundedEra) : null;
          const marks = (records.get(id) ?? record).read ?? { control: {}, chat: {} };
          const readAtS = now();
          const readFromMs = Date.now();
          const controlRead = await readThreadCaughtUp(lane, publicGroupControlUid(record.groupId, record.founder), { firstEra, marks: marks.control ?? {}, budget: pagesPerPass, states });
          const chatRead = await readThreadCaughtUp(lane, publicGroupChatUid(record.groupId, record.founder), { firstEra, marks: marks.chat ?? {}, budget: pagesPerPass, states: controlRead.states ?? states });
          await locked(id, async () => {
          if (JSON.stringify((records.get(id) ?? record).read ?? { control: {}, chat: {} }) !== JSON.stringify(marks)) return;
          const signature = JSON.stringify([marks.control ?? {}, marks.chat ?? {}, controlRead.marks, chatRead.marks, controlRead.hidden, chatRead.hidden, controlRead.declined ?? [], chatRead.declined ?? []]);
          {
            const held = records.get(id) ?? record;
            const quiet = quietSignatures.get(id) === signature && threadConnected(controlRead.marks) && (controlRead.declined ?? []).length === 0
              && (held.pending ?? []).length === 0 && (held.buffer ?? []).length === 0
              && Object.keys(held.parts?.control ?? {}).length === 0 && Object.keys(held.parts?.chat ?? {}).length === 0
              && !reanchorDue(held, id, now());
            if (quiet) {
              const entry = { groupId: id, record: held, messages: [], hidden: [], bannedNow: [], liftedNow: [], hiddenNow: [], unhiddenNow: [], chatRead: chatRead.delivered, readFromMs, connected: true, caughtUp: threadConnected(chatRead.marks) };
              if (typeof deliver === 'function') { try { await deliver(entry); } catch (error) { note('deliver', error); } }
              out.push(entry);
              return;
            }
          }
          let current = records.get(id) ?? record;
          let dirty = false;
          const silencedAtStart = new Set([...(current.banned ?? []), ...(current.muted ?? [])].map(hex));
          const hiddenAtStart = new Set(Object.keys(current.hidden ?? {}));
          const nowS = now();
          const controlDocs = assemblePublicGroupDocuments(controlRead.posts, readPayload, { parts: current.parts?.control ?? {}, now: nowS });
          const chatDocs = assemblePublicGroupDocuments(chatRead.posts, readPayload, { parts: current.parts?.chat ?? {}, now: nowS });
          const controlRows = [];
          for (const doc of controlDocs.docs) {
            const row = rowOf(doc, { decodeDocument, onAvatarBytes });
            if (row?.control) controlRows.push({ row, doc });
          }
          const textRows = [];
          for (const doc of chatDocs.docs) {
            const row = rowOf(doc, { decodeDocument, onAvatarBytes: null });
            if (row && !row.control) textRows.push(row);
          }
          const connected = threadConnected(controlRead.marks) && (controlRead.declined ?? []).length === 0;
          let buffer = [...(current.buffer ?? [])];
          let toFold = [];
          if (connected) {
            const waiting = [];
            for (const lite of buffer) {
              try { const row = rowOf(docOfLite(lite), { decodeDocument, onAvatarBytes }); if (row?.control) waiting.push(row); } catch { }
            }
            toFold = [...waiting, ...controlRows.map((entry) => entry.row)];
            if (buffer.length > 0) { buffer = []; dirty = true; }
          } else if (controlRows.length > 0) {
            const trusted = new Set([hex(current.founder), ...(current.owner ? [hex(current.owner)] : []), ...(current.admins ?? []).map(hex)]);
            const kept = controlRows.filter((entry) => entry.doc.documentBytes.length <= PUBLIC_GROUP_BUFFER_ROW_MAX_BYTES || trusted.has(hex(entry.row.senderKey)));
            const held = new Set(buffer.map(bufferKeyOf));
            const added = [];
            for (const entry of kept) {
              const lite = { ...liteOf(entry.doc.post, entry.doc.documentBytes, entry.doc.streamId, entry.doc.hidden), kind: entry.row.control.kind, sender: hex(entry.row.senderKey) };
              const key = bufferKeyOf(lite);
              if (held.has(key)) continue;
              held.add(key);
              added.push(lite);
            }
            if (added.length > 0) {
              buffer = boundBuffer([...buffer, ...added], hex(current.founder));
              dirty = true;
            }
          }
          const folded = applyPublicGroupRows(current, [...toFold, ...textRows]);
          current = folded.record;
          if (folded.changed) dirty = true;
          if (typeof onAvatarBytes === 'function') {
            const picture = avatarBytesFor(current, toFold);
            if (picture) { try { onAvatarBytes(picture.hash, picture.bytes, picture.width, picture.height); } catch { } }
          }
          if (connected && reanchorDue(current, id, nowS)) {
            try {
              current = await control(current, PUBLIC_GROUP_KIND.ADMIN, { admins: current.admins, owner: current.owner });
              dirty = false;
            } catch (error) { reanchorFailedAt.set(id, nowS); note('re-anchor', error); }
          }
          const seen = new Set(controlRows.map((entry) => entry.row.key));
          const keep = [];
          for (const entry of current.pending ?? []) {
            if (seen.has(publicGroupStreamKey(entry.streamId, entry.sender))) { dirty = true; continue; }
            const age = readAtS - Number(entry.at ?? 0);
            if (age <= PUBLIC_GROUP_CONTROL_CONFIRM_S || (!connected && age <= PUBLIC_GROUP_CONTROL_ABANDON_S)) { keep.push(entry); continue; }
            current = revertPending(current, entry);
            dirty = true;
          }
          while (keep.length > PUBLIC_GROUP_PENDING_MAX) { current = revertPending(current, keep.shift()); dirty = true; }
          const ghosts = keep.map((entry) => ghostOf(entry, current)).filter(Boolean);
          if (ghosts.length > 0) {
            const again = applyPublicGroupRows(current, ghosts);
            if (again.changed) { current = again.record; dirty = true; }
          }
          const silencedAtEnd = new Set([...(current.banned ?? []), ...(current.muted ?? [])].map(hex));
          const hiddenAtEnd = new Set(Object.keys(current.hidden ?? {}));
          const bannedNow = [...silencedAtEnd].filter((k) => !silencedAtStart.has(k));
          const liftedNow = [...silencedAtStart].filter((k) => !silencedAtEnd.has(k));
          const hiddenNow = [...hiddenAtEnd].filter((k) => !hiddenAtStart.has(k));
          const unhiddenNow = [...hiddenAtStart].filter((k) => !hiddenAtEnd.has(k));
          const chainHidden = new Set(textRows.filter((row) => row.hidden).map((row) => row.key));
          const readBefore = ({ shardKey, entryId }) => Number.isFinite(Number(entryId))
            && blocksOf(marks.chat ?? {}, shardKey).some((block) => Number(entryId) >= block.bottom && Number(entryId) < block.top);
          const handedBefore = (row) => (row.partsAt ?? [{ shardKey: row.coords?.shardKey, entryId: row.coords?.entryId }]).every(readBefore);
          const leftBefore = Number((records.get(id) ?? record).leftAt ?? 0);
          const messages = folded.messages.map((m) => {
            const chain = chainHidden.has(m.key);
            const byKey = hiddenAtEnd.has(m.key);
            const silenced = silencedAtEnd.has(hex(m.senderKey));
            return { ...m, hidden: chain || silenced || byKey, hiddenBy: chain ? 'chain' : byKey ? 'key' : silenced ? 'silence' : null };
          })
            .filter((m) => m.hidden || !handedBefore(m))
            .filter((m) => !(leftBefore > 0) || (self?.hash && hex(m.senderKey) === hex(self.hash)) || Number(m.createdAt ?? 0) <= leftBefore);
          const nextParts = { control: controlDocs.parts, chat: chatDocs.parts };
          if (JSON.stringify(nextParts) !== JSON.stringify(current.parts ?? {})) dirty = true;
          current = { ...current, pending: keep, parts: nextParts, buffer };
          const entry = {
            groupId: id, record: current, messages,
            hidden: [...chatRead.hidden],
            bannedNow, liftedNow, hiddenNow, unhiddenNow,
            chatRead: chatRead.delivered,
            readFromMs,
            connected,
            caughtUp: connected && threadConnected(chatRead.marks),
          };
          let stored = true;
          if (typeof deliver === 'function') {
            try { stored = (await deliver(entry)) !== false; } catch (error) { note('deliver', error); stored = false; }
          }
          let chatMarks = stored ? chatRead.marks : (marks.chat ?? {});
          if (liftedNow.length > 0 || unhiddenNow.length > 0) { chatMarks = {}; dirty = true; }
          const nextRead = { control: controlRead.marks, chat: chatMarks };
          if (JSON.stringify(nextRead) !== JSON.stringify(current.read ?? {})) dirty = true;
          current = { ...current, read: nextRead };
          if (dirty) await persist(current); else records.set(id, current);
          if (stored && liftedNow.length === 0 && unhiddenNow.length === 0) quietSignatures.set(id, signature); else quietSignatures.delete(id);
          out.push({ ...entry, record: current });
          });
          });
        } catch (error) {
          note(`group ${id}`, error);
        }
      }
      return out;
    },
  };

  function reanchorDue(current, id, nowS) {
    return Boolean(self?.hash) && isValidPublicGroupKey(current.founder) && hex(current.founder) === hex(self.hash) && Boolean(current.owner) && hex(current.owner) !== hex(self.hash)
      && Number(current.ownerRowAt ?? 0) > 0 && nowS - Number(current.ownerRowAt) > PUBLIC_GROUP_REANCHOR_S
      && nowS - Number(reanchorFailedAt.get(id) ?? 0) > PUBLIC_GROUP_REANCHOR_RETRY_S
      && !(current.pending ?? []).some((p) => p.kind === PUBLIC_GROUP_KIND.ADMIN) && !current.leftAt;
  }

  function ghostOf(entry, record) {
    if (!entry?.body) return null;
    let control = null;
    try { control = decodePublicGroupControl(fromBase64(entry.body)); } catch { return null; }
    const senderKey = publicGroupKeyFromHexSafe(entry.sender);
    if (!control || !senderKey) return null;
    const far = Number.MAX_SAFE_INTEGER;
    return {
      key: publicGroupStreamKey(entry.streamId, entry.sender), senderKey, senderWallet: record.selfWallet ?? null,
      createdAt: Number(entry.at ?? 0), coords: { era: far, seq: far, entryId: far, generation: 0, epochTag: '', partitionKey: '', shardKey: null },
      control, hidden: false,
    };
  }

  function snapshotFields(record, fields) {
    const out = {};
    for (const field of fields) out[field] = fieldValue(record, field);
    return out;
  }

  function fieldValue(record, field) {
    switch (field) {
      case 'name': return record.name ?? null;
      case 'avatar': return JSON.stringify(record.avatar ?? null);
      case 'admins': return (record.admins ?? []).map(hex).sort().join(',');
      case 'owner': return record.owner ? hex(record.owner) : null;
      case 'banned': return (record.banned ?? []).map(hex).sort().join(',');
      case 'muted': return (record.muted ?? []).map(hex).sort().join(',');
      case 'hidden': return Object.keys(record.hidden ?? {}).sort().join(',');
      case 'members': return (record.members ?? []).map((m) => hex(m.groupKey)).sort().join(',');
      case 'leftAt': case 'rejoinedFrom': return record.leftAt ?? null;
      default: return undefined;
    }
  }

  function revertPending(record, entry) {
    const revert = entry?.revert;
    if (!revert) return record;
    let next = record;
    const untouched = (field) => entry.applied === undefined || fieldValue(record, field) === entry.applied?.[field];
    if ('name' in revert && untouched('name')) next = { ...next, name: revert.name ?? null };
    if ('avatar' in revert && untouched('avatar')) next = { ...next, avatar: revert.avatar ?? null };
    if ('admins' in revert && untouched('admins')) next = { ...next, admins: (revert.admins ?? []).map((h) => publicGroupKeyFromHexSafe(h)).filter(Boolean) };
    if ('owner' in revert && revert.owner && untouched('owner')) next = { ...next, owner: publicGroupKeyFromHexSafe(revert.owner) ?? next.owner };
    if ('banned' in revert && untouched('banned')) next = { ...next, banned: (revert.banned ?? []).map((h) => publicGroupKeyFromHexSafe(h)).filter(Boolean) };
    if ('muted' in revert && untouched('muted')) next = { ...next, muted: (revert.muted ?? []).map((h) => publicGroupKeyFromHexSafe(h)).filter(Boolean) };
    if ('hidden' in revert && untouched('hidden')) next = { ...next, hidden: publicGroupHiddenIn(revert.hidden) };
    if ('members' in revert && untouched('members')) next = { ...next, members: next.members.filter((m) => !(revert.members ?? []).includes(hex(m.groupKey))) };
    if (revert.leftAt === true && untouched('leftAt')) next = { ...next, leftAt: null };
    if ('rejoinedFrom' in revert && revert.rejoinedFrom && untouched('rejoinedFrom')) next = { ...next, leftAt: revert.rejoinedFrom };
    return next;
  }

  const PRICED_OPERATIONS = new Set(['join', 'leave', 'say', 'setName', 'setAvatar', 'setAdmins', 'transferOwnership', 'ban', 'mute', 'hide']);
  for (const name of ['join', 'adopt', 'leave', 'rereadChat', 'say', 'setName', 'setAvatar', 'setAdmins', 'transferOwnership', 'ban', 'mute', 'hide']) {
    const inner = api[name];
    if (typeof inner !== 'function') continue;
    const lockKey = (groupId) => (groupId instanceof Uint8Array ? hex(groupId) : String(groupId));
    if (!PRICED_OPERATIONS.has(name)) { api[name] = (groupId, ...rest) => locked(lockKey(groupId), () => inner.call(api, groupId, ...rest)); continue; }
    api[name] = (groupId, ...rest) => {
      const asked = Number(now());
      return locked(lockKey(groupId), async () => {
        const key = askedKey(groupId);
        askedAt.set(key, asked);
        try { return await inner.call(api, groupId, ...rest); } finally { askedAt.delete(key); }
      });
    };
  }
  return api;
}

function publicGroupKeyFromHexSafe(text) {
  try {
    if (typeof text !== 'string' || text.length !== 64) return null;
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
    return out;
  } catch { return null; }
}

export { publicGroupKeyHex };
