// Platho v1 Vault milestone 1 implementation.
// Scope: UserState, TON deposit/withdraw, Vault-funded publish, KeyRecord/key_generation lifecycle.
// Includes signed publish to CapsuleHub with PendingPublish ACK/bounce recovery.
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
const VAULT_ATH_WITHDRAW_MIN_VALUE: Int = 40000000;
const VAULT_WITHDRAW_TON_EXEC_RESERVE: Int = 2000000;
const VAULT_ATH_WITHDRAW_REFUND_EXEC_RESERVE: Int = 2000000;
const VAULT_PRUNE_PENDING_PUBLISH_EXEC_RESERVE: Int = 2000000;
const ASSET_TON: Int = 1;
const ASSET_ATH: Int = 2;
const RECEIVE_INTENT_ID_DOMAIN: Int = 0x52434944; // "RCID"
const RECEIVE_INTENT_COMMITMENT_DOMAIN: Int = 0x5243434d; // "RCCM"
const VAULT_RECEIVE_INTENT_SIGNING_DOMAIN: Int = 0x56524331; // "VRC1"
const VAULT_RECEIVE_INTENT_ACTION_CREATE: Int = 1;
const VAULT_RECEIVE_INTENT_ACTION_CLAIM: Int = 2;
const VAULT_RECEIVE_INTENT_ACTION_CANCEL: Int = 3;
const VAULT_REPLACE_MESSAGING_KEYS_SIGNING_DOMAIN: Int = 0x56524B31; // "VRK1"
const VAULT_RECEIVE_INTENT_SETTLEMENT_EXEC_RESERVE: Int = 2000000;
const VAULT_PENDING_PUBLISH_COUNT_UNIT: Int = 1;
const VAULT_PENDING_PROFILE_COUNT_UNIT: Int = 4294967296;
const VAULT_PENDING_USERNAME_COUNT_UNIT: Int = 281474976710656;
const VAULT_PENDING_PROFILE_COUNT_MOD: Int = 65536;
const VAULT_PENDING_PROFILE_COUNT_MAX: Int = 65535;
const VAULT_PENDING_USERNAME_COUNT_MAX: Int = 65535;
const CRYPTO_SUITE_HYBRID: Int = 2;
const MLKEM768_PUBKEY_LEN: Int = 1184;
const MLKEM768_PUBKEY_SNAKE_CHUNK_BYTES: Int = 127;
const MLKEM768_PUBKEY_SNAKE_FIRST_CHUNK_BYTES: Int = 41;
const MLKEM768_PUBKEY_SNAKE_CELLS: Int = 10;
const MLKEM768_PUBKEY_SNAKE_BITS: Int = 9472;
const MLKEM768_PUBKEY_SNAKE_REFS: Int = 9;
const UINT64_MAX: Int = 18446744073709551615;
const UINT64_MOD: Int = 18446744073709551616;
const UINT160_MOD: Int = 1461501637330902918203684832716283019655932542976;
const UINT32_MAX: Int = 4294967295;
const ATH_DEPOSIT_ID_DOMAIN: Int = 0x41445049; // "ADPI"
const ATH_WITHDRAWAL_ID_DOMAIN: Int = 0x41574944; // "AWID"
const KEY_ID_DOMAIN: Int = 0x4b455949; // "KEYI"
const PUBLISH_KIND_PRIVATE: Int = 1;
const PUBLISH_KIND_PUBLIC: Int = 2;
const VAULT_PUBLISH_SIGNING_DOMAIN: Int = 0x56504231; // "VPB1"
const VAULT_PROFILE_AVATAR_SIGNING_DOMAIN: Int = 0x56504131; // "VPA1"
const VAULT_PROFILE_AVATAR_PAYMENT_ID_DOMAIN: Int = 0x56504149; // "VPAI"
const VAULT_USERNAME_MINT_SIGNING_DOMAIN: Int = 0x56554E31; // "VUN1"
const VAULT_USERNAME_MINT_PAYMENT_ID_DOMAIN: Int = 0x56554E49; // "VUNI"
const SIZE_CLASS_1K: Int = 1;
const SIZE_CLASS_2K: Int = 2;
const SIZE_CLASS_4K: Int = 4;
const SIZE_CLASS_8K: Int = 8;
const SIZE_CLASS_16K: Int = 16;
const SIZE_CLASS_32K: Int = 32;
const SIZE_CLASS_STANDARD: Int = SIZE_CLASS_1K;
const CRYPTO_SUITE_PUBLIC_NONE: Int = 0;
const PLATO_PRIVATE_LONG_TERM_FEE_TON: Int = 10000000;
const PLATO_PUBLIC_POST_FEE_TON: Int = 10000000;
const PLATO_MIN_PROTOCOL_FEE_TON: Int = 0;
const PLATHO_PUBLIC_MARKETING_NOTE_ASCII: Int = 0x73656e742076696120506c6174686f2e417070; // "sent via Platho.App"
const ATH_FULL_DISCOUNT_AMOUNT: Int = 10000000000000;
const VAULT_ACTIVITY_AIRDROP_TOTAL_ATH: Int = 15000000000000000;
const VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH: Int = 0;
const VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH: Int = 10000000000;
const VAULT_PUBLISH_PUBLIC_LOCAL_EXEC_RESERVE: Int = 8700000;
const VAULT_PUBLISH_PRIVATE_HYBRID_1K_LOCAL_EXEC_RESERVE: Int = 12000000;
const VAULT_PUBLISH_PRIVATE_HYBRID_2K_LOCAL_EXEC_RESERVE: Int = 13800000;
const VAULT_PUBLISH_PRIVATE_HYBRID_4K_LOCAL_EXEC_RESERVE: Int = 17300000;
const VAULT_PUBLISH_PRIVATE_HYBRID_8K_LOCAL_EXEC_RESERVE: Int = 24400000;
const VAULT_PUBLISH_PRIVATE_HYBRID_16K_LOCAL_EXEC_RESERVE: Int = 38900000;
const VAULT_PUBLISH_PRIVATE_HYBRID_32K_LOCAL_EXEC_RESERVE: Int = 67600000;
const VAULT_PENDING_PUBLISH_REFUND_EXEC_RESERVE: Int = 4200000;
const CAPSULEHUB_PRIVATE_HYBRID_1K_EXEC_RESERVE: Int = 4200000;
const CAPSULEHUB_PRIVATE_HYBRID_2K_EXEC_RESERVE: Int = 4300000;
const CAPSULEHUB_PRIVATE_HYBRID_4K_EXEC_RESERVE: Int = 4500000;
const CAPSULEHUB_PRIVATE_HYBRID_8K_EXEC_RESERVE: Int = 5000000;
const CAPSULEHUB_PRIVATE_HYBRID_16K_EXEC_RESERVE: Int = 5800000;
const CAPSULEHUB_PRIVATE_HYBRID_32K_EXEC_RESERVE: Int = 7600000;
const CAPSULEHUB_PUBLIC_EXEC_RESERVE: Int = 2400000;
const CAPSULEHUB_PRIVATE_STORAGE_KEEPALIVE_RESERVE: Int = 1000000;
const CAPSULEHUB_PUBLIC_STORAGE_KEEPALIVE_RESERVE: Int = 1000000;
const CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT: Int = 3300000;
const CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT: Int = 7400000;
const CAPSULEHUB_ACK_FORWARD_RESERVE: Int = 30000000;
const CAPSULEHUB_PRIVATE_HEADER0_BITS: Int = 1120;
const CAPSULEHUB_PRIVATE_HEADER1_BITS: Int = 240;
const CAPSULEHUB_PRIVATE_HEADER0_CELLS: Int = 2;
const CAPSULEHUB_PRIVATE_HEADER0_REFS: Int = 1;
const CAPSULEHUB_PRIVATE_HEADER1_CELLS: Int = 1;
const CAPSULEHUB_PRIVATE_HEADER1_REFS: Int = 0;
const CAPSULEHUB_PRIVATE_HYBRID_BODY_OVERHEAD_BYTES: Int = 1204;
const CAPSULEHUB_PUBLIC_HEADER_MAX_BITS: Int = 576;
const CAPSULEHUB_PUBLIC_HEADER_MAX_CELLS: Int = 1;
const CAPSULEHUB_PUBLIC_HEADER_MAX_REFS: Int = 0;
const CAPSULEHUB_PUBLIC_BODY_MAX_BITS: Int = 8192;
const CAPSULEHUB_PUBLIC_BODY_MAX_CELLS: Int = 9;
const CAPSULEHUB_PUBLIC_BODY_MAX_REFS: Int = 8;
const PROFILE_AVATAR_PRICE_ATH: Int = 100000000000;
const PROFILE_AVATAR_NOTIFY_VALUE: Int = 30000000;
const PROFILE_AVATAR_MAX_PARTS: Int = 16;
const PROFILE_AVATAR_MEDIA_FORMAT_WEBP: Int = 1;
const VAULT_PROFILE_AVATAR_LOCAL_EXEC_RESERVE: Int = 6000000;
const VAULT_PROFILE_AVATAR_ATH_WALLET_REQUEST_VALUE: Int = 55000000;
const VAULT_PROFILE_AVATAR_EXCESS_REFUND_EXEC_RESERVE: Int = 2000000;
const USERNAME_PRICE_4_CHARS: Int = 10000000000000;
const USERNAME_PRICE_5_CHARS: Int = 1000000000000;
const USERNAME_PRICE_6_PLUS_CHARS: Int = 100000000000;
const USERNAME_NOTIFY_VALUE: Int = 32000000;
const USERNAME_MAX_LENGTH: Int = 16;
const USERNAME_NAME_HASH_DOMAIN: Int = 0xC5CC7CD6;
const VAULT_USERNAME_MINT_LOCAL_EXEC_RESERVE: Int = 6000000;
const VAULT_USERNAME_MINT_ATH_WALLET_REQUEST_VALUE: Int = 57000000;
const VAULT_BINDING_CAPSULE_HUB: Int = 1;
const VAULT_BINDING_PROFILE_REGISTRY: Int = 2;
const VAULT_BINDING_USERNAME_REGISTRY: Int = 4;
const OP_BIND_DEPLOYMENT_MANIFEST: Int = 0x90E2E0CB;
const OP_BIND_OFFICIAL_ATH_WALLET: Int = 0x18DB2CCB;
const OP_BIND_PROFILE_REGISTRY: Int = 0x50A61103;
const OP_BIND_USERNAME_REGISTRY: Int = 0x50A61104;
const OP_SEAL_GENESIS: Int = 0x3A12D1AD;


message(0x90E2E0CB) BindDeploymentManifest {
    deployment_manifest_hash: Int as uint256;
    counterpart_address: Address;
}

message(0x18DB2CCB) BindOfficialAthWallet {
    deployment_manifest_hash: Int as uint256;
    official_ath_wallet_address: Address;
}

message(0x50A61103) BindProfileRegistry {
    deployment_manifest_hash: Int as uint256;
    profile_registry_address: Address;
}

message(0x50A61104) BindUsernameRegistry {
    deployment_manifest_hash: Int as uint256;
    username_registry_address: Address;
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
    auth_pubkey: Int as uint256;
    pq_kem_pubkey_hash: Int as uint256;
    pq_kem_pubkey_len: Int as uint16;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: Int as uint16;
}

message(0x89D648BB) ReplaceMessagingKeys {
    owner_wallet: Address;
    signature: Slice as bytes64;
    signed_payload: Cell;
}

message(0x7E1F5035) CreateReceiveIntent {
    owner_wallet: Address;
    signature: Slice as bytes64;
    signed_payload: Cell;
}

message(0x7E1F5036) ClaimReceiveIntent {
    owner_wallet: Address;
    signature: Slice as bytes64;
    signed_payload: Cell;
}

message(0x7E1F5037) CancelReceiveIntent {
    owner_wallet: Address;
    signature: Slice as bytes64;
    signed_payload: Cell;
}

message(0x7E1F5031) PublishPrivateFromVaultBalance {
    owner_wallet: Address;
    signature: Slice as bytes64;
    signed_payload: Cell;
}

message(0x7E1F5032) PublishPublicFromVaultBalance {
    owner_wallet: Address;
    signature: Slice as bytes64;
    signed_payload: Cell;
}

message(0x7E1F5033) SetProfileAvatarFromVaultBalance {
    owner_wallet: Address;
    signature: Slice as bytes64;
    signed_payload: Cell;
}

message(0x7E1F5034) MintUsernameFromVaultBalance {
    owner_wallet: Address;
    signature: Slice as bytes64;
    signed_payload: Cell;
}

message(0xA4F862C0) PublishPrivateFromVault {
    bounce_id: Int as uint64;
    bounce_tag: Int as uint160;
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
    bounce_tag: Int as uint160;
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

message(0x50A61121) ProfileAvatarTonExcessRefund {
    query_id: Int as uint64;
    owner_wallet: Address;
    amount: Int as uint128;
}


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
    refund_to_vault: Bool;
    nonce: Int as uint64;
    publish_kind: Int as uint8;
    body_hash: Int as uint256;
    refundable_amount: Int as uint128;
    created_at: Int as uint32;
}

struct PendingProfileAvatarPayment {
    owner_wallet: Address;
    amount: Int as uint128;
    created_at: Int as uint32;
}

struct PendingUsernameMintPayment {
    owner_wallet: Address;
    amount: Int as uint128;
    created_at: Int as uint32;
}

struct ReceiveIntent {
    sender_wallet: Address;
    recipient_wallet: Address;
    asset: Int as uint8;
    amount: Int as uint128;
    commitment: Int as uint256;
    client_nonce: Int as uint64;
    settlement_reserve_ton: Int as uint128;
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
    auth_pubkey: Int as uint256;
    publish_nonce: Int as uint64;
}


struct VaultReceiveIntentView {
    exists: Bool;
    sender_wallet: Address;
    recipient_wallet: Address;
    asset: Int;
    amount: Int;
    commitment: Int;
    client_nonce: Int;
    settlement_reserve_ton: Int;
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
    auth_pubkey: Int;
    publish_nonce: Int;
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
    profile_registry_bound: Bool;
    username_registry_bound: Bool;
    deployment_manifest_hash: Int;
    capsule_hub_address: Address;
    profile_registry_address: Address;
    username_registry_address: Address;
    vault_ath_wallet_address: Address;
    ath_master_address: Address;
    user_count: Int;
    key_record_count: Int;
    receive_intent_count: Int;
    pending_ath_withdrawal_count: Int;
    pending_publish_count: Int;
    pending_profile_avatar_payment_count: Int;
    pending_username_mint_payment_count: Int;
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
    profile_registry_address: Address;
    username_registry_address: Address;
    binding_flags: Int as uint8;
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
    pending_profile_avatar_payments: map<Int, PendingProfileAvatarPayment>;
    pending_username_mint_payments: map<Int, PendingUsernameMintPayment>;
    user_count: Int as uint64;
    key_record_count: Int as uint64;
    receive_intent_count: Int as uint64;
    processed_ath_deposit_count: Int as uint64;
    pending_ath_withdrawal_count: Int as uint64;
    // Packed pending counters: low 32 bits = publish, next 16 = profile avatar, next 16 = username mint.
    pending_publish_count: Int as uint64;

    init(vault_ath_wallet_address: Address, ath_master_address: Address, capsule_hub_address: Address, genesis_config_hash: Int, capsule_hub_bound: Bool, sealed: Bool, deployment_manifest_hash: Int) {
        self.vault_ath_wallet_address = vault_ath_wallet_address;
        self.ath_master_address = ath_master_address;
        self.capsule_hub_address = capsule_hub_address;
        self.profile_registry_address = capsule_hub_address;
        self.username_registry_address = capsule_hub_address;
        self.binding_flags = 0;
        if (capsule_hub_bound) {
            self.binding_flags = VAULT_BINDING_CAPSULE_HUB;
        }
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
        self.pending_profile_avatar_payments = emptyMap();
        self.pending_username_mint_payments = emptyMap();
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

    fun isBindingSet(mask: Int): Bool {
        return ((self.binding_flags / mask) % 2) == 1;
    }

    fun isCapsuleHubBound(): Bool {
        return self.isBindingSet(VAULT_BINDING_CAPSULE_HUB);
    }

    fun isProfileRegistryBound(): Bool {
        return self.isBindingSet(VAULT_BINDING_PROFILE_REGISTRY);
    }

    fun isUsernameRegistryBound(): Bool {
        return self.isBindingSet(VAULT_BINDING_USERNAME_REGISTRY);
    }

    fun requireGenesisController() {
        throwUnless(15030, self.genesis_config_hash != 0);
        throwUnless(15031, beginCell().storeAddress(sender()).endCell().hash() == self.genesis_config_hash);
    }

    fun emptyUser(): UserState {
        return UserState {
            ton_balance: 0,
            ath_balance: 0,
            current_key_id: 0,
            auth_pubkey: 0,
            publish_nonce: 0
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
        let ownerSlice: Slice = owner.asSlice();
        return ownerSlice.loadUint(11) == 1024;
    }

    fun pendingPublishCount(): Int {
        return self.pending_publish_count % VAULT_PENDING_PROFILE_COUNT_UNIT;
    }

    fun pendingProfileAvatarPaymentCount(): Int {
        return (self.pending_publish_count / VAULT_PENDING_PROFILE_COUNT_UNIT) % VAULT_PENDING_PROFILE_COUNT_MOD;
    }

    fun pendingUsernameMintPaymentCount(): Int {
        return self.pending_publish_count / VAULT_PENDING_USERNAME_COUNT_UNIT;
    }

    fun incrementPendingPublishCount() {
        self.pending_publish_count += VAULT_PENDING_PUBLISH_COUNT_UNIT;
    }

    fun decrementPendingPublishCount() {
        self.pending_publish_count -= VAULT_PENDING_PUBLISH_COUNT_UNIT;
    }

    fun incrementPendingProfileAvatarPaymentCount() {
        throwUnless(16690, self.pendingProfileAvatarPaymentCount() < VAULT_PENDING_PROFILE_COUNT_MAX);
        self.pending_publish_count += VAULT_PENDING_PROFILE_COUNT_UNIT;
    }

    fun decrementPendingProfileAvatarPaymentCount() {
        self.pending_publish_count -= VAULT_PENDING_PROFILE_COUNT_UNIT;
    }

    fun incrementPendingUsernameMintPaymentCount() {
        throwUnless(16790, self.pendingUsernameMintPaymentCount() < VAULT_PENDING_USERNAME_COUNT_MAX);
        self.pending_publish_count += VAULT_PENDING_USERNAME_COUNT_UNIT;
    }

    fun decrementPendingUsernameMintPaymentCount() {
        self.pending_publish_count -= VAULT_PENDING_USERNAME_COUNT_UNIT;
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

    fun computeProfileAvatarPaymentId(ownerWallet: Address, clientNonce: Int, avatarHash: Int): Int {
        return beginCell()
            .storeUint(VAULT_PROFILE_AVATAR_PAYMENT_ID_DOMAIN, 32)
            .storeAddress(ownerWallet)
            .storeUint(clientNonce, 64)
            .storeUint(avatarHash, 256)
            .endCell()
            .hash() % UINT64_MOD;
    }

    fun computeUsernameNameHash(username: Slice): Int {
        return beginCell()
            .storeUint(USERNAME_NAME_HASH_DOMAIN, 32)
            .storeSlice(username)
            .endCell()
            .hash();
    }

    fun computeUsernameMintPaymentId(ownerWallet: Address, clientNonce: Int, nameHash: Int): Int {
        return beginCell()
            .storeUint(VAULT_USERNAME_MINT_PAYMENT_ID_DOMAIN, 32)
            .storeAddress(ownerWallet)
            .storeUint(clientNonce, 64)
            .storeUint(nameHash, 256)
            .endCell()
            .hash() % UINT64_MOD;
    }

    fun profileRegistryAthWalletAddress(): Address {
        return self.deriveAthWalletAddress(self.profile_registry_address);
    }

    fun usernameRegistryAthWalletAddress(): Address {
        return self.deriveAthWalletAddress(self.username_registry_address);
    }

    fun profileAvatarTonCharge(): Int {
        return VAULT_PROFILE_AVATAR_LOCAL_EXEC_RESERVE + VAULT_PROFILE_AVATAR_ATH_WALLET_REQUEST_VALUE;
    }

    fun usernameMintTonCharge(): Int {
        return VAULT_USERNAME_MINT_LOCAL_EXEC_RESERVE + VAULT_USERNAME_MINT_ATH_WALLET_REQUEST_VALUE;
    }

    fun usernamePriceForLength(nameLen: Int): Int {
        throwUnless(16650, nameLen >= 4);
        throwUnless(16651, nameLen <= USERNAME_MAX_LENGTH);
        if (nameLen == 4) {
            return USERNAME_PRICE_4_CHARS;
        }
        if (nameLen == 5) {
            return USERNAME_PRICE_5_CHARS;
        }
        return USERNAME_PRICE_6_PLUS_CHARS;
    }

    fun isValidUsernameBytes(nameLen: Int, username: Slice): Bool {
        if ((nameLen < 4) || (nameLen > USERNAME_MAX_LENGTH)) {
            return false;
        }
        if (username.bits() != (nameLen * 8)) {
            return false;
        }
        if (!username.refsEmpty()) {
            return false;
        }

        let cursor: Slice = username;
        let i: Int = 0;
        while (i < nameLen) {
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

    fun requireValidProfileAvatarPointer(ownerWallet: Address, avatarHash: Int, avatarStreamId: Int, avatarPartCount: Int, mediaFormat: Int) {
        throwUnless(16640, self.isBasechainAddress(ownerWallet));
        throwUnless(16641, avatarHash != 0);
        throwUnless(16642, avatarStreamId != 0);
        throwUnless(16643, avatarPartCount > 0);
        throwUnless(16644, avatarPartCount <= PROFILE_AVATAR_MAX_PARTS);
        throwUnless(16645, mediaFormat == PROFILE_AVATAR_MEDIA_FORMAT_WEBP);
    }


    fun discountedFee(owner: Address, fullFee: Int): Int {
        if (!self.sealed) {
            return fullFee;
        }
        if (self.genesis_config_hash > VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH) {
            return fullFee;
        }
        let minFee: Int = PLATO_MIN_PROTOCOL_FEE_TON;
        if (fullFee < minFee) {
            minFee = fullFee;
        }
        let user: UserState = self.getUserOrEmpty(owner);
        if (user.ath_balance >= ATH_FULL_DISCOUNT_AMOUNT) {
            return minFee;
        }
        let remaining: Int = ATH_FULL_DISCOUNT_AMOUNT - user.ath_balance;
        let fee: Int = ((fullFee * remaining) + ATH_FULL_DISCOUNT_AMOUNT - 1) / ATH_FULL_DISCOUNT_AMOUNT;
        if (fee < minFee) {
            return minFee;
        }
        return fee;
    }

    fun isPublishProfileValid(publishKind: Int, sizeClass: Int, cryptoSuite: Int, header0: Int, header1: Int): Bool {
        if (publishKind == PUBLISH_KIND_PRIVATE) {
            if (header0 == 0) { return false; }
            if (header1 == 0) { return false; }
            if (!self.isAllowedPrivateSizeClass(sizeClass)) { return false; }
            return cryptoSuite == CRYPTO_SUITE_HYBRID;
        }
        if (publishKind == PUBLISH_KIND_PUBLIC) {
            if (sizeClass != SIZE_CLASS_STANDARD) { return false; }
            if (cryptoSuite != CRYPTO_SUITE_PUBLIC_NONE) { return false; }
            if (header0 == 0) { return false; }
            if (header1 != 0) { return false; }
            return true;
        }
        return false;
    }

    fun isAllowedPrivateSizeClass(sizeClass: Int): Bool {
        return sizeClass == SIZE_CLASS_1K
            || sizeClass == SIZE_CLASS_2K
            || sizeClass == SIZE_CLASS_4K
            || sizeClass == SIZE_CLASS_8K
            || sizeClass == SIZE_CLASS_16K
            || sizeClass == SIZE_CLASS_32K;
    }

    fun privateUsefulBytes(sizeClass: Int): Int {
        throwUnless(16326, self.isAllowedPrivateSizeClass(sizeClass));
        return sizeClass * 1024;
    }

    fun privateBodyOverheadBytes(cryptoSuite: Int): Int {
        throwUnless(16327, cryptoSuite == CRYPTO_SUITE_HYBRID);
        return CAPSULEHUB_PRIVATE_HYBRID_BODY_OVERHEAD_BYTES;
    }

    fun privateBodyBytes(sizeClass: Int, cryptoSuite: Int): Int {
        return self.privateBodyOverheadBytes(cryptoSuite) + self.privateUsefulBytes(sizeClass);
    }

    fun privateBodyBits(sizeClass: Int, cryptoSuite: Int): Int {
        return self.privateBodyBytes(sizeClass, cryptoSuite) * 8;
    }

    fun privateBodyCells(sizeClass: Int, cryptoSuite: Int): Int {
        return (self.privateBodyBytes(sizeClass, cryptoSuite) + 126) / 127;
    }

    fun privateBodyRefs(sizeClass: Int, cryptoSuite: Int): Int {
        return self.privateBodyCells(sizeClass, cryptoSuite) - 1;
    }

    fun isExactCapsuleCell(cell: Cell, expectedCells: Int, expectedBits: Int, expectedRefs: Int): Bool {
        try {
            let size: DataSize = cell.computeDataSize(expectedCells);
            return size.cells == expectedCells && size.bits == expectedBits && size.refs == expectedRefs;
        } catch (exitCode) {
            return false;
        }
    }

    fun isPublicCapsuleCell(cell: Cell, maxCells: Int, maxBits: Int, maxRefs: Int, requireByteAligned: Bool): Bool {
        try {
            let size: DataSize = cell.computeDataSize(maxCells);
            if (!(size.cells <= maxCells)) { return false; }
            if (!(size.bits > 0)) { return false; }
            if (!(size.bits <= maxBits)) { return false; }
            if (!(size.refs <= maxRefs)) { return false; }
            if (requireByteAligned && !(size.bits % 8 == 0)) { return false; }
            return true;
        } catch (exitCode) {
            return false;
        }
    }

    fun isPrivateCapsuleShapeValid(sizeClass: Int, cryptoSuite: Int, header0: Cell, header1: Cell, body: Cell): Bool {
        if (!self.isExactCapsuleCell(header0, CAPSULEHUB_PRIVATE_HEADER0_CELLS, CAPSULEHUB_PRIVATE_HEADER0_BITS, CAPSULEHUB_PRIVATE_HEADER0_REFS)) {
            return false;
        }
        if (!self.isExactCapsuleCell(header1, CAPSULEHUB_PRIVATE_HEADER1_CELLS, CAPSULEHUB_PRIVATE_HEADER1_BITS, CAPSULEHUB_PRIVATE_HEADER1_REFS)) {
            return false;
        }
        return self.isExactCapsuleCell(body, self.privateBodyCells(sizeClass, cryptoSuite), self.privateBodyBits(sizeClass, cryptoSuite), self.privateBodyRefs(sizeClass, cryptoSuite));
    }

    fun isPublicCapsuleShapeValid(header: Cell, body: Cell): Bool {
        if (!self.isPublicCapsuleCell(header, CAPSULEHUB_PUBLIC_HEADER_MAX_CELLS, CAPSULEHUB_PUBLIC_HEADER_MAX_BITS, CAPSULEHUB_PUBLIC_HEADER_MAX_REFS, true)) {
            return false;
        }
        return self.isPublicCapsuleCell(body, CAPSULEHUB_PUBLIC_BODY_MAX_CELLS, CAPSULEHUB_PUBLIC_BODY_MAX_BITS, CAPSULEHUB_PUBLIC_BODY_MAX_REFS, true);
    }

    fun privatePublishLocalExecReserve(sizeClass: Int, cryptoSuite: Int): Int {
        throwUnless(16323, self.isAllowedPrivateSizeClass(sizeClass));
        throwUnless(16324, cryptoSuite == CRYPTO_SUITE_HYBRID);
        if (sizeClass == SIZE_CLASS_1K) { return VAULT_PUBLISH_PRIVATE_HYBRID_1K_LOCAL_EXEC_RESERVE; }
        if (sizeClass == SIZE_CLASS_2K) { return VAULT_PUBLISH_PRIVATE_HYBRID_2K_LOCAL_EXEC_RESERVE; }
        if (sizeClass == SIZE_CLASS_4K) { return VAULT_PUBLISH_PRIVATE_HYBRID_4K_LOCAL_EXEC_RESERVE; }
        if (sizeClass == SIZE_CLASS_8K) { return VAULT_PUBLISH_PRIVATE_HYBRID_8K_LOCAL_EXEC_RESERVE; }
        if (sizeClass == SIZE_CLASS_16K) { return VAULT_PUBLISH_PRIVATE_HYBRID_16K_LOCAL_EXEC_RESERVE; }
        return VAULT_PUBLISH_PRIVATE_HYBRID_32K_LOCAL_EXEC_RESERVE;
    }

    fun privateCapsulehubExecReserve(sizeClass: Int, cryptoSuite: Int): Int {
        throwUnless(16329, self.isAllowedPrivateSizeClass(sizeClass));
        throwUnless(16325, cryptoSuite == CRYPTO_SUITE_HYBRID);
        if (sizeClass == SIZE_CLASS_1K) { return CAPSULEHUB_PRIVATE_HYBRID_1K_EXEC_RESERVE; }
        if (sizeClass == SIZE_CLASS_2K) { return CAPSULEHUB_PRIVATE_HYBRID_2K_EXEC_RESERVE; }
        if (sizeClass == SIZE_CLASS_4K) { return CAPSULEHUB_PRIVATE_HYBRID_4K_EXEC_RESERVE; }
        if (sizeClass == SIZE_CLASS_8K) { return CAPSULEHUB_PRIVATE_HYBRID_8K_EXEC_RESERVE; }
        if (sizeClass == SIZE_CLASS_16K) { return CAPSULEHUB_PRIVATE_HYBRID_16K_EXEC_RESERVE; }
        return CAPSULEHUB_PRIVATE_HYBRID_32K_EXEC_RESERVE;
    }

    fun publishLocalExecReserve(publishKind: Int, sizeClass: Int, cryptoSuite: Int): Int {
        if (publishKind == PUBLISH_KIND_PUBLIC) {
            throwUnless(16320, sizeClass == SIZE_CLASS_STANDARD);
            throwUnless(16321, cryptoSuite == CRYPTO_SUITE_PUBLIC_NONE);
            return VAULT_PUBLISH_PUBLIC_LOCAL_EXEC_RESERVE;
        }
        throwUnless(16322, publishKind == PUBLISH_KIND_PRIVATE);
        return self.privatePublishLocalExecReserve(sizeClass, cryptoSuite);
    }

    fun canonicalPublishMaxCharge(owner: Address, publishKind: Int, sizeClass: Int, cryptoSuite: Int): Int {
        let localExecReserve: Int = self.publishLocalExecReserve(publishKind, sizeClass, cryptoSuite);
        if (publishKind == PUBLISH_KIND_PUBLIC) {
            return localExecReserve
                + self.discountedFee(owner, PLATO_PUBLIC_POST_FEE_TON)
                + CAPSULEHUB_PUBLIC_EXEC_RESERVE
                + CAPSULEHUB_PUBLIC_STORAGE_KEEPALIVE_RESERVE
                + CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT
                + CAPSULEHUB_ACK_FORWARD_RESERVE;
        }
        throwUnless(16328, cryptoSuite == CRYPTO_SUITE_HYBRID);
        return localExecReserve
            + self.discountedFee(owner, PLATO_PRIVATE_LONG_TERM_FEE_TON)
            + self.privateCapsulehubExecReserve(sizeClass, cryptoSuite)
            + CAPSULEHUB_PRIVATE_STORAGE_KEEPALIVE_RESERVE
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

    fun capsulehubCallValue(maxCharge: Int, localExecReserve: Int): Int {
        throwUnless(16340, maxCharge >= localExecReserve);
        return maxCharge - localExecReserve;
    }

    fun computePublishBounceId(publishId: Int): Int {
        return publishId % UINT64_MOD;
    }

    fun computePublishBounceTag(publishId: Int): Int {
        return beginCell()
            .storeUint(publishId, 256)
            .endCell()
            .hash() % UINT160_MOD;
    }

    fun protocolFeePaid(owner: Address, publishKind: Int, sizeClass: Int, cryptoSuite: Int): Int {
        if (publishKind == PUBLISH_KIND_PUBLIC) {
            throwUnless(16350, sizeClass == SIZE_CLASS_STANDARD);
            throwUnless(16351, cryptoSuite == CRYPTO_SUITE_PUBLIC_NONE);
            return self.discountedFee(owner, PLATO_PUBLIC_POST_FEE_TON);
        }
        throwUnless(16352, publishKind == PUBLISH_KIND_PRIVATE);
        throwUnless(16353, self.isAllowedPrivateSizeClass(sizeClass));
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
        if (!pending.refund_to_vault) {
            self.refundPublishValue(pending.owner_wallet, pending.refundable_amount, amount);
            return;
        }
        let refundAmount: Int = 0;
        if (amount > VAULT_PENDING_PUBLISH_REFUND_EXEC_RESERVE) {
            refundAmount = amount - VAULT_PENDING_PUBLISH_REFUND_EXEC_RESERVE;
        }
        if (refundAmount > pending.refundable_amount) {
            refundAmount = pending.refundable_amount;
        }
        if (refundAmount <= 0) {
            return;
        }
        let user: UserState = self.getUserOrEmpty(pending.owner_wallet);
        user.ton_balance += refundAmount;
        self.users.set(pending.owner_wallet, user);
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

    fun restorePendingProfileAvatarPayment(queryId: Int, pending: PendingProfileAvatarPayment) {
        let user: UserState = self.getUserOrEmpty(pending.owner_wallet);
        user.ath_balance += pending.amount;
        self.users.set(pending.owner_wallet, user);
        self.pending_profile_avatar_payments.del(queryId);
        self.decrementPendingProfileAvatarPaymentCount();
    }

    fun restorePendingUsernameMintPayment(queryId: Int, pending: PendingUsernameMintPayment) {
        let user: UserState = self.getUserOrEmpty(pending.owner_wallet);
        user.ath_balance += pending.amount;
        self.users.set(pending.owner_wallet, user);
        self.pending_username_mint_payments.del(queryId);
        self.decrementPendingUsernameMintPaymentCount();
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
        throwUnless(16100, cryptoSuiteMask == CRYPTO_SUITE_HYBRID);
        return VAULT_KEY_RECORD_LONG_TERM_STORAGE_ENDOWMENT;
    }

    fun validatePqPubkeyCell(pqLen: Int, cryptoSuiteMask: Int, pqPubkey: Cell) {
        throwUnless(16107, cryptoSuiteMask == CRYPTO_SUITE_HYBRID);
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
    }

    fun validateKeyProfile(encPubkey: Int, signPubkey: Int, pqHash: Int, pqLen: Int, pqPubkey: Cell, cryptoSuiteMask: Int) {
        throwUnless(16101, encPubkey != 0);
        throwUnless(16102, signPubkey != 0);
        throwUnless(16107, cryptoSuiteMask == CRYPTO_SUITE_HYBRID);
        throwUnless(16105, pqHash != 0);
        throwUnless(16106, pqLen == MLKEM768_PUBKEY_LEN);
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
        throwUnless(15010, !self.isCapsuleHubBound());
        throwUnless(15011, msg.deployment_manifest_hash != 0);
        throwUnless(15012, self.deployment_manifest_hash == 0 || self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(15018, self.isBasechainAddress(msg.counterpart_address));
        throwUnless(15019, msg.counterpart_address != myAddress());
        self.deployment_manifest_hash = msg.deployment_manifest_hash;
        self.capsule_hub_address = msg.counterpart_address;
        self.binding_flags += VAULT_BINDING_CAPSULE_HUB;
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

    receive(msg: BindProfileRegistry) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(15025, msg.deployment_manifest_hash > 1);
        throwUnless(15026, !self.isProfileRegistryBound());
        throwUnless(15027, self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(15028, self.isBasechainAddress(msg.profile_registry_address));
        throwUnless(15029, msg.profile_registry_address != myAddress());
        self.profile_registry_address = msg.profile_registry_address;
        self.binding_flags += VAULT_BINDING_PROFILE_REGISTRY;
    }

    receive(msg: BindUsernameRegistry) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(15032, msg.deployment_manifest_hash > 1);
        throwUnless(15033, !self.isUsernameRegistryBound());
        throwUnless(15034, self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(15035, self.isBasechainAddress(msg.username_registry_address));
        throwUnless(15036, msg.username_registry_address != myAddress());
        self.username_registry_address = msg.username_registry_address;
        self.binding_flags += VAULT_BINDING_USERNAME_REGISTRY;
    }

    receive(msg: SealGenesis) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(15020, msg.deployment_manifest_hash > 1);
        throwUnless(15021, self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(15022, self.isCapsuleHubBound());
        throwUnless(15023, self.vault_ath_wallet_address != sender());
        throwUnless(15024, self.vault_ath_wallet_address == self.deriveAthWalletAddress(myAddress()));
        throwUnless(15037, self.isProfileRegistryBound());
        throwUnless(15038, self.isUsernameRegistryBound());
        throwUnless(15039, self.isBasechainAddress(self.profile_registry_address));
        throwUnless(15040, self.isBasechainAddress(self.username_registry_address));
        throwUnless(15041, self.profile_registry_address != myAddress());
        throwUnless(15042, self.username_registry_address != myAddress());
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
        let pendingUsernameOpt: PendingUsernameMintPayment? = self.pending_username_mint_payments.get(msg.query_id);
        if (pendingUsernameOpt != null) {
            let pendingUsername: PendingUsernameMintPayment = pendingUsernameOpt!!;
            throwUnless(16660, pendingUsername.amount == msg.amount);
            if (sender() == self.usernameRegistryAthWalletAddress()) {
                self.pending_username_mint_payments.del(msg.query_id);
                self.decrementPendingUsernameMintPaymentCount();
            } else {
                throwUnless(16661, sender() == self.vault_ath_wallet_address);
                self.restorePendingUsernameMintPayment(msg.query_id, pendingUsername);
            }
            return;
        }

        let pendingProfileOpt: PendingProfileAvatarPayment? = self.pending_profile_avatar_payments.get(msg.query_id);
        if (pendingProfileOpt != null) {
            let pendingProfile: PendingProfileAvatarPayment = pendingProfileOpt!!;
            throwUnless(16620, pendingProfile.amount == msg.amount);
            if (sender() == self.profileRegistryAthWalletAddress()) {
                self.pending_profile_avatar_payments.del(msg.query_id);
                self.decrementPendingProfileAvatarPaymentCount();
            } else {
                throwUnless(16621, sender() == self.vault_ath_wallet_address);
                self.restorePendingProfileAvatarPayment(msg.query_id, pendingProfile);
            }
            return;
        }

        if (sender() == self.vault_ath_wallet_address) {
            return;
        }

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
        let pendingUsernameOpt: PendingUsernameMintPayment? = self.pending_username_mint_payments.get(msg.query_id);
        if (pendingUsernameOpt != null) {
            let pendingUsername: PendingUsernameMintPayment = pendingUsernameOpt!!;
            throwUnless(16670, pendingUsername.amount == msg.amount);
            throwUnless(16671, sender() == self.vault_ath_wallet_address);
            self.restorePendingUsernameMintPayment(msg.query_id, pendingUsername);
            return;
        }

        let pendingProfileOpt: PendingProfileAvatarPayment? = self.pending_profile_avatar_payments.get(msg.query_id);
        if (pendingProfileOpt != null) {
            let pendingProfile: PendingProfileAvatarPayment = pendingProfileOpt!!;
            throwUnless(16630, pendingProfile.amount == msg.amount);
            throwUnless(16631, sender() == self.vault_ath_wallet_address);
            self.restorePendingProfileAvatarPayment(msg.query_id, pendingProfile);
            return;
        }

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

    bounced(msg: bounced<ATHTransferRequestVaultProfileAvatar>) {
        self.requireSealed();
        throwUnless(16635, sender() == self.vault_ath_wallet_address);
        throwUnless(16636, msg.amount > 0);
        let pendingProfileOpt: PendingProfileAvatarPayment? = self.pending_profile_avatar_payments.get(msg.query_id);
        throwUnless(16637, pendingProfileOpt != null);
        let pendingProfile: PendingProfileAvatarPayment = pendingProfileOpt!!;
        throwUnless(16638, pendingProfile.amount == msg.amount);
        self.restorePendingProfileAvatarPayment(msg.query_id, pendingProfile);
    }

    bounced(msg: bounced<ATHTransferRequestVaultMintUsername>) {
        self.requireSealed();
        throwUnless(16675, sender() == self.vault_ath_wallet_address);
        throwUnless(16676, msg.amount > 0);
        let pendingUsernameOpt: PendingUsernameMintPayment? = self.pending_username_mint_payments.get(msg.query_id);
        throwUnless(16677, pendingUsernameOpt != null);
        let pendingUsername: PendingUsernameMintPayment = pendingUsernameOpt!!;
        throwUnless(16678, pendingUsername.amount == msg.amount);
        self.restorePendingUsernameMintPayment(msg.query_id, pendingUsername);
    }

    receive(msg: ProfileAvatarTonExcessRefund) {
        self.requireSealed();
        throwUnless(16680, self.isProfileRegistryBound());
        throwUnless(16681, sender() == self.profile_registry_address);
        throwUnless(16682, self.isBasechainAddress(msg.owner_wallet));
        throwUnless(16683, msg.amount > 0);
        let userOpt: UserState? = self.users.get(msg.owner_wallet);
        throwUnless(16684, userOpt != null);
        if (context().value <= VAULT_PROFILE_AVATAR_EXCESS_REFUND_EXEC_RESERVE) {
            return;
        }
        let creditAmount: Int = context().value - VAULT_PROFILE_AVATAR_EXCESS_REFUND_EXEC_RESERVE;
        if (creditAmount > msg.amount) {
            creditAmount = msg.amount;
        }
        if (creditAmount <= 0) {
            return;
        }
        let user: UserState = userOpt!!;
        user.ton_balance += creditAmount;
        self.users.set(msg.owner_wallet, user);
    }

    receive(msg: TopUpStorageReserve) {
        // Accept TON for Vault storage reserve only. No user balance, authority, or config state changes.
    }



    receive(msg: RegisterMessagingKeys) {
        self.requireSealed();
        self.validateKeyProfile(msg.enc_pubkey, msg.sign_pubkey, msg.pq_kem_pubkey_hash, msg.pq_kem_pubkey_len, msg.pq_kem_pubkey, msg.crypto_suite_mask);
        throwUnless(16118, msg.auth_pubkey != 0);
        throwUnless(16119, msg.auth_pubkey != msg.sign_pubkey);
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
        user.auth_pubkey = msg.auth_pubkey;
        self.users.set(sender(), user);
    }

    external(msg: ReplaceMessagingKeys) {
        let userOpt: UserState? = self.users.get(msg.owner_wallet);
        throwUnless(16120, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16121, user.current_key_id != 0);
        throwUnless(16128, user.auth_pubkey != 0);
        throwUnless(16130, checkSignature(msg.signed_payload.hash(), msg.signature, user.auth_pubkey));

        let signedPayload: Slice = msg.signed_payload.beginParse();
        let signedDomain: Int = signedPayload.loadUint(32);
        throwUnless(16131, signedDomain == VAULT_REPLACE_MESSAGING_KEYS_SIGNING_DOMAIN);
        let signedManifestHash: Int = signedPayload.loadUint(256);
        throwUnless(16132, signedManifestHash == self.deployment_manifest_hash);
        let signedVaultHash: Int = signedPayload.loadUint(256);
        let vaultAddressSlice: Slice = myAddress().asSlice();
        throwUnless(16133, vaultAddressSlice.loadUint(11) == 1024);
        throwUnless(16133, signedVaultHash == vaultAddressSlice.loadUint(256));
        let signedOwnerHash: Int = signedPayload.loadUint(256);
        let ownerPrefix: Slice = msg.owner_wallet.asSlice();
        throwUnless(16134, ownerPrefix.loadUint(11) == 1024);
        throwUnless(16134, signedOwnerHash == ownerPrefix.loadUint(256));
        let clientNonce: Int = signedPayload.loadUint(64);
        throwUnless(16135, clientNonce == user.publish_nonce);
        throwUnless(16136, signedPayload.bits() == 0);
        throwUnless(16137, signedPayload.refs() == 1);
        let required: Int = self.keyRecordStorageEndowment(CRYPTO_SUITE_HYBRID);
        required += VAULT_STATE_GROWTH_EXEC_RESERVE;
        throwUnless(16126, user.ton_balance >= required);

        acceptMessage();

        let actionPayload: Slice = signedPayload.loadRef().beginParse();
        let encPubkey: Int = actionPayload.loadUint(256);
        let signPubkey: Int = actionPayload.loadUint(256);
        let pqKemPubkeyHash: Int = actionPayload.loadUint(256);
        let pqKemPubkeyLen: Int = actionPayload.loadUint(16);
        let pqKemPubkey: Cell = actionPayload.loadRef();
        let cryptoSuiteMask: Int = actionPayload.loadUint(16);
        throwUnless(16138, actionPayload.bits() == 0);
        throwUnless(16139, actionPayload.refs() == 0);

        self.validateKeyProfile(encPubkey, signPubkey, pqKemPubkeyHash, pqKemPubkeyLen, pqKemPubkey, cryptoSuiteMask);
        throwUnless(16129, signPubkey != user.auth_pubkey);

        let oldRecordOpt: KeyRecord? = self.key_records.get(user.current_key_id);
        throwUnless(16122, oldRecordOpt != null);
        let oldRecord: KeyRecord = oldRecordOpt!!;
        throwUnless(16123, oldRecord.owner_wallet == msg.owner_wallet);
        throwUnless(16124, oldRecord.revoked_lt == 0);
        throwUnless(16125, oldRecord.key_generation < UINT32_MAX);

        oldRecord.revoked_at = now();
        oldRecord.revoked_lt = curLt();
        self.key_records.set(user.current_key_id, oldRecord);

        let keyGeneration: Int = oldRecord.key_generation + 1;
        let newKeyId: Int = self.computeKeyId(msg.owner_wallet, keyGeneration, encPubkey, signPubkey, pqKemPubkeyHash, pqKemPubkeyLen, cryptoSuiteMask);
        throwUnless(16127, !self.key_records.exists(newKeyId));

        self.key_records.set(newKeyId, KeyRecord {
            owner_wallet: msg.owner_wallet,
            key_generation: keyGeneration,
            enc_pubkey: encPubkey,
            sign_pubkey: signPubkey,
            pq_kem_pubkey_hash: pqKemPubkeyHash,
            pq_kem_pubkey_len: pqKemPubkeyLen,
            pq_kem_pubkey: pqKemPubkey,
            crypto_suite_mask: cryptoSuiteMask,
            created_at: now(),
            created_lt: curLt(),
            revoked_at: 0,
            revoked_lt: 0
        });
        self.key_record_count += 1;
        user.current_key_id = newKeyId;
        user.ton_balance -= required;
        user.publish_nonce += 1;
        self.users.set(msg.owner_wallet, user);
    }



    external(msg: CreateReceiveIntent) {
        self.requireSealed();
        let userOpt: UserState? = self.users.get(msg.owner_wallet);
        throwUnless(16214, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16221, user.auth_pubkey != 0);
        throwUnless(16222, checkSignature(msg.signed_payload.hash(), msg.signature, user.auth_pubkey));

        let signedPayload: Slice = msg.signed_payload.beginParse();
        let signedDomain: Int = signedPayload.loadUint(32);
        throwUnless(16223, signedDomain == VAULT_RECEIVE_INTENT_SIGNING_DOMAIN);
        let signedManifestHash: Int = signedPayload.loadUint(256);
        throwUnless(16224, signedManifestHash == self.deployment_manifest_hash);
        let signedVaultHash: Int = signedPayload.loadUint(256);
        let vaultAddressSlice: Slice = myAddress().asSlice();
        throwUnless(16225, vaultAddressSlice.loadUint(11) == 1024);
        throwUnless(16225, signedVaultHash == vaultAddressSlice.loadUint(256));
        let signedAction: Int = signedPayload.loadUint(8);
        throwUnless(16226, signedAction == VAULT_RECEIVE_INTENT_ACTION_CREATE);
        let signedOwnerHash: Int = signedPayload.loadUint(256);
        let ownerPrefix: Slice = msg.owner_wallet.asSlice();
        throwUnless(16227, ownerPrefix.loadUint(11) == 1024);
        throwUnless(16227, signedOwnerHash == ownerPrefix.loadUint(256));
        let clientNonce: Int = signedPayload.loadUint(64);
        throwUnless(16233, clientNonce == user.publish_nonce);
        acceptMessage();
        user.publish_nonce += 1;
        self.users.set(msg.owner_wallet, user);
        commit();

        if (!(signedPayload.bits() == 0)) {
            return;
        }
        if (!(signedPayload.refs() == 1)) {
            return;
        }
        let actionPayload: Slice = signedPayload.loadRef().beginParse();
        let asset: Int = actionPayload.loadUint(8);
        let amount: Int = actionPayload.loadUint(128);
        let recipientWallet: Address = actionPayload.loadAddress();
        let commitment: Int = actionPayload.loadUint(256);
        if (!(actionPayload.bits() == 0)) {
            return;
        }
        if (!(actionPayload.refs() == 0)) {
            return;
        }
        if (!((asset == ASSET_TON) || (asset == ASSET_ATH))) {
            return;
        }
        if (!(amount > 0)) {
            return;
        }
        if (!(commitment != 0)) {
            return;
        }

        let tonReserve: Int = VAULT_RECEIVE_INTENT_STORAGE_ENDOWMENT + VAULT_STATE_GROWTH_EXEC_RESERVE + VAULT_RECEIVE_INTENT_SETTLEMENT_EXEC_RESERVE;
        if (asset == ASSET_TON) {
            if (!(user.ton_balance >= amount + tonReserve)) {
                return;
            }
            user.ton_balance -= (amount + tonReserve);
        } else {
            if (!(self.isBasechainAddress(msg.owner_wallet))) {
                return;
            }
            if (!(self.isBasechainAddress(recipientWallet))) {
                return;
            }
            if (!(user.ath_balance >= amount)) {
                return;
            }
            if (!(user.ton_balance >= tonReserve)) {
                return;
            }
            user.ath_balance -= amount;
            user.ton_balance -= tonReserve;
        }

        let intentId: Int = self.computeReceiveIntentId(msg.owner_wallet, recipientWallet, asset, amount, clientNonce);
        if (self.receive_intents.exists(intentId)) {
            return;
        }

        self.users.set(msg.owner_wallet, user);
        self.receive_intents.set(intentId, ReceiveIntent {
            sender_wallet: msg.owner_wallet,
            recipient_wallet: recipientWallet,
            asset: asset,
            amount: amount,
            commitment: commitment,
            client_nonce: clientNonce,
            settlement_reserve_ton: VAULT_RECEIVE_INTENT_SETTLEMENT_EXEC_RESERVE,
            created_at: now(),
            claimed: false
        });
        self.receive_intent_count += 1;
    }

    external(msg: ClaimReceiveIntent) {
        self.requireSealed();
        let userOpt: UserState? = self.users.get(msg.owner_wallet);
        throwUnless(16239, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16240, user.auth_pubkey != 0);
        throwUnless(16241, checkSignature(msg.signed_payload.hash(), msg.signature, user.auth_pubkey));

        let signedPayload: Slice = msg.signed_payload.beginParse();
        let signedDomain: Int = signedPayload.loadUint(32);
        throwUnless(16242, signedDomain == VAULT_RECEIVE_INTENT_SIGNING_DOMAIN);
        let signedManifestHash: Int = signedPayload.loadUint(256);
        throwUnless(16243, signedManifestHash == self.deployment_manifest_hash);
        let signedVaultHash: Int = signedPayload.loadUint(256);
        let vaultAddressSlice: Slice = myAddress().asSlice();
        throwUnless(16244, vaultAddressSlice.loadUint(11) == 1024);
        throwUnless(16244, signedVaultHash == vaultAddressSlice.loadUint(256));
        let signedAction: Int = signedPayload.loadUint(8);
        throwUnless(16245, signedAction == VAULT_RECEIVE_INTENT_ACTION_CLAIM);
        let signedOwnerHash: Int = signedPayload.loadUint(256);
        let ownerPrefix: Slice = msg.owner_wallet.asSlice();
        throwUnless(16246, ownerPrefix.loadUint(11) == 1024);
        throwUnless(16246, signedOwnerHash == ownerPrefix.loadUint(256));
        let clientNonce: Int = signedPayload.loadUint(64);
        throwUnless(16249, clientNonce == user.publish_nonce);
        acceptMessage();
        user.publish_nonce += 1;
        self.users.set(msg.owner_wallet, user);
        commit();

        if (!(signedPayload.bits() == 0)) {
            return;
        }
        if (!(signedPayload.refs() == 1)) {
            return;
        }
        let actionPayload: Slice = signedPayload.loadRef().beginParse();
        let intentId: Int = actionPayload.loadUint(256);
        let secret32: Int = actionPayload.loadUint(256);
        if (!(actionPayload.bits() == 0)) {
            return;
        }
        if (!(actionPayload.refs() == 0)) {
            return;
        }

        let intentOpt: ReceiveIntent? = self.receive_intents.get(intentId);
        if (intentOpt == null) {
            return;
        }
        let intent: ReceiveIntent = intentOpt!!;
        if (intent.claimed) {
            return;
        }
        if (!(msg.owner_wallet == intent.recipient_wallet)) {
            return;
        }
        if (intent.asset == ASSET_ATH) {
            if (!(self.isBasechainAddress(msg.owner_wallet))) {
                return;
            }
        }
        let expected: Int = self.computeReceiveIntentCommitment(intentId, msg.owner_wallet, secret32);
        if (!(expected == intent.commitment)) {
            return;
        }

        if (intent.asset == ASSET_TON) {
            user.ton_balance += intent.amount;
        } else {
            user.ath_balance += intent.amount;
        }

        self.users.set(msg.owner_wallet, user);
        self.receive_intents.del(intentId);
        self.receive_intent_count -= 1;
    }

    external(msg: CancelReceiveIntent) {
        self.requireSealed();
        let userOpt: UserState? = self.users.get(msg.owner_wallet);
        throwUnless(16252, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16253, user.auth_pubkey != 0);
        throwUnless(16254, checkSignature(msg.signed_payload.hash(), msg.signature, user.auth_pubkey));

        let signedPayload: Slice = msg.signed_payload.beginParse();
        let signedDomain: Int = signedPayload.loadUint(32);
        throwUnless(16255, signedDomain == VAULT_RECEIVE_INTENT_SIGNING_DOMAIN);
        let signedManifestHash: Int = signedPayload.loadUint(256);
        throwUnless(16256, signedManifestHash == self.deployment_manifest_hash);
        let signedVaultHash: Int = signedPayload.loadUint(256);
        let vaultAddressSlice: Slice = myAddress().asSlice();
        throwUnless(16257, vaultAddressSlice.loadUint(11) == 1024);
        throwUnless(16257, signedVaultHash == vaultAddressSlice.loadUint(256));
        let signedAction: Int = signedPayload.loadUint(8);
        throwUnless(16258, signedAction == VAULT_RECEIVE_INTENT_ACTION_CANCEL);
        let signedOwnerHash: Int = signedPayload.loadUint(256);
        let ownerPrefix: Slice = msg.owner_wallet.asSlice();
        throwUnless(16259, ownerPrefix.loadUint(11) == 1024);
        throwUnless(16259, signedOwnerHash == ownerPrefix.loadUint(256));
        let clientNonce: Int = signedPayload.loadUint(64);
        throwUnless(16262, clientNonce == user.publish_nonce);
        acceptMessage();
        user.publish_nonce += 1;
        self.users.set(msg.owner_wallet, user);
        commit();

        if (!(signedPayload.bits() == 0)) {
            return;
        }
        if (!(signedPayload.refs() == 1)) {
            return;
        }
        let actionPayload: Slice = signedPayload.loadRef().beginParse();
        let intentId: Int = actionPayload.loadUint(256);
        if (!(actionPayload.bits() == 0)) {
            return;
        }
        if (!(actionPayload.refs() == 0)) {
            return;
        }

        let intentOpt: ReceiveIntent? = self.receive_intents.get(intentId);
        if (intentOpt == null) {
            return;
        }
        let intent: ReceiveIntent = intentOpt!!;
        if (!(msg.owner_wallet == intent.sender_wallet)) {
            return;
        }

        if (intent.asset == ASSET_TON) {
            user.ton_balance += intent.amount;
        } else {
            user.ath_balance += intent.amount;
        }

        self.users.set(msg.owner_wallet, user);
        self.receive_intents.del(intentId);
        self.receive_intent_count -= 1;
    }

    external(msg: PublishPrivateFromVaultBalance) {
        self.requireSealed();
        let userOpt: UserState? = self.users.get(msg.owner_wallet);
        throwUnless(16451, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16454, user.auth_pubkey != 0);
        throwUnless(16457, checkSignature(msg.signed_payload.hash(), msg.signature, user.auth_pubkey));

        let signedPayload: Slice = msg.signed_payload.beginParse();
        let signedDomain: Int = signedPayload.loadUint(32);
        throwUnless(16464, signedDomain == VAULT_PUBLISH_SIGNING_DOMAIN);
        let signedManifestHash: Int = signedPayload.loadUint(256);
        throwUnless(16465, signedManifestHash == self.deployment_manifest_hash);
        let signedVaultHash: Int = signedPayload.loadUint(256);
        let vaultAddressSlice: Slice = myAddress().asSlice();
        throwUnless(16466, vaultAddressSlice.loadUint(11) == 1024);
        throwUnless(16466, signedVaultHash == vaultAddressSlice.loadUint(256));
        let signedPublishKind: Int = signedPayload.loadUint(8);
        throwUnless(16467, signedPublishKind == PUBLISH_KIND_PRIVATE);
        let signedOwnerHash: Int = signedPayload.loadUint(256);
        let clientNonce: Int = signedPayload.loadUint(64);
        let maxCharge: Int = signedPayload.loadUint(128);
        let signedSizeClass: Int = signedPayload.loadUint(8);
        let signedCryptoSuite: Int = signedPayload.loadUint(8);
        let ownerPrefix: Slice = msg.owner_wallet.asSlice();
        throwUnless(16450, ownerPrefix.loadUint(11) == 1024);
        throwUnless(16470, signedOwnerHash == ownerPrefix.loadUint(256));
        throwUnless(16453, clientNonce == user.publish_nonce);
        throwUnless(16472, signedCryptoSuite == CRYPTO_SUITE_HYBRID);
        let localExecReserve: Int = 0;
        if (signedSizeClass == SIZE_CLASS_1K) {
            localExecReserve = VAULT_PUBLISH_PRIVATE_HYBRID_1K_LOCAL_EXEC_RESERVE;
        } else if (signedSizeClass == SIZE_CLASS_2K) {
            localExecReserve = VAULT_PUBLISH_PRIVATE_HYBRID_2K_LOCAL_EXEC_RESERVE;
        } else if (signedSizeClass == SIZE_CLASS_4K) {
            localExecReserve = VAULT_PUBLISH_PRIVATE_HYBRID_4K_LOCAL_EXEC_RESERVE;
        } else if (signedSizeClass == SIZE_CLASS_8K) {
            localExecReserve = VAULT_PUBLISH_PRIVATE_HYBRID_8K_LOCAL_EXEC_RESERVE;
        } else if (signedSizeClass == SIZE_CLASS_16K) {
            localExecReserve = VAULT_PUBLISH_PRIVATE_HYBRID_16K_LOCAL_EXEC_RESERVE;
        } else if (signedSizeClass == SIZE_CLASS_32K) {
            localExecReserve = VAULT_PUBLISH_PRIVATE_HYBRID_32K_LOCAL_EXEC_RESERVE;
        }
        throwUnless(16471, localExecReserve > 0);
        throwUnless(16462, maxCharge >= localExecReserve);
        throwUnless(16463, user.ton_balance >= maxCharge);
        acceptMessage();

        user.ton_balance -= localExecReserve;
        user.publish_nonce += 1;
        self.users.set(msg.owner_wallet, user);
        commit();

        if (!(signedPayload.bits() == 0)) {
            return;
        }
        if (!(signedPayload.refs() == 1)) {
            return;
        }
        let payloadCell: Cell = signedPayload.loadRef();

        let payloadPreview: Slice = payloadCell.beginParse();
        if (!(payloadPreview.bits() == 784)) {
            return;
        }
        if (!(payloadPreview.refs() == 3)) {
            return;
        }

        let payload: Slice = payloadCell.beginParse();
        let parsedSizeClass: Int = payload.loadUint(8);
        let parsedCryptoSuite: Int = payload.loadUint(8);
        if (!(parsedSizeClass == signedSizeClass)) {
            return;
        }
        if (!(parsedCryptoSuite == signedCryptoSuite)) {
            return;
        }
        let sizeClass: Int = parsedSizeClass;
        let cryptoSuite: Int = parsedCryptoSuite;
        let header0Hash: Int = payload.loadUint(256);
        let header1Hash: Int = payload.loadUint(256);
        let bodyHash: Int = payload.loadUint(256);
        let header0: Cell = payload.loadRef();
        let header1: Cell = payload.loadRef();
        let body: Cell = payload.loadRef();
        if (!(payload.bits() == 0)) {
            return;
        }
        if (!(payload.refs() == 0)) {
            return;
        }

        if (!self.isPublishProfileValid(PUBLISH_KIND_PRIVATE, sizeClass, cryptoSuite, header0Hash, header1Hash)) {
            return;
        }
        if (!(header0.hash() == header0Hash)) {
            return;
        }
        if (!(header1.hash() == header1Hash)) {
            return;
        }
        if (!(body.hash() == bodyHash)) {
            return;
        }
        if (!self.isPrivateCapsuleShapeValid(sizeClass, cryptoSuite, header0, header1, body)) {
            return;
        }

        let expectedMax: Int = self.canonicalPublishMaxCharge(msg.owner_wallet, PUBLISH_KIND_PRIVATE, sizeClass, cryptoSuite);
        if (!(maxCharge >= expectedMax)) {
            return;
        }

        let protocolFee: Int = self.protocolFeePaid(msg.owner_wallet, PUBLISH_KIND_PRIVATE, sizeClass, cryptoSuite);
        let callValue: Int = self.capsulehubCallValue(maxCharge, localExecReserve);
        let publishId: Int = self.computePublishId(msg.owner_wallet, clientNonce, bodyHash, PUBLISH_KIND_PRIVATE);
        if (!(publishId != 0)) {
            return;
        }
        let bounceId: Int = self.computePublishBounceId(publishId);
        let bounceTag: Int = self.computePublishBounceTag(publishId);
        if (self.pending_publishes.exists(bounceId)) {
            return;
        }

        user.ton_balance -= (maxCharge - localExecReserve);
        self.users.set(msg.owner_wallet, user);

        self.pending_publishes.set(bounceId, PendingPublish {
            owner_wallet: msg.owner_wallet,
            tombstone: false,
            refund_to_vault: true,
            nonce: clientNonce,
            publish_kind: PUBLISH_KIND_PRIVATE,
            body_hash: bodyHash,
            refundable_amount: callValue,
            created_at: now()
        });
        self.incrementPendingPublishCount();
        commit();

        message(MessageParameters {
            to: self.capsule_hub_address,
            value: callValue,
            bounce: true,
            mode: SendPayGasSeparately,
            body: PublishPrivateFromVault {
                bounce_id: bounceId,
                bounce_tag: bounceTag,
                publish_id: publishId,
                size_class: sizeClass,
                crypto_suite: cryptoSuite,
                header_0_hash: header0Hash,
                header_1_hash: header1Hash,
                body_hash: bodyHash,
                header_0: header0,
                header_1: header1,
                body: body,
                protocol_fee_paid: protocolFee
            }.toCell()
        });
    }

    external(msg: PublishPublicFromVaultBalance) {
        self.requireSealed();
        let userOpt: UserState? = self.users.get(msg.owner_wallet);
        throwUnless(16481, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16484, user.auth_pubkey != 0);
        throwUnless(16487, checkSignature(msg.signed_payload.hash(), msg.signature, user.auth_pubkey));

        let signedPayload: Slice = msg.signed_payload.beginParse();
        let signedDomain: Int = signedPayload.loadUint(32);
        throwUnless(16493, signedDomain == VAULT_PUBLISH_SIGNING_DOMAIN);
        let signedManifestHash: Int = signedPayload.loadUint(256);
        throwUnless(16494, signedManifestHash == self.deployment_manifest_hash);
        let signedVaultAddress: Address = signedPayload.loadAddress();
        throwUnless(16495, signedVaultAddress == myAddress());
        let signedPublishKind: Int = signedPayload.loadUint(8);
        throwUnless(16496, signedPublishKind == PUBLISH_KIND_PUBLIC);
        let signedOwner: Address = signedPayload.loadAddress();
        let clientNonce: Int = signedPayload.loadUint(64);
        let maxCharge: Int = signedPayload.loadUint(128);
        throwUnless(16499, signedOwner == msg.owner_wallet);
        let ownerPrefix: Slice = msg.owner_wallet.asSlice();
        throwUnless(16480, ownerPrefix.loadUint(11) == 1024);
        throwUnless(16483, clientNonce == user.publish_nonce);
        let localExecReserve: Int = VAULT_PUBLISH_PUBLIC_LOCAL_EXEC_RESERVE;
        throwUnless(16491, maxCharge >= localExecReserve);
        throwUnless(16492, user.ton_balance >= maxCharge);
        acceptMessage();

        user.ton_balance -= localExecReserve;
        user.publish_nonce += 1;
        self.users.set(msg.owner_wallet, user);
        commit();

        if (!(signedPayload.bits() == 0)) {
            return;
        }
        if (!(signedPayload.refs() == 1)) {
            return;
        }
        let payloadCell: Cell = signedPayload.loadRef();

        let payloadPreview: Slice = payloadCell.beginParse();
        if (!(payloadPreview.bits() == 512)) {
            return;
        }
        if (!(payloadPreview.refs() == 2)) {
            return;
        }

        let payload: Slice = payloadCell.beginParse();
        let headerHash: Int = payload.loadUint(256);
        let bodyHash: Int = payload.loadUint(256);
        let header: Cell = payload.loadRef();
        let body: Cell = payload.loadRef();
        if (!(payload.bits() == 0)) {
            return;
        }
        if (!(payload.refs() == 0)) {
            return;
        }

        if (!self.isPublishProfileValid(PUBLISH_KIND_PUBLIC, SIZE_CLASS_STANDARD, CRYPTO_SUITE_PUBLIC_NONE, headerHash, 0)) {
            return;
        }
        if (!(header.hash() == headerHash)) {
            return;
        }
        if (!(body.hash() == bodyHash)) {
            return;
        }
        if (!self.isPublicCapsuleShapeValid(header, body)) {
            return;
        }

        let expectedMax: Int = self.canonicalPublishMaxCharge(msg.owner_wallet, PUBLISH_KIND_PUBLIC, SIZE_CLASS_STANDARD, CRYPTO_SUITE_PUBLIC_NONE);
        if (!(maxCharge >= expectedMax)) {
            return;
        }

        let protocolFee: Int = self.protocolFeePaid(msg.owner_wallet, PUBLISH_KIND_PUBLIC, SIZE_CLASS_STANDARD, CRYPTO_SUITE_PUBLIC_NONE);
        let callValue: Int = self.capsulehubCallValue(maxCharge, localExecReserve);
        let publishId: Int = self.computePublishId(msg.owner_wallet, clientNonce, bodyHash, PUBLISH_KIND_PUBLIC);
        if (!(publishId != 0)) {
            return;
        }
        let bounceId: Int = self.computePublishBounceId(publishId);
        let bounceTag: Int = self.computePublishBounceTag(publishId);
        if (self.pending_publishes.exists(bounceId)) {
            return;
        }

        user.ton_balance -= (maxCharge - localExecReserve);
        self.users.set(msg.owner_wallet, user);

        self.pending_publishes.set(bounceId, PendingPublish {
            owner_wallet: msg.owner_wallet,
            tombstone: false,
            refund_to_vault: true,
            nonce: clientNonce,
            publish_kind: PUBLISH_KIND_PUBLIC,
            body_hash: bodyHash,
            refundable_amount: callValue,
            created_at: now()
        });
        self.incrementPendingPublishCount();
        commit();

        message(MessageParameters {
            to: self.capsule_hub_address,
            value: callValue,
            bounce: true,
            mode: SendPayGasSeparately,
            body: PublishPublicFromVault {
                bounce_id: bounceId,
                bounce_tag: bounceTag,
                publish_id: publishId,
                marketing_note: PLATHO_PUBLIC_MARKETING_NOTE_ASCII,
                author_wallet: msg.owner_wallet,
                header_hash: headerHash,
                body_hash: bodyHash,
                header: header,
                body: body,
                protocol_fee_paid: protocolFee
            }.toCell()
        });
    }

    external(msg: SetProfileAvatarFromVaultBalance) {
        self.requireSealed();
        throwUnless(16600, self.isProfileRegistryBound());
        let userOpt: UserState? = self.users.get(msg.owner_wallet);
        throwUnless(16601, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16602, user.auth_pubkey != 0);
        throwUnless(16604, checkSignature(msg.signed_payload.hash(), msg.signature, user.auth_pubkey));

        let signedPayload: Slice = msg.signed_payload.beginParse();
        let signedDomain: Int = signedPayload.loadUint(32);
        throwUnless(16605, signedDomain == VAULT_PROFILE_AVATAR_SIGNING_DOMAIN);
        let signedManifestHash: Int = signedPayload.loadUint(256);
        throwUnless(16606, signedManifestHash == self.deployment_manifest_hash);
        let signedVaultAddress: Address = signedPayload.loadAddress();
        throwUnless(16607, signedVaultAddress == myAddress());
        let signedOwner: Address = signedPayload.loadAddress();
        let clientNonce: Int = signedPayload.loadUint(64);
        let maxTonCharge: Int = signedPayload.loadUint(128);
        throwUnless(16610, signedOwner == msg.owner_wallet);
        throwUnless(16611, clientNonce == user.publish_nonce);
        acceptMessage();
        user.publish_nonce += 1;
        self.users.set(msg.owner_wallet, user);
        commit();

        if (!(self.sealed)) {
            return;
        }
        if (!(self.isUsernameRegistryBound())) {
            return;
        }

        let ownerPrefix: Slice = msg.owner_wallet.asSlice();
        if (!(ownerPrefix.loadUint(11) == 1024)) {
            return;
        }
        if (!(maxTonCharge >= VAULT_PROFILE_AVATAR_LOCAL_EXEC_RESERVE)) {
            return;
        }
        if (!(user.ton_balance >= VAULT_PROFILE_AVATAR_LOCAL_EXEC_RESERVE)) {
            return;
        }

        user.ton_balance -= VAULT_PROFILE_AVATAR_LOCAL_EXEC_RESERVE;
        self.users.set(msg.owner_wallet, user);
        commit();

        if (!(signedPayload.bits() == 0)) {
            return;
        }
        if (!(signedPayload.refs() == 1)) {
            return;
        }
        let avatarPayloadCell: Cell = signedPayload.loadRef();

        let avatarPayloadPreview: Slice = avatarPayloadCell.beginParse();
        if (!(avatarPayloadPreview.bits() == 739)) {
            return;
        }
        if (!(avatarPayloadPreview.refs() == 0)) {
            return;
        }

        let avatarPayload: Slice = avatarPayloadCell.beginParse();
        let signedProfileRegistry: Address = avatarPayload.loadAddress();
        let avatarHash: Int = avatarPayload.loadUint(256);
        let avatarEntryId: Int = avatarPayload.loadUint(64);
        let avatarStreamId: Int = avatarPayload.loadUint(128);
        let avatarPartCount: Int = avatarPayload.loadUint(16);
        let mediaFormat: Int = avatarPayload.loadUint(8);
        if (!(signedProfileRegistry == self.profile_registry_address)) {
            return;
        }
        self.requireValidProfileAvatarPointer(msg.owner_wallet, avatarHash, avatarStreamId, avatarPartCount, mediaFormat);

        let tonCharge: Int = self.profileAvatarTonCharge();
        if (!(maxTonCharge >= tonCharge)) {
            return;
        }
        let remainingTonCharge: Int = tonCharge - VAULT_PROFILE_AVATAR_LOCAL_EXEC_RESERVE;
        if (!(user.ton_balance >= remainingTonCharge)) {
            return;
        }
        if (!(user.ath_balance >= PROFILE_AVATAR_PRICE_ATH)) {
            return;
        }

        let queryId: Int = self.computeProfileAvatarPaymentId(msg.owner_wallet, clientNonce, avatarHash);
        if (self.pending_profile_avatar_payments.exists(queryId)) {
            return;
        }

        user.ton_balance -= remainingTonCharge;
        user.ath_balance -= PROFILE_AVATAR_PRICE_ATH;
        self.users.set(msg.owner_wallet, user);
        self.pending_profile_avatar_payments.set(queryId, PendingProfileAvatarPayment {
            owner_wallet: msg.owner_wallet,
            amount: PROFILE_AVATAR_PRICE_ATH,
            created_at: now()
        });
        self.incrementPendingProfileAvatarPaymentCount();
        commit();

        message(MessageParameters {
            to: self.vault_ath_wallet_address,
            value: VAULT_PROFILE_AVATAR_ATH_WALLET_REQUEST_VALUE,
            bounce: true,
            mode: SendPayGasSeparately,
            body: ATHTransferRequestVaultProfileAvatar {
                query_id: queryId,
                amount: PROFILE_AVATAR_PRICE_ATH,
                recipient: self.profile_registry_address,
                response_destination: myAddress(),
                notify_value: PROFILE_AVATAR_NOTIFY_VALUE,
                owner_wallet: msg.owner_wallet,
                avatar_hash: avatarHash,
                avatar_entry_id: avatarEntryId,
                avatar_stream_id: avatarStreamId,
                avatar_part_count: avatarPartCount,
                media_format: mediaFormat
            }.toCell()
        });
    }

    external(msg: MintUsernameFromVaultBalance) {
        let userOpt: UserState? = self.users.get(msg.owner_wallet);
        throwUnless(16701, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16702, user.auth_pubkey != 0);
        throwUnless(16704, checkSignature(msg.signed_payload.hash(), msg.signature, user.auth_pubkey));

        let signedPayload: Slice = msg.signed_payload.beginParse();
        let signedDomain: Int = signedPayload.loadUint(32);
        throwUnless(16705, signedDomain == VAULT_USERNAME_MINT_SIGNING_DOMAIN);
        let signedManifestHash: Int = signedPayload.loadUint(256);
        throwUnless(16706, signedManifestHash == self.deployment_manifest_hash);
        let signedVaultAddress: Address = signedPayload.loadAddress();
        throwUnless(16707, signedVaultAddress == myAddress());
        let signedOwner: Address = signedPayload.loadAddress();
        let clientNonce: Int = signedPayload.loadUint(64);
        let maxTonCharge: Int = signedPayload.loadUint(128);
        throwUnless(16710, signedOwner == msg.owner_wallet);
        throwUnless(16711, clientNonce == user.publish_nonce);
        acceptMessage();
        user.publish_nonce += 1;
        self.users.set(msg.owner_wallet, user);
        commit();

        let ownerPrefix: Slice = msg.owner_wallet.asSlice();
        if (!(ownerPrefix.loadUint(11) == 1024)) {
            return;
        }
        if (!(maxTonCharge >= VAULT_USERNAME_MINT_LOCAL_EXEC_RESERVE)) {
            return;
        }
        if (!(user.ton_balance >= VAULT_USERNAME_MINT_LOCAL_EXEC_RESERVE)) {
            return;
        }

        user.ton_balance -= VAULT_USERNAME_MINT_LOCAL_EXEC_RESERVE;
        self.users.set(msg.owner_wallet, user);
        commit();

        if (!(signedPayload.bits() == 0)) {
            return;
        }
        if (!(signedPayload.refs() == 1)) {
            return;
        }
        let usernamePayloadCell: Cell = signedPayload.loadRef();

        let usernamePayloadPreview: Slice = usernamePayloadCell.beginParse();
        if (!(usernamePayloadPreview.bits() >= 275)) {
            return;
        }
        if (!(usernamePayloadPreview.refs() == 0)) {
            return;
        }

        let usernamePayload: Slice = usernamePayloadCell.beginParse();
        let signedUsernameRegistry: Address = usernamePayload.loadAddress();
        let usernameLen: Int = usernamePayload.loadUint(8);
        let username: Slice = usernamePayload;
        if (!(signedUsernameRegistry == self.username_registry_address)) {
            return;
        }
        if (!self.isValidUsernameBytes(usernameLen, username)) {
            return;
        }

        let price: Int = self.usernamePriceForLength(usernameLen);
        let tonCharge: Int = self.usernameMintTonCharge();
        if (!(maxTonCharge >= tonCharge)) {
            return;
        }
        let remainingTonCharge: Int = tonCharge - VAULT_USERNAME_MINT_LOCAL_EXEC_RESERVE;
        if (!(user.ton_balance >= remainingTonCharge)) {
            return;
        }
        if (!(user.ath_balance >= price)) {
            return;
        }

        let nameHash: Int = self.computeUsernameNameHash(username);
        let queryId: Int = self.computeUsernameMintPaymentId(msg.owner_wallet, clientNonce, nameHash);
        if (self.pending_username_mint_payments.exists(queryId)) {
            return;
        }

        user.ton_balance -= remainingTonCharge;
        user.ath_balance -= price;
        self.users.set(msg.owner_wallet, user);
        self.pending_username_mint_payments.set(queryId, PendingUsernameMintPayment {
            owner_wallet: msg.owner_wallet,
            amount: price,
            created_at: now()
        });
        self.incrementPendingUsernameMintPaymentCount();
        commit();

        message(MessageParameters {
            to: self.vault_ath_wallet_address,
            value: VAULT_USERNAME_MINT_ATH_WALLET_REQUEST_VALUE,
            bounce: true,
            mode: SendPayGasSeparately,
            body: ATHTransferRequestVaultMintUsername {
                query_id: queryId,
                amount: price,
                recipient: self.username_registry_address,
                response_destination: myAddress(),
                notify_value: USERNAME_NOTIFY_VALUE,
                owner_wallet: msg.owner_wallet,
                username_len: usernameLen,
                username: username
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
            self.decrementPendingPublishCount();
        }
    }

    bounced(msg: bounced<PublishPrivateFromVault>) {
        self.requireSealed();
        throwUnless(16510, sender() == self.capsule_hub_address);
        let pendingOpt: PendingPublish? = self.pending_publishes.get(msg.bounce_id);
        throwUnless(16511, pendingOpt != null);
        let pending: PendingPublish = pendingOpt!!;
        let expectedPublishId: Int = self.computePublishId(pending.owner_wallet, pending.nonce, pending.body_hash, pending.publish_kind);
        throwUnless(16514, self.computePublishBounceTag(expectedPublishId) == msg.bounce_tag);
        if (pending.tombstone) {
            throwUnless(16512, now() <= pending.created_at);
            throwUnless(16513, pending.publish_kind == PUBLISH_KIND_PRIVATE);
            self.refundPendingPublish(pending, context().value);
            self.pending_publishes.del(msg.bounce_id);
        } else {
            self.refundPendingPublish(pending, context().value);
            self.pending_publishes.del(msg.bounce_id);
            self.decrementPendingPublishCount();
        }
    }

    bounced(msg: bounced<PublishPublicFromVault>) {
        self.requireSealed();
        throwUnless(16520, sender() == self.capsule_hub_address);
        let pendingOpt: PendingPublish? = self.pending_publishes.get(msg.bounce_id);
        throwUnless(16521, pendingOpt != null);
        let pending: PendingPublish = pendingOpt!!;
        let expectedPublishId: Int = self.computePublishId(pending.owner_wallet, pending.nonce, pending.body_hash, pending.publish_kind);
        throwUnless(16524, self.computePublishBounceTag(expectedPublishId) == msg.bounce_tag);
        if (pending.tombstone) {
            throwUnless(16522, now() <= pending.created_at);
            throwUnless(16523, pending.publish_kind == PUBLISH_KIND_PUBLIC);
            self.refundPendingPublish(pending, context().value);
            self.pending_publishes.del(msg.bounce_id);
        } else {
            self.refundPendingPublish(pending, context().value);
            self.pending_publishes.del(msg.bounce_id);
            self.decrementPendingPublishCount();
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
            refund_to_vault: pending.refund_to_vault,
            nonce: pending.nonce,
            publish_kind: pending.publish_kind,
            body_hash: pending.body_hash,
            refundable_amount: pending.refundable_amount,
            created_at: tombstoneExpiresAt
        });
        self.decrementPendingPublishCount();
    }

    get fun get_user(owner: Address): VaultUserView {
        let userOpt: UserState? = self.users.get(owner);
        if (userOpt == null) {
            return VaultUserView {
                exists: false,
                ton_balance: 0,
                ath_balance: 0,
                current_key_id: 0,
                auth_pubkey: 0,
                publish_nonce: 0
            };
        }
        let user: UserState = userOpt!!;
        return VaultUserView {
            exists: true,
            ton_balance: user.ton_balance,
            ath_balance: user.ath_balance,
            current_key_id: user.current_key_id,
            auth_pubkey: user.auth_pubkey,
            publish_nonce: user.publish_nonce
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
                settlement_reserve_ton: 0,
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
            settlement_reserve_ton: intent.settlement_reserve_ton,
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
            capsule_hub_bound: self.isCapsuleHubBound(),
            profile_registry_bound: self.isProfileRegistryBound(),
            username_registry_bound: self.isUsernameRegistryBound(),
            deployment_manifest_hash: self.deployment_manifest_hash,
            capsule_hub_address: self.capsule_hub_address,
            profile_registry_address: self.profile_registry_address,
            username_registry_address: self.username_registry_address,
            vault_ath_wallet_address: self.vault_ath_wallet_address,
            ath_master_address: self.ath_master_address,
            user_count: self.user_count,
            key_record_count: self.key_record_count,
            receive_intent_count: self.receive_intent_count,
            pending_ath_withdrawal_count: self.pending_ath_withdrawal_count,
            pending_publish_count: self.pendingPublishCount(),
            pending_profile_avatar_payment_count: self.pendingProfileAvatarPaymentCount(),
            pending_username_mint_payment_count: self.pendingUsernameMintPaymentCount(),
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
