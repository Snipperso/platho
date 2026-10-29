message(0xBBA3EC19) UsernameItemDeployedAck {
    name_hash: Int as uint256;
    owner_wallet: Address;
}

struct MockUsernameRegistryAckSinkStateView {
    ack_count: Int;
    last_name_hash: Int;
    last_owner_wallet: Address;
}

contract MockUsernameRegistryAckSink {
    ack_count: Int as uint64;
    last_name_hash: Int as uint256;
    last_owner_wallet: Address;

    init(last_owner_wallet: Address) {
        self.ack_count = 0;
        self.last_name_hash = 0;
        self.last_owner_wallet = last_owner_wallet;
    }

    receive(msg: UsernameItemDeployedAck) {
        self.ack_count += 1;
        self.last_name_hash = msg.name_hash;
        self.last_owner_wallet = msg.owner_wallet;
    }

    get fun get_state(): MockUsernameRegistryAckSinkStateView {
        return MockUsernameRegistryAckSinkStateView {
            ack_count: self.ack_count,
            last_name_hash: self.last_name_hash,
            last_owner_wallet: self.last_owner_wallet
        };
    }

    receive() {
        throw(18999);
    }
}
