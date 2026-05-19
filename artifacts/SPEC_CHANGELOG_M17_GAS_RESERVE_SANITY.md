# SPEC CHANGELOG — M17 Gas / Reserve Sanity

## Accepted change

Add an implemented-subset gas/reserve sanity profile.

## Why

M16 restored reliable full-suite exit behavior. M17 adds a regression guard for already implemented money/publish flows so reserve-sensitive changes do not silently creep in.

This is intentionally not a mainnet gas freeze. It is a compact sanity layer while BuybackBurn and final STON.fi route values remain blocked.

## No protocol changes

M17 does not change:

```text
contract code
opcodes
message layouts
StateInit layouts
storage schema
money semantics
sealed manifest semantics
```

## Added artifacts

```text
scripts/gas_reserve_m17.ts
tests/m17-gas-reserve-sanity.test.ts
artifacts/m17_gas_reserve_sanity_report.json
artifacts/m17_gas_reserve_sanity_summary.md
artifacts/platho_v1_open_values_v0_17_gas_reserve_sanity.md
```

## Result

```text
npm run build: OK
npm audit --omit=dev --audit-level=high: 0 vulnerabilities
M17 targeted test: 1/1 passed
Full suite: 23 files passed / 98 tests passed / exit code 0
```
