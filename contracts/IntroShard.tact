import "./NullifierShard.tact";

// IntroShard — clean-17 sharded anon-publish, INTRO lane (first contact, stealth).
//
// Partition = (epoch, bucket), bucket SENDER-chosen — leak-free: it reveals nothing about the recipient (who is
// hidden behind the stealth view_tag). The recipient SCANS: it reads the compact (R, view_tag) of every live intro
// in its catch-up window and tests each against its scan secret, fetching the full body (from the publishing
// transaction's history) only for matches. State holds only R + view_tag + a body commitment — NOT the body — so
// the scan stays cheap (measured 4 cells/intro; a 1-week window at 1e9-scale traffic is ~2 MB/day to scan).
//
// SHORT RETENTION + EVICTION (owner decision 2026-07-17: ONE WEEK): an intro only needs to live until the
// recipient scans it. After a week it is evicted, so (a) the persistent intro graph never accumulates in state —
// the state scraper the redesign targets finds nothing — and (b) the live set stays bounded to intros/day x 7,
// which is what keeps the leak-free full scan feasible. The only residual is a real-time observer at the moment of
// contact, already an accepted timing residual. A recipient offline longer than a week misses the first contact;
// the sender retries (they see no reply).
//
// AUTHORITY: like the CONV RecordShard, an intro is accepted ONLY from the exact NullifierShard that burnt this
// token's nullifier (RS-AUTH via serial -> NullifierShard address). So INTRO is credit-paid and a token cannot be
// spent in both CONV and INTRO — both lanes route through the same NullifierShard, which burns one nullifier.
//
// TERMINAL, CARRY: stores the intro and sends nothing (empty ACTION — no code-50 surface). The endowment is
// carried in the forward and kept on balance.

const IS_LANE_COUNT: Int = 1048576;       // MUST equal NullifierShard's NS_LANE_COUNT (RS-AUTH derivation)
const IS_INTRO_RETENTION: Int = 604800;   // 1 week (owner 2026-07-17) — evict intros older than this
const IS_SAFE_CAP: Int = 8000;            // intros per (epoch, bucket) — refuse in COMPUTE, not code 50 in ACTION
const IS_EVICT_CAP: Int = 64;             // max intros one EvictIntros call may sweep (bounds gas; keepers repeat)

message(0x49535032) IntroStore {          // "ISP2" — forwarded by the NullifierShard after it burns the nullifier
    serial: Int as uint256;               // lets this shard recompute the authorized NullifierShard address
    r: Int as uint256;                    // stealth ephemeral point R = r*G (recipient tests X25519(scan, R))
    view_tag: Int as uint16;              // HKDF(X25519(r, recipient.scan_pub), R)[:2] — the scan filter
    body_commit: Int as uint256;          // H(the intro body, which lives in the publishing tx history)
}

message(0x49535033) EvictIntros {         // "ISP3" — permissionless FIFO eviction of intros past the 1-week window
    max_count: Int as uint16;
}

struct IntroEntry {
    r: Int;
    view_tag: Int;
    body_commit: Int;
    created_at: Int;
}

struct IntroEntryView {
    exists: Bool;
    r: Int;
    view_tag: Int;
    body_commit: Int;
    created_at: Int;
}

struct IntroShardView {
    epoch: Int;
    bucket: Int;
    live_count: Int;
    next_id: Int;
    evict_cursor: Int;
    retention: Int;
    safe_cap: Int;
}

contract IntroShard {
    epoch: Int as uint32;
    bucket: Int as uint32;
    intros: map<Int, IntroEntry>;
    next_id: Int as uint32;
    live_count: Int as uint32;
    evict_cursor: Int as uint32;   // FIFO low-water: lowest id not yet evicted

    init(epoch: Int, bucket: Int) {
        self.epoch = epoch;
        self.bucket = bucket;
        self.intros = emptyMap();
        self.next_id = 0;
        self.live_count = 0;
        self.evict_cursor = 0;
    }

    receive(msg: IntroStore) {
        // RS-AUTH: the sender must be the exact NullifierShard for (this shard's epoch, the serial's lane). Only it
        // could be here — it burns the nullifier before forwarding, and its address is unforgeable. So an intro
        // exists iff a nullifier was spent for its token (no free intros).
        let lane: Int = msg.serial % IS_LANE_COUNT;
        throwUnless(13681, sender() == contractAddress(initOf NullifierShard(self.epoch, lane)));
        throwUnless(13680, self.live_count < IS_SAFE_CAP);   // SAFE-CAP in COMPUTE

        self.intros.set(self.next_id, IntroEntry{
            r: msg.r,
            view_tag: msg.view_tag,
            body_commit: msg.body_commit,
            created_at: now(),   // the contract stamps the time, so eviction cannot be gamed by a client field
        });
        self.next_id = self.next_id + 1;
        self.live_count = self.live_count + 1;
        // EMPTY ACTION: no send, no reserve. The forwarded endowment stays on balance.
    }

    // Permissionless FIFO eviction of intros past the 1-week window. Intros are appended in order, so created_at is
    // monotonic and a FIFO cursor drains oldest-first. This is what keeps the intro graph from persisting in state.
    receive(msg: EvictIntros) {
        let swept: Int = 0;
        let cursor: Int = self.evict_cursor;
        while ((swept < msg.max_count) && (swept < IS_EVICT_CAP) && (cursor < self.next_id)) {
            let e: IntroEntry? = self.intros.get(cursor);
            if (e != null) {
                if ((e!!.created_at + IS_INTRO_RETENTION) < now()) {
                    self.intros.set(cursor, null);
                    self.live_count = self.live_count - 1;
                    cursor = cursor + 1;
                    swept = swept + 1;
                } else {
                    // oldest live intro is still within the window -> nothing older remains to evict
                    swept = msg.max_count;   // break
                }
            } else {
                cursor = cursor + 1;   // already gone; advance the low-water mark
            }
        }
        self.evict_cursor = cursor;
    }

    receive() {}

    get fun get_entry(entry_id: Int): IntroEntryView {
        let e: IntroEntry? = self.intros.get(entry_id);
        if (e == null) {
            return IntroEntryView{ exists: false, r: 0, view_tag: 0, body_commit: 0, created_at: 0 };
        }
        let v: IntroEntry = e!!;
        return IntroEntryView{ exists: true, r: v.r, view_tag: v.view_tag, body_commit: v.body_commit, created_at: v.created_at };
    }

    get fun get_view(): IntroShardView {
        return IntroShardView{
            epoch: self.epoch,
            bucket: self.bucket,
            live_count: self.live_count,
            next_id: self.next_id,
            evict_cursor: self.evict_cursor,
            retention: IS_INTRO_RETENTION,
            safe_cap: IS_SAFE_CAP,
        };
    }
}
