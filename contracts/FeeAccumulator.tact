// Platho v1 FeeAccumulator milestone implementation.
// Scope: immutable Treasury/BuybackBurn addresses, permissionless protocol fee deposit,
// bootstrap treasury/liquidity reserve split, exact buyback split after one-way enable,
// treasury due flush, buyback due flush with bounce recovery.
// No override/pause/upgrade/governance/rescue/fallback behavior is implemented.

const SPLIT_BASE_BPS: Int = 10000;
const TREASURY_SHARE_BPS: Int = 5000;
const FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE: Int = 2000000;
const FEEACCUMULATOR_SPLIT_EXEC_RESERVE: Int = 2000000;
const FEEACCUMULATOR_FLUSH_EXEC_RESERVE: Int = 5000000;
const FEEACCUMULATOR_MIN_TREASURY_FLUSH_TON: Int = FEEACCUMULATOR_FLUSH_EXEC_RESERVE;
const BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE: Int = 2000000;
// M19H BuybackBurn funding envelope: exact 50 TON offer + 1.05 TON route funding.
// FeeAccumulator must only flush complete buyback execution envelopes, not raw 50 TON offer chunks.
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

// Message body sent to BuybackBurn. Opcode matches Platho.V1.BuybackBurn.AcceptBurnReserve.
// Field order is intentional so bounced<AcceptBurnReserve> can recover amount.
message(0x594BA505) AcceptBurnReserve {
    amount: Int as uint128;
}

struct FeeAccumulatorStateView {
    accumulated_ton: Int;
    treasury_due_ton: Int;
    buyback_due_ton: Int;
    buyback_split_enabled: Bool;
    treasury_receiver_address: Address;
    buyback_burn_address: Address;
}

contract FeeAccumulator {
    treasury_receiver_address: Address;
    buyback_burn_address: Address;
    accumulated_ton: Int as uint128;
    treasury_due_ton: Int as uint128;
    buyback_due_ton: Int as uint128;
    buyback_split_enabled: Bool;

    init(treasury_receiver_address: Address, buyback_burn_address: Address) {
        self.treasury_receiver_address = treasury_receiver_address;
        self.buyback_burn_address = buyback_burn_address;
        self.accumulated_ton = 0;
        self.treasury_due_ton = 0;
        self.buyback_due_ton = 0;
        self.buyback_split_enabled = false;
    }

    receive(msg: DepositProtocolFee) {
        // Deposits are permissionless: any sender may donate protocol-fee principal.
        // Only the declared amount is credited; surplus is execution/storage reserve.
        throwUnless(15001, msg.amount > 0);
        // The declared protocol fee amount is the accounted principal.
        // Execution must be caller-funded so principal buckets remain backed after gas/fees.
        throwUnless(15002, context().value >= msg.amount + FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE);

        self.accumulated_ton += msg.amount;
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
    }

    receive(msg: FlushBuybackDue) {
        throwUnless(15030, msg.amount > 0);
        // M19H: one future BuybackBurn execution must be funded as a complete envelope.
        // 50 TON is only the STON.fi offer principal; 1.05 TON route funding is part of the protocol-owned envelope.
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
    }

    bounced(msg: bounced<AcceptBurnReserve>) {
        throwUnless(15032, sender() == self.buyback_burn_address);
        throwUnless(15033, msg.amount > 0);
        self.buyback_due_ton += msg.amount;
    }

    receive(msg: TopUpStorageReserve) {
        // Accept TON for FeeAccumulator storage reserve only. Due buckets and receivers are unchanged.
    }

    get fun get_state(): FeeAccumulatorStateView {
        return FeeAccumulatorStateView {
            accumulated_ton: self.accumulated_ton,
            treasury_due_ton: self.treasury_due_ton,
            buyback_due_ton: self.buyback_due_ton,
            buyback_split_enabled: self.buyback_split_enabled,
            treasury_receiver_address: self.treasury_receiver_address,
            buyback_burn_address: self.buyback_burn_address
        };
    }

    receive() {
        // No fallback behavior. Empty inbound messages are rejected.
        throw(15099);
    }
}
