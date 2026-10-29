

import "./vault-wire.tact";
import "./sink-wire.tact";
import "./gate-wire.tact";

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
const PS_ENTRY_ENDOWMENT_BEACON: Int = 1700000;
const PS_ENTRY_ENDOWMENT_AVATAR: Int = 2400000;

const PS_BASE_ENDOWMENT_POST: Int = 8400000;
const PS_BASE_ENDOWMENT_BEACON: Int = 23000000;
const PS_BASE_ENDOWMENT_AVATAR: Int = 36500000;

const PS_PUBLISH_GAS: Int = 4000000;

const PS_PROTOCOL_FEE: Int = 10000000;

const PS_FEE_SINK_DEPOSIT_RESERVE: Int = 400000;
const PS_FEE_SINK_FWD_RESERVE: Int = 200000;
const PS_FEE_TRANSPORT: Int = PS_FEE_SINK_DEPOSIT_RESERVE + PS_FEE_SINK_FWD_RESERVE;

const PS_RETIRE_SLACK: Int = 86400;
const PS_RETIRE_BOUNTY: Int = 2000000;
const PS_RETIRE_GAS: Int = 1400000;


message(0x50535031) PublicPublish {
    kind: Int as uint8;
    key_arg: Int as uint256;
    shard_seq: Int as uint32;
    header: Cell;
    body: Cell;
}

message(0x50535033) RetirePublicShard {}

message(0x50535034) React {
    target: Int as uint32;
    emoji: Int as uint8;
}

struct ReactionRows {
    from_target: Int;
    count: Int;
    entry_count: Int;
    rows: Cell;
}


struct PublicEntry {
    publisher: Address;
    body_commit: Int;
    created_at: Int;
    hidden: Bool;
}

struct PublicEntryView {
    exists: Bool;
    publisher: Address;
    body_commit: Int;
    created_at: Int;
    hidden: Bool;
}

const PS_PAIRS_PER_CELL: Int = 2;
const PS_HIDE_GAS: Int = 5800000;
const PS_IDS_PER_CELL: Int = 31;
const PS_HIDDEN_DOMAIN: Int = 57896044618658097711785492504343953926634992332820282019728792003956564819968;
const PS_HIDDEN_KEY_BASE: Int = 2147483648;
const PS_HIDDEN_PAGE_CAP: Int = 310;
const PS_HIDDEN_ENDOWMENT: Int = 2350000;
const PS_PUBLISHER_TAG_MOD: Int = 340282366920938463463374607431768211456;

const PS_REACTION_EMOJIS: Int = 16;
const PS_REACTION_PER_LEAF: Int = 8;
const PS_REACTION_GROUPS: Int = PS_REACTION_EMOJIS / PS_REACTION_PER_LEAF;
const PS_REACTION_DOMAIN: Int = 18446744073709551616;
const PS_REACTION_LEAF_CAP: Int = 16384;
const PS_REACTION_PAGE_CAP: Int = 32;
const PS_REACT_GAS: Int = 2500000;
const PS_REACT_LEAF_ENDOWMENT: Int = 250000;
const PS_REACTION_COUNTER_MAX: Int = 4294967295;
const PS_PAGE_CAP: Int = 96;

struct PublicPage {
    from_id: Int;
    count: Int;
    entry_count: Int;
    rows: Cell;
}

struct HiddenIds {
    count: Int;
    returned: Int;
    ids: Cell;
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
    beacon_slot: map<Int as uint256, Int as uint256>;

    hidden_count: Int as uint32;
    reaction_count: Int as uint32;

    init(partition_key: Int, epoch_tag: Int) {
        self.partition_key = partition_key;
        self.epoch_tag = epoch_tag;
        self.entries = emptyMap();
        self.entry_count = 0;
        self.beacon_slot = emptyMap();
        self.hidden_count = 0;
        self.reaction_count = 0;
    }

    fun mySink(): Address {
        return sinkAddressOf(self.partition_key % FS_SINK_COUNT);
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

    fun accountHash(of: Address): Int {
        let s: Slice = of.asSlice();
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

    fun claimedPartitionKey(kind: Int, keyArg: Int, shardSeq: Int, publisher: Address): Int {
        if (kind == PS_KIND_CHANNEL) {
            return beginCell().storeUint(PS_CHANNEL_DOMAIN, 32).storeUint(self.accountHash(publisher), 256).storeUint(shardSeq, 32).endCell().hash();
        }
        if (kind == PS_KIND_THREAD) {
            return beginCell().storeUint(PS_THREAD_DOMAIN, 32).storeUint(keyArg, 256).storeUint(shardSeq, 32).endCell().hash();
        }
        if (kind == PS_KIND_BEACON) {
            return beginCell().storeUint(PS_BEACON_DOMAIN, 32)
                .storeUint(keyArg & 0xFFFFFFFF, 32).storeUint(shardSeq, 32).endCell().hash();
        }
        return beginCell().storeUint(PS_AVATAR_DOMAIN, 32).storeUint(self.accountHash(publisher), 256).endCell().hash();
    }

    fun processPublish(kind: Int, keyArg: Int, shardSeq: Int, header: Cell, body: Cell, fee_paid: Int, publisher: Address, refund_to: Address) {
        throwUnless(13701, kind == self.kindOf());
        throwUnless(13711, kind <= PS_KIND_AVATAR);
        throwUnless(13702, self.claimedPartitionKey(kind, keyArg, shardSeq, publisher) == self.partition_key);
        let nowEra: Int = now() / self.eraSeconds();
        throwUnless(13703, (nowEra >= self.eraIndex() - 1) && (nowEra <= self.eraIndex() + 1));
        let beaconSlot: Int? = kind == PS_KIND_BEACON ? self.beacon_slot.get(self.accountHash(publisher) % PS_HIDDEN_DOMAIN) : null;
        let fee_gap: Int = PS_PROTOCOL_FEE - fee_paid + (fee_paid == 0 ? PS_FEE_TRANSPORT : 0);
        let entry_demand: Int = beaconSlot != null
            ? self.minValue() - self.entryEndowment()
            : (self.entry_count == 0 ? self.deployMinValue() : self.minValue());
        throwUnless(13704, context().value >= entry_demand - fee_gap);
        throwUnless(13712, context().value >= entry_demand - fee_gap + myStorageDue());
        throwUnless(13724, refund_to.asSlice().preloadUint(11) == 1024);

        throwUnless(13705, self.entry_count < PS_SAFE_CAP || beaconSlot != null);

        let slot: Int = beaconSlot != null ? beaconSlot!! : self.entry_count;
        let previous: PublicEntry? = beaconSlot != null ? self.entries.get(slot) : null;
        self.entries.set(slot, PublicEntry{
            publisher: publisher,
            body_commit: self.bodyCommit(header, body),
            created_at: now(),
            hidden: previous != null && previous!!.hidden,
        });
        if (beaconSlot == null) {
            if (kind == PS_KIND_BEACON) {
                self.beacon_slot.set(self.accountHash(publisher) % PS_HIDDEN_DOMAIN, self.entry_count);
            }
            self.entry_count = self.entry_count + 1;
        }

        if (fee_paid > 0) {
            message(MessageParameters{
                to: self.mySink(),
                value: fee_paid + PS_FEE_SINK_DEPOSIT_RESERVE,
                bounce: true,
                mode: SendPayFwdFeesSeparately | SendBounceIfActionFail,
                body: DepositProtocolFee{ amount: fee_paid }.toCell(),
            });
        }

        nativeReserve(
            (beaconSlot != null ? 0
                : self.entryEndowment() + (self.entry_count == 1 ? self.baseEndowment() : 0))
                + myStorageDue(),
            ReserveExact | ReserveAddOriginalBalance | ReserveBounceIfActionFail,
        );
        send(SendParameters{ to: refund_to, value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    receive(msg: PublicPublish) {
        self.processPublish(msg.kind, msg.key_arg, msg.shard_seq, msg.header, msg.body, PS_PROTOCOL_FEE,
            sender(), sender());
    }

    receive(msg: VaultPublish) {
        throwUnless(13720, sender() == vaultAddressOf(msg.payer));
        throwUnless(13722, msg.payer.asSlice().preloadUint(11) == 1024);
        let inner: PublicPublish = PublicPublish.fromCell(msg.record);
        throwUnless(13723, inner.kind != PS_KIND_BEACON);
        self.processPublish(inner.kind, inner.key_arg, inner.shard_seq, inner.header, inner.body, 0,
            msg.payer, msg.payer);
    }

    receive(msg: RetirePublicShard) {
        throwUnless(13706, now() > self.retireAt());
        throwUnless(13708, context().value >= PS_RETIRE_GAS);
        self.entries = emptyMap();
        self.entry_count = 0;
        self.hidden_count = 0;
        self.reaction_count = 0;
        self.beacon_slot = emptyMap();
        let keep: Int = PS_RETIRE_BOUNTY + context().value + PS_FEE_SINK_DEPOSIT_RESERVE + PS_FEE_SINK_FWD_RESERVE;
        let surplus: Int = myBalance() > keep ? myBalance() - keep : 0;
        if (surplus > 0) {
            message(MessageParameters{
                to: self.mySink(),
                value: surplus + PS_FEE_SINK_DEPOSIT_RESERVE,
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
        throwUnless(13709, sender() == self.mySink());
        throwUnless(13710, msg.amount > 0);
    }

    receive(msg: SetEntryHidden) {
        throwUnless(13730, sender() == moderationGateAddress());
        let existing: PublicEntry? = self.entries.get(msg.entry_id);
        throwUnless(13731, existing != null);
        let e: PublicEntry = existing!!;
        let grows: Bool = msg.hidden && !e.hidden;
        throwUnless(13733, msg.refund_to.asSlice().preloadUint(11) == 1024);
        throwUnless(13732, context().value >= PS_HIDE_GAS + (grows ? PS_HIDDEN_ENDOWMENT : 0) + myStorageDue());
        if (msg.hidden != e.hidden) {
            self.entries.set(msg.entry_id, PublicEntry{
                publisher: e.publisher, body_commit: e.body_commit, created_at: e.created_at, hidden: msg.hidden,
            });
            if (msg.hidden) {
                self.beacon_slot.set(PS_HIDDEN_DOMAIN + self.hidden_count, msg.entry_id);
                self.beacon_slot.set(PS_HIDDEN_DOMAIN + PS_HIDDEN_KEY_BASE + msg.entry_id, self.hidden_count);
                self.hidden_count = self.hidden_count + 1;
            } else {
                let last: Int = self.hidden_count - 1;
                let pos: Int = self.beacon_slot.get(PS_HIDDEN_DOMAIN + PS_HIDDEN_KEY_BASE + msg.entry_id)!!;
                let moved: Int = self.beacon_slot.get(PS_HIDDEN_DOMAIN + last)!!;
                self.beacon_slot.set(PS_HIDDEN_DOMAIN + pos, moved);
                self.beacon_slot.set(PS_HIDDEN_DOMAIN + PS_HIDDEN_KEY_BASE + moved, pos);
                self.beacon_slot.del(PS_HIDDEN_DOMAIN + last);
                self.beacon_slot.del(PS_HIDDEN_DOMAIN + PS_HIDDEN_KEY_BASE + msg.entry_id);
                self.hidden_count = last;
            }
        }
        nativeReserve((grows ? PS_HIDDEN_ENDOWMENT : 0) + myStorageDue(), ReserveAtMost | ReserveAddOriginalBalance);
        send(SendParameters{ to: msg.refund_to, value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    receive(msg: React) {
        let kind: Int = self.kindOf();
        throwUnless(13740, kind == PS_KIND_CHANNEL || kind == PS_KIND_THREAD);
        throwUnless(13741, msg.emoji < PS_REACTION_EMOJIS);
        let existing: PublicEntry? = self.entries.get(msg.target);
        throwUnless(13742, existing != null);
        throwUnless(13743, !(existing!!.hidden));
        throwUnless(13746, sender().asSlice().preloadUint(11) == 1024);
        let key: Int = PS_REACTION_DOMAIN + msg.target * PS_REACTION_GROUPS + msg.emoji / PS_REACTION_PER_LEAF;
        let current: Int? = self.beacon_slot.get(key);
        let grows: Bool = current == null;
        throwUnless(13744, context().value >= PS_REACT_GAS
            + (grows ? PS_REACT_LEAF_ENDOWMENT : 0) + myStorageDue());
        if (grows) {
            throwUnless(13745, self.reaction_count < PS_REACTION_LEAF_CAP);
            self.reaction_count = self.reaction_count + 1;
        }
        let packed: Int = current == null ? 0 : current!!;
        let shift: Int = (msg.emoji % PS_REACTION_PER_LEAF) * 32;
        let count: Int = (packed >> shift) & PS_REACTION_COUNTER_MAX;
        if (count < PS_REACTION_COUNTER_MAX) {
            self.beacon_slot.set(key, packed + (1 << shift));
        }
        nativeReserve((grows ? PS_REACT_LEAF_ENDOWMENT : 0) + myStorageDue(), ReserveAtMost | ReserveAddOriginalBalance);
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
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
            let mask: Int = 0;
            let rows: Builder = beginCell();
            let i: Int = 0;
            while (i < chunk) {
                let e: PublicEntry? = self.entries.get(first + i);
                if (e != null && e!!.hidden) { mask = mask | (1 << i); }
                rows = rows.storeUint(e == null ? 0 : e!!.body_commit, 256)
                           .storeUint(e == null ? 0 : e!!.created_at, 64)
                           .storeUint(e == null ? 0 : self.publisherTag(e!!.publisher), 128);
                i = i + 1;
            }
            let b: Builder = beginCell().storeUint(mask, 2).storeBuilder(rows);
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

    fun packIds(start: Int, n: Int): Cell {
        let cell: Cell = beginCell().endCell();
        let isTail: Bool = true;
        let remaining: Int = n;
        while (remaining > 0) {
            let chunk: Int = min(remaining, PS_IDS_PER_CELL);
            let first: Int = start + remaining - chunk;
            let b: Builder = beginCell();
            let i: Int = 0;
            while (i < chunk) {
                b = b.storeUint(self.beacon_slot.get(PS_HIDDEN_DOMAIN + first + i)!!, 32);
                i = i + 1;
            }
            if (isTail) { cell = b.endCell(); isTail = false; }
            else { cell = b.storeRef(cell).endCell(); }
            remaining = remaining - chunk;
        }
        return cell;
    }

    get fun get_hidden_ids(from_index: Int, max_count: Int): HiddenIds {
        let start: Int = max(from_index, 0);
        let available: Int = self.hidden_count > start ? self.hidden_count - start : 0;
        let n: Int = max(0, min(min(max_count, PS_HIDDEN_PAGE_CAP), available));
        return HiddenIds{ count: self.hidden_count, returned: n, ids: self.packIds(start, n) };
    }

    fun packReactions(start: Int, n: Int): Cell {
        let tail: Cell? = null;
        let i: Int = n - 1;
        while (i >= 0) {
            let b: Builder = beginCell();
            let g: Int = 0;
            while (g < PS_REACTION_GROUPS) {
                let p: Int? = self.beacon_slot.get(PS_REACTION_DOMAIN + (start + i) * PS_REACTION_GROUPS + g);
                let packed: Int = p == null ? 0 : p!!;
                let e: Int = 0;
                while (e < PS_REACTION_PER_LEAF) {
                    b = b.storeUint((packed >> (e * 32)) & PS_REACTION_COUNTER_MAX, 32);
                    e = e + 1;
                }
                g = g + 1;
            }
            if (tail != null) { b = b.storeRef(tail!!); }
            tail = b.endCell();
            i = i - 1;
        }
        return tail == null ? beginCell().endCell() : tail!!;
    }

    get fun get_reactions(from_target: Int, max_count: Int): ReactionRows {
        let start: Int = max(from_target, 0);
        let available: Int = self.entry_count > start ? self.entry_count - start : 0;
        let n: Int = max(0, min(min(max_count, PS_REACTION_PAGE_CAP), available));
        return ReactionRows{ from_target: start, count: n, entry_count: self.entry_count, rows: self.packReactions(start, n) };
    }

    get fun get_entry(entry_id: Int): PublicEntryView {
        let e: PublicEntry? = self.entries.get(entry_id);
        if (e == null) {
            return PublicEntryView{ exists: false, publisher: myAddress(), body_commit: 0, created_at: 0, hidden: false };
        }
        let v: PublicEntry = e!!;
        return PublicEntryView{ exists: true, publisher: v.publisher, body_commit: v.body_commit, created_at: v.created_at, hidden: v.hidden };
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
            fee_sink: self.mySink(),
        };
    }
}
