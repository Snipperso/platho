// Platho v1 transferable username NFT item.
// Scope: standard NFT transfer surface, on-chain username identity, registry-bound mint initialization,
// and permissionless deployed-ACK resend. No admin/pause/upgrade/rescue/fallback behavior is implemented.

const USERNAME_ITEM_ACK_FORWARD_RESERVE: Int = 3000000;
const USERNAME_ITEM_ACK_EXEC_RESERVE: Int = 1000000;
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
    // [ADDED 2026-07-29, wave-8 HIGH] Identifies WHICH pending mint this initialization belongs to. It sits before
    // `username` because that field is `as remaining` and nothing can follow it.
    mint_nonce: Int as uint64;
    username_len: Int as uint8;
    username: Slice as remaining;
}

message(0x639CFC6C) ResendDeployedAck {}

message(0x27ACDF8B) TopUpStorageReserve {}

// Cross-generation migration. A contract redeploy gives the next generation's registry an empty name map, so
// without this the names bought here would look free there and could be taken by anyone — the owner keeps the
// NFT but loses the name in the system that is actually live.
//
// This is the ONLY half of the mechanism that cannot be added later: once minted, this item is immutable
// forever, so a registry that does not exist yet can only learn who owns the name if the item can state it
// itself. The consuming side belongs to the generation that consumes it and is written then.
message(0x554E5052) ProveUsernameOwnership {
    query_id: Int as uint64;
    to: Address;
}

// Everything the next generation needs to recreate the name, in ONE message: name_hash is not reversible, so
// the username bytes travel with it, and a claim needs no second correlated transaction.
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

// TEP-62 NFT transfer surface. The body after query_id is parsed manually because
// response_destination is a TL-B MsgAddress that may legally be addr_none$00, which a
// typed Address field rejects.
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
    // [ADDED 2026-07-29, wave-8 HIGH] What the ACK must report, frozen at initialization.
    //
    // sendDeployedAck used to read the LIVE owner_wallet, which NftTransfer rewrites without knowing whether the
    // registry ever accepted the ACK. A resend after a transfer therefore carried the new owner, failed the
    // registry's 19136, and made recovery of an unfinished mint impossible forever. And with ResendDeployedAck open
    // to anyone for 4,000,000, an ACK from an item initialized long ago could finalize a LATER pending mint whose
    // owner_wallet happened to match — buying a name already owned by the same wallet, a gift to a wallet that
    // already holds it, or a client retry. The registry then booked the price, acked the payer's ATH as accepted,
    // and the genuine bounce that followed died on 19140 because the pending was already gone. Payment taken, no
    // NFT, no refund. The nonce makes an ACK say which initialization it came from, and there is only ever one.
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
            .storeUint(0x2e617468, 32) // ".ath"
            .endCell();
    }

    fun snakeDescriptionCell(): Cell {
        // TEP-64 description shown in wallets/marketplaces. Generic value-prop — the `name` key carries the
        // actual username. beginTailString writes the 0x00 snake marker (same as the image keys).
        let b: StringBuilder = beginTailString();
        b.append("Private correspondence is a right, not a privilege. This is a username NFT for Platho — the anonymous, post-quantum-encrypted, uncensorable messenger. A permanent, transferable, fully on-chain handle: the name others reach you by, held by no one but you. platho.app");
        return b.toCell();
    }

    fun individualContent(): Cell {
        // Slim partial content (TEP-62): name + description only. The collection
        // (UsernameRegistry.get_nft_content) adds the rendered on-chain SVG image keys.
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

    // The item states its own public facts — the same ones get_nft_data already exposes — so this is
    // permissionless. That is deliberate: it lets anyone migrate a name on the owner's behalf, and it means a
    // name is never stranded because its owner went quiet. It cannot be abused to move a name, because the
    // proof always names the CURRENT owner, whoever triggers it.
    //
    // Crucially the item is NOT transferred. The owner keeps it and may prove as many times as needed, so a
    // refused or mistimed claim costs nothing — unlike a transfer-based proof, where a name already taken on
    // the other side would leave the claimant with neither the item nor the name.
    receive(msg: ProveUsernameOwnership) {
        throwUnless(18040, self.initialized);
        throwUnless(18041, self.isBasechainAddress(msg.to));
        throwUnless(18042, context().value >= USERNAME_ITEM_PROOF_FORWARD_RESERVE + USERNAME_ITEM_PROOF_EXEC_RESERVE);
        // Capped exactly like the ack-resend path: the item forwards to a caller-chosen address, so without a
        // ceiling it would be a value relay. The item never pays out of its own storage endowment.
        throwUnless(18043, context().value <= USERNAME_ITEM_PROOF_MAX_VALUE);

        message(MessageParameters {
            to: msg.to,
            value: USERNAME_ITEM_PROOF_FORWARD_RESERVE,
            mode: SendPayFwdFeesSeparately,
            // Bounceable so a proof aimed at a non-existent or refusing registry returns the value here
            // instead of burning it into an uninitialised account.
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

        // response_destination: MsgAddress — addr_none$00 means "no excesses response".
        let hasResponseDestination: Bool = body.preloadUint(2) != 0;
        let responseDestination: Address? = null;
        if (hasResponseDestination) {
            responseDestination = body.loadAddress();
            throwUnless(18033, self.isBasechainAddress(responseDestination!!));
        } else {
            body.skipBits(2);
        }

        if (body.loadBool()) { body.loadRef(); } // custom_payload: Maybe ^Cell (unused)
        let forwardAmount: Int = body.loadCoins();
        // body now holds the TEP-62 forward_payload (Either bit + content), forwarded verbatim.

        // Explicit budget: the inbound value alone funds execution, the ownership-assigned
        // forward, both forward fees, and the excesses value. The item never pays from its
        // own balance (the v1 mode-64 excesses defect double-counted forward_amount and
        // drained ~forward_amount per transfer, failing outright when the balance was short).
        // The fee allowance scales with the inbound forward fee (reference nft-item.fc
        // pattern): ownership_assigned re-forwards the sender's payload, so a large payload
        // raises the required budget instead of eating the item balance, and a future fee
        // schedule raise widens the allowance automatically. The 10M floor keeps today's
        // marketplace budget unchanged.
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
