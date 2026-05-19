# Platho CapsuleHub milestone 2: Vault publish paths + ACK/excess

Scope implemented:

- `contracts/CapsuleHub.tact`
- `contracts/MockVaultAckSink.tact` for tests only
- direct private publish
- direct public publish
- Vault private publish path
- Vault public publish path
- immutable/mock Vault sender check
- CapsuleHubPublishAck to Vault after accepted Vault publish
- sequential `entry_id`
- `entry_uid` metadata hash
- page storage reserve accounting
- PLATO fee accrual
- amount-based `FlushFees(amount)`
- bounce recovery for FeeAccumulator fee flush
- no empty fallback behavior

Explicitly not implemented:

- real Vault contract
- Vault PendingPublish accounting
- Vault Message Budget accounting
- Vault ACK/excess routing
- Vault external session compact request
- UsernameRegistry
- BuybackBurn STON.fi execution
- deployment/seal checks

Commands run:

```bash
npm run build
npm run vectors
npm test -- --reporter=verbose
npm audit --omit=dev
```

Results:

```text
4 test files passed, 27 tests passed
npm audit --omit=dev: 0 vulnerabilities
```

Code hashes:

```text
CAPSULEHUB_CODE_HASH = f1868da18b4da289bd704d2d787e659f4a4cd8f2782fa50838464316c051a15a
CAPSULEHUB_CODE_BOC_SHA256 = 87a064a4c01801fe52f6d838b6d92cfcc732093222afd168534844ed3b58f646
MOCK_VAULT_ACK_SINK_CODE_HASH = a4a3767811ce6dfd4ad9794ca02e492c147bb5d894d2fce390e66cc632fc98f9
```

Important note:

`MockVaultAckSink` is test-only. It is not part of Platho v1 production contracts.

Vault publish paths are contract-side CapsuleHub receivers only. Full Vault integration remains a future milestone.
