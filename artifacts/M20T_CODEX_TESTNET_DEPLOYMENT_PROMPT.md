# Codex prompt — M20T testnet deployment and BuybackBurn probe

You are working in the Platho M19I/M20T project checkout.

Goal: perform M20T testnet deployment/probe preparation and, if the environment has network access and a funded disposable testnet wallet, execute the live testnet probe.

Hard constraints:

- Do not change production tokenomics.
- Do not change FeeAccumulator 51.05 TON buyback envelope semantics.
- Do not enable production BuybackBurn.
- Do not set `STONFI_ROUTE_FREEZE_READY=true`.
- Do not set `BUYBACKBURN_IMPLEMENTATION_READY=true`.
- Do not treat testnet evidence as mainnet route freeze.
- Do not mix mainnet and testnet addresses in one manifest.
- Do not commit `.env`, `.env.*.local`, mnemonic, seed, private key, or wallet secret material.
- Do not add admin rescue, fallback route, route switch, pause, owner override, governance surface, or ignored-error money send.

Required workflow:

1. Read `.env.testnet.example` and create `.env.testnet.local` locally only.
2. Generate a disposable testnet wallet if no local testnet deployer exists.
3. Print the deployer testnet address and current balance.
4. Run `npm run m20t:preflight -- --observed-balance-nanotons <BALANCE>`.
5. If preflight reports blockers, stop and fix only the testnet/preflight issue.
6. If balance is below `PLATHO_TESTNET_MIN_BALANCE_NANOTONS`, stop with status `NEED_TESTNET_TON` or `READY_FOR_SCALED_HARNESS_ONLY` and do not fake full-size evidence.
7. Build contracts with `npm run build`.
8. Run full suite with `npm test` using the existing Vitest `vmThreads` config.
9. Deploy only testnet contracts/harnesses needed for M20T.
10. Capture tx hashes, explorer links, account states, balances, get-method outputs, and message results.
11. Probe, where implemented/harnessed:
   - 51.05 TON envelope accepted from authorized FeeAccumulator path;
   - 50 TON raw principal rejected as incomplete envelope;
   - wrong sender rejected;
   - wrong amount rejected;
   - duplicate/replay behavior captured;
   - refund/excess/bounce behavior captured if route/harness exists.
12. Write `artifacts/m20t_testnet_manifest.json`.
13. Write `artifacts/m20t_testnet_evidence.json`.
14. Write `artifacts/M20T_TESTNET_EVIDENCE.md`.
15. Preserve `artifacts/m20t_execution_preflight.json` and `artifacts/M20T_EXECUTION_PREFLIGHT.md`.
16. Re-run full suite after changes, if any code/scripts changed.
17. Summarize exactly what was proven and exactly what remains unproven.

Acceptance:

- Full suite remains green.
- Evidence files exist and are filled with real values or explicit `NOT_EXECUTED` reasons.
- Preflight files exist and report no blockers.
- No secrets are committed.
- Production flags remain false.
- Testnet evidence is explicitly labeled `NOT_MAINNET_ROUTE_FREEZE`.
