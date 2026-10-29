
import { GROUP_KIND, groupEntryFeeIn, groupHiddenIn, groupNameIn, groupRemovalsIn, isGroupRowKey, isValidMemberKeys } from './group-protocol.mjs?v=31';
import { advanceGroupEpoch, groupEpochFromSeconds, isValidGroupKey, GROUP_MAX_RATCHET_STEPS } from './crypto/group-lane.mjs?v=8';
import { CUTOVER_EPOCH } from './cutover-epoch.mjs?v=7';

export const GROUP_RECORD_SHARD_GENERATION = 18;
function unstampedPastBoundary(stored) {
  return !(Number(stored?.sg) >= GROUP_RECORD_SHARD_GENERATION) && Number.isFinite(CUTOVER_EPOCH) && CUTOVER_EPOCH > 0;
}

export const GROUP_CONTROL_LOG_MAX = 512;
export const GROUP_CONTROL_LOG_MAX_MEMBERS = 2048;
export const GROUP_PENDING_INVITES_MAX = 256;
export const GROUP_CONTROL_ABANDON_S = 7 * 86_400;
export const GROUP_CONTROL_CONFIRM_S = 600;

export const GROUP_WINDOW_DAYS = 3;
export const GROUP_SIZE_GROUP = 50;

const HEX_TABLE = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
const hex = (bytes) => { let out = ''; for (let i = 0; i < bytes.length; i += 1) out += HEX_TABLE[bytes[i]]; return out; };
const unhex = (text) => {
  if (typeof text !== 'string' || text.length % 2 !== 0 || /[^0-9a-f]/i.test(text)) throw new TypeError('bad hex');
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const sameKey = (a, b) => {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
};
const validKeyHex = new Set();
const invalidKeyHex = new Set();
const isValidKeyCached = (key) => {
  if (!(key instanceof Uint8Array) || key.length !== 32) return false;
  const id = hex(key);
  if (validKeyHex.has(id)) return true;
  if (invalidKeyHex.has(id)) return false;
  if (!isValidGroupKey(key)) {
    if (invalidKeyHex.size >= 4096) invalidKeyHex.clear();
    invalidKeyHex.add(id);
    return false;
  }
  if (validKeyHex.size >= 16384) validKeyHex.clear();
  validKeyHex.add(id);
  return true;
};

export function createGroupRecord({ founding, name = null, self, members = [], admins = [], owner = null, openedAt = 0 }) {
  if (!(founding?.groupId instanceof Uint8Array) || !(founding?.key instanceof Uint8Array)) {
    throw new TypeError('createGroupRecord needs a founding state from createGroupFounding');
  }
  return {
    groupId: founding.groupId,
    name,
    avatar: null,
    self: self ?? null,
    admins: admins.map((a) => a),
    owner: owner ?? null,
    members: members.map((m) => ({ ...m })),
    epochs: [{ epoch: founding.epoch, generation: founding.generation, key: founding.key }],
    rosterKeys: founding.rosterKey ? { [String(founding.generation)]: founding.rosterKey } : {},
    snapshot: null,
    snapshotApplied: true,
    admitsSinceSnapshot: 0,
    rosterCursor: founding.epoch,
    seqHighWater: {},
    seenSeq: {},
    pendingInvites: [],
    candidates: [],
    leftAt: null,
    openedAt: Number(openedAt) || 0,
    controlLog: [],
    pendingControl: [],
    rosterSeen: {},
    lastControlFailure: null,
    muted: [],
    hidden: {},
    entryFee: null,
    removals: {},
    accessOwed: [],
  };
}

export const GROUP_ACCESS_OWED_MAX = 256;
const ACCESS_TEXT_MAX = 256;
const accessText = (value) => (typeof value === 'string' && value.length > 0 ? value.slice(0, ACCESS_TEXT_MAX) : null);
const dayOrNull = (value) => (value === null || value === undefined || value === '' || !Number.isSafeInteger(Number(value)) || Number(value) < 0 ? null : Number(value));

export function groupAccessOwedIn(list) {
  const out = [];
  for (const entry of Array.isArray(list) ? list : []) {
    const key = String(entry?.groupKey ?? '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(key) || out.some((held) => held.groupKey === key)) continue;
    out.push({
      groupKey: key, wallet: accessText(entry.wallet), keyId: accessText(entry.keyId), name: accessText(entry.name), at: Number(entry.at) || 0,
      ...(dayOrNull(entry.since) !== null ? { since: dayOrNull(entry.since) } : {}),
    });
  }
  return out.slice(-GROUP_ACCESS_OWED_MAX);
}

export function noteGroupAccessOwed(record, members, at = 0) {
  const held = groupAccessOwedIn(record.accessOwed);
  const add = [];
  for (const member of members ?? []) {
    if (!(member?.groupKey instanceof Uint8Array)) continue;
    const key = hex(member.groupKey);
    if (held.some((o) => o.groupKey === key) || add.some((o) => o.groupKey === key)) continue;
    add.push({
      groupKey: key, wallet: member.wallet ?? null, keyId: member.keyId ?? null, name: member.name ?? null, at: Number(at) || 0,
      ...(dayOrNull(member.since) !== null ? { since: dayOrNull(member.since) } : {}),
    });
  }
  if (add.length === 0) return record;
  return { ...record, accessOwed: groupAccessOwedIn([...held, ...add]) };
}

export function clearGroupAccessOwed(record, groupKey) {
  const key = groupKey instanceof Uint8Array ? hex(groupKey) : String(groupKey ?? '').toLowerCase();
  const held = record.accessOwed ?? [];
  if (!held.some((o) => o.groupKey === key)) return record;
  return { ...record, accessOwed: held.filter((o) => o.groupKey !== key) };
}

export const GROUP_HIDDEN_MAX = 512;
export const GROUP_REMOVALS_MAX = 512;
export const GROUP_MUTED_MAX = 1024;

export function groupMutedIn(list, { owner = null, admins = [], fromOwner = false } = {}) {
  const out = [];
  const seen = new Set();
  for (const key of Array.isArray(list) ? list : []) {
    if (!isValidKeyCached(key)) continue;
    const id = hex(key);
    if (seen.has(id)) continue;
    if (owner && sameKey(owner, key)) continue;
    if (!fromOwner && admins.some((a) => sameKey(a, key))) continue;
    seen.add(id);
    out.push(key);
    if (out.length >= GROUP_MUTED_MAX) break;
  }
  return out;
}

export function noteGroupRemoval(removals, groupKeyHex, at, { replace = false } = {}) {
  const when = Math.floor(Number(at) || 0);
  const key = String(groupKeyHex ?? '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(key) || when <= 0) return removals ?? {};
  if (!replace && Number(removals?.[key] ?? 0) >= when) return removals ?? {};
  if (Number(removals?.[key] ?? 0) === when) return removals ?? {};
  const next = { ...(removals ?? {}), [key]: when };
  const keys = Object.keys(next);
  if (keys.length > GROUP_REMOVALS_MAX) delete next[keys.sort((a, b) => Number(next[a]) - Number(next[b]))[0]];
  return next;
}

export function mergeGroupRemovals(held, incoming) {
  let next = held ?? {};
  for (const [key, at] of Object.entries(groupRemovalsIn(incoming))) next = noteGroupRemoval(next, key, at);
  return next;
}

export function groupRemovalsForRoster(removals, max = 64) {
  const entries = Object.entries(groupRemovalsIn(removals)).sort((a, b) => Number(b[1]) - Number(a[1]));
  return Object.fromEntries(entries.slice(0, Math.max(0, max)));
}

export function groupRemovedAt(record, groupKey) {
  if (!(groupKey instanceof Uint8Array)) return 0;
  return Number(record?.removals?.[hex(groupKey)] ?? 0) || 0;
}

export function groupOwnerWallet(record) {
  const owner = groupOwnerKey(record);
  return owner ? (groupMember(record, owner)?.wallet ?? null) : null;
}

export function groupMessageKey(row) {
  return `${Number(row.epoch)}.${Number(row.generation ?? 0)}.${hex(row.senderGroupKey ?? new Uint8Array())}.${Number(row.seq ?? 0)}`;
}

export function isGroupMuted(record, groupKey) {
  return Boolean(groupKey) && (record?.muted ?? []).some((m) => sameKey(m, groupKey));
}

export function groupHiddenForRoster(hidden, max = 64) {
  const entries = Object.entries(groupHiddenIn(hidden)).sort((a, b) => Number(b[1].at) - Number(a[1].at));
  return Object.fromEntries(entries.slice(0, Math.max(0, max)));
}

export function currentGroupEpoch(record) {
  let best = null;
  for (const e of record.epochs ?? []) {
    if (!best || e.generation > best.generation || (e.generation === best.generation && e.epoch > best.epoch)) best = e;
  }
  return best;
}

function epochRoot(e) {
  return typeof e?.root === 'string' ? e.root : (e?.key instanceof Uint8Array ? hex(e.key) : '');
}

export function holdsGroupGeneration(record, generation, key) {
  const keyHex = key instanceof Uint8Array ? hex(key) : String(key ?? '').toLowerCase();
  if (!keyHex) return false;
  return (record?.epochs ?? []).some((e) => Number(e.generation) === Number(generation) && epochRoot(e) === keyHex);
}

export async function advanceGroupWindow(record, nowSec, { windowDays = GROUP_WINDOW_DAYS, keepUnread = GROUP_UNREAD_DAYS_KEPT } = {}) {
  const today = groupEpochFromSeconds(nowSec);
  const head = currentGroupEpoch(record);
  if (!head) return record;
  if (today < head.epoch) return record;
  const epochs = [...record.epochs];
  let state = { groupId: record.groupId, ...head };
  let steps = 0;
  const root = epochRoot(head);
  const inherited = {
    ...(Array.isArray(head.stamp) ? { stamp: head.stamp } : {}),
    ...(head.speculative === true ? { speculative: true } : {}),
  };
  while (state.epoch < today && steps < GROUP_MAX_RATCHET_STEPS * 4) {
    state = await advanceGroupEpoch(state);
    epochs.push({ epoch: state.epoch, generation: state.generation, key: state.key, root, ...inherited });
    steps += 1;
  }
  const floor = today - Math.max(0, Number(windowDays));
  const kept = epochs.filter((e) => e.epoch >= floor || e.read !== true);
  const unreadOld = kept.filter((e) => e.epoch < floor);
  const drop = Math.max(0, unreadOld.length - Math.max(0, Number(keepUnread)));
  const dropped = new Set(unreadOld.slice(0, drop));
  return { ...record, epochs: kept.filter((e) => !dropped.has(e)) };
}

export const GROUP_UNREAD_DAYS_KEPT = 30;
export const GROUP_UNREAD_DAYS_PER_PASS = 4;

export function groupEpochsToRead(record, nowSec, { windowDays = GROUP_WINDOW_DAYS, unreadPerPass = GROUP_UNREAD_DAYS_PER_PASS } = {}) {
  const today = groupEpochFromSeconds(nowSec);
  const floor = today - Math.max(0, Number(windowDays));
  const ceiling = today + 1;
  const inWindow = record.epochs.filter((e) => e.epoch >= floor && e.epoch <= ceiling);
  const missed = record.epochs.filter((e) => e.epoch < floor && e.read !== true).sort((a, b) => a.epoch - b.epoch);
  return [...missed.slice(0, Math.max(0, Number(unreadPerPass))), ...inWindow];
}

export function markGroupEpochsRead(record, epochs) {
  const done = new Set((epochs ?? []).map((e) => `${e.epoch}.${e.generation}`));
  if (done.size === 0) return record;
  return { ...record, epochs: record.epochs.map((e) => (done.has(`${e.epoch}.${e.generation}`) ? { ...e, read: true } : e)) };
}

export function noteGroupSeqFromRows(record, rows) {
  let next = record;
  for (const row of rows ?? []) {
    if (!sameKey(row.senderGroupKey, record.self)) continue;
    const seq = Number(row.seq) + Math.max(1, Number(row.parts ?? 1)) - 1;
    if (!Number.isFinite(seq)) continue;
    next = noteGroupSeq(next, { epoch: row.epoch, generation: row.generation, lane: row.roster ? 'roster' : 'daily', seq });
  }
  return next;
}

export function noteSeenSeqs(record, entries) {
  let next = null;
  for (const [address, seq] of entries ?? []) {
    const key = String(address).toLowerCase();
    const value = Number(seq);
    const held = Number((next ?? record.seenSeq ?? {})[key] ?? -1);
    if (!Number.isFinite(value) || value <= held) continue;
    if (!next) next = { ...(record.seenSeq ?? {}) };
    next[key] = value;
  }
  return next ? { ...record, seenSeq: next } : record;
}

export function pruneSeenSeq(record, keepAddresses) {
  const keep = new Set([...(keepAddresses ?? [])].map((a) => String(a).toLowerCase()));
  const held = record.seenSeq ?? {};
  const next = {};
  for (const [address, seq] of Object.entries(held)) if (keep.has(address)) next[address] = seq;
  return Object.keys(next).length === Object.keys(held).length ? record : { ...record, seenSeq: next };
}

export function noteSeenSeq(record, address, seq) {
  const key = String(address).toLowerCase();
  const held = Number(record.seenSeq?.[key] ?? -1);
  const value = Number(seq);
  if (!Number.isFinite(value) || value <= held) return record;
  return { ...record, seenSeq: { ...(record.seenSeq ?? {}), [key]: value } };
}

export function stampBefore(a, b) {
  if (!Array.isArray(a)) return false;
  if (!Array.isArray(b)) return true;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i]; const y = b[i];
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x < y;
    return String(x) < String(y);
  }
  return false;
}

export function adoptGroupGeneration(record, { epoch, generation, key, stamp = null, speculative = false }) {
  const held = record.epochs.filter((e) => e.generation === generation);
  const keyHex = key instanceof Uint8Array ? hex(key) : '';
  const same = held.find((e) => epochRoot(e) === keyHex);
  if (same) {
    if (same.speculative === true && !speculative) {
      return { ...record, epochs: record.epochs.map((e) => (e.generation === generation ? { ...e, speculative: false, stamp: e.stamp ?? stamp ?? null } : e)) };
    }
    return record;
  }
  const rival = held[0] ?? null;
  const entry = { epoch, generation, key, stamp: stamp ?? null, ...(speculative ? { speculative: true } : {}) };
  if (!rival) return { ...record, epochs: [...record.epochs, entry] };
  const rivalWins = speculative ? true : (rival.speculative === true ? false : !stampBefore(stamp, rival.stamp));
  if (rivalWins) return record;
  const epochs = record.epochs.filter((e) => e.generation !== generation);
  epochs.push(entry);
  epochs.sort((a, b) => (a.epoch - b.epoch) || (a.generation - b.generation));
  return {
    ...record,
    epochs,
    generationLost: [...(record.generationLost ?? []), { generation, key: rival.key }],
  };
}

export function groupMemberPublicKeys(record) {
  const keys = record.members.map((m) => m.groupKey);
  if (record.self && !keys.some((k) => sameKey(k, record.self))) keys.push(record.self);
  return keys;
}

export function groupRosterKeyFor(record, generation) {
  return record.rosterKeys?.[String(generation)] ?? null;
}

export function noteGroupRosterKey(record, generation, rosterKey) {
  if (!(rosterKey instanceof Uint8Array)) throw new TypeError('a roster key must be a Uint8Array');
  return { ...record, rosterKeys: { ...(record.rosterKeys ?? {}), [String(generation)]: rosterKey } };
}

export function groupOwnerKey(record) {
  if (record?.owner) return record.owner;
  const admins = record?.admins ?? [];
  return admins.length === 1 ? admins[0] : null;
}

export function isGroupOwner(record, groupKey) {
  const owner = groupOwnerKey(record);
  return Boolean(owner && groupKey && sameKey(owner, groupKey));
}

export function isGroupAdmin(record, groupKey) {
  return record.admins.some((a) => sameKey(a, groupKey));
}

export function groupMember(record, groupKey) {
  return record.members.find((m) => sameKey(m.groupKey, groupKey)) ?? null;
}

export function notePendingGroupInvite(record, { wallet = null, keyId = null, name = null, at = 0, generation = null, epoch = null }) {
  const already = (record.pendingInvites ?? []).some((invite) => (wallet && invite.wallet === wallet)
    || (keyId && invite.keyId === keyId));
  if (already) return record;
  const carried = {
    ...(dayOrNull(generation) !== null ? { generation: dayOrNull(generation) } : {}),
    ...(dayOrNull(epoch) !== null ? { epoch: dayOrNull(epoch) } : {}),
  };
  return { ...record, pendingInvites: [...(record.pendingInvites ?? []).slice(-(GROUP_PENDING_INVITES_MAX - 1)), { wallet, keyId, name, at: Number(at), ...carried }] };
}

export function pendingInviteBehind(invite, generation) {
  if (!invite) return null;
  if (dayOrNull(invite.generation) === Number(generation)) return null;
  return dayOrNull(invite.epoch) ?? groupEpochFromSeconds(Number(invite.at ?? 0));
}

export function groupAdminByWallet(record, wallet, same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase()) {
  if (typeof wallet !== 'string' || wallet.length === 0) return null;
  return (record?.members ?? []).find((m) => typeof m.wallet === 'string' && m.wallet.length > 0 && same(m.wallet, wallet)
    && isGroupAdmin(record, m.groupKey)) ?? null;
}

export function catchUpGroupGeneration(record, { generation, epoch, key, rosterKey, snapshot = null }) {
  const head = currentGroupEpoch(record);
  if (head && Number(generation) <= Number(head.generation)) return record;
  if (!(key instanceof Uint8Array) || !(rosterKey instanceof Uint8Array)) throw new TypeError('a generation is taken with its day key and its roster key');
  const pointer = snapshot && Number(snapshot.generation) === Number(generation) ? snapshot : null;
  const next = noteGroupRosterKey(adoptGroupGeneration(record, { epoch: Number(epoch), generation: Number(generation), key }), Number(generation), rosterKey);
  return {
    ...next,
    snapshot: pointer,
    snapshotApplied: !pointer,
    admitsSinceSnapshot: 0,
    rosterCursor: pointer ? Number(pointer.epoch) : Number(epoch),
  };
}

export function matchPendingGroupInvite(record, candidate) {
  return (record.pendingInvites ?? []).find((invite) => (invite.wallet && invite.wallet === candidate.wallet)
    || (invite.keyId && invite.keyId === candidate.keyId)) ?? null;
}

export function clearPendingGroupInvite(record, invite) {
  return { ...record, pendingInvites: (record.pendingInvites ?? []).filter((held) => held !== invite) };
}

export const GROUP_MAX_CANDIDATES = 512;

export function noteGroupCandidate(record, candidate, { at = 0 } = {}) {
  if (!(candidate?.groupKey instanceof Uint8Array)) throw new TypeError('a candidate needs a groupKey');
  if (groupMember(record, candidate.groupKey)) return record;
  if ((record.candidates ?? []).some((held) => sameKey(held.groupKey, candidate.groupKey))) return record;
  const held = (record.candidates ?? []).slice();
  while (held.length > GROUP_MAX_CANDIDATES - 1) {
    const waiting = held.findIndex((c) => c.declined !== true);
    held.splice(waiting === -1 ? 0 : waiting, 1);
  }
  return {
    ...record,
    candidates: [...held, {
      groupKey: candidate.groupKey,
      wallet: candidate.wallet ?? null,
      keyId: candidate.keyId ?? null,
      name: candidate.name ?? null,
      x25519PublicKey: candidate.x25519PublicKey ?? null,
      mlKem768PublicKey: candidate.mlKem768PublicKey ?? null,
      at: Number(at),
      paid: candidate.paid === true ? true : candidate.paid === false ? false : null,
    }],
  };
}

export function noteGroupCandidatePaid(record, groupKey, paid) {
  const value = paid === true ? true : paid === false ? false : null;
  const held = (record.candidates ?? []).find((c) => sameKey(c.groupKey, groupKey));
  if (!held || held.paid === value) return record;
  return { ...record, candidates: record.candidates.map((c) => (c === held ? { ...c, paid: value } : c)) };
}

export function serializeGroupCandidate(c) {
  return {
    groupKey: hex(c.groupKey), wallet: c.wallet ?? null, keyId: c.keyId ?? null, name: c.name ?? null,
    x: c.x25519PublicKey ? hex(c.x25519PublicKey) : null, k: c.mlKem768PublicKey ? hex(c.mlKem768PublicKey) : null,
    at: Number(c.at ?? 0),
    ...(c.paid === true || c.paid === false ? { p: c.paid } : {}),
    ...(c.declined === true ? { d: 1 } : {}),
  };
}

export function parseGroupCandidate(c) {
  return {
    groupKey: unhex(c.groupKey), wallet: c.wallet ?? null, keyId: c.keyId ?? null, name: c.name ?? null,
    x25519PublicKey: c.x ? unhex(c.x) : null, mlKem768PublicKey: c.k ? unhex(c.k) : null, at: Number(c.at ?? 0),
    paid: c.p === true ? true : c.p === false ? false : null,
    ...(c.d === 1 ? { declined: true } : {}),
  };
}

export function clearGroupCandidate(record, groupKey) {
  return { ...record, candidates: (record.candidates ?? []).filter((held) => !sameKey(held.groupKey, groupKey)) };
}

export function declineGroupCandidate(record, groupKey) {
  const held = (record.candidates ?? []).find((c) => sameKey(c.groupKey, groupKey));
  if (!held || held.declined === true) return record;
  return { ...record, candidates: record.candidates.map((c) => (c === held ? { ...c, declined: true } : c)) };
}

export function groupCandidatesWaiting(record) {
  return (record?.candidates ?? []).filter((c) => c.declined !== true);
}

function seqKey({ epoch, generation, lane = 'daily' }) {
  return lane === 'roster' ? `r.${epoch}.${generation}` : `${epoch}.${generation}`;
}

export function nextGroupSeq(record, state) {
  return Number(record.seqHighWater[seqKey(state)] ?? 0) + 1;
}

export function noteGroupSeq(record, state) {
  const key = seqKey(state);
  const held = Number(record.seqHighWater[key] ?? 0);
  if (Number(state.seq) <= held) return record;
  return { ...record, seqHighWater: { ...record.seqHighWater, [key]: Number(state.seq) } };
}

export function controlOrder(row) {
  const stamped = Number(row.createdAt ?? NaN);
  const claimed = Number(row.payload?.sentAt ?? NaN);
  return [Number.isFinite(stamped) ? stamped : claimed, Number.isFinite(stamped) ? 0 : 1, hex(row.senderGroupKey ?? new Uint8Array()), Number(row.seq ?? 0)];
}

function beforeOther(a, b) {
  const [at, ap, ak, as] = controlOrder(a);
  const [bt, bp, bk, bs] = controlOrder(b);
  if (at !== bt) return at < bt;
  if (ap !== bp) return ap < bp;
  if (ak !== bk) return ak < bk;
  return as < bs;
}

function logEntryOf(row, effect) {
  return {
    kind: row.kind, sender: hex(row.senderGroupKey ?? new Uint8Array()), epoch: Number(row.epoch), seq: Number(row.seq ?? 0),
    generation: Number(row.generation ?? 0), stamp: controlOrder(row), ...effect,
  };
}

function appendControlLog(record, entry) {
  const held = record.controlLog ?? [];
  if (held.some((e) => e.sender === entry.sender && e.epoch === entry.epoch && e.seq === entry.seq && e.kind === entry.kind && Number(e.generation ?? 0) === Number(entry.generation ?? 0))) return record;
  const log = [...held, entry].sort((a, b) => (stampBefore(a.stamp, b.stamp) ? -1 : 1));
  return { ...record, controlLog: trimControlLog(log) };
}

function trimControlLog(log) {
  let start = Math.max(0, log.length - GROUP_CONTROL_LOG_MAX);
  let members = 0;
  for (let i = log.length - 1; i >= start; i -= 1) {
    members += Array.isArray(log[i]?.members) ? log[i].members.length : 0;
    if (members > GROUP_CONTROL_LOG_MAX_MEMBERS) { start = i + 1; break; }
  }
  return start === 0 ? log : log.slice(start);
}

function coveredByAsOf(asOf, entry) {
  if (entry.kind === GROUP_KIND.LEAVE) return false;
  const at = asOf?.[entry.sender];
  if (!at) return false;
  if (at.g !== undefined && at.g !== null && entry.generation !== undefined && Number(entry.generation) !== Number(at.g)) {
    return Number(entry.generation) < Number(at.g);
  }
  return entry.epoch < Number(at.epoch) || (entry.epoch === Number(at.epoch) && entry.seq <= Number(at.seq));
}

function replayEntry(next, entry, seated = null) {
  if (entry.noop === true) return next;
  switch (entry.kind) {
    case GROUP_KIND.ADMIT: {
      const seatedSet = seated ?? new Set(next.members.map((m) => hex(m.groupKey)));
      const added = [];
      for (const logged of entry.members ?? []) {
        const id = String(logged?.groupKey ?? '').toLowerCase();
        if (seatedSet.has(id)) continue;
        const m = memberFromLog(logged);
        if (!m) continue;
        seatedSet.add(hex(m.groupKey));
        added.push(m);
      }
      return added.length === 0 ? next : { ...next, members: [...next.members, ...added] };
    }
    case GROUP_KIND.REMOVE:
    case GROUP_KIND.LEAVE: {
      const gone = (entry.keys ?? []).map(unhexSafe).filter(Boolean);
      if (seated) for (const key of gone) seated.delete(hex(key));
      let removals = next.removals ?? {};
      if (entry.kind === GROUP_KIND.REMOVE) for (const key of gone) removals = noteGroupRemoval(removals, hex(key), Number(entry.stamp?.[0] ?? 0));
      return {
        ...next,
        members: next.members.filter((m) => !gone.some((k) => sameKey(k, m.groupKey))),
        admins: next.admins.filter((a) => !gone.some((k) => sameKey(k, a))),
        muted: (next.muted ?? []).filter((m) => !gone.some((k) => sameKey(k, m))),
        removals,
      };
    }
    case GROUP_KIND.ADMIN: {
      const admins = (entry.admins ?? []).map(unhexSafe).filter(Boolean);
      if (admins.length === 0) return next;
      const owner = entry.owner ? unhexSafe(entry.owner) : null;
      return { ...next, admins, ...(owner ? { owner } : {}) };
    }
    case GROUP_KIND.PROFILE:
      return entry.profile && typeof entry.profile === 'object' ? { ...next, ...entry.profile } : next;
    case GROUP_KIND.MUTE: {
      const keys = (entry.keys ?? []).map(unhexSafe).filter(Boolean);
      if (keys.length === 0) return next;
      const muted = entry.lift
        ? (next.muted ?? []).filter((m) => !keys.some((k) => sameKey(k, m)))
        : [...(next.muted ?? []), ...keys.filter((k) => !isGroupMuted(next, k))];
      return { ...next, muted };
    }
    case GROUP_KIND.HIDE: {
      if (!isGroupRowKey(entry.key)) return next;
      const hidden = { ...(next.hidden ?? {}) };
      if (entry.lift) delete hidden[entry.key]; else if (!(entry.key in hidden)) hidden[entry.key] = { at: Number(entry.hiddenAt ?? 0) || 0, excerpt: entry.excerpt ?? '' };
      return { ...next, hidden };
    }
    default:
      return next;
  }
}

const unhexSafe = (text) => { try { return unhex(text); } catch { return null; } };
const memberToLog = (m) => ({
  groupKey: hex(m.groupKey), wallet: m.wallet ?? null, keyId: m.keyId ?? null, name: m.name ?? null,
  x: m.x25519PublicKey ? hex(m.x25519PublicKey) : null, k: m.mlKem768PublicKey ? hex(m.mlKem768PublicKey) : null,
});
const memberFromLog = (m) => {
  const groupKey = unhexSafe(m?.groupKey);
  if (!groupKey) return null;
  return {
    groupKey, wallet: m.wallet ?? null, keyId: m.keyId ?? null, name: m.name ?? null,
    x25519PublicKey: m.x ? unhexSafe(m.x) : null, mlKem768PublicKey: m.k ? unhexSafe(m.k) : null,
  };
};

export function noteRosterSeen(record, rows) {
  let seen = record.rosterSeen ?? {};
  let changed = false;
  for (const row of rows ?? []) {
    if (!row?.roster || !(row.senderGroupKey instanceof Uint8Array)) continue;
    const admin = hex(row.senderGroupKey);
    const epoch = Number(row.epoch); const seq = Number(row.seq ?? 0); const g = Number(row.generation ?? 0);
    const held = seen[admin];
    const heldG = Number(held?.g ?? 0);
    if (held && (heldG > g || (heldG === g && (held.epoch > epoch || (held.epoch === epoch && held.seq >= seq))))) continue;
    if (!changed) { seen = { ...seen }; changed = true; }
    seen[admin] = { epoch, seq, g };
  }
  return changed ? { ...record, rosterSeen: seen } : record;
}

const admitIndexCache = new WeakMap();
function latestAdmitStamps(log) {
  let index = admitIndexCache.get(log);
  if (index) return index;
  index = new Map();
  for (const e of log) {
    if (e?.kind !== GROUP_KIND.ADMIT) continue;
    for (const m of e.members ?? []) {
      const key = String(m?.groupKey ?? '').toLowerCase();
      const held = index.get(key);
      if (!held || stampBefore(held, e.stamp)) index.set(key, e.stamp);
    }
  }
  admitIndexCache.set(log, index);
  return index;
}

function readmittedAfter(record, keyHex, stamp) {
  const log = record.controlLog;
  if (!Array.isArray(log) || log.length === 0) return false;
  const latest = latestAdmitStamps(log).get(String(keyHex).toLowerCase());
  return Boolean(latest) && stampBefore(stamp, latest);
}

function beforeThisMembership(record, row) {
  const at = Number(controlOrder(row)[0]);
  return Number(record.openedAt ?? 0) > 0 && Number.isFinite(at) && at < Number(record.openedAt);
}

const hasKeyPair = (m) => m?.x25519PublicKey instanceof Uint8Array && m.x25519PublicKey.length === 32
  && m?.mlKem768PublicKey instanceof Uint8Array && m.mlKem768PublicKey.length === 1184;
function keepSeatedEntry(seated, claimed) {
  let x25519PublicKey = seated.x25519PublicKey ?? null;
  let mlKem768PublicKey = seated.mlKem768PublicKey ?? null;
  if (!hasKeyPair(seated) && hasKeyPair(claimed) && isValidMemberKeys(claimed)) {
    x25519PublicKey = claimed.x25519PublicKey;
    mlKem768PublicKey = claimed.mlKem768PublicKey;
  }
  return {
    ...seated,
    wallet: seated.wallet ?? claimed.wallet ?? null,
    keyId: seated.keyId ?? claimed.keyId ?? null,
    name: seated.name ?? claimed.name ?? null,
    x25519PublicKey,
    mlKem768PublicKey,
  };
}

export function applyGroupRows(record, rows) {
  const messages = [];
  const rekeys = [];
  let next = record;
  const control = [];
  for (const row of rows ?? []) {
    if (row.kind === GROUP_KIND.TEXT) { messages.push(row); continue; }
    control.push(row);
  }
  control.sort((a, b) => (beforeOther(a, b) ? -1 : 1));
  for (const row of control) {
    const fromAdmin = isGroupAdmin(next, row.senderGroupKey);
    const fromOwner = next.owner ? sameKey(next.owner, row.senderGroupKey) : fromAdmin;
    switch (row.kind) {
      case GROUP_KIND.ROSTER: {
        if (!fromAdmin) break;
        const seatedByHex = new Map(next.members.map((m) => [hex(m.groupKey), m]));
        const members = row.payload.members.filter((m) => isValidKeyCached(m.groupKey)).map((m) => {
          const seated = seatedByHex.get(hex(m.groupKey));
          return seated ? keepSeatedEntry(seated, m) : { ...m };
        });
        const rosterAdmins = row.payload.admins.filter((a) => isValidKeyCached(a));
        if (rosterAdmins.length === 0) break;
        const rosterOwner = row.payload.owner && isValidKeyCached(row.payload.owner) ? row.payload.owner : null;
        const ownerNext = !next.owner ? (rosterOwner ?? null) : (fromOwner && rosterOwner ? rosterOwner : next.owner);
        const admins = fromOwner ? rosterAdmins : next.admins;
        const ownerEntry = next.owner ? groupMember(next, next.owner) : null;
        if (!fromOwner && ownerEntry && !members.some((m) => sameKey(m.groupKey, next.owner))) members.push({ ...ownerEntry });
        if (!fromOwner) {
          for (const admin of admins) {
            if (members.some((m) => sameKey(m.groupKey, admin))) continue;
            const seated = groupMember(next, admin);
            if (seated) members.push({ ...seated });
          }
        }
        const memberHexSet = new Set(members.map((m) => hex(m.groupKey)));
        next = {
          ...next,
          owner: ownerNext,
          name: row.payload.name ?? next.name,
          avatar: avatarPointerKeepingSecret(row.payload.avatar ?? next.avatar, next.avatar),
          members,
          admins,
          candidates: (next.candidates ?? []).filter((c) => !memberHexSet.has(hex(c.groupKey))),
          muted: Array.isArray(row.payload.muted) ? groupMutedIn(row.payload.muted, { owner: ownerNext, admins, fromOwner }) : (next.muted ?? []),
          hidden: row.payload.hidden && typeof row.payload.hidden === 'object' ? groupHiddenForRoster(row.payload.hidden, GROUP_HIDDEN_MAX) : (next.hidden ?? {}),
          entryFee: row.payload.entryFee === undefined || !fromOwner ? (next.entryFee ?? null) : row.payload.entryFee,
          removals: mergeGroupRemovals(next.removals, row.payload.removals),
        };
        const seated = new Set(next.members.map((m) => hex(m.groupKey)));
        for (const entry of next.controlLog ?? []) {
          if (coveredByAsOf(row.payload.asOf, entry)) continue;
          if ((entry.kind === GROUP_KIND.LEAVE || entry.kind === GROUP_KIND.REMOVE) && (entry.keys ?? []).length > 0
            && (entry.keys ?? []).every((k) => readmittedAfter(next, k, entry.stamp))) continue;
          next = replayEntry(next, entry, seated);
        }
        break;
      }
      case GROUP_KIND.ADMIT: {
        if (!fromAdmin) break;
        const added = (row.payload.members ?? []).filter((m) => isValidKeyCached(m.groupKey) && !groupMember(next, m.groupKey));
        next = appendControlLog(next, logEntryOf(row, { members: (row.payload.members ?? []).filter((m) => isValidKeyCached(m.groupKey)).map(memberToLog) }));
        if (added.length === 0) break;
        next = {
          ...next,
          members: [...next.members, ...added.map((m) => ({ ...m }))],
          candidates: (next.candidates ?? []).filter((c) => !added.some((m) => sameKey(m.groupKey, c.groupKey))),
        };
        break;
      }
      case GROUP_KIND.PROFILE: {
        if (!fromAdmin) break;
        const delta = {
          ...('name' in row.payload ? { name: groupNameIn(row.payload.name) ?? next.name } : {}),
          ...('avatar' in row.payload ? { avatar: avatarPointerKeepingSecret(row.payload.avatar, next.avatar) } : {}),
          ...('entryFee' in row.payload && fromOwner ? { entryFee: groupEntryFeeIn(row.payload.entryFee) } : {}),
        };
        next = appendControlLog({ ...next, ...delta }, logEntryOf(row, { profile: delta }));
        break;
      }
      case GROUP_KIND.LEAVE:
        if (!sameKey(row.senderGroupKey, row.payload.groupKey)) break;
        if (readmittedAfter(next, hex(row.payload.groupKey), controlOrder(row))) break;
        if (sameKey(row.payload.groupKey, next.self) && beforeThisMembership(next, row)) break;
        next = {
          ...next,
          members: next.members.filter((m) => !sameKey(m.groupKey, row.payload.groupKey)),
          admins: next.admins.filter((a) => !sameKey(a, row.payload.groupKey)),
          muted: (next.muted ?? []).filter((m) => !sameKey(m, row.payload.groupKey)),
        };
        next = appendControlLog(next, logEntryOf(row, { keys: [hex(row.payload.groupKey)] }));
        if (sameKey(row.payload.groupKey, next.self)) next = { ...next, leftAt: Number(row.payload.sentAt ?? 0) };
        break;
      case GROUP_KIND.REMOVE:
        if (!fromAdmin) break;
        if (next.owner && sameKey(next.owner, row.payload.groupKey)) break;
        if (isGroupAdmin(next, row.payload.groupKey) && !fromOwner) break;
        if (readmittedAfter(next, hex(row.payload.groupKey), controlOrder(row))) {
          next = appendControlLog(next, logEntryOf(row, { keys: [hex(row.payload.groupKey)] }));
          next = { ...next, removals: noteGroupRemoval(next.removals, hex(row.payload.groupKey), controlOrder(row)[0]) };
          if (row.payload.envelope) rekeys.push({ generation: row.payload.generation, envelope: row.payload.envelope, epoch: row.epoch, stamp: controlOrder(row), sender: row.senderGroupKey });
          break;
        }
        next = {
          ...next,
          members: next.members.filter((m) => !sameKey(m.groupKey, row.payload.groupKey)),
          admins: next.admins.filter((a) => !sameKey(a, row.payload.groupKey)),
          muted: (next.muted ?? []).filter((m) => !sameKey(m, row.payload.groupKey)),
        };
        next = appendControlLog(next, logEntryOf(row, { keys: [hex(row.payload.groupKey)] }));
        next = { ...next, removals: noteGroupRemoval(next.removals, hex(row.payload.groupKey), controlOrder(row)[0], { replace: true }) };
        if (sameKey(row.payload.groupKey, next.self) && !beforeThisMembership(next, row)) {
          next = { ...next, leftAt: Number(row.createdAt ?? row.payload.sentAt ?? 0) || Number(row.payload.sentAt ?? 0), removedAt: Number(row.payload.sentAt ?? 0) };
        }
        if (row.payload.envelope) {
          rekeys.push({ generation: row.payload.generation, envelope: row.payload.envelope, epoch: row.epoch, stamp: controlOrder(row), sender: row.senderGroupKey });
        }
        break;
      case GROUP_KIND.ADMIN: {
        if (!fromOwner) break;
        const admins = row.payload.admins.filter((a) => isValidKeyCached(a));
        if (admins.length === 0) break;
        const handover = row.payload.owner && isValidKeyCached(row.payload.owner) ? row.payload.owner : null;
        const owner = handover && admins.some((a) => sameKey(a, handover)) ? handover : next.owner;
        next = appendControlLog({ ...next, admins, owner },
          logEntryOf(row, { admins: admins.map(hex), owner: owner ? hex(owner) : null }));
        break;
      }
      case GROUP_KIND.MUTE: {
        if (!fromAdmin) break;
        const target = row.payload.groupKey;
        if (!isValidKeyCached(target)) break;
        if (row.payload.lift) {
          if (!isGroupMuted(next, target)) {
            if (groupMember(next, target)) next = appendControlLog(next, logEntryOf(row, { keys: [hex(target)], lift: true, noop: true }));
            break;
          }
          next = appendControlLog({ ...next, muted: (next.muted ?? []).filter((m) => !sameKey(m, target)) }, logEntryOf(row, { keys: [hex(target)], lift: true }));
          break;
        }
        if (next.owner && sameKey(next.owner, target)) break;
        if (isGroupAdmin(next, target) && !fromOwner) break;
        if (!groupMember(next, target)) break;
        if (isGroupMuted(next, target)) { next = appendControlLog(next, logEntryOf(row, { keys: [hex(target)], lift: false, noop: true })); break; }
        next = appendControlLog({ ...next, muted: [...(next.muted ?? []), target] }, logEntryOf(row, { keys: [hex(target)], lift: false }));
        break;
      }
      case GROUP_KIND.HIDE: {
        if (!fromAdmin || !isGroupRowKey(row.payload.key)) break;
        const key = row.payload.key;
        const held = next.hidden ?? {};
        if (row.payload.lift) {
          if (!(key in held)) { next = appendControlLog(next, logEntryOf(row, { key, lift: true, noop: true })); break; }
          const rest = { ...held }; delete rest[key];
          next = appendControlLog({ ...next, hidden: rest }, logEntryOf(row, { key, lift: true }));
          break;
        }
        if (key in held) { next = appendControlLog(next, logEntryOf(row, { key, lift: false, noop: true })); break; }
        const hiddenAt = Number(row.createdAt ?? row.payload.sentAt ?? 0) || 0;
        const hidden = { ...held, [key]: { at: hiddenAt, excerpt: row.payload.excerpt ?? '' } };
        const keys = Object.keys(hidden);
        if (keys.length > GROUP_HIDDEN_MAX) delete hidden[keys.sort((a, b) => Number(hidden[a].at) - Number(hidden[b].at))[0]];
        next = appendControlLog({ ...next, hidden }, logEntryOf(row, { key, lift: false, excerpt: row.payload.excerpt ?? '', hiddenAt }));
        break;
      }
      default:
        break;
    }
  }
  const mutedHex = new Set((next.muted ?? []).map(hex));
  const hiddenKeys = next.hidden ?? {};
  const shown = messages.map((row) => {
    const key = groupMessageKey(row);
    const hidden = mutedHex.has(hex(row.senderGroupKey ?? new Uint8Array())) || Boolean(hiddenKeys[key]);
    return hidden ? { ...row, key, hidden: true } : { ...row, key };
  });
  shown.sort((a, b) => Number(a.payload?.sentAt ?? 0) - Number(b.payload?.sentAt ?? 0));
  return { record: next, messages: shown, rekeys };
}


export function snapshotForRevert(snapshot) {
  if (!snapshot) return null;
  const admin = snapshot.admin instanceof Uint8Array ? hex(snapshot.admin) : (typeof snapshot.admin === 'string' ? snapshot.admin : hex(bytesLikeToArray(snapshot.admin) ?? new Uint8Array()));
  return { epoch: Number(snapshot.epoch), generation: Number(snapshot.generation), admin, seq: Number(snapshot.seq), parts: Number(snapshot.parts), at: Number(snapshot.at ?? 0) };
}

export function snapshotFromRevert(stored) {
  if (!stored) return null;
  const admin = stored.admin instanceof Uint8Array ? stored.admin : (typeof stored.admin === 'string' ? unhexSafe(stored.admin) : bytesLikeToArray(stored.admin));
  if (!(admin instanceof Uint8Array) || admin.length !== 32) return null;
  return { epoch: Number(stored.epoch), generation: Number(stored.generation), admin, seq: Number(stored.seq), parts: Number(stored.parts), at: Number(stored.at ?? 0) };
}

function bytesLikeToArray(value) {
  if (!value || typeof value !== 'object') return null;
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.length > 64 || keys.some((k) => !/^\d+$/.test(k))) return null;
  const out = new Uint8Array(keys.length);
  for (let i = 0; i < keys.length; i += 1) { const b = Number(value[i]); if (!Number.isInteger(b) || b < 0 || b > 255) return null; out[i] = b; }
  return out;
}

export function createPerKeyLock() {
  const chains = new Map();
  return (key, fn) => {
    const id = String(key);
    const previous = chains.get(id) ?? Promise.resolve();
    const next = previous.then(fn, fn);
    chains.set(id, next.catch(() => {}));
    return next;
  };
}

function groupFieldValue(record, field) {
  switch (field) {
    case 'admins': return (record.admins ?? []).map(hex).sort().join(',');
    case 'owner': return record.owner instanceof Uint8Array ? hex(record.owner) : '';
    case 'muted': return (record.muted ?? []).map(hex).sort().join(',');
    case 'hidden': return Object.keys(record.hidden ?? {}).sort().join(',');
    case 'removals': return JSON.stringify(Object.entries(record.removals ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    case 'name': return String(record.name ?? '');
    case 'avatar': return JSON.stringify(record.avatar ?? null);
    case 'entryFee': return String(record.entryFee ?? '');
    case 'snapshot': return JSON.stringify(snapshotForRevert(record.snapshot));
    case 'admitsSinceSnapshot': return String(Number(record.admitsSinceSnapshot ?? 0));
    case 'rosterCursor': return String(record.rosterCursor ?? '');
    default: return undefined;
  }
}

export function notePendingControl(record, entry) {
  const applied = {};
  for (const field of Object.keys(entry.revert ?? {})) {
    const value = groupFieldValue(record, field);
    if (value !== undefined) applied[field] = value;
  }
  return { ...record, pendingControl: [...(record.pendingControl ?? []), { ...entry, applied, at: Number(entry.at ?? 0) }] };
}

export function settlePendingControl(record, { rosterRows = [], cleanEpochs = [], cleanLanes = null, nowSec = 0, confirmAfterS = GROUP_CONTROL_CONFIRM_S, abandonAfterS = GROUP_CONTROL_ABANDON_S } = {}) {
  const pending = record.pendingControl ?? [];
  if (pending.length === 0) return { record, reverted: [] };
  const own = new Set((rosterRows ?? [])
    .filter((row) => row?.roster && sameKey(row.senderGroupKey, record.self))
    .map((row) => `${Number(row.generation ?? 0)}.${Number(row.epoch)}.${Number(row.seq)}`));
  const clean = new Set((cleanEpochs ?? []).map(Number));
  const lanes = cleanLanes ? new Set([...cleanLanes].map(String)) : null;
  const readClean = (entry) => (lanes ? lanes.has(`${Number(entry.generation ?? 0)}.${Number(entry.epoch)}`) : clean.has(Number(entry.epoch)));
  let next = record;
  const keep = [];
  const reverted = [];
  for (const entry of pending) {
    if (own.has(`${Number(entry.generation ?? 0)}.${Number(entry.epoch)}.${Number(entry.seq)}`)) continue;
    const age = Number(nowSec) - Number(entry.at ?? 0);
    const overdue = age > Number(confirmAfterS);
    const abandoned = age > Number(abandonAfterS);
    if (!(overdue && readClean(entry)) && !abandoned) { keep.push(entry); continue; }
    next = revertControl(next, entry);
    reverted.push(entry);
  }
  next = { ...next, pendingControl: keep };
  if (reverted.length > 0) next = { ...next, lastControlFailure: { kind: reverted[reverted.length - 1].kind, at: Number(nowSec) } };
  return { record: next, reverted };
}

function revertControl(record, entry) {
  const revert = entry.revert ?? {};
  let next = record;
  const untouched = (field) => !entry.applied || !(field in entry.applied) || groupFieldValue(record, field) === entry.applied[field];
  const selfHex = record.self instanceof Uint8Array ? hex(record.self) : '';
  const loggedByOther = (kinds, keyHex) => (record.controlLog ?? []).some((e) => kinds.includes(e.kind) && e.sender !== selfHex
    && ((e.keys ?? []).map((k) => String(k).toLowerCase()).includes(keyHex) || (e.members ?? []).some((m) => String(m?.groupKey ?? '').toLowerCase() === keyHex)));
  const otherSays = (kind, about, lift) => {
    let newest = null;
    for (const e of record.controlLog ?? []) if (e.kind === kind && e.sender !== selfHex && about(e)) newest = e;
    return Boolean(newest) && Boolean(newest.lift) === lift;
  };
  switch (entry.kind) {
    case GROUP_KIND.ADMIT: {
      const added = (entry.members ?? []).map(memberFromLog).filter(Boolean).filter((m) => !loggedByOther([GROUP_KIND.ADMIT], hex(m.groupKey)));
      next = {
        ...next,
        members: next.members.filter((m) => !added.some((a) => sameKey(a.groupKey, m.groupKey))),
        candidates: [...(next.candidates ?? []), ...added.filter((a) => !(next.candidates ?? []).some((c) => sameKey(c.groupKey, a.groupKey))).map((a) => ({ ...a, at: Number(entry.at ?? 0) }))],
        admitsSinceSnapshot: Math.max(0, Number(next.admitsSinceSnapshot ?? 0) - added.length),
        accessOwed: (next.accessOwed ?? []).filter((o) => !added.some((a) => hex(a.groupKey) === o.groupKey)),
      };
      break;
    }
    case GROUP_KIND.REMOVE: {
      const victim = entry.victim ? memberFromLog(entry.victim) : null;
      const victimGoneOtherwise = victim ? loggedByOther([GROUP_KIND.REMOVE, GROUP_KIND.LEAVE], hex(victim.groupKey)) : false;
      if (victim && !victimGoneOtherwise && !groupMember(next, victim.groupKey)) next = { ...next, members: [...next.members, victim] };
      if (victim && !victimGoneOtherwise && entry.victimWasAdmin && !isGroupAdmin(next, victim.groupKey)) next = { ...next, admins: [...next.admins, victim.groupKey] };
      if (entry.rekey) {
        const lostHex = String(entry.rekey.key ?? '').toLowerCase();
        const generation = Number(entry.rekey.generation);
        const epochs = next.epochs.filter((e) => !(e.generation === generation && lostHex && epochRoot(e) === lostHex));
        const generationRemains = epochs.some((e) => e.generation === generation);
        next = {
          ...next,
          epochs,
          rosterKeys: generationRemains ? (next.rosterKeys ?? {}) : Object.fromEntries(Object.entries(next.rosterKeys ?? {}).filter(([g]) => Number(g) !== generation)),
        };
        if ('snapshot' in revert && untouched('snapshot')) next = { ...next, snapshot: snapshotFromRevert(revert.snapshot) };
        if ('admitsSinceSnapshot' in revert && untouched('admitsSinceSnapshot')) next = { ...next, admitsSinceSnapshot: Number(revert.admitsSinceSnapshot ?? 0) };
        if ('rosterCursor' in revert && untouched('rosterCursor')) next = { ...next, rosterCursor: revert.rosterCursor ?? next.rosterCursor };
      }
      if ('removals' in revert && untouched('removals')) next = { ...next, removals: groupRemovalsIn(revert.removals) };
      break;
    }
    case GROUP_KIND.ADMIN:
      if (Array.isArray(revert.admins) && untouched('admins')) next = { ...next, admins: revert.admins.map(unhexSafe).filter(Boolean) };
      if ('owner' in revert && untouched('owner')) next = { ...next, owner: revert.owner ? unhexSafe(revert.owner) ?? next.owner : null };
      break;
    case GROUP_KIND.ROSTER:
      if ('snapshot' in revert && untouched('snapshot')) next = { ...next, snapshot: snapshotFromRevert(revert.snapshot) };
      if ('admitsSinceSnapshot' in revert && untouched('admitsSinceSnapshot')) next = { ...next, admitsSinceSnapshot: Number(revert.admitsSinceSnapshot ?? 0) };
      break;
    case GROUP_KIND.PROFILE:
      if ('avatar' in revert && untouched('avatar')) next = { ...next, avatar: revert.avatar ?? null };
      if ('name' in revert && untouched('name')) next = { ...next, name: revert.name ?? null };
      if ('entryFee' in revert && untouched('entryFee')) next = { ...next, entryFee: groupEntryFeeIn(revert.entryFee) };
      break;
    case GROUP_KIND.MUTE: {
      if (!Array.isArray(revert.muted)) break;
      if (untouched('muted')) { next = { ...next, muted: revert.muted.map(unhexSafe).filter(Boolean) }; break; }
      const before = new Set(revert.muted.map((k) => String(k).toLowerCase()));
      const after = new Set(String(entry.applied?.muted ?? '').split(',').filter(Boolean));
      const about = (k) => (e) => (e.keys ?? []).some((x) => String(x).toLowerCase() === k);
      let muted = (next.muted ?? []).filter((m) => { const k = hex(m); return !(after.has(k) && !before.has(k) && !otherSays(GROUP_KIND.MUTE, about(k), false)); });
      for (const k of before) {
        if (after.has(k) || otherSays(GROUP_KIND.MUTE, about(k), true)) continue;
        const key = unhexSafe(k);
        if (key && groupMember(next, key) && !muted.some((m) => sameKey(m, key))) muted = [...muted, key];
      }
      next = { ...next, muted };
      break;
    }
    case GROUP_KIND.HIDE: {
      if (!revert.hidden || typeof revert.hidden !== 'object') break;
      if (untouched('hidden')) { next = { ...next, hidden: groupHiddenIn(revert.hidden) }; break; }
      const beforeMap = groupHiddenIn(revert.hidden);
      const after = new Set(String(entry.applied?.hidden ?? '').split(',').filter(Boolean));
      const about = (key) => (e) => e.key === key;
      const hidden = { ...(next.hidden ?? {}) };
      for (const key of after) if (!(key in beforeMap) && !otherSays(GROUP_KIND.HIDE, about(key), false)) delete hidden[key];
      for (const key of Object.keys(beforeMap)) if (!after.has(key) && !otherSays(GROUP_KIND.HIDE, about(key), true) && !(key in hidden)) hidden[key] = beforeMap[key];
      next = { ...next, hidden };
      break;
    }
    default:
      break;
  }
  return next;
}

export function memberForLog(member) { return memberToLog(member); }

export function groupRemovalPlan(record, victimGroupKey, { entryBytes = 1156, headerBytes = 44 } = {}) {
  const stays = record.members.filter((m) => !sameKey(m.groupKey, victimGroupKey));
  const wrappable = stays.filter((m) => m.mlKem768PublicKey && m.x25519PublicKey);
  return {
    stays,
    wrappable,
    missingKeys: stays.length - wrappable.length,
    bytes: headerBytes + wrappable.length * entryBytes,
    generation: (currentGroupEpoch(record)?.generation ?? 0) + 1,
  };
}


const memberHexMemo = new WeakMap();
const memoHex = (bytes) => {
  if (!(bytes instanceof Uint8Array)) return hex(bytes);
  let s = memberHexMemo.get(bytes);
  if (s === undefined) { s = hex(bytes); memberHexMemo.set(bytes, s); }
  return s;
};

export function avatarPointerKeepingSecret(incoming, held) {
  if (!incoming || !held || incoming.key || !held.key) return incoming ?? null;
  const same = Number(incoming.epoch) === Number(held.epoch) && Number(incoming.seq) === Number(held.seq)
    && Number(incoming.parts) === Number(held.parts) && String(incoming.hash).toLowerCase() === String(held.hash).toLowerCase();
  return same ? { ...incoming, key: held.key } : incoming;
}

export function mergeGroupRecordRows(current, legacy) {
  if (!current || !legacy || String(current.groupId ?? '').toLowerCase() !== String(legacy.groupId ?? '').toLowerCase()) return current;
  const rootOf = (e) => String(typeof e?.root === 'string' ? e.root : (e?.key ?? '')).toLowerCase();
  const roots = new Map();
  for (const e of current.epochs ?? []) {
    const g = Number(e.generation ?? 0);
    if (!roots.has(g)) roots.set(g, new Set());
    roots.get(g).add(rootOf(e));
  }
  const held = new Set((current.epochs ?? []).map((e) => `${Number(e.epoch)}.${Number(e.generation ?? 0)}`));
  const added = [];
  for (const e of legacy.epochs ?? []) {
    const g = Number(e.generation ?? 0);
    const id = `${Number(e.epoch)}.${g}`;
    if (held.has(id) || !roots.get(g)?.has(rootOf(e)) || !/^[0-9a-f]{64}$/i.test(String(e.key ?? ''))) continue;
    held.add(id);
    const { read: _read, ...day } = e;
    added.push(day);
  }
  const epochs = added.length === 0 ? current.epochs : [...(current.epochs ?? []), ...added]
    .sort((a, b) => (Number(a.epoch) - Number(b.epoch)) || (Number(a.generation ?? 0) - Number(b.generation ?? 0)));
  const rosterKeys = { ...(current.rosterKeys ?? {}) };
  for (const [g, key] of Object.entries(legacy.rosterKeys ?? {})) {
    if (!(g in rosterKeys) && roots.has(Number(g)) && /^[0-9a-f]{64}$/i.test(String(key ?? ''))) rosterKeys[g] = key;
  }
  const seqHighWater = { ...(current.seqHighWater ?? {}) };
  for (const [lane, seq] of Object.entries(legacy.seqHighWater ?? {})) {
    if (Number.isFinite(Number(seq)) && Number(seq) > Number(seqHighWater[lane] ?? 0)) seqHighWater[lane] = Number(seq);
  }
  const invites = [...(current.pendingInvites ?? [])];
  for (const invite of legacy.pendingInvites ?? []) {
    if (invites.some((kept) => (invite.wallet && kept.wallet === invite.wallet) || (invite.keyId && kept.keyId === invite.keyId))) continue;
    invites.push({ ...invite });
  }
  const pendingInvites = invites.sort((a, b) => Number(a.at ?? 0) - Number(b.at ?? 0)).slice(-GROUP_PENDING_INVITES_MAX);
  return { ...current, epochs, rosterKeys, seqHighWater, pendingInvites };
}

export function serializeGroupRecord(record) {
  return {
    v: 1,
    sg: GROUP_RECORD_SHARD_GENERATION,
    groupId: hex(record.groupId),
    name: record.name,
    avatar: record.avatar ? { ...record.avatar } : null,
    self: record.self ? hex(record.self) : null,
    admins: record.admins.map(hex),
    owner: record.owner ? hex(record.owner) : null,
    members: record.members.map((m) => ({
      groupKey: memoHex(m.groupKey),
      wallet: m.wallet ?? null,
      keyId: m.keyId ?? null,
      name: m.name ?? null,
      x: m.x25519PublicKey ? memoHex(m.x25519PublicKey) : null,
      k: m.mlKem768PublicKey ? memoHex(m.mlKem768PublicKey) : null,
    })),
    epochs: record.epochs.map((e) => ({
      epoch: e.epoch, generation: e.generation, key: hex(e.key),
      ...(e.read === true ? { read: true } : {}),
      ...(e.speculative === true ? { speculative: true } : {}),
      ...(Array.isArray(e.stamp) ? { stamp: e.stamp.map((v) => (typeof v === 'number' ? v : String(v))) } : {}),
      ...(typeof e.root === 'string' && /^[0-9a-f]{64}$/.test(e.root) ? { root: e.root } : {}),
    })),
    rosterKeys: Object.fromEntries(Object.entries(record.rosterKeys ?? {}).map(([g, k]) => [g, hex(k)])),
    snapshot: record.snapshot ? { ...record.snapshot, admin: hex(record.snapshot.admin) } : null,
    snapshotApplied: record.snapshotApplied !== false,
    admitsSinceSnapshot: Number(record.admitsSinceSnapshot ?? 0),
    rosterCursor: record.rosterCursor ?? null,
    seqHighWater: { ...record.seqHighWater },
    seenSeq: { ...record.seenSeq },
    pendingInvites: (record.pendingInvites ?? []).map((invite) => ({ ...invite })),
    leftAt: record.leftAt ?? null,
    openedAt: Number(record.openedAt ?? 0),
    muted: (record.muted ?? []).map(hex),
    hidden: groupHiddenIn(record.hidden),
    removedAt: record.removedAt ?? null,
    entryFee: groupEntryFeeIn(record.entryFee),
    removals: groupRemovalsIn(record.removals),
    controlLog: (record.controlLog ?? []).map((e) => ({ ...e })),
    pendingControl: (record.pendingControl ?? []).map((e) => ({ ...e })),
    rosterSeen: { ...(record.rosterSeen ?? {}) },
    generationLost: (record.generationLost ?? []).map((g) => ({ generation: g.generation, key: hex(g.key) })),
    lastControlFailure: record.lastControlFailure ? { ...record.lastControlFailure } : null,
    accessOwed: groupAccessOwedIn(record.accessOwed),
  };
}

export function parseGroupRecord(stored) {
  if (Number(stored?.v) !== 1) throw new RangeError(`unsupported group record version ${stored?.v}`);
  const rewind = unstampedPastBoundary(stored);
  return {
    groupId: unhex(stored.groupId),
    name: stored.name ?? null,
    avatar: stored.avatar ? { ...stored.avatar } : null,
    self: stored.self ? unhex(stored.self) : null,
    admins: (stored.admins ?? []).map(unhex),
    owner: stored.owner ? unhex(stored.owner) : null,
    members: (stored.members ?? []).map((m) => ({
      groupKey: unhex(m.groupKey),
      wallet: m.wallet ?? null,
      keyId: m.keyId ?? null,
      name: m.name ?? null,
      x25519PublicKey: m.x ? unhex(m.x) : null,
      mlKem768PublicKey: m.k ? unhex(m.k) : null,
    })),
    epochs: (stored.epochs ?? []).map((e) => ({
      epoch: Number(e.epoch), generation: Number(e.generation), key: unhex(e.key),
      ...(e.read === true && !(rewind && Number(e.epoch) >= CUTOVER_EPOCH) ? { read: true } : {}),
      ...(e.speculative === true ? { speculative: true } : {}),
      ...(Array.isArray(e.stamp) ? { stamp: [...e.stamp] } : {}),
      ...(typeof e.root === 'string' && /^[0-9a-f]{64}$/.test(e.root) ? { root: e.root } : {}),
    })),
    rosterKeys: Object.fromEntries(Object.entries(stored.rosterKeys ?? {}).map(([g, k]) => [g, unhex(k)])),
    snapshot: stored.snapshot
      ? {
        epoch: Number(stored.snapshot.epoch), generation: Number(stored.snapshot.generation), admin: unhex(stored.snapshot.admin),
        seq: Number(stored.snapshot.seq), parts: Number(stored.snapshot.parts), at: Number(stored.snapshot.at ?? 0),
      }
      : null,
    snapshotApplied: stored.snapshotApplied !== false,
    admitsSinceSnapshot: Number(stored.admitsSinceSnapshot ?? 0),
    rosterCursor: stored.rosterCursor === undefined || stored.rosterCursor === null ? null
      : (rewind ? Math.min(Number(stored.rosterCursor), CUTOVER_EPOCH) : Number(stored.rosterCursor)),
    seqHighWater: { ...(stored.seqHighWater ?? {}) },
    seenSeq: { ...(stored.seenSeq ?? {}) },
    pendingInvites: (stored.pendingInvites ?? []).map((invite) => ({ ...invite })),
    candidates: (stored.candidates ?? []).map(parseGroupCandidate),
    leftAt: stored.leftAt ?? null,
    openedAt: Number(stored.openedAt ?? 0),
    muted: (stored.muted ?? []).map(unhexSafe).filter(Boolean),
    hidden: groupHiddenIn(stored.hidden),
    removedAt: stored.removedAt ?? null,
    entryFee: groupEntryFeeIn(stored.entryFee),
    removals: groupRemovalsIn(stored.removals),
    controlLog: (stored.controlLog ?? []).map((e) => ({ ...e })),
    pendingControl: (stored.pendingControl ?? []).map((e) => ({ ...e })),
    rosterSeen: { ...(stored.rosterSeen ?? {}) },
    generationLost: (stored.generationLost ?? []).map((g) => ({ generation: Number(g.generation), key: unhex(g.key) })),
    lastControlFailure: stored.lastControlFailure ? { ...stored.lastControlFailure } : null,
    accessOwed: groupAccessOwedIn(stored.accessOwed),
  };
}

export const GROUPS_RECOVERY_VERSION = 1;

export const GROUPS_RECOVERY_REFRESH_DAYS = 300;

export function groupRecoveryEntry(record) {
  if (!record || record.leftAt) return null;
  const oldest = (record.epochs ?? [])[0];
  if (!oldest?.key || !record.groupId) return null;
  const admin = groupOwnerKey(record) ?? (record.admins ?? [])[0] ?? record.self ?? null;
  const rosterKey = record.rosterKeys?.[String(oldest.generation)] ?? null;
  return {
    g: hex(record.groupId),
    k: hex(oldest.key),
    e: Number(oldest.epoch),
    n: Number(oldest.generation),
    ...(record.name ? { t: String(record.name) } : {}),
    ...(admin ? { a: hex(admin) } : {}),
    ...(rosterKey instanceof Uint8Array ? { r: hex(rosterKey) } : {}),
  };
}

export function isPublicGroupRecoveryEntry(entry) {
  return Boolean(entry) && entry.k === undefined && /^[0-9a-f]{64}$/i.test(String(entry.f ?? ''));
}

export function publicGroupRecoveryEntry(record) {
  if (!record || record.kind !== 'public' || record.leftAt) return null;
  if (!(record.groupId instanceof Uint8Array) || !(record.founder instanceof Uint8Array) || record.founder.length !== 32) return null;
  const era = record.foundedEra === null || record.foundedEra === undefined ? null : Number(record.foundedEra);
  return {
    g: hex(record.groupId),
    f: hex(record.founder),
    ...(Number.isInteger(era) && era >= 0 ? { r: era } : {}),
    ...(record.name ? { t: String(record.name) } : {}),
  };
}

export function groupsRecoveryBytes(entries) {
  const list = (entries ?? []).filter(Boolean);
  const pointers = list.filter(isPublicGroupRecoveryEntry);
  return new TextEncoder().encode(JSON.stringify({
    v: GROUPS_RECOVERY_VERSION,
    groups: list.filter((entry) => !isPublicGroupRecoveryEntry(entry)),
    ...(pointers.length > 0 ? { public: pointers } : {}),
  }));
}

export function groupsRecoveryEntries(records, publicRecords = []) {
  return [...(records ?? []).map(groupRecoveryEntry), ...(publicRecords ?? []).map(publicGroupRecoveryEntry)].filter(Boolean);
}

export function serializeGroupsRecovery(records) {
  return groupsRecoveryBytes(groupsRecoveryEntries(records));
}

export function parseGroupsRecovery(bytes) {
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes ?? [])));
    if (Number(value?.v) !== GROUPS_RECOVERY_VERSION || !Array.isArray(value.groups)) return [];
    const id = (entry) => /^[0-9a-f]{64}$/i.test(String(entry?.g ?? ""));
    const privateEntries = value.groups.filter((entry) => id(entry)
      && /^[0-9a-f]{64}$/i.test(String(entry?.k ?? ""))
      && Number.isInteger(Number(entry?.e)) && Number.isInteger(Number(entry?.n)));
    const publicEntries = (Array.isArray(value.public) ? value.public : []).filter((entry) => id(entry)
      && isPublicGroupRecoveryEntry(entry)
      && (entry.r === undefined || entry.r === null || (Number.isInteger(Number(entry.r)) && Number(entry.r) >= 0)));
    return [...privateEntries, ...publicEntries];
  } catch {
    return [];
  }
}

export function groupsRecoverySecret(entry) {
  return {
    groupId: String(entry.g),
    key: String(entry.k),
    epoch: Number(entry.e),
    generation: Number(entry.n),
    name: entry.t ?? null,
    inviter: entry.a ?? null,
    rosterKey: entry.r ?? null,
    snapshot: null,
  };
}

export function publicGroupRecoveryPointer(entry) {
  return {
    groupId: unhex(String(entry.g)),
    founder: unhex(String(entry.f)),
    foundedEra: entry.r === undefined || entry.r === null ? null : Number(entry.r),
    name: entry.t ?? null,
  };
}

export function groupsRecoveryIsStale(entries, storedEntries, todayEpoch) {
  const now = Number(todayEpoch);
  const mine = (entries ?? []).filter(Boolean);
  const stored = new Map((storedEntries ?? []).map((entry) => [String(entry.g).toLowerCase(), entry]));
  if (mine.length !== stored.size) return true;
  for (const entry of mine) {
    const held = stored.get(entry.g.toLowerCase());
    if (!held) return true;
    if (isPublicGroupRecoveryEntry(entry)) {
      if (!isPublicGroupRecoveryEntry(held) || String(held.f).toLowerCase() !== String(entry.f).toLowerCase()) return true;
      if ((held.r ?? null) !== (entry.r ?? null)) return true;
      continue;
    }
    if (isPublicGroupRecoveryEntry(held)) return true;
    if (Number.isFinite(now) && now - Number(held.e) > GROUPS_RECOVERY_REFRESH_DAYS && Number(entry.e) > Number(held.e)) return true;
    if (String(held.k).toLowerCase() !== entry.k.toLowerCase() && Number(held.n) > Number(entry.n)) return true;
    if (String(held.r ?? '').toLowerCase() !== String(entry.r ?? '').toLowerCase()) return true;
    if (String(held.a ?? '').toLowerCase() !== String(entry.a ?? '').toLowerCase()) return true;
  }
  return false;
}
