// Platho v1 UsernameRegistry implementation through M13.
// Scope: official ATH notification username mint, deterministic UsernameNFTItem deploy + ACK finalization,
// exact price tiers, raw lowercase ASCII username validation, refund-due accounting for rejected official mints,
// bounce-safe refund/treasury/burn due flushes, and stale pending mint prune.
// No admin/owner override/pause/upgrade/governance/rescue/fallback behavior is implemented.
// No BuybackBurn route, adapter, migration, or compatibility path is implemented.

import "./UsernameNFTItem.tact";
import "./ATHWallet.tact";

const USERNAME_PRICE_4_CHARS: Int = 10000000000000;      // 10,000 ATH atomic units
const USERNAME_PRICE_5_CHARS: Int = 1000000000000;       // 1,000 ATH atomic units
const USERNAME_PRICE_6_PLUS_CHARS: Int = 100000000000;   // 100 ATH atomic units
const USERNAME_PENDING_MINT_STORAGE_ENDOWMENT: Int = 6000000;
const USERNAME_ATH_REFUND_DUE_STORAGE_ENDOWMENT: Int = 4000000;
const USERNAME_STATE_GROWTH_EXEC_RESERVE: Int = 2000000;
const USERNAME_NFT_ITEM_DEPLOY_RESERVE: Int = 20000000;
const USERNAME_ATH_TRANSFER_EXEC_RESERVE: Int = 5000000;
const USERNAME_ATH_BURN_EXEC_RESERVE: Int = 5000000;
const USERNAME_DUE_FLUSH_LOCAL_EXEC_RESERVE: Int = 2000000;
const USERNAME_PRUNE_PENDING_MINT_EXEC_RESERVE: Int = 2000000;
const USERNAME_ATH_NOTIFICATION_ACK_VALUE: Int = 1000000;
const USERNAME_MINT_EXCESS_REFUND_MIN_VALUE: Int = 100000;
const USERNAME_PENDING_MINT_STALE_TTL: Int = 86400; // 24 hours
const USERNAME_MAX_LENGTH: Int = 32;
const USERNAME_SPLIT_BASE_BPS: Int = 10000;
const USERNAME_TREASURY_SHARE_BPS: Int = 5000;
const USERNAME_NAME_HASH_DOMAIN: Int = 0xC5CC7CD6;
const USERNAME_REFUND_FLUSH_ID_DOMAIN: Int = 0x52464944; // "RFID"
const UINT64_MOD: Int = 18446744073709551616;

const OP_USERNAME_BIND_OFFICIAL_ATH_WALLET: Int = 0x663DF03D;
const OP_SEAL_GENESIS: Int = 0x3A12D1AD;

message(0x663DF03D) BindOfficialAthWallet {
    deployment_manifest_hash: Int as uint256;
    official_ath_wallet_address: Address;
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

message(0x6B928B47) FlushAthRefundDue {
    query_id: Int as uint64;
    owner_wallet: Address;
}

message(0x3796DF2D) PrunePendingUsernameMint {
    name_hash: Int as uint256;
}

message(0x0ABA5F1D) UsernameRegistryTopUpStorageReserve {}

struct PendingUsernameMint {
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
    deployment_manifest_hash: Int;
    genesis_config_hash: Int;
    official_ath_wallet_address: Address;
    genesis_controller_address: Address;
    name_record_count: Int;
    pending_mint_count: Int;
    refund_due_count: Int;
    treasury_due_ath: Int;
    burn_due_ath: Int;
    pending_refund_flush_count: Int;
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
    owner_wallet: Address;
    name_hash: Int;
    price_paid: Int;
    item_address: Address;
    item_deploy_value: Int;
    created_at: Int;
}

struct PendingAthRefundFlush {
    owner_wallet: Address;
    amount: Int as uint128;
    recipient_ath_wallet: Address;
    created_at: Int as uint32;
}

struct PendingAthRefundFlushView {
    exists: Bool;
    owner_wallet: Address;
    amount: Int;
    recipient_ath_wallet: Address;
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

contract UsernameRegistry {
    official_ath_wallet_address: Address;
    ath_master_address: Address;
    treasury_ath_receiver_address: Address;
    official_ath_wallet_bound: Bool;
    sealed: Bool;
    deployment_manifest_hash: Int as uint256;
    genesis_config_hash: Int as uint256;
    name_record_count: Int as uint64;
    pending_mint_count: Int as uint64;
    refund_due_count: Int as uint64;
    treasury_due_ath: Int as uint128;
    burn_due_ath: Int as uint128;
    name_records: map<Int, NameRecord>;
    pending_mints: map<Int, PendingUsernameMint>;
    pending_item_to_name_hash: map<Address, Int>;
    ath_refunds_due: map<Address, Int>;
    pending_refund_flushes: map<Int, PendingAthRefundFlush>;
    pending_refund_flush_count: Int as uint64;
    pending_treasury_flushes: map<Int, PendingAthTreasuryFlush>;
    pending_treasury_flush_count: Int as uint64;
    pending_burn_flushes: map<Int, PendingAthBurnFlush>;
    pending_burn_flush_count: Int as uint64;
    genesis_controller_address: Address;

    init(official_ath_wallet_address: Address, ath_master_address: Address, treasury_ath_receiver_address: Address, sealed: Bool, deployment_manifest_hash: Int, genesis_config_hash: Int, genesis_controller_address: Address) {
        self.official_ath_wallet_address = official_ath_wallet_address;
        self.ath_master_address = ath_master_address;
        self.treasury_ath_receiver_address = treasury_ath_receiver_address;
        self.official_ath_wallet_bound = false;
        self.sealed = sealed;
        self.genesis_controller_address = genesis_controller_address;
        self.deployment_manifest_hash = deployment_manifest_hash;
        self.genesis_config_hash = genesis_config_hash;
        self.name_record_count = 0;
        self.pending_mint_count = 0;
        self.refund_due_count = 0;
        self.treasury_due_ath = 0;
        self.burn_due_ath = 0;
        self.pending_refund_flush_count = 0;
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
            if (!(lower || digit)) {
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

    fun deriveItemAddress(owner_wallet: Address, name_hash: Int): Address {
        throwUnless(19020, name_hash != 0);
        let owner_std: StdAddress = parseStdAddress(owner_wallet.asSlice());
        let item_init: StateInit = initOf UsernameNFTItem(owner_wallet, myAddress(), name_hash);
        return contractAddressExt(owner_std.workchain, item_init.code, item_init.data);
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

    fun addRefundDue(owner_wallet: Address, amount: Int) {
        throwUnless(19110, amount > 0);
        let existing: Int? = self.ath_refunds_due.get(owner_wallet);
        if (existing == null) {
            throwUnless(19111, context().value >= USERNAME_ATH_REFUND_DUE_STORAGE_ENDOWMENT + USERNAME_STATE_GROWTH_EXEC_RESERVE);
            self.ath_refunds_due.set(owner_wallet, amount);
            self.refund_due_count += 1;
        } else {
            self.ath_refunds_due.set(owner_wallet, existing!! + amount);
        }
    }

    fun requireRefundDueAndNotificationAckReserve(owner_wallet: Address): Int {
        let existing: Int? = self.ath_refunds_due.get(owner_wallet);
        if (existing == null) {
            let required: Int = USERNAME_ATH_REFUND_DUE_STORAGE_ENDOWMENT + USERNAME_ATH_NOTIFICATION_ACK_VALUE + USERNAME_STATE_GROWTH_EXEC_RESERVE;
            throwUnless(19124, context().value >= required);
            return required;
        } else {
            let required: Int = USERNAME_ATH_NOTIFICATION_ACK_VALUE + USERNAME_STATE_GROWTH_EXEC_RESERVE;
            throwUnless(19125, context().value >= required);
            return required;
        }
    }

    fun sendAthNotificationAck(query_id: Int, sender_key: Int, amount: Int) {
        message(MessageParameters {
            to: sender(),
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

    fun refundRejectedMintExcess(owner_wallet: Address, retained_value: Int) {
        let excess: Int = context().value - retained_value;
        if (excess < USERNAME_MINT_EXCESS_REFUND_MIN_VALUE) {
            return;
        }

        message(MessageParameters {
            to: owner_wallet,
            value: excess,
            bounce: false,
            mode: SendDefaultMode,
            body: null
        });
    }

    fun restoreRefundDue(owner_wallet: Address, amount: Int) {
        throwUnless(19112, amount > 0);
        let existing: Int? = self.ath_refunds_due.get(owner_wallet);
        if (existing == null) {
            self.ath_refunds_due.set(owner_wallet, amount);
            self.refund_due_count += 1;
        } else {
            self.ath_refunds_due.set(owner_wallet, existing!! + amount);
        }
    }

    fun computeRefundFlushId(owner_wallet: Address, query_id: Int): Int {
        return beginCell()
            .storeUint(USERNAME_REFUND_FLUSH_ID_DOMAIN, 32)
            .storeAddress(owner_wallet)
            .storeUint(query_id, 64)
            .endCell()
            .hash() % UINT64_MOD;
    }

    fun clearPendingRefundFlush(query_id: Int): PendingAthRefundFlush {
        let pendingOpt: PendingAthRefundFlush? = self.pending_refund_flushes.get(query_id);
        throwUnless(19150, pendingOpt != null);
        let pending: PendingAthRefundFlush = pendingOpt!!;
        self.pending_refund_flushes.del(query_id);
        self.pending_refund_flush_count -= 1;
        return pending;
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
        throwUnless(19200, !self.pending_refund_flushes.exists(query_id));
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

    receive(msg: SealGenesis) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(19040, msg.deployment_manifest_hash > 1);
        throwUnless(19041, self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(19042, self.official_ath_wallet_bound);
        throwUnless(19043, self.official_ath_wallet_address == self.deriveAthWalletAddress(myAddress()));
        throwUnless(19044, self.isBasechainAddress(self.treasury_ath_receiver_address));
        self.genesis_config_hash = msg.deployment_manifest_hash;
        self.sealed = true;
    }

    receive(msg: AthTransferNotificationMintUsername) {
        self.requireSealed();
        throwUnless(19120, sender() == self.official_ath_wallet_address);
        throwUnless(19121, msg.amount > 0);
        throwUnless(19126, self.isBasechainAddress(msg.owner_wallet));

        if (!self.isValidUsernameBytes(msg.username_len, msg.username)) {
            let retainedValue: Int = self.requireRefundDueAndNotificationAckReserve(msg.owner_wallet);
            self.addRefundDue(msg.owner_wallet, msg.amount);
            self.sendAthNotificationAck(msg.query_id, msg.sender_key, msg.amount);
            self.refundRejectedMintExcess(msg.owner_wallet, retainedValue);
            return;
        }

        let name_hash: Int = self.computeNameHash(msg.username);
        let price: Int = self.priceForLength(msg.username_len);

        if (msg.amount != price) {
            let retainedValue: Int = self.requireRefundDueAndNotificationAckReserve(msg.owner_wallet);
            self.addRefundDue(msg.owner_wallet, msg.amount);
            self.sendAthNotificationAck(msg.query_id, msg.sender_key, msg.amount);
            self.refundRejectedMintExcess(msg.owner_wallet, retainedValue);
            return;
        }

        if (self.name_records.exists(name_hash)) {
            let retainedValue: Int = self.requireRefundDueAndNotificationAckReserve(msg.owner_wallet);
            self.addRefundDue(msg.owner_wallet, msg.amount);
            self.sendAthNotificationAck(msg.query_id, msg.sender_key, msg.amount);
            self.refundRejectedMintExcess(msg.owner_wallet, retainedValue);
            return;
        }

        if (self.pending_mints.exists(name_hash)) {
            let retainedValue: Int = self.requireRefundDueAndNotificationAckReserve(msg.owner_wallet);
            self.addRefundDue(msg.owner_wallet, msg.amount);
            self.sendAthNotificationAck(msg.query_id, msg.sender_key, msg.amount);
            self.refundRejectedMintExcess(msg.owner_wallet, retainedValue);
            return;
        }

        let retainedValue: Int = USERNAME_PENDING_MINT_STORAGE_ENDOWMENT + USERNAME_NFT_ITEM_DEPLOY_RESERVE + USERNAME_ATH_NOTIFICATION_ACK_VALUE + USERNAME_STATE_GROWTH_EXEC_RESERVE;
        throwUnless(19122, context().value >= retainedValue);

        let item_address: Address = self.deriveItemAddress(msg.owner_wallet, name_hash);
        throwUnless(19123, !self.pending_item_to_name_hash.exists(item_address));

        self.pending_mints.set(name_hash, PendingUsernameMint {
            owner_wallet: msg.owner_wallet,
            name_hash: name_hash,
            price_paid: msg.amount,
            item_address: item_address,
            item_deploy_value: USERNAME_NFT_ITEM_DEPLOY_RESERVE,
            created_at: now()
        });
        self.pending_item_to_name_hash.set(item_address, name_hash);
        self.pending_mint_count += 1;

        let item_init: StateInit = initOf UsernameNFTItem(msg.owner_wallet, myAddress(), name_hash);
        send(SendParameters {
            to: item_address,
            value: USERNAME_NFT_ITEM_DEPLOY_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            code: item_init.code,
            data: item_init.data,
            body: ResendDeployedAck {}.toCell()
        });

        self.sendAthNotificationAck(msg.query_id, msg.sender_key, msg.amount);
        self.refundRejectedMintExcess(msg.owner_wallet, retainedValue);
    }

    receive(msg: UsernameItemDeployedAck) {
        self.requireSealed();
        let nameFromItem: Int? = self.pending_item_to_name_hash.get(sender());
        throwUnless(19130, nameFromItem != null);
        throwUnless(19131, nameFromItem!! == msg.name_hash);

        let pendingOpt: PendingUsernameMint? = self.pending_mints.get(msg.name_hash);
        throwUnless(19132, pendingOpt != null);
        let pending: PendingUsernameMint = pendingOpt!!;
        throwUnless(19133, pending.owner_wallet == msg.owner_wallet);
        throwUnless(19134, pending.item_address == sender());
        throwUnless(19135, !self.name_records.exists(msg.name_hash));

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
    }

    bounced(msg: bounced<ResendDeployedAck>) {
        self.requireSealed();
        let nameFromItem: Int? = self.pending_item_to_name_hash.get(sender());
        throwUnless(19140, nameFromItem != null);
        let pendingOpt: PendingUsernameMint? = self.pending_mints.get(nameFromItem!!);
        throwUnless(19141, pendingOpt != null);

        let cleared: PendingUsernameMint = self.clearPendingMint(nameFromItem!!);
        let retainedValue: Int = USERNAME_STATE_GROWTH_EXEC_RESERVE;
        if (!self.ath_refunds_due.exists(cleared.owner_wallet)) {
            retainedValue += USERNAME_ATH_REFUND_DUE_STORAGE_ENDOWMENT;
        }
        self.addRefundDue(cleared.owner_wallet, cleared.price_paid);
        self.refundRejectedMintExcess(cleared.owner_wallet, retainedValue);
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

    receive(msg: FlushAthRefundDue) {
        self.requireSealed();
        throwUnless(19151, msg.query_id > 0);
        throwUnless(19152, self.isBasechainAddress(msg.owner_wallet));
        let refundFlushId: Int = self.computeRefundFlushId(msg.owner_wallet, msg.query_id);
        self.requireNoDueFlushQuery(refundFlushId);

        let dueOpt: Int? = self.ath_refunds_due.get(msg.owner_wallet);
        throwUnless(19153, dueOpt != null);
        let due: Int = dueOpt!!;
        throwUnless(19154, due > 0);
        throwUnless(19155, context().value >= USERNAME_ATH_TRANSFER_EXEC_RESERVE + USERNAME_DUE_FLUSH_LOCAL_EXEC_RESERVE);

        self.ath_refunds_due.del(msg.owner_wallet);
        self.refund_due_count -= 1;

        let recipient_ath_wallet: Address = self.deriveAthWalletAddress(msg.owner_wallet);
        self.pending_refund_flushes.set(refundFlushId, PendingAthRefundFlush {
            owner_wallet: msg.owner_wallet,
            amount: due,
            recipient_ath_wallet: recipient_ath_wallet,
            created_at: now()
        });
        self.pending_refund_flush_count += 1;

        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: USERNAME_ATH_TRANSFER_EXEC_RESERVE,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: ATHTransferRequest {
                query_id: refundFlushId,
                amount: due,
                recipient: msg.owner_wallet,
                response_destination: myAddress()
            }.toCell()
        });
    }

    receive(msg: ATHTransferAck) {
        self.requireSealed();
        let refundPendingOpt: PendingAthRefundFlush? = self.pending_refund_flushes.get(msg.query_id);
        if (refundPendingOpt != null) {
            let pending: PendingAthRefundFlush = self.clearPendingRefundFlush(msg.query_id);
            throwUnless(19156, msg.amount == pending.amount);
            throwUnless(19157, sender() == pending.recipient_ath_wallet);
            return;
        }

        let treasuryPendingOpt: PendingAthTreasuryFlush? = self.pending_treasury_flushes.get(msg.query_id);
        throwUnless(19230, treasuryPendingOpt != null);
        let treasuryPending: PendingAthTreasuryFlush = self.clearPendingTreasuryFlush(msg.query_id);
        throwUnless(19231, msg.amount == treasuryPending.amount);
        throwUnless(19232, sender() == treasuryPending.recipient_ath_wallet);
    }

    receive(msg: ATHTransferFailed) {
        self.requireSealed();
        throwUnless(19158, sender() == self.official_ath_wallet_address);
        let refundPendingOpt: PendingAthRefundFlush? = self.pending_refund_flushes.get(msg.query_id);
        if (refundPendingOpt != null) {
            let pending: PendingAthRefundFlush = self.clearPendingRefundFlush(msg.query_id);
            throwUnless(19159, msg.amount == pending.amount);
            self.restoreRefundDue(pending.owner_wallet, pending.amount);
            return;
        }

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
        let refundPendingOpt: PendingAthRefundFlush? = self.pending_refund_flushes.get(msg.query_id);
        if (refundPendingOpt != null) {
            let pending: PendingAthRefundFlush = self.clearPendingRefundFlush(msg.query_id);
            throwUnless(19161, msg.amount == pending.amount);
            self.restoreRefundDue(pending.owner_wallet, pending.amount);
            return;
        }

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
        if (!self.ath_refunds_due.exists(pending.owner_wallet)) {
            throwUnless(19306, context().value >= USERNAME_PRUNE_PENDING_MINT_EXEC_RESERVE + USERNAME_ATH_REFUND_DUE_STORAGE_ENDOWMENT);
        }

        let cleared: PendingUsernameMint = self.clearPendingMint(msg.name_hash);
        self.restoreRefundDue(cleared.owner_wallet, cleared.price_paid);
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

    get fun get_username_item_address(owner_wallet: Address, name_hash: Int): Address {
        return self.deriveItemAddress(owner_wallet, name_hash);
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
            owner_wallet: pending.owner_wallet,
            name_hash: pending.name_hash,
            price_paid: pending.price_paid,
            item_address: pending.item_address,
            item_deploy_value: pending.item_deploy_value,
            created_at: pending.created_at
        };
    }

    get fun get_refund_due(owner_wallet: Address): Int {
        let due: Int? = self.ath_refunds_due.get(owner_wallet);
        if (due == null) {
            return 0;
        }
        return due!!;
    }

    get fun get_pending_refund_flush(query_id: Int): PendingAthRefundFlushView {
        let pendingOpt: PendingAthRefundFlush? = self.pending_refund_flushes.get(query_id);
        if (pendingOpt == null) {
            return PendingAthRefundFlushView {
                exists: false,
                owner_wallet: self.official_ath_wallet_address,
                amount: 0,
                recipient_ath_wallet: self.official_ath_wallet_address,
                created_at: 0
            };
        }
        let pending: PendingAthRefundFlush = pendingOpt!!;
        return PendingAthRefundFlushView {
            exists: true,
            owner_wallet: pending.owner_wallet,
            amount: pending.amount,
            recipient_ath_wallet: pending.recipient_ath_wallet,
            created_at: pending.created_at
        };
    }

    get fun get_refund_flush_id(owner_wallet: Address, query_id: Int): Int {
        return self.computeRefundFlushId(owner_wallet, query_id);
    }

    get fun get_pending_refund_flush_for(owner_wallet: Address, query_id: Int): PendingAthRefundFlushView {
        return self.get_pending_refund_flush(self.computeRefundFlushId(owner_wallet, query_id));
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
            deployment_manifest_hash: self.deployment_manifest_hash,
            genesis_config_hash: self.genesis_config_hash,
            official_ath_wallet_address: self.official_ath_wallet_address,
            genesis_controller_address: self.genesis_controller_address,
            name_record_count: self.name_record_count,
            pending_mint_count: self.pending_mint_count,
            refund_due_count: self.refund_due_count,
            treasury_due_ath: self.treasury_due_ath,
            burn_due_ath: self.burn_due_ath,
            pending_refund_flush_count: self.pending_refund_flush_count,
            pending_treasury_flush_count: self.pending_treasury_flush_count,
            pending_burn_flush_count: self.pending_burn_flush_count,
            pending_mint_stale_ttl: USERNAME_PENDING_MINT_STALE_TTL
        };
    }

    receive() {
        throw(19099);
    }
}
