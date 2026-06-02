# Milestone Summary: UsernameRegistry Pending Mint Prune M13

Implemented:

- `UsernameRegistry.PrunePendingUsernameMint`.
- `USERNAME_PENDING_MINT_STALE_TTL = 86_400 seconds`.
- Non-destructive stale `PendingUsernameMint` probe.
- No timeout-based `price_paid` recovery into `ath_refunds_due[owner_wallet]`.
- Late `UsernameItemDeployedAck` / `UsernameNFTItem.ResendDeployedAck` recovery remains valid after a stale probe.
- `UsernameNFTItem` ACK reserve raised to `0.003 TON` to keep sequential mint ACK paths green after registry state growth.

Not implemented:

- `Vault.PrunePendingPublish`.
- BuybackBurn / STON.fi route.
- Partial treasury/burn flush amounts.
- Any admin/rescue/fallback/governance path.

Verification:

```text
npm run build: OK
npm audit --omit=dev --audit-level=high: 0 vulnerabilities
npm test -- --reporter=verbose --testTimeout=30000: 19 files / 87 tests passed
```

New tests:

```text
USERNAME-REG-M13-01: stale PendingUsernameMint probe is non-destructive and does not create refund due
USERNAME-REG-M13-02: non-stale PendingUsernameMint cannot be pruned and remains pending
```

Regression validated:

```text
M10 paid mint tests pass after ACK reserve update
M12 treasury/burn due flush tests pass after ACK reserve update
```

Current code hashes:

```text
ATH_WALLET_CODE_HASH=7b4b51d5044ddd869d277dd037fd738a4f38696dc47c0960808e6891ca61a7d5
ATHMASTER_CODE_HASH=143c2255d9bf3ae853947e45560afeb6ad0a0648361ed2350c714c3e9d6d2328
CAPSULEHUB_CODE_HASH=add81654c2263f725fcc93cf3c9caf3229c8f164870511b90f967174a953db85
FEEACCUMULATOR_CODE_HASH=ed272b10bc841ce09da511dbe3c10cffa89659791480d0390d3e7bbde08af503
VAULT_CODE_HASH=7509a56f5a0d38d0d2e0e6d26bcee39457de6b3d7372130db6e817933ad6b927
USERNAME_NFT_ITEM_CODE_HASH=aeae8569040208929451ecbd632606c31de78e43425603997d88b85a403d8830
USERNAME_REGISTRY_CODE_HASH=77374ee9f1f832ed10f4ab428ff89c72e2784b200a88aad686ce225002574390
MOCK_VAULT_ATH_WALLET_CODE_HASH=9dff854edded531aca8ae603427aa978f14ee45517b9ec97d51760b197353cad
MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH=ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b
```
