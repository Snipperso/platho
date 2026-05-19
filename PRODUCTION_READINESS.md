# Platho Production Readiness Gate

This file is the production freeze checklist. If any hard blocker below is still open, do not deploy mainnet production artifacts.

## Hard blockers

- Keep unsupported or non-standard TON wallet contracts fail-closed unless an on-chain `get_public_key` fallback is added.
- Replace preview wallet labels with real wallet and Vault-derived data.
- Configure `web/vault-ton-rpc-provider.mjs` with the production Vault address and TON RPC endpoint/API policy before trusting a messaging bundle.
- Switch `web/platho-config.mjs` to `mode: 'production'`, `network.chain: 'mainnet'`, and a static Vault provider module before creating the public production bundle.
- Keep testnet and mainnet configuration separated. Production deploys must not read `.env.testnet.local`.
- After deploying ATHMaster, execute the one-shot `DeployTreasurySupply` message from the final treasury owner and verify the official treasury ATH wallet balance equals the fixed total supply.
- Before sealing or publishing a production Vault genesis package, derive the official Vault ATH wallet from the final Vault StateInit and archive proof that it is funded with the full activity-airdrop allocation.
- Keep visible network labels, TonConnect manifest policy, and preview fixtures controlled through `web/platho-config.mjs`.
- Preserve the full-size M20T testnet harness evidence before changing any BuybackBurn readiness flag; M20T evidence alone is not a production unlock.
- Derive final mainnet BuybackBurn and official ATH wallet addresses from the production `BuybackBurn` StateInit. The M20T harness must never be selected as production BuybackBurn.
- Complete M20F mainnet STON.fi route freeze evidence before enabling production BuybackBurn. M20F must use STON.fi mainnet API simulation and official SDK/API transaction parameters, not hardcoded testnet route data.
- Keep BuybackBurn production readiness false until both M20T and M20F are complete.
- Do an external crypto review before treating the PWA encryption layer as production security.

## Required pre-prod commands

```powershell
npm.cmd run crypto:selftest
npm.cmd run mainnet:ath-master:derive
npm.cmd run m20f:address-preflight
npm.cmd run m20f:derive-addresses
npm.cmd run m20u:readiness
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

- `web/app.js` wires TonConnect UI, requests the generated proof payload, verifies standard wallet `walletStateInit`, and has a fail-closed Vault chain binding bridge. `web/vault-ton-rpc-provider.mjs` provides the static TON RPC provider skeleton; production still needs real Vault address, RPC endpoint/API policy, and mainnet config.
- The PWA now has no-backend public-key and encrypted-capsule package exchange. Production still needs final peer/key UX and operator review, but this path does not require a Platho server.
- QR/share UX is implemented for transport packages. Production should still decide the final peer verification ceremony and how users compare key fingerprints before first trust.
- Local message history is encrypted at rest with a device-local WebCrypto key. Production still needs backup/recovery UX so users understand that clearing browser storage destroys local history.
- `web/platho-config.mjs` is currently in `preview` mode and points the UI at testnet preview data.
- `.env.testnet.local` exists for faucet/testnet work.
- Full-size M20T testnet harness probe is complete: see `artifacts/m20t_testnet_evidence.json` and `artifacts/M20T_TESTNET_EVIDENCE.md`.
- M20F STON.fi live collector is prepared: see `artifacts/m20f_stonfi_live_collector_input_template.json` and `artifacts/M20F_STONFI_LIVE_COLLECTOR.md`. It is expected to stay `WAITING_FOR_FINAL_MAINNET_INPUT` until final mainnet addresses and proof refs are supplied.
- Production `contracts/BuybackBurn.tact` is present and built. M20F address-unlock preflight is tracked in `artifacts/m20f_mainnet_address_unlock_preflight.json`; current status may be `READY_FOR_MAINNET_ADDRESS_DERIVATION`, but this is not a production unlock.
- ATHMaster now has an explicit one-shot treasury supply deployment surface. Deriving the ATHMaster address is not enough by itself; the treasury supply deployment transaction and official treasury ATH wallet balance proof must be captured before treating ATH as live.
- BuybackBurn local freeze was reopened after external Round 6 audit findings; the current candidate includes reserve, min-out, and query-lifecycle hardening. This does not unlock production route seal.
- M20F mainnet route-freeze preflight is tracked in `artifacts/m20f_mainnet_route_freeze_preflight.json`; current status is expected to stay blocked until final mainnet ATH/BuybackBurn addresses, STON.fi API simulation, official tx params, code hashes, and refund/excess/failure proofs are supplied.
- BuybackBurn remains locked by M20F mainnet STON.fi route-freeze evidence and production review gates.
