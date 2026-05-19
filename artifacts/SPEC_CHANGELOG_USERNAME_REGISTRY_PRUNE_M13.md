# Spec Changelog: UsernameRegistry Pending Mint Prune M13

Accepted changes:

1. Pin `USERNAME_PENDING_MINT_STALE_TTL = 86_400 seconds`.
2. Implement `UsernameRegistry.PrunePendingUsernameMint = 0x3796DF2D`.
3. Define prune as permissionless stale pending cleanup that moves `pending.price_paid` into `ath_refunds_due[pending.owner_wallet]`.
4. Explicitly reject late `UsernameItemDeployedAck` after pending prune.
5. Raise `USERNAME_ITEM_ACK_FORWARD_RESERVE` to `0.003 TON` after M13 regression gas tests.

No changes introduced:

```text
admin
owner override
pause
upgrade
governance
rescue
fallback
ignored-error money send
additional routes/adapters/migration hooks/compatibility paths
```

Still not accepted / still blocked:

```text
Vault.PrunePendingPublish
BuybackBurn
STON.fi route
```
