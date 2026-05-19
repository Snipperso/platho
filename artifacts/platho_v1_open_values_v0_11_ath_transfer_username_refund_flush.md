# Platho v1 Open Values Profile v0.11: ATH Transfer + UsernameRegistry Refund Flush

**Document status:** accepted implementation profile for milestone 11  
**Base profile:** `platho_v1_open_values_v0_10_username_registry_paid_mint.md`  
**Rule:** if behavior is not pinned here or in the base profile/spec set, it is not part of this milestone.

---

## 1. Scope

Implemented now:

```text
ATHWallet owner-authorized bounce-safe transfer
ATH wallet transfer recipient deterministic StateInit deploy/credit
UsernameRegistry.FlushAthRefundDue
UsernameRegistry pending refund flush accounting
UsernameRegistry refund flush success ACK clearing
UsernameRegistry refund flush bounce/failure restoration
```

Still not implemented:

```text
UsernameRegistry.FlushTreasuryAthDue
UsernameRegistry.FlushBurnAthDue
UsernameRegistry.PrunePendingUsernameMint
ATH burn due-bucket integration/ack for UsernameRegistry
BuybackBurn
STON.fi route
admin / owner override / pause / upgrade / governance / rescue / fallback
ignored-error money sends
additional routes / adapters / migration hooks / compatibility paths
```

---

## 2. ATH Wallet Transfer Profile

ATH Wallet remains fixed-supply and owner-controlled. There is no mint, tax, blacklist, pause, or admin force transfer.

### 2.1 Owner Transfer Request

```text
ATHWallet.ATHTransferRequest = 0x41544810

ATHTransferRequest {
  query_id: uint64
  amount: uint128 ATH atomic units
  recipient: MsgAddress
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
source_wallet.balance -= amount
recipient_wallet = derive_ath_wallet_address(recipient)
send bounceable ATHInternalTransfer to recipient_wallet with recipient StateInit
```

The transfer request field order keeps `query_id` and `amount` first for owner-side bounce recovery by source contracts.

### 2.2 Internal Transfer

```text
ATHWallet.ATHInternalTransfer = 0x41544812

ATHInternalTransfer {
  query_id: uint64
  amount: uint128 ATH atomic units
  sender_owner: MsgAddress
  response_destination: MsgAddress
}
```

Recipient wallet accepts only if:

```text
sender() == derive_ath_wallet_address(sender_owner)
amount > 0
```

Effects:

```text
recipient_wallet.balance += amount
recipient_wallet sends ATHTransferAck(query_id, amount) to response_destination
```

### 2.3 Transfer ACK / Failure

```text
ATHWallet.ATHTransferAck    = 0x41544811
ATHWallet.ATHTransferFailed = 0x41544813
```

ACK means the recipient ATH wallet credited the exact amount. Failure means the source ATH wallet restored its balance after internal transfer bounce/failure.

### 2.4 Transfer-to-dead-address

Transfer to any address, including a dead/inaccessible owner address, is not burn. It only creates/credits the deterministic ATH wallet for that owner address. ATH total supply is unchanged.

---

## 3. UsernameRegistry Refund Flush

Opcode:

```text
UsernameRegistry.FlushAthRefundDue = 0x6B928B47
```

Payload:

```text
FlushAthRefundDue {
  query_id: uint64
  owner_wallet: MsgAddress
}
```

Rules:

```text
registry MUST be sealed
query_id MUST be > 0
pending_refund_flushes[query_id] MUST NOT exist
ath_refunds_due[owner_wallet] MUST exist and be > 0
context().value MUST be >= USERNAME_ATH_TRANSFER_EXEC_RESERVE
```

Pinned reserve:

```text
USERNAME_ATH_TRANSFER_EXEC_RESERVE = 0.005 TON = 5_000_000 nanotons
```

Effects before send:

```text
due = ath_refunds_due[owner_wallet]
delete ath_refunds_due[owner_wallet]
refund_due_count -= 1
recipient_ath_wallet = derive_ath_wallet_address(owner_wallet)
create pending_refund_flushes[query_id]
pending_refund_flush_count += 1
send bounceable ATHTransferRequest to official_ath_wallet_address
```

Send profile:

```text
to = official_ath_wallet_address
value = USERNAME_ATH_TRANSFER_EXEC_RESERVE
mode = SendPayFwdFeesSeparately
bounce = true
body = ATHTransferRequest(query_id, due, owner_wallet, response_destination = UsernameRegistry address)
```

---

## 4. Refund Flush Finalization

Success path:

```text
UsernameRegistry accepts ATHTransferAck only if:
  pending_refund_flushes[query_id] exists
  msg.amount == pending.amount
  msg.sender == pending.recipient_ath_wallet
```

Effects:

```text
delete pending_refund_flushes[query_id]
pending_refund_flush_count -= 1
```

Bounce/failure paths:

```text
bounced<ATHTransferRequest> from official_ath_wallet_address
ATHTransferFailed from official_ath_wallet_address
```

Both restore:

```text
delete pending_refund_flushes[query_id]
pending_refund_flush_count -= 1
ath_refunds_due[owner_wallet] += amount
refund_due_count restored if the entry was absent
```

No ignored-error money send is used.

---

## 5. Updated Code Hashes

```text
ATH_WALLET_CODE_HASH=fd9bebe7f6fabc9a5ecd248f6ad1786ff471dd7f7cf35a312e3876a1fe61ec47
ATHMASTER_CODE_HASH=9df08d668edfa892aa1aa350c75a8c60a4c04d14a9d35fd387c4643c1fad39ab
USERNAME_REGISTRY_CODE_HASH=136900f5b1e555a8a7f17bc5cde88bb84449a6c8a0d235629941991405038f91
```

ATH wallet code hash changed because production transfer support is now part of the compiled ATH wallet artifact. All dependent deployment manifests and wallet derivation vectors must use this new hash.

---

## 6. Tests Added

```text
ATH-XFER-01
ATH-XFER-02
ATH-XFER-03
USERNAME-REG-M11-01
USERNAME-REG-M11-02
```

Full suite result:

```text
17 test files passed
81 tests passed
```
