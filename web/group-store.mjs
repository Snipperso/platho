// PLATHO — the state of a private group on this device: what it holds, how it moves, and what a control message
// is allowed to change. Pure — no chain, no storage engine, no UI — so the rules can be read in one place and
// tested without a sandbox. Design: contracts18/docs/DESIGN-private-groups.md.
//
// ── THE DEVICE HOLDS A WINDOW, NOT A KEY ───────────────────────────────────────────────────────────────────
//
// The epoch key ratchets FORWARD ONLY, so yesterday's lanes cannot be derived from today's key. A device
// therefore keeps the (epoch, generation, key) states it still wants to read and prunes the rest; one that was
// away walks the ratchet forward itself and keeps the keys of the days it missed. `advanceGroupWindow` is that
// walk, and it is the only place the ratchet is turned.
//
// ── THE LANE IS THE SIGNATURE ──────────────────────────────────────────────────────────────────────────────
//
// A control message needs no signature of its own. The capsule was found in a lane whose blinded key only its
// owner can sign, and the frame — sealed as the AEAD's additional data — names that same owner; the reader has
// already refused any row where the two disagree. So "signed by an admin" is exactly `admins` containing the
// sender's group key, and nothing else has to be checked or stored.
//
// ── WHAT MAY CHANGE WHAT ───────────────────────────────────────────────────────────────────────────────────
//
//   (joining is not a lane message at all [2026-09-05]: the newcomer answers the invite in the private conversation
//   it came in, and the admin's device notes them as a CANDIDATE — noteGroupCandidate — until a ROSTER admits
//   them. Holding the key is never a membership card, and there is no lobby lane for it to be written into.)
//   ROSTER  from an admin only: the SNAPSHOT — replaces the membership and the admin set wholesale. Lives in the
//           admin's ROSTER lane (readable by the whole generation), taken every so often, pointed at by invites.
//   ADMIT   from an admin only: a delta — these people are in. One small capsule whatever the room's size.
//   PROFILE from an admin only: a delta — the room's name, size hint or picture pointer.
//   LEAVE   from the member themselves: drops them from the roster. No rekey, and the caller must not pretend
//           otherwise — a departed member keeps the key and can still read.
//   REMOVE  from an admin only: drops the named member, and when it carries an envelope it also starts the next
//           generation for everyone else.
//   ADMIN   from an admin only: replaces the admin set wholesale, so a revoked key cannot survive by omission.
//
// Competing changes are ordered by the CONTRACT's stamp when the caller has it (`createdAt` from the record) and
// by the sender's own `sentAt` when it does not, tie-broken by the lane key so every device lands on one answer.

import { GROUP_KIND } from './group-protocol.mjs?v=9';
import { advanceGroupEpoch, groupEpochFromSeconds, isValidGroupKey } from './crypto/group-lane.mjs?v=5';

/** How many folded control rows a record keeps, so a late snapshot can have the deltas it did not see replayed. */
export const GROUP_CONTROL_LOG_MAX = 512;
/** How long a control write this device published may stay unconfirmed before the fold takes it back (seconds). */
export const GROUP_CONTROL_CONFIRM_S = 600;

/** How many past days a device keeps readable. Three covers a phone that was off for a weekend. */
export const GROUP_WINDOW_DAYS = 3;
/** The presets of the design: a group people know each other in, and a room that is a closed publication. */
export const GROUP_SIZE_GROUP = 50;
export const GROUP_SIZE_ROOM = 1024;

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (text) => {
  if (typeof text !== 'string' || text.length % 2 !== 0 || /[^0-9a-f]/i.test(text)) throw new TypeError('bad hex');
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const sameKey = (a, b) => a instanceof Uint8Array && b instanceof Uint8Array && hex(a) === hex(b);

/**
 * A group as this device knows it. `self` is this member's own group public key — the lane the device writes to.
 * `epochs` is the read window, newest last. Everything is plain data: `serializeGroupRecord` is the storage form.
 */
export function createGroupRecord({ founding, name = null, sizeHint = GROUP_SIZE_GROUP, self, members = [], admins = [] }) {
  if (!(founding?.groupId instanceof Uint8Array) || !(founding?.key instanceof Uint8Array)) {
    throw new TypeError('createGroupRecord needs a founding state from createGroupFounding');
  }
  return {
    groupId: founding.groupId,
    name,
    sizeHint: Number(sizeHint),
    // WHERE THE ROOM'S PICTURE IS — a pointer, never the bytes. The image itself belongs in the media cache the
    // app already keeps for avatars, keyed by the same sha-256 this names.
    avatar: null,
    self: self ?? null,
    admins: admins.map((a) => a),
    members: members.map((m) => ({ ...m })),
    epochs: [{ epoch: founding.epoch, generation: founding.generation, key: founding.key }],
    // THE ROSTER KEY OF EACH GENERATION this device has lived in (crypto/group-lane.mjs groupRosterKey): what lets
    // it read the admins' roster lanes — every admission, removal and snapshot of the generation — on any day.
    rosterKeys: founding.rosterKey ? { [String(founding.generation)]: founding.rosterKey } : {},
    // WHERE THE LAST SNAPSHOT IS: (epoch, generation, admin, seq, parts). An invite points a newcomer at it, and
    // the admissions after it are read from the roster lanes day by day.
    snapshot: null,
    snapshotApplied: true,     // false on a newcomer's record until its first pass has read the snapshot
    admitsSinceSnapshot: 0,
    // The roster lanes are read from this day up to today on every pass, whatever the message window is: a missed
    // admission would mean never reading that member's lane, which is a loss the message window cannot afford.
    rosterCursor: founding.epoch,
    seqHighWater: {},         // `${epoch}.${generation}` -> the highest seq THIS device has written
    seenSeq: {},              // `${address}` -> the highest seq read, so a pass knows how deep to page
    // WHO WAS INVITED AND HAS NOT ARRIVED. An invite cannot put anyone in the roster — a member's group key is
    // derived from their own vault seed, so the inviter has nothing to name. This is the note that lets the
    // admin's device recognise their own invitee when the join token arrives and admit them without asking again.
    pendingInvites: [],
    // WHO ANSWERED AN INVITE AND WAITS FOR AN ADMIN. An admin's device fills this from join tokens it reads in
    // private conversations; a roster empties it. Only an admin's record ever has anyone here.
    candidates: [],
    leftAt: null,             // set when this device left (or was removed); the record stays for the history it holds
    // THE FOLDED CONTROL ROWS, bounded (GROUP_CONTROL_LOG_MAX) [audit 2026-09-06, round 3]: what a late ROSTER
    // snapshot did not see is replayed from here after it lands, so a wholesale roster cannot un-admit or re-admit.
    controlLog: [],
    // WHAT THIS DEVICE PUBLISHED AND THE CHAIN HAS NOT SHOWN YET [round 3]: a control write is believed at broadcast
    // for the screen, and taken back by the fold when its own roster lane has been read clean and does not carry it.
    pendingControl: [],
    // Per admin (hex): the highest (epoch, seq) of that admin's roster rows this device has folded — what a snapshot
    // this device takes says it saw (`asOf`).
    rosterSeen: {},
    lastControlFailure: null,
  };
}

/** The newest state the device holds — what a send uses. */
export function currentGroupEpoch(record) {
  return record.epochs.length === 0 ? null : record.epochs[record.epochs.length - 1];
}

/**
 * Walk the ratchet up to `nowSec`'s day, keeping every key walked through (those days are readable) and pruning
 * anything older than the window. Returns a NEW record; the old one is untouched, so a failed pass cannot leave
 * a half-turned ratchet behind.
 */
export async function advanceGroupWindow(record, nowSec, { windowDays = GROUP_WINDOW_DAYS, keepUnread = GROUP_UNREAD_DAYS_KEPT } = {}) {
  const today = groupEpochFromSeconds(nowSec);
  const head = currentGroupEpoch(record);
  if (!head) return record;
  if (today < head.epoch) return record;      // a clock behind the ratchet is not a reason to turn it back
  const epochs = [...record.epochs];
  let state = { groupId: record.groupId, ...head };
  while (state.epoch < today) {
    state = await advanceGroupEpoch(state);
    epochs.push({ epoch: state.epoch, generation: state.generation, key: state.key });
  }
  // WHAT IS PRUNED IS WHAT WAS READ [audit 2026-09-05, round 1]. The window is three days of lanes a pass reads
  // every time; a day older than that leaves the window ONLY once a pass has read it. This used to prune by age
  // alone, so a device away longer than the window derived the keys of the days it missed and threw them away in
  // the same call, before any pass could read those days — messages on chain for a year, unreadable for good, and
  // nothing said. The design promised the opposite. `keepUnread` bounds how many missed days are carried (the
  // oldest fall off first — they are also the ones closest to leaving the chain), and a pass reads a few of them a
  // tick until none are left.
  const floor = today - Math.max(0, Number(windowDays));
  const kept = epochs.filter((e) => e.epoch >= floor || e.read !== true);
  const unreadOld = kept.filter((e) => e.epoch < floor);
  const drop = Math.max(0, unreadOld.length - Math.max(0, Number(keepUnread)));
  const dropped = new Set(unreadOld.slice(0, drop));
  return { ...record, epochs: kept.filter((e) => !dropped.has(e)) };
}

/** How many missed days (older than the window, not yet read) a device carries until a pass reads them. */
export const GROUP_UNREAD_DAYS_KEPT = 30;
/** How many of those a single pass reads on top of the window — the lanes of a thousand members per day is a batch. */
export const GROUP_UNREAD_DAYS_PER_PASS = 4;

/** The epochs a pass should read now: the window, plus the oldest few missed days still unread. */
export function groupEpochsToRead(record, nowSec, { windowDays = GROUP_WINDOW_DAYS, unreadPerPass = GROUP_UNREAD_DAYS_PER_PASS } = {}) {
  const today = groupEpochFromSeconds(nowSec);
  const floor = today - Math.max(0, Number(windowDays));
  const inWindow = record.epochs.filter((e) => e.epoch >= floor);
  const missed = record.epochs.filter((e) => e.epoch < floor && e.read !== true).sort((a, b) => a.epoch - b.epoch);
  return [...missed.slice(0, Math.max(0, Number(unreadPerPass))), ...inWindow];
}

/** Those epochs were read whole this pass: they may leave the window when their day is over. */
export function markGroupEpochsRead(record, epochs) {
  const done = new Set((epochs ?? []).map((e) => `${e.epoch}.${e.generation}`));
  if (done.size === 0) return record;
  return { ...record, epochs: record.epochs.map((e) => (done.has(`${e.epoch}.${e.generation}`) ? { ...e, read: true } : e)) };
}

/**
 * THE SEQ FLOOR THE CHAIN SAYS, folded in [audit 2026-09-05, round 1]. A member's lane has one writer — their
 * devices, plural — and each device counted alone: two phones of one wallet claimed the same seqs, the shard
 * refused the second (13653), and the screen said sent. Every own-lane row a pass reads, and every floor read
 * before a send, raises the counter to the chain's truth; `nextGroupSeq` then claims above it.
 */
export function noteGroupSeqFromRows(record, rows) {
  let next = record;
  for (const row of rows ?? []) {
    if (!sameKey(row.senderGroupKey, record.self)) continue;
    const seq = Number(row.seq);
    if (!Number.isFinite(seq)) continue;
    next = noteGroupSeq(next, { epoch: row.epoch, generation: row.generation, lane: row.roster ? 'roster' : 'daily', seq });
  }
  return next;
}

/**
 * Forget the paging marks of lanes no pass will ask about again — their day left the window. Without this the map
 * grew by one entry per member per day for ever: a room of 1,024 over a year is 373,000 addresses in one IndexedDB
 * record [self-review 2026-09-05, round 2]. What a pass asks about is bounded (the window's lanes plus the roster
 * lanes), and so is this.
 */
export function pruneSeenSeq(record, keepAddresses) {
  const keep = new Set([...(keepAddresses ?? [])].map((a) => String(a).toLowerCase()));
  const held = record.seenSeq ?? {};
  const next = {};
  for (const [address, seq] of Object.entries(held)) if (keep.has(address)) next[address] = seq;
  return Object.keys(next).length === Object.keys(held).length ? record : { ...record, seenSeq: next };
}

/** The highest seq this device has read from a lane address — how deep the next pass pages back to. */
export function noteSeenSeq(record, address, seq) {
  const key = String(address).toLowerCase();
  const held = Number(record.seenSeq?.[key] ?? -1);
  const value = Number(seq);
  if (!Number.isFinite(value) || value <= held) return record;
  return { ...record, seenSeq: { ...(record.seenSeq ?? {}), [key]: value } };
}

/** Lexicographic order of two control stamps ([time, priority, senderHex, seq]); an unknown stamp comes last. */
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

/**
 * Fold a generation change in: the envelope opened, so from this epoch the group lives on a new key. Both states
 * stay in the window for the rest of the day — a removal takes effect at once, and what was written before it
 * under the old key is still readable.
 *
 * TWO CLAIMS ON ONE GENERATION [audit 2026-09-06, round 3]. A generation number is chosen locally (current + 1), so
 * two admins — or two devices of one admin — that each publish a REMOVE-with-rekey before reading the other's row
 * both produce "generation g+1" with unrelated keys, and every member follows whichever row it read first: a fork
 * nobody is told about, the losing admin still an admin in its own eyes and unheard by everyone. The rule that ends
 * it: the chain's EARLIER row wins (`stamp` is the control order of the roster row that carried the envelope), and a
 * SPECULATIVE claim — this device's own, adopted at broadcast before any row was read — loses to any chain row. The
 * loser's entries (its adoption and every day derived from it) are dropped and the winner's adopted at its epoch;
 * the ratchet re-derives the later days from the winner's key. The loser is named in `generationLost` so the
 * runtime can republish what the lost rekey was for.
 */
export function adoptGroupGeneration(record, { epoch, generation, key, stamp = null, speculative = false }) {
  const held = record.epochs.filter((e) => e.generation === generation);
  const same = held.find((e) => sameKey(e.key, key));
  if (same) {
    if (same.speculative === true && !speculative) {
      // the chain confirms this device's own claim
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

/** Every member's group key — the lanes a pass must derive, plus this device's own. */
export function groupMemberPublicKeys(record) {
  const keys = record.members.map((m) => m.groupKey);
  if (record.self && !keys.some((k) => sameKey(k, record.self))) keys.push(record.self);
  return keys;
}

/** The roster key this device holds for `generation`, or null when it never lived in it. */
export function groupRosterKeyFor(record, generation) {
  return record.rosterKeys?.[String(generation)] ?? null;
}

export function noteGroupRosterKey(record, generation, rosterKey) {
  if (!(rosterKey instanceof Uint8Array)) throw new TypeError('a roster key must be a Uint8Array');
  return { ...record, rosterKeys: { ...(record.rosterKeys ?? {}), [String(generation)]: rosterKey } };
}

export function isGroupAdmin(record, groupKey) {
  return record.admins.some((a) => sameKey(a, groupKey));
}

export function groupMember(record, groupKey) {
  return record.members.find((m) => sameKey(m.groupKey, groupKey)) ?? null;
}

/** Remember an invite this device sent, so its candidate is recognised when they announce themselves. */
export function notePendingGroupInvite(record, { wallet = null, keyId = null, name = null, at = 0 }) {
  const already = (record.pendingInvites ?? []).some((invite) => (wallet && invite.wallet === wallet)
    || (keyId && invite.keyId === keyId));
  if (already) return record;
  return { ...record, pendingInvites: [...(record.pendingInvites ?? []), { wallet, keyId, name, at: Number(at) }] };
}

/** The invite a candidate answers, if this device sent one — matched on the identity the invite was aimed at. */
export function matchPendingGroupInvite(record, candidate) {
  return (record.pendingInvites ?? []).find((invite) => (invite.wallet && invite.wallet === candidate.wallet)
    || (invite.keyId && invite.keyId === candidate.keyId)) ?? null;
}

export function clearPendingGroupInvite(record, invite) {
  return { ...record, pendingInvites: (record.pendingInvites ?? []).filter((held) => held !== invite) };
}

/**
 * Someone answered an invite: their group key and who they are, read from the join token in a private
 * conversation. A CANDIDATE and nothing more — the roster is what admits. Already a member, or already waiting:
 * nothing changes.
 */
export function noteGroupCandidate(record, candidate, { at = 0 } = {}) {
  if (!(candidate?.groupKey instanceof Uint8Array)) throw new TypeError('a candidate needs a groupKey');
  if (groupMember(record, candidate.groupKey)) return record;
  if ((record.candidates ?? []).some((held) => sameKey(held.groupKey, candidate.groupKey))) return record;
  return {
    ...record,
    candidates: [...(record.candidates ?? []), {
      groupKey: candidate.groupKey,
      wallet: candidate.wallet ?? null,
      keyId: candidate.keyId ?? null,
      name: candidate.name ?? null,
      x25519PublicKey: candidate.x25519PublicKey ?? null,
      mlKem768PublicKey: candidate.mlKem768PublicKey ?? null,
      at: Number(at),
    }],
  };
}

export function clearGroupCandidate(record, groupKey) {
  return { ...record, candidates: (record.candidates ?? []).filter((held) => !sameKey(held.groupKey, groupKey)) };
}

/** The seq this device's next capsule of that (epoch, generation) takes. One writer per lane: its own devices. */
/** `lane` is 'daily' (the member's message lane) or 'roster' (an admin's roster lane): two shards, two seq spaces. */
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

/** The order every device must agree on: the chain's stamp when we have it, the sender's when we do not. */
export function controlOrder(row) {
  const stamped = Number(row.createdAt ?? NaN);
  const claimed = Number(row.payload?.sentAt ?? NaN);
  return [Number.isFinite(stamped) ? stamped : claimed, Number.isFinite(stamped) ? 0 : 1, hex(row.senderGroupKey ?? new Uint8Array()), Number(row.seq ?? 0)];
}

function beforeOther(a, b) {
  const [at, ap, ak, as] = controlOrder(a);
  const [bt, bp, bk, bs] = controlOrder(b);
  if (at !== bt) return at < bt;
  if (ap !== bp) return ap < bp;             // a chain-stamped row beats a merely claimed one
  if (ak !== bk) return ak < bk;
  return as < bs;                            // two rows of one writer in one transfer share a stamp: the lane's seq orders them
}

/**
 * Fold what a pass read into the record. Returns the new record, the TEXT messages in order, and the generation
 * changes the caller must act on (opening an envelope needs this device's KeyShard secrets, which this module
 * deliberately never sees).
 */
/** One folded control row, as the log keeps it: enough to replay its effect after a snapshot that did not see it. */
function logEntryOf(row, effect) {
  return {
    kind: row.kind, sender: hex(row.senderGroupKey ?? new Uint8Array()), epoch: Number(row.epoch), seq: Number(row.seq ?? 0),
    stamp: controlOrder(row), ...effect,
  };
}

function appendControlLog(record, entry) {
  const held = record.controlLog ?? [];
  if (held.some((e) => e.sender === entry.sender && e.epoch === entry.epoch && e.seq === entry.seq && e.kind === entry.kind)) return record;
  const log = [...held, entry].sort((a, b) => (stampBefore(a.stamp, b.stamp) ? -1 : 1));
  return { ...record, controlLog: log.length > GROUP_CONTROL_LOG_MAX ? log.slice(log.length - GROUP_CONTROL_LOG_MAX) : log };
}

/** Did the snapshot's `asOf` cover this delta? (A LEAVE rides a member's daily lane: never covered, always replayed — idempotent.) */
function coveredByAsOf(asOf, entry) {
  if (entry.kind === GROUP_KIND.LEAVE) return false;
  const at = asOf?.[entry.sender];
  if (!at) return false;
  return entry.epoch < Number(at.epoch) || (entry.epoch === Number(at.epoch) && entry.seq <= Number(at.seq));
}

/** Re-apply a logged delta's effect on the membership (after a snapshot that did not include it). */
function replayEntry(next, entry) {
  switch (entry.kind) {
    case GROUP_KIND.ADMIT: {
      const added = (entry.members ?? []).map(memberFromLog).filter((m) => m && !groupMember(next, m.groupKey));
      return added.length === 0 ? next : { ...next, members: [...next.members, ...added] };
    }
    case GROUP_KIND.REMOVE:
    case GROUP_KIND.LEAVE: {
      const gone = (entry.keys ?? []).map(unhexSafe).filter(Boolean);
      return {
        ...next,
        members: next.members.filter((m) => !gone.some((k) => sameKey(k, m.groupKey))),
        admins: next.admins.filter((a) => !gone.some((k) => sameKey(k, a))),
      };
    }
    case GROUP_KIND.ADMIN: {
      const admins = (entry.admins ?? []).map(unhexSafe).filter(Boolean);
      return admins.length === 0 ? next : { ...next, admins };
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

/** Per admin, the highest (epoch, seq) roster row this device has folded — what a snapshot it takes says it saw. */
export function noteRosterSeen(record, rows) {
  let seen = record.rosterSeen ?? {};
  let changed = false;
  for (const row of rows ?? []) {
    if (!row?.roster || !(row.senderGroupKey instanceof Uint8Array)) continue;
    const admin = hex(row.senderGroupKey);
    const epoch = Number(row.epoch); const seq = Number(row.seq ?? 0);
    const held = seen[admin];
    if (held && (held.epoch > epoch || (held.epoch === epoch && held.seq >= seq))) continue;
    if (!changed) { seen = { ...seen }; changed = true; }
    seen[admin] = { epoch, seq };
  }
  return changed ? { ...record, rosterSeen: seen } : record;
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
    switch (row.kind) {
      case GROUP_KIND.ROSTER: {
        if (!fromAdmin) break;
        // KEYS THAT ARE NOT POINTS ARE DROPPED HERE TOO [audit 2026-09-06, round 3]: an admin row naming one used to
        // fold and persist, and every device's next pass threw in its roster-lane derivation, for good.
        const members = row.payload.members.filter((m) => isValidGroupKey(m.groupKey)).map((m) => ({ ...m }));
        const admins = row.payload.admins.filter((a) => isValidGroupKey(a));
        if (admins.length === 0) break;   // a room without an admin is not a state a roster may put us in
        next = {
          ...next,
          name: row.payload.name ?? next.name,
          sizeHint: row.payload.sizeHint ?? next.sizeHint,
          // A roster is published WHOLE, so a client too old to know about pictures would drop one by writing a
          // roster without it. `?? next.avatar` keeps what is known until a roster actually names another.
          avatar: row.payload.avatar ?? next.avatar,
          members,
          admins,
          candidates: (next.candidates ?? []).filter((c) => !members.some((m) => sameKey(m.groupKey, c.groupKey))),
        };
        // THE DELTAS THE SNAPSHOT DID NOT SEE ARE REPLAYED [round 3]: a roster is wholesale and stamped later than
        // rows its publisher had not read; without this an ADMIT from another admin vanished under it and a REMOVE
        // came undone. `asOf` names what the publisher had folded per admin lane; everything beyond it is applied
        // again, in stamp order (idempotent effects — an ADMIT of a present member, a REMOVE of an absent one, change nothing).
        for (const entry of next.controlLog ?? []) {
          if (coveredByAsOf(row.payload.asOf, entry)) continue;
          next = replayEntry(next, entry);
        }
        break;
      }
      case GROUP_KIND.ADMIT: {
        if (!fromAdmin) break;
        const added = (row.payload.members ?? []).filter((m) => isValidGroupKey(m.groupKey) && !groupMember(next, m.groupKey));
        next = appendControlLog(next, logEntryOf(row, { members: (row.payload.members ?? []).filter((m) => isValidGroupKey(m.groupKey)).map(memberToLog) }));
        if (added.length === 0) break;
        next = {
          ...next,
          members: [...next.members, ...added.map((m) => ({ ...m }))],
          candidates: (next.candidates ?? []).filter((c) => !added.some((m) => sameKey(m.groupKey, c.groupKey))),
        };
        break;
      }
      case GROUP_KIND.PROFILE:
        if (!fromAdmin) break;
        next = {
          ...next,
          ...('name' in row.payload ? { name: row.payload.name ?? next.name } : {}),
          ...('sizeHint' in row.payload ? { sizeHint: row.payload.sizeHint ?? next.sizeHint } : {}),
          // an explicit null here REMOVES the picture; a profile that says nothing about it leaves it alone
          ...('avatar' in row.payload ? { avatar: row.payload.avatar } : {}),
        };
        break;
      case GROUP_KIND.LEAVE:
        // Only about THEMSELVES: the lane proved who wrote it, so a leave naming someone else is a forgery.
        if (!sameKey(row.senderGroupKey, row.payload.groupKey)) break;
        // A LEAVER LEAVES THE ADMIN SET TOO [audit 2026-09-05, round 2]. Dropping them from `members` alone left every
        // device reading their roster lane and obeying ROSTER/ADMIT/REMOVE/ADMIN from a key the interface showed as
        // gone — a departed admin could take the room from outside it, weeks later, with a rekey wrapped to friends.
        next = {
          ...next,
          members: next.members.filter((m) => !sameKey(m.groupKey, row.payload.groupKey)),
          admins: next.admins.filter((a) => !sameKey(a, row.payload.groupKey)),
        };
        next = appendControlLog(next, logEntryOf(row, { keys: [hex(row.payload.groupKey)] }));
        if (sameKey(row.payload.groupKey, next.self)) next = { ...next, leftAt: Number(row.payload.sentAt ?? 0) };
        break;
      case GROUP_KIND.REMOVE:
        if (!fromAdmin) break;
        next = {
          ...next,
          members: next.members.filter((m) => !sameKey(m.groupKey, row.payload.groupKey)),
          admins: next.admins.filter((a) => !sameKey(a, row.payload.groupKey)),
        };
        next = appendControlLog(next, logEntryOf(row, { keys: [hex(row.payload.groupKey)] }));
        // THE REMOVED ARE TOLD [audit 2026-09-06, round 3]: this device's own removal used to set nothing, so the
        // thread stayed writable, its echoes confirmed from a lane nobody else derived, and a re-invite was refused as
        // "already in". Removal reads as having left: read-only history, and a fresh invite is a way back in.
        if (sameKey(row.payload.groupKey, next.self)) {
          next = { ...next, leftAt: Number(row.createdAt ?? row.payload.sentAt ?? 0) || Number(row.payload.sentAt ?? 0), removedAt: Number(row.payload.sentAt ?? 0) };
        }
        if (row.payload.envelope) {
          // the row's chain order rides with the envelope, so a competing rekey of the same generation is settled
          // by the earlier row (adoptGroupGeneration)
          rekeys.push({ generation: row.payload.generation, envelope: row.payload.envelope, epoch: row.epoch, stamp: controlOrder(row), sender: row.senderGroupKey });
        }
        break;
      case GROUP_KIND.ADMIN: {
        if (!fromAdmin) break;
        // WHOLESALE, never additive: a revoked key must not survive because nobody remembered to name it — but a
        // key that is not a point does not enter, and a set left empty by that is refused [round 3].
        const admins = row.payload.admins.filter((a) => isValidGroupKey(a));
        if (admins.length === 0) break;
        next = appendControlLog({ ...next, admins }, logEntryOf(row, { admins: admins.map(hex) }));
        break;
      }
      default:
        break;
    }
  }
  messages.sort((a, b) => Number(a.payload?.sentAt ?? 0) - Number(b.payload?.sentAt ?? 0));
  return { record: next, messages, rekeys };
}

// ── A CONTROL WRITE IS BELIEVED AT BROADCAST AND TAKEN BACK BY THE FOLD [audit 2026-09-06, round 3] ────────────
//
// Every roster publish (ADMIT, REMOVE, ADMIN, ROSTER, PROFILE) used to persist its effect the moment the wallet
// external was queued. A refused write — 13653 from a sibling device inside the hop window, a squat due above the
// cushion, a dropped external — left the admin's device on a generation no member held, reading roster lanes nobody
// wrote, with the interface saying "removed" or "admitted". Now the effect is applied for the screen, remembered here
// with what it takes to undo it, and either CONFIRMED (the pass reads this device's own row back) or REVERTED once
// the own roster lane has been read clean past GROUP_CONTROL_CONFIRM_S without it.

export function notePendingControl(record, entry) {
  return { ...record, pendingControl: [...(record.pendingControl ?? []), { ...entry, at: Number(entry.at ?? 0) }] };
}

/**
 * Settle what this device published: `rosterRows` are the roster rows a pass read (own rows confirm), `cleanEpochs`
 * the epochs whose OWN roster lane was read clean this pass (a miss there past the window reverts), `nowSec` the clock.
 */
export function settlePendingControl(record, { rosterRows = [], cleanEpochs = [], nowSec = 0, confirmAfterS = GROUP_CONTROL_CONFIRM_S } = {}) {
  const pending = record.pendingControl ?? [];
  if (pending.length === 0) return { record, reverted: [] };
  const own = new Set((rosterRows ?? [])
    .filter((row) => row?.roster && sameKey(row.senderGroupKey, record.self))
    .map((row) => `${Number(row.epoch)}.${Number(row.seq)}`));
  const clean = new Set((cleanEpochs ?? []).map(Number));
  let next = record;
  const keep = [];
  const reverted = [];
  for (const entry of pending) {
    if (own.has(`${Number(entry.epoch)}.${Number(entry.seq)}`)) continue;                      // confirmed: the chain shows it
    const overdue = Number(nowSec) - Number(entry.at ?? 0) > Number(confirmAfterS);
    if (!(overdue && clean.has(Number(entry.epoch)))) { keep.push(entry); continue; }            // still in flight, or the lane unread
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
  switch (entry.kind) {
    case GROUP_KIND.ADMIT: {
      const added = (entry.members ?? []).map(memberFromLog).filter(Boolean);
      next = {
        ...next,
        members: next.members.filter((m) => !added.some((a) => sameKey(a.groupKey, m.groupKey))),
        candidates: [...(next.candidates ?? []), ...added.filter((a) => !(next.candidates ?? []).some((c) => sameKey(c.groupKey, a.groupKey))).map((a) => ({ ...a, at: Number(entry.at ?? 0) }))],
        admitsSinceSnapshot: Math.max(0, Number(next.admitsSinceSnapshot ?? 0) - added.length),
      };
      break;
    }
    case GROUP_KIND.REMOVE: {
      const victim = entry.victim ? memberFromLog(entry.victim) : null;
      if (victim && !groupMember(next, victim.groupKey)) next = { ...next, members: [...next.members, victim] };
      if (victim && entry.victimWasAdmin && !isGroupAdmin(next, victim.groupKey)) next = { ...next, admins: [...next.admins, victim.groupKey] };
      if (entry.rekey) {
        const lostKey = unhexSafe(entry.rekey.key);
        next = {
          ...next,
          epochs: next.epochs.filter((e) => !(e.generation === Number(entry.rekey.generation) && lostKey && sameKey(e.key, lostKey))),
          rosterKeys: Object.fromEntries(Object.entries(next.rosterKeys ?? {}).filter(([g]) => Number(g) !== Number(entry.rekey.generation))),
        };
        if ('snapshot' in revert) next = { ...next, snapshot: revert.snapshot ?? null };
        if ('admitsSinceSnapshot' in revert) next = { ...next, admitsSinceSnapshot: Number(revert.admitsSinceSnapshot ?? 0) };
        if ('rosterCursor' in revert) next = { ...next, rosterCursor: revert.rosterCursor ?? next.rosterCursor };
      }
      break;
    }
    case GROUP_KIND.ADMIN:
      if (Array.isArray(revert.admins)) next = { ...next, admins: revert.admins.map(unhexSafe).filter(Boolean) };
      break;
    case GROUP_KIND.ROSTER:
      if ('snapshot' in revert) next = { ...next, snapshot: revert.snapshot ?? null };
      if ('admitsSinceSnapshot' in revert) next = { ...next, admitsSinceSnapshot: Number(revert.admitsSinceSnapshot ?? 0) };
      break;
    case GROUP_KIND.PROFILE:
      if ('avatar' in revert) next = { ...next, avatar: revert.avatar ?? null };
      if ('name' in revert) next = { ...next, name: revert.name ?? null };
      if ('sizeHint' in revert) next = { ...next, sizeHint: Number(revert.sizeHint ?? next.sizeHint) };
      break;
    default:
      break;
  }
  return next;
}

/** A member in the log's storage form, for a pending entry's `victim`/`members`. */
export function memberForLog(member) { return memberToLog(member); }

/**
 * What a removal would do and what it would cost. `stays` is who the envelope must be wrapped to; `bytes` is the
 * envelope's size, which is what prices the message — the dialog shows this before anything is signed, because in
 * a room of a thousand the reading half of a removal buys little and costs a great deal.
 */
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

// ── storage form ───────────────────────────────────────────────────────────────────────────────────────────

export function serializeGroupRecord(record) {
  return {
    v: 1,
    groupId: hex(record.groupId),
    name: record.name,
    sizeHint: record.sizeHint,
    avatar: record.avatar ? { ...record.avatar } : null,
    self: record.self ? hex(record.self) : null,
    admins: record.admins.map(hex),
    members: record.members.map((m) => ({
      groupKey: hex(m.groupKey),
      wallet: m.wallet ?? null,
      keyId: m.keyId ?? null,
      name: m.name ?? null,
      x: m.x25519PublicKey ? hex(m.x25519PublicKey) : null,
      k: m.mlKem768PublicKey ? hex(m.mlKem768PublicKey) : null,
    })),
    epochs: record.epochs.map((e) => ({
      epoch: e.epoch, generation: e.generation, key: hex(e.key),
      ...(e.read === true ? { read: true } : {}),
      ...(e.speculative === true ? { speculative: true } : {}),
      ...(Array.isArray(e.stamp) ? { stamp: e.stamp.map((v) => (typeof v === 'number' ? v : String(v))) } : {}),
    })),
    rosterKeys: Object.fromEntries(Object.entries(record.rosterKeys ?? {}).map(([g, k]) => [g, hex(k)])),
    snapshot: record.snapshot ? { ...record.snapshot, admin: hex(record.snapshot.admin) } : null,
    snapshotApplied: record.snapshotApplied !== false,
    admitsSinceSnapshot: Number(record.admitsSinceSnapshot ?? 0),
    rosterCursor: record.rosterCursor ?? null,
    seqHighWater: { ...record.seqHighWater },
    seenSeq: { ...record.seenSeq },
    pendingInvites: (record.pendingInvites ?? []).map((invite) => ({ ...invite })),
    candidates: (record.candidates ?? []).map((c) => ({
      groupKey: hex(c.groupKey), wallet: c.wallet ?? null, keyId: c.keyId ?? null, name: c.name ?? null,
      x: c.x25519PublicKey ? hex(c.x25519PublicKey) : null, k: c.mlKem768PublicKey ? hex(c.mlKem768PublicKey) : null,
      at: Number(c.at ?? 0),
    })),
    leftAt: record.leftAt ?? null,
    removedAt: record.removedAt ?? null,
    controlLog: (record.controlLog ?? []).map((e) => ({ ...e })),
    pendingControl: (record.pendingControl ?? []).map((e) => ({ ...e })),
    rosterSeen: { ...(record.rosterSeen ?? {}) },
    generationLost: (record.generationLost ?? []).map((g) => ({ generation: g.generation, key: hex(g.key) })),
    lastControlFailure: record.lastControlFailure ? { ...record.lastControlFailure } : null,
  };
}

export function parseGroupRecord(stored) {
  if (Number(stored?.v) !== 1) throw new RangeError(`unsupported group record version ${stored?.v}`);
  return {
    groupId: unhex(stored.groupId),
    name: stored.name ?? null,
    sizeHint: Number(stored.sizeHint ?? GROUP_SIZE_GROUP),
    avatar: stored.avatar ? { ...stored.avatar } : null,
    self: stored.self ? unhex(stored.self) : null,
    admins: (stored.admins ?? []).map(unhex),
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
      ...(e.read === true ? { read: true } : {}),
      ...(e.speculative === true ? { speculative: true } : {}),
      ...(Array.isArray(e.stamp) ? { stamp: [...e.stamp] } : {}),
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
    rosterCursor: stored.rosterCursor === undefined || stored.rosterCursor === null ? null : Number(stored.rosterCursor),
    seqHighWater: { ...(stored.seqHighWater ?? {}) },
    seenSeq: { ...(stored.seenSeq ?? {}) },
    pendingInvites: (stored.pendingInvites ?? []).map((invite) => ({ ...invite })),
    candidates: (stored.candidates ?? []).map((c) => ({
      groupKey: unhex(c.groupKey), wallet: c.wallet ?? null, keyId: c.keyId ?? null, name: c.name ?? null,
      x25519PublicKey: c.x ? unhex(c.x) : null, mlKem768PublicKey: c.k ? unhex(c.k) : null, at: Number(c.at ?? 0),
    })),
    leftAt: stored.leftAt ?? null,
    removedAt: stored.removedAt ?? null,
    controlLog: (stored.controlLog ?? []).map((e) => ({ ...e })),
    pendingControl: (stored.pendingControl ?? []).map((e) => ({ ...e })),
    rosterSeen: { ...(stored.rosterSeen ?? {}) },
    generationLost: (stored.generationLost ?? []).map((g) => ({ generation: Number(g.generation), key: unhex(g.key) })),
    lastControlFailure: stored.lastControlFailure ? { ...stored.lastControlFailure } : null,
  };
}
