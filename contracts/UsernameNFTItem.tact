// Platho v1 transferable username NFT item.
// Scope: standard NFT transfer surface, on-chain username identity, registry-bound mint initialization,
// and permissionless deployed-ACK resend. No admin/pause/upgrade/rescue/fallback behavior is implemented.

const USERNAME_ITEM_ACK_FORWARD_RESERVE: Int = 3000000;
const USERNAME_ITEM_ACK_EXEC_RESERVE: Int = 1000000;
const USERNAME_ITEM_ACK_MAX_RESEND_VALUE: Int = 20000000;
const USERNAME_ITEM_TRANSFER_EXEC_RESERVE: Int = 2000000;
const USERNAME_ITEM_TRANSFER_FWD_FEE_ALLOWANCE: Int = 10000000;
const USERNAME_ITEM_EXCESSES_MIN_VALUE: Int = 100000;
const USERNAME_ITEM_MAX_LENGTH: Int = 16;
const USERNAME_ITEM_NAME_HASH_DOMAIN: Int = 0xC5CC7CD6;
const USERNAME_ITEM_METADATA_KEY_NAME: Int = 0x82a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce89;
const USERNAME_ITEM_METADATA_KEY_DESCRIPTION: Int = 0xc9046f7a37ad0ea7cee73355984fa5428982f8b37c8f7bcec91f7ac71a7cd104;

message(0x554E494E) InitializeUsernameItem {
    owner_wallet: Address;
    username_len: Int as uint8;
    username: Slice as remaining;
}

message(0x639CFC6C) ResendDeployedAck {}

message(0x27ACDF8B) TopUpStorageReserve {}

message(0xBBA3EC19) UsernameItemDeployedAck {
    name_hash: Int as uint256;
    owner_wallet: Address;
}

// TEP-62 NFT transfer surface.
message(0x5FCC3D14) NftTransfer {
    query_id: Int as uint64;
    new_owner: Address;
    response_destination: Address;
    custom_payload: Cell?;
    forward_amount: Int as coins;
    forward_payload: Slice as remaining;
}

message(0x05138D91) NftOwnershipAssigned {
    query_id: Int as uint64;
    previous_owner: Address;
    forward_payload: Slice as remaining;
}

message(0xD53276DB) NftExcesses {
    query_id: Int as uint64;
}

struct UsernameNFTItemStateView {
    initialized: Bool;
    owner_wallet: Address;
    username_registry_address: Address;
    name_hash: Int;
    username_len: Int;
    username: Cell;
    tier: Int;
}

struct UsernameNftDataView {
    initialized: Bool;
    index: Int;
    collection_address: Address;
    owner_address: Address;
    individual_content: Cell;
}

struct UsernameNftOnchainContent {
    marker: Int as uint8;
    metadata: map<Int as uint256, Cell>;
}

contract UsernameNFTItem {
    initialized: Bool;
    owner_wallet: Address;
    username_registry_address: Address;
    name_hash: Int as uint256;
    username_len: Int as uint8;
    username: Cell;

    init(username_registry_address: Address, name_hash: Int) {
        throwUnless(18001, name_hash != 0);
        self.initialized = false;
        self.owner_wallet = username_registry_address;
        self.username_registry_address = username_registry_address;
        self.name_hash = name_hash;
        self.username_len = 0;
        self.username = beginCell().endCell();
    }

    fun isBasechainAddress(address: Address): Bool {
        let std: StdAddress = parseStdAddress(address.asSlice());
        return std.workchain == 0;
    }

    fun isValidNameLength(name_len: Int): Bool {
        return (name_len >= 4) && (name_len <= USERNAME_ITEM_MAX_LENGTH);
    }

    fun isValidUsernameBytes(name_len: Int, username: Slice): Bool {
        if (!self.isValidNameLength(name_len)) {
            return false;
        }
        if (username.bits() != (name_len * 8)) {
            return false;
        }
        if (!username.refsEmpty()) {
            return false;
        }

        let cursor: Slice = username;
        let i: Int = 0;
        while (i < name_len) {
            let ch: Int = cursor.loadUint(8);
            let lower: Bool = (ch >= 97) && (ch <= 122);
            let digit: Bool = (ch >= 48) && (ch <= 57);
            let separator: Bool = (ch == 45) || (ch == 95);
            if (!(lower || digit || separator)) {
                return false;
            }
            i += 1;
        }
        return cursor.empty();
    }

    fun computeNameHash(username: Slice): Int {
        return beginCell()
            .storeUint(USERNAME_ITEM_NAME_HASH_DOMAIN, 32)
            .storeSlice(username)
            .endCell()
            .hash();
    }

    fun tier(): Int {
        if (self.username_len == 4) {
            return 1;
        }
        if (self.username_len == 5) {
            return 2;
        }
        return 3;
    }

    fun snakeNameCell(): Cell {
        return beginCell()
            .storeUint(0, 8)
            .storeSlice(self.username.beginParse())
            .storeUint(0x2e617468, 32) // ".ath"
            .endCell();
    }

    fun snakeDescriptionCell(): Cell {
        return beginCell()
            .storeUint(0, 8)
            .storeUint(0x506c6174686f20757365726e616d65, 120) // "Platho username"
            .endCell();
    }

    fun individualContent(): Cell {
        let metadata: map<Int as uint256, Cell> = emptyMap();
        metadata.set(USERNAME_ITEM_METADATA_KEY_NAME, self.snakeNameCell());
        metadata.set(USERNAME_ITEM_METADATA_KEY_DESCRIPTION, self.snakeDescriptionCell());
        return UsernameNftOnchainContent {
            marker: 0,
            metadata: metadata
        }.toCell();
    }

    fun normalizedForwardPayload(payload: Slice): Slice {
        if (payload.empty()) {
            return beginCell().storeBit(false).endCell().beginParse();
        }
        return payload;
    }

    fun sendDeployedAck() {
        message(MessageParameters {
            to: self.username_registry_address,
            value: USERNAME_ITEM_ACK_FORWARD_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: UsernameItemDeployedAck {
                name_hash: self.name_hash,
                owner_wallet: self.owner_wallet
            }.toCell()
        });
    }

    receive(msg: InitializeUsernameItem) {
        throwUnless(18010, sender() == self.username_registry_address);
        throwUnless(18011, !self.initialized);
        throwUnless(18012, self.isBasechainAddress(msg.owner_wallet));
        throwUnless(18013, self.isValidUsernameBytes(msg.username_len, msg.username));
        throwUnless(18014, self.computeNameHash(msg.username) == self.name_hash);
        throwUnless(18015, context().value >= USERNAME_ITEM_ACK_FORWARD_RESERVE + USERNAME_ITEM_ACK_EXEC_RESERVE);

        self.initialized = true;
        self.owner_wallet = msg.owner_wallet;
        self.username_len = msg.username_len;
        self.username = beginCell().storeSlice(msg.username).endCell();

        self.sendDeployedAck();
    }

    receive(msg: ResendDeployedAck) {
        throwUnless(18020, self.initialized);
        throwUnless(18021, context().value >= USERNAME_ITEM_ACK_FORWARD_RESERVE + USERNAME_ITEM_ACK_EXEC_RESERVE);
        throwUnless(18022, context().value <= USERNAME_ITEM_ACK_MAX_RESEND_VALUE);
        self.sendDeployedAck();
    }

    receive(msg: NftTransfer) {
        throwUnless(18030, self.initialized);
        throwUnless(18031, sender() == self.owner_wallet);
        throwUnless(18032, self.isBasechainAddress(msg.new_owner));
        throwUnless(18033, self.isBasechainAddress(msg.response_destination));
        throwUnless(18034, msg.forward_amount >= 0);
        throwUnless(18035, context().value >= USERNAME_ITEM_TRANSFER_EXEC_RESERVE + msg.forward_amount + USERNAME_ITEM_TRANSFER_FWD_FEE_ALLOWANCE);

        let previousOwner: Address = self.owner_wallet;
        self.owner_wallet = msg.new_owner;

        if (msg.forward_amount > 0) {
            message(MessageParameters {
                to: msg.new_owner,
                value: msg.forward_amount,
                mode: SendPayFwdFeesSeparately,
                bounce: false,
                body: NftOwnershipAssigned {
                    query_id: msg.query_id,
                    previous_owner: previousOwner,
                    forward_payload: self.normalizedForwardPayload(msg.forward_payload)
                }.toCell()
            });
        }

        if (context().value >= USERNAME_ITEM_TRANSFER_EXEC_RESERVE + msg.forward_amount + USERNAME_ITEM_TRANSFER_FWD_FEE_ALLOWANCE + USERNAME_ITEM_EXCESSES_MIN_VALUE) {
            message(MessageParameters {
                to: msg.response_destination,
                value: 0,
                mode: SendRemainingValue,
                bounce: false,
                body: NftExcesses {
                    query_id: msg.query_id
                }.toCell()
            });
        }
    }

    receive(msg: TopUpStorageReserve) {
        // Accept TON for storage reserve only. Grants no authority and mutates no protocol state.
    }

    get fun get_state(): UsernameNFTItemStateView {
        return UsernameNFTItemStateView {
            initialized: self.initialized,
            owner_wallet: self.owner_wallet,
            username_registry_address: self.username_registry_address,
            name_hash: self.name_hash,
            username_len: self.username_len,
            username: self.username,
            tier: self.tier()
        };
    }

    get fun get_nft_data(): UsernameNftDataView {
        return UsernameNftDataView {
            initialized: self.initialized,
            index: self.name_hash,
            collection_address: self.username_registry_address,
            owner_address: self.owner_wallet,
            individual_content: self.individualContent()
        };
    }

    receive() {
        throw(18099);
    }
}
