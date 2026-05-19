# Platho deployment binding milestone: Vault ↔ CapsuleHub pre-seal circular binding

Scope implemented:

- `Vault.OP_BIND_DEPLOYMENT_MANIFEST`
- `Vault.OP_SEAL_GENESIS`
- `CapsuleHub.OP_BIND_DEPLOYMENT_MANIFEST`
- `CapsuleHub.OP_SEAL_GENESIS`
- Vault can start with `capsule_hub_address` unbound and bind the actual CapsuleHub address exactly once before seal
- CapsuleHub can start with `vault_address` unbound and bind the actual Vault address exactly once before seal
- all user operations remain rejected before seal
- seal requires required circular binding
- post-seal binding is rejected forever
- deployment manifest hash is stored and exposed

Explicitly not implemented:

- Vault -> CapsuleHub publish send
- PendingPublish accounting
- CapsuleHub ACK/excess receive in Vault
- production deployment manifest generation
- actual downstream seal vectors
- any post-seal admin/address mutation path

Commands run:

```bash
npm run build
npm test -- --reporter=verbose
npm audit --omit=dev --audit-level=high
```

Results:

```text
deployment-binding tests: 1 test file passed, 4 tests passed
npm audit --omit=dev: 0 vulnerabilities
```

Important note:

`npm test` in this milestone package is intentionally scoped to `tests/deployment-binding.test.ts`, because this package is a deployment-binding milestone. Existing regression test files are included and were individually sanity-checked during development; full cross-milestone regression should be run in CI with sufficient timeout/resources.

Code hashes after binding changes:

```text
VAULT_CODE_HASH = 682a7dfbedff91631573105d2276faf34b9366aa2a1bb924d47823efaf67d84c
VAULT_CODE_BOC_SHA256 = a893d84715f0aff9d84207a6f0879b51154f7eb614bac24ce750ce47a8ebcdaf

CAPSULEHUB_CODE_HASH = d11c8609a8cb5f39c540363531cf9bcd8b4459c8d7da03144847e498dd453b77
CAPSULEHUB_CODE_BOC_SHA256 = f029cf5bc7063aaddcc5b073c5c89cf1be69691794d84d60c7635bfc9e2dbcd7
```
