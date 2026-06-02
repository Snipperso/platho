# M40 FeeAccumulator BuybackBurn Flush Preflight

Status: PASS.

This milestone adds an off-chain operational guard for the FeeAccumulator ->
BuybackBurn reserve flush path.

## Covered Flow

- `FlushBuybackDue.amount` must be exactly the `51.05 TON` funding envelope.
- `FeeAccumulator.buyback_due_ton` must cover one full envelope.
- `FeeAccumulator.buyback_burn_address` must match the intended BuybackBurn.
- BuybackBurn must be sealed.
- BuybackBurn must have `route_frozen == true`.
- M20F final mainnet route-freeze evidence must be accepted; `route_frozen`
  alone is not enough for a production reserve flush.
- BuybackBurn must be bound to the source FeeAccumulator address.

## Verification

- Focused seam/preflight tests:
  `tests\buyback-flush-preflight.test.ts`,
  `tests\enable-buyback-split-preflight.test.ts`,
  `tests\m20f-mainnet-route-freeze-preflight.test.ts`,
  `tests\m20u-buybackburn-implementation-readiness.test.ts`,
  `tests\buybackburn-production.test.ts`,
  `tests\buybackburn-auth-negative-matrix.test.ts`,
  `tests\fee-accumulator.test.ts`,
  `tests\fee-accumulator-backing-negative.test.ts`,
  `tests\m19h-buybackburn-funding-envelope.test.ts`,
  `tests\m29-buybackburn-abi-freeze.test.ts`: 10 files / 83 tests PASS.
- `npm.cmd test`: 68 files / 291 tests PASS.

## Production Note

No contract bytecode changed. The Low premature-flush case is handled as an
operator/runbook guard rather than a contract expansion. Production remains
blocked by the existing mainnet route, funding, address, and final-genesis
evidence gates.
