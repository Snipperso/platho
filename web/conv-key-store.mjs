
import { conversationOrder, base64urlDecode } from './crypto/conv-routing.mjs?v=9';
import { generationForEpoch } from './cutover-epoch.mjs?v=7';

function toBytes(value, length, name) {
  let bytes;
  if (value instanceof Uint8Array) bytes = value;
  else if (Array.isArray(value)) bytes = Uint8Array.from(value);
  else if (typeof value === 'string') {
    const hex = value.startsWith('0x') ? value.slice(2) : value;
    if (hex.length === length * 2 && !/[^0-9a-fA-F]/.test(hex)) {
      bytes = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    } else {
      try { bytes = base64urlDecode(value); } catch { throw new TypeError(`${name} must be ${length}-byte hex or base64url`); }
      if (bytes.length !== length) throw new TypeError(`${name} must be ${length}-byte hex or base64url`);
    }
  } else throw new TypeError(`${name} must be bytes, hex or base64url`);
  if (bytes.length !== length) throw new RangeError(`${name} must be ${length} bytes, got ${bytes.length}`);
  return bytes;
}

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

function compareBytes(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) { if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; }
  return a.length === b.length ? 0 : (a.length < b.length ? -1 : 1);
}

export function conversationId(selfKeyId, peerKeyId) {
  const { lo, hi } = conversationOrder(selfKeyId, peerKeyId);
  return `${hex(lo)}:${hex(hi)}`;
}

export const SAFETY_CODE_DOMAIN = 'PLATHO.SAFETY.CODE.V1';
export async function conversationSafetyCode(selfKeyId, peerKeyId) {
  const id = conversationId(selfKeyId, peerKeyId);
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-512', new TextEncoder().encode(`${SAFETY_CODE_DOMAIN}|${id}`)));
  const groups = [];
  for (let group = 0; group < 12; group += 1) {
    let n = 0n;
    for (let i = 0; i < 5; i += 1) n = (n << 8n) | BigInt(digest[group * 5 + i]);
    groups.push(String(n % 100_000n).padStart(5, '0'));
  }
  return groups;
}

export function compareAdoption(candidate, record) {
  const ca = Number(candidate.createdAt ?? 0);
  const ra = Number(record.adoptedCreatedAt ?? 0);
  if (ca !== ra) return ca > ra ? 1 : -1;
  return compareBytes(toBytes(candidate.introNonce, 16, 'introNonce'), toBytes(record.adoptedIntroNonce, 16, 'adoptedIntroNonce'));
}

const CONV_GAP_FLOORS_MAX = 256;

const CONV_KEY_MAX_READ_ROOTS = 16;
export const OUTGOING_SEQ_KEEP_EPOCHS = 7;

function appendRetiredNonce(list, nonce) {
  if (nonce == null) return list ?? [];
  const bytes = toBytes(nonce, 16, 'introNonce');
  const held = list ?? [];
  if (held.some((n) => compareBytes(toBytes(n, 16, 'introNonce'), bytes) === 0)) return held;
  const next = [...held, bytes];
  return next.length > CONV_KEY_MAX_READ_ROOTS ? next.slice(next.length - CONV_KEY_MAX_READ_ROOTS) : next;
}

export const PEER_WALLET_CANDIDATES_MAX = 64;

export function walletList(...lists) {
  return [...new Set(lists.flat().filter((w) => w !== null && w !== undefined && w !== '').map((w) => String(w)))].slice(0, PEER_WALLET_CANDIDATES_MAX);
}

function appendReadRoot(list, kRoot, adoptedAt) {
  const bytes = toBytes(kRoot, 32, 'kRoot');
  if (list.some((r) => compareBytes(toBytes(r.kRoot, 32, 'kRoot'), bytes) === 0)) return list;
  const next = [...list, { kRoot: bytes, adoptedAt }];
  return next.length > CONV_KEY_MAX_READ_ROOTS ? next.slice(next.length - CONV_KEY_MAX_READ_ROOTS) : next;
}

export function adoptKRoot(existing, candidate) {
  const kRoot = toBytes(candidate.kRoot, 32, 'kRoot');
  const introNonce = toBytes(candidate.introNonce, 16, 'introNonce');
  const createdAt = Number(candidate.createdAt ?? 0);
  const peerKeyId = toBytes(candidate.peerKeyId, 32, 'peerKeyId');
  const peerEncPublicKey = candidate.peerEncPublicKey == null ? null : toBytes(candidate.peerEncPublicKey, 32, 'peerEncPublicKey');
  const peerWallet = candidate.peerWallet == null ? null : String(candidate.peerWallet);
  const peerWalletCandidates = Array.isArray(candidate.peerWalletCandidates) ? walletList(candidate.peerWalletCandidates) : [];
  if (!existing) {
    return { outcome: 'created', record: { kRootCurrent: kRoot, kRootsForRead: [], peerKeyId, peerEncPublicKey, peerWallet, peerWalletCandidates, adoptedCreatedAt: createdAt, adoptedIntroNonce: introNonce, outgoingSeq: {}, lastScannedEpoch: null } };
  }
  if (compareBytes(introNonce, toBytes(existing.adoptedIntroNonce, 16, 'adoptedIntroNonce')) === 0) {
    const heldAt = Number(existing.adoptedCreatedAt ?? 0);
    const candidates = walletList([existing.peerWallet], existing.peerWalletCandidates ?? [], [peerWallet], peerWalletCandidates);
    const grew = candidates.length !== walletList([existing.peerWallet], existing.peerWalletCandidates ?? []).length;
    const withCandidates = grew ? { ...existing, peerWallet: existing.peerWallet ?? peerWallet ?? null, peerWalletCandidates: candidates } : existing;
    if (createdAt > 0 && (heldAt <= 0 || createdAt < heldAt)) {
      return { outcome: 'resourced', record: { ...withCandidates, adoptedCreatedAt: createdAt } };
    }
    return { outcome: createdAt === heldAt ? 'duplicate' : 'replayed', record: withCandidates };
  }
  const rootKnown = compareBytes(kRoot, toBytes(existing.kRootCurrent, 32, 'kRootCurrent')) === 0
    || (existing.kRootsForRead ?? []).some((r) => compareBytes(toBytes(r.kRoot, 32, 'kRoot'), kRoot) === 0);
  const nonceRetired = (existing.retiredIntroNonces ?? []).some((n) => compareBytes(toBytes(n, 16, 'introNonce'), introNonce) === 0);
  if (rootKnown || nonceRetired) return { outcome: 'replayed', record: existing };
  const cmp = compareAdoption({ createdAt, introNonce }, existing);
  if (cmp > 0) {
    return {
      outcome: 'adopted',
      record: {
        ...existing,
        kRootCurrent: kRoot,
        kRootsForRead: appendReadRoot(existing.kRootsForRead, existing.kRootCurrent, existing.adoptedCreatedAt),
        retiredIntroNonces: appendRetiredNonce(existing.retiredIntroNonces, existing.adoptedIntroNonce),
        peerKeyId,
        peerEncPublicKey: peerEncPublicKey ?? existing.peerEncPublicKey,
        peerWallet: existing.peerWallet ?? peerWallet ?? null,
        peerWalletCandidates: walletList([existing.peerWallet], existing.peerWalletCandidates ?? [], [peerWallet], peerWalletCandidates),
        adoptedCreatedAt: createdAt,
        adoptedIntroNonce: introNonce,
      },
    };
  }
  return {
    outcome: 'retained',
    record: {
      ...existing,
      kRootsForRead: appendReadRoot(existing.kRootsForRead, kRoot, createdAt),
      retiredIntroNonces: appendRetiredNonce(existing.retiredIntroNonces, introNonce),
    },
  };
}

export function createConvKeyStore({ persist = null, load: loadImpl = null } = {}) {
  const byConv = new Map();

  let heldChanges = 0;
  let writtenChanges = 0;
  let dirty = false;
  const persistAndAdopt = async (claim = null) => {
    if (!persist) return;
    const covers = heldChanges;
    let merged;
    try {
      merged = await persist(byConv, claim);
    } catch (error) {
      dirty = true;
      throw error;
    }
    dirty = false;
    writtenChanges = Math.max(writtenChanges, covers);
    if (!(merged instanceof Map) || merged === byConv) return;
    byConv.clear();
    for (const [id, record] of merged) byConv.set(id, record);
  };

  const store = {
    async upsertConversationKRoot(selfKeyId, peerKeyId, candidate) {
      const id = conversationId(selfKeyId, peerKeyId);
      const held = byConv.get(id);
      const { record, outcome } = adoptKRoot(held, { ...candidate, peerKeyId });
      if ((outcome !== 'duplicate' && outcome !== 'replayed') || record !== held || dirty) { byConv.set(id, record); await persistAndAdopt(); }
      return outcome;
    },

    isDurable() {
      return Boolean(persist) && !dirty;
    },

    async settlePeerWallet(selfKeyId, peerKeyId, wallet) {
      const id = conversationId(selfKeyId, peerKeyId);
      const held = byConv.get(id);
      if (!held || !wallet) return false;
      if (held.peerWallet === String(wallet) && held.peerWalletVerified === true) return false;
      byConv.set(id, {
        ...held,
        peerWallet: String(wallet),
        peerWalletVerified: true,
        peerWalletCandidates: walletList([String(wallet)], [held.peerWallet], held.peerWalletCandidates ?? []),
      });
      await persistAndAdopt();
      return true;
    },

    getConversation(selfKeyId, peerKeyId) {
      return byConv.get(conversationId(selfKeyId, peerKeyId)) ?? null;
    },

    async advanceConvScanCursor(selfKeyId, peerKeyId, epoch, { persist: write = true } = {}) {
      const record = byConv.get(conversationId(selfKeyId, peerKeyId));
      if (!record) return;
      const e = Number(epoch);
      if (!Number.isFinite(e)) return;
      const generation = generationForEpoch(e);
      const stampChanged = record.lastScannedGeneration !== generation;
      const advanced = record.lastScannedEpoch == null || e > record.lastScannedEpoch;
      if (advanced) record.lastScannedEpoch = e;
      record.lastScannedGeneration = generation;
      if (!(advanced || stampChanged)) return;
      if (write) await persistAndAdopt(); else heldChanges += 1;
    },

    async flush() {
      if (heldChanges > writtenChanges || dirty) await persistAndAdopt();
    },

    async noteConvShardGap(selfKeyId, peerKeyId, address, floor) {
      const record = byConv.get(conversationId(selfKeyId, peerKeyId));
      const f = Number(floor);
      if (!record || !address || !Number.isSafeInteger(f)) return;
      const key = String(address);
      const floors = { ...(record.gapFloors ?? {}) };
      if (floors[key] !== undefined && Number(floors[key]) <= f) return;
      floors[key] = f;
      const keys = Object.keys(floors);
      for (const drop of keys.slice(0, Math.max(0, keys.length - CONV_GAP_FLOORS_MAX))) delete floors[drop];
      record.gapFloors = floors;
      await persistAndAdopt();
    },

    async clearConvShardGap(selfKeyId, peerKeyId, address) {
      const record = byConv.get(conversationId(selfKeyId, peerKeyId));
      if (!record || !address || record.gapFloors?.[String(address)] === undefined) return;
      const floors = { ...record.gapFloors };
      delete floors[String(address)];
      record.gapFloors = floors;
      await persistAndAdopt();
    },

    async nextOutgoingSeq(selfKeyId, peerKeyId, epoch, coldFloor = 0) {
      const id = conversationId(selfKeyId, peerKeyId);
      const record = byConv.get(id);
      if (!record) throw new Error('nextOutgoingSeq: no K_root for this conversation — receive/adopt the INTRO first');
      const e = Number(epoch);
      const floor = Number(coldFloor ?? 0);
      const base = record.outgoingSeq[e] !== undefined ? Math.max(record.outgoingSeq[e], floor) : floor;
      const next = base + 1;
      if (!Number.isSafeInteger(base) || !Number.isSafeInteger(next) || next <= base) {
        const error = new Error(`Conversation shard-day ${e} cannot accept another message: its sequence is exhausted`);
        error.code = 'CONV_SEQ_EXHAUSTED';
        throw error;
      }
      record.outgoingSeq[e] = next;
      for (const key of Object.keys(record.outgoingSeq)) if (Number(key) < e - OUTGOING_SEQ_KEEP_EPOCHS) delete record.outgoingSeq[key];
      let claimed = next;
      await persistAndAdopt((merged, onDisk) => {
        const taken = Number(onDisk?.get?.(id)?.outgoingSeq?.[e]);
        if (Number.isFinite(taken) && taken >= claimed) claimed = taken + 1;
        if (!Number.isSafeInteger(claimed)) {
          const error = new Error(`Conversation shard-day ${e} cannot accept another message: its sequence is exhausted`);
          error.code = 'CONV_SEQ_EXHAUSTED';
          throw error;
        }
        const held = merged?.get?.(id);
        if (held?.outgoingSeq) held.outgoingSeq[e] = claimed;
      });
      return claimed;
    },

    async importConversations(map) {
      if (!(map instanceof Map)) return 0;
      let changed = 0;
      for (const [id, incoming] of map) {
        if (!incoming?.kRootCurrent) continue;
        const existing = byConv.get(id);
        if (existing) {
          const incomingRoot = toBytes(incoming.kRootCurrent, 32, 'kRootCurrent');
          const retiredRoot = (existing.kRootsForRead ?? []).some((r) => compareBytes(toBytes(r.kRoot, 32, 'kRoot'), incomingRoot) === 0);
          const retiredNonce = incoming.adoptedIntroNonce != null && (existing.retiredIntroNonces ?? [])
            .some((n) => compareBytes(toBytes(n, 16, 'introNonce'), toBytes(incoming.adoptedIntroNonce, 16, 'introNonce')) === 0);
          if (retiredRoot || retiredNonce) continue;
        }
        const incomingAt = Number(incoming.adoptedCreatedAt ?? 0);
        const existingAt = Number(existing?.adoptedCreatedAt ?? 0);
        const rootHex = (value) => (value instanceof Uint8Array ? [...value].map((b) => b.toString(16).padStart(2, '0')).join('') : String(value ?? '').toLowerCase());
        if (!existing || incomingAt > existingAt || (incomingAt === existingAt && rootHex(incoming.kRootCurrent) > rootHex(existing.kRootCurrent))) {
          byConv.set(id, {
            ...incoming, lastScannedEpoch: null, gapFloors: existing?.gapFloors ?? {},
            retiredIntroNonces: [...(incoming.retiredIntroNonces ?? []), ...(existing?.retiredIntroNonces ?? [])]
              .reduce((list, nonce) => appendRetiredNonce(list, nonce), []),
          });
          changed += 1;
        }
      }
      if (changed > 0) await persistAndAdopt();
      return changed;
    },

    async load() {
      if (!loadImpl) return;
      const next = await loadImpl();
      if (next instanceof Map) { byConv.clear(); for (const [k, v] of next) byConv.set(k, v); }
    },

    async refresh() { await persistAndAdopt(); },

    snapshot() { return new Map(byConv); },
  };
  return store;
}

export const createMemoryConvKeyStore = () => createConvKeyStore();
