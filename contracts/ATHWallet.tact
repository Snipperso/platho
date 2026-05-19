// Platho v1 ATH Wallet implementation.
// Scope: deterministic wallet derivation, authenticated burn request forwarding,
// and owner-authorized bounce-safe ATH transfers.

const ATH_TRANSFER_NOTIFY_ACK_VALUE: Int = 1000000;
const ATH_TRANSFER_NOTIFY_MIN_VALUE: Int = 30000000;
const ATH_INTERNAL_TRANSFER_EXEC_RESERVE: Int = 2000000;
const ATH_BURN_NOTIFICATION_EXEC_RESERVE: Int = 2000000;
const ATH_TRANSFER_NOTIFY_EXEC_RESERVE: Int = 2000000;
const ATH_GENESIS_SUPPLY_EXEC_RESERVE: Int = 2000000;
const ATH_GENESIS_SUPPLY_ACK_VALUE: Int = 1000000;
const ATH_TRANSFER_NOTIFY_ID_DOMAIN: Int = 0x41544E49; // "ATNI"
const ATH_TRANSFER_NOTIFY_SENDER_KEY_MOD: Int = 4294967296;

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

struct ATHWalletDataView {
    balance: Int;
    owner_address: Address;
    ath_master_address: Address;
}

struct PendingAthTransferNotification {
    sender_owner: Address;
    amount: Int as uint128;
}

contract ATHWallet {
    balance: Int as uint128;
    owner_address: Address;
    ath_master_address: Address;
    pending_notifications: map<Int, PendingAthTransferNotification>;
    processed_notifications: map<Int, Int>;

    init(balance: Int, owner_address: Address, ath_master_address: Address) {
        self.balance = balance;
        self.owner_address = owner_address;
        self.ath_master_address = ath_master_address;
        self.pending_notifications = emptyMap();
        self.processed_notifications = emptyMap();
    }

    fun derive_wallet_address(owner: Address): Address {
        let owner_std: StdAddress = parseStdAddress(owner.asSlice());
        let wallet_init: StateInit = initOf ATHWallet(0, owner, self.ath_master_address);
        return contractAddressExt(owner_std.workchain, wallet_init.code, wallet_init.data);
    }

    fun compute_notification_id(sender_owner: Address, query_id: Int): Int {
        return beginCell()
            .storeUint(ATH_TRANSFER_NOTIFY_ID_DOMAIN, 32)
            .storeAddress(sender_owner)
            .storeUint(query_id, 64)
            .endCell()
            .hash();
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

    fun refund_bounced_notification(query_id: Int, sender_key: Int, amount: Int) {
        throwUnless(14330, amount > 0);
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

        send(SendParameters {
            to: refund_wallet,
            value: 0,
            bounce: true,
            mode: SendRemainingValue,
            code: refund_init.code,
            data: refund_init.data,
            body: ATHInternalTransfer {
                query_id: query_id,
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
        throwUnless(14006, context().value >= ATH_BURN_NOTIFICATION_EXEC_RESERVE);

        self.balance -= msg.amount;

        message(MessageParameters {
            to: self.ath_master_address,
            value: 0,
            mode: SendRemainingValue,
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
        throwUnless(14202, msg.amount > 0);
        throwUnless(14203, self.balance >= msg.amount);
        throwUnless(14204, context().value >= ATH_INTERNAL_TRANSFER_EXEC_RESERVE);

        self.balance -= msg.amount;

        let recipient_wallet: Address = self.derive_wallet_address(msg.recipient);
        let recipient_init: StateInit = initOf ATHWallet(0, msg.recipient, self.ath_master_address);

        send(SendParameters {
            to: recipient_wallet,
            value: 0,
            bounce: true,
            mode: SendRemainingValue,
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
        throwUnless(14303, msg.amount > 0);
        throwUnless(14304, msg.notify_value > 0);
        throwUnless(14305, self.balance >= msg.amount);
        throwUnless(14306, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
        throwUnless(14307, context().value >= msg.notify_value + ATH_TRANSFER_NOTIFY_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE);

        self.balance -= msg.amount;

        let recipient_wallet: Address = self.derive_wallet_address(msg.recipient);
        let recipient_init: StateInit = initOf ATHWallet(0, msg.recipient, self.ath_master_address);

        send(SendParameters {
            to: recipient_wallet,
            value: 0,
            bounce: true,
            mode: SendRemainingValue,
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
    }

    receive(msg: ATHTransferRequestMintUsername) {
        throwUnless(14500, sender() == self.owner_address);
        throwUnless(14501, msg.response_destination == self.owner_address);
        throwUnless(14502, msg.amount > 0);
        throwUnless(14503, msg.notify_value > 0);
        throwUnless(14504, self.balance >= msg.amount);
        throwUnless(14505, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
        throwUnless(14506, context().value >= msg.notify_value + ATH_TRANSFER_NOTIFY_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE);

        self.balance -= msg.amount;

        let recipient_wallet: Address = self.derive_wallet_address(msg.recipient);
        let recipient_init: StateInit = initOf ATHWallet(0, msg.recipient, self.ath_master_address);

        send(SendParameters {
            to: recipient_wallet,
            value: 0,
            bounce: true,
            mode: SendRemainingValue,
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
    }

    receive(msg: ATHInternalTransfer) {
        throwUnless(14210, msg.amount > 0);
        throwUnless(14211, sender() == self.derive_wallet_address(msg.sender_owner));
        throwUnless(14212, context().value >= ATH_INTERNAL_TRANSFER_EXEC_RESERVE);

        self.balance += msg.amount;

        message(MessageParameters {
            to: msg.response_destination,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: ATHTransferAck {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });
    }

    receive(msg: ATHInternalTransferWithNotify) {
        throwUnless(14310, msg.amount > 0);
        throwUnless(14311, sender() == self.derive_wallet_address(msg.sender_owner));
        throwUnless(14312, msg.notify_destination == self.owner_address);
        throwUnless(14313, msg.notify_value > 0);
        throwUnless(14314, context().value >= msg.notify_value + ATH_TRANSFER_NOTIFY_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE);
        let sender_key: Int = self.compute_sender_key(msg.sender_owner);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, sender_key);
        throwUnless(14315, !self.pending_notifications.exists(pending_key));
        throwUnless(14316, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
        let notification_id: Int = self.compute_notification_id(msg.sender_owner, msg.query_id);
        throwUnless(14317, !self.processed_notifications.exists(notification_id));

        self.balance += msg.amount;
        self.pending_notifications.set(pending_key, PendingAthTransferNotification {
            sender_owner: msg.sender_owner,
            amount: msg.amount
        });

        message(MessageParameters {
            to: msg.notify_destination,
            value: msg.notify_value,
            mode: SendDefaultMode,
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
    }

    receive(msg: ATHInternalTransferMintUsername) {
        throwUnless(14510, msg.amount > 0);
        throwUnless(14511, sender() == self.derive_wallet_address(msg.sender_owner));
        throwUnless(14512, msg.notify_value > 0);
        throwUnless(14513, context().value >= msg.notify_value + ATH_TRANSFER_NOTIFY_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE);
        let sender_key: Int = self.compute_sender_key(msg.sender_owner);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, sender_key);
        throwUnless(14514, !self.pending_notifications.exists(pending_key));
        throwUnless(14515, msg.notify_value >= ATH_TRANSFER_NOTIFY_MIN_VALUE);
        let notification_id: Int = self.compute_notification_id(msg.sender_owner, msg.query_id);
        throwUnless(14516, !self.processed_notifications.exists(notification_id));

        self.balance += msg.amount;
        self.pending_notifications.set(pending_key, PendingAthTransferNotification {
            sender_owner: msg.sender_owner,
            amount: msg.amount
        });

        message(MessageParameters {
            to: self.owner_address,
            value: msg.notify_value,
            mode: SendDefaultMode,
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
    }

    receive(msg: AthTransferNotificationAck) {
        throwUnless(14340, sender() == self.owner_address);
        throwUnless(14341, msg.amount > 0);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, msg.sender_key);
        let pendingOpt: PendingAthTransferNotification? = self.pending_notifications.get(pending_key);
        throwUnless(14342, pendingOpt != null);
        let pending: PendingAthTransferNotification = pendingOpt!!;
        throwUnless(14343, pending.amount == msg.amount);
        throwUnless(14344, self.compute_sender_key(pending.sender_owner) == msg.sender_key);
        let notification_id: Int = self.compute_notification_id(pending.sender_owner, msg.query_id);
        self.processed_notifications.set(notification_id, msg.amount);
        self.pending_notifications.del(pending_key);
    }

    bounced(msg: bounced<ATHInternalTransfer>) {
        throwUnless(14220, msg.amount > 0);
        self.balance += msg.amount;

        message(MessageParameters {
            to: self.owner_address,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: ATHTransferFailed {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });
    }

    bounced(msg: bounced<ATHInternalTransferWithNotify>) {
        throwUnless(14320, msg.amount > 0);
        self.balance += msg.amount;

        message(MessageParameters {
            to: self.owner_address,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: ATHTransferFailed {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });
    }

    bounced(msg: bounced<ATHInternalTransferMintUsername>) {
        throwUnless(14520, msg.amount > 0);
        self.balance += msg.amount;

        message(MessageParameters {
            to: self.owner_address,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: ATHTransferFailed {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });
    }

    bounced(msg: bounced<AthTransferNotification>) {
        self.refund_bounced_notification(msg.query_id, msg.sender_key, msg.amount);
    }

    bounced(msg: bounced<AthTransferNotificationMintUsername>) {
        self.refund_bounced_notification(msg.query_id, msg.sender_key, msg.amount);
    }

    get fun get_wallet_data(): ATHWalletDataView {
        return ATHWalletDataView {
            balance: self.balance,
            owner_address: self.owner_address,
            ath_master_address: self.ath_master_address
        };
    }

    receive() {
        // No fallback behavior. Empty inbound messages are rejected.
        throw(13000);
    }
}
