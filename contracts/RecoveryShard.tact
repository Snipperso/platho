// RecoveryShard — clean-17 sharded anon-publish, RECOVERY lane. Durability of the K_root self-recovery blob.
//
// One partition per user's self-recovery key (self_bucket_key, epoch-INDEPENDENT — §12 self-lane), deployed lazily
// at address = f(StateInit{self_bucket_key}). Unlike the CONV RecordShard, it does NOT die daily: the recovery
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
const RS_SLOT_DOMAIN: Int = 0x52534C4B;           // "RSLK" — the slot IS the owner key: self_bucket_key = H(this ‖ owner_pubkey)
const RS_RECOVERY_RETENTION: Int = 94608000;      // 3 years (owner 2026-07-15); permissionless evict after updated_at + this
const RS_RECOVERY_ENDOWMENT: Int = 23200000;      // 79 cells (8K cap) x 64962 x 3yr x 1.5 — mirrors the monolith's measured value
// The endowment above is calibrated for EXACTLY this many cells (79 x 64962 x 3 x 1.5 = 23_093_991 ~ 23_200_000), so
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
    seq: Int as uint64;                           // strictly increasing — the anti-rollback bind
    h0: Int as uint256;
    h1: Int as uint256;
    bh: Int as uint256;
    body: Cell;                                   // the on-chain recovery blob (durability against archive pruning)
    owner_sig: Cell;                              // ed25519 over the recovery digest
}

message(0x52435632) EvictRecovery {}              // "RCV2" — permissionless self-heal after 3 years of inactivity

struct RecoveryShardView {
    self_bucket_key: Int;
    bound: Bool;
    owner_pubkey: Int;
    seq: Int;
    updated_at: Int;
    retention: Int;
    endowment: Int;
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
    // [SQUAT-CLOSE] The slot's identity IS the owner key. self_bucket_key = H(RS_SLOT_DOMAIN ‖ owner_pubkey), so
    // only the holder of the seed that derives owner_pubkey can name (hence bind) this address.
    fun slotKeyForOwner(ownerPubkey: Int): Int {
        return beginCell().storeUint(RS_SLOT_DOMAIN, 32).storeUint(ownerPubkey, 256).endCell().hash();
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

        let wasUnbound: Bool = !self.bound;
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
            throwUnless(13575, self.self_bucket_key == self.slotKeyForOwner(msg.owner_pubkey));
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

        // Reserve the INCREMENT over the balance already held: the endowment only on the FIRST bind (the slot is
        // funded once), zero on an overwrite. An absolute reserve would hand any top-up to whoever writes next —
        // the monolith flags that exact mistake at CapsuleHub.tact:1722.
        nativeReserve(
            wasUnbound ? RS_RECOVERY_ENDOWMENT : 0,
            ReserveAtMost | ReserveAddOriginalBalance,
        );
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    // Permissionless self-heal: after 3 years with no refresh, the slot may be cleared so the address is reusable
    // (and the endowment reclaimed by the caller). A user active within 3 years never hits this — every recovery
    // publish resets updated_at, so griefing is impossible while the user lives.
    receive(_: EvictRecovery) {
        throwUnless(13561, self.bound);
        throwUnless(13562, (self.updated_at + RS_RECOVERY_RETENTION) < now());
        self.bound = false;
        self.owner_pubkey = 0;
        // seq is deliberately NOT reset — it is the anti-rollback high-water mark. Clearing it made every
        // previously signed RecoveryStore valid again, so anyone could re-bind the freed slot with the owner's own
        // OUTDATED blob and roll their K_root back to a key they had rotated away from. Eight bytes of retained
        // state is a trivial price for closing that.
        self.h0 = 0;
        self.h1 = 0;
        self.bh = 0;
        self.body = emptyCell();
        self.updated_at = 0;
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
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
