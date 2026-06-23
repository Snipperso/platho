# clean-10 immutable genesis re-ceremony — RUNBOOK (DRAFT)

DRAFT checklist assembled 2026-06-22 from the existing ceremony scripts + project memory. VERIFY each exact
script invocation against the scripts before running. The on-chain broadcast steps (Phase 2) are OWNER-GATED
and irreversible — do NOT run them without explicit go and a passing dry-run.

Why: CapsuleHub.tact + Vault.tact changed (public author/parent index + FIFO auto-eviction + 2106-clamp removal
+ gas/storage recalibration) → code hashes diverge from clean-09 → a fresh immutable genesis ("clean-10") is
required. Addresses stay the SAME (vanity wallets via state-init determinism on the same deployment fork); only
the code hashes + the deployment manifest hash change.

clean-09 baseline (for diff): manifest b29aa2598542aa320df5065cc5dbce5d29047e7a44140fd68a49439316dee5ae;
Vault UQB-EaCRXSL_HyRXhp7YMSuQxKcSYPEvRtq-hEwsfzepfFJT; CapsuleHub UQAYwXnGFHz0yZLDKRNGofomS9yWrzxMnyPO-A-Di5ZQB90G.
Current clean-10 build hashes (deterministic, 2 rebuilds identical): CapsuleHub b7ec6e2d…, Vault 41d0e25a….

## PHASE 1 — LOCAL PREP (safe now, no on-chain effect)
1. `npm run build` — compile all contracts.
2. `node scripts/hash_codes.js` — regenerate artifacts/CURRENT_CODE_HASHES.txt (+ per-contract .txt).
3. `npm run mainnet:manifest:draft` — build the clean-10 manifest draft (same addresses, new code hashes + new
   manifest hash). Needs artifacts/local/mainnet_roles.local.json. Output: artifacts/local/mainnet_final_manifest_draft.json.
4. `npm run mainnet:deploy:packet` — build the deployment packet (deploy stateInits + pre-seal bind + seal +
   funding). Output: artifacts/local/mainnet_deploy_packet.json.
5. `npm run mainnet:tx:dry-run` — gas/bounce dry-run of the full packet. Output: artifacts/local/mainnet_tx_dry_run_packet.json.
6. Dry-run the broadcaster for each phase WITHOUT --broadcast (validates seed files + key derivation + that
   messages would land): `node scripts/mainnet_ceremony_broadcast.mjs --phase <deploy|bind|seal> --packet …`.

## PHASE 2 — OWNER-GATED ON-CHAIN CEREMONY (IRREVERSIBLE — explicit go + passing dry-run required)
Bind→seal order matters (CapsuleHub & Vault bind each other's address + manifest hash via BindDeploymentManifest
0x90E2E0CB, THEN SealGenesis 0x3A12D1AD). Broadcaster phases (mainnet_ceremony_broadcast.mjs, role-signed,
redundant toncenter+gateway):
- 2.1 `--phase deploy --broadcast` — deploy the contract set (idempotent; skips already-active).  ⚠ live code.
- 2.2 `--phase treasury-supply --broadcast` — ATH treasury supply (if applicable).
- 2.3 `--phase bind --broadcast` — Vault↔CapsuleHub (+ other) BindDeploymentManifest = lock clean-10 manifest hash.
- 2.4 `--phase seal --broadcast` — SealGenesis on all → genesis IMMUTABLE.  ⚠⚠ fully irreversible.
- 2.5 `--phase fund --broadcast` — funding/liquidity (if any).
Prereqs: role seed mnemonics in artifacts/local/*.secret.txt (treasury_owner, genesis_controller, receiver…);
wallets funded; gateway reachable. Admin host per memory: ssh -i ~/.ssh/platho_njalla_ed25519 platho@45.142.141.141.

## PHASE 3 — POST-DEPLOY VERIFY + EVIDENCE REBASELINE (turns the 8 red genesis-posture tests green)
1. RE-READ live config-18 basechain cell_price_ps at this point (confirm current 135, not the superseded 500).
2. `npm run mainnet:genesis:verify` against the clean-10 manifest → artifacts/mainnet_genesis_verify_report.json;
   set artifacts/MAINNET_GENESIS_VERIFIED.txt = true.
3. Rebaseline artifacts/mainnet_genesis_verify_input.json + the mainnet manifest/deploy-packet/dry-run pins to the
   clean-10 build hashes (the release-truth + m16 + m18 guards read these).
4. Rebaseline artifacts/CURRENT_FULL_TEST_SUMMARY.json (file count 116, test count, all pass).
5. Update web/platho-config.mjs: vault.deploymentManifestHash → clean-10 hash (addresses unchanged).
6. `npm run test` (full suite) → confirm 0 failures (the 8 posture reds clear).
7. `npm run web:deploy:prepare:prod` → production PWA bundle with the clean-10 manifest pinned.

## ONE-TIME PRE-CEREMONY ALSO REQUIRED
- Atomic commit of contracts + build + evidence + tests (release-evidence-rebaseline rule) BEFORE cutting the
  ceremony from the tree, so the deployed bytecode's evidence matches the commit.
- The client read-path (per-author/parent walk + computePublicAuthorKeyId) is NOT a contract blocker — it can
  ship before or after the seal; the contract serves correct reads regardless.

NOTE: line numbers / exact role-file names in the source runbook were inferred by the assembling agent — verify
against the actual scripts before relying on them.
