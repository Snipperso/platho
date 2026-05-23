// Platho v1 Vault milestone 1 implementation.
// Scope: UserState, TON deposit/withdraw, wallet-funded publish, KeyRecord/key_generation lifecycle.
// Includes wallet publish to CapsuleHub with PendingPublish ACK/bounce recovery.
// Includes pre-seal official ATH wallet binding to avoid self-address StateInit circularity.
// No admin/owner override/pause/upgrade/governance/rescue/fallback behavior is implemented.

import "./ATHWallet.tact";

const VAULT_USER_STATE_STORAGE_ENDOWMENT: Int = 10000000;
const VAULT_KEY_RECORD_STANDARD_STORAGE_ENDOWMENT: Int = 5000000;
const VAULT_KEY_RECORD_LONG_TERM_STORAGE_ENDOWMENT: Int = 30000000;
const VAULT_RECEIVE_INTENT_STORAGE_ENDOWMENT: Int = 5000000;
const VAULT_PENDING_PUBLISH_STORAGE_ENDOWMENT: Int = 3000000;
const VAULT_PENDING_PUBLISH_STALE_TTL: Int = 86400; // 24 hours
const VAULT_PRUNED_PUBLISH_TOMBSTONE_TTL: Int = 86400; // 24 hours after prune
const VAULT_DEPOSIT_TON_EXEC_RESERVE: Int = 2000000;
const VAULT_STATE_GROWTH_EXEC_RESERVE: Int = 2000000;
const VAULT_ATH_NOTIFICATION_ACK_VALUE: Int = 1000000;
const VAULT_ATH_WITHDRAW_MIN_VALUE: Int = 30000000;
const VAULT_WITHDRAW_TON_EXEC_RESERVE: Int = 2000000;
const VAULT_ATH_WITHDRAW_REFUND_EXEC_RESERVE: Int = 2000000;
const VAULT_PRUNE_PENDING_PUBLISH_EXEC_RESERVE: Int = 2000000;
const ASSET_TON: Int = 1;
const ASSET_ATH: Int = 2;
const RECEIVE_INTENT_ID_DOMAIN: Int = 0x52434944; // "RCID"
const RECEIVE_INTENT_COMMITMENT_DOMAIN: Int = 0x5243434d; // "RCCM"
const CRYPTO_SUITE_CLASSICAL: Int = 1;
const CRYPTO_SUITE_HYBRID: Int = 2;
const MLKEM768_PUBKEY_LEN: Int = 1184;
const MLKEM768_PUBKEY_SNAKE_CHUNK_BYTES: Int = 127;
const MLKEM768_PUBKEY_SNAKE_FIRST_CHUNK_BYTES: Int = 41;
const MLKEM768_PUBKEY_SNAKE_CELLS: Int = 10;
const MLKEM768_PUBKEY_SNAKE_BITS: Int = 9472;
const MLKEM768_PUBKEY_SNAKE_REFS: Int = 9;
const UINT64_MAX: Int = 18446744073709551615;
const UINT64_MOD: Int = 18446744073709551616;
const UINT32_MAX: Int = 4294967295;
const ATH_DEPOSIT_ID_DOMAIN: Int = 0x41445049; // "ADPI"
const ATH_WITHDRAWAL_ID_DOMAIN: Int = 0x41574944; // "AWID"
const KEY_ID_DOMAIN: Int = 0x4b455949; // "KEYI"
const OP_PUBLISH_PRIVATE_BY_WALLET: Int = 0x686694C6;
const OP_PUBLISH_PUBLIC_BY_WALLET: Int = 0x900EC906;
const PUBLISH_KIND_PRIVATE: Int = 1;
const PUBLISH_KIND_PUBLIC: Int = 2;
const SIZE_CLASS_STANDARD: Int = 1;
const SIZE_CLASS_LONG_TERM: Int = 2;
const CRYPTO_SUITE_PUBLIC_NONE: Int = 0;
const PLATO_PRIVATE_STANDARD_FEE_TON: Int = 5000000;
const PLATO_PRIVATE_LONG_TERM_FEE_TON: Int = 10000000;
const PLATO_PUBLIC_POST_FEE_TON: Int = 5000000;
const PLATHO_PUBLIC_MARKETING_NOTE_ASCII: Int = 0x73656e742076696120506c6174686f2e417070; // "sent via Platho.App"
const ATH_FULL_DISCOUNT_AMOUNT: Int = 10000000000000;
const VAULT_ACTIVITY_AIRDROP_TOTAL_ATH: Int = 30000000000000000;
const VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH: Int = 10000000000;
const VAULT_PUBLISH_LOCAL_EXEC_RESERVE: Int = 6000000;
const VAULT_PENDING_PUBLISH_REFUND_EXEC_RESERVE: Int = 2000000;
const CAPSULEHUB_PRIVATE_STANDARD_EXEC_RESERVE: Int = 3000000;
const CAPSULEHUB_PRIVATE_LONG_TERM_EXEC_RESERVE: Int = 4000000;
const CAPSULEHUB_PUBLIC_EXEC_RESERVE: Int = 3000000;
const CAPSULEHUB_PRIVATE_STANDARD_STORAGE_KEEPALIVE_RESERVE: Int = 1000000;
const CAPSULEHUB_PRIVATE_LONG_TERM_STORAGE_KEEPALIVE_RESERVE: Int = 1000000;
const CAPSULEHUB_PUBLIC_STORAGE_KEEPALIVE_RESERVE: Int = 1000000;
const CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT: Int = 4000000;
const CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT: Int = 1000000;
const CAPSULEHUB_ACK_FORWARD_RESERVE: Int = 30000000;
const OP_BIND_DEPLOYMENT_MANIFEST: Int = 0x90E2E0CB;
const OP_BIND_OFFICIAL_ATH_WALLET: Int = 0x18DB2CCB;
const OP_SEAL_GENESIS: Int = 0x3A12D1AD;


message(0x90E2E0CB) BindDeploymentManifest {
    deployment_manifest_hash: Int as uint256;
    counterpart_address: Address;
}

message(0x18DB2CCB) BindOfficialAthWallet {
    deployment_manifest_hash: Int as uint256;
    official_ath_wallet_address: Address;
}

message(0x3A12D1AD) SealGenesis {
    deployment_manifest_hash: Int as uint256;
}

message(0x2AAFBD98) DepositTon {
    amount: Int as uint128;
}

message(0x484C1D72) WithdrawTon {
    amount: Int as uint128;
    recipient: Address;
}

message(0xF9A44834) WithdrawAth {
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
}

message(0x52705EDA) RegisterMessagingKeys {
    enc_pubkey: Int as uint256;
    sign_pubkey: Int as uint256;
    pq_kem_pubkey_hash: Int as uint256;
    pq_kem_pubkey_len: Int as uint16;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: Int as uint16;
}

message(0x89D648BB) ReplaceMessagingKeys {
    enc_pubkey: Int as uint256;
    sign_pubkey: Int as uint256;
    pq_kem_pubkey_hash: Int as uint256;
    pq_kem_pubkey_len: Int as uint16;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: Int as uint16;
}

message(0xF780F913) CreateReceiveIntent {
    asset: Int as uint8;
    amount: Int as uint128;
    recipient_wallet: Address;
    commitment: Int as uint256;
    client_nonce: Int as uint64;
}

message(0x99ECCCFC) ClaimReceiveIntent {
    intent_id: Int as uint256;
    secret32: Int as uint256;
}

message(0x32289374) CancelReceiveIntent {
    intent_id: Int as uint256;
}

message(0x686694C6) PublishPrivateFromWallet {
    client_nonce: Int as uint64;
    max_charge: Int as uint128;
    size_class: Int as uint8;
    crypto_suite: Int as uint8;
    header_0_hash: Int as uint256;
    header_1_hash: Int as uint256;
    body_hash: Int as uint256;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
}

message(0x900EC906) PublishPublicFromWallet {
    client_nonce: Int as uint64;
    max_charge: Int as uint128;
    header_hash: Int as uint256;
    body_hash: Int as uint256;
    header: Cell;
    body: Cell;
}

message(0xA4F862C0) PublishPrivateFromVault {
    bounce_id: Int as uint64;
    publish_id: Int as uint256;
    size_class: Int as uint8;
    crypto_suite: Int as uint8;
    header_0_hash: Int as uint256;
    header_1_hash: Int as uint256;
    body_hash: Int as uint256;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
    protocol_fee_paid: Int as uint128;
}

message(0x8C2A76B7) PublishPublicFromVault {
    bounce_id: Int as uint64;
    publish_id: Int as uint256;
    marketing_note: Int as uint152;
    author_wallet: Address;
    header_hash: Int as uint256;
    body_hash: Int as uint256;
    header: Cell;
    body: Cell;
    protocol_fee_paid: Int as uint128;
}

message(0x874E576A) CapsuleHubPublishAck {
    publish_id: Int as uint256;
    entry_id: Int as uint64;
    entry_uid: Int as uint256;
}

message(0x720BDD6D) PrunePendingPublish {
    publish_id: Int as uint256;
}

message(0x3215B5FD) TopUpStorageReserve {}


struct PendingAthWithdrawal {
    owner_wallet: Address;
    recipient: Address;
    recipient_ath_wallet: Address;
    amount: Int as uint128;
    refundable_ton_amount: Int as uint128;
    created_at: Int as uint32;
}

struct PendingPublish {
    owner_wallet: Address;
    tombstone: Bool;
    nonce: Int as uint64;
    publish_kind: Int as uint8;
    body_hash: Int as uint256;
    refundable_amount: Int as uint128;
    created_at: Int as uint32;
}

struct ReceiveIntent {
    sender_wallet: Address;
    recipient_wallet: Address;
    asset: Int as uint8;
    amount: Int as uint128;
    commitment: Int as uint256;
    client_nonce: Int as uint64;
    created_at: Int as uint32;
    claimed: Bool;
}

struct KeyRecord {
    owner_wallet: Address;
    key_generation: Int as uint32;
    enc_pubkey: Int as uint256;
    sign_pubkey: Int as uint256;
    pq_kem_pubkey_hash: Int as uint256;
    pq_kem_pubkey_len: Int as uint16;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: Int as uint16;
    created_at: Int as uint32;
    created_lt: Int as uint64;
    revoked_at: Int as uint32;
    revoked_lt: Int as uint64;
}

struct UserState {
    ton_balance: Int as uint128;
    ath_balance: Int as uint128;
    current_key_id: Int as uint256;
}


struct VaultReceiveIntentView {
    exists: Bool;
    sender_wallet: Address;
    recipient_wallet: Address;
    asset: Int;
    amount: Int;
    commitment: Int;
    client_nonce: Int;
    created_at: Int;
    claimed: Bool;
}

struct VaultKeyRecordView {
    exists: Bool;
    owner_wallet: Address;
    key_generation: Int;
    enc_pubkey: Int;
    sign_pubkey: Int;
    pq_kem_pubkey_hash: Int;
    pq_kem_pubkey_len: Int;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: Int;
    created_at: Int;
    created_lt: Int;
    revoked_at: Int;
    revoked_lt: Int;
}

struct VaultUserView {
    exists: Bool;
    ton_balance: Int;
    ath_balance: Int;
    current_key_id: Int;
}

struct VaultPendingAthWithdrawalView {
    exists: Bool;
    owner_wallet: Address;
    recipient: Address;
    recipient_ath_wallet: Address;
    amount: Int;
    created_at: Int;
}

struct VaultGlobalView {
    sealed: Bool;
    capsule_hub_bound: Bool;
    deployment_manifest_hash: Int;
    capsule_hub_address: Address;
    vault_ath_wallet_address: Address;
    ath_master_address: Address;
    user_count: Int;
    key_record_count: Int;
    receive_intent_count: Int;
    pending_ath_withdrawal_count: Int;
    pending_publish_count: Int;
    processed_ath_deposit_count: Int;
    pending_publish_stale_ttl: Int;
    airdrop_remaining_ath: Int;
    airdrop_distributed_ath: Int;
    airdrop_reward_per_message_ath: Int;
    airdrop_total_allocation_ath: Int;
}

contract Vault {
    vault_ath_wallet_address: Address;
    ath_master_address: Address;
    capsule_hub_address: Address;
    capsule_hub_bound: Bool;
    sealed: Bool;
    deployment_manifest_hash: Int as uint256;
    // Pre-seal: hash(genesis_controller_address). Post-seal: remaining community activity airdrop ATH.
    // The canonical sealed signing/deployment domain is deployment_manifest_hash.
    genesis_config_hash: Int as uint256;
    users: map<Address, UserState>;
    key_records: map<Int, KeyRecord>;
    receive_intents: map<Int, ReceiveIntent>;
    processed_ath_deposits: map<Int, Int>;
    pending_ath_withdrawals: map<Int, PendingAthWithdrawal>;
    pending_publishes: map<Int, PendingPublish>;
    user_count: Int as uint64;
    key_record_count: Int as uint64;
    receive_intent_count: Int as uint64;
    processed_ath_deposit_count: Int as uint64;
    pending_ath_withdrawal_count: Int as uint64;
    pending_publish_count: Int as uint64;

    init(vault_ath_wallet_address: Address, ath_master_address: Address, capsule_hub_address: Address, genesis_config_hash: Int, capsule_hub_bound: Bool, sealed: Bool, deployment_manifest_hash: Int) {
        self.vault_ath_wallet_address = vault_ath_wallet_address;
        self.ath_master_address = ath_master_address;
        self.capsule_hub_address = capsule_hub_address;
        self.capsule_hub_bound = capsule_hub_bound;
        self.sealed = sealed;
        self.deployment_manifest_hash = deployment_manifest_hash;
        self.genesis_config_hash = genesis_config_hash;
        if (sealed) {
            if (self.deployment_manifest_hash == 0) {
                self.deployment_manifest_hash = genesis_config_hash;
            }
            self.genesis_config_hash = VAULT_ACTIVITY_AIRDROP_TOTAL_ATH;
        }
        self.users = emptyMap();
        self.key_records = emptyMap();
        self.receive_intents = emptyMap();
        self.processed_ath_deposits = emptyMap();
        self.pending_ath_withdrawals = emptyMap();
        self.pending_publishes = emptyMap();
        self.user_count = 0;
        self.key_record_count = 0;
        self.receive_intent_count = 0;
        self.processed_ath_deposit_count = 0;
        self.pending_ath_withdrawal_count = 0;
        self.pending_publish_count = 0;
    }

    fun requireSealed() {
        throwUnless(15000, self.sealed);
    }

    fun requireUnsealed() {
        throwUnless(15001, !self.sealed);
    }

    fun requireGenesisController() {
        throwUnless(15030, self.genesis_config_hash != 0);
        throwUnless(15031, beginCell().storeAddress(sender()).endCell().hash() == self.genesis_config_hash);
    }

    fun emptyUser(): UserState {
        return UserState {
            ton_balance: 0,
            ath_balance: 0,
            current_key_id: 0
        };
    }

    fun getUserOrEmpty(owner: Address): UserState {
        let value: UserState? = self.users.get(owner);
        if (value == null) {
            return self.emptyUser();
        }
        return value!!;
    }

    fun deriveAthWalletAddress(owner: Address): Address {
        let owner_std: StdAddress = parseStdAddress(owner.asSlice());
        let wallet_init: StateInit = initOf ATHWallet(0, owner, self.ath_master_address);
        return contractAddressExt(owner_std.workchain, wallet_init.code, wallet_init.data);
    }

    fun isBasechainAddress(owner: Address): Bool {
        let owner_std: StdAddress = parseStdAddress(owner.asSlice());
        return owner_std.workchain == 0;
    }

    fun computeAthDepositId(senderWallet: Address, queryId: Int): Int {
        return beginCell()
            .storeUint(ATH_DEPOSIT_ID_DOMAIN, 32)
            .storeAddress(senderWallet)
            .storeUint(queryId, 64)
            .endCell()
            .hash();
    }

    fun computeAthWithdrawalId(ownerWallet: Address, queryId: Int): Int {
        return beginCell()
            .storeUint(ATH_WITHDRAWAL_ID_DOMAIN, 32)
            .storeAddress(ownerWallet)
            .storeUint(queryId, 64)
            .endCell()
            .hash() % UINT64_MOD;
    }


    fun discountedFee(owner: Address, fullFee: Int): Int {
        let user: UserState = self.getUserOrEmpty(owner);
        if (user.ath_balance >= ATH_FULL_DISCOUNT_AMOUNT) {
            return 0;
        }
        let remaining: Int = ATH_FULL_DISCOUNT_AMOUNT - user.ath_balance;
        return ((fullFee * remaining) + ATH_FULL_DISCOUNT_AMOUNT - 1) / ATH_FULL_DISCOUNT_AMOUNT;
    }

    fun isPublishProfileValid(op: Int, publishKind: Int, sizeClass: Int, cryptoSuite: Int, header0: Int, header1: Int): Bool {
        if (op == OP_PUBLISH_PRIVATE_BY_WALLET) {
            if (publishKind != PUBLISH_KIND_PRIVATE) { return false; }
            if (header0 == 0) { return false; }
            if (header1 == 0) { return false; }
            if (sizeClass == SIZE_CLASS_STANDARD) {
                return cryptoSuite == CRYPTO_SUITE_CLASSICAL;
            }
            if (sizeClass == SIZE_CLASS_LONG_TERM) {
                return cryptoSuite == CRYPTO_SUITE_HYBRID;
            }
            return false;
        }
        if (op == OP_PUBLISH_PUBLIC_BY_WALLET) {
            if (publishKind != PUBLISH_KIND_PUBLIC) { return false; }
            if (sizeClass != SIZE_CLASS_STANDARD) { return false; }
            if (cryptoSuite != CRYPTO_SUITE_PUBLIC_NONE) { return false; }
            if (header0 == 0) { return false; }
            if (header1 != 0) { return false; }
            return true;
        }
        return false;
    }

    fun canonicalPublishMaxCharge(owner: Address, publishKind: Int, sizeClass: Int, cryptoSuite: Int): Int {
        if (publishKind == PUBLISH_KIND_PUBLIC) {
            throwUnless(16320, sizeClass == SIZE_CLASS_STANDARD);
            throwUnless(16321, cryptoSuite == CRYPTO_SUITE_PUBLIC_NONE);
            return VAULT_PUBLISH_LOCAL_EXEC_RESERVE
                + self.discountedFee(owner, PLATO_PUBLIC_POST_FEE_TON)
                + CAPSULEHUB_PUBLIC_EXEC_RESERVE
                + CAPSULEHUB_PUBLIC_STORAGE_KEEPALIVE_RESERVE
                + CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT
                + CAPSULEHUB_ACK_FORWARD_RESERVE;
        }
        throwUnless(16322, publishKind == PUBLISH_KIND_PRIVATE);
        if (sizeClass == SIZE_CLASS_STANDARD) {
            throwUnless(16323, cryptoSuite == CRYPTO_SUITE_CLASSICAL);
            return VAULT_PUBLISH_LOCAL_EXEC_RESERVE
                + self.discountedFee(owner, PLATO_PRIVATE_STANDARD_FEE_TON)
                + CAPSULEHUB_PRIVATE_STANDARD_EXEC_RESERVE
                + CAPSULEHUB_PRIVATE_STANDARD_STORAGE_KEEPALIVE_RESERVE
                + CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT
                + CAPSULEHUB_ACK_FORWARD_RESERVE;
        }
        throwUnless(16324, sizeClass == SIZE_CLASS_LONG_TERM);
        throwUnless(16325, cryptoSuite == CRYPTO_SUITE_HYBRID);
        return VAULT_PUBLISH_LOCAL_EXEC_RESERVE
            + self.discountedFee(owner, PLATO_PRIVATE_LONG_TERM_FEE_TON)
            + CAPSULEHUB_PRIVATE_LONG_TERM_EXEC_RESERVE
            + CAPSULEHUB_PRIVATE_LONG_TERM_STORAGE_KEEPALIVE_RESERVE
            + CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT
            + CAPSULEHUB_ACK_FORWARD_RESERVE;
    }

    fun computePublishId(owner: Address, nonce: Int, bodyHash: Int, publishKind: Int): Int {
        return beginCell()
            .storeUint(self.deployment_manifest_hash, 256)
            .storeAddress(owner)
            .storeUint(nonce, 64)
            .storeUint(bodyHash, 256)
            .storeUint(publishKind, 8)
            .endCell()
            .hash();
    }

    fun capsulehubCallValue(maxCharge: Int): Int {
        throwUnless(16340, maxCharge >= VAULT_PUBLISH_LOCAL_EXEC_RESERVE);
        return maxCharge - VAULT_PUBLISH_LOCAL_EXEC_RESERVE;
    }

    fun computePublishBounceId(publishId: Int): Int {
        return publishId % UINT64_MOD;
    }

    fun protocolFeePaid(owner: Address, publishKind: Int, sizeClass: Int, cryptoSuite: Int): Int {
        if (publishKind == PUBLISH_KIND_PUBLIC) {
            throwUnless(16350, sizeClass == SIZE_CLASS_STANDARD);
            throwUnless(16351, cryptoSuite == CRYPTO_SUITE_PUBLIC_NONE);
            return self.discountedFee(owner, PLATO_PUBLIC_POST_FEE_TON);
        }
        throwUnless(16352, publishKind == PUBLISH_KIND_PRIVATE);
        if (sizeClass == SIZE_CLASS_STANDARD) {
            throwUnless(16353, cryptoSuite == CRYPTO_SUITE_CLASSICAL);
            return self.discountedFee(owner, PLATO_PRIVATE_STANDARD_FEE_TON);
        }
        throwUnless(16354, sizeClass == SIZE_CLASS_LONG_TERM);
        throwUnless(16355, cryptoSuite == CRYPTO_SUITE_HYBRID);
        return self.discountedFee(owner, PLATO_PRIVATE_LONG_TERM_FEE_TON);
    }

    fun refundPublishValue(owner: Address, refundableAmount: Int, amount: Int) {
        let refundAmount: Int = 0;
        if (amount > VAULT_PENDING_PUBLISH_REFUND_EXEC_RESERVE) {
            refundAmount = amount - VAULT_PENDING_PUBLISH_REFUND_EXEC_RESERVE;
        }
        if (refundAmount > refundableAmount) {
            refundAmount = refundableAmount;
        }
        if (refundAmount <= 0) {
            return;
        }
        message(MessageParameters {
            to: owner,
            value: refundAmount,
            bounce: false,
            mode: SendPayFwdFeesSeparately,
            body: null
        });
    }

    fun refundPendingPublish(pending: PendingPublish, amount: Int) {
        self.refundPublishValue(pending.owner_wallet, pending.refundable_amount, amount);
    }

    fun refundPendingAthWithdrawalTon(pending: PendingAthWithdrawal, amount: Int) {
        let refundAmount: Int = 0;
        if (amount > VAULT_ATH_WITHDRAW_REFUND_EXEC_RESERVE) {
            refundAmount = amount - VAULT_ATH_WITHDRAW_REFUND_EXEC_RESERVE;
        }
        if (refundAmount > pending.refundable_ton_amount) {
            refundAmount = pending.refundable_ton_amount;
        }
        if (refundAmount <= 0) {
            return;
        }
        let user: UserState = self.getUserOrEmpty(pending.owner_wallet);
        user.ton_balance += refundAmount;
        self.users.set(pending.owner_wallet, user);
    }

    fun creditActivityAirdrop(owner: Address) {
        if (self.genesis_config_hash <= 0) {
            return;
        }
        throwUnless(16540, self.users.exists(owner));
        let reward: Int = VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH;
        if (reward > self.genesis_config_hash) {
            reward = self.genesis_config_hash;
        }
        let user: UserState = self.getUserOrEmpty(owner);
        user.ath_balance += reward;
        self.genesis_config_hash -= reward;
        self.users.set(owner, user);
    }




    fun keyRecordStorageEndowment(cryptoSuiteMask: Int): Int {
        throwUnless(16100, (cryptoSuiteMask == CRYPTO_SUITE_CLASSICAL) || (cryptoSuiteMask == CRYPTO_SUITE_HYBRID));
        if (cryptoSuiteMask == CRYPTO_SUITE_CLASSICAL) {
            return VAULT_KEY_RECORD_STANDARD_STORAGE_ENDOWMENT;
        }
        return VAULT_KEY_RECORD_LONG_TERM_STORAGE_ENDOWMENT;
    }

    fun validatePqPubkeyCell(pqLen: Int, cryptoSuiteMask: Int, pqPubkey: Cell) {
        if (cryptoSuiteMask == CRYPTO_SUITE_CLASSICAL) {
            let empty: Slice = pqPubkey.beginParse();
            throwUnless(16108, empty.bits() == 0);
            throwUnless(16109, empty.refs() == 0);
            return;
        }
        if (cryptoSuiteMask == CRYPTO_SUITE_HYBRID) {
            let size: DataSize = pqPubkey.computeDataSize(MLKEM768_PUBKEY_SNAKE_CELLS);
            throwUnless(16108, size.cells == MLKEM768_PUBKEY_SNAKE_CELLS);
            throwUnless(16109, size.bits == MLKEM768_PUBKEY_SNAKE_BITS);
            throwUnless(16113, size.refs == MLKEM768_PUBKEY_SNAKE_REFS);

            let cursor: Cell = pqPubkey;
            let remaining: Int = pqLen;
            while (remaining > 0) {
                let chunkBytes: Int = MLKEM768_PUBKEY_SNAKE_CHUNK_BYTES;
                if (remaining == MLKEM768_PUBKEY_LEN) {
                    chunkBytes = MLKEM768_PUBKEY_SNAKE_FIRST_CHUNK_BYTES;
                } else {
                    if (remaining < chunkBytes) {
                        chunkBytes = remaining;
                    }
                }
                let cursorSlice: Slice = cursor.beginParse();
                throwUnless(16114, cursorSlice.bits() == (chunkBytes * 8));
                if (remaining > chunkBytes) {
                    throwUnless(16115, cursorSlice.refs() == 1);
                    cursor = cursorSlice.loadRef();
                } else {
                    throwUnless(16116, cursorSlice.refs() == 0);
                }
                remaining -= chunkBytes;
            }
            return;
        }
        throw(16107);
    }

    fun validateKeyProfile(encPubkey: Int, signPubkey: Int, pqHash: Int, pqLen: Int, pqPubkey: Cell, cryptoSuiteMask: Int) {
        throwUnless(16101, encPubkey != 0);
        throwUnless(16102, signPubkey != 0);
        if (cryptoSuiteMask == CRYPTO_SUITE_CLASSICAL) {
            throwUnless(16103, pqHash == 0);
            throwUnless(16104, pqLen == 0);
        } else {
            if (cryptoSuiteMask == CRYPTO_SUITE_HYBRID) {
                throwUnless(16105, pqHash != 0);
                throwUnless(16106, pqLen == MLKEM768_PUBKEY_LEN);
            } else {
                throw(16107);
            }
        }
        self.validatePqPubkeyCell(pqLen, cryptoSuiteMask, pqPubkey);
    }

    fun computeKeyId(owner: Address, keyGeneration: Int, encPubkey: Int, signPubkey: Int, pqHash: Int, pqLen: Int, cryptoSuiteMask: Int): Int {
        let keyFields: Cell = beginCell()
            .storeUint(encPubkey, 256)
            .storeUint(signPubkey, 256)
            .storeUint(pqHash, 256)
            .endCell();
        return beginCell()
            .storeUint(KEY_ID_DOMAIN, 32)
            .storeAddress(owner)
            .storeUint(keyGeneration, 32)
            .storeUint(pqLen, 16)
            .storeUint(cryptoSuiteMask, 16)
            .storeRef(keyFields)
            .endCell()
            .hash();
    }



    fun validateReceiveAsset(asset: Int) {
        throwUnless(16200, (asset == ASSET_TON) || (asset == ASSET_ATH));
    }

    fun computeReceiveIntentId(senderWallet: Address, recipientWallet: Address, asset: Int, amount: Int, clientNonce: Int): Int {
        return beginCell()
            .storeUint(RECEIVE_INTENT_ID_DOMAIN, 32)
            .storeAddress(senderWallet)
            .storeAddress(recipientWallet)
            .storeUint(asset, 8)
            .storeUint(amount, 128)
            .storeUint(clientNonce, 64)
            .endCell()
            .hash();
    }

    fun computeReceiveIntentCommitment(intentId: Int, recipientWallet: Address, secret32: Int): Int {
        return beginCell()
            .storeUint(RECEIVE_INTENT_COMMITMENT_DOMAIN, 32)
            .storeUint(intentId, 256)
            .storeAddress(recipientWallet)
            .storeUint(secret32, 256)
            .endCell()
            .hash();
    }

    receive(msg: BindDeploymentManifest) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(15010, !self.capsule_hub_bound);
        throwUnless(15011, msg.deployment_manifest_hash != 0);
        throwUnless(15012, self.deployment_manifest_hash == 0 || self.deployment_manifest_hash == msg.deployment_manifest_hash);
        self.deployment_manifest_hash = msg.deployment_manifest_hash;
        self.capsule_hub_address = msg.counterpart_address;
        self.capsule_hub_bound = true;
    }

    receive(msg: BindOfficialAthWallet) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(15013, self.vault_ath_wallet_address == sender());
        throwUnless(15014, msg.deployment_manifest_hash > 1);
        throwUnless(15015, self.deployment_manifest_hash == 0 || self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(15016, msg.official_ath_wallet_address != sender());
        throwUnless(15017, msg.official_ath_wallet_address == self.deriveAthWalletAddress(myAddress()));
        self.deployment_manifest_hash = msg.deployment_manifest_hash;
        self.vault_ath_wallet_address = msg.official_ath_wallet_address;
    }

    receive(msg: SealGenesis) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(15020, msg.deployment_manifest_hash > 1);
        throwUnless(15021, self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(15022, self.capsule_hub_bound);
        throwUnless(15023, self.vault_ath_wallet_address != sender());
        throwUnless(15024, self.vault_ath_wallet_address == self.deriveAthWalletAddress(myAddress()));
        self.genesis_config_hash = VAULT_ACTIVITY_AIRDROP_TOTAL_ATH;
        self.sealed = true;
    }

    receive(msg: DepositTon) {
        self.requireSealed();
        throwUnless(16010, msg.amount > 0);
        let exists: Bool = self.users.exists(sender());
        if (!exists) {
            throwUnless(16011, context().value >= msg.amount + VAULT_USER_STATE_STORAGE_ENDOWMENT + VAULT_DEPOSIT_TON_EXEC_RESERVE);
            self.user_count += 1;
        } else {
            throwUnless(16012, context().value >= msg.amount + VAULT_DEPOSIT_TON_EXEC_RESERVE);
        }

        let user: UserState = self.getUserOrEmpty(sender());
        user.ton_balance += msg.amount;
        self.users.set(sender(), user);
    }

    receive(msg: AthTransferNotification) {
        self.requireSealed();
        throwUnless(16013, sender() == self.vault_ath_wallet_address);
        throwUnless(16014, msg.amount > 0);
        throwUnless(16074, self.isBasechainAddress(msg.sender_wallet));
        let depositId: Int = self.computeAthDepositId(msg.sender_wallet, msg.query_id);
        if (self.processed_ath_deposits.exists(depositId)) {
            if (context().value >= VAULT_ATH_NOTIFICATION_ACK_VALUE) {
                message(MessageParameters {
                    to: sender(),
                    value: VAULT_ATH_NOTIFICATION_ACK_VALUE,
                    bounce: false,
                    mode: SendDefaultMode,
                    body: AthTransferNotificationAck {
                        query_id: msg.query_id,
                        sender_key: msg.sender_key,
                        amount: msg.amount
                    }.toCell()
                });
            }
            return;
        }
        let exists: Bool = self.users.exists(msg.sender_wallet);
        if (!exists) {
            throwUnless(16015, context().value >= VAULT_USER_STATE_STORAGE_ENDOWMENT + VAULT_ATH_NOTIFICATION_ACK_VALUE + VAULT_STATE_GROWTH_EXEC_RESERVE);
            self.user_count += 1;
        } else {
            throwUnless(16016, context().value >= VAULT_ATH_NOTIFICATION_ACK_VALUE);
        }

        let user: UserState = self.getUserOrEmpty(msg.sender_wallet);
        user.ath_balance += msg.amount;
        self.users.set(msg.sender_wallet, user);
        self.processed_ath_deposits.set(depositId, msg.amount);
        self.processed_ath_deposit_count += 1;

        message(MessageParameters {
            to: sender(),
            value: VAULT_ATH_NOTIFICATION_ACK_VALUE,
            bounce: false,
            mode: SendDefaultMode,
            body: AthTransferNotificationAck {
                query_id: msg.query_id,
                sender_key: msg.sender_key,
                amount: msg.amount
            }.toCell()
        });
    }

    receive(msg: WithdrawTon) {
        self.requireSealed();
        throwUnless(16020, msg.amount > 0);
        throwUnless(16018, msg.recipient != myAddress());
        throwUnless(16019, context().value >= VAULT_WITHDRAW_TON_EXEC_RESERVE);
        let userOpt: UserState? = self.users.get(sender());
        throwUnless(16021, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16022, user.ton_balance >= msg.amount);

        user.ton_balance -= msg.amount;
        self.users.set(sender(), user);

        message(MessageParameters {
            to: msg.recipient,
            value: msg.amount,
            bounce: false,
            mode: SendPayFwdFeesSeparately,
            body: null
        });
    }

    receive(msg: WithdrawAth) {
        self.requireSealed();
        throwUnless(16023, msg.amount > 0);
        throwUnless(16017, msg.recipient != myAddress());
        throwUnless(16075, self.isBasechainAddress(sender()));
        throwUnless(16076, self.isBasechainAddress(msg.recipient));
        throwUnless(16027, context().value >= VAULT_ATH_WITHDRAW_MIN_VALUE);
        let userOpt: UserState? = self.users.get(sender());
        throwUnless(16024, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16025, user.ath_balance >= msg.amount);
        let withdrawalId: Int = self.computeAthWithdrawalId(sender(), msg.query_id);
        throwUnless(16026, !self.pending_ath_withdrawals.exists(withdrawalId));

        user.ath_balance -= msg.amount;
        self.users.set(sender(), user);
        let recipientAthWallet: Address = self.deriveAthWalletAddress(msg.recipient);
        self.pending_ath_withdrawals.set(withdrawalId, PendingAthWithdrawal {
            owner_wallet: sender(),
            recipient: msg.recipient,
            recipient_ath_wallet: recipientAthWallet,
            amount: msg.amount,
            refundable_ton_amount: context().value,
            created_at: now()
        });
        self.pending_ath_withdrawal_count += 1;

        message(MessageParameters {
            to: self.vault_ath_wallet_address,
            value: 0,
            bounce: true,
            mode: SendRemainingValue,
            body: ATHTransferRequest {
                query_id: withdrawalId,
                amount: msg.amount,
                recipient: msg.recipient,
                response_destination: myAddress()
            }.toCell()
        });
    }

    receive(msg: ATHTransferAck) {
        self.requireSealed();
        let pendingOpt: PendingAthWithdrawal? = self.pending_ath_withdrawals.get(msg.query_id);
        throwUnless(16028, pendingOpt != null);
        let pending: PendingAthWithdrawal = pendingOpt!!;
        throwUnless(16029, pending.amount == msg.amount);
        throwUnless(16030, sender() == pending.recipient_ath_wallet);
        self.refundPendingAthWithdrawalTon(pending, context().value);
        self.pending_ath_withdrawals.del(msg.query_id);
        self.pending_ath_withdrawal_count -= 1;
    }

    receive(msg: ATHTransferFailed) {
        self.requireSealed();
        throwUnless(16070, sender() == self.vault_ath_wallet_address);
        throwUnless(16071, msg.amount > 0);
        let pendingOpt: PendingAthWithdrawal? = self.pending_ath_withdrawals.get(msg.query_id);
        throwUnless(16072, pendingOpt != null);
        let pending: PendingAthWithdrawal = pendingOpt!!;
        throwUnless(16073, pending.amount == msg.amount);
        let user: UserState = self.getUserOrEmpty(pending.owner_wallet);
        user.ath_balance += pending.amount;
        self.users.set(pending.owner_wallet, user);
        self.refundPendingAthWithdrawalTon(pending, context().value);
        self.pending_ath_withdrawals.del(msg.query_id);
        self.pending_ath_withdrawal_count -= 1;
    }

    bounced(msg: bounced<ATHTransferRequest>) {
        self.requireSealed();
        throwUnless(16060, sender() == self.vault_ath_wallet_address);
        throwUnless(16061, msg.amount > 0);
        let pendingOpt: PendingAthWithdrawal? = self.pending_ath_withdrawals.get(msg.query_id);
        throwUnless(16062, pendingOpt != null);
        let pending: PendingAthWithdrawal = pendingOpt!!;
        throwUnless(16063, pending.amount == msg.amount);
        let user: UserState = self.getUserOrEmpty(pending.owner_wallet);
        user.ath_balance += pending.amount;
        self.users.set(pending.owner_wallet, user);
        self.refundPendingAthWithdrawalTon(pending, context().value);
        self.pending_ath_withdrawals.del(msg.query_id);
        self.pending_ath_withdrawal_count -= 1;
    }

    receive(msg: TopUpStorageReserve) {
        // Accept TON for Vault storage reserve only. No user balance, authority, or config state changes.
    }



    receive(msg: RegisterMessagingKeys) {
        self.requireSealed();
        self.validateKeyProfile(msg.enc_pubkey, msg.sign_pubkey, msg.pq_kem_pubkey_hash, msg.pq_kem_pubkey_len, msg.pq_kem_pubkey, msg.crypto_suite_mask);
        let userExists: Bool = self.users.exists(sender());
        let required: Int = self.keyRecordStorageEndowment(msg.crypto_suite_mask);
        if (!userExists) {
            required += VAULT_USER_STATE_STORAGE_ENDOWMENT;
        }
        required += VAULT_STATE_GROWTH_EXEC_RESERVE;
        throwUnless(16110, context().value >= required);

        let user: UserState = self.getUserOrEmpty(sender());
        throwUnless(16111, user.current_key_id == 0);

        let keyGeneration: Int = 0;
        let keyId: Int = self.computeKeyId(sender(), keyGeneration, msg.enc_pubkey, msg.sign_pubkey, msg.pq_kem_pubkey_hash, msg.pq_kem_pubkey_len, msg.crypto_suite_mask);
        throwUnless(16112, !self.key_records.exists(keyId));

        if (!userExists) {
            self.user_count += 1;
        }

        self.key_records.set(keyId, KeyRecord {
            owner_wallet: sender(),
            key_generation: keyGeneration,
            enc_pubkey: msg.enc_pubkey,
            sign_pubkey: msg.sign_pubkey,
            pq_kem_pubkey_hash: msg.pq_kem_pubkey_hash,
            pq_kem_pubkey_len: msg.pq_kem_pubkey_len,
            pq_kem_pubkey: msg.pq_kem_pubkey,
            crypto_suite_mask: msg.crypto_suite_mask,
            created_at: now(),
            created_lt: curLt(),
            revoked_at: 0,
            revoked_lt: 0
        });
        self.key_record_count += 1;
        user.current_key_id = keyId;
        self.users.set(sender(), user);
    }

    receive(msg: ReplaceMessagingKeys) {
        self.requireSealed();
        self.validateKeyProfile(msg.enc_pubkey, msg.sign_pubkey, msg.pq_kem_pubkey_hash, msg.pq_kem_pubkey_len, msg.pq_kem_pubkey, msg.crypto_suite_mask);
        let userOpt: UserState? = self.users.get(sender());
        throwUnless(16120, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16121, user.current_key_id != 0);

        let oldRecordOpt: KeyRecord? = self.key_records.get(user.current_key_id);
        throwUnless(16122, oldRecordOpt != null);
        let oldRecord: KeyRecord = oldRecordOpt!!;
        throwUnless(16123, oldRecord.owner_wallet == sender());
        throwUnless(16124, oldRecord.revoked_lt == 0);
        throwUnless(16125, oldRecord.key_generation < UINT32_MAX);

        let required: Int = self.keyRecordStorageEndowment(msg.crypto_suite_mask);
        required += VAULT_STATE_GROWTH_EXEC_RESERVE;
        throwUnless(16126, context().value >= required);

        oldRecord.revoked_at = now();
        oldRecord.revoked_lt = curLt();
        self.key_records.set(user.current_key_id, oldRecord);

        let keyGeneration: Int = oldRecord.key_generation + 1;
        let newKeyId: Int = self.computeKeyId(sender(), keyGeneration, msg.enc_pubkey, msg.sign_pubkey, msg.pq_kem_pubkey_hash, msg.pq_kem_pubkey_len, msg.crypto_suite_mask);
        throwUnless(16127, !self.key_records.exists(newKeyId));

        self.key_records.set(newKeyId, KeyRecord {
            owner_wallet: sender(),
            key_generation: keyGeneration,
            enc_pubkey: msg.enc_pubkey,
            sign_pubkey: msg.sign_pubkey,
            pq_kem_pubkey_hash: msg.pq_kem_pubkey_hash,
            pq_kem_pubkey_len: msg.pq_kem_pubkey_len,
            pq_kem_pubkey: msg.pq_kem_pubkey,
            crypto_suite_mask: msg.crypto_suite_mask,
            created_at: now(),
            created_lt: curLt(),
            revoked_at: 0,
            revoked_lt: 0
        });
        self.key_record_count += 1;
        user.current_key_id = newKeyId;
        self.users.set(sender(), user);
    }



    receive(msg: CreateReceiveIntent) {
        self.requireSealed();
        self.validateReceiveAsset(msg.asset);
        throwUnless(16210, msg.amount > 0);
        throwUnless(16211, msg.commitment != 0);

        let userOpt: UserState? = self.users.get(sender());
        throwUnless(16214, userOpt != null);
        let user: UserState = userOpt!!;

        if (msg.asset == ASSET_TON) {
            throwUnless(16215, user.ton_balance >= msg.amount);
            user.ton_balance -= msg.amount;
        } else {
            throwUnless(16216, user.ath_balance >= msg.amount);
            user.ath_balance -= msg.amount;
        }

        let intentId: Int = self.computeReceiveIntentId(sender(), msg.recipient_wallet, msg.asset, msg.amount, msg.client_nonce);
        throwUnless(16217, !self.receive_intents.exists(intentId));
        throwUnless(16218, context().value >= VAULT_RECEIVE_INTENT_STORAGE_ENDOWMENT + VAULT_STATE_GROWTH_EXEC_RESERVE);

        self.users.set(sender(), user);
        self.receive_intents.set(intentId, ReceiveIntent {
            sender_wallet: sender(),
            recipient_wallet: msg.recipient_wallet,
            asset: msg.asset,
            amount: msg.amount,
            commitment: msg.commitment,
            client_nonce: msg.client_nonce,
            created_at: now(),
            claimed: false
        });
        self.receive_intent_count += 1;
    }

    receive(msg: ClaimReceiveIntent) {
        self.requireSealed();
        let intentOpt: ReceiveIntent? = self.receive_intents.get(msg.intent_id);
        throwUnless(16230, intentOpt != null);
        let intent: ReceiveIntent = intentOpt!!;
        throwUnless(16231, !intent.claimed);
        throwUnless(16232, sender() == intent.recipient_wallet);
        let expected: Int = self.computeReceiveIntentCommitment(msg.intent_id, sender(), msg.secret32);
        throwUnless(16234, expected == intent.commitment);

        let userExists: Bool = self.users.exists(sender());
        if (!userExists) {
            throwUnless(16235, context().value >= VAULT_USER_STATE_STORAGE_ENDOWMENT + VAULT_STATE_GROWTH_EXEC_RESERVE);
            self.user_count += 1;
        }

        let user: UserState = self.getUserOrEmpty(sender());
        if (intent.asset == ASSET_TON) {
            user.ton_balance += intent.amount;
        } else {
            user.ath_balance += intent.amount;
        }

        self.users.set(sender(), user);
        self.receive_intents.del(msg.intent_id);
        self.receive_intent_count -= 1;
    }

    receive(msg: CancelReceiveIntent) {
        self.requireSealed();
        let intentOpt: ReceiveIntent? = self.receive_intents.get(msg.intent_id);
        throwUnless(16250, intentOpt != null);
        let intent: ReceiveIntent = intentOpt!!;
        throwUnless(16251, sender() == intent.sender_wallet);

        let user: UserState = self.getUserOrEmpty(sender());
        if (intent.asset == ASSET_TON) {
            user.ton_balance += intent.amount;
        } else {
            user.ath_balance += intent.amount;
        }

        self.users.set(sender(), user);
        self.receive_intents.del(msg.intent_id);
        self.receive_intent_count -= 1;
    }


    receive(msg: PublishPrivateFromWallet) {
        self.requireSealed();
        throwUnless(16410, self.isBasechainAddress(sender()));
        let userOpt: UserState? = self.users.get(sender());
        throwUnless(16411, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16412, user.current_key_id != 0);
        throwUnless(16413, self.isPublishProfileValid(OP_PUBLISH_PRIVATE_BY_WALLET, PUBLISH_KIND_PRIVATE, msg.size_class, msg.crypto_suite, msg.header_0_hash, msg.header_1_hash));
        throwUnless(16414, msg.header_0.hash() == msg.header_0_hash);
        throwUnless(16415, msg.header_1.hash() == msg.header_1_hash);
        throwUnless(16416, msg.body.hash() == msg.body_hash);

        let expectedMax: Int = self.canonicalPublishMaxCharge(sender(), PUBLISH_KIND_PRIVATE, msg.size_class, msg.crypto_suite);
        throwUnless(16417, msg.max_charge >= expectedMax);
        throwUnless(16418, context().value >= msg.max_charge);

        let protocolFee: Int = self.protocolFeePaid(sender(), PUBLISH_KIND_PRIVATE, msg.size_class, msg.crypto_suite);
        let callValue: Int = self.capsulehubCallValue(msg.max_charge);
        let publishId: Int = self.computePublishId(sender(), msg.client_nonce, msg.body_hash, PUBLISH_KIND_PRIVATE);
        throwUnless(16419, publishId != 0);
        let bounceId: Int = self.computePublishBounceId(publishId);
        throwUnless(16420, !self.pending_publishes.exists(bounceId));

        self.pending_publishes.set(bounceId, PendingPublish {
            owner_wallet: sender(),
            tombstone: false,
            nonce: msg.client_nonce,
            publish_kind: PUBLISH_KIND_PRIVATE,
            body_hash: msg.body_hash,
            refundable_amount: callValue,
            created_at: now()
        });
        self.pending_publish_count += 1;

        message(MessageParameters {
            to: self.capsule_hub_address,
            value: callValue,
            bounce: true,
            mode: SendPayGasSeparately,
            body: PublishPrivateFromVault {
                bounce_id: bounceId,
                publish_id: publishId,
                size_class: msg.size_class,
                crypto_suite: msg.crypto_suite,
                header_0_hash: msg.header_0_hash,
                header_1_hash: msg.header_1_hash,
                body_hash: msg.body_hash,
                header_0: msg.header_0,
                header_1: msg.header_1,
                body: msg.body,
                protocol_fee_paid: protocolFee
            }.toCell()
        });
    }

    receive(msg: PublishPublicFromWallet) {
        self.requireSealed();
        throwUnless(16430, self.isBasechainAddress(sender()));
        let userOpt: UserState? = self.users.get(sender());
        throwUnless(16431, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16432, user.current_key_id != 0);
        throwUnless(16433, self.isPublishProfileValid(OP_PUBLISH_PUBLIC_BY_WALLET, PUBLISH_KIND_PUBLIC, SIZE_CLASS_STANDARD, CRYPTO_SUITE_PUBLIC_NONE, msg.header_hash, 0));
        throwUnless(16434, msg.header.hash() == msg.header_hash);
        throwUnless(16435, msg.body.hash() == msg.body_hash);

        let expectedMax: Int = self.canonicalPublishMaxCharge(sender(), PUBLISH_KIND_PUBLIC, SIZE_CLASS_STANDARD, CRYPTO_SUITE_PUBLIC_NONE);
        throwUnless(16436, msg.max_charge >= expectedMax);
        throwUnless(16437, context().value >= msg.max_charge);

        let protocolFee: Int = self.protocolFeePaid(sender(), PUBLISH_KIND_PUBLIC, SIZE_CLASS_STANDARD, CRYPTO_SUITE_PUBLIC_NONE);
        let callValue: Int = self.capsulehubCallValue(msg.max_charge);
        let publishId: Int = self.computePublishId(sender(), msg.client_nonce, msg.body_hash, PUBLISH_KIND_PUBLIC);
        throwUnless(16438, publishId != 0);
        let bounceId: Int = self.computePublishBounceId(publishId);
        throwUnless(16439, !self.pending_publishes.exists(bounceId));

        self.pending_publishes.set(bounceId, PendingPublish {
            owner_wallet: sender(),
            tombstone: false,
            nonce: msg.client_nonce,
            publish_kind: PUBLISH_KIND_PUBLIC,
            body_hash: msg.body_hash,
            refundable_amount: callValue,
            created_at: now()
        });
        self.pending_publish_count += 1;

        message(MessageParameters {
            to: self.capsule_hub_address,
            value: callValue,
            bounce: true,
            mode: SendPayGasSeparately,
            body: PublishPublicFromVault {
                bounce_id: bounceId,
                publish_id: publishId,
                marketing_note: PLATHO_PUBLIC_MARKETING_NOTE_ASCII,
                author_wallet: sender(),
                header_hash: msg.header_hash,
                body_hash: msg.body_hash,
                header: msg.header,
                body: msg.body,
                protocol_fee_paid: protocolFee
            }.toCell()
        });
    }

    receive(msg: CapsuleHubPublishAck) {
        self.requireSealed();
        throwUnless(16500, sender() == self.capsule_hub_address);
        let bounceId: Int = self.computePublishBounceId(msg.publish_id);
        let pendingOpt: PendingPublish? = self.pending_publishes.get(bounceId);
        throwUnless(16501, pendingOpt != null);
        let pending: PendingPublish = pendingOpt!!;
        let expectedPublishId: Int = self.computePublishId(pending.owner_wallet, pending.nonce, pending.body_hash, pending.publish_kind);
        throwUnless(16502, expectedPublishId == msg.publish_id);
        if (pending.tombstone) {
            throwUnless(16503, now() <= pending.created_at);
            self.refundPendingPublish(pending, context().value);
            self.creditActivityAirdrop(pending.owner_wallet);
            self.pending_publishes.del(bounceId);
        } else {
            self.refundPendingPublish(pending, context().value);
            self.creditActivityAirdrop(pending.owner_wallet);
            self.pending_publishes.del(bounceId);
            self.pending_publish_count -= 1;
        }
    }

    bounced(msg: bounced<PublishPrivateFromVault>) {
        self.requireSealed();
        throwUnless(16510, sender() == self.capsule_hub_address);
        let pendingOpt: PendingPublish? = self.pending_publishes.get(msg.bounce_id);
        throwUnless(16511, pendingOpt != null);
        let pending: PendingPublish = pendingOpt!!;
        if (pending.tombstone) {
            throwUnless(16512, now() <= pending.created_at);
            throwUnless(16513, pending.publish_kind == PUBLISH_KIND_PRIVATE);
            self.refundPendingPublish(pending, context().value);
            self.pending_publishes.del(msg.bounce_id);
        } else {
            self.refundPendingPublish(pending, context().value);
            self.pending_publishes.del(msg.bounce_id);
            self.pending_publish_count -= 1;
        }
    }

    bounced(msg: bounced<PublishPublicFromVault>) {
        self.requireSealed();
        throwUnless(16520, sender() == self.capsule_hub_address);
        let pendingOpt: PendingPublish? = self.pending_publishes.get(msg.bounce_id);
        throwUnless(16521, pendingOpt != null);
        let pending: PendingPublish = pendingOpt!!;
        if (pending.tombstone) {
            throwUnless(16522, now() <= pending.created_at);
            throwUnless(16523, pending.publish_kind == PUBLISH_KIND_PUBLIC);
            self.refundPendingPublish(pending, context().value);
            self.pending_publishes.del(msg.bounce_id);
        } else {
            self.refundPendingPublish(pending, context().value);
            self.pending_publishes.del(msg.bounce_id);
            self.pending_publish_count -= 1;
        }
    }

    receive(msg: PrunePendingPublish) {
        self.requireSealed();
        throwUnless(16533, context().value >= VAULT_PRUNE_PENDING_PUBLISH_EXEC_RESERVE);
        let bounceId: Int = self.computePublishBounceId(msg.publish_id);
        let pendingOpt: PendingPublish? = self.pending_publishes.get(bounceId);
        throwUnless(16530, pendingOpt != null);
        let pending: PendingPublish = pendingOpt!!;
        let expectedPublishId: Int = self.computePublishId(pending.owner_wallet, pending.nonce, pending.body_hash, pending.publish_kind);
        throwUnless(16531, expectedPublishId == msg.publish_id);
        if (pending.tombstone) {
            throwUnless(16534, now() >= pending.created_at);
            self.pending_publishes.del(bounceId);
            return;
        }
        throwUnless(16532, now() >= pending.created_at + VAULT_PENDING_PUBLISH_STALE_TTL);
        let tombstoneExpiresAt: Int = now() + VAULT_PRUNED_PUBLISH_TOMBSTONE_TTL;
        if (tombstoneExpiresAt > UINT32_MAX) {
            tombstoneExpiresAt = UINT32_MAX;
        }
        self.pending_publishes.set(bounceId, PendingPublish {
            owner_wallet: pending.owner_wallet,
            tombstone: true,
            nonce: pending.nonce,
            publish_kind: pending.publish_kind,
            body_hash: pending.body_hash,
            refundable_amount: pending.refundable_amount,
            created_at: tombstoneExpiresAt
        });
        self.pending_publish_count -= 1;
    }

    get fun get_user(owner: Address): VaultUserView {
        let userOpt: UserState? = self.users.get(owner);
        if (userOpt == null) {
            return VaultUserView {
                exists: false,
                ton_balance: 0,
                ath_balance: 0,
                current_key_id: 0
            };
        }
        let user: UserState = userOpt!!;
        return VaultUserView {
            exists: true,
            ton_balance: user.ton_balance,
            ath_balance: user.ath_balance,
            current_key_id: user.current_key_id
        };
    }



    get fun get_key_record(keyId: Int): VaultKeyRecordView {
        let recordOpt: KeyRecord? = self.key_records.get(keyId);
        if (recordOpt == null) {
            return VaultKeyRecordView {
                exists: false,
                owner_wallet: myAddress(),
                key_generation: 0,
                enc_pubkey: 0,
                sign_pubkey: 0,
                pq_kem_pubkey_hash: 0,
                pq_kem_pubkey_len: 0,
                pq_kem_pubkey: emptyCell(),
                crypto_suite_mask: 0,
                created_at: 0,
                created_lt: 0,
                revoked_at: 0,
                revoked_lt: 0
            };
        }
        let record: KeyRecord = recordOpt!!;
        return VaultKeyRecordView {
            exists: true,
            owner_wallet: record.owner_wallet,
            key_generation: record.key_generation,
            enc_pubkey: record.enc_pubkey,
            sign_pubkey: record.sign_pubkey,
            pq_kem_pubkey_hash: record.pq_kem_pubkey_hash,
            pq_kem_pubkey_len: record.pq_kem_pubkey_len,
            pq_kem_pubkey: record.pq_kem_pubkey,
            crypto_suite_mask: record.crypto_suite_mask,
            created_at: record.created_at,
            created_lt: record.created_lt,
            revoked_at: record.revoked_at,
            revoked_lt: record.revoked_lt
        };
    }



    get fun get_receive_intent(intentId: Int): VaultReceiveIntentView {
        let intentOpt: ReceiveIntent? = self.receive_intents.get(intentId);
        if (intentOpt == null) {
            return VaultReceiveIntentView {
                exists: false,
                sender_wallet: myAddress(),
                recipient_wallet: myAddress(),
                asset: 0,
                amount: 0,
                commitment: 0,
                client_nonce: 0,
                created_at: 0,
                claimed: false
            };
        }
        let intent: ReceiveIntent = intentOpt!!;
        return VaultReceiveIntentView {
            exists: true,
            sender_wallet: intent.sender_wallet,
            recipient_wallet: intent.recipient_wallet,
            asset: intent.asset,
            amount: intent.amount,
            commitment: intent.commitment,
            client_nonce: intent.client_nonce,
            created_at: intent.created_at,
            claimed: intent.claimed
        };
    }

    get fun get_receive_intent_id(senderWallet: Address, recipientWallet: Address, asset: Int, amount: Int, clientNonce: Int): Int {
        return self.computeReceiveIntentId(senderWallet, recipientWallet, asset, amount, clientNonce);
    }

    get fun get_receive_intent_commitment(intentId: Int, recipientWallet: Address, secret32: Int): Int {
        return self.computeReceiveIntentCommitment(intentId, recipientWallet, secret32);
    }

    get fun get_pending_ath_withdrawal(queryId: Int): VaultPendingAthWithdrawalView {
        let pendingOpt: PendingAthWithdrawal? = self.pending_ath_withdrawals.get(queryId);
        if (pendingOpt == null) {
            return VaultPendingAthWithdrawalView {
                exists: false,
                owner_wallet: myAddress(),
                recipient: myAddress(),
                recipient_ath_wallet: myAddress(),
                amount: 0,
                created_at: 0
            };
        }
        let pending: PendingAthWithdrawal = pendingOpt!!;
        return VaultPendingAthWithdrawalView {
            exists: true,
            owner_wallet: pending.owner_wallet,
            recipient: pending.recipient,
            recipient_ath_wallet: pending.recipient_ath_wallet,
            amount: pending.amount,
            created_at: pending.created_at
        };
    }

    get fun get_ath_withdrawal_id(ownerWallet: Address, queryId: Int): Int {
        return self.computeAthWithdrawalId(ownerWallet, queryId);
    }

    get fun get_pending_ath_withdrawal_for(ownerWallet: Address, queryId: Int): VaultPendingAthWithdrawalView {
        let withdrawalId: Int = self.computeAthWithdrawalId(ownerWallet, queryId);
        return self.get_pending_ath_withdrawal(withdrawalId);
    }

    get fun get_canonical_publish_charge(owner: Address, publishKind: Int, sizeClass: Int, cryptoSuite: Int): Int {
        return self.canonicalPublishMaxCharge(owner, publishKind, sizeClass, cryptoSuite);
    }


    get fun get_global(): VaultGlobalView {
        let airdropRemaining: Int = 0;
        if (self.sealed) {
            airdropRemaining = self.genesis_config_hash;
        }
        return VaultGlobalView {
            sealed: self.sealed,
            capsule_hub_bound: self.capsule_hub_bound,
            deployment_manifest_hash: self.deployment_manifest_hash,
            capsule_hub_address: self.capsule_hub_address,
            vault_ath_wallet_address: self.vault_ath_wallet_address,
            ath_master_address: self.ath_master_address,
            user_count: self.user_count,
            key_record_count: self.key_record_count,
            receive_intent_count: self.receive_intent_count,
            pending_ath_withdrawal_count: self.pending_ath_withdrawal_count,
            pending_publish_count: self.pending_publish_count,
            processed_ath_deposit_count: self.processed_ath_deposit_count,
            pending_publish_stale_ttl: VAULT_PENDING_PUBLISH_STALE_TTL,
            airdrop_remaining_ath: airdropRemaining,
            airdrop_distributed_ath: VAULT_ACTIVITY_AIRDROP_TOTAL_ATH - airdropRemaining,
            airdrop_reward_per_message_ath: VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH,
            airdrop_total_allocation_ath: VAULT_ACTIVITY_AIRDROP_TOTAL_ATH
        };
    }

    receive() {
        throw(16099);
    }
}
