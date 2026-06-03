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
const USERNAME_NFT_ITEM_DEPLOY_RESERVE: Int = 21000000;
const USERNAME_ATH_TRANSFER_EXEC_RESERVE: Int = 30000000;
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
const USERNAME_COLLECTION_UNORDERED_NEXT_INDEX: Int = -1;

const OP_USERNAME_BIND_OFFICIAL_ATH_WALLET: Int = 0x663DF03D;
const OP_USERNAME_BIND_VAULT: Int = 0x60A61104;
const OP_SEAL_GENESIS: Int = 0x3A12D1AD;

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
    created_at: Int as uint32;
}

struct NameRecord {
    owner_wallet: Address;
    item_address: Address;
    registered_at: Int as uint32;
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
    owner_wallet: Address;
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
    created_at: Int as uint32;
}

struct PendingAthBurnFlush {
    amount: Int as uint128;
    created_at: Int as uint32;
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
            owner_wallet: pendingToFinalize.owner_wallet,
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
        throw(19307);
    }

    receive(msg: UsernameRegistryTopUpStorageReserve) {
        // Accept TON for storage reserve only. Grants no authority and mutates no protocol state.
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
        return individual_content;
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
                owner_wallet: self.official_ath_wallet_address,
                item_address: self.official_ath_wallet_address,
                registered_at: 0
            };
        }
        let rec: NameRecord = recOpt!!;
        return UsernameNameRecordView {
            exists: true,
            owner_wallet: rec.owner_wallet,
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
