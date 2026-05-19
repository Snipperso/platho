# ATH Wallet/Master Execution Reserve Hardening - 2026-05-17

Status: implemented and locally verified.

## Summary

This pass covers `ATHWallet` and `ATHMaster`.

Fixed:

- owner burn requests now require caller-funded burn-notification execution reserve before wallet balance is debited;
- owner transfer requests now require caller-funded internal-transfer execution reserve before wallet balance is debited;
- owner transfer-with-notify requests now require notification value, ACK value, and recipient execution reserve before wallet balance is debited;
- recipient wallet internal transfer credits now require caller-funded execution reserve before recipient balance is credited;
- recipient wallet transfer-with-notify credits now require notification value, ACK value, and recipient execution reserve before pending notification state is recorded;
- ATHMaster burn notification finalization now requires caller-funded execution reserve before total_supply is reduced.

The issue found was real: before this pass, exact-funded or underfunded internal wallet/master messages could credit tokens or finalize burns while execution/forwarding costs were paid from the recipient wallet or ATHMaster TON reserve.

## Updated Constants

```text
ATH_INTERNAL_TRANSFER_EXEC_RESERVE=2_000_000 nanotons
ATH_BURN_NOTIFICATION_EXEC_RESERVE=2_000_000 nanotons
ATH_TRANSFER_NOTIFY_EXEC_RESERVE=2_000_000 nanotons
ATH_TRANSFER_NOTIFY_ACK_VALUE=1_000_000 nanotons
ATH_TRANSFER_NOTIFY_MIN_VALUE=30_000_000 nanotons
```

## Updated Tests

Added coverage:

```text
ATH-BND-01: recipient wallet rejects internal transfer without caller-funded execution reserve
ATH-BND-02: notify transfer requires notification value, ACK value, and recipient execution reserve
ATH-BND-03: ATHMaster rejects burn notification without caller-funded execution reserve
```

Each boundary test covers both min-1 rejection and exact-min acceptance.

## Verification

```text
npm run build: PASS
ATH boundary suite: 1 file passed, 3 tests passed
Impacted ATH/Vault/Username suite: 11 files passed, 42 tests passed
Expanded ATH/artifact suite: 17 files passed, 59 tests passed
M15 deployment manifest: PASS
M17 gas reserve report: PASS
M16 conformance: PASS
M18 artifact integrity: PASS
npm test: 46 files passed, 178 tests passed
npm audit --omit=dev: found 0 vulnerabilities
```

## Updated Hashes

```text
ATH_WALLET_CODE_HASH=a4ca0258ce36f72c4bab250c5ead87bc6db1b0ebe3832bad8c6961efaaedc730
ATHMASTER_CODE_HASH=33e4c62fa48e4f6d8b3b93a00e025485c18a6b81efcd055768508c215b88cfbf
ATH_WALLET_CODE_BOC_SHA256=6db86ce6664eb628745fefd830de2343ac8178e39c1c55fdc089f2996a6c2be7
IMPLEMENTED_SUBSET_MANIFEST_HASH=a1eecf7c96cc2bd7fdf88cf460d418b431c6d97649c05a0bd93a185c3935765f
```

Linked current hashes after rebuild:

```text
CAPSULEHUB_CODE_HASH=2522af15971a775b873a335c6637e961ab8a54d29446738f7c8390449c5c6cf6
FEEACCUMULATOR_CODE_HASH=afe97a1d7ea09f8912098a15fe42a88005dd9bf6a691e0dc2db55c1a820de9f1
VAULT_CODE_HASH=ec268816c42d788b55bd171a32b81d40073cb7f242c48138d521185508914353
USERNAME_NFT_ITEM_CODE_HASH=23f13b3c91120c089244c411b855c69a71a42bc0244740e1cc6c266f71c1f1ea
USERNAME_REGISTRY_CODE_HASH=6cc5a428588f43a706047ea2ae6595726596b17ee54c8703cdc9c8239a6d0742
```

## Residual Notes

This pass does not add admin, pause, upgrade, rescue, migration, ignored-error sends, compatibility paths, or non-standard burn semantics.

Production BuybackBurn and STON.fi route gates remain non-final blockers outside ATHWallet/ATHMaster.
