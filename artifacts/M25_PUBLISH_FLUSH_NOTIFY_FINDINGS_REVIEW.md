# M25 Publish, Flush, and Notify Findings Review

Status: **PATCHED / TESTED**, production still **NO-GO** because preprod readiness gates remain intentionally closed.

## Scope

Reviewed the new audit pass covering F-017 through F-024 against current `main` after the previous accounting fixes.

## Findings

- F-017 / F-018: patched. Vault publish ACK/bounce accounting no longer credits raw inbound ACK value into message budget. `VAULT_EXTERNAL_SESSION_LOCAL_MAX_CHARGE` was raised to cover local Vault costs, and `refundPendingPublish` now keeps a receive-side execution reserve before refunding budget.
- F-019: current report values were stale against the already-patched tree. Vault state-growth paths already include `VAULT_STATE_GROWTH_EXEC_RESERVE`; existing boundary tests still pass.
- F-020: patched. UsernameRegistry due flush calls now require an extra local execution reserve while forwarding only the ATH wallet execution value.
- F-021: patched. FeeAccumulator treasury flush reserve was raised so exact-reserve flushes do not drain accumulator backing.
- F-022: patched. ATHWallet pending notification state now has a TTL and explicit prune path.
- F-023: patched. ATH notify transfers now require an explicit storage endowment for persistent pending notification state.
- F-024: patched. UsernameRegistry refund flush pending IDs are scoped by owner wallet plus caller query ID.

## Regression Evidence

- `npm.cmd test -- --reporter=json --outputFile=artifacts\NPM_TEST_FULL_SUITE_M25_PUBLISH_FLUSH_NOTIFY_RESULTS.json`
  - success: true
  - passed tests: 269 / 269
- M16 conformance: PASS
- M17 gas reserve sanity: PASS
- M18 artifact integrity: PASS
- `node scripts\preprod_guard.mjs`: BLOCKED as expected by non-contract production gates.

## Remaining Non-Contract Gates

Preprod guard still blocks production because the PWA is not in production/mainnet mode, crypto docs still list production work, the readiness checklist has open hard blockers, and `.env.testnet.local` is present in this workspace.
