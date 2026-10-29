
import "./vault-wire.tact";

const RS_SAFE_CAP: Int = 4096;
const RS_RETENTION: Int = 31536000;

const RS_PAGE_CAP: Int = 256;
const RS_ROWS_PER_CELL: Int = 3;

const RS_FRAME_DOMAIN: Int = 0x52534643;
const RS_WRITE_DOMAIN: Int = 0x52535744;

const RS_RECORD_ENDOWMENT: Int = 300000;
const RS_BASE_ENDOWMENT: Int = 3500000;
const RS_PUBLISH_GAS: Int = 2500000;
const RS_RETIRE_GAS: Int = 505000;

const RS_PROTOCOL_FEE: Int = 10000000;



const RS_MIN_VALUE: Int = RS_RECORD_ENDOWMENT + RS_PUBLISH_GAS;
const RS_DEPLOY_MIN_VALUE: Int = RS_MIN_VALUE + RS_BASE_ENDOWMENT;

message(0x52535031) CapsulePublish {
    seq: Int as uint64;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
    sig: Cell;
}

message(0x52535033) RetireShard {}



struct RecordEntry {
    frame_commit: Int;
    created_at: Int;
}

struct CapsuleRecordView {
    exists: Bool;
    frame_commit: Int;
    created_at: Int;
}

struct RecordPage {
    from_id: Int;
    count: Int;
    record_count: Int;
    rows: Cell;
}

struct RecordShardView {
    write_pubkey: Int;
    epoch: Int;
    last_seq: Int;
    record_count: Int;
    safe_cap: Int;
    retention: Int;
    min_value: Int;
    deploy_min_value: Int;
    protocol_fee: Int;
    retire_at: Int;
}

contract RecordShard {
    write_pubkey: Int as uint256;
    epoch: Int as uint32;
    last_seq: Int as uint64;
    records: map<Int, RecordEntry>;
    record_count: Int as uint32;

    init(write_pubkey: Int, epoch: Int) {
        self.write_pubkey = write_pubkey;
        self.epoch = epoch;
        self.last_seq = 0;
        self.records = emptyMap();
        self.record_count = 0;
    }

    fun frameCommit(h0: Cell, h1: Cell, body: Cell): Int {
        return beginCell()
            .storeUint(RS_FRAME_DOMAIN, 32)
            .storeUint(h0.hash(), 256)
            .storeUint(h1.hash(), 256)
            .storeUint(body.hash(), 256)
            .endCell()
            .hash();
    }

    fun processPublish(seq: Int, header_0: Cell, header_1: Cell, body_cell: Cell, sig: Cell, refund_to: Address) {
        let nowEpoch: Int = now() / 86400;
        throwUnless(13656, (nowEpoch >= self.epoch - 1) && (nowEpoch <= self.epoch + 1));
        throwUnless(13652, context().value >= (self.record_count == 0 ? RS_DEPLOY_MIN_VALUE : RS_MIN_VALUE));
        throwUnless(13660, context().value >= (self.record_count == 0 ? RS_DEPLOY_MIN_VALUE : RS_MIN_VALUE) + myStorageDue());
        throwUnless(13651, self.record_count < RS_SAFE_CAP);
        throwUnless(13653, seq > self.last_seq);
        throwUnless(13659, seq <= self.last_seq + RS_SAFE_CAP);

        let commit: Int = self.frameCommit(header_0, header_1, body_cell);
        let digest: Int = beginCell()
            .storeUint(RS_WRITE_DOMAIN, 32).storeUint(seq, 64).storeUint(commit, 256)
            .storeUint(self.epoch, 32)
            .endCell().hash();
        throwUnless(13654, checkSignature(digest, sig.beginParse(), self.write_pubkey));

        self.last_seq = seq;
        self.records.set(self.record_count, RecordEntry{ frame_commit: commit, created_at: now() });
        self.record_count = self.record_count + 1;


        nativeReserve(
            RS_RECORD_ENDOWMENT + (self.record_count == 1 ? RS_BASE_ENDOWMENT : 0) + myStorageDue(),
            ReserveAtMost | ReserveAddOriginalBalance,
        );        send(SendParameters{ to: refund_to, value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }



    receive(msg: VaultPublish) {
        throwUnless(13670, sender() == vaultAddressOf(msg.payer));
        throwUnless(13672, msg.payer.asSlice().preloadUint(11) == 1024);
        let inner: CapsulePublish = CapsulePublish.fromCell(msg.record);
        self.processPublish(inner.seq, inner.header_0, inner.header_1, inner.body, inner.sig,
            msg.payer);
    }

    receive(msg: RetireShard) {
        throwUnless(13655, now() > (self.epoch + 2) * 86400 + RS_RETENTION);
        throwUnless(13657, context().value >= RS_RETIRE_GAS);
        self.records = emptyMap();
        self.record_count = 0;
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero | SendIgnoreErrors,
            bounce: false,
        });
    }

    receive() {}

    get fun get_record(entry_id: Int): CapsuleRecordView {
        let e: RecordEntry? = self.records.get(entry_id);
        if (e == null) {
            return CapsuleRecordView{ exists: false, frame_commit: 0, created_at: 0 };
        }
        let v: RecordEntry = e!!;
        return CapsuleRecordView{ exists: true, frame_commit: v.frame_commit, created_at: v.created_at };
    }

    fun packRows(start: Int, n: Int): Cell {
        let cell: Cell = beginCell().endCell();
        let isTail: Bool = true;
        let remaining: Int = n;
        while (remaining > 0) {
            let chunk: Int = min(remaining, RS_ROWS_PER_CELL);
            let first: Int = start + remaining - chunk;
            let b: Builder = beginCell();
            let i: Int = 0;
            while (i < chunk) {
                let e: RecordEntry? = self.records.get(first + i);
                b = b.storeUint(e == null ? 0 : e!!.frame_commit, 256).storeUint(e == null ? 0 : e!!.created_at, 64);
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

    get fun get_page(from_id: Int, max_count: Int): RecordPage {
        let start: Int = max(from_id, 0);
        let available: Int = self.record_count > start ? self.record_count - start : 0;
        let n: Int = max(0, min(min(max_count, RS_PAGE_CAP), available));
        return RecordPage{
            from_id: start,
            count: n,
            record_count: self.record_count,
            rows: self.packRows(start, n),
        };
    }

    get fun get_view(): RecordShardView {
        return RecordShardView{
            write_pubkey: self.write_pubkey,
            epoch: self.epoch,
            last_seq: self.last_seq,
            record_count: self.record_count,
            safe_cap: RS_SAFE_CAP,
            retention: RS_RETENTION,
            min_value: RS_MIN_VALUE,
            deploy_min_value: RS_DEPLOY_MIN_VALUE,
            retire_at: (self.epoch + 2) * 86400 + RS_RETENTION,
            protocol_fee: RS_PROTOCOL_FEE,
        };
    }
}
