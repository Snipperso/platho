# Platho v1 Open Values Profile

**Document status:** freeze-candidate values; ATH wallet and Vault M6 external publish aligned  
**Version:** v0.6-open-values  
**Companion spec:** `platho_v1_spec_v0_3_1_smoke_clean.md`  
**Rule:** if a value is not pinned here or in the main v1 spec, it is not part of Platho v1.

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

## 2. CompactSessionRequestV1 TON Cell Profile

Vault external session publish uses a TON cell profile, not a raw 268-byte external payload.

### 2.1 Root Cell Fields

The external root slice stores:

```text
magic:          uint32 = ASCII "PLSR" = 0x504C5352
version:        uint8  = 1
op:             uint32
owner_wallet:   MsgAddress
session_id:     uint256
session_nonce:  uint64
valid_until:    uint32
publish_kind:   uint8
size_class:     uint8
crypto_suite:   uint8
max_charge:     uint128
hashes_ref:     ^Cell
signature_ref:  ^Cell
```

After parsing these fields, the root slice MUST have:

```text
remaining bits = 0
remaining refs = 0
```

### 2.2 `hashes_ref` Cell

```text
body_hash:      uint256
header_0_hash:  uint256
header_1_hash:  uint256
```

The `hashes_ref` cell MUST have:

```text
bits = 768
refs = 0
```

### 2.3 `signature_ref` Cell

```text
signature: 512 raw bits Ed25519 signature
```

The `signature_ref` cell MUST provide exactly the 512-bit signature used by TVM `checkSignature`.

### 2.4 Session Signature Hash

```text
fields_cell = begin_cell()
  .store_uint("PLSR", 32)
  .store_uint(1, 8)
  .store_uint(op, 32)
  .store_address(owner_wallet)
  .store_uint(session_id, 256)
  .store_uint(session_nonce, 64)
  .store_uint(valid_until, 32)
  .store_uint(publish_kind, 8)
  .store_uint(size_class, 8)
  .store_uint(crypto_suite, 8)
  .store_uint(max_charge, 128)
  .store_ref(hashes_ref)
  .end_cell()

session_sig_hash = HASH(
  "PLATHO_VAULT_SESSION_PUBLISH_V1" ||
  genesis_config_hash ||
  vault_address ||
  capsule_hub_address ||
  fields_cell
)
```

No alternative v1 signature preimage is valid for the TON cell profile.

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

Base PLATO protocol fees:

```text
PLATO_PRIVATE_STANDARD_FEE_TON = 0.005 TON = 5_000_000 nanotons
PLATO_PRIVATE_LONG_TERM_FEE_TON = 0.010 TON = 10_000_000 nanotons
PLATO_PUBLIC_POST_FEE_TON = 0.005 TON = 5_000_000 nanotons
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
CAPSULEHUB_ACK_FORWARD_RESERVE = 0.030 TON = 30_000_000 nanotons
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
FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE = 0.002 TON = 2_000_000 nanotons
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

Separate private and public page maps are used.

---

## 9. Canonical Max-Charge Formulas

```text
MAX_CHARGE_PRIVATE_STANDARD(owner) =
  VAULT_EXTERNAL_SESSION_LOCAL_MAX_CHARGE
  + discounted_fee(owner, PLATO_PRIVATE_STANDARD_FEE_TON)
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

Unused page storage reserve returns through ACK excess. CapsuleHub MUST retain the
protocol-fee backing, execution/storage reserves, and keepalive value for accepted
Vault publishes; the ACK carries only `CAPSULEHUB_ACK_FORWARD_RESERVE` plus true
excess value.

---

## 10. ATH Tokenomics

```text
ATH_TOTAL_SUPPLY = 100,000,000 ATH
ATH_DECIMALS = 9
ATH_TOTAL_SUPPLY_ATOMIC = 100,000,000,000,000,000 atomic units
```

Initial distribution freeze candidate:

```text
Liquidity bootstrap:             15%
Founder vesting:                 10%
Community airdrop:                5%
Early user / free-float reserve: 10%
Ecosystem growth reserve:        35%
Protocol treasury reserve:       15%
Strategic / market operations:   10%
```

Only liquidity bootstrap + explicitly released early/community allocations are intended to be liquid near launch. Other allocations must be locked, vested, or controlled by transparent release rules outside v1 core contracts.

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

Status: **profile fixed; concrete code hash produced by ATH wallet build artifact.**

Platho v1 uses the standard TON StateInit-based address derivation model for ATH jetton wallets.

### 12.1 ATH Master Address

```text
ATH_MASTER_ADDRESS = deployment address of Platho ATH Jetton Master
```

This value is not hand-picked inside dependent contracts. It is produced by deploying the ATH Jetton Master from pinned code/data and recorded in the deployment manifest before sealing dependent contracts.

### 12.2 ATH Wallet Code Hash

```text
ATH_WALLET_CODE_HASH = cell_hash(compiled ATH Jetton Wallet code cell)
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

Until the ATH Wallet contract compiles, dependent contracts that require seal-time wallet derivation remain blocked.

This does **not** block implementing ATH Jetton itself. It blocks sealing Vault / BuybackBurn / UsernameRegistry with final ATH wallet addresses.

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

If implementation or TON tooling requires all ATH wallets to be in a specific workchain, that rule MUST be pinned before code freeze and reflected in test vectors. Until then, use owner workchain.

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

### 12.8 ATH Execution Reserve Profile

ATH wallet/master messages that debit, credit, or finalize token accounting must be caller-funded for execution. Token balances and total_supply must not be used as an implicit TON reserve for someone else's message execution.

Pinned reserve values:

```text
ATH_INTERNAL_TRANSFER_EXEC_RESERVE = 0.002 TON = 2_000_000 nanotons
ATH_BURN_NOTIFICATION_EXEC_RESERVE = 0.002 TON = 2_000_000 nanotons
ATH_TRANSFER_NOTIFY_EXEC_RESERVE = 0.002 TON = 2_000_000 nanotons
ATH_TRANSFER_NOTIFY_ACK_VALUE = 0.001 TON = 1_000_000 nanotons
ATH_TRANSFER_NOTIFY_MIN_VALUE = 0.030 TON = 30_000_000 nanotons
```

Required boundaries:

```text
ATHWallet.ATHBurn requires context().value >= ATH_BURN_NOTIFICATION_EXEC_RESERVE
ATHWallet.ATHTransferRequest requires context().value >= ATH_INTERNAL_TRANSFER_EXEC_RESERVE
ATHWallet.ATHTransferRequestWithNotify requires context().value >= notify_value + ATH_TRANSFER_NOTIFY_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE
ATHWallet.ATHInternalTransfer requires context().value >= ATH_INTERNAL_TRANSFER_EXEC_RESERVE
ATHWallet.ATHInternalTransferWithNotify requires context().value >= notify_value + ATH_TRANSFER_NOTIFY_ACK_VALUE + ATH_TRANSFER_NOTIFY_EXEC_RESERVE
ATHMaster.ATHBurnNotification requires context().value >= ATH_BURN_NOTIFICATION_EXEC_RESERVE
```

Min-1 must reject before balance/total_supply mutation. Exact-min must be accepted when all other authorization and accounting checks pass.

### 12.9 ATH Master Getter Compatibility

ATH Master MUST expose a getter equivalent to the standard jetton:

```text
get_wallet_address(owner_address) -> ath_wallet_address
```

Required invariant:

```text
get_wallet_address(owner) == derive_ath_wallet_address(owner)
```

### 12.10 Test Vectors Required Before Code Freeze

For each owner:

```text
Vault address
BuybackBurn address
UsernameRegistry address
Treasury ATH receiver address if applicable
random user wallet address
```

generate vectors:

```text
owner_address
ATH_WALLET_CODE_HASH
ath_wallet_data_cell_hash
ath_wallet_state_init_hash
derived_ath_wallet_address
ATH Master get_wallet_address(owner) result
```

All must match.

### 12.11 Implementation Blocker Status

```text
ATH wallet derivation formula: FIXED BY THIS PROFILE
ATH wallet code hash: produced by compiled ATH Wallet artifact
dependent contract seal with ATH wallets: BLOCKED until ATH Wallet code hash exists
ATH Jetton implementation itself: NOT BLOCKED
```


---

## 13. ATH Burn Finalization Profile

Must be pinned before ATH implementation freeze:

```text
ATH_BURN_OPCODE = FINAL
ATH_BURN_NOTIFICATION_OPCODE = FINAL IF USED
ATH_BURN_FINALIZATION_MESSAGE = FINAL
ATH_TOTAL_SUPPLY_DECREASE_PROOF = FINAL
```

Protocol burn due buckets cannot be permanently cleared without verified total_supply decrease.

Transfer-to-dead-address is not burn.

---

## 14. Vault External Publish / PendingPublish Profile

This section pins the Vault M6 publish details that are not already covered by the CompactSessionRequestV1 TON cell profile in Section 2.

### 14.1 Vault Publish ID

```text
publish_id = HASH(
  genesis_config_hash ||
  owner_wallet ||
  session_nonce ||
  body_hash ||
  publish_kind
)
```

`publish_id` MUST be nonzero.

### 14.2 Vault -> CapsuleHub Publish Message Layout

Vault -> CapsuleHub publish messages include a first-field bounce routing key.

#### 14.2.1 Private Publish From Vault

```text
CapsuleHub.PublishPrivateFromVault = 0xA4F862C0

PublishPrivateFromVault {
  publish_bounce_id: uint64
  publish_id:        uint256
  size_class:        uint8
  crypto_suite:      uint8
  header_0_hash:     uint256
  header_1_hash:     uint256
  body_hash:         uint256
  protocol_fee_paid: coins uint128
}
```

#### 14.2.2 Public Publish From Vault

```text
CapsuleHub.PublishPublicFromVault = 0x8C2A76B7

PublishPublicFromVault {
  publish_bounce_id: uint64
  publish_id:        uint256
  author_wallet:     MsgAddress
  body_hash:         uint256
  protocol_fee_paid: coins uint128
}
```

### 14.3 Bounce Routing Key

```text
publish_bounce_id = publish_id mod 2^64
```

Rules:

```text
1. publish_bounce_id is only a bounce-routing key.
2. publish_bounce_id is not an authentication proof.
3. CapsuleHub ACK uses full publish_id.
4. Vault verifies ACK by recomputing full publish_id from PendingPublish fields.
5. If pending_publishes[publish_bounce_id] already exists before send, Vault MUST NOT send to CapsuleHub.
6. Collision before send is treated as a controlled post-accept invalid signed request: nonce consumed, bounded invalid-request charge, no PLATO fee, no CapsuleHub publish.
```

### 14.4 PendingPublishV1 Storage

Logical pending publish fields remain:

```text
PendingPublishV1 {
  owner_wallet: address
  session_id: uint256
  budget_epoch: uint64
  nonce: uint64
  publish_kind: uint8
  body_hash: uint256
  protocol_fee_paid: coins
  capsulehub_call_value: coins
  refundable_budget_amount: coins
  created_at: uint32
}
```

Implementation MAY key the map by `publish_bounce_id` to support deterministic typed-bounce recovery.

### 14.5 Vault -> CapsuleHub Send Mode

Vault -> CapsuleHub publish sends MUST be:

```text
bounce = true
mode = SendPayGasSeparately
value = capsulehub_call_value
```

`SendPayGasSeparately` is allowed here because it is not ignored-error mode and does not suppress bounce failure. It is required so the exact canonical CapsuleHub call value reaches CapsuleHub validation.

Ignored-error mode remains forbidden for outbound money sends.

### 14.6 ACK and Bounce Routing

ACK acceptance:

```text
sender == capsule_hub_address
pending exists for publish_bounce_id = publish_id mod 2^64
recompute publish_id from pending fields
recomputed publish_id == ack.publish_id
```

Bounce acceptance:

```text
sender == capsule_hub_address
pending exists for publish_bounce_id
```

ACK and bounce route returned value by budget epoch:

```text
if session active and current budget_epoch == pending.budget_epoch:
  returned/excess value -> message_budget_ton
else:
  returned/excess value -> ton_balance
```

Returned value is capped to `pending.refundable_budget_amount`.

CapsuleHub ACK value is not allowed to drain protocol-fee backing from
`CapsuleHub.accrued_plato_fee_ton`; accepted Vault publishes return only the fixed
ACK reserve and true excess over the required CapsuleHub backing.

### 14.7 PrunePendingPublish Remains Blocked

The main spec says stale pending publish may be pruned without refund, but this profile does not pin a TTL.

Until TTL is pinned:

```text
Vault.PrunePendingPublish is not implementation-ready.
```

### 14.8 Non-Changes

This profile does not add:

```text
admin override
owner override
pause
rescue
governance
fallback behavior
compatibility path
migration hook
MessageSession/session-spender contract
silent fallback behavior
ignored-error send mode
```

---

## 15. Crypto Test Vector Obligations

Before implementation freeze, generate and store test vectors for:

```text
CompactSessionRequestV1 TON cell profile serialization
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

## 16. Open Blockers Before Code Freeze

```text
1. STON.fi v2 exact route and payload values
2. ATH wallet code hash from compiled ATH Wallet artifact
3. ATH burn finalization exact path
4. Gas-test validation of all reserve constants
5. CompactSessionRequest TON cell profile vector set
6. HeaderV1 / body tree vector set
7. ML-KEM deterministic implementation choice
8. Username NFT item deploy gas/reserve validation
9. Vault PrunePendingPublish stale TTL, if prune is kept in v1
```

If any blocker is unresolved, the corresponding contract/function is not implementation-ready.
