# Platho ATH milestone 2.1: burn finalization + bounce/failure safety proof

Scope implemented:

- `contracts/ATHWallet.tact`
- `contracts/ATHMaster.tact`
- authenticated ATH burn request from owner through official ATH wallet
- ATH Master burn finalization from deterministic official ATH wallet only
- `total_supply` decreases exactly by burned amount
- wallet balance decreases exactly by burned amount on successful burn
- direct arbitrary burn notification to master rejected
- wrong owner cannot burn another wallet owner balance
- transfer-to-dead-address is not treated as burn
- underfunded burn does not debit wallet without total_supply decrease
- burn notification bounce/failure restores wallet balance
- `npm test` now runs all test files, not only derivation tests
- tooling packages moved to `devDependencies`; `npm audit --omit=dev` returns 0 vulnerabilities
- wallet derivation vectors regenerated after wallet code changed for bounce-safe burn support

Explicitly not implemented:

- Vault seal checks
- BuybackBurn seal checks
- UsernameRegistry seal checks
- FeeAccumulator
- Vault
- CapsuleHub
- UsernameRegistry
- BuybackBurn
- STON.fi route
- admin/owner override/pause/upgrade/governance/rescue/fallback paths

Commands run:

```bash
npm install
npm audit --omit=dev
npm run build
npm run vectors
npm test -- --reporter=verbose
```

Results:

```text
ATH_WALLET_CODE_HASH = b94bf85fa69b23907e2dbd1940c6daad03f71ce36379a0f9cb1c63276d621918
npm audit --omit=dev: 0 vulnerabilities
vitest: 2 test files passed, 8 tests passed
```

Important note:

The ATH wallet code hash changed again because bounce recovery required changing the `ATHBurnNotification` field order and adding a bounced-message receiver in `ATHWallet`. This is expected. The milestone 2.1 hash supersedes all earlier ATH wallet hashes for subsequent open-values profiles.

Caveat:

The derivation vectors still use deterministic fixture owner addresses for Vault/BuybackBurn/UsernameRegistry/Treasury/User labels. They prove the derivation invariant and are not final deployment manifest seal vectors until actual contract addresses are pinned.
