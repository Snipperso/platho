# BuybackBurn Threat Model Checklist

Status: current local contract checklist after final engineering hardening pass, not an independent audit or formal proof.

Date: 2026-07-28 (rebaselined onto the clean-17 build; checklist content unchanged since 2026-07-06)

Frozen source: `contracts/BuybackBurn.tact`

Current code hash: `265eadd2806b7480f5783a6854b87f8fe14e907429c0122a1d93eab849bcfe68`

Production unlock status: final genesis may seal BuybackBurn with `route_frozen=false`, but route freeze and execution remain blocked until post-pool M20F mainnet STON.fi route evidence passes. This local freeze does not set `production_buyback_burn_unlocked` or `BUYBACKBURN_IMPLEMENTATION_READY` to true.

## Covered Locally

- Genesis controller binding surface: FeeAccumulator and official BuybackBurn ATH wallet are one-way pre-seal operations.
- Seal may happen before the STON.fi route exists; in that state `route_frozen=false` and `genesis_config_hash` remains as the one-time post-pool launch controller hash.
- If the route was already frozen before seal, seal burns the controller surface immediately by clearing `genesis_config_hash`.
- Post-seal `FreezeBuybackRoute` is allowed once while BuybackBurn has no reserve, route refund, retry due, accepted reserve count, or pending phase; successful freeze clears `genesis_config_hash`.
- Official ATH wallet is derived from the final BuybackBurn address and ATH master address.
- STON.fi route freeze requires a positive min-out, nonzero evidence hash, referral bps bound, and ask wallet derived from the pinned ATH pool owner.
- F11 dead-man `RecoverStuckStonfiSwap` (0x42595353): permissionless, time-only recovery of a PENDING_STONFI_SWAP that never resolves. Requires NO +49-TON refund proof and NO whitelisted refund sender; only that `now() > pending_deadline + BUYBACK_STUCK_SWAP_DEADMAN_GRACE_SECONDS` (21600s, ~24x the 900s swap deadline) and a matching pending query_id. Closes the permanent-brick class (success-but-no-notify, refund-sender migration, sub-49 net refund, silent no-refund) that the +49-gated `RecoverStonfiRouteRefund` cannot reach, without adding an owner/pause/upgrade surface.
- Buyback execution is a fixed-floor route. `ExecuteBuybackChunk` must provide the frozen quote and frozen `dex_min_out`; it is not a dynamic best-price mechanism and does not accept caller-supplied live market quotes.
- FeeAccumulator can fund BuybackBurn only with the exact 51.05 TON envelope.
- BuybackBurn executes one 50 TON offer per envelope while preserving 1.05 TON route funding.
- pTON send uses `SendPayFwdFeesSeparately` so the exact envelope reaches the pTON wallet inbound path.
- STON.fi pTON refund, swap refund, and excess receivers are BuybackBurn.
- pTON transfer bounce records returned TON as route refund due and does not restore a free retryable reserve envelope.
- Large current-swap route refunds can clear a pending swap only after deadline plus grace.
- Full accumulated route refunds can be permissionlessly recycled into exactly one new 51.05 TON reserve envelope.
- ATH receipt is accepted only from the official BuybackBurn ATH wallet and only from the pinned STON.fi pool owner wallet.
- ATH burn finalization is accepted only from ATHMaster and only for the pending query/amount/owner.
- Buyback burn success is recognized only after BuybackBurn receives authenticated `ATHBurnFinalized` from ATHMaster.
  ATHWallet sending `ATHBurnNotification`, or BuybackBurn sending an outbound burn request, is only a burn attempt and
  must not be counted as completed burn by release dashboards or indexers.
- ATH burn failure and bounced burn request move ATH into retry-due accounting; retry requires caller-funded burn execution reserve.
- Empty fallback rejects all unauthenticated value, and accepts only authenticated STON.fi route refund/excess senders after seal and route freeze.
- Extended auth-negative matrix covers forged genesis actions, inconsistent manifest reuse, invalid route freeze parameters, malformed reserve intake, malformed execute requests, forged ATH notifications, premature route recovery, underfunded recycle, and malformed burn retry attempts.
- No admin, owner override, pause, upgrade, governance, rescue, or ignored-error money send surface is implemented.

## Local Invariants

- `reserve_due_ton` changes only by exact accepted reserve envelopes, execution debit, or full route-refund recycle.
- `route_refund_due_ton` records only authenticated route refund/excess/bounce value from pinned STON.fi addresses.
- A pending STON.fi swap cannot become a successful buyback without ATH receipt by the official ATH wallet.
- A pending ATH burn cannot become successful without `ATHBurnFinalized` from ATHMaster.
- Failed route execution does not increment executed buyback count or burned ATH total.
- Failed ATH burn preserves retryable ATH accounting until a later authenticated burn finalizes.
- Ordinary ATH sent directly to the official BuybackBurn ATH wallet is not tracked by BuybackBurn state, is not burn due, and must be monitored as unexpected stuck wallet balance rather than protocol-owned reserve.
- The production route cannot be frozen from testnet M20T evidence alone.

## Final Local Verification

- `npm.cmd run build`: pass.
- `node scripts/hash_codes.js`: BuybackBurn hash `adf826d02915f535d900d769fe3e47ba24181e6bfe669a8de52fc75a00afd8bd`.
- Targeted BuybackBurn route/readiness suite: 14 files, 71 tests passed.
- Focused BuybackBurn production suite: 11 tests passed, including burn-failure retry coverage.
- BuybackBurn auth-negative matrix: 6 tests passed.
- `scripts/conformance_m16.ts`: pass.
- `scripts/artifact_integrity_m18.ts`: pass.
- `npm.cmd run m20u:readiness`: blocked only by `M20F_MAINNET_STONFI_ROUTE_FREEZE_NOT_READY`.
- `npm.cmd run m20f:address-preflight`: `READY_FOR_MAINNET_ADDRESS_DERIVATION`.
- `npm.cmd run m20f:preflight`: blocked by missing final mainnet inputs and M19F dossier.
- Full suite: 61 files, 245 tests passed.
- `npm.cmd audit --json`: 0 vulnerabilities.

## Residual Assumptions

- Sandbox gas and forwarding behavior is a proxy, not final mainnet gas proof.
- `BUYBACK_FUNDING_ENVELOPE_NANOTONS = 51.05 TON`, `BUYBACK_PTON_TRANSFER_GAS_NANOTONS = 0.05 TON`, ATH burn request value, notify value, and recycle reserve should be remeasured on live mainnet before post-pool route freeze.
- M20F must use real mainnet ATH/BuybackBurn addresses, STON.fi API simulation, official SDK/API transaction params, and refund/excess/failure proofs.
- STON.fi router, pool, pTON wallet, and ATH wallet code hashes must be captured from mainnet before route freeze.
- No independent human audit has reviewed this hardening pass.
- No formal model checker has proven all reachable states.

## Recommended Before Final Genesis

- Keep `contracts/BuybackBurn.tact` frozen unless a real bug is found.
- Do not set production BuybackBurn readiness true until post-pool M20F route freeze and production review gates pass.
- Derive final mainnet BuybackBurn StateInit address and official BuybackBurn ATH wallet.
- Capture final M20F route evidence and run M19F/M20F gates.
- Repeat build, hash, targeted suite, full suite, artifact integrity, and dependency audit after final mainnet inputs are added.
