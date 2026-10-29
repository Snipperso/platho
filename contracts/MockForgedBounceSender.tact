
message(0xB0117E51) ForgeBounce {
    target: Address;
    body: Cell;
    attach: Int as coins;
}

contract MockForgedBounceSender {
    receive(msg: ForgeBounce) {
        let raw: Cell = beginCell()
            .storeUint(0, 1)
            .storeUint(1, 1)
            .storeUint(0, 1)
            .storeUint(1, 1)
            .storeUint(0, 2)
            .storeAddress(msg.target)
            .storeCoins(msg.attach)
            .storeUint(0, 1)
            .storeCoins(0)
            .storeCoins(0)
            .storeUint(0, 64)
            .storeUint(0, 32)
            .storeUint(0, 1)
            .storeUint(1, 1)
            .storeRef(msg.body)
            .endCell();
        sendRawMessage(raw, 0);
    }

    receive() {}
}
