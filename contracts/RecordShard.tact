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
//   record endowment: 3 MEASURED cells x 64962 x 1yr x 1.5 = 292_329 -> 300_000 (the record lives 1 year).
//     The earlier "2 cells" figure lost the G8 1.5x margin by coincidence: 2 x 64962 x 1.5 == 3 x 64962 == 194_886,
//     so the number looked right while the real margin was 1.026x. config-18 is a SCHEDULE and has already moved
//     (500/1 -> 135/0 in Apr 2026); a 3% rise would make a full shard rent-insolvent before its own retention ends,
//     and an immutable contract cannot be repriced afterwards.
//   base endowment:   the shard's own code+data rent over its 1-year life, with margin
//   publish gas:      this contract's own compute + the change-return, measured ~1.6M on the old terminal hop
const RS_RECORD_ENDOWMENT: Int = 300000;
const RS_BASE_ENDOWMENT: Int = 2000000;
const RS_PUBLISH_GAS: Int = 2500000;

// PROTOCOL FEE — 0.01 GRAM per published capsule. NOT storage: this is the service fee that funds the liquidity
// pool, and it is the other half of the airdrop's economics (owner's frozen math: 1.5M capsules -> 15M ATH paid out
// -> 15k GRAM collected). It carried the same value in the deleted CreditSale (CS_CREDIT_FEE_DEFAULT = 10000000,
// commented "owner: 10M nanoTON -> 15k GRAM at 1.5M"), and dropping the token layer silently dropped it with them.
// Restoring it also removes what looked like an airdrop-farm: publishing must cost the fee, not just the rent.
const RS_PROTOCOL_FEE: Int = 10000000;

// THE FEE'S WAY OUT. Without this the fee was a one-way trap: accrued_fee only ever grew and was only ever
// reserved, so the 15k GRAM that IS the pool's TON side would have been immured across millions of shards by an
// immutable contract. The sink is FeeAccumulator, the same contract CapsuleHub already deposits into.
//
// THE ADDRESS IS A CONSTANT, NOT A BINDING. A shard deploys LAZILY and UNBOUND — the first publisher creates the
// account — so any post-deploy bind receiver would let a stranger bind their own address and walk off with every
// fee that shard ever collects. A constant is the only form that cannot be captured.
// This was expected to force a genesis ordering constraint (sink address -> shard code -> shard addresses).
// MEASURED 2026-07-19: it does not. FeeAccumulator.init takes only (treasury_receiver, buyback_burn) with NO
// deployment_id, so its address is a pure function of its code and the owner's two wallets — the current build
// reproduces the manifest address 0:126ccfb...f3fe3e exactly. The address is therefore already known and already
// live, and it is pinned against a fresh derivation by tests/shard-fee-outlet.test.ts. If FeeAccumulator's code or
// either owner wallet ever changes, that pin fails loudly instead of routing real money into a dead address.
const RS_FEE_SINK: Address = address("EQASbM-7--CIRVhLUSvT9E5JVxTwURQ20AoAqNj9IPP-PtQu");

// FeeAccumulator's own gate 15002 demands context().value >= amount + FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE, so an
// under-funded deposit is REFUSED and, being non-bounceable, would land as unaccounted balance — the exact defect
// m31 fixed in CapsuleHub.FlushFees. Mirror its shape: send amount + the deposit reserve, fees paid separately.
const RS_FEE_SINK_DEPOSIT_RESERVE: Int = 2000000;
// The shard pays the forward fee for its OWN message. Charged to the account rather than taken out of the value,
// it would otherwise come from the pool that mode-128 returns to the evictor — the caller would silently
// subsidise the protocol's transfer.
// MEASURED 2026-07-19: the whole eviction transaction's action phase pays 150_668 in forward fees for BOTH
// outbound messages together, i.e. ~75_000 for this one, and the figure does not move with shard size because
// the deposit body is a fixed 160 bits. The first revision reserved 2_000_000 here — 26x the real cost — and
// every unused nanoton of that went to the EVICTOR rather than to the pool, so over-reserving is not free.
// 500_000 keeps ~6.6x headroom against a config-25 repricing. Erring high is still the right direction: if the
// real fee ever exceeded this the excess would come out of the evictor's change, which is millions, so the
// failure is a slightly smaller bounty rather than a cliff.
const RS_FEE_SINK_FWD_RESERVE: Int = 500000;
const RS_FEE_REMIT_OVERHEAD: Int = RS_FEE_SINK_DEPOSIT_RESERVE + RS_FEE_SINK_FWD_RESERVE;

// THE FEE PAYS FOR ITS OWN EXTRACTION. What reaches the pool is what the shard collected MINUS the cost of
// moving it. This is not a preference, it is what the measurements forced:
//   MEASURED 2026-07-19 — money a swept shard holds ABOVE its accrued fee, i.e. all that was ever available to
//   fund the transfer:  CONV 736_636 at 1 record, 1_468_693 at 8, 3_978_604 at 32;  INTRO ~965_285 at 1 record
//   rising only to 1_200_181 at 64 (its endowment covers one WEEK, so there is almost no margin at any size).
// Against a 4_000_000 overhead the fee therefore could not leave AT ALL on the INTRO lane, and only from ~64
// records upward on CONV — which is to say the outlet, as first written, did not work for ordinary shards.
// Charging the overhead to the shard's spare balance was never viable; charging it to the first publisher would
// have meant raising the publish gate for everyone. Charging it to the fee itself needs neither, and makes the
// affordability test hold BY CONSTRUCTION: the publish path already reserves fee + endowment + bounty per
// record, so a rent-solvent shard can always afford exactly this.
// The cost is real and belongs in the owner's arithmetic: the pool receives the collected fee less ~4_000_000
// per SHARD (not per capsule), of which the 2_000_000 deposit reserve is FeeAccumulator's immutable gate demand
// and settles into its balance rather than into accumulated_ton.
const RS_FEE_REMIT_MIN: Int = RS_FEE_REMIT_OVERHEAD + 1;   // below this, moving the fee would cost more than it is

// EVICTION BOUNTY — what actually makes eviction happen. [MEASURED 2026-07-18.] The payout used to be the freed
// RS_RECORD_ENDOWMENT, which cannot work for a structural reason rather than a tuning one: a storage endowment is
// BY CONSTRUCTION consumed by the storage it paid for, so when a record finally ages out there is nothing left of
// it. Worse, the floor correctly protects accrued_fee (that money is the liquidity pool's, not the evictor's), so
// what reaches the caller is only whatever rent has not yet eaten. Measured on a full 64-record sweep past the
// 1-year window the caller LOST 12_598_501 nanoton; marginal cost is ~187_000 per record (stable across two
// disjoint spans: 165_820 over records 16-32 and 186_654 over 32-64).
// Keeper daemons are forbidden in this project, so the only possible caller is a self-interested participant, and
// "nobody calls it" is a certainty rather than a risk. Everything resting on eviction — bounded state, reclaimed
// shards, the retention promise — was therefore unfunded. Immutable contracts cannot be repriced later.
// SIZED AT THE WORST CASE THE CONTRACT PERMITS, not at a convenient one. Marginal gas per evicted record grows
// with dictionary DEPTH, so a bounty calibrated on a small shard fails on a large one — measured per entry:
//   64 records 283_082 · 256 -> 366_519 · 1024 -> 449_853 · 2048 -> 491_519 · 4096 (RS_SAFE_CAP) -> 533_186
// The first revision used 300_000, calibrated at 64 records, and went loss-making from ~80 records upward — an
// ordinary conversation-day against a 4096 cap. Idle time does NOT enter this (verified: 2048 records after ten
// idle years sits on the same curve), because the reserve no longer charges the shard's rent to the caller.
//   533_186 x 1.5 (G8) = 799_779 -> 800_000
const RS_EVICT_BOUNTY: Int = 800000;

const RS_MIN_VALUE: Int = RS_RECORD_ENDOWMENT + RS_EVICT_BOUNTY + RS_PUBLISH_GAS + RS_PROTOCOL_FEE;   // gate 13652

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

// Declared locally with FeeAccumulator's opcode, exactly as CapsuleHub does — Tact compiles one contract per
// project, so the sink's message type is mirrored rather than imported. The opcode is what must match.
message(0xFF775609) DepositProtocolFee {
    amount: Int as uint128;
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
    protocol_fee: Int;    // the per-capsule service fee included in min_value
    accrued_fee: Int;     // collected fee held here, awaiting routing to the fee sink
    evict_bounty: Int;    // what evicting one record pays its caller
    accrued_bounty: Int;  // bounties still owed for records that have not been evicted yet
    fee_sink: Address;    // where accrued_fee is routed; a constant, readable so it needs no disassembly to check
}

contract RecordShard {
    write_pubkey: Int as uint256;     // the bucket's identity AND its write authority (see the header)
    epoch: Int as uint32;
    last_seq: Int as uint64;          // replay floor: a publish must strictly exceed it
    records: map<Int, RecordEntry>;   // entry_id -> (frame_commit, created_at)
    record_count: Int as uint32;      // monotonic next id
    live_count: Int as uint32;
    evict_cursor: Int as uint32;      // FIFO low-water: lowest id not yet evicted
    accrued_fee: Int as coins;        // protocol fee collected here; routing to the fee sink is the open piece
    accrued_bounty: Int as coins;     // held for the future evictor of each live record; released only on eviction

    init(write_pubkey: Int, epoch: Int) {
        self.write_pubkey = write_pubkey;
        self.epoch = epoch;
        self.last_seq = 0;
        self.records = emptyMap();
        self.record_count = 0;
        self.live_count = 0;
        self.evict_cursor = 0;
        self.accrued_fee = 0;
        self.accrued_bounty = 0;
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
        throwUnless(13656, (nowEpoch >= self.epoch - 1) && (nowEpoch <= self.epoch + 1));
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
        self.accrued_fee = self.accrued_fee + RS_PROTOCOL_FEE;
        self.accrued_bounty = self.accrued_bounty + RS_EVICT_BOUNTY;
        // created_at is stamped by the CONTRACT (now()), so eviction cannot be gamed by a client field.
        self.records.set(self.record_count, RecordEntry{ frame_commit: commit, created_at: now() });
        self.record_count = self.record_count + 1;
        self.live_count = self.live_count + 1;

        // Reserve the INCREMENT this message adds, ON TOP OF the balance the account already had
        // (ReserveAddOriginalBalance), and return only THIS message's change. An absolute reserve was wrong and the
        // monolith says so in as many words at CapsuleHub.tact:1722 — "reserve(protectedReserve) would be WRONG, it
        // would leak the sweepable surplus". With an absolute target the balance becomes a hard ceiling: every
        // surplus (a deliberate top-up to extend a conversation, a mistaken transfer, the deploy float) is swept to
        // whoever publishes next, and the balance also becomes an exact public message counter. ReserveAtMost keeps
        // it from ever exceeding the balance, so ACTION still cannot fail.
        nativeReserve(
            RS_RECORD_ENDOWMENT + RS_PROTOCOL_FEE + RS_EVICT_BOUNTY + (self.record_count == 1 ? RS_BASE_ENDOWMENT : 0),
            ReserveAtMost | ReserveAddOriginalBalance,
        );
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    // Permissionless FIFO eviction of CONV records past the 1-year window. Records are appended in order, so
    // created_at is monotonic and a FIFO cursor drains oldest-first — this reclaims the (bucket_key, epoch) shards
    // instead of letting them accumulate forever.
    receive(msg: EvictRecords) {
        // `evicted` is the REAL count; `steps` is the gas bound. They must be SEPARATE: the previous version
        // overloaded one counter as both, assigning it max_count to break out when the oldest record was still
        // fresh — so a "nothing was evicted" exit looked identical to a full sweep. Every iteration counts toward
        // `steps`, including the already-gone branch, which previously advanced the cursor without any bound.
        let evicted: Int = 0;
        let steps: Int = 0;
        let cursor: Int = self.evict_cursor;
        let stop: Bool = false;
        while ((steps < msg.max_count) && (steps < RS_EVICT_CAP) && (cursor < self.record_count) && !stop) {
            let e: RecordEntry? = self.records.get(cursor);
            steps = steps + 1;
            if (e != null) {
                if ((e!!.created_at + RS_RETENTION) < now()) {
                    self.records.set(cursor, null);
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
        throwUnless(13655, evicted > 0);
        // PAY THE EVICTOR. Eviction is the only drain in an immutable contract and external keeper daemons are
        // forbidden in this project, so it will only ever be called by an ordinary participant — who, before this,
        // paid gas AND donated the rest of their value to the shard. Nobody rationally does that, which would have
        // quietly voided every claim resting on eviction (bounded state, and the one-week INTRO retention that is
        // the whole point of not persisting the first-contact graph).
        //
        // Release EXACTLY the endowments this call freed, and nothing else. A plain absolute reserve was wrong for
        // the same reason it is wrong on the publish path above: it makes the balance a hard ceiling, so the first
        // eviction hands a deliberate top-up to whoever happens to call it — the publish path promises to protect
        // that top-up, and this path was quietly taking it. Inverting the sign instead (original − freed) fixes
        // that but opens the opposite hole: once rent has eaten into the balance, paying out a full `freed` comes
        // out of the endowments of records that are still LIVE. Both bounds have to hold at once, so take the max.
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
        let payout: Int = evicted * RS_EVICT_BOUNTY;
        self.accrued_bounty = self.accrued_bounty - payout;

        // ROUTE THE PROTOCOL FEE OUT. One outbound fee message per shard, for the whole life of the shard.
        //
        // WHY ONE IS ENOUGH: the publish gate (13656) admits an epoch only within +/-1, so from epoch+2 onward
        // nothing can ever be added to accrued_fee again. The figure is FINAL, not a running total, so there is
        // no need for a flush loop, an operator, or a keeper — all of which are forbidden here anyway.
        // The guard is redundant by arithmetic (a record can only be evicted after RS_RETENTION, which is a year,
        // so any successful sweep is already far past epoch+1) and is kept because it is the actual invariant the
        // single-message design rests on: it must fail closed if retention is ever shortened below two days.
        //
        // AFFORDABILITY IS CHECKED IN COMPUTE, NOT CLAMPED IN ACTION. This is the whole lesson of the design
        // panel: three attackers compiled the winning proposal and broke it fatally. It put the explicit fee send
        // AHEAD of the mode-128 payout with only a `keep < 0` clamp behind it — and the clamp does not hold the
        // send back, it just lets the reserve collapse to zero, after which the fee is drawn from the CALLER's
        // attached value. An ACTION-phase failure does not bounce either, so the shard would have silently eaten
        // a stranger's money. Same class as the reserve defect fixed on this very receiver earlier.
        // Checking here instead means a shard too poor to remit simply does not remit; nothing is clamped,
        // nothing is billed to the evictor, and the fee waits for a later sweep.
        //
        // BOUNTIES OUTRANK THE FEE. What is left after the remit must still cover every bounty this shard still
        // owes, or a later evictor is underpaid, stops calling, and the records are never swept — which would
        // trade a funded fee outlet for an unbounded state, the exact failure the bounty exists to prevent.
        // `spend` is what leaves for the sink INCLUDING the cost of sending it, and is exactly self.accrued_fee.
        // `feeOut` is the principal the sink books. See RS_FEE_REMIT_MIN for why the overhead comes out of the
        // fee rather than out of the shard or the publisher.
        let feeOut: Int = 0;
        let spend: Int = 0;
        let nowEpoch: Int = now() / 86400;
        if ((self.accrued_fee >= RS_FEE_REMIT_MIN) && (nowEpoch > self.epoch + 1)
            && ((original - payout - self.accrued_fee) >= self.accrued_bounty)) {
            feeOut = self.accrued_fee - RS_FEE_REMIT_OVERHEAD;
            spend = self.accrued_fee;
            self.accrued_fee = 0;
        }

        let keep: Int = original - payout - spend;
        if (keep < 0) { keep = 0; }
        nativeReserve(keep, ReserveAtMost);
        if (feeOut > 0) {
            message(MessageParameters {
                to: RS_FEE_SINK,
                value: feeOut + RS_FEE_SINK_DEPOSIT_RESERVE,
                bounce: true,
                mode: SendPayFwdFeesSeparately,
                body: DepositProtocolFee{ amount: feeOut }.toCell()
            });
        }
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    // The sink refused the deposit or was unreachable. The value came back with the bounce, so the debt must come
    // back with it — otherwise accrued_fee would read 0 while the money still sat here, unaccounted and unsendable.
    // A later sweep retries.
    // THE SENDER GATE IS LOAD-BEARING, not hygiene: the bounced flag is an ordinary message-header bit that any
    // account may set, so without this check a stranger could forge a bounce and inflate accrued_fee at will.
    // That does not pay them anything, but an inflated debt fails the affordability test above forever, which
    // strands the real fee — a cheap, permanent denial of the outlet.
    bounced(msg: bounced<DepositProtocolFee>) {
        throwUnless(13657, sender() == RS_FEE_SINK);
        throwUnless(13658, msg.amount > 0);
        self.accrued_fee = self.accrued_fee + msg.amount;
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
            protocol_fee: RS_PROTOCOL_FEE,
            accrued_fee: self.accrued_fee,
            evict_bounty: RS_EVICT_BOUNTY,
            accrued_bounty: self.accrued_bounty,
            fee_sink: RS_FEE_SINK,
        };
    }
}
