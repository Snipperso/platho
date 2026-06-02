# Spec Changelog: UsernameRegistry Pending Mint Prune M13

Accepted changes:

1. Pin `USERNAME_PENDING_MINT_STALE_TTL = 86_400 seconds`.
2. Implement `UsernameRegistry.PrunePendingUsernameMint = 0x3796DF2D`.
3. Define prune as a permissionless stale pending probe: it validates that a pending mint is stale, then throws without deleting pending state or creating refund due.
4. Keep late `UsernameItemDeployedAck` / `UsernameNFTItem.ResendDeployedAck` as the recovery path after a stale probe.
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
