// RecoveryShard — clean-17 sharded anon-publish, RECOVERY lane. Durability of the K_root self-recovery blob.
//
// RS_MAX_SLOTS partitions per user (self_bucket_key = H(domain ‖ owner_pubkey ‖ slot_index), epoch-INDEPENDENT —
// §12 self-lane), deployed lazily at address = f(StateInit{self_bucket_key}) and filled densely from index 0. A user
// pays for a slot only when they fill one. Unlike the CONV RecordShard, it does NOT die daily: the recovery
// blob must survive so a user who reinstalls after a long absence can recover their whole contact graph. Retention
// is 3 years (owner decision 2026-07-15), refreshed on every recovery publish.
//
// Self-funded, NOT credit-token authorized: RECOVERY is not a paid message, so it uses no CAC cert and burns no
// nullifier. It is authorized by an OWNER SIGNATURE, and the first publisher binds owner_pubkey. Two attacks the
// monolith's review caught and this must also close:
//   - REPLAY/ROLLBACK: a stale owner-signed publish would roll K_root back to an old value (letting the owner
//     "recover" a key they had rotated away from). Closed by a MONOTONIC seq inside the signed digest: an update
//     must carry seq strictly greater than the stored one (13564-class).
//   - HIJACK: a third party who reads the on-chain self_bucket_key must not be able to overwrite the blob. Closed
//     by requiring owner_pubkey to match the first publisher's on every subsequent write.
//
// CARRY: the blob's storage is self-funded — the owner brings the endowment in msg.value; the shard keeps exactly
// that and returns the change. The blob is stored ON-CHAIN (body cell, not just a hash) so it survives even if
// archive nodes drop old transaction history — that on-chain durability is the whole point of this lane.
//
// EMPTY-ish ACTION: the only outgoing is the change return to the sender (cannot fail). No forward, no code-50
// surface: an overwrite reuses the slot (no growth); a new bind adds one blob, gated in COMPUTE.

const RS_RECOVERY_DOMAIN: Int = 0x42525331;       // "BRS1" — recovery digest preimage, MUST mirror CapsuleHub.tact
const RS_SLOT_DOMAIN: Int = 0x52534C4B;           // "RSLK" — self_bucket_key = H(this ‖ owner_pubkey ‖ slot_index)
const RS_EVICT_DOMAIN: Int = 0x52534556;          // "RSEV" — owner-authenticated slot-clear digest preimage (W1-009)
// [OWNER DECISION 2026-07-19] A slot holds RS_MAX_BLOB_CELLS of blob — about 155 conversations at 64 bytes each.
// The derivation used to be H(domain ‖ owner_pubkey) with NO index, so one owner key named exactly ONE address and
// that ~155 was a HARD CEILING on how many conversations survive a reinstall. It could not be raised later: the
// derivation is the address, and the address is immutable once sealed. Indexing the slot lifts the ceiling to
// RS_MAX_SLOTS x ~155 while keeping the squat-close intact — the address still commits to owner_pubkey, so a
// stranger still cannot name it (see 13575).
//
// THE CAP IS ENFORCED HERE, NOT ONLY IN THE CLIENT, and that is the load-bearing half. A restoring client finds its
// slots by probing [0, RS_MAX_SLOTS) in one batched accountStates read — it has no other way to learn how many exist,
// since nothing on chain enumerates them. A client that wrote to slot 5000 would therefore create a blob NOBODY EVER
// READS AGAIN: the write succeeds, the money is spent, and the loss surfaces years later at the one moment the user
// needs it. Refusing out-of-range here turns that silent loss into a loud refusal at publish time.
// 256 x ~155 = ~40k conversations, and 256 addresses still fit one batched read.
const RS_MAX_SLOTS: Int = 256;
// [OWNER DECISION 2026-07-23] NAMED durable slots for KNOWN-address self-data that is NOT the conversation partition —
// prefs (public-channel subscriptions) first, and future single-blob settings (block lists, notification prefs, contact
// aliases). The [0, RS_MAX_SLOTS) range above is SCANNED, because a restoring client cannot know how many conversations
// exist. A named slot is the OPPOSITE: there is exactly one, at a FIXED index the client derives deterministically and
// reads DIRECTLY — so the scan-reachability the [RANGE] gate protects is satisfied by known-address-reachability instead,
// and the blob is never orphaned. Reserving a small block addressed immediately above the scan range lets ONE durable
// store serve both concerns without a namespace field (index [RS_MAX_SLOTS, RS_MAX_SLOTS + RS_NAMED_SLOTS) = named). The
// slot key derivation is UNCHANGED (still H(domain ‖ owner_pubkey ‖ index)); only the accepted index range widens. 16
// leaves headroom for several future named data types without a re-seal. Anything at/above the top is still refused.
const RS_NAMED_SLOTS: Int = 16;
const RS_RECOVERY_RETENTION: Int = 94608000;      // 3 years (owner 2026-07-15). No longer an eviction deadline
// (eviction is owner-signed now, W1-009) — it is the CLIENT's refresh cadence: every bound slot is refreshed within
// this window so its endowment is topped back up (W1-008) and an idle slot of a live user never freezes.
// The endowment must cover the WHOLE ACCOUNT for the whole retention, not just the payload. Unlike its two siblings
// this lane has no separate base endowment (compare RS_BASE_ENDOWMENT in RecordShard and IS_BASE_ENDOWMENT in
// IntroShard), so this one constant is everything the account ever keeps. If it falls short the slot freezes and the
// recovery blob is lost at exactly the moment it is needed — the failure this whole lane exists to prevent.
//
// [MEASURED 2026-07-19] DERIVED BY MEASUREMENT, NOT BY COUNTING A MODEL, because counting a model is what got the
// two previous values wrong. The first (23_200_000) priced the 79-cell blob alone and omitted the shard's own code
// and state. The second (28_700_000) added those — "79 blob + 17 code + 2 data = 98 cells" — and still came up
// short, because an account is 1 + code + data: the StateInit WRAPPER cell is not in either subtree. Measured at
// three blob sizes, the storage stat is always exactly one more than the model predicts, so the worst case is 99
// cells, not 98. The delivered margin was therefore 1.4875x, not the 1.5027x the arithmetic claimed.
//
// tests/recovery-rent-solvency.test.ts RENT-01 now reads the real figure off the STORAGE PHASE after advancing the
// full retention, so this constant can never again be validated against a cell model that leaves something out:
//   measured 3-year rent at the frozen rate = 19_683_534  ->  x1.5 = 29_525_301  ->  29_600_000 (margin 1.504x)
// [RAISED 2026-07-24, twice, as the W1-009 eviction code grew: 29_000_000 (rent 19_293_761) -> 29_300_000 (owner-sig
// eviction: evictDigest + sig check + refund_to, rent 19_488_648) -> 29_600_000 (re-audit LOW fix: isBasechainAddress
// helper + gate 13566 on refund_to, rent 19_683_534, old margin 1.489x). Re-measured each time off the storage phase.]
// Both sibling lanes were raised pre-seal for this same class of error (RecordShard at 1.026x, IntroShard at
// 1.21x). That margin is the entire defence against a governance rate change on a contract that can never be
// repriced.
// [RAISED 2026-07-29, wave-8: 29.6M -> 30.4M] Second-order consequence of adding RS_EVICT_SEQ_ENDOWMENT below: the
// extra nativeReserve grew this contract's code, so the per-slot rent grew with it and RENT-01 measured the 3-year
// margin at 1.4891x — under the project's 1.5x rule. Restored by measurement, not by rounding the rule down.
const RS_RECOVERY_ENDOWMENT: Int = 30400000;
// [ADDED 2026-07-29, wave-8 LOW] What eviction LEAVES BEHIND so the retained seq keeps existing.
//
// This lane deliberately never destroys its account, because a live seq is the only thing stopping a freed slot from
// being re-bound with the owner's own OUTDATED signed blob — rolling their K_root back to a key they had rotated away
// from. But the payout went out with mode 128, which empties the account to exactly zero, and an emptied account still
// pays rent on 19 code cells plus data. The anti-rollback invariant was therefore not a property of the code at all,
// it was a bet on how long an unfunded account survives before storage debt collects it. MEASURED: 19 cells at the
// frozen 64,962 per cell-year is ~1,234,000 a year, so this funds the high-water mark for roughly forty years — the
// horizon that matters, since a slot outliving its owner's key rotations is exactly the case being defended.
const RS_EVICT_SEQ_ENDOWMENT: Int = 50000000;
// The endowment above is calibrated for EXACTLY the blob cap below, so
// the blob MUST be capped at it. The monolith gated this as RECOVERY_MAX_SIZE_CLASS (13560); the sharded rewrite
// dropped the gate, which let an oversized blob buy permanent storage for a fixed endowment — the slot then goes
// rent-insolvent and the K_root blob is lost on freeze, the exact failure the endowment exists to prevent. Measured
// here from the ACTUAL cell tree rather than a declared size class, so a lying client cannot under-declare.
const RS_MAX_BLOB_CELLS: Int = 79;
const RS_BLOB_PROBE_CELLS: Int = 1024;            // measurement headroom so 13560 fires instead of a raw cell-overflow
const RS_RECOVERY_PATH_GAS: Int = 8000000;        // compute + change-return, with margin (the blob store is the heavy part)
const RS_MIN_VALUE: Int = RS_RECOVERY_ENDOWMENT + RS_RECOVERY_PATH_GAS;

message(0x52435631) RecoveryStore {               // "RCV1"
    owner_pubkey: Int as uint256;                 // bound on the first publish; must match on every later write
    // Which of the owner's slots this is. Checked ONLY against self_bucket_key on the first bind (13575) and ignored
    // on an overwrite, because by then the slot's identity is already fixed and owner_pubkey alone authorises.
    // DELIBERATELY NOT in the signed digest: self_bucket_key already commits to it by construction, and the digest
    // commits to self_bucket_key — so the signature is bound to this exact slot transitively. Adding it again would
    // be redundant. Tampering with it in flight can only make 13575 refuse a first bind (a self-evident, retryable
    // failure), never redirect a write to the wrong slot.
    slot_index: Int as uint32;
    seq: Int as uint64;                           // strictly increasing — the anti-rollback bind
    h0: Int as uint256;
    h1: Int as uint256;
    bh: Int as uint256;
    body: Cell;                                   // the on-chain recovery blob (durability against archive pruning)
    owner_sig: Cell;                              // ed25519 over the recovery digest
}

message(0x52435632) EvictRecovery {               // "RCV2" — OWNER-authenticated slot clear + endowment reclaim (W1-009)
    refund_to: Address;                           // where the reclaimed endowment goes; committed in the digest so a
                                                  // relayer cannot redirect it to themselves
    owner_sig: Cell;                              // ed25519 over evictDigest(refund_to)
}

struct RecoveryShardView {
    self_bucket_key: Int;
    bound: Bool;
    owner_pubkey: Int;
    seq: Int;
    updated_at: Int;
    retention: Int;
    endowment: Int;
    max_slots: Int;        // clients probe [0, this) on restore instead of hardcoding a mirror of RS_MAX_SLOTS
    // The frame hashes were stored but never exposed, so a client could fetch the blob with nothing to check it
    // against — the monolith returned body_hash alongside the body, making the read self-verifying. Restored.
    h0: Int;
    h1: Int;
    bh: Int;
    max_blob_cells: Int;   // clients size the blob against the contract's own cap instead of hardcoding a mirror
}

contract RecoveryShard {
    self_bucket_key: Int as uint256;
    bound: Bool;
    owner_pubkey: Int as uint256;
    seq: Int as uint64;
    h0: Int as uint256;
    h1: Int as uint256;
    bh: Int as uint256;
    body: Cell;
    updated_at: Int as uint64;

    init(self_bucket_key: Int) {
        self.self_bucket_key = self_bucket_key;
        self.bound = false;
        self.owner_pubkey = 0;
        self.seq = 0;
        self.h0 = 0;
        self.h1 = 0;
        self.bh = 0;
        self.body = emptyCell();
        self.updated_at = 0;
    }

    // digest = H(RECOVERY_DOMAIN ‖ self_bucket_key ‖ seq ‖ h0 ‖ h1 ‖ bh). Binds the signature to THIS slot, THIS
    // seq, and THIS frame — so a signed publish cannot be replayed into a different slot, reordered, or downgraded.
    // [SQUAT-CLOSE] The slot's identity IS the owner key. self_bucket_key = H(RS_SLOT_DOMAIN ‖ owner_pubkey ‖
    // slot_index), so only the holder of the seed that derives owner_pubkey can name (hence bind) any of these
    // addresses. Indexing does not weaken that: every index still hashes the owner key, so all RS_MAX_SLOTS
    // addresses of a user are equally unnameable by anyone else.
    fun slotKeyForOwner(ownerPubkey: Int, slotIndex: Int): Int {
        return beginCell()
            .storeUint(RS_SLOT_DOMAIN, 32)
            .storeUint(ownerPubkey, 256)
            .storeUint(slotIndex, 32)
            .endCell()
            .hash();
    }

    fun recoveryDigest(seq: Int, h0: Int, h1: Int, bh: Int): Int {
        return beginCell()
            .storeUint(RS_RECOVERY_DOMAIN, 32)
            .storeAddress(myAddress())   // binds the signature to THIS deployment; a signed publish cannot be
                                         // replayed into the same slot of a future code generation
            .storeUint(self.self_bucket_key, 256)
            .storeUint(seq, 64)
            .storeRef(beginCell().storeUint(h0, 256).storeUint(h1, 256).storeUint(bh, 256).endCell())
            .endCell()
            .hash();
    }

    // digest = H(EVICT_DOMAIN ‖ myAddress ‖ self_bucket_key ‖ seq ‖ refund_to). Binds an eviction to THIS deployment,
    // THIS slot, the CURRENT seq (so a stale eviction cannot be replayed after the slot is re-bound with a higher
    // seq), and the payout address (so a relayer forwarding the owner's signed eviction cannot redirect the reclaimed
    // endowment to itself).
    fun evictDigest(refundTo: Address): Int {
        return beginCell()
            .storeUint(RS_EVICT_DOMAIN, 32)
            .storeAddress(myAddress())
            .storeUint(self.self_bucket_key, 256)
            .storeUint(self.seq, 64)
            .storeAddress(refundTo)
            .endCell()
            .hash();
    }

    // Byte-for-byte the std-address basechain check the sister contracts use (AirdropPool.tact:201).
    fun isBasechainAddress(a: Address): Bool {
        let s: Slice = a.asSlice();
        return s.loadUint(11) == 1024;
    }

    receive(msg: RecoveryStore) {
        throwUnless(13571, (msg.h0 != 0) && (msg.h1 != 0) && (msg.bh != 0));
        // [RESTORED 13557] Bind the stored blob to the SIGNED frame. The signature covers bh, but the body itself
        // was taken verbatim, so a relay could ship the owner's signature with a DIFFERENT body and destroy the
        // K_root blob — which lives on chain here, with no second copy. The monolith gated exactly this.
        throwUnless(13557, msg.body.hash() == msg.bh);
        // CARRY self-funding, gated in COMPUTE so the change-return below cannot fail in ACTION.
        throwUnless(13572, context().value >= RS_MIN_VALUE);
        // [RESTORED 13560] The blob is stored ON CHAIN for 3 years against a FIXED endowment, so its size must be
        // capped or the slot goes rent-insolvent and the K_root blob is lost exactly when it is needed. Measured from
        // the REAL cell tree, so a client cannot under-declare its size.
        //
        // The probe limit is deliberately well ABOVE the cap: computeDataSize itself throws (exit 8, cell overflow)
        // the moment the tree exceeds the limit it is given, so probing AT the cap would make the explicit check
        // below dead code and report an opaque "cell overflow" instead of a semantic refusal. Probing with headroom
        // means an over-cap blob is refused as 13560 and a client can tell WHY. An absurdly large tree still exceeds
        // the probe and bounces on exit 8 — also refused, just without the friendly code.
        let blob: DataSize = msg.body.computeDataSize(RS_BLOB_PROBE_CELLS);
        throwUnless(13560, blob.cells <= RS_MAX_BLOB_CELLS);

        if (!self.bound) {
            // First publish binds the owner, and must STILL beat the high-water seq. On a fresh slot self.seq is 0,
            // so this reduces to seq >= 1. After an eviction it is the retained high-water mark, which is the whole
            // point: without this the anti-rollback check lived only in the overwrite branch below, so a freed slot
            // could be re-bound with the owner's own OUTDATED signed blob — rolling their K_root back to a key they
            // had rotated away from. Keeping seq across eviction is useless unless the first bind honours it too.
            throwUnless(13573, msg.seq > self.seq);
            // [SQUAT-CLOSE] the first binding is SELF-AUTHENTICATING: this slot's address commits to owner_pubkey, so
            // a squatter re-binding an evicted (or fresh) slot would need a hash preimage of the victim's
            // self_bucket_key — infeasible. Anti-hijack no longer rests on "first writer wins": ONLY the owner key
            // that names the slot can bind it, even after a 3-year eviction frees it.
            // [RANGE] Refuse a slot NO client would ever read back. Two ranges are reachable and everything else is
            // orphan-territory: [0, RS_MAX_SLOTS) is found by the restore SCAN, and [RS_MAX_SLOTS, RS_MAX_SLOTS +
            // RS_NAMED_SLOTS) are NAMED slots the client reads by their fixed deterministic address (see RS_NAMED_SLOTS).
            // Both are reachable; a slot at/above the top is not — nothing on chain enumerates a user's slots, so an
            // out-of-range bind writes a blob that is never read again (money spent, write reported successful, loss
            // found years later). Checked ONLY on the bind, where slot_index decides the identity; on an overwrite the
            // identity is already fixed and a stale index must not block the anti-rollback update path.
            throwUnless(13576, (msg.slot_index >= 0) && (msg.slot_index < RS_MAX_SLOTS + RS_NAMED_SLOTS));
            throwUnless(13575, self.self_bucket_key == self.slotKeyForOwner(msg.owner_pubkey, msg.slot_index));
            self.bound = true;
            self.owner_pubkey = msg.owner_pubkey;
        } else {
            // Only the bound owner may update, and only forward: strictly-increasing seq blocks a stale rollback.
            throwUnless(13563, msg.owner_pubkey == self.owner_pubkey);
            throwUnless(13564, msg.seq > self.seq);
        }
        throwUnless(13574, checkSignature(self.recoveryDigest(msg.seq, msg.h0, msg.h1, msg.bh), msg.owner_sig.beginParse(), self.owner_pubkey));

        self.seq = msg.seq;
        self.h0 = msg.h0;
        self.h1 = msg.h1;
        self.bh = msg.bh;
        self.body = msg.body;
        self.updated_at = now();

        // [W1-008 FIX 2026-07-24] Keep the FULL endowment on EVERY write, not only the first. Gate 13572 already
        // requires every RecoveryStore to bring >= RS_MIN_VALUE (endowment + path gas), so a refresh tops the slot
        // back up to RS_RECOVERY_ENDOWMENT and the overpayment (the rent NOT yet consumed) returns to the owner.
        //
        // The OLD code reserved `wasUnbound ? ENDOWMENT : 0` with AddOriginalBalance — free refreshes that kept only
        // the already-drained balance. Measured (tests/recovery-rent-solvency.test.ts RENT-03): the endowment funds
        // ~4.5 years from the first bind, but each refresh only RESET updated_at, so a user who refreshed every year
        // renewed the retention PROMISE indefinitely while the FUNDING never renewed — freezing in year 5 and losing
        // the K_root blob the lane exists to protect. Topping up on every write is what lets the client's periodic
        // refresh of ALL bound slots (W1-009) actually keep an idle slot alive instead of just resetting a timer.
        //
        // The old comment cited CapsuleHub.tact:1722 against an "absolute reserve". That hazard does NOT apply here:
        // CapsuleHub was a MULTI-endowment pool whose whole accumulated balance would leak to the caller under an
        // absolute reserve. A RecoveryShard holds ONE slot's endowment, and every write is owner-signature-gated
        // (13563/13574), so ReserveAtMost(ENDOWMENT) simply returns the owner's own overpayment to the owner.
        nativeReserve(RS_RECOVERY_ENDOWMENT, ReserveAtMost);
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    // OWNER-AUTHENTICATED slot clear + endowment reclaim. [W1-009 FIX 2026-07-24, owner-approved.]
    //
    // WHAT THIS USED TO BE, AND WHY IT WAS UNSAFE. It was PERMISSIONLESS: any sender could clear a bound slot once it
    // was 3 years past its last write (gate 13562) and sweep the WHOLE residual to itself (mode 128). The retention
    // clock is PER-SLOT, and the client only refreshed a slot when its OWN partition changed — never the idle ones.
    // So a demonstrably-alive user who filled slot 0, then wrote only slot 1 for three years, left slot 0 evictable,
    // and clearing it was PROFITABLE — a stranger could destroy the oldest K_root blob and pocket the endowment. The
    // "client refreshes every bound slot" mitigation this used to promise was never in the client (W1-009).
    //
    // NOW ONLY THE OWNER MAY CLEAR IT, proven by a signature over evictDigest(refund_to) against the bound
    // owner_pubkey. A stranger has neither the key nor a reason: the address commits to owner_pubkey, so no one else
    // can ever reuse a freed slot. The 3-year timer is GONE — it only ever existed to time-limit stranger eviction;
    // the owner reclaims their OWN slot on demand (reclaiming the endowment they would otherwise bleed to rent). The
    // payout goes to the signed refund_to, NOT sender(), so a relayer forwarding the owner's eviction cannot steal it.
    //
    // THIS LANE STILL DELIBERATELY DOES NOT DESTROY ITS ACCOUNT (unlike RecordShard/IntroShard RetireShard): `seq` is
    // retained as the anti-rollback high-water mark. A fresh seq of 0 would make every previously signed RecoveryStore
    // valid again, letting the freed slot be re-bound with the owner's own OUTDATED blob and rolling their K_root back
    // to a key they had rotated away from. The first-bind branch honours the retained seq (13573) for the same reason.
    receive(msg: EvictRecovery) {
        throwUnless(13561, self.bound);
        // [FIX 2026-07-24, re-audit LOW] refund_to MUST be basechain. The reclaim below is mode 128 | SendIgnoreErrors,
        // so a refund_to on a foreign workchain (or otherwise undeliverable in a way the emulator accepts) would have
        // its send SILENTLY dropped AFTER the state is cleared — and 13561 then blocks any re-eviction, stranding the
        // whole endowment forever. Refusing a non-basechain refund_to here, in COMPUTE before any state change, turns
        // that permanent silent loss into a retryable refusal (the owner re-signs to a basechain address). refund_to is
        // committed in the signed digest, so this cannot be weaponised by a relayer. (A uninit BASECHAIN address is
        // safe: mode 128 simply deploys/tops it up — that is a legitimate owner choice, so only foreign chains are refused.)
        throwUnless(13566, self.isBasechainAddress(msg.refund_to));
        throwUnless(13565, checkSignature(self.evictDigest(msg.refund_to), msg.owner_sig.beginParse(), self.owner_pubkey));
        self.bound = false;
        self.owner_pubkey = 0;
        // seq is deliberately NOT reset — anti-rollback high-water mark (see the note above).
        self.h0 = 0;
        self.h1 = 0;
        self.bh = 0;
        self.body = emptyCell();
        self.updated_at = 0;
        // Keep the seq alive. Reserved BEFORE the payout, so the residual the owner reclaims is what remains above
        // the endowment rather than the whole balance; ReserveAtMost keeps this from failing if the balance is already
        // below it. Without it, mode 128 left exactly zero behind and the invariant above was unfunded.
        nativeReserve(RS_EVICT_SEQ_ENDOWMENT, ReserveAtMost);
        send(SendParameters{ to: msg.refund_to, value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    receive() {}

    get fun get_view(): RecoveryShardView {
        return RecoveryShardView{
            self_bucket_key: self.self_bucket_key,
            bound: self.bound,
            owner_pubkey: self.owner_pubkey,
            seq: self.seq,
            updated_at: self.updated_at,
            retention: RS_RECOVERY_RETENTION,
            endowment: RS_RECOVERY_ENDOWMENT,
            max_slots: RS_MAX_SLOTS,
            h0: self.h0,
            h1: self.h1,
            bh: self.bh,
            max_blob_cells: RS_MAX_BLOB_CELLS,
        };
    }

    get fun get_body(): Cell {
        return self.body;
    }
}
