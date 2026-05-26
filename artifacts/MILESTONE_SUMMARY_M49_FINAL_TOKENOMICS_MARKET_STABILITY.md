# M49 - Final Tokenomics and Market Stability Reserve

Status: documented and manifest-pinned.

## Summary

M49 fixes the final ATH allocation:

- activity airdrop: `15%`;
- initial liquidity: `15%`;
- treasury / operations: `10%`;
- market stability reserve: `60%`;
- founder allocation: `0%`.

The market stability reserve is `60,000,000 ATH`, split into twenty `3,000,000 ATH` tranches at x2 through x21 from the initial official ATH/TON pool price.

## Manifest constants

Added manifest constants:

```text
ath_activity_airdrop_allocation_percent = 15
ath_initial_liquidity_allocation_percent = 15
ath_treasury_operations_allocation_percent = 10
ath_market_stability_reserve_allocation_percent = 60
ath_founder_allocation_percent = 0
ath_initial_liquidity_allocation_atomic = 15000000000000000
ath_treasury_operations_allocation_atomic = 10000000000000000
ath_market_stability_reserve_allocation_atomic = 60000000000000000
ath_market_stability_tranche_count = 20
ath_market_stability_tranche_percent = 3
ath_market_stability_tranche_atomic = 3000000000000000
ath_market_stability_start_multiplier = 2
ath_market_stability_end_multiplier = 21
```

## Contract scope

No existing smart contract behavior changes in M49.

The automated market-stability seller is implemented later in M50 as a separate immutable contract/release item. It must still be covered by release evidence before reserve ATH is operationally released.
