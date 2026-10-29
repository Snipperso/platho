
const RS_RECOVERY_DOMAIN: Int = 0x42525331;
const RS_SLOT_DOMAIN: Int = 0x52534C4B;
const RS_EVICT_DOMAIN: Int = 0x52534556;
const RS_MAX_SLOTS: Int = 256;
const RS_NAMED_SLOTS: Int = 16;
const RS_RECOVERY_RETENTION: Int = 94608000;
const RS_RECOVERY_ENDOWMENT: Int = 30400000;
const RS_EVICT_SEQ_ENDOWMENT: Int = 50000000;
const RS_MAX_BLOB_CELLS: Int = 79;
const RS_BLOB_PROBE_CELLS: Int = 1024;
const RS_RECOVERY_PATH_GAS: Int = 8000000;
const RS_MIN_VALUE: Int = RS_RECOVERY_ENDOWMENT + RS_RECOVERY_PATH_GAS;

message(0x52435631) RecoveryStore {
    owner_pubkey: Int as uint256;
    slot_index: Int as uint32;
    seq: Int as uint64;
    h0: Int as uint256;
    h1: Int as uint256;
    bh: Int as uint256;
    body: Cell;
    owner_sig: Cell;
}

message(0x52435632) EvictRecovery {
    refund_to: Address;
    owner_sig: Cell;
}

struct RecoveryShardView {
    self_bucket_key: Int;
    bound: Bool;
    owner_pubkey: Int;
    seq: Int;
    updated_at: Int;
    retention: Int;
    endowment: Int;
    max_slots: Int;
    h0: Int;
    h1: Int;
    bh: Int;
    max_blob_cells: Int;
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
            .storeAddress(myAddress())
            .storeUint(self.self_bucket_key, 256)
            .storeUint(seq, 64)
            .storeRef(beginCell().storeUint(h0, 256).storeUint(h1, 256).storeUint(bh, 256).endCell())
            .endCell()
            .hash();
    }

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

    fun isBasechainAddress(a: Address): Bool {
        let s: Slice = a.asSlice();
        return s.loadUint(11) == 1024;
    }

    receive(msg: RecoveryStore) {
        throwUnless(13571, (msg.h0 != 0) && (msg.h1 != 0) && (msg.bh != 0));
        throwUnless(13557, msg.body.hash() == msg.bh);
        throwUnless(13572, context().value >= RS_MIN_VALUE);
        let blob: DataSize = msg.body.computeDataSize(RS_BLOB_PROBE_CELLS);
        throwUnless(13560, blob.cells <= RS_MAX_BLOB_CELLS);

        if (!self.bound) {
            throwUnless(13573, msg.seq > self.seq);
            throwUnless(13576, (msg.slot_index >= 0) && (msg.slot_index < RS_MAX_SLOTS + RS_NAMED_SLOTS));
            throwUnless(13575, self.self_bucket_key == self.slotKeyForOwner(msg.owner_pubkey, msg.slot_index));
            self.bound = true;
            self.owner_pubkey = msg.owner_pubkey;
        } else {
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

        nativeReserve(RS_RECOVERY_ENDOWMENT, ReserveAtMost);
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    receive(msg: EvictRecovery) {
        throwUnless(13561, self.bound);
        throwUnless(13566, self.isBasechainAddress(msg.refund_to));
        throwUnless(13565, checkSignature(self.evictDigest(msg.refund_to), msg.owner_sig.beginParse(), self.owner_pubkey));
        self.bound = false;
        self.owner_pubkey = 0;
        self.h0 = 0;
        self.h1 = 0;
        self.bh = 0;
        self.body = emptyCell();
        self.updated_at = 0;
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
