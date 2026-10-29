
message(0x472D9D7D) AthTransferNotification {
    query_id: Int as uint64;
    sender_key: Int as uint160;
    amount: Int as uint128;
    sender_wallet: Address;
}

contract MockGasBurnNotifyOwner {
    burn_iters: Int as uint32;

    init(burn_iters: Int) {
        self.burn_iters = burn_iters;
    }

    receive(msg: AthTransferNotification) {
        let x: Int = 7;
        repeat (self.burn_iters) {
            x = (x * 1103515245 + 12345) % 2147483647;
        }
        throwUnless(60004, x == -1);
    }

    receive() {}
    receive(_: Slice) {}
}
