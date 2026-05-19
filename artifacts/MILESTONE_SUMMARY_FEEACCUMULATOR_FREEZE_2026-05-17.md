# FeeAccumulator Freeze Summary - 2026-05-17

Status: FROZEN_LOCALLY_REVERIFIED_AFTER_ATH_EXEC_RESERVE_HARDENING

This freezes the current FeeAccumulator implementation after the final local security and regression pass.
The freeze was revalidated after ATHWallet/ATHMaster execution-reserve hardening changed ATH-linked code, dependent StateInit, and deployment manifest hashes.

## Scope

Frozen scope:

- `contracts/FeeAccumulator.tact`
- permissionless protocol-fee principal deposits
- caller-funded deposit/split/flush execution reserves
- accumulated protocol-fee split into treasury and buyback due buckets
- terminal treasury due flush
- M19H 51.05 TON BuybackBurn funding envelope enforcement
- buyback due flush bounce recovery
- duplicate FeeAccumulator code-hash artifacts

This is a local engineering freeze. It is not an independent third-party audit, formal proof, or final genesis release approval.

## Final Verification

Commands completed successfully on 2026-05-17:

```text
npm run build
npm test -- tests/fee-accumulator.test.ts tests/fee-accumulator-backing-negative.test.ts tests/m19h-buybackburn-funding-envelope.test.ts tests/capsulehub.test.ts
node scripts/hash_codes.js
npx ts-node scripts/deployment_manifest_m15.ts
npx ts-node scripts/gas_reserve_m17.ts
npx ts-node scripts/conformance_m16.ts
npx ts-node scripts/artifact_integrity_m18.ts
npm test
npm audit --omit=dev
```

Results:

```text
FeeAccumulator focused suite: 4 files passed, 29 tests passed
M17 gas reserve report: PASS
M16 conformance: PASS
M18 artifact integrity: PASS
Full suite: 45 files passed, 175 tests passed
npm audit --omit=dev: found 0 vulnerabilities
```

Post-ATH execution-reserve revalidation on 2026-05-17:

```text
Expanded ATH/artifact suite: 17 files passed, 59 tests passed
Full suite: 46 files passed, 178 tests passed
npm audit --omit=dev: found 0 vulnerabilities
```

## Frozen Hashes

```text
FEEACCUMULATOR_CODE_HASH=afe97a1d7ea09f8912098a15fe42a88005dd9bf6a691e0dc2db55c1a820de9f1
FEEACCUMULATOR_STATE_INIT_HASH=889d5eb9cc138396145486e8ac52ae4f317edf71e9048f8e2fc2448a9106b8ff
CAPSULEHUB_CODE_HASH=2522af15971a775b873a335c6637e961ab8a54d29446738f7c8390449c5c6cf6
VAULT_CODE_HASH=ec268816c42d788b55bd171a32b81d40073cb7f242c48138d521185508914353
USERNAME_NFT_ITEM_CODE_HASH=23f13b3c91120c089244c411b855c69a71a42bc0244740e1cc6c266f71c1f1ea
USERNAME_REGISTRY_CODE_HASH=6cc5a428588f43a706047ea2ae6595726596b17ee54c8703cdc9c8239a6d0742
ATH_WALLET_CODE_HASH=a4ca0258ce36f72c4bab250c5ead87bc6db1b0ebe3832bad8c6961efaaedc730
ATHMASTER_CODE_HASH=33e4c62fa48e4f6d8b3b93a00e025485c18a6b81efcd055768508c215b88cfbf
IMPLEMENTED_SUBSET_MANIFEST_HASH=a1eecf7c96cc2bd7fdf88cf460d418b431c6d97649c05a0bd93a185c3935765f
```

Pinned values:

```text
FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE=0.002 TON=2_000_000 nanotons
FEEACCUMULATOR_SPLIT_EXEC_RESERVE=0.002 TON=2_000_000 nanotons
FEEACCUMULATOR_FLUSH_EXEC_RESERVE=0.003 TON=3_000_000 nanotons
BUYBACK_FUNDING_ENVELOPE_NANOTONS=51.05 TON=51_050_000_000 nanotons
```

Manifest status:

```text
IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS
```

## Local Security Notes

No real FeeAccumulator bug or vulnerability remains known after this pass.

The freeze includes local coverage for:

- permissionless deposits crediting only declared TON principal;
- underfunded deposit rejection before principal accounting;
- split preserving exact total principal and dust-to-buyback behavior;
- underfunded split rejection before due-bucket mutation;
- treasury flush reserve boundary and immutable terminal receiver routing;
- buyback flush reserve boundary before envelope send;
- raw 50 TON buyback offer rejection as an incomplete funding envelope;
- bounce recovery restoring the exact 51.05 TON buyback envelope;
- CapsuleHub fee flush integration;
- full suite regression and production dependency audit.

## Residual Non-Code Gates

Before final genesis/mainnet release, these remain outside the FeeAccumulator local freeze:

- independent Tact/security review;
- testnet/mainnet gas envelope evidence for deposit, split, treasury flush, and buyback bounce paths;
- final BuybackBurn implementation/deployment with a real non-placeholder address;
- STON.fi production route gates and final route values;
- final deployment manifest replacement of non-final global blockers.

## Freeze Rule

Any future change to frozen FeeAccumulator scope, its reserve constants, the M19H buyback envelope value, or FeeAccumulator deployment parameters must reopen this freeze and repeat:

```text
npm run build
FeeAccumulator focused suite
M17 gas reserve report
M16 conformance
M18 artifact integrity
npm test
npm audit --omit=dev
```
