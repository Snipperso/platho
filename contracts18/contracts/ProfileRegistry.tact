
import "./ATHWallet.tact";
import "./KeyShard.tact";
import "./ath-wire.tact";

const PROFILE_AVATAR_PRICE_ATH: Int = 100000000000;

const PROFILE_TON_SWEEP_FLOOR: Int = 1000000000;
const PROFILE_TON_SWEEP_EXEC_RESERVE: Int = 5000000;
const PROFILE_TON_SWEEP_MIN: Int = 50000000;
const PROFILE_TON_SWEEP_OPENS_AT: Int = 1793664000;
const PROFILE_ACCEPT_GAS_UNITS: Int = 40000;
const PROFILE_WRITE_FWD_CELLS: Int = 2;
const PROFILE_WRITE_FWD_BITS: Int = 1300;
const PROFILE_ADOPT_FORWARD: Int = 7200000;
const PROFILE_PENDING_AVATAR_CAP: Int = 4096;
const PROFILE_KEY_SHARD_WRITE_VALUE: Int = 150000000;
const PROFILE_REFUND_OWNER_MIN_VALUE: Int = 39000000;
const PROFILE_REFUND_PAYER_ARRIVAL_MIN: Int = 29000000;
const PROFILE_REFUND_WALLET_GAS: Int = 50000;
const PROFILE_REFUND_LEG_CELLS: Int = 90;
const PROFILE_REFUND_LEG_BITS: Int = 53829;
const PROFILE_REFUND_SELF_GAS: Int = 40000;
const PROFILE_REFUND_MSG_CELLS: Int = 1;
const PROFILE_REFUND_MSG_BITS: Int = 384;
const PROFILE_AVATAR_WRITE_STALE_TTL: Int = 86400;
const PROFILE_ACK_WALLET_GAS: Int = 50000;
const PROFILE_AVATAR_EXCESS_REFUND_MIN_VALUE: Int = 100000;
const PROFILE_ADOPT_FORWARD_FEE_ALLOWANCE: Int = 200000;
const PROFILE_ATH_TRANSFER_EXEC_RESERVE: Int = 48000000;
const PROFILE_ATH_BURN_EXEC_RESERVE: Int = 5000000;
const PROFILE_FLUSH_SELF_GAS: Int = 25000;
const PROFILE_BURN_MASTER_GAS: Int = 15000;
const PROFILE_FLUSH_SETTLE_GAS: Int = 20000;
const PROFILE_FLUSH_MSG_CELLS: Int = 1;
const PROFILE_FLUSH_MSG_BITS: Int = 1023;
const PROFILE_ATH_OWNER_REQUEST_KEEP: Int = 2000000;
const PROFILE_TREASURY_EXCESS_MIN: Int = 1000000;
const PROFILE_PENDING_FLUSH_CAP: Int = 16;
const PROFILE_DUE_FLUSH_STALE_TTL: Int = 3888000;
const PROFILE_SPLIT_BASE_BPS: Int = 10000;
const PROFILE_TREASURY_SHARE_BPS: Int = 5000;
const PROFILE_AVATAR_MAX_PARTS: Int = 2;
const PROFILE_AVATAR_MEDIA_FORMAT_WEBP: Int = 1;

message(0x50A61101) BindProfileOfficialAthWallet {
    deployment_manifest_hash: Int as uint256;
    official_ath_wallet_address: Address;
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

message(0x50A61122) SweepProfileTreasuryTon {
    query_id: Int as uint64;
}

message(0x50A61120) ProfileRegistryTopUpStorageReserve {}

message(0x50A61123) PruneStaleAvatarWrite {
    write_id: Int as uint64;
}

message(0x50A61124) PruneStaleDueFlush {
    query_id: Int as uint64;
    burn: Bool;
}

struct PendingProfileAvatarWrite {
    query_id: Int as uint64;
    sender_key: Int as uint160;
    amount: Int as uint128;
    owner_wallet: Address;
    created_at: Int as uint64;
}

struct PendingProfileTreasuryFlush {
    amount: Int as uint128;
    recipient_ath_wallet: Address;
    created_at: Int as uint64;
}

struct PendingProfileBurnFlush {
    amount: Int as uint128;
    created_at: Int as uint64;
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

struct PendingProfileAvatarWriteView {
    exists: Bool;
    query_id: Int;
    sender_key: Int;
    amount: Int;
    owner_wallet: Address;
    created_at: Int;
}

struct ProfileRegistryGlobalView {
    sealed: Bool;
    official_ath_wallet_bound: Bool;
    deployment_manifest_hash: Int;
    genesis_config_hash: Int;
    official_ath_wallet_address: Address;
    ath_master_address: Address;
    treasury_ath_receiver_address: Address;
    genesis_controller_address: Address;
    profile_count: Int;
    pending_avatar_write_count: Int;
    next_avatar_write_id: Int;
    treasury_due_ath: Int;
    burn_due_ath: Int;
    pending_treasury_flush_count: Int;
    pending_burn_flush_count: Int;
}

contract ProfileRegistry {
    official_ath_wallet_address: Address;
    ath_master_address: Address;
    treasury_ath_receiver_address: Address;
    official_ath_wallet_bound: Bool;
    sealed: Bool;
    deployment_manifest_hash: Int as uint256;
    genesis_config_hash: Int as uint256;
    genesis_controller_address: Address;
    predecessor_keyshard_code: Cell;
    predecessor_registry_address: Address;
    profile_count: Int as uint64;
    treasury_due_ath: Int as uint128;
    burn_due_ath: Int as uint128;
    pending_avatar_writes: map<Int, PendingProfileAvatarWrite>;
    pending_avatar_write_count: Int as uint64;
    next_avatar_write_id: Int as uint64;
    pending_treasury_flushes: map<Int, PendingProfileTreasuryFlush>;
    pending_treasury_flush_count: Int as uint64;
    pending_burn_flushes: map<Int, PendingProfileBurnFlush>;
    pending_burn_flush_count: Int as uint64;

    init(official_ath_wallet_address: Address, ath_master_address: Address, treasury_ath_receiver_address: Address, deployment_manifest_hash: Int, genesis_config_hash: Int, genesis_controller_address: Address, predecessor_keyshard_code: Cell, predecessor_registry_address: Address) {
        self.official_ath_wallet_address = official_ath_wallet_address;
        self.ath_master_address = ath_master_address;
        self.treasury_ath_receiver_address = treasury_ath_receiver_address;
        self.official_ath_wallet_bound = false;
        throwUnless(21053, treasury_ath_receiver_address.asSlice().preloadUint(11) == 1024);
        throwUnless(21054, treasury_ath_receiver_address != ath_master_address);
        throwUnless(21055, genesis_config_hash == 0);
        throwUnless(21056, deployment_manifest_hash == 0 || deployment_manifest_hash > 1);
        self.sealed = false;
        self.deployment_manifest_hash = deployment_manifest_hash;
        self.genesis_config_hash = genesis_config_hash;
        self.genesis_controller_address = genesis_controller_address;
        self.predecessor_keyshard_code = predecessor_keyshard_code;
        self.predecessor_registry_address = predecessor_registry_address;
        self.profile_count = 0;
        self.treasury_due_ath = 0;
        self.burn_due_ath = 0;
        self.pending_avatar_writes = emptyMap();
        self.pending_avatar_write_count = 0;
        self.next_avatar_write_id = 1;
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
        return athWalletOf(owner_wallet, self.ath_master_address);
    }

    fun deriveKeyShardAddress(owner_wallet: Address): Address {
        return contractAddress(initOf KeyShard(owner_wallet, myAddress()));
    }

    fun derivePredecessorKeyShardAddress(owner_wallet: Address): Address {
        let data: Cell = beginCell()
            .storeUint(0, 1)
            .storeAddress(owner_wallet)
            .storeAddress(self.predecessor_registry_address)
            .endCell();
        return contractAddressExt(0, self.predecessor_keyshard_code, data);
    }

    receive(msg: KeyShardOwnershipProof) {
        self.requireSealed();
        throwUnless(21600, self.isBasechainAddress(msg.owner_wallet));
        throwUnless(21601, sender() == self.derivePredecessorKeyShardAddress(msg.owner_wallet));
        throwUnless(21602, myBalance() - context().value
            >= PROFILE_TON_SWEEP_FLOOR + PROFILE_ADOPT_FORWARD + PROFILE_ADOPT_FORWARD_FEE_ALLOWANCE);
        message(MessageParameters {
            to: self.deriveKeyShardAddress(msg.owner_wallet),
            value: PROFILE_ADOPT_FORWARD,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: KeyShardAdoptIdentity {
                owner_wallet: msg.owner_wallet,
                key_id: msg.key_id,
                key_generation: msg.key_generation,
                rotation_nonce: msg.rotation_nonce,
                enc_pubkey: msg.enc_pubkey,
                sign_pubkey: msg.sign_pubkey,
                scan_pubkey: msg.scan_pubkey,
                pq_kem_pubkey_hash: msg.pq_kem_pubkey_hash,
                pq_kem_pubkey_len: msg.pq_kem_pubkey_len,
                pq_kem_pubkey: msg.pq_kem_pubkey,
                crypto_suite_mask: msg.crypto_suite_mask,
                created_at: msg.created_at,
                avatar_version: msg.avatar_version,
                avatar_hash: msg.avatar_hash,
                avatar_entry_id: msg.avatar_entry_id,
                avatar_stream_id: msg.avatar_stream_id,
                avatar_part_count: msg.avatar_part_count,
                avatar_media_format: msg.avatar_media_format,
                avatar_updated_at: msg.avatar_updated_at
            }.toCell()
        });
    }

    fun requireValidAvatarPointerFields(owner_wallet: Address, avatar_hash: Int, avatar_stream_id: Int, avatar_part_count: Int, media_format: Int) {
        throwUnless(21120, self.isBasechainAddress(owner_wallet));
        throwUnless(21121, avatar_hash != 0);
        throwUnless(21122, avatar_stream_id != 0);
        throwUnless(21123, avatar_part_count > 0);
        throwUnless(21124, avatar_part_count <= PROFILE_AVATAR_MAX_PARTS);
        throwUnless(21125, media_format == PROFILE_AVATAR_MEDIA_FORMAT_WEBP);
    }

    fun sendAthNotificationAck(query_id: Int, sender_key: Int, amount: Int) {
        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: getComputeFee(PROFILE_ACK_WALLET_GAS, false),
            bounce: false,
            mode: SendPayFwdFeesSeparately,
            body: AthTransferNotificationAck {
                query_id: query_id,
                sender_key: sender_key,
                amount: amount
            }.toCell()
        });
    }

    fun refundArrivalNeed(): Int {
        return max(PROFILE_REFUND_OWNER_MIN_VALUE, PROFILE_REFUND_PAYER_ARRIVAL_MIN
            + getComputeFee(PROFILE_REFUND_WALLET_GAS, false)
            + getForwardFee(PROFILE_REFUND_LEG_CELLS, PROFILE_REFUND_LEG_BITS, false));
    }

    fun acceptCost(): Int {
        return getComputeFee(PROFILE_ACCEPT_GAS_UNITS, false)
            + getForwardFee(PROFILE_WRITE_FWD_CELLS, PROFILE_WRITE_FWD_BITS, false);
    }

    fun refundTriggerNeed(): Int {
        return self.refundArrivalNeed() + getComputeFee(PROFILE_REFUND_SELF_GAS, false)
            + getForwardFee(PROFILE_REFUND_MSG_CELLS, PROFILE_REFUND_MSG_BITS, false);
    }

    fun burnLegNeed(): Int {
        return max(PROFILE_ATH_BURN_EXEC_RESERVE, PROFILE_ATH_OWNER_REQUEST_KEEP
            + getComputeFee(PROFILE_BURN_MASTER_GAS, false)
            + getForwardFee(PROFILE_FLUSH_MSG_CELLS, PROFILE_FLUSH_MSG_BITS, false)
            + getComputeFee(PROFILE_FLUSH_SETTLE_GAS, false));
    }

    fun treasuryLegNeed(): Int {
        return max(PROFILE_ATH_TRANSFER_EXEC_RESERVE, PROFILE_ATH_OWNER_REQUEST_KEEP
            + getForwardFee(PROFILE_REFUND_LEG_CELLS, PROFILE_REFUND_LEG_BITS, false)
            + PROFILE_REFUND_PAYER_ARRIVAL_MIN
            + max(PROFILE_TREASURY_EXCESS_MIN, getComputeFee(PROFILE_FLUSH_SETTLE_GAS, false)));
    }

    fun flushSelfCost(): Int {
        return getComputeFee(PROFILE_FLUSH_SELF_GAS, false)
            + getForwardFee(PROFILE_FLUSH_MSG_CELLS, PROFILE_FLUSH_MSG_BITS, false);
    }

    fun sendAthNotificationRefund(query_id: Int, sender_key: Int, amount: Int) {
        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: 0,
            bounce: true,
            mode: SendRemainingValue,
            body: AthTransferNotificationRefund {
                query_id: query_id,
                sender_key: sender_key,
                amount: amount
            }.toCell()
        });
    }

    fun abandonPendingAvatarWrite(write_id: Int) {
        let pendingOpt: PendingProfileAvatarWrite? = self.pending_avatar_writes.get(write_id);
        throwUnless(21520, pendingOpt != null);
        let pending: PendingProfileAvatarWrite = pendingOpt!!;
        self.pending_avatar_writes.del(write_id);
        self.pending_avatar_write_count -= 1;
        self.sendAthNotificationRefund(pending.query_id, pending.sender_key, pending.amount);
    }

    fun refundAvatarExcess(owner_wallet: Address, retained_value: Int) {
        let excess: Int = context().value - retained_value;
        if (excess < PROFILE_AVATAR_EXCESS_REFUND_MIN_VALUE) {
            return;
        }
        message(MessageParameters {
            to: owner_wallet,
            value: excess,
            bounce: false,
            mode: SendDefaultMode | SendIgnoreErrors,
            body: "platho-avatar-excess-refund".asComment()
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

    fun acceptAvatarPayment(query_id: Int, sender_key: Int, amount: Int, owner_wallet: Address, avatar_hash: Int, avatar_entry_id: Int, avatar_stream_id: Int, avatar_part_count: Int, media_format: Int) {
        throwUnless(21111, amount == PROFILE_AVATAR_PRICE_ATH);
        throwUnless(21113, self.pending_avatar_write_count < PROFILE_PENDING_AVATAR_CAP);
        self.requireValidAvatarPointerFields(owner_wallet, avatar_hash, avatar_stream_id, avatar_part_count, media_format);

        let retainedValue: Int = PROFILE_KEY_SHARD_WRITE_VALUE + self.acceptCost();
        throwUnless(21112, context().value >= retainedValue);

        let writeId: Int = self.next_avatar_write_id;
        self.next_avatar_write_id += 1;
        self.pending_avatar_writes.set(writeId, PendingProfileAvatarWrite {
            query_id: query_id,
            sender_key: sender_key,
            amount: amount,
            owner_wallet: owner_wallet,
            created_at: now()
        });
        self.pending_avatar_write_count += 1;

        message(MessageParameters {
            to: self.deriveKeyShardAddress(owner_wallet),
            value: PROFILE_KEY_SHARD_WRITE_VALUE,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: KeyShardSetAvatarPointer {
                write_id: writeId,
                owner_wallet: owner_wallet,
                avatar_hash: avatar_hash,
                avatar_entry_id: avatar_entry_id,
                avatar_stream_id: avatar_stream_id,
                avatar_part_count: avatar_part_count,
                media_format: media_format
            }.toCell()
        });

        self.refundAvatarExcess(owner_wallet, retainedValue);
    }

    receive(msg: BindProfileOfficialAthWallet) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(21031, msg.deployment_manifest_hash > 1);
        throwUnless(21032, !self.official_ath_wallet_bound);
        throwUnless(21034, self.deployment_manifest_hash == 0 || self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(21035, msg.official_ath_wallet_address == self.deriveAthWalletAddress(myAddress()));
        self.deployment_manifest_hash = msg.deployment_manifest_hash;
        self.genesis_config_hash = 1;
        self.official_ath_wallet_address = msg.official_ath_wallet_address;
        self.official_ath_wallet_bound = true;
    }

    receive(msg: SealGenesis) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(21040, msg.deployment_manifest_hash > 1);
        throwUnless(21041, self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(21042, self.official_ath_wallet_bound);
        throwUnless(21049, self.treasury_ath_receiver_address != myAddress());
        throwUnless(21050, self.treasury_ath_receiver_address != self.official_ath_wallet_address);
        self.genesis_config_hash = msg.deployment_manifest_hash;
        self.sealed = true;
    }

    receive(msg: AthTransferNotificationRegistryProfileAvatar) {
        self.requireSealed();
        throwUnless(21160, sender() == self.official_ath_wallet_address);
        throwUnless(21163, msg.owner_wallet == msg.payer_wallet);
        self.acceptAvatarPayment(
            msg.query_id,
            msg.sender_key,
            msg.amount,
            msg.owner_wallet,
            msg.avatar_hash,
            msg.avatar_entry_id,
            msg.avatar_stream_id,
            msg.avatar_part_count,
            msg.media_format
        );
    }

    receive(msg: KeyShardAvatarPointerAck) {
        self.requireSealed();
        let pendingOpt: PendingProfileAvatarWrite? = self.pending_avatar_writes.get(msg.write_id);
        throwUnless(21500, pendingOpt != null);
        let pending: PendingProfileAvatarWrite = pendingOpt!!;
        throwUnless(21501, sender() == self.deriveKeyShardAddress(pending.owner_wallet));
        self.pending_avatar_writes.del(msg.write_id);
        self.pending_avatar_write_count -= 1;

        if (msg.version == 1) {
            self.profile_count += 1;
        }

        let treasury_amount: Int = (pending.amount * PROFILE_TREASURY_SHARE_BPS) / PROFILE_SPLIT_BASE_BPS;
        let burn_amount: Int = pending.amount - treasury_amount;
        self.treasury_due_ath += treasury_amount;
        self.burn_due_ath += burn_amount;

        self.sendAthNotificationAck(pending.query_id, pending.sender_key, pending.amount);

        nativeReserve(0, ReserveAtMost | ReserveAddOriginalBalance);
        message(MessageParameters {
            to: pending.owner_wallet,
            value: 0,
            mode: SendRemainingBalance | SendIgnoreErrors,
            bounce: false,
            body: "platho-avatar-change".asComment()
        });
    }

    bounced(msg: bounced<KeyShardSetAvatarPointer>) {
        self.requireSealed();
        let pendingOpt: PendingProfileAvatarWrite? = self.pending_avatar_writes.get(msg.write_id);
        throwUnless(21510, pendingOpt != null);
        let pending: PendingProfileAvatarWrite = pendingOpt!!;
        throwUnless(21511, sender() == self.deriveKeyShardAddress(pending.owner_wallet));
        if (context().value >= self.refundTriggerNeed()) {
            self.abandonPendingAvatarWrite(msg.write_id);
            return;
        }
        self.pending_avatar_writes.set(msg.write_id, PendingProfileAvatarWrite {
            query_id: pending.query_id,
            sender_key: pending.sender_key,
            amount: pending.amount,
            owner_wallet: pending.owner_wallet,
            created_at: 0
        });
        message(MessageParameters {
            to: pending.owner_wallet,
            value: 0,
            mode: SendRemainingValue | SendIgnoreErrors,
            bounce: false,
            body: "platho-avatar-change".asComment()
        });
    }

    receive(msg: PruneStaleAvatarWrite) {
        self.requireSealed();
        let pendingOpt: PendingProfileAvatarWrite? = self.pending_avatar_writes.get(msg.write_id);
        throwUnless(21530, pendingOpt != null);
        let pending: PendingProfileAvatarWrite = pendingOpt!!;
        throwUnless(21531, now() >= pending.created_at + PROFILE_AVATAR_WRITE_STALE_TTL);
        throwUnless(21532, context().value >= self.refundTriggerNeed());
        self.abandonPendingAvatarWrite(msg.write_id);
    }

    receive(msg: SweepProfileTreasuryTon) {
        self.requireSealed();
        throwUnless(21613, now() >= PROFILE_TON_SWEEP_OPENS_AT);
        throwUnless(21610, context().value >= PROFILE_TON_SWEEP_EXEC_RESERVE);
        let held: Int = myBalance() - context().value;
        throwUnless(21612, held > PROFILE_TON_SWEEP_FLOOR + PROFILE_TON_SWEEP_MIN);
        let amount: Int = held - PROFILE_TON_SWEEP_FLOOR;
        message(MessageParameters {
            to: self.treasury_ath_receiver_address,
            value: amount,
            mode: SendDefaultMode,
            bounce: false,
            body: null,
        });
    }

    receive(msg: FlushProfileTreasuryAthDue) {
        self.requireSealed();
        throwUnless(21250, msg.query_id > 0);
        self.requireNoDueFlushQuery(msg.query_id);
        throwUnless(21251, self.treasury_due_ath > 0);
        throwUnless(21252, context().value >= self.flushSelfCost() + self.treasuryLegNeed());
        throwUnless(21253, self.pending_treasury_flush_count < PROFILE_PENDING_FLUSH_CAP);

        let flushId: Int = self.next_avatar_write_id;
        self.next_avatar_write_id += 1;
        let amount: Int = self.treasury_due_ath;
        self.treasury_due_ath = 0;
        let recipient_ath_wallet: Address = self.deriveAthWalletAddress(self.treasury_ath_receiver_address);
        self.pending_treasury_flushes.set(flushId, PendingProfileTreasuryFlush {
            amount: amount,
            recipient_ath_wallet: recipient_ath_wallet,
            created_at: now()
        });
        self.pending_treasury_flush_count += 1;

        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: ATHTransferRequest {
                query_id: flushId,
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
        throwUnless(21262, context().value >= self.flushSelfCost() + self.burnLegNeed());
        throwUnless(21263, self.pending_burn_flush_count < PROFILE_PENDING_FLUSH_CAP);

        let flushId: Int = self.next_avatar_write_id;
        self.next_avatar_write_id += 1;
        let amount: Int = self.burn_due_ath;
        self.burn_due_ath = 0;
        self.pending_burn_flushes.set(flushId, PendingProfileBurnFlush {
            amount: amount,
            created_at: now()
        });
        self.pending_burn_flush_count += 1;

        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: ATHBurn {
                query_id: flushId,
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
    }

    receive(msg: ATHTransferExcess) {
        let pendingOpt: PendingProfileTreasuryFlush? = self.pending_treasury_flushes.get(msg.query_id);
        if (pendingOpt != null && sender() == pendingOpt!!.recipient_ath_wallet) {
            self.pending_treasury_flushes.del(msg.query_id);
            self.pending_treasury_flush_count -= 1;
        }
    }

    receive(msg: PruneStaleDueFlush) {
        self.requireSealed();
        if (msg.burn) {
            let pendingOpt: PendingProfileBurnFlush? = self.pending_burn_flushes.get(msg.query_id);
            throwUnless(21270, pendingOpt != null);
            throwUnless(21271, now() > pendingOpt!!.created_at + PROFILE_DUE_FLUSH_STALE_TTL);
            self.pending_burn_flushes.del(msg.query_id);
            self.pending_burn_flush_count -= 1;
        } else {
            let pendingOpt: PendingProfileTreasuryFlush? = self.pending_treasury_flushes.get(msg.query_id);
            throwUnless(21272, pendingOpt != null);
            throwUnless(21273, now() > pendingOpt!!.created_at + PROFILE_DUE_FLUSH_STALE_TTL);
            self.pending_treasury_flushes.del(msg.query_id);
            self.pending_treasury_flush_count -= 1;
        }
    }

    receive() {
        throw(21400);
    }

    get fun get_global(): ProfileRegistryGlobalView {
        return ProfileRegistryGlobalView {
            sealed: self.sealed,
            official_ath_wallet_bound: self.official_ath_wallet_bound,
            deployment_manifest_hash: self.deployment_manifest_hash,
            genesis_config_hash: self.genesis_config_hash,
            official_ath_wallet_address: self.official_ath_wallet_address,
            ath_master_address: self.ath_master_address,
            treasury_ath_receiver_address: self.treasury_ath_receiver_address,
            genesis_controller_address: self.genesis_controller_address,
            profile_count: self.profile_count,
            pending_avatar_write_count: self.pending_avatar_write_count,
            next_avatar_write_id: self.next_avatar_write_id,
            treasury_due_ath: self.treasury_due_ath,
            burn_due_ath: self.burn_due_ath,
            pending_treasury_flush_count: self.pending_treasury_flush_count,
            pending_burn_flush_count: self.pending_burn_flush_count
        };
    }

    get fun get_predecessor_key_shard_address(owner_wallet: Address): Address {
        return self.derivePredecessorKeyShardAddress(owner_wallet);
    }

    get fun get_key_shard_address(owner_wallet: Address): Address {
        return self.deriveKeyShardAddress(owner_wallet);
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

    get fun get_pending_avatar_write(write_id: Int): PendingProfileAvatarWriteView {
        let pendingOpt: PendingProfileAvatarWrite? = self.pending_avatar_writes.get(write_id);
        if (pendingOpt == null) {
            return PendingProfileAvatarWriteView {
                exists: false,
                query_id: 0,
                sender_key: 0,
                amount: 0,
                owner_wallet: myAddress(),
                created_at: 0
            };
        }
        let pending: PendingProfileAvatarWrite = pendingOpt!!;
        return PendingProfileAvatarWriteView {
            exists: true,
            query_id: pending.query_id,
            sender_key: pending.sender_key,
            amount: pending.amount,
            owner_wallet: pending.owner_wallet,
            created_at: pending.created_at
        };
    }

    get fun get_refund_need(): Int {
        return self.refundTriggerNeed();
    }

    get fun get_burn_flush_need(): Int {
        return self.flushSelfCost() + self.burnLegNeed();
    }

    get fun get_treasury_flush_need(): Int {
        return self.flushSelfCost() + self.treasuryLegNeed();
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
