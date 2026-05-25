// Platho v1 ATH Wallet implementation.
// Scope: deterministic wallet derivation, authenticated burn request forwarding,
// and owner-authorized bounce-safe ATH transfers.

const ATH_TRANSFER_NOTIFY_ACK_VALUE: Int = 1000000;
const ATH_INTERNAL_TRANSFER_ACK_VALUE: Int = 3000000;
const ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE: Int = 1000000;
const ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE: Int = 21000000;
const ATH_TRANSFER_NOTIFY_MIN_VALUE: Int = 30000000;
const ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT: Int = 2000000;
const ATH_INTERNAL_TRANSFER_EXEC_RESERVE: Int = 2000000;
const ATH_BURN_NOTIFICATION_EXEC_RESERVE: Int = 2000000;
const ATH_TRANSFER_NOTIFY_EXEC_RESERVE: Int = 7000000;
const ATH_OWNER_REQUEST_EXEC_RESERVE: Int = 2000000;
const ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE: Int = 10000000;
const ATH_OWNER_EXCESS_REFUND_MIN_VALUE: Int = 100000;
const ATH_GENESIS_SUPPLY_EXEC_RESERVE: Int = 2000000;
const ATH_GENESIS_SUPPLY_ACK_VALUE: Int = 1000000;
const ATH_TRANSFER_NOTIFY_ID_DOMAIN: Int = 0x41544E49; // "ATNI"
const ATH_OUTGOING_TRANSFER_ID_DOMAIN: Int = 0x41544F47; // "ATOG"
const ATH_NOTIFY_REFUND_QUERY_DOMAIN: Int = 0x41545246; // "ATRF"
const ATH_TRANSFER_NOTIFY_SENDER_KEY_MOD: Int = 4294967296;
const ATH_QUERY_ID_MOD: Int = 18446744073709551616;
const ATH_PENDING_NOTIFICATION_TTL: Int = 86400; // 24 hours
const JETTON_EXCESSES_VALUE: Int = 1000000;

message(0x41544801) ATHBurn {
    query_id: Int as uint64;
    amount: Int as uint128;
    response_destination: Address;
}

// Field order is intentional: query_id + amount fit inside bounced-message prefix.
// This lets ATHWallet restore balance if the burn notification bounces.
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

// ATH Master -> official treasury wallet. One-shot fixed-supply genesis credit.
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
    amount: Int as uint128;
    sender_key: Int as uint32;
    sender_wallet: Address;
}

message(0x472D9D7E) AthTransferNotificationAck {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_key: Int as uint32;
}

message(0x504E5052) PruneStaleNotification {
    query_id: Int as uint64;
    sender_key: Int as uint32;
}

// Official ATH wallet -> UsernameRegistry. The wallet fills amount/owner from
// the real credited transfer; callers provide only the username bytes.
message(0x89129D5F) AthTransferNotificationMintUsername {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_key: Int as uint32;
    owner_wallet: Address;
    username_len: Int as uint8;
    username: Slice as remaining;
}

// Official profile ATH wallet -> ProfileRegistry. The wallet fills amount/owner
// from the real credited transfer; callers provide only the avatar pointer.
message(0xA11A7001) AthTransferNotificationProfileAvatar {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_key: Int as uint32;
    owner_wallet: Address;
    avatar_hash: Int as uint256;
    avatar_entry_id: Int as uint64;
    avatar_stream_id: Int as uint128;
    avatar_part_count: Int as uint16;
    media_format: Int as uint8;
}

// Owner -> own official ATH wallet. Field order is intentional for owner-side bounce recovery.
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

message(0x41544816) ATHTransferRequestMintUsername {
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
    response_destination: Address;
    notify_value: Int as uint128;
    username_len: Int as uint8;
    username: Slice as remaining;
}

message(0x41544818) ATHTransferRequestProfileAvatar {
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
    response_destination: Address;
    notify_value: Int as uint128;
    avatar_hash: Int as uint256;
    avatar_entry_id: Int as uint64;
    avatar_stream_id: Int as uint128;
    avatar_part_count: Int as uint16;
    media_format: Int as uint8;
}

// ATH wallet -> recipient ATH wallet. Field order is intentional for wallet-side bounce recovery.
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

message(0x41544817) ATHInternalTransferMintUsername {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_owner: Address;
    response_destination: Address;
    notify_value: Int as uint128;
    username_len: Int as uint8;
    username: Slice as remaining;
}

message(0x41544819) ATHInternalTransferProfileAvatar {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_owner: Address;
    response_destination: Address;
    notify_value: Int as uint128;
    avatar_hash: Int as uint256;
    avatar_entry_id: Int as uint64;
    avatar_stream_id: Int as uint128;
    avatar_part_count: Int as uint16;
    media_format: Int as uint8;
}

// Recipient ATH wallet -> response destination after successful credit.
message(0x41544811) ATHTransferAck {
    query_id: Int as uint64;
    amount: Int as uint128;
}

// Source ATH wallet -> response destination after internal transfer bounce/failure.
message(0x41544813) ATHTransferFailed {
    query_id: Int as uint64;
    amount: Int as uint128;
}

// TEP-74 compatible surface used by external jetton routers. Platho system
// contracts still consume the authenticated ATH* messages above.
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

struct ATHWalletDataView {
    balance: Int;
    owner_address: Address;
    ath_master_address: Address;
}

struct PendingAthTransferNotificationView {
    exists: Bool;
    sender_owner: Address;
    amount: Int;
    created_at: Int;
}

struct PendingAthTransferNotification {
    sender_owner: Address;
    amount: Int as uint128;
    created_at: Int as uint32;
}

struct PendingAthOutgoingTransfer {
    recipient_wallet: Address;
    response_destination: Address;
    amount: Int as uint128;
    created_at: Int as uint32;
}

contract ATHWallet {
    balance: Int as uint128;
    owner_address: Address;
    ath_master_address: Address;
    pending_notifications: map<Int, PendingAthTransferNotification>;
    processed_notifications: map<Int, Int>;
    pruned_notification_acks: map<Int, Int>;
    pending_outgoing_transfers: map<Int, PendingAthOutgoingTransfer>;

    init(balance: Int, owner_address: Address, ath_master_address: Address) {
        self.balance = balance;
        self.owner_address = owner_address;
        self.ath_master_address = ath_master_address;
        self.pending_notifications = emptyMap();
        self.processed_notifications = emptyMap();
        self.pruned_notification_acks = emptyMap();
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

    fun compute_sender_key(sender_owner: Address): Int {
        return beginCell()
            .storeUint(ATH_TRANSFER_NOTIFY_ID_DOMAIN, 32)
            .storeAddress(sender_owner)
            .endCell()
            .hash() % ATH_TRANSFER_NOTIFY_SENDER_KEY_MOD;
    }

    fun compute_pending_notification_key(query_id: Int, sender_key: Int): Int {
        return (query_id * ATH_TRANSFER_NOTIFY_SENDER_KEY_MOD) + sender_key;
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
            .storeUint(sender_key, 32)
            .storeAddress(refund_wallet)
            .endCell()
            .hash() % ATH_QUERY_ID_MOD;
    }

    fun notify_transfer_value(notify_value: Int): Int {
        return notify_value + ATH_TRANSFER_NOTIFY_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT;
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

    fun refund_bounced_notification(query_id: Int, sender_key: Int, amount: Int) {
        throwUnless(14330, amount > 0);
        throwUnless(14335, context().value >= ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE);
        throwUnless(14331, self.balance >= amount);
        let pending_key: Int = self.compute_pending_notification_key(query_id, sender_key);
        let pendingOpt: PendingAthTransferNotification? = self.pending_notifications.get(pending_key);
        throwUnless(14332, pendingOpt != null);
        let pending: PendingAthTransferNotification = pendingOpt!!;
        throwUnless(14333, pending.amount == amount);
        throwUnless(14334, self.compute_sender_key(pending.sender_owner) == sender_key);

        self.balance -= amount;
        self.pending_notifications.del(pending_key);

        let refund_wallet: Address = self.derive_wallet_address(pending.sender_owner);
        let refund_init: StateInit = initOf ATHWallet(0, pending.sender_owner, self.ath_master_address);
        let refund_query_id: Int = self.compute_notify_refund_query_id(query_id, sender_key, refund_wallet);
        self.store_pending_outgoing(refund_query_id, amount, refund_wallet, pending.sender_owner);

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
                response_destination: pending.sender_owner
            }.toCell()
        });
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
        let required_value: Int = ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_ACK_VALUE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT + ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE + ATH_OWNER_REQUEST_EXEC_RESERVE;
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

    receive(msg: ATHTransferRequestMintUsername) {
        throwUnless(14500, sender() == self.owner_address);
        throwUnless(14501, msg.response_destination == self.owner_address);
        self.require_basechain_owner_path(msg.recipient, msg.response_destination);
        throwUnless(14502, msg.amount > 0);
        throwUnless(14503, msg.notify_value > 0);
        throwUnless(14504, self.balance >= msg.amount);
        throwUnless(14505, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
        let downstream_value: Int = self.notify_transfer_value(msg.notify_value);
        let required_value: Int = downstream_value + ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE;
        throwUnless(14506, context().value >= required_value);

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
            body: ATHInternalTransferMintUsername {
                query_id: msg.query_id,
                amount: msg.amount,
                sender_owner: self.owner_address,
                response_destination: msg.response_destination,
                notify_value: msg.notify_value,
                username_len: msg.username_len,
                username: msg.username
            }.toCell()
        });

        self.refund_owner_excess(msg.response_destination, context().value - required_value);
    }

    receive(msg: ATHTransferRequestProfileAvatar) {
        throwUnless(14610, sender() == self.owner_address);
        throwUnless(14611, msg.response_destination == self.owner_address);
        self.require_basechain_owner_path(msg.recipient, msg.response_destination);
        throwUnless(14612, msg.amount > 0);
        throwUnless(14613, msg.notify_value > 0);
        throwUnless(14614, self.balance >= msg.amount);
        throwUnless(14615, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
        let downstream_value: Int = self.notify_transfer_value(msg.notify_value);
        let required_value: Int = downstream_value + ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE;
        throwUnless(14616, context().value >= required_value);

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
            body: ATHInternalTransferProfileAvatar {
                query_id: msg.query_id,
                amount: msg.amount,
                sender_owner: self.owner_address,
                response_destination: msg.response_destination,
                notify_value: msg.notify_value,
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
        throwUnless(14703, msg.forward_ton_amount == 0 || msg.forward_ton_amount >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
        let required_value: Int = ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + msg.forward_ton_amount + ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE + ATH_OWNER_REQUEST_EXEC_RESERVE;
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
    }

    receive(msg: JettonInternalTransfer) {
        throwUnless(14710, msg.amount > 0);
        throwUnless(14711, sender() == self.derive_wallet_address(msg.from));
        throwUnless(14712, self.is_basechain_address(msg.from));

        if (msg.forward_ton_amount > 0) {
            throwUnless(14713, msg.forward_ton_amount >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
            throwUnless(14714, context().value >= msg.forward_ton_amount + ATH_TRANSFER_NOTIFY_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
            let sender_key: Int = self.compute_sender_key(msg.from);
            let pending_key: Int = self.compute_pending_notification_key(msg.query_id, sender_key);
            throwUnless(14715, !self.pending_notifications.exists(pending_key));
            throwUnless(14716, !self.processed_notifications.exists(pending_key));

            self.balance += msg.amount;
            self.pending_notifications.set(pending_key, PendingAthTransferNotification {
                sender_owner: msg.from,
                amount: msg.amount,
                created_at: now()
            });

            message(MessageParameters {
                to: self.owner_address,
                value: msg.forward_ton_amount,
                mode: SendPayFwdFeesSeparately,
                bounce: true,
                body: AthTransferNotification {
                    query_id: msg.query_id,
                    sender_key: sender_key,
                    amount: msg.amount,
                    sender_wallet: msg.from
                }.toCell()
            });
        } else {
            throwUnless(14717, context().value >= ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
            self.balance += msg.amount;
        }

        self.send_source_wallet_ack(msg.query_id, msg.amount, sender());

        if (context().value >= msg.forward_ton_amount + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + JETTON_EXCESSES_VALUE) {
            message(MessageParameters {
                to: msg.response_address,
                value: JETTON_EXCESSES_VALUE,
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
        let sender_key: Int = self.compute_sender_key(msg.sender_owner);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, sender_key);
        throwUnless(14315, !self.pending_notifications.exists(pending_key));
        throwUnless(14316, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
        throwUnless(14317, !self.processed_notifications.exists(pending_key));

        self.balance += msg.amount;
        self.pending_notifications.set(pending_key, PendingAthTransferNotification {
            sender_owner: msg.sender_owner,
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
    }

    receive(msg: ATHInternalTransferMintUsername) {
        throwUnless(14510, msg.amount > 0);
        throwUnless(14511, sender() == self.derive_wallet_address(msg.sender_owner));
        throwUnless(14512, msg.notify_value > 0);
        throwUnless(14513, context().value >= msg.notify_value + ATH_TRANSFER_NOTIFY_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
        let sender_key: Int = self.compute_sender_key(msg.sender_owner);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, sender_key);
        throwUnless(14514, !self.pending_notifications.exists(pending_key));
        throwUnless(14515, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
        throwUnless(14516, !self.processed_notifications.exists(pending_key));

        self.balance += msg.amount;
        self.pending_notifications.set(pending_key, PendingAthTransferNotification {
            sender_owner: msg.sender_owner,
            amount: msg.amount,
            created_at: now()
        });

        message(MessageParameters {
            to: self.owner_address,
            value: msg.notify_value,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: AthTransferNotificationMintUsername {
                query_id: msg.query_id,
                sender_key: sender_key,
                amount: msg.amount,
                owner_wallet: msg.sender_owner,
                username_len: msg.username_len,
                username: msg.username
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
    }

    receive(msg: ATHInternalTransferProfileAvatar) {
        throwUnless(14620, msg.amount > 0);
        throwUnless(14621, sender() == self.derive_wallet_address(msg.sender_owner));
        throwUnless(14622, msg.notify_value > 0);
        throwUnless(14623, context().value >= msg.notify_value + ATH_TRANSFER_NOTIFY_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
        let sender_key: Int = self.compute_sender_key(msg.sender_owner);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, sender_key);
        throwUnless(14624, !self.pending_notifications.exists(pending_key));
        throwUnless(14625, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
        throwUnless(14626, !self.processed_notifications.exists(pending_key));

        self.balance += msg.amount;
        self.pending_notifications.set(pending_key, PendingAthTransferNotification {
            sender_owner: msg.sender_owner,
            amount: msg.amount,
            created_at: now()
        });

        message(MessageParameters {
            to: self.owner_address,
            value: msg.notify_value,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: AthTransferNotificationProfileAvatar {
                query_id: msg.query_id,
                sender_key: sender_key,
                amount: msg.amount,
                owner_wallet: msg.sender_owner,
                avatar_hash: msg.avatar_hash,
                avatar_entry_id: msg.avatar_entry_id,
                avatar_stream_id: msg.avatar_stream_id,
                avatar_part_count: msg.avatar_part_count,
                media_format: msg.media_format
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

    receive(msg: AthTransferNotificationAck) {
        throwUnless(14340, sender() == self.owner_address);
        throwUnless(14341, msg.amount > 0);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, msg.sender_key);
        let pendingOpt: PendingAthTransferNotification? = self.pending_notifications.get(pending_key);
        if (pendingOpt == null) {
            let prunedAmount: Int? = self.pruned_notification_acks.get(pending_key);
            throwUnless(14342, prunedAmount != null);
            throwUnless(14345, prunedAmount!! == msg.amount);
            return;
        }
        let pending: PendingAthTransferNotification = pendingOpt!!;
        throwUnless(14343, pending.amount == msg.amount);
        throwUnless(14344, self.compute_sender_key(pending.sender_owner) == msg.sender_key);
        self.processed_notifications.set(pending_key, msg.amount);
        self.pending_notifications.del(pending_key);
    }

    receive(msg: PruneStaleNotification) {
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, msg.sender_key);
        let pendingOpt: PendingAthTransferNotification? = self.pending_notifications.get(pending_key);
        throwUnless(14350, pendingOpt != null);
        let pending: PendingAthTransferNotification = pendingOpt!!;
        throwUnless(14351, self.compute_sender_key(pending.sender_owner) == msg.sender_key);
        throwUnless(14352, now() >= pending.created_at + ATH_PENDING_NOTIFICATION_TTL);
        self.processed_notifications.set(pending_key, pending.amount);
        self.pruned_notification_acks.set(pending_key, pending.amount);
        self.pending_notifications.del(pending_key);
    }

    bounced(msg: bounced<ATHInternalTransfer>) {
        self.restore_bounced_outgoing(msg.query_id, msg.amount);
    }

    bounced(msg: bounced<ATHInternalTransferWithNotify>) {
        self.restore_bounced_outgoing(msg.query_id, msg.amount);
    }

    bounced(msg: bounced<ATHInternalTransferMintUsername>) {
        self.restore_bounced_outgoing(msg.query_id, msg.amount);
    }

    bounced(msg: bounced<ATHInternalTransferProfileAvatar>) {
        self.restore_bounced_outgoing(msg.query_id, msg.amount);
    }

    bounced(msg: bounced<JettonInternalTransfer>) {
        self.restore_bounced_outgoing(msg.query_id, msg.amount);
    }

    bounced(msg: bounced<AthTransferNotification>) {
        throwUnless(14336, sender() == self.owner_address);
        self.refund_bounced_notification(msg.query_id, msg.sender_key, msg.amount);
    }

    bounced(msg: bounced<AthTransferNotificationMintUsername>) {
        throwUnless(14530, sender() == self.owner_address);
        self.refund_bounced_notification(msg.query_id, msg.sender_key, msg.amount);
    }

    bounced(msg: bounced<AthTransferNotificationProfileAvatar>) {
        throwUnless(14640, sender() == self.owner_address);
        self.refund_bounced_notification(msg.query_id, msg.sender_key, msg.amount);
    }

    get fun get_wallet_data(): ATHWalletDataView {
        return ATHWalletDataView {
            balance: self.balance,
            owner_address: self.owner_address,
            ath_master_address: self.ath_master_address
        };
    }

    get fun get_pending_notification(query_id: Int, sender_key: Int): PendingAthTransferNotificationView {
        let pending_key: Int = self.compute_pending_notification_key(query_id, sender_key);
        let pendingOpt: PendingAthTransferNotification? = self.pending_notifications.get(pending_key);
        if (pendingOpt == null) {
            return PendingAthTransferNotificationView {
                exists: false,
                sender_owner: self.owner_address,
                amount: 0,
                created_at: 0
            };
        }
        let pending: PendingAthTransferNotification = pendingOpt!!;
        return PendingAthTransferNotificationView {
            exists: true,
            sender_owner: pending.sender_owner,
            amount: pending.amount,
            created_at: pending.created_at
        };
    }

    receive() {
        // No fallback behavior. Empty inbound messages are rejected.
        throw(13000);
    }
}
