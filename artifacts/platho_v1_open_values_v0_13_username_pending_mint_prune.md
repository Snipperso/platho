# Platho v1 Open Values Profile v0.13: UsernameRegistry Pending Mint Prune

**Document status:** accepted implementation profile for milestone 13  
**Base profile:** `platho_v1_open_values_v0_12_username_registry_due_flush.md`  
**Rule:** if behavior is not pinned here or in the base profile/spec set, it is not part of this milestone.

---

## 1. Scope

Implemented now:

```text
UsernameRegistry.PrunePendingUsernameMint
stale PendingUsernameMint TTL
price_paid recovery into ath_refunds_due
late UsernameNFTItem ACK rejection after prune
UsernameNFTItem ACK forward reserve validation update
```

Still not implemented:

```text
Vault.PrunePendingPublish
BuybackBurn
STON.fi route
partial treasury/burn flush amounts
admin / owner override / pause / upgrade / governance / rescue / fallback
ignored-error money sends
additional routes / adapters / migration hooks / compatibility paths
```

---

## 2. Pending Username Mint Stale TTL

Pinned value:

```text
USERNAME_PENDING_MINT_STALE_TTL = 86_400 seconds = 24 hours
```

Rationale:

```text
UsernameNFTItem deploy + deployed ACK should complete immediately in normal message flow.
A pending mint that remains unfinalized for 24 hours is stale for v1 purposes.
The TTL is long enough to avoid pruning during ordinary async message settlement and short enough to avoid name lock griefing.
```

This TTL applies only to `UsernameRegistry.PendingUsernameMint`.

It does **not** unblock:

```text
Vault.PrunePendingPublish
BuybackBurn.PruneStuckBuyback
any STON.fi route-related prune
```

---

## 3. PrunePendingUsernameMint

Opcode:

```text
UsernameRegistry.PrunePendingUsernameMint = 0x3796DF2D
```

Payload:

```text
PrunePendingUsernameMint {
  name_hash: uint256
}
```

Rules:

```text
registry MUST be sealed
name_hash MUST be nonzero
pending_mints[name_hash] MUST exist
now() >= pending.created_at + USERNAME_PENDING_MINT_STALE_TTL
name_records[name_hash] MUST NOT exist
```

Effects:

```text
pending = pending_mints[name_hash]
delete pending_mints[name_hash]
delete pending_item_to_name_hash[pending.item_address]
pending_mint_count -= 1
ath_refunds_due[pending.owner_wallet] += pending.price_paid
```

Refund semantics:

```text
Only pending.price_paid is moved into ath_refunds_due.
USERNAME_PENDING_MINT_STORAGE_ENDOWMENT is not refunded.
Freed pending state/storage reserve remains with UsernameRegistry as contract storage reserve.
```

Permission model:

```text
PrunePendingUsernameMint is permissionless.
Caller gains no authority and cannot choose refund recipient.
Refund recipient is pending.owner_wallet from stored state.
```

Late ACK after prune:

```text
Any UsernameNFTItem ACK arriving after the pending mint was pruned MUST be rejected.
It MUST NOT recreate the pending mint.
It MUST NOT create a NameRecord.
It MUST NOT debit or mutate ath_refunds_due.
```

No ignored-error money send is used because prune does not perform an outbound ATH transfer. It only moves already-accounted ATH value from pending mint accounting into a bounce-safe refund-due bucket.

---

## 4. UsernameNFTItem ACK Forward Reserve Update

Pinned value:

```text
USERNAME_ITEM_ACK_FORWARD_RESERVE = 0.003 TON = 3_000_000 nanotons
```

Reason:

```text
After UsernameRegistry gained due-flush and pending-prune accounting, 0.001 TON was not enough for all tested ACK paths, including sequential successful mints after registry state growth.
```

Rule:

```text
UsernameNFTItem.ResendDeployedAck MUST NOT use SendRemainingValue.
It sends fixed USERNAME_ITEM_ACK_FORWARD_RESERVE with SendPayFwdFeesSeparately.
The NFT item keeps the rest of its deployment/storage reserve.
```

This value is validated by the M13 full suite and must not be silently lowered.

---

## 5. Test Obligations

Required tests:

```text
USERNAME-REG-M13-01: stale PendingUsernameMint can be pruned, refunds exact price, and late ACK is rejected
USERNAME-REG-M13-02: non-stale PendingUsernameMint cannot be pruned and remains pending
REGRESSION-M10: valid paid mints still finalize after ACK after reserve update
REGRESSION-M12: treasury/burn due flush still passes after reserve update
```

---

## 6. Blocker Status

Unblocked and implemented:

```text
UsernameRegistry.PrunePendingUsernameMint
Username pending mint stale TTL
late ACK rejection after prune
```

Still blocked:

```text
Vault.PrunePendingPublish stale TTL
BuybackBurn STON.fi route and payload values
BuybackBurn buyback/burn final route execution
```
