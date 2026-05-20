// Platho v1 UsernameNFTItem milestone implementation.
// Scope: immutable owner/name_hash/registry binding and permissionless deployed-ACK resend.
// No admin/owner override/pause/upgrade/governance/rescue/fallback behavior is implemented.

const USERNAME_ITEM_ACK_FORWARD_RESERVE: Int = 3000000;
const USERNAME_ITEM_ACK_EXEC_RESERVE: Int = 1000000;
const USERNAME_ITEM_ACK_MAX_RESEND_VALUE: Int = 20000000;

message(0x639CFC6C) ResendDeployedAck {}

message(0x27ACDF8B) TopUpStorageReserve {}

message(0xBBA3EC19) UsernameItemDeployedAck {
    name_hash: Int as uint256;
    owner_wallet: Address;
}

struct UsernameNFTItemStateView {
    owner_wallet: Address;
    username_registry_address: Address;
    name_hash: Int;
}

contract UsernameNFTItem {
    owner_wallet: Address;
    username_registry_address: Address;
    name_hash: Int as uint256;

    init(owner_wallet: Address, username_registry_address: Address, name_hash: Int) {
        throwUnless(18001, name_hash != 0);
        self.owner_wallet = owner_wallet;
        self.username_registry_address = username_registry_address;
        self.name_hash = name_hash;
    }

    receive(msg: ResendDeployedAck) {
        // Permissionless ACK resend is allowed, but the caller must fund both
        // the forwarded ACK value and this item's local execution reserve.
        throwUnless(18002, context().value >= USERNAME_ITEM_ACK_FORWARD_RESERVE + USERNAME_ITEM_ACK_EXEC_RESERVE);
        throwUnless(18003, context().value <= USERNAME_ITEM_ACK_MAX_RESEND_VALUE);
        message(MessageParameters {
            to: self.username_registry_address,
            value: USERNAME_ITEM_ACK_FORWARD_RESERVE,
            bounce: true,
            mode: SendDefaultMode,
            body: UsernameItemDeployedAck {
                name_hash: self.name_hash,
                owner_wallet: self.owner_wallet
            }.toCell()
        });
    }

    receive(msg: TopUpStorageReserve) {
        // Accept value for item storage reserve. Grants no authority and changes no ownership/name state.
    }

    get fun get_state(): UsernameNFTItemStateView {
        return UsernameNFTItemStateView {
            owner_wallet: self.owner_wallet,
            username_registry_address: self.username_registry_address,
            name_hash: self.name_hash
        };
    }

    receive() {
        throw(18099);
    }
}
