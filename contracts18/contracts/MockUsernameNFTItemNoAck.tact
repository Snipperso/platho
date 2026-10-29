
message(0x554E494E) InitializeUsernameItem {
    owner_wallet: Address;
    username_len: Int as uint8;
    username: Slice as remaining;
}

message(0x639CFC6C) ResendDeployedAck {}
message(0x27ACDF8B) TopUpStorageReserve {}

contract MockUsernameNFTItemNoAck {
    accepted_count: Int as uint64;

    init() {
        self.accepted_count = 0;
    }

    receive(msg: InitializeUsernameItem) {
        self.accepted_count += 1;
    }

    receive(msg: ResendDeployedAck) {
        self.accepted_count += 1;
    }

    receive(msg: TopUpStorageReserve) {
    }

    get fun get_accepted_count(): Int {
        return self.accepted_count;
    }

    receive() {
        throw(18998);
    }
}
