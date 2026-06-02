# Platho v1 Open Values Profile

**Document status:** initial freeze-candidate values  
**Version:** v0.1-open-values  
**Companion spec:** `platho_v1_spec_v0_3_1_smoke_clean.md`  
**Rule:** if a value is not pinned here or in the main v1 spec, it is not part of Platho v1.

**Historical note, 2026-05-22:** this older profile is superseded for CapsuleHub payload storage and publish pricing by `PLATHO_CAPSULE_V1_FINAL_SPEC.md` and `platho_v1_open_values_v0_6.md`. Final v1 removed `CAPSULEHUB_PAGE_STORAGE_ENDOWMENT`; page boundaries are metadata-only.

This profile fixes serialization, economic constants, reserve defaults, storage endowments, route placeholders, and test-vector obligations for implementation handoff.

Values marked **FINAL AFTER GAS TESTS** are conservative implementation-start values. They must be validated by unit/gas tests before code freeze. Do not silently lower them in code.

---

## 1. Units

```text
1 TON = 1_000_000_000 nanotons
all TON amounts are stored/serialized as integer nanotons
all ATH amounts are stored/serialized as integer atomic ATH units
ATH decimals = 9
1 ATH = 1_000_000_000 ATH atomic units
```

No floating point arithmetic is allowed in contracts, scripts, test vectors, or fee calculations.

---

## 2. CompactSessionRequestV1 Serialization

### 2.1 Integer Encoding

```text
uint8       = 1 byte, unsigned
uint32      = 4 bytes, unsigned, big-endian
uint64      = 8 bytes, unsigned, big-endian
uint128     = 16 bytes, unsigned, big-endian
uint256     = 32 bytes, unsigned, big-endian
coins       = uint128 nanotons, big-endian
signature   = 64 raw bytes Ed25519 signature
hash        = 32 raw bytes
```

### 2.2 Address Encoding

CompactSessionRequestV1 uses fixed raw address encoding:

```text
MsgAddressRawV1 {
  workchain_id: int32 big-endian signed
  account_id: 32 bytes
}
```

Allowed address profile:

```text
addr_std only
no anycast
no variable-length friendly address text
no bounceable/non-bounceable UI flags
no base64/base64url string serialization
```

Masterchain workchain `-1` is encoded as:

```text
0xFFFFFFFF
```

Basechain workchain `0` is encoded as:

```text
0x00000000
```

Address byte length:

```text
36 bytes
```

### 2.3 CompactSessionRequestV1 Exact Byte Layout

```text
offset  size   field
0       4      magic = ASCII "PLSR" = 0x50 0x4C 0x53 0x52
4       1      version = 0x01
5       4      op: uint32
9       36     owner_wallet: MsgAddressRawV1
45      32     session_id: uint256
77      8      session_nonce: uint64
85      4      valid_until: uint32
89      1      publish_kind: uint8
90      1      size_class: uint8
91      1      crypto_suite: uint8
92      32     body_hash: uint256
124     32     header_0_hash: uint256
156     32     header_1_hash: uint256
188     16     max_charge: coins uint128
204     64     signature: Ed25519 signature
```

Total size:

```text
268 bytes
```

The signed bytes are exactly bytes `[0..203]`, excluding signature.

### 2.4 Session Signature Hash

```text
session_sig_hash = SHA256(
  "PLATHO_VAULT_SESSION_PUBLISH_V1" ||
  genesis_config_hash ||
  vault_address_raw36 ||
  capsule_hub_address_raw36 ||
  CompactSessionRequestV1_bytes[0..203]
)
```

No alternative v1 preimage is valid.

---

## 3. Enum Values

```text
publish_kind_private = 1
publish_kind_public  = 2

SIZE_CLASS_STANDARD  = 1
SIZE_CLASS_LONG_TERM = 2

CRYPTO_SUITE_PUBLIC_NONE                     = 0
CLASSICAL_X25519_XCHACHA20_V1                = 1
HYBRID_X25519_MLKEM768_XCHACHA20_V1          = 2
```

Allowed pairs:

```text
public:
  publish_kind = 2
  size_class = 1
  crypto_suite = 0
  header_0_hash = zero
  header_1_hash = zero

private standard:
  publish_kind = 1
  size_class = 1
  crypto_suite = 1
  header_0_hash != zero
  header_1_hash != zero

private long-term:
  publish_kind = 1
  size_class = 2
  crypto_suite = 2
  header_0_hash != zero
  header_1_hash != zero
```

All other enum combinations are rejected before `accept_message`.

---

## 4. Protocol Fees

Historical superseded PLATO protocol-fee constants:

```text
This v0.5 draft used obsolete fee constants and is not the current release source of truth.
Current final v1 pricing uses 0.010 TON Platho protocol fee for public and private publishes,
and ATH can discount the full Platho protocol-fee component after unlock.
```

ATH full discount threshold:

```text
ATH_FULL_DISCOUNT_AMOUNT = 10_000 ATH = 10_000_000_000_000 atomic ATH units
```

Discount formula:

```text
discount_base = 10_000 ATH
user_ath = min(user_ath_balance, discount_base)
discounted_fee = ceil(full_fee * (discount_base - user_ath) / discount_base)
```

Examples:

```text
0 ATH       -> 100% PLATO fee
1,000 ATH   -> 90% PLATO fee
5,000 ATH   -> 50% PLATO fee
10,000 ATH  -> 0% PLATO fee
>10,000 ATH -> 0% PLATO fee
```

ATH discount applies only to PLATO protocol fee, never to network execution, forwarding, storage, state endowments, or reserves.

---

## 5. FeeAccumulator Split

```text
SPLIT_BASE_BPS = 10_000
TREASURY_SHARE_BPS = 5_000
BUYBACK_SHARE_BPS = 5_000
```

Split:

```text
treasury_amount = floor(accumulated_ton * TREASURY_SHARE_BPS / 10_000)
buyback_amount = accumulated_ton - treasury_amount
```

All rounding dust goes to `buyback_amount`.

Invariant:

```text
treasury_amount + buyback_amount == accumulated_ton
```

---

## 6. BuybackBurn Constants

```text
BUYBACK_CHUNK_TON = 50 TON = 50_000_000_000 nanotons
BUYBACK_MIN_ATH_OUT_PER_50_TON = FINAL AFTER LIQUIDITY/ROUTE TESTS
```

v1 has no on-chain oracle.

Contract enforces:

```text
buyback_amount_ton == 50 TON
dex_min_out >= BUYBACK_MIN_ATH_OUT_PER_50_TON
DEX payload uses dex_min_out as actual min_out / ask_min_amount
```

Official executor policy:

```text
dex_min_out >= floor(current_STONfi_quote_out * 0.95)
```

This is not a trustless on-chain fair-price guarantee.

---

## 7. Initial Reserve Constants

These are conservative implementation-start values. They must be validated by gas tests.

### 7.1 Vault

```text
VAULT_EXTERNAL_SESSION_LOCAL_MAX_CHARGE = 0.003 TON = 3_000_000 nanotons
INVALID_SESSION_REQUEST_CHARGE_TON = 0.002 TON = 2_000_000 nanotons
VAULT_PENDING_PUBLISH_STORAGE_ENDOWMENT = 0.003 TON = 3_000_000 nanotons
VAULT_USER_STATE_STORAGE_ENDOWMENT = 0.010 TON = 10_000_000 nanotons
VAULT_SESSION_STATE_STORAGE_ENDOWMENT = 0.005 TON = 5_000_000 nanotons
VAULT_RECEIVE_INTENT_STORAGE_ENDOWMENT = 0.005 TON = 5_000_000 nanotons
VAULT_KEY_RECORD_STANDARD_STORAGE_ENDOWMENT = 0.005 TON = 5_000_000 nanotons
VAULT_KEY_RECORD_LONG_TERM_STORAGE_ENDOWMENT = 0.030 TON = 30_000_000 nanotons
```

### 7.2 CapsuleHub

```text
CAPSULEHUB_PRIVATE_STANDARD_EXEC_RESERVE = 0.003 TON = 3_000_000 nanotons
CAPSULEHUB_PRIVATE_LONG_TERM_EXEC_RESERVE = 0.004 TON = 4_000_000 nanotons
CAPSULEHUB_PUBLIC_EXEC_RESERVE = 0.003 TON = 3_000_000 nanotons

CAPSULEHUB_PRIVATE_STANDARD_STORAGE_KEEPALIVE_RESERVE = 0.001 TON = 1_000_000 nanotons
CAPSULEHUB_PRIVATE_LONG_TERM_STORAGE_KEEPALIVE_RESERVE = 0.001 TON = 1_000_000 nanotons
CAPSULEHUB_PUBLIC_STORAGE_KEEPALIVE_RESERVE = 0.001 TON = 1_000_000 nanotons

CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT = 0.004 TON = 4_000_000 nanotons
CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT = 0.003 TON = 3_000_000 nanotons
CAPSULEHUB_PAGE_STORAGE_ENDOWMENT = 0.010 TON = 10_000_000 nanotons
CAPSULEHUB_ACK_FORWARD_RESERVE = 0.001 TON = 1_000_000 nanotons
```

### 7.3 UsernameRegistry

```text
USERNAME_PENDING_MINT_STORAGE_ENDOWMENT = 0.006 TON = 6_000_000 nanotons
USERNAME_NAME_RECORD_STORAGE_ENDOWMENT = 0.010 TON = 10_000_000 nanotons
USERNAME_ATH_REFUND_DUE_STORAGE_ENDOWMENT = 0.004 TON = 4_000_000 nanotons
USERNAME_NFT_ITEM_DEPLOY_RESERVE = FINAL AFTER NFT ITEM GAS TESTS
```

### 7.4 FeeAccumulator

```text
FEEACCUMULATOR_SPLIT_EXEC_RESERVE = 0.002 TON = 2_000_000 nanotons
FEEACCUMULATOR_FLUSH_EXEC_RESERVE = 0.003 TON = 3_000_000 nanotons
```

### 7.5 BuybackBurn

```text
BUYBACK_EXEC_RESERVE = 0.005 TON = 5_000_000 nanotons
BUYBACK_PENDING_STORAGE_ENDOWMENT = 0.005 TON = 5_000_000 nanotons
BUYBACK_BURN_FINALIZATION_RESERVE = FINAL AFTER ATH BURN TESTS
```

### 7.6 Global Contract Storage Reserve

```text
MIN_STORAGE_BALANCE = 0.05 TON = 50_000_000 nanotons
TARGET_STORAGE_BALANCE = 0.20 TON = 200_000_000 nanotons
MAX_STORAGE_BALANCE = 1.00 TON = 1_000_000_000 nanotons
```

---

## 8. CapsuleHub Page Size

```text
CAPSULEHUB_PAGE_SIZE = 256 entries
```

For sequential entry id:

```text
page_id = entry_id / 256
index_in_page = entry_id % 256
```

Superseded by the M27 interface decision: CapsuleHub v1 uses separate private and public counters/page counts, not retrievable on-chain page maps.

---

## 9. Canonical Max-Charge Formulas

```text
MAX_CHARGE_PRIVATE_STANDARD(owner) =
  VAULT_EXTERNAL_SESSION_LOCAL_MAX_CHARGE
  + discounted_fee(owner, PLATO_PRIVATE_LONG_TERM_FEE_TON)
  + CAPSULEHUB_PRIVATE_STANDARD_EXEC_RESERVE
  + CAPSULEHUB_PRIVATE_STANDARD_STORAGE_KEEPALIVE_RESERVE
  + CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT
  + CAPSULEHUB_PAGE_STORAGE_ENDOWMENT
  + CAPSULEHUB_ACK_FORWARD_RESERVE

MAX_CHARGE_PRIVATE_LONG_TERM(owner) =
  VAULT_EXTERNAL_SESSION_LOCAL_MAX_CHARGE
  + discounted_fee(owner, PLATO_PRIVATE_LONG_TERM_FEE_TON)
  + CAPSULEHUB_PRIVATE_LONG_TERM_EXEC_RESERVE
  + CAPSULEHUB_PRIVATE_LONG_TERM_STORAGE_KEEPALIVE_RESERVE
  + CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT
  + CAPSULEHUB_PAGE_STORAGE_ENDOWMENT
  + CAPSULEHUB_ACK_FORWARD_RESERVE

MAX_CHARGE_PUBLIC(owner) =
  VAULT_EXTERNAL_SESSION_LOCAL_MAX_CHARGE
  + discounted_fee(owner, PLATO_PUBLIC_POST_FEE_TON)
  + CAPSULEHUB_PUBLIC_EXEC_RESERVE
  + CAPSULEHUB_PUBLIC_STORAGE_KEEPALIVE_RESERVE
  + CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT
  + CAPSULEHUB_PAGE_STORAGE_ENDOWMENT
  + CAPSULEHUB_ACK_FORWARD_RESERVE
```

Unused page storage reserve returns through ACK excess.

---

## 10. ATH Tokenomics

```text
ATH_TOTAL_SUPPLY = 100,000,000 ATH
ATH_DECIMALS = 9
ATH_TOTAL_SUPPLY_ATOMIC = 100,000,000,000,000,000 atomic units
```

Current canonical distribution:

```text
Activity airdrop:                15%
Initial liquidity:               15%
Long-term protocol vesting:      10%
Market stability reserve:        60%
```

The long-term protocol vesting allocation is controlled by immutable ATHVesting and unlocks only 100,000 ATH per 365-day period.

ATH master is fixed-supply:

```text
no mint after deploy
burn reduces total_supply
no tax
no blacklist
no pause
no admin force transfer
```

---

## 11. STON.fi Route Values

These must be pinned from the exact selected STON.fi v2 route before code freeze:

```text
STONFI_ROUTER_ADDRESS = FINAL
STONFI_POOL_ADDRESS_TON_ATH = FINAL
STONFI_VAULT_ADDRESS = FINAL IF REQUIRED BY ROUTE
STONFI_SWAP_OPCODE = FINAL
STONFI_SWAP_PAYLOAD_LAYOUT = FINAL
STONFI_ASK_MIN_AMOUNT_FIELD = FINAL
STONFI_FORWARD_GAS_REQUIREMENTS = FINAL
```

Until this table is filled, BuybackBurn implementation is blocked.

No DeDust route is part of Platho v1.

No route switch exists in v1.

No null/disabled route exists in v1.

---

## 12. ATH Wallet Derivation Profile

Status: **profile fixed; ATH wallet code hash pinned by milestone artifact; final deployment owner-address vectors pending.**

Platho v1 uses the standard TON StateInit-based address derivation model for ATH jetton wallets.

### 12.1 ATH Master Address

```text
ATH_MASTER_ADDRESS = deployment address of Platho ATH Jetton Master
```

Milestone fixture/vector value:

```text
ATH_MASTER_ADDRESS = EQCsWTXmWyrIPPEUVe1EeSlcXRR6apqVH1Zw9LmQpWWtgQRr
```

This address appears in the milestone derivation vectors. Final deployment manifest MUST record the actual ATH Master address produced by the final pinned ATH Master StateInit used for deployment.

### 12.2 ATH Wallet Code Hash

Pinned by ATH milestone 1 compiled wallet artifact:

```text
ATH_WALLET_CODE_HASH = a4ca0258ce36f72c4bab250c5ead87bc6db1b0ebe3832bad8c6961efaaedc730
ATH_WALLET_CODE_BOC_SHA256 = 6db86ce6664eb628745fefd830de2343ac8178e39c1c55fdc089f2996a6c2be7
```

Rules:

```text
1. ATH_WALLET_CODE_HASH is produced by the compiled ATH Jetton Wallet artifact.
2. It MUST be recorded in the deployment manifest.
3. It MUST be included in genesis_config_hash.
4. It MUST be identical across:
   - ATH Master get_jetton_data / wallet_code exposure
   - off-chain deployment manifest verification
   - seal-time derivation checks in Platho contracts
5. It MUST NOT be typed manually as a guessed constant.
```

Milestone 2.1 note:

```text
The wallet code hash changed after adding bounce/failure-safe burn recovery.
The milestone 2.1 hash supersedes all earlier ATH wallet hashes.
```


### 12.3 ATH Wallet StateInit Data Layout

ATH wallet address derivation uses the pinned ATH wallet code cell and the exact initial data cell:

```text
ATHWalletDataV1 {
  balance: uint128 = 0
  owner_address: MsgAddress
  ath_master_address: MsgAddress
}
```

If the final ATH wallet implementation requires additional fields for burn finalization, those fields MUST be explicitly added here before code freeze and included in test vectors. No hidden extra fields are allowed.

### 12.4 ATH Wallet Derivation Formula

For an owner contract/address `owner_address`:

```text
ath_wallet_data = build_ath_wallet_data(
  balance = 0,
  owner_address = owner_address,
  ath_master_address = ATH_MASTER_ADDRESS
)

ath_wallet_state_init = StateInit {
  code = ATH_WALLET_CODE_CELL,
  data = ath_wallet_data
}

ath_wallet_address = addr_std(
  workchain_id = owner_address.workchain_id,
  account_id = cell_hash(ath_wallet_state_init)
)
```

The default wallet workchain is the owner address workchain.

The milestone vectors include a masterchain owner workchain check. Therefore the owner-workchain rule is covered by fixture vectors.

If implementation or TON tooling requires all ATH wallets to be in a specific workchain, that rule would contradict the current v1 profile and MUST NOT be introduced silently.

### 12.5 Required Official Wallets

Deployment/seal MUST derive and verify:

```text
Vault official ATH wallet =
  derive_ath_wallet_address(owner_address = Vault address)

BuybackBurn official ATH wallet =
  derive_ath_wallet_address(owner_address = BuybackBurn address)

UsernameRegistry official ATH wallet =
  derive_ath_wallet_address(owner_address = UsernameRegistry address)

Treasury ATH wallet, if treasury receiver uses a contract/wallet owner =
  derive_ath_wallet_address(owner_address = treasury_ath_receiver_address)
```

### 12.6 Seal-Time Verification

Each contract that accepts ATH notifications stores its expected official ATH wallet address in initial data.

At seal, the contract/deployment verifier MUST prove:

```text
stored_ath_wallet_address ==
derive_ath_wallet_address(
  owner_address = this_contract_address,
  ath_master = ATH_MASTER_ADDRESS,
  wallet_code_hash = ATH_WALLET_CODE_HASH,
  wallet_derivation_formula = ATH_WALLET_DERIVATION_FORMULA_V1
)
```

If mismatch:

```text
OP_SEAL_GENESIS MUST fail
```

### 12.7 Runtime Notification Check

At runtime, ATH notification acceptance requires:

```text
msg.sender == stored_official_ath_wallet_address
```

Payload claims about master/owner/amount are not sufficient.

### 12.8 ATH Master Getter Compatibility

ATH Master MUST expose a getter equivalent to the standard jetton:

```text
get_wallet_address(owner_address) -> ath_wallet_address
```

Required invariant:

```text
get_wallet_address(owner) == derive_ath_wallet_address(owner)
```

### 12.9 Milestone Fixture Vectors

Milestone package:

```text
milestone = ATH-derivation-and-burn-bounce-safe-v1
generated_at_utc = 2026-05-15T14:41:52.967Z
tact_compiler = 1.6.13
ton_core = 0.63.1
```

Fixture labels covered:

```text
Vault fixture owner
BuybackBurn fixture owner
UsernameRegistry fixture owner
Treasury ATH receiver fixture owner
Random user wallet fixture owner
Masterchain owner workchain check fixture
```

For all milestone fixture vectors:

```text
ATH Master get_wallet_address(owner) == local StateInit derivation using owner workchain
match == true
```

These vectors prove the derivation invariant. They are not final deployment manifest seal vectors for Vault / BuybackBurn / UsernameRegistry / Treasury until those contracts' actual StateInit-derived addresses are pinned.

### 12.10 Final Deployment Vectors Required Later

After Vault / BuybackBurn / UsernameRegistry / Treasury receiver actual addresses are produced from their final StateInit, generate final deployment manifest vectors:

```text
owner_address
ATH_WALLET_CODE_HASH
ath_wallet_data_cell_hash
ath_wallet_state_init_hash
derived_ath_wallet_address
ATH Master get_wallet_address(owner) result
match == true
```

Required final owners:

```text
Vault actual address
BuybackBurn actual address
UsernameRegistry actual address
Treasury ATH receiver actual address, if applicable
```

### 12.11 Implementation Blocker Status

```text
ATH wallet derivation formula: FIXED
ATH wallet code hash: PINNED BY MILESTONE 2.1
ATH fixture derivation invariant: PROVEN AFTER BOUNCE-SAFE BURN SUPPORT
ATH Jetton burn finalization milestone: COMPLETED FOR AUTHENTICATED WALLET BURN PATH + BOUNCE/FAILURE SAFETY
dependent contract final seal vectors: BLOCKED until actual dependent contract addresses exist
```


---

## 13. ATH Burn Finalization Profile

Status: **burn finalization path fixed and tested by ATH milestone 2.1, including bounce/failure safety.**

### 13.1 Burn Messages

ATH burn is a two-step authenticated path:

```text
owner wallet/user -> official ATHWallet.ATHBurn(query_id, amount)
official ATHWallet -> ATHMaster.ATHBurnNotification(query_id, amount, owner_address)
```

Message opcodes used by milestone 2:

```text
ATHBurn             = 0x41544801
ATHBurnNotification = 0x41544802
```

### 13.2 ATHWallet Burn Requirements

`ATHWallet` accepts `ATHBurn` only when:

```text
sender() == owner_address
amount > 0
balance >= amount
context().value >= ATH_BURN_NOTIFICATION_EXEC_RESERVE
```

Effects:

```text
balance -= amount
send bounceable ATHBurnNotification(query_id, amount, owner_address) to ATHMaster
```

If ATHBurnNotification bounces or fails before total_supply reduction:

```text
ATHWallet bounced<ATHBurnNotification> restores balance += amount
```

The ATHBurnNotification field order is intentionally:

```text
query_id: uint64
amount: uint128
owner_address: Address
```

`query_id + amount` fit inside the bounced-message prefix, allowing the wallet to recover the debited amount on bounce.

### 13.3 ATHMaster Burn Finalization Requirements

`ATHMaster` accepts `ATHBurnNotification` only when:

```text
amount > 0
sender() == derive_ath_wallet_address(owner_address)
total_supply >= amount
context().value >= ATH_BURN_NOTIFICATION_EXEC_RESERVE
```

Effects:

```text
total_supply -= amount
```

### 13.4 Forbidden Burn Semantics

The following are not burn in Platho v1:

```text
transfer to dead address
transfer to zero address
transfer to inaccessible wallet
arbitrary user notification to ATHMaster
arbitrary wallet notification to ATHMaster
accounting-only burn without total_supply decrease
```

### 13.5 Milestone 2 Test Coverage

```text
ATH-00: burn operation reduces total_supply by exact burned amount
ATH-00A: burn finalization/ack path is deterministic and testable by protocol tests
ATH-00B: transfer-to-dead-address or zero-address is not treated as burn
ATH-00C: ATH master accepts burn only from deterministic official ATH wallet for burner owner
ATH-00D: protocol contracts/users cannot burn ATH from arbitrary third-party wallets
ATH-00E: underfunded ATHBurn does not debit wallet without total_supply decrease
ATH-00F: burn notification bounce/failure restores wallet balance when master is unavailable
ATH-BND-03: ATHMaster rejects burn notification without caller-funded execution reserve
```

Milestone 2 result:

```text
ATH_WALLET_CODE_HASH = a4ca0258ce36f72c4bab250c5ead87bc6db1b0ebe3832bad8c6961efaaedc730
ATHMASTER_CODE_HASH = 33e4c62fa48e4f6d8b3b93a00e025485c18a6b81efcd055768508c215b88cfbf
ATH boundary suite: 1 file passed, 3 tests passed
```

### 13.5A ATH Execution Reserve Profile

Pinned reserve values:

```text
ATH_INTERNAL_TRANSFER_EXEC_RESERVE = 0.002 TON = 2_000_000 nanotons
ATH_BURN_NOTIFICATION_EXEC_RESERVE = 0.002 TON = 2_000_000 nanotons
ATH_TRANSFER_NOTIFY_EXEC_RESERVE = 0.002 TON = 2_000_000 nanotons
ATH_TRANSFER_NOTIFY_ACK_VALUE = 0.001 TON = 1_000_000 nanotons
ATH_TRANSFER_NOTIFY_MIN_VALUE = 0.030 TON = 30_000_000 nanotons
```

Internal transfer and transfer-with-notify credits require caller-funded execution reserve before recipient balance is credited. Min-1 must reject before mutation; exact-min must accept when all authentication and accounting checks pass.

### 13.6 Remaining Burn Caveat

The current milestone proves the authenticated wallet burn path and wallet-side bounce/failure recovery for burn notification failure. Protocol due-bucket integrations in `BuybackBurn` and `UsernameRegistry` still need their own pending-burn / rollback-safe integration tests when those contracts are implemented.

---

## 14. Crypto Test Vector Obligations

Before implementation freeze, generate and store test vectors for:

```text
CompactSessionRequestV1 byte serialization
CompactSessionRequestV1 session_sig_hash
Ed25519 session signature verify
HeaderV1 exact 64-byte serialization
header_i_hash
canonical 2KB body tree hash
canonical 4KB body tree hash
public body tree hash
X25519 shared secret
XChaCha20-Poly1305 encrypt/decrypt
payload sender-auth Ed25519 signing
key_generation 0 / 1 deterministic derivation
ML-KEM-768 deterministic key generation
hybrid shared secret derivation
detection_tag candidates
```

No implementation is accepted without vectors.

---

## 15. Open Blockers Before Code Freeze

```text
1. STON.fi v2 exact route and payload values
2. final deployment ATH wallet derivation vectors for actual Vault / BuybackBurn / UsernameRegistry / Treasury addresses
4. Gas-test validation of all reserve constants
5. CompactSessionRequest MsgAddress/coins vector set
6. HeaderV1 / body tree vector set
7. ML-KEM deterministic implementation choice
7. Username NFT item deploy gas/reserve validation
```

If any blocker is unresolved, the corresponding contract/function is not implementation-ready.
