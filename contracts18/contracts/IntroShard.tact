
import "./sink-wire.tact";

const IS_INTRO_RETENTION: Int = 604800;
const IS_SAFE_CAP: Int = 8000;

const IS_RETIRE_SLACK: Int = 345600;
const IS_SCAN_PAGE_CAP: Int = 256;
const IS_PAIRS_PER_CELL: Int = 3;

const IS_BODY_DOMAIN: Int = 0x49534243;

const IS_INTRO_ENDOWMENT: Int = 12000;
const IS_BASE_ENDOWMENT: Int = 2500000;
const IS_PUBLISH_GAS: Int = 2500000;
const IS_RETIRE_BOUNTY: Int = 2000000;
const IS_RETIRE_GAS: Int = 1200000;

const IS_PROTOCOL_FEE: Int = 10000000;


const IS_FEE_SINK_DEPOSIT_RESERVE: Int = 400000;
const IS_FEE_SINK_FWD_RESERVE: Int = 200000;
const IS_FEE_TRANSPORT: Int = IS_FEE_SINK_DEPOSIT_RESERVE + IS_FEE_SINK_FWD_RESERVE;


const IS_MIN_VALUE: Int = IS_INTRO_ENDOWMENT + IS_PUBLISH_GAS + IS_PROTOCOL_FEE + IS_FEE_TRANSPORT;
const IS_DEPLOY_MIN_VALUE: Int = IS_MIN_VALUE + IS_BASE_ENDOWMENT;

message(0x49535031) IntroPublish {
    r: Int as uint256;
    view_tag: Int as uint16;
    header_0: Cell;
    body: Cell;
}

message(0x49535033) RetireShard {}




struct IntroEntry {
    r: Int as uint256;
    view_tag: Int as uint16;
    body_commit: Int as uint256;
    created_at: Int as uint64;
}

struct IntroEntryView {
    exists: Bool;
    r: Int;
    view_tag: Int;
    body_commit: Int;
    created_at: Int;
}

struct IntroScanPage {
    from_id: Int;
    count: Int;
    next_id: Int;
    pairs: Cell;
}

struct IntroShardView {
    epoch: Int;
    bucket: Int;
    next_id: Int;
    retention: Int;
    safe_cap: Int;
    min_value: Int;
    deploy_min_value: Int;
    protocol_fee: Int;
    retire_at: Int;
    fee_sink: Address;
}

contract IntroShard {
    epoch: Int as uint32;
    bucket: Int as uint32;
    intros: map<Int, IntroEntry>;
    next_id: Int as uint32;

    init(epoch: Int, bucket: Int) {
        self.epoch = epoch;
        self.bucket = bucket;
        self.intros = emptyMap();
        self.next_id = 0;
    }

    fun mySink(): Address {
        return sinkAddressOf(self.bucket % FS_SINK_COUNT);
    }
    fun bodyCommit(h0: Cell, body: Cell): Int {
        return beginCell()
            .storeUint(IS_BODY_DOMAIN, 32)
            .storeUint(h0.hash(), 256)
            .storeUint(body.hash(), 256)
            .endCell()
            .hash();
    }

    receive(msg: IntroPublish) {
        let nowEpoch: Int = now() / 86400;
        throwUnless(13684, (nowEpoch >= self.epoch - 1) && (nowEpoch <= self.epoch + 1));
        throwUnless(13682, context().value >= (self.next_id == 0 ? IS_DEPLOY_MIN_VALUE : IS_MIN_VALUE));
        throwUnless(13688, context().value >= (self.next_id == 0 ? IS_DEPLOY_MIN_VALUE : IS_MIN_VALUE) + myStorageDue());
        throwUnless(13680, self.next_id < IS_SAFE_CAP);
        throwUnless(13687, sender().asSlice().preloadUint(11) == 1024);

        self.intros.set(self.next_id, IntroEntry{
            r: msg.r,
            view_tag: msg.view_tag,
            body_commit: self.bodyCommit(msg.header_0, msg.body),
            created_at: now(),
        });
        self.next_id = self.next_id + 1;

        message(MessageParameters {
            to: self.mySink(),
            value: IS_PROTOCOL_FEE + IS_FEE_SINK_DEPOSIT_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately | SendBounceIfActionFail,
            body: DepositProtocolFee{ amount: IS_PROTOCOL_FEE }.toCell(),
        });

        nativeReserve(
            IS_INTRO_ENDOWMENT + (self.next_id == 1 ? IS_BASE_ENDOWMENT : 0) + myStorageDue(),
            ReserveExact | ReserveAddOriginalBalance | ReserveBounceIfActionFail,
        );        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    receive(msg: RetireShard) {
        throwUnless(13683, now() > (self.epoch + 2) * 86400 + IS_INTRO_RETENTION + IS_RETIRE_SLACK);
        throwUnless(13681, context().value >= IS_RETIRE_GAS);
        self.intros = emptyMap();
        self.next_id = 0;
        let keep: Int = IS_RETIRE_BOUNTY + context().value + IS_FEE_SINK_DEPOSIT_RESERVE + IS_FEE_SINK_FWD_RESERVE;
        let surplus: Int = myBalance() > keep ? myBalance() - keep : 0;
        if (surplus > 0) {
            message(MessageParameters{
                to: self.mySink(),
                value: surplus + IS_FEE_SINK_DEPOSIT_RESERVE,
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
        throwUnless(13685, sender() == self.mySink());
        throwUnless(13686, msg.amount > 0);
    }

    receive() {}

    fun packPairs(start: Int, n: Int): Cell {
        let cell: Cell = beginCell().endCell();
        let isTail: Bool = true;
        let remaining: Int = n;
        while (remaining > 0) {
            let chunk: Int = min(remaining, IS_PAIRS_PER_CELL);
            let first: Int = start + remaining - chunk;
            let b: Builder = beginCell();
            let i: Int = 0;
            while (i < chunk) {
                let e: IntroEntry? = self.intros.get(first + i);
                b = b.storeUint(e == null ? 0 : e!!.r, 256).storeUint(e == null ? 0 : e!!.view_tag, 16);
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

    get fun get_scan_page(from_id: Int, max_count: Int): IntroScanPage {
        let start: Int = max(from_id, 0);
        let available: Int = self.next_id > start ? self.next_id - start : 0;
        let n: Int = max(0, min(min(max_count, IS_SCAN_PAGE_CAP), available));
        return IntroScanPage{
            from_id: start,
            count: n,
            next_id: self.next_id,
            pairs: self.packPairs(start, n),
        };
    }

    get fun get_entry(entry_id: Int): IntroEntryView {
        let e: IntroEntry? = self.intros.get(entry_id);
        if (e == null) {
            return IntroEntryView{ exists: false, r: 0, view_tag: 0, body_commit: 0, created_at: 0 };
        }
        let v: IntroEntry = e!!;
        return IntroEntryView{ exists: true, r: v.r, view_tag: v.view_tag, body_commit: v.body_commit, created_at: v.created_at };
    }

    get fun get_view(): IntroShardView {
        return IntroShardView{
            epoch: self.epoch,
            bucket: self.bucket,
            next_id: self.next_id,
            retention: IS_INTRO_RETENTION,
            safe_cap: IS_SAFE_CAP,
            min_value: IS_MIN_VALUE,
            deploy_min_value: IS_DEPLOY_MIN_VALUE,
            retire_at: (self.epoch + 2) * 86400 + IS_INTRO_RETENTION + IS_RETIRE_SLACK,
            protocol_fee: IS_PROTOCOL_FEE,
            fee_sink: self.mySink(),
        };
    }
}
