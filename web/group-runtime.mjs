
import {
  GROUP_KIND, GROUP_AVATAR_HEADER_BYTES, encodeGroupAdmins, encodeGroupAdmit, encodeGroupAvatar, encodeGroupJoinToken,
  encodeGroupLeave, encodeGroupProfile, encodeGroupMute, encodeGroupHide, isGroupRowKey, groupExcerptIn, encodeGroupRemove, encodeGroupRoster, encodeGroupText, groupAvatarHash,
  groupCapsulePlan, groupRekeyEnvelopeBytes, openGroupRekeyEnvelope, sealGroupRekeyEnvelope, isValidMemberKeys,
  groupEntryFeeIn,
} from './group-protocol.mjs?v=31';
import {
  advanceGroupWindow, adoptGroupGeneration, applyGroupRows, clearPendingGroupInvite, createGroupRecord,
  currentGroupEpoch, groupMemberPublicKeys, groupOwnerKey, groupRemovalPlan, groupRosterKeyFor, isGroupAdmin, isGroupOwner, isGroupMuted, groupHiddenForRoster, matchPendingGroupInvite,
  nextGroupSeq, noteGroupCandidate, noteGroupRosterKey, noteGroupSeq, notePendingGroupInvite, parseGroupCandidate,
  parseGroupRecord, serializeGroupCandidate,
  serializeGroupRecord, groupEpochsToRead, markGroupEpochsRead, noteGroupSeqFromRows, noteSeenSeq, pruneSeenSeq,
  groupMember, memberForLog, notePendingControl, noteRosterSeen, settlePendingControl, snapshotForRevert, noteSeenSeqs, createPerKeyLock,
  groupOwnerWallet, groupRemovedAt, groupRemovalsForRoster, noteGroupCandidatePaid, noteGroupRemoval, declineGroupCandidate,
  holdsGroupGeneration, noteGroupAccessOwed, clearGroupAccessOwed, catchUpGroupGeneration, groupAdminByWallet, pendingInviteBehind,
} from './group-store.mjs?v=42';
import {
  createGroupFounding, groupEpochFromSeconds, groupMemberPublicKey, groupMemberSeed, groupRosterKey, rekeyGroup,
  isValidGroupKey, GROUP_EPOCH_SECONDS, GROUP_KEY_BYTES, GROUP_MAX_RATCHET_STEPS,
} from './crypto/group-lane.mjs?v=8';

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
import { buildGroupAvatarPublishMessages, buildGroupPublishMessages } from './group-lane-send.mjs?v=98';
import { createGroupReadLane, groupLaneBuckets, groupRosterBuckets } from './group-lane-read.mjs?v=75';
import { CUTOVER_EPOCH, generationForEpochAt } from './cutover-epoch.mjs?v=7';

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const sameKey = (a, b) => a instanceof Uint8Array && b instanceof Uint8Array && hex(a) === hex(b);

export const GROUP_LEFT_READ_S = 15 * 60;

function randomEntropy(random) {
  if (typeof random === 'function') return random(32);
  const out = new Uint8Array(32);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function createGroupRuntime({
  store, identity, send, vaultRouting, readMessagesWithSource, readStates, readLastSeq = null,
  requests = null,
  readEntryPayment = null,
  clock = null,
  publishValue, now = () => Math.floor(Date.now() / 1000), boundary = CUTOVER_EPOCH, random = null, onError = null,
  onAdmitted = null,
  sameWallet = null,
  lane: injectedLane = null,
}) {
  if (!store) throw new Error('createGroupRuntime requires a record store');
  if (typeof send !== 'function') throw new Error('createGroupRuntime requires send()');
  const lane = injectedLane ?? createGroupReadLane({ readMessagesWithSource });
  const records = new Map();
  const pruneKeys = new Map();
  const laneDeepWalk = new Map();
  const BOOKKEEPING_MAX = 4_096;
  const laneClockMs = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());
  const note = (where, error) => { try { onError?.(where, error); } catch { } };
  const walletsMatch = typeof sameWallet === 'function' ? sameWallet : undefined;

  const remember = (record) => { records.set(hex(record.groupId), record); return record; };

  const queueList = async (groupIdHex) => {
    if (!requests) return null;
    try { return (await requests.list(groupIdHex)).map(parseGroupCandidate); } catch (error) { note('requests', error); return null; }
  };

  const lastPersisted = new Map();
  const persist = async (record) => {
    const id = hex(record.groupId);
    records.set(id, record);
    if (lastPersisted.get(id)?.record === record) return record;
    try {
      const serialized = serializeGroupRecord(record);
      const text = JSON.stringify(serialized);
      if (lastPersisted.get(id)?.text === text) { lastPersisted.set(id, { record, text }); return record; }
      await store.put(id, serialized);
      lastPersisted.set(id, { record, text });
    } catch (error) { note('persist', error); }
    return record;
  };

  const refuseLeft = (record) => { if (record?.leftAt) throw new Error('this device has left the room'); };
  const selfMember = (self) => ({
    groupKey: self,
    wallet: identity.wallet ?? null,
    keyId: identity.keyId ?? null,
    name: identity.name ?? null,
    x25519PublicKey: identity.x25519PublicKey ?? null,
    mlKem768PublicKey: identity.mlKem768PublicKey ?? null,
  });

  const nudgeAdmitted = (groupId) => {
    if (typeof onAdmitted !== 'function') return;
    const id = hex(groupId);
    setTimeout(() => { Promise.resolve().then(() => onAdmitted({ groupId: id })).catch((error) => note('admitted', error)); }, 0);
  };

  const clockTrusted = () => (typeof clock?.trusted === 'function' ? clock.trusted() !== false : true);
  const getFresh = async (groupId) => {
    const record = records.get(String(groupId));
    if (!record) return null;
    if (typeof clock?.settle === 'function') await clock.settle();
    const advanced = await advanceGroupWindow(record, now());
    return advanced === record ? record : persist(advanced);
  };


  const provenLive = new Set();
  const PROVEN_LIVE_LIMIT = 4_096;
  const proveLive = (lane) => {
    if (provenLive.has(lane)) return;
    if (provenLive.size >= PROVEN_LIVE_LIMIT) provenLive.delete(provenLive.values().next().value);
    provenLive.add(lane);
  };
  const provenLiveKeys = new Set();
  const laneKeyOf = (state) => `${String(state.groupId)}|${state.lane === 'roster' ? 'r.' : ''}${state.epoch}.${state.generation}`;
  const proveLiveKey = (state) => {
    const key = laneKeyOf(state);
    if (provenLiveKeys.has(key)) return;
    if (provenLiveKeys.size >= PROVEN_LIVE_LIMIT) provenLiveKeys.delete(provenLiveKeys.values().next().value);
    provenLiveKeys.add(key);
  };

  const withChainFloor = async (record, state, buckets, { always = false } = {}) => {
    const [bucket] = await buckets();
    if (!bucket) return { record, live: false };
    const lane = String(bucket.address).toLowerCase();
    if (!always && nextGroupSeq(record, state) > 1 && provenLive.has(lane)) return { record, live: true };
    if (typeof readLastSeq !== 'function') return { record, live: false };
    let floorRead;
    try { floorRead = await readLastSeq(bucket.address); } catch (error) {
      if (error?.code === 'TIMEOUT' || error?.code === 'QUEUE_TIMEOUT') throw error;
      floorRead = await readLastSeq(bucket.address);
    }
    const floor = Number(floorRead);
    if (!(Number.isFinite(floor) && floor > 0)) return { record, live: false };
    proveLive(lane);
    proveLiveKey(state);
    return { record: noteGroupSeq(record, { ...state, seq: floor }), live: true };
  };

  const doorArgs = async (epoch, groupId = null) => {
    if (groupId !== null) refuseMovedGeneration(groupId, epoch);
    const common = { value: publishValue, ...(boundary === undefined ? {} : { boundary }) };
    if (generationForEpochAt(Number(epoch), boundary) < 18) return { ...common, door: 'direct' };
    const routing = await vaultRouting();
    return { ...common, door: 'vault', vaultAddress: routing.vaultAddress, feeDue: routing.feeDue, deployVault: routing.deployVault === true,
      prices: routing.prices ?? null, deployFlight: routing.deployFlight ?? null };
  };
  const routeOf = (args) => ({ door: args.door, vaultAddress: args.vaultAddress ?? null, deployVault: args.deployVault === true, deployFlight: args.deployFlight ?? null });
  const unroute = (args) => {
    try { args?.deployFlight?.settle?.(false); } catch { }
  };

  const publish = async (given, kind, payload, { floorEveryTime = false } = {}) => {
    const state = { groupId: given.groupId, ...currentGroupEpoch(given) };
    const { record, live } = await withChainFloor(given, state, () => groupLaneBuckets({ state, memberPublicKeys: [given.self], boundary }), { always: floorEveryTime });
    const memberSeed = await groupMemberSeed({ vaultSeed: identity.vaultSeed, groupId: record.groupId });
    const firstSeq = nextGroupSeq(record, state);
    const args = await doorArgs(state.epoch, record.groupId);
    let built;
    try {
      built = await buildGroupPublishMessages({ state, memberSeed, kind, payload, firstSeq, sentAt: now(), ...args, attachStateInit: !live });
    } catch (error) { unroute(args); throw error; }
    return { messages: built.messages, firstSeq, lastSeq: built.lastSeq, count: built.count, wireBytes: built.wireBytes, state, record, route: routeOf(args) };
  };

  const publishAvatar = async (record, epoch, payload, firstSeq, secret, args = null) => buildGroupAvatarPublishMessages({
    groupId: record.groupId, epoch, payload, firstSeq, sentAt: now(), secret, ...(args ?? await doorArgs(epoch, record.groupId)),
  });

  const SNAPSHOT_MAX_ADMITS = 16;
  const SNAPSHOT_MAX_DAYS = 14;

  const rosterSnapshotPayload = (record) => encodeGroupRoster({
    members: record.members, admins: record.admins, name: record.name, owner: record.owner ?? null,
    avatar: record.avatar ?? null, sentAt: now(),
    asOf: record.rosterSeen ?? {},
    muted: record.muted ?? [], hidden: groupHiddenForRoster(record.hidden),
    entryFee: record.entryFee ?? null, removals: groupRemovalsForRoster(record.removals),
  });

  const publishRoster = async (given, kind, payload, { doorFor = null } = {}) => {
    const current = currentGroupEpoch(given);
    const rosterKey = groupRosterKeyFor(given, current.generation);
    if (!rosterKey) throw new Error('this device holds no roster key for the current generation');
    const state = { groupId: given.groupId, key: rosterKey, epoch: current.epoch, generation: current.generation, lane: 'roster' };
    const { record, live } = await withChainFloor(given, state, () => groupRosterBuckets({
      rosterKey, groupId: given.groupId, generation: current.generation, epochs: [current.epoch], adminPublicKeys: [given.self], boundary,
    }), { always: true });
    const memberSeed = await groupMemberSeed({ vaultSeed: identity.vaultSeed, groupId: record.groupId });
    const firstSeq = nextGroupSeq(record, state);
    const args = doorFor ? await doorFor(state.epoch) : await doorArgs(state.epoch, record.groupId);
    let built;
    try {
      built = await buildGroupPublishMessages({ state, memberSeed, kind, payload, firstSeq, sentAt: now(), ...args, attachStateInit: !live });
    } catch (error) { unroute(args); throw error; }
    return { messages: built.messages, firstSeq, lastSeq: built.lastSeq, count: built.count, wireBytes: built.wireBytes, state, record, route: routeOf(args) };
  };

  const sendOrLanded = async (messages, route) => {
    try { return await send(messages, route); } catch (error) { if (error?.builtBoc) return { landedMaybe: true }; throw error; }
  };

  const unhexBytes = (text) => Uint8Array.from((String(text).match(/../g) ?? []).map((b) => parseInt(b, 16)));

  const forgetLiftedLanes = async (record, { members = [], rows = [] } = {}) => {
    try {
      const epochs = record.epochs.map((e) => ({ groupId: record.groupId, ...e }));
      const addresses = new Set();
      if (members.length > 0) {
        for (const b of await lane.buckets({ epochs, memberPublicKeys: members, boundary })) addresses.add(lower(b.address));
      }
      for (const key of rows) {
        const [epoch, generation, senderHex] = String(key).split('.');
        const state = epochs.find((e) => Number(e.epoch) === Number(epoch) && Number(e.generation ?? 0) === Number(generation));
        if (!state || !HEX_KEY.test(String(senderHex ?? ''))) continue;
        for (const b of await lane.buckets({ epochs: [state], memberPublicKeys: [unhexBytes(senderHex)], boundary })) addresses.add(lower(b.address));
      }
      if (addresses.size === 0) return record;
      lane.forgetShards?.([...addresses]);
      const seenSeq = { ...(record.seenSeq ?? {}) };
      for (const address of addresses) delete seenSeq[address];
      return { ...record, seenSeq };
    } catch (error) {
      note('forget', error);
      return { ...record, seenSeq: {} };
    }
  };

  const noteWaiting = async (record, candidate, { paid = null } = {}) => {
    let next = noteGroupCandidate(record, { ...candidate, paid }, { at: now() });
    if (next === record) next = noteGroupCandidatePaid(record, candidate.groupKey, paid);
    if (next === record) return record;
    const id = hex(record.groupId);
    if (requests) {
      try {
        await requests.add(id, serializeGroupCandidate(next.candidates.find((c) => sameKey(c.groupKey, candidate.groupKey)) ?? next.candidates.at(-1)));
        const kept = new Set(next.candidates.map((c) => hex(c.groupKey)));
        for (const held of record.candidates ?? []) {
          if (!kept.has(hex(held.groupKey))) await requests.remove(id, hex(held.groupKey));
        }
      } catch (error) { note('requests', error); }
    }
    return remember(next);
  };

  const ENTRY_RECHECK_FIRST_GAP_S = 30;
  const ENTRY_RECHECK_MAX_GAP_S = 480;
  const entryChecks = new Map();
  const entryCheckId = (record, candidate) => `${hex(record.groupId)}.${hex(candidate.groupKey)}`;
  const entryCheckDue = (record, candidate) => {
    const held = entryChecks.get(entryCheckId(record, candidate));
    return !held || now() - held.at >= Math.min(ENTRY_RECHECK_MAX_GAP_S, ENTRY_RECHECK_FIRST_GAP_S * 2 ** held.n);
  };
  const verifyEntryPayment = async (record, candidate) => {
    if (typeof readEntryPayment !== 'function') return null;
    const ownerWallet = groupOwnerWallet(record);
    if (!ownerWallet || !candidate?.wallet) return null;
    {
      const checkId = entryCheckId(record, candidate);
      const held = entryChecks.get(checkId);
      entryChecks.delete(checkId);
      entryChecks.set(checkId, { at: now(), n: held ? held.n + 1 : 0 });
      while (entryChecks.size > BOOKKEEPING_MAX) entryChecks.delete(entryChecks.keys().next().value);
    }
    try {
      const verdict = await readEntryPayment({
        groupId: record.groupId, groupKey: candidate.groupKey, wallet: candidate.wallet, ownerWallet,
        entryFee: groupEntryFeeIn(record.entryFee), since: groupRemovedAt(record, candidate.groupKey),
      });
      return verdict && typeof verdict === 'object' ? verdict : null;
    } catch (error) {
      note('entry payment', error);
      return null;
    }
  };

  const ENTRY_RECHECK_S = 1800;
  const ENTRY_RECHECK_MAX = 4;
  const entryQuestionOf = (record, candidate) => JSON.stringify([groupEntryFeeIn(record.entryFee), groupOwnerWallet(record), groupRemovedAt(record, candidate.groupKey)]);
  const readEntryVerdicts = async (record) => {
    if (record.leftAt || groupEntryFeeIn(record.entryFee) === null || !isGroupAdmin(record, record.self)) return [];
    const floor = now() - ENTRY_RECHECK_S;
    const due = (record.candidates ?? []).filter((c) => c.paid !== true && Number(c.at ?? 0) >= floor && entryCheckDue(record, c)).slice(-ENTRY_RECHECK_MAX);
    const verdicts = [];
    for (const candidate of due) verdicts.push({ candidate, question: entryQuestionOf(record, candidate), verdict: await verifyEntryPayment(record, candidate) });
    return verdicts;
  };
  const applyEntryVerdicts = async (record, verdicts) => {
    if (verdicts.length === 0 || record.leftAt || groupEntryFeeIn(record.entryFee) === null || !isGroupAdmin(record, record.self)) return record;
    let current = record;
    for (const { candidate, question, verdict } of verdicts) {
      const waiting = (current.candidates ?? []).find((c) => sameKey(c.groupKey, candidate.groupKey));
      if (!waiting || groupMember(current, candidate.groupKey)) continue;
      if (question !== undefined && question !== entryQuestionOf(current, waiting)) continue;
      if (waiting.paid === true && verdict?.paid !== true) continue;
      if (verdict?.paid === true) {
        try { current = await admitUnlocked(hex(current.groupId), [waiting]); continue; } catch (error) { note('auto-admit', error); }
      }
      current = await noteWaiting(current, waiting, { paid: verdict?.paid === true ? true : verdict ? false : null });
    }
    return current;
  };

  const locked = createPerKeyLock();
  let admitUnlocked = null;
  let removeUnlocked = null;

  const askedGeneration = new Map();
  const opKey = (groupId) => (groupId instanceof Uint8Array ? hex(groupId) : String(groupId).toLowerCase());
  const refuseMovedGeneration = (groupId, epoch) => {
    const asked = askedGeneration.get(opKey(groupId));
    if (asked === undefined || generationForEpochAt(Number(epoch), boundary) === asked) return;
    const error = new Error('the prices moved between the press and the build: nothing was signed');
    error.code = 'PRICES_MOVED';
    throw error;
  };

  const HANDOVERS_WAITING_MAX = 8;
  const handoversWaiting = new Map();
  const HEX_KEY = /^[0-9a-f]{64}$/i;
  const takeNewerGeneration = (groupIdHex, secret, from) => locked(groupIdHex, async () => {
    const held = records.get(groupIdHex);
    if (!held || held.leftAt) return held ?? null;
    const generation = Number(secret?.generation);
    const head = currentGroupEpoch(held);
    if (!Number.isSafeInteger(generation) || generation < 0 || (head && generation <= Number(head.generation))) return held;
    let offer;
    try {
      if (!HEX_KEY.test(String(secret.key ?? ''))) throw new RangeError('the handed day key is not a key');
      if (!HEX_KEY.test(String(secret.rosterKey ?? ''))) throw new RangeError('a newer generation comes with its roster key, or it cannot be read');
      const epoch = Number(secret.epoch);
      if (!Number.isSafeInteger(epoch) || epoch < 0) throw new RangeError('the handed key names no day');
      let snapshot = null;
      if (secret.snapshot) {
        const admin = HEX_KEY.test(String(secret.snapshot.admin ?? '')) ? unhexBytes(secret.snapshot.admin) : null;
        if (!admin || !isValidGroupKey(admin)) throw new RangeError('the handed key points at a snapshot of no valid admin');
        snapshot = {
          epoch: Number(secret.snapshot.epoch), generation: Number(secret.snapshot.generation), admin,
          seq: Number(secret.snapshot.seq), parts: Number(secret.snapshot.parts), at: 0,
        };
      }
      offer = { generation, epoch, key: unhexBytes(secret.key), rosterKey: unhexBytes(secret.rosterKey), snapshot };
    } catch (error) {
      note('handover', error);
      return held;
    }
    if (held.snapshotApplied === false || held.members.length === 0) {
      const waiting = (handoversWaiting.get(groupIdHex) ?? []).filter((w) => !(w.from === from && String(w.secret.key) === String(secret.key)));
      handoversWaiting.set(groupIdHex, [...waiting, { secret, from }].slice(-HANDOVERS_WAITING_MAX));
      return held;
    }
    if (!groupAdminByWallet(held, from, walletsMatch)) {
      note('handover', new Error(`generation ${generation} was offered by somebody who is not an admin of the room`));
      return held;
    }
    return persist(catchUpGroupGeneration(held, offer));
  });
  const retryWaitingHandovers = async (groupIdHex) => {
    const held = records.get(groupIdHex);
    if (!held || held.snapshotApplied === false || held.members.length === 0) return;
    const offers = [...(handoversWaiting.get(groupIdHex) ?? [])].sort((a, b) => Number(b.secret.generation) - Number(a.secret.generation));
    handoversWaiting.delete(groupIdHex);
    for (const { secret, from } of offers) {
      const before = records.get(groupIdHex);
      if ((await takeNewerGeneration(groupIdHex, secret, from)) !== before) break;
    }
  };

  const republishLostRekeys = async (record, pendingBefore = record.pendingControl ?? []) => {
    const lost = record.generationLost ?? [];
    if (lost.length === 0) return record;
    const lostRekeys = (pendingBefore ?? []).filter((e) => e.kind === GROUP_KIND.REMOVE && e.rekey
      && lost.some((l) => Number(l.generation) === Number(e.rekey.generation) && hex(l.key) === String(e.rekey.key)));
    const victims = lostRekeys.map((e) => e.victim?.groupKey).filter(Boolean);
    let next = await persist({ ...record, generationLost: [], pendingControl: (record.pendingControl ?? []).filter((e) => !lostRekeys.includes(e)) });
    for (const victimHex of victims) {
      try { next = await removeUnlocked(hex(next.groupId), unhexBytes(victimHex), { cutReading: true }); } catch (error) { note('rekey again', error); }
    }
    return records.get(hex(next.groupId)) ?? next;
  };

  const passLocked = createPerKeyLock();
  const NOT_READ = 'this pass did not read the lane';
  const lower = (address) => String(address).toLowerCase();
  const textOf = (value) => (value instanceof Uint8Array ? hex(value) : String(value ?? ''));
  const asStatesMap = (v) => (v instanceof Map ? v : new Map(Object.entries(v ?? {})));
  const heldKeyOf = (record) => `${record.epochs.map((e) => `${e.epoch}.${e.generation}`).join(',')}|${record.members.length}`;
  const WHOLE_FIELDS = ['name', 'entryFee', 'avatar', 'admins', 'owner'];
  const keyHexOf = (key) => (key instanceof Uint8Array ? hex(key) : String(key ?? '').toLowerCase());
  const wholeText = (record, field) => {
    switch (field) {
      case 'admins': return (record.admins ?? []).map(keyHexOf).sort().join(',');
      case 'owner': return record.owner ? keyHexOf(record.owner) : '';
      case 'avatar': return JSON.stringify(record.avatar ?? null);
      default: return String(record[field] ?? '');
    }
  };
  const keepWritesMadeDuringReads = (start, folded, since) => {
    const stillPending = new Set(folded.pendingControl ?? []);
    const seatedIn = (record, keyHex) => record.members.some((m) => hex(m.groupKey) === keyHex);
    const heldBefore = new Set(start.controlLog ?? []);
    const foldedNow = (folded.controlLog ?? []).filter((e) => !heldBefore.has(e));
    const outranked = (entry, about) => foldedNow.some((e) => Number(e.stamp?.[0] ?? 0) > Number(entry.at ?? 0) && about(e));
    const names = (e, keyHex) => (e.keys ?? []).some((k) => String(k).toLowerCase() === keyHex)
      || (e.members ?? []).some((m) => String(m?.groupKey ?? '').toLowerCase() === keyHex);
    let next = folded;
    for (const entry of start.pendingControl ?? []) {
      if (Number(entry.at ?? 0) < Number(since) || !stillPending.has(entry)) continue;
      const revert = entry.revert ?? {};
      for (const field of WHOLE_FIELDS) {
        if (!(field in revert) || wholeText(next, field) === wholeText(start, field)) continue;
        const kind = field === 'admins' || field === 'owner' ? GROUP_KIND.ADMIN : GROUP_KIND.PROFILE;
        if (outranked(entry, (e) => e.kind === kind && (kind === GROUP_KIND.ADMIN || field in (e.profile ?? {})))) continue;
        next = { ...next, [field]: start[field] };
      }
      if ('muted' in revert) {
        const before = new Set((revert.muted ?? []).map(keyHexOf));
        const after = new Set(String(entry.applied?.muted ?? '').split(',').filter(Boolean));
        const fresh = (k) => !outranked(entry, (e) => e.kind === GROUP_KIND.MUTE && names(e, k));
        const lifted = [...before].filter((k) => !after.has(k) && fresh(k));
        const held = new Set((next.muted ?? []).map(keyHexOf));
        const added = [...after].filter((k) => !before.has(k) && !held.has(k) && seatedIn(next, k) && fresh(k));
        if (lifted.some((k) => held.has(k)) || added.length > 0) {
          next = { ...next, muted: [...(next.muted ?? []).filter((m) => !lifted.includes(keyHexOf(m))), ...added.map(unhexBytes)] };
        }
      }
      if ('hidden' in revert) {
        const before = new Set(Object.keys(revert.hidden ?? {}));
        const after = new Set(String(entry.applied?.hidden ?? '').split(',').filter(Boolean));
        const fresh = (key) => !outranked(entry, (e) => e.kind === GROUP_KIND.HIDE && e.key === key);
        const hidden = { ...(next.hidden ?? {}) };
        let moved = false;
        for (const key of before) if (!after.has(key) && key in hidden && fresh(key)) { delete hidden[key]; moved = true; }
        for (const key of after) if (!before.has(key) && !(key in hidden) && start.hidden?.[key] && fresh(key)) { hidden[key] = start.hidden[key]; moved = true; }
        if (moved) next = { ...next, hidden };
      }
      if (entry.kind === GROUP_KIND.ADMIT) {
        for (const logged of entry.members ?? []) {
          const keyHex = keyHexOf(logged?.groupKey);
          if (!keyHex || seatedIn(next, keyHex)) continue;
          if (outranked(entry, (e) => (e.kind === GROUP_KIND.REMOVE || e.kind === GROUP_KIND.LEAVE) && names(e, keyHex))) continue;
          const seated = start.members.find((m) => hex(m.groupKey) === keyHex);
          if (!seated) continue;
          next = { ...next, members: [...next.members, seated], candidates: (next.candidates ?? []).filter((c) => hex(c.groupKey) !== keyHex) };
        }
      }
      if (entry.kind === GROUP_KIND.REMOVE && entry.victim?.groupKey) {
        const keyHex = keyHexOf(entry.victim.groupKey);
        if (seatedIn(next, keyHex) && !seatedIn(start, keyHex) && !outranked(entry, (e) => e.kind === GROUP_KIND.ADMIT && names(e, keyHex))) {
          next = {
            ...next,
            members: next.members.filter((m) => hex(m.groupKey) !== keyHex),
            admins: next.admins.filter((a) => keyHexOf(a) !== keyHex),
            muted: (next.muted ?? []).filter((m) => keyHexOf(m) !== keyHex),
          };
        }
      }
    }
    return next;
  };
  const seenMarksOf = (rows, gapped) => {
    const marks = [];
    for (const row of rows ?? []) if (!gapped.has(lower(row.address))) marks.push([row.address, Number(row.seq) + Math.max(1, Number(row.parts ?? 1)) - 1]);
    return marks;
  };
  const questionOf = (kind, args) => {
    if (kind === 'snapshot') {
      const p = args.pointer ?? {};
      return [textOf(args.rosterKey), textOf(args.groupId), p.epoch, p.generation, textOf(p.admin), p.seq, p.parts].join('|');
    }
    if (kind === 'roster') {
      return [textOf(args.rosterKey), textOf(args.groupId), args.generation, (args.epochs ?? []).join(','), (args.adminPublicKeys ?? []).map(textOf).join(',')].join('|');
    }
    return [(args.epochs ?? []).map((e) => `${textOf(e.groupId)}.${e.epoch}.${e.generation}.${textOf(e.key)}`).join(','), (args.memberPublicKeys ?? []).map(textOf).join(',')].join('|');
  };
  const lanesOf = async (kind, args) => {
    const buckets = kind === 'roster'
      ? await lane.rosterBuckets({ rosterKey: args.rosterKey, groupId: args.groupId, generation: args.generation, epochs: args.epochs, adminPublicKeys: args.adminPublicKeys, boundary })
      : await lane.buckets({ epochs: args.epochs, memberPublicKeys: args.memberPublicKeys, boundary });
    return (buckets ?? []).map((b) => lower(b.address));
  };
  const pageMarkOf = (knownSeqOf, address) => {
    const known = Number(typeof knownSeqOf === 'function' ? knownSeqOf(address) : NaN);
    return Number.isFinite(known) ? Math.max(known, 0) : -1;
  };

  const liveReads = () => {
    const asked = [];
    const markedRead = new Set();
    const walkedDeep = new Set();
    const fullWalk = (address) => {
      const key = lower(address);
      const owed = laneDeepWalk.get(key);
      if (!owed || laneClockMs() < owed.notBefore) return false;
      walkedDeep.add(key);
      return true;
    };
    const ask = async (kind, args, read) => {
      const entry = { kind, question: questionOf(kind, args), args, events: [], marks: new Map(), rows: [] };
      asked.push(entry);
      const rows = await read({
        ...args,
        knownSeqOf: (address) => { const known = args.knownSeqOf(address); entry.marks.set(lower(address), pageMarkOf(() => known, address)); return known; },
        onShardFailed: (address, error) => { entry.events.push(['failed', lower(address), error]); note(`shard ${address}`, error); args.onShardFailed?.(address, error); },
        onShardGap: (address, gap) => {
          const key = lower(address);
          entry.events.push(['gap', key, gap]);
          const count = (laneDeepWalk.get(key)?.count ?? 0) + (walkedDeep.has(key) ? 1 : 0);
          const delay = count > 0 ? Math.min(3_600_000, 60_000 * 2 ** Math.min(count - 1, 16)) : 0;
          laneDeepWalk.delete(key);
          laneDeepWalk.set(key, { count, notBefore: laneClockMs() + delay });
          while (laneDeepWalk.size > BOOKKEEPING_MAX) laneDeepWalk.delete(laneDeepWalk.keys().next().value);
          note(`lane gap ${address}`, gap);
          args.onShardGap?.(address, gap);
        },
        onShardRead: (address, info) => {
          if (info?.gap !== false) return;
          markedRead.add(lower(address));
          laneDeepWalk.delete(lower(address));
        },
        fullWalk,
      });
      entry.rows = rows ?? [];
      return entry.rows;
    };
    const io = {
      async readSnapshot(args) {
        const row = await lane.readSnapshot({ ...args, onShardFailed: (address, error) => note(`shard ${address}`, error) });
        asked.push({ kind: 'snapshot', question: questionOf('snapshot', args), row: row ?? null });
        return row;
      },
      readStates: typeof readStates === 'function' ? (addresses) => readStates(addresses) : null,
      readRoster: (args) => ask('roster', args, (full) => lane.readRoster(full)),
      read: (args) => ask('daily', args, (full) => lane.read(full)),
    };
    return { io, asked, markedRead };
  };

  const replayedReads = (asked) => {
    const used = new Set();
    const order = new Map();
    for (const entry of asked) for (const row of entry.rows ?? []) order.set(row, order.size);
    let heard = null;
    const lanesHeard = async () => {
      if (heard) return heard;
      heard = { roster: new Map(), daily: new Map() };
      for (const entry of asked) {
        if (entry.kind === 'snapshot') continue;
        const byLane = heard[entry.kind];
        const laneAt = (address) => {
          let at = byLane.get(address);
          if (!at) { at = { events: [], rows: [], seqs: new Set(), mark: null }; byLane.set(address, at); }
          return at;
        };
        for (const address of await lanesOf(entry.kind, entry.args)) laneAt(address);
        for (const [type, address, info] of entry.events) laneAt(address).events.push([type, info]);
        for (const [address, mark] of entry.marks) { const at = laneAt(address); at.mark = at.mark === null ? mark : Math.max(at.mark, mark); }
        for (const row of entry.rows) {
          const at = byLane.get(lower(row.address));
          const identity = `${row.seq}|${row.parts ?? 1}|${row.kind}|${row.sentAt ?? ''}|${row.createdAt ?? ''}`;
          if (!at || at.seqs.has(identity)) continue;
          at.seqs.add(identity);
          at.rows.push(row);
        }
      }
      return heard;
    };
    const tell = (args, type, address, info) => {
      if (type === 'failed') args.onShardFailed?.(address, info);
      else if (type === 'gap') args.onShardGap?.(address, info);
    };
    const answer = async (kind, args) => {
      const question = questionOf(kind, args);
      const same = asked.find((entry) => entry.kind === kind && entry.question === question);
      if (same && [...same.marks].every(([address, mark]) => pageMarkOf(args.knownSeqOf, address) >= mark)) {
        for (const [type, address, info] of same.events) { tell(args, type, address, info); used.add(address); }
        for (const address of same.marks.keys()) used.add(address);
        for (const row of same.rows) used.add(lower(row.address));
        return same.rows;
      }
      const byLane = (await lanesHeard())[kind];
      const rows = [];
      for (const address of await lanesOf(kind, args)) {
        const at = byLane.get(address);
        if (!at || (at.mark !== null && pageMarkOf(args.knownSeqOf, address) < at.mark)) {
          args.onShardFailed?.(address, new Error(NOT_READ));
          continue;
        }
        for (const [type, info] of at.events) tell(args, type, address, info);
        used.add(address);
        rows.push(...at.rows);
      }
      return rows.sort((a, b) => order.get(a) - order.get(b));
    };
    const io = {
      async readSnapshot(args) {
        const question = questionOf('snapshot', args);
        return asked.find((entry) => entry.kind === 'snapshot' && entry.question === question)?.row ?? null;
      },
      readStates: typeof readStates === 'function' ? async () => new Map() : null,
      readRoster: (args) => answer('roster', args),
      read: (args) => answer('daily', args),
    };
    return { io, used };
  };

  const walkRoom = async (record, io, at) => {
    let current = clockTrusted() ? await advanceGroupWindow(record, at) : record;
    const today = currentGroupEpoch(current);
    const rosterKey = groupRosterKeyFor(current, today.generation);
    const rekeys = [];

    if (rosterKey && current.snapshot && !current.snapshotApplied) {
      const snap = await io.readSnapshot({ rosterKey, groupId: current.groupId, pointer: current.snapshot, boundary });
      if (snap) current = { ...applyGroupRows(current, [snap]).record, snapshotApplied: true };
    }

    const failedShards = new Set();
    const shardFailedHere = (address) => { failedShards.add(lower(address)); };
    const gapped = new Set();
    const shardGapHere = (address) => { gapped.add(lower(address)); };
    const troubled = (address) => failedShards.has(lower(address)) || gapped.has(lower(address));
    const rosterAddresses = new Set();
    const knownSeqOf = (address) => {
      const key = lower(address);
      const held = current.seenSeq?.[key];
      if (held !== undefined && held !== null) return Number(held);
      return rosterAddresses.has(key) ? 0 : -1;
    };
    const noteSeen = (rows) => { current = noteSeenSeqs(current, seenMarksOf(rows, gapped)); };
    const memberPublicKeys = groupMemberPublicKeys(current);
    const epochs = groupEpochsToRead(current, at).map((e) => ({ groupId: current.groupId, ...e }));
    const rosterEpochs = [];
    if (rosterKey && current.admins.length > 0) {
      const from = Math.min(Number(current.rosterCursor ?? today.epoch), today.epoch);
      for (let e = Math.max(from, today.epoch - 366); e <= today.epoch; e += 1) rosterEpochs.push(e);
    }
    const rosterReads = [
      ...(rosterEpochs.length > 0 ? [{ rosterKey, generation: today.generation, epochs: rosterEpochs }] : []),
      ...(current.admins.length > 0 ? rosterReadsOfPreviousGeneration(current, today) : []),
    ];
    let pendingBeforeSettle = current.pendingControl ?? [];
    let reverted = [];
    const rosterBuckets = [];
    for (const read of rosterReads) {
      rosterBuckets.push(...await lane.rosterBuckets({
        rosterKey: read.rosterKey, groupId: current.groupId, generation: read.generation, epochs: read.epochs, adminPublicKeys: current.admins, boundary,
      }));
    }
    const pendingReads = [];
    if (rosterReads.length > 0 && current.self) {
      for (const entry of current.pendingControl ?? []) {
        const generation = Number(entry.generation ?? 0);
        const epoch = Number(entry.epoch);
        if (!Number.isInteger(generation) || !Number.isInteger(epoch)) continue;
        const read = rosterBuckets.some((b) => Number(b.generation) === generation && Number(b.epoch) === epoch && sameKey(b.member, current.self))
          || pendingReads.some((r) => r.generation === generation && r.epochs[0] === epoch);
        if (read) continue;
        const rosterKeyThen = groupRosterKeyFor(current, generation);
        if (rosterKeyThen) pendingReads.push({ rosterKey: rosterKeyThen, generation, epochs: [epoch] });
      }
    }
    const pendingBuckets = [];
    for (const read of pendingReads) {
      pendingBuckets.push(...await lane.rosterBuckets({
        rosterKey: read.rosterKey, groupId: current.groupId, generation: read.generation, epochs: read.epochs, adminPublicKeys: [current.self], boundary,
      }));
    }
    for (const bucket of [...rosterBuckets, ...pendingBuckets]) rosterAddresses.add(lower(bucket.address));
    const buckets = await lane.buckets({ epochs, memberPublicKeys, boundary });
    const states = typeof io.readStates === 'function'
      ? await io.readStates([...rosterBuckets, ...pendingBuckets, ...buckets].map((b) => b.address))
      : null;
    if (rosterReads.length > 0) {
      const rosterRows = [];
      for (const read of rosterReads) {
        rosterRows.push(...await io.readRoster({
          rosterKey: read.rosterKey, groupId: current.groupId, generation: read.generation, epochs: read.epochs,
          adminPublicKeys: current.admins, states, knownSeqOf, boundary, onShardFailed: shardFailedHere, onShardGap: shardGapHere,
        }));
      }
      for (const read of pendingReads) {
        rosterRows.push(...await io.readRoster({
          rosterKey: read.rosterKey, groupId: current.groupId, generation: read.generation, epochs: read.epochs,
          adminPublicKeys: [current.self], states, knownSeqOf, boundary, onShardFailed: shardFailedHere, onShardGap: shardGapHere,
        }));
      }
      noteSeen(rosterRows);
      current = noteRosterSeen(current, rosterRows);
      current = noteGroupSeqFromRows(current, rosterRows);
      const adminsBefore = current.admins;
      const folded = applyGroupRows(current, rosterRows);
      current = folded.record;
      rekeys.push(...folded.rekeys);
      const newAdmins = current.admins.filter((a) => !adminsBefore.some((b) => sameKey(a, b)));
      let adminsSettled = true;
      if (newAdmins.length > 0) {
        const extraBuckets = [];
        for (const read of rosterReads) {
          extraBuckets.push(...await lane.rosterBuckets({
            rosterKey: read.rosterKey, groupId: current.groupId, generation: read.generation, epochs: read.epochs, adminPublicKeys: newAdmins, boundary,
          }));
        }
        for (const bucket of extraBuckets) rosterAddresses.add(lower(bucket.address));
        let extraStates = states;
        if (typeof io.readStates === 'function' && extraBuckets.length > 0) {
          const more = await io.readStates(extraBuckets.map((b) => b.address));
          extraStates = new Map([...asStatesMap(states), ...asStatesMap(more)]);
        }
        const extraRows = [];
        for (const read of rosterReads) {
          extraRows.push(...await io.readRoster({
            rosterKey: read.rosterKey, groupId: current.groupId, generation: read.generation, epochs: read.epochs,
            adminPublicKeys: newAdmins, states: extraStates, knownSeqOf, boundary, onShardFailed: shardFailedHere, onShardGap: shardGapHere,
          }));
        }
        noteSeen(extraRows);
        current = noteRosterSeen(current, extraRows);
        current = noteGroupSeqFromRows(current, extraRows);
        const adminsThen = current.admins;
        const foldedMore = applyGroupRows(current, extraRows);
        current = foldedMore.record;
        rekeys.push(...foldedMore.rekeys);
        rosterBuckets.push(...extraBuckets);
        adminsSettled = current.admins.every((a) => adminsThen.some((b) => sameKey(a, b)));
      }
      const rosterClean = rosterBuckets.every((b) => !troubled(b.address)) && (current.snapshotApplied !== false) && adminsSettled;
      if (rosterClean) current = { ...current, rosterCursor: today.epoch };
      const ownBuckets = [...rosterBuckets, ...pendingBuckets].filter((b) => sameKey(b.member, current.self));
      const cleanLanes = new Set(ownBuckets.map((b) => `${Number(b.generation)}.${Number(b.epoch)}`));
      for (const b of ownBuckets) if (troubled(b.address)) cleanLanes.delete(`${Number(b.generation)}.${Number(b.epoch)}`);
      pendingBeforeSettle = current.pendingControl ?? [];
      const settled = settlePendingControl(current, { rosterRows, cleanLanes, nowSec: at });
      reverted = settled.reverted;
      current = settled.record;
    }

    let laneBuckets = buckets;
    let laneStates = states;
    const membersNow = groupMemberPublicKeys(current);
    const membersChanged = membersNow.length !== memberPublicKeys.length || membersNow.some((k, i) => !sameKey(k, memberPublicKeys[i]));
    if (membersChanged) {
      laneBuckets = await lane.buckets({ epochs, memberPublicKeys: membersNow, boundary });
      const fetched = new Set([...rosterBuckets, ...buckets].map((b) => lower(b.address)));
      const missing = laneBuckets.map((b) => b.address).filter((a) => !fetched.has(lower(a)));
      if (missing.length > 0 && typeof io.readStates === 'function') {
        const more = await io.readStates(missing);
        laneStates = new Map([...asStatesMap(states), ...asStatesMap(more)]);
      }
    }
    const rows = await io.read({
      epochs, memberPublicKeys: groupMemberPublicKeys(current), states: laneStates, knownSeqOf, boundary, onShardFailed: shardFailedHere, onShardGap: shardGapHere,
    });
    return { current, rows, rekeys, epochs, laneBuckets, rosterBuckets, pendingBuckets, gapped, troubled, pendingBeforeSettle, reverted };
  };

  const finishRoom = async (start, walked, { deliver, verdicts, readFromMs }) => {
    let { current } = walked;
    const { rows, epochs, laneBuckets, rosterBuckets, pendingBuckets, gapped, troubled, pendingBeforeSettle } = walked;
    for (const entry of walked.reverted) note('control write taken back', new Error(`kind ${entry.kind}, seq ${entry.seq}`));
    if (requests) {
      for (const entry of walked.reverted) {
        if (entry.kind !== GROUP_KIND.ADMIT) continue;
        for (const member of entry.members ?? []) {
          try { await requests.add(hex(current.groupId), { ...member, at: Number(entry.at ?? 0) }); } catch (error) { note('requests', error); }
        }
      }
    }
    const seenBeforeDaily = current.seenSeq ?? {};
    current = noteSeenSeqs(current, seenMarksOf(rows, gapped));
    current = noteGroupSeqFromRows(current, rows);
    const folded = applyGroupRows(current, rows);
    current = folded.record;
    const rekeys = [...walked.rekeys, ...folded.rekeys];
    const readWhole = epochs.filter((e) => !laneBuckets.some((b) => Number(b.epoch) === Number(e.epoch) && troubled(b.address)));
    const readBefore = new Set(current.epochs.filter((e) => e.read === true).map((e) => `${e.epoch}.${e.generation}`));
    current = markGroupEpochsRead(current, readWhole);
    const ownLaneRead = !laneBuckets.some((b) => sameKey(b.member, current.self) && troubled(b.address));
    const heldKey = heldKeyOf(current);
    let heldLanes = null;
    const deriveHeldLanes = async () => { if (!heldLanes) heldLanes = await lane.buckets({ epochs: current.epochs.map((e) => ({ groupId: current.groupId, ...e })), memberPublicKeys: groupMemberPublicKeys(current), boundary }); return heldLanes; };
    if (pruneKeys.get(hex(current.groupId)) !== heldKey) {
      current = pruneSeenSeq(current, [...rosterBuckets, ...pendingBuckets, ...(await deriveHeldLanes())].map((b) => b.address));
      pruneKeys.set(hex(current.groupId), heldKey);
    }

    let rekeyTrouble = null;
    for (const rekey of rekeys) {
      try {
        const opened = await openGroupRekeyEnvelope({
          groupId: current.groupId,
          envelope: rekey.envelope,
          memberGroupKey: current.self,
          x25519SecretKey: identity.x25519SecretKey,
          mlKem768SecretKey: identity.mlKem768SecretKey,
        });
        if (opened) {
          const heldBefore = holdsGroupGeneration(current, opened.generation, opened.key);
          current = adoptGroupGeneration(current, { epoch: rekey.epoch, generation: opened.generation, key: opened.key, stamp: rekey.stamp ?? null });
          if (!heldBefore && holdsGroupGeneration(current, opened.generation, opened.key)) {
            current = noteGroupRosterKey(current, opened.generation,
              await groupRosterKey({ key: opened.key, groupId: current.groupId, generation: opened.generation }));
            current = { ...current, snapshot: null, admitsSinceSnapshot: 0, rosterCursor: rekey.epoch };
          }
        }
      } catch (error) {
        note('rekey', error);
        rekeyTrouble = rekeyTrouble === null ? Number(rekey.epoch) : Math.min(rekeyTrouble, Number(rekey.epoch));
      }
    }
    if (rekeyTrouble !== null && Number.isFinite(rekeyTrouble)) {
      current = { ...current, rosterCursor: Math.min(Number(current.rosterCursor ?? rekeyTrouble), rekeyTrouble) };
      try { lane.forgetShards?.(rosterBuckets.filter((b) => Number(b.epoch) >= rekeyTrouble).map((b) => b.address)); } catch (error) { note('forget', error); }
    }
    const silencedBefore = new Set((start.muted ?? []).map(hex));
    const silencedAfter = new Set((current.muted ?? []).map(hex));
    const hiddenBefore = new Set(Object.keys(start.hidden ?? {}));
    const hiddenAfter = new Set(Object.keys(current.hidden ?? {}));
    const liftedNow = [...silencedBefore].filter((k) => !silencedAfter.has(k));
    const unhiddenNow = [...hiddenBefore].filter((k) => !hiddenAfter.has(k));
    const handedBefore = (m) => Number(m.seq) + Math.max(1, Number(m.parts ?? 1)) - 1 <= Number(seenBeforeDaily[String(m.address ?? '').toLowerCase()] ?? -1);
    const leftBefore = Number(start.leftAt ?? 0);
    const messages = folded.messages
      .filter((m) => m.hidden || !handedBefore(m))
      .filter((m) => !(leftBefore > 0) || sameKey(m.senderGroupKey, current.self) || Number(m.payload?.sentAt ?? 0) <= leftBefore);
    const entry = {
      groupId: hex(current.groupId), record: current, messages, ownLaneRead,
      readFromMs,
      silencedNow: [...silencedAfter].filter((k) => !silencedBefore.has(k)),
      liftedNow,
      hiddenNow: [...hiddenAfter].filter((k) => !hiddenBefore.has(k)),
      unhiddenNow,
    };
    let stored = true;
    if (typeof deliver === 'function') {
      try { stored = (await deliver(entry)) !== false; } catch (error) { note('deliver', error); stored = false; }
    }
    if (!stored) {
      const seenSeq = { ...(current.seenSeq ?? {}) };
      for (const row of rows) {
        const key = String(row.address ?? '').toLowerCase();
        if (key in seenBeforeDaily) seenSeq[key] = seenBeforeDaily[key]; else delete seenSeq[key];
      }
      current = { ...current, seenSeq, epochs: current.epochs.map((e) => (e.read === true && !readBefore.has(`${e.epoch}.${e.generation}`) ? { ...e, read: false } : e)) };
      try { lane.forgetShards?.([...new Set(rows.map((row) => lower(row.address ?? '')))]); } catch (error) { note('forget', error); }
    }
    await persist(current);
    if (!current.leftAt) {
      current = await republishLostRekeys(current, pendingBeforeSettle);
      current = await applyEntryVerdicts(current, verdicts);
    }
    if (liftedNow.length > 0 || unhiddenNow.length > 0) {
      current = await persist(await forgetLiftedLanes(current, { members: liftedNow.map(unhexBytes), rows: unhiddenNow }));
    }
    return { ...entry, record: current };
  };

  const passRoom = (id, deliver) => passLocked(id, async () => {
    const found = records.get(id);
    if (!found) return [];
    if (found.leftAt && now() - Number(found.leftAt) > GROUP_LEFT_READ_S) return [];
    const at = now();
    const readFromMs = Date.now();
    const reads = liveReads();
    const forget = (addresses) => {
      if (addresses.length === 0) return;
      try { lane.forgetShards?.(addresses); } catch (error) { note('forget', error); }
    };
    let verdicts = [];
    try {
      const walked = await walkRoom(found, reads.io, at);
      verdicts = await readEntryVerdicts(walked.current);
      if (pruneKeys.get(id) !== heldKeyOf(walked.current)) {
        await lane.buckets({ epochs: walked.current.epochs.map((e) => ({ groupId: walked.current.groupId, ...e })), memberPublicKeys: groupMemberPublicKeys(walked.current), boundary });
      }
    } catch (error) {
      forget([...reads.markedRead]);
      note(`group ${id}`, error);
      return [];
    }
    return locked(id, async () => {
      const start = records.get(id);
      const replay = replayedReads(reads.asked);
      let walked = null;
      try {
        if (start) walked = await walkRoom(start, replay.io, at);
        if (walked) walked = { ...walked, current: keepWritesMadeDuringReads(start, walked.current, at) };
      } catch (error) { note(`group ${id}`, error); }
      forget([...reads.markedRead].filter((address) => !(walked && replay.used.has(address))));
      if (!walked) return [];
      try {
        return [await finishRoom(start, walked, { deliver, verdicts, readFromMs })];
      } catch (error) {
        forget([...reads.markedRead]);
        note(`group ${id}`, error);
        return [];
      }
    });
  });

  const api = {
    list() { return [...records.values()]; },
    get(groupId) { return records.get(String(groupId)) ?? null; },

    laneProvenLive(groupId, lane = 'daily') {
      const record = records.get(String(groupId));
      if (!record) return false;
      const state = currentGroupEpoch(record);
      return provenLiveKeys.has(laneKeyOf({ groupId: record.groupId, lane, epoch: state.epoch, generation: state.generation }));
    },

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
      for (const record of [...records.values()]) {
        if (record.leftAt || !record.self || !record.admins.some((a) => sameKey(a, record.self))) continue;
        if (record.members.some((m) => sameKey(m.groupKey, record.self))) continue;
        await persist({ ...record, members: [...record.members, selfMember(record.self)] });
      }
      if (requests) {
        for (const record of [...records.values()]) {
          const id = hex(record.groupId);
          const carried = record.candidates ?? [];
          try {
            for (const candidate of carried) await requests.add(id, serializeGroupCandidate(candidate));
          } catch (error) { note('requests', error); }
          const waiting = (await queueList(id)) ?? carried;
          const seated = waiting.filter((c) => record.members.some((m) => sameKey(m.groupKey, c.groupKey)));
          for (const gone of seated) {
            try { await requests.remove(id, hex(gone.groupKey)); } catch (error) { note('requests', error); }
          }
          const open = waiting.filter((c) => !seated.includes(c));
          records.set(id, { ...record, candidates: open });
          if (carried.length > 0) await persist({ ...record, candidates: open });
        }
      }
      return this.list();
    },

    async create({ name = null } = {}) {
      const founding = await createGroupFounding({ entropy: randomEntropy(random), createdAtSec: now() });
      const memberSeed = await groupMemberSeed({ vaultSeed: identity.vaultSeed, groupId: founding.groupId });
      const self = groupMemberPublicKey(memberSeed);
      const me = selfMember(self);
      return persist(createGroupRecord({ founding, name, self, members: [me], admins: [self], owner: self, openedAt: now() }));
    },

    secretFor(groupId, { admitted = false, since = null } = {}) {
      const record = this.get(groupId);
      if (!record) throw new Error('no such group');
      const state = currentGroupEpoch(record);
      const rosterKey = groupRosterKeyFor(record, state.generation);
      const snapshot = record.snapshot && Number(record.snapshot.generation) === Number(state.generation) ? record.snapshot : null;
      const day = admitted && Number.isSafeInteger(since)
        ? record.epochs
          .filter((e) => Number(e.generation) === Number(state.generation) && Number(e.epoch) >= since && Number(e.epoch) <= Number(state.epoch))
          .reduce((first, e) => (!first || Number(e.epoch) < Number(first.epoch) ? e : first), null) ?? state
        : state;
      return {
        groupId: hex(record.groupId),
        key: hex(day.key),
        epoch: day.epoch,
        generation: state.generation,
        name: record.name,
        inviter: record.self ? hex(record.self) : null,
        rosterKey: rosterKey ? hex(rosterKey) : null,
        snapshot: snapshot
          ? { epoch: snapshot.epoch, generation: snapshot.generation, admin: hex(snapshot.admin), seq: snapshot.seq, parts: snapshot.parts }
          : null,
        ...(admitted ? { admitted: true } : {}),
      };
    },

    accessOwed() {
      const out = [];
      for (const record of records.values()) {
        if (record.leftAt) continue;
        for (const owed of record.accessOwed ?? []) {
          const groupKey = unhexBytes(owed.groupKey);
          out.push({
            groupId: hex(record.groupId), groupKey, groupKeyHex: owed.groupKey, wallet: owed.wallet ?? null, keyId: owed.keyId ?? null,
            name: owed.name ?? null, at: Number(owed.at ?? 0), since: owed.since ?? null, member: Boolean(groupMember(record, groupKey)),
          });
        }
      }
      return out;
    },

    async noteAccessSent(groupId, groupKey) {
      const record = this.get(groupId);
      if (!record) return null;
      const next = clearGroupAccessOwed(record, groupKey);
      return next === record ? record : persist(next);
    },

    controlPlan(groupId, kind, { admins = null, owner = null, members = null, name = null, groupKey = null, key = null, excerpt = '', entryFee = undefined } = {}) {
      const record = this.get(groupId);
      if (!record) throw new Error('no such group');
      if (kind === GROUP_KIND.MUTE) return groupCapsulePlan(encodeGroupMute({ groupKey: groupKey ?? record.self, sentAt: now() }).length);
      if (kind === GROUP_KIND.HIDE) return groupCapsulePlan(encodeGroupHide({ key: key ?? `0.0.${hex(record.self)}.0`, excerpt, sentAt: now() }).length);
      if (kind === GROUP_KIND.LEAVE) return groupCapsulePlan(encodeGroupLeave({ groupKey: record.self, sentAt: now() }).length);
      const payload = kind === GROUP_KIND.ADMIT
        ? encodeGroupAdmit({ members: members ?? [], sentAt: now() })
        : kind === GROUP_KIND.PROFILE
          ? encodeGroupProfile(entryFee === undefined ? { name: String(name ?? record.name ?? ''), sentAt: now() } : { entryFee, sentAt: now() })
          : encodeGroupAdmins({ admins: admins ?? record.admins, owner, sentAt: now() });
      return groupCapsulePlan(payload.length);
    },

    snapshotPlan(groupId) {
      const record = this.get(groupId);
      if (!record) throw new Error('no such group');
      const current = currentGroupEpoch(record);
      const held = record.snapshot;
      const fresh = held && Number(held.generation) === Number(current.generation)
        && Number(record.admitsSinceSnapshot ?? 0) < SNAPSHOT_MAX_ADMITS
        && (Number(current.epoch) - Number(held.epoch)) < SNAPSHOT_MAX_DAYS;
      if (fresh) return null;
      return groupCapsulePlan(rosterSnapshotPayload(record).length);
    },

    async ensureSnapshot(groupId) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      refuseLeft(record);
      if (!isGroupAdmin(record, record.self)) throw new Error('only an admin may take a snapshot');
      const current = currentGroupEpoch(record);
      const held = record.snapshot;
      const fresh = held && Number(held.generation) === Number(current.generation)
        && Number(record.admitsSinceSnapshot ?? 0) < SNAPSHOT_MAX_ADMITS
        && (Number(current.epoch) - Number(held.epoch)) < SNAPSHOT_MAX_DAYS;
      if (fresh) return record;
      const payload = rosterSnapshotPayload(record);
      const { messages, firstSeq, lastSeq, count, state, record: floored, route } = await publishRoster(record, GROUP_KIND.ROSTER, payload);
      await sendOrLanded(messages, route);
      const snapshot = { epoch: state.epoch, generation: state.generation, admin: record.self, seq: firstSeq, parts: count, at: now() };
      return persist(notePendingControl(noteGroupSeq({ ...floored, snapshot, snapshotApplied: true, admitsSinceSnapshot: 0 }, { ...state, seq: lastSeq }), {
        kind: GROUP_KIND.ROSTER, epoch: state.epoch, generation: state.generation, seq: firstSeq, at: now(),
        revert: { snapshot: snapshotForRevert(record.snapshot), admitsSinceSnapshot: Number(record.admitsSinceSnapshot ?? 0) },
      }));
    },

    async noteInvite(groupId, member) {
      const record = this.get(groupId);
      if (!record) throw new Error('no such group');
      refuseLeft(record);
      if (!isGroupAdmin(record, record.self)) throw new Error('only an admin may invite');
      const state = currentGroupEpoch(record);
      return persist(notePendingGroupInvite(record, {
        ...member, generation: member?.generation ?? state.generation, epoch: member?.epoch ?? state.epoch, at: now(),
      }));
    },

    async adopt(secret, { name = null, from = null } = {}) {
      const groupId = unhexBytes(secret.groupId);
      const key = unhexBytes(secret.key);
      const today = groupEpochFromSeconds(now());
      if (!Number.isInteger(Number(secret.epoch)) || today - Number(secret.epoch) > GROUP_MAX_RATCHET_STEPS) {
        throw new RangeError(`the invite's epoch ${secret.epoch} is out of the ratchet's reach from ${today}`);
      }
      if (Number(secret.epoch) > today + 1) throw new RangeError(`the invite's epoch ${secret.epoch} is in the future`);
      {
        const held = records.get(hex(groupId));
        if (held && !held.leftAt) return takeNewerGeneration(hex(groupId), secret, from);
      }
      const memberSeed = await groupMemberSeed({ vaultSeed: identity.vaultSeed, groupId });
      const self = groupMemberPublicKey(memberSeed);
      const generation = Number(secret.generation);
      if (!Number.isInteger(generation) || generation < 0) throw new RangeError(`the invite names no valid generation (${secret.generation})`);
      if (groupId.length !== GROUP_KEY_BYTES || key.length !== GROUP_KEY_BYTES) throw new RangeError('the invite carries no valid group id or day key');
      const rosterKey = secret.rosterKey ? unhexBytes(secret.rosterKey) : null;
      if (rosterKey && rosterKey.length !== GROUP_KEY_BYTES) throw new RangeError('the invite carries no valid roster key');
      const inviter = secret.inviter ? unhexBytes(secret.inviter) : null;
      if (inviter && !isValidGroupKey(inviter)) throw new RangeError('the invite names an inviter key that is not a point');
      if (secret.snapshot && !isValidGroupKey(unhexBytes(secret.snapshot.admin))) throw new RangeError('the invite points at a snapshot of no valid admin');
      const snapshot = secret.snapshot
        ? {
          epoch: Number(secret.snapshot.epoch), generation: Number(secret.snapshot.generation),
          admin: unhexBytes(secret.snapshot.admin), seq: Number(secret.snapshot.seq), parts: Number(secret.snapshot.parts), at: 0,
        }
        : null;
      const record = createGroupRecord({
        founding: { groupId, key, epoch: Number(secret.epoch), generation, ...(rosterKey ? { rosterKey } : {}) },
        openedAt: now(),
        name: secret.name ?? name,
        self,
        members: inviter && sameKey(inviter, self) ? [selfMember(self)] : [],
        admins: [
          ...(inviter ? [inviter] : []),
          ...(snapshot?.admin && !(inviter && sameKey(inviter, snapshot.admin)) ? [snapshot.admin] : []),
        ],
      });
      const id = hex(groupId);
      return locked(id, async () => {
        const meanwhile = records.get(id);
        if (meanwhile && !meanwhile.leftAt) return meanwhile;
        return persist({
          ...record,
          snapshot,
          snapshotApplied: !snapshot,
          rosterCursor: snapshot ? snapshot.epoch : Number(secret.epoch),
        });
      });
    },

    async askTokenFor(groupId) {
      const bytes = unhexBytes(groupId);
      if (bytes.length !== 32) throw new RangeError('a request needs a group id');
      return encodeGroupJoinToken({
        groupId: bytes,
        groupKey: await this.memberKeyFor(groupId),
        wallet: identity.wallet ?? '',
        keyId: identity.keyId ?? '',
        name: identity.name ?? null,
        x25519PublicKey: identity.x25519PublicKey ?? null,
        mlKem768PublicKey: identity.mlKem768PublicKey ?? null,
      });
    },

    async memberKeyFor(groupId) {
      const bytes = unhexBytes(groupId);
      if (bytes.length !== 32) throw new RangeError('a member key needs a group id');
      return groupMemberPublicKey(await groupMemberSeed({ vaultSeed: identity.vaultSeed, groupId: bytes }));
    },

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

    async noteCandidate(groupId, candidate) {
      const record = this.get(groupId);
      if (!record) return null;
      if (record.leftAt) return record;
      if (!isGroupAdmin(record, record.self)) return record;
      if (!isValidGroupKey(candidate?.groupKey)) { note('candidate', new RangeError('join token key is not a curve point')); return record; }
      if (!isValidMemberKeys(candidate)) { note('candidate', new RangeError('join token KeyShard keys cannot be wrapped to')); return record; }
      if (groupMember(record, candidate.groupKey)) return record;
      const invite = matchPendingGroupInvite(record, candidate);
      if (invite) {
        try {
          const admitted = await admitUnlocked(hex(record.groupId), [candidate]);
          return persist(clearPendingGroupInvite(admitted, matchPendingGroupInvite(admitted, candidate) ?? invite));
        } catch (error) {
          note('auto-admit', error);
          return noteWaiting(this.get(groupId) ?? record, candidate);
        }
      }
      const fee = groupEntryFeeIn(record.entryFee);
      if (fee !== null) {
        const held = (record.candidates ?? []).find((c) => sameKey(c.groupKey, candidate.groupKey));
        if (held && held.paid === false && now() - Number(held.at ?? 0) > ENTRY_RECHECK_S) return record;
        const verdict = await verifyEntryPayment(record, candidate);
        if (verdict?.paid === true) {
          try {
            return await admitUnlocked(hex(record.groupId), [candidate]);
          } catch (error) {
            note('auto-admit', error);
            return noteWaiting(this.get(groupId) ?? record, candidate, { paid: true });
          }
        }
        return noteWaiting(record, candidate, { paid: verdict ? false : null });
      }
      return noteWaiting(record, candidate);
    },

    async declineCandidate(groupId, groupKey) {
      const record = this.get(groupId);
      if (!record) return null;
      if (!isGroupAdmin(record, record.self)) throw new Error('only an admin may decline');
      const next = declineGroupCandidate(record, groupKey);
      if (next === record) return record;
      if (requests) {
        try {
          await requests.add(hex(record.groupId), serializeGroupCandidate(next.candidates.find((c) => sameKey(c.groupKey, groupKey))));
        } catch (error) { note('requests', error); }
      }
      return remember(next);
    },

    async setEntryFee(groupId, entryFee) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      refuseLeft(record);
      if (!isGroupOwner(record, record.self)) throw new Error('only the owner sets the entry fee');
      const next = groupEntryFeeIn(entryFee);
      if (entryFee !== null && entryFee !== undefined && String(entryFee) !== '0' && next === null) throw new RangeError('an entry fee is a positive number of atomic ATH');
      if (next !== null && BigInt(next) < 2n) throw new RangeError('an entry fee is at least two atomic units — one cannot be split');
      if (next !== null && !identity.wallet) throw new Error('a priced room needs the owner\'s wallet');
      if (next === groupEntryFeeIn(record.entryFee)) return record;
      const profile = await publishRoster(record, GROUP_KIND.PROFILE, encodeGroupProfile({ entryFee: next, sentAt: now() }));
      await sendOrLanded(profile.messages, profile.route);
      return persist(notePendingControl(noteGroupSeq({ ...profile.record, entryFee: next }, { ...profile.state, seq: profile.lastSeq }), {
        kind: GROUP_KIND.PROFILE, epoch: profile.state.epoch, generation: profile.state.generation, seq: profile.firstSeq, at: now(),
        revert: { entryFee: record.entryFee ?? null },
      }));
    },

    async say(groupId, text, { replyTo = null, onSealed = null } = {}) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      refuseLeft(record);
      if (isGroupMuted(record, record.self)) throw new Error('an admin has muted this device in the room');
      const payload = encodeGroupText({ text, replyTo, sentAt: now() });
      const { messages, firstSeq, lastSeq, state, record: floored, route } = await publish(record, GROUP_KIND.TEXT, payload, { floorEveryTime: true });
      const claimed = await persist(noteGroupSeq(floored, { ...state, seq: lastSeq }));
      if (typeof onSealed === 'function') await onSealed({ epoch: state.epoch, generation: state.generation, firstSeq, lastSeq, self: record.self });
      await sendOrLanded(messages, route);
      return { record: claimed, epoch: state.epoch, generation: state.generation, firstSeq, lastSeq };
    },

    async leave(groupId) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      if (record.leftAt) return record;
      if (isGroupAdmin(record, record.self) && record.admins.length <= 1 && record.members.length > 1) {
        throw new RangeError('the only admin cannot leave while others remain — name another admin first');
      }
      if (isGroupOwner(record, record.self) && record.members.length > 1) {
        throw new RangeError('the owner hands the group on before leaving');
      }
      const payload = encodeGroupLeave({ groupKey: record.self, sentAt: now() });
      const { messages, lastSeq: seq, state, record: floored, route } = await publish(record, GROUP_KIND.LEAVE, payload);
      await sendOrLanded(messages, route);
      const next = { ...noteGroupSeq(floored, { ...state, seq }), leftAt: now() };
      return persist(next);
    },

    plan(groupId, victimGroupKey) {
      const record = this.get(groupId);
      if (!record) throw new Error('no such group');
      const plan = groupRemovalPlan(record, victimGroupKey);
      const envelopeBytes = groupRekeyEnvelopeBytes(plan.wrappable.length);
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

    async remove(groupId, victimGroupKey, { cutReading = true } = {}) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      refuseLeft(record);
      if (!isGroupAdmin(record, record.self)) throw new Error('only an admin may remove');
      if (isGroupOwner(record, victimGroupKey)) throw new RangeError('the owner cannot be removed — hand the group on first');
      if (isGroupAdmin(record, victimGroupKey) && record.admins.length <= 1) throw new RangeError('the last admin cannot be removed');
      const fromOwner = record.owner ? sameKey(record.owner, record.self) : isGroupAdmin(record, record.self);
      if (isGroupAdmin(record, victimGroupKey) && !fromOwner) throw new Error('only the owner removes an admin');
      const plan = groupRemovalPlan(record, victimGroupKey);
      let envelope = null;
      let rekeyed = null;
      if (cutReading) {
        const current = currentGroupEpoch(record);
        rekeyed = await rekeyGroup({
          groupId: record.groupId, entropy: randomEntropy(random), createdAtSec: current.epoch * GROUP_EPOCH_SECONDS, generation: plan.generation,
        });
        envelope = await sealGroupRekeyEnvelope({
          groupId: record.groupId, generation: plan.generation, newKey: rekeyed.key, members: plan.wrappable,
          onSkipped: (member, error) => note(`rekey skipped ${hex(member.groupKey ?? new Uint8Array())}`, error),
        });
      }
      const payload = encodeGroupRemove({
        groupKey: victimGroupKey, generation: plan.generation, envelope, sentAt: now(),
      });
      const victim = groupMember(record, victimGroupKey);
      const victimWasAdmin = isGroupAdmin(record, victimGroupKey);
      const { messages, firstSeq, lastSeq: seq, state, record: floored, route } = await publishRoster(record, GROUP_KIND.REMOVE, payload);
      await sendOrLanded(messages, route);
      let next = noteGroupSeq({
        ...floored, members: plan.stays, admins: floored.admins.filter((a) => !sameKey(a, victimGroupKey)),
        removals: noteGroupRemoval(floored.removals, hex(victimGroupKey), now()),
      }, { ...state, seq });
      if (rekeyed) {
        next = adoptGroupGeneration(next, { epoch: rekeyed.epoch, generation: rekeyed.generation, key: rekeyed.key, speculative: true });
        next = noteGroupRosterKey(next, rekeyed.generation, rekeyed.rosterKey);
        next = { ...next, snapshot: null, admitsSinceSnapshot: 0, rosterCursor: rekeyed.epoch };
      }
      next = notePendingControl(next, {
        kind: GROUP_KIND.REMOVE, epoch: state.epoch, generation: state.generation, seq: firstSeq, at: now(),
        victim: victim ? memberForLog(victim) : null, victimWasAdmin,
        rekey: rekeyed ? { epoch: rekeyed.epoch, generation: rekeyed.generation, key: hex(rekeyed.key) } : null,
        revert: { snapshot: snapshotForRevert(record.snapshot), admitsSinceSnapshot: Number(record.admitsSinceSnapshot ?? 0), rosterCursor: record.rosterCursor ?? null, removals: { ...(record.removals ?? {}) } },
      });
      return persist(next);
    },

    async setAdmins(groupId, admins) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      refuseLeft(record);
      if (!isGroupOwner(record, record.self)) {
        throw new Error('only the owner may name admins');
      }
      if (!Array.isArray(admins) || admins.length === 0) throw new RangeError('a group needs at least one admin');
      for (const admin of admins) {
        if (!record.members.some((m) => sameKey(m.groupKey, admin))) throw new RangeError('an admin must be a member');
      }
      const owner = groupOwnerKey(record);
      if (owner && !admins.some((a) => sameKey(a, owner))) {
        throw new RangeError('the owner must stay an admin');
      }
      const payload = encodeGroupAdmins({ admins, owner: owner ?? null, sentAt: now() });
      const { messages, firstSeq, lastSeq: seq, state, record: floored, route } = await publishRoster(record, GROUP_KIND.ADMIN, payload);
      await sendOrLanded(messages, route);
      return persist(notePendingControl(noteGroupSeq({ ...floored, admins: admins.map((a) => a) }, { ...state, seq }), {
        kind: GROUP_KIND.ADMIN, epoch: state.epoch, generation: state.generation, seq: firstSeq, at: now(),
        revert: { admins: record.admins.map(hex) },
      }));
    },

    async transferOwnership(groupId, newOwnerKey) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      refuseLeft(record);
      const owner = groupOwnerKey(record);
      if (!owner) throw new RangeError('this group has no owner to hand on');
      if (!sameKey(owner, record.self)) throw new Error('only the owner may hand the group on');
      if (!isValidGroupKey(newOwnerKey)) throw new RangeError('the new owner is not a valid key');
      if (!record.members.some((m) => sameKey(m.groupKey, newOwnerKey))) {
        throw new RangeError('the new owner must be a member');
      }
      if (sameKey(owner, newOwnerKey)) return record;
      const admins = record.admins.some((a) => sameKey(a, newOwnerKey))
        ? record.admins.map((a) => a)
        : [...record.admins, newOwnerKey];
      const payload = encodeGroupAdmins({ admins, owner: newOwnerKey, sentAt: now() });
      const { messages, firstSeq, lastSeq: seq, state, record: floored, route } = await publishRoster(record, GROUP_KIND.ADMIN, payload);
      await sendOrLanded(messages, route);
      return persist(notePendingControl(
        noteGroupSeq({ ...floored, admins, owner: newOwnerKey }, { ...state, seq }),
        {
          kind: GROUP_KIND.ADMIN, epoch: state.epoch, generation: state.generation, seq: firstSeq, at: now(),
          revert: { admins: record.admins.map(hex), owner: hex(owner) },
        },
      ));
    },

    async admit(groupId, candidates) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      refuseLeft(record);
      if (!isGroupAdmin(record, record.self)) throw new Error('only an admin may admit');
      const added = [];
      for (const candidate of candidates) {
        if (!isValidGroupKey(candidate.groupKey)) { note('admit', new RangeError('candidate key is not a curve point')); continue; }
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
      await sendOrLanded(messages, route);
      const owed = added.flatMap((m) => {
        const invite = matchPendingGroupInvite(record, m);
        if (!invite) return [m];
        const since = pendingInviteBehind(invite, state.generation);
        return since === null ? [] : [{ ...m, since }];
      });
      const members = [...floored.members, ...added];
      const waiting = (floored.candidates ?? []).filter((c) => !members.some((m) => sameKey(m.groupKey, c.groupKey)));
      if (requests) {
        for (const seated of added) {
          try { await requests.remove(hex(floored.groupId), hex(seated.groupKey)); } catch (error) { note('requests', error); }
        }
      }
      const admitted = await persist(notePendingControl(noteGroupSeq(noteGroupAccessOwed({
        ...floored, members, candidates: waiting,
        admitsSinceSnapshot: Number(floored.admitsSinceSnapshot ?? 0) + added.length,
      }, owed, now()), { ...state, seq }), {
        kind: GROUP_KIND.ADMIT, epoch: state.epoch, generation: state.generation, seq: firstSeq, at: now(),
        members: added.map(memberForLog), revert: {},
      }));
      if (owed.length > 0) nudgeAdmitted(admitted.groupId);
      return admitted;
    },

    async setAvatar(groupId, { bytes, width = 0, height = 0 }) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      refuseLeft(record);
      if (!isGroupAdmin(record, record.self)) throw new Error('only an admin may set the picture');
      const epoch = currentGroupEpoch(record).epoch;
      const payload = encodeGroupAvatar({ bytes, width, height, sentAt: now() });
      const secretBytes = randomEntropy(random);
      const doors = new Map();
      const doorFor = async (at) => {
        const generation = generationForEpochAt(Number(at), boundary);
        if (!doors.has(generation)) doors.set(generation, await doorArgs(at, record.groupId));
        return doors.get(generation);
      };
      let picture;
      let profile;
      let avatar;
      try {
        picture = await publishAvatar(record, epoch, payload, 1, secretBytes, await doorFor(epoch));
        const hash = await groupAvatarHash(bytes);
        avatar = { epoch, seq: 1, parts: picture.count, hash, width: Number(width) || 0, height: Number(height) || 0, key: hex(secretBytes) };
        const withPointer = { ...record, avatar };
        profile = await publishRoster(withPointer, GROUP_KIND.PROFILE, encodeGroupProfile({ avatar, sentAt: now() }), { doorFor });
      } catch (error) {
        for (const args of doors.values()) unroute(args);
        throw error;
      }
      await sendOrLanded([...picture.messages, ...profile.messages], profile.route);
      return persist(notePendingControl(noteGroupSeq(profile.record, { ...profile.state, seq: profile.lastSeq }), {
        kind: GROUP_KIND.PROFILE, epoch: profile.state.epoch, generation: profile.state.generation, seq: profile.firstSeq, at: now(),
        revert: { avatar: record.avatar ?? null },
      }));
    },

    async setName(groupId, name) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      refuseLeft(record);
      if (!isGroupAdmin(record, record.self)) throw new Error('only an admin may rename the room');
      const next = String(name ?? '').trim();
      if (!next) throw new RangeError('a room needs a name');
      if (next === record.name) return record;
      const profile = await publishRoster(record, GROUP_KIND.PROFILE, encodeGroupProfile({ name: next, sentAt: now() }));
      await sendOrLanded(profile.messages, profile.route);
      return persist(notePendingControl(noteGroupSeq({ ...profile.record, name: next }, { ...profile.state, seq: profile.lastSeq }), {
        kind: GROUP_KIND.PROFILE, epoch: profile.state.epoch, generation: profile.state.generation, seq: profile.firstSeq, at: now(),
        revert: { name: record.name ?? null },
      }));
    },

    async mute(groupId, target, { lift = false } = {}) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      refuseLeft(record);
      if (!isGroupAdmin(record, record.self)) throw new Error('only an admin may mute');
      if (!isValidGroupKey(target)) throw new RangeError('the target is not a member key');
      if (!lift && !groupMember(record, target)) throw new RangeError('the target is not a member');
      if (!lift) {
        if (isGroupOwner(record, target)) throw new Error('the owner cannot be muted');
        if (isGroupAdmin(record, target) && !isGroupOwner(record, record.self)) throw new Error('only the owner mutes an admin');
      }
      if (isGroupMuted(record, target) === !lift) return record;
      const published = await publishRoster(record, GROUP_KIND.MUTE, encodeGroupMute({ groupKey: target, lift, sentAt: now() }));
      await sendOrLanded(published.messages, published.route);
      const muted = lift ? (record.muted ?? []).filter((m) => !sameKey(m, target)) : [...(record.muted ?? []), target];
      const written = notePendingControl(noteGroupSeq({ ...published.record, muted }, { ...published.state, seq: published.lastSeq }), {
        kind: GROUP_KIND.MUTE, epoch: published.state.epoch, generation: published.state.generation, seq: published.firstSeq, at: now(),
        revert: { muted: (record.muted ?? []).map(hex) },
      });
      return persist(lift ? await forgetLiftedLanes(written, { members: [target] }) : written);
    },

    async hide(groupId, key, { lift = false, excerpt = '' } = {}) {
      const record = await getFresh(groupId);
      if (!record) throw new Error('no such group');
      refuseLeft(record);
      if (!isGroupAdmin(record, record.self)) throw new Error('only an admin may hide a message');
      if (!isGroupRowKey(key)) throw new RangeError('a hidden row is named by its key');
      if (Boolean(record.hidden?.[key]) === !lift) return record;
      const published = await publishRoster(record, GROUP_KIND.HIDE, encodeGroupHide({ key, lift, excerpt, sentAt: now() }));
      await sendOrLanded(published.messages, published.route);
      const hidden = { ...(record.hidden ?? {}) };
      if (lift) delete hidden[key]; else hidden[key] = { at: now(), excerpt: groupExcerptIn(excerpt) };
      const written = notePendingControl(noteGroupSeq({ ...published.record, hidden }, { ...published.state, seq: published.lastSeq }), {
        kind: GROUP_KIND.HIDE, epoch: published.state.epoch, generation: published.state.generation, seq: published.firstSeq, at: now(),
        revert: { hidden: { ...(record.hidden ?? {}) } },
      });
      return persist(lift ? await forgetLiftedLanes(written, { rows: [key] }) : written);
    },

    avatarPlan(groupId, byteLength) {
      const record = this.get(groupId);
      if (!record) throw new Error('no such group');
      const picture = groupCapsulePlan(GROUP_AVATAR_HEADER_BYTES + Number(byteLength ?? 0));
      const pointer = { epoch: 0, seq: 0, parts: picture.count, hash: '00'.repeat(32), width: 0, height: 0, key: 'ff'.repeat(32) };
      const profile = groupCapsulePlan(encodeGroupProfile({ avatar: pointer, sentAt: now() }).length);
      return { picture, profile, count: picture.count + profile.count, parts: [...picture.parts, ...profile.parts] };
    },

    async avatar(groupId) {
      const record = this.get(groupId);
      if (!record?.avatar) return null;
      return lane.readAvatar({
        groupId: record.groupId, pointer: record.avatar, states: null,
        ...(boundary === undefined ? {} : { boundary }),
      });
    },

    async sync({ groupIds = null, deliver = null } = {}) {
      const out = [];
      for (const record of [...records.values()]) {
        const id = hex(record.groupId);
        if (groupIds && !groupIds.includes(id)) continue;
        out.push(...await passRoom(id, deliver));
        if (handoversWaiting.has(id)) await retryWaitingHandovers(id);
      }
      return out;
    },
  };

  admitUnlocked = api.admit;
  removeUnlocked = api.remove;
  const PRICED_OPERATIONS = new Set(['say', 'leave', 'remove', 'admit', 'setAdmins', 'transferOwnership', 'ensureSnapshot', 'setAvatar', 'mute', 'hide', 'setName', 'setEntryFee']);
  for (const name of ['say', 'leave', 'remove', 'admit', 'setAdmins', 'transferOwnership', 'noteInvite', 'ensureSnapshot', 'setAvatar', 'noteCandidate', 'mute', 'hide', 'setName', 'setEntryFee', 'noteAccessSent', 'declineCandidate']) {
    const inner = api[name];
    if (!PRICED_OPERATIONS.has(name)) { api[name] = (groupId, ...rest) => locked(groupId, () => inner.call(api, groupId, ...rest)); continue; }
    api[name] = (groupId, ...rest) => {
      const asked = generationForEpochAt(Math.floor(Number(now()) / 86_400), boundary);
      const run = () => locked(groupId, async () => {
        const key = opKey(groupId);
        askedGeneration.set(key, asked);
        try { return await inner.call(api, groupId, ...rest); } finally { askedGeneration.delete(key); }
      });
      return run();
    };
  }
  return api;
}

export { groupEpochFromSeconds };
