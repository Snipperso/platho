// Platho v1 Vault milestone 1 implementation.
// Scope: UserState, TON deposit/withdraw, Vault-funded batch publish, KeyRecord/key_generation lifecycle.
// Includes the signed VPB2 batch publish to CapsuleHub with PendingBatchPublish ACK/bounce recovery.
// Includes pre-seal official ATH wallet binding to avoid self-address StateInit circularity.
// No admin/owner override/pause/upgrade/governance/rescue/fallback behavior is implemented.

import "./ATHWallet.tact";

const VAULT_USER_STATE_STORAGE_ENDOWMENT: Int = 10000000;
const VAULT_KEY_RECORD_STANDARD_STORAGE_ENDOWMENT: Int = 5000000;
const VAULT_KEY_RECORD_LONG_TERM_STORAGE_ENDOWMENT: Int = 30000000;
const VAULT_RECEIVE_INTENT_STORAGE_ENDOWMENT: Int = 5000000;
const VAULT_PENDING_PUBLISH_STALE_TTL: Int = 86400;          // 24h: a stuck pending batch becomes prunable
const VAULT_PRUNED_PUBLISH_TOMBSTONE_TTL: Int = 86400;       // 24h tombstone window after prune, then deletable
const VAULT_PRUNE_PENDING_PUBLISH_EXEC_RESERVE: Int = 2000000; // min inbound value to drive a prune
const VAULT_DEPOSIT_TON_EXEC_RESERVE: Int = 2000000;
const VAULT_STATE_GROWTH_EXEC_RESERVE: Int = 2000000;
const VAULT_ATH_NOTIFICATION_ACK_VALUE: Int = 1000000;
const VAULT_ATH_WITHDRAW_MIN_VALUE: Int = 40000000;
const VAULT_WITHDRAW_TON_EXEC_RESERVE: Int = 2000000;
const VAULT_ATH_WITHDRAW_REFUND_EXEC_RESERVE: Int = 2000000;
const ASSET_TON: Int = 1;
const ASSET_ATH: Int = 2;
const RECEIVE_INTENT_ID_DOMAIN: Int = 0x52434944; // "RCID"
// Reserved for a future hash-commitment variant. Current receive intents store secret32 directly as the recipient-authenticated claim gate, not as a hiding commitment.
const RECEIVE_INTENT_COMMITMENT_DOMAIN: Int = 0x5243434d; // "RCCM"
const VAULT_RECEIVE_INTENT_SIGNING_DOMAIN: Int = 0x56524331; // "VRC1"
const VAULT_WITHDRAW_TON_SIGNING_DOMAIN: Int = 0x56545731; // "VTW1"
const VAULT_WITHDRAW_ATH_SIGNING_DOMAIN: Int = 0x56574131; // "VWA1"
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
const UINT128_MOD: Int = 340282366920938463463374607431768211456;
const UINT160_MOD: Int = 1461501637330902918203684832716283019655932542976;
const UINT32_MAX: Int = 4294967295;
const ATH_DEPOSIT_ID_DOMAIN: Int = 0x41445049; // "ADPI"
const ATH_WITHDRAWAL_ID_DOMAIN: Int = 0x41574944; // "AWID"
const KEY_ID_DOMAIN: Int = 0x4b455949; // "KEYI"
const PUBLISH_KIND_PRIVATE: Int = 1;
const PUBLISH_KIND_PUBLIC: Int = 2;
const VAULT_BATCH_PUBLISH_SIGNING_DOMAIN: Int = 0x56504232; // "VPB2" (retires VPB1 for publishing)
const VAULT_BATCH_PUBLISH_ID_DOMAIN: Int = 0x42504931;      // "BPI1" batch publish_id derivation
const CAPSULE_ENTRY_PUBLISH_ID_DOMAIN: Int = 0x45504931;    // "EPI1" per-entry publish_id derivation
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
const CRYPTO_SUITE_PUBLIC_NONE: Int = 0;
const PLATO_MIN_PROTOCOL_FEE_TON: Int = 0;
const PLATHO_PUBLIC_MARKETING_NOTE_ASCII: Int = 0x73656e742076696120506c6174686f2e417070; // "sent via Platho.App"
const ATH_FULL_DISCOUNT_AMOUNT: Int = 10000000000000;
const VAULT_ACTIVITY_AIRDROP_TOTAL_ATH: Int = 15000000000000000;
const VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH: Int = 0;
const VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH: Int = 10000000000;
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
const PROFILE_AVATAR_PRICE_ATH: Int = 100000000000;
const PROFILE_AVATAR_NOTIFY_VALUE: Int = 30000000;
const PROFILE_AVATAR_MAX_PARTS: Int = 2;
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
    envelope_padding: Slice as remaining;
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

message(0x7E1F5038) WithdrawTonFromVaultBalance {
    owner_wallet: Address;
    signature: Slice as bytes64;
    signed_payload: Cell;
    envelope_padding: Slice as remaining;
}

message(0x7E1F5039) WithdrawAthFromVaultBalance {
    owner_wallet: Address;
    signature: Slice as bytes64;
    signed_payload: Cell;
    envelope_padding: Slice as remaining;
}

message(0x7E1F5033) SetProfileAvatarFromVaultBalance {
    owner_wallet: Address;
    signature: Slice as bytes64;
    signed_payload: Cell;
    envelope_padding: Slice as remaining;
}

message(0x7E1F5034) MintUsernameFromVaultBalance {
    owner_wallet: Address;
    signature: Slice as bytes64;
    signed_payload: Cell;
    envelope_padding: Slice as remaining;
}

message(0x7E1F5041) PublishBatchFromVaultBalance {
    owner_wallet: Address;
    signature: Slice as bytes64;
    signed_payload: Cell;
    envelope_padding: Slice as remaining;
}

message(0xA4F862D1) PublishBatchToHub {
    bounce_id: Int as uint64;
    bounce_tag: Int as uint160;
    publish_id: Int as uint256;
    publish_kind: Int as uint8;
    part_count: Int as uint8;
    protocol_fee_total: Int as uint128;
    author_wallet: Address;
    parts: Cell;        // ref[0]: the exact signed part list, forwarded as-is
    marketing: Cell?;   // ref[1]: public batches only ({marketing_note}); null for private
}

message(0x874E5771) CapsuleHubBatchAck {
    publish_id: Int as uint256;
    first_entry_id: Int as uint64;
    part_count: Int as uint8;
    batch_uid: Int as uint256;
}

message(0x720BDD6E) PruneBatchPublish {
    publish_id: Int as uint256;
}

message(0x5355434D) AnnounceSuccessorManifest {
    successor_manifest_hash: Int as uint256;
    successor_vault: Address;
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

struct PendingBatchPublish {
    owner_wallet: Address;
    tombstone: Bool;
    refund_to_vault: Bool;
    nonce: Int as uint64;
    publish_kind: Int as uint8;
    part_count: Int as uint8;
    publish_id: Int as uint256;     // FULL id: ACK/bounce verify by equality
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

const RECEIPT_RING_K: Int = 20;
// Receipt action codes (which of the 9 nonce-consuming actions a slot reports).
const ACT_WITHDRAW_TON: Int = 1;
const ACT_WITHDRAW_ATH: Int = 2;
const ACT_REPLACE_KEYS: Int = 3;
const ACT_CREATE_INTENT: Int = 4;
const ACT_CLAIM_INTENT: Int = 5;
const ACT_CANCEL_INTENT: Int = 6;
const ACT_PUBLISH_BATCH: Int = 7;
const ACT_SET_AVATAR: Int = 8;
const ACT_MINT_USERNAME: Int = 9;
// Receipt result codes (lifecycle). RJ_* reject codes are added with the batch external (group C).
const RES_PROCESSING: Int = 0x00;     // non-terminal; thin-client timeout fallback applies
const RES_CONFIRMED: Int = 0x01;
const RES_BOUNCED_REFUNDED: Int = 0x02;
const RES_TOMBSTONED: Int = 0x03;
const AUX_BATCH_LEVEL: Int = 0xFFFFFFFFFFFFFFFF; // 2^64-1: batch-level aux (no specific part index)
// --- VPB2 batch publish ---
const MAX_BATCH_PARTS: Int = 8;
const VPB2_VERSION: Int = 1;
// Worst-case import bound for the pre-accept floor + the signed hold: provably upper-bounds the import fee of
// ANY legal inbound EXTERNAL (drain-proof) — gates a REFUNDABLE hold. Tightened (2026-06-14) from the absolute
// TVM message caps (8192 cells / 2^21 bits) to the config-43 max_ext_msg_size: an inbound external BoC is <=
// 65,535 bytes, so its data is <= 65535*8 = 524,280 bits (data cannot exceed the byte size that carries it),
// and its cells are still <= the 8192 cap. The network drops anything larger before the contract runs, so this
// is a true ceiling, not the 2^21-bit theoretical max (which an external can never reach). Halves the hold.
const EXT_HARD_CELLS: Int = 8192;      // config-43 max_msg_cells
const EXT_HARD_BITS: Int = 524280;     // config-43 max_ext_msg_size (65535 bytes) * 8 — provable data-bit ceiling
// Root-cell bit width of the PublishBatchToHub body (0xA4F862D1), used to fee the Vault->Hub forward over
// the FULL message (root + parts subtree + optional marketing), not the bare parts subtree. Derivation:
// op(32)+bounce_id(64)+bounce_tag(160)+publish_id(256)+kind(8)+part_count(8)+protocol_fee(128)
// +author_wallet(267)+marketing-maybe(1) = 924. Generator re-pins from the compiled ABI; gate G2 asserts.
const HUB_BATCH_MSG_ROOT_BITS: Int = 924;
const ACK_MIN_FORWARD: Int = 30000000; // 0.03 TON floor for the ACK leg (returned via mode-128 ACK)
// Pinned pre-accept charge floor = worst-case import HOLD + bounded reject-path compute, as an AFFINE constant
// in part_count. The fee primitives getForwardFee/getComputeFee are too expensive for the 10k pre-accept gas
// credit (measured: the floor's getForwardFee alone pushes this receiver over), so the floor is PRECOMPUTED.
// reject_fee uses the SAME formula, so reject refund = max_charge - floor >= 0 ALWAYS (the pre-accept gate is
// max_charge >= floor) and the Vault recovers its real import as long as each pin >= its runtime value.
// canonical_total and success retention stay RUNTIME-priced (post-accept, gas-ample, config-tracking).
// Snapshot (config-43 max_ext_msg_size, on-chain measured 2026-06-14 via diag_ext_hard_import):
// getForwardFee(8192,524280)=89,632,004; getComputeFee(REJECT_BASE_GAS=10000)=666,668;
// getComputeFee(WALK_GAS_PER_PART_MAX=90000)=6,000,001 — each rounded UP for config headroom. Release gate G2
// reads diag_forward_fee/diag_compute_fee and asserts each pin >= its runtime value (drain-proof reject).
const BATCH_FLOOR_BASE_PIN: Int = 92700000;    // import hold (89.63M, rounded up to 92M) + reject base compute (0.7M)
const BATCH_FLOOR_PER_PART_PIN: Int = 6200000; // per-part walk compute (getComputeFee(90000)≈6.0M, rounded up)
const PROTOCOL_FEE_TON_BATCH: Int = 10000000; // 0.01 TON per part
const STORAGE_RESERVE_PRIVATE: Int = 4300000; // 1M keepalive + 3.3M endowment
const STORAGE_RESERVE_PUBLIC: Int = 8400000;  // 1M keepalive + 7.4M endowment
// Structural GAS constants (runtime-priced via getComputeFee). CALIBRATED 2026-06-13 from sandbox worst-case:
// per-part is the 32K measurement (Vault ~81,452 / Hub ~69,289) + margin; bases from the count-sweep intercept.
// MAX_BATCH_PARTS=8 keeps the worst sendable batch (8x4K ~471k) under 50% of the 1M tx limit (gate GAS-GATE-G8).
const VAULT_BATCH_BASE_GAS: Int = 50000;
const VAULT_PART_GAS_PRIVATE: Int = 90000;
const VAULT_PART_GAS_PUBLIC: Int = 90000;
const HUB_BATCH_BASE_GAS: Int = 14000;
const HUB_PART_GAS_PRIVATE: Int = 75000;
const HUB_PART_GAS_PUBLIC: Int = 75000;
const WALK_GAS_PER_PART_MAX: Int = 90000;
const REJECT_BASE_GAS: Int = 10000;
const ACK_GAS: Int = 9000;
// VPB2 reject result codes (receipt RJ_*).
const RJ_PART_SHAPE: Int = 0x11;
const RJ_CLASS_OR_SUITE: Int = 0x12;
const RJ_HASH_MISMATCH: Int = 0x13;
const RJ_PAYLOAD_SHAPE: Int = 0x14;
const RJ_DUPLICATE_ADJACENT: Int = 0x15;
const RJ_UNDERPRICED: Int = 0x16;
const RJ_BINDING: Int = 0x17;          // vault/owner address-hash mismatch (verified POST-accept; see receiver)
const RJ_ID_ZERO: Int = 0x18;
const RJ_PENDING_COLLISION: Int = 0x19;

struct ReceiptSlot {
    nonce: Int as uint64;       // the nonce this slot reports (slot-nonce guard for eviction-safe updates)
    action: Int as uint8;       // ACT_* (which of the 9 nonce-consuming actions)
    result: Int as uint8;       // RES_* / RJ_* lifecycle code
    aux: Int as uint64;         // action-specific: first_entry_id, failing part_index, or AUX_BATCH_LEVEL
    part_count: Int as uint8;
    at: Int as uint32;
}

struct UserState {
    ton_balance: Int as uint128;
    ath_balance: Int as uint128;
    current_key_id: Int as uint256;
    auth_pubkey: Int as uint256;
    publish_nonce: Int as uint64;
    // Ring of the last RECEIPT_RING_K receipts, keyed by nonce mod RECEIPT_RING_K. Discovery
    // accelerator only (NOT a trust anchor): "delivered" still needs self-authenticated entry match.
    receipts: map<Int as uint8, ReceiptSlot>;
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

struct VaultUserReceiptsView {
    exists: Bool;
    publish_nonce: Int;
    // The receipt ring, keyed by nonce mod RECEIPT_RING_K. One verified getter call replaces both
    // nonce polling and confirmation discovery (a single dict cell — Orbs-v2-portable).
    receipts: map<Int as uint8, ReceiptSlot>;
}

struct VaultPendingAthWithdrawalView {
    exists: Bool;
    owner_wallet: Address;
    recipient: Address;
    recipient_ath_wallet: Address;
    amount: Int;
    created_at: Int;
}

struct VaultSuccessorView {
    announced: Bool;
    successor_manifest_hash: Int;
    successor_vault: Address;
    announced_at: Int;
}

struct VaultPendingBatchPublishView {
    exists: Bool;
    owner_wallet: Address;
    nonce: Int;
    publish_kind: Int;
    part_count: Int;
    created_at: Int;
    tombstone: Bool;
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
    receive_intents: map<Int as uint128, ReceiveIntent>;
    processed_ath_deposits: map<Int, Int>;
    pending_ath_withdrawals: map<Int, PendingAthWithdrawal>;
    pending_batch_publishes: map<Int, PendingBatchPublish>;
    pending_profile_avatar_payments: map<Int, PendingProfileAvatarPayment>;
    pending_username_mint_payments: map<Int, PendingUsernameMintPayment>;
    user_count: Int as uint64;
    key_record_count: Int as uint64;
    receive_intent_count: Int as uint64;
    processed_ath_deposit_count: Int as uint64;
    pending_ath_withdrawal_count: Int as uint64;
    // Packed pending counters: low 32 bits = publish, next 16 = profile avatar, next 16 = username mint.
    // The publish lane counts live pending_batch_publishes entries (incremented on batch hand-off, decremented
    // on ACK/bounce/prune settlement) — one global counter, mirrored 1:1 by the pending_batch_publishes map.
    pending_publish_count: Int as uint64;
    // Ref-stored genesis extension (loaded lazily — only a ref pointer at contract_load, NOT inline bits, so it
    // does not erode the 10k pre-accept gas credit the edge externals depend on). Layout:
    //   controller_hash:u256 | announced:Bool | (if announced) successor_manifest_hash:u256, successor_vault:Address, announced_at:u32
    // controller_hash preserves the genesis controller across seal (genesis_config_hash is repurposed to the
    // airdrop pool); the successor slot is the one-shot, irreversible successor-deployment record (spec 6).
    genesis_ext: Cell;

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
        // Capture the controller hash (= pre-seal genesis_config_hash) into the ref ext BEFORE the seal repurposes
        // genesis_config_hash; successor slot starts unannounced.
        self.genesis_ext = beginCell().storeUint(genesis_config_hash, 256).storeBool(false).endCell();
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
        self.pending_batch_publishes = emptyMap();
        self.pending_profile_avatar_payments = emptyMap();
        self.pending_username_mint_payments = emptyMap();
        self.user_count = 0;
        self.key_record_count = 0;
        self.receive_intent_count = 0;
        self.processed_ath_deposit_count = 0;
        self.pending_ath_withdrawal_count = 0;
        self.pending_publish_count = 0;
    }

    inline fun requireSealed() {
        throwUnless(15000, self.sealed);
    }

    inline fun requireEmptyEnvelopePadding(padding: Slice) {
        // The signed external envelope is exactly (op | owner_wallet | signature | signed_payload).
        // `padding` is the message's trailing `Slice as remaining`: any extra refs/bits an attacker
        // appended OUTSIDE the signature. Extra refs are charged to the Vault pool as the import fee but
        // are never covered by the signature; rejecting here (pre-accept) means the import fee is never
        // paid. Also enforces a canonical, non-malleable external form. Parsed by Tact itself (correct
        // layout for externals; avoids inMsg()'s codegen side effects and context().raw's external quirk).
        throwUnless(16900, padding.bits() == 0);
        throwUnless(16901, padding.refs() == 0);
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
            publish_nonce: 0,
            receipts: emptyMap()
        };
    }

    fun getUserOrEmpty(owner: Address): UserState {
        let value: UserState? = self.users.get(owner);
        if (value == null) {
            return self.emptyUser();
        }
        return value!!;
    }

    // Write a receipt into the ring at the SAME commit that consumes the nonce. Returns the updated
    // user; the caller persists it with self.users.set. `nonce` is the pre-increment client nonce.
    fun writeReceipt(user: UserState, nonce: Int, action: Int, result: Int, aux: Int, part_count: Int): UserState {
        user.receipts.set(nonce % RECEIPT_RING_K, ReceiptSlot {
            nonce: nonce,
            action: action,
            result: result,
            aux: aux,
            part_count: part_count,
            at: now()
        });
        return user;
    }

    // Update an existing receipt by nonce (ACK / bounce / tombstone). Eviction-safe: the slot is only
    // overwritten if it still holds this exact nonce, so a late ACK can never stamp a foreign receipt.
    fun updateReceipt(user: UserState, nonce: Int, result: Int, aux: Int): UserState {
        let idx: Int = nonce % RECEIPT_RING_K;
        let slotOpt: ReceiptSlot? = user.receipts.get(idx);
        if (slotOpt != null) {
            let slot: ReceiptSlot = slotOpt!!;
            if (slot.nonce == nonce) {
                slot.result = result;
                slot.aux = aux;
                user.receipts.set(idx, slot);
            }
        }
        return user;
    }

    fun deriveAthWalletAddress(owner: Address): Address {
        let owner_std: StdAddress = parseStdAddress(owner.asSlice());
        let wallet_init: StateInit = initOf ATHWallet(0, owner, self.ath_master_address);
        return contractAddressExt(owner_std.workchain, wallet_init.code, wallet_init.data);
    }

    fun isBasechainAddress(owner: Address): Bool {
        // Std-address basechain prefix check; sister contracts use parseStdAddress(...).workchain == 0 for the same standard-address condition.
        let ownerSlice: Slice = owner.asSlice();
        return ownerSlice.loadUint(11) == 1024;
    }

    fun pendingPublishCount(): Int {
        // Count of outstanding batch publishes (one per live pending_batch_publishes entry): incremented when
        // a batch is handed to the Hub, decremented on its ACK/bounce/prune settlement. Surfaced in get_global
        // and asserted == 0 at genesis.
        return self.pending_publish_count % VAULT_PENDING_PROFILE_COUNT_UNIT;
    }

    fun pendingProfileAvatarPaymentCount(): Int {
        return (self.pending_publish_count / VAULT_PENDING_PROFILE_COUNT_UNIT) % VAULT_PENDING_PROFILE_COUNT_MOD;
    }

    fun pendingUsernameMintPaymentCount(): Int {
        return self.pending_publish_count / VAULT_PENDING_USERNAME_COUNT_UNIT;
    }

    fun incrementPendingPublishCount() {
        // No < MAX guard here (unlike the 16-bit profile/username lanes): the publish lane is the low 32 bits,
        // so its implicit cap is 2^32-1 — unreachable (each pending needs a funded user + unique nonce + an
        // unsettled Hub round-trip). A throwing guard would also be unsafe: this runs POST-acceptMessage, so a
        // throw would strand the user's debit. The 32-bit width IS the bound; the carry into the profile lane
        // it would otherwise risk is not physically attainable.
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

    fun isValidProfileAvatarPointer(ownerWallet: Address, avatarHash: Int, avatarStreamId: Int, avatarPartCount: Int, mediaFormat: Int): Bool {
        return self.isBasechainAddress(ownerWallet)
            && (avatarHash != 0)
            && (avatarStreamId != 0)
            && (avatarPartCount > 0)
            && (avatarPartCount <= PROFILE_AVATAR_MAX_PARTS)
            && (mediaFormat == PROFILE_AVATAR_MEDIA_FORMAT_WEBP);
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
            if (!self.isAllowedPublicSizeClass(sizeClass)) { return false; }
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

    fun isAllowedPublicSizeClass(sizeClass: Int): Bool {
        return self.isAllowedPrivateSizeClass(sizeClass);
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

    fun publicBodyBytes(sizeClass: Int): Int {
        throwUnless(16330, self.isAllowedPublicSizeClass(sizeClass));
        return sizeClass * 1024;
    }

    fun publicBodyBits(sizeClass: Int): Int {
        return self.publicBodyBytes(sizeClass) * 8;
    }

    fun publicBodyCells(sizeClass: Int): Int {
        return (self.publicBodyBytes(sizeClass) + 126) / 127;
    }

    fun publicBodyRefs(sizeClass: Int): Int {
        return self.publicBodyCells(sizeClass) - 1;
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

    fun isPublicCapsuleShapeValid(sizeClass: Int, header: Cell, body: Cell): Bool {
        if (!self.isPublicCapsuleCell(header, CAPSULEHUB_PUBLIC_HEADER_MAX_CELLS, CAPSULEHUB_PUBLIC_HEADER_MAX_BITS, CAPSULEHUB_PUBLIC_HEADER_MAX_REFS, true)) {
            return false;
        }
        return self.isPublicCapsuleCell(body, self.publicBodyCells(sizeClass), self.publicBodyBits(sizeClass), self.publicBodyRefs(sizeClass), true);
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

    // --- VPB2 batch helpers (bounce_id/tag reuse computePublishBounceId/computePublishBounceTag) ---
    fun batchStorageReserve(kind: Int): Int {
        if (kind == PUBLISH_KIND_PUBLIC) { return STORAGE_RESERVE_PUBLIC; }
        return STORAGE_RESERVE_PRIVATE;
    }

    fun batchHubPartGas(kind: Int): Int {
        if (kind == PUBLISH_KIND_PUBLIC) { return HUB_PART_GAS_PUBLIC; }
        return HUB_PART_GAS_PRIVATE;
    }

    fun batchVaultPartGas(kind: Int): Int {
        if (kind == PUBLISH_KIND_PUBLIC) { return VAULT_PART_GAS_PUBLIC; }
        return VAULT_PART_GAS_PRIVATE;
    }

    // publish_id = hash(BPI1 ‖ manifest ‖ owner ‖ nonce ‖ parts_root_hash ‖ kind ‖ part_count).
    fun computeBatchPublishId(owner: Address, nonce: Int, partsRootHash: Int, kind: Int, partCount: Int): Int {
        return beginCell()
            .storeUint(VAULT_BATCH_PUBLISH_ID_DOMAIN, 32)
            .storeUint(self.deployment_manifest_hash, 256)
            .storeAddress(owner)
            .storeUint(nonce, 64)
            .storeUint(partsRootHash, 256)
            .storeUint(kind, 8)
            .storeUint(partCount, 8)
            .endCell()
            .hash();
    }

    // Pre-accept worst-case floor: EXT_HARD import (drain-proof, part_count-independent) + bounded walk
    // + reject base. reject_fee <= this <= max_charge, so a rejected batch is fully paid by the user.
    inline fun batchChargeFloor(partCount: Int): Int {
        // Pinned affine floor (worst-case import hold + bounded reject compute). Pure arithmetic — no fee
        // primitive — so it fits the 10k pre-accept gas credit. Also serves as reject_fee (refund >= 0 by
        // construction). See BATCH_FLOOR_BASE_PIN for the calibration + drain-safety argument.
        return BATCH_FLOOR_BASE_PIN + BATCH_FLOOR_PER_PART_PIN * partCount;
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

    // Credits the community-activity airdrop for `count` confirmed capsules (owner decision Q2: 10 ATH per
    // capsule, no per-account cap), capped at the remaining pool. count == part_count for a confirmed batch.
    fun creditActivityAirdrop(owner: Address, count: Int) {
        if (self.genesis_config_hash <= 0) {
            return;
        }
        throwUnless(16540, self.users.exists(owner));
        let reward: Int = VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH * count;
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

    fun isValidPqPubkeyCell(pqLen: Int, cryptoSuiteMask: Int, pqPubkey: Cell): Bool {
        if (cryptoSuiteMask != CRYPTO_SUITE_HYBRID) {
            return false;
        }
        let size: DataSize = pqPubkey.computeDataSize(MLKEM768_PUBKEY_SNAKE_CELLS);
        if (size.cells != MLKEM768_PUBKEY_SNAKE_CELLS) {
            return false;
        }
        if (size.bits != MLKEM768_PUBKEY_SNAKE_BITS) {
            return false;
        }
        if (size.refs != MLKEM768_PUBKEY_SNAKE_REFS) {
            return false;
        }

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
            if (cursorSlice.bits() != (chunkBytes * 8)) {
                return false;
            }
            if (remaining > chunkBytes) {
                if (cursorSlice.refs() != 1) {
                    return false;
                }
                cursor = cursorSlice.loadRef();
            } else {
                if (cursorSlice.refs() != 0) {
                    return false;
                }
            }
            remaining -= chunkBytes;
        }
        return true;
    }

    fun isValidKeyProfile(encPubkey: Int, signPubkey: Int, pqHash: Int, pqLen: Int, pqPubkey: Cell, cryptoSuiteMask: Int): Bool {
        if (encPubkey == 0) {
            return false;
        }
        if (signPubkey == 0) {
            return false;
        }
        if (cryptoSuiteMask != CRYPTO_SUITE_HYBRID) {
            return false;
        }
        if (pqHash == 0) {
            return false;
        }
        if (pqLen != MLKEM768_PUBKEY_LEN) {
            return false;
        }
        return self.isValidPqPubkeyCell(pqLen, cryptoSuiteMask, pqPubkey);
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

    fun computeReceiveIntentId(senderWallet: Address, recipientWallet: Address, asset: Int, amount: Int, clientNonce: Int): Int {
        // Keep receive-intent lookups cheap enough for pre-accept external claims.
        // The id is still hash-derived, but truncated to the uint128 storage key.
        return beginCell()
            .storeUint(RECEIVE_INTENT_ID_DOMAIN, 32)
            .storeAddress(senderWallet)
            .storeAddress(recipientWallet)
            .storeUint(asset, 8)
            .storeUint(amount, 128)
            .storeUint(clientNonce, 64)
            .endCell()
            .hash() % UINT128_MOD;
    }

    fun computeReceiveIntentCommitment(intentId: Int, recipientWallet: Address, secret32: Int): Int {
        // Protocol v1 intentionally exposes the secret gate value; claim still requires the recipient wallet signature.
        return secret32;
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

    // Spec 6: one-shot, genesis-controller-only, post-seal announcement of a future successor deployment. It is a
    // DATA RECORD only — no auto-switch semantics (clients verify out-of-band and never migrate automatically), so
    // immutability is preserved. The unset guard makes it irreversible: a set record can never be changed, so this
    // is the migration trust-root hint, never an upgrade path. (The announcement key is the controller's sole
    // standing post-seal power; custody/retirement is an operational mandate — see spec 6.)
    receive(msg: AnnounceSuccessorManifest) {
        self.requireSealed();
        let ext: Slice = self.genesis_ext.beginParse();
        let controllerHash: Int = ext.loadUint(256);
        throwUnless(15050, controllerHash != 0);
        throwUnless(15051, beginCell().storeAddress(sender()).endCell().hash() == controllerHash);
        throwUnless(15052, !ext.loadBool()); // one-shot: a record already present is irreversible
        self.genesis_ext = beginCell()
            .storeUint(controllerHash, 256)
            .storeBool(true)
            .storeUint(msg.successor_manifest_hash, 256)
            .storeAddress(msg.successor_vault)
            .storeUint(now(), 32)
            .endCell();
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

    external(msg: WithdrawTonFromVaultBalance) {
        self.requireEmptyEnvelopePadding(msg.envelope_padding);
        self.requireSealed();
        throwUnless(16800, self.isBasechainAddress(msg.owner_wallet));
        let userOpt: UserState? = self.users.get(msg.owner_wallet);
        throwUnless(16801, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16802, user.auth_pubkey != 0);
        throwUnless(16803, checkSignature(msg.signed_payload.hash(), msg.signature, user.auth_pubkey));

        let signedPayload: Slice = msg.signed_payload.beginParse();
        let signedDomain: Int = signedPayload.loadUint(32);
        throwUnless(16804, signedDomain == VAULT_WITHDRAW_TON_SIGNING_DOMAIN);
        let signedManifestHash: Int = signedPayload.loadUint(256);
        throwUnless(16805, signedManifestHash == self.deployment_manifest_hash);
        let signedVaultAddress: Address = signedPayload.loadAddress();
        throwUnless(16806, signedVaultAddress == myAddress());
        let signedOwner: Address = signedPayload.loadAddress();
        throwUnless(16807, signedOwner == msg.owner_wallet);
        let clientNonce: Int = signedPayload.loadUint(64);
        throwUnless(16808, clientNonce == user.publish_nonce);
        throwUnless(16816, user.ton_balance >= VAULT_WITHDRAW_TON_EXEC_RESERVE);

        acceptMessage();
        user.ton_balance -= VAULT_WITHDRAW_TON_EXEC_RESERVE;
        user.publish_nonce += 1;
        user = self.writeReceipt(user, user.publish_nonce - 1, ACT_WITHDRAW_TON, RES_PROCESSING, 0, 0);
        self.users.set(msg.owner_wallet, user);
        commit();

        if (!(signedPayload.bits() == 0)) {
            return;
        }
        if (!(signedPayload.refs() == 1)) {
            return;
        }
        let actionPayload: Slice = signedPayload.loadRef().beginParse();
        let amount: Int = actionPayload.loadUint(128);
        let recipient: Address = actionPayload.loadAddress();
        if (!(actionPayload.bits() == 0)) {
            return;
        }
        if (!(actionPayload.refs() == 0)) {
            return;
        }
        if (!(amount > 0)) {
            return;
        }
        if (!(recipient != myAddress())) {
            return;
        }
        if (!self.isBasechainAddress(recipient)) {
            return;
        }
        if (!(user.ton_balance >= amount)) {
            return;
        }
        user.ton_balance -= amount;
        self.users.set(msg.owner_wallet, user);

        message(MessageParameters {
            to: recipient,
            value: amount,
            bounce: false,
            mode: SendPayFwdFeesSeparately,
            body: null
        });
    }

    external(msg: WithdrawAthFromVaultBalance) {
        self.requireEmptyEnvelopePadding(msg.envelope_padding);
        self.requireSealed();
        throwUnless(16075, self.isBasechainAddress(msg.owner_wallet));
        let userOpt: UserState? = self.users.get(msg.owner_wallet);
        throwUnless(16024, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16031, user.auth_pubkey != 0);
        throwUnless(16032, checkSignature(msg.signed_payload.hash(), msg.signature, user.auth_pubkey));

        let signedPayload: Slice = msg.signed_payload.beginParse();
        let signedDomain: Int = signedPayload.loadUint(32);
        throwUnless(16033, signedDomain == VAULT_WITHDRAW_ATH_SIGNING_DOMAIN);
        let signedManifestHash: Int = signedPayload.loadUint(256);
        throwUnless(16034, signedManifestHash == self.deployment_manifest_hash);
        let signedVaultAddress: Address = signedPayload.loadAddress();
        throwUnless(16035, signedVaultAddress == myAddress());
        let signedOwner: Address = signedPayload.loadAddress();
        throwUnless(16036, signedOwner == msg.owner_wallet);
        let clientNonce: Int = signedPayload.loadUint(64);
        throwUnless(16037, clientNonce == user.publish_nonce);
        throwUnless(16027, user.ton_balance >= VAULT_ATH_WITHDRAW_MIN_VALUE);

        acceptMessage();
        user.publish_nonce += 1;
        user = self.writeReceipt(user, user.publish_nonce - 1, ACT_WITHDRAW_ATH, RES_PROCESSING, 0, 0);
        user.ton_balance -= VAULT_ATH_WITHDRAW_MIN_VALUE;
        self.users.set(msg.owner_wallet, user);
        commit();

        if (!(signedPayload.bits() == 0)) {
            return;
        }
        if (!(signedPayload.refs() == 1)) {
            return;
        }

        let actionPayload: Slice = signedPayload.loadRef().beginParse();
        let amount: Int = actionPayload.loadUint(128);
        let recipient: Address = actionPayload.loadAddress();
        if (!(actionPayload.bits() == 0)) {
            return;
        }
        if (!(actionPayload.refs() == 0)) {
            return;
        }
        if (!(amount > 0)) {
            return;
        }
        if (!(recipient != myAddress())) {
            return;
        }
        if (!self.isBasechainAddress(recipient)) {
            return;
        }
        if (!(user.ath_balance >= amount)) {
            return;
        }
        let withdrawalId: Int = self.computeAthWithdrawalId(msg.owner_wallet, clientNonce);
        if (self.pending_ath_withdrawals.exists(withdrawalId)) {
            return;
        }
        user.ath_balance -= amount;
        self.users.set(msg.owner_wallet, user);
        let recipientAthWallet: Address = self.deriveAthWalletAddress(recipient);
        self.pending_ath_withdrawals.set(withdrawalId, PendingAthWithdrawal {
            owner_wallet: msg.owner_wallet,
            recipient: recipient,
            recipient_ath_wallet: recipientAthWallet,
            amount: amount,
            refundable_ton_amount: VAULT_ATH_WITHDRAW_MIN_VALUE,
            created_at: now()
        });
        self.pending_ath_withdrawal_count += 1;

        message(MessageParameters {
            to: self.vault_ath_wallet_address,
            value: VAULT_ATH_WITHDRAW_MIN_VALUE,
            bounce: true,
            mode: SendDefaultMode,
            body: ATHTransferRequest {
                query_id: withdrawalId,
                amount: amount,
                recipient: recipient,
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
        self.requireEmptyEnvelopePadding(msg.envelope_padding);
        self.requireSealed();
        let userOpt: UserState? = self.users.get(msg.owner_wallet);
        throwUnless(16120, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16121, user.current_key_id != 0);
        throwUnless(16128, user.auth_pubkey != 0);
        throwUnless(16130, checkSignature(msg.signed_payload.hash(), msg.signature, user.auth_pubkey));

        let signedPayload: Slice = msg.signed_payload.beginParse();
        throwUnless(16136, signedPayload.bits() == 864);
        throwUnless(16137, signedPayload.refs() == 1);
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
        let localReserve: Int = VAULT_STATE_GROWTH_EXEC_RESERVE;
        throwUnless(16126, user.ton_balance >= localReserve);
        acceptMessage();
        user.ton_balance -= localReserve;
        user.publish_nonce += 1;
        user = self.writeReceipt(user, user.publish_nonce - 1, ACT_REPLACE_KEYS, RES_PROCESSING, 0, 0);
        self.users.set(msg.owner_wallet, user);
        commit();

        let actionPayloadCell: Cell = signedPayload.loadRef();
        let actionPayloadPreview: Slice = actionPayloadCell.beginParse();
        if (!(actionPayloadPreview.bits() == 800)) {
            return;
        }
        if (!(actionPayloadPreview.refs() == 1)) {
            return;
        }

        let required: Int = self.keyRecordStorageEndowment(CRYPTO_SUITE_HYBRID);
        required += VAULT_STATE_GROWTH_EXEC_RESERVE;
        let remainingRequired: Int = required - localReserve;
        if (!(user.ton_balance >= remainingRequired)) {
            return;
        }

        let actionPayload: Slice = actionPayloadCell.beginParse();
        let encPubkey: Int = actionPayload.loadUint(256);
        let signPubkey: Int = actionPayload.loadUint(256);
        let pqKemPubkeyHash: Int = actionPayload.loadUint(256);
        let pqKemPubkeyLen: Int = actionPayload.loadUint(16);
        let pqKemPubkey: Cell = actionPayload.loadRef();
        let cryptoSuiteMask: Int = actionPayload.loadUint(16);
        if (!(actionPayload.bits() == 0)) {
            return;
        }
        if (!(actionPayload.refs() == 0)) {
            return;
        }

        if (!self.isValidKeyProfile(encPubkey, signPubkey, pqKemPubkeyHash, pqKemPubkeyLen, pqKemPubkey, cryptoSuiteMask)) {
            return;
        }
        if (!(signPubkey != user.auth_pubkey)) {
            return;
        }

        let oldRecordOpt: KeyRecord? = self.key_records.get(user.current_key_id);
        if (oldRecordOpt == null) {
            return;
        }
        let oldRecord: KeyRecord = oldRecordOpt!!;
        if (!(oldRecord.owner_wallet == msg.owner_wallet)) {
            return;
        }
        if (!(oldRecord.revoked_lt == 0)) {
            return;
        }
        if (!(oldRecord.key_generation < UINT32_MAX)) {
            return;
        }

        let keyGeneration: Int = oldRecord.key_generation + 1;
        let newKeyId: Int = self.computeKeyId(msg.owner_wallet, keyGeneration, encPubkey, signPubkey, pqKemPubkeyHash, pqKemPubkeyLen, cryptoSuiteMask);
        if (self.key_records.exists(newKeyId)) {
            return;
        }

        oldRecord.revoked_at = now();
        oldRecord.revoked_lt = curLt();
        self.key_records.set(user.current_key_id, oldRecord);

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
        user.ton_balance -= remainingRequired;
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
        // Advances past the std-address prefix. A separate prefix throw was tested and pushes large publish externals over the 10k pre-accept gas credit; basechain deployment is enforced by genesis/config.
        let vaultAddressPrefix: Int = vaultAddressSlice.loadUint(11);
        throwUnless(16225, signedVaultHash == vaultAddressSlice.loadUint(256));
        let signedOwnerHash: Int = signedPayload.loadUint(256);
        let ownerPrefix: Slice = msg.owner_wallet.asSlice();
        // Keep receive-intent externals inside the 10k pre-accept gas credit: the signed owner hash still binds the typed outer owner address.
        ownerPrefix.loadUint(11);
        throwUnless(16288, signedOwnerHash == ownerPrefix.loadUint(256));
        throwUnless(16226, signedPayload.loadUint(8) == VAULT_RECEIVE_INTENT_ACTION_CREATE);
        let clientNonce: Int = signedPayload.loadUint(64);
        throwUnless(16233, clientNonce == user.publish_nonce);
        let createLocalReserve: Int = VAULT_STATE_GROWTH_EXEC_RESERVE;
        throwUnless(16265, user.ton_balance >= createLocalReserve);
        acceptMessage();
        user.publish_nonce += 1;
        user = self.writeReceipt(user, user.publish_nonce - 1, ACT_CREATE_INTENT, RES_PROCESSING, 0, 0);
        user.ton_balance -= createLocalReserve;
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
        let remainingTonReserve: Int = tonReserve - createLocalReserve;
        if (asset == ASSET_TON) {
            if (!(user.ton_balance >= amount + remainingTonReserve)) {
                return;
            }
            let intentId: Int = self.computeReceiveIntentId(msg.owner_wallet, recipientWallet, asset, amount, clientNonce);
            if (self.receive_intents.exists(intentId)) {
                return;
            }
            user.ton_balance -= (amount + remainingTonReserve);
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
            if (!(user.ton_balance >= remainingTonReserve)) {
                return;
            }
            let intentId: Int = self.computeReceiveIntentId(msg.owner_wallet, recipientWallet, asset, amount, clientNonce);
            if (self.receive_intents.exists(intentId)) {
                return;
            }
            user.ath_balance -= amount;
            user.ton_balance -= remainingTonReserve;
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
    }

    external(msg: ClaimReceiveIntent) {
        // Valid users/intents are created only by sealed flows; auth, manifest, vault binding, and intent checks stay pre-accept here.
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
        // Advances past the std-address prefix. A separate prefix throw was tested and pushes large publish externals over the 10k pre-accept gas credit; basechain deployment is enforced by genesis/config.
        let vaultAddressPrefix: Int = vaultAddressSlice.loadUint(11);
        throwUnless(16244, signedVaultHash == vaultAddressSlice.loadUint(256));
        let signedOwnerHash: Int = signedPayload.loadUint(256);
        let ownerPrefix: Slice = msg.owner_wallet.asSlice();
        // Keep receive-intent externals inside the 10k pre-accept gas credit: the signed owner hash still binds the typed outer owner address.
        ownerPrefix.loadUint(11);
        throwUnless(16292, signedOwnerHash == ownerPrefix.loadUint(256));
        throwUnless(16245, signedPayload.loadUint(8) == VAULT_RECEIVE_INTENT_ACTION_CLAIM);
        let clientNonce: Int = signedPayload.loadUint(64);
        throwUnless(16249, clientNonce == user.publish_nonce);
        let actionPayload: Slice = signedPayload.loadRef().beginParse();
        let intentId: Int = actionPayload.loadUint(256);
        let secret32: Int = actionPayload.loadUint(256);

        let intentOpt: ReceiveIntent? = self.receive_intents.get(intentId);
        throwUnless(16276, intentOpt != null);
        let intent: ReceiveIntent = intentOpt!!;
        throwUnless(16278, msg.owner_wallet == intent.recipient_wallet);
        throwUnless(16280, secret32 == intent.commitment);

        acceptMessage();
        user.publish_nonce += 1;
        user = self.writeReceipt(user, user.publish_nonce - 1, ACT_CLAIM_INTENT, RES_PROCESSING, 0, 0);

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
        // Valid users/intents are created only by sealed flows; auth, manifest, vault binding, and intent checks stay pre-accept here.
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
        // Advances past the std-address prefix. A separate prefix throw was tested and pushes large publish externals over the 10k pre-accept gas credit; basechain deployment is enforced by genesis/config.
        let vaultAddressPrefix: Int = vaultAddressSlice.loadUint(11);
        throwUnless(16257, signedVaultHash == vaultAddressSlice.loadUint(256));
        let signedOwnerHash: Int = signedPayload.loadUint(256);
        let ownerPrefix: Slice = msg.owner_wallet.asSlice();
        // Keep receive-intent externals inside the 10k pre-accept gas credit: the signed owner hash still binds the typed outer owner address.
        ownerPrefix.loadUint(11);
        throwUnless(16296, signedOwnerHash == ownerPrefix.loadUint(256));
        throwUnless(16258, signedPayload.loadUint(8) == VAULT_RECEIVE_INTENT_ACTION_CANCEL);
        let clientNonce: Int = signedPayload.loadUint(64);
        throwUnless(16262, clientNonce == user.publish_nonce);
        let actionPayload: Slice = signedPayload.loadRef().beginParse();
        let intentId: Int = actionPayload.loadUint(256);

        let intentOpt: ReceiveIntent? = self.receive_intents.get(intentId);
        throwUnless(16285, intentOpt != null);
        let intent: ReceiveIntent = intentOpt!!;
        throwUnless(16286, msg.owner_wallet == intent.sender_wallet);

        acceptMessage();
        user.publish_nonce += 1;
        user = self.writeReceipt(user, user.publish_nonce - 1, ACT_CANCEL_INTENT, RES_PROCESSING, 0, 0);

        if (intent.asset == ASSET_TON) {
            user.ton_balance += intent.amount;
        } else {
            user.ath_balance += intent.amount;
        }

        self.users.set(msg.owner_wallet, user);
        self.receive_intents.del(intentId);
        self.receive_intent_count -= 1;
    }

    external(msg: PublishBatchFromVaultBalance) {
        // Pre-accept (O(1), inside the 10k credit): envelope strictness + binding + worst-case floor.
        self.requireEmptyEnvelopePadding(msg.envelope_padding);
        self.requireSealed();
        let userOpt: UserState? = self.users.get(msg.owner_wallet);
        throwUnless(16451, userOpt != null);
        let user: UserState = userOpt!!;
        throwUnless(16454, user.auth_pubkey != 0);
        throwUnless(16457, checkSignature(msg.signed_payload.hash(), msg.signature, user.auth_pubkey));

        // The 10k pre-accept gas credit is tight for this receiver, so pre-accept does ONLY the drain/replay
        // gates: it skips straight to the nonce/charge/part_count fields and validates the floor + balance.
        // Domain, manifest, vault/owner binding, kind, version and exact root shape are re-parsed and enforced
        // AUTHORITATIVELY post-accept (all sig-authenticated, so a mismatch is the owner's own misrouted request
        // -> a refundable RJ_BINDING reject, never an attacker drain).
        let root: Slice = msg.signed_payload.beginParse();
        root.skipBits(808); // domain(32)+manifest(256)+vault(256)+kind(8)+owner(256) — re-checked post-accept
        let clientNonce: Int = root.loadUint(64);
        throwUnless(16453, clientNonce == user.publish_nonce);
        let maxCharge: Int = root.loadUint(128);
        let partCount: Int = root.loadUint(8); // u8; range 1..MAX_BATCH_PARTS enforced post-accept (before the walk)
        // Pinned floor inlined here (NOT via batchChargeFloor) — a function call does not fit the gas credit.
        throwUnless(16485, maxCharge >= BATCH_FLOOR_BASE_PIN + BATCH_FLOOR_PER_PART_PIN * partCount);
        throwUnless(16463, user.ton_balance >= maxCharge);
        acceptMessage();

        // 3.2 accept: single full debit + nonce + PROCESSING receipt. From here every outcome is observable.
        user.ton_balance -= maxCharge;
        user.publish_nonce += 1;
        user = self.writeReceipt(user, clientNonce, ACT_PUBLISH_BATCH, RES_PROCESSING, 0, partCount);
        self.users.set(msg.owner_wallet, user);
        commit();

        // Post-accept: authoritative full re-validation of the signed root (skipped pre-accept to fit the 10k
        // credit). Every field is sig-authenticated, so a mismatch is the owner's own malformed/misrouted
        // request -> a batch-level RJ_BINDING reject WITH refund, never a silent drop.
        let vroot: Slice = msg.signed_payload.beginParse();
        let vAddr: Slice = myAddress().asSlice();
        vAddr.loadUint(11); // skip std-address prefix (basechain enforced at genesis)
        let oAddr: Slice = msg.owner_wallet.asSlice();
        let structuralOk: Bool =
               (vroot.loadUint(32) == VAULT_BATCH_PUBLISH_SIGNING_DOMAIN)
            && (vroot.loadUint(256) == self.deployment_manifest_hash)
            && (vroot.loadUint(256) == vAddr.loadUint(256));
        let kind: Int = vroot.loadUint(8);
        structuralOk = structuralOk
            && ((kind == PUBLISH_KIND_PRIVATE) || (kind == PUBLISH_KIND_PUBLIC))
            && (oAddr.loadUint(11) == 1024)
            && (vroot.loadUint(256) == oAddr.loadUint(256));
        vroot.skipBits(64 + 128 + 8); // nonce + max_charge + part_count (all validated pre-accept)
        structuralOk = structuralOk
            && (vroot.loadUint(8) == VPB2_VERSION)
            && (vroot.bits() == 0)
            && (vroot.refs() == 1);

        // 3.3 single walk over the linked part list (flag-based; Tact has no break). Reuses the V1 per-part
        // shape/hash validators. Any failure -> atomic reject WITH refund (no silent returns in V2).
        let partsRoot: Cell = vroot.loadRef();
        let cursor: Cell = partsRoot;
        let i: Int = 0;
        let rejectCode: Int = 0;
        let failIdx: Int = AUX_BATCH_LEVEL;
        // Both checks skip the walk and fall through to the reject-with-refund path. The part_count bound is
        // enforced HERE (not pre-accept, to fit the gas credit) and before the walk, so the walk gas stays
        // bounded by MAX_BATCH_PARTS (the G8 freeze gate's worst case).
        if (!structuralOk) { rejectCode = RJ_BINDING; }
        else if ((partCount < 1) || (partCount > MAX_BATCH_PARTS)) { rejectCode = RJ_PART_SHAPE; }
        let totalFee: Int = 0;
        let totalHubGas: Int = 0;
        let totalStorage: Int = 0;
        let prevH0: Int = 0;
        let prevH1: Int = 0;
        let prevBody: Int = 0;
        let hasPrev: Bool = false;
        while ((i < partCount) && (rejectCode == 0)) {
            let isLast: Bool = (i == (partCount - 1));
            let part: Slice = cursor.beginParse();
            let h0: Int = 0;
            let h1: Int = 0;
            let bh: Int = 0;
            let nextCell: Cell = partsRoot; // overwritten when not last; unused on the last iteration
            if (kind == PUBLISH_KIND_PRIVATE) {
                let wantRefs: Int = 3;
                if (!isLast) { wantRefs = 4; }
                if (!((part.bits() == 784) && (part.refs() == wantRefs))) {
                    rejectCode = RJ_PART_SHAPE; failIdx = i;
                } else {
                    let sizeClass: Int = part.loadUint(8);
                    let cryptoSuite: Int = part.loadUint(8);
                    h0 = part.loadUint(256);
                    h1 = part.loadUint(256);
                    bh = part.loadUint(256);
                    let header0: Cell = part.loadRef();
                    let header1: Cell = part.loadRef();
                    let body: Cell = part.loadRef();
                    if (!isLast) { nextCell = part.loadRef(); }
                    if (!self.isPublishProfileValid(PUBLISH_KIND_PRIVATE, sizeClass, cryptoSuite, h0, h1)) {
                        rejectCode = RJ_CLASS_OR_SUITE; failIdx = i;
                    } else if (!self.isPrivateCapsuleShapeValid(sizeClass, cryptoSuite, header0, header1, body)) {
                        rejectCode = RJ_PAYLOAD_SHAPE; failIdx = i;
                    } else if (!((header0.hash() == h0) && (header1.hash() == h1) && (body.hash() == bh))) {
                        rejectCode = RJ_HASH_MISMATCH; failIdx = i;
                    }
                }
            } else {
                let wantRefs: Int = 2;
                if (!isLast) { wantRefs = 3; }
                if (!((part.bits() == 528) && (part.refs() == wantRefs))) {
                    rejectCode = RJ_PART_SHAPE; failIdx = i;
                } else {
                    let sizeClass: Int = part.loadUint(8);
                    let reserved: Int = part.loadUint(8);
                    h0 = part.loadUint(256);
                    bh = part.loadUint(256);
                    let header: Cell = part.loadRef();
                    let body: Cell = part.loadRef();
                    if (!isLast) { nextCell = part.loadRef(); }
                    if (!(reserved == 0)) {
                        rejectCode = RJ_PART_SHAPE; failIdx = i;
                    } else if (!self.isPublishProfileValid(PUBLISH_KIND_PUBLIC, sizeClass, CRYPTO_SUITE_PUBLIC_NONE, h0, 0)) {
                        rejectCode = RJ_CLASS_OR_SUITE; failIdx = i;
                    } else if (!self.isPublicCapsuleShapeValid(sizeClass, header, body)) {
                        rejectCode = RJ_PAYLOAD_SHAPE; failIdx = i;
                    } else if (!((header.hash() == h0) && (body.hash() == bh))) {
                        rejectCode = RJ_HASH_MISMATCH; failIdx = i;
                    }
                }
            }
            if (rejectCode == 0) {
                if (hasPrev && (h0 == prevH0) && (h1 == prevH1) && (bh == prevBody)) {
                    rejectCode = RJ_DUPLICATE_ADJACENT; failIdx = i; // anti-bloat tripwire only
                } else {
                    totalFee += self.discountedFee(msg.owner_wallet, PROTOCOL_FEE_TON_BATCH);
                    totalHubGas += self.batchHubPartGas(kind);
                    totalStorage += self.batchStorageReserve(kind);
                    prevH0 = h0;
                    prevH1 = h1;
                    prevBody = bh;
                    hasPrev = true;
                    cursor = nextCell;
                }
            }
            i += 1;
        }

        let publishId: Int = self.computeBatchPublishId(msg.owner_wallet, clientNonce, partsRoot.hash(), kind, partCount);
        let bounceId: Int = self.computePublishBounceId(publishId);
        if (rejectCode == 0) {
            if (publishId == 0) {
                rejectCode = RJ_ID_ZERO;
            } else if (self.pending_batch_publishes.exists(bounceId)) {
                rejectCode = RJ_PENDING_COLLISION;
            }
        }

        // Measure the actual external once, BEFORE the gate (the canonical gate needs hubFwd). Bounded by the
        // validated walk, so computeDataSize cannot overflow EXT_HARD_CELLS (the EXT_HARD fallback is
        // unreachable). measured_import = the import the Vault truly paid; hubFwd = the Vault->Hub forward over
        // the FULL PublishBatchToHub message (fixed root cell + parts subtree + optional marketing cell), which
        // under SendPayGasSeparately the Vault pays from its own retention.
        let measuredCells: Int = EXT_HARD_CELLS;
        let measuredBits: Int = EXT_HARD_BITS;
        try {
            let pd: DataSize = msg.signed_payload.computeDataSize(EXT_HARD_CELLS);
            measuredCells = pd.cells;
            measuredBits = pd.bits;
        } catch (e) {}
        let measuredImport: Int = getForwardFee(measuredCells, measuredBits, false);
        let hubMsgCells: Int = measuredCells;                                    // parts subtree (measuredCells-1) + 1 root cell
        let hubMsgBits: Int = (measuredBits - 1016) + HUB_BATCH_MSG_ROOT_BITS;   // parts subtree bits + root bits
        if (kind == PUBLISH_KIND_PUBLIC) {
            hubMsgCells += 1;                                                     // marketing cell
            hubMsgBits += 152;
        }
        let hubFwd: Int = getForwardFee(hubMsgCells, hubMsgBits, false);
        let vaultCompute: Int = getComputeFee(VAULT_BATCH_BASE_GAS + self.batchVaultPartGas(kind) * partCount, false);

        // canonical_total (the signed hold): the import term is the EXT_HARD worst case (== floor import, so an
        // honest send clears the floor gate too — G10); every other term is the runtime-priced REAL cost,
        // including the Vault->Hub forward (hubFwd) so the Hub leg is funded even when the import over-hold is
        // small. Success retention below uses the MEASURED import; the import over-hold (~0.07 TON snapshot)
        // rides to the Hub and returns via the mode-128 ACK (Q4: protocol margin lives only in the per-part fee).
        let canonicalTotal: Int = getForwardFee(EXT_HARD_CELLS, EXT_HARD_BITS, false)
            + vaultCompute
            + hubFwd
            + totalFee
            + getComputeFee(totalHubGas, false)
            + totalStorage * 125 / 100
            + getComputeFee(HUB_BATCH_BASE_GAS, false)
            + ACK_MIN_FORWARD;
        if ((rejectCode == 0) && (maxCharge < canonicalTotal)) {
            rejectCode = RJ_UNDERPRICED;
        }

        if (rejectCode != 0) {
            // Atomic reject WITH refund. reject_fee IS the pinned floor (worst-case import + bounded reject
            // compute), so reject_fee == floor <= max_charge (pre-accept gate) => refund >= 0 ALWAYS, and the
            // Vault recovers its real import (pin >= runtime import, gate G2). The user loses the worst-case
            // import their padded/malformed external could have caused, plus one nonce; the receipt names the part.
            let rejectFee: Int = self.batchChargeFloor(partCount);
            user = self.updateReceipt(user, clientNonce, rejectCode, failIdx);
            user.ton_balance += maxCharge - rejectFee;
            self.users.set(msg.owner_wallet, user);
            return;
        }

        // Success: retain only the MEASURED import + Vault compute + the Vault->Hub forward; the rest
        // (import over-hold + ack float + hub costs) rides to the Hub in the message value.
        let callValue: Int = maxCharge - (measuredImport + vaultCompute + hubFwd);

        let marketing: Cell? = null;
        if (kind == PUBLISH_KIND_PUBLIC) {
            marketing = beginCell().storeUint(PLATHO_PUBLIC_MARKETING_NOTE_ASCII, 152).endCell();
        }
        self.pending_batch_publishes.set(bounceId, PendingBatchPublish {
            owner_wallet: msg.owner_wallet,
            tombstone: false,
            refund_to_vault: true,
            nonce: clientNonce,
            publish_kind: kind,
            part_count: partCount,
            publish_id: publishId,
            refundable_amount: callValue,
            created_at: now()
        });
        self.incrementPendingPublishCount(); // decremented on this batch's ACK/bounce/prune settlement (Group D)
        commit();

        message(MessageParameters {
            to: self.capsule_hub_address,
            value: callValue,
            bounce: true,
            mode: SendPayGasSeparately,
            body: PublishBatchToHub {
                bounce_id: bounceId,
                bounce_tag: self.computePublishBounceTag(publishId),
                publish_id: publishId,
                publish_kind: kind,
                part_count: partCount,
                protocol_fee_total: totalFee,
                author_wallet: msg.owner_wallet,
                parts: partsRoot,
                marketing: marketing
            }.toCell()
        });
    }

    external(msg: SetProfileAvatarFromVaultBalance) {
        self.requireEmptyEnvelopePadding(msg.envelope_padding);
        self.requireSealed();
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
        let signedOwner: Address = signedPayload.loadAddress();
        throwUnless(16618, signedOwner == msg.owner_wallet);
        let clientNonce: Int = signedPayload.loadUint(64);
        throwUnless(16611, clientNonce == user.publish_nonce);
        let maxTonCharge: Int = signedPayload.loadUint(128);
        throwUnless(16615, maxTonCharge >= VAULT_PROFILE_AVATAR_LOCAL_EXEC_RESERVE);
        let signedVaultAddress: Address = signedPayload.loadAddress();
        throwUnless(16619, signedVaultAddress == myAddress());
        throwUnless(16614, user.ton_balance >= VAULT_PROFILE_AVATAR_LOCAL_EXEC_RESERVE);
        acceptMessage();
        user.publish_nonce += 1;
        user = self.writeReceipt(user, user.publish_nonce - 1, ACT_SET_AVATAR, RES_PROCESSING, 0, 0);
        user.ton_balance -= VAULT_PROFILE_AVATAR_LOCAL_EXEC_RESERVE;
        self.users.set(msg.owner_wallet, user);
        commit();
        if (!self.isProfileRegistryBound()) {
            return;
        }

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
        if (!self.isValidProfileAvatarPointer(msg.owner_wallet, avatarHash, avatarStreamId, avatarPartCount, mediaFormat)) {
            return;
        }

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
        self.requireEmptyEnvelopePadding(msg.envelope_padding);
        self.requireSealed();
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
        let signedOwner: Address = signedPayload.loadAddress();
        throwUnless(16716, signedOwner == msg.owner_wallet);
        let clientNonce: Int = signedPayload.loadUint(64);
        throwUnless(16711, clientNonce == user.publish_nonce);
        let maxTonCharge: Int = signedPayload.loadUint(128);
        throwUnless(16715, maxTonCharge >= VAULT_USERNAME_MINT_LOCAL_EXEC_RESERVE);
        let signedVaultAddress: Address = signedPayload.loadAddress();
        throwUnless(16717, signedVaultAddress == myAddress());
        throwUnless(16714, user.ton_balance >= VAULT_USERNAME_MINT_LOCAL_EXEC_RESERVE);
        acceptMessage();
        user.publish_nonce += 1;
        user = self.writeReceipt(user, user.publish_nonce - 1, ACT_MINT_USERNAME, RES_PROCESSING, 0, 0);
        user.ton_balance -= VAULT_USERNAME_MINT_LOCAL_EXEC_RESERVE;
        self.users.set(msg.owner_wallet, user);
        commit();
        if (!self.isUsernameRegistryBound()) {
            return;
        }

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

    fun creditBatchSettlementRefund(user: UserState, refundableAmount: Int): UserState {
        // Credits (context().value − ACK exec reserve) to ton_balance, CAPPED at refundable_amount (the value the
        // Vault actually sent to the Hub). The cap matches spec 5.4/5.5 — an uncapped credit would be an
        // unbacked-ledger insolvency primitive (the Hub could mint Vault liabilities by over-returning value).
        let ackReserve: Int = getComputeFee(ACK_GAS, false);
        let refundAmount: Int = 0;
        if (context().value > ackReserve) {
            refundAmount = context().value - ackReserve;
        }
        if (refundAmount > refundableAmount) {
            refundAmount = refundableAmount;
        }
        if (refundAmount > 0) {
            user.ton_balance += refundAmount;
        }
        return user;
    }

    // VPB2 batch ACK (spec 5.4): the Hub confirms a batch. Verify sender + FULL publish_id, refund the returned
    // over-hold (capped), credit the per-capsule airdrop (count from the RECORD, never the message), advance the
    // receipt to RES_CONFIRMED, drop the pending. A late ACK on a tombstoned pending still settles, so a user who
    // pruned a slow publish keeps their airdrop/refund right (the tombstone was already count-decremented).
    receive(msg: CapsuleHubBatchAck) {
        self.requireSealed();
        throwUnless(16550, sender() == self.capsule_hub_address);
        let bounceId: Int = self.computePublishBounceId(msg.publish_id);
        let pendingOpt: PendingBatchPublish? = self.pending_batch_publishes.get(bounceId);
        throwUnless(16551, pendingOpt != null);
        let pending: PendingBatchPublish = pendingOpt!!;
        throwUnless(16552, pending.publish_id == msg.publish_id);
        self.creditActivityAirdrop(pending.owner_wallet, pending.part_count);
        let user: UserState = self.creditBatchSettlementRefund(self.getUserOrEmpty(pending.owner_wallet), pending.refundable_amount);
        user = self.updateReceipt(user, pending.nonce, RES_CONFIRMED, msg.first_entry_id);
        self.users.set(pending.owner_wallet, user);
        if (!pending.tombstone) {
            self.decrementPendingPublishCount();
        }
        self.pending_batch_publishes.del(bounceId);
    }

    // VPB2 bounce recovery (spec 5.5): FAIL-CLOSED — this handler MUST NOT throw on ANY input (a delayed bounce
    // after a tombstone-delete must not strand in a throwing handler). Unknown sender / no pending / tag mismatch
    // => silently absorb (value joins the Vault balance). On a verified match: refund the full call value (capped)
    // and advance the receipt to RES_BOUNCED_REFUNDED. bounced<T> exposes only the first 224 bits (bounce_id +
    // bounce_tag), which is exactly what we key + authenticate on.
    bounced(msg: bounced<PublishBatchToHub>) {
        if (sender() != self.capsule_hub_address) {
            return;
        }
        let pendingOpt: PendingBatchPublish? = self.pending_batch_publishes.get(msg.bounce_id);
        if (pendingOpt == null) {
            return;
        }
        let pending: PendingBatchPublish = pendingOpt!!;
        if (self.computePublishBounceTag(pending.publish_id) != msg.bounce_tag) {
            return;
        }
        let user: UserState = self.creditBatchSettlementRefund(self.getUserOrEmpty(pending.owner_wallet), pending.refundable_amount);
        user = self.updateReceipt(user, pending.nonce, RES_BOUNCED_REFUNDED, AUX_BATCH_LEVEL);
        self.users.set(pending.owner_wallet, user);
        if (!pending.tombstone) {
            self.decrementPendingPublishCount();
        }
        self.pending_batch_publishes.del(msg.bounce_id);
    }

    // VPB2 manual prune (spec 3.5): a stuck pending (no ACK/bounce for VAULT_PENDING_PUBLISH_STALE_TTL) ->
    // tombstone (a VAULT_PRUNED_PUBLISH_TOMBSTONE_TTL window in which a late ACK/bounce can still settle) ->
    // delete. Prune NEVER refunds (fail-closed); refunds arrive only via the ACK (over-hold) or bounce (full).
    receive(msg: PruneBatchPublish) {
        self.requireSealed();
        throwUnless(16563, context().value >= VAULT_PRUNE_PENDING_PUBLISH_EXEC_RESERVE);
        let bounceId: Int = self.computePublishBounceId(msg.publish_id);
        let pendingOpt: PendingBatchPublish? = self.pending_batch_publishes.get(bounceId);
        throwUnless(16560, pendingOpt != null);
        let pending: PendingBatchPublish = pendingOpt!!;
        throwUnless(16561, pending.publish_id == msg.publish_id);
        if (pending.tombstone) {
            throwUnless(16564, now() >= pending.created_at);
            self.pending_batch_publishes.del(bounceId);
            return;
        }
        throwUnless(16562, now() >= pending.created_at + VAULT_PENDING_PUBLISH_STALE_TTL);
        let tombstoneExpiresAt: Int = now() + VAULT_PRUNED_PUBLISH_TOMBSTONE_TTL;
        if (tombstoneExpiresAt > UINT32_MAX) {
            tombstoneExpiresAt = UINT32_MAX;
        }
        let user: UserState = self.updateReceipt(self.getUserOrEmpty(pending.owner_wallet), pending.nonce, RES_TOMBSTONED, AUX_BATCH_LEVEL);
        self.users.set(pending.owner_wallet, user);
        self.pending_batch_publishes.set(bounceId, PendingBatchPublish {
            owner_wallet: pending.owner_wallet,
            tombstone: true,
            refund_to_vault: pending.refund_to_vault,
            nonce: pending.nonce,
            publish_kind: pending.publish_kind,
            part_count: pending.part_count,
            publish_id: pending.publish_id,
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

    get fun get_user_receipts(owner: Address): VaultUserReceiptsView {
        let userOpt: UserState? = self.users.get(owner);
        if (userOpt == null) {
            return VaultUserReceiptsView { exists: false, publish_nonce: 0, receipts: emptyMap() };
        }
        let user: UserState = userOpt!!;
        return VaultUserReceiptsView {
            exists: true,
            publish_nonce: user.publish_nonce,
            receipts: user.receipts
        };
    }

    // Drain-safety diagnostics: the live-config forward/compute fees the floor pins must dominate (release gate
    // G2 reads these and asserts BATCH_FLOOR_BASE_PIN / BATCH_FLOOR_PER_PART_PIN >= the runtime values, so the
    // reject_fee always covers the Vault's real worst-case import + walk cost at the current network config).
    get fun diag_forward_fee(cells: Int, bits: Int): Int {
        return getForwardFee(cells, bits, false);
    }
    get fun diag_compute_fee(gas: Int): Int {
        return getComputeFee(gas, false);
    }
    get fun diag_ext_hard_import(): Int {
        return getForwardFee(EXT_HARD_CELLS, EXT_HARD_BITS, false);
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

    // Pending batch-publish observability (spec 3.5). Key = bounce_id = publish_id mod 2^64; the client
    // computes it locally (it knows all publish_id inputs). Enables the diagnosis matrix without a backend.
    get fun get_pending_batch_publish(bounceId: Int): VaultPendingBatchPublishView {
        let pendingOpt: PendingBatchPublish? = self.pending_batch_publishes.get(bounceId);
        if (pendingOpt == null) {
            return VaultPendingBatchPublishView {
                exists: false,
                owner_wallet: myAddress(),
                nonce: 0,
                publish_kind: 0,
                part_count: 0,
                created_at: 0,
                tombstone: false
            };
        }
        let pending: PendingBatchPublish = pendingOpt!!;
        return VaultPendingBatchPublishView {
            exists: true,
            owner_wallet: pending.owner_wallet,
            nonce: pending.nonce,
            publish_kind: pending.publish_kind,
            part_count: pending.part_count,
            created_at: pending.created_at,
            tombstone: pending.tombstone
        };
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

    get fun get_successor(): VaultSuccessorView {
        let ext: Slice = self.genesis_ext.beginParse();
        ext.loadUint(256); // skip controller_hash
        if (!ext.loadBool()) {
            return VaultSuccessorView {
                announced: false,
                successor_manifest_hash: 0,
                successor_vault: myAddress(),
                announced_at: 0
            };
        }
        return VaultSuccessorView {
            announced: true,
            successor_manifest_hash: ext.loadUint(256),
            successor_vault: ext.loadAddress(),
            announced_at: ext.loadUint(32)
        };
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
