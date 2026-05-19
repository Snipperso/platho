# M17 — Gas / Reserve Sanity Pass

## Scope

Implemented-subset gas/reserve sanity pass.

No new production contract and no protocol behavior change were introduced.

## Added

```text
scripts/gas_reserve_m17.ts
tests/m17-gas-reserve-sanity.test.ts
artifacts/m17_gas_reserve_sanity_report.json
artifacts/m17_gas_reserve_sanity_summary.md
artifacts/platho_v1_open_values_v0_17_gas_reserve_sanity.md
artifacts/SPEC_CHANGELOG_M17_GAS_RESERVE_SANITY.md
```

## Covered scenarios

```text
ATH_TRANSFER_SUCCESS
ATH_BURN_SUCCESS
CAPSULEHUB_DIRECT_PUBLISH_AND_FLUSH_BOUNCE
FEEACCUMULATOR_SPLIT_FLUSH
USERNAME_REGISTRY_MINT_FLUSH_PRUNE
VAULT_EXTERNAL_PUBLISH
```

## Observed maxima

```text
max_single_operation_fee_nanotons = 5_572_714
max_gas_used_per_transaction = 42_003
```

Both remain well below the broad M17 regression thresholds:

```text
max_total_fees_per_operation_nanotons = 100_000_000
max_gas_used_per_transaction = 100_000
```

## Verification

```text
npm ci --ignore-scripts: OK
npm run build: OK
npm audit --omit=dev --audit-level=high: 0 vulnerabilities
npx vitest run tests/m17-gas-reserve-sanity.test.ts --config vitest.all.config.ts: 1/1 passed
npm test -- --reporter=dot --testTimeout=30000: 23 files passed / 98 tests passed / exit code 0
npx ts-node scripts/gas_reserve_m17.ts: PASS
```

## Code hashes

No contract code changed in M17.

```text
ATH_WALLET_CODE_HASH=7b4b51d5044ddd869d277dd037fd738a4f38696dc47c0960808e6891ca61a7d5
ATHMASTER_CODE_HASH=143c2255d9bf3ae853947e45560afeb6ad0a0648361ed2350c714c3e9d6d2328
CAPSULEHUB_CODE_HASH=add81654c2263f725fcc93cf3c9caf3229c8f164870511b90f967174a953db85
FEEACCUMULATOR_CODE_HASH=ed272b10bc841ce09da511dbe3c10cffa89659791480d0390d3e7bbde08af503
VAULT_CODE_HASH=5cedd91640c2d12f61f805881172683f7ec27ff5e044514ab855517a6910f489
USERNAME_NFT_ITEM_CODE_HASH=aeae8569040208929451ecbd632606c31de78e43425603997d88b85a403d8830
USERNAME_REGISTRY_CODE_HASH=77374ee9f1f832ed10f4ab428ff89c72e2784b200a88aad686ce225002574390
```

## Remaining blockers

```text
BuybackBurn is still blocked until STON.fi v2 route/payload values are pinned.
Final genesis manifest is still blocked until BuybackBurn StateInit exists.
```
