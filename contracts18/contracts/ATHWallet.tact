
const ATH_TRANSFER_NOTIFY_ACK_VALUE: Int = 1000000;
const ATH_REGISTRY_RESPONSE_ACK_VALUE: Int = 3000000;
const ATH_INTERNAL_TRANSFER_ACK_VALUE: Int = 3000000;
const ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE: Int = 4000000;
const ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE: Int = 8000000;
const ATH_REGISTRY_PROFILE_AVATAR_FWD_FEE_ALLOWANCE: Int = 2000000;
const ATH_TRANSFER_NOTIFY_MIN_VALUE: Int = 45000000;
const ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT: Int = 20000000;
const ATH_INTERNAL_TRANSFER_EXEC_RESERVE: Int = 2000000;
const ATH_BURN_NOTIFICATION_EXEC_RESERVE: Int = 2000000;
const ATH_TRANSFER_NOTIFY_EXEC_RESERVE: Int = 7000000;
const ATH_PRUNE_NOTIFICATION_EXEC_RESERVE: Int = 2000000;
const ATH_INTERNAL_TRANSFER_ARRIVAL_MIN: Int = ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_ACK_VALUE
    + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT;
const ATH_NOTIFY_REFUND_OWNER_MIN_VALUE: Int = ATH_INTERNAL_TRANSFER_ARRIVAL_MIN + ATH_TRANSFER_NOTIFY_EXEC_RESERVE
    + ATH_REGISTRY_RESPONSE_ACK_VALUE;
const ATH_OWNER_REQUEST_EXEC_RESERVE: Int = 2000000;
const ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE: Int = 10000000;
const ATH_OWNER_EXCESS_REFUND_MIN_VALUE: Int = 100000;
const ATH_GENESIS_SUPPLY_EXEC_RESERVE: Int = 2000000;
const ATH_GENESIS_SUPPLY_ACK_VALUE: Int = 1000000;
const ATH_TRANSFER_NOTIFY_ID_DOMAIN: Int = 0x41544E49;
const ATH_OUTGOING_TRANSFER_ID_DOMAIN: Int = 0x41544F47;

const ATH_OUTGOING_STUCK_RECOVERY_GRACE_SECONDS: Int = 2592000;
const ATH_OUTGOING_STUCK_RECOVERY_MIN_VALUE: Int = ATH_OWNER_REQUEST_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE
    + ATH_REGISTRY_RESPONSE_ACK_VALUE;
const ATH_NOTIFY_REFUND_QUERY_DOMAIN: Int = 0x41545246;
const ATH_QUERY_ID_MOD: Int = 18446744073709551616;
const ATH_SENDER_KEY_MOD: Int = 1461501637330902918203684832716283019655932542976;
const ATH_PENDING_NOTIFICATION_TTL: Int = 86400;
const ATH_REGISTRY_PENDING_TTL: Int = 604800;
const JETTON_EXCESSES_VALUE: Int = 1000000;

message(0x41544801) ATHBurn {
    query_id: Int as uint64;
    amount: Int as uint128;
    response_destination: Address;
}

message(0x41544802) ATHBurnNotification {
    query_id: Int as uint64;
    amount: Int as uint128;
    owner_address: Address;
    response_destination: Address;
}

message(0x41544803) ATHBurnFinalized {
    query_id: Int as uint64;
    amount: Int as uint128;
    owner_address: Address;
}

message(0x41544804) ATHBurnFailed {
    query_id: Int as uint64;
    amount: Int as uint128;
}

message(0x41544805) ATHGenesisSupplyCredit {
    query_id: Int as uint64;
    amount: Int as uint128;
    response_destination: Address;
}

message(0x41544806) ATHGenesisSupplyAck {
    query_id: Int as uint64;
    amount: Int as uint128;
    owner_address: Address;
}

message(0x472D9D7D) AthTransferNotification {
    query_id: Int as uint64;
    sender_key: Int as uint160;
    amount: Int as uint128;
    sender_wallet: Address;
}

message(0x472D9D7E) AthTransferNotificationAck {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_key: Int as uint160;
}

message(0x4154481E) AthTransferNotificationRefund {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_key: Int as uint160;
}

message(0x504E5052) PruneStaleNotification {
    query_id: Int as uint64;
    sender_key: Int as uint160;
}

message(0x89129D60) AthTransferNotificationRegistryMintUsername {
    query_id: Int as uint64;
    sender_key: Int as uint160;
    amount: Int as uint128;
    payer_wallet: Address;
    owner_wallet: Address;
    username_len: Int as uint8;
    username: Cell;
}

message(0xA11A7002) AthTransferNotificationRegistryProfileAvatar {
    query_id: Int as uint64;
    sender_key: Int as uint160;
    amount: Int as uint128;
    payer_wallet: Address;
    owner_wallet: Address;
    avatar_hash: Int as uint256;
    avatar_entry_id: Int as uint64;
    avatar_stream_id: Int as uint128;
    avatar_part_count: Int as uint16;
    media_format: Int as uint8;
}

message(0x41544810) ATHTransferRequest {
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
    response_destination: Address;
}

message(0x41544814) ATHTransferRequestWithNotify {
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
    response_destination: Address;
    notify_destination: Address;
    notify_value: Int as uint128;
}

message(0x4154481A) ATHTransferRequestRegistryProfileAvatar {
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
    response_destination: Address;
    notify_value: Int as uint128;
    owner_wallet: Address;
    avatar_hash: Int as uint256;
    avatar_entry_id: Int as uint64;
    avatar_stream_id: Int as uint128;
    avatar_part_count: Int as uint16;
    media_format: Int as uint8;
}

message(0x4154481C) ATHTransferRequestRegistryMintUsername {
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
    response_destination: Address;
    notify_value: Int as uint128;
    owner_wallet: Address;
    username_len: Int as uint8;
    username: Slice as remaining;
}

message(0x41544812) ATHInternalTransfer {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_owner: Address;
    response_destination: Address;
}

message(0x41544815) ATHInternalTransferWithNotify {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_owner: Address;
    response_destination: Address;
    notify_destination: Address;
    notify_value: Int as uint128;
}

message(0x4154481B) ATHInternalTransferRegistryProfileAvatar {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_owner: Address;
    response_destination: Address;
    notify_value: Int as uint128;
    owner_wallet: Address;
    avatar_hash: Int as uint256;
    avatar_entry_id: Int as uint64;
    avatar_stream_id: Int as uint128;
    avatar_part_count: Int as uint16;
    media_format: Int as uint8;
}

message(0x4154481D) ATHInternalTransferRegistryMintUsername {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_owner: Address;
    response_destination: Address;
    notify_value: Int as uint128;
    owner_wallet: Address;
    username_len: Int as uint8;
    username: Slice as remaining;
}

message(0x41544811) ATHTransferAck {
    query_id: Int as uint64;
    amount: Int as uint128;
}

message(0x41544813) ATHTransferFailed {
    query_id: Int as uint64;
    amount: Int as uint128;
}

message(0x0F8A7EA5) JettonTransfer {
    query_id: Int as uint64;
    amount: Int as coins;
    destination: Address;
    response_destination: Address;
    custom_payload: Cell?;
    forward_ton_amount: Int as coins;
    forward_payload: Slice as remaining;
}

message(0x178D4519) JettonInternalTransfer {
    query_id: Int as uint64;
    amount: Int as coins;
    from: Address;
    response_address: Address;
    forward_ton_amount: Int as coins;
    forward_payload: Slice as remaining;
}

message(0x7362D09C) JettonTransferNotification {
    query_id: Int as uint64;
    amount: Int as coins;
    sender: Address;
    forward_payload: Slice as remaining;
}

message(0xD53276DB) JettonExcesses {
    query_id: Int as uint64;
}

message(0x4154481F) ATHTransferExcess {
    query_id: Int as uint64;
}

message(0x41544807) ATHWalletTopUpStorageReserve {}

message(0x41544808) ATHRecoverStuckOutgoing {
    query_id: Int as uint64;
    recipient_wallet: Address;
}

struct ATHWalletDataView {
    balance: Int;
    owner_address: Address;
    ath_master_address: Address;
    jetton_wallet_code: Cell;
}

struct PendingAthTransferNotificationView {
    exists: Bool;
    sender_owner: Address;
    response_destination: Address;
    amount: Int;
    created_at: Int;
}

struct PendingAthTransferNotification {
    sender_owner: Address;
    response_destination: Address;
    response_ack_value: Int as uint64;
    amount: Int as uint128;
    created_at: Int as uint64;
}

struct PendingAthOutgoingTransfer {
    recipient_wallet: Address;
    response_destination: Address;
    amount: Int as uint128;
    created_at: Int as uint64;
}

contract ATHWallet {
    balance: Int as uint128;
    owner_address: Address;
    ath_master_address: Address;
    pending_notifications: map<Int, PendingAthTransferNotification>;
    pending_outgoing_transfers: map<Int, PendingAthOutgoingTransfer>;

    init(balance: Int, owner_address: Address, ath_master_address: Address) {
        self.balance = balance;
        self.owner_address = owner_address;
        self.ath_master_address = ath_master_address;
        self.pending_notifications = emptyMap();
        self.pending_outgoing_transfers = emptyMap();
    }

    fun derive_wallet_address(owner: Address): Address {
        let owner_std: StdAddress = parseStdAddress(owner.asSlice());
        let wallet_init: StateInit = initOf ATHWallet(0, owner, self.ath_master_address);
        return contractAddressExt(owner_std.workchain, wallet_init.code, wallet_init.data);
    }

    fun is_basechain_address(owner: Address): Bool {
        let owner_std: StdAddress = parseStdAddress(owner.asSlice());
        return owner_std.workchain == 0;
    }

    fun require_basechain_owner_path(recipient: Address, response_destination: Address) {
        throwUnless(14600, self.is_basechain_address(self.owner_address));
        throwUnless(14601, self.is_basechain_address(recipient));
        throwUnless(14602, self.is_basechain_address(response_destination));
    }

    fun compute_sender_key(query_id: Int, sender_owner: Address): Int {
        return beginCell()
            .storeUint(ATH_TRANSFER_NOTIFY_ID_DOMAIN, 32)
            .storeUint(query_id, 64)
            .storeAddress(sender_owner)
            .endCell()
            .hash() % ATH_SENDER_KEY_MOD;
    }

    fun compute_pending_notification_key(query_id: Int, sender_key: Int): Int {
        return sender_key;
    }

    fun compute_pending_outgoing_key(query_id: Int, recipient_wallet: Address): Int {
        return beginCell()
            .storeUint(ATH_OUTGOING_TRANSFER_ID_DOMAIN, 32)
            .storeUint(query_id, 64)
            .storeAddress(recipient_wallet)
            .endCell()
            .hash();
    }

    fun compute_notify_refund_query_id(query_id: Int, sender_key: Int, refund_wallet: Address): Int {
        return beginCell()
            .storeUint(ATH_NOTIFY_REFUND_QUERY_DOMAIN, 32)
            .storeUint(query_id, 64)
            .storeUint(sender_key, 160)
            .storeAddress(refund_wallet)
            .endCell()
            .hash() % ATH_QUERY_ID_MOD;
    }

    fun notify_transfer_value(notify_value: Int): Int {
        return notify_value + ATH_TRANSFER_NOTIFY_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT;
    }

    fun registry_notify_transfer_value(notify_value: Int): Int {
        return notify_value + ATH_REGISTRY_RESPONSE_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT + ATH_REGISTRY_PROFILE_AVATAR_FWD_FEE_ALLOWANCE;
    }

    fun store_pending_outgoing(query_id: Int, amount: Int, recipient_wallet: Address, response_destination: Address) {
        let pending_key: Int = self.compute_pending_outgoing_key(query_id, recipient_wallet);
        throwUnless(14230, !self.pending_outgoing_transfers.exists(pending_key));
        self.pending_outgoing_transfers.set(pending_key, PendingAthOutgoingTransfer {
            recipient_wallet: recipient_wallet,
            response_destination: response_destination,
            amount: amount,
            created_at: now()
        });
    }

    fun restore_bounced_outgoing(query_id: Int, amount: Int) {
        throwUnless(14220, amount > 0);
        let pending_key: Int = self.compute_pending_outgoing_key(query_id, sender());
        let pendingOpt: PendingAthOutgoingTransfer? = self.pending_outgoing_transfers.get(pending_key);
        throwUnless(14221, pendingOpt != null);
        let pending: PendingAthOutgoingTransfer = pendingOpt!!;
        throwUnless(14222, pending.amount == amount);
        throwUnless(14223, sender() == pending.recipient_wallet);
        self.pending_outgoing_transfers.del(pending_key);
        self.balance += amount;

        if (pending.response_destination != myAddress()) {
            message(MessageParameters {
                to: pending.response_destination,
                value: 0,
                mode: SendRemainingValue,
                bounce: true,
                body: ATHTransferFailed {
                    query_id: query_id,
                    amount: amount
                }.toCell()
            });
        }
    }

    fun send_source_wallet_ack(query_id: Int, amount: Int, source_wallet: Address) {
        message(MessageParameters {
            to: source_wallet,
            value: ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE,
            mode: SendPayFwdFeesSeparately,
            bounce: false,
            body: ATHTransferAck {
                query_id: query_id,
                amount: amount
            }.toCell()
        });
    }

    fun refund_owner_excess(destination: Address, amount: Int) {
        if (amount < ATH_OWNER_EXCESS_REFUND_MIN_VALUE) {
            return;
        }

        message(MessageParameters {
            to: destination,
            value: amount,
            bounce: false,
            mode: SendDefaultMode,
            body: null
        });
    }

    fun refund_pending_notification(query_id: Int, sender_key: Int, amount: Int) {
        throwUnless(14330, amount > 0);
        let pending_key: Int = self.compute_pending_notification_key(query_id, sender_key);
        let pendingOpt: PendingAthTransferNotification? = self.pending_notifications.get(pending_key);
        throwUnless(14332, pendingOpt != null);
        let pending: PendingAthTransferNotification = pendingOpt!!;
        throwUnless(14335, context().value >= ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + pending.response_ack_value);
        throwUnless(14331, self.balance >= amount);
        throwUnless(14333, pending.amount == amount);
        throwUnless(14334, self.compute_sender_key(query_id, pending.sender_owner) == sender_key);

        self.balance -= amount;
        self.pending_notifications.del(pending_key);

        let refund_wallet: Address = self.derive_wallet_address(pending.sender_owner);
        let refund_init: StateInit = initOf ATHWallet(0, pending.sender_owner, self.ath_master_address);
        let refund_query_id: Int = self.compute_notify_refund_query_id(query_id, sender_key, refund_wallet);
        let refund_response_destination: Address = pending.sender_owner;
        let outgoing_failure_destination: Address = pending.sender_owner;

        if (pending.response_ack_value == ATH_REGISTRY_RESPONSE_ACK_VALUE) {
            refund_query_id = query_id;
            refund_response_destination = pending.response_destination;
            outgoing_failure_destination = myAddress();
        } else {
            message(MessageParameters {
                to: pending.response_destination,
                value: pending.response_ack_value,
                mode: SendPayFwdFeesSeparately,
                bounce: false,
                body: ATHTransferFailed {
                    query_id: query_id,
                    amount: amount
                }.toCell()
            });
        }

        self.store_pending_outgoing(refund_query_id, amount, refund_wallet, outgoing_failure_destination);

        send(SendParameters {
            to: refund_wallet,
            value: 0,
            bounce: true,
            mode: SendRemainingValue,
            code: refund_init.code,
            data: refund_init.data,
            body: ATHInternalTransfer {
                query_id: refund_query_id,
                amount: amount,
                sender_owner: self.owner_address,
                response_destination: refund_response_destination
            }.toCell()
        });
    }

    fun return_notify_lane_excess(query_id: Int, destination: Address, required: Int) {
        let excess: Int = context().value - required - context().readForwardFee();
        if (excess < JETTON_EXCESSES_VALUE) {
            return;
        }
        message(MessageParameters {
            to: destination,
            value: excess,
            mode: SendPayFwdFeesSeparately,
            bounce: false,
            body: ATHTransferExcess { query_id: query_id }.toCell()
        });
    }

    fun refund_bounced_notification(query_id: Int, sender_key: Int) {
        let pending_key: Int = self.compute_pending_notification_key(query_id, sender_key);
        let pendingOpt: PendingAthTransferNotification? = self.pending_notifications.get(pending_key);
        throwUnless(14337, pendingOpt != null);
        let pending: PendingAthTransferNotification = pendingOpt!!;
        throwUnless(14338, self.compute_sender_key(query_id, pending.sender_owner) == sender_key);
        self.refund_pending_notification(query_id, sender_key, pending.amount);
    }

    receive(msg: ATHBurn) {
        throwUnless(14000, sender() == self.owner_address);
        throwUnless(14001, msg.amount > 0);
        throwUnless(14002, self.balance >= msg.amount);
        throwUnless(14005, msg.response_destination == self.owner_address);
        let required_value: Int = ATH_BURN_NOTIFICATION_EXEC_RESERVE + ATH_OWNER_REQUEST_EXEC_RESERVE;
        throwUnless(14006, context().value >= required_value);
        let downstream_value: Int = context().value - ATH_OWNER_REQUEST_EXEC_RESERVE;

        self.balance -= msg.amount;

        message(MessageParameters {
            to: self.ath_master_address,
            value: downstream_value,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: ATHBurnNotification {
                query_id: msg.query_id,
                amount: msg.amount,
                owner_address: self.owner_address,
                response_destination: msg.response_destination
            }.toCell()
        });
    }

    bounced(msg: bounced<ATHBurnNotification>) {
        throwUnless(14003, sender() == self.ath_master_address);
        throwUnless(14004, msg.amount > 0);
        self.balance += msg.amount;

        message(MessageParameters {
            to: self.owner_address,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: ATHBurnFailed {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });
    }

    receive(msg: ATHGenesisSupplyCredit) {
        throwUnless(14400, sender() == self.ath_master_address);
        throwUnless(14401, msg.amount > 0);
        throwUnless(14402, self.balance == 0);
        throwUnless(14403, context().value >= ATH_GENESIS_SUPPLY_EXEC_RESERVE + ATH_GENESIS_SUPPLY_ACK_VALUE);

        self.balance += msg.amount;

        message(MessageParameters {
            to: msg.response_destination,
            value: ATH_GENESIS_SUPPLY_ACK_VALUE,
            mode: SendDefaultMode,
            bounce: false,
            body: ATHGenesisSupplyAck {
                query_id: msg.query_id,
                amount: msg.amount,
                owner_address: self.owner_address
            }.toCell()
        });
    }

    receive(msg: ATHTransferRequest) {
        throwUnless(14200, sender() == self.owner_address);
        throwUnless(14201, msg.response_destination == self.owner_address);
        self.require_basechain_owner_path(msg.recipient, msg.response_destination);
        throwUnless(14202, msg.amount > 0);
        throwUnless(14203, self.balance >= msg.amount);
        let required_value: Int = ATH_OWNER_REQUEST_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_ARRIVAL_MIN
            + ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE;
        throwUnless(14204, context().value >= required_value);
        let downstream_value: Int = context().value - ATH_OWNER_REQUEST_EXEC_RESERVE;

        let recipient_wallet: Address = self.derive_wallet_address(msg.recipient);
        let recipient_init: StateInit = initOf ATHWallet(0, msg.recipient, self.ath_master_address);
        self.store_pending_outgoing(msg.query_id, msg.amount, recipient_wallet, msg.response_destination);
        self.balance -= msg.amount;

        send(SendParameters {
            to: recipient_wallet,
            value: downstream_value,
            bounce: true,
            mode: SendDefaultMode,
            code: recipient_init.code,
            data: recipient_init.data,
            body: ATHInternalTransfer {
                query_id: msg.query_id,
                amount: msg.amount,
                sender_owner: self.owner_address,
                response_destination: msg.response_destination
            }.toCell()
        });
    }

    receive(msg: ATHTransferRequestWithNotify) {
        throwUnless(14300, sender() == self.owner_address);
        throwUnless(14301, msg.response_destination == self.owner_address);
        throwUnless(14302, msg.notify_destination == msg.recipient);
        self.require_basechain_owner_path(msg.recipient, msg.response_destination);
        throwUnless(14303, msg.amount > 0);
        throwUnless(14304, msg.notify_value > 0);
        throwUnless(14305, self.balance >= msg.amount);
        throwUnless(14306, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
        let downstream_value: Int = self.notify_transfer_value(msg.notify_value);
        let required_value: Int = downstream_value + ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE;
        throwUnless(14307, context().value >= required_value);

        let recipient_wallet: Address = self.derive_wallet_address(msg.recipient);
        let recipient_init: StateInit = initOf ATHWallet(0, msg.recipient, self.ath_master_address);
        self.store_pending_outgoing(msg.query_id, msg.amount, recipient_wallet, msg.response_destination);
        self.balance -= msg.amount;

        send(SendParameters {
            to: recipient_wallet,
            value: downstream_value,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            code: recipient_init.code,
            data: recipient_init.data,
            body: ATHInternalTransferWithNotify {
                query_id: msg.query_id,
                amount: msg.amount,
                sender_owner: self.owner_address,
                response_destination: msg.response_destination,
                notify_destination: msg.notify_destination,
                notify_value: msg.notify_value
            }.toCell()
        });

        self.refund_owner_excess(msg.response_destination, context().value - required_value);
    }

    receive(msg: ATHTransferRequestRegistryMintUsername) {
        throwUnless(14550, sender() == self.owner_address);
        throwUnless(14551, msg.response_destination == self.owner_address);
        self.require_basechain_owner_path(msg.recipient, msg.response_destination);
        throwUnless(14552, self.is_basechain_address(msg.owner_wallet));
        throwUnless(14553, msg.amount > 0);
        throwUnless(14554, msg.notify_value > 0);
        throwUnless(14555, self.balance >= msg.amount);
        throwUnless(14556, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
        let downstream_value: Int = self.registry_notify_transfer_value(msg.notify_value);
        let required_value: Int = downstream_value + ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE;
        throwUnless(14557, context().value >= required_value);

        let recipient_wallet: Address = self.derive_wallet_address(msg.recipient);
        let recipient_init: StateInit = initOf ATHWallet(0, msg.recipient, self.ath_master_address);
        self.store_pending_outgoing(msg.query_id, msg.amount, recipient_wallet, msg.response_destination);
        self.balance -= msg.amount;

        send(SendParameters {
            to: recipient_wallet,
            value: downstream_value,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            code: recipient_init.code,
            data: recipient_init.data,
            body: ATHInternalTransferRegistryMintUsername {
                query_id: msg.query_id,
                amount: msg.amount,
                sender_owner: self.owner_address,
                response_destination: msg.response_destination,
                notify_value: msg.notify_value,
                owner_wallet: msg.owner_wallet,
                username_len: msg.username_len,
                username: msg.username
            }.toCell()
        });

        self.refund_owner_excess(msg.response_destination, context().value - required_value);
    }

    receive(msg: ATHTransferRequestRegistryProfileAvatar) {
        throwUnless(14650, sender() == self.owner_address);
        throwUnless(14651, msg.response_destination == self.owner_address);
        self.require_basechain_owner_path(msg.recipient, msg.response_destination);
        throwUnless(14652, self.is_basechain_address(msg.owner_wallet));
        throwUnless(14653, msg.amount > 0);
        throwUnless(14654, msg.notify_value > 0);
        throwUnless(14655, self.balance >= msg.amount);
        throwUnless(14656, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
        let downstream_value: Int = self.registry_notify_transfer_value(msg.notify_value);
        let required_value: Int = downstream_value + ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE;
        throwUnless(14657, context().value >= required_value);

        let recipient_wallet: Address = self.derive_wallet_address(msg.recipient);
        let recipient_init: StateInit = initOf ATHWallet(0, msg.recipient, self.ath_master_address);
        self.store_pending_outgoing(msg.query_id, msg.amount, recipient_wallet, msg.response_destination);
        self.balance -= msg.amount;

        send(SendParameters {
            to: recipient_wallet,
            value: downstream_value,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            code: recipient_init.code,
            data: recipient_init.data,
            body: ATHInternalTransferRegistryProfileAvatar {
                query_id: msg.query_id,
                amount: msg.amount,
                sender_owner: self.owner_address,
                response_destination: msg.response_destination,
                notify_value: msg.notify_value,
                owner_wallet: msg.owner_wallet,
                avatar_hash: msg.avatar_hash,
                avatar_entry_id: msg.avatar_entry_id,
                avatar_stream_id: msg.avatar_stream_id,
                avatar_part_count: msg.avatar_part_count,
                media_format: msg.media_format
            }.toCell()
        });

        self.refund_owner_excess(msg.response_destination, context().value - required_value);
    }

    receive(msg: JettonTransfer) {
        throwUnless(14700, sender() == self.owner_address);
        self.require_basechain_owner_path(msg.destination, msg.response_destination);
        throwUnless(14701, msg.amount > 0);
        throwUnless(14702, self.balance >= msg.amount);
        throwUnless(14703, msg.forward_ton_amount < context().value);
        let arrival_min: Int = ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE
            + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT;
        if (msg.forward_ton_amount > 0) {
            arrival_min = msg.forward_ton_amount + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE
                + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT
                + context().readForwardFee();
        }
        let required_value: Int = ATH_OWNER_REQUEST_EXEC_RESERVE + arrival_min
            + ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE;
        throwUnless(14704, context().value >= required_value);
        let downstream_value: Int = context().value - ATH_OWNER_REQUEST_EXEC_RESERVE;

        let recipient_wallet: Address = self.derive_wallet_address(msg.destination);
        let recipient_init: StateInit = initOf ATHWallet(0, msg.destination, self.ath_master_address);
        self.store_pending_outgoing(msg.query_id, msg.amount, recipient_wallet, msg.response_destination);
        self.balance -= msg.amount;

        send(SendParameters {
            to: recipient_wallet,
            value: downstream_value,
            bounce: true,
            mode: SendDefaultMode,
            code: recipient_init.code,
            data: recipient_init.data,
            body: JettonInternalTransfer {
                query_id: msg.query_id,
                amount: msg.amount,
                from: self.owner_address,
                response_address: msg.response_destination,
                forward_ton_amount: msg.forward_ton_amount,
                forward_payload: msg.forward_payload
            }.toCell()
        });
    }

    receive(msg: ATHInternalTransfer) {
        throwUnless(14210, msg.amount > 0);
        throwUnless(14211, sender() == self.derive_wallet_address(msg.sender_owner));
        throwUnless(14212, context().value >= ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);

        self.balance += msg.amount;

        message(MessageParameters {
            to: msg.response_destination,
            value: ATH_INTERNAL_TRANSFER_ACK_VALUE,
            mode: SendPayFwdFeesSeparately,
            bounce: false,
            body: ATHTransferAck {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });

        message(MessageParameters {
            to: sender(),
            value: ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE,
            mode: SendPayFwdFeesSeparately,
            bounce: false,
            body: ATHTransferAck {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });

        let excess: Int = context().value - ATH_INTERNAL_TRANSFER_ARRIVAL_MIN;
        if (excess >= JETTON_EXCESSES_VALUE) {
            message(MessageParameters {
                to: msg.response_destination,
                value: excess,
                mode: SendPayFwdFeesSeparately,
                bounce: false,
                body: ATHTransferExcess { query_id: msg.query_id }.toCell()
            });
        }
    }

    receive(msg: JettonInternalTransfer) {
        throwUnless(14710, msg.amount > 0);
        throwUnless(14711, sender() == self.derive_wallet_address(msg.from));
        throwUnless(14712, self.is_basechain_address(msg.from));

        if (msg.forward_ton_amount > 0) {
            throwUnless(14713, msg.forward_ton_amount < context().value);
            throwUnless(14714, context().value >= msg.forward_ton_amount + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT + context().readForwardFee());

            self.balance += msg.amount;
            message(MessageParameters {
                to: self.owner_address,
                value: msg.forward_ton_amount,
                mode: SendPayFwdFeesSeparately,
                bounce: false,
                body: JettonTransferNotification {
                    query_id: msg.query_id,
                    amount: msg.amount,
                    sender: msg.from,
                    forward_payload: msg.forward_payload
                }.toCell()
            });
        } else {
            throwUnless(14717, context().value >= ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
            self.balance += msg.amount;
        }

        self.send_source_wallet_ack(msg.query_id, msg.amount, sender());

        let consumed: Int = ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE
            + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT;
        if (msg.forward_ton_amount > 0) {
            consumed = msg.forward_ton_amount + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE
                + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT
                + context().readForwardFee();
        }
        let excess: Int = context().value - consumed;
        if (excess >= JETTON_EXCESSES_VALUE) {
            message(MessageParameters {
                to: msg.response_address,
                value: excess,
                mode: SendPayFwdFeesSeparately,
                bounce: false,
                body: JettonExcesses {
                    query_id: msg.query_id
                }.toCell()
            });
        }
    }

    receive(msg: ATHInternalTransferWithNotify) {
        throwUnless(14310, msg.amount > 0);
        throwUnless(14311, sender() == self.derive_wallet_address(msg.sender_owner));
        throwUnless(14312, msg.notify_destination == self.owner_address);
        throwUnless(14313, msg.notify_value > 0);
        throwUnless(14314, context().value >= msg.notify_value + ATH_TRANSFER_NOTIFY_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
        let sender_key: Int = self.compute_sender_key(msg.query_id, msg.sender_owner);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, sender_key);
        throwUnless(14315, !self.pending_notifications.exists(pending_key));
        throwUnless(14316, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);

        self.balance += msg.amount;
        self.pending_notifications.set(pending_key, PendingAthTransferNotification {
            sender_owner: msg.sender_owner,
            response_destination: msg.response_destination,
            response_ack_value: ATH_TRANSFER_NOTIFY_ACK_VALUE,
            amount: msg.amount,
            created_at: now()
        });

        message(MessageParameters {
            to: msg.notify_destination,
            value: msg.notify_value,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: AthTransferNotification {
                query_id: msg.query_id,
                sender_key: sender_key,
                amount: msg.amount,
                sender_wallet: msg.sender_owner
            }.toCell()
        });

        message(MessageParameters {
            to: msg.response_destination,
            value: ATH_TRANSFER_NOTIFY_ACK_VALUE,
            mode: SendDefaultMode,
            bounce: false,
            body: ATHTransferAck {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });

        message(MessageParameters {
            to: sender(),
            value: ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE,
            mode: SendPayFwdFeesSeparately,
            bounce: false,
            body: ATHTransferAck {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });

        self.return_notify_lane_excess(msg.query_id, msg.response_destination,
            msg.notify_value + ATH_TRANSFER_NOTIFY_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE
            + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
    }

    receive(msg: ATHInternalTransferRegistryMintUsername) {
        throwUnless(14560, msg.amount > 0);
        throwUnless(14561, sender() == self.derive_wallet_address(msg.sender_owner));
        throwUnless(14562, msg.notify_value > 0);
        throwUnless(14563, context().value >= msg.notify_value + ATH_REGISTRY_RESPONSE_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
        throwUnless(14564, self.is_basechain_address(msg.owner_wallet));
        let sender_key: Int = self.compute_sender_key(msg.query_id, msg.sender_owner);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, sender_key);
        throwUnless(14565, !self.pending_notifications.exists(pending_key));
        throwUnless(14566, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);

        self.balance += msg.amount;
        self.pending_notifications.set(pending_key, PendingAthTransferNotification {
            sender_owner: msg.sender_owner,
            response_destination: msg.response_destination,
            response_ack_value: ATH_REGISTRY_RESPONSE_ACK_VALUE,
            amount: msg.amount,
            created_at: now()
        });

        message(MessageParameters {
            to: self.owner_address,
            value: msg.notify_value,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: AthTransferNotificationRegistryMintUsername {
                query_id: msg.query_id,
                sender_key: sender_key,
                amount: msg.amount,
                payer_wallet: msg.sender_owner,
                owner_wallet: msg.owner_wallet,
                username_len: msg.username_len,
                username: beginCell().storeSlice(msg.username).endCell()
            }.toCell()
        });

        message(MessageParameters {
            to: sender(),
            value: ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE,
            mode: SendPayFwdFeesSeparately,
            bounce: false,
            body: ATHTransferAck {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });

        self.return_notify_lane_excess(msg.query_id, msg.response_destination,
            msg.notify_value + ATH_REGISTRY_RESPONSE_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE
            + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
    }

    receive(msg: ATHInternalTransferRegistryProfileAvatar) {
        throwUnless(14660, msg.amount > 0);
        throwUnless(14661, sender() == self.derive_wallet_address(msg.sender_owner));
        throwUnless(14662, msg.notify_value > 0);
        throwUnless(14663, context().value >= msg.notify_value + ATH_REGISTRY_RESPONSE_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
        throwUnless(14664, self.is_basechain_address(msg.owner_wallet));
        let sender_key: Int = self.compute_sender_key(msg.query_id, msg.sender_owner);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, sender_key);
        throwUnless(14665, !self.pending_notifications.exists(pending_key));
        throwUnless(14666, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);

        self.balance += msg.amount;
        self.pending_notifications.set(pending_key, PendingAthTransferNotification {
            sender_owner: msg.sender_owner,
            response_destination: msg.response_destination,
            response_ack_value: ATH_REGISTRY_RESPONSE_ACK_VALUE,
            amount: msg.amount,
            created_at: now()
        });

        message(MessageParameters {
            to: self.owner_address,
            value: msg.notify_value,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: AthTransferNotificationRegistryProfileAvatar {
                query_id: msg.query_id,
                sender_key: sender_key,
                amount: msg.amount,
                payer_wallet: msg.sender_owner,
                owner_wallet: msg.owner_wallet,
                avatar_hash: msg.avatar_hash,
                avatar_entry_id: msg.avatar_entry_id,
                avatar_stream_id: msg.avatar_stream_id,
                avatar_part_count: msg.avatar_part_count,
                media_format: msg.media_format
            }.toCell()
        });

        message(MessageParameters {
            to: sender(),
            value: ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE,
            mode: SendPayFwdFeesSeparately,
            bounce: false,
            body: ATHTransferAck {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });

        self.return_notify_lane_excess(msg.query_id, msg.response_destination,
            msg.notify_value + ATH_REGISTRY_RESPONSE_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE
            + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
    }

    receive(msg: ATHTransferAck) {
        throwUnless(14240, msg.amount > 0);
        let pending_key: Int = self.compute_pending_outgoing_key(msg.query_id, sender());
        let pendingOpt: PendingAthOutgoingTransfer? = self.pending_outgoing_transfers.get(pending_key);
        throwUnless(14241, pendingOpt != null);
        let pending: PendingAthOutgoingTransfer = pendingOpt!!;
        throwUnless(14242, pending.amount == msg.amount);
        throwUnless(14243, sender() == pending.recipient_wallet);
        self.pending_outgoing_transfers.del(pending_key);
    }

    receive(msg: ATHRecoverStuckOutgoing) {
        throwUnless(14250, context().value >= ATH_OUTGOING_STUCK_RECOVERY_MIN_VALUE);
        let pending_key: Int = self.compute_pending_outgoing_key(msg.query_id, msg.recipient_wallet);
        let pendingOpt: PendingAthOutgoingTransfer? = self.pending_outgoing_transfers.get(pending_key);
        throwUnless(14251, pendingOpt != null);
        let pending: PendingAthOutgoingTransfer = pendingOpt!!;
        throwUnless(14252, now() > pending.created_at + ATH_OUTGOING_STUCK_RECOVERY_GRACE_SECONDS);

        self.pending_outgoing_transfers.del(pending_key);
        self.balance += pending.amount;

        if (pending.response_destination != myAddress()) {
            message(MessageParameters {
                to: pending.response_destination,
                value: 0,
                mode: SendRemainingValue,
                bounce: true,
                body: ATHTransferFailed {
                    query_id: msg.query_id,
                    amount: pending.amount
                }.toCell()
            });
        }
    }

    receive(msg: AthTransferNotificationAck) {
        throwUnless(14340, sender() == self.owner_address);
        throwUnless(14341, msg.amount > 0);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, msg.sender_key);
        let pendingOpt: PendingAthTransferNotification? = self.pending_notifications.get(pending_key);
        if (pendingOpt == null) {
            return;
        }
        let pending: PendingAthTransferNotification = pendingOpt!!;
        throwUnless(14343, pending.amount == msg.amount);
        throwUnless(14344, self.compute_sender_key(msg.query_id, pending.sender_owner) == msg.sender_key);
        self.pending_notifications.del(pending_key);

        message(MessageParameters {
            to: pending.response_destination,
            value: pending.response_ack_value,
            mode: SendPayFwdFeesSeparately,
            bounce: false,
            body: ATHTransferAck {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });
    }

    receive(msg: AthTransferNotificationRefund) {
        throwUnless(14346, sender() == self.owner_address);
        throwUnless(14347, context().value >= ATH_NOTIFY_REFUND_OWNER_MIN_VALUE);
        self.refund_pending_notification(msg.query_id, msg.sender_key, msg.amount);
    }

    receive(msg: PruneStaleNotification) {
        throwUnless(14349, context().value >= ATH_PRUNE_NOTIFICATION_EXEC_RESERVE);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, msg.sender_key);
        let pendingOpt: PendingAthTransferNotification? = self.pending_notifications.get(pending_key);
        throwUnless(14350, pendingOpt != null);
        let pending: PendingAthTransferNotification = pendingOpt!!;
        throwUnless(14351, self.compute_sender_key(msg.query_id, pending.sender_owner) == msg.sender_key);
        let ttl: Int = pending.response_ack_value == ATH_REGISTRY_RESPONSE_ACK_VALUE
            ? ATH_REGISTRY_PENDING_TTL
            : ATH_PENDING_NOTIFICATION_TTL;
        throwUnless(14352, now() >= pending.created_at + ttl);
        self.pending_notifications.del(pending_key);
    }

    bounced(msg: bounced<ATHInternalTransfer>) {
        self.restore_bounced_outgoing(msg.query_id, msg.amount);
    }

    bounced(msg: bounced<ATHInternalTransferWithNotify>) {
        self.restore_bounced_outgoing(msg.query_id, msg.amount);
    }

    bounced(msg: bounced<ATHInternalTransferRegistryMintUsername>) {
        self.restore_bounced_outgoing(msg.query_id, msg.amount);
    }

    bounced(msg: bounced<ATHInternalTransferRegistryProfileAvatar>) {
        self.restore_bounced_outgoing(msg.query_id, msg.amount);
    }

    bounced(msg: bounced<JettonInternalTransfer>) {
        self.restore_bounced_outgoing(msg.query_id, msg.amount);
    }

    bounced(msg: bounced<AthTransferNotification>) {
        throwUnless(14336, sender() == self.owner_address);
        self.refund_bounced_notification(msg.query_id, msg.sender_key);
    }

    bounced(msg: bounced<AthTransferNotificationRegistryMintUsername>) {
        throwUnless(14570, sender() == self.owner_address);
        self.refund_bounced_notification(msg.query_id, msg.sender_key);
    }

    bounced(msg: bounced<AthTransferNotificationRegistryProfileAvatar>) {
        throwUnless(14670, sender() == self.owner_address);
        self.refund_bounced_notification(msg.query_id, msg.sender_key);
    }

    get fun get_wallet_data(): ATHWalletDataView {
        return ATHWalletDataView {
            balance: self.balance,
            owner_address: self.owner_address,
            ath_master_address: self.ath_master_address,
            jetton_wallet_code: (initOf ATHWallet(0, self.owner_address, self.ath_master_address)).code
        };
    }

    get fun get_pending_notification(query_id: Int, sender_key: Int): PendingAthTransferNotificationView {
        let pending_key: Int = self.compute_pending_notification_key(query_id, sender_key);
        let pendingOpt: PendingAthTransferNotification? = self.pending_notifications.get(pending_key);
        if (pendingOpt == null) {
            return PendingAthTransferNotificationView {
                exists: false,
                sender_owner: self.owner_address,
                response_destination: self.owner_address,
                amount: 0,
                created_at: 0
            };
        }
        let pending: PendingAthTransferNotification = pendingOpt!!;
        return PendingAthTransferNotificationView {
            exists: true,
            sender_owner: pending.sender_owner,
            response_destination: pending.response_destination,
            amount: pending.amount,
            created_at: pending.created_at
        };
    }

    receive(msg: ATHWalletTopUpStorageReserve) {
    }

    receive() {
        throw(13000);
    }
}
