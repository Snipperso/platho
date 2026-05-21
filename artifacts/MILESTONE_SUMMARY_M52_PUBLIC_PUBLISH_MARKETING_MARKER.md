# M52 Public Publish Marketing Marker

Date: 2026-05-21

Status: local ABI/product pass. This is not a mainnet production approval.

## Decision

Public CapsuleHub publish messages carry a fixed on-chain marker:

```text
sent via Platho.App
```

The marker is public-channel-only. It is written into the transaction message body as a byte-aligned `uint152` value:

```text
0x73656e742076696120506c6174686f2e417070
```

The official messenger UI must not render this marker as part of the public post text. Private publish messages do not carry the marker.

## Code Change

`contracts/CapsuleHub.tact` now requires the marker in:

```text
PublishPublicDirect
PublishPublicFromVault
```

`contracts/Vault.tact` automatically adds the marker when sending public session publishes to CapsuleHub.

`contracts/MockVaultAckSink.tact` and public publish tests were updated to match the ABI.

For byte-level auditability:

- `PublishPublicDirect` stores `marketing_note` immediately after the opcode.
- `PublishPublicFromVault` stores `marketing_note` immediately after `publish_id`, before `author_wallet`.

That keeps the ASCII marker visible as contiguous bytes in the serialized public publish body.

## Regression Coverage

`tests/capsulehub-boundary-negative.test.ts` now verifies:

- public direct publish rejects a missing/wrong marker;
- Vault public publish rejects a missing/wrong marker;
- serialized `PublishPublicDirect` and `PublishPublicFromVault` bodies contain the clear ASCII bytes for `sent via Platho.App`.

Existing CapsuleHub/Vault publish suites were updated to include the marker in public paths.

## Updated Evidence

- CapsuleHub code hash: `d085e00659e51525f54cfdb023379646ee55f81001598cc541d22a91b9b0aa34`
- Vault code hash: `2c3d46775d2509ff5c3c7b8f839589bc26a6e69e9a453d0e6248ca6cf3f723b3`
- Implemented-subset manifest hash: `8ac43f43f884f48ae640efc78303b7bbbd9367aa447fb8e763887d4fbde3b730`

Regenerated artifacts:

- `build/CapsuleHub/*`
- `build/Vault/*`
- `build/MockVaultAckSink/*`
- `artifacts/CAPSULEHUB_CODE_HASH.txt`
- `artifacts/VAULT_CODE_HASH.txt`
- `artifacts/CURRENT_CODE_HASHES.txt`
- `artifacts/deployment_manifest_implemented_subset_m15.json`
- `artifacts/DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH.txt`
- `artifacts/m16_conformance_report.json`
- `artifacts/m17_gas_reserve_report.json`
- `artifacts/m18_artifact_integrity_report.json`
- `artifacts/m18_artifact_lock.json`

## Verification

- `npm.cmd run build`: PASS.
- Focused CapsuleHub/Vault publish suite: PASS, 7 files / 40 tests.
- `node scripts/hash_codes.js`: PASS.
- `scripts/deployment_manifest_m15.ts`: PASS.
- `scripts/gas_reserve_m17.ts`: PASS, 6 scenarios.
- `scripts/conformance_m16.ts`: PASS.
- `scripts/artifact_integrity_m18.ts`: PASS.
- `npm.cmd test`: PASS, 71 files / 316 tests.

## Remaining Production Gates

This pass only adds the public publish marker. It does not approve mainnet production or remove final blockers such as M20F mainnet STON.fi route freeze evidence, final genesis manifest replacement, ATH treasury supply deployment proof, Vault activity airdrop funding proof, PWA/preprod gates, or future audit findings.
