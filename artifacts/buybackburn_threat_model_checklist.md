# BuybackBurn Threat Model Checklist

Status: locally frozen contract candidate after final engineering hardening pass, not an independent audit or formal proof.

Date: 2026-05-19

Frozen source: `contracts/BuybackBurn.tact`

Frozen code hash: `95286777c509acdb6799ea117be609d95fdcd866534548398bd80eb015a8fc24`

Production unlock status: blocked until final M20F mainnet STON.fi route evidence passes. This local freeze does not set `production_buyback_burn_unlocked` or `BUYBACKBURN_IMPLEMENTATION_READY` to true.

## Covered Locally

- Genesis controller binding surface: FeeAccumulator, official BuybackBurn ATH wallet, route values, and seal are one-way pre-seal operations.
- Seal burns the genesis-controller surface by clearing `genesis_config_hash`.
- Official ATH wallet is derived from the final BuybackBurn address and ATH master address.
- STON.fi route freeze requires a positive min-out, nonzero evidence hash, referral bps bound, and ask wallet derived from the pinned ATH pool owner.
- FeeAccumulator can fund BuybackBurn only with the exact 51.05 TON envelope.
- BuybackBurn executes one 50 TON offer per envelope while preserving 1.05 TON route funding.
- pTON send uses `SendPayFwdFeesSeparately` so the exact envelope reaches the pTON wallet inbound path.
- STON.fi pTON refund, swap refund, and excess receivers are BuybackBurn.
- pTON transfer bounce records returned TON as route refund due and does not restore a free retryable reserve envelope.
- Large current-swap route refunds can clear a pending swap only after deadline plus grace.
- Full accumulated route refunds can be permissionlessly recycled into exactly one new 51.05 TON reserve envelope.
- ATH receipt is accepted only from the official BuybackBurn ATH wallet and only from the pinned STON.fi pool owner wallet.
- ATH burn finalization is accepted only from ATHMaster and only for the pending query/amount/owner.
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
- The production route cannot be sealed from testnet M20T evidence alone.

## Final Local Verification

- `npm.cmd run build`: pass.
- `node scripts/hash_codes.js`: BuybackBurn hash unchanged at `95286777c509acdb6799ea117be609d95fdcd866534548398bd80eb015a8fc24`.
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
- `BUYBACK_FUNDING_ENVELOPE_NANOTONS = 51.05 TON`, `BUYBACK_PTON_TRANSFER_GAS_NANOTONS = 0.05 TON`, ATH burn request value, notify value, and recycle reserve should be remeasured on live mainnet before final route seal.
- M20F must use real mainnet ATH/BuybackBurn addresses, STON.fi API simulation, official SDK/API transaction params, and refund/excess/failure proofs.
- STON.fi router, pool, pTON wallet, and ATH wallet code hashes must be captured from mainnet before route freeze.
- No independent human audit has reviewed this hardening pass.
- No formal model checker has proven all reachable states.

## Recommended Before Final Genesis

- Keep `contracts/BuybackBurn.tact` frozen unless a real bug is found.
- Do not set production BuybackBurn readiness true until M20F route freeze and production review gates pass.
- Derive final mainnet BuybackBurn StateInit address and official BuybackBurn ATH wallet.
- Capture final M20F route evidence and run M19F/M20F gates.
- Repeat build, hash, targeted suite, full suite, artifact integrity, and dependency audit after final mainnet inputs are added.
