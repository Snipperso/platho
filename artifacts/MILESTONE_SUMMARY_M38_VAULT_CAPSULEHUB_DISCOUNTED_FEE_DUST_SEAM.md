# M38 Vault CapsuleHub Discounted Fee Dust Seam

Status: PASS.

This milestone adds a cross-contract regression for the Vault -> CapsuleHub ->
FeeAccumulator discounted-fee dust path.

## Covered Flow

- A Vault user receives `ATH_FULL_DISCOUNT_AMOUNT - 1` ATH through the official
  Vault ATH wallet notification path.
- A valid external private publish computes a discounted protocol fee of
  `1` nanotON.
- CapsuleHub accepts the Vault publish and accrues `1` nanotON.
- `FlushFees(1)` succeeds because it flushes the whole accrued bucket.
- A real FeeAccumulator receives and accounts the `1` nanotON principal.

## Verification

- Focused seam tests:
  `tests\vault-m6-publish.test.ts`,
  `tests\vault-prune-pending-publish.test.ts`,
  `tests\capsulehub-boundary-negative.test.ts`,
  `tests\capsulehub.test.ts`: 4 files / 25 tests PASS.
- `npm.cmd test`: 67 files / 284 tests PASS.

## Production Note

No contract bytecode changed in this milestone. The implemented-subset manifest
remains non-final until mainnet route, funding, address, and final-genesis
evidence blockers are closed.
