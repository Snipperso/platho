message(0xA4F862C0) PublishPrivateFromVault {
    bounce_id: Int as uint64;
    publish_id: Int as uint256;
    size_class: Int as uint8;
    crypto_suite: Int as uint8;
    header_0_hash: Int as uint256;
    header_1_hash: Int as uint256;
    body_hash: Int as uint256;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
    protocol_fee_paid: Int as uint128;
}

message(0x8C2A76B7) PublishPublicFromVault {
    bounce_id: Int as uint64;
    publish_id: Int as uint256;
    marketing_note: Int as uint152;
    author_wallet: Address;
    header_hash: Int as uint256;
    body_hash: Int as uint256;
    header: Cell;
    body: Cell;
    protocol_fee_paid: Int as uint128;
}

message(0x874E576A) CapsuleHubPublishAck {
    publish_id: Int as uint256;
    entry_id: Int as uint64;
    entry_uid: Int as uint256;
}

message(0xFA001001) ForwardVaultPrivate {
    capsule_hub_address: Address;
    bounce_id: Int as uint64;
    publish_id: Int as uint256;
    size_class: Int as uint8;
    crypto_suite: Int as uint8;
    header_0_hash: Int as uint256;
    header_1_hash: Int as uint256;
    body_hash: Int as uint256;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
    protocol_fee_paid: Int as uint128;
    value_to_capsule: Int as uint128;
}

message(0xFA001002) ForwardVaultPublic {
    capsule_hub_address: Address;
    bounce_id: Int as uint64;
    publish_id: Int as uint256;
    marketing_note: Int as uint152;
    author_wallet: Address;
    header_hash: Int as uint256;
    body_hash: Int as uint256;
    header: Cell;
    body: Cell;
    protocol_fee_paid: Int as uint128;
    value_to_capsule: Int as uint128;
}

struct MockVaultStateView {
    ack_count: Int;
    last_publish_id: Int;
    last_entry_id: Int;
    last_entry_uid: Int;
}

contract MockVaultAckSink {
    ack_count: Int as uint64;
    last_publish_id: Int as uint256;
    last_entry_id: Int as uint64;
    last_entry_uid: Int as uint256;

    init() {
        self.ack_count = 0;
        self.last_publish_id = 0;
        self.last_entry_id = 0;
        self.last_entry_uid = 0;
    }

    receive(msg: ForwardVaultPrivate) {
        message(MessageParameters {
            to: msg.capsule_hub_address,
            value: msg.value_to_capsule,
            bounce: true,
            mode: SendDefaultMode,
            body: PublishPrivateFromVault {
                bounce_id: msg.bounce_id,
                publish_id: msg.publish_id,
                size_class: msg.size_class,
                crypto_suite: msg.crypto_suite,
                header_0_hash: msg.header_0_hash,
                header_1_hash: msg.header_1_hash,
                body_hash: msg.body_hash,
                header_0: msg.header_0,
                header_1: msg.header_1,
                body: msg.body,
                protocol_fee_paid: msg.protocol_fee_paid
            }.toCell()
        });
    }

    receive(msg: ForwardVaultPublic) {
        message(MessageParameters {
            to: msg.capsule_hub_address,
            value: msg.value_to_capsule,
            bounce: true,
            mode: SendDefaultMode,
            body: PublishPublicFromVault {
                bounce_id: msg.bounce_id,
                publish_id: msg.publish_id,
                marketing_note: msg.marketing_note,
                author_wallet: msg.author_wallet,
                header_hash: msg.header_hash,
                body_hash: msg.body_hash,
                header: msg.header,
                body: msg.body,
                protocol_fee_paid: msg.protocol_fee_paid
            }.toCell()
        });
    }

    receive(msg: CapsuleHubPublishAck) {
        self.ack_count += 1;
        self.last_publish_id = msg.publish_id;
        self.last_entry_id = msg.entry_id;
        self.last_entry_uid = msg.entry_uid;
    }

    get fun get_state(): MockVaultStateView {
        return MockVaultStateView {
            ack_count: self.ack_count,
            last_publish_id: self.last_publish_id,
            last_entry_id: self.last_entry_id,
            last_entry_uid: self.last_entry_uid
        };
    }

    receive() {
        throw(20999);
    }
}
