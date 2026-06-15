// Platho v1 UsernameRegistry implementation through M13.
// Scope: Vault-funded official ATH notification username mint, deterministic UsernameNFTItem deploy + ACK finalization,
// exact price tiers, raw lowercase ASCII username validation, bounce-safe treasury/burn due flushes, and stale pending mint check.
// No admin/owner override/pause/upgrade/governance/rescue/fallback behavior is implemented.
// No BuybackBurn route, adapter, migration, or compatibility path is implemented.

import "./UsernameNFTItem.tact";
import "./ATHWallet.tact";

const USERNAME_PRICE_4_CHARS: Int = 10000000000000;      // 10,000 ATH atomic units
const USERNAME_PRICE_5_CHARS: Int = 1000000000000;       // 1,000 ATH atomic units
const USERNAME_PRICE_6_PLUS_CHARS: Int = 100000000000;   // 100 ATH atomic units
const USERNAME_PENDING_MINT_STORAGE_ENDOWMENT: Int = 6000000;
const USERNAME_STATE_GROWTH_EXEC_RESERVE: Int = 4000000;
const USERNAME_NFT_ITEM_DEPLOY_RESERVE: Int = 500000000; // 0.5 TON prepaid storage: ~250+ years at mainnet config-18 (~2M nanoton/yr for the ~30-cell item), with a thick cushion against storage-price growth. The minter funds it once; the NFT lives for centuries.
const USERNAME_ATH_TRANSFER_EXEC_RESERVE: Int = 48000000; // raised 30M->48M to track the ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT raise (2M->20M, +18M): the official ATH wallet's ATHTransferRequest required_value = EXEC_RESERVE(2M)+INTERNAL_TRANSFER_ACK(3M)+STORAGE_ENDOWMENT(20M)+FWD_FEE_ALLOWANCE(21M)+OWNER_REQUEST_EXEC(2M) = 48M.
const USERNAME_ATH_BURN_EXEC_RESERVE: Int = 5000000;
const USERNAME_DUE_FLUSH_LOCAL_EXEC_RESERVE: Int = 2000000;
const USERNAME_PRUNE_PENDING_MINT_EXEC_RESERVE: Int = 2000000;
const USERNAME_ATH_NOTIFICATION_ACK_VALUE: Int = 1000000;
const USERNAME_ATH_NOTIFICATION_REFUND_VALUE: Int = 12000000;
const USERNAME_PENDING_MINT_STALE_TTL: Int = 86400; // 24 hours
const USERNAME_MAX_LENGTH: Int = 16;
const USERNAME_SPLIT_BASE_BPS: Int = 10000;
const USERNAME_TREASURY_SHARE_BPS: Int = 5000;
const USERNAME_NAME_HASH_DOMAIN: Int = 0xC5CC7CD6;
const USERNAME_COLLECTION_METADATA_KEY_NAME: Int = 0x82a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce89;
const USERNAME_COLLECTION_METADATA_KEY_IMAGE: Int = 0x6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d;
const USERNAME_COLLECTION_METADATA_KEY_IMAGE_DATA: Int = 0xd9a88ccec79eef59c84b671136a20ece4cd00caaad5bc47e2c208829154ee9e4;
const USERNAME_COLLECTION_UNORDERED_NEXT_INDEX: Int = -1;

const OP_USERNAME_BIND_OFFICIAL_ATH_WALLET: Int = 0x663DF03D;
const OP_USERNAME_BIND_VAULT: Int = 0x60A61104;
const OP_SEAL_GENESIS: Int = 0x3A12D1AD;

// base64 alphabet lookup by 6-bit index -> ASCII code (global inline: cheaper
// calling convention than a contract method in the hot encoder loop).
inline fun b64Code(v: Int): Int {
    if (v < 26) { return 65 + v; }          // 'A'..'Z'
    if (v < 52) { return 71 + v; }          // 'a'..'z'  (97 + (v-26))
    if (v < 62) { return v - 4; }           // '0'..'9'  (48 + (v-52))
    if (v == 62) { return 43; }             // '+'
    return 47;                              // '/'
}

// Encode 24 bits (one 3-byte group) into 4 base64 ASCII codes packed into a
// single 32-bit integer (big-endian char order).
inline fun b64Quad(g: Int): Int {
    return (b64Code((g >> 18) & 63) << 24)
        | (b64Code((g >> 12) & 63) << 16)
        | (b64Code((g >> 6) & 63) << 8)
        | b64Code(g & 63);
}

message(0x663DF03D) BindOfficialAthWallet {
    deployment_manifest_hash: Int as uint256;
    official_ath_wallet_address: Address;
}

message(0x60A61104) BindUsernameVault {
    deployment_manifest_hash: Int as uint256;
    vault_address: Address;
}

message(0x3A12D1AD) SealGenesis {
    deployment_manifest_hash: Int as uint256;
}

message(0x60A9BDDB) FlushTreasuryAthDue {
    query_id: Int as uint64;
}

message(0xE9A2C2CB) FlushBurnAthDue {
    query_id: Int as uint64;
}

message(0x3796DF2D) PrunePendingUsernameMint {
    name_hash: Int as uint256;
}

message(0x0ABA5F1D) UsernameRegistryTopUpStorageReserve {}

struct PendingUsernameMint {
    query_id: Int as uint64;
    sender_key: Int as uint160;
    owner_wallet: Address;
    name_hash: Int as uint256;
    price_paid: Int as uint128;
    item_address: Address;
    item_deploy_value: Int as uint128;
    created_at: Int as uint64;
}

struct NameRecord {
    // The wallet that MINTED the name. NOT the current owner: TEP-62 transfer updates the
    // item's owner_wallet but not this record. Resolve live ownership from the item state.
    minter_wallet: Address;
    item_address: Address;
    registered_at: Int as uint64;
}

struct UsernameRegistryGlobalView {
    sealed: Bool;
    official_ath_wallet_bound: Bool;
    vault_bound: Bool;
    deployment_manifest_hash: Int;
    genesis_config_hash: Int;
    official_ath_wallet_address: Address;
    vault_address: Address;
    genesis_controller_address: Address;
    name_record_count: Int;
    pending_mint_count: Int;
    treasury_due_ath: Int;
    burn_due_ath: Int;
    pending_treasury_flush_count: Int;
    pending_burn_flush_count: Int;
    pending_mint_stale_ttl: Int;
}

struct UsernamePriceView {
    valid_length: Bool;
    price_ath_atomic: Int;
}

struct UsernameNameRecordView {
    exists: Bool;
    // Minter at registration time, NOT the current owner (see NameRecord). Read live ownership
    // from the item's get_state.owner_wallet.
    minter_wallet: Address;
    item_address: Address;
    registered_at: Int;
}

struct PendingUsernameMintView {
    exists: Bool;
    query_id: Int;
    sender_key: Int;
    owner_wallet: Address;
    name_hash: Int;
    price_paid: Int;
    item_address: Address;
    item_deploy_value: Int;
    created_at: Int;
}

struct PendingAthTreasuryFlush {
    amount: Int as uint128;
    recipient_ath_wallet: Address;
    created_at: Int as uint64;
}

struct PendingAthBurnFlush {
    amount: Int as uint128;
    created_at: Int as uint64;
}

struct PendingAthTreasuryFlushView {
    exists: Bool;
    amount: Int;
    recipient_ath_wallet: Address;
    created_at: Int;
}

struct PendingAthBurnFlushView {
    exists: Bool;
    amount: Int;
    created_at: Int;
}

struct UsernameCollectionDataView {
    next_item_index: Int;
    collection_content: Cell;
    owner_address: Address;
}

struct UsernameCollectionOnchainContent {
    marker: Int as uint8;
    metadata: map<Int as uint256, Cell>;
}

contract UsernameRegistry {
    official_ath_wallet_address: Address;
    vault_address: Address;
    ath_master_address: Address;
    treasury_ath_receiver_address: Address;
    official_ath_wallet_bound: Bool;
    vault_bound: Bool;
    sealed: Bool;
    deployment_manifest_hash: Int as uint256;
    genesis_config_hash: Int as uint256;
    name_record_count: Int as uint64;
    pending_mint_count: Int as uint64;
    treasury_due_ath: Int as uint128;
    burn_due_ath: Int as uint128;
    name_records: map<Int, NameRecord>;
    pending_mints: map<Int, PendingUsernameMint>;
    pending_item_to_name_hash: map<Address, Int>;
    pending_treasury_flushes: map<Int, PendingAthTreasuryFlush>;
    pending_treasury_flush_count: Int as uint64;
    pending_burn_flushes: map<Int, PendingAthBurnFlush>;
    pending_burn_flush_count: Int as uint64;
    genesis_controller_address: Address;

    init(official_ath_wallet_address: Address, ath_master_address: Address, treasury_ath_receiver_address: Address, sealed: Bool, deployment_manifest_hash: Int, genesis_config_hash: Int, genesis_controller_address: Address) {
        self.official_ath_wallet_address = official_ath_wallet_address;
        self.vault_address = official_ath_wallet_address;
        self.ath_master_address = ath_master_address;
        self.treasury_ath_receiver_address = treasury_ath_receiver_address;
        self.official_ath_wallet_bound = false;
        self.vault_bound = false;
        self.sealed = sealed;
        self.genesis_controller_address = genesis_controller_address;
        self.deployment_manifest_hash = deployment_manifest_hash;
        self.genesis_config_hash = genesis_config_hash;
        self.name_record_count = 0;
        self.pending_mint_count = 0;
        self.treasury_due_ath = 0;
        self.burn_due_ath = 0;
        self.pending_treasury_flush_count = 0;
        self.pending_burn_flush_count = 0;
    }

    fun requireUnsealed() {
        throwUnless(19000, !self.sealed);
    }

    fun requireSealed() {
        throwUnless(19100, self.sealed);
    }

    fun requireGenesisController() {
        throwUnless(19033, sender() == self.genesis_controller_address);
    }

    fun priceForLength(name_len: Int): Int {
        throwUnless(19010, name_len >= 4);
        throwUnless(19011, name_len <= USERNAME_MAX_LENGTH);
        if (name_len == 4) {
            return USERNAME_PRICE_4_CHARS;
        }
        if (name_len == 5) {
            return USERNAME_PRICE_5_CHARS;
        }
        return USERNAME_PRICE_6_PLUS_CHARS;
    }

    fun isValidNameLength(name_len: Int): Bool {
        return (name_len >= 4) && (name_len <= USERNAME_MAX_LENGTH);
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
            .storeUint(USERNAME_NAME_HASH_DOMAIN, 32)
            .storeSlice(username)
            .endCell()
            .hash();
    }

    fun collectionNameCell(): Cell {
        return beginCell()
            .storeUint(0, 8)
            .storeUint(0x506c6174686f20757365726e616d6573, 128) // "Platho usernames"
            .endCell();
    }

    fun collectionContent(): Cell {
        let metadata: map<Int as uint256, Cell> = emptyMap();
        metadata.set(USERNAME_COLLECTION_METADATA_KEY_NAME, self.collectionNameCell());
        return UsernameCollectionOnchainContent {
            marker: 0,
            metadata: metadata
        }.toCell();
    }

    fun deriveItemAddress(name_hash: Int): Address {
        throwUnless(19020, name_hash > 0);
        let registry_std: StdAddress = parseStdAddress(myAddress().asSlice());
        let item_init: StateInit = initOf UsernameNFTItem(myAddress(), name_hash);
        return contractAddressExt(registry_std.workchain, item_init.code, item_init.data);
    }

    fun deriveAthWalletAddress(owner_wallet: Address): Address {
        let owner_std: StdAddress = parseStdAddress(owner_wallet.asSlice());
        let wallet_init: StateInit = initOf ATHWallet(0, owner_wallet, self.ath_master_address);
        return contractAddressExt(owner_std.workchain, wallet_init.code, wallet_init.data);
    }

    fun isBasechainAddress(address: Address): Bool {
        let std: StdAddress = parseStdAddress(address.asSlice());
        return std.workchain == 0;
    }

    fun sendAthNotificationAck(destination: Address, query_id: Int, sender_key: Int, amount: Int) {
        message(MessageParameters {
            to: destination,
            value: USERNAME_ATH_NOTIFICATION_ACK_VALUE,
            bounce: false,
            mode: SendDefaultMode,
            body: AthTransferNotificationAck {
                query_id: query_id,
                sender_key: sender_key,
                amount: amount
            }.toCell()
        });
    }

    fun sendAthNotificationRefund(query_id: Int, sender_key: Int, amount: Int) {
        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: USERNAME_ATH_NOTIFICATION_REFUND_VALUE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: AthTransferNotificationRefund {
                query_id: query_id,
                sender_key: sender_key,
                amount: amount
            }.toCell()
        });
    }

    fun clearPendingTreasuryFlush(query_id: Int): PendingAthTreasuryFlush {
        let pendingOpt: PendingAthTreasuryFlush? = self.pending_treasury_flushes.get(query_id);
        throwUnless(19250, pendingOpt != null);
        let pending: PendingAthTreasuryFlush = pendingOpt!!;
        self.pending_treasury_flushes.del(query_id);
        self.pending_treasury_flush_count -= 1;
        return pending;
    }

    fun clearPendingBurnFlush(query_id: Int): PendingAthBurnFlush {
        let pendingOpt: PendingAthBurnFlush? = self.pending_burn_flushes.get(query_id);
        throwUnless(19260, pendingOpt != null);
        let pending: PendingAthBurnFlush = pendingOpt!!;
        self.pending_burn_flushes.del(query_id);
        self.pending_burn_flush_count -= 1;
        return pending;
    }

    fun requireNoDueFlushQuery(query_id: Int) {
        throwUnless(19201, !self.pending_treasury_flushes.exists(query_id));
        throwUnless(19202, !self.pending_burn_flushes.exists(query_id));
    }

    fun clearPendingMint(name_hash: Int): PendingUsernameMint {
        let pendingOpt: PendingUsernameMint? = self.pending_mints.get(name_hash);
        throwUnless(19300, pendingOpt != null);
        let pending: PendingUsernameMint = pendingOpt!!;
        self.pending_mints.del(name_hash);
        self.pending_item_to_name_hash.del(pending.item_address);
        self.pending_mint_count -= 1;
        return pending;
    }

    fun acceptUsernameMint(query_id: Int, sender_key: Int, amount: Int, owner_wallet: Address, username_len: Int, username: Slice) {
        throwUnless(19121, amount > 0);
        throwUnless(19126, self.isBasechainAddress(owner_wallet));

        if (!self.isValidUsernameBytes(username_len, username)) {
            throw(19170);
        }

        let name_hash: Int = self.computeNameHash(username);
        let price: Int = self.priceForLength(username_len);

        if (amount != price) {
            throw(19171);
        }

        if (self.name_records.exists(name_hash)) {
            throw(19172);
        }

        if (self.pending_mints.exists(name_hash)) {
            throw(19173);
        }

        let retainedValue: Int = USERNAME_PENDING_MINT_STORAGE_ENDOWMENT + USERNAME_NFT_ITEM_DEPLOY_RESERVE + USERNAME_ATH_NOTIFICATION_ACK_VALUE + USERNAME_STATE_GROWTH_EXEC_RESERVE;
        throwUnless(19122, context().value >= retainedValue);

        let item_address: Address = self.deriveItemAddress(name_hash);
        throwUnless(19123, !self.pending_item_to_name_hash.exists(item_address));

        self.pending_mints.set(name_hash, PendingUsernameMint {
            query_id: query_id,
            sender_key: sender_key,
            owner_wallet: owner_wallet,
            name_hash: name_hash,
            price_paid: amount,
            item_address: item_address,
            item_deploy_value: USERNAME_NFT_ITEM_DEPLOY_RESERVE,
            created_at: now()
        });
        self.pending_item_to_name_hash.set(item_address, name_hash);
        self.pending_mint_count += 1;

        let item_init: StateInit = initOf UsernameNFTItem(myAddress(), name_hash);
        send(SendParameters {
            to: item_address,
            value: USERNAME_NFT_ITEM_DEPLOY_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            code: item_init.code,
            data: item_init.data,
            body: InitializeUsernameItem {
                owner_wallet: owner_wallet,
                username_len: username_len,
                username: username
            }.toCell()
        });

    }

    receive(msg: BindOfficialAthWallet) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(19030, msg.deployment_manifest_hash > 1);
        throwUnless(19031, !self.official_ath_wallet_bound);
        throwUnless(19032, self.genesis_config_hash == 0);
        throwUnless(19034, self.deployment_manifest_hash == 0 || self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(19035, msg.official_ath_wallet_address == self.deriveAthWalletAddress(myAddress()));
        self.deployment_manifest_hash = msg.deployment_manifest_hash;
        self.genesis_config_hash = 1;
        self.official_ath_wallet_address = msg.official_ath_wallet_address;
        self.official_ath_wallet_bound = true;
    }

    receive(msg: BindUsernameVault) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(19036, msg.deployment_manifest_hash > 1);
        throwUnless(19037, !self.vault_bound);
        throwUnless(19038, self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(19039, self.isBasechainAddress(msg.vault_address));
        throwUnless(19046, msg.vault_address != myAddress());
        self.vault_address = msg.vault_address;
        self.vault_bound = true;
    }

    receive(msg: SealGenesis) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(19040, msg.deployment_manifest_hash > 1);
        throwUnless(19041, self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(19042, self.official_ath_wallet_bound);
        throwUnless(19043, self.official_ath_wallet_address == self.deriveAthWalletAddress(myAddress()));
        throwUnless(19044, self.isBasechainAddress(self.treasury_ath_receiver_address));
        throwUnless(19045, self.vault_bound);
        throwUnless(19047, self.isBasechainAddress(self.vault_address));
        throwUnless(19048, self.vault_address != myAddress());
        throwUnless(19049, self.treasury_ath_receiver_address != myAddress());
        throwUnless(19050, self.treasury_ath_receiver_address != self.official_ath_wallet_address);
        throwUnless(19051, self.treasury_ath_receiver_address != self.vault_address);
        throwUnless(19052, self.treasury_ath_receiver_address != self.ath_master_address);
        self.genesis_config_hash = msg.deployment_manifest_hash;
        self.sealed = true;
    }

    receive(msg: AthTransferNotificationVaultMintUsername) {
        self.requireSealed();
        throwUnless(19180, sender() == self.official_ath_wallet_address);
        throwUnless(19181, self.vault_bound);
        throwUnless(19182, msg.payer_wallet == self.vault_address);
        self.acceptUsernameMint(msg.query_id, msg.sender_key, msg.amount, msg.owner_wallet, msg.username_len, msg.username);
    }

    receive(msg: UsernameItemDeployedAck) {
        self.requireSealed();
        let nameFromItem: Int? = self.pending_item_to_name_hash.get(sender());
        throwUnless(19130, nameFromItem != null);
        throwUnless(19131, nameFromItem!! == msg.name_hash);

        let pendingOpt: PendingUsernameMint? = self.pending_mints.get(msg.name_hash);
        throwUnless(19132, pendingOpt != null);
        let pending: PendingUsernameMint = pendingOpt!!;
        throwUnless(19133, self.isBasechainAddress(msg.owner_wallet));
        throwUnless(19134, pending.item_address == sender());
        throwUnless(19135, !self.name_records.exists(msg.name_hash));
        throwUnless(19136, msg.owner_wallet == pending.owner_wallet);

        let pendingToFinalize: PendingUsernameMint = self.clearPendingMint(msg.name_hash);

        self.name_records.set(msg.name_hash, NameRecord {
            minter_wallet: pendingToFinalize.owner_wallet,
            item_address: pendingToFinalize.item_address,
            registered_at: now()
        });
        self.name_record_count += 1;

        let treasury_amount: Int = (pendingToFinalize.price_paid * USERNAME_TREASURY_SHARE_BPS) / USERNAME_SPLIT_BASE_BPS;
        let burn_amount: Int = pendingToFinalize.price_paid - treasury_amount;
        self.treasury_due_ath += treasury_amount;
        self.burn_due_ath += burn_amount;
        self.sendAthNotificationAck(self.official_ath_wallet_address, pendingToFinalize.query_id, pendingToFinalize.sender_key, pendingToFinalize.price_paid);
    }

    bounced(msg: bounced<InitializeUsernameItem>) {
        // Username mint finality is intentionally item-driven: pending mints clear only on deterministic item ACK or deploy bounce/refund, not on arbitrary timeout prune.
        self.requireSealed();
        let nameFromItem: Int? = self.pending_item_to_name_hash.get(sender());
        throwUnless(19140, nameFromItem != null);
        let pendingOpt: PendingUsernameMint? = self.pending_mints.get(nameFromItem!!);
        throwUnless(19141, pendingOpt != null);

        let cleared: PendingUsernameMint = self.clearPendingMint(nameFromItem!!);
        self.sendAthNotificationRefund(cleared.query_id, cleared.sender_key, cleared.price_paid);
    }

    receive(msg: FlushTreasuryAthDue) {
        self.requireSealed();
        throwUnless(19210, msg.query_id > 0);
        self.requireNoDueFlushQuery(msg.query_id);
        throwUnless(19211, self.treasury_due_ath > 0);
        throwUnless(19212, context().value >= USERNAME_ATH_TRANSFER_EXEC_RESERVE + USERNAME_DUE_FLUSH_LOCAL_EXEC_RESERVE);
        throwUnless(19213, self.isBasechainAddress(self.treasury_ath_receiver_address));

        let amount: Int = self.treasury_due_ath;
        self.treasury_due_ath = 0;
        let recipient_ath_wallet: Address = self.deriveAthWalletAddress(self.treasury_ath_receiver_address);

        self.pending_treasury_flushes.set(msg.query_id, PendingAthTreasuryFlush {
            amount: amount,
            recipient_ath_wallet: recipient_ath_wallet,
            created_at: now()
        });
        self.pending_treasury_flush_count += 1;

        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: USERNAME_ATH_TRANSFER_EXEC_RESERVE,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: ATHTransferRequest {
                query_id: msg.query_id,
                amount: amount,
                recipient: self.treasury_ath_receiver_address,
                response_destination: myAddress()
            }.toCell()
        });
    }

    receive(msg: FlushBurnAthDue) {
        self.requireSealed();
        throwUnless(19220, msg.query_id > 0);
        self.requireNoDueFlushQuery(msg.query_id);
        throwUnless(19221, self.burn_due_ath > 0);
        throwUnless(19222, context().value >= USERNAME_ATH_BURN_EXEC_RESERVE + USERNAME_DUE_FLUSH_LOCAL_EXEC_RESERVE);

        let amount: Int = self.burn_due_ath;
        self.burn_due_ath = 0;

        self.pending_burn_flushes.set(msg.query_id, PendingAthBurnFlush {
            amount: amount,
            created_at: now()
        });
        self.pending_burn_flush_count += 1;

        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: USERNAME_ATH_BURN_EXEC_RESERVE,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: ATHBurn {
                query_id: msg.query_id,
                amount: amount,
                response_destination: myAddress()
            }.toCell()
        });
    }

    receive(msg: ATHTransferAck) {
        self.requireSealed();
        let treasuryPendingOpt: PendingAthTreasuryFlush? = self.pending_treasury_flushes.get(msg.query_id);
        throwUnless(19230, treasuryPendingOpt != null);
        let treasuryPending: PendingAthTreasuryFlush = self.clearPendingTreasuryFlush(msg.query_id);
        throwUnless(19231, msg.amount == treasuryPending.amount);
        throwUnless(19232, sender() == treasuryPending.recipient_ath_wallet);
    }

    receive(msg: ATHTransferFailed) {
        self.requireSealed();
        throwUnless(19158, sender() == self.official_ath_wallet_address);
        let treasuryPendingOpt: PendingAthTreasuryFlush? = self.pending_treasury_flushes.get(msg.query_id);
        throwUnless(19240, treasuryPendingOpt != null);
        let treasuryPending: PendingAthTreasuryFlush = self.clearPendingTreasuryFlush(msg.query_id);
        throwUnless(19241, msg.amount == treasuryPending.amount);
        self.treasury_due_ath += treasuryPending.amount;
    }

    receive(msg: ATHBurnFinalized) {
        self.requireSealed();
        throwUnless(19270, sender() == self.ath_master_address);
        throwUnless(19271, msg.owner_address == myAddress());
        let pending: PendingAthBurnFlush = self.clearPendingBurnFlush(msg.query_id);
        throwUnless(19272, msg.amount == pending.amount);
    }

    receive(msg: ATHBurnFailed) {
        self.requireSealed();
        throwUnless(19280, sender() == self.official_ath_wallet_address);
        let pending: PendingAthBurnFlush = self.clearPendingBurnFlush(msg.query_id);
        throwUnless(19281, msg.amount == pending.amount);
        self.burn_due_ath += pending.amount;
    }

    bounced(msg: bounced<ATHTransferRequest>) {
        self.requireSealed();
        throwUnless(19160, sender() == self.official_ath_wallet_address);
        let treasuryPendingOpt: PendingAthTreasuryFlush? = self.pending_treasury_flushes.get(msg.query_id);
        throwUnless(19242, treasuryPendingOpt != null);
        let treasuryPending: PendingAthTreasuryFlush = self.clearPendingTreasuryFlush(msg.query_id);
        throwUnless(19243, msg.amount == treasuryPending.amount);
        self.treasury_due_ath += treasuryPending.amount;
    }

    bounced(msg: bounced<ATHBurn>) {
        self.requireSealed();
        throwUnless(19290, sender() == self.official_ath_wallet_address);
        let pending: PendingAthBurnFlush = self.clearPendingBurnFlush(msg.query_id);
        throwUnless(19291, msg.amount == pending.amount);
        self.burn_due_ath += pending.amount;
    }

    receive(msg: PrunePendingUsernameMint) {
        self.requireSealed();
        throwUnless(19305, context().value >= USERNAME_PRUNE_PENDING_MINT_EXEC_RESERVE);
        throwUnless(19301, msg.name_hash != 0);
        let pendingOpt: PendingUsernameMint? = self.pending_mints.get(msg.name_hash);
        throwUnless(19302, pendingOpt != null);
        let pending: PendingUsernameMint = pendingOpt!!;
        throwUnless(19303, now() >= pending.created_at + USERNAME_PENDING_MINT_STALE_TTL);
        throwUnless(19304, !self.name_records.exists(msg.name_hash));
        // Conservative seam policy: do not refund a Vault-funded mint until UsernameNFTItem ACK/bounce proves item deployment finality.
        throw(19307);
    }

    receive(msg: UsernameRegistryTopUpStorageReserve) {
        // Accept TON for storage reserve only. Grants no authority and mutates no protocol state.
    }

    fun appendUsernameSvgChar(b: StringBuilder, ch: Int): StringBuilder {
        if (ch == 45) { return b.concat("-"); }
        if (ch == 48) { return b.concat("0"); }
        if (ch == 49) { return b.concat("1"); }
        if (ch == 50) { return b.concat("2"); }
        if (ch == 51) { return b.concat("3"); }
        if (ch == 52) { return b.concat("4"); }
        if (ch == 53) { return b.concat("5"); }
        if (ch == 54) { return b.concat("6"); }
        if (ch == 55) { return b.concat("7"); }
        if (ch == 56) { return b.concat("8"); }
        if (ch == 57) { return b.concat("9"); }
        if (ch == 95) { return b.concat("_"); }
        if (ch == 97) { return b.concat("a"); }
        if (ch == 98) { return b.concat("b"); }
        if (ch == 99) { return b.concat("c"); }
        if (ch == 100) { return b.concat("d"); }
        if (ch == 101) { return b.concat("e"); }
        if (ch == 102) { return b.concat("f"); }
        if (ch == 103) { return b.concat("g"); }
        if (ch == 104) { return b.concat("h"); }
        if (ch == 105) { return b.concat("i"); }
        if (ch == 106) { return b.concat("j"); }
        if (ch == 107) { return b.concat("k"); }
        if (ch == 108) { return b.concat("l"); }
        if (ch == 109) { return b.concat("m"); }
        if (ch == 110) { return b.concat("n"); }
        if (ch == 111) { return b.concat("o"); }
        if (ch == 112) { return b.concat("p"); }
        if (ch == 113) { return b.concat("q"); }
        if (ch == 114) { return b.concat("r"); }
        if (ch == 115) { return b.concat("s"); }
        if (ch == 116) { return b.concat("t"); }
        if (ch == 117) { return b.concat("u"); }
        if (ch == 118) { return b.concat("v"); }
        if (ch == 119) { return b.concat("w"); }
        if (ch == 120) { return b.concat("x"); }
        if (ch == 121) { return b.concat("y"); }
        if (ch == 122) { return b.concat("z"); }
        return b;
    }

    fun appendSvgTile(b: StringBuilder, tileStart: String, ch: Int): StringBuilder {
        b.append(tileStart);
        b = self.appendUsernameSvgChar(b, ch);
        b.append("</text>");
        return b;
    }

    fun appendEpicTile(b: StringBuilder, i: Int, ch: Int): StringBuilder {
        if (i == 0) { return self.appendSvgTile(b, "<rect x=\"169\" y=\"374\" width=\"152\" height=\"152\" rx=\"20\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/><text x=\"245\" y=\"478\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"97\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        if (i == 1) { return self.appendSvgTile(b, "<rect x=\"347\" y=\"374\" width=\"152\" height=\"152\" rx=\"20\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/><text x=\"423\" y=\"478\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"97\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        if (i == 2) { return self.appendSvgTile(b, "<rect x=\"525\" y=\"374\" width=\"152\" height=\"152\" rx=\"20\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/><text x=\"601\" y=\"478\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"97\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        if (i == 3) { return self.appendSvgTile(b, "<rect x=\"703\" y=\"374\" width=\"152\" height=\"152\" rx=\"20\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/><text x=\"779\" y=\"478\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"97\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        return b;
    }

    fun appendRareTile(b: StringBuilder, i: Int, ch: Int): StringBuilder {
        if (i == 0) { return self.appendSvgTile(b, "<rect x=\"162\" y=\"386\" width=\"132\" height=\"132\" rx=\"17\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/><text x=\"228\" y=\"476\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"84\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        if (i == 1) { return self.appendSvgTile(b, "<rect x=\"304\" y=\"386\" width=\"132\" height=\"132\" rx=\"17\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/><text x=\"370\" y=\"476\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"84\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        if (i == 2) { return self.appendSvgTile(b, "<rect x=\"446\" y=\"386\" width=\"132\" height=\"132\" rx=\"17\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/><text x=\"512\" y=\"476\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"84\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        if (i == 3) { return self.appendSvgTile(b, "<rect x=\"588\" y=\"386\" width=\"132\" height=\"132\" rx=\"17\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/><text x=\"654\" y=\"476\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"84\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        if (i == 4) { return self.appendSvgTile(b, "<rect x=\"730\" y=\"386\" width=\"132\" height=\"132\" rx=\"17\" fill=\"#151a1d\" stroke=\"url(#tier-tile)\" stroke-width=\"4\"/><text x=\"796\" y=\"476\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"84\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        return b;
    }

    fun appendCommonSingleTile(b: StringBuilder, len: Int, i: Int, ch: Int): StringBuilder {
        if (len == 6) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"252\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"292\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"340\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"380\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"428\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"468\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 3) { return self.appendSvgTile(b, "<rect x=\"516\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"556\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 4) { return self.appendSvgTile(b, "<rect x=\"604\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"644\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 5) { return self.appendSvgTile(b, "<rect x=\"692\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"732\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        }
        if (len == 7) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"208\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"248\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"296\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"336\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"384\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"424\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 3) { return self.appendSvgTile(b, "<rect x=\"472\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"512\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 4) { return self.appendSvgTile(b, "<rect x=\"560\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"600\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 5) { return self.appendSvgTile(b, "<rect x=\"648\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"688\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 6) { return self.appendSvgTile(b, "<rect x=\"736\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"776\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        }
        if (len == 8) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"164\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"204\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"252\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"292\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"340\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"380\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 3) { return self.appendSvgTile(b, "<rect x=\"428\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"468\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 4) { return self.appendSvgTile(b, "<rect x=\"516\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"556\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 5) { return self.appendSvgTile(b, "<rect x=\"604\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"644\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 6) { return self.appendSvgTile(b, "<rect x=\"692\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"732\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 7) { return self.appendSvgTile(b, "<rect x=\"780\" y=\"418\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"820\" y=\"474\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        }
        return b;
    }

    fun appendCommonTopTile(b: StringBuilder, i: Int, ch: Int): StringBuilder {
        if (i == 0) { return self.appendSvgTile(b, "<rect x=\"164\" y=\"372\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"204\" y=\"428\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        if (i == 1) { return self.appendSvgTile(b, "<rect x=\"252\" y=\"372\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"292\" y=\"428\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        if (i == 2) { return self.appendSvgTile(b, "<rect x=\"340\" y=\"372\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"380\" y=\"428\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        if (i == 3) { return self.appendSvgTile(b, "<rect x=\"428\" y=\"372\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"468\" y=\"428\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        if (i == 4) { return self.appendSvgTile(b, "<rect x=\"516\" y=\"372\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"556\" y=\"428\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        if (i == 5) { return self.appendSvgTile(b, "<rect x=\"604\" y=\"372\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"644\" y=\"428\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        if (i == 6) { return self.appendSvgTile(b, "<rect x=\"692\" y=\"372\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"732\" y=\"428\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        if (i == 7) { return self.appendSvgTile(b, "<rect x=\"780\" y=\"372\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"820\" y=\"428\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        return b;
    }

    fun appendCommonSecondTile(b: StringBuilder, rem: Int, i: Int, ch: Int): StringBuilder {
        if (rem == 1) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"472\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"512\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        }
        if (rem == 2) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"428\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"468\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"516\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"556\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        }
        if (rem == 3) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"384\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"424\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"472\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"512\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"560\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"600\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        }
        if (rem == 4) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"340\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"380\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"428\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"468\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"516\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"556\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 3) { return self.appendSvgTile(b, "<rect x=\"604\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"644\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        }
        if (rem == 5) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"296\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"336\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"384\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"424\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"472\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"512\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 3) { return self.appendSvgTile(b, "<rect x=\"560\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"600\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 4) { return self.appendSvgTile(b, "<rect x=\"648\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"688\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        }
        if (rem == 6) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"252\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"292\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"340\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"380\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"428\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"468\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 3) { return self.appendSvgTile(b, "<rect x=\"516\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"556\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 4) { return self.appendSvgTile(b, "<rect x=\"604\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"644\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 5) { return self.appendSvgTile(b, "<rect x=\"692\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"732\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        }
        if (rem == 7) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"208\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"248\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"296\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"336\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"384\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"424\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 3) { return self.appendSvgTile(b, "<rect x=\"472\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"512\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 4) { return self.appendSvgTile(b, "<rect x=\"560\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"600\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 5) { return self.appendSvgTile(b, "<rect x=\"648\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"688\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 6) { return self.appendSvgTile(b, "<rect x=\"736\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"776\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        }
        if (rem == 8) {
            if (i == 0) { return self.appendSvgTile(b, "<rect x=\"164\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"204\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 1) { return self.appendSvgTile(b, "<rect x=\"252\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"292\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 2) { return self.appendSvgTile(b, "<rect x=\"340\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"380\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 3) { return self.appendSvgTile(b, "<rect x=\"428\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"468\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 4) { return self.appendSvgTile(b, "<rect x=\"516\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"556\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 5) { return self.appendSvgTile(b, "<rect x=\"604\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"644\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 6) { return self.appendSvgTile(b, "<rect x=\"692\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"732\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
            if (i == 7) { return self.appendSvgTile(b, "<rect x=\"780\" y=\"464\" width=\"80\" height=\"80\" rx=\"13\" fill=\"#151a1d\" stroke=\"#283136\" stroke-width=\"2\"/><text x=\"820\" y=\"520\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"52\" font-weight=\"850\" text-anchor=\"middle\">", ch); }
        }
        return b;
    }

    fun appendUsernameTiles(b: StringBuilder, usernameCell: Cell, username_len: Int): StringBuilder {
        let cursor: Slice = usernameCell.beginParse();
        let i: Int = 0;
        if (username_len == 4) {
            while (i < 4) {
                let ch: Int = cursor.loadUint(8);
                b = self.appendEpicTile(b, i, ch);
                i += 1;
            }
            return b;
        }
        if (username_len == 5) {
            while (i < 5) {
                let ch: Int = cursor.loadUint(8);
                b = self.appendRareTile(b, i, ch);
                i += 1;
            }
            return b;
        }
        if (username_len <= 8) {
            while (i < username_len) {
                let ch: Int = cursor.loadUint(8);
                b = self.appendCommonSingleTile(b, username_len, i, ch);
                i += 1;
            }
            return b;
        }
        while (i < 8) {
            let ch: Int = cursor.loadUint(8);
            b = self.appendCommonTopTile(b, i, ch);
            i += 1;
        }
        let j: Int = 0;
        let rem: Int = username_len - 8;
        while (j < rem) {
            let ch: Int = cursor.loadUint(8);
            b = self.appendCommonSecondTile(b, rem, j, ch);
            j += 1;
        }
        return b;
    }

    fun appendSvgUsernameLine(b: StringBuilder, usernameCell: Cell, username_len: Int): StringBuilder {
        let cursor: Slice = usernameCell.beginParse();
        let i: Int = 0;
        while (i < username_len) {
            let ch: Int = cursor.loadUint(8);
            b = self.appendUsernameSvgChar(b, ch);
            i += 1;
        }
        return b;
    }

    fun appendLengthNumber(b: StringBuilder, n: Int): StringBuilder {
        if (n >= 10) {
            let tens: Int = n / 10;
            b = self.appendUsernameSvgChar(b, 48 + tens);
        }
        b = self.appendUsernameSvgChar(b, 48 + (n % 10));
        return b;
    }

    fun appendSvgDefs(b: StringBuilder, username_len: Int): StringBuilder {
        b.append("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1024 1024\" role=\"img\"><defs><linearGradient id=\"bg\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#0d1113\"/><stop offset=\"1\" stop-color=\"#0b0d0f\"/></linearGradient><linearGradient id=\"teal\" x1=\"0\" y1=\"1\" x2=\"1\" y2=\"0\"><stop offset=\"0\" stop-color=\"#2be6ad\"/><stop offset=\".55\" stop-color=\"#30d5b0\"/><stop offset=\"1\" stop-color=\"#25c99b\"/></linearGradient>");
        if (username_len == 4) {
            b.append("<linearGradient id=\"common-line\" x1=\"104\" y1=\"0\" x2=\"920\" y2=\"0\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#0b0d0f\" stop-opacity=\"0\"/><stop offset=\".06\" stop-color=\"#8d6727\" stop-opacity=\".74\"/><stop offset=\".5\" stop-color=\"#f0c76b\"/><stop offset=\".94\" stop-color=\"#8d6727\" stop-opacity=\".74\"/><stop offset=\"1\" stop-color=\"#0b0d0f\" stop-opacity=\"0\"/></linearGradient><linearGradient id=\"tier-tile\" x1=\"0\" y1=\"374\" x2=\"0\" y2=\"526\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#f6d98b\"/><stop offset=\".48\" stop-color=\"#d7ad57\"/><stop offset=\"1\" stop-color=\"#8d6727\"/></linearGradient>");
        } else {
            if (username_len == 5) {
                b.append("<linearGradient id=\"common-line\" x1=\"104\" y1=\"0\" x2=\"920\" y2=\"0\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#0b0d0f\" stop-opacity=\"0\"/><stop offset=\".06\" stop-color=\"#727b80\" stop-opacity=\".78\"/><stop offset=\".5\" stop-color=\"#e1e8e6\"/><stop offset=\".94\" stop-color=\"#727b80\" stop-opacity=\".78\"/><stop offset=\"1\" stop-color=\"#0b0d0f\" stop-opacity=\"0\"/></linearGradient><linearGradient id=\"tier-tile\" x1=\"0\" y1=\"386\" x2=\"0\" y2=\"518\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#eef4f2\"/><stop offset=\".48\" stop-color=\"#b9c3c3\"/><stop offset=\"1\" stop-color=\"#687279\"/></linearGradient>");
            } else {
                b.append("<linearGradient id=\"common-line\" x1=\"104\" y1=\"0\" x2=\"920\" y2=\"0\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#0b0d0f\" stop-opacity=\"0\"/><stop offset=\".06\" stop-color=\"#1e262a\" stop-opacity=\".62\"/><stop offset=\".5\" stop-color=\"#30d5b0\"/><stop offset=\".94\" stop-color=\"#1e262a\" stop-opacity=\".62\"/><stop offset=\"1\" stop-color=\"#0b0d0f\" stop-opacity=\"0\"/></linearGradient>");
            }
        }
        b.append("</defs>");
        return b;
    }

    fun appendSvgShell(b: StringBuilder, usernameCell: Cell, username_len: Int): StringBuilder {
        b = self.appendSvgDefs(b, username_len);
        b.append("<rect width=\"1024\" height=\"1024\" fill=\"url(#bg)\"/><rect x=\"76\" y=\"76\" width=\"872\" height=\"872\" rx=\"44\" fill=\"#111417\" stroke=\"#283136\" stroke-width=\"2\"/><rect x=\"104\" y=\"104\" width=\"816\" height=\"816\" rx=\"28\" fill=\"#0b0d0f\" stroke=\"#1e262a\" stroke-width=\"2\"/>");
        if (username_len == 4) {
            b.append("<path d=\"M104 104h816\" stroke=\"url(#common-line)\" stroke-width=\"6\" stroke-linecap=\"round\"/><path d=\"M104 920h816\" stroke=\"url(#common-line)\" stroke-width=\"4\" stroke-linecap=\"round\" opacity=\".44\"/>");
        } else {
            if (username_len == 5) {
                b.append("<path d=\"M104 104h816\" stroke=\"url(#common-line)\" stroke-width=\"6\" stroke-linecap=\"round\"/><path d=\"M104 920h816\" stroke=\"url(#common-line)\" stroke-width=\"4\" stroke-linecap=\"round\" opacity=\".44\"/>");
            } else {
                b.append("<path d=\"M104 104h816\" stroke=\"url(#common-line)\" stroke-width=\"6\" stroke-linecap=\"round\"/><path d=\"M104 920h816\" stroke=\"url(#common-line)\" stroke-width=\"4\" stroke-linecap=\"round\" opacity=\".44\"/>");
            }
        }
        b.append("<rect x=\"124\" y=\"122\" width=\"94\" height=\"94\" rx=\"22\" fill=\"#111417\" stroke=\"#1e262a\"/><g transform=\"matrix(0.160156 0 0 -0.160156 130 210)\"><path fill=\"url(#teal)\" fill-rule=\"evenodd\" d=\"");
        b.append("M167.5 432.1 L330.5 432.1 L346.5 429.9 L364.5 424.8 L380.5 417.7 L393.5 409.6 L404.5 401.0 L416.0 389.5 L425.8 376.5 L435.9 358.5 L441.7 343.5 L445.9 325.5 L446.9 296.5 L445.8 285.5 L442.8 271.5 L435.7 251.5 L425.9 233.5 L416.9 221.5 L402.5 207.1 L387.5 196.1 L362.5 184.1 L348.5 180.1 L334.5 178.0 L221.5 177.2 L220.5 79.2 L137.5 79.4 L137.2 139.5 L166.5 140.2 L166.8 174.5 L136.5 175.1 L135.6 174.5 L135.7 163.5 L134.5 162.8 L104.1 163.5 L104.5 192.7 L134.5 192.9 L135.5 193.5 L135.4 220.5 L136.2 221.5 L166.8 222.5 L166.5 253.0 L135.5 253.3 L134.5 235.2 L105.5 235.1 L104.1 236.5 L104.3 264.5 L134.5 265.3 L135.5 292.5 L197.5 292.7 L198.4 293.5 L198.0 323.5 L166.8 324.5 L167.3 364.5 L198.4 365.5 L198.3 394.5 L166.9 395.5 L166.7 430.5 L167.5 432.1 Z M104.5 407.6 L134.9 407.5 L134.5 377.7 L104.5 377.9 L104.5 407.6 Z M221.5 372.3 L221.5 237.2 L322.5 237.1 L329.5 238.1 L342.5 242.1 L352.5 247.4 L359.5 252.8 L369.6 263.5 L377.0 275.5 L381.5 288.5 L383.1 298.5 L382.7 316.5 L379.7 327.5 L374.8 338.5 L368.9 347.5 L358.5 357.9 L344.5 366.7 L332.5 370.8 L322.5 372.4 L221.5 372.3 Z M65.5 324.3 L93.5 324.3 L93.9 294.5 L64.9 294.5 L64.6 322.5 L65.5 324.3 Z");
        b.append("\"/></g><text x=\"244\" y=\"176\" fill=\"#f4f7f5\" font-family=\"Arial,sans-serif\" font-size=\"34\" font-weight=\"800\">Platho usernames</text>");
        if (username_len == 4) {
            b.append("<rect x=\"732\" y=\"134\" width=\"156\" height=\"58\" rx=\"12\" fill=\"#17130b\" stroke=\"#d7ad57\" stroke-opacity=\".68\"/><text x=\"810\" y=\"173\" fill=\"#f0c76b\" font-family=\"Arial,sans-serif\" font-size=\"25\" font-weight=\"900\" text-anchor=\"middle\">EPIC</text><circle cx=\"512\" cy=\"512\" r=\"280\" fill=\"none\" stroke=\"#d7ad57\" stroke-width=\"2\" opacity=\".09\"/><circle cx=\"512\" cy=\"512\" r=\"218\" fill=\"none\" stroke=\"#f0c76b\" stroke-width=\"2\" opacity=\".13\"/>");
        } else {
            if (username_len == 5) {
                b.append("<rect x=\"732\" y=\"134\" width=\"156\" height=\"58\" rx=\"12\" fill=\"#14171a\" stroke=\"#b9c3c3\" stroke-opacity=\".68\"/><text x=\"810\" y=\"173\" fill=\"#d9e0df\" font-family=\"Arial,sans-serif\" font-size=\"25\" font-weight=\"900\" text-anchor=\"middle\">RARE</text><circle cx=\"512\" cy=\"512\" r=\"280\" fill=\"none\" stroke=\"#b9c3c3\" stroke-width=\"2\" opacity=\".09\"/><circle cx=\"512\" cy=\"512\" r=\"218\" fill=\"none\" stroke=\"#d9e0df\" stroke-width=\"2\" opacity=\".13\"/>");
            } else {
                b.append("<rect x=\"732\" y=\"134\" width=\"156\" height=\"58\" rx=\"12\" fill=\"#111417\" stroke=\"#283136\"/><text x=\"810\" y=\"173\" fill=\"#96a19c\" font-family=\"Arial,sans-serif\" font-size=\"25\" font-weight=\"900\" text-anchor=\"middle\">COMMON</text><circle cx=\"512\" cy=\"512\" r=\"280\" fill=\"none\" stroke=\"#30d5b0\" stroke-width=\"2\" opacity=\".09\"/><circle cx=\"512\" cy=\"512\" r=\"218\" fill=\"none\" stroke=\"#66726d\" stroke-width=\"2\" opacity=\".13\"/>");
            }
        }
        b.append("<rect x=\"122\" y=\"312\" width=\"780\" height=\"350\" rx=\"32\" fill=\"#111417\" fill-opacity=\".94\" stroke=\"#283136\" stroke-width=\"2\"/><g>");
        b = self.appendUsernameTiles(b, usernameCell, username_len);
        b.append("</g>");
        if (username_len == 4) {
            b.append("<text x=\"512\" y=\"592\" fill=\"#f0c76b\" font-family=\"Arial,sans-serif\" font-size=\"44\" font-weight=\"850\" text-anchor=\"middle\">.ath</text>");
        } else {
            if (username_len == 5) {
                b.append("<text x=\"512\" y=\"592\" fill=\"#d9e0df\" font-family=\"Arial,sans-serif\" font-size=\"44\" font-weight=\"850\" text-anchor=\"middle\">.ath</text>");
            } else {
                b.append("<text x=\"512\" y=\"592\" fill=\"#30d5b0\" font-family=\"Arial,sans-serif\" font-size=\"44\" font-weight=\"850\" text-anchor=\"middle\">.ath</text>");
            }
        }
        if (username_len == 4) {
            b.append("<path d=\"M176 612h672\" stroke=\"#d7ad57\" stroke-width=\"4\" stroke-linecap=\"round\" opacity=\".70\"/><text x=\"512\" y=\"640\" fill=\"#b7aa8e\" font-family=\"Arial,sans-serif\" font-size=\"24\" font-weight=\"800\" text-anchor=\"middle\">");
        } else {
            if (username_len == 5) {
                b.append("<path d=\"M176 612h672\" stroke=\"#b9c3c3\" stroke-width=\"4\" stroke-linecap=\"round\" opacity=\".70\"/><text x=\"512\" y=\"640\" fill=\"#aeb8b8\" font-family=\"Arial,sans-serif\" font-size=\"24\" font-weight=\"800\" text-anchor=\"middle\">");
            } else {
                b.append("<path d=\"M176 612h672\" stroke=\"#30d5b0\" stroke-width=\"4\" stroke-linecap=\"round\" opacity=\".65\"/><text x=\"512\" y=\"640\" fill=\"#96a19c\" font-family=\"Arial,sans-serif\" font-size=\"24\" font-weight=\"800\" text-anchor=\"middle\">");
            }
        }
        b = self.appendLengthNumber(b, username_len);
        if (username_len <= 5) {
            b.append(" LETTER USERNAME</text>");
        } else {
            b.append(" CHARACTER USERNAME</text>");
        }
        b.append("<text x=\"512\" y=\"760\" fill=\"#66726d\" font-family=\"Arial,sans-serif\" font-size=\"24\" font-weight=\"750\" text-anchor=\"middle\">transferable on-chain identity</text></svg>");
        return b;
    }

    fun imageDataCell(usernameCell: Cell, username_len: Int): Cell {
        let b: StringBuilder = beginTailString();
        b = self.appendSvgShell(b, usernameCell, username_len);
        return b.toCell();
    }

    // ---------------------------------------------------------------------
    // Optimized on-chain base64 encoder.
    //
    // Reads the raw-SVG snake cell byte-by-byte (loadUint(8) across loadRef()
    // boundaries) and WRITES base64 output as raw bytes (storeUint(code, 8))
    // into hand-managed snake segments. No per-byte cell allocation, no
    // per-char StringBuilder.append(String). Standard 3->4 with '=' padding.
    //
    // Output snake layout: head cell holds the data-URI prefix
    // "data:image/svg+xml;base64," followed by base64 bytes, then chains via a
    // single ref to the next segment, etc. (NFT image snake format, no leading
    // null byte: the IMAGE key is an off-chain-style ASCII URI, mirrored by the
    // contract's prior data:image/svg+xml, layout.)
    //
    // Segments are buffered tail-first via recursion so the snake reads
    // head-first without a map.
    // ---------------------------------------------------------------------

    // Encode an already-built raw-SVG snake cell to a base64 data-URI snake cell.
    // `rawSvg` is the image_data cell built with beginTailString() (leading null
    // marker byte); we skip that one marker byte and base64 exactly the SVG bytes.
    //
    // Performance: the input snake is byte-aligned, so we pull 24-bit (3-byte)
    // groups with a single loadUint(24) on the fast path and emit a 32-bit packed
    // quad with one storeUint(.,32). A small bit-accumulator carries the <24-bit
    // remainder across snake-cell (loadRef) boundaries. Output segments are
    // collected in a map and stitched head-first at the end.
    fun imageCell(rawSvg: Cell): Cell {
        let inS: Slice = rawSvg.beginParse();
        inS.loadUint(8); // skip the snake-string marker byte

        let segs: map<Int as uint16, Cell> = emptyMap();
        let segCount: Int = 0;
        let ob: Builder = beginCell();
        ob = ob.storeSlice("data:image/svg+xml;base64,".asSlice());
        let obBits: Int = ob.bits();

        // bit accumulator (carry < 24 bits across cell boundaries / partial reads)
        let acc: Int = 0;
        let accBits: Int = 0;

        let done: Bool = false;
        while (!done) {
            // FAST PATH A0: the current cell holds four whole 24-bit groups (96 bits
            // = 12 input bytes -> 16 output chars / 128 output bits). One loadUint(96)
            // + four packed storeUint(.,32) maximally amortizes loop/load/store cost.
            if ((accBits == 0) && (inS.bits() >= 96)) {
                if (obBits + 128 > 1016) {
                    segs.set(segCount, ob.endCell());
                    segCount += 1;
                    ob = beginCell();
                    obBits = 0;
                }
                let four: Int = inS.loadUint(96);
                ob = ob.storeUint(b64Quad((four >> 72) & 0xFFFFFF), 32)
                       .storeUint(b64Quad((four >> 48) & 0xFFFFFF), 32)
                       .storeUint(b64Quad((four >> 24) & 0xFFFFFF), 32)
                       .storeUint(b64Quad(four & 0xFFFFFF), 32);
                obBits += 128;
            } else if ((accBits == 0) && (inS.bits() >= 48)) {
            // FAST PATH A: the current cell holds two whole 24-bit groups (48 bits).
            // Pull both with one loadUint(48) and emit 64 output bits, halving the
            // loop-control + load/store count for the common case.
                if (obBits + 64 > 1016) {
                    segs.set(segCount, ob.endCell());
                    segCount += 1;
                    ob = beginCell();
                    obBits = 0;
                }
                let two: Int = inS.loadUint(48);
                ob = ob.storeUint(b64Quad((two >> 24) & 0xFFFFFF), 32).storeUint(b64Quad(two & 0xFFFFFF), 32);
                obBits += 64;
            } else if ((accBits == 0) && (inS.bits() >= 24)) {
                // FAST PATH B: one whole 24-bit group remains in the current cell.
                if (obBits + 32 > 1016) {
                    segs.set(segCount, ob.endCell());
                    segCount += 1;
                    ob = beginCell();
                    obBits = 0;
                }
                ob = ob.storeUint(b64Quad(inS.loadUint(24)), 32);
                obBits += 32;
            } else {
                // SLOW PATH: refill the accumulator up to >=24 bits across cell refs.
                while ((accBits < 24) && ((inS.bits() > 0) || (inS.refs() > 0))) {
                    if (inS.bits() == 0) {
                        inS = inS.loadRef().beginParse();
                    } else {
                        let want: Int = 24 - accBits;          // 8, 16, or 24 wanted
                        let avail: Int = inS.bits();
                        let take: Int = want;
                        if (avail < take) { take = avail; }
                        acc = (acc << take) | inS.loadUint(take);
                        accBits += take;
                    }
                }
                if (accBits >= 24) {
                    if (obBits + 32 > 1016) {
                        segs.set(segCount, ob.endCell());
                        segCount += 1;
                        ob = beginCell();
                        obBits = 0;
                    }
                    let g: Int = (acc >> (accBits - 24)) & 0xFFFFFF;
                    ob = ob.storeUint(b64Quad(g), 32);
                    obBits += 32;
                    accBits -= 24;
                    if (accBits == 0) {
                        acc = 0;
                    } else {
                        acc = acc & ((1 << accBits) - 1);
                    }
                } else {
                    done = true;
                }
            }
        }
        // Tail group: accBits is 0, 8, or 16 here.
        if (accBits == 8) {
            let b0: Int = acc & 0xFF;
            let c0: Int = b64Code((b0 >> 2) & 63);
            let c1: Int = b64Code((b0 << 4) & 63);
            if (obBits + 32 > 1016) {
                segs.set(segCount, ob.endCell());
                segCount += 1;
                ob = beginCell();
                obBits = 0;
            }
            ob = ob.storeUint(c0, 8).storeUint(c1, 8).storeUint(61, 8).storeUint(61, 8); // '=='
        }
        if (accBits == 16) {
            let w: Int = acc & 0xFFFF;
            let c0: Int = b64Code((w >> 10) & 63);
            let c1: Int = b64Code((w >> 4) & 63);
            let c2: Int = b64Code((w << 2) & 63);
            if (obBits + 32 > 1016) {
                segs.set(segCount, ob.endCell());
                segCount += 1;
                ob = beginCell();
                obBits = 0;
            }
            ob = ob.storeUint(c0, 8).storeUint(c1, 8).storeUint(c2, 8).storeUint(61, 8); // '='
        }
        // Stitch segments head-first: segs[0] is the head, tail is the active builder.
        let chained: Cell = ob.endCell();
        let k: Int = segCount - 1;
        while (k >= 0) {
            let seg: Slice = segs.get(k)!!.beginParse();
            chained = beginCell().storeSlice(seg).storeRef(chained).endCell();
            k -= 1;
        }
        return chained;
    }

    get fun get_username_price(name_len: Int): UsernamePriceView {
        if (!self.isValidNameLength(name_len)) {
            return UsernamePriceView { valid_length: false, price_ath_atomic: 0 };
        }
        return UsernamePriceView { valid_length: true, price_ath_atomic: self.priceForLength(name_len) };
    }

    get fun get_username_item_address(name_hash: Int): Address {
        return self.deriveItemAddress(name_hash);
    }

    get fun get_nft_address_by_index(index: Int): Address {
        return self.deriveItemAddress(index);
    }

    get fun get_nft_content(index: Int, individual_content: Cell): Cell {
        // Collection completes the item partial content (TEP-62): read the username from the
        // item name and ADD the rendered on-chain SVG image keys. The item carries no art.
        let content: UsernameNftOnchainContent = UsernameNftOnchainContent.fromCell(individual_content);
        let nameOpt: Cell? = content.metadata.get(USERNAME_COLLECTION_METADATA_KEY_NAME);
        throwUnless(19350, nameOpt != null);
        let s: Slice = nameOpt!!.beginParse();
        s.loadUint(8);                       // skip snake-string marker byte
        let remaining: Int = s.bits();       // username_len*8 + 32 (".ath")
        throwUnless(19351, remaining >= 64);
        throwUnless(19352, (remaining - 32) % 8 == 0);
        let username_len: Int = (remaining - 32) / 8;
        throwUnless(19353, (username_len >= 4) && (username_len <= USERNAME_MAX_LENGTH));
        let usernameCell: Cell = beginCell().storeSlice(s.loadBits(username_len * 8)).endCell();
        let metadata: map<Int as uint256, Cell> = content.metadata;
        // Build the raw SVG once; reuse it for image_data and as the base64 source.
        let rawSvg: Cell = self.imageDataCell(usernameCell, username_len);
        metadata.set(USERNAME_COLLECTION_METADATA_KEY_IMAGE, self.imageCell(rawSvg));
        metadata.set(USERNAME_COLLECTION_METADATA_KEY_IMAGE_DATA, rawSvg);
        return UsernameNftOnchainContent { marker: 0, metadata: metadata }.toCell();
    }

    get fun get_collection_data(): UsernameCollectionDataView {
        return UsernameCollectionDataView {
            next_item_index: USERNAME_COLLECTION_UNORDERED_NEXT_INDEX,
            collection_content: self.collectionContent(),
            owner_address: self.treasury_ath_receiver_address
        };
    }

    get fun get_name_record(name_hash: Int): UsernameNameRecordView {
        let recOpt: NameRecord? = self.name_records.get(name_hash);
        if (recOpt == null) {
            return UsernameNameRecordView {
                exists: false,
                minter_wallet: self.official_ath_wallet_address,
                item_address: self.official_ath_wallet_address,
                registered_at: 0
            };
        }
        let rec: NameRecord = recOpt!!;
        return UsernameNameRecordView {
            exists: true,
            minter_wallet: rec.minter_wallet,
            item_address: rec.item_address,
            registered_at: rec.registered_at
        };
    }

    get fun get_pending_mint(name_hash: Int): PendingUsernameMintView {
        let pendingOpt: PendingUsernameMint? = self.pending_mints.get(name_hash);
        if (pendingOpt == null) {
            return PendingUsernameMintView {
                exists: false,
                query_id: 0,
                sender_key: 0,
                owner_wallet: self.official_ath_wallet_address,
                name_hash: 0,
                price_paid: 0,
                item_address: self.official_ath_wallet_address,
                item_deploy_value: 0,
                created_at: 0
            };
        }
        let pending: PendingUsernameMint = pendingOpt!!;
        return PendingUsernameMintView {
            exists: true,
            query_id: pending.query_id,
            sender_key: pending.sender_key,
            owner_wallet: pending.owner_wallet,
            name_hash: pending.name_hash,
            price_paid: pending.price_paid,
            item_address: pending.item_address,
            item_deploy_value: pending.item_deploy_value,
            created_at: pending.created_at
        };
    }

    get fun get_pending_treasury_flush(query_id: Int): PendingAthTreasuryFlushView {
        let pendingOpt: PendingAthTreasuryFlush? = self.pending_treasury_flushes.get(query_id);
        if (pendingOpt == null) {
            return PendingAthTreasuryFlushView {
                exists: false,
                amount: 0,
                recipient_ath_wallet: self.official_ath_wallet_address,
                created_at: 0
            };
        }
        let pending: PendingAthTreasuryFlush = pendingOpt!!;
        return PendingAthTreasuryFlushView {
            exists: true,
            amount: pending.amount,
            recipient_ath_wallet: pending.recipient_ath_wallet,
            created_at: pending.created_at
        };
    }

    get fun get_pending_burn_flush(query_id: Int): PendingAthBurnFlushView {
        let pendingOpt: PendingAthBurnFlush? = self.pending_burn_flushes.get(query_id);
        if (pendingOpt == null) {
            return PendingAthBurnFlushView {
                exists: false,
                amount: 0,
                created_at: 0
            };
        }
        let pending: PendingAthBurnFlush = pendingOpt!!;
        return PendingAthBurnFlushView {
            exists: true,
            amount: pending.amount,
            created_at: pending.created_at
        };
    }

    get fun get_ath_wallet_address(owner_wallet: Address): Address {
        return self.deriveAthWalletAddress(owner_wallet);
    }

    get fun get_global(): UsernameRegistryGlobalView {
        return UsernameRegistryGlobalView {
            sealed: self.sealed,
            official_ath_wallet_bound: self.official_ath_wallet_bound,
            vault_bound: self.vault_bound,
            deployment_manifest_hash: self.deployment_manifest_hash,
            genesis_config_hash: self.genesis_config_hash,
            official_ath_wallet_address: self.official_ath_wallet_address,
            vault_address: self.vault_address,
            genesis_controller_address: self.genesis_controller_address,
            name_record_count: self.name_record_count,
            pending_mint_count: self.pending_mint_count,
            treasury_due_ath: self.treasury_due_ath,
            burn_due_ath: self.burn_due_ath,
            pending_treasury_flush_count: self.pending_treasury_flush_count,
            pending_burn_flush_count: self.pending_burn_flush_count,
            pending_mint_stale_ttl: USERNAME_PENDING_MINT_STALE_TTL
        };
    }

    receive() {
        throw(19099);
    }
}
