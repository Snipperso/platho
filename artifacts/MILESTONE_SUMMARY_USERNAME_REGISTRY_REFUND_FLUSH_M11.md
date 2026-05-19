# Milestone Summary: UsernameRegistry Refund Flush M11

Implemented:

- ATH Wallet owner-authorized transfer.
- Deterministic recipient ATH wallet deployment/credit.
- Transfer ACK from credited recipient ATH wallet.
- Transfer failure notification from source official ATH wallet on internal bounce/failure.
- UsernameRegistry `FlushAthRefundDue`.
- Pending refund flush bucket.
- ACK clearing and bounce/failure restoration.

Not implemented:

- `FlushTreasuryAthDue`.
- `FlushBurnAthDue`.
- `PrunePendingUsernameMint`.
- BuybackBurn / STON.fi route.
- Any admin/rescue/fallback/governance path.

Verification:

```text
npm run build: OK
npm audit --omit=dev --audit-level=high: 0 vulnerabilities
npm test -- --reporter=dot: 17 files / 81 tests passed
```

New tests:

```text
ATH-XFER-01
ATH-XFER-02
ATH-XFER-03
USERNAME-REG-M11-01
USERNAME-REG-M11-02
```

Current code hashes:

```text
ATH_WALLET_CODE_HASH=fd9bebe7f6fabc9a5ecd248f6ad1786ff471dd7f7cf35a312e3876a1fe61ec47
ATHMASTER_CODE_HASH=9df08d668edfa892aa1aa350c75a8c60a4c04d14a9d35fd387c4643c1fad39ab
CAPSULEHUB_CODE_HASH=add81654c2263f725fcc93cf3c9caf3229c8f164870511b90f967174a953db85
FEEACCUMULATOR_CODE_HASH=ed272b10bc841ce09da511dbe3c10cffa89659791480d0390d3e7bbde08af503
VAULT_CODE_HASH=7509a56f5a0d38d0d2e0e6d26bcee39457de6b3d7372130db6e817933ad6b927
USERNAME_NFT_ITEM_CODE_HASH=b0817c86add16431b453ac1b7f47e3bcfc057afb338fceb1a29a5dd87e081325
USERNAME_REGISTRY_CODE_HASH=136900f5b1e555a8a7f17bc5cde88bb84449a6c8a0d235629941991405038f91
MOCK_VAULT_ATH_WALLET_CODE_HASH=9dff854edded531aca8ae603427aa978f14ee45517b9ec97d51760b197353cad
```
