# M20T testnet deployment/probe checklist

## Before running

- [ ] Use disposable testnet wallet only.
- [ ] Copy `.env.testnet.example` to `.env.testnet.local`.
- [ ] Keep `.env.testnet.local` uncommitted.
- [ ] Confirm `PLATHO_NETWORK=testnet`.
- [ ] Confirm `PLATHO_M20T_ALLOW_MAINNET=false`.
- [ ] Confirm production readiness flags remain false.
- [ ] Confirm Vitest config uses `pool: 'vmThreads'`.
- [ ] Run `npm run m20t:preflight -- --observed-balance-nanotons <BALANCE>`.
- [ ] Confirm preflight has no blockers and `productionUnlock=false`.

## Funding gate

- [ ] Print deployer testnet address.
- [ ] Capture deployer balance before deployment.
- [ ] If balance is below `55 TON`, stop with `NEED_TESTNET_TON`.
- [ ] If preflight reports `READY_FOR_SCALED_HARNESS_ONLY`, do not run full-size M20T.
- [ ] Do not fake full envelope tests with smaller amounts unless the result is explicitly labeled `SCALED_HARNESS_ONLY_NOT_PRODUCTION_ENVELOPE`.

## Deployment evidence

- [ ] Capture ATH Master testnet address or `NOT_DEPLOYED` reason.
- [ ] Capture FeeAccumulator testnet address or `NOT_DEPLOYED` reason.
- [ ] Capture BuybackBurn candidate/harness testnet address or `NOT_DEPLOYED` reason.
- [ ] Capture code hashes for deployed contracts.
- [ ] Capture StateInit hashes for deployed contracts.
- [ ] Capture tx hashes and explorer links.

## Probe evidence

- [ ] 51.05 TON envelope accepted from authorized path.
- [ ] 50 TON raw principal rejected as incomplete envelope.
- [ ] wrong sender rejected.
- [ ] wrong amount rejected.
- [ ] duplicate/replay behavior captured.
- [ ] balance deltas captured before/after probe messages.
- [ ] get-method state captured before/after probe messages.
- [ ] refund/excess/bounce behavior captured if the route/harness exists.

## After running

- [ ] Write `artifacts/m20t_testnet_manifest.json`.
- [ ] Write `artifacts/m20t_testnet_evidence.json`.
- [ ] Write `artifacts/M20T_TESTNET_EVIDENCE.md`.
- [ ] Preserve `artifacts/m20t_execution_preflight.json`.
- [ ] Preserve `artifacts/M20T_EXECUTION_PREFLIGHT.md`.
- [ ] Run full suite.
- [ ] Confirm no secret files are staged.
- [ ] Confirm `STONFI_ROUTE_FREEZE_READY` remains false.
- [ ] Confirm `BUYBACKBURN_IMPLEMENTATION_READY` remains false.

## Final statement required

The final M20T evidence must include:

`M20T testnet evidence is NOT mainnet route freeze evidence and does not unlock production BuybackBurn.`
