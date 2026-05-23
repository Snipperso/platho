# CapsuleHub Threat Model Checklist

Status: local engineering hardening pass, not an independent audit or formal proof.

Date: 2026-05-22

## Covered Locally

- Vault private and public publish validation, sender authority, publish_id checks, ACK emission, and fee backing.
- Min-1 and exact-min boundaries for Vault publish paths.
- Negative matrix for unsealed publish, forged Vault publish, invalid publish IDs, bind/seal authority, and sealed rebind.
- Deterministic state-machine walks for Vault publish, invalid publish attempts, forged attempts, and fee flush bounce recovery.
- Fee flush amount bounds and bounce restoration for failed FeeAccumulator delivery.
- CapsuleHub/Vault cross-contract ACK processing after accepted external session publish.

## Local Invariants

- Private/public entry counters and latest ids advance only after accepted publishes.
- Private/public latest ids advance sequentially; page boundaries are client-derived metadata only and do not change publish price.
- `accrued_plato_fee_ton` changes only by accepted protocol fees and successful/failed flush accounting.
- Accepted Vault publishes retain CapsuleHub backing for accrued fees and charged reserves.
- Vault ACKs clear pending publishes and do not leave stale pending state in covered success flows.
- Forged or invalid callbacks do not create entries or ACKs.

## Residual Assumptions

- Sandbox gas and forwarding behavior is a proxy, not final mainnet gas proof.
- `CAPSULEHUB_ACK_FORWARD_RESERVE = 0.030 TON` is locally validated but should be remeasured on testnet/mainnet.
- CapsuleHub final v1 has no direct user publish ABI. Public and private publishes are Vault-only so ATH discounts apply consistently; storage top-up remains an explicit separate operation.
- CapsuleHub v1 must store retrievable encrypted payload cells on-chain. Counter-only, anchor-only, hash-only, off-chain package, local cache, IPFS/Ton Storage pointer, or static mirror semantics are not valid v1 message records.
- Private capsule on-chain payload cells use the final binary layout in `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`, not JSON: `PH0B` header0 is 140 bytes, `PH1B` header1 is 30 bytes, and each capsule body carries exactly one encrypted 1024-byte user payload slot. Standard body bytes are 1,140; postquantum body bytes are 2,228. Public publish stores a compact `PPH1` header cell plus a raw public body cell; both public posts and comments get a full 1..1024 UTF-8 text bytes, with post/comment metadata in the header. Public bodies are not padded to private capsule size. Long private text/images use multiple capsules, not multiple slots inside one capsule.
- CapsuleHub v1 does not expose page-map retrieval as the primary interface; clients retrieve accepted messages by entry id and use counters/latest ids for discovery.
- No independent human audit has reviewed this hardening pass.
- No formal model checker has proven all reachable states.

## Recommended Before Final Genesis

- Independent Tact/security review focused on async ACK/bounce value backing and fee flush authority.
- Testnet/mainnet gas envelope measurement for Vault publish ACK and fee flush bounce.
- Testnet/mainnet storage-rent measurement for CapsuleHub encrypted payload cell, counter, and metadata growth.
- Keep CapsuleHub frozen only while the focused CapsuleHub/Vault suite, full suite, and artifact checks remain green.
