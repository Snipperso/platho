// IntroShard — clean-17 sharded INTRO lane (first contact, stealth). Partition = (epoch, bucket).
//
// DIRECT-PAID (no tokens, no nullifiers, no issuer) — see RecordShard.tact for the full rationale. [OWNER
// 2026-07-18: all external infrastructure is forbidden in this project and always has been.] The blind-token layer
// that used to gate this lane only bought unlinkability against the issuer and required an external relay to mean
// anything, so it is gone. A publisher simply pays the rent for what it stores.
//
// WHY THIS LANE IS OPEN BY NATURE. Unlike CONV, an INTRO is a first contact from a STRANGER, so there is no shared
// secret yet and the bucket is SENDER-chosen and public — anyone may write here, and that is inherent, not a
// weakness. Leak-freedom comes from the payload, not from access control: the bucket reveals nothing about the
// recipient (who is hidden behind the stealth view_tag), and the recipient SCANS — it reads the compact
// (r, view_tag) of every live intro in its window and tests each against its scan secret. Spam is bounded by three
// things: every intro pays its own rent, SAFE-CAP refuses a full partition in COMPUTE, and the one-week eviction
// keeps the live set small.
//
// SHORT RETENTION + EVICTION (owner decision 2026-07-17: ONE WEEK): an intro only needs to live until the recipient
// scans it. After a week it is evicted, so (a) the persistent intro graph never accumulates in state — the state
// scraper the redesign targets finds nothing — and (b) the live set stays bounded, which is what keeps the
// leak-free full scan feasible. A recipient offline longer than a week misses the first contact; the sender retries.
//
// BODY CARRIAGE: the client publishes DIRECTLY here, so its transaction carries the intro capsule cells and the
// content lives in THIS account's transaction history, authenticated by the stored body_commit. State keeps only
// (r, view_tag, body_commit, created_at) — compact enough that scanning the whole live set stays cheap.
//
// TERMINAL + CARRY: stores the intro, returns the payer's change, keeps only its own rent.

const IS_INTRO_RETENTION: Int = 604800;   // 1 week (owner 2026-07-17) — evict intros older than this
const IS_SAFE_CAP: Int = 8000;            // intros per (epoch, bucket) — refuse in COMPUTE, not code 50 in ACTION
const IS_EVICT_CAP: Int = 64;             // max intros one EvictIntros call may sweep (bounds gas; keepers repeat)
const IS_TAG_PAGE_CAP: Int = 256;         // max view_tags one scan page may pack (bounds get-method gas)
const IS_TAGS_PER_CELL: Int = 63;         // 1023 bits / 16 — how many tags fit one cell's data

// body_commit preimage tag. The CONTRACT defines the commitment so publisher and scanner cannot disagree.
const IS_BODY_DOMAIN: Int = 0x49534243;   // "ISBC"

// [RE-MEASURE BEFORE SEAL] storage 64962 nanoton/cell/year (config-18, bits free).
//   intro endowment: measured 4 cells x 64962 x 7/365 x 1.5 -> 7500 -> 8000 (an intro lives 1 week)
//   base endowment:  this shard's own code+data rent over its short life, with margin
const IS_INTRO_ENDOWMENT: Int = 8000;
const IS_BASE_ENDOWMENT: Int = 1000000;
const IS_PUBLISH_GAS: Int = 2500000;
const IS_MIN_VALUE: Int = IS_INTRO_ENDOWMENT + IS_PUBLISH_GAS;   // minimum that must ARRIVE (gate 13682)

// A stealth first-contact publish. header_0 + body ride so they land in this account's transaction history; they are
// NOT stored in state. body_commit is recomputed here from their hashes — nothing is trusted from the sender.
message(0x49535031) IntroPublish {        // "ISP1"
    r: Int as uint256;                    // stealth ephemeral point R = r*G (recipient tests X25519(scan, R))
    view_tag: Int as uint16;              // HKDF(X25519(r, recipient.scan_pub), R)[:2] — the cheap scan filter
    header_0: Cell;
    body: Cell;
}

message(0x49535032) EvictIntros {         // "ISP2" — permissionless FIFO eviction of intros past the 1-week window
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

// A page of the scan filter. Carries ONLY the 16-bit view_tags — never `r`, never the commitment — because that is
// what makes a leak-free scan affordable: a recipient cannot ask "which of these is mine", so it must look at EVERY
// live intro in the network, and the only question that matters is how many bytes that costs.
//   measured: whole account state    85 B/intro   -> 229 MB/day/user at 2.7M first contacts/day network-wide
//   measured: this page              2.03 B/intro ->   5.5 MB/day/user  (42x less, identical privacy)
// The ids are IMPLICIT — tag i of the page is entry (from_id + i). That is sound because eviction is FIFO from the
// bottom while intros append at the top, so the live range [evict_cursor, next_id) is always CONTIGUOUS and has no
// holes to encode. A missing slot packs as 0, which is simply a candidate the second stage rejects.
struct IntroTagPage {
    from_id: Int;        // first entry id in this page
    count: Int;          // how many tags are packed
    next_id: Int;        // the shard's append cursor, so the caller knows whether more pages remain
    evict_cursor: Int;   // the live floor, so the caller never asks for evicted ids
    tags: Cell;          // `count` x uint16, 63 per cell, chained by ref
}

struct IntroShardView {
    epoch: Int;
    bucket: Int;
    live_count: Int;
    next_id: Int;
    evict_cursor: Int;
    retention: Int;
    safe_cap: Int;
    min_value: Int;      // what a publish must bring (clients read this instead of hardcoding a mirror)
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

    fun bodyCommit(h0: Cell, body: Cell): Int {
        return beginCell()
            .storeUint(IS_BODY_DOMAIN, 32)
            .storeUint(h0.hash(), 256)
            .storeUint(body.hash(), 256)
            .endCell()
            .hash();
    }

    receive(msg: IntroPublish) {
        // Funding gated in COMPUTE before any state change, so an underfunded intro bounces and is refunded.
        throwUnless(13682, context().value >= IS_MIN_VALUE);
        throwUnless(13680, self.live_count < IS_SAFE_CAP);   // SAFE-CAP in COMPUTE

        self.intros.set(self.next_id, IntroEntry{
            r: msg.r,
            view_tag: msg.view_tag,
            body_commit: self.bodyCommit(msg.header_0, msg.body),
            created_at: now(),   // the contract stamps the time, so eviction cannot be gamed by a client field
        });
        self.next_id = self.next_id + 1;
        self.live_count = self.live_count + 1;

        // Reserve the INCREMENT on top of the balance already held (see RecordShard for the full reasoning and the
        // monolith precedent). This lane is OPEN by design, so an absolute reserve was strictly worse here: any
        // surplus on a funded IntroShard could be swept by a stranger publishing one intro.
        nativeReserve(
            IS_INTRO_ENDOWMENT + (self.next_id == 1 ? IS_BASE_ENDOWMENT : 0),
            ReserveAtMost | ReserveAddOriginalBalance,
        );
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
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
                    swept = msg.max_count;   // oldest live intro is still within the window -> nothing older remains
                }
            } else {
                cursor = cursor + 1;   // already gone; advance the low-water mark
            }
        }
        self.evict_cursor = cursor;
        // Pay the evictor out of the freed endowments — absolute reserve on purpose (see RecordShard). Without this
        // nobody calls eviction, and "the one-week eviction keeps the live set small" stops being true.
        nativeReserve(IS_BASE_ENDOWMENT + self.live_count * IS_INTRO_ENDOWMENT, ReserveAtMost);
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    receive() {}

    // Pack the view_tags of [from_id, from_id+n) into a ref-chained cell, built from the END backwards so each cell
    // can reference the one after it.
    fun packTags(start: Int, n: Int): Cell {
        let cell: Cell = beginCell().endCell();
        let isTail: Bool = true;
        let remaining: Int = n;
        while (remaining > 0) {
            let chunk: Int = min(remaining, IS_TAGS_PER_CELL);
            let first: Int = start + remaining - chunk;
            let b: Builder = beginCell();
            let i: Int = 0;
            while (i < chunk) {
                let e: IntroEntry? = self.intros.get(first + i);
                b = b.storeUint(e == null ? 0 : e!!.view_tag, 16);
                i = i + 1;
            }
            if (isTail) {
                cell = b.endCell();
                isTail = false;
            } else {
                cell = b.storeRef(cell).endCell();
            }
            remaining = remaining - chunk;
        }
        return cell;
    }

    // THE SCAN PRIMITIVE. A recipient walks every live intro in its catch-up window through this, testing each tag
    // against its own scan secret, and only fetches the full entry (get_entry) for the ~1-in-65536 that match.
    // Clamped to the live range so a caller can never be handed evicted ids, and capped so the page cannot run the
    // get-method out of gas.
    get fun get_view_tags(from_id: Int, max_count: Int): IntroTagPage {
        let start: Int = max(from_id, self.evict_cursor);
        let available: Int = self.next_id > start ? self.next_id - start : 0;
        let n: Int = min(min(max_count, IS_TAG_PAGE_CAP), available);
        return IntroTagPage{
            from_id: start,
            count: n,
            next_id: self.next_id,
            evict_cursor: self.evict_cursor,
            tags: self.packTags(start, n),
        };
    }

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
            min_value: IS_MIN_VALUE,
        };
    }
}
