# Genesis clean-14 → clean-15 evidence-regen runbook (username NFT TEP-62 transfer fix)

deployment_id = `platho-mainnet-20260707-clean-15` (baked on-chain via ATH metadata).
Changed contracts: UsernameNFTItem (reference TEP-62 NftTransfer: explicit-rest excesses replacing
mode-64 double-count, addr_none response_destination via manual body parse, dynamic forward-fee
allowance = max(10M, readForwardFee()*2)) → UsernameRegistry cascade (initOf embed).
Roles STAY (deployment_id bump forks ATHMaster → cascades to whole set on same vanity wallets).

Motivation: sealed clean-14 UsernameNFTItem paid ~forward_amount from its own balance per transfer
(mode-64 excesses defect) → GetGems' server-side pre-flight (createCartTx, synthetic ~0.0505 item
balance) rejected every listing; usernames could not be sold on GetGems. Vault.BindUsernameRegistry
is requireUnsealed() → no partial redeploy possible → full genesis fork.
Evidence: artifacts/getgems-sale-emulation-20260707/ (root cause, GetGems flow reverse-engineering,
fixed-code e2e: list at 0.0505 passes, buy, cancel; adversarial review SOUND / 0 critical).

## OFF-CHAIN REGEN — DONE 2026-07-07 (Phases A–I per GENESIS_CLEAN14_REGEN_RUNBOOK.md)
- VERIFIED→false; DEFAULT_DEPLOYMENT_ID→clean-15; npm run build; hash_codes
  (USERNAME_NFT_ITEM eccbea50…, USERNAME_REGISTRY 89cf0458…).
- ath-metadata (contentHash 3ca983ee…); ALL vectors+economics regenerated
  (incl. username_nft_item_vectors + username_registry_storage_economics — the two the
  adversarial review flagged as easy to miss); M15+M16; manifest:draft
  (manifest d9ca407acd7a9cdb5b3ee26cbd122b73fea79e6f7f12fb7445c1a64516e57a16) + deploy:packet +
  tx:dry-run; COLLISION GATE vs live clean-14 = CLEAN; derivation inputs re-pointed
  (ath_master clean-15 UQAMx3PgZCEDrGtsOcfK82wONP8RkMRHSR-4DDTUuEIFcF6b) + derives; M18 PASS (34);
  PRODUCTION_READINESS re-worded to clean-15-prep; genesis:verify → expected STALE/BLOCKED;
  web deploy preps → productionReady=false; full suite GREEN 125 files / 1165 tests.
- Note: run ts-node scripts with `--compiler-options {"module":"CommonJS"}` (bare `npm run vectors`
  hits the ESM resolver and fails to import build/ bindings).

## Key clean-15 addresses (from artifacts/local/mainnet_final_manifest_draft.json)
ath_master UQAMx3PgZCEDrGtsOcfK82wONP8RkMRHSR-4DDTUuEIFcF6b
vault UQAFsNc952nbwLMDfHqXExkgn1lipVzNndbNQKBfHEIEe5Zy
capsulehub UQD1Qj4S3F4IAMku5M_xc5IFBPhHR7DeakWZDGURjDtCGrx9
buyback_burn UQBoOuHT0NhmZfHbm_wOquj3hA1BYUO84EKoqQ-X85UrLYgj
market_stability_seller UQCeAPYtO5x57C1wvXPFMapKWOAu6GaNBUZduVjYNG1ZBL1x
fee_accumulator UQASbM-7--CIRVhLUSvT9E5JVxTwURQ20AoAqNj9IPP-Ponr
username_registry UQBhlvF4qNpc6PLN2-X9hgVqlq-6k2DJRtxkGbrgBkZL-nMI
profile_registry UQAkt_x_FRJxT0TevI5KTcExz1wTp412Hq47h4F3F1z2u3Jr
ath_long_term_vesting UQCQWDxoOOFLX-ylqlzq3cm8eZGRnZUbwqAQv8a9L_lYZdAI

## STILL PENDING (Phase J — needs owner vanity-wallet keys + real TON)
1. On-chain ceremony: deploy → bind → seal (art dicts: 56 glyph parts + 3 collection-meta) →
   fund → collect_mainnet_genesis_snapshot → mainnet:genesis:verify PASS.
2. Flip MAINNET_GENESIS_VERIFIED→true; re-run M18; re-run full suite.
3. ATH redistribution (Vault 15M / Vesting 10M / MSS reserve 60M / treasury 15M) + burn clean-14 ATH.
4. PWA cutover: web/platho-config.mjs → clean-15 addresses + manifest hash; version cascade;
   web:deploy:prepare:prod; preprod:check; deploy via the proven Bash tar→SSH path.
5. RE-MINT the 5 live usernames on the new registry (owners: platho.ath + support.ath = owner
   wallet 0:d4e3…; sexybitch.ath 0:d989…; autodeff.ath 0:9697…; moonly.ath 0:1171…) — decide the
   ATH compensation for the 3 tester-owned names (100 ATH each from treasury).
6. GetGems e2e ON THE REAL SITE: list a username via the GetGems UI (pre-flight must now pass at
   its synthetic 0.0505 balance), verify the listing renders, then buy/cancel.
