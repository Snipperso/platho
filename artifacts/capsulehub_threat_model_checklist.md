# CapsuleHub Threat Model Checklist

> **HISTORICAL ONLY — SUPERSEDED.** `CapsuleHub` and `Vault` were deleted in clean-17. Everything below describes the
> clean-15 monolithic hub and the Vault-funded publish path: a single hub contract holding every user's entries, publishes
> funded from an internal Vault balance, `PH0B` 140-byte headers, ACK forward reserves, and a publish surcharge retained
> as hub reserve. None of that exists.
>
> clean-17 replaced the hub with per-lane shard accounts (`RecordShard`, `IntroShard`, `RecoveryShard`, `PublicShard`,
> `KeyShard`), each addressed by derivation and paid directly from the user's own wallet. The current protocol is
> specified in `web/CRYPTO_PROTOCOL.md`; the clean-17 contract review is recorded in the release evidence, not here.
>
> This file is kept because it records a real hardening pass and the reasoning behind decisions that carried forward
> (fee flush bounce accounting, forged-callback rejection, retrievable payload cells as the delivery record). It must not
> be cited as current behaviour.

Status: local engineering hardening pass, not an independent audit or formal proof.

Date: 2026-05-22 (clean-15 generation)

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
- CapsuleHub v1 must retain compact authenticated entry state and accept retrievable publish payload cells in TON transaction history. Counter-only anchors, local-cache-only delivery, IPFS/Ton Storage pointers, or static mirror semantics are not valid v1 message records.
- Private capsule publish payload cells use the final binary layout in `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`, not JSON: `PH0B` header0 is 140 bytes, `PH1B` header1 is 30 bytes, and each hybrid capsule body carries exactly one encrypted user payload slot selected from the 1, 2, 4, 8, 16, or 32 KiB size classes. CapsuleHub state stores compact headers/indexes, `created_at = now()`, and `body_hash`; the heavy body remains in the accepted publish transaction body and is verified by hash, with availability depending on TON message-history provider coverage and local cache. Public publish stores compact `PPH1` header/index state plus a raw public body in transaction history; public text/image/avatar bodies use the smallest fitting 1, 2, 4, 8, 16, or 32 KiB public size class, with post/comment metadata in the header. Public bodies are not encrypted or padded to private ciphertext size. Long private or public text/images use multiple independent capsules, not multiple unrelated payloads inside one capsule.
- CapsuleHub v1 does not expose page-map retrieval as the primary interface; clients retrieve accepted messages by entry id and use counters/latest ids for discovery.
- No independent human audit has reviewed this hardening pass.
- No formal model checker has proven all reachable states.

## Recommended Before Final Genesis

- Independent Tact/security review focused on async ACK/bounce value backing and fee flush authority.
- Testnet/mainnet gas envelope measurement for Vault publish ACK and fee flush bounce.
- Testnet/mainnet storage-rent measurement for CapsuleHub compact index/header metadata growth and prune cadence.
- Keep CapsuleHub frozen only while the focused CapsuleHub/Vault suite, full suite, and artifact checks remain green.
