# M20X Test Matrix Summary

Status: PASS

## Build

- `npx tact --config tact.config.json --project Vault`: PASS

## Targeted M20X verification

- `tests/vault-m6-publish.test.ts`
- `tests/vault-external-session-gate.test.ts`
- `tests/vault-prune-pending-publish.test.ts`
- `tests/deployment-manifest-m15.test.ts`
- `tests/m16-conformance-static.test.ts`
- `tests/m17-gas-reserve-sanity.test.ts`
- `tests/m18-artifact-integrity.test.ts`

Result: 7 test files / 20 tests passed.

## Chunked full regression matrix

- Chunk 1: 8 files / 36 tests passed
- Chunk 2: 8 files / 27 tests passed
- Chunk 3: 8 files / 38 tests passed
- Chunk 4: 8 files / 29 tests passed
- Chunk 5: 2 files / 13 tests passed

Total: 34 test files / 143 tests passed.

Failed chunks: 0.

## Notes

The one-shot full-suite command can hit the outer sandbox execution timeout before final summary, even when individual chunks are green. M20X therefore uses explicit chunked proof artifacts. Human tooling remains a garden of tiny rakes.
