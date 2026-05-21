# M51 UsernameRegistry Basechain Runtime And Mint Excess

Date: 2026-05-21

Status: local hardening pass after UsernameRegistry session 7 findings
`UREG-01` and `UREG-02`. This is not a mainnet production approval.

## Findings

`UREG-01`: fixed basechain-sized UsernameRegistry envelopes could start mint,
refund, or treasury flush flows for non-basechain recipients and leave the flow
stuck or lossy.

`UREG-02`: successful paid mint retained meaningful excess notification TON even
though rejected mint paths already returned excess.

## Code Change

`contracts/UsernameRegistry.tact` now treats the supported v1 runtime profile as
basechain-only for money-moving username paths:

- `SealGenesis` rejects a non-basechain `treasury_ath_receiver_address`.
- paid mint rejects non-basechain `owner_wallet` before pending mint/refund state
  is created.
- `FlushTreasuryAthDue` and `FlushAthRefundDue` require basechain recipients.

Successful paid mint now returns meaningful excess notification TON to
`owner_wallet`. Dust below `100_000` nanotons may remain as registry reserve so a
tiny refund action cannot cancel an otherwise valid mint.

The deterministic item-address derivation vectors still include non-basechain
owners as address math evidence. Runtime paid mint/refund/treasury flows are
basechain-only until a separate masterchain envelope and recovery profile is
explicitly accepted.

## Regression Coverage

`tests/username-registry-paid-mint.test.ts` now verifies:

- successful mint returns meaningful notify excess to the owner wallet;
- masterchain owner mint is rejected before name, pending, or refund state.

`tests/username-registry-boundary-negative.test.ts` now verifies:

- a registry configured with a masterchain treasury receiver cannot be sealed.

## Updated Evidence

- UsernameRegistry code hash:
  `637959f5a8467210a21e9ebb49977c5008bb7bf8f756cf2cce41c11e0f2e1ed1`
- Implemented-subset manifest hash:
  `d3a3c28b14cb73b3dc5f53cdcc2d02850bfefe693b6c8c23daf57ccc59247a60`

Regenerated artifacts:

- `build/UsernameRegistry/*`
- `artifacts/USERNAME_REGISTRY_CODE_HASH.txt`
- `artifacts/CURRENT_CODE_HASHES.txt`
- `artifacts/username_registry_foundation_vectors.json`
- `artifacts/username_registry_mint_vectors.json`
- `artifacts/deployment_manifest_implemented_subset_m15.json`
- `artifacts/DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH.txt`
- `artifacts/m16_conformance_report.json`
- `artifacts/m18_artifact_integrity_report.json`
- `artifacts/m18_artifact_lock.json`

## Verification

- `npm.cmd run build`: PASS.
- Focused UsernameRegistry/NFT suite: PASS, 10 files / 43 tests.
- `node scripts/hash_codes.js`: PASS.
- `scripts/deployment_manifest_m15.ts`: PASS.
- `scripts/conformance_m16.ts`: PASS.
- `scripts/artifact_integrity_m18.ts`: PASS.
- `npm.cmd test`: PASS, 71 files / 314 tests.

## Remaining Production Gates

This pass closes only the local UsernameRegistry workchain/envelope footgun and
successful-mint excess retention. It does not approve mainnet production or
remove final blockers such as M20F mainnet STON.fi route freeze evidence, final
genesis manifest replacement, ATH treasury supply deployment proof, Vault
activity airdrop funding proof, PWA/preprod gates, or future seam-audit
findings.
