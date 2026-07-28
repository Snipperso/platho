# Platho Production Readiness Gate

This file is the production freeze checklist. Production artifacts must follow the release gates below and the live verifier evidence in `artifacts/mainnet_genesis_verify_report.json`.

For the short release-order sheet and exact funding table, use `MAINNET_RELEASE_CHECKLIST.md` as the operational go/no-go checklist.

## Canonical ATH Tokenomics

The canonical ATH allocation for this release is:

- `15,000,000 ATH` activity airdrop;
- `15,000,000 ATH` initial ATH/TON liquidity;
- `10,000,000 ATH` long-term protocol vesting reserve;
- `60,000,000 ATH` MarketStabilitySeller reserve.

`MarketStabilitySeller` is intentionally configured for `20` tranches of `3,000,000 ATH`, from `x2` through `x21` of the initial pool price.

The `10,000,000 ATH` long-term reserve is not a liquid operations bucket. It is held by immutable `ATHVesting`, backed by its official ATH wallet, and unlocks only `100,000 ATH` per 365-day period across `100` periods. There is no acceleration, beneficiary change, pause, admin sweep, or rescue drain.

Any audit note that expects the older lower-reserve, shorter-seller schedule is based on an obsolete tokenomics brief and should be treated as spec drift, not as a contract finding.

## Release gates

- Mainnet genesis evidence must be live verified: `artifacts/MAINNET_GENESIS_VERIFIED.txt` is `true`, `mainnet:genesis:verify` passes, and the verified manifest hash comes from the final live verifier report, not a hand-maintained docs value.
- `web/platho-config.mjs` must be pinned to the verified mainnet Vault, CapsuleHub, ATHMaster, UsernameRegistry, ProfileRegistry, manifest hash, and production signed-bundle purpose before publishing the production PWA bundle.
- Production TON RPC configuration must use approved mainnet providers. Critical reads stay fail-closed on disagreement or missing verification while a primary transport is healthy, and CapsuleHub message-history reads must have at least one concrete provider with message-history support.
- Censorship survival is a release requirement: the production config must include a keyless verifier-only emergency fallback provider (direct TonCenter) with concrete read, send, and message-history endpoints (`PWA_TON_RPC_EMERGENCY_FALLBACK_REQUIRED`). If the Platho RPC gateway is blocked or unreachable, the transport parks it after repeated hard failures, promotes the emergency provider to full duty at its ~1 rps budget, and re-probes the gateway on a retry window. In that degraded single-provider mode dual-provider verification is structurally impossible, so own-action pre-sign reads may fall back to unverified reads through `callWithDegradedTransportReadFallback`; trust-critical recipient key verification gates remain fail-closed. Post-broadcast nonce polling is always unverified and tolerant because the publish outcome is re-authenticated by CapsuleHub confirmation. The TonCenter API key never ships in the static bundle; the direct emergency endpoints are keyless by design.
- TON DNS support must remain fail-closed. If the production bundle exposes `.ton` recipient resolution, the TON DNS root/provider configuration must be present and verified through the same approved RPC transport path.
- Keep testnet and mainnet configuration separated. Production deploys and production PWA packaging must not read `.env.testnet.local`.
- The one-shot `ATHMaster.DeployTreasurySupply` transaction is complete and must remain backed by the verified treasury owner ATH wallet balance of `100,000,000 ATH`.
- Vault activity airdrop backing is complete: the official Vault ATH wallet is funded with `15,000,000 ATH` and the live verifier proves that backing before user publish rewards are live.
- ATHVesting backing is complete: the official ATHVesting ATH wallet is funded with `10,000,000 ATH`, with no acceleration, beneficiary change, pause, admin sweep, or rescue drain.
- Final ATH allocation is fixed as `15%` activity airdrop, `15%` initial liquidity, `10%` long-term protocol vesting, and `60%` market stability reserve.
- `10 ATH` per finalized capsule is an activity bonus for real usage, not a refund, cashback, reimbursement, investment return, or price guarantee.
- Platho message pricing is network cost plus the `0.010 TON` protocol-fee component before the ATH discount floor. Protocol fees before pool launch are not expected to fully fund the TON side of initial liquidity; the initial pool may require project/treasury funding in addition to protocol revenue.
- MarketStabilitySeller pricing freeze is a real one-time launch authority after pool launch: it sets the base tranche price once from pool-launch evidence. It cannot steal funds, pause, rescue, or mutate pricing after freeze, but production docs must not describe it as if no authority exists.
- FeeAccumulator buyback split enable is a real one-time authority held by the immutable treasury receiver. It is not admin/rescue/pause and cannot steal funds, but it permanently changes fee economics from bootstrap treasury-only accumulation to the 50/50 treasury/buyback split. It must be called only after `buyback:enable-preflight` passes.
- MarketStabilitySeller runtime permits partial reserve funding and partial sales, but release readiness must not mark the seller ready until `reserve_due_ath == 60,000,000 ATH`, `reserve_funded_total_ath == 60,000,000 ATH`, and the official seller ATH wallet backs at least `60,000,000 ATH`.
- MarketStabilitySeller reserve funding must use the bound reserve funder notify-flow into the official seller ATH wallet. Manual ordinary ATH transfer to the official seller ATH wallet is unsupported, is not tracked reserve, does not increase sellable supply, and can remain stuck.
- Serve the production PWA with the checked-in static hosting security headers. At minimum the final `platho.app` host must enforce `Content-Security-Policy` with `default-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'` for the bundled WebP encoder, `connect-src` limited to same-origin and approved production TON RPC hosts (`https://toncenter.com` and `https://*.toncenter.com`), `object-src 'none'`, `base-uri 'none'`, `frame-ancestors https://web.telegram.org` (allows the Telegram Mini App iframe), plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`. The bundle intentionally has no inline scripts and no inline import map (vendor modules use relative imports), so `script-src` carries no content hashes and old Safari without import-map support can still boot; the plain-script `boot-guard.js` watchdog must stay in `index.html` so a dead module graph shows a diagnostic screen instead of a dark shell.
- The service worker install cache must include the runtime noble vendor modules imported by the local wallet and message crypto graph. A production PWA must not depend on accidental browser HTTP cache state for first offline launch.
- Seal production BuybackBurn with `route_frozen = false`; the ATH/TON STON.fi pool is created only after the 15% activity-distribution gate.
- Complete M20F mainnet STON.fi route freeze evidence before calling the one-time post-pool `FreezeBuybackRoute`. M20F must use STON.fi mainnet API simulation and official SDK/API transaction parameters, not hardcoded testnet route data.
- Production buyback execution is a fixed-floor route, not a dynamic best-price bot. `ExecuteBuybackChunk` must use the one-time frozen quote and `dex_min_out`; if the market moves away from that floor the route must refund/fail closed, and if the market moves in favor of ATH the contract still protects only the frozen minimum.
- The official BuybackBurn ATH wallet is not a deposit address. Ordinary ATH transfers into that wallet are untracked by `BuybackBurn`, do not create burn retry due, do not increment burned totals, and should be treated by monitoring as an unexpected stuck balance warning.
- Buyback burn success is proven only when BuybackBurn receives `ATHBurnFinalized` from ATHMaster. An ATHWallet burn notification or outbound burn request is not a success signal and must not be treated by docs, dashboards, or indexers as completed buyback burn.
- Keep BuybackBurn route readiness false until M20F is complete and the post-pool route is frozen.

## Release Gate Chain And Authorities

No post-pool readiness script replaces final genesis verification. The production chain is:

```text
final manifest
-> live getter snapshot
-> mainnet:genesis:verify PASS
-> production PWA mainnet release
-> 15,000,000 ATH activity airdrop distribution through Vault
-> Vault airdrop_remaining_ath == 0 proof
-> initial ATH/TON pool launch
-> post-pool route/pricing preflights and freezes
-> seller readiness / buyback enable preflights
-> reserve funding / EnableBuybackSplit
```

M20F route preflight, M20T harness evidence, and MarketStabilitySeller readiness are supplemental gates after final genesis verification. They must not be used as substitutes for `mainnet:genesis:verify`. The M20T harness must never appear in the production manifest as the production BuybackBurn or official BuybackBurn ATH wallet.

The protocol has narrow one-shot or one-way authorities. They are not rescue, pause, upgrade, admin drain, or arbitrary balance-control levers, but they are still authorities and must stay named in release docs:

- `ath_treasury_owner` sends the one-shot `ATHMaster.DeployTreasurySupply`.
- `genesis_controller_one_shot` performs pre-seal binding and seal actions.
- BuybackBurn launch controller performs the one-time post-pool route freeze.
- MarketStabilitySeller launch controller performs the one-time post-pool pricing freeze.
- FeeAccumulator treasury receiver performs the one-way `EnableBuybackSplit` after preflight.

Current release manifests intentionally use the same address for `genesis_controller_one_shot`,
`buyback_burn_launch_controller`, and `market_stability_seller_launch_controller`. That controller
is narrow, but it is not retired after seal. It must remain secured until BuybackBurn has
`route_frozen == true` and `genesis_config_hash == 0`, and MarketStabilitySeller has
`pricing_frozen == true` and `genesis_config_hash == 0`.

## Required before production PWA release

```powershell
npm.cmd run crypto:selftest
npm.cmd run mainnet:ath-master:derive
npm.cmd run m20f:address-preflight
npm.cmd run m20f:derive-addresses
npm.cmd run m20u:readiness
npm.cmd audit --json
npm.cmd test
npm.cmd run build
npm.cmd run mainnet:manifest:draft
npm.cmd run mainnet:deploy:packet
npm.cmd run mainnet:tx:dry-run
npm.cmd run mainnet:genesis:verify
npm.cmd run preprod:check
npm.cmd run web:deploy:prepare:prod
```

`preprod:check` is a release gate. It must pass before a production static bundle is published.
`web:deploy:prepare:prod` uses the same production blockers and must not be bypassed for the public `platho.app` bundle.

## Required only after airdrop and pool launch

These commands are post-pool gates. They must not be treated as blockers for the production PWA release, and they must never replace `mainnet:genesis:verify`.

```powershell
npm.cmd run m20f:collect
npm.cmd run m20f:preflight
npm.cmd run market-stability:readiness
npm.cmd run buyback:enable-preflight
```

## Current Operational Notes

- `web/app.js` uses a normal 24-word TON recovery phrase as the single user secret, derives wallet and messaging keys from that phrase, and has a fail-closed Vault chain binding bridge.
- The PWA now anchors public messaging keys in Vault records and publishes private messages through CapsuleHub payload cells. Manual public-bundle / capsule package exchange is removed from the production UI.
- Local message history is encrypted at rest with a device-local WebCrypto key. The profile UI exports/imports only the 24-word TON recovery phrase; messaging keys are deterministically derived from that phrase and are not backed up separately.
- `web/platho-config.mjs` must be pinned to the verified mainnet manifest and `pwa-production` signed-bundle purpose before publishing the production PWA. `MAINNET_GENESIS_VERIFIED.txt` returns `false`: the release evidence was rebaselined onto **clean-17** on 2026-07-28 by owner decision, and the clean-17 genesis has not been deployed. The previously verified deployment was clean-15; that record is deliberately retired rather than carried forward, because clean-17 supersedes it and keeping a `true` flag would have asserted verification of a contract set that differs from the current build in every one of its 14 manifest code hashes. Until the ceremony runs and a live getter snapshot passes `mainnet:genesis:verify`, the **current archive may still be preview-blocked** and the production bundle reports the single blocker `MAINNET_GENESIS_NOT_VERIFIED`. Treat `artifacts/mainnet_genesis_verify_report.json`, `artifacts/MAINNET_GENESIS_VERIFIED.txt`, and `preprod:check` as the source of truth; the manifest hash to pin is the one the ceremony emits, never a hash copied from a previous generation.
- `.env.testnet.local` may exist in a developer workspace for faucet/testnet work; it must remain untracked and absent from release/audit archives.
- Full-size M20T testnet harness probe is complete: see `artifacts/m20t_testnet_evidence.json` and `artifacts/M20T_TESTNET_EVIDENCE.md`.
- M20F STON.fi live collector is prepared: see `artifacts/m20f_stonfi_live_collector_input_template.json` and `artifacts/M20F_STONFI_LIVE_COLLECTOR.md`. It is expected to stay `WAITING_FOR_FINAL_MAINNET_INPUT` until final mainnet addresses and proof refs are supplied.
- Production `contracts/BuybackBurn.tact` is present and built. M20F address-unlock preflight is tracked in `artifacts/m20f_mainnet_address_unlock_preflight.json`; current status may be `READY_FOR_MAINNET_ADDRESS_DERIVATION`, but this is not a production unlock.
- ATHMaster now has an explicit one-shot treasury supply deployment surface. Deriving the ATHMaster address is not enough by itself; the treasury supply deployment transaction and official treasury ATH wallet balance proof must be captured before treating ATH as live.
- BuybackBurn local freeze was reopened after external Round 6 audit findings; the current candidate includes reserve, min-out, query-lifecycle hardening, and a post-pool route-freeze gate. This does not unlock production route freeze or execution.
- CapsuleHub v1 accepts retrievable publish body cells in Vault -> CapsuleHub transactions and persists compact authenticated entry state (`body_hash`, headers, `created_at`, and indexes). A state record without the matching accepted publish transaction body is not a readable v1 message; a counter-only, anchor-only, off-chain pointer, or local-cache-only message record is not valid.
- Storage top-up ABI coverage is explicit for Vault, CapsuleHub, FeeAccumulator, BuybackBurn, UsernameRegistry, and UsernameNFTItem. Top-up messages are no-authority storage reserve maintenance only, not balances or rescue paths.
- M20F mainnet route-freeze preflight is tracked in `artifacts/m20f_mainnet_route_freeze_preflight.json`; current status is expected to stay blocked until the post-15% ATH/TON pool exists and final mainnet STON.fi API simulation, official tx params, code hashes, and refund/excess/failure proofs are supplied.
- BuybackBurn remains locked by the one-time post-pool route-freeze gate and production review gates.
- MarketStabilitySeller post-pool readiness is tracked by `npm.cmd run market-stability:readiness`. It must stay blocked until final pool launch price evidence, exact base-price match, pricing-freeze transaction proof, official seller ATH wallet funding proof, getter snapshot, and code-hash evidence are supplied.
- `market-stability:readiness` is not a substitute for `mainnet:genesis:verify`. The release order is `mainnet:genesis:verify` PASS (which already certifies the `60,000,000 ATH` reserve funded and locked into the seller at genesis via authenticated reserve funding), then production PWA release, then full `15,000,000 ATH` activity airdrop distribution, then initial pool launch, then post-pool pricing freeze, then `market-stability:readiness` PASS. Do not run the seller readiness script as a standalone production gate.
