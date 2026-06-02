// Platho v1 ProfileRegistry.
// Stores paid wallet-level avatar pointers. Avatar image bytes live as public
// CapsuleHub avatar capsules; this contract records the authenticated pointer
// and splits the 100 ATH update fee 50/50 between treasury and burn due.

import "./ATHWallet.tact";

const PROFILE_AVATAR_PRICE_ATH: Int = 100000000000; // 100 ATH atomic units
const PROFILE_AVATAR_RECORD_STORAGE_ENDOWMENT: Int = 6000000;
const PROFILE_OWNER_VERSION_STORAGE_ENDOWMENT: Int = 3000000;
const PROFILE_STATE_GROWTH_EXEC_RESERVE: Int = 3000000;
const PROFILE_ATH_NOTIFICATION_ACK_VALUE: Int = 1000000;
const PROFILE_AVATAR_EXCESS_REFUND_MIN_VALUE: Int = 100000;
const PROFILE_VAULT_EXCESS_REFUND_EXEC_RESERVE: Int = 2000000;
const PROFILE_EXCESS_REFUND_FORWARD_RESERVE: Int = 200000;
const PROFILE_ATH_TRANSFER_EXEC_RESERVE: Int = 30000000;
const PROFILE_ATH_BURN_EXEC_RESERVE: Int = 5000000;
const PROFILE_DUE_FLUSH_LOCAL_EXEC_RESERVE: Int = 2000000;
const PROFILE_SPLIT_BASE_BPS: Int = 10000;
const PROFILE_TREASURY_SHARE_BPS: Int = 5000;
const PROFILE_AVATAR_MAX_PARTS: Int = 16;
const PROFILE_AVATAR_MEDIA_FORMAT_WEBP: Int = 1;
const PROFILE_AVATAR_RECORD_ID_DOMAIN: Int = 0x50524156; // "PRAV"

message(0x50A61101) BindProfileOfficialAthWallet {
    deployment_manifest_hash: Int as uint256;
    official_ath_wallet_address: Address;
}

message(0x50A61102) BindProfileVault {
    deployment_manifest_hash: Int as uint256;
    vault_address: Address;
}

message(0x3A12D1AD) SealGenesis {
    deployment_manifest_hash: Int as uint256;
}

message(0x50A61110) FlushProfileTreasuryAthDue {
    query_id: Int as uint64;
}

message(0x50A61111) FlushProfileBurnAthDue {
    query_id: Int as uint64;
}

message(0x50A61120) ProfileRegistryTopUpStorageReserve {}

message(0x50A61121) ProfileAvatarTonExcessRefund {
    query_id: Int as uint64;
    owner_wallet: Address;
    amount: Int as uint128;
}

struct ProfileAvatarRecord {
    owner_wallet: Address;
    version: Int as uint32;
    avatar_hash: Int as uint256;
    avatar_entry_id: Int as uint64;
    avatar_stream_id: Int as uint128;
    avatar_part_count: Int as uint16;
    media_format: Int as uint8;
    updated_at: Int as uint32;
}

struct ProfileAvatarView {
    exists: Bool;
    owner_wallet: Address;
    version: Int;
    avatar_hash: Int;
    avatar_entry_id: Int;
    avatar_stream_id: Int;
    avatar_part_count: Int;
    media_format: Int;
    updated_at: Int;
}

struct PendingProfileTreasuryFlush {
    amount: Int as uint128;
    recipient_ath_wallet: Address;
    created_at: Int as uint32;
}

struct PendingProfileBurnFlush {
    amount: Int as uint128;
    created_at: Int as uint32;
}

struct PendingProfileTreasuryFlushView {
    exists: Bool;
    amount: Int;
    recipient_ath_wallet: Address;
    created_at: Int;
}

struct PendingProfileBurnFlushView {
    exists: Bool;
    amount: Int;
    created_at: Int;
}

struct ProfileRegistryGlobalView {
    sealed: Bool;
    official_ath_wallet_bound: Bool;
    vault_bound: Bool;
    deployment_manifest_hash: Int;
    genesis_config_hash: Int;
    official_ath_wallet_address: Address;
    vault_address: Address;
    ath_master_address: Address;
    treasury_ath_receiver_address: Address;
    genesis_controller_address: Address;
    profile_count: Int;
    avatar_record_count: Int;
    treasury_due_ath: Int;
    burn_due_ath: Int;
    pending_treasury_flush_count: Int;
    pending_burn_flush_count: Int;
}

contract ProfileRegistry {
    official_ath_wallet_address: Address;
    vault_address: Address;
    ath_master_address: Address;
    treasury_ath_receiver_address: Address;
    official_ath_wallet_bound: Bool;
    vault_bound: Bool;
    sealed: Bool;
    deployment_manifest_hash: Int as uint256;
    genesis_config_hash: Int as uint256;
    genesis_controller_address: Address;
    profile_count: Int as uint64;
    avatar_record_count: Int as uint64;
    treasury_due_ath: Int as uint128;
    burn_due_ath: Int as uint128;
    current_avatar_versions: map<Address, Int>;
    avatar_records: map<Int, ProfileAvatarRecord>;
    pending_treasury_flushes: map<Int, PendingProfileTreasuryFlush>;
    pending_treasury_flush_count: Int as uint64;
    pending_burn_flushes: map<Int, PendingProfileBurnFlush>;
    pending_burn_flush_count: Int as uint64;

    init(official_ath_wallet_address: Address, ath_master_address: Address, treasury_ath_receiver_address: Address, sealed: Bool, deployment_manifest_hash: Int, genesis_config_hash: Int, genesis_controller_address: Address) {
        self.official_ath_wallet_address = official_ath_wallet_address;
        self.vault_address = official_ath_wallet_address;
        self.ath_master_address = ath_master_address;
        self.treasury_ath_receiver_address = treasury_ath_receiver_address;
        self.official_ath_wallet_bound = false;
        self.vault_bound = false;
        self.sealed = sealed;
        self.deployment_manifest_hash = deployment_manifest_hash;
        self.genesis_config_hash = genesis_config_hash;
        self.genesis_controller_address = genesis_controller_address;
        self.profile_count = 0;
        self.avatar_record_count = 0;
        self.treasury_due_ath = 0;
        self.burn_due_ath = 0;
        self.current_avatar_versions = emptyMap();
        self.avatar_records = emptyMap();
        self.pending_treasury_flushes = emptyMap();
        self.pending_treasury_flush_count = 0;
        self.pending_burn_flushes = emptyMap();
        self.pending_burn_flush_count = 0;
    }

    fun requireUnsealed() {
        throwUnless(21000, !self.sealed);
    }

    fun requireSealed() {
        throwUnless(21100, self.sealed);
    }

    fun requireGenesisController() {
        throwUnless(21030, sender() == self.genesis_controller_address);
    }

    fun isBasechainAddress(address: Address): Bool {
        let std: StdAddress = parseStdAddress(address.asSlice());
        return std.workchain == 0;
    }

    fun deriveAthWalletAddress(owner_wallet: Address): Address {
        let owner_std: StdAddress = parseStdAddress(owner_wallet.asSlice());
        let wallet_init: StateInit = initOf ATHWallet(0, owner_wallet, self.ath_master_address);
        return contractAddressExt(owner_std.workchain, wallet_init.code, wallet_init.data);
    }

    fun computeAvatarRecordId(owner_wallet: Address, version: Int): Int {
        return beginCell()
            .storeUint(PROFILE_AVATAR_RECORD_ID_DOMAIN, 32)
            .storeAddress(owner_wallet)
            .storeUint(version, 32)
            .endCell()
            .hash();
    }

    fun requireValidAvatarPointerFields(owner_wallet: Address, avatar_hash: Int, avatar_stream_id: Int, avatar_part_count: Int, media_format: Int) {
        throwUnless(21120, self.isBasechainAddress(owner_wallet));
        throwUnless(21121, avatar_hash != 0);
        throwUnless(21122, avatar_stream_id != 0);
        throwUnless(21123, avatar_part_count > 0);
        throwUnless(21124, avatar_part_count <= PROFILE_AVATAR_MAX_PARTS);
        throwUnless(21125, media_format == PROFILE_AVATAR_MEDIA_FORMAT_WEBP);
    }

    fun requireValidAvatarPointer(msg: AthTransferNotificationProfileAvatar) {
        self.requireValidAvatarPointerFields(msg.owner_wallet, msg.avatar_hash, msg.avatar_stream_id, msg.avatar_part_count, msg.media_format);
    }

    fun sendAthNotificationAck(query_id: Int, sender_key: Int, amount: Int) {
        message(MessageParameters {
            to: sender(),
            value: PROFILE_ATH_NOTIFICATION_ACK_VALUE,
            bounce: false,
            mode: SendDefaultMode,
            body: AthTransferNotificationAck {
                query_id: query_id,
                sender_key: sender_key,
                amount: amount
            }.toCell()
        });
    }

    fun refundAvatarExcess(query_id: Int, owner_wallet: Address, retained_value: Int, vault_funded: Bool) {
        let excess: Int = context().value - retained_value;
        if (excess < PROFILE_AVATAR_EXCESS_REFUND_MIN_VALUE) {
            return;
        }

        if (vault_funded) {
            if (excess <= PROFILE_VAULT_EXCESS_REFUND_EXEC_RESERVE + PROFILE_EXCESS_REFUND_FORWARD_RESERVE) {
                return;
            }
            let refundValue: Int = excess - PROFILE_EXCESS_REFUND_FORWARD_RESERVE;
            let creditAmount: Int = refundValue - PROFILE_VAULT_EXCESS_REFUND_EXEC_RESERVE;
            if (creditAmount < PROFILE_AVATAR_EXCESS_REFUND_MIN_VALUE) {
                return;
            }
            message(MessageParameters {
                to: self.vault_address,
                value: refundValue,
                bounce: false,
                mode: SendDefaultMode,
                body: ProfileAvatarTonExcessRefund {
                    query_id: query_id,
                    owner_wallet: owner_wallet,
                    amount: creditAmount
                }.toCell()
            });
            return;
        }

        if (excess <= PROFILE_EXCESS_REFUND_FORWARD_RESERVE) {
            return;
        }
        let refundValue: Int = excess - PROFILE_EXCESS_REFUND_FORWARD_RESERVE;
        if (refundValue < PROFILE_AVATAR_EXCESS_REFUND_MIN_VALUE) {
            return;
        }
        message(MessageParameters {
            to: owner_wallet,
            value: refundValue,
            bounce: false,
            mode: SendDefaultMode,
            body: null
        });
    }

    fun requireNoDueFlushQuery(query_id: Int) {
        throwUnless(21200, !self.pending_treasury_flushes.exists(query_id));
        throwUnless(21201, !self.pending_burn_flushes.exists(query_id));
    }

    fun restoreTreasuryDue(amount: Int) {
        throwUnless(21210, amount > 0);
        self.treasury_due_ath += amount;
    }

    fun restoreBurnDue(amount: Int) {
        throwUnless(21220, amount > 0);
        self.burn_due_ath += amount;
    }

    fun clearPendingTreasuryFlush(query_id: Int): PendingProfileTreasuryFlush {
        let pendingOpt: PendingProfileTreasuryFlush? = self.pending_treasury_flushes.get(query_id);
        throwUnless(21230, pendingOpt != null);
        let pending: PendingProfileTreasuryFlush = pendingOpt!!;
        self.pending_treasury_flushes.del(query_id);
        self.pending_treasury_flush_count -= 1;
        return pending;
    }

    fun clearPendingBurnFlush(query_id: Int): PendingProfileBurnFlush {
        let pendingOpt: PendingProfileBurnFlush? = self.pending_burn_flushes.get(query_id);
        throwUnless(21240, pendingOpt != null);
        let pending: PendingProfileBurnFlush = pendingOpt!!;
        self.pending_burn_flushes.del(query_id);
        self.pending_burn_flush_count -= 1;
        return pending;
    }

    fun acceptAvatarPayment(query_id: Int, sender_key: Int, amount: Int, owner_wallet: Address, avatar_hash: Int, avatar_entry_id: Int, avatar_stream_id: Int, avatar_part_count: Int, media_format: Int, vault_funded: Bool) {
        throwUnless(21111, amount == PROFILE_AVATAR_PRICE_ATH);
        self.requireValidAvatarPointerFields(owner_wallet, avatar_hash, avatar_stream_id, avatar_part_count, media_format);

        let currentVersionOpt: Int? = self.current_avatar_versions.get(owner_wallet);
        let retainedValue: Int = PROFILE_AVATAR_RECORD_STORAGE_ENDOWMENT + PROFILE_ATH_NOTIFICATION_ACK_VALUE + PROFILE_STATE_GROWTH_EXEC_RESERVE;
        if (currentVersionOpt == null) {
            retainedValue += PROFILE_OWNER_VERSION_STORAGE_ENDOWMENT;
        }
        throwUnless(21112, context().value >= retainedValue);

        let nextVersion: Int = 1;
        if (currentVersionOpt != null) {
            throwUnless(21113, currentVersionOpt!! < 4294967295);
            nextVersion = currentVersionOpt!! + 1;
        } else {
            self.profile_count += 1;
        }

        let recordId: Int = self.computeAvatarRecordId(owner_wallet, nextVersion);
        throwUnless(21114, !self.avatar_records.exists(recordId));
        self.avatar_records.set(recordId, ProfileAvatarRecord {
            owner_wallet: owner_wallet,
            version: nextVersion,
            avatar_hash: avatar_hash,
            avatar_entry_id: avatar_entry_id,
            avatar_stream_id: avatar_stream_id,
            avatar_part_count: avatar_part_count,
            media_format: media_format,
            updated_at: now()
        });
        self.current_avatar_versions.set(owner_wallet, nextVersion);
        self.avatar_record_count += 1;

        let treasury_amount: Int = (amount * PROFILE_TREASURY_SHARE_BPS) / PROFILE_SPLIT_BASE_BPS;
        let burn_amount: Int = amount - treasury_amount;
        self.treasury_due_ath += treasury_amount;
        self.burn_due_ath += burn_amount;

        self.sendAthNotificationAck(query_id, sender_key, amount);
        self.refundAvatarExcess(query_id, owner_wallet, retainedValue, vault_funded);
    }

    receive(msg: BindProfileOfficialAthWallet) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(21031, msg.deployment_manifest_hash > 1);
        throwUnless(21032, !self.official_ath_wallet_bound);
        throwUnless(21033, self.genesis_config_hash == 0);
        throwUnless(21034, self.deployment_manifest_hash == 0 || self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(21035, msg.official_ath_wallet_address == self.deriveAthWalletAddress(myAddress()));
        self.deployment_manifest_hash = msg.deployment_manifest_hash;
        self.genesis_config_hash = 1;
        self.official_ath_wallet_address = msg.official_ath_wallet_address;
        self.official_ath_wallet_bound = true;
    }

    receive(msg: BindProfileVault) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(21036, msg.deployment_manifest_hash > 1);
        throwUnless(21037, !self.vault_bound);
        throwUnless(21038, self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(21039, self.isBasechainAddress(msg.vault_address));
        throwUnless(21045, msg.vault_address != myAddress());
        self.vault_address = msg.vault_address;
        self.vault_bound = true;
    }

    receive(msg: SealGenesis) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(21040, msg.deployment_manifest_hash > 1);
        throwUnless(21041, self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(21042, self.official_ath_wallet_bound);
        throwUnless(21043, self.official_ath_wallet_address == self.deriveAthWalletAddress(myAddress()));
        throwUnless(21044, self.isBasechainAddress(self.treasury_ath_receiver_address));
        throwUnless(21046, self.vault_bound);
        throwUnless(21047, self.isBasechainAddress(self.vault_address));
        throwUnless(21048, self.vault_address != myAddress());
        throwUnless(21049, self.treasury_ath_receiver_address != myAddress());
        throwUnless(21050, self.treasury_ath_receiver_address != self.official_ath_wallet_address);
        throwUnless(21051, self.treasury_ath_receiver_address != self.vault_address);
        throwUnless(21052, self.treasury_ath_receiver_address != self.ath_master_address);
        self.genesis_config_hash = msg.deployment_manifest_hash;
        self.sealed = true;
    }

    receive(msg: AthTransferNotificationProfileAvatar) {
        self.requireSealed();
        throwUnless(21110, sender() == self.official_ath_wallet_address);
        self.acceptAvatarPayment(
            msg.query_id,
            msg.sender_key,
            msg.amount,
            msg.owner_wallet,
            msg.avatar_hash,
            msg.avatar_entry_id,
            msg.avatar_stream_id,
            msg.avatar_part_count,
            msg.media_format,
            false
        );
    }

    receive(msg: AthTransferNotificationVaultProfileAvatar) {
        self.requireSealed();
        throwUnless(21160, sender() == self.official_ath_wallet_address);
        throwUnless(21162, self.vault_bound);
        throwUnless(21161, msg.payer_wallet == self.vault_address);
        self.acceptAvatarPayment(
            msg.query_id,
            msg.sender_key,
            msg.amount,
            msg.owner_wallet,
            msg.avatar_hash,
            msg.avatar_entry_id,
            msg.avatar_stream_id,
            msg.avatar_part_count,
            msg.media_format,
            true
        );
    }

    receive(msg: FlushProfileTreasuryAthDue) {
        self.requireSealed();
        throwUnless(21250, msg.query_id > 0);
        self.requireNoDueFlushQuery(msg.query_id);
        throwUnless(21251, self.treasury_due_ath > 0);
        throwUnless(21252, context().value >= PROFILE_ATH_TRANSFER_EXEC_RESERVE + PROFILE_DUE_FLUSH_LOCAL_EXEC_RESERVE);
        throwUnless(21253, self.isBasechainAddress(self.treasury_ath_receiver_address));

        let amount: Int = self.treasury_due_ath;
        self.treasury_due_ath = 0;
        let recipient_ath_wallet: Address = self.deriveAthWalletAddress(self.treasury_ath_receiver_address);
        self.pending_treasury_flushes.set(msg.query_id, PendingProfileTreasuryFlush {
            amount: amount,
            recipient_ath_wallet: recipient_ath_wallet,
            created_at: now()
        });
        self.pending_treasury_flush_count += 1;

        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: PROFILE_ATH_TRANSFER_EXEC_RESERVE,
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

    receive(msg: FlushProfileBurnAthDue) {
        self.requireSealed();
        throwUnless(21260, msg.query_id > 0);
        self.requireNoDueFlushQuery(msg.query_id);
        throwUnless(21261, self.burn_due_ath > 0);
        throwUnless(21262, context().value >= PROFILE_ATH_BURN_EXEC_RESERVE + PROFILE_DUE_FLUSH_LOCAL_EXEC_RESERVE);

        let amount: Int = self.burn_due_ath;
        self.burn_due_ath = 0;
        self.pending_burn_flushes.set(msg.query_id, PendingProfileBurnFlush {
            amount: amount,
            created_at: now()
        });
        self.pending_burn_flush_count += 1;

        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: PROFILE_ATH_BURN_EXEC_RESERVE,
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
        let pending: PendingProfileTreasuryFlush = self.clearPendingTreasuryFlush(msg.query_id);
        throwUnless(21300, pending.amount == msg.amount);
        throwUnless(21301, sender() == pending.recipient_ath_wallet);
    }

    receive(msg: ATHTransferFailed) {
        self.requireSealed();
        throwUnless(21310, sender() == self.official_ath_wallet_address);
        let pending: PendingProfileTreasuryFlush = self.clearPendingTreasuryFlush(msg.query_id);
        throwUnless(21311, pending.amount == msg.amount);
        self.restoreTreasuryDue(pending.amount);
    }

    bounced(msg: bounced<ATHTransferRequest>) {
        self.requireSealed();
        throwUnless(21320, sender() == self.official_ath_wallet_address);
        let pending: PendingProfileTreasuryFlush = self.clearPendingTreasuryFlush(msg.query_id);
        throwUnless(21321, pending.amount == msg.amount);
        self.restoreTreasuryDue(pending.amount);
    }

    receive(msg: ATHBurnFinalized) {
        self.requireSealed();
        throwUnless(21330, sender() == self.ath_master_address);
        throwUnless(21332, msg.owner_address == myAddress());
        let pending: PendingProfileBurnFlush = self.clearPendingBurnFlush(msg.query_id);
        throwUnless(21331, pending.amount == msg.amount);
    }

    receive(msg: ATHBurnFailed) {
        self.requireSealed();
        throwUnless(21340, sender() == self.official_ath_wallet_address);
        let pending: PendingProfileBurnFlush = self.clearPendingBurnFlush(msg.query_id);
        throwUnless(21341, pending.amount == msg.amount);
        self.restoreBurnDue(pending.amount);
    }

    bounced(msg: bounced<ATHBurn>) {
        self.requireSealed();
        throwUnless(21350, sender() == self.official_ath_wallet_address);
        let pending: PendingProfileBurnFlush = self.clearPendingBurnFlush(msg.query_id);
        throwUnless(21351, pending.amount == msg.amount);
        self.restoreBurnDue(pending.amount);
    }

    receive(msg: ProfileRegistryTopUpStorageReserve) {
        // Accept TON for ProfileRegistry storage reserve only. Avatar pointers,
        // ATH due buckets, and deployment bindings are unchanged.
    }

    receive() {
        throw(21400);
    }

    get fun get_global(): ProfileRegistryGlobalView {
        return ProfileRegistryGlobalView {
            sealed: self.sealed,
            official_ath_wallet_bound: self.official_ath_wallet_bound,
            vault_bound: self.vault_bound,
            deployment_manifest_hash: self.deployment_manifest_hash,
            genesis_config_hash: self.genesis_config_hash,
            official_ath_wallet_address: self.official_ath_wallet_address,
            vault_address: self.vault_address,
            ath_master_address: self.ath_master_address,
            treasury_ath_receiver_address: self.treasury_ath_receiver_address,
            genesis_controller_address: self.genesis_controller_address,
            profile_count: self.profile_count,
            avatar_record_count: self.avatar_record_count,
            treasury_due_ath: self.treasury_due_ath,
            burn_due_ath: self.burn_due_ath,
            pending_treasury_flush_count: self.pending_treasury_flush_count,
            pending_burn_flush_count: self.pending_burn_flush_count
        };
    }

    get fun get_avatar(owner_wallet: Address): ProfileAvatarView {
        let versionOpt: Int? = self.current_avatar_versions.get(owner_wallet);
        if (versionOpt == null) {
            return ProfileAvatarView {
                exists: false,
                owner_wallet: owner_wallet,
                version: 0,
                avatar_hash: 0,
                avatar_entry_id: 0,
                avatar_stream_id: 0,
                avatar_part_count: 0,
                media_format: 0,
                updated_at: 0
            };
        }
        return self.get_avatar_version(owner_wallet, versionOpt!!);
    }

    get fun get_avatar_version(owner_wallet: Address, version: Int): ProfileAvatarView {
        let recordId: Int = self.computeAvatarRecordId(owner_wallet, version);
        let recordOpt: ProfileAvatarRecord? = self.avatar_records.get(recordId);
        if (recordOpt == null) {
            return ProfileAvatarView {
                exists: false,
                owner_wallet: owner_wallet,
                version: version,
                avatar_hash: 0,
                avatar_entry_id: 0,
                avatar_stream_id: 0,
                avatar_part_count: 0,
                media_format: 0,
                updated_at: 0
            };
        }
        let record: ProfileAvatarRecord = recordOpt!!;
        return ProfileAvatarView {
            exists: true,
            owner_wallet: record.owner_wallet,
            version: record.version,
            avatar_hash: record.avatar_hash,
            avatar_entry_id: record.avatar_entry_id,
            avatar_stream_id: record.avatar_stream_id,
            avatar_part_count: record.avatar_part_count,
            media_format: record.media_format,
            updated_at: record.updated_at
        };
    }

    get fun get_ath_wallet_address(owner_wallet: Address): Address {
        return self.deriveAthWalletAddress(owner_wallet);
    }

    get fun get_pending_treasury_flush(query_id: Int): PendingProfileTreasuryFlushView {
        let pendingOpt: PendingProfileTreasuryFlush? = self.pending_treasury_flushes.get(query_id);
        if (pendingOpt == null) {
            return PendingProfileTreasuryFlushView {
                exists: false,
                amount: 0,
                recipient_ath_wallet: self.treasury_ath_receiver_address,
                created_at: 0
            };
        }
        let pending: PendingProfileTreasuryFlush = pendingOpt!!;
        return PendingProfileTreasuryFlushView {
            exists: true,
            amount: pending.amount,
            recipient_ath_wallet: pending.recipient_ath_wallet,
            created_at: pending.created_at
        };
    }

    get fun get_pending_burn_flush(query_id: Int): PendingProfileBurnFlushView {
        let pendingOpt: PendingProfileBurnFlush? = self.pending_burn_flushes.get(query_id);
        if (pendingOpt == null) {
            return PendingProfileBurnFlushView {
                exists: false,
                amount: 0,
                created_at: 0
            };
        }
        let pending: PendingProfileBurnFlush = pendingOpt!!;
        return PendingProfileBurnFlushView {
            exists: true,
            amount: pending.amount,
            created_at: pending.created_at
        };
    }
}
