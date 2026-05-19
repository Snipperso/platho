# Platho M19A: STON.fi Route Discovery Draft

## Status

Completed as discovery/tooling milestone.

Production BuybackBurn remains blocked until real STON.fi route values are pinned.

## What was added

```text
scripts/stonfi_v2_1_route_lib.ts
scripts/stonfi_route_discovery_m19.ts
tests/m19-stonfi-route-discovery.test.ts
artifacts/stonfi_route_probe_m19.json
artifacts/STONFI_ROUTE_FREEZE_READY_M19.txt
artifacts/platho_v1_open_values_v0_19_stonfi_route_discovery_draft.md
artifacts/SPEC_CHANGELOG_STONFI_ROUTE_DISCOVERY_M19A.md
```

## Official SDK constants recorded

```text
DEX_OP_SWAP = 0x6664de2a
PTON_OP_TON_TRANSFER = 0x01f3835d
swapTonToJetton forward gas = 0.3 TON
pTON tonTransfer gas = 0.01 TON
```

## Test coverage

```text
M19A-01: SDK v2.1-equivalent TON->jetton payload has dex_min_out in minAskAmount
M19A-02: total value formula is offer + router forward gas + pTON transfer gas
M19A-03: production BuybackBurn remains blocked while final route values are unresolved
```
