# Milestone Summary: UsernameRegistry Treasury/Burn Due Flush M12

Implemented:

- ATH burn finalization ACK from ATH Master.
- ATH burn failure notification from ATH Wallet on master notification bounce/failure.
- UsernameRegistry immutable treasury ATH receiver.
- `FlushTreasuryAthDue`.
- `FlushBurnAthDue`.
- Pending treasury flush bucket.
- Pending burn flush bucket.
- Treasury transfer ACK clearing.
- Treasury transfer bounce/failure restoration.
- Burn finalization ACK clearing.
- Burn failure/bounce restoration.

Not implemented:

- `PrunePendingUsernameMint`.
- BuybackBurn / STON.fi route.
- Partial treasury/burn flush amounts.
- Any admin/rescue/fallback/governance path.

Verification:

```text
npm run build: OK
npm audit --omit=dev --audit-level=high: 0 vulnerabilities
npm test -- --reporter=verbose: 18 files / 85 tests passed
```

New tests:

```text
USERNAME-REG-M12-01: FlushTreasuryAthDue transfers treasury due to immutable treasury ATH receiver and clears pending on ACK
USERNAME-REG-M12-02: FlushBurnAthDue burns through official ATH wallet, authenticated master ACK clears pending, and total_supply decreases exactly
USERNAME-REG-M12-03: treasury transfer failure restores treasury_due_ath and clears pending
USERNAME-REG-M12-04: burn notification failure restores burn_due_ath, clears pending, and restores official wallet balance
```

Current code hashes:

```text
ATH_WALLET_CODE_HASH=7b4b51d5044ddd869d277dd037fd738a4f38696dc47c0960808e6891ca61a7d5
ATHMASTER_CODE_HASH=143c2255d9bf3ae853947e45560afeb6ad0a0648361ed2350c714c3e9d6d2328
CAPSULEHUB_CODE_HASH=add81654c2263f725fcc93cf3c9caf3229c8f164870511b90f967174a953db85
FEEACCUMULATOR_CODE_HASH=ed272b10bc841ce09da511dbe3c10cffa89659791480d0390d3e7bbde08af503
VAULT_CODE_HASH=7509a56f5a0d38d0d2e0e6d26bcee39457de6b3d7372130db6e817933ad6b927
USERNAME_NFT_ITEM_CODE_HASH=b0817c86add16431b453ac1b7f47e3bcfc057afb338fceb1a29a5dd87e081325
USERNAME_REGISTRY_CODE_HASH=bf2b6bee43aeecd3bbe3ed3b8eec6108be4438cd61a90b51434d0b6018c22176
MOCK_VAULT_ATH_WALLET_CODE_HASH=9dff854edded531aca8ae603427aa978f14ee45517b9ec97d51760b197353cad
```
