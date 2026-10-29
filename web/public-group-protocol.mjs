
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const PUBLIC_GROUP_KEY_BYTES = 32;
export const PUBLIC_GROUP_ID_BYTES = 32;

export const PUBLIC_GROUP_KIND = Object.freeze({
  FOUND: 1,
  JOIN: 2,
  LEAVE: 3,
  ADMIN: 4,
  PROFILE: 5,
  BAN: 6,
  MUTE: 7,
  HIDE: 8,
});
const KIND_VALUES = new Set(Object.values(PUBLIC_GROUP_KIND));

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (text) => {
  if (typeof text !== 'string' || text.length !== PUBLIC_GROUP_KEY_BYTES * 2 || /[^0-9a-f]/i.test(text)) throw new TypeError('bad key hex');
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const sameKey = (a, b) => a instanceof Uint8Array && b instanceof Uint8Array && hex(a) === hex(b);

export function isValidPublicGroupKey(bytes) {
  return bytes instanceof Uint8Array && bytes.length === PUBLIC_GROUP_KEY_BYTES;
}

export function publicGroupKeyHex(bytes) {
  if (!isValidPublicGroupKey(bytes)) throw new TypeError('a public group key is 32 bytes');
  return hex(bytes);
}

export function publicGroupKeyFromHex(text) {
  return unhex(text);
}

function assertText(name, value, max) {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  if (encoder.encode(value).length > max) throw new RangeError(`${name} is longer than ${max} bytes`);
  return value;
}

export const PUBLIC_GROUP_NAME_MAX_BYTES = 96;
export const PUBLIC_GROUP_EXCERPT_MAX = 80;
const ROW_KEY_RE = /^stream:[0-9a-f]{64}:[0-9a-f]{32}$/;

export function isPublicGroupRowKey(value) {
  return typeof value === 'string' && ROW_KEY_RE.test(value);
}

export function publicGroupExcerptIn(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  let out = '';
  let count = 0;
  for (const ch of text) { if (count >= PUBLIC_GROUP_EXCERPT_MAX) break; out += ch; count += 1; }
  return out;
}

function avatarPointerOut(avatar) {
  if (avatar === null || avatar === undefined) return null;
  const hash = String(avatar.hash ?? '');
  if (!/^[0-9a-f]{64}$/i.test(hash)) throw new TypeError('an avatar pointer names a sha-256 hex');
  return { hash: hash.toLowerCase(), width: Number(avatar.width ?? 0) >>> 0, height: Number(avatar.height ?? 0) >>> 0 };
}

const BIDI_CONTROLS_RE = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
function nameIn(value) {
  let out = '';
  let bytes = 0;
  for (const ch of String(value ?? '').replace(BIDI_CONTROLS_RE, '')) {
    const cp = ch.codePointAt(0);
    const n = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    if (bytes + n > PUBLIC_GROUP_NAME_MAX_BYTES) break;
    out += ch;
    bytes += n;
  }
  return out;
}

function avatarPointerIn(value) {
  if (value === null || value === undefined) return null;
  const hash = String(value?.hash ?? '');
  if (!/^[0-9a-f]{64}$/i.test(hash)) return null;
  return { hash: hash.toLowerCase(), width: Number(value.width ?? 0) >>> 0, height: Number(value.height ?? 0) >>> 0 };
}


export function encodePublicGroupControl(kind, payload) {
  const k = Number(kind);
  if (!KIND_VALUES.has(k)) throw new RangeError(`unknown public group kind ${kind}`);
  const sentAt = Number(payload?.sentAt);
  if (!Number.isInteger(sentAt) || sentAt < 0) throw new RangeError('a control row carries its sentAt');
  let body;
  switch (k) {
    case PUBLIC_GROUP_KIND.FOUND:
      body = { v: 1, name: assertText('name', String(payload.name ?? ''), PUBLIC_GROUP_NAME_MAX_BYTES), sentAt };
      break;
    case PUBLIC_GROUP_KIND.JOIN:
      body = { v: 1, ...(payload.name ? { name: assertText('name', String(payload.name), PUBLIC_GROUP_NAME_MAX_BYTES) } : {}), sentAt };
      break;
    case PUBLIC_GROUP_KIND.LEAVE:
      body = { v: 1, sentAt };
      break;
    case PUBLIC_GROUP_KIND.ADMIN: {
      const admins = (payload.admins ?? []).map((a) => publicGroupKeyHex(a));
      if (admins.length === 0) throw new RangeError('a group keeps at least one admin');
      body = { v: 1, admins, ...(payload.owner ? { owner: publicGroupKeyHex(payload.owner) } : {}), sentAt };
      break;
    }
    case PUBLIC_GROUP_KIND.PROFILE:
      body = {
        v: 1,
        ...(payload.name !== undefined ? { name: assertText('name', String(payload.name ?? ''), PUBLIC_GROUP_NAME_MAX_BYTES) } : {}),
        ...(payload.avatar !== undefined ? { avatar: avatarPointerOut(payload.avatar) } : {}),
        sentAt,
      };
      break;
    case PUBLIC_GROUP_KIND.MUTE:
      body = { v: 1, groupKey: publicGroupKeyHex(payload.groupKey), ...(payload.lift === true ? { lift: true } : {}), sentAt };
      break;
    case PUBLIC_GROUP_KIND.HIDE: {
      if (!isPublicGroupRowKey(payload.key)) throw new RangeError('a hidden row is named by its key');
      body = { v: 1, key: payload.key, ...(payload.lift === true ? { lift: true } : { excerpt: publicGroupExcerptIn(payload.excerpt) }), sentAt };
      break;
    }
    case PUBLIC_GROUP_KIND.BAN:
      body = { v: 1, groupKey: publicGroupKeyHex(payload.groupKey), ...(payload.lift === true ? { lift: true } : {}), sentAt };
      break;
    default:
      throw new RangeError(`unknown public group kind ${kind}`);
  }
  const json = encoder.encode(JSON.stringify(body));
  const out = new Uint8Array(1 + json.length);
  out[0] = k;
  out.set(json, 1);
  return out;
}

export function decodePublicGroupControl(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 2) return null;
  const kind = bytes[0];
  if (!KIND_VALUES.has(kind)) return null;
  let value;
  try { value = JSON.parse(decoder.decode(bytes.subarray(1))); } catch { return null; }
  if (!value || Number(value.v) !== 1) return null;
  const sentAt = Number(value.sentAt ?? 0);
  try {
    switch (kind) {
      case PUBLIC_GROUP_KIND.FOUND:
        return { kind, name: nameIn(value.name ?? '') || null, sentAt };
      case PUBLIC_GROUP_KIND.JOIN:
        return { kind, name: value.name === undefined || value.name === null ? null : (nameIn(value.name) || null), sentAt };
      case PUBLIC_GROUP_KIND.LEAVE:
        return { kind, sentAt };
      case PUBLIC_GROUP_KIND.ADMIN:
        return { kind, admins: (Array.isArray(value.admins) ? value.admins : []).slice(0, PUBLIC_GROUP_MEMBERS_MAX).map(unhex), owner: value.owner ? unhex(value.owner) : null, sentAt };
      case PUBLIC_GROUP_KIND.PROFILE:
        return {
          kind,
          ...('name' in value ? { name: value.name === null ? null : (nameIn(value.name) || null) } : {}),
          ...('avatar' in value ? { avatar: avatarPointerIn(value.avatar) } : {}),
          sentAt,
        };
      case PUBLIC_GROUP_KIND.BAN:
        return { kind, groupKey: unhex(value.groupKey), lift: value.lift === true, sentAt };
      case PUBLIC_GROUP_KIND.MUTE:
        return { kind, groupKey: unhex(value.groupKey), lift: value.lift === true, sentAt };
      case PUBLIC_GROUP_KIND.HIDE:
        if (!isPublicGroupRowKey(value.key)) return null;
        return { kind, key: value.key, lift: value.lift === true, excerpt: publicGroupExcerptIn(value.excerpt), sentAt };
      default:
        return null;
    }
  } catch {
    return null;
  }
}


export function createPublicGroupRecord({ groupId, self, selfWallet = null, name = null, founder, owner = null, foundedEra = null, foundedAt = 0, openedAt = 0 }) {
  if (!(groupId instanceof Uint8Array) || groupId.length !== PUBLIC_GROUP_ID_BYTES) throw new TypeError('a public group id is 32 bytes');
  if (self !== null && !isValidPublicGroupKey(self)) throw new TypeError('self must be a wallet hash');
  if (!isValidPublicGroupKey(founder)) throw new TypeError('a public group names its founder');
  const era = foundedEra === null || foundedEra === undefined ? null : Number(foundedEra);
  if (era !== null && (!Number.isInteger(era) || era < 0)) throw new RangeError('foundedEra must be a thread era');
  const first = founder;
  void owner;
  return {
    kind: 'public',
    groupId,
    name,
    avatar: null,
    self,
    selfWallet,
    founder,
    owner: first,
    admins: [first],
    members: [{ groupKey: first, wallet: sameKey(first, self) ? selfWallet : null, name: null }],
    banned: [],
    muted: [],
    hidden: {},
    foundedEra: era,
    foundedAt: Number(foundedAt) || 0,
    known: {},
    ownerRowAt: 0,
    membersCapped: false,
    leftAt: null,
    openedAt: Number(openedAt) || 0,
    pending: [],
  };
}

export const PUBLIC_GROUP_MEMBERS_MAX = 4096;
export const PUBLIC_GROUP_KNOWN_MAX = 8192;
export const PUBLIC_GROUP_HIDDEN_MAX = 512;

export function publicGroupOwnerKey(record) {
  return record?.owner ?? null;
}

export function isPublicGroupOwner(record, key) {
  return Boolean(record?.owner && key && sameKey(record.owner, key));
}

export function isPublicGroupAdmin(record, key) {
  return Boolean(key) && (record?.admins ?? []).some((a) => sameKey(a, key));
}

export function isPublicGroupBanned(record, key) {
  return Boolean(key) && (record?.banned ?? []).some((b) => sameKey(b, key));
}

export function isPublicGroupMuted(record, key) {
  return Boolean(key) && (record?.muted ?? []).some((m) => sameKey(m, key));
}

export function publicGroupHiddenIn(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [key, entry] of Object.entries(value)) {
    if (!isPublicGroupRowKey(key)) continue;
    out[key] = { at: Number(entry?.at ?? 0) || 0, excerpt: publicGroupExcerptIn(entry?.excerpt ?? '') };
  }
  return out;
}

export function publicGroupMember(record, key) {
  return (record?.members ?? []).find((m) => sameKey(m.groupKey, key)) ?? null;
}

export function publicControlOrder(row) {
  return [
    Number(row.createdAt ?? 0),
    Number(row.coords?.era ?? 0),
    Number(row.coords?.seq ?? 0),
    Number(row.coords?.entryId ?? 0),
  ];
}

function seatBefore(x, y) {
  for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return x[i] < y[i];
  return false;
}

function seatCompare(x, y) {
  for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

function beforeOther(a, b) {
  return seatBefore(publicControlOrder(a), publicControlOrder(b));
}

export function applyPublicGroupRows(record, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { record, messages: [], changed: false, bannedNow: [], liftedNow: [] };
  const founderHex = record?.founder ? hex(record.founder) : null;
  const selfHex = record?.self ? hex(record.self) : null;
  let ownerHex = record?.owner ? hex(record.owner) : null;
  const admins = new Set((record?.admins ?? []).map(hex));
  const members = new Map((record?.members ?? []).map((m) => [hex(m.groupKey), m]));
  const banned = new Set((record?.banned ?? []).map(hex));
  const muted = new Set((record?.muted ?? []).map(hex));
  const hidden = { ...(record?.hidden ?? {}) };
  const known = { ...(record?.known ?? {}) };
  let knownCount = Object.keys(known).length;
  let membersCapped = record?.membersCapped === true;
  let name = record?.name ?? null;
  let avatar = record?.avatar ?? null;
  let foundedEra = record?.foundedEra ?? null;
  let foundedAt = Number(record?.foundedAt ?? 0);
  let leftAt = record?.leftAt ?? null;
  let ownerRowAt = Number(record?.ownerRowAt ?? 0);
  const adminSince = new Map(Object.entries(record?.adminSince ?? {}).filter(([, since]) => Array.isArray(since)));
  let ownerSince = Array.isArray(record?.ownerSince) ? record.ownerSince : null;
  const inTenure = (since, at) => !since || !seatBefore(at, since);
  let changed = false;
  const bannedBefore = new Set(banned);
  const note = (row) => {
    const key = hex(row.senderKey);
    const held = known[key];
    const wallet = held?.wallet ?? row.senderWallet ?? null;
    const label = row.control?.kind === PUBLIC_GROUP_KIND.JOIN ? (row.control.name ?? held?.name ?? null) : (held?.name ?? null);
    if (held && held.wallet === wallet && held.name === label) return;
    if (!held) {
      if (knownCount >= PUBLIC_GROUP_KNOWN_MAX) { for (const oldest in known) { delete known[oldest]; break; } } else knownCount += 1;
    }
    known[key] = { wallet, name: label };
    changed = true;
  };
  const seat = (row, label = null) => {
    const key = hex(row.senderKey);
    const held = members.get(key);
    if (held) {
      const wallet = held.wallet ?? row.senderWallet ?? null;
      const next = label ?? held.name ?? null;
      if (wallet !== held.wallet || next !== held.name) { members.set(key, { ...held, wallet, name: next }); changed = true; }
      return true;
    }
    if (members.size >= PUBLIC_GROUP_MEMBERS_MAX) { if (!membersCapped) { membersCapped = true; changed = true; } return false; }
    members.set(key, { groupKey: row.senderKey, wallet: row.senderWallet ?? null, name: label });
    changed = true;
    return true;
  };
  const unseat = (key) => {
    if (members.delete(key)) changed = true;
    if (admins.delete(key)) { adminSince.delete(key); changed = true; }
  };
  const control = [];
  const texts = [];
  for (const row of rows ?? []) {
    if (!isValidPublicGroupKey(row?.senderKey)) continue;
    if (row.control) control.push(row);
    else if (typeof row.text === 'string') texts.push(row);
  }
  control.sort((a, b) => (beforeOther(a, b) ? -1 : beforeOther(b, a) ? 1 : 0));
  for (const row of control) {
    const c = row.control;
    const senderHex = hex(row.senderKey);
    const at = publicControlOrder(row);
    const fromAdmin = admins.has(senderHex) && inTenure(adminSince.get(senderHex), at);
    const fromOwner = ownerHex !== null && senderHex === ownerHex && inTenure(ownerSince, at);
    note(row);
    switch (c.kind) {
      case PUBLIC_GROUP_KIND.FOUND: {
        if (senderHex !== founderHex) break;
        const era = Number(row.coords?.era);
        if (c.name && (name === null || !foundedAt) && c.name !== name) { name = c.name; changed = true; }
        if (Number.isInteger(era) && era >= 0 && (foundedEra === null || era < foundedEra)) { foundedEra = era; changed = true; }
        if (!foundedAt) { foundedAt = Number(row.createdAt ?? c.sentAt ?? 0) || 1; changed = true; }
        seat(row);
        break;
      }
      case PUBLIC_GROUP_KIND.JOIN: {
        if (banned.has(senderHex)) break;
        seat(row, c.name ?? null);
        if (senderHex === selfHex && leftAt !== null) { leftAt = null; changed = true; }
        break;
      }
      case PUBLIC_GROUP_KIND.LEAVE: {
        if (fromOwner) break;
        unseat(senderHex);
        if (senderHex === selfHex) { const at = Number(row.createdAt ?? c.sentAt ?? 0); if (leftAt !== at) { leftAt = at; changed = true; } }
        break;
      }
      case PUBLIC_GROUP_KIND.ADMIN: {
        if (!fromOwner && senderHex !== founderHex) break;
        const set = c.admins.filter(isValidPublicGroupKey).map(hex);
        if (set.length === 0) break;
        const handover = c.owner && isValidPublicGroupKey(c.owner) ? hex(c.owner) : null;
        const restatement = !fromOwner && senderHex === founderHex && handover !== null && handover === ownerHex
          && set.length === admins.size && set.every((k) => admins.has(k));
        if (!fromOwner && !restatement) break;
        const nextOwner = handover && set.includes(handover) ? handover : ownerHex;
        if (!set.includes(nextOwner)) break;
        if (banned.has(nextOwner)) break;
        const same = set.length === admins.size && set.every((k) => admins.has(k));
        for (const k of set) {
          if (!admins.has(k)) { adminSince.set(k, at); changed = true; continue; }
          const held = adminSince.get(k);
          if (held && seatBefore(at, held)) { adminSince.set(k, at); changed = true; }
        }
        for (const k of [...adminSince.keys()]) if (!set.includes(k)) adminSince.delete(k);
        if (!same) { admins.clear(); for (const k of set) admins.add(k); changed = true; }
        if (nextOwner !== ownerHex) { ownerHex = nextOwner; ownerSince = at; changed = true; } else if (ownerSince && seatBefore(at, ownerSince)) { ownerSince = at; changed = true; }
        const stamped = Number(row.createdAt ?? 0);
        if (stamped > ownerRowAt) { ownerRowAt = stamped; changed = true; }
        break;
      }
      case PUBLIC_GROUP_KIND.PROFILE:
        if (!fromAdmin) break;
        if ('name' in c && (c.name ?? name) !== name) { name = c.name ?? name; changed = true; }
        if ('avatar' in c && JSON.stringify(c.avatar ?? null) !== JSON.stringify(avatar ?? null)) { avatar = c.avatar ?? null; changed = true; }
        break;
      case PUBLIC_GROUP_KIND.BAN: {
        if (!fromAdmin) break;
        const target = c.groupKey;
        if (!isValidPublicGroupKey(target)) break;
        const targetHex = hex(target);
        if (c.lift) {
          if (banned.delete(targetHex)) changed = true;
          break;
        }
        if (targetHex === ownerHex) break;
        if (admins.has(targetHex) && !fromOwner) break;
        if (!banned.has(targetHex)) {
          banned.add(targetHex); changed = true;
          if (banned.size > PUBLIC_GROUP_MEMBERS_MAX) banned.delete(banned.values().next().value);
        }
        unseat(targetHex);
        break;
      }
      case PUBLIC_GROUP_KIND.MUTE: {
        if (!fromAdmin) break;
        const target = c.groupKey;
        if (!isValidPublicGroupKey(target)) break;
        const targetHex = hex(target);
        if (c.lift) { if (muted.delete(targetHex)) changed = true; break; }
        if (targetHex === ownerHex) break;
        if (admins.has(targetHex) && !fromOwner) break;
        if (!muted.has(targetHex)) {
          muted.add(targetHex); changed = true;
          if (muted.size > PUBLIC_GROUP_MEMBERS_MAX) muted.delete(muted.values().next().value);
        }
        break;
      }
      case PUBLIC_GROUP_KIND.HIDE: {
        if (!fromAdmin || !isPublicGroupRowKey(c.key)) break;
        if (c.lift) { if (c.key in hidden) { delete hidden[c.key]; changed = true; } break; }
        if (c.key in hidden) break;
        const hiddenAt = Number(row.createdAt ?? c.sentAt ?? 0) || 0;
        const keys = Object.keys(hidden);
        if (keys.length >= PUBLIC_GROUP_HIDDEN_MAX) {
          const oldest = keys.sort((a, b) => Number(hidden[a].at) - Number(hidden[b].at))[0];
          if (Number(hidden[oldest].at) >= hiddenAt) break;
          delete hidden[oldest];
        }
        hidden[c.key] = { at: hiddenAt, excerpt: c.excerpt ?? '' };
        changed = true;
        break;
      }
      default:
        break;
    }
  }
  for (const row of texts) {
    note(row);
    if (banned.has(hex(row.senderKey))) continue;
    seat(row);
  }
  const messages = texts
    .map((row) => ({ ...row, hidden: row.hidden === true || banned.has(hex(row.senderKey)) || muted.has(hex(row.senderKey)) || Boolean(hidden[row.key]) }))
    .sort((a, b) => Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0) || seatCompare(publicControlOrder(a), publicControlOrder(b)));
  const bannedNow = [...banned].filter((k) => !bannedBefore.has(k));
  const liftedNow = [...bannedBefore].filter((k) => !banned.has(k));
  if (!changed) return { record, messages, changed: false, bannedNow, liftedNow };
  const owner = ownerHex ? publicGroupKeyFromHex(ownerHex) : null;
  const next = {
    ...record,
    name, avatar, owner, foundedEra, foundedAt, leftAt, known, membersCapped, ownerRowAt,
    adminSince: Object.fromEntries(adminSince), ownerSince,
    admins: [...admins].map(publicGroupKeyFromHex),
    members: [...members.values()],
    banned: [...banned].map(publicGroupKeyFromHex),
    muted: [...muted].map(publicGroupKeyFromHex),
    hidden,
  };
  return { record: next, messages, changed: true, bannedNow, liftedNow };
}


export function serializePublicGroupRecord(record) {
  return {
    v: 2,
    kind: 'public',
    groupId: hex(record.groupId),
    name: record.name ?? null,
    avatar: record.avatar ? { ...record.avatar } : null,
    self: record.self ? hex(record.self) : null,
    selfWallet: record.selfWallet ?? null,
    owner: record.owner ? hex(record.owner) : null,
    admins: (record.admins ?? []).map(hex),
    members: (record.members ?? []).map((m) => ({ groupKey: hex(m.groupKey), wallet: m.wallet ?? null, name: m.name ?? null })),
    banned: (record.banned ?? []).map(hex),
    muted: (record.muted ?? []).map(hex),
    hidden: publicGroupHiddenIn(record.hidden),
    founder: record.founder ? hex(record.founder) : null,
    foundedEra: record.foundedEra === null || record.foundedEra === undefined ? null : Number(record.foundedEra),
    foundedAt: Number(record.foundedAt ?? 0),
    leftAt: record.leftAt ?? null,
    openedAt: Number(record.openedAt ?? 0),
    pending: (record.pending ?? []).map((p) => ({ ...p })),
    known: Object.fromEntries(Object.entries(record.known ?? {}).map(([k, v]) => [k, { wallet: v?.wallet ?? null, name: v?.name ?? null }])),
    membersCapped: record.membersCapped === true,
    ownerRowAt: Number(record.ownerRowAt ?? 0),
    adminSince: publicTenuresIn(record.adminSince),
    ownerSince: publicTenureIn(record.ownerSince),
    read: serializeRead(record.read),
    buffer: (record.buffer ?? []).map((p) => ({ ...p })),
    parts: Object.fromEntries(Object.entries(record.parts ?? {}).map(([k, v]) => [k, { ...v }])),
  };
}

function publicTenureIn(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const out = value.map(Number);
  return out.every((n) => Number.isFinite(n) && n >= 0) ? out : null;
}

function publicTenuresIn(value) {
  const out = {};
  for (const [key, since] of Object.entries(value && typeof value === 'object' ? value : {})) {
    const tenure = publicTenureIn(since);
    if (/^[0-9a-f]{64}$/.test(key) && tenure) out[key] = tenure;
  }
  return out;
}

function serializeRead(read) {
  const out = {};
  for (const lane of ['control', 'chat']) {
    out[lane] = {};
    for (const [shardKey, marks] of Object.entries(read?.[lane] ?? {})) {
      const list = Array.isArray(marks) ? marks : (marks ? [marks] : []);
      out[lane][shardKey] = list
        .map((mark) => ({ bottom: Number(mark?.bottom ?? 0), top: Number(mark?.top ?? 0), oldestLt: mark?.oldestLt == null ? null : String(mark.oldestLt) }))
        .filter((mark) => mark.top > mark.bottom)
        .slice(0, 8);
    }
  }
  return out;
}

export function parsePublicGroupRecord(stored) {
  if (Number(stored?.v) !== 2 || stored?.kind !== 'public') throw new RangeError(`not a public group record (v${stored?.v}, ${stored?.kind})`);
  const id = String(stored.groupId ?? '');
  if (id.length !== PUBLIC_GROUP_ID_BYTES * 2) throw new RangeError('bad public group id');
  return {
    kind: 'public',
    groupId: unhex(id),
    name: stored.name ?? null,
    avatar: stored.avatar ? { ...stored.avatar } : null,
    self: stored.self ? unhex(stored.self) : null,
    selfWallet: stored.selfWallet ?? null,
    owner: stored.owner ? unhex(stored.owner) : null,
    admins: (stored.admins ?? []).map(unhex),
    members: (stored.members ?? []).map((m) => ({ groupKey: unhex(m.groupKey), wallet: m.wallet ?? null, name: m.name ?? null })),
    banned: (stored.banned ?? []).map(unhex),
    muted: (stored.muted ?? []).filter((k) => /^[0-9a-f]{64}$/i.test(String(k))).map(unhex),
    hidden: publicGroupHiddenIn(stored.hidden),
    founder: stored.founder ? unhex(stored.founder) : (stored.owner && stored.self === stored.owner ? unhex(stored.owner) : null),
    foundedEra: stored.foundedEra === null || stored.foundedEra === undefined ? null : Number(stored.foundedEra),
    foundedAt: Number(stored.foundedAt ?? 0),
    leftAt: stored.leftAt ?? null,
    openedAt: Number(stored.openedAt ?? 0),
    pending: (stored.pending ?? []).map((p) => ({ ...p })),
    known: Object.fromEntries(Object.entries(stored.known ?? {}).filter(([k]) => /^[0-9a-f]{64}$/.test(k)).map(([k, v]) => [k, { wallet: v?.wallet ?? null, name: v?.name ?? null }])),
    membersCapped: stored.membersCapped === true,
    ownerRowAt: Number(stored.ownerRowAt ?? 0),
    adminSince: publicTenuresIn(stored.adminSince),
    ownerSince: publicTenureIn(stored.ownerSince),
    read: serializeRead(stored.read),
    buffer: Array.isArray(stored.buffer) ? stored.buffer.map((p) => ({ ...p })) : [],
    parts: Object.fromEntries(Object.entries(stored.parts ?? {}).map(([k, v]) => [k, { ...v }])),
  };
}


export const PUBLIC_GROUP_JOIN_VERSION = 2;

function u32be(n) {
  const v = Number(n) >>> 0;
  return new Uint8Array([(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]);
}

function base64urlEncode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(text) {
  if (typeof text !== 'string' || /[^A-Za-z0-9_-]/.test(text)) throw new TypeError('bad pointer');
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}

export function encodePublicGroupJoinToken({ groupId, founder, owner = null, foundedEra = null, name = null }) {
  if (!(groupId instanceof Uint8Array) || groupId.length !== PUBLIC_GROUP_ID_BYTES) throw new TypeError('a public group id is 32 bytes');
  if (!isValidPublicGroupKey(founder)) throw new TypeError('a pointer names the founder');
  let text = String(name ?? '').slice(0, 64);
  while (encoder.encode(text).length > 96) text = text.slice(0, -1);
  const nameBytes = encoder.encode(text);
  const out = new Uint8Array(1 + PUBLIC_GROUP_ID_BYTES + 64 + 4 + 1 + nameBytes.length);
  out[0] = PUBLIC_GROUP_JOIN_VERSION;
  out.set(groupId, 1);
  out.set(founder, 1 + PUBLIC_GROUP_ID_BYTES);
  if (owner && isValidPublicGroupKey(owner)) out.set(owner, 1 + PUBLIC_GROUP_ID_BYTES + 32);
  out.set(u32be(foundedEra === null || foundedEra === undefined ? 0 : foundedEra), 1 + PUBLIC_GROUP_ID_BYTES + 64);
  out[1 + PUBLIC_GROUP_ID_BYTES + 68] = nameBytes.length;
  out.set(nameBytes, 1 + PUBLIC_GROUP_ID_BYTES + 69);
  return base64urlEncode(out);
}

export const PUBLIC_GROUP_JOIN_LINK_PATH = 'join';
export function publicGroupJoinLink(origin, token) {
  return `${String(origin ?? '').replace(/\/+$/, '')}/${PUBLIC_GROUP_JOIN_LINK_PATH}/${String(token ?? '')}`;
}

export function parsePublicGroupJoinLink(url) {
  const text = String(url ?? '');
  const path = text.includes('://') ? text.slice(text.indexOf('://') + 3).replace(/^[^/]*/, '') : text;
  const match = new RegExp(`^/${PUBLIC_GROUP_JOIN_LINK_PATH}/([A-Za-z0-9_-]{8,4096})/?$`).exec(path.split('?')[0].split('#')[0]);
  if (!match) return null;
  return parsePublicGroupJoinToken(match[1]);
}

export function parsePublicGroupJoinToken(text) {
  let bytes;
  try { bytes = base64urlDecode(String(text ?? '')); } catch { return null; }
  if (bytes.length < 1 + PUBLIC_GROUP_ID_BYTES + 69 || bytes[0] !== PUBLIC_GROUP_JOIN_VERSION) return null;
  const groupId = bytes.slice(1, 1 + PUBLIC_GROUP_ID_BYTES);
  const founder = bytes.slice(1 + PUBLIC_GROUP_ID_BYTES, 1 + PUBLIC_GROUP_ID_BYTES + 32);
  if (founder.every((b) => b === 0)) return null;
  const ownerBytes = bytes.slice(1 + PUBLIC_GROUP_ID_BYTES + 32, 1 + PUBLIC_GROUP_ID_BYTES + 64);
  const owner = ownerBytes.every((b) => b === 0) ? null : ownerBytes;
  const at = 1 + PUBLIC_GROUP_ID_BYTES + 64;
  const era = ((bytes[at] << 24) >>> 0) + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3];
  const nameLen = bytes[at + 4];
  if (bytes.length !== at + 5 + nameLen) return null;
  const name = nameLen > 0 ? (nameIn(decoder.decode(bytes.subarray(at + 5, at + 5 + nameLen))) || null) : null;
  return { public: true, groupId, founder, owner, foundedEra: era > 0 ? era : null, name };
}
