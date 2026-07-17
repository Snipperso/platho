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
const RS_RECOVERY_RETENTION: Int = 94608000;      // 3 years (owner 2026-07-15); permissionless evict after updated_at + this
const RS_RECOVERY_ENDOWMENT: Int = 23200000;      // 79 cells (8K cap) x 64962 x 3yr x 1.5 — mirrors the monolith's measured value
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
    fun recoveryDigest(seq: Int, h0: Int, h1: Int, bh: Int): Int {
        return beginCell()
            .storeUint(RS_RECOVERY_DOMAIN, 32)
            .storeUint(self.self_bucket_key, 256)
            .storeUint(seq, 64)
            .storeRef(beginCell().storeUint(h0, 256).storeUint(h1, 256).storeUint(bh, 256).endCell())
            .endCell()
            .hash();
    }

    receive(msg: RecoveryStore) {
        throwUnless(13571, (msg.h0 != 0) && (msg.h1 != 0) && (msg.bh != 0));
        // CARRY self-funding, gated in COMPUTE so the change-return below cannot fail in ACTION.
        throwUnless(13572, context().value >= RS_MIN_VALUE);

        if (!self.bound) {
            // First publish binds the owner. seq must be positive so a later rollback has no seq=0 floor to abuse.
            throwUnless(13573, msg.seq >= 1);
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

        // Keep exactly the endowment; return the owner's change. One outgoing to the sender — cannot fail in ACTION.
        nativeReserve(RS_RECOVERY_ENDOWMENT, ReserveAtMost);
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
        self.seq = 0;
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
        };
    }

    get fun get_body(): Cell {
        return self.body;
    }
}
