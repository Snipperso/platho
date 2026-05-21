# Platho v1 Open Values Profile v0.10: UsernameRegistry Paid Mint

**Document status:** accepted implementation profile for UsernameRegistry paid mint milestone 10  
**Base spec:** `platho_v1_spec_v0_3_3_deployment_ath_binding.md`  
**Companion previous profile:** `platho_v1_open_values_v0_9_username_registry_foundation.md`  
**Rule:** if behavior is not pinned here or in the base v1 spec/profile set, it is not part of this milestone.

---

## 1. Scope

Implemented now:

```text
UsernameRegistry.AthTransferNotificationMintUsername payload profile
raw username byte validation
canonical username name_hash
exact ATH price enforcement
PendingUsernameMint creation
UsernameNFTItem deploy from UsernameRegistry
UsernameItemDeployedAck finalization
NameRecord persistence
ATH refund-due accounting for rejected official mint notifications
treasury_due_ath / burn_due_ath accounting after ACK
UsernameNFTItem ACK send reserve behavior
```

Not implemented in this milestone:

```text
FlushTreasuryAthDue
FlushBurnAthDue
FlushAthRefundDue
PrunePendingUsernameMint
BuybackBurn
STON.fi route
ATH burn of UsernameRegistry burn_due_ath
admin / owner override / pause / upgrade / governance / rescue / fallback
additional adapters / routes / migration hooks / compatibility paths
ignored-error money sends
```

---

## 2. Username Mint Notification Payload

Opcode:

```text
UsernameRegistry.AthTransferNotificationMintUsername = 0x89129D5F
```

Payload:

```text
AthTransferNotificationMintUsernameV1 {
  op: uint32 = 0x89129D5F
  query_id: uint64
  amount: uint128 ATH atomic units
  owner_wallet: MsgAddress
  username_len: uint8
  username: remaining raw bytes, exactly username_len bytes
}
```

Rules:

```text
msg.sender MUST equal stored official_ath_wallet_address
amount MUST be > 0
payload username remaining slice MUST contain no refs
payload username bits MUST equal username_len * 8
owner_wallet MUST be a basechain std address for the supported v1 runtime mint profile
```

Payload claims about ATH master/owner are not sufficient; runtime sender authentication remains the official ATH wallet check.

The deterministic UsernameNFTItem address derivation profile can still produce
vectors for non-basechain owners as address mathematics, but paid mint execution
is basechain-only in v1. Fixed mint/NFT/ACK envelopes are not sized for
masterchain downstream deployment and transfer paths.

---

## 3. Username Canonical Byte Rules

Accepted v1 username bytes:

```text
length: 4..32 bytes inclusive
allowed bytes: ASCII a-z and ASCII 0-9 only
unicode: forbidden
uppercase: forbidden
hyphen / underscore / dot / space: forbidden
normalization: none
```

No alternate Unicode normalization, display-name mapping, case folding, or separator normalization exists in v1.

---

## 4. Name Hash

Canonical formula:

```text
USERNAME_NAME_HASH_DOMAIN = first_32_bits(SHA256("PLATHO.V1.UsernameRegistry.NameHash"))
USERNAME_NAME_HASH_DOMAIN = 0xC5CC7CD6

name_hash = cell_hash(
  Cell {
    USERNAME_NAME_HASH_DOMAIN:uint32
    username_raw_bytes
  }
)
```

The contract computes `name_hash` from raw username bytes. The mint payload does not carry a trusted name_hash.

---

## 5. Price Rules

Pinned price tiers remain:

```text
4 chars: 10_000 ATH = 10_000_000_000_000 atomic ATH
5 chars: 1_000 ATH = 1_000_000_000_000 atomic ATH
6..32 chars: 100 ATH = 100_000_000_000 atomic ATH
```

M10 uses exact-price mint:

```text
amount MUST equal price(username_len)
```

If an official ATH wallet notification is invalid after authentication, the registry does not create a pending mint. If enough TON is attached to create a refund due entry, it records:

```text
ath_refunds_due[owner_wallet] += amount
```

If a new refund-due entry is required, the notification must carry at least:

```text
USERNAME_ATH_REFUND_DUE_STORAGE_ENDOWMENT = 0.004 TON = 4_000_000 nanotons
```

Flush of refund due ATH remains out of M10 scope.

---

## 6. Pending Mint and NFT Deploy

On valid official notification:

```text
name_hash = canonical hash(username_bytes)
price = exact tier price
name_records[name_hash] MUST NOT exist
pending_mints[name_hash] MUST NOT exist
context().value >= USERNAME_PENDING_MINT_STORAGE_ENDOWMENT + USERNAME_NFT_ITEM_DEPLOY_RESERVE
```

The notification must also carry enough value for the registry to ACK the official ATH wallet:

```text
context().value >= USERNAME_PENDING_MINT_STORAGE_ENDOWMENT + USERNAME_NFT_ITEM_DEPLOY_RESERVE + USERNAME_ATH_NOTIFICATION_ACK_VALUE
```

Meaningful excess notification TON above the retained value is returned to
`owner_wallet` on successful mint. Dust below the implementation refund
threshold may remain as registry reserve to avoid dust refund action-phase
failure.

The registry creates:

```text
PendingUsernameMint {
  owner_wallet
  name_hash
  price_paid
  item_address
  item_deploy_value
  created_at
}
```

and sends a bounceable deployment message to deterministic `UsernameNFTItem`:

```text
to = derive_username_item_address(owner_wallet, name_hash)
value = USERNAME_NFT_ITEM_DEPLOY_RESERVE
mode = SendPayFwdFeesSeparately
bounce = true
code/data = UsernameNFTItem StateInit
body = UsernameNFTItem.ResendDeployedAck {}
```

---

## 7. UsernameNFTItem ACK Reserve

M8 `ResendDeployedAck` is refined for deployment safety:

```text
USERNAME_ITEM_ACK_FORWARD_RESERVE = 0.003 TON = 3_000_000 nanotons
```

`UsernameNFTItem.ResendDeployedAck` sends `UsernameItemDeployedAck` with:

```text
value = USERNAME_ITEM_ACK_FORWARD_RESERVE
mode = SendDefaultMode
bounce = true
```

It MUST NOT use `SendRemainingValue`, because that can drain the NFT item storage reserve during initial deploy.

Permissionless resend remains allowed, but the inbound message must carry at least:

```text
context().value >= USERNAME_ITEM_ACK_FORWARD_RESERVE
```

This prevents underfunded resend attempts from draining the item storage reserve.

---

## 8. ACK Finalization

Registry accepts `UsernameItemDeployedAck` only if:

```text
registry sealed == true
pending exists
msg.sender == deterministic UsernameNFTItem address for pending owner/name_hash
owner_wallet matches pending owner_wallet
name_hash matches pending name_hash
name_records[name_hash] does not exist
```

On valid ACK:

```text
delete pending_mints[name_hash]
delete pending_item_to_name_hash[item_address]
create name_records[name_hash]
name_record_count += 1
pending_mint_count -= 1
```

Then the paid ATH principal becomes protocol due:

```text
USERNAME_SPLIT_BASE_BPS = 10_000
USERNAME_TREASURY_SHARE_BPS = 5_000
USERNAME_BURN_SHARE_BPS = 5_000

treasury_amount = floor(price_paid * 5_000 / 10_000)
burn_amount = price_paid - treasury_amount
```

Dust, if any, goes to `burn_amount`.

After a paid-mint notification is accepted and either a pending mint or refund-due entry has been recorded, the registry sends:

```text
AthTransferNotificationAck(query_id, amount)
to = official_ath_wallet_address
value = USERNAME_ATH_NOTIFICATION_ACK_VALUE
bounce = false
```

This clears the corresponding pending notification in the official ATH wallet. If the incoming value is insufficient for the required state update plus this ACK, the registry rejects the notification instead of recording partial state.

---

## 9. Deploy Bounce Recovery

If the NFT deploy/initial ACK body bounces, the registry uses `msg.sender` item address to find the pending mint via:

```text
pending_item_to_name_hash[item_address]
```

Then:

```text
delete pending_mints[name_hash]
delete pending_item_to_name_hash[item_address]
pending_mint_count -= 1
ath_refunds_due[owner_wallet] += price_paid
```

No treasury/burn due is credited on bounce.

---

## 10. Reserve Constants

Pinned by M10 gas/test validation:

```text
USERNAME_NFT_ITEM_DEPLOY_RESERVE = 0.020 TON = 20_000_000 nanotons
USERNAME_ITEM_ACK_FORWARD_RESERVE = 0.003 TON = 3_000_000 nanotons
USERNAME_ATH_NOTIFICATION_ACK_VALUE = 0.001 TON = 1_000_000 nanotons
```

Existing constants used:

```text
USERNAME_PENDING_MINT_STORAGE_ENDOWMENT = 0.006 TON = 6_000_000 nanotons
USERNAME_ATH_REFUND_DUE_STORAGE_ENDOWMENT = 0.004 TON = 4_000_000 nanotons
```

---

## 11. Test Vector Obligations

Generated vector artifact:

```text
artifacts/username_registry_mint_vectors.json
```

Includes:

```text
mint payload layout examples
name_hash examples
UsernameRegistry code hash
UsernameNFTItem code hash
ATH wallet code hash
official ATH wallet fixture derivation
valid 4/5/6+ username vectors
invalid username examples
```

---

## 12. Blocker Status

Unblocked and implemented:

```text
UsernameRegistry paid mint flow
AthTransferNotificationMintUsername exact payload
raw username byte serialization
UsernameNFTItem deploy reserve
PendingUsernameMint create/finalize
NameRecord persistence
treasury/burn due accounting after ACK
refund-due accounting for rejected official notifications
```

Still blocked / not implemented:

```text
FlushTreasuryAthDue
FlushBurnAthDue
FlushAthRefundDue
PrunePendingUsernameMint TTL
BuybackBurn STON.fi route
ATH burn of burn_due_ath
```
