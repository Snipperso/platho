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
const RS_RECOVERY_RETENTION: Int = 94608000;      // 3 years (owner 2026-07-15); permissionless evict after updated_at + this
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
//   measured 3-year rent at the frozen rate = 19_293_761  ->  x1.5 = 28_940_642  ->  29_000_000 (margin 1.503x)
// Both sibling lanes were raised pre-seal for this same class of error (RecordShard at 1.026x, IntroShard at
// 1.21x). That margin is the entire defence against a governance rate change on a contract that can never be
// repriced.
const RS_RECOVERY_ENDOWMENT: Int = 29000000;
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

message(0x52435632) EvictRecovery {}              // "RCV2" — permissionless self-heal after 3 years of inactivity

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
    // (and the endowment reclaimed by the caller).
    //
    // THE RETENTION CLOCK IS PER-SLOT, AND THAT IS A CLIENT OBLIGATION, NOT A CONTRACT GUARANTEE. This comment used
    // to read "a user active within 3 years never hits this — griefing is impossible while the user lives", and that
    // was true only while one owner key named one address. Across RS_MAX_SLOTS it is FALSE: updated_at lives on each
    // account separately, so a user who fills slot 0, then spends three years writing only slot 1, leaves slot 0
    // untouched and evictable — and sweeping it is PROFITABLE, so it will not stay hypothetical. The user is
    // demonstrably alive and still loses their oldest conversations.
    //
    // Nothing here can fix that: these are independent accounts and coupling them would cost a read per slot per
    // write. The client MUST refresh every bound slot inside the retention window, not merely the slot it is
    // writing. A refresh is an ordinary RecoveryStore with a higher seq; it costs gas plus the RS_MIN_VALUE float,
    // which is returned.
    //
    // The 3-year clock also RESETS on every publish while the reserve increment is zero on an overwrite (see the
    // nativeReserve note below), so a refresh moves the deadline without moving money. Funding therefore lasts a
    // fixed ~4.4 years from the first bind however often the slot is refreshed. That is deliberate — an absolute
    // reserve would hand any top-up to whoever writes next — but it means a long-lived slot eventually carries a
    // retention promise it cannot fund. Freeze is still roughly two decades of continuous use away at the frozen
    // rate, so this is a known and accepted horizon rather than an imminent loss.
    //
    // THIS LANE DELIBERATELY DOES NOT DESTROY ITS ACCOUNT, unlike RecordShard.RetireShard and
    // IntroShard.RetireShard, which do. The asymmetry is load-bearing and a future reader must not "tidy" it:
    // destroying an account resets its state to init, and `seq` below is retained precisely so that it CANNOT be
    // reset — it is the anti-rollback high-water mark, and a fresh seq of 0 would make every previously signed
    // RecoveryStore valid again, letting anyone re-bind the freed slot with the owner's own OUTDATED blob and
    // roll their K_root back to a key they had rotated away from.
    // The other two lanes are safe to destroy because their identity carries no such monotonic guard: a
    // resurrected RecordShard/IntroShard is refused by the epoch gate, so nothing can be written into it at all.
    // This one also needs no destroy to be economical — clearing the slot is already O(1) and the caller already
    // takes the whole residual through mode 128, which is exactly the shape the other two lanes had to be
    // rebuilt to reach. It never carried a per-entry bounty, so it never had the defect that removed them.
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
