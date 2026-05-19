# M19G — BuybackBurn Route-Independent State Machine

## Summary

M19G adds a route-independent BuybackBurn state-machine model and tests. It does not implement production BuybackBurn and does not unblock BuybackBurn without STON.fi route freeze evidence.

## Added

```text
scripts/buybackburn_state_machine_m19g.ts
tests/m19g-buybackburn-state-machine.test.ts
artifacts/buybackburn_state_machine_m19g.json
artifacts/BUYBACKBURN_IMPLEMENTATION_READY_M19G.txt
artifacts/platho_v1_open_values_v0_19g_buybackburn_state_machine.md
artifacts/SPEC_CHANGELOG_BUYBACKBURN_STATE_MACHINE_M19G.md
```

## Model

```text
IDLE -> PENDING_STONFI_SWAP -> PENDING_ATH_BURN -> IDLE
```

Success is not router-claim based. Success requires:

```text
actual ATH receipt by official BuybackBurn ATH wallet
then ATH burn
then ATHBurnFinalized from ATH Master
```

## Tests

```text
M19G-01 route freeze required before start
M19G-02 happy path requires official ATH receipt and ATH Master finalization
M19G-03 wrong senders / amount mismatches do not clear pending
M19G-04 route refund/failure clears swap pending and records route refund due
M19G-05 burn failure records ATH retry due
M19G-06 profile forbids fake routes, ignored-error sends, and router-claim success
```

## Verification

```text
build: OK
audit: 0 vulnerabilities
M19G targeted: 1 file / 6 tests passed
full suite: 31 files / 128 tests passed
full suite exit code: 0
```

## Contract hashes

No production contract code changed in M19G.
