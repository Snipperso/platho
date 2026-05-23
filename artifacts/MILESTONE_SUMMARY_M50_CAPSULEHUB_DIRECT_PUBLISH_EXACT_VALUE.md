# M50 CapsuleHub Direct Publish Exact Value

Date: 2026-05-21

Status: local hardening pass after CapsuleHub session 6 audit finding `CAPHUB-01`. This is not a mainnet production approval.

Superseded note 2026-05-22: final v1 removed the separate page-storage reserve entirely. Page counters are metadata-only, and direct publish exactness now applies to a fixed same-profile value rather than a first-page/no-page split.

Superseded note 2026-05-22: final v1 dynamic PWA pricing re-opened `context.value >= required` for direct publishes so the official client can attach a rounded network-fee surcharge above the base value. Manual broad overpayment is no longer a contract-level concern; the current pricing source of truth is `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`.

## Finding

Direct CapsuleHub publish paths accepted any value greater than or equal to the computed required amount. Before final v1 removed the page-storage charge, this could happen by attaching a boundary-page value after another entry had already created the page. The publish succeeded and the excess TON remained as unaccounted CapsuleHub balance.

Vault-mediated publish was not changed in this pass. That path intentionally accepts a caller envelope and returns ACK/excess value to Vault.

## Code Change

`contracts/CapsuleHub.tact` now requires exact value for direct publishes:

```text
PublishPrivateDirect: context.value == required
PublishPublicDirect:  context.value == required
```

The change is intentionally narrow: direct users no longer silently donate overpayment, while Vault publish still keeps its ACK/excess accounting model.

## Regression Coverage

`tests/capsulehub-boundary-negative.test.ts` now verifies:

- private direct publish rejects `required - 1`;
- private direct publish rejects `required + 1`;
- public direct overpay is rejected;
- exact public direct value still succeeds.

`tests/capsulehub.test.ts` uses exact direct publish values instead of broad `0.1 TON` overpayment in the happy paths.

`scripts/gas_reserve_m17.ts` was updated to use exact direct publish values for its CapsuleHub scenario.

## Updated Evidence

- CapsuleHub code hash: `5e91fea9b5a796d53f6cb7cd5d26d7aced33154eafa4e73d996d59625e74ed84`
- Implemented-subset manifest hash: `42438ea2b44a7fc618aad511802ee88fefeada99bd66d57b8f505c73f9cb3ec7`

Regenerated artifacts:

- `build/CapsuleHub/*`
- `artifacts/CAPSULEHUB_CODE_HASH.txt`
- `artifacts/CURRENT_CODE_HASHES.txt`
- `artifacts/deployment_manifest_implemented_subset_m15.json`
- `artifacts/DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH.txt`
- `artifacts/m16_conformance_report.json`
- `artifacts/m17_gas_reserve_report.json`
- `artifacts/m18_artifact_integrity_report.json`
- `artifacts/m18_artifact_lock.json`

## Verification

- `npm.cmd run build`: PASS.
- Focused CapsuleHub / Vault-publish / deployment-binding suite: PASS, 10 files / 48 tests.
- `node scripts/hash_codes.js`: PASS.
- `scripts/deployment_manifest_m15.ts`: PASS.
- `scripts/gas_reserve_m17.ts`: PASS, 6 scenarios.
- `scripts/conformance_m16.ts`: PASS.
- `scripts/artifact_integrity_m18.ts`: PASS.
- `npm.cmd test`: PASS, 70 files / 307 tests.

## Remaining Production Gates

This pass closes only the direct publish overpayment footgun. It does not approve mainnet production or remove final blockers such as M20F mainnet STON.fi route freeze evidence, final genesis manifest replacement, ATH treasury supply deployment proof, Vault activity airdrop funding proof, PWA/preprod gates, or future seam-audit findings.
