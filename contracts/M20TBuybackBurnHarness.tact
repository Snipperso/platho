// Testnet-only M20T BuybackBurn receiver harness.
// Not part of Platho v1 production contracts.

const M20T_BUYBACK_ENVELOPE_NANOTONS: Int = 51050000000;

message(0x4D323042) M20TBindFeeAccumulator { // "M20B"
    fee_accumulator_address: Address;
}

message(0x594BA505) AcceptBurnReserve {
    amount: Int as uint128;
}

message(0x4D32544B) M20TBuybackHarnessTopUp {} // "M2TK"

struct M20TBuybackBurnHarnessStateView {
    run_id: Int;
    fee_bound: Bool;
    fee_accumulator_address: Address;
    accepted_count: Int;
    total_accepted: Int;
    last_amount: Int;
}

contract M20TBuybackBurnHarness {
    run_id: Int as uint64;
    genesis_controller_address: Address;
    fee_accumulator_address: Address;
    fee_bound: Bool;
    accepted_count: Int as uint64;
    total_accepted: Int as uint128;
    last_amount: Int as uint128;

    init(genesis_controller_address: Address, run_id: Int) {
        throwUnless(21004, run_id > 0);
        self.run_id = run_id;
        self.genesis_controller_address = genesis_controller_address;
        self.fee_accumulator_address = genesis_controller_address;
        self.fee_bound = false;
        self.accepted_count = 0;
        self.total_accepted = 0;
        self.last_amount = 0;
    }

    receive(msg: M20TBindFeeAccumulator) {
        throwUnless(21000, sender() == self.genesis_controller_address);
        throwUnless(21001, !self.fee_bound);
        throwUnless(21002, msg.fee_accumulator_address != self.genesis_controller_address);
        self.fee_accumulator_address = msg.fee_accumulator_address;
        self.fee_bound = true;
    }

    receive(msg: M20TBuybackHarnessTopUp) {
        throwUnless(21003, sender() == self.genesis_controller_address);
    }

    receive(msg: AcceptBurnReserve) {
        throwUnless(21010, self.fee_bound);
        throwUnless(21011, sender() == self.fee_accumulator_address);
        throwUnless(21012, msg.amount == M20T_BUYBACK_ENVELOPE_NANOTONS);
        throwUnless(21013, self.accepted_count == 0);

        self.accepted_count = 1;
        self.total_accepted = msg.amount;
        self.last_amount = msg.amount;
    }

    get fun get_state(): M20TBuybackBurnHarnessStateView {
        return M20TBuybackBurnHarnessStateView {
            run_id: self.run_id,
            fee_bound: self.fee_bound,
            fee_accumulator_address: self.fee_accumulator_address,
            accepted_count: self.accepted_count,
            total_accepted: self.total_accepted,
            last_amount: self.last_amount
        };
    }

    receive() {
        throw(21099);
    }
}
