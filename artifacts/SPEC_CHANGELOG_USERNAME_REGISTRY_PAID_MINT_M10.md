# Spec Changelog: UsernameRegistry Paid Mint M10

Accepted changes:

1. Pinned `AthTransferNotificationMintUsernameV1` exact payload with raw username bytes as remaining slice.
2. Pinned canonical username byte rules: 4..16 bytes, ASCII `a-z`, `0-9`, `_`, and `-` only, no unicode and no uppercase.
3. Pinned `name_hash = cell_hash(uint32 domain || raw username bytes)` with domain `0xC5CC7CD6`.
4. Pinned exact-price mint semantics; invalid authenticated notifications create refund-due accounting when storage endowment is supplied.
5. Pinned UsernameRegistry pending mint + deterministic UsernameNFTItem deployment + ACK finalization flow.
6. Refined `UsernameNFTItem.ResendDeployedAck` to use a fixed ACK forward reserve, not `SendRemainingValue`, to preserve item storage reserve on initial deploy.
7. Pinned `USERNAME_NFT_ITEM_DEPLOY_RESERVE = 0.020 TON`, `USERNAME_ITEM_ACK_FORWARD_RESERVE = 0.003 TON`, and `USERNAME_ATH_NOTIFICATION_ACK_VALUE = 0.001 TON`.
8. Pinned official ATH notification ACK behavior: accepted paid-mint notifications ACK the official ATH wallet only after pending mint or refund-due state is recorded.
9. Pinned underfunded `ResendDeployedAck` rejection so permissionless ACK resend cannot drain item storage reserve.
10. Pinned 50/50 ATH split after ACK: treasury gets floor half, burn due receives the remainder.

Explicitly not added:

```text
admin / owner override / pause / upgrade / governance / rescue / fallback
extra routes / adapters / migration hooks / compatibility paths
ignored-error send mode
BuybackBurn / STON.fi route
PrunePendingUsernameMint
ATH due flush implementations
```
