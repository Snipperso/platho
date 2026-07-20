// Test-only registry sink that accepts registry-funded ATH notifications without ACKing.
// Not part of Platho v1 production contracts.

message(0xA11A7002) AthTransferNotificationRegistryProfileAvatar {
    query_id: Int as uint64;
    sender_key: Int as uint160;
    amount: Int as uint128;
    payer_wallet: Address;
    owner_wallet: Address;
    avatar_hash: Int as uint256;
    avatar_entry_id: Int as uint64;
    avatar_stream_id: Int as uint128;
    avatar_part_count: Int as uint16;
    media_format: Int as uint8;
}

message(0x89129D60) AthTransferNotificationRegistryMintUsername {
    query_id: Int as uint64;
    sender_key: Int as uint160;
    amount: Int as uint128;
    payer_wallet: Address;
    owner_wallet: Address;
    username_len: Int as uint8;
    username: Slice as remaining;
}

struct MockRegistryNotificationNoAckStateView {
    profile_count: Int;
    username_count: Int;
    last_query_id: Int;
}

contract MockRegistryNotificationNoAck {
    profile_count: Int as uint64;
    username_count: Int as uint64;
    last_query_id: Int as uint64;

    init() {
        self.profile_count = 0;
        self.username_count = 0;
        self.last_query_id = 0;
    }

    receive(msg: AthTransferNotificationRegistryProfileAvatar) {
        self.profile_count += 1;
        self.last_query_id = msg.query_id;
    }

    receive(msg: AthTransferNotificationRegistryMintUsername) {
        self.username_count += 1;
        self.last_query_id = msg.query_id;
    }

    get fun get_state(): MockRegistryNotificationNoAckStateView {
        return MockRegistryNotificationNoAckStateView {
            profile_count: self.profile_count,
            username_count: self.username_count,
            last_query_id: self.last_query_id
        };
    }

    receive() {
        throw(18777);
    }
}
