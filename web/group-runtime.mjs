// PLATHO — the orchestration of private groups: create, invite, send, sync, leave, remove. Everything the app
// does with a group goes through here, so app.js keeps only the rendering and this stays testable without a DOM.
// The rules live next door (group-store.mjs); the crypto two doors down (crypto/group-lane.mjs); the design in
// contracts18/docs/DESIGN-private-groups.md.
//
// EVERY DEPENDENCY IS INJECTED, and that is not ceremony: a group's whole engine can then be exercised against
// fakes in an ordinary test, which is the only way the sequences below (a removal is a rekey the caller may
// decline; a payload is as many capsules as it needs; a newcomer is admitted from a token read in a private
// conversation) can be checked at all without a chain.
//
// WHAT THIS MODULE REFUSES TO DECIDE:
//   * whether a removal also cuts READING. It prices both halves and hands the answer to the caller, because in a
//     room of a thousand the second half buys little and costs a great deal — the person, not the code, chooses.
//   * whether a departed member "lost access". They did not, and nothing here will say they did.

import {
  GROUP_KIND, GROUP_AVATAR_HEADER_BYTES, encodeGroupAdmins, encodeGroupAdmit, encodeGroupAvatar, encodeGroupJoinToken,
  encodeGroupLeave, encodeGroupProfile, encodeGroupRemove, encodeGroupRoster, encodeGroupText, groupAvatarHash,
  groupCapsulePlan, groupRekeyEnvelopeBytes, openGroupRekeyEnvelope, sealGroupRekeyEnvelope, isValidMemberKeys,
} from './group-protocol.mjs?v=9';
import {
  advanceGroupWindow, adoptGroupGeneration, applyGroupRows, clearPendingGroupInvite, createGroupRecord,
  currentGroupEpoch, groupMemberPublicKeys, groupRemovalPlan, groupRosterKeyFor, isGroupAdmin, matchPendingGroupInvite,
  nextGroupSeq, noteGroupCandidate, noteGroupRosterKey, noteGroupSeq, notePendingGroupInvite, parseGroupRecord,
  serializeGroupRecord, GROUP_SIZE_GROUP, groupEpochsToRead, markGroupEpochsRead, noteGroupSeqFromRows, noteSeenSeq, pruneSeenSeq,
  groupMember, memberForLog, notePendingControl, noteRosterSeen, settlePendingControl,
} from './group-store.mjs?v=10';
import {
  createGroupFounding, groupEpochFromSeconds, groupMemberPublicKey, groupMemberSeed, groupRosterKey, rekeyGroup,
  isValidGroupKey, GROUP_EPOCH_SECONDS, GROUP_KEY_BYTES, GROUP_MAX_RATCHET_STEPS,
} from './crypto/group-lane.mjs?v=5';

/**
 * The roster lanes of the generation that ended within the last two days, from the day it ended — read beside
 * today's [audit 2026-09-06, round 3]. A competing rekey published in the OLD generation's roster lane within a hop
 * of this device's own would otherwise never be read after this device adopted its own claim, and the loser of that
 * race would never learn it lost: an admin unheard by everyone, still an admin in its own eyes.
 */
function rosterReadsOfPreviousGeneration(record, today) {
  const previousGeneration = Number(today.generation) - 1;
  const rosterKey = groupRosterKeyFor(record, previousGeneration);
  if (!rosterKey) return [];
  const adopted = record.epochs.filter((e) => Number(e.generation) === Number(today.generation)).map((e) => Number(e.epoch));
  if (adopted.length === 0) return [];
  const adoptionEpoch = Math.min(...adopted);
  if (adoptionEpoch < Number(today.epoch) - 2) return [];
  const epochs = [];
  for (let e = adoptionEpoch; e <= Number(today.epoch); e += 1) epochs.push(e);
  return [{ rosterKey, generation: previousGeneration, epochs }];
}
import { buildGroupAvatarPublishMessages, buildGroupPublishMessages } from './group-lane-send.mjs?v=13';
import { createGroupReadLane, groupLaneBuckets, groupRosterBuckets } from './group-lane-read.mjs?v=11';
import { generationForEpochAt } from './cutover-epoch.mjs?v=4';

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const sameKey = (a, b) => a instanceof Uint8Array && b instanceof Uint8Array && hex(a) === hex(b);

function randomEntropy(random) {
  if (typeof random === 'function') return random(32);
  const out = new Uint8Array(32);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/**
 * `identity` is this device's own material:
 *   { vaultSeed, wallet, keyId, x25519SecretKey, x25519PublicKey, mlKem768SecretKey, mlKem768PublicKey }
 * — the same values the messaging identity already derives from the wallet seed. The group SIGNING key is derived
 * from the vault seed per group, so a restored wallet is the same member again and nothing extra is backed up.
 *
 * `send(messages)` takes the wallet-message forms this module builds and returns when they are signed and sent;
 * `vaultRouting()` answers { vaultAddress, feeDue } exactly as the private lane's does.
 */
export function createGroupRuntime({
  store, identity, send, vaultRouting, readMessagesWithSource, readStates, readLastSeq = null,
  publishValue, now = () => Math.floor(Date.now() / 1000), boundary, random = null, onError = null,
  lane: injectedLane = null,
}) {
  if (!store) throw new Error('createGroupRuntime requires a record store');
  if (typeof send !== 'function') throw new Error('createGroupRuntime requires send()');
  // The lane is injectable for the same reason the read lane takes its reader: the one branch of a sync that
  // cannot be reached without a chain is the rekey envelope a removal leaves behind. Production passes nothing.
  const lane = injectedLane ?? createGroupReadLane({ readMessagesWithSource });
  const records = new Map();          // groupId hex -> record
  const note = (where, error) => { try { onError?.(where, error); } catch { /* a listener must not break a pass */ } };

  const persist = async (record) => {
    records.set(hex(record.groupId), record);
    try { await store.put(hex(record.groupId), serializeGroupRecord(record)); } catch (error) { note('persist', error); }
    return record;
  };

  /**
   * THE RECORD AS OF TODAY, before anything is published from it [audit 2026-09-05, round 1]. The ratchet is turned
   * only by a pass, and a pass can be a day behind (the app was backgrounded across midnight; the last pass died on
   * a 429). Publishing from a stale record put the capsule in YESTERDAY's lane — and, on a removal, derived the new
   * generation's key at today's epoch while writing it into yesterday's roster lane, so readers adopted it a day
   * early and walked it one step further than the admin did: two keys, one group, no error anywhere.
   */
  const getFresh = async (groupId) => {
    const record = records.get(String(groupId));
    if (!record) return null;
    const advanced = await advanceGroupWindow(record, now());
    return advanced === record ? record : persist(advanced);
  };

  /**
   * THE FLOOR THE CHAIN SAYS, once per lane-day [audit 2026-09-05, round 1]. A member's lane has one writer — their
   * devices, plural, each counting alone — so the first claim this device makes in a lane-day reads the shard's
   * `last_seq` and folds it in, exactly as the private lane does on its cold start. A failed read THROWS: claiming
   * blind below a committed seq is refused by the shard (13653) with the value bounced and the message lost, and
   * the private lane learned that the hard way. Absence (no shard yet) is floor 0.
   */
  const withChainFloor = async (record, state, buckets, { always = false } = {}) => {
    // `live`: the lane already holds a record on chain (this device wrote to it, or the floor said so) — its StateInit
    // need not ride again [audit 2026-09-05, round 2].
    if (nextGroupSeq(record, state) > 1 && !always) return { record, live: true };
    if (typeof readLastSeq !== 'function') return { record, live: nextGroupSeq(record, state) > 1 };
    const [bucket] = await buckets();
    if (!bucket) return { record, live: false };
    // A CONTROL PUBLISH READS THE FLOOR EVERY TIME (`always`) [audit 2026-09-05, round 2]: roster writes are rare and
    // an admin's two devices both hold a counter above zero, so "once per lane-day" left them colliding at 13653 with
    // the membership change believed at broadcast. One getter per admission is cheap; a fork is not.
    const floor = Number(await readLastSeq(bucket.address));
    const known = Number.isFinite(floor) && floor > 0 ? noteGroupSeq(record, { ...state, seq: floor }) : record;
    return { record: known, live: nextGroupSeq(known, state) > 1 };
  };

  /**
   * THE DOOR FOLLOWS THE GENERATION, exactly as it does for a private message: clean-17's RecordShard has only the
   * direct door and clean-18's only the vault one, and the epoch is what says which shard this is. A group is
   * therefore usable BEFORE the flip — it is an ordinary CONV lane with a blinded write key — and moves to the
   * discounted door on the same day every private message does, with no group-side change at all.
   */
  const doorArgs = async (epoch) => {
    const common = { value: publishValue, ...(boundary === undefined ? {} : { boundary }) };
    if (generationForEpochAt(Number(epoch), boundary) < 18) return { ...common, door: 'direct' };
    const routing = await vaultRouting();
    // `deployVault` rides to the sender: a payer with no vault yet has one deployed by the same transfer, as the
    // private funnel does (prepareConvLaneParts) — a group send is not special [audit 2026-09-05, round 1].
    return { ...common, door: 'vault', vaultAddress: routing.vaultAddress, feeDue: routing.feeDue, deployVault: routing.deployVault === true };
  };
  /** What the sender must know beside the messages: the door, and whether the vault has to be created first. */
  const routeOf = (args) => ({ door: args.door, vaultAddress: args.vaultAddress ?? null, deployVault: args.deployVault === true });

  /**
   * One payload from this device into its own lane of the group's current (epoch, generation): as many capsules
   * as the payload needs, consecutive seqs, to be signed together. Answers the messages and where the lane's seq
   * now stands — `lastSeq` is what the record must remember.
   */
  const publish = async (given, kind, payload) => {
    const state = { groupId: given.groupId, ...currentGroupEpoch(given) };
    const { record, live } = await withChainFloor(given, state, () => groupLaneBuckets({ state, memberPublicKeys: [given.self], boundary }));
    const memberSeed = await groupMemberSeed({ vaultSeed: identity.vaultSeed, groupId: record.groupId });
    const firstSeq = nextGroupSeq(record, state);
    const args = await doorArgs(state.epoch);
    const built = await buildGroupPublishMessages({ state, memberSeed, kind, payload, firstSeq, sentAt: now(), ...args, attachStateInit: !live });
    return { messages: built.messages, firstSeq, lastSeq: built.lastSeq, count: built.count, wireBytes: built.wireBytes, state, record, route: routeOf(args) };
  };

  /**
   * The picture into the group's shared avatar lane — same door, same price, same generation rule as any capsule.
   * Only the key and the lane differ, and both come from the group id, so a member who joined this morning can
   * read a picture published a year ago.
   */
  const publishAvatar = async (record, epoch, payload, firstSeq) => buildGroupAvatarPublishMessages({
    groupId: record.groupId, epoch, payload, firstSeq, sentAt: now(), ...(await doorArgs(epoch)),
  });

  /** How stale a snapshot may get before an invite takes a fresh one: admissions since it, or days since it. */
  const SNAPSHOT_MAX_ADMITS = 16;
  const SNAPSHOT_MAX_DAYS = 14;

  /**
   * One payload from this ADMIN into its ROSTER lane: the daily lane's own construction under the generation's
   * roster key (crypto/group-lane.mjs groupRosterKey), so everyone in the generation — the member who joined this
   * morning included — can read it on any day of the generation, and a member removed by a rekey cannot read what
   * comes after. Membership travels here; messages stay in the daily lanes.
   */
  const publishRoster = async (given, kind, payload) => {
    const current = currentGroupEpoch(given);
    const rosterKey = groupRosterKeyFor(given, current.generation);
    if (!rosterKey) throw new Error('this device holds no roster key for the current generation');
    const state = { groupId: given.groupId, key: rosterKey, epoch: current.epoch, generation: current.generation, lane: 'roster' };
    const { record, live } = await withChainFloor(given, state, () => groupRosterBuckets({
      rosterKey, groupId: given.groupId, generation: current.generation, epochs: [current.epoch], adminPublicKeys: [given.self], boundary,
    }), { always: true });
    const memberSeed = await groupMemberSeed({ vaultSeed: identity.vaultSeed, groupId: record.groupId });
    const firstSeq = nextGroupSeq(record, state);
    const args = await doorArgs(state.epoch);
    const built = await buildGroupPublishMessages({ state, memberSeed, kind, payload, firstSeq, sentAt: now(), ...args, attachStateInit: !live });
    return { messages: built.messages, firstSeq, lastSeq: built.lastSeq, count: built.count, wireBytes: built.wireBytes, state, record, route: routeOf(args) };
  };

  const unhexBytes = (text) => Uint8Array.from((String(text).match(/../g) ?? []).map((b) => parseInt(b, 16)));

  // ONE MUTATION AT A TIME PER GROUP [audit 2026-09-05, round 2]. Every publisher below reads the record, claims a seq
  // and persists; a pass reads the record, folds a day of rows and persists. Two of them in flight on one group were
  // last-writer-wins: a pass that started before a send persisted without the send's seq bump, and the next send
  // claimed the same seq (13653, the message lost); two Enter presses a second apart claimed one seq from one record.
  // A per-group promise chain serialises them — a send during a pass waits for the pass, then reads the fresh record.
  const chains = new Map();
  const locked = (groupId, fn) => {
    const key = String(groupId);
    const previous = chains.get(key) ?? Promise.resolve();
    const next = previous.then(fn, fn);
    chains.set(key, next.catch(() => {}));
    return next;
  };
  // `noteCandidate` admits a matched invitee from INSIDE its own turn of the lock; it calls the unlocked admit, or
  // it would wait on itself. The pass republishes a lost rekey the same way.
  let admitUnlocked = null;
  let removeUnlocked = null;

  /**
   * A REKEY THIS DEVICE LOST TO AN EARLIER ONE IS PUBLISHED AGAIN [audit 2026-09-06, round 3]. The removal it carried
   * still stands (every fold dropped the member), but the winning admin's envelope may have been wrapped to the very
   * member this device removed — they hold the winning key. So the cut is made again, from the winning generation.
   */
  const republishLostRekeys = async (record) => {
    const lost = record.generationLost ?? [];
    if (lost.length === 0) return record;
    const lostRekeys = (record.pendingControl ?? []).filter((e) => e.kind === GROUP_KIND.REMOVE && e.rekey
      && lost.some((l) => Number(l.generation) === Number(e.rekey.generation) && hex(l.key) === String(e.rekey.key)));
    const victims = lostRekeys.map((e) => e.victim?.groupKey).filter(Boolean);
    let next = await persist({ ...record, generationLost: [], pendingControl: (record.pendingControl ?? []).filter((e) => !lostRekeys.includes(e)) });
    for (const victimHex of victims) {
      try { next = await removeUnlocked(hex(next.groupId), unhexBytes(victimHex), { cutReading: true }); } catch (error) { note('rekey again', error); }
    }
    return records.get(hex(next.groupId)) ?? next;
  };

  const api = {
    /** Every group this device knows, newest window first. */
    list() { return [...records.values()]; },
    get(groupId) { return records.get(String(groupId)) ?? null; },

    /** Load what the last launch left. The epoch keys in here cannot be re-derived — see group-record-store. */
    async load() {
      records.clear();
      let stored = [];
      try { stored = await store.list(); } catch (error) { note('load', error); }
      for (const row of stored) {
        try {
          const record = parseGroupRecord(row);
          records.set(hex(record.groupId), record);
        } catch (error) { note('parse', error); }
      }
      return this.list();
    },

    /**
     * A new group. The creator is its first member and its first admin — and may appoint more at any time, which
     * is the whole answer to "what if the admin is lost" [decided 2026-09-05: no majority override].
     */
    async create({ name = null, sizeHint = GROUP_SIZE_GROUP } = {}) {
      const founding = await createGroupFounding({ entropy: randomEntropy(random), createdAtSec: now() });
      const memberSeed = await groupMemberSeed({ vaultSeed: identity.vaultSeed, groupId: founding.groupId });
      const self = groupMemberPublicKey(memberSeed);
      const me = {
        groupKey: self,
        wallet: identity.wallet ?? null,
        keyId: identity.keyId ?? null,
        name: identity.name ?? null,
        x25519PublicKey: identity.x25519PublicKey ?? null,
        mlKem768PublicKey: identity.mlKem768PublicKey ?? null,
      };
      return persist(createGroupRecord({ founding, name, sizeHint, self, members: [me], admins: [self] }));
    },

    /**
     * THE SECRET AN INVITE CARRIES — the group id, TODAY'S key, the generation's ROSTER key, and where the last
     * SNAPSHOT is. Not the roster itself: an invite must not grow with the room. With the roster key and the
     * pointer the newcomer reads the snapshot and every admission after it, holding no earlier day key.
     */
    secretFor(groupId) {
      const record = this.get(groupId);
      if (!record) throw new Error('no such group');
      const state = currentGroupEpoch(record);
      const rosterKey = groupRosterKeyFor(record, state.generation);
      const snapshot = record.snapshot && Number(record.snapshot.generation) === Number(state.generation) ? record.snapshot : null;
      return {
        groupId: hex(record.groupId),
        key: hex(state.key),
        epoch: state.epoch,
        generation: state.generation,
        name: record.name,
        sizeHint: record.sizeHint,
        inviter: record.self ? hex(record.self) : null,
        rosterKey: rosterKey ? hex(rosterKey) : null,
        snapshot: snapshot
          ? { epoch: snapshot.epoch, generation: snapshot.generation, admin: hex(snapshot.admin), seq: snapshot.seq, parts: snapshot.parts }
          : null,
      };
    },

    /** What `ensureSnapshot` would publish now: null when the last snapshot is still fresh. For the dialog. */
    snapshotPlan(groupId) {
      const record = this.get(groupId);
      if (!record) throw new Error('no such group');
      const current = currentGroupEpoch(record);
      const held = record.snapshot;
      const fresh = held && Number(held.generation) === Number(current.generation)
        && Number(record.admitsSinceSnapshot ?? 0) < SNAPSHOT_MAX_ADMITS
        && (Number(current.epoch) - Number(held.epoch)) < SNAPSHOT_MAX_DAYS;
      if (fresh) return null;
      return groupCapsulePlan(encodeGroupRoster({
        members: record.members, admins: record.admins, name: record.name, sizeHint: record.sizeHint,
        avatar: record.avatar ?? null, sentAt: now(),   // sized as it will be sent: a real timestamp, not a 0 nine bytes shorter
        asOf: record.rosterSeen ?? {},
      }).length);
    },

    /**
     * A SNAPSHOT, when the last one is stale: too many admissions since it, too many days, or another generation.
     * The whole roster in the compact record — 50 members are three capsules, a room of 1024 about 43 — taken by
     * an admin before an invite goes out, so the invite has something to point at. Cheap groups pay it rarely;
     * a room pays it every SNAPSHOT_MAX_ADMITS admissions instead of on every one.
     */
    async ensureSnapshot(groupId) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      if (!isGroupAdmin(record, record.self)) throw new Error('only an admin may take a snapshot');
      const current = currentGroupEpoch(record);
      const held = record.snapshot;
      const fresh = held && Number(held.generation) === Number(current.generation)
        && Number(record.admitsSinceSnapshot ?? 0) < SNAPSHOT_MAX_ADMITS
        && (Number(current.epoch) - Number(held.epoch)) < SNAPSHOT_MAX_DAYS;
      if (fresh) return record;
      const payload = encodeGroupRoster({
        members: record.members, admins: record.admins, name: record.name, sizeHint: record.sizeHint,
        avatar: record.avatar ?? null, sentAt: now(),
        // WHAT THIS SNAPSHOT HAS SEEN [round 3]: per admin lane, the highest row folded — readers replay every delta
        // beyond it after the wholesale roster, so a snapshot taken before another admin's ADMIT was read cannot
        // un-admit
        asOf: record.rosterSeen ?? {},
      });
      const { messages, firstSeq, lastSeq, count, state, record: floored, route } = await publishRoster(record, GROUP_KIND.ROSTER, payload);
      await send(messages, route);
      const snapshot = { epoch: state.epoch, generation: state.generation, admin: record.self, seq: firstSeq, parts: count, at: now() };
      return persist(notePendingControl(noteGroupSeq({ ...floored, snapshot, snapshotApplied: true, admitsSinceSnapshot: 0 }, { ...state, seq: lastSeq }), {
        kind: GROUP_KIND.ROSTER, epoch: state.epoch, generation: state.generation, seq: firstSeq, at: now(),
        revert: { snapshot: record.snapshot ?? null, admitsSinceSnapshot: Number(record.admitsSinceSnapshot ?? 0) },
      }));
    },

    /**
     * Note an invite this device has just sent. NOTHING GOES ON CHAIN HERE, and that is the correction the crypto
     * forces: a member's group key is derived from their OWN vault seed, so an invite has nobody to put in the
     * roster. The person answers with a join token in the same private conversation, and `noteCandidate` admits
     * the ones this device invited — so nobody pays for someone who never showed up.
     */
    async noteInvite(groupId, member) {
      const record = this.get(groupId);
      if (!record) throw new Error('no such group');
      if (!isGroupAdmin(record, record.self)) throw new Error('only an admin may invite');
      return persist(notePendingGroupInvite(record, { ...member, at: now() }));
    },

    /**
     * A group this device was invited into. The day key opens today forward and nothing before it; the roster key
     * opens the generation's membership — the snapshot the invite points at, and every admission after it.
     */
    async adopt(secret, { name = null } = {}) {
      const groupId = unhexBytes(secret.groupId);
      const key = unhexBytes(secret.key);
      // AN INVITE FROM THE DISTANT PAST IS REFUSED, not walked [audit 2026-09-05, round 1]: the ratchet is turned one
      // HKDF per day from the epoch the token names, and a hostile `e` twenty thousand days back cost the invitee
      // that many derivations for a group whose lanes left the chain long ago. The lane keeps a year.
      const today = groupEpochFromSeconds(now());
      if (!Number.isInteger(Number(secret.epoch)) || today - Number(secret.epoch) > GROUP_MAX_RATCHET_STEPS) {
        throw new RangeError(`the invite's epoch ${secret.epoch} is out of the ratchet's reach from ${today}`);
      }
      const memberSeed = await groupMemberSeed({ vaultSeed: identity.vaultSeed, groupId });
      const self = groupMemberPublicKey(memberSeed);
      const generation = Number(secret.generation);
      // A HOSTILE TOKEN PLANTS NO DEAD RECORD [audit 2026-09-06, round 3]: a generation that is not a number, a key of
      // the wrong length, an inviter or a snapshot admin that is not a point were persisted as they came, and every
      // pass from then on threw for that room with nothing in the interface to remove it. Refused at the door.
      if (!Number.isInteger(generation) || generation < 0) throw new RangeError(`the invite names no valid generation (${secret.generation})`);
      if (groupId.length !== GROUP_KEY_BYTES || key.length !== GROUP_KEY_BYTES) throw new RangeError('the invite carries no valid group id or day key');
      const rosterKey = secret.rosterKey ? unhexBytes(secret.rosterKey) : null;
      if (rosterKey && rosterKey.length !== GROUP_KEY_BYTES) throw new RangeError('the invite carries no valid roster key');
      const inviter = secret.inviter ? unhexBytes(secret.inviter) : null;
      if (inviter && !isValidGroupKey(inviter)) throw new RangeError('the invite names an inviter key that is not a point');
      if (secret.snapshot && !isValidGroupKey(unhexBytes(secret.snapshot.admin))) throw new RangeError('the invite points at a snapshot of no valid admin');
      const record = createGroupRecord({
        founding: { groupId, key, epoch: Number(secret.epoch), generation, ...(rosterKey ? { rosterKey } : {}) },
        name: secret.name ?? name,
        sizeHint: Number(secret.sizeHint ?? GROUP_SIZE_GROUP),
        self,
        members: [],
        // the inviter is the one admin known until the snapshot says more — and the one whose roster lane the
        // first pass must read
        admins: inviter ? [inviter] : [],
      });
      const snapshot = secret.snapshot
        ? {
          epoch: Number(secret.snapshot.epoch), generation: Number(secret.snapshot.generation),
          admin: unhexBytes(secret.snapshot.admin), seq: Number(secret.snapshot.seq), parts: Number(secret.snapshot.parts), at: 0,
        }
        : null;
      // NOTHING ON CHAIN. The newcomer's key is said back in the private conversation the invite came in
      // (`joinTokenFor`), and the admin's device admits. The roster lanes are read from the snapshot's day.
      return persist({
        ...record,
        snapshot,
        snapshotApplied: false,
        rosterCursor: snapshot ? snapshot.epoch : Number(secret.epoch),
      });
    },

    /**
     * "I am here, and this is my key" — the private message a newcomer sends back to whoever invited them. The
     * group key comes from THIS device's vault seed, so nobody else could have said it; the KeyShard public keys
     * ride along so a later removal's rekey envelope has something to wrap to.
     */
    joinTokenFor(groupId) {
      const record = this.get(groupId);
      if (!record) throw new Error('no such group');
      return encodeGroupJoinToken({
        groupId: record.groupId,
        groupKey: record.self,
        wallet: identity.wallet ?? '',
        keyId: identity.keyId ?? '',
        name: identity.name ?? null,
        x25519PublicKey: identity.x25519PublicKey ?? null,
        mlKem768PublicKey: identity.mlKem768PublicKey ?? null,
      });
    },

    /**
     * An admin's device read a join token in a private conversation. A CANDIDATE THIS DEVICE INVITED IS ADMITTED
     * AT ONCE: the decision was made and paid for when the invite was sent, and a waiting list would mean the
     * admin has to press a button before anyone can be heard. Everyone else waits in the members dialog for a
     * person to look at them. A device that is not an admin has nothing to do with the token.
     */
    async noteCandidate(groupId, candidate) {
      const record = this.get(groupId);
      if (!record) return null;
      if (!isGroupAdmin(record, record.self)) return record;
      // a token naming a key that is not a curve point, or KeyShard keys nothing can wrap to, is noise, whoever sent
      // it — see admit()
      if (!isValidGroupKey(candidate?.groupKey)) { note('candidate', new RangeError('join token key is not a curve point')); return record; }
      if (!isValidMemberKeys(candidate)) { note('candidate', new RangeError('join token KeyShard keys cannot be wrapped to')); return record; }
      const invite = matchPendingGroupInvite(record, candidate);
      if (invite) {
        try {
          const admitted = await admitUnlocked(hex(record.groupId), [candidate]);
          return persist(clearPendingGroupInvite(admitted, matchPendingGroupInvite(admitted, candidate) ?? invite));
        } catch (error) {
          // THE JOIN IS KEPT, NOT LOST [audit 2026-09-06, round 3]: an admit that could not be sent (no GRAM, a floor
          // read declined) recorded nothing, and the person waited until the members dialog happened to be opened.
          // They stand as a candidate the admin admits with one press — or the next token rescan does.
          note('auto-admit', error);
          return persist(noteGroupCandidate(this.get(groupId) ?? record, candidate, { at: now() }));
        }
      }
      return persist(noteGroupCandidate(record, candidate, { at: now() }));
    },

    /** An ordinary message. Costs what a private message costs, whatever the room's size. */
    async say(groupId, text, { replyTo = null } = {}) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      const payload = encodeGroupText({ text, replyTo, sentAt: now() });
      const { messages, firstSeq, lastSeq, state, record: floored, route } = await publish(record, GROUP_KIND.TEXT, payload);
      await send(messages, route);
      // The caller gets the lane coordinates of what it just sent, so its echo can carry the SAME key the chain
      // copy will arrive under, and a later pass can confirm it — rather than a second bubble [audit 2026-09-05].
      return { record: await persist(noteGroupSeq(floored, { ...state, seq: lastSeq })), epoch: state.epoch, generation: state.generation, firstSeq, lastSeq };
    },

    /** Leaving. No rekey, and the caller must not tell the person otherwise: they keep the key and can read. */
    async leave(groupId) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      // THE SOLE ADMIN DOES NOT LEAVE A ROOM WITH PEOPLE IN IT [audit 2026-09-05, round 2]: a leaver leaves the admin
      // set too (the fold), and a room without an admin can never admit or rekey again. Name another admin first.
      if (isGroupAdmin(record, record.self) && record.admins.length <= 1 && record.members.length > 1) {
        throw new RangeError('the only admin cannot leave while others remain — name another admin first');
      }
      const payload = encodeGroupLeave({ groupKey: record.self, sentAt: now() });
      const { messages, lastSeq: seq, state, record: floored, route } = await publish(record, GROUP_KIND.LEAVE, payload);
      await send(messages, route);
      const next = { ...noteGroupSeq(floored, { ...state, seq }), leftAt: now() };
      return persist(next);
    },

    /** What a removal would do and cost — the numbers the dialog shows before anything is signed. */
    plan(groupId, victimGroupKey) {
      const record = this.get(groupId);
      if (!record) throw new Error('no such group');
      const plan = groupRemovalPlan(record, victimGroupKey);
      const envelopeBytes = groupRekeyEnvelopeBytes(plan.wrappable.length);
      // WHAT THE WALLET WILL BE ASKED TO SIGN, from the same arithmetic the sealer follows. The removal with its
      // envelope is `capsules.count` private-shaped capsules (56,688 bytes of envelope at 50 members is two of
      // them; a room's ~1.18 MB is 37); without cutting reading it is one.
      const sized = (envelope) => groupCapsulePlan(encodeGroupRemove({
        groupKey: victimGroupKey, generation: plan.generation, envelope, sentAt: now(),
      }).length);
      return {
        ...plan,
        envelopeBytes,
        capsules: sized(new Uint8Array(envelopeBytes)),
        capsulesWithoutRekey: sized(null),
      };
    },

    /**
     * Removal. `cutReading` is the expensive half and the caller's choice: with it the group starts a new
     * generation the removed member cannot derive; without it they simply can no longer be heard — which in a
     * room of a thousand is the honest trade, since the key is already held by a thousand people.
     *
     * Into the ROSTER lane, like every membership change, so a newcomer reading the generation learns it too.
     */
    async remove(groupId, victimGroupKey, { cutReading = true } = {}) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      if (!isGroupAdmin(record, record.self)) throw new Error('only an admin may remove');
      // THE LAST ADMIN CANNOT BE REMOVED [audit 2026-09-05, round 2]: a room with members and no admin can never admit
      // or rekey again.
      if (isGroupAdmin(record, victimGroupKey) && record.admins.length <= 1) throw new RangeError('the last admin cannot be removed');
      const plan = groupRemovalPlan(record, victimGroupKey);
      let envelope = null;
      let rekeyed = null;
      if (cutReading) {
        // THE NEW KEY IS BORN IN THE EPOCH THE REMOVE IS WRITTEN IN [audit 2026-09-05, round 1]. Readers adopt the
        // generation at the epoch of the roster row that carried it and walk the ratchet on from there; this device
        // must adopt at exactly that epoch, or the two sides derive different day keys from the same generation.
        // `now()` gave today's epoch while a stale record still wrote into yesterday's lane — one day apart, two
        // keys, a group split in silence. The record is fresh (getFresh) so the two coincide; the epoch is named
        // explicitly all the same.
        const current = currentGroupEpoch(record);
        rekeyed = await rekeyGroup({
          groupId: record.groupId, entropy: randomEntropy(random), createdAtSec: current.epoch * GROUP_EPOCH_SECONDS, generation: plan.generation,
        });
        envelope = await sealGroupRekeyEnvelope({
          groupId: record.groupId, generation: plan.generation, newKey: rekeyed.key, members: plan.wrappable,
          // a member whose keys cannot be wrapped to is left out of the new generation rather than blocking it
          onSkipped: (member, error) => note(`rekey skipped ${hex(member.groupKey ?? new Uint8Array())}`, error),
        });
      }
      const payload = encodeGroupRemove({
        groupKey: victimGroupKey, generation: plan.generation, envelope, sentAt: now(),
      });
      const victim = groupMember(record, victimGroupKey);
      const victimWasAdmin = isGroupAdmin(record, victimGroupKey);
      const { messages, firstSeq, lastSeq: seq, state, record: floored, route } = await publishRoster(record, GROUP_KIND.REMOVE, payload);
      await send(messages, route);
      let next = noteGroupSeq({ ...floored, members: plan.stays, admins: floored.admins.filter((a) => !sameKey(a, victimGroupKey)) },
        { ...state, seq });
      if (rekeyed) {
        // SPECULATIVE until the pass reads this row back [audit 2026-09-06, round 3]: a competing rekey of the same
        // generation from another admin, stamped earlier by the chain, wins over this claim (adoptGroupGeneration).
        next = adoptGroupGeneration(next, { epoch: rekeyed.epoch, generation: rekeyed.generation, key: rekeyed.key, speculative: true });
        // the new generation has its own roster key and, as yet, no snapshot — the next invite takes one
        next = noteGroupRosterKey(next, rekeyed.generation, rekeyed.rosterKey);
        next = { ...next, snapshot: null, admitsSinceSnapshot: 0, rosterCursor: rekeyed.epoch };
      }
      // BELIEVED AT BROADCAST, TAKEN BACK BY THE FOLD if the chain never shows the row [round 3]
      next = notePendingControl(next, {
        kind: GROUP_KIND.REMOVE, epoch: state.epoch, generation: state.generation, seq: firstSeq, at: now(),
        victim: victim ? memberForLog(victim) : null, victimWasAdmin,
        rekey: rekeyed ? { epoch: rekeyed.epoch, generation: rekeyed.generation, key: hex(rekeyed.key) } : null,
        revert: { snapshot: record.snapshot ?? null, admitsSinceSnapshot: Number(record.admitsSinceSnapshot ?? 0), rosterCursor: record.rosterCursor ?? null },
      });
      return persist(next);
    },

    /** The admin set, replaced wholesale — a revoked key must not survive by omission. Into the roster lane. */
    async setAdmins(groupId, admins) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      if (!isGroupAdmin(record, record.self)) throw new Error('only an admin may name admins');
      // THE ADMIN SET IS NON-EMPTY AND MADE OF MEMBERS [audit 2026-09-05, round 2]: an empty set leaves a room nobody
      // can admit into or rekey; a non-member admin is a key nobody reads a roster lane for.
      if (!Array.isArray(admins) || admins.length === 0) throw new RangeError('a group needs at least one admin');
      for (const admin of admins) {
        if (!record.members.some((m) => sameKey(m.groupKey, admin))) throw new RangeError('an admin must be a member');
      }
      const payload = encodeGroupAdmins({ admins, sentAt: now() });
      const { messages, firstSeq, lastSeq: seq, state, record: floored, route } = await publishRoster(record, GROUP_KIND.ADMIN, payload);
      await send(messages, route);
      return persist(notePendingControl(noteGroupSeq({ ...floored, admins: admins.map((a) => a) }, { ...state, seq }), {
        kind: GROUP_KIND.ADMIN, epoch: state.epoch, generation: state.generation, seq: firstSeq, at: now(),
        revert: { admins: record.admins.map(hex) },
      }));
    },

    /**
     * An admin admitting the people who answered an invite: ONE ADMIT DELTA — the new members and nothing else —
     * one capsule whatever the room's size. The first draft republished the whole roster here, ~2.6 KB a member:
     * four capsules for forty-nine people, and a room of 1024 could not carry its own roster at all.
     */
    async admit(groupId, candidates) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      if (!isGroupAdmin(record, record.self)) throw new Error('only an admin may admit');
      const added = [];
      for (const candidate of candidates) {
        // A KEY THAT IS NOT A POINT IS NOT ADMITTED [audit 2026-09-05, round 1]: written into the roster it would
        // throw in every device's lane derivation and take the group's pass down for good.
        if (!isValidGroupKey(candidate.groupKey)) { note('admit', new RangeError('candidate key is not a curve point')); continue; }
        // and the KeyShard keys a rekey will wrap to must be ones the primitives accept [round 2]: one malformed
        // ML-KEM or X25519 key in the roster blocked every later removal-with-rekey of anyone else
        if (!isValidMemberKeys(candidate)) { note('admit', new RangeError('candidate KeyShard keys cannot be wrapped to')); continue; }
        if (record.members.some((m) => sameKey(m.groupKey, candidate.groupKey))) continue;
        if (added.some((m) => sameKey(m.groupKey, candidate.groupKey))) continue;
        added.push({
          groupKey: candidate.groupKey,
          wallet: candidate.wallet ?? null,
          keyId: candidate.keyId ?? null,
          name: candidate.name ?? null,
          x25519PublicKey: candidate.x25519PublicKey ?? null,
          mlKem768PublicKey: candidate.mlKem768PublicKey ?? null,
        });
      }
      if (added.length === 0) return record;
      const payload = encodeGroupAdmit({ members: added, sentAt: now() });
      const { messages, firstSeq, lastSeq: seq, state, record: floored, route } = await publishRoster(record, GROUP_KIND.ADMIT, payload);
      await send(messages, route);
      const members = [...floored.members, ...added];
      const waiting = (floored.candidates ?? []).filter((c) => !members.some((m) => sameKey(m.groupKey, c.groupKey)));
      return persist(notePendingControl(noteGroupSeq({
        ...floored, members, candidates: waiting,
        admitsSinceSnapshot: Number(floored.admitsSinceSnapshot ?? 0) + added.length,
      }, { ...state, seq }), {
        kind: GROUP_KIND.ADMIT, epoch: state.epoch, generation: state.generation, seq: firstSeq, at: now(),
        members: added.map(memberForLog), revert: {},
      }));
    },

    /**
     * THE ROOM'S PICTURE. `bytes` is already-compressed WebP from the app's own image pipeline — the same ladder
     * and the same encoder every other picture in this client goes through.
     *
     * Two writes: the parts go into the shared avatar lane, and a PROFILE delta into the roster lane carries the
     * pointer and the sha-256. Members learn about the picture from the roster lanes they already read; nothing
     * extra is added to a daily pass, because a picture changes about never.
     */
    async setAvatar(groupId, { bytes, width = 0, height = 0 }) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      if (!isGroupAdmin(record, record.self)) throw new Error('only an admin may set the picture');
      const epoch = currentGroupEpoch(record).epoch;
      const payload = encodeGroupAvatar({ bytes, width, height, sentAt: now() });
      // WHERE THE LANE ALREADY IS. Its write key is shared, so this device is not the only one that could have
      // written there today; starting at a seq the shard has already stored would simply be refused (13653).
      // Promise.resolve().then, not a bare call with .catch: a lane that has no avatarTip at all throws
      // SYNCHRONOUSLY, and a probe failing is never a reason to refuse to publish a picture.
      const tip = await Promise.resolve()
        .then(() => lane.avatarTip({ groupId: record.groupId, ...(boundary === undefined ? {} : { boundary }), epoch }))
        .catch((error) => { note('avatarTip', error); return 0; });
      const first = Number(tip ?? 0) + 1;
      const picture = await publishAvatar(record, epoch, payload, first);
      const hash = await groupAvatarHash(bytes);
      const avatar = { epoch, seq: first, parts: picture.count, hash, width: Number(width) || 0, height: Number(height) || 0 };
      const withPointer = { ...record, avatar };
      const profile = await publishRoster(withPointer, GROUP_KIND.PROFILE, encodeGroupProfile({ avatar, sentAt: now() }));
      await send([...picture.messages, ...profile.messages], profile.route);
      return persist(notePendingControl(noteGroupSeq(profile.record, { ...profile.state, seq: profile.lastSeq }), {
        kind: GROUP_KIND.PROFILE, epoch: profile.state.epoch, generation: profile.state.generation, seq: profile.firstSeq, at: now(),
        revert: { avatar: record.avatar ?? null },
      }));
    },

    /**
     * What setting a picture of `byteLength` bytes will cost, BEFORE the file is chosen for good: the picture's
     * capsules plus the one PROFILE delta that points at it.
     */
    avatarPlan(groupId, byteLength) {
      const record = this.get(groupId);
      if (!record) throw new Error('no such group');
      const picture = groupCapsulePlan(GROUP_AVATAR_HEADER_BYTES + Number(byteLength ?? 0));
      const pointer = { epoch: 0, seq: 0, parts: picture.count, hash: '00'.repeat(32), width: 0, height: 0 };
      const profile = groupCapsulePlan(encodeGroupProfile({ avatar: pointer, sentAt: now() }).length);
      return { picture, profile, count: picture.count + profile.count, parts: [...picture.parts, ...profile.parts] };
    },

    /** The picture itself, verified against the hash the roster named. Null when it is not there, or not it. */
    async avatar(groupId) {
      const record = this.get(groupId);
      if (!record?.avatar) return null;
      return lane.readAvatar({
        groupId: record.groupId, pointer: record.avatar, states: null,
        ...(boundary === undefined ? {} : { boundary }),
      });
    },

    /**
     * One pass over every group: turn each ratchet up to today; a newcomer's first time, read the SNAPSHOT the
     * invite pointed at; read the admins' ROSTER lanes from the cursor to today — every day, whatever the message
     * window, because a missed admission would mean never reading that member's lane; read the message lanes of
     * the window; open any rekey addressed to this device; hand back the messages to render.
     *
     * The reads of a group's day are batched accountStates calls between all its lanes — 1024 members plus a few
     * admins' roster lanes sit inside the measured 1149-address wall.
     */
    async sync({ groupIds = null } = {}) {
      const out = [];
      for (const record of this.list()) {
        if (groupIds && !groupIds.includes(hex(record.groupId))) continue;
        if (record.leftAt) continue;
        try {
          let current = await advanceGroupWindow(record, now());
          const today = currentGroupEpoch(current);
          const rosterKey = groupRosterKeyFor(current, today.generation);
          const shardFailed = (address, error) => note(`shard ${address}`, error);
          const rekeys = [];

          // (1) A NEWCOMER'S FIRST READ: the snapshot the invite pointed at, once.
          if (rosterKey && current.snapshot && !current.snapshotApplied) {
            const snap = await lane.readSnapshot({
              rosterKey, groupId: current.groupId, pointer: current.snapshot, boundary, onShardFailed: shardFailed,
            });
            if (snap) current = { ...applyGroupRows(current, [snap]).record, snapshotApplied: true };
          }

          // (2) MEMBERSHIP: the admins' roster lanes from the cursor to today, and the message lanes of the window
          // plus a few of the days this device missed (groupEpochsToRead), their change markers read in ONE batch.
          // A lane that fails to read is remembered, so its day is not marked read and is asked for again.
          const failedShards = new Set();
          const shardFailedHere = (address, error) => { failedShards.add(String(address).toLowerCase()); shardFailed(address, error); };
          // A LANE THAT OUTRAN THE WINDOW IS NOT MARKED READ [audit 2026-09-05, round 2]: its mark stays where it was so
          // the next pass pages back to it, its day stays unread, and the roster cursor does not move past it.
          const gapped = new Set();
          const shardGapHere = (address, gap) => { gapped.add(String(address).toLowerCase()); note(`lane gap ${address}`, gap); };
          const troubled = (address) => failedShards.has(String(address).toLowerCase()) || gapped.has(String(address).toLowerCase());
          // HOW DEEP TO PAGE: the highest seq this device has read from each lane, so a lane that outran the newest
          // window is paged back to what is held rather than truncated in silence — the private reader's own
          // defence, which the group path had not wired [audit 2026-09-05, round 1]. A lane never seen reads its
          // newest window (-1), as the private lane does on a cold start.
          // ...EXCEPT A ROSTER LANE, WHICH IS PAGED FROM ITS FIRST ROW [audit 2026-09-06, round 3]: the newest window of a
          // roster lane can hide the rows that matter (a snapshot under a day of later rows, an ADMIT under refused junk
          // anyone may send the lane for a GRAM), and a cold lane reported no gap — the cursor moved past rows never read.
          const rosterAddresses = new Set();
          const knownSeqOf = (address) => {
            const key = String(address).toLowerCase();
            const held = current.seenSeq?.[key];
            if (held !== undefined && held !== null) return Number(held);
            return rosterAddresses.has(key) ? 0 : -1;
          };
          const noteSeen = (rows) => { for (const row of rows ?? []) if (!gapped.has(String(row.address).toLowerCase())) current = noteSeenSeq(current, row.address, Number(row.seq)); };
          const memberPublicKeys = groupMemberPublicKeys(current);
          const epochs = groupEpochsToRead(current, now()).map((e) => ({ groupId: current.groupId, ...e }));
          const rosterEpochs = [];
          if (rosterKey && current.admins.length > 0) {
            const from = Math.min(Number(current.rosterCursor ?? today.epoch), today.epoch);
            for (let e = Math.max(from, today.epoch - 366); e <= today.epoch; e += 1) rosterEpochs.push(e);
          }
          // today's generation from the cursor, and the generation just left for the two days after the rekey
          const rosterReads = [
            ...(rosterEpochs.length > 0 ? [{ rosterKey, generation: today.generation, epochs: rosterEpochs }] : []),
            ...(current.admins.length > 0 ? rosterReadsOfPreviousGeneration(current, today) : []),
          ];
          const rosterBuckets = [];
          for (const read of rosterReads) {
            rosterBuckets.push(...await lane.rosterBuckets({
              rosterKey: read.rosterKey, groupId: current.groupId, generation: read.generation, epochs: read.epochs, adminPublicKeys: current.admins, boundary,
            }));
          }
          for (const bucket of rosterBuckets) rosterAddresses.add(String(bucket.address).toLowerCase());
          const buckets = await lane.buckets({ epochs, memberPublicKeys, boundary });
          const states = typeof readStates === 'function'
            ? await readStates([...rosterBuckets, ...buckets].map((b) => b.address))
            : null;
          if (rosterReads.length > 0) {
            const rosterRows = [];
            for (const read of rosterReads) {
              rosterRows.push(...await lane.readRoster({
                rosterKey: read.rosterKey, groupId: current.groupId, generation: read.generation, epochs: read.epochs,
                adminPublicKeys: current.admins, states, knownSeqOf, boundary, onShardFailed: shardFailedHere, onShardGap: shardGapHere,
              }));
            }
            noteSeen(rosterRows);
            current = noteRosterSeen(current, rosterRows);   // what a snapshot this device takes will say it saw
            // this device's own roster writes raise its roster-lane counter — a sibling device may have written
            current = noteGroupSeqFromRows(current, rosterRows);
            const folded = applyGroupRows(current, rosterRows);
            // THE CURSOR MOVES ONLY OVER A CLEAN READ [audit 2026-09-05, round 2]. It used to advance to today whatever
            // happened to the roster lanes: one declined /messages read of an admin's lane on the day of a removal
            // with rekey, and this device never read that REMOVE — never adopted the new generation, and read and
            // wrote gen-0 lanes nobody else used, in silence, until re-invited. A newcomer whose snapshot has not
            // applied yet keeps its cursor too: the snapshot's roster replaces the membership wholesale, so the
            // admissions between it and today must still be read after it lands.
            const rosterClean = rosterBuckets.every((b) => !troubled(b.address)) && (folded.record.snapshotApplied !== false);
            current = { ...folded.record, ...(rosterClean ? { rosterCursor: today.epoch } : {}) };
            rekeys.push(...folded.rekeys);
            // WHAT THIS DEVICE PUBLISHED IS CONFIRMED OR TAKEN BACK [round 3]: its own row read back confirms; its own
            // roster lane read clean past the window without the row reverts the effect the screen already showed.
            const cleanEpochs = rosterEpochs.filter((e) => rosterBuckets.some((b) => Number(b.epoch) === e && sameKey(b.member, current.self))
              && !rosterBuckets.some((b) => Number(b.epoch) === e && sameKey(b.member, current.self) && troubled(b.address)));
            const settled = settlePendingControl(current, { rosterRows, cleanEpochs, nowSec: now() });
            for (const entry of settled.reverted) note('control write taken back', new Error(`kind ${entry.kind}, seq ${entry.seq}`));
            current = settled.record;
          }

          // (3) MESSAGES: the daily lanes of the window and of the missed days.
          const rows = await lane.read({
            epochs, memberPublicKeys: groupMemberPublicKeys(current), states, knownSeqOf, boundary, onShardFailed: shardFailedHere, onShardGap: shardGapHere,
          });
          noteSeen(rows);
          // and this device's own daily writes, for the same reason
          current = noteGroupSeqFromRows(current, rows);
          const folded = applyGroupRows(current, rows);
          current = folded.record;
          rekeys.push(...folded.rekeys);
          // a day whose every lane was read may leave the window when it ages out; one with a failed or gapped lane stays
          const readWhole = epochs.filter((e) => !buckets.some((b) => Number(b.epoch) === Number(e.epoch) && troubled(b.address)));
          current = markGroupEpochsRead(current, readWhole);
          // was this device's own lane really read this pass? An echo may be called not delivered only when it was.
          const ownLaneRead = !buckets.some((b) => sameKey(b.member, current.self) && troubled(b.address));
          // the paging marks live as long as their lanes are held — every epoch still in the record, not only the ones
          // this pass asked about (an unread day beyond the per-pass quota keeps its marks for its turn)
          const heldLanes = await lane.buckets({ epochs: current.epochs.map((e) => ({ groupId: current.groupId, ...e })), memberPublicKeys: groupMemberPublicKeys(current), boundary });
          current = pruneSeenSeq(current, [...rosterBuckets, ...heldLanes].map((b) => b.address));

          // (4) A REKEY addressed to this device: the new generation's day key, and from it the roster key.
          for (const rekey of rekeys) {
            try {
              const opened = await openGroupRekeyEnvelope({
                groupId: current.groupId,
                envelope: rekey.envelope,
                memberGroupKey: current.self,
                x25519SecretKey: identity.x25519SecretKey,
                mlKem768SecretKey: identity.mlKem768SecretKey,
              });
              // Null is the ORDINARY answer for a removal this device was not a recipient of — including the one
              // that removed this device. It is not an error, and it must not look like one.
              if (opened) {
                current = adoptGroupGeneration(current, { epoch: rekey.epoch, generation: opened.generation, key: opened.key, stamp: rekey.stamp ?? null });
                current = noteGroupRosterKey(current, opened.generation,
                  await groupRosterKey({ key: opened.key, groupId: current.groupId, generation: opened.generation }));
                current = { ...current, snapshot: null, admitsSinceSnapshot: 0, rosterCursor: rekey.epoch };
              }
            } catch (error) { note('rekey', error); }
          }
          await persist(current);
          current = await republishLostRekeys(current);
          out.push({ groupId: hex(current.groupId), record: current, messages: folded.messages, ownLaneRead });
        } catch (error) {
          note(`group ${hex(record.groupId)}`, error);
        }
      }
      return out;
    },
  };

  // The publishers and the pass run under the per-group lock; the readers (list/get/secretFor/plan/...) do not.
  admitUnlocked = api.admit;
  removeUnlocked = api.remove;
  for (const name of ['say', 'leave', 'remove', 'admit', 'setAdmins', 'ensureSnapshot', 'setAvatar', 'noteCandidate']) {
    const inner = api[name];
    api[name] = (groupId, ...rest) => locked(groupId, () => inner.call(api, groupId, ...rest));
  }
  const syncUnlocked = api.sync;
  api.sync = async (options = {}) => {
    // each group's pass under its own lock, so a send on that group waits for the pass and then sees its result
    const out = [];
    for (const record of api.list()) {
      const groupId = hex(record.groupId);
      if (options?.groupIds && !options.groupIds.includes(groupId)) continue;
      const passes = await locked(groupId, () => syncUnlocked.call(api, { groupIds: [groupId] }));
      out.push(...passes);
    }
    return out;
  };
  return api;
}

export { groupEpochFromSeconds };
