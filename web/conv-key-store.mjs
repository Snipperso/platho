// conv-key-store — the per-conversation K_root secrets the clean-17 CONV private lane needs, and the two rules that
// keep a conversation from silently forking or losing a message.
//
// WHY THIS MODULE MUST EXIST. K_root — the shared root a CONV conversation derives all its bucket keys and write keys
// from — is minted at INTRO and, in the client today, computed transiently and thrown away (intro-handshake returns
// it, nobody stores it). Without it CONV receive cannot even start deriving where to read. This holds it, keyed by a
// join id both sides compute identically, so the initiator (self=A,peer=B) and the responder (self=B,peer=A) land on
// the SAME record.
//
// TWO INVARIANTS LIVE HERE, both silent-loss if wrong:
//   * RE-INTRO ADOPTION (last-writer-wins). A repeat INTRO mints a NEW K_root. If a client adopted whichever arrived
//     LAST rather than whichever is NEWEST, a re-INTRO that raced an in-flight older one would clobber the live root
//     and the two sides would derive different buckets forever — a conversation that silently splits. Adoption is by
//     (createdAt, introNonce), never by arrival order; the retired root is kept for DECRYPTING old history, not for
//     deriving new buckets.
//   * OUTGOING SEQ. RecordShard gate 13653 wants seq strictly increasing. "Read last_seq off the chain and add one"
//     loses the second of two fast messages (both read the same last_seq). The chain read is only a COLD-START floor;
//     the authoritative counter is local and monotonic per (conversation, epoch).
//
// Persistence is injected so the secret bytes can be sealed at rest (createIndexedDbConvKeyStore seals like
// encrypted-message-store; the memory store does not persist). The ADOPTION and SEQ logic is pure and testable
// independent of storage — tests/conv-key-store.test.ts pins both, including the mutation that removes the compare.

import { conversationOrder } from './crypto/conv-routing.mjs?v=1';

function toBytes(value, length, name) {
  let bytes;
  if (value instanceof Uint8Array) bytes = value;
  else if (Array.isArray(value)) bytes = Uint8Array.from(value);
  else if (typeof value === 'string') {
    const hex = value.startsWith('0x') ? value.slice(2) : value;
    if (hex.length !== length * 2 || /[^0-9a-fA-F]/.test(hex)) throw new TypeError(`${name} must be ${length}-byte hex`);
    bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  } else throw new TypeError(`${name} must be bytes or hex`);
  if (bytes.length !== length) throw new RangeError(`${name} must be ${length} bytes, got ${bytes.length}`);
  return bytes;
}

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

function compareBytes(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) { if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; }
  return a.length === b.length ? 0 : (a.length < b.length ? -1 : 1);
}

/** The join id both sides compute identically. Order-independent: conversationOrder sorts self/peer to (lo,hi). */
export function conversationId(selfKeyId, peerKeyId) {
  const { lo, hi } = conversationOrder(selfKeyId, peerKeyId);
  return `${hex(lo)}:${hex(hi)}`;
}

/** >0 if candidate is NEWER than the record's adopted root, 0 if the same intro, <0 if older. By (createdAt, introNonce). */
export function compareAdoption(candidate, record) {
  const ca = Number(candidate.createdAt ?? 0);
  const ra = Number(record.adoptedCreatedAt ?? 0);
  if (ca !== ra) return ca > ra ? 1 : -1;
  return compareBytes(toBytes(candidate.introNonce, 16, 'introNonce'), toBytes(record.adoptedIntroNonce, 16, 'adoptedIntroNonce'));
}

/**
 * Pure last-writer-wins adoption. Returns { record, outcome } — outcome is 'created' | 'adopted' | 'retained' |
 * 'duplicate'. NEVER mutates `existing`. The retired/older root always lands in kRootsForRead so old history stays
 * decryptable; only the NEWEST root ever drives outgoing bucket derivation.
 */
export function adoptKRoot(existing, candidate) {
  const kRoot = toBytes(candidate.kRoot, 32, 'kRoot');
  const introNonce = toBytes(candidate.introNonce, 16, 'introNonce');
  const createdAt = Number(candidate.createdAt ?? 0);
  const peerKeyId = toBytes(candidate.peerKeyId, 32, 'peerKeyId');
  const peerEncPublicKey = candidate.peerEncPublicKey == null ? null : toBytes(candidate.peerEncPublicKey, 32, 'peerEncPublicKey');
  if (!existing) {
    return { outcome: 'created', record: { kRootCurrent: kRoot, kRootsForRead: [], peerKeyId, peerEncPublicKey, adoptedCreatedAt: createdAt, adoptedIntroNonce: introNonce, outgoingSeq: {} } };
  }
  const cmp = compareAdoption({ createdAt, introNonce }, existing);
  if (cmp === 0) return { outcome: 'duplicate', record: existing };
  if (cmp > 0) {
    return {
      outcome: 'adopted',
      record: {
        ...existing,
        kRootCurrent: kRoot,
        kRootsForRead: [...existing.kRootsForRead, { kRoot: existing.kRootCurrent, adoptedAt: existing.adoptedCreatedAt }],
        peerKeyId,
        peerEncPublicKey: peerEncPublicKey ?? existing.peerEncPublicKey,
        adoptedCreatedAt: createdAt,
        adoptedIntroNonce: introNonce,
      },
    };
  }
  return { outcome: 'retained', record: { ...existing, kRootsForRead: [...existing.kRootsForRead, { kRoot, adoptedAt: createdAt }] } };
}

/**
 * The conversation key store. `persist(map)` is called after every mutation (omit for the in-memory store); `load()`
 * hydrates from it. Records are held by conversationId so both sides share one entry.
 */
export function createConvKeyStore({ persist = null, load: loadImpl = null } = {}) {
  const byConv = new Map();

  const store = {
    /** Adopt (or retire) a K_root for a conversation. Returns the adoption outcome. */
    async upsertConversationKRoot(selfKeyId, peerKeyId, candidate) {
      const id = conversationId(selfKeyId, peerKeyId);
      const { record, outcome } = adoptKRoot(byConv.get(id), { ...candidate, peerKeyId });
      if (outcome !== 'duplicate') { byConv.set(id, record); if (persist) await persist(byConv); }
      return outcome;
    },

    /** The current record for a conversation, or null. kRootCurrent drives derivation; kRootsForRead decrypt history. */
    getConversation(selfKeyId, peerKeyId) {
      return byConv.get(conversationId(selfKeyId, peerKeyId)) ?? null;
    },

    /**
     * The next OUTGOING seq for (conversation, epoch). The local counter is authoritative and monotonic; coldFloor
     * (the shard's last_seq, read once at cold start) only seeds a fresh epoch so two fast messages can't collide.
     */
    async nextOutgoingSeq(selfKeyId, peerKeyId, epoch, coldFloor = 0) {
      const id = conversationId(selfKeyId, peerKeyId);
      const record = byConv.get(id);
      if (!record) throw new Error('nextOutgoingSeq: no K_root for this conversation — receive/adopt the INTRO first');
      const e = Number(epoch);
      const base = record.outgoingSeq[e] !== undefined ? record.outgoingSeq[e] : Number(coldFloor ?? 0);
      const next = base + 1;
      record.outgoingSeq[e] = next;
      if (persist) await persist(byConv);
      return next;
    },

    /** Hydrate from the injected loader (a Map of convId -> record). */
    async load() {
      if (!loadImpl) return;
      const next = await loadImpl();
      if (next instanceof Map) { byConv.clear(); for (const [k, v] of next) byConv.set(k, v); }
    },

    /** The raw map (for persistence / inspection). */
    snapshot() { return new Map(byConv); },
  };
  return store;
}

/** In-memory store — no persistence (fine for a session; a device reload loses K_roots and re-derives on next INTRO). */
export const createMemoryConvKeyStore = () => createConvKeyStore();
