# M49 - Final Tokenomics and Market Stability Reserve

Status: documented and manifest-pinned.

## Summary

M49 fixes the final ATH allocation:

- activity airdrop: `30%`;
- initial liquidity: `15%`;
- treasury / operations: `10%`;
- market stability reserve: `45%`;
- founder allocation: `0%`.

The market stability reserve is `45,000,000 ATH`, split into fifteen `3,000,000 ATH` tranches at x2 through x16 from the initial official ATH/TON pool price.

## Manifest constants

Added manifest constants:

```text
ath_activity_airdrop_allocation_percent = 30
ath_initial_liquidity_allocation_percent = 15
ath_treasury_operations_allocation_percent = 10
ath_market_stability_reserve_allocation_percent = 45
ath_founder_allocation_percent = 0
ath_initial_liquidity_allocation_atomic = 15000000000000000
ath_treasury_operations_allocation_atomic = 10000000000000000
ath_market_stability_reserve_allocation_atomic = 45000000000000000
ath_market_stability_tranche_count = 15
ath_market_stability_tranche_percent = 3
ath_market_stability_tranche_atomic = 3000000000000000
ath_market_stability_start_multiplier = 2
ath_market_stability_end_multiplier = 16
```

## Contract scope

No existing smart contract behavior changes in M49.

The automated market-stability seller remains a separate future immutable contract/release item. It must be audited before reserve ATH is operationally released.

