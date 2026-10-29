
const USERNAME_ITEM_ACK_FORWARD_RESERVE: Int = 3000000;
const USERNAME_ITEM_ACK_EXEC_RESERVE: Int = 2000000;
const USERNAME_ITEM_ACK_MAX_RESEND_VALUE: Int = 20000000;
const USERNAME_ITEM_TRANSFER_EXEC_RESERVE: Int = 2000000;
const USERNAME_ITEM_TRANSFER_FWD_FEE_ALLOWANCE: Int = 10000000;
const USERNAME_ITEM_PROOF_FORWARD_RESERVE: Int = 5000000;
const USERNAME_ITEM_PROOF_EXEC_RESERVE: Int = 1000000;
const USERNAME_ITEM_PROOF_MAX_VALUE: Int = 20000000;
const USERNAME_ITEM_EXCESSES_MIN_VALUE: Int = 100000;
const USERNAME_ITEM_MAX_LENGTH: Int = 16;
const USERNAME_ITEM_NAME_HASH_DOMAIN: Int = 0xC5CC7CD6;
const USERNAME_ITEM_METADATA_KEY_NAME: Int = 0x82a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce89;
const USERNAME_ITEM_METADATA_KEY_DESCRIPTION: Int = 0xc9046f7a37ad0ea7cee73355984fa5428982f8b37c8f7bcec91f7ac71a7cd104;

message(0x554E494E) InitializeUsernameItem {
    owner_wallet: Address;
    mint_nonce: Int as uint64;
    username_len: Int as uint8;
    username: Slice as remaining;
}

message(0x639CFC6C) ResendDeployedAck {}

message(0x27ACDF8B) TopUpStorageReserve {}

message(0x2FCB26A2) GetStaticData {
    query_id: Int as uint64;
}

message(0x8B771735) ReportStaticData {
    query_id: Int as uint64;
    index: Int as uint256;
    collection: Address;
}

message(0x554E5052) ProveUsernameOwnership {
    query_id: Int as uint64;
    to: Address;
}

message(0x554E504F) UsernameOwnershipProof {
    query_id: Int as uint64;
    name_hash: Int as uint256;
    owner_wallet: Address;
    username_len: Int as uint8;
    username: Slice as remaining;
}

message(0xBBA3EC19) UsernameItemDeployedAck {
    name_hash: Int as uint256;
    owner_wallet: Address;
    mint_nonce: Int as uint64;
}

message(0x5FCC3D14) NftTransfer {
    query_id: Int as uint64;
    payload: Slice as remaining;
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
    init_owner_wallet: Address;
    init_mint_nonce: Int as uint64;

    init(username_registry_address: Address, name_hash: Int) {
        throwUnless(18001, name_hash != 0);
        self.initialized = false;
        self.owner_wallet = username_registry_address;
        self.username_registry_address = username_registry_address;
        self.name_hash = name_hash;
        self.username_len = 0;
        self.username = beginCell().endCell();
        self.init_owner_wallet = username_registry_address;
        self.init_mint_nonce = 0;
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
            .storeUint(0x2e617468, 32)
            .endCell();
    }

    fun snakeDescriptionCell(): Cell {
        let b: StringBuilder = beginTailString();
        b.append("Private correspondence is a right, not a privilege. This is a username NFT for Platho — the anonymous, post-quantum-encrypted, uncensorable messenger. A permanent, transferable, fully on-chain handle: the name others reach you by, held by no one but you. platho.app");
        return b.toCell();
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
                owner_wallet: self.init_owner_wallet,
                mint_nonce: self.init_mint_nonce
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
        self.init_owner_wallet = msg.owner_wallet;
        self.init_mint_nonce = msg.mint_nonce;
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

    receive(msg: ProveUsernameOwnership) {
        throwUnless(18040, self.initialized);
        throwUnless(18041, self.isBasechainAddress(msg.to));
        throwUnless(18042, context().value >= USERNAME_ITEM_PROOF_FORWARD_RESERVE + USERNAME_ITEM_PROOF_EXEC_RESERVE);
        throwUnless(18043, context().value <= USERNAME_ITEM_PROOF_MAX_VALUE);

        message(MessageParameters {
            to: msg.to,
            value: USERNAME_ITEM_PROOF_FORWARD_RESERVE,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: UsernameOwnershipProof {
                query_id: msg.query_id,
                name_hash: self.name_hash,
                owner_wallet: self.owner_wallet,
                username_len: self.username_len,
                username: self.username.asSlice()
            }.toCell()
        });
    }

    receive(msg: NftTransfer) {
        throwUnless(18030, self.initialized);
        throwUnless(18031, sender() == self.owner_wallet);

        let body: Slice = msg.payload;
        let newOwner: Address = body.loadAddress();
        throwUnless(18032, self.isBasechainAddress(newOwner));

        let hasResponseDestination: Bool = body.preloadUint(2) != 0;
        let responseDestination: Address? = null;
        if (hasResponseDestination) {
            responseDestination = body.loadAddress();
            throwUnless(18033, self.isBasechainAddress(responseDestination!!));
        } else {
            body.skipBits(2);
        }

        if (body.loadBool()) { body.loadRef(); }
        let forwardAmount: Int = body.loadCoins();

        let fwdFeeAllowance: Int = max(USERNAME_ITEM_TRANSFER_FWD_FEE_ALLOWANCE, context().readForwardFee() * 2);
        let restAmount: Int = context().value - USERNAME_ITEM_TRANSFER_EXEC_RESERVE - forwardAmount - fwdFeeAllowance;
        throwUnless(18035, restAmount >= 0);

        let previousOwner: Address = self.owner_wallet;
        self.owner_wallet = newOwner;

        if (forwardAmount > 0) {
            message(MessageParameters {
                to: newOwner,
                value: forwardAmount,
                mode: SendPayFwdFeesSeparately,
                bounce: false,
                body: NftOwnershipAssigned {
                    query_id: msg.query_id,
                    previous_owner: previousOwner,
                    forward_payload: self.normalizedForwardPayload(body)
                }.toCell()
            });
        }

        if (hasResponseDestination && restAmount >= USERNAME_ITEM_EXCESSES_MIN_VALUE) {
            message(MessageParameters {
                to: responseDestination!!,
                value: restAmount,
                mode: SendPayFwdFeesSeparately,
                bounce: false,
                body: NftExcesses {
                    query_id: msg.query_id
                }.toCell()
            });
        }
    }

    receive(msg: TopUpStorageReserve) {
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

    receive(msg: GetStaticData) {
        message(MessageParameters {
            to: sender(),
            value: 0,
            bounce: false,
            mode: SendRemainingValue | SendIgnoreErrors,
            body: ReportStaticData {
                query_id: msg.query_id,
                index: self.name_hash,
                collection: self.username_registry_address
            }.toCell()
        });
    }
}
