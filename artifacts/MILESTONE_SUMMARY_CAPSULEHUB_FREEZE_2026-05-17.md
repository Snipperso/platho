# CapsuleHub Freeze Summary - 2026-05-17

Status: FROZEN_LOCALLY_REVERIFIED_AFTER_ATH_EXEC_RESERVE_HARDENING

This freezes the current CapsuleHub implementation after the final local security and regression pass.
The freeze was revalidated after ATHWallet/ATHMaster execution-reserve hardening changed ATH-linked code, dependent StateInit, and deployment manifest hashes.

## Scope

Frozen scope:

- `contracts/CapsuleHub.tact`
- direct private and public publish paths
- Vault private and public publish paths
- CapsuleHub ACK emission to Vault
- protocol-fee accrual and fee flush bounce recovery
- entry/page counters and value boundary checks
- counter-only / anchor-only v1 semantics; no on-chain page-map retrieval interface is exposed
- shared Vault/CapsuleHub ACK forward reserve value used by Vault max-charge accounting

This is a local engineering freeze. It is not an independent third-party audit, formal proof, or final genesis release approval.

## Final Verification

Commands completed successfully on 2026-05-17:

```text
npm run build
npm test -- tests/capsulehub.test.ts tests/capsulehub-boundary-negative.test.ts tests/capsulehub-auth-negative-matrix.test.ts tests/capsulehub-state-invariants.test.ts tests/vault-external-session-gate.test.ts tests/vault-m6-publish.test.ts tests/vault-prune-pending-publish.test.ts
npx ts-node scripts/gas_reserve_m17.ts
npx ts-node scripts/conformance_m16.ts
npx ts-node scripts/artifact_integrity_m18.ts
npm test
npm audit --omit=dev
```

Results:

```text
CapsuleHub/Vault ACK focused suite: 7 files passed, 32 tests passed
M17 gas reserve report: PASS
M16 conformance: PASS
M18 artifact integrity: PASS
Full suite: 44 files passed, 172 tests passed
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
CAPSULEHUB_CODE_HASH=2522af15971a775b873a335c6637e961ab8a54d29446738f7c8390449c5c6cf6
VAULT_CODE_HASH=ec268816c42d788b55bd171a32b81d40073cb7f242c48138d521185508914353
ATH_WALLET_CODE_HASH=a4ca0258ce36f72c4bab250c5ead87bc6db1b0ebe3832bad8c6961efaaedc730
ATHMASTER_CODE_HASH=33e4c62fa48e4f6d8b3b93a00e025485c18a6b81efcd055768508c215b88cfbf
USERNAME_NFT_ITEM_CODE_HASH=23f13b3c91120c089244c411b855c69a71a42bc0244740e1cc6c266f71c1f1ea
USERNAME_REGISTRY_CODE_HASH=6cc5a428588f43a706047ea2ae6595726596b17ee54c8703cdc9c8239a6d0742
IMPLEMENTED_SUBSET_MANIFEST_HASH=a1eecf7c96cc2bd7fdf88cf460d418b431c6d97649c05a0bd93a185c3935765f
```

Pinned value:

```text
CAPSULEHUB_ACK_FORWARD_RESERVE=0.030 TON=30_000_000 nanotons
```

Manifest status:

```text
IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS
```

## Local Security Notes

No real CapsuleHub bug or vulnerability remains known after this pass.

The freeze includes local coverage for:

- direct private/public publish validation and min-1/exact-min value boundaries;
- Vault private/public publish validation, authorized Vault sender checks, and min-1/exact-min ACK boundaries;
- protocol-fee backing retention for accepted Vault publishes;
- ACK reserve sufficiency for Vault pending publish clearance in covered success flows;
- forged Vault publish and forged/invalid publish rejection;
- public author spoof rejection;
- deterministic state-machine invariant walks across direct publish, Vault publish, invalid attempts, and fee flush bounce recovery;
- full suite regression and production dependency audit.

## Residual Non-Code Gates

Before final genesis/mainnet release, these remain outside the CapsuleHub local freeze:

- independent Tact/security review;
- testnet/mainnet gas envelope evidence for direct publish, Vault publish ACK, and fee flush bounce paths;
- testnet/mainnet storage-rent/economic measurement for CapsuleHub counter/page-count growth;
- final deployment manifest replacement of non-final global blockers;
- BuybackBurn and STON.fi production route gates where applicable.

## Freeze Rule

Any future change to frozen CapsuleHub scope, `CAPSULEHUB_ACK_FORWARD_RESERVE`, or Vault max-charge accounting must reopen this freeze and repeat:

```text
npm run build
CapsuleHub/Vault ACK focused suite
M17 gas reserve report
M16 conformance
M18 artifact integrity
npm test
npm audit --omit=dev
```
