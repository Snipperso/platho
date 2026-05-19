# Spec Changelog — M20V Tomorrow Codex Execution Runbook

## Summary

M20V adds a single execution runbook for tomorrow's Codex-driven M20T testnet deployment/probe.

## Added

- `artifacts/M20V_TOMORROW_CODEX_EXECUTION_RUNBOOK.md`
- `artifacts/MILESTONE_SUMMARY_M20V_TOMORROW_CODEX_RUNBOOK.md`
- `artifacts/M20V_LOCAL_VERIFICATION_NOTE.md`

## Changed

Documentation/artifacts only.

## Unchanged

- `contracts/`
- `tests/`
- `scripts/`
- FeeAccumulator `51.05 TON` buyback envelope semantics
- M20U readiness gate semantics
- production BuybackBurn implementation status
- STON.fi route freeze status

## Safety stance

M20V does not allow testnet evidence to unlock production BuybackBurn. M20U still requires both:

```text
M20T_TESTNET_DEPLOYMENT_PROBE_COMPLETE = true
M20F_MAINNET_STONFI_ROUTE_FREEZE_READY = true
```

Current production readiness remains false.
