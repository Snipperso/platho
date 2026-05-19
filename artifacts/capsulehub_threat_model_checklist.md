# CapsuleHub Threat Model Checklist

Status: local engineering hardening pass, not an independent audit or formal proof.

Date: 2026-05-17

## Covered Locally

- Direct private and public publish validation, value boundaries, counters, and fee accrual.
- Vault private and public publish validation, sender authority, publish_id checks, ACK emission, and fee backing.
- Min-1 and exact-min boundaries for direct and Vault publish paths.
- Negative matrix for unsealed publish, forged Vault publish, public author spoof, invalid publish IDs, bind/seal authority, and sealed rebind.
- Deterministic state-machine walks for direct publish, Vault publish, invalid publish attempts, forged attempts, and fee flush bounce recovery.
- Fee flush amount bounds and bounce restoration for failed FeeAccumulator delivery.
- CapsuleHub/Vault cross-contract ACK processing after accepted external session publish.

## Local Invariants

- Private/public entry counters and latest ids advance only after accepted publishes.
- Private/public page counters match first-entry-on-page transitions.
- `accrued_plato_fee_ton` changes only by accepted protocol fees and successful/failed flush accounting.
- Accepted Vault publishes retain CapsuleHub backing for accrued fees and charged reserves.
- Vault ACKs clear pending publishes and do not leave stale pending state in covered success flows.
- Forged or invalid callbacks do not create entries or ACKs.

## Residual Assumptions

- Sandbox gas and forwarding behavior is a proxy, not final mainnet gas proof.
- `CAPSULEHUB_ACK_FORWARD_RESERVE = 0.030 TON` is locally validated but should be remeasured on testnet/mainnet.
- Direct-publish overpayment remains contract balance/storage reserve and is not modeled as refundable user balance.
- CapsuleHub v1 intentionally stores counter/anchor metadata only, not full production retrieval indexes or on-chain page maps.
- No independent human audit has reviewed this hardening pass.
- No formal model checker has proven all reachable states.

## Recommended Before Final Genesis

- Independent Tact/security review focused on async ACK/bounce value backing and fee flush authority.
- Testnet/mainnet gas envelope measurement for direct publish, Vault publish ACK, and fee flush bounce.
- Testnet/mainnet storage-rent measurement for CapsuleHub counter/page-count growth.
- Keep CapsuleHub frozen only while the focused CapsuleHub/Vault suite, full suite, and artifact checks remain green.
