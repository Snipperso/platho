# M20F Mainnet Address Unlock Preflight

Status: READY_FOR_MAINNET_ADDRESS_DERIVATION

- address_unlock_ready: true
- production_buyback_burn_unlocked: false
- production BuybackBurn source exists: true
- production BuybackBurn Tact project exists: true
- production BuybackBurn code BOC exists: true
- harness selected as production: false

## Blockers

- none

## Required Next Actions

- Derive the final mainnet BuybackBurn StateInit address from the final genesis hash and final ATH master address.
- Derive the official BuybackBurn ATH wallet from that BuybackBurn address and ATH master.
- Feed the final mainnet ATH/BuybackBurn addresses into the M20F live STON.fi collector with real proof refs.
- Final genesis may seal BuybackBurn with route_frozen=false; keep production_buyback_burn_unlocked false until post-pool M20F route freeze and production review gates pass.

## Address Derivation Notes

- FeeAccumulator already stores an immutable buyback_burn_address, so the final BuybackBurn StateInit address must exist before FeeAccumulator production deployment.
- The M20TBuybackBurnHarness address must never be reused as the production BuybackBurn address.
- The official BuybackBurn ATH wallet is derived after the BuybackBurn address is known; it must not be hardcoded from testnet evidence.
- M20F route evidence remains separate from production unlock and must stay false until final mainnet evidence passes.
