import "./NullifierShard.tact";

// RecordShard — clean-17 sharded anon-publish, increment 3: the TERMINAL hop that stores a capsule record.
//
// One (bucket_key, epoch) partition — a conversation-direction for a day. Deployed lazily, address =
// f(StateInit{bucket_key, epoch}), so a client that knows its bucket_key computes the address locally and reads
// the records straight from account state (zero getters, zero cross-shard walk). Dies with its epoch.
//
// It is the TERMINAL hop on purpose: on success it stores the record and sends NOTHING (0 outgoing, 0
// nativeReserve). The ACTION phase therefore has no failure surface — the class of silent code-50 loss that has
// no bounce cannot happen here. Every refusal is a COMPUTE throw, which bounces. This is what makes the two-hop
// path safe: the nullifier is burnt at the NullifierShard, and the record hop can only either succeed or refuse-
// and-bounce in COMPUTE — it never half-commits silently.
//
// AUTHORITY: it accepts a record ONLY from the exact NullifierShard that must have burnt this token's nullifier.
// The forward carries the serial; this contract recomputes lane = serial mod LANE_COUNT and the NullifierShard's
// address = f(StateInit{epoch, lane}), and requires sender() to equal it (RS-AUTH). Without this gate anyone could
// write records for free, bypassing the nullifier burn.
//
// CARRY: the record's storage endowment rides in the forwarded value. Being terminal and reserving nothing, the
// contract simply keeps the whole incoming value on balance — the endowment stays, funding the record's rent.
//
// SAFE-CAP: RS_SAFE_CAP bounds records per (bucket_key, epoch) so the account cannot grow into code 50. The cap is
// per-conversation-per-day; reaching it means 4096 spent credits (10 ATH each) aimed at one conversation-day —
// economically absurd, so the bounce path below is effectively unreachable. If ever hit, the residual (the token's
// nullifier stays burnt while the record is refused) is a single lost message for someone who burnt 4096 credits;
// documented and accepted rather than compensated with cross-shard saga machinery.

const RS_LANE_COUNT: Int = 1048576;   // MUST equal NullifierShard's NS_LANE_COUNT (the sender-address derivation)
const RS_SAFE_CAP: Int = 4096;        // records per (bucket_key, epoch); refuse in COMPUTE, not code 50 in ACTION
const RS_RETENTION: Int = 31536000;   // 1 year — CONV records live this long, then are evictable (matches the endowment)
const RS_EVICT_CAP: Int = 64;         // max records one EvictRecords call may sweep (bounds gas; keepers repeat)

message(0x52535031) RecordStore {     // "RSP1" — forwarded by the NullifierShard after it burns the nullifier
    serial: Int as uint256;           // lets this shard recompute the authorized NullifierShard address
    frame_commit: Int as uint256;     // the capsule frame commitment (H of the header/body hashes); the body lives
                                       // in the forwarding transaction's history, authenticated by this commit
}

message(0x52535032) EvictRecords {    // "RSP2" — permissionless FIFO eviction of records past the 1-year window
    max_count: Int as uint16;
}

struct RecordEntry {
    frame_commit: Int;
    created_at: Int;
}

struct CapsuleRecordView {
    exists: Bool;
    frame_commit: Int;
}

struct RecordShardView {
    bucket_key: Int;
    epoch: Int;
    record_count: Int;   // monotonic next id (total ever stored)
    live_count: Int;     // current live records (after eviction)
    evict_cursor: Int;
    lane_count: Int;
    safe_cap: Int;
    retention: Int;
}

contract RecordShard {
    bucket_key: Int as uint256;
    epoch: Int as uint32;
    records: map<Int, RecordEntry>;   // entry_id -> (frame_commit, created_at)
    record_count: Int as uint32;      // monotonic next id
    live_count: Int as uint32;
    evict_cursor: Int as uint32;      // FIFO low-water: lowest id not yet evicted

    init(bucket_key: Int, epoch: Int) {
        self.bucket_key = bucket_key;
        self.epoch = epoch;
        self.records = emptyMap();
        self.record_count = 0;
        self.live_count = 0;
        self.evict_cursor = 0;
    }

    receive(msg: RecordStore) {
        // RS-AUTH: the sender must be the exact NullifierShard for (this shard's epoch, serial's lane). That shard,
        // and only that shard, could have reached here — because it burns the nullifier before forwarding, and its
        // address is unforgeable. A record therefore exists iff a nullifier was spent for its token.
        let lane: Int = msg.serial % RS_LANE_COUNT;
        let expected: Address = contractAddress(initOf NullifierShard(self.epoch, lane));
        throwUnless(13650, sender() == expected);

        // SAFE-CAP in COMPUTE, so a full partition bounces instead of hitting code 50 in ACTION.
        throwUnless(13651, self.live_count < RS_SAFE_CAP);

        // created_at is stamped by the CONTRACT (now()), so eviction cannot be gamed by a client field.
        self.records.set(self.record_count, RecordEntry{ frame_commit: msg.frame_commit, created_at: now() });
        self.record_count = self.record_count + 1;
        self.live_count = self.live_count + 1;
        // EMPTY ACTION PHASE: no send, no reserve. The forwarded value (the endowment) stays on balance. Nothing
        // can fail after this point.
    }

    // Permissionless FIFO eviction of CONV records past the 1-year window. Records are appended in order, so
    // created_at is monotonic and a FIFO cursor drains oldest-first — this reclaims the (bucket_key, epoch) shards
    // instead of letting them accumulate forever (clean-17 spec section 9, item 3).
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
            return CapsuleRecordView{ exists: false, frame_commit: 0 };
        }
        return CapsuleRecordView{ exists: true, frame_commit: e!!.frame_commit };
    }

    get fun get_view(): RecordShardView {
        return RecordShardView{
            bucket_key: self.bucket_key,
            epoch: self.epoch,
            record_count: self.record_count,
            live_count: self.live_count,
            evict_cursor: self.evict_cursor,
            lane_count: RS_LANE_COUNT,
            safe_cap: RS_SAFE_CAP,
            retention: RS_RETENTION,
        };
    }
}
