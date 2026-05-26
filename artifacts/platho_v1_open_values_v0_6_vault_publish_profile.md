# Platho v1 Open Values Profile Update: Vault External Publish / PendingPublish

**Version:** v0.6-vault-external-publish-profile
**Status:** proposed freeze-candidate profile update after Vault M6 implementation
**Companion package:** `platho-vault-m6-spec-review.zip`
**Rule:** this profile does not introduce admin, pause, rescue, fallback, compatibility routes, migration hooks, or ignored-error money sends.

This profile pins the implementation-relevant details that were not sufficiently specified by the earlier raw CompactSessionRequestV1 and Vault -> CapsuleHub publish profile.

---

## 1. CompactSessionRequestV1 TON Cell Profile

The Vault external session publish request is a TON cell profile, not a raw 268-byte external payload.

### 1.1 Root Cell Fields

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

### 1.2 `hashes_ref` Cell

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

### 1.3 `signature_ref` Cell

```text
signature: 512 raw bits Ed25519 signature
```

The `signature_ref` cell MUST provide exactly the 512-bit signature used by TVM `checkSignature`.

---

## 2. Session Signature Hash

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
  SIGN_DOMAIN_SESSION_PUBLISH ||
  genesis_config_hash ||
  vault_address ||
  capsule_hub_address ||
  fields_cell
)
```

No alternative v1 signature preimage is valid for the TON cell profile.

---

## 3. Vault Publish ID

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

---

## 4. Vault -> CapsuleHub Publish Message Layout

Vault -> CapsuleHub publish messages include a first-field bounce routing key.

### 4.1 Private Publish From Vault

```text
CapsuleHub.PublishPrivateFromVault = 0xA4F862C0

PublishPrivateFromVault {
  publish_bounce_id: uint64
  publish_bounce_tag:uint160
  publish_id:        uint256
  size_class:        uint8
  crypto_suite:      uint8
  header_0_hash:     uint256
  header_1_hash:     uint256
  body_hash:         uint256
  protocol_fee_paid: coins uint128
}
```

### 4.2 Public Publish From Vault

```text
CapsuleHub.PublishPublicFromVault = 0x8C2A76B7

PublishPublicFromVault {
  publish_bounce_id: uint64
  publish_bounce_tag:uint160
  publish_id:        uint256
  marketing_note:    uint152 = ASCII "sent via Platho.App"
  author_wallet:     MsgAddress
  body_hash:         uint256
  protocol_fee_paid: coins uint128
}
```

`marketing_note` is fixed to:

```text
0x73656e742076696120506c6174686f2e417070
```

It is a public-channel-only on-chain marker and is not part of the user-rendered message body. Private publish messages have no marketing marker.

---

## 5. Bounce Routing Key

```text
publish_bounce_id = publish_id mod 2^64
publish_bounce_tag = hash(cell { publish_id:uint256 }) mod 2^160
```

Rules:

```text
1. publish_bounce_id selects the PendingPublish bounce slot.
2. publish_bounce_tag is a compact bounce proof derived from the full publish_id.
3. Bounce handlers cannot read the full publish_id because TON bounced bodies expose only the first 224 payload bits after opcode.
4. Vault verifies bounce by recomputing full publish_id from PendingPublish fields and matching publish_bounce_tag.
5. CapsuleHub ACK uses full publish_id.
6. Vault verifies ACK by recomputing full publish_id from PendingPublish fields.
7. If pending_publishes[publish_bounce_id] already exists before send, Vault MUST NOT send to CapsuleHub.
8. Collision before send is treated as a controlled post-accept invalid signed request: nonce consumed, bounded invalid-request charge, no PLATO fee, no CapsuleHub publish.
```

---

## 6. PendingPublishV1 Storage

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

---

## 7. Vault -> CapsuleHub Send Mode

Vault -> CapsuleHub publish sends MUST be:

```text
bounce = true
mode = SendPayGasSeparately
value = capsulehub_call_value
```

`SendPayGasSeparately` is allowed here because it is not ignored-error mode and does not suppress bounce failure. It is required so the exact canonical CapsuleHub call value reaches CapsuleHub validation.

Ignored-error mode remains forbidden for outbound money sends.

---

## 8. ACK and Bounce Routing

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

CapsuleHub ACK value MUST retain CapsuleHub-side backing for accepted publishes:
protocol fee, execution/storage reserves, keepalive, entry storage, and any page
storage actually charged stay in CapsuleHub. A success ACK returns only the fixed
publish ACK reserve of `30,000,000` nanotons (`0.030 TON`); after Vault processes
that ACK, the user is credited roughly `28,000,000` nanotons in internal Vault TON
balance. Later final v1 PWA surcharge above canonical required value is retained
by CapsuleHub as network/storage reserve overage, not returned to Vault.

---

## 9. PrunePendingPublish Remains Blocked

The main spec says stale pending publish may be pruned without refund, but this profile does not pin a TTL.

Until TTL is pinned:

```text
Vault.PrunePendingPublish is not implementation-ready.
```

---

## 10. Non-Changes

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
