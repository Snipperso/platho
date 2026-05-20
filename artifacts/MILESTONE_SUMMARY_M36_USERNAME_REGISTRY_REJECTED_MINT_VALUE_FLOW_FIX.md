# Platho M36 UsernameRegistry Rejected Mint Value Flow Fix

Status: **PASS**

Scope: fixes local UsernameRegistry rejected-mint TON retention finding UNREG-01.

## Closed Finding

- UNREG-01: rejected username mints no longer retain most of the production ATHWallet notify value in `UsernameRegistry` balance.

## Current Rule

On rejected mint branches, `UsernameRegistry` retains only:

- `4_000_000` nanotons refund-due storage endowment when creating a new refund bucket;
- `1_000_000` nanotons ATH notification ACK value;
- `2_000_000` nanotons local state-growth execution reserve.

Any excess inbound TON is refunded to `owner_wallet` with `bounce=false`.

## Verification

- `npm.cmd run build`: PASS
- `npm.cmd run test:file -- tests\username-registry-foundation.test.ts tests\username-registry-paid-mint.test.ts tests\username-registry-refund-flush.test.ts tests\username-registry-due-flush.test.ts tests\username-registry-prune-pending-mint.test.ts tests\username-registry-boundary-negative.test.ts tests\username-registry-auth-negative-matrix.test.ts tests\username-registry-ath-wallet-integration.test.ts tests\username-registry-state-invariants.test.ts`: 9 files / 34 tests PASS
- `npm.cmd test`: 67 files / 282 tests PASS
- M16 conformance: PASS
- M18 artifact integrity: PASS

## Hashes

- `USERNAME_REGISTRY_CODE_HASH=7d640cf5c5708c49e32f8afa94e8e283c9f85f4db7ee09d3b8295ad56c05193f`
- `DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH=b5c23fc5265fdbe03bfb91d1aac3304c5621a170e6739f23d854251a211fb0c1`

## Production Note

This closes the local UsernameRegistry rejected-mint TON retention finding only. The implemented-subset manifest remains non-final while mainnet genesis and STON.fi route blockers remain open.
