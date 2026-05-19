# Vault Threat Model Checklist

Status: local engineering hardening pass, not an independent audit or formal proof.

Date: 2026-05-17

## Covered Locally

- ATH deposit/withdraw accounting with production ATHWallet integration.
- Duplicate ATH deposit query replay by sender/query_id.
- Underfunded ATH notify and underfunded ATH withdrawal boundaries.
- ATH withdrawal ACK, failed-transfer, and bounce recovery.
- TON deposit/withdraw accounting and low-value delivery behavior.
- Session lifecycle, message budget top-up/revoke, and receive-intent claim/cancel.
- External session publish success, bounce, duplicate nonce, invalid signature, invalid profile, stale prune.
- Forged ATH and CapsuleHub callbacks from non-authorized senders.
- Storage/value threshold checks at min-1 and exact-min boundaries for selected handlers.
- Deterministic state-machine walks for Vault TON/session/budget/receive-intent and Vault ATH accounting.

## Local Invariants

- Sum of internal user ATH balances equals official Vault ATH wallet balance in covered ATH flows.
- Pending ATH withdrawal count returns to zero after successful or rejected covered operations.
- Processed ATH deposit count equals the modeled set of accepted sender/query_id deposits.
- TON user balances, message budgets, session counts, and receive-intent counts match the deterministic model after every state-machine step.
- Receive-intent claim/cancel preserves total internal backing in covered TON and ATH cases.

## Residual Assumptions

- Sandbox gas and forwarding behavior is a proxy, not a final mainnet gas proof.
- Storage growth for replay/idempotency maps is intentionally permanent in the current design and still needs final economic sizing.
- External publish route economics remain bounded by existing M17/M19 artifacts, not by a formal liveness proof.
- No independent human audit has reviewed these changes.
- No formal model checker has proven all reachable states.

## Recommended Before Final Genesis

- Independent Tact/security review focused on money-flow and async callback authority.
- Mainnet/testnet gas envelope measurement for ATH notify, ATH withdraw, CapsuleHub publish, and stale prune.
- Explicit storage-rent/economic policy for permanent processed deposit and notification replay maps.
- Longer CI fuzz schedule with multiple deterministic seeds beyond the fast local suite.
