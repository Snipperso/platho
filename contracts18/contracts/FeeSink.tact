
const FS_DEPOSIT_EXEC_RESERVE: Int = 400000;

const FS_FLUSH_EXEC_RESERVE: Int = 5000000;

const FS_STORAGE_FLOOR: Int = 1000000;

const FS_TOPUP_GAS_ALLOWANCE: Int = 500000;

message(0xFF775609) DepositProtocolFee {
    amount: Int as uint128;
}

message(0x46534B31) FlushToTreasury {}

message(0x46534B32) SweepUnaccounted {}

message(0x46534B33) TopUpStorageReserve {}

contract FeeSink {
    treasury_receiver_address: Address;
    sink_index: Int as uint8;
    accumulated_ton: Int as uint128;
    storage_reserve_ton: Int as coins;

    init(treasury_receiver_address: Address, sink_index: Int) {
        self.treasury_receiver_address = treasury_receiver_address;
        self.sink_index = sink_index;
        self.accumulated_ton = 0;
        self.storage_reserve_ton = 0;
    }

    receive(msg: DepositProtocolFee) {
        throwUnless(15501, msg.amount > 0);
        throwUnless(15502, context().value >= msg.amount + FS_DEPOSIT_EXEC_RESERVE);
        self.accumulated_ton += msg.amount;
    }

    receive(msg: FlushToTreasury) {
        throwUnless(15510, self.accumulated_ton > 0);
        throwUnless(15511, context().value >= FS_FLUSH_EXEC_RESERVE);
        let amount: Int = self.accumulated_ton;
        self.accumulated_ton = 0;
        message(MessageParameters {
            to: self.treasury_receiver_address,
            value: amount,
            mode: SendPayFwdFeesSeparately | SendIgnoreErrors,
            bounce: false,
            body: null,
        });
    }

    receive(msg: SweepUnaccounted) {
        let held: Int = myBalance() - context().value;
        let accounted: Int = self.accumulated_ton + self.storage_reserve_ton;
        throwUnless(15520, held > accounted + FS_STORAGE_FLOOR);
        self.accumulated_ton += held - accounted - FS_STORAGE_FLOOR;
        nativeReserve(held, ReserveAtMost);
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    receive(msg: TopUpStorageReserve) {
        let net: Int = context().value - FS_TOPUP_GAS_ALLOWANCE;
        if (net < 0) { net = 0 }
        let claimed: Int = self.storage_reserve_ton + net;
        let backed: Int = myBalance() - self.accumulated_ton - FS_STORAGE_FLOOR - FS_TOPUP_GAS_ALLOWANCE;
        if (backed < 0) { backed = 0 }
        self.storage_reserve_ton = claimed < backed ? claimed : backed;
    }

    get fun get_state(): FeeSinkStateView {
        return FeeSinkStateView {
            treasury_receiver_address: self.treasury_receiver_address,
            accumulated_ton: self.accumulated_ton,
            storage_reserve_ton: self.storage_reserve_ton,
            balance: myBalance(),
            sink_index: self.sink_index,
        };
    }

    receive() {
        throw(15599);
    }
}

struct FeeSinkStateView {
    treasury_receiver_address: Address;
    accumulated_ton: Int;
    storage_reserve_ton: Int;
    balance: Int;
    sink_index: Int;
}
