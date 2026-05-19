# Platho v1 Open Values Profile v0.17 — Gas / Reserve Sanity

**Status:** accepted implemented-subset sanity profile  
**Scope:** sandbox gas/reserve regression guard for already implemented Platho v1 subset.  
**Not final:** this is **not** a final mainnet gas freeze and does not unblock BuybackBurn.

## Rule

M17 does not change protocol behavior, opcodes, storage layouts, reserves, or code hashes.

It adds a repeatable sandbox measurement pass for the implemented subset:

```text
ATH transfer
ATH burn
CapsuleHub direct publish + fee flush bounce
FeeAccumulator split/flush
UsernameRegistry mint/refund/treasury/burn/prune flows
Vault external publish ACK/bounce flows
```

## Broad sanity thresholds

These thresholds are broad regression guards only:

```text
max_total_fees_per_operation_nanotons = 100_000_000   // 0.1 TON
max_gas_used_per_transaction = 100_000
```

A scenario exceeding these thresholds must fail the M17 sanity test and trigger review.

These thresholds do **not** replace the already pinned execution/storage reserves in previous profiles.
They only detect obvious reserve/gas regressions while final BuybackBurn/STON.fi values remain blocked.

## Required artifacts

```text
artifacts/m17_gas_reserve_sanity_report.json
artifacts/m17_gas_reserve_sanity_summary.md
tests/m17-gas-reserve-sanity.test.ts
scripts/gas_reserve_m17.ts
```

## Current result

```text
M17 gas/reserve sanity: PASS
```

Observed maxes from the current implemented subset:

```text
max_operation_fee_nanotons = 18_263_750   // UsernameRegistry multi-flow scenario total across 7 operations
max_single_operation_fee_nanotons = 5_572_714 // Vault external publish ACK flow
max_gas_used_per_transaction = 42_003         // Vault external publish path
```

All values are below the broad M17 sanity thresholds.

## Remaining blockers

Unchanged from M15/M16:

```text
BUYBACK_BURN_CONTRACT_NOT_IMPLEMENTED_UNTIL_STONFI_ROUTE_VALUES_ARE_PINNED
STONFI_V2_ROUTE_AND_PAYLOAD_VALUES_NOT_PINNED
FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_BUYBACK_BLOCKED_ADDRESS_WITH_REAL_BUYBACKBURN_STATEINIT_ADDRESS
```
