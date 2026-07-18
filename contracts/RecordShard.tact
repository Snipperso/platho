// RecordShard — clean-17 sharded CONV lane: one (bucket_key, epoch) partition = a conversation-direction for a day.
//
// DIRECT-PAID (no tokens, no nullifiers, no issuer). [OWNER 2026-07-18: all external infrastructure is forbidden in
// this project and always has been.] The earlier design routed every publish through a NullifierShard that burnt a
// blind-issued token. That token layer only bought unlinkability against the ISSUER — a chain observer still reads
// the spend transaction's `src` — so it paid off only in combination with an external relay. Two mandatory online
// services in the send path is exactly what this project does not do, so the whole layer is gone. What actually
// closed the metadata-graph leak is the opaque bucket_key, and that is pure client-side crypto:
//     bucket_key = HKDF(K_epoch ‖ dir ‖ epoch),  K_epoch = HKDF(K_root, epoch)
//
// WRITE AUTHORIZATION = A SIGNATURE UNDER THE BUCKET'S OWN KEY. An earlier draft of this rewrite claimed that
// merely KNOWING the bucket key was the capability, since only the two participants can derive it. That was WRONG
// and was caught by measurement: the bucket key goes into this contract's ADDRESS, and the address is public the
// instant anyone publishes (it is the destination of that transaction). A stranger who had only observed one publish
// appended junk to a private conversation, and filling SAFE_CAP to deny a conversation-day cost ~11 TON.
// ADDRESS PRIVACY IS NOT AUTHORIZATION.
//
// So the shard's identity is a PUBLIC KEY: write_pubkey = ed25519(HKDF(K_epoch ‖ dir ‖ epoch, "PLATHO.CONV.WRITE.V1")),
// derived from the conversation's shared K_root. Knowing the address (a hash) does not let anyone sign. A publish
// must carry a signature over (seq ‖ the commitment this contract computes), so an outsider can neither forge new
// content nor splice a captured signature onto different cells.
//
// The monotonic `seq` closes REPLAY, which the signature alone does not: without it a captured (cells, sig) pair
// could be re-sent to burn SAFE_CAP slots at the same ~11 TON, leaving the denial-of-service intact. It doubles as
// the client's ordering key. Anti-spam beyond that is the rent itself, bounded by SAFE-CAP and 1-year eviction.
//
// BODY CARRIAGE — the bug this rewrite fixes. The two-hop design could not deliver a message at all: the forward
// carried only {serial, frame_commit}, so the ciphertext existed nowhere on chain and the recipient had nothing to
// decrypt. Publishing DIRECTLY to the terminal shard fixes it by construction: the client's own transaction lands
// here carrying the capsule cells, so the content lives in THIS account's transaction history, authenticated by the
// stored commit. That is the proven monolith pattern (headers/body recovered from hub tx history).
//
// STATE STAYS THIN: the account stores only (frame_commit, created_at) per record — the capsule cells are NOT copied
// into state. That is what keeps a shard's state bounded and the ~65536-cell account ceiling irrelevant. The durability
// tradeoff is explicit and inherited from the monolith: content lives in transaction history, so a message is
// recoverable as long as history is. The RECOVERY lane exists precisely because the K_root blob must survive even
// that, and it alone stores its blob on chain.
//
// TERMINAL + CARRY: success stores the record and returns the payer's change (one send to the sender's wallet, which
// cannot fail), keeping only the shard's own rent. Every refusal is a COMPUTE throw, which bounces and refunds.

const RS_SAFE_CAP: Int = 4096;        // records per (bucket_key, epoch); refuse in COMPUTE, not code 50 in ACTION
const RS_RETENTION: Int = 31536000;   // 1 year — CONV records live this long, then are evictable (matches the endowment)
const RS_EVICT_CAP: Int = 64;         // max records one EvictRecords call may sweep (bounds gas; keepers repeat)

// frame_commit preimage tag. The CONTRACT defines the commitment, so client and reader cannot disagree about it.
const RS_FRAME_DOMAIN: Int = 0x52534643;   // "RSFC"
const RS_WRITE_DOMAIN: Int = 0x52535744;   // "RSWD" — the write-authorization digest preimage

// [RE-MEASURE BEFORE SEAL] Storage is 64962 nanoton/cell/year (config-18, bits free).
//   record endowment: 2 measured cells x 64962 x 1yr x 1.5 = 194_886 -> 200_000 (the record lives 1 year)
//   base endowment:   the shard's own code+data rent over its 1-year life, with margin
//   publish gas:      this contract's own compute + the change-return, measured ~1.6M on the old terminal hop
const RS_RECORD_ENDOWMENT: Int = 200000;
const RS_BASE_ENDOWMENT: Int = 2000000;
const RS_PUBLISH_GAS: Int = 2500000;
const RS_MIN_VALUE: Int = RS_RECORD_ENDOWMENT + RS_PUBLISH_GAS;   // minimum that must ARRIVE (gate 13652)

// The capsule a client publishes. The three cells are carried so they land in this account's transaction history;
// they are NOT stored in state. frame_commit is recomputed here from their hashes — nothing is trusted from the sender.
message(0x52535031) CapsulePublish {   // "RSP1"
    seq: Int as uint64;               // strictly increasing per shard — closes replay, and orders records
    header_0: Cell;
    header_1: Cell;
    body: Cell;
    sig: Cell;                        // ed25519 over H(RS_WRITE_DOMAIN ‖ seq ‖ frame_commit) under write_pubkey
}

message(0x52535032) EvictRecords {     // "RSP2" — permissionless FIFO eviction of records past the 1-year window
    max_count: Int as uint16;
}

struct RecordEntry {
    frame_commit: Int;
    created_at: Int;
}

struct CapsuleRecordView {
    exists: Bool;
    frame_commit: Int;
    created_at: Int;     // the client orders/ages records by this; the contract stamps it, so it cannot be gamed
}

struct RecordShardView {
    write_pubkey: Int;
    epoch: Int;
    last_seq: Int;
    record_count: Int;   // monotonic next id (total ever stored)
    live_count: Int;     // current live records (after eviction)
    evict_cursor: Int;
    safe_cap: Int;
    retention: Int;
    min_value: Int;      // what a publish must bring (clients read this instead of hardcoding a mirror)
}

contract RecordShard {
    write_pubkey: Int as uint256;     // the bucket's identity AND its write authority (see the header)
    epoch: Int as uint32;
    last_seq: Int as uint64;          // replay floor: a publish must strictly exceed it
    records: map<Int, RecordEntry>;   // entry_id -> (frame_commit, created_at)
    record_count: Int as uint32;      // monotonic next id
    live_count: Int as uint32;
    evict_cursor: Int as uint32;      // FIFO low-water: lowest id not yet evicted

    init(write_pubkey: Int, epoch: Int) {
        self.write_pubkey = write_pubkey;
        self.epoch = epoch;
        self.last_seq = 0;
        self.records = emptyMap();
        self.record_count = 0;
        self.live_count = 0;
        self.evict_cursor = 0;
    }

    // The commitment binding a record to its capsule cells. Defined HERE so the publisher and the reader derive it
    // identically by construction — a client-supplied commit could silently disagree with the cells it ships.
    fun frameCommit(h0: Cell, h1: Cell, body: Cell): Int {
        return beginCell()
            .storeUint(RS_FRAME_DOMAIN, 32)
            .storeUint(h0.hash(), 256)
            .storeUint(h1.hash(), 256)
            .storeUint(body.hash(), 256)
            .endCell()
            .hash();
    }

    receive(msg: CapsulePublish) {
        // Funding gated in COMPUTE, before any state change, so an underfunded publish bounces and is refunded
        // rather than half-committing. The record's rent must be present or the shard slowly starves.
        throwUnless(13652, context().value >= RS_MIN_VALUE);
        // SAFE-CAP in COMPUTE, so a full partition bounces instead of hitting code 50 in ACTION.
        throwUnless(13651, self.live_count < RS_SAFE_CAP);
        // Replay floor: a captured (cells, sig) pair cannot be re-sent to burn slots.
        throwUnless(13653, msg.seq > self.last_seq);

        // WRITE AUTHORIZATION: the commitment is computed HERE from the attached cells, so the signature binds the
        // exact capsule — a captured signature cannot be spliced onto different content, and an outsider who knows
        // only the address cannot sign at all.
        let commit: Int = self.frameCommit(msg.header_0, msg.header_1, msg.body);
        let digest: Int = beginCell()
            .storeUint(RS_WRITE_DOMAIN, 32).storeUint(msg.seq, 64).storeUint(commit, 256)
            .endCell().hash();
        throwUnless(13654, checkSignature(digest, msg.sig.beginParse(), self.write_pubkey));

        self.last_seq = msg.seq;
        // created_at is stamped by the CONTRACT (now()), so eviction cannot be gamed by a client field.
        self.records.set(self.record_count, RecordEntry{ frame_commit: commit, created_at: now() });
        self.record_count = self.record_count + 1;
        self.live_count = self.live_count + 1;

        // Keep only this shard's own rent (its base + one endowment per LIVE record) and hand the payer back the
        // rest. ReserveAtMost never over-reserves; the 13652 gate guarantees the balance covers it, so the send
        // below has funds. A message to the sender's wallet cannot fail, so ACTION stays safe.
        nativeReserve(RS_BASE_ENDOWMENT + self.live_count * RS_RECORD_ENDOWMENT, ReserveAtMost);
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    // Permissionless FIFO eviction of CONV records past the 1-year window. Records are appended in order, so
    // created_at is monotonic and a FIFO cursor drains oldest-first — this reclaims the (bucket_key, epoch) shards
    // instead of letting them accumulate forever.
    receive(msg: EvictRecords) {
        let swept: Int = 0;
        let cursor: Int = self.evict_cursor;
        while ((swept < msg.max_count) && (swept < RS_EVICT_CAP) && (cursor < self.record_count)) {
            let e: RecordEntry? = self.records.get(cursor);
            if (e != null) {
                if ((e!!.created_at + RS_RETENTION) < now()) {
                    self.records.set(cursor, null);
                    self.live_count = self.live_count - 1;
                    cursor = cursor + 1;
                    swept = swept + 1;
                } else {
                    swept = msg.max_count;   // oldest live record is still fresh -> nothing older remains
                }
            } else {
                cursor = cursor + 1;
            }
        }
        self.evict_cursor = cursor;
    }

    receive() {}   // plain top-up / lazy deploy carrier

    get fun get_record(entry_id: Int): CapsuleRecordView {
        let e: RecordEntry? = self.records.get(entry_id);
        if (e == null) {
            return CapsuleRecordView{ exists: false, frame_commit: 0, created_at: 0 };
        }
        let v: RecordEntry = e!!;
        return CapsuleRecordView{ exists: true, frame_commit: v.frame_commit, created_at: v.created_at };
    }

    get fun get_view(): RecordShardView {
        return RecordShardView{
            write_pubkey: self.write_pubkey,
            epoch: self.epoch,
            last_seq: self.last_seq,
            record_count: self.record_count,
            live_count: self.live_count,
            evict_cursor: self.evict_cursor,
            safe_cap: RS_SAFE_CAP,
            retention: RS_RETENTION,
            min_value: RS_MIN_VALUE,
        };
    }
}
