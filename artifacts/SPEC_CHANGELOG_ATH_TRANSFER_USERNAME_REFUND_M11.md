# Spec Changelog: ATH Transfer + UsernameRegistry Refund Flush M11

Accepted changes:

1. Added production `ATHWallet.ATHTransferRequest` / `ATHInternalTransfer` / `ATHTransferAck` / `ATHTransferFailed` profile.
2. Added `UsernameRegistry.FlushAthRefundDue` pending-send profile.
3. Added `USERNAME_ATH_TRANSFER_EXEC_RESERVE = 0.005 TON`.
4. Added `ath_master_address` to `UsernameRegistry` init data so registry can derive recipient ATH wallets for ACK authentication.
5. Updated ATH wallet code hash and all dependent vector obligations.

Non-changes:

```text
No mint
No tax
No blacklist
No pause
No admin force transfer
No transfer-to-dead-address-as-burn
No ignored-error money send
No rescue/governance/fallback path
```

Still blocked:

```text
FlushTreasuryAthDue: requires treasury ATH receiver integration profile.
FlushBurnAthDue: requires UsernameRegistry burn due finalization/ack integration.
BuybackBurn: blocked by STON.fi route values.
PrunePendingUsernameMint: blocked by TTL.
```
