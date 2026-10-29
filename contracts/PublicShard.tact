

const PS_SAFE_CAP: Int = 4096;

const PS_ERA_SHORT: Int = 2592000;
const PS_ERA_LONG: Int = 31536000;

const PS_RETENTION_POST: Int = 31536000;
const PS_RETENTION_BEACON: Int = 31536000;
const PS_RETENTION_AVATAR: Int = 94608000;

const PS_KIND_CHANNEL: Int = 0;
const PS_KIND_THREAD: Int = 1;
const PS_KIND_BEACON: Int = 2;
const PS_KIND_AVATAR: Int = 3;

const PS_CHANNEL_DOMAIN: Int = 0x50534348;
const PS_THREAD_DOMAIN: Int = 0x50535448;
const PS_BEACON_DOMAIN: Int = 0x50534243;
const PS_AVATAR_DOMAIN: Int = 0x50534156;
const PS_BODY_DOMAIN: Int = 0x50534644;
const PS_POST_UID_DOMAIN: Int = 0x50535544;

const PS_ENTRY_ENDOWMENT_POST: Int = 500000;
const PS_ENTRY_ENDOWMENT_BEACON: Int = 1600000;
const PS_ENTRY_ENDOWMENT_AVATAR: Int = 2400000;

const PS_BASE_ENDOWMENT_POST: Int = 4500000;
const PS_BASE_ENDOWMENT_BEACON: Int = 14500000;
const PS_BASE_ENDOWMENT_AVATAR: Int = 21800000;

const PS_PUBLISH_GAS: Int = 2500000;

const PS_PROTOCOL_FEE: Int = 10000000;

const PS_FEE_SINK: Address = address("EQAgWSAucibv2D3SOIhL1wKFwg27wIRkeiObu5uxgOfNpO6E");
const PS_FEE_SINK_DEPOSIT_RESERVE: Int = 2600000;
const PS_FEE_SINK_FWD_RESERVE: Int = 200000;
const PS_FEE_TRANSPORT: Int = PS_FEE_SINK_DEPOSIT_RESERVE + PS_FEE_SINK_FWD_RESERVE;

const PS_RETIRE_SLACK: Int = 86400;

const PS_UINT32_MAX: Int = 4294967295;

message(0x50535031) PublicPublish {
    kind: Int as uint8;
    key_arg: Int as uint256;
    shard_seq: Int as uint32;
    header: Cell;
    body: Cell;
}

message(0x50535033) RetirePublicShard {}

message(0x52535046) DepositCapsuleFee {
    amount: Int as uint128;
    lane: Int as uint8;
    init_arg0: Int as int257;
    init_arg1: Int as int257;
    publisher: Address;
}

struct PublicEntry {
    publisher: Address;
    body_commit: Int;
    created_at: Int;
}

struct PublicEntryView {
    exists: Bool;
    publisher: Address;
    body_commit: Int;
    created_at: Int;
}

const PS_ROW_BITS: Int = 448;
const PS_PAIRS_PER_CELL: Int = 2;
const PS_PUBLISHER_TAG_MOD: Int = 340282366920938463463374607431768211456;
const PS_PAGE_CAP: Int = 96;

struct PublicPage {
    from_id: Int;
    count: Int;
    entry_count: Int;
    rows: Cell;
}

struct PublicShardView {
    partition_key: Int;
    epoch_tag: Int;
    kind: Int;
    era_index: Int;
    entry_count: Int;
    safe_cap: Int;
    era_seconds: Int;
    retention: Int;
    min_value: Int;
    deploy_min_value: Int;
    protocol_fee: Int;
    retire_at: Int;
    fee_sink: Address;
}

contract PublicShard {
    partition_key: Int as uint256;
    epoch_tag: Int as uint64;
    entries: map<Int, PublicEntry>;
    entry_count: Int as uint32;

    init(partition_key: Int, epoch_tag: Int) {
        self.partition_key = partition_key;
        self.epoch_tag = epoch_tag;
        self.entries = emptyMap();
        self.entry_count = 0;
    }

    fun kindOf(): Int { return self.epoch_tag >> 32; }
    fun eraIndex(): Int { return self.epoch_tag & 0xFFFFFFFF; }
    fun eraSeconds(): Int { return self.kindOf() < PS_KIND_BEACON ? PS_ERA_SHORT : PS_ERA_LONG; }
    fun retention(): Int {
        let k: Int = self.kindOf();
        if (k == PS_KIND_AVATAR) { return PS_RETENTION_AVATAR; }
        if (k == PS_KIND_BEACON) { return PS_RETENTION_BEACON; }
        return PS_RETENTION_POST;
    }
    fun entryEndowment(): Int {
        let k: Int = self.kindOf();
        if (k == PS_KIND_AVATAR) { return PS_ENTRY_ENDOWMENT_AVATAR; }
        if (k == PS_KIND_BEACON) { return PS_ENTRY_ENDOWMENT_BEACON; }
        return PS_ENTRY_ENDOWMENT_POST;
    }
    fun baseEndowment(): Int {
        let k: Int = self.kindOf();
        if (k == PS_KIND_AVATAR) { return PS_BASE_ENDOWMENT_AVATAR; }
        if (k == PS_KIND_BEACON) { return PS_BASE_ENDOWMENT_BEACON; }
        return PS_BASE_ENDOWMENT_POST;
    }
    fun minValue(): Int { return self.entryEndowment() + PS_PUBLISH_GAS + PS_PROTOCOL_FEE + PS_FEE_TRANSPORT; }
    fun deployMinValue(): Int { return self.minValue() + self.baseEndowment(); }
    fun retireAt(): Int { return (self.eraIndex() + 2) * self.eraSeconds() + self.retention() + PS_RETIRE_SLACK; }

    fun senderHash(): Int {
        let s: Slice = sender().asSlice();
        throwUnless(13707, s.loadUint(11) == 1024);
        return s.loadUint(256);
    }

    fun bodyCommit(header: Cell, body: Cell): Int {
        return beginCell()
            .storeUint(PS_BODY_DOMAIN, 32)
            .storeUint(header.hash(), 256)
            .storeUint(body.hash(), 256)
            .endCell()
            .hash();
    }

    fun claimedPartitionKey(kind: Int, keyArg: Int, shardSeq: Int): Int {
        if (kind == PS_KIND_CHANNEL) {
            return beginCell().storeUint(PS_CHANNEL_DOMAIN, 32).storeUint(self.senderHash(), 256).storeUint(shardSeq, 32).endCell().hash();
        }
        if (kind == PS_KIND_THREAD) {
            return beginCell().storeUint(PS_THREAD_DOMAIN, 32).storeUint(keyArg, 256).storeUint(shardSeq, 32).endCell().hash();
        }
        if (kind == PS_KIND_BEACON) {
            return beginCell().storeUint(PS_BEACON_DOMAIN, 32).storeUint(keyArg & 0xFFFFFFFF, 32).endCell().hash();
        }
        return beginCell().storeUint(PS_AVATAR_DOMAIN, 32).storeUint(self.senderHash(), 256).endCell().hash();
    }

    receive(msg: PublicPublish) {
        throwUnless(13701, msg.kind == self.kindOf());
        throwUnless(13702, self.claimedPartitionKey(msg.kind, msg.key_arg, msg.shard_seq) == self.partition_key);
        let nowEra: Int = now() / self.eraSeconds();
        throwUnless(13703, (nowEra >= self.eraIndex() - 1) && (nowEra <= self.eraIndex() + 1));
        throwUnless(13704, context().value >= (self.entry_count == 0 ? self.deployMinValue() : self.minValue()));
        throwUnless(13705, self.entry_count < PS_SAFE_CAP);
        throwUnless(13708, self.entry_count < PS_UINT32_MAX);

        self.entries.set(self.entry_count, PublicEntry{
            publisher: sender(),
            body_commit: self.bodyCommit(msg.header, msg.body),
            created_at: now(),
        });
        self.entry_count = self.entry_count + 1;

        message(MessageParameters{
            to: PS_FEE_SINK,
            value: PS_PROTOCOL_FEE + PS_FEE_SINK_DEPOSIT_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: DepositCapsuleFee{ amount: PS_PROTOCOL_FEE, lane: 2,
                                     init_arg0: self.partition_key, init_arg1: self.epoch_tag,
                                     publisher: sender() }.toCell(),
        });

        nativeReserve(
            self.entryEndowment() + (self.entry_count == 1 ? self.baseEndowment() : 0),
            ReserveAtMost | ReserveAddOriginalBalance,
        );
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    receive(msg: RetirePublicShard) {
        throwUnless(13706, now() > self.retireAt());
        self.entries = emptyMap();
        self.entry_count = 0;
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero | SendIgnoreErrors,
            bounce: false,
        });
    }

    bounced(msg: bounced<DepositCapsuleFee>) {
        throwUnless(13709, sender() == PS_FEE_SINK);
        throwUnless(13710, msg.amount > 0);
    }

    receive() {}

    fun publisherTag(publisher: Address): Int {
        return parseStdAddress(publisher.asSlice()).address % PS_PUBLISHER_TAG_MOD;
    }

    fun packRows(start: Int, n: Int): Cell {
        let cell: Cell = beginCell().endCell();
        let isTail: Bool = true;
        let remaining: Int = n;
        while (remaining > 0) {
            let chunk: Int = min(remaining, PS_PAIRS_PER_CELL);
            let first: Int = start + remaining - chunk;
            let b: Builder = beginCell();
            let i: Int = 0;
            while (i < chunk) {
                let e: PublicEntry? = self.entries.get(first + i);
                b = b.storeUint(e == null ? 0 : e!!.body_commit, 256)
                     .storeUint(e == null ? 0 : e!!.created_at, 64)
                     .storeUint(e == null ? 0 : self.publisherTag(e!!.publisher), 128);
                i = i + 1;
            }
            if (isTail) { cell = b.endCell(); isTail = false; }
            else { cell = b.storeRef(cell).endCell(); }
            remaining = remaining - chunk;
        }
        return cell;
    }

    get fun get_page(from_id: Int, max_count: Int): PublicPage {
        let start: Int = max(from_id, 0);
        let available: Int = self.entry_count > start ? self.entry_count - start : 0;
        let n: Int = max(0, min(min(max_count, PS_PAGE_CAP), available));
        return PublicPage{ from_id: start, count: n, entry_count: self.entry_count, rows: self.packRows(start, n) };
    }

    get fun get_entry(entry_id: Int): PublicEntryView {
        let e: PublicEntry? = self.entries.get(entry_id);
        if (e == null) {
            return PublicEntryView{ exists: false, publisher: myAddress(), body_commit: 0, created_at: 0 };
        }
        let v: PublicEntry = e!!;
        return PublicEntryView{ exists: true, publisher: v.publisher, body_commit: v.body_commit, created_at: v.created_at };
    }

    get fun get_view(): PublicShardView {
        return PublicShardView{
            partition_key: self.partition_key,
            epoch_tag: self.epoch_tag,
            kind: self.kindOf(),
            era_index: self.eraIndex(),
            entry_count: self.entry_count,
            safe_cap: PS_SAFE_CAP,
            era_seconds: self.eraSeconds(),
            retention: self.retention(),
            min_value: self.minValue(),
            deploy_min_value: self.deployMinValue(),
            protocol_fee: PS_PROTOCOL_FEE,
            retire_at: self.retireAt(),
            fee_sink: PS_FEE_SINK,
        };
    }
}
