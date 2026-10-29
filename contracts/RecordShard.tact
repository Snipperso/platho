
const RS_SAFE_CAP: Int = 4096;
const RS_RETENTION: Int = 31536000;

const RS_FRAME_DOMAIN: Int = 0x52534643;
const RS_WRITE_DOMAIN: Int = 0x52535744;

const RS_RECORD_ENDOWMENT: Int = 300000;
const RS_BASE_ENDOWMENT: Int = 3500000;
const RS_PUBLISH_GAS: Int = 2500000;

const RS_PROTOCOL_FEE: Int = 10000000;

const RS_FEE_SINK: Address = address("EQAgWSAucibv2D3SOIhL1wKFwg27wIRkeiObu5uxgOfNpO6E");

const RS_FEE_SINK_DEPOSIT_RESERVE: Int = 2600000;
const RS_FEE_SINK_FWD_RESERVE: Int = 200000;
const RS_FEE_TRANSPORT: Int = RS_FEE_SINK_DEPOSIT_RESERVE + RS_FEE_SINK_FWD_RESERVE;


const RS_MIN_VALUE: Int = RS_RECORD_ENDOWMENT + RS_PUBLISH_GAS + RS_PROTOCOL_FEE + RS_FEE_TRANSPORT;
const RS_DEPLOY_MIN_VALUE: Int = RS_MIN_VALUE + RS_BASE_ENDOWMENT;

message(0x52535031) CapsulePublish {
    seq: Int as uint64;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
    sig: Cell;
}

message(0x52535033) RetireShard {}

message(0xFF775609) DepositProtocolFee {
    amount: Int as uint128;
}

message(0x52535046) DepositCapsuleFee {
    amount: Int as uint128;
    lane: Int as uint8;
    init_arg0: Int as int257;
    init_arg1: Int as int257;
    publisher: Address;
}

struct RecordEntry {
    frame_commit: Int;
    created_at: Int;
}

struct CapsuleRecordView {
    exists: Bool;
    frame_commit: Int;
    created_at: Int;
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
    fee_sink: Address;
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

    receive(msg: CapsulePublish) {
        let nowEpoch: Int = now() / 86400;
        throwUnless(13656, (nowEpoch >= self.epoch - 1) && (nowEpoch <= self.epoch + 1));
        throwUnless(13652, context().value >= (self.record_count == 0 ? RS_DEPLOY_MIN_VALUE : RS_MIN_VALUE));
        throwUnless(13651, self.record_count < RS_SAFE_CAP);
        throwUnless(13653, msg.seq > self.last_seq);

        let commit: Int = self.frameCommit(msg.header_0, msg.header_1, msg.body);
        let digest: Int = beginCell()
            .storeUint(RS_WRITE_DOMAIN, 32).storeUint(msg.seq, 64).storeUint(commit, 256)
            .endCell().hash();
        throwUnless(13654, checkSignature(digest, msg.sig.beginParse(), self.write_pubkey));

        self.last_seq = msg.seq;
        self.records.set(self.record_count, RecordEntry{ frame_commit: commit, created_at: now() });
        self.record_count = self.record_count + 1;

        message(MessageParameters {
            to: RS_FEE_SINK,
            value: RS_PROTOCOL_FEE + RS_FEE_SINK_DEPOSIT_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: DepositCapsuleFee{ amount: RS_PROTOCOL_FEE, lane: 0,
                                     init_arg0: self.write_pubkey, init_arg1: self.epoch,
                                     publisher: sender() }.toCell(),
        });

        nativeReserve(
            RS_RECORD_ENDOWMENT + (self.record_count == 1 ? RS_BASE_ENDOWMENT : 0),
            ReserveAtMost | ReserveAddOriginalBalance,
        );
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    receive(msg: RetireShard) {
        throwUnless(13655, now() > (self.epoch + 2) * 86400 + RS_RETENTION);
        self.records = emptyMap();
        self.record_count = 0;
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero | SendIgnoreErrors,
            bounce: false,
        });
    }

    bounced(msg: bounced<DepositCapsuleFee>) {
        throwUnless(13657, sender() == RS_FEE_SINK);
        throwUnless(13658, msg.amount > 0);
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
            fee_sink: RS_FEE_SINK,
        };
    }
}
