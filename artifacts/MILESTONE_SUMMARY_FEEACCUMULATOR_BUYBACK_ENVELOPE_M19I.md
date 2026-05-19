# Platho M19I — FeeAccumulator Buyback Envelope Alignment

Status: **implemented**

## Summary

FeeAccumulator now enforces M19H envelope semantics at contract level.

Before M19I, `FlushBuybackDue` accepted any positive amount up to `buyback_due_ton`. That meant a raw `50 TON` buyback offer principal could be flushed even though M19H requires a full `51.05 TON` conservative funding envelope.

M19I adds the pinned contract constant:

```text
BUYBACK_FUNDING_ENVELOPE_NANOTONS = 51_050_000_000
```

and requires:

```text
FlushBuybackDue.amount == BUYBACK_FUNDING_ENVELOPE_NANOTONS
FlushBuybackDue.amount <= buyback_due_ton
```

## Preserved behavior

- Treasury flush remains arbitrary partial flush up to `treasury_due_ton`.
- Buyback bounce recovery still restores the exact sent envelope.
- Fee split remains exact 50/50 integer split with dust to buyback.
- Production BuybackBurn remains blocked until real STON.fi route values are pinned.

## Tests

Targeted tests passed:

```text
FeeAccumulator + M19H + manifest/conformance/integrity targeted suite: 21/21 passed
```

Coverage added/updated:

- `FEE-DUE-06`: bounce restores a complete 51.05 TON envelope.
- `FEE-DUE-07`: deployed receiver debits exactly one 51.05 TON envelope.
- `FEE-DUE-08/M19H`: raw 50 TON offer principal is rejected.
- `M19H-04`: contract constant matches M19H profile value.
- `M19H-05`: 50 TON is rejected even when `buyback_due_ton` can fund a full envelope.

## Build / integrity

```text
FeeAccumulator build: PASS
M16 conformance: PASS
M18 artifact integrity: PASS
Full suite: PASS under Vitest vmThreads
32 test files passed
134 tests passed
EXIT=0
```

The full suite uses `vitest.all.config.ts` with `pool: 'vmThreads'`, `fileParallelism: false`, `maxWorkers: 1`, and `minWorkers: 1`. This avoids the Vitest 4.x `threads` teardown hang previously observed in the TON sandbox-heavy suite.

Canonical full-suite artifacts for M19I are now the successful vmThreads run:

```text
artifacts/NPM_TEST_FULL_SUITE_M19I_OUTPUT.txt
artifacts/NPM_TEST_FULL_SUITE_M19I_EXIT.txt
artifacts/NPM_TEST_FULL_SUITE_M19I_VMTHREADS_OUTPUT.txt
artifacts/NPM_TEST_FULL_SUITE_M19I_VMTHREADS_EXIT.txt
```

## Current hashes

```text
FEEACCUMULATOR_CODE_HASH=afe97a1d7ea09f8912098a15fe42a88005dd9bf6a691e0dc2db55c1a820de9f1
FEEACCUMULATOR_STATE_INIT_HASH=889d5eb9cc138396145486e8ac52ae4f317edf71e9048f8e2fc2448a9106b8ff
IMPLEMENTED_SUBSET_MANIFEST_HASH=0a028486f76ddc52a3feed0016ddc1547ffb7667ec1c494979aff9909b0066aa
```

## 2026-05-17 local hardening note

FeeAccumulator now also enforces caller-funded execution reserves for deposit,
split, treasury flush, and buyback flush. This prevents protocol principal/due
backing from paying execution, forwarding, or bounce fees.
