# SPEC CHANGELOG - M49 Final Tokenomics and Market Stability Reserve

## Changed

- Final ATH allocation is fixed as `30%` activity airdrop, `15%` initial liquidity, `10%` treasury / operations, `45%` market stability reserve, and `0%` founder allocation.
- Prior founder/ecosystem/strategic split language in M20Y is superseded.
- The market stability reserve is explicit and milestone-gated instead of a vague ecosystem or partnership bucket.

## Added

- Manifest constants for the final allocation table.
- Manifest constants for the market stability tranche policy:
  - fifteen tranches;
  - `3%` supply per tranche;
  - `3,000,000 ATH` per tranche;
  - milestones from x2 through x16 from the initial official ATH/TON pool price.

## Unchanged

- Fixed ATH supply.
- No mint-after-deploy.
- Vault activity airdrop remains `30,000,000 ATH`.
- Activity reward remains `10 ATH` per successfully finalized paid publish.
- Initial pool launch target remains after approximately `15,000,000 ATH` has been distributed through Vault activity rewards.
- Message discounts and buyback split remain gated behind the 15% activity-distribution / pool-launch policy.

## Implemented later

M49 does not add a market-stability seller contract. M50 adds that separate immutable money state machine with tests and release evidence hooks.
