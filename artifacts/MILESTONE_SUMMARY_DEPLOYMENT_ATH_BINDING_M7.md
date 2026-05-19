# Platho Milestone 7: Vault Deployment ATH Wallet Binding

Status: implemented and validated.

## Scope

This milestone fixes the DEPLOY-04A / official ATH wallet seal problem for Vault without bloating Vault with on-chain ATH wallet derivation code.

Implemented:

```text
Vault.BindOfficialAthWallet = 0x18DB2CCB
pre-seal official ATH wallet binding
Vault seal requires ATH wallet binding
post-seal ATH wallet rebinding rejected forever
Vault get_global exposes vault_ath_wallet_address
deployment ATH wallet binding vectors
test proving StateInit official wallet storage is circular
test proving bind -> seal -> frozen official wallet path
```

## Key decision

Do not store the final official ATH wallet in Vault StateInit as final data.

Reason:

```text
Vault address depends on Vault StateInit.
Vault official ATH wallet depends on Vault address.
Putting the final official ATH wallet into Vault StateInit changes Vault address.
That changes the official ATH wallet again.
```

The implementation therefore uses a placeholder in initial StateInit and one pre-seal deployment binding after Vault address exists.

## Tests

Added:

```text
tests/deployment-ath-wallet-binding.test.ts
```

New tests:

```text
DEPLOY-ATH-BIND-00: storing final official ATH wallet in Vault StateInit creates a self-address circularity
DEPLOY-04A/Vault: official ATH wallet is derived after Vault address exists, bound before seal, and frozen after seal
```

Updated:

```text
tests/deployment-binding.test.ts
tests/vault-m6-publish.test.ts
scripts/run-tests-m7.sh
vitest.all.config.ts
vitest.debug.config.ts
```

## Validation

Commands:

```bash
npm run build
npm audit --omit=dev --audit-level=high
npm test -- --reporter=dot
npx ts-node scripts/generate_deployment_ath_binding_vectors.ts
```

Results:

```text
build: OK
audit: found 0 vulnerabilities
Test Files: 12 passed
Tests: 63 passed
```

## Current code hashes

```text
ATH_WALLET_CODE_HASH=b94bf85fa69b23907e2dbd1940c6daad03f71ce36379a0f9cb1c63276d621918
ATHMASTER_CODE_HASH=ee5a80a35387ceafce2a89cc58fb94200152d19ee00347cff95ab1fb329abbcc
CAPSULEHUB_CODE_HASH=add81654c2263f725fcc93cf3c9caf3229c8f164870511b90f967174a953db85
FEEACCUMULATOR_CODE_HASH=ed272b10bc841ce09da511dbe3c10cffa89659791480d0390d3e7bbde08af503
MOCK_VAULT_ATH_WALLET_CODE_HASH=9dff854edded531aca8ae603427aa978f14ee45517b9ec97d51760b197353cad
VAULT_CODE_HASH=7509a56f5a0d38d0d2e0e6d26bcee39457de6b3d7372130db6e817933ad6b927
```

## Explicitly not implemented

```text
BuybackBurn
UsernameRegistry
Treasury receiver contract
STON.fi route
Vault.PrunePendingPublish
BuybackBurn / UsernameRegistry official ATH wallet binding
admin / owner override / pause / upgrade / governance / rescue / fallback
```
