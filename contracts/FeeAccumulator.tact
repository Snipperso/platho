// Platho v1 FeeAccumulator milestone implementation.
// Scope: immutable Treasury/BuybackBurn addresses, permissionless protocol fee deposit,
// bootstrap treasury/liquidity reserve split, exact buyback split after one-way enable,
// treasury due flush, buyback due flush with bounce recovery.
// No override/pause/upgrade/governance/rescue/fallback behavior is implemented.

const SPLIT_BASE_BPS: Int = 10000;
const TREASURY_SHARE_BPS: Int = 5000;
// What a depositor must bring ON TOP of the principal, to fund this contract's own execution.
//
// WAS 2_000_000, AND THAT NUMBER DECIDED AN ARCHITECTURE. It was sized for CapsuleHub, which flushes rarely and
// in large amounts, where 2 TON of slack is noise. The clean-17 shards deposit PER CAPSULE — 1.5M times over the
// airdrop — and at that rate the reserve is not slack, it is 18% of the fee. That is the only reason the shards
// were built to ACCUMULATE the fee and remit it once per shard: the accumulation existed purely to pay this
// constant once instead of a million times. [OWNER 2026-07-19: the fee must not sit in a shard at all — "в шарде
// должна быть только его рента, а моя комиссия это моя комиссия".] Fixing the constant removes the reason.
//
// MEASURED 2026-07-19 against the LIVE mainnet config, not from memory (a recalled "400 nanoton per gas unit"
// nearly caused the correct measurement to be discarded — see below):
//   config-21 basechain: flat_gas_limit 100, flat_gas_price 6667, gas_price 4369067/65536 = 66.667 nanoton/unit
//   one DepositProtocolFee: gasUsed 2986  ->  6667 + 2886 * 66.667 = 199_067 predicted
//   sandbox measurement:                                              199_068 actual
// Agreement to one nanoton, which also proves @ton/sandbox prices gas at the live mainnet rate.
//
// SIZED HIGH, WITH THE SURPLUS MADE RECOVERABLE. I first reasoned the opposite — err low, because a shortfall
// only drains this contract gradually while a surplus strands forever — and the owner corrected the premise:
//   [OWNER 2026-07-19] "Если мы ошибаемся вниз, то пользователь просто меньше платит за сообщение, а потом мне
//   из своего кармана надо оплачивать ошибку? Если так, то пусть лучше пользователь платит с запасом."
// That is right, and my version had the payer wrong. The publisher's cost is the deposit message's value, so a
// smaller reserve means the USER pays less while accumulated_ton is still credited in full — the shortfall
// lands on the owner at flush time. Erring low spends the owner's money to save the user a rounding error.
//
// So: 400_000 against a measured 199_068 (2x margin against any plausible gas repricing), and SweepUnaccounted
// below makes the leftover recoverable instead of immured. The asymmetry that made a thin margin look prudent
// is gone once the surplus has an exit.
const FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE: Int = 400000;

// A last-resort cushion the sweep never touches. Deliberate funding is now COUNTED (storage_reserve_ton) rather
// than defended by a guessed floor, so this is not the storage budget — it only guarantees the contract can still
// execute its own next transaction if genesis ever under-funded it. Kept small deliberately: an oversized floor
// silently makes small surpluses unsweepable, which is how the first attempt at this failed its own test.
const FEEACCUMULATOR_STORAGE_FLOOR: Int = 1000000;
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

message(0x5357554E) SweepUnaccounted {}   // "SWUN"

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
    storage_reserve_ton: Int;   // deliberate top-ups, tracked so SweepUnaccounted cannot mistake them for surplus
}

contract FeeAccumulator {
    treasury_receiver_address: Address;
    buyback_burn_address: Address;
    accumulated_ton: Int as uint128;
    treasury_due_ton: Int as uint128;
    buyback_due_ton: Int as uint128;
    buyback_split_enabled: Bool;
    storage_reserve_ton: Int as coins;

    init(treasury_receiver_address: Address, buyback_burn_address: Address) {
        self.treasury_receiver_address = treasury_receiver_address;
        self.buyback_burn_address = buyback_burn_address;
        self.accumulated_ton = 0;
        self.treasury_due_ton = 0;
        self.buyback_due_ton = 0;
        self.buyback_split_enabled = false;
        self.storage_reserve_ton = 0;
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
        // COUNTED, because SweepUnaccounted must be able to tell a deliberate top-up from deposit surplus.
        // Leaving it untracked reproduced a defect this project has already made twice: a balance-derived
        // sweep that cannot see intent carries off money somebody meant to leave behind. Caught here by
        // tests/shard-fee-passthrough.test.ts PT-09, where the sweep ate the fixture's own 1 GRAM of funding.
        // It never decreases as rent consumes it, so the figure only ever over-protects — the sweep
        // under-credits rather than over-credits, which is the safe direction.
        self.storage_reserve_ton += context().value;
    }

    // RECLAIM THE UNACCOUNTED BALANCE. Every deposit arrives carrying FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE on top
    // of its principal, and only the principal is booked; the difference between that reserve and the gas
    // actually burnt settles here as raw balance. Before this receiver existed there was no path out of it at
    // all — FlushTreasuryDue can only send what SplitAccumulated moved into treasury_due_ton, which only ever
    // comes from a declared deposit amount. Across the airdrop's 1.5M capsules that would have immured a few
    // hundred GRAM of the owner's own money.
    // [OWNER 2026-07-19, on the surplus: "разве нельзя вывести и излишки, если они будут?"] Now it can: this
    // credits it to accumulated_ton, from which it splits and flushes like any other protocol fee.
    //
    // PERMISSIONLESS ON PURPOSE, and safe because it cannot move value ANYWHERE. It only relabels balance this
    // contract already holds from "unaccounted" to "accumulated" — both of which are the owner's. A caller can
    // only pay gas to do the owner a favour. It also cannot over-credit: the floor is subtracted first and the
    // gate refuses unless there is a genuine surplus above every accounted bucket, so an under-funded contract
    // (the case where deposits cost more gas than their reserve) simply refuses instead of inventing money.
    receive(msg: SweepUnaccounted) {
        let held: Int = myBalance() - context().value;
        let accounted: Int = self.accumulated_ton + self.treasury_due_ton + self.buyback_due_ton
            + self.storage_reserve_ton;
        throwUnless(15040, held > accounted + FEEACCUMULATOR_STORAGE_FLOOR);
        self.accumulated_ton += held - accounted - FEEACCUMULATOR_STORAGE_FLOOR;

        // RETURN THE CALLER'S CHANGE, which also makes the operation IDEMPOTENT. Without this the caller's own
        // attached value stays behind as fresh unaccounted balance, so the very next sweep finds a "surplus"
        // that is really just the previous caller's gas money — the call would never settle, and repeating it
        // would quietly convert callers' funds into the owner's bucket. Reserving exactly what the contract
        // already held before this message means mode-128 hands back the attached value less gas.
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
            storage_reserve_ton: self.storage_reserve_ton
        };
    }

    receive() {
        // No fallback behavior. Empty inbound messages are rejected.
        throw(15099);
    }
}
