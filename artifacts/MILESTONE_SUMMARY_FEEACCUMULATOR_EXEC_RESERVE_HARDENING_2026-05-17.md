# FeeAccumulator Execution Reserve Hardening - 2026-05-17

Status: implemented and locally verified.

## Summary

This pass covers `FeeAccumulator`.

Fixed:

- `DepositProtocolFee(amount)` now requires caller-funded execution reserve in addition to the declared protocol principal;
- `SplitAccumulated` now requires caller-funded execution reserve before moving principal into due buckets;
- `FlushTreasuryDue` now requires caller-funded flush reserve before debiting `treasury_due_ton`;
- `FlushBuybackDue` now requires caller-funded flush reserve before sending the 51.05 TON BuybackBurn funding envelope;
- spec/open values now pin `FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE = 0.002 TON` alongside the existing split/flush reserves.

The issue found was real: before this pass, exact-funded or underfunded calls could make FeeAccumulator spend its own balance/backing on execution, forwarding, or bounce costs while due buckets still recorded full principal.

## Updated Constants

```text
FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE=2_000_000 nanotons
FEEACCUMULATOR_SPLIT_EXEC_RESERVE=2_000_000 nanotons
FEEACCUMULATOR_FLUSH_EXEC_RESERVE=3_000_000 nanotons
BUYBACK_FUNDING_ENVELOPE_NANOTONS=51_050_000_000 nanotons
```

## Updated Tests

Added coverage:

```text
FEE-BACKING-01: deposits require separate execution reserve and preserve principal backing
FEE-BACKING-02: split and treasury flush require caller-funded execution reserve
FEE-BACKING-03: buyback flush requires caller-funded reserve before sending the envelope
```

## Verification

```text
npm run build: PASS
FeeAccumulator focused suite: 3 files passed, 15 tests passed
Expanded FeeAccumulator/CapsuleHub/artifact suite: 8 files passed, 39 tests passed
M17 gas reserve report: PASS
M16 conformance: PASS
M18 artifact integrity: PASS
npm test: 45 files passed, 175 tests passed
npm audit --omit=dev: found 0 vulnerabilities
```

## Current Hashes After ATH Revalidation

```text
FEEACCUMULATOR_CODE_HASH=afe97a1d7ea09f8912098a15fe42a88005dd9bf6a691e0dc2db55c1a820de9f1
FEEACCUMULATOR_STATE_INIT_HASH=889d5eb9cc138396145486e8ac52ae4f317edf71e9048f8e2fc2448a9106b8ff
IMPLEMENTED_SUBSET_MANIFEST_HASH=a1eecf7c96cc2bd7fdf88cf460d418b431c6d97649c05a0bd93a185c3935765f
```

Current linked contract code hashes:

```text
CAPSULEHUB_CODE_HASH=2522af15971a775b873a335c6637e961ab8a54d29446738f7c8390449c5c6cf6
VAULT_CODE_HASH=ec268816c42d788b55bd171a32b81d40073cb7f242c48138d521185508914353
USERNAME_NFT_ITEM_CODE_HASH=23f13b3c91120c089244c411b855c69a71a42bc0244740e1cc6c266f71c1f1ea
USERNAME_REGISTRY_CODE_HASH=6cc5a428588f43a706047ea2ae6595726596b17ee54c8703cdc9c8239a6d0742
ATH_WALLET_CODE_HASH=a4ca0258ce36f72c4bab250c5ead87bc6db1b0ebe3832bad8c6961efaaedc730
ATHMASTER_CODE_HASH=33e4c62fa48e4f6d8b3b93a00e025485c18a6b81efcd055768508c215b88cfbf
```

## Residual Notes

This pass does not add admin, pause, upgrade, rescue, migration, ignored-error sends, or compatibility paths.

Production BuybackBurn and STON.fi route gates remain non-final blockers outside FeeAccumulator.
