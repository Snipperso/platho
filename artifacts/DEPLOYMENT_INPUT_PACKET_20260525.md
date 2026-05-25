# Platho Deployment Input Packet - 2026-05-25

Internal working packet for testnet rehearsal / mainnet genesis preparation. This file does not contain secrets, mnemonics, deployer keys, RPC tokens, or vanity candidate material.

## Current Repository Point

- Branch: `main`
- Before using this packet, confirm the current release commit with `git rev-parse HEAD`.
- Baseline before ATH metadata pin: `28179781902e8ca81daebfef4fa823342694ae0a`
- Baseline CI: `CI #93` passed for that baseline
- Latest external audit archive currently present:
  - `artifacts/platho_external_audit_slim_20260525-181000_c81192e.zip`
  - SHA256: `02fd28101d14d17c348b0ad1ae2c894857542061d28598dff277c8fdbd58bdd7`

Note: the latest audit archive is tied to `c81192e`. Commits after that are docs, artifact hygiene, and deterministic deployment-input metadata only, but a strict release freeze should either archive the current HEAD or record the non-contract delta explicitly.

## Local Gate Snapshot

Already green on this line:

- `npm.cmd test`
- `npm.cmd run build`
- `scripts/artifact_integrity_m18.ts`
- GitHub CI push run

Current `preprod:check` is intentionally blocked:

- `PWA_MODE_NOT_PRODUCTION`
- `PWA_NETWORK_NOT_MAINNET`
- `CRYPTO_PROD_REMAINING_WORK`
- `PROD_CHECKLIST_OPEN_BLOCKERS`
- `TESTNET_ENV_PRESENT`

This is expected before final mainnet configuration. Do not bypass it for public production deploy.

## Address / Manifest Derivation Status

Ready:

- `npm.cmd run m20f:address-preflight`
- Report: `artifacts/m20f_mainnet_address_unlock_preflight.json`
- Status: `READY_FOR_MAINNET_ADDRESS_DERIVATION`

Blocked until final inputs:

- `npm.cmd run mainnet:ath-master:derive`
- Report: `artifacts/mainnet_ath_master_derivation.json`
- Status: `BLOCKED_MISSING_FINAL_MAINNET_ATH_MASTER_INPUTS`

- `npm.cmd run m20f:derive-addresses`
- Report: `artifacts/m20f_mainnet_address_derivation.json`
- Status: `BLOCKED_MISSING_FINAL_MAINNET_ADDRESS_INPUTS`

## First Inputs To Fill

ATH metadata/content is now pinned by:

```text
artifacts/ath_metadata_content.json
```

Regenerate it with:

```powershell
npm.cmd run mainnet:ath-metadata
```

This also creates a draft `artifacts/mainnet_ath_master_derivation_input.json`.

Before deriving ATHMaster, finalize `artifacts/mainnet_ath_master_derivation_input.json` from:

```text
artifacts/mainnet_ath_master_derivation_input_template.json
```

Required fields:

- `status`: `FINAL_MAINNET_ATH_MASTER_INPUT`
- `treasuryOwnerAddress`: final mainnet ATH treasury owner address
- `contentBocBase64`: final ATH metadata/content cell BOC base64, currently pinned from `artifacts/ath_metadata_content.json`
- `proofRefs.treasuryOwnerProof`
- `proofRefs.contentCellProof`, currently pinned to `artifacts/ath_metadata_content.json#contentHashHex=3f02381090c27e0cd36e7f6098979dcbecd6ee0ea2154ddb2cea1412a9caf8ea`
- `proofRefs.athMasterBuildArtifact`

Then run:

```powershell
npm.cmd run mainnet:ath-master:derive
```

Expected output when complete:

- final ATHMaster address
- final treasury owner ATHWallet address
- ATHMaster StateInit hash
- ATHWallet code hash
- treasury supply deployment parameters

## Second Inputs To Fill

After ATHMaster derivation, create `artifacts/m20f_mainnet_address_derivation_input.json` from:

```text
artifacts/m20f_mainnet_address_derivation_input_template.json
```

Required fields:

- `status`: `FINAL_MAINNET_ADDRESS_INPUT`
- `genesisControllerAddress`: final one-shot genesis controller address
- `athMasterAddress`: derived final mainnet ATHMaster address
- `proofRefs.finalGenesisControllerProof`
- `proofRefs.athDeploymentManifest`
- `proofRefs.buybackBurnBuildArtifact`

Then run:

```powershell
npm.cmd run m20f:derive-addresses
```

Expected output when complete:

- final BuybackBurn address
- final BuybackBurn official ATHWallet address
- BuybackBurn StateInit hash
- next M20F route-freeze inputs

## Stop Conditions

Stop immediately if any of these happens:

- any final input uses a testnet address, fixture address, placeholder, or unproven chat/screenshot value;
- `mainnet:ath-master:derive` or `m20f:derive-addresses` returns a blocker;
- generated code hashes differ from current build artifacts without a full rebuild and artifact integrity pass;
- any secret, mnemonic, seed phrase, vanity candidate, or local `.env` is about to enter git or an external audit archive;
- Larisa returns an open C/H/M on the fresh archive.

## Next Concrete Step

Fill `artifacts/mainnet_ath_master_derivation_input.json` with final treasury owner and final proof refs, then switch its status to `FINAL_MAINNET_ATH_MASTER_INPUT`. Until that file is final and the derivation report is clean, there is no honest mainnet deployment step to execute.
