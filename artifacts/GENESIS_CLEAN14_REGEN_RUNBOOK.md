# Genesis clean-13 → clean-14 evidence-regen runbook (F11 hardening)

deployment_id = `platho-mainnet-20260706-clean-14` (baked on-chain via ATH metadata).
Changed contracts: BuybackBurn (dead-man), ATHWallet (top-up) → ATHMaster cascade, MarketStabilitySeller (#3 floor 48M→58M).
Roles STAY (deployment_id bump forks ATHMaster → cascades to whole set on same vanity wallets).

## CRITICAL GOTCHAS
1. `artifacts/MAINNET_GENESIS_VERIFIED.txt` = `true` now → **flip to `false` FIRST** (before build) or release-truth tests fail. Flip back to `true` ONLY after on-chain mainnet:genesis:verify passes.
2. `PLATHO_ATH_DEPLOYMENT_ID` env is read ONLY by `mainnet:ath-metadata`. Forget it → silently bakes stale `clean-06`. Verify `artifacts/ath_metadata_content.json` fields.deployment_id == clean-14 right after.
3. `artifact_integrity_m18.ts` runs LAST (rehashes everything incl scripts/tests). Any later edit invalidates the lock.
4. COLLISION GATE (manual): after manifest:draft, diff new manifest.addresses vs live clean-13 (`mainnet_genesis_verify_input.json`) — intersection MUST be empty.
5. Phase G derivation-input JSONs need clean-14 values (from manifest:draft output) or they block.
6. `npm test` (canonical) NEVER bare `npx vitest run`.

## OFF-CHAIN REGEN (Phases A-I, autonomous)
A. Set `artifacts/MAINNET_GENESIS_VERIFIED.txt` → `false`. (+ update DEFAULT_DEPLOYMENT_ID line 12 → clean-14 belt-and-suspenders)
B. `npm run build` ; `node scripts/hash_codes.js`
C. `$env:PLATHO_ATH_DEPLOYMENT_ID="platho-mainnet-20260706-clean-14"; npm run mainnet:ath-metadata`  → verify fields.deployment_id
D. vectors+economics: npm run vectors ; generate_deployment_ath_binding_vectors ; generate_username_nft_item_vectors ; generate_username_registry_foundation_vectors ; generate_username_registry_mint_vectors ; username_registry_storage_economics ; capsulehub_storage_economics ; profile_registry_storage_economics ; ath_wallet_tombstone_economics ; gas_reserve_m17 ; publish_reserve_pricing
E. deployment_manifest_m15 ; conformance_m16
F. npm run mainnet:manifest:draft ; mainnet:deploy:packet ; mainnet:tx:dry-run   → **COLLISION GATE diff here**
G. edit mainnet_ath_master_derivation_input.json + m20f_mainnet_address_derivation_input.json to clean-14 → npm run mainnet:ath-master:derive ; m20f:derive-addresses
H. artifact_integrity_m18  (LAST)
I. `npm test` → 4 pinned tests green ; update CURRENT_FULL_TEST_SUMMARY.json counts
J. (POST on-chain deploy) collect_mainnet_genesis_snapshot ; mainnet:genesis:verify ; flip VERIFIED→true ; m18 again ; edit web/platho-config.mjs new addrs+manifest hash ; web:deploy:prepare[:prod] ; preprod:check

## PWA cutover (web/platho-config.mjs) — from manifest.addresses:
vault.address←vault; vault.deploymentManifestHash←manifest_hash_hex; capsuleHub.address←capsulehub; feeAccumulator.address←fee_accumulator; ath.masterAddress←ath_master; usernameRegistry.address←username_registry; profileRegistry.address←profile_registry. Bump provider ?v=.
