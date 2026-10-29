
const SPLIT_BASE_BPS: Int = 10000;
const TREASURY_SHARE_BPS: Int = 5000;
const FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE: Int = 400000;

const FEEACCUMULATOR_STORAGE_FLOOR: Int = 1000000;
const FEEACCUMULATOR_SPLIT_EXEC_RESERVE: Int = 2000000;
const FEEACCUMULATOR_FLUSH_EXEC_RESERVE: Int = 5000000;
const FEEACCUMULATOR_MIN_TREASURY_FLUSH_TON: Int = FEEACCUMULATOR_FLUSH_EXEC_RESERVE;
const BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE: Int = 2000000;
const BUYBACK_FUNDING_ENVELOPE_NANOTONS: Int = 51050000000;

message(0xFF775609) DepositProtocolFee {
    amount: Int as uint128;
}

message(0x7B24EA03) SplitAccumulated {}

message(0x8D8F2C18) EnableBuybackSplit {}

message(0xDDAB4641) FlushTreasuryDue {
    amount: Int as uint128;
}

message(0xB3D2C52D) FlushBuybackDue {
    amount: Int as uint128;
}

message(0x87A2D2C7) TopUpStorageReserve {}

message(0x5357554E) SweepUnaccounted {}

message(0x594BA505) AcceptBurnReserve {
    amount: Int as uint128;
}

const FEEACCUMULATOR_CAPSULE_FEE_EXEC_RESERVE: Int = 2600000;
const FEEACCUMULATOR_TICKET_CREDIT_VALUE: Int = 600000;
const FEEACCUMULATOR_ACCRUE_LEG_VALUE: Int = 60000000;
const FEEACCUMULATOR_REDEEM_EXEC_RESERVE: Int = 2000000;

message(0x52535046) DepositCapsuleFee {
    amount: Int as uint128;
    lane: Int as uint8;
    init_arg0: Int as int257;
    init_arg1: Int as int257;
    publisher: Address;
}

message(0x41544331) TicketCredit {}

message(0x41544333) TicketRedeem {
    credits_k: Int as uint32;
    owner: Address;
}

message(0x41544334) TicketRedeemAck {
    credits_k: Int as uint32;
}

const AIRDROP_MAX_CREDITS_PER_ACCRUAL_MIRROR: Int = 1000;
const FEEACCUMULATOR_BUYBACK_REMAINDER_INACTIVITY: Int = 31536000;

message(0x41445214) ReclassifyStuckBuybackRemainder {}

message(0x41445210) AirdropAccrue {
    purchase_id: Int as uint64;
    buyer: Address;
    credits_k: Int as uint32;
}

message(0xFA110001) BindShardCode { shard_code: Cell }
message(0xFA110002) BindTicketCode { ticket_code: Cell }
message(0xFA110004) BindIntroShardCode { intro_shard_code: Cell }
message(0xFA110003) BindAirdropPool { airdrop_pool_address: Address }
message(0xFA110005) BindPublicShardCode { public_shard_code: Cell }

struct FeeAccumulatorStateView {
    accumulated_ton: Int;
    treasury_due_ton: Int;
    buyback_due_ton: Int;
    buyback_split_enabled: Bool;
    treasury_receiver_address: Address;
    buyback_burn_address: Address;
    storage_reserve_ton: Int;
    buyback_due_last_increase_at: Int;
    failed_accrual_count: Int;
    last_failed_accrual_purchase_id: Int;
    shard_code_bound: Bool;
    intro_shard_code_bound: Bool;
    public_shard_code_bound: Bool;
    ticket_code_bound: Bool;
    airdrop_pool_bound: Bool;
}

contract FeeAccumulator {
    treasury_receiver_address: Address;
    buyback_burn_address: Address;
    accumulated_ton: Int as uint128;
    treasury_due_ton: Int as uint128;
    buyback_due_ton: Int as uint128;
    buyback_split_enabled: Bool;
    storage_reserve_ton: Int as coins;
    buyback_due_last_increase_at: Int as uint64;
    failed_accrual_count: Int as uint32;
    last_failed_accrual_purchase_id: Int as uint64;
    shard_code: Cell?;
    intro_shard_code: Cell?;
    ticket_code: Cell?;
    airdrop_pool_address: Address?;
    public_shard_code: Cell?;
    accrual_seq: Int as uint64;

    init(treasury_receiver_address: Address, buyback_burn_address: Address) {
        self.shard_code = null;
        self.intro_shard_code = null;
        self.ticket_code = null;
        self.airdrop_pool_address = null;
        self.public_shard_code = null;
        self.accrual_seq = 0;
        self.treasury_receiver_address = treasury_receiver_address;
        self.buyback_burn_address = buyback_burn_address;
        self.accumulated_ton = 0;
        self.treasury_due_ton = 0;
        self.buyback_due_ton = 0;
        self.buyback_split_enabled = false;
        self.storage_reserve_ton = 0;
        self.buyback_due_last_increase_at = 0;
        self.failed_accrual_count = 0;
        self.last_failed_accrual_purchase_id = 0;
    }

    receive(msg: DepositProtocolFee) {
        throwUnless(15001, msg.amount > 0);
        throwUnless(15002, context().value >= msg.amount + FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE);

        self.accumulated_ton += msg.amount;
    }

    fun requireTreasury() {
        throwUnless(15050, sender() == self.treasury_receiver_address);
    }

    receive(msg: BindShardCode) {
        self.requireTreasury();
        throwUnless(15051, self.shard_code == null);
        self.shard_code = msg.shard_code;
    }

    receive(msg: BindIntroShardCode) {
        self.requireTreasury();
        throwUnless(15057, self.intro_shard_code == null);
        self.intro_shard_code = msg.intro_shard_code;
    }

    receive(msg: BindTicketCode) {
        self.requireTreasury();
        throwUnless(15052, self.ticket_code == null);
        self.ticket_code = msg.ticket_code;
    }

    receive(msg: BindAirdropPool) {
        self.requireTreasury();
        throwUnless(15053, self.airdrop_pool_address == null);
        self.airdrop_pool_address = msg.airdrop_pool_address;
    }

    receive(msg: BindPublicShardCode) {
        self.requireTreasury();
        throwUnless(15059, self.public_shard_code == null);
        self.public_shard_code = msg.public_shard_code;
    }

    fun deriveFromBoundCode(code: Cell, data: Cell): Address {
        return contractAddressExt(0, code, data);
    }

    fun laneShardAddress(lane: Int, arg0: Int, arg1: Int): Address {
        let code: Cell = lane == 0 ? self.shard_code!! : (lane == 1 ? self.intro_shard_code!! : self.public_shard_code!!);
        return self.deriveFromBoundCode(code, beginCell()
            .storeUint(0, 1)
            .storeInt(arg0, 257)
            .storeInt(arg1, 257)
            .endCell());
    }

    fun laneCodeBound(lane: Int): Bool {
        return lane == 0 ? self.shard_code != null : (lane == 1 ? self.intro_shard_code != null : self.public_shard_code != null);
    }

    fun ticketAddress(owner: Address): Address {
        return self.deriveFromBoundCode(self.ticket_code!!, beginCell()
            .storeUint(0, 1)
            .storeAddress(owner)
            .endCell());
    }

    receive(msg: DepositCapsuleFee) {
        throwUnless(15054, msg.amount > 0);
        throwUnless(15058, msg.lane >= 0 && msg.lane <= 2);
        throwUnless(15055, self.laneCodeBound(msg.lane)
            && sender() == self.laneShardAddress(msg.lane, msg.init_arg0, msg.init_arg1));
        throwUnless(15056, context().value >= msg.amount + FEEACCUMULATOR_CAPSULE_FEE_EXEC_RESERVE);

        self.accumulated_ton += msg.amount;

        if (self.ticket_code != null) {
            let data: Cell = beginCell().storeUint(0, 1).storeAddress(msg.publisher).endCell();
            send(SendParameters {
                to: self.ticketAddress(msg.publisher),
                value: FEEACCUMULATOR_TICKET_CREDIT_VALUE,
                mode: SendPayGasSeparately,
                bounce: false,
                code: self.ticket_code!!,
                data: data,
                body: TicketCredit{}.toCell(),
            });
        }
    }

    receive(msg: TicketRedeem) {
        throwUnless(15060, self.ticket_code != null && self.airdrop_pool_address != null);
        throwUnless(15061, sender() == self.ticketAddress(msg.owner));
        throwUnless(15062, msg.credits_k > 0 && msg.credits_k <= AIRDROP_MAX_CREDITS_PER_ACCRUAL_MIRROR);
        throwUnless(15063, context().value >= FEEACCUMULATOR_ACCRUE_LEG_VALUE + FEEACCUMULATOR_REDEEM_EXEC_RESERVE);

        self.accrual_seq += 1;
        message(MessageParameters {
            to: self.airdrop_pool_address!!,
            value: FEEACCUMULATOR_ACCRUE_LEG_VALUE,
            mode: SendPayGasSeparately,
            bounce: true,
            body: AirdropAccrue{ purchase_id: self.accrual_seq, buyer: msg.owner, credits_k: msg.credits_k }.toCell(),
        });
        message(MessageParameters {
            to: sender(),
            value: context().value - FEEACCUMULATOR_ACCRUE_LEG_VALUE - FEEACCUMULATOR_REDEEM_EXEC_RESERVE,
            mode: SendPayGasSeparately,
            bounce: false,
            body: TicketRedeemAck{ credits_k: msg.credits_k }.toCell(),
        });
    }

    receive(msg: SplitAccumulated) {
        throwUnless(15010, self.accumulated_ton > 0);
        throwUnless(15011, context().value >= FEEACCUMULATOR_SPLIT_EXEC_RESERVE);

        let amount: Int = self.accumulated_ton;
        if (!self.buyback_split_enabled) {
            self.accumulated_ton = 0;
            self.treasury_due_ton += amount;
            return;
        }

        let treasury_amount: Int = (amount * TREASURY_SHARE_BPS) / SPLIT_BASE_BPS;
        let buyback_amount: Int = amount - treasury_amount;

        self.accumulated_ton = 0;
        self.treasury_due_ton += treasury_amount;
        self.buyback_due_ton += buyback_amount;
        self.buyback_due_last_increase_at = now();
    }

    receive(msg: EnableBuybackSplit) {
        throwUnless(15012, sender() == self.treasury_receiver_address);
        throwUnless(15013, !self.buyback_split_enabled);
        throwUnless(15014, context().value >= FEEACCUMULATOR_SPLIT_EXEC_RESERVE);

        if (self.accumulated_ton > 0) {
            self.treasury_due_ton += self.accumulated_ton;
            self.accumulated_ton = 0;
        }
        self.buyback_split_enabled = true;
    }

    receive(msg: FlushTreasuryDue) {
        throwUnless(15020, msg.amount > 0);
        throwUnless(15021, msg.amount <= self.treasury_due_ton);
        throwUnless(15023, msg.amount >= FEEACCUMULATOR_MIN_TREASURY_FLUSH_TON || msg.amount == self.treasury_due_ton);
        throwUnless(15022, context().value >= FEEACCUMULATOR_FLUSH_EXEC_RESERVE);

        self.treasury_due_ton -= msg.amount;

        message(MessageParameters {
            to: self.treasury_receiver_address,
            value: msg.amount,
            bounce: false,
            mode: SendPayFwdFeesSeparately,
            body: null
        });

        let flushChange: Int = context().value - FEEACCUMULATOR_FLUSH_EXEC_RESERVE;
        if (flushChange > 0) {
            message(MessageParameters {
                to: sender(),
                value: flushChange,
                bounce: false,
                mode: SendPayFwdFeesSeparately | SendIgnoreErrors,
                body: null
            });
        }
    }

    receive(msg: FlushBuybackDue) {
        throwUnless(15030, msg.amount > 0);
        throwUnless(15034, msg.amount == BUYBACK_FUNDING_ENVELOPE_NANOTONS);
        throwUnless(15031, msg.amount <= self.buyback_due_ton);
        throwUnless(15035, context().value >= FEEACCUMULATOR_FLUSH_EXEC_RESERVE + BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE);

        self.buyback_due_ton -= msg.amount;

        message(MessageParameters {
            to: self.buyback_burn_address,
            value: msg.amount + BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: AcceptBurnReserve { amount: msg.amount }.toCell()
        });

        let buybackChange: Int = context().value - FEEACCUMULATOR_FLUSH_EXEC_RESERVE - BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE;
        if (buybackChange > 0) {
            message(MessageParameters {
                to: sender(),
                value: buybackChange,
                bounce: false,
                mode: SendPayFwdFeesSeparately | SendIgnoreErrors,
                body: null
            });
        }
    }

    bounced(msg: bounced<AcceptBurnReserve>) {
        throwUnless(15032, sender() == self.buyback_burn_address);
        throwUnless(15033, msg.amount > 0);
        self.buyback_due_ton += msg.amount;
        self.buyback_due_last_increase_at = now();
    }

    receive(_: ReclassifyStuckBuybackRemainder) {
        throwUnless(15070, self.buyback_due_ton > 0);
        throwUnless(15071, self.buyback_due_ton < BUYBACK_FUNDING_ENVELOPE_NANOTONS);
        throwUnless(15072, now() > self.buyback_due_last_increase_at + FEEACCUMULATOR_BUYBACK_REMAINDER_INACTIVITY);
        self.treasury_due_ton += self.buyback_due_ton;
        self.buyback_due_ton = 0;
    }

    bounced(msg: bounced<AirdropAccrue>) {
        self.failed_accrual_count += 1;
        self.last_failed_accrual_purchase_id = msg.purchase_id;
    }

    receive(msg: TopUpStorageReserve) {
        self.storage_reserve_ton += context().value;
    }

    receive(msg: SweepUnaccounted) {
        let held: Int = myBalance() - context().value;
        let accounted: Int = self.accumulated_ton + self.treasury_due_ton + self.buyback_due_ton
            + self.storage_reserve_ton;
        throwUnless(15040, held > accounted + FEEACCUMULATOR_STORAGE_FLOOR);
        self.accumulated_ton += held - accounted - FEEACCUMULATOR_STORAGE_FLOOR;

        nativeReserve(held, ReserveAtMost);
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    get fun get_state(): FeeAccumulatorStateView {
        return FeeAccumulatorStateView {
            accumulated_ton: self.accumulated_ton,
            treasury_due_ton: self.treasury_due_ton,
            buyback_due_ton: self.buyback_due_ton,
            buyback_split_enabled: self.buyback_split_enabled,
            treasury_receiver_address: self.treasury_receiver_address,
            buyback_burn_address: self.buyback_burn_address,
            storage_reserve_ton: self.storage_reserve_ton,
            buyback_due_last_increase_at: self.buyback_due_last_increase_at,
            failed_accrual_count: self.failed_accrual_count,
            last_failed_accrual_purchase_id: self.last_failed_accrual_purchase_id,
            shard_code_bound: self.shard_code != null,
            intro_shard_code_bound: self.intro_shard_code != null,
            public_shard_code_bound: self.public_shard_code != null,
            ticket_code_bound: self.ticket_code != null,
            airdrop_pool_bound: self.airdrop_pool_address != null
        };
    }

    receive() {
        throw(15099);
    }
}
