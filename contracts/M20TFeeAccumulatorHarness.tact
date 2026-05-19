// Testnet-only M20T fee-path harness.
// It preloads one buyback envelope so the 51.05 TON path can be probed with a 55 TON disposable wallet.
// Not part of Platho v1 production contracts.

const M20T_FEE_HARNESS_FLUSH_EXEC_RESERVE: Int = 3000000;
const M20T_FEE_HARNESS_BUYBACK_ENVELOPE_NANOTONS: Int = 51050000000;

message(0xB3D2C52D) FlushBuybackDue {
    amount: Int as uint128;
}

message(0x594BA505) AcceptBurnReserve {
    amount: Int as uint128;
}

message(0x4D324657) M20TForwardWrongAcceptBurnReserve { // "M2FW"
    amount: Int as uint128;
    forward_value: Int as uint128;
}

message(0x4D325446) M20TFeeHarnessTopUp {} // "M2TF"

struct M20TFeeAccumulatorHarnessStateView {
    run_id: Int;
    controller_address: Address;
    buyback_burn_address: Address;
    buyback_due_ton: Int;
    flush_count: Int;
    last_flush_amount: Int;
}

contract M20TFeeAccumulatorHarness {
    run_id: Int as uint64;
    controller_address: Address;
    buyback_burn_address: Address;
    buyback_due_ton: Int as uint128;
    flush_count: Int as uint64;
    last_flush_amount: Int as uint128;

    init(controller_address: Address, buyback_burn_address: Address, initial_buyback_due_ton: Int, run_id: Int) {
        throwUnless(21102, run_id > 0);
        throwUnless(21100, initial_buyback_due_ton == M20T_FEE_HARNESS_BUYBACK_ENVELOPE_NANOTONS);
        self.run_id = run_id;
        self.controller_address = controller_address;
        self.buyback_burn_address = buyback_burn_address;
        self.buyback_due_ton = initial_buyback_due_ton;
        self.flush_count = 0;
        self.last_flush_amount = 0;
    }

    receive(msg: M20TFeeHarnessTopUp) {
        throwUnless(21101, sender() == self.controller_address);
    }

    receive(msg: FlushBuybackDue) {
        throwUnless(21110, sender() == self.controller_address);
        throwUnless(21111, msg.amount > 0);
        throwUnless(21112, msg.amount == M20T_FEE_HARNESS_BUYBACK_ENVELOPE_NANOTONS);
        throwUnless(21113, msg.amount <= self.buyback_due_ton);
        throwUnless(21114, context().value >= M20T_FEE_HARNESS_FLUSH_EXEC_RESERVE);

        self.buyback_due_ton -= msg.amount;
        self.flush_count += 1;
        self.last_flush_amount = msg.amount;

        message(MessageParameters {
            to: self.buyback_burn_address,
            value: msg.amount,
            bounce: true,
            mode: SendDefaultMode,
            body: AcceptBurnReserve { amount: msg.amount }.toCell()
        });
    }

    receive(msg: M20TForwardWrongAcceptBurnReserve) {
        throwUnless(21120, sender() == self.controller_address);
        throwUnless(21121, context().value >= msg.forward_value + M20T_FEE_HARNESS_FLUSH_EXEC_RESERVE);

        message(MessageParameters {
            to: self.buyback_burn_address,
            value: msg.forward_value,
            bounce: false,
            mode: SendDefaultMode,
            body: AcceptBurnReserve { amount: msg.amount }.toCell()
        });
    }

    bounced(msg: bounced<AcceptBurnReserve>) {
        throwUnless(21130, sender() == self.buyback_burn_address);
        throwUnless(21131, msg.amount > 0);
        self.buyback_due_ton += msg.amount;
    }

    get fun get_state(): M20TFeeAccumulatorHarnessStateView {
        return M20TFeeAccumulatorHarnessStateView {
            run_id: self.run_id,
            controller_address: self.controller_address,
            buyback_burn_address: self.buyback_burn_address,
            buyback_due_ton: self.buyback_due_ton,
            flush_count: self.flush_count,
            last_flush_amount: self.last_flush_amount
        };
    }

    receive() {
        throw(21199);
    }
}
