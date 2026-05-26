# Platho Production Readiness Gate

This file is the production freeze checklist. If any hard blocker below is still open, do not deploy mainnet production artifacts.

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

## Hard blockers

- Replace preview wallet labels with real embedded Platho wallet and Vault-derived data.
- Configure `web/vault-ton-rpc-provider.mjs` with the production Vault address and TON RPC endpoint/API policy before trusting a messaging bundle.
- Switch `web/platho-config.mjs` to `mode: 'production'`, `network.chain: 'mainnet'`, and a static Vault provider module before creating the public production bundle.
- Keep testnet and mainnet configuration separated. Production deploys must not read `.env.testnet.local`.
- After deploying ATHMaster, execute the one-shot `DeployTreasurySupply` message from the final treasury owner and verify the official treasury ATH wallet balance equals the fixed total supply.
- Before sealing or publishing a production Vault genesis package, derive the official Vault ATH wallet from the final Vault StateInit and archive proof that it is funded with the full activity-airdrop allocation.
- Final ATH allocation is fixed as `15%` activity airdrop, `15%` initial liquidity, `10%` long-term protocol vesting, and `60%` market stability reserve. `ATHVesting` must be backed by exactly `10,000,000 ATH` in its official ATH wallet at final genesis. `MarketStabilitySeller` implements the x2..x21 tranche policy; the reserve must stay inert until final pool-launch pricing evidence is frozen by the one-time launch controller and the official seller ATH wallet funding proof is archived.
- MarketStabilitySeller pricing freeze is a real one-time launch authority: it sets the base tranche price once from pool-launch evidence. It cannot steal funds, pause, rescue, or mutate pricing after freeze, but production docs must not describe it as if no authority exists.
- FeeAccumulator buyback split enable is a real one-time authority held by the immutable treasury receiver. It is not admin/rescue/pause and cannot steal funds, but it permanently changes fee economics from bootstrap treasury-only accumulation to the 50/50 treasury/buyback split. It must be called only after `buyback:enable-preflight` passes.
- MarketStabilitySeller runtime permits partial reserve funding and partial sales, but release readiness must not mark the seller ready until `reserve_due_ath == 60,000,000 ATH`, `reserve_funded_total_ath == 60,000,000 ATH`, and the official seller ATH wallet backs at least `60,000,000 ATH`.
- MarketStabilitySeller reserve funding must use the bound reserve funder notify-flow into the official seller ATH wallet. Manual ordinary ATH transfer to the official seller ATH wallet is unsupported, is not tracked reserve, does not increase sellable supply, and can remain stuck. Readiness treats official seller ATH wallet balance above `60,000,000 ATH` as a readiness warning only, not as a blocker.
- Keep visible network labels, embedded wallet policy, and preview fixtures controlled through `web/platho-config.mjs`.
- Preserve the full-size M20T testnet harness evidence before changing any BuybackBurn readiness flag; M20T evidence alone is not a production unlock.
- Derive final mainnet BuybackBurn and official ATH wallet addresses from the production `BuybackBurn` StateInit. The M20T harness must never be selected as production BuybackBurn.
- Seal production BuybackBurn with `route_frozen = false`; the ATH/TON STON.fi pool is created only after the 15% activity-distribution gate.
- Complete M20F mainnet STON.fi route freeze evidence before calling the one-time post-pool `FreezeBuybackRoute`. M20F must use STON.fi mainnet API simulation and official SDK/API transaction parameters, not hardcoded testnet route data.
- Buyback burn success is proven only when BuybackBurn receives `ATHBurnFinalized` from ATHMaster. An ATHWallet burn notification or outbound burn request is not a success signal and must not be treated by docs, dashboards, or indexers as completed buyback burn.
- Keep BuybackBurn production readiness false until both M20T and M20F are complete.
- Do an external crypto review before treating the PWA encryption layer as production security.

## Release Gate Chain And Authorities

No post-pool readiness script replaces final genesis verification. The production chain is:

```text
final manifest
-> live getter snapshot
-> mainnet:genesis:verify PASS
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

## Required pre-prod commands

```powershell
npm.cmd run crypto:selftest
npm.cmd run mainnet:ath-master:derive
npm.cmd run m20f:address-preflight
npm.cmd run m20f:derive-addresses
npm.cmd run m20u:readiness
npm.cmd run market-stability:readiness
npm.cmd run m20f:collect
npm.cmd run m20f:preflight
npm.cmd audit --json
npm.cmd test
npm.cmd run build
npm.cmd run preprod:check
npm.cmd run web:deploy:prepare:prod
```

`preprod:check` is expected to fail while testnet data, unverified wallet public-key lookup, or missing chain lookup remains in the app. A passing `preprod:check` should be treated as a release gate, not as a casual lint.
`web:deploy:prepare:prod` uses the same production blockers and must not be bypassed for the public `platho.app` bundle.

## Current intentional non-prod markers

- `web/app.js` uses an embedded Platho wallet seed as the single user secret, derives wallet and messaging keys from that seed, and has a fail-closed Vault chain binding bridge. `web/vault-ton-rpc-provider.mjs` provides the static TON RPC provider skeleton; production still needs real Vault address, RPC endpoint/API policy, and mainnet config.
- The PWA now anchors public messaging keys in Vault records and publishes private messages through CapsuleHub payload cells. Manual public-bundle / capsule package exchange is removed from the production UI.
- Local message history is encrypted at rest with a device-local WebCrypto key. The profile UI exports/imports only the Platho wallet seed; messaging keys are deterministically derived from that seed and are not backed up separately.
- `web/platho-config.mjs` is currently in `preview` mode and points the UI at testnet preview data.
- `.env.testnet.local` exists for faucet/testnet work.
- Full-size M20T testnet harness probe is complete: see `artifacts/m20t_testnet_evidence.json` and `artifacts/M20T_TESTNET_EVIDENCE.md`.
- M20F STON.fi live collector is prepared: see `artifacts/m20f_stonfi_live_collector_input_template.json` and `artifacts/M20F_STONFI_LIVE_COLLECTOR.md`. It is expected to stay `WAITING_FOR_FINAL_MAINNET_INPUT` until final mainnet addresses and proof refs are supplied.
- Production `contracts/BuybackBurn.tact` is present and built. M20F address-unlock preflight is tracked in `artifacts/m20f_mainnet_address_unlock_preflight.json`; current status may be `READY_FOR_MAINNET_ADDRESS_DERIVATION`, but this is not a production unlock.
- ATHMaster now has an explicit one-shot treasury supply deployment surface. Deriving the ATHMaster address is not enough by itself; the treasury supply deployment transaction and official treasury ATH wallet balance proof must be captured before treating ATH as live.
- BuybackBurn local freeze was reopened after external Round 6 audit findings; the current candidate includes reserve, min-out, query-lifecycle hardening, and a post-pool route-freeze gate. This does not unlock production route freeze or execution.
- CapsuleHub v1 is now explicitly counter-only / anchor-only; no production bundle may assume on-chain page-map retrieval unless a future CapsuleHub interface change reopens audit and code hashes.
- Storage top-up ABI coverage is explicit for Vault, CapsuleHub, FeeAccumulator, BuybackBurn, UsernameRegistry, and UsernameNFTItem. Top-up messages are no-authority storage reserve maintenance only, not balances or rescue paths.
- M20F mainnet route-freeze preflight is tracked in `artifacts/m20f_mainnet_route_freeze_preflight.json`; current status is expected to stay blocked until the post-15% ATH/TON pool exists and final mainnet STON.fi API simulation, official tx params, code hashes, and refund/excess/failure proofs are supplied.
- BuybackBurn remains locked by the one-time post-pool route-freeze gate and production review gates.
- MarketStabilitySeller post-pool readiness is tracked by `npm.cmd run market-stability:readiness`. It must stay blocked until final pool launch price evidence, exact base-price match, pricing-freeze transaction proof, official seller ATH wallet funding proof, getter snapshot, and code-hash evidence are supplied.
- `market-stability:readiness` is not a substitute for `mainnet:genesis:verify`. The release order is `mainnet:genesis:verify` PASS, then post-pool pricing freeze, then reserve funding, then `market-stability:readiness` PASS. Do not run the seller readiness script as a standalone production gate.
