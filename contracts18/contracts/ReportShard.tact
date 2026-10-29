import "./sink-wire.tact";
import "./gate-wire.tact";

const MR_ERA_SECONDS: Int = 2592000;
const MR_BUCKET_COUNT: Int = 64;
const MR_RETENTION: Int = 7776000;
const MR_RETIRE_SLACK: Int = 86400;
const MR_SAFE_CAP: Int = 8192;
const MR_RETIRE_BOUNTY: Int = 2000000;
const MR_RETIRE_GAS: Int = 1300000;
const MR_LADDER_START: Int = 2048;
const MR_LADDER_STEP: Int = 512;
const MR_REPORT_FEE: Int = 5000000;
const MR_FEE_SINK_DEPOSIT_RESERVE: Int = 400000;
const MR_FEE_SINK_FWD_RESERVE: Int = 200000;
const MR_FEE_TRANSPORT: Int = MR_FEE_SINK_DEPOSIT_RESERVE + MR_FEE_SINK_FWD_RESERVE;
const MR_REPORT_GAS: Int = 3800000;
const MR_REVIEW_GAS: Int = 2100000;
const MR_TARGET_ENDOWMENT: Int = 250000;
const MR_BASE_ENDOWMENT: Int = 2700000;
const MR_REASON_COUNT: Int = 8;
const MR_KIND_MAX: Int = 3;
const MR_GENERATION_MIN: Int = 17;
const MR_TARGET_BITS: Int = 144;
const MR_ROWS_PER_CELL: Int = 1;
const MR_PAGE_CAP: Int = 96;

message(0x4D525231) ReportEntry {
    generation: Int as uint8;
    kind: Int as uint8;
    epoch_tag: Int as uint64;
    shard_seq: Int as uint32;
    entry_id: Int as uint32;
    reason: Int as uint8;
    partition_key: Int as uint256;
}
message(0x4D525239) RetireReportShard {}

struct ReportRow {
    target: Int as uint256;
    partition_key: Int as uint256;
    count: Int as uint32;
    reviewed_count: Int as uint32;
    reasons: Int as uint16;
    first_at: Int as uint32;
    last_at: Int as uint32;
}

struct ReportRowView {
    exists: Bool;
    row_key: Int;
    count: Int;
    reviewed_count: Int;
    reasons: Int;
    first_at: Int;
    last_at: Int;
}

struct ReportPage {
    from_slot: Int;
    count: Int;
    target_count: Int;
    rows: Cell;
}

struct ReportShardView {
    era: Int;
    bucket: Int;
    target_count: Int;
    safe_cap: Int;
    report_fee: Int;
    min_value: Int;
    ladder_premium: Int;
    repeat_value: Int;
    deploy_min_value: Int;
    retire_at: Int;
    fee_sink: Address;
    gate: Address;
}

contract ReportShard {
    era: Int as uint32;
    bucket: Int as uint8;
    targets: map<Int as uint32, Int as uint256>;
    rows: map<Int as uint256, ReportRow>;
    target_count: Int as uint32;

    init(era: Int, bucket: Int) {
        throwUnless(13800, bucket >= 0 && bucket < MR_BUCKET_COUNT);
        self.era = era;
        self.bucket = bucket;
        self.targets = emptyMap();
        self.rows = emptyMap();
        self.target_count = 0;
    }

    fun mySink(): Address {
        return sinkAddressOf(self.bucket % FS_SINK_COUNT);
    }

    fun ladderPremiumAt(fill: Int): Int {
        if (fill < MR_LADDER_START) { return 0; }
        return (MR_TARGET_ENDOWMENT << ((fill - MR_LADDER_START) / MR_LADDER_STEP + 1)) - MR_TARGET_ENDOWMENT;
    }
    fun repeatValue(): Int { return MR_REPORT_GAS + MR_REPORT_FEE + MR_FEE_TRANSPORT; }
    fun minValueAt(fill: Int): Int { return MR_TARGET_ENDOWMENT + self.ladderPremiumAt(fill) + self.repeatValue(); }
    fun deployMinValue(): Int { return self.minValueAt(0) + MR_BASE_ENDOWMENT; }
    fun retireAt(): Int { return (self.era + 2) * MR_ERA_SECONDS + MR_RETENTION + MR_RETIRE_SLACK; }

    fun targetKey(generation: Int, kind: Int, epochTag: Int, shardSeq: Int, entryId: Int): Int {
        return (((((generation << 8) | kind) << 64) | epochTag) << 32 | shardSeq) << 32 | entryId;
    }
    fun rowKeyOf(target: Int, partitionKey: Int): Int {
        return beginCell().storeUint(target, MR_TARGET_BITS).storeUint(partitionKey, 256).endCell().hash();
    }

    receive(msg: ReportEntry) {
        throwUnless(13818, sender().asSlice().preloadUint(11) == 1024);
        throwUnless(13801, msg.kind <= MR_KIND_MAX);
        throwUnless(13802, msg.reason < MR_REASON_COUNT);
        throwUnless(13803, msg.generation >= MR_GENERATION_MIN);
        let nowEra: Int = now() / MR_ERA_SECONDS;
        throwUnless(13804, (nowEra >= self.era - 1) && (nowEra <= self.era + 1));
        throwUnless(13814, msg.kind == (msg.epoch_tag >> 32));
        throwUnless(13815, msg.partition_key > 0);
        let target: Int = self.targetKey(msg.generation, msg.kind, msg.epoch_tag, msg.shard_seq, msg.entry_id);
        let rowKey: Int = self.rowKeyOf(target, msg.partition_key);
        throwUnless(13805, rowKey % MR_BUCKET_COUNT == self.bucket);
        let existing: ReportRow? = self.rows.get(rowKey);
        let fresh: Bool = existing == null;
        let premium: Int = fresh ? self.ladderPremiumAt(self.target_count) : 0;
        let demand: Int = fresh
            ? (self.target_count == 0 ? self.deployMinValue() : self.minValueAt(self.target_count))
            : self.repeatValue();
        throwUnless(13806, context().value >= demand);
        throwUnless(13807, context().value >= demand + myStorageDue());
        throwUnless(13808, !fresh || self.target_count < MR_SAFE_CAP);
        if (fresh) {
            self.targets.set(self.target_count, rowKey);
            self.rows.set(rowKey, ReportRow{
                target: target, partition_key: msg.partition_key, count: 1, reviewed_count: 0,
                reasons: 1 << msg.reason, first_at: now(), last_at: now(),
            });
            self.target_count = self.target_count + 1;
        } else {
            let row: ReportRow = existing!!;
            throwUnless(13809, row.count < 4294967295);
            self.rows.set(rowKey, ReportRow{
                target: row.target,
                partition_key: row.partition_key,
                count: row.count + 1,
                reviewed_count: row.reviewed_count,
                reasons: row.reasons | (1 << msg.reason),
                first_at: row.first_at,
                last_at: now(),
            });
        }
        message(MessageParameters{
            to: self.mySink(),
            value: MR_REPORT_FEE + premium + MR_FEE_SINK_DEPOSIT_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately | SendBounceIfActionFail,
            body: DepositProtocolFee{ amount: MR_REPORT_FEE + premium }.toCell(),
        });
        nativeReserve(
            (fresh ? MR_TARGET_ENDOWMENT + (self.target_count == 1 ? MR_BASE_ENDOWMENT : 0) : 0) + myStorageDue(),
            ReserveExact | ReserveAddOriginalBalance | ReserveBounceIfActionFail,
        );
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    receive(msg: MarkReviewed) {
        throwUnless(13820, sender() == moderationGateAddress());
        throwUnless(13817, msg.refund_to.asSlice().preloadUint(11) == 1024);
        let existing: ReportRow? = self.rows.get(msg.row_key);
        throwUnless(13821, existing != null);
        throwUnless(13822, context().value >= MR_REVIEW_GAS + myStorageDue());
        let row: ReportRow = existing!!;
        self.rows.set(msg.row_key, ReportRow{
            target: row.target, partition_key: row.partition_key, count: row.count, reviewed_count: row.count,
            reasons: row.reasons, first_at: row.first_at, last_at: row.last_at,
        });
        nativeReserve(myStorageDue(), ReserveAtMost | ReserveAddOriginalBalance);
        send(SendParameters{ to: msg.refund_to, value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    receive(msg: RetireReportShard) {
        throwUnless(13810, now() > self.retireAt());
        throwUnless(13816, context().value >= MR_RETIRE_GAS);
        self.targets = emptyMap();
        self.rows = emptyMap();
        self.target_count = 0;
        let keep: Int = MR_RETIRE_BOUNTY + context().value + MR_FEE_SINK_DEPOSIT_RESERVE + MR_FEE_SINK_FWD_RESERVE;
        let surplus: Int = myBalance() > keep ? myBalance() - keep : 0;
        if (surplus > 0) {
            message(MessageParameters{
                to: self.mySink(),
                value: surplus + MR_FEE_SINK_DEPOSIT_RESERVE,
                mode: SendPayFwdFeesSeparately | SendIgnoreErrors,
                bounce: false,
                body: DepositProtocolFee{ amount: surplus }.toCell(),
            });
        }
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero | SendIgnoreErrors,
            bounce: false,
        });
    }

    bounced(msg: bounced<DepositProtocolFee>) {
        throwUnless(13811, sender() == self.mySink());
        throwUnless(13812, msg.amount > 0);
    }

    receive() {}

    fun packRows(start: Int, n: Int): Cell {
        let cell: Cell = beginCell().endCell();
        let isTail: Bool = true;
        let remaining: Int = n;
        while (remaining > 0) {
            let chunk: Int = min(remaining, MR_ROWS_PER_CELL);
            let first: Int = start + remaining - chunk;
            let b: Builder = beginCell();
            let i: Int = 0;
            while (i < chunk) {
                let key: Int? = self.targets.get(first + i);
                let row: ReportRow? = key == null ? null : self.rows.get(key!!);
                b = b.storeUint(row == null ? 0 : row!!.target, 256)
                     .storeUint(row == null ? 0 : row!!.partition_key, 256)
                     .storeUint(row == null ? 0 : row!!.count, 32)
                     .storeUint(row == null ? 0 : row!!.reviewed_count, 32)
                     .storeUint(row == null ? 0 : row!!.reasons, 16)
                     .storeUint(row == null ? 0 : row!!.first_at, 32)
                     .storeUint(row == null ? 0 : row!!.last_at, 32);
                i = i + 1;
            }
            if (isTail) { cell = b.endCell(); isTail = false; }
            else { cell = b.storeRef(cell).endCell(); }
            remaining = remaining - chunk;
        }
        return cell;
    }

    get fun get_page(from_slot: Int, max_count: Int): ReportPage {
        let start: Int = max(from_slot, 0);
        let available: Int = self.target_count > start ? self.target_count - start : 0;
        let n: Int = max(0, min(min(max_count, MR_PAGE_CAP), available));
        return ReportPage{ from_slot: start, count: n, target_count: self.target_count, rows: self.packRows(start, n) };
    }

    get fun get_row(target: Int, partition_key: Int): ReportRowView {
        let rowKey: Int = self.rowKeyOf(target, partition_key);
        let row: ReportRow? = self.rows.get(rowKey);
        if (row == null) {
            return ReportRowView{ exists: false, row_key: rowKey, count: 0, reviewed_count: 0, reasons: 0, first_at: 0, last_at: 0 };
        }
        let r: ReportRow = row!!;
        return ReportRowView{ exists: true, row_key: rowKey, count: r.count, reviewed_count: r.reviewed_count, reasons: r.reasons, first_at: r.first_at, last_at: r.last_at };
    }

    get fun row_key(target: Int, partition_key: Int): Int {
        return self.rowKeyOf(target, partition_key);
    }

    get fun get_view(): ReportShardView {
        return ReportShardView{
            era: self.era,
            bucket: self.bucket,
            target_count: self.target_count,
            safe_cap: MR_SAFE_CAP,
            report_fee: MR_REPORT_FEE,
            min_value: self.minValueAt(self.target_count),
            ladder_premium: self.ladderPremiumAt(self.target_count),
            repeat_value: self.repeatValue(),
            deploy_min_value: self.deployMinValue(),
            retire_at: self.retireAt(),
            fee_sink: self.mySink(),
            gate: moderationGateAddress(),
        };
    }
}
