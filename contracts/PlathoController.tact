// PlathoController — clean-16 L4/#9. The migration trust-root: a 3-of-5 ed25519 multisig with a ~14-day timelock,
// the sole caller of the Vault's AnnounceSuccessorManifest. Its ONLY power is to ANNOUNCE a successor deployment
// (a non-coercive DATA hint — clients verify out-of-band and never auto-migrate). It cannot drain/freeze/censor.
//
// ed25519 (NOT PQ): on-chain PQ signature verification is infeasible on TON (Dilithium exceeds gas, Falcon needs
// floats, SPHINCS+ too large). The controller acts PRE-QUANTUM — the migration to a PQ successor is executed before
// the ed25519 quantum horizon (owner decision 2026-07-15: #6 = ed25519 + migration plan).
//
// Self-rotating: the 3-of-5 set can replace one of its own signers, so the trust-root survives the loss/turnover of
// individual key-holders (including the owner) across a century. Timelock: a proposed action takes effect only after
// ~14 days, giving the community time to detect and (via the multisig) CANCEL a malicious/mistaken proposal.

const CONTROLLER_THRESHOLD: Int = 3;
const CONTROLLER_SIGNER_COUNT: Int = 5;
// [OWNER 2026-07-18: одной недели достаточно] The timelock is NOT a way for honest signers to stop a compromised
// majority — ControllerProposeCancel requires the SAME 3-of-5, so if three keys are held by an attacker the honest
// two can never reach the threshold to cancel. What the delay actually buys is OBSERVATION: a pending action is
// public for this long, giving the owner and users time to react out of band (drain custody, warn, refuse to follow
// the announced successor). One week is the owner's judgement of how long that reaction needs.
const CONTROLLER_TIMELOCK_SECONDS: Int = 604800; // 7 days
const CONTROLLER_SIGN_DOMAIN: Int = 0x504C4331; // "PLC1"

// Action kinds (part of the signed digest so a signature for one action can't be replayed as another).
const CTRL_ACT_ANNOUNCE_SUCCESSOR: Int = 1;
const CTRL_ACT_ROTATE_SIGNER: Int = 2;
const CTRL_ACT_CANCEL: Int = 3;

// Mirror of the Vault's AnnounceSuccessorManifest (op must match Vault.tact).
message(0x5355434D) AnnounceSuccessorManifest {
    successor_manifest_hash: Int as uint256;
    successor_vault: Address;
}

// One external carries the action + M..N (slot, signature) approvals. Signatures MUST be in STRICTLY INCREASING
// slot order (dedupes signers and makes the threshold count a simple length). `approvals` is a snake of cells, each
// holding one {slot:uint8, sig:bits512}; the last cell has no ref.
message(0xC0DE0001) ControllerProposeSuccessor {
    nonce: Int as uint64;
    target_vault: Address;      // the CURRENT Vault to announce to (authorizes only its own controller by hash)
    successor_manifest_hash: Int as uint256;
    successor_vault: Address;   // the NEXT deployment's Vault (the successor pointer)
    approvals: Cell;
}

message(0xC0DE0002) ControllerProposeRotate {
    nonce: Int as uint64;
    slot: Int as uint8;         // which signer slot to replace (0..N-1)
    new_pubkey: Int as uint256; // its new ed25519 pubkey
    approvals: Cell;
}

message(0xC0DE0003) ControllerProposeCancel {
    nonce: Int as uint64;
    approvals: Cell;
}

// After the timelock elapses, ANYONE may execute the single pending action (the M-of-N was already provided at
// propose time; a permissionless executor just triggers the effect once the delay has passed).
message(0xC0DE0004) ControllerExecute {}

struct ControllerStateView {
    threshold: Int;
    signer_count: Int;
    nonce: Int;
    timelock_seconds: Int;
    has_pending: Bool;
    pending_kind: Int;
    pending_effective_at: Int;
    pending_manifest_hash: Int;
    pending_target_vault: Address;
    pending_successor_vault: Address;
    pending_rotate_slot: Int;
    pending_rotate_pubkey: Int;
}

contract PlathoController {
    // NOTE: intentionally NO vault_address field — the target Vault is part of each SIGNED proposal. This breaks the
    // genesis address cycle (Vault.genesis_config_hash = hash(controller addr), so the controller's address must NOT
    // depend on the Vault's). A Vault only accepts an announce from the controller whose hash it was sealed with, so
    // letting the controller name the target is safe.
    signers: map<Int, Int>; // slot 0..N-1 -> ed25519 pubkey
    nonce: Int as uint64;
    has_pending: Bool;
    pending_kind: Int as uint8;
    pending_effective_at: Int as uint64; // clean-16 L7/#17: uint64 so `now()+timelock` never overflows past ~2106 (Y2106)
    // pending action params (union by kind)
    pending_manifest_hash: Int as uint256;
    pending_target_vault: Address;
    pending_successor_vault: Address;
    pending_rotate_slot: Int as uint8;
    pending_rotate_pubkey: Int as uint256;

    init(pk0: Int, pk1: Int, pk2: Int, pk3: Int, pk4: Int) {
        self.signers = emptyMap();
        self.signers.set(0, pk0);
        self.signers.set(1, pk1);
        self.signers.set(2, pk2);
        self.signers.set(3, pk3);
        self.signers.set(4, pk4);
        self.nonce = 0;
        self.has_pending = false;
        self.pending_kind = 0;
        self.pending_effective_at = 0;
        self.pending_manifest_hash = 0;
        self.pending_target_vault = myAddress();
        self.pending_successor_vault = myAddress();
        self.pending_rotate_slot = 0;
        self.pending_rotate_pubkey = 0;
    }

    // Verify >= CONTROLLER_THRESHOLD distinct valid signatures over `digest`, provided in strictly increasing slot
    // order. Throws (25010/25011/25012) on a bad/duplicate/insufficient set; returns nothing on success.
    fun requireThreshold(digest: Int, approvals: Cell) {
        let cur: Cell = approvals;
        let count: Int = 0;
        let prevSlot: Int = -1;
        let more: Bool = true;
        let i: Int = 0;
        while (more && (i < CONTROLLER_SIGNER_COUNT)) {
            let s: Slice = cur.beginParse();
            let slot: Int = s.loadUint(8);
            let sig: Slice = s.loadBits(512);
            throwUnless(25010, slot > prevSlot);              // strictly increasing → distinct signers
            throwUnless(25011, slot < CONTROLLER_SIGNER_COUNT);
            let pkOpt: Int? = self.signers.get(slot);
            throwUnless(25012, pkOpt != null);
            throwUnless(25013, checkSignature(digest, sig, pkOpt!!));
            count += 1;
            prevSlot = slot;
            if (s.refs() == 1) { cur = s.loadRef(); } else { more = false; }
            i += 1;
        }
        throwUnless(25014, count >= CONTROLLER_THRESHOLD);
    }

    fun actionDigest(kind: Int, paramHash: Int): Int {
        return beginCell()
            .storeUint(CONTROLLER_SIGN_DOMAIN, 32)
            .storeSlice(myAddress().asSlice())
            .storeUint(self.nonce, 64)
            .storeUint(kind, 8)
            .storeUint(paramHash, 256)
            .endCell()
            .hash();
    }

    fun setPendingCommon(kind: Int) {
        throwUnless(25020, !self.has_pending); // one pending action at a time; CANCEL or EXECUTE clears it first
        self.has_pending = true;
        self.pending_kind = kind;
        self.pending_effective_at = now() + CONTROLLER_TIMELOCK_SECONDS;
        self.nonce += 1; // consume the nonce → the just-used signatures can never be replayed
    }

    receive(msg: ControllerProposeSuccessor) {
        let paramHash: Int = beginCell()
            .storeSlice(msg.target_vault.asSlice())
            .storeUint(msg.successor_manifest_hash, 256)
            .storeSlice(msg.successor_vault.asSlice())
            .endCell().hash();
        throwUnless(25001, msg.nonce == self.nonce);
        self.requireThreshold(self.actionDigest(CTRL_ACT_ANNOUNCE_SUCCESSOR, paramHash), msg.approvals);
        self.setPendingCommon(CTRL_ACT_ANNOUNCE_SUCCESSOR);
        self.pending_manifest_hash = msg.successor_manifest_hash;
        self.pending_target_vault = msg.target_vault;
        self.pending_successor_vault = msg.successor_vault;
    }

    receive(msg: ControllerProposeRotate) {
        throwUnless(25002, msg.slot < CONTROLLER_SIGNER_COUNT);
        throwUnless(25003, msg.new_pubkey != 0);
        let paramHash: Int = beginCell()
            .storeUint(msg.slot, 8)
            .storeUint(msg.new_pubkey, 256)
            .endCell().hash();
        throwUnless(25004, msg.nonce == self.nonce);
        self.requireThreshold(self.actionDigest(CTRL_ACT_ROTATE_SIGNER, paramHash), msg.approvals);
        self.setPendingCommon(CTRL_ACT_ROTATE_SIGNER);
        self.pending_rotate_slot = msg.slot;
        self.pending_rotate_pubkey = msg.new_pubkey;
    }

    // CANCEL is itself an M-of-N action, but it needs NO timelock (aborting a bad pending proposal must be fast).
    receive(msg: ControllerProposeCancel) {
        throwUnless(25005, self.has_pending);
        throwUnless(25006, msg.nonce == self.nonce);
        self.requireThreshold(self.actionDigest(CTRL_ACT_CANCEL, 0), msg.approvals);
        self.has_pending = false;
        self.pending_kind = 0;
        self.nonce += 1;
    }

    receive(msg: ControllerExecute) {
        throwUnless(25030, self.has_pending);
        throwUnless(25031, now() >= self.pending_effective_at); // timelock must have elapsed
        if (self.pending_kind == CTRL_ACT_ANNOUNCE_SUCCESSOR) {
            message(MessageParameters {
                to: self.pending_target_vault,
                value: 0,
                bounce: true,
                mode: SendRemainingValue,
                body: AnnounceSuccessorManifest {
                    successor_manifest_hash: self.pending_manifest_hash,
                    successor_vault: self.pending_successor_vault
                }.toCell()
            });
        } else if (self.pending_kind == CTRL_ACT_ROTATE_SIGNER) {
            self.signers.set(self.pending_rotate_slot, self.pending_rotate_pubkey);
        }
        self.has_pending = false;
        self.pending_kind = 0;
    }

    receive() {
        // Accept bare TON (storage top-up) and ignore. No authority granted.
    }

    get fun get_controller_state(): ControllerStateView {
        return ControllerStateView {
            threshold: CONTROLLER_THRESHOLD,
            signer_count: CONTROLLER_SIGNER_COUNT,
            nonce: self.nonce,
            timelock_seconds: CONTROLLER_TIMELOCK_SECONDS,
            has_pending: self.has_pending,
            pending_kind: self.pending_kind,
            pending_effective_at: self.pending_effective_at,
            pending_manifest_hash: self.pending_manifest_hash,
            pending_target_vault: self.pending_target_vault,
            pending_successor_vault: self.pending_successor_vault,
            pending_rotate_slot: self.pending_rotate_slot,
            pending_rotate_pubkey: self.pending_rotate_pubkey
        };
    }

    get fun get_signer(slot: Int): Int {
        let pkOpt: Int? = self.signers.get(slot);
        if (pkOpt == null) { return 0; }
        return pkOpt!!;
    }
}
