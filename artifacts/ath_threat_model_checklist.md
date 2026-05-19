# ATH Wallet/Master Threat Model Checklist

Status: local engineering hardening pass, not an independent audit or formal proof.

Date: 2026-05-17

## Covered Locally

- Fixed-supply ATH master with no mint/admin/pause/blacklist/tax/force-transfer/fallback behavior.
- Deterministic ATH wallet derivation from owner address and ATH master address.
- Owner-authorized burn request and authenticated ATHMaster burn notification.
- Burn notification bounce/failure recovery restoring wallet balance before total_supply finalization.
- Owner-authorized ATH transfer and recipient-wallet authenticated internal transfer.
- ATH transfer-with-notify flow with recipient notification, ACK value, pending notification state, and bounce refund path.
- Caller-funded execution reserve boundaries for transfer requests, internal wallet credits, notify transfer credits, burn requests, and master burn notifications.
- Min-1 and exact-min reserve boundaries for internal transfers, notify transfers, and burn notification finalization.
- Rejection of arbitrary transfer-to-dead-address burn semantics and forged burn notifications.

## Local Invariants

- ATHMaster `total_supply` decreases only after an authenticated official wallet burn notification with caller-funded execution reserve.
- ATHWallet balance is debited before outbound burn/transfer and restored on covered bounce/failure paths.
- Recipient ATHWallet balance increases only after an authenticated source wallet message with caller-funded execution reserve.
- Transfer-with-notify cannot credit recipient balance unless the inbound value funds the user notification, wallet ACK, and recipient execution reserve.
- Burn notification cannot debit global supply from ATHMaster reserve; the wallet/caller funds the execution boundary.

## Residual Assumptions

- Sandbox gas and forwarding behavior is a proxy, not final mainnet gas proof.
- `ATH_INTERNAL_TRANSFER_EXEC_RESERVE = 0.002 TON`, `ATH_BURN_NOTIFICATION_EXEC_RESERVE = 0.002 TON`, and `ATH_TRANSFER_NOTIFY_EXEC_RESERVE = 0.002 TON` are local conservative guards and should be remeasured on testnet/mainnet.
- Permanent processed-notification state in ATHWallet still needs final storage-rent/economic sizing.
- No independent human audit has reviewed this hardening pass.
- No formal model checker has proven all reachable states.

## Recommended Before Final Genesis

- Independent Tact/security review focused on ATH wallet/master money flow and authenticated async boundaries.
- Testnet/mainnet gas envelope measurement for burn, internal transfer, transfer-with-notify, notification ACK, and bounce recovery paths.
- Final storage-rent policy for ATH wallet pending/processed notification maps.
- Keep ATHWallet/ATHMaster frozen only while focused ATH, integration, artifact, full suite, and dependency audit remain green.
