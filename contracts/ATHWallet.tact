// Platho v1 ATH Wallet implementation.
// Scope: deterministic wallet derivation, authenticated burn request forwarding,
// and owner-authorized bounce-safe ATH transfers.

const ATH_TRANSFER_NOTIFY_ACK_VALUE: Int = 1000000;
const ATH_REGISTRY_RESPONSE_ACK_VALUE: Int = 3000000;
const ATH_INTERNAL_TRANSFER_ACK_VALUE: Int = 3000000;
const ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE: Int = 1000000;
const ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE: Int = 21000000;
const ATH_REGISTRY_PROFILE_AVATAR_FWD_FEE_ALLOWANCE: Int = 2000000;
// [MEASURED 2026-07-20, raised 30M -> 45M] This floor is what keeps a REFUSED registry purchase refundable.
// When a registry throws, the notification bounces and the ATH goes home as an ATHInternalTransfer funded by
// SendRemainingValue out of what bounced — and the payer's own wallet gates that arrival at 14212 (2M + 3M + 1M +
// 20M = 26M). The sender-side gate on the same money, 14335, only demands 12M, so between the two there is a
// window where the refund is SENT, arrives under-funded, throws, and the buyer's ATH is stranded on the
// registry's official wallet. Immutable after seal, so the floor has to be measured, not modelled.
//
// Measured (tests/ath-notify-refund-floor.test.ts), refusal overhead deducted from notify_value before arrival:
//     30,000,000 -> arrives 24,037,796  => BELOW 26M: refund throws 14212, ATH stranded
//     empty registry   overhead 6,236,737
//     200 profiles     overhead 6,336,737
//     800 profiles     overhead 6,383,404
// The refusing transaction's gas is paid out of the notification, and dictionary gas grows with DEPTH, so the
// overhead rises as the product grows: ~+46,667 per doubling at the 800-profile point, i.e. ~6.9M extrapolated at
// a million profiles. A floor calibrated on an empty registry would decay into the stranding window silently,
// years after the seal. 45M leaves ~38M on arrival against the 26M gate (~1.47x) and tolerates the refusal
// overhead nearly TRIPLING before anyone loses money.
const ATH_TRANSFER_NOTIFY_MIN_VALUE: Int = 45000000;
// [COMMENT CORRECTED 2026-07-19] This used to be justified as rent for one `processed_notifications` entry — the
// permanent replay tombstone, which was DELETED (see the state declaration below for why). What still justifies it
// is the RECIPIENT wallet's own rent: an inbound transfer may DEPLOY that wallet (1 + code + data cells, paying
// rent forever), and this endowment is the only thing funding it. The value is deliberately left unchanged here:
// re-sizing it means measuring a wallet account's real storage phase, which is its own job, and it feeds gate
// 14212 above — lowering it without that measurement would under-fund every freshly deployed wallet.
const ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT: Int = 20000000;
const ATH_INTERNAL_TRANSFER_EXEC_RESERVE: Int = 2000000;
const ATH_BURN_NOTIFICATION_EXEC_RESERVE: Int = 2000000;
const ATH_TRANSFER_NOTIFY_EXEC_RESERVE: Int = 7000000;
const ATH_PRUNE_NOTIFICATION_EXEC_RESERVE: Int = 2000000;
const ATH_OWNER_REQUEST_EXEC_RESERVE: Int = 2000000;
const ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE: Int = 10000000;
const ATH_OWNER_EXCESS_REFUND_MIN_VALUE: Int = 100000;
const ATH_GENESIS_SUPPLY_EXEC_RESERVE: Int = 2000000;
const ATH_GENESIS_SUPPLY_ACK_VALUE: Int = 1000000;
const ATH_TRANSFER_NOTIFY_ID_DOMAIN: Int = 0x41544E49; // "ATNI"
const ATH_OUTGOING_TRANSFER_ID_DOMAIN: Int = 0x41544F47; // "ATOG"
const ATH_NOTIFY_REFUND_QUERY_DOMAIN: Int = 0x41545246; // "ATRF"
const ATH_QUERY_ID_MOD: Int = 18446744073709551616;
const ATH_SENDER_KEY_MOD: Int = 1461501637330902918203684832716283019655932542976; // 2^160
const ATH_PENDING_NOTIFICATION_TTL: Int = 86400; // 24 hours — plain lane
// [OWNER DECISION 2026-07-19] The registry lanes (username mint / profile avatar) used to be UNPRUNABLE outright:
// gate 14353 refused any prune of a pending carrying the registry marker, at any age, forever. That handed anyone a
// permanent griefing primitive — measured, a stuck pending costs 3 cells, so ~21,845 of them fill an ordinary
// user's ATH wallet to the account ceiling for about 1333 GRAM, after which every write to that wallet fails
// SILENTLY (compute exit 0, ACTION code 50) and the user can never buy a name, set a paid avatar, or receive ATH
// again. Immutable, so unfixable after seal.
//
// A TTL closes it without giving up what 14353 was protecting. The danger of pruning is pruning a LIVE pending: the
// balance is credited on the inbound message, so if the entry disappears before the registry settles, the buyer has
// paid and the mint never completes. A legitimate settlement — the registry acking, or refusing and refunding —
// happens within seconds. A week is six orders of magnitude of headroom over that, while still making the attack
// something the attacker must pay for again every week instead of once forever.
const ATH_REGISTRY_PENDING_TTL: Int = 604800; // 7 days — registry lanes, deliberately far longer than the plain one
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

// Official username ATH wallet -> UsernameRegistry for a registry-funded username mint. payer_wallet is stamped by
// the official ATH wallet from the real payer's derived address, owner_wallet is the wallet receiving the NFT.
// (Named "Vault" until 2026-07-19: this lane predates the Vault's cancellation and the registries took the role.)
// [§4c 2026-07-23] username is a `Cell` (a dedicated ref), NOT `Slice as remaining` like its 0x4154481C/1D
// siblings. Those siblings carry >1023 fixed bits, so Tact auto-spills the trailing remaining-slice into a fresh
// cell and a 16-char name fits. THIS message's fixed part is only 926 bits (op32+query_id64+sender_key160+
// amount128+payer267+owner267+len8), leaving 97 inline bits = 12 chars; a 13..16-char name (all sold at full
// price) overflowed the 1023-bit cell → exit 8 when the wallet built the notification. A `Cell` field is always a
// ref, so the name now lives in its own cell (name bytes only, still FLAT — UsernameRegistry.isValidUsernameBytes
// parses it and requires refsEmpty + bits==len*8). Root = 926 bits + 1 ref; fits any name up to 127 chars.
message(0x89129D60) AthTransferNotificationRegistryMintUsername {
    query_id: Int as uint64;
    sender_key: Int as uint160;
    amount: Int as uint128;
    payer_wallet: Address;
    owner_wallet: Address;
    username_len: Int as uint8;
    username: Cell;
}

// Official profile ATH wallet -> ProfileRegistry for a registry-funded profile avatar. payer_wallet is stamped by
// the official ATH wallet from the real payer's derived address, owner_wallet is the wallet whose public avatar
// pointer is being updated.
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

message(0x41544807) ATHWalletTopUpStorageReserve {} // "ATH"+0x07 — F11/#2: no-authority storage-reserve top-up

// TEP-74 standard get_wallet_data shape: positional 4-tuple {int balance, slice owner, slice jetton_master,
// cell jetton_wallet_code}. The 4th field (jetton_wallet_code) is what indexers (tonapi) + wallets (Tonkeeper)
// require to classify this as a jetton wallet and read the balance — clean-11 omitted it (3-tuple) → invisible.
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
    // [DELETED 2026-07-19: processed_notifications, the permanent replay tombstone. DO NOT RESTORE IT.]
    //
    // It was one permanent map entry per inbound notification, with ZERO `.del` anywhere in this contract, on an
    // account that is a SINGLETON for its owner — a jetton wallet is one per (owner, master) by TEP-74 and cannot be
    // sharded. Measured: 3.00 cells/entry => ~21,845 inbound notifications, ever, then the ~65536-cell account
    // ceiling is hit and writes fail SILENTLY (compute exit 0, ACTION code 50, wallet reports success). Since a
    // .ath name and a paid avatar are both bought with ATH and land on the registry's ONE official wallet, that
    // capped usernames and profiles at ~21,845 for the whole product, against a million-user target, forever.
    //
    // IT NEVER PROTECTED THE BALANCE, which is why deleting it is safe rather than a trade:
    //   1. `derive_wallet_address` returns contractAddressExt(workchain, code, data) — the address IS the hash of
    //      code+data, so gate 14311/14561/14661 proves the sender runs THIS EXACT bytecode. A forged sender wallet
    //      cannot exist.
    //   2. That same bytecode debits before sending and restores only via bounce, where the pending key is `.del`ed,
    //      so a restore happens exactly once. Every credit is therefore backed by exactly one debit.
    //   3. The credit happens on the INBOUND message; the tombstone was written LATER, on the ack. It could not
    //      guard money that had already moved.
    //   4. The one reachable double-processing window — a duplicate arriving while the first is still pending — is
    //      closed by 14315/14565/14665, which are untouched.
    // Replay safety now lives on the SEMANTIC key at the consumer, which is both stronger and the pattern this
    // contract already uses: the TEP-74 lane below (`JettonInternalTransfer`) has never written a tombstone, and
    // says so explicitly.
    //   * UsernameRegistry rejects a repeat by name_hash. [UPDATED 2026-07-20 — this used to name gates
    //     19172/19173, and 19172 no longer exists: the registry's name_records map was deleted (it was that
    //     contract's ~21,500-name ceiling, the same disease as this tombstone). The property is unchanged and the
    //     refusal simply moved to the contract that always owned it — the per-name UsernameNFTItem refuses
    //     re-initialisation at its own gate 18011, the message bounces, and the buyer's ATH is refunded. 19173
    //     still guards an in-flight duplicate.]
    //   * ProfileRegistry rejects a repeat of the current avatar pointer at 21115, added in the same change
    //     because it had no guard at all.
    //
    // Residual, and it is NARROWER than this note first claimed. "A resend with the same query_id is paid for by
    // a SECOND debit, so it is a second genuine purchase" holds only where the consumer's semantic key produces a
    // REFUSAL — which is the registry lanes above, both of which refund. It does NOT hold for a consumer that
    // dedupes silently and answers ACK: there the second debit buys nothing and the ATH is stranded on the
    // recipient's official wallet, credited to no one.
    // MEASURED (tests/vault-ath-integration.test.ts VAULT-ATH-04): a replayed deposit query_id leaves the payer
    // 700 units short, parks them on the official wallet, and the Vault credits 1,000 — because the Vault dedupes
    // on its own ledger and replies ACK instead of refunding. That is a real loss on the VAULT lane, and it is one
    // more reason Vault must actually leave the clean-17 deploy set rather than merely be called cancelled while
    // the scripts still deploy it. Any future consumer of this notification must REFUND a duplicate, not ACK it.
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
            // clean-12 Lane A (standard TEP-74): fire-and-forget standard JettonTransferNotification, NO custom
            // escrow/tombstone. Replay-safety now lives in each consumer's OWN idempotency map (Vault
            // processed_ath_deposits, BuybackBurn phase+query_id, MSS supply-cap). The forward_payload passes
            // through VERBATIM (Slice as remaining) so DEX routers' swap/LP ops inside it are bit-preserved.
            // Guard = forwarded notify value + the source-ack (still sent below) + exec reserve.
            throwUnless(14714, context().value >= msg.forward_ton_amount + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE);

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
        let sender_key: Int = self.compute_sender_key(msg.query_id, msg.sender_owner);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, sender_key);
        // [14315 IS THE BALANCE GUARD, AND IT STAYS.] It blocks a duplicate while the first is still in flight —
        // the only reachable double-processing window. The permanent tombstone that used to sit beside it (14317)
        // was DELETED 2026-07-19; see the state declaration for why it never protected the balance.
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
    }

    receive(msg: ATHInternalTransferRegistryMintUsername) {
        throwUnless(14560, msg.amount > 0);
        throwUnless(14561, sender() == self.derive_wallet_address(msg.sender_owner));
        throwUnless(14562, msg.notify_value > 0);
        throwUnless(14563, context().value >= msg.notify_value + ATH_REGISTRY_RESPONSE_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
        throwUnless(14564, self.is_basechain_address(msg.owner_wallet));
        let sender_key: Int = self.compute_sender_key(msg.query_id, msg.sender_owner);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, sender_key);
        // 14565 is this lane's in-flight guard (see 14315). Its permanent-tombstone twin (14567) was deleted
        // 2026-07-19; the username lane's replay guard is UsernameRegistry's own name_hash check (19172/19173),
        // which is strictly stronger because it keys on WHAT was bought rather than on a message id.
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
                // Wrap the inbound remaining-slice name into its own ref cell (see the message decl for why).
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
    }

    receive(msg: ATHInternalTransferRegistryProfileAvatar) {
        throwUnless(14660, msg.amount > 0);
        throwUnless(14661, sender() == self.derive_wallet_address(msg.sender_owner));
        throwUnless(14662, msg.notify_value > 0);
        throwUnless(14663, context().value >= msg.notify_value + ATH_REGISTRY_RESPONSE_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);
        throwUnless(14664, self.is_basechain_address(msg.owner_wallet));
        let sender_key: Int = self.compute_sender_key(msg.query_id, msg.sender_owner);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, sender_key);
        // 14665 is this lane's in-flight guard (see 14315). Its permanent-tombstone twin (14667) was deleted
        // 2026-07-19. NOTE: unlike the username lane, ProfileRegistry carries NO replay guard of its own, so the
        // avatar lane's protection now rests entirely on the pointer gate added there in the same change.
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
            // A LATE OR DUPLICATE ACK IS A TOLERATED NO-OP, and that property is load-bearing: the owner is a
            // registry, and a registry that acks twice (or acks after a prune) must not have its message bounce.
            // This branch used to prove the ack matched a TOMBSTONE (14342/14345). With the tombstone gone there is
            // nothing left to prove and nothing to do — this handler moves NO money, it only clears the pending
            // entry and forwards a response ack, and with no pending there is neither. Returning quietly is the
            // whole correct behaviour. Note 14340 above already restricts this receiver to the owner, so a stranger
            // cannot reach it at all.
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
        self.refund_pending_notification(msg.query_id, msg.sender_key, msg.amount);
    }

    receive(msg: PruneStaleNotification) {
        throwUnless(14349, context().value >= ATH_PRUNE_NOTIFICATION_EXEC_RESERVE);
        let pending_key: Int = self.compute_pending_notification_key(msg.query_id, msg.sender_key);
        let pendingOpt: PendingAthTransferNotification? = self.pending_notifications.get(pending_key);
        throwUnless(14350, pendingOpt != null);
        let pending: PendingAthTransferNotification = pendingOpt!!;
        throwUnless(14351, self.compute_sender_key(msg.query_id, pending.sender_owner) == msg.sender_key);
        // The registry lanes get a LONGER age requirement, not an exemption. 14353 used to sit here and refuse them
        // outright — see ATH_REGISTRY_PENDING_TTL for why that had to go and what the week is protecting.
        let ttl: Int = pending.response_ack_value == ATH_REGISTRY_RESPONSE_ACK_VALUE
            ? ATH_REGISTRY_PENDING_TTL
            : ATH_PENDING_NOTIFICATION_TTL;
        throwUnless(14352, now() >= pending.created_at + ttl);
        // Pruning now genuinely FREES the entry. It used to convert pending into a permanent tombstone, so the
        // "prune" only moved the cost from one map to another that could never be reclaimed — the stale entry was
        // cleared and the account grew anyway. With the tombstone gone this is a real reclaim.
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
        // F11/#2: accept TON for storage reserve ONLY (no balance credit, no auth, no state change). Lets the
        // monotonic processed_notifications replay-tombstone on the ECOSYSTEM wallets (Vault / treasury /
        // UsernameRegistry / ProfileRegistry official ATH wallets, which write it) be externally funded, so a
        // config-18 storage-price rise over the 100yr horizon cannot bleed them below the rent floor with no way to
        // replenish. Standard user-to-user wallets never write that map, so their custody is unaffected either way.
        // Mirrors the no-authority top-up already on CapsuleHub / ATHVesting / BuybackBurn / MarketStabilitySeller.
    }

    receive() {
        // No fallback behavior. Empty inbound messages are rejected.
        throw(13000);
    }
}
