# Platho v1 Protocol Specification

**Document status:** clean rebuild for implementation handoff; Vault M6 external publish and M7 deployment ATH binding aligned  
**Version:** v0.3.3-deployment-ath-binding  
**Scope:** immutable TON-based Platho v1 contracts and official client rules  
**Design stance:** closed-world v1. No hidden extension hooks. No upgrade/admin/fallback paths. Future systems are separate protocol deployments, not v1 features.

---

## 0. Core Philosophy

Platho v1 is an immutable protocol for encrypted wallet-to-wallet messaging, public posts, message-budget no-popup publishing, protocol fees, ATH utility token accounting, username NFTs, buyback/burn, and receive-intent transfers.

After deployment and seal, v1 contracts do not evolve.

Any behavior not explicitly specified before v1 code freeze is **not part of v1** and must be rejected. Unknown opcodes, unsupported enum values, unsupported crypto suites, unsupported layouts, unsupported payload types, unsupported routing paths, and unsupported recovery modes are rejected by v1.

No v1 contract has:

```text
admin
owner override
pause
upgrade
governance
blacklist
whitelist
rescue
setFee
setRouter
setTreasury
setVault
setCapsuleHub
fallback behavior
```

`OP_SEAL_GENESIS` is the final pre-seal operation. It does not set addresses or constants. Deployment-only binding operations explicitly listed in the deployment profile may run before seal to resolve circular deployment addresses, including Vault/CapsuleHub binding and Vault official ATH wallet binding. All such bindings are rejected forever after seal.

---

## 1. Contract List

Platho v1 consists of:

```text
1. CapsuleHub
2. Vault
3. FeeAccumulator
4. BuybackBurn
5. UsernameRegistry
6. UsernameNFTItem
7. ATH Jetton
8. Treasury Receiver
9. Official Client / PWA rules
```

No additional contract may hold no-popup Message Budget. Vault is the only v1 no-popup publishing authority.

---

## 2. Genesis / Seal

### 2.1 GenesisConfigV1

All core contracts must store immutable initial values before seal:

```text
contract_version
capsule_hub_address
vault_address
fee_accumulator_address
buyback_burn_address
username_registry_address
ath_master_address
treasury_receiver_address
treasury_ath_receiver_address

all official ATH wallet addresses
all code hashes / derivation profiles
all fee constants
all storage endowment constants
all reserve constants
all TTL constants
all route constants
STON.fi route values
ATH full discount amount
```

### 2.2 Seal Rule

Before seal, all user operations are rejected.

Allowed pre-seal deployment-only operations are exactly the pinned deployment binding operations and:

```text
OP_SEAL_GENESIS
```

No user operation may be accepted before seal.

`OP_SEAL_GENESIS`:

```text
- reads already-stored initial values and required pre-seal deployment bindings
- verifies completeness and consistency
- computes genesis_config_hash
- verifies that all required pre-seal deployment bindings have happened
- sets sealed = true
```

It must not:

```text
set addresses
replace constants
patch values
normalize missing fields
infer values
import values from message body
```

If any required immutable value is missing, zero where nonzero is required, inconsistent with paired contracts, not proven by the deployment verifier for ATH wallet derivation, or mismatched against deployment manifest, seal fails and the contract remains unusable.

### 2.3 Deployment Tests

```text
DEPLOY-01: all core contracts reject user operations before seal
DEPLOY-02: OP_SEAL_GENESIS succeeds only with complete immutable StateInit data plus required pinned pre-seal deployment bindings
DEPLOY-03: OP_SEAL_GENESIS does not accept or apply message-supplied addresses/constants
DEPLOY-04: seal fails if required immutable address/constant/code hash is zero or incomplete
DEPLOY-04A: seal fails if configured ATH wallet address is inconsistent with ATH master/owner/wallet derivation
DEPLOY-05: sealed core contracts expose the same genesis_config_hash
DEPLOY-06: mismatched genesis_config_hash across core contracts is rejected by official client
DEPLOY-07: OP_SEAL_GENESIS is rejected forever after first successful seal
DEPLOY-08: no post-seal operation mutates addresses/constants/fees/routes/code hashes/storage values
DEPLOY-09: deployment manifest values match StateInit/initial data before seal
DEPLOY-10: treasury receiver addresses satisfy terminal receiver assumptions and expose no governance/admin/control surface
```

---

## 3. Opcode Rule

Every opcode is:

```text
opcode = first_32_bits(SHA256("PLATHO.V1.<Contract>.<Operation>"))
byte order = big-endian
opcode width = uint32
```

Unknown opcodes are rejected.

No opcode is reserved for future activation inside v1.

### 3.1 Fixed Opcode Table

```text
Global.SealGenesis                         = 0x3A12D1AD
Global.TopUpStorageReserve                 = 0x7A8AFEAD

Vault.BindDeploymentManifest               = 0x90E2E0CB
Vault.BindOfficialAthWallet                = 0x18DB2CCB
CapsuleHub.BindDeploymentManifest          = 0x90E2E0CB

CapsuleHub.PublishPrivateDirect            = 0x7A0EBFEF
CapsuleHub.PublishPublicDirect             = 0xDD65EEF9
CapsuleHub.PublishPrivateFromVault         = 0xA4F862C0
CapsuleHub.PublishPublicFromVault          = 0x8C2A76B7
CapsuleHub.FlushFees                       = 0x7A861031
CapsuleHub.TopUpStorageReserve             = 0x5331B880

Vault.DepositTon                           = 0x2AAFBD98
Vault.WithdrawTon                          = 0x484C1D72
Vault.AthTransferNotification              = 0x472D9D7D
Vault.WithdrawAth                          = 0xF9A44834
Vault.RegisterMessagingKeys                = 0x52705EDA
Vault.ReplaceMessagingKeys                 = 0x89D648BB
Vault.TopUpMessageBudget                   = 0x86A15F92
Vault.SetSession                           = 0xFF3FBCC0
Vault.RevokeSession                        = 0xDB1CCDBE
Vault.PublishPrivateBySessionExternal      = 0x686694C6
Vault.PublishPublicBySessionExternal       = 0x900EC906
Vault.CapsuleHubPublishAck                 = 0x874E576A
Vault.PrunePendingPublish                  = 0x720BDD6D
Vault.CreateReceiveIntent                  = 0xF780F913
Vault.ClaimReceiveIntent                   = 0x99ECCCFC
Vault.CancelReceiveIntent                  = 0x32289374
Vault.TopUpStorageReserve                  = 0x3215B5FD

FeeAccumulator.DepositProtocolFee          = 0xFF775609
FeeAccumulator.SplitAccumulated            = 0x7B24EA03
FeeAccumulator.FlushTreasuryDue            = 0xDDAB4641
FeeAccumulator.FlushBuybackDue             = 0xB3D2C52D
FeeAccumulator.TopUpStorageReserve         = 0x87A2D2C7

BuybackBurn.AcceptBurnReserve              = 0x594BA505
BuybackBurn.ExecuteBuyback                 = 0x515DAD14
BuybackBurn.AthTransferNotification        = 0x72D32133
BuybackBurn.BuybackBounceRecovery          = 0x9A410326
BuybackBurn.PruneStuckBuyback              = 0x0C689070
BuybackBurn.TopUpStorageReserve            = 0x906182D2

UsernameRegistry.AthTransferNotificationMintUsername = 0x89129D5F
UsernameRegistry.UsernameItemDeployedAck             = 0xBBA3EC19
UsernameRegistry.FlushTreasuryAthDue                 = 0x60A9BDDB
UsernameRegistry.FlushBurnAthDue                     = 0xE9A2C2CB
UsernameRegistry.FlushAthRefundDue                   = 0x6B928B47
UsernameRegistry.PrunePendingUsernameMint            = 0x3796DF2D
UsernameRegistry.TopUpStorageReserve                 = 0x0ABA5F1D

UsernameNFTItem.ResendDeployedAck                    = 0x639CFC6C
UsernameNFTItem.TopUpStorageReserve                  = 0x27ACDF8B
```

---

## 4. Shared Economic / Send Invariants

### 4.1 Storage Reserve

Every contract must keep its own storage reserve before forwarding surplus.

```text
MIN_STORAGE_BALANCE
TARGET_STORAGE_BALANCE
MAX_STORAGE_BALANCE
```

`OP_TOP_UP_STORAGE_RESERVE` accepts TON for storage reserve, grants no authority, creates no withdrawable balance, and cannot be withdrawn by admin/treasury.

### 4.2 State Storage Endowment

Any new persistent or transient state record must be paid for by the operation that creates it.

Examples:

```text
Vault UserState
Vault SessionState
Vault KeyRecord
Vault ReceiveIntent
Vault PendingPublish
CapsuleHub entry
CapsuleHub page
Username pending mint
Username finalized name record
Username ATH refund-due entry
Buyback pending buyback / pending burn metadata
```

State storage endowment is not PLATO fee and is not discounted by ATH.

### 4.3 Storage Endowment Retention

Default v1 rule:

```text
state storage endowment is non-refundable
record deletion frees state but does not create a user/protocol refund
freed reserve remains in the owning contract storage balance/reserve
```

Examples:

```text
ReceiveIntent claim/cancel returns locked TON/ATH, not VAULT_RECEIVE_INTENT_STORAGE_ENDOWMENT
ath_refunds_due flush returns ATH due amount, not USERNAME_ATH_REFUND_DUE_STORAGE_ENDOWMENT
Vault ACK/bounce may return unused reserve, not consumed record endowment
```

### 4.4 Outbound Money Send Rule

For every outbound transfer of user or protocol value, the source accounting bucket remains recoverable until one is true:

```text
A. send succeeds as final non-bounceable user-directed transfer under explicit final-transfer profile
B. send failure rolls back the whole transaction and accounting mutation
C. send is bounceable and bounce restores exact bucket or moves value into explicit refund_due bucket
D. value is burned through burn operation that reduces total_supply
```

No outbound money send may use ignored-error mode while debiting an accounting bucket.

### 4.5 Due Bucket Flush Rule

Any bucket named or used as `*_due`, `*_refund_due`, `accrued_*`, or equivalent pending protocol value is a due bucket.

Examples:

```text
CapsuleHub.accrued_plato_fee_ton
FeeAccumulator.treasury_due_ton
FeeAccumulator.buyback_due_ton
UsernameRegistry.treasury_due_ath
UsernameRegistry.burn_due_ath
UsernameRegistry.ath_refunds_due[wallet]
BuybackBurn.pending_buyback / burn reserve
```

Allowed due bucket flush patterns:

```text
A. rollback-safe final send
B. pending-send pattern with bounce restoration
C. final non-bounceable user-directed transfer profile where explicitly allowed
D. burn-finalization profile proving total_supply reduction
```

If none can be implemented, the flush operation is not part of v1.

---

## 5. CapsuleHub

### 5.1 Purpose

CapsuleHub stores private encrypted message entries and public post entries.

It does not parse private payload semantics, recipient identity, private conversation state, wallet balances, ATH discount ownership, or receive-intent secrets.

### 5.2 State

```text
sealed: bool
genesis_config_hash: uint256
vault_address: address
fee_accumulator_address: address

private_latest_id: uint64
public_latest_id: uint64

private_pages: dict<uint64, Page>
public_pages: dict<uint64, Page>

accrued_plato_fee_ton: coins
```

### 5.3 Entry Identity

CapsuleHub uses two separate identifiers:

```text
entry_id:  uint64 sequential scan/index id
entry_uid: uint256 content/source identity hash
```

`entry_id` is used for pages, scanning, latest ids, and client pagination.

`entry_uid` is stored identity metadata.

Callers must not supply either.

CapsuleHub assigns `entry_id` only after validation and required value/storage checks pass.

Entry persistence and counter increment are atomic:

```text
store entry at entry_id
then increment latest_id
```

If storage fails or transaction rolls back, latest id is not incremented.

CapsuleHub must not intentionally create entry_id gaps.

Canonical entry_uid formulas:

```text
entry_uid_direct_private = HASH(
  "PLATHO_CAPSULE_ENTRY_UID_V1" || genesis_config_hash || "direct_private" || msg.sender || entry_id || current transaction logical time || header_0_hash || header_1_hash || body_hash
)

entry_uid_direct_public = HASH(
  "PLATHO_CAPSULE_ENTRY_UID_V1" || genesis_config_hash || "direct_public" || msg.sender || entry_id || current transaction logical time || body_hash
)

entry_uid_vault_private = HASH(
  "PLATHO_CAPSULE_ENTRY_UID_V1" || genesis_config_hash || "vault_private" || vault_address || publish_id || entry_id || header_0_hash || header_1_hash || body_hash
)

entry_uid_vault_public = HASH(
  "PLATHO_CAPSULE_ENTRY_UID_V1" || genesis_config_hash || "vault_public" || vault_address || publish_id || entry_id || author_wallet || body_hash
)
```

### 5.3.1 Vault Publish Message Layout

Vault -> CapsuleHub publish messages include a first-field bounce routing key.

Private publish from Vault:

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
  protocol_fee_paid: coins
}
```

Public publish from Vault:

```text
CapsuleHub.PublishPublicFromVault = 0x8C2A76B7

PublishPublicFromVault {
  publish_bounce_id: uint64
  publish_id:        uint256
  author_wallet:     MsgAddress
  body_hash:         uint256
  protocol_fee_paid: coins
}
```

Bounce routing key:

```text
publish_bounce_id = publish_id mod 2^64
```

Rules:

```text
publish_bounce_id is only a bounce routing key
publish_bounce_id is not an authentication proof
ACK authenticity uses full publish_id
Vault recomputes full publish_id from PendingPublish fields
if pending_publishes[publish_bounce_id] already exists before send, Vault MUST NOT send to CapsuleHub
collision before send is a controlled post-accept invalid signed request: nonce consumed, bounded invalid-request charge, no PLATO fee, no CapsuleHub publish
```

Vault -> CapsuleHub publish sends must be:

```text
bounce = true
mode = SendPayGasSeparately
value = capsulehub_call_value
```

`SendPayGasSeparately` is allowed here because it is not ignored-error mode and does not suppress bounce failure. It is required so the exact canonical CapsuleHub call value reaches CapsuleHub validation.

Ignored-error mode remains forbidden for outbound money sends.

### 5.4 Page / Entry Storage

Every new entry charges:

```text
capsulehub_entry_storage_endowment(kind, size_class)
```

If the entry creates a new page:

```text
CAPSULEHUB_PAGE_STORAGE_ENDOWMENT
```

Page condition:

```text
page_id = entry_id / CAPSULEHUB_PAGE_SIZE
if page[page_id] does not exist before publish:
  charge CAPSULEHUB_PAGE_STORAGE_ENDOWMENT
```

Direct publishes must attach enough TON for possible page creation if the client cannot prove page existence.

Vault session publish max charge includes possible page endowment. Unused reserve returns through ACK excess.

### 5.5 Direct Public Publish

Direct public publish must require:

```text
msg.sender == author_wallet
```

The author cannot be supplied only in payload/arguments.

### 5.6 Private Validation

Direct private and Vault private publish both require:

```text
headers are valid HeaderV1
both headers have same size_class and crypto_suite
(size_class, crypto_suite) is an allowed v1 private pair
body canonical layout matches size_class
```

### 5.7 Fee Accrual

Every accepted publish adds:

```text
accrued_plato_fee_ton += protocol_fee_paid
```

CapsuleHub does not send to FeeAccumulator on every publish.

### 5.8 Fee Flush

Only amount-based bounce-safe flush exists:

```text
OP_FLUSH_FEES(amount)
```

Requirements:

```text
amount > 0
amount <= accrued_plato_fee_ton
fee_accumulator_address immutable and nonzero
```

Effects:

```text
accrued_plato_fee_ton -= amount
send bounceable FeeAccumulator.OP_DEPOSIT_PROTOCOL_FEE(amount) with amount TON attached
```

On bounce:

```text
accrued_plato_fee_ton += bounced_amount
```

The “flush all and set accrued to zero before send” pattern is not part of Platho v1.

---

## 6. Vault

### 6.1 Purpose

Vault stores user accounting and no-popup session state.

Vault supports:

```text
TON internal balances
ATH internal balances
Message Budget
messaging key records
Vault external session publish
ReceiveIntent
ATH discount calculation
```

Vault does not parse private payload semantics or know private recipient.

### 6.2 UserStateV1

```text
UserStateV1 {
  ton_balance: coins
  ath_balance: jetton_amount
  message_budget_ton: coins
  budget_epoch: uint64
  current_key_id: uint256 | zero
}
```

Any first creation of `users[wallet]` charges:

```text
VAULT_USER_STATE_STORAGE_ENDOWMENT
```

Examples:

```text
TON deposit
ATH deposit notification
key registration
session setup
first ReceiveIntent claim by recipient
```

### 6.3 SessionStateV1

```text
SessionStateV1 {
  session_pubkey: 32 bytes // Ed25519 public key
  session_id: uint256
  nonce: uint64
  expires_at: uint32
  active: bool
}
```

`session_id`:

```text
HASH("PLATHO_VAULT_SESSION_ID_V1" || owner_wallet || session_pubkey || created_lt)
```

Session key:

```text
random per-session Ed25519 keypair
not derived from root_secret
hot key for no-popup Message Budget publishing only
```

### 6.4 OP_SET_SESSION

May be called when previous session is active, expired, or absent.

Creates fresh:

```text
session_pubkey
session_id
nonce = 0
expires_at
active = true
```

If no previous session state exists, charge:

```text
VAULT_SESSION_STATE_STORAGE_ENDOWMENT
```

`OP_SET_SESSION` does not move `message_budget_ton` to `ton_balance`.

### 6.5 OP_REVOKE_SESSION

Allowed even if session expired.

Effects:

```text
sessions[msg.sender].active = false
users[msg.sender].ton_balance += users[msg.sender].message_budget_ton
users[msg.sender].message_budget_ton = 0
users[msg.sender].budget_epoch += 1
```

Existing pending publishes remain recoverable.

### 6.6 Message Budget Top-Up

Requires usable session:

```text
sessions[msg.sender].active == true
now <= sessions[msg.sender].expires_at
```

Effects:

```text
ton_balance -= amount
message_budget_ton += amount
```

Direct attached TON Message Budget top-up is rejected.

### 6.7 CompactSessionRequestV1

Vault external session publish uses the TON cell profile pinned by the Vault M6 profile, not the earlier raw byte-array profile.

Root cell fields:

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

After parsing root fields:

```text
remaining bits = 0
remaining refs = 0
```

`hashes_ref` layout:

```text
body_hash:      uint256
header_0_hash:  uint256
header_1_hash:  uint256
```

`hashes_ref` must have exactly:

```text
bits = 768
refs = 0
```

`signature_ref` layout:

```text
signature: 512 raw bits Ed25519 signature
```

The request preimage cell used for signing excludes `signature_ref` and includes the exact `hashes_ref` cell:

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
```

Signature hash:

```text
session_sig_hash = HASH(
  "PLATHO_VAULT_SESSION_PUBLISH_V1" ||
  genesis_config_hash ||
  vault_address ||
  capsule_hub_address ||
  fields_cell
)
```

No alternative v1 session-signature preimage exists.

### 6.8 Pre-Accept Checks

Before `accept_message`, Vault parses only compact request and checks:

```text
magic == "PLSR"
version == 1
op is private/public session external publish
op matches publish_kind
size_class and crypto_suite allowed for publish_kind
owner_wallet valid
session active
session_id matches
nonce matches
not expired
now <= valid_until
max_charge == canonical_current_discounted_max_charge_for_declared_publish
max_charge <= message_budget_ton
Ed25519 signature valid
```

Only then may Vault call `accept_message`.

### 6.9 Post-Accept Atomic Debit

Immediately after `accept_message`:

```text
sessions[owner_wallet].nonce += 1
users[owner_wallet].message_budget_ton -= compact_request.max_charge
escrowed_session_charge = compact_request.max_charge
```

No unhandled throw/revert is allowed between accept and debit.

Post-accept failures are controlled invalid signed requests:

```text
charge INVALID_SESSION_REQUEST_CHARGE_TON
refund max_charge - INVALID_SESSION_REQUEST_CHARGE_TON to message_budget_ton
nonce remains consumed
no CapsuleHub publish
no PLATO fee
```

### 6.10 Max Charge

Max charge uses current ATH discount:

```text
MAX_CHARGE_PRIVATE_STANDARD(owner_wallet)
MAX_CHARGE_PRIVATE_LONG_TERM(owner_wallet)
MAX_CHARGE_PUBLIC(owner_wallet)
```

Each includes:

```text
VAULT_EXTERNAL_SESSION_LOCAL_MAX_CHARGE
+ CapsuleHub call value with discounted PLATO fee
+ possible CapsuleHub page storage endowment
```

ATH discount applies only to PLATO fee, not execution/storage/state endowment.

### 6.11 PendingPublishV1

Publish id:

```text
publish_id = HASH(
  genesis_config_hash ||
  owner_wallet ||
  session_nonce ||
  body_hash ||
  publish_kind
)
```

`publish_id` must be nonzero.

Logical pending publish fields:

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

Implementation may key the pending map by `publish_bounce_id = publish_id mod 2^64` to support deterministic typed-bounce recovery.

Created before bounceable Vault -> CapsuleHub send.

ACK acceptance requires:

```text
sender == capsule_hub_address
pending exists for publish_bounce_id = ack.publish_id mod 2^64
recompute publish_id from pending fields
recomputed_publish_id == ack.publish_id
```

Bounce acceptance requires:

```text
sender == capsule_hub_address
pending exists for publish_bounce_id
```

ACK and bounce use `budget_epoch` routing:

```text
if session active and current budget_epoch == pending.budget_epoch:
  refund/excess -> message_budget_ton
else:
  refund/excess -> ton_balance
```

Returned/excess value is capped to `pending.refundable_budget_amount`.

`Vault.PrunePendingPublish` is not implementation-ready until a stale-pending TTL is pinned in open values. Until then, stale pending prune behavior is blocked rather than guessed.

### 6.12 ReceiveIntent

Create requires existing funded sender UserState.

Claim may create recipient UserState and charges `VAULT_USER_STATE_STORAGE_ENDOWMENT` if needed.

Create locks TON/ATH.

Claim credits recipient Vault balance.

Cancel returns locked asset to sender.

Session keys cannot create/claim/cancel ReceiveIntent.

### 6.13 Withdrawals

TON withdrawal:

```text
final user-directed TON transfer
action creation failure rolls back ton_balance debit
no ignored-error send mode
```

ATH withdrawal:

```text
bounce-safe ATH jetton transfer
bounce/failure restores ath_balance
no ignored-error send mode
```

---

## 7. Messaging Keys

### 7.1 KeyRecordV1

```text
KeyRecordV1 {
  owner_wallet: address
  key_generation: uint32
  enc_pubkey: 32 bytes
  sign_pubkey: 32 bytes
  pq_kem_pubkey: bytes | empty
  crypto_suite_mask: uint16
  created_at: uint32
  created_lt: uint64
  revoked_at: uint32
  revoked_lt: uint64
}
```

### 7.2 Registration / Replacement

Register:

```text
key_generation = 0
```

Replace:

```text
previous current key revoked
key_generation = previous_generation + 1
new KeyRecord created
```

Historical key records remain for historical message verification.

### 7.3 Key Derivation

From wallet signature:

```text
root_secret = HKDF-SHA256(wallet_signature, salt = genesis_config_hash, info = "PLATHO_ROOT_SECRET_V1")
```

Per generation:

```text
x25519_enc_keypair(key_generation)
payload_sender_auth_ed25519_keypair(key_generation)
mlkem768_kem_keypair(key_generation)
```

Official clients must derive and self-verify public keys before registering/replacing.

Nonconforming random messaging keys may be accepted by contracts but deterministic recovery is not guaranteed; official client warns.

### 7.4 Recipient Key Lookup

Before every private send, official client must verify recipient current active key record:

```text
recipient.current_key_id
KeyRecordV1
key_generation
revoked_lt == 0
```

Cached recipient key may be used only if verified current.

Lookup failure fails send.

---

## 8. Crypto / Body Layout

### 8.1 Header Hash

```text
header_i_hash = SHA256(exact 64-byte HeaderV1 serialization)
```

Not cell hash. Not BOC hash.

### 8.2 Body Hash

Body hash is canonical over fixed body tree.

```text
2KB = canonical 32 leaves
4KB = canonical 64 leaves
public body = separate public layout
```

### 8.3 Long-Term Mode

Standard:

```text
classical X25519 + XChaCha20-Poly1305 confidentiality
```

Long-Term:

```text
hybrid X25519 + ML-KEM-768 + XChaCha20-Poly1305 payload confidentiality
```

Long-Term does not promise future PQ privacy of communication graph.

### 8.4 Detection Tag

Detection tag is only a candidate hint.

It is not proof of:

```text
recipient ownership
sender authenticity
message validity
```

After detection match, client still requires:

```text
keybox decrypt
body decrypt / AEAD authentication
body_hash match
sender signature verification
sender key validity at publication logical time
payload domain/conversation checks
```

Failed candidates are invalid noise and not shown.

Clients should rate-limit/batch failed candidate processing.

---

## 9. FeeAccumulator

### 9.1 Deposit

FeeAccumulator accepts permissionless protocol-fee principal deposits. The declared
`amount` is accounted as protocol principal, and inbound value must include:

```text
amount + FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE
```

Surplus value is execution/storage reserve, not additional protocol-fee principal.
Permissionless deposits are safe because they can only add real TON-backed protocol
principal.

### 9.2 Split

Split requires caller-funded execution reserve:

```text
context.value >= FEEACCUMULATOR_SPLIT_EXEC_RESERVE
```

```text
split_base_bps = 10_000
treasury_amount = floor(accumulated_ton * TREASURY_SHARE_BPS / split_base_bps)
buyback_amount = accumulated_ton - treasury_amount
```

No dust remains.

Split does not send external value.

### 9.3 Treasury Flush

Final non-bounceable transfer to immutable terminal treasury receiver.

Treasury flush requires caller-funded execution reserve:

```text
context.value >= FEEACCUMULATOR_FLUSH_EXEC_RESERVE
```

Action creation failure rolls back debit.

No ignored-error mode.

### 9.4 Buyback Flush

Bounceable transfer to immutable BuybackBurn:

```text
BuybackBurn.OP_ACCEPT_BURN_RESERVE(amount)
```

Buyback flush requires caller-funded execution reserve:

```text
context.value >= FEEACCUMULATOR_FLUSH_EXEC_RESERVE
```

Bounce restores `buyback_due_ton`.

---

## 10. BuybackBurn

### 10.1 Accept Burn Reserve

Accepts TON only from immutable FeeAccumulator.

### 10.2 Execute Buyback

v1 is oracle-free.

Contract enforces:

```text
buyback_amount_ton == 50 TON
dex_min_out >= BUYBACK_MIN_ATH_OUT_PER_50_TON
DEX payload uses dex_min_out as actual min_out / ask_min_amount
```

Official executor policy:

```text
dex_min_out >= floor(current_quote_out * 0.95)
```

This 5% policy is not a trustless on-chain guarantee in v1.

### 10.3 Stuck Buyback

If no authenticated ATH receipt and no authenticated TON refund/bounce arrives, outcome is unknown.

Prune must not restore 50 TON reserve without authenticated DEX refund/bounce.

Late ATH after stale prune is burned, but original TON reserve is not restored unless authenticated refund/bounce arrives.

---

## 11. UsernameRegistry / UsernameNFTItem

### 11.1 Name Rules

```text
1-3 chars: rejected in v1
4 chars: 10,000 ATH
5 chars: 1,000 ATH
6+ chars: 100 ATH
lowercase ASCII only
no unicode
no uppercase
no hyphen/underscore/dot/space
```

### 11.2 Mint Flow

ATH transfer notification creates pending mint only if valid.

Finalized only after deterministic UsernameNFTItem deployed ACK.

Treasury/burn due credited only after ACK.

### 11.3 Refund Due

Invalid mint attempts may create:

```text
ath_refunds_due[wallet]
```

Creation charges:

```text
USERNAME_ATH_REFUND_DUE_STORAGE_ENDOWMENT
```

Refund flush uses bounce-safe ATH jetton transfer. Failure restores due.

Storage endowment is not refunded.

### 11.4 NFT ACK Recovery

UsernameNFTItem supports:

```text
OP_RESEND_DEPLOYED_ACK()
```

Permissionless. Grants no ownership/transfer rights.

Registry accepts ACK only if:

```text
pending exists
msg.sender == deterministic NFT item address
owner_wallet matches minter
name not finalized
```

Late ACK after pending deleted/refunded is rejected.

### 11.5 Ownership

NFT item owner is source of truth.

No seize, revoke, force-transfer, admin transfer.

---

## 12. ATH Jetton

ATH is fixed supply.

No post-deploy mint.

No tax.

No blacklist.

No pause.

No admin force transfer.

Burn must reduce total_supply.

Transfer-to-dead-address is not burn.

### 12.1 Wallet Authenticity

Contracts accepting ATH notifications accept only immutable official ATH wallet derived from:

```text
ATH master
owner contract address
pinned wallet code hash / derivation profile
```

For contracts whose official ATH wallet depends on the contract address itself, the deployment verifier derives the official ATH wallet after the contract address exists and binds it with a pinned pre-seal deployment-only operation. This avoids StateInit self-address circularity and avoids embedding ATH wallet derivation code into every dependent contract.

Vault uses:

```text
Vault.BindOfficialAthWallet = 0x18DB2CCB
```

Seal fails if the required official ATH wallet binding has not happened. After seal, rebinding is rejected forever. Runtime notification acceptance remains:

```text
msg.sender == stored_official_ath_wallet_address
```

Payload claims about master/owner/amount are not sufficient.

ATH wallet/master messages that debit, credit, or finalize token accounting require caller-funded execution reserve before mutation:

```text
ATH_INTERNAL_TRANSFER_EXEC_RESERVE = 0.002 TON
ATH_BURN_NOTIFICATION_EXEC_RESERVE = 0.002 TON
ATH_TRANSFER_NOTIFY_EXEC_RESERVE = 0.002 TON
ATH_TRANSFER_NOTIFY_ACK_VALUE = 0.001 TON
ATH_TRANSFER_NOTIFY_MIN_VALUE = 0.030 TON
```

Underfunded ATH transfer, transfer-with-notify, or burn-notification messages must reject before balance or total_supply mutation.

### 12.2 Burn Authorization

ATH master accepts burn only from deterministic official ATH wallet for burner owner.

Burn verifies:

```text
wallet balance debited
amount > 0
total_supply decreases exactly by amount
```

Protocol contracts can burn only ATH they own through their official ATH wallet.

Burn finalization/ack must be authenticated.

---

## 13. Treasury Receiver

Treasury Receiver v1 is terminal immutable receiver, not interactive protocol actor.

TON treasury receiver:

```text
immutable nonzero address
accepts plain TON
no custom opcode
no ACK
no callback
no recovery dependency
```

ATH treasury receiver:

```text
immutable nonzero address
can receive ATH jetton transfers
no protocol callback requirements
```

Treasury receiver cannot be governance/admin/control surface.

If it requires interactive acknowledgement, custom payload interpretation, callback, admin action, upgrade authority, or ability to influence v1 behavior, it is not valid v1 Treasury Receiver.

---

## 14. Monotonic Counter Overflow

Applies to:

```text
CapsuleHub.private_latest_id
CapsuleHub.public_latest_id
Vault session nonce
Vault budget_epoch
KeyRecord key_generation
```

Rule:

```text
if counter == MAX_VALUE:
  reject before mutating state
else:
  counter += 1
```

No wrap to zero.

---

## 15. Official Client Requirements

Official client must:

```text
verify deployment manifest and genesis_config_hash
derive deterministic messaging keys by key_generation
self-verify public keys before registration/replacement
generate session key randomly per session
store session private key only locally
never upload session private key to backend
warn/disable persistent no-popup mode if secure local storage unavailable
verify recipient current key before private send
treat detection tags only as candidate hints
verify sender signatures and key validity by publication logical time
recover historical messages from root_secret + key_generation records
```

---

## 16. Open Values Before Code Freeze

Must be pinned before implementation freeze:

```text
CompactSessionRequestV1 TON cell profile test vectors
CompactSessionRequestV1 session_sig_hash test vectors
HeaderV1 exact 64-byte test vectors
canonical body tree hash vectors
XChaCha20-Poly1305 vectors
ML-KEM deterministic keygen vectors
ATH wallet derivation profile
ATH burn finalization path
STON.fi v2 route cell/payload values
fee constants
reserve constants
storage endowment constants
CapsuleHub page size
Vault PrunePendingPublish stale TTL, if prune is kept in v1
```


If not pinned before freeze, not part of v1.

---

## 17. Test Matrix Summary

Required test groups:

```text
DEPLOY
NO-ADMIN
CAPSULE
CAPSULE-ID
CAPSULE-FEE
VAULT-HAPPY
VAULT-REJECT
VAULT-EXT
FEE-DUE
BUYBACK-DUE
USER
USER-DUE
ATH
TREASURY
CLIENT
CRYPTO-TV
ECON
```

No tests for deleted/nonexistent architecture are part of v1.

---

## 18. Final Implementation Rule

Claude/codegen must implement only this v1 specification.

If a behavior is not present here, reject it.

If a field is not specified here, do not add it.

If a fallback seems convenient, do not add it.

If a recovery path is not specified, the operation must not rely on it.

If a send profile is unclear, treat as implementation blocker.

Platho v1 is intentionally closed-world.


---

## Appendix: v0.3.3 Deployment ATH Binding Alignment

Vault official ATH wallet binding follows `platho_v1_open_values_v0_7_deployment_ath_binding.md`. The accepted profile is deployment verifier derivation plus pre-seal binding, not on-chain wallet derivation during seal. This is required because storing the final official ATH wallet in Vault StateInit changes the Vault address and therefore changes the derived official wallet again.
