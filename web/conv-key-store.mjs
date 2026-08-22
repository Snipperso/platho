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

import { conversationOrder, base64urlDecode } from './crypto/conv-routing.mjs?v=3';

// [CORRECTED 2026-08-02] Strings arrive in TWO forms and this accepted only one.
//
// A keyId's canonical string form is BASE64URL — computeHybridKeyId emits it, introKeyIdString renders it, the intro
// capsule header carries it (platho-crypto base64urlEncode), and conv-routing's normalizeKeyId decodes it. This
// function hex-decoded instead, so BOTH live paths — the sender's adoption after a confirmed INTRO and the recipient's
// adoption of an incoming one — threw `peerKeyId must be 32-byte hex` on a value that was perfectly well-formed.
// Nothing caught it because the tests hand this store raw Uint8Arrays, which take the branch above.
//
// The two encodings cannot be confused: 32 bytes is 64 hex characters or 43 base64url ones, so length decides. Hex
// stays supported for persisted records written before this.
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

// How many retired roots to keep for decrypting in-window history. Bounded so a long-lived conversation with repeated
// re-INTROs cannot grow the sealed-at-rest record without limit; the 1-week retention window means old roots stop
// being needed long before this cap. [private-review #4]
const CONV_KEY_MAX_READ_ROOTS = 16;

/** Append a retired root to kRootsForRead, DEDUPED by bytes (re-adopting/re-retiring the same root must not pile up)
 *  and CAPPED to the most-recent CONV_KEY_MAX_READ_ROOTS. */
function appendReadRoot(list, kRoot, adoptedAt) {
  const bytes = toBytes(kRoot, 32, 'kRoot');
  if (list.some((r) => compareBytes(toBytes(r.kRoot, 32, 'kRoot'), bytes) === 0)) return list;
  const next = [...list, { kRoot: bytes, adoptedAt }];
  return next.length > CONV_KEY_MAX_READ_ROOTS ? next.slice(next.length - CONV_KEY_MAX_READ_ROOTS) : next;
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
  // peerWallet: the INTRO publish tx src (raw '0:HEX'), a HINT for resolving the peer's full bundle (KeyShard) on reply.
  // Stored as-is; verified against peerKeyId at reply time, never trusted alone. [Y reply-bundle resolution]
  const peerWallet = candidate.peerWallet == null ? null : String(candidate.peerWallet);
  if (!existing) {
    // lastScannedEpoch: the highest epoch the receive lane has fully scanned for this conversation. null = never
    // scanned; the receiver starts at the steady window and extends BACK to this cursor to catch up after being
    // offline, so a message whose epoch scrolled past the steady window is not silently lost. [conv-receive review]
    return { outcome: 'created', record: { kRootCurrent: kRoot, kRootsForRead: [], peerKeyId, peerEncPublicKey, peerWallet, adoptedCreatedAt: createdAt, adoptedIntroNonce: introNonce, outgoingSeq: {}, lastScannedEpoch: null } };
  }
  const cmp = compareAdoption({ createdAt, introNonce }, existing);
  if (cmp === 0) return { outcome: 'duplicate', record: existing };
  if (cmp > 0) {
    return {
      outcome: 'adopted',
      record: {
        ...existing,
        kRootCurrent: kRoot,
        kRootsForRead: appendReadRoot(existing.kRootsForRead, existing.kRootCurrent, existing.adoptedCreatedAt),
        peerKeyId,
        peerEncPublicKey: peerEncPublicKey ?? existing.peerEncPublicKey,
        peerWallet: peerWallet ?? existing.peerWallet ?? null,
        adoptedCreatedAt: createdAt,
        adoptedIntroNonce: introNonce,
      },
    };
  }
  return { outcome: 'retained', record: { ...existing, kRootsForRead: appendReadRoot(existing.kRootsForRead, kRoot, createdAt) } };
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
     * Advance the per-conversation receive scan cursor to `epoch` (the highest epoch fully scanned this pass).
     * MONOTONIC — never rewinds, so a later pass that scanned a narrower window cannot drop the cursor and re-open the
     * offline gap. Only call after a CLEAN scan (no shard read failed); a failed read must leave the cursor so the
     * missed epochs are retried. No-op if the conversation is unknown. [conv-receive review — offline catch-up]
     */
    async advanceConvScanCursor(selfKeyId, peerKeyId, epoch) {
      const record = byConv.get(conversationId(selfKeyId, peerKeyId));
      if (!record) return;
      const e = Number(epoch);
      if (!Number.isFinite(e)) return;
      if (record.lastScannedEpoch == null || e > record.lastScannedEpoch) {
        record.lastScannedEpoch = e;
        if (persist) await persist(byConv);
      }
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

    /**
     * Merge restored conversation records (from the RECOVERY lane) into the store and persist. On a collision the
     * NEWER record wins (higher adoptedCreatedAt), so importing an older on-chain backup can never roll a live K_root
     * back to a key the user has already rotated past. Records slot in by their own convId (both devices compute it
     * identically from the seed-derived key ids), so a reinstalled device lands each conversation where it belongs.
     * Returns how many records were written. [RECOVERY restore]
     */
    async importConversations(map) {
      if (!(map instanceof Map)) return 0;
      let changed = 0;
      for (const [id, incoming] of map) {
        if (!incoming?.kRootCurrent) continue;
        const existing = byConv.get(id);
        if (!existing || Number(incoming.adoptedCreatedAt ?? 0) > Number(existing.adoptedCreatedAt ?? 0)) {
          // A RESTORED RECORD ARRIVES COLD. lastScannedEpoch is "the highest epoch THIS DEVICE has fully scanned for
          // this conversation" — the backing-up device's cursor says nothing about what this one holds. Importing it
          // made a fresh device believe it had already read everything up to the other device's cursor, so its sync
          // took only the steady W-epoch window and the conversation came back as its last three days [OWNER
          // 2026-08-22, on a device restored from the slots: "only the peer's latest replies came"]. A record new to
          // this store, or a record whose root a newer backup replaces, starts with no cursor and the receive lane
          // scans it from its birth (adoptedCreatedAt), once; the cursor is written after the first clean pass.
          byConv.set(id, { ...incoming, lastScannedEpoch: null });
          changed += 1;
        }
      }
      if (changed > 0 && persist) await persist(byConv);
      return changed;
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
