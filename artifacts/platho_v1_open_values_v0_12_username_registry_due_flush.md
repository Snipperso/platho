# Platho v1 Open Values Profile v0.12: UsernameRegistry Treasury/Burn Due Flush

**Document status:** accepted implementation profile for milestone 12  
**Base profile:** `platho_v1_open_values_v0_11_ath_transfer_username_refund_flush.md`  
**Rule:** if behavior is not pinned here or in the base profile/spec set, it is not part of this milestone.

---

## 1. Scope

Implemented now:

```text
ATH burn finalization ACK from ATH Master to owner/response destination
ATH burn failure notification from ATH Wallet to owner on master notification bounce/failure
UsernameRegistry.FlushTreasuryAthDue
UsernameRegistry.FlushBurnAthDue
UsernameRegistry pending treasury flush accounting
UsernameRegistry pending burn flush accounting
UsernameRegistry treasury transfer ACK clearing
UsernameRegistry treasury transfer bounce/failure restoration
UsernameRegistry burn finalization ACK clearing
UsernameRegistry burn failure/bounce restoration
```

Still not implemented:

```text
UsernameRegistry.PrunePendingUsernameMint
BuybackBurn
STON.fi route
Flush Treasury/Burn partial amounts
admin / owner override / pause / upgrade / governance / rescue / fallback
ignored-error money sends
additional routes / adapters / migration hooks / compatibility paths
```

---

## 2. ATH Burn ACK Extension

The old ATH burn path reduced `total_supply`, but owner/protocol contracts could not deterministically clear due buckets after verified supply decrease. Milestone 12 fixes that with an authenticated ACK.

### 2.1 Updated Burn Request

```text
ATHWallet.ATHBurn = 0x41544801

ATHBurn {
  query_id: uint64
  amount: uint128 ATH atomic units
  response_destination: MsgAddress
}
```

Rules:

```text
sender() MUST equal ATHWallet.owner_address
response_destination MUST equal ATHWallet.owner_address
amount MUST be > 0
ATHWallet.balance MUST be >= amount
```

Effects:

```text
ATHWallet.balance -= amount
send bounceable ATHBurnNotification to ATH Master
```

### 2.2 Updated Burn Notification

```text
ATHWallet.ATHBurnNotification = 0x41544802

ATHBurnNotification {
  query_id: uint64
  amount: uint128 ATH atomic units
  owner_address: MsgAddress
  response_destination: MsgAddress
}
```

The field order still keeps `query_id` and `amount` first so bounced-message recovery can restore the debited amount.

### 2.3 Burn Finalized ACK

```text
ATHWallet.ATHBurnFinalized = 0x41544803

ATHBurnFinalized {
  query_id: uint64
  amount: uint128 ATH atomic units
  owner_address: MsgAddress
}
```

ATH Master sends this only after:

```text
sender() == derive_ath_wallet_address(owner_address)
total_supply decreased exactly by amount
```

Protocol contracts MUST accept burn finalization only from `ATH_MASTER_ADDRESS` and only for a matching pending burn flush.

### 2.4 Burn Failed Notification

```text
ATHWallet.ATHBurnFailed = 0x41544804

ATHBurnFailed {
  query_id: uint64
  amount: uint128 ATH atomic units
}
```

If `ATHBurnNotification` bounces/fails before master finalization:

```text
ATHWallet.balance += amount
ATHWallet sends ATHBurnFailed(query_id, amount) to owner_address
```

---

## 3. UsernameRegistry Treasury Due Flush

Opcode:

```text
UsernameRegistry.FlushTreasuryAthDue = 0x60A9BDDB
```

Payload:

```text
FlushTreasuryAthDue {
  query_id: uint64
}
```

Rules:

```text
registry MUST be sealed
query_id MUST be > 0
query_id MUST NOT be used by any pending ATH due flush
threshold: treasury_due_ath MUST be > 0
treasury_ath_receiver_address MUST be a basechain std address
context().value MUST be >= USERNAME_ATH_TRANSFER_EXEC_RESERVE
```

Seal also enforces the same basechain treasury receiver policy. The v1 treasury
flush profile does not support masterchain treasury receivers; fixed ATH
transfer envelopes are sized for basechain recipient ATH wallets.


Effects before send:

```text
amount = treasury_due_ath
treasury_due_ath = 0
recipient = immutable treasury_ath_receiver_address
recipient_ath_wallet = derive_ath_wallet_address(recipient)
create pending_treasury_flushes[query_id]
send bounceable ATHTransferRequest to official_ath_wallet_address
```

Success ACK accepted only if:

```text
pending_treasury_flushes[query_id] exists
msg.amount == pending.amount
msg.sender == pending.recipient_ath_wallet
```

Bounce/failure restoration:

```text
delete pending_treasury_flushes[query_id]
treasury_due_ath += pending.amount
```

No ignored-error send mode is used.

---

## 4. UsernameRegistry Burn Due Flush

Opcode:

```text
UsernameRegistry.FlushBurnAthDue = 0xE9A2C2CB
```

Payload:

```text
FlushBurnAthDue {
  query_id: uint64
}
```

Rules:

```text
registry MUST be sealed
query_id MUST be > 0
query_id MUST NOT be used by any pending ATH due flush
burn_due_ath MUST be > 0
context().value MUST be >= USERNAME_ATH_BURN_EXEC_RESERVE
```

Pinned reserve:

```text
USERNAME_ATH_BURN_EXEC_RESERVE = 0.005 TON = 5_000_000 nanotons
```

Effects before send:

```text
amount = burn_due_ath
burn_due_ath = 0
create pending_burn_flushes[query_id]
send bounceable ATHBurn(query_id, amount, response_destination = UsernameRegistry address) to official_ath_wallet_address
```

Success finalization accepted only if:

```text
pending_burn_flushes[query_id] exists
msg.sender == ATH_MASTER_ADDRESS
msg.owner_address == UsernameRegistry address
msg.amount == pending.amount
```

Effects:

```text
delete pending_burn_flushes[query_id]
```

Bounce/failure restoration:

```text
bounced<ATHBurn> from official_ath_wallet_address
ATHBurnFailed from official_ath_wallet_address
```

Both restore:

```text
delete pending_burn_flushes[query_id]
burn_due_ath += pending.amount
```

---

## 5. UsernameRegistry Init Update

UsernameRegistry initial data now includes immutable ATH treasury receiver:

```text
UsernameRegistry.init(
  official_ath_wallet_address,
  ath_master_address,
  treasury_ath_receiver_address,
  sealed,
  deployment_manifest_hash,
  genesis_config_hash
)
```

`treasury_ath_receiver_address` is immutable and is not a governance/admin/control surface.

---

## 6. Updated Code Hashes

```text
ATH_WALLET_CODE_HASH=7b4b51d5044ddd869d277dd037fd738a4f38696dc47c0960808e6891ca61a7d5
ATHMASTER_CODE_HASH=143c2255d9bf3ae853947e45560afeb6ad0a0648361ed2350c714c3e9d6d2328
USERNAME_REGISTRY_CODE_HASH=bf2b6bee43aeecd3bbe3ed3b8eec6108be4438cd61a90b51434d0b6018c22176
```

ATH wallet and master hashes changed because burn ACK/failure messages are now part of the production burn profile. UsernameRegistry hash changed because treasury/burn due flush and immutable treasury receiver are now part of its state/profile.

---

## 7. Tests Added

```text
USERNAME-REG-M12-01
USERNAME-REG-M12-02
USERNAME-REG-M12-03
USERNAME-REG-M12-04
```

Full suite result:

```text
18 test files passed
85 tests passed
```
