# Vault Freeze Summary - 2026-05-17

Status: FROZEN_LOCALLY_REVERIFIED_AFTER_ATH_EXEC_RESERVE_HARDENING

This freezes the current Vault implementation after the final local security and regression pass.
The freeze was reopened and repeated because CapsuleHub ACK reserve hardening changes the shared Vault max-charge constant and therefore the Vault code hash.
It was revalidated again after ATHWallet/ATHMaster execution-reserve hardening changed ATH-linked code, StateInit, and deployment manifest hashes.

## Scope

Frozen scope:

- `contracts/Vault.tact`
- production Vault integration with `ATHWallet`
- Vault ATH deposit/withdraw accounting
- Vault TON deposit/withdraw accounting
- session lifecycle and external publish gate
- receive-intent claim/cancel flows
- stale pending publish prune flow
- Vault-side activity airdrop accounting

This is a local engineering freeze. It is not an independent third-party audit, formal proof, or final genesis release approval.

## Final Verification

Commands completed successfully on 2026-05-17:

```text
npm run build
npm test -- tests/vault-session-lifecycle.test.ts tests/vault-key-records.test.ts tests/vault-receive-intent.test.ts tests/vault-ath-integration.test.ts tests/vault-ath-invariants.test.ts tests/vault-ton-state-invariants.test.ts tests/vault-boundary-negative.test.ts tests/vault-auth-negative-matrix.test.ts tests/vault-external-session-gate.test.ts tests/vault-m6-publish.test.ts tests/vault-prune-pending-publish.test.ts
npm test -- tests/ath-wallet-transfer.test.ts tests/ath-wallet-derivation.test.ts tests/ath-burn-finalization.test.ts
npm test -- tests/m17-gas-reserve-sanity.test.ts tests/m18-artifact-integrity.test.ts tests/m16-conformance-static.test.ts tests/deployment-manifest-m15.test.ts tests/deployment-ath-wallet-binding.test.ts
npm test
npm audit --omit=dev
```

Results:

```text
Vault focused suite: 11 files passed, 40 tests passed
ATH focused suite: 3 files passed, 11 tests passed
Conformance/artifact/gas/deployment suite: 5 files passed, 12 tests passed
CapsuleHub/Vault ACK regression suite: 7 files passed, 32 tests passed
Full suite: 44 files passed, 172 tests passed
npm audit --omit=dev: found 0 vulnerabilities
```

Post-ATH execution-reserve revalidation on 2026-05-17:

```text
Impacted ATH/Vault/Username suite: 11 files passed, 42 tests passed
Expanded ATH/artifact suite: 17 files passed, 59 tests passed
Full suite: 46 files passed, 178 tests passed
npm audit --omit=dev: found 0 vulnerabilities
```

## Frozen Hashes

```text
VAULT_CODE_HASH=ec268816c42d788b55bd171a32b81d40073cb7f242c48138d521185508914353
CAPSULEHUB_CODE_HASH=2522af15971a775b873a335c6637e961ab8a54d29446738f7c8390449c5c6cf6
ATH_WALLET_CODE_HASH=a4ca0258ce36f72c4bab250c5ead87bc6db1b0ebe3832bad8c6961efaaedc730
ATHMASTER_CODE_HASH=33e4c62fa48e4f6d8b3b93a00e025485c18a6b81efcd055768508c215b88cfbf
USERNAME_REGISTRY_CODE_HASH=6cc5a428588f43a706047ea2ae6595726596b17ee54c8703cdc9c8239a6d0742
IMPLEMENTED_SUBSET_MANIFEST_HASH=a1eecf7c96cc2bd7fdf88cf460d418b431c6d97649c05a0bd93a185c3935765f
```

Manifest status:

```text
IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS
```

## Local Security Notes

No real Vault bug or vulnerability remains known after this pass.

The freeze includes local coverage for:

- duplicate ATH deposit replay by sender/query_id;
- ATH withdrawal success, failure callback, and bounce recovery;
- underfunded ATH notify and withdraw boundaries;
- forged ATH and CapsuleHub callback rejection;
- TON/session/budget/receive-intent deterministic state-machine invariants;
- ATH backing invariant between internal balances and official Vault ATH wallet balance;
- ATHWallet/ATHMaster caller-funded execution-reserve hardening revalidated against Vault ATH integration paths;
- min-1 and exact-min value boundary checks for selected handlers;
- full suite regression and production dependency audit.

## Residual Non-Code Gates

Before final genesis/mainnet release, these remain outside the Vault local freeze:

- independent Tact/security review;
- testnet/mainnet gas envelope evidence for money-flow and async callback paths;
- final storage-rent/economic policy for permanent replay/idempotency maps;
- final deployment manifest replacement of non-final global blockers;
- BuybackBurn and STON.fi production route gates where applicable.

## Freeze Rule

Any future change to frozen Vault scope must reopen this freeze and repeat:

```text
npm run build
Vault focused suite
ATH focused suite
Conformance/artifact/gas/deployment suite
npm test
npm audit --omit=dev
```
