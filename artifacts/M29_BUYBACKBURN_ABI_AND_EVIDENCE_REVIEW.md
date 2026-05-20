# M29 BuybackBurn ABI And Evidence Review

Date: 2026-05-20

Status: audit follow-up for F-006, F-040, and F-041. This is not a mainnet production approval.

## F-006 BuybackBurn ABI Source Of Truth

Decision: the current v1 `BuybackBurn` ABI is the explicit BY* opcode table implemented in `contracts/BuybackBurn.tact` and exported by the generated Tact wrapper.

Older planning/spec artifacts that mention `BuybackBurn.ExecuteBuyback`, `BuybackBurn.BuybackBounceRecovery`, or `BuybackBurn.PruneStuckBuyback` are superseded for production ABI purposes. They are retained as historical milestone context, not as active client or deployment source of truth.

Final active BuybackBurn messages:

| Message | Opcode | Domain |
|---|---:|---|
| `AcceptBurnReserve` | `0x594BA505` | FeeAccumulator reserve envelope |
| `BindBuybackFeeAccumulator` | `0x42594641` | `BYFA` |
| `BindBuybackOfficialAthWallet` | `0x42594157` | `BYAW` |
| `FreezeBuybackRoute` | `0x42595246` | `BYRF` |
| `SealBuybackBurnGenesis` | `0x4259534C` | `BYSL` |
| `ExecuteBuybackChunk` | `0x42594558` | `BYEX` |
| `RetryAthBurnDue` | `0x42595254` | `BYRT` |
| `RecoverStonfiRouteRefund` | `0x42595243` | `BYRC` |
| `RecycleRouteRefundReserve` | `0x42595252` | `BYRR` |
| `TopUpStorageReserve` | `0x906182D2` | storage reserve top-up |

Callback / imported message opcodes remain owned by ATHWallet / ATHMaster / STON.fi compatibility surfaces, not by the BuybackBurn-specific BY* table:

| Message | Opcode |
|---|---:|
| `AthTransferNotification` | `0x472D9D7D` |
| `ATHBurnFinalized` | `0x41544843` |
| `ATHBurnFailed` | `0x41544844` |
| `StonfiPtonTonTransferBounce` | `0x01F3835D` |

Regression coverage:

- `tests/m29-buybackburn-abi-freeze.test.ts` asserts that the generated wrapper exports the final BY* table.
- The same test asserts that the stale names `ExecuteBuyback`, `BuybackBounceRecovery`, and `PruneStuckBuyback` are not present in the active wrapper opcode map.
- `artifacts/platho_v1_spec_v0_3_2_vault_m6_aligned.md` and `artifacts/platho_v1_spec_v0_3_3_deployment_ath_binding.md` now carry an explicit supersession note for BuybackBurn ABI.

## F-040 Clean Build And Full Suite Evidence

New retained proof artifacts:

- `artifacts/NPM_BUILD_M29_F040_OUTPUT.txt`
- `artifacts/NPM_BUILD_M29_F040_SUMMARY.json`
- `artifacts/NPM_TEST_FULL_SUITE_M29_F040_RESULTS.json`
- `artifacts/NPM_TEST_FULL_SUITE_M29_F040_SUMMARY.json`

Observed local results:

- `npm.cmd run build`: exit code 0.
- `npm.cmd test -- --reporter=json --outputFile artifacts/NPM_TEST_FULL_SUITE_M29_F040_RESULTS.json`: exit code 0.
- Full suite JSON result: 67 files / 276 tests PASS.

## F-041 npm Audit Evidence

New retained proof artifacts:

- `artifacts/NPM_AUDIT_FULL_M29_F041.json`
- `artifacts/NPM_AUDIT_PROD_M29_F041.json`
- `artifacts/NPM_AUDIT_M29_F041_SUMMARY.json`

Observed local results:

- full graph audit: 0 vulnerabilities.
- production-only audit: 0 vulnerabilities.

This closes the evidence mismatch for the current lockfile state. Future dependency changes must regenerate both audit artifacts before release packaging.

## Remaining Production Gates

This pass closes audit evidence gaps and BuybackBurn ABI source-of-truth drift. It does not remove the final mainnet deployment blockers, including final STON.fi route freeze, final genesis manifest replacement, and production PWA/preprod gates.
