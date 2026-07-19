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
// A scan page carries (r, view_tag) PAIRS, not bare tags. [CORRECTED 2026-07-18 — the tag-only page could not
// serve a scan at all.] The recipient's filter is computePrivateScanViewTag(scan_secret, r): the tag is a function
// of the intro's OWN ephemeral point, so it is unique per intro and the recipient cannot precompute "my tag" once
// and match it against a list. That is not an implementation detail — it is what stealth MEANS. So `r` must be
// downloaded for every live intro no matter how the page is shaped, and a page of bare tags was simply unusable.
//   pair = 256 (r) + 16 (tag) = 272 bits -> 3 per 1023-bit cell (816 used, 79.8% efficient)
// The earlier "2.03 B/intro, 42x cheaper than reading state" figure measured a page that was not sufficient for
// the scan; the honest floor is ~34 B/intro and it cannot be beaten without giving up stealth.
// 256 pairs = 86 cells = ~9 KB per response. Chosen because the EXPENSIVE part of this getter is the 256 dictionary
// lookups, and that count is identical to the tag-only page this replaces — only the cell building grew, which is
// cheap. Measured with the cap temporarily lifted for the probe: 600 pairs (21 KB) still answer, so 256 is not
// near any edge; the cap bounds the response, not the getter. It also sets the SCAN REQUEST COUNT, which is what
// actually limits a phone: a recipient must read every bucket of every epoch in its window, so requests per day
// are max(bucketCount, intros_per_day / IS_SCAN_PAGE_CAP). Raising the cap is the only lever that cuts requests
// without touching privacy — see the budget in PLATHO_CLEAN17_SHARDED_SPEC.md.
const IS_SCAN_PAGE_CAP: Int = 256;
const IS_PAIRS_PER_CELL: Int = 3;         // 1023 bits / 272 — how many (r, tag) pairs fit one cell's data

// body_commit preimage tag. The CONTRACT defines the commitment so publisher and scanner cannot disagree.
const IS_BODY_DOMAIN: Int = 0x49534243;   // "ISBC"

// [RE-MEASURE BEFORE SEAL] storage 64962 nanoton/cell/year (config-18, bits free).
//   intro endowment: measured 4 cells x 64962 x 7/365 x 1.5 -> 7500 -> 8000 (an intro lives 1 week)
//   base endowment:  this shard's own code+data rent over its short life, with margin
const IS_INTRO_ENDOWMENT: Int = 8000;
const IS_BASE_ENDOWMENT: Int = 1000000;
const IS_PUBLISH_GAS: Int = 2500000;

// PROTOCOL FEE — 0.01 GRAM per published capsule, the SAME fee RecordShard charges (RS_PROTOCOL_FEE), because the
// owner's economics are stated per MESSAGE and an intro is a message: 1.5M capsules -> 15k GRAM of liquidity.
// [OWNER 2026-07-18: "комиссию берём и с интро".] Charging it here was previously omitted with no reasoning in the
// code, which made a first contact a quarter the price of a reply.
// It also does defensive work that CONV does not need. This lane is OPEN by design — anyone may write to any
// bucket, and the recipient must SCAN every live intro — so the cost of publishing junk IS the cost of degrading
// everyone's scan. The fee raises that cost ~5x (2.508M -> 12.508M per intro), which is the only lever available:
// there is no gate that can distinguish a real first contact from a fake one without breaking the stealth property.
const IS_PROTOCOL_FEE: Int = 10000000;

// THE FEE'S WAY OUT — identical in shape to RecordShard's, see RS_FEE_SINK there for the full reasoning.
// The address is a CONSTANT because an IntroShard deploys lazily and unbound, and this lane is OPEN by design:
// a post-deploy bind receiver would let literally any stranger bind their own address and collect the fees of
// every intro published to that bucket that day. Pinned against a fresh derivation in tests/shard-fee-outlet.test.ts.
const IS_FEE_SINK: Address = address("EQASbM-7--CIRVhLUSvT9E5JVxTwURQ20AoAqNj9IPP-PtQu");
const IS_FEE_SINK_DEPOSIT_RESERVE: Int = 2000000;   // FeeAccumulator gate 15002
// MEASURED 2026-07-19: ~75_000 actually, constant in shard size (the deposit body is a fixed 160 bits); see
// RS_FEE_SINK_FWD_RESERVE for why over-reserving is not free — the slack goes to the evictor, not the pool.
const IS_FEE_SINK_FWD_RESERVE: Int = 500000;
const IS_FEE_REMIT_OVERHEAD: Int = IS_FEE_SINK_DEPOSIT_RESERVE + IS_FEE_SINK_FWD_RESERVE;

// THE FEE PAYS FOR ITS OWN EXTRACTION — and on this lane there was never an alternative. MEASURED 2026-07-19,
// the money an INTRO shard holds above its accrued fee is ~965_285 at one intro and reaches only 1_200_181 at
// 64: IS_INTRO_ENDOWMENT covers one WEEK, so unlike CONV the margin does not grow with size. Against a
// 4_000_000 overhead the fee could not have left an IntroShard of ANY size. Taking the overhead out of the fee
// makes the affordability test hold by construction, since the publish path already reserves fee + endowment +
// bounty for every intro.
const IS_FEE_REMIT_MIN: Int = IS_FEE_REMIT_OVERHEAD + 1;

// EVICTION BOUNTY — the money that actually makes the one-week retention happen. [MEASURED 2026-07-18.]
// The payout used to come out of IS_INTRO_ENDOWMENT, and that could never work, for a structural reason rather
// than a tuning one: the storage endowment is BY CONSTRUCTION consumed by the storage it paid for, so at the
// moment an entry finally ages out there is nothing left of it to pay anyone. Measured on a full 64-entry sweep,
// the caller LOST 19_012_953 nanoton — marginal cost is ~305_000 per entry (stable across two disjoint spans:
// 283_671 over entries 16-32 and 304_505 over 32-64) against a payout of 8_000. Off by 38x.
// Since keeper daemons are forbidden in this project, "nobody will ever call it" is not a risk but a certainty,
// and everything resting on eviction was therefore false: the intro graph would persist for the life of the shard
// and get_view_tags would keep serving it, so a later scan would find EVERYTHING. That is the exact opposite of
// this lane's stated purpose. An immutable contract cannot be repriced afterwards, so it is fixed here.
// SIZED AT THE WORST CASE THE CONTRACT PERMITS. Marginal gas per evicted intro grows with dictionary DEPTH, and
// this lane's cap is the larger one — measured per entry: 512 intros 425_306 · 4000 -> 550_306 ·
// 8000 (IS_SAFE_CAP) -> 591_973. A bounty calibrated on a shallow shard fails on a full one, and on the OPEN lane
// a full shard is something a stranger can arrange.
//   591_973 x 1.5 (G8) = 887_960 -> 900_000
const IS_EVICT_BOUNTY: Int = 900000;

const IS_MIN_VALUE: Int = IS_INTRO_ENDOWMENT + IS_EVICT_BOUNTY + IS_PUBLISH_GAS + IS_PROTOCOL_FEE;   // gate 13682

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

// Mirrored from FeeAccumulator by opcode (Tact compiles one contract per project) — as CapsuleHub does.
message(0xFF775609) DepositProtocolFee {
    amount: Int as uint128;
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

// A page of the scan input. Carries the (r, view_tag) pairs the recipient needs and NOTHING else — not the body
// commitment, not created_at. A recipient cannot ask "which of these is mine", so it must look at EVERY live intro
// in the network, and the only question that matters is how many bytes that costs.
//   whole account state read   85 B/intro
//   this page                  34 B/intro   (2.5x less, identical privacy)
// 2.5x is the real ceiling, not the 42x an earlier revision claimed: `r` is 32 of those 34 bytes and the scan
// cannot proceed without it. Cutting further means weakening stealth, which is not on the table.
// The ids are IMPLICIT — pair i of the page is entry (from_id + i). That is sound because eviction is FIFO from the
// bottom while intros append at the top, so the live range [evict_cursor, next_id) is always CONTIGUOUS and has no
// holes to encode. A missing slot packs as (0, 0), which is simply a candidate the second stage rejects.
struct IntroScanPage {
    from_id: Int;        // first entry id in this page
    count: Int;          // how many pairs are packed
    next_id: Int;        // the shard's append cursor, so the caller knows whether more pages remain
    evict_cursor: Int;   // the live floor, so the caller never asks for evicted ids
    pairs: Cell;         // `count` x (uint256 r, uint16 view_tag), 3 per cell, chained by ref
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
    protocol_fee: Int;    // the per-capsule service fee included in min_value
    accrued_fee: Int;     // collected fee held here, awaiting routing to the fee sink
    evict_bounty: Int;    // what evicting one entry pays its caller
    accrued_bounty: Int;  // bounties still owed for entries that have not been evicted yet
    fee_sink: Address;    // where accrued_fee is routed; a constant, readable so it needs no disassembly to check
}

contract IntroShard {
    epoch: Int as uint32;
    bucket: Int as uint32;
    intros: map<Int, IntroEntry>;
    next_id: Int as uint32;
    live_count: Int as uint32;
    evict_cursor: Int as uint32;   // FIFO low-water: lowest id not yet evicted
    accrued_fee: Int as coins;     // protocol fee collected here; routing to the fee sink is the open piece
    accrued_bounty: Int as coins;  // held for the future evictor of each live entry; released only on eviction

    init(epoch: Int, bucket: Int) {
        self.epoch = epoch;
        self.bucket = bucket;
        self.intros = emptyMap();
        self.next_id = 0;
        self.live_count = 0;
        self.evict_cursor = 0;
        self.accrued_fee = 0;
        self.accrued_bounty = 0;
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
        // THE SHARD MUST BELONG TO ROUGHLY NOW. Without this the epoch was a free parameter: MEASURED — a publish
        // into the shard for an epoch 300 days PAST and one 300 days FUTURE were both accepted with exit 0.
        // Two things go wrong, and the first is a plain product bug rather than an attack. A client whose clock is
        // off publishes into a shard nobody scans; the recipient's window is the retention period, so the message
        // is lost FOREVER while the wallet reports success. That is the same silent-success family as sending to
        // an uninitialised account, and it is the worst failure mode this project has.
        // The second is that it makes past epochs mutable, so nothing derived from a past epoch's state can be
        // trusted to be the same for two readers — an attacker can move it after one client has read it and before
        // another has. Any client-side rule that reads history (for instance sizing the bucket space from observed
        // fill) rests on epochs being closed, and they were not.
        // The tolerance is +/-1 epoch, not exact equality: a message signed just before midnight may well be
        // processed just after it, and bouncing those would be a real bug for no gain. One epoch of slack is safe
        // because the recipient's scan window is the whole retention period, which is far wider than a day.
        let nowEpoch: Int = now() / 86400;
        throwUnless(13684, (nowEpoch >= self.epoch - 1) && (nowEpoch <= self.epoch + 1));
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
        self.accrued_fee = self.accrued_fee + IS_PROTOCOL_FEE;
        self.accrued_bounty = self.accrued_bounty + IS_EVICT_BOUNTY;

        // Reserve the INCREMENT on top of the balance already held (see RecordShard for the full reasoning and the
        // monolith precedent). This lane is OPEN by design, so an absolute reserve was strictly worse here: any
        // surplus on a funded IntroShard could be swept by a stranger publishing one intro.
        nativeReserve(
            IS_INTRO_ENDOWMENT + IS_PROTOCOL_FEE + IS_EVICT_BOUNTY + (self.next_id == 1 ? IS_BASE_ENDOWMENT : 0),
            ReserveAtMost | ReserveAddOriginalBalance,
        );
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    // Permissionless FIFO eviction of intros past the 1-week window. Intros are appended in order, so created_at is
    // monotonic and a FIFO cursor drains oldest-first. This is what keeps the intro graph from persisting in state.
    receive(msg: EvictIntros) {
        // `evicted` is the REAL count; `steps` is the gas bound. They must be SEPARATE: the previous version
        // overloaded one counter as both, assigning it max_count to break out when the oldest record was still
        // fresh — so a "nothing was evicted" exit looked identical to a full sweep. Every iteration counts toward
        // `steps`, including the already-gone branch, which previously advanced the cursor without any bound.
        let evicted: Int = 0;
        let steps: Int = 0;
        let cursor: Int = self.evict_cursor;
        let stop: Bool = false;
        while ((steps < msg.max_count) && (steps < IS_EVICT_CAP) && (cursor < self.next_id) && !stop) {
            let e: IntroEntry? = self.intros.get(cursor);
            steps = steps + 1;
            if (e != null) {
                if ((e!!.created_at + IS_INTRO_RETENTION) < now()) {
                    self.intros.set(cursor, null);
                    self.live_count = self.live_count - 1;
                    cursor = cursor + 1;
                    evicted = evicted + 1;
                } else {
                    stop = true;   // oldest live entry is still inside the window -> nothing older remains
                }
            } else {
                cursor = cursor + 1;   // already gone; advance the low-water mark
            }
        }
        self.evict_cursor = cursor;
        // REFUSE A NO-OP. Without this, EvictRecords{max_count: 0} — or any call made when nothing has aged out —
        // skips the loop entirely and still falls through to the payout, letting any passer-by drain the shard's
        // surplus for the price of gas. Throwing here reverts the cursor advance too, which is correct: nothing
        // was reclaimed, so nothing is owed.
        throwUnless(13683, evicted > 0);
        // Pay the evictor out of the endowments this call actually freed — bounded on BOTH sides, see RecordShard
        // for the full reasoning. Without any payout nobody calls eviction and "the one-week eviction keeps the
        // live set small" stops being true; without the upper bound a top-up is swept; without the floor a shard
        // that has fallen behind on rent pays the evictor out of live intros' endowments.
        // RELEASE EXACTLY THE BOUNTIES THIS SWEEP FREED, AND NOTHING ELSE.
        //
        // The previous revision reserved `max(floor, original - freed - payout)` where floor counted
        // `base + live*endowment + accrued_fee + accrued_bounty`. That was wrong for a reason worth spelling out,
        // because it looks right: the publish path reserves RELATIVELY (original_balance + endowment + fee +
        // bounty), which are exactly the terms the floor counts, so `balance == floor` holds identically while the
        // shard sits idle. `original` is read AFTER the storage phase, so original = floor - R where R is all the
        // rent settled in this transaction. The clamp therefore fired every time, and the evictor's take became
        // `freed + payout - R`. In other words the shard's ENTIRE accumulated storage bill was deducted from the
        // caller instead of from the entries that incurred it. Measured: +6_640_039 at 64 records but +839_978 at
        // 80, -2_286_748 at 96, -17_460_321 at 160, and at 400 records after ten idle years the caller lost their
        // whole attached value. RS_SAFE_CAP is 4096, so ~80 records is an ordinary day, not an edge case — the
        // regression the bounty exists to prevent had simply moved to larger shards.
        //
        // Releasing the freed ENDOWMENTS was fiction in the first place: a storage endowment is consumed by the
        // storage it paid for, so by the time an entry ages out there is nothing of it left to hand anyone. That is
        // precisely why the bounty exists. So the reserve keeps everything the shard still holds and lets go of the
        // bounty alone. A deliberate top-up is untouched by construction (it is part of `original`, and only
        // `payout` is subtracted), which is the property PB-13 pins. The clamp at zero is the graceful end for a
        // shard already too poor to honour the bounties it owes: pay out what is there and clear the entries.
        let original: Int = myBalance() - context().value;
        let payout: Int = evicted * IS_EVICT_BOUNTY;
        self.accrued_bounty = self.accrued_bounty - payout;

        // ROUTE THE PROTOCOL FEE OUT — one outbound fee message per shard, ever. See RecordShard's EvictIntros
        // twin for the full reasoning; the three load-bearing points are the same.
        // (1) The publish gate (13684) admits an epoch only within +/-1, so from epoch+2 accrued_fee is FINAL and
        //     a single message suffices forever. Here the guard is not even close to redundant the way it is on
        //     the CONV lane: IS_INTRO_RETENTION is one WEEK, so the first sweep lands around epoch+7 — much
        //     nearer the boundary than CONV's year, and this lane is the one a stranger can fill on purpose.
        // (2) Affordability is decided in COMPUTE. Clamping in ACTION was the fatal defect the design panel's
        //     three attackers reproduced by compiling it: the explicit send is not held back by a `keep < 0`
        //     clamp, so the fee comes out of the caller's attached value, and an ACTION-phase failure does not
        //     bounce. A shard that cannot afford the remit simply does not remit.
        // (3) Outstanding bounties outrank the fee — underpay a future evictor and the intro graph is never
        //     swept, which is precisely what this lane's one-week retention exists to guarantee.
        let feeOut: Int = 0;
        let spend: Int = 0;
        let nowEpoch: Int = now() / 86400;
        if ((self.accrued_fee >= IS_FEE_REMIT_MIN) && (nowEpoch > self.epoch + 1)
            && ((original - payout - self.accrued_fee) >= self.accrued_bounty)) {
            feeOut = self.accrued_fee - IS_FEE_REMIT_OVERHEAD;
            spend = self.accrued_fee;
            self.accrued_fee = 0;
        }

        let keep: Int = original - payout - spend;
        if (keep < 0) { keep = 0; }
        nativeReserve(keep, ReserveAtMost);
        if (feeOut > 0) {
            message(MessageParameters {
                to: IS_FEE_SINK,
                value: feeOut + IS_FEE_SINK_DEPOSIT_RESERVE,
                bounce: true,
                mode: SendPayFwdFeesSeparately,
                body: DepositProtocolFee{ amount: feeOut }.toCell()
            });
        }
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    // The sink refused or was unreachable: the value came back, so the debt must too. The sender gate is
    // load-bearing — the bounced flag is an ordinary header bit any account may set, and a forged bounce would
    // inflate accrued_fee past the affordability test and strand the real fee permanently.
    bounced(msg: bounced<DepositProtocolFee>) {
        throwUnless(13685, sender() == IS_FEE_SINK);
        throwUnless(13686, msg.amount > 0);
        self.accrued_fee = self.accrued_fee + msg.amount;
    }

    receive() {}

    // Pack the (r, view_tag) pairs of [from_id, from_id+n) into a ref-chained cell, built from the END backwards so
    // each cell can reference the one after it.
    fun packPairs(start: Int, n: Int): Cell {
        let cell: Cell = beginCell().endCell();
        let isTail: Bool = true;
        let remaining: Int = n;
        while (remaining > 0) {
            let chunk: Int = min(remaining, IS_PAIRS_PER_CELL);
            let first: Int = start + remaining - chunk;
            let b: Builder = beginCell();
            let i: Int = 0;
            while (i < chunk) {
                let e: IntroEntry? = self.intros.get(first + i);
                b = b.storeUint(e == null ? 0 : e!!.r, 256).storeUint(e == null ? 0 : e!!.view_tag, 16);
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
    get fun get_scan_page(from_id: Int, max_count: Int): IntroScanPage {
        let start: Int = max(from_id, self.evict_cursor);
        let available: Int = self.next_id > start ? self.next_id - start : 0;
        // max() against 0 as well: a negative max_count would otherwise return count < 0 beside an empty cell,
        // a page that contradicts itself and that a client has no sane way to read.
        let n: Int = max(0, min(min(max_count, IS_SCAN_PAGE_CAP), available));
        return IntroScanPage{
            from_id: start,
            count: n,
            next_id: self.next_id,
            evict_cursor: self.evict_cursor,
            pairs: self.packPairs(start, n),
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
            protocol_fee: IS_PROTOCOL_FEE,
            accrued_fee: self.accrued_fee,
            evict_bounty: IS_EVICT_BOUNTY,
            accrued_bounty: self.accrued_bounty,
            fee_sink: IS_FEE_SINK,
        };
    }
}
