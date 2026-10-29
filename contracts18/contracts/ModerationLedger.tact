import "./gate-wire.tact";

const ML_THRESHOLD: Int = 3;
const ML_ROOT_COUNT: Int = 5;
const ML_PROPOSAL_TTL: Int = 2592000;
const ML_VERDICTS_PER_DAY: Int = 500;
const ML_VERDICT_GAS_UNITS: Int = 50000;
const ML_RELAY_FWD_CELLS: Int = 22;
const ML_RELAY_FWD_BITS: Int = 11000;
const ML_COUNCIL_GAS_UNITS: Int = 44000;
const ML_PROPOSAL_ENDOWMENT: Int = 50000;
const ML_HANDOVER_GAS_UNITS: Int = 20000;
const ML_FLOAT: Int = 2200000000;
const ML_ENTRY_FORWARD: Int = 10450000;
const ML_WALLET_FORWARD: Int = 4500000;
const ML_REVIEW_FORWARD: Int = 3300000;
const ML_REASON_COUNT: Int = 16;
const ML_MODERATORS_PER_CALL: Int = 48;
const ML_ADDRESSES_PER_CELL: Int = 3;

const ML_KIND_REPLACE_ROOT: Int = 1;
const ML_KIND_ADD_MODERATOR: Int = 2;
const ML_KIND_REMOVE_MODERATOR: Int = 3;
const ML_KIND_SET_LEDGER: Int = 4;
const ML_KIND_SWEEP_GATE: Int = 5;
const ML_KIND_ACCEPT_GATE: Int = 6;
const ML_KIND_WITHDRAW: Int = 7;

message(0x4D4C5031) Propose {
    kind: Int as uint8;
    a: Address;
    b: Address;
}
message(0x4D4C4131) Approve {
    proposer: Address;
    kind: Int as uint8;
    a: Address;
    b: Address;
}
message(0x4D4C5631) Verdict {
    action: Int as uint8;
    reason: Int as uint8;
    shard: Address?;
    entry_id: Int as uint32;
    key: Int as uint256;
}

struct Proposal {
    kind: Int as uint8;
    a: Address;
    b: Address;
    created_at: Int as uint32;
    second: Address?;
}

struct ProposalView {
    exists: Bool;
    kind: Int;
    a: Address;
    b: Address;
    created_at: Int;
    expires_at: Int;
    seconded_by: Address?;
}

struct LedgerView {
    root_count: Int;
    moderator_count: Int;
    threshold: Int;
    proposal_ttl: Int;
    verdicts_per_day: Int;
    entry_min_value: Int;
    wallet_min_value: Int;
    review_min_value: Int;
    council_min_value: Int;
    gate: Address;
}

struct AddressList {
    count: Int;
    list: Cell;
}

contract ModerationLedger {
    roots: map<Address, Bool>;
    moderators: map<Address, Bool>;
    moderator_count: Int as uint32;
    proposals: map<Address, Proposal>;
    quota: map<Address, Int as uint64>;
    sanction_code: Cell;

    init(root_a: Address, root_b: Address, root_c: Address, root_d: Address, root_e: Address, sanction_code: Cell) {
        throwUnless(29060, sanction_code.hash() == SS_CODE_HASH);
        throwUnless(29001, root_a != root_b && root_a != root_c && root_a != root_d && root_a != root_e
            && root_b != root_c && root_b != root_d && root_b != root_e
            && root_c != root_d && root_c != root_e && root_d != root_e);
        throwUnless(29002, root_a.asSlice().preloadUint(11) == 1024 && root_b.asSlice().preloadUint(11) == 1024
            && root_c.asSlice().preloadUint(11) == 1024 && root_d.asSlice().preloadUint(11) == 1024
            && root_e.asSlice().preloadUint(11) == 1024);
        self.roots = emptyMap();
        self.roots.set(root_a, true);
        self.roots.set(root_b, true);
        self.roots.set(root_c, true);
        self.roots.set(root_d, true);
        self.roots.set(root_e, true);
        self.moderators = emptyMap();
        self.moderator_count = 0;
        self.proposals = emptyMap();
        self.quota = emptyMap();
        self.sanction_code = sanction_code;
    }

    fun sanctionInit(wallet: Int): StateInit {
        let data: Cell = beginCell().storeUint(0, 1).storeAddress(moderationGateAddress()).storeInt(wallet, 257).endCell();
        return StateInit{ code: self.sanction_code, data: data };
    }

    fun isBasechain(a: Address): Bool { return a.asSlice().preloadUint(11) == 1024; }
    fun isRoot(a: Address): Bool { return self.roots.get(a) != null; }
    fun isModerator(a: Address): Bool { return self.moderators.get(a) != null; }

    fun validate(p: Proposal) {
        if (p.kind == ML_KIND_REPLACE_ROOT) {
            throwUnless(29021, self.isRoot(p.a));
            throwUnless(29022, !self.isRoot(p.b));
            throwUnless(29024, self.isBasechain(p.b));
        } else if (p.kind == ML_KIND_ADD_MODERATOR) {
            throwUnless(29025, !self.isModerator(p.a));
            throwUnless(29026, self.isBasechain(p.a));
        } else if (p.kind == ML_KIND_REMOVE_MODERATOR) {
            throwUnless(29027, self.isModerator(p.a));
        } else if (p.kind == ML_KIND_SET_LEDGER || p.kind == ML_KIND_SWEEP_GATE || p.kind == ML_KIND_WITHDRAW) {
            throwUnless(29029, self.isBasechain(p.a));
        } else if (p.kind == ML_KIND_ACCEPT_GATE) {
            throwUnless(29030, p.a == myAddress());
        } else {
            throwUnless(29028, false);
        }
    }

    fun execute(p: Proposal) {
        if (p.kind == ML_KIND_REPLACE_ROOT) {
            self.roots.del(p.a);
            self.roots.set(p.b, true);
        } else if (p.kind == ML_KIND_ADD_MODERATOR) {
            self.moderators.set(p.a, true);
            self.moderator_count = self.moderator_count + 1;
        } else if (p.kind == ML_KIND_REMOVE_MODERATOR) {
            self.moderators.del(p.a);
            self.quota.del(p.a);
            self.moderator_count = self.moderator_count - 1;
        } else if (p.kind == ML_KIND_SET_LEDGER) {
            self.tellGate(SetLedger{ ledger: p.a }.toCell());
        } else if (p.kind == ML_KIND_ACCEPT_GATE) {
            self.tellGate(AcceptLedger{}.toCell());
        } else if (p.kind == ML_KIND_SWEEP_GATE) {
            self.tellGate(SweepGate{ to: p.a }.toCell());
        } else {
            let surplus: Int = myBalance() - context().value - ML_FLOAT - myStorageDue();
            if (surplus > 0) {
                send(SendParameters{ to: p.a, value: surplus, mode: SendPayFwdFeesSeparately, bounce: false });
            }
        }
    }

    fun verdictOwnCost(): Int {
        return getComputeFee(ML_VERDICT_GAS_UNITS, false) + getForwardFee(ML_RELAY_FWD_CELLS, ML_RELAY_FWD_BITS, false);
    }

    fun councilMin(): Int {
        return getComputeFee(ML_COUNCIL_GAS_UNITS, false);
    }

    fun tellGate(body: Cell) {
        send(SendParameters{
            to: moderationGateAddress(),
            value: getComputeFee(ML_HANDOVER_GAS_UNITS, false),
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: body,
        });
    }

    fun settle(keep: Int) {
        nativeReserve(keep + myStorageDue(), ReserveAtMost | ReserveAddOriginalBalance);
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    fun settleExact(keep: Int) {
        nativeReserve(keep + myStorageDue(), ReserveAtMost);
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    receive(msg: Propose) {
        throwUnless(29020, self.isRoot(sender()));
        throwUnless(29031, context().value >= self.councilMin());
        let p: Proposal = Proposal{ kind: msg.kind, a: msg.a, b: msg.b, created_at: now(), second: null };
        self.validate(p);
        self.proposals.set(sender(), p);
        self.settle(ML_PROPOSAL_ENDOWMENT);
    }

    receive(msg: Approve) {
        throwUnless(29040, self.isRoot(sender()));
        throwUnless(29041, sender() != msg.proposer);
        throwUnless(29042, self.isRoot(msg.proposer));
        let open: Proposal? = self.proposals.get(msg.proposer);
        throwUnless(29043, open != null);
        let p: Proposal = open!!;
        throwUnless(29044, now() <= p.created_at + ML_PROPOSAL_TTL);
        throwUnless(29045, context().value >= self.councilMin());
        throwUnless(29046, p.kind == msg.kind && p.a == msg.a && p.b == msg.b);
        if (p.second == null) {
            self.proposals.set(msg.proposer, Proposal{ kind: p.kind, a: p.a, b: p.b, created_at: p.created_at,
                second: sender() });
            self.settle(0);
            return;
        }
        throwUnless(29047, sender() != p.second!!);
        self.execute(p);
        self.proposals = emptyMap();
        if (p.kind == ML_KIND_WITHDRAW) { self.settleExact(ML_FLOAT); } else { self.settle(0); }
    }

    receive(msg: Verdict) {
        throwUnless(29050, self.isModerator(sender()));
        throwUnless(29051, msg.action >= MS_ACTION_HIDE_ENTRY && msg.action <= MS_ACTION_UNWARN_WALLET);
        throwUnless(29052, msg.reason < ML_REASON_COUNT);
        let entryAction: Bool = msg.action <= MS_ACTION_UNHIDE_ENTRY;
        let walletAction: Bool = (msg.action >= MS_ACTION_WARN_WALLET && msg.action <= MS_ACTION_UNRESTRICT_WALLET) || msg.action == MS_ACTION_UNWARN_WALLET;
        throwUnless(29053, entryAction
            ? (msg.shard != null && self.isBasechain(msg.shard!!) && msg.key == 0)
            : (walletAction
                ? (msg.shard == null && msg.key > 0 && msg.entry_id == 0)
                : (msg.shard != null && self.isBasechain(msg.shard!!) && msg.key > 0 && msg.entry_id == 0)));
        let forwardMin: Int = entryAction ? ML_ENTRY_FORWARD : (walletAction ? ML_WALLET_FORWARD : ML_REVIEW_FORWARD);
        let ownCost: Int = self.verdictOwnCost();
        throwUnless(29054, context().value >= ownCost + forwardMin + myStorageDue());
        let forward: Int = context().value - ownCost - myStorageDue();
        let q: Int? = self.quota.get(sender());
        let lastAt: Int = q != null ? (q!! >> 32) : now();
        let usedMilli: Int = q != null ? (q!! & 4294967295) : 0;
        let elapsed: Int = now() > lastAt ? now() - lastAt : 0;
        let refill: Int = elapsed * (ML_VERDICTS_PER_DAY * 1000) / 86400;
        usedMilli = usedMilli > refill ? usedMilli - refill : 0;
        throwUnless(29055, usedMilli + 1000 <= ML_VERDICTS_PER_DAY * 1000);
        self.quota.set(sender(), (now() << 32) | (usedMilli + 1000));
        let gate: Address = moderationGateAddress();
        if (entryAction) {
            self.relay(gate, forward, Forward{
                to: msg.shard!!, code: null, data: null,
                body: SetEntryHidden{ entry_id: msg.entry_id, hidden: msg.action == MS_ACTION_HIDE_ENTRY, reason: msg.reason, refund_to: sender() }.toCell(),
            });
        } else if (walletAction) {
            let lifts: Bool = msg.action == MS_ACTION_UNRESTRICT_WALLET || msg.action == MS_ACTION_UNWARN_WALLET;
            let init: StateInit = self.sanctionInit(msg.key);
            self.relay(gate, forward, Forward{
                to: contractAddress(init), code: lifts ? null : init.code, data: lifts ? null : init.data,
                body: SetWalletSanction{ wallet: msg.key, action: msg.action, reason: msg.reason, refund_to: sender() }.toCell(),
            });
        } else {
            self.relay(gate, forward, Forward{
                to: msg.shard!!, code: null, data: null,
                body: MarkReviewed{ row_key: msg.key, refund_to: sender() }.toCell(),
            });
        }
        self.settle(0);
    }

    fun relay(gate: Address, value: Int, msg: Forward) {
        send(SendParameters{ to: gate, value: value, mode: SendPayFwdFeesSeparately, bounce: true, body: msg.toCell() });
    }

    receive() {}

    fun packAddresses(selected: map<Int as uint32, Address>, n: Int): Cell {
        let cell: Cell = beginCell().endCell();
        let isTail: Bool = true;
        let remaining: Int = n;
        while (remaining > 0) {
            let chunk: Int = min(remaining, ML_ADDRESSES_PER_CELL);
            let first: Int = remaining - chunk;
            let b: Builder = beginCell();
            let i: Int = 0;
            while (i < chunk) {
                b = b.storeAddress(selected.get(first + i)!!);
                i = i + 1;
            }
            if (isTail) { cell = b.endCell(); isTail = false; }
            else { cell = b.storeRef(cell).endCell(); }
            remaining = remaining - chunk;
        }
        return cell;
    }

    get fun get_view(): LedgerView {
        return LedgerView{
            root_count: ML_ROOT_COUNT,
            moderator_count: self.moderator_count,
            threshold: ML_THRESHOLD,
            proposal_ttl: ML_PROPOSAL_TTL,
            verdicts_per_day: ML_VERDICTS_PER_DAY,
            entry_min_value: self.verdictOwnCost() + ML_ENTRY_FORWARD,
            wallet_min_value: self.verdictOwnCost() + ML_WALLET_FORWARD,
            review_min_value: self.verdictOwnCost() + ML_REVIEW_FORWARD,
            council_min_value: self.councilMin(),
            gate: moderationGateAddress(),
        };
    }

    get fun is_root(a: Address): Bool { return self.isRoot(a); }
    get fun is_moderator(a: Address): Bool { return self.isModerator(a); }

    get fun get_roots(): AddressList {
        let selected: map<Int as uint32, Address> = emptyMap();
        let n: Int = 0;
        foreach (root, flag in self.roots) {
            selected.set(n, root);
            n = n + 1;
        }
        return AddressList{ count: n, list: self.packAddresses(selected, n) };
    }

    get fun get_moderators(from: Int, max_count: Int): AddressList {
        let selected: map<Int as uint32, Address> = emptyMap();
        let seen: Int = 0;
        let n: Int = 0;
        let cap: Int = max(0, min(max_count, ML_MODERATORS_PER_CALL));
        foreach (moderator, flag in self.moderators) {
            if (seen >= from && n < cap) {
                selected.set(n, moderator);
                n = n + 1;
            }
            seen = seen + 1;
        }
        return AddressList{ count: n, list: self.packAddresses(selected, n) };
    }

    get fun get_proposal(proposer: Address): ProposalView {
        let open: Proposal? = self.proposals.get(proposer);
        if (open == null) {
            return ProposalView{ exists: false, kind: 0, a: proposer, b: proposer, created_at: 0, expires_at: 0, seconded_by: null };
        }
        let p: Proposal = open!!;
        return ProposalView{ exists: true, kind: p.kind, a: p.a, b: p.b, created_at: p.created_at, expires_at: p.created_at + ML_PROPOSAL_TTL, seconded_by: p.second };
    }

    get fun sanction_shard(wallet: Int): Address {
        return contractAddress(self.sanctionInit(wallet));
    }

    get fun sanction_code_hash(): Int { return self.sanction_code.hash(); }

    get fun quota(a: Address): Int {
        let q: Int? = self.quota.get(a);
        return q != null ? q!! : 0;
    }
}
