# Platho Vault milestone 5: external session pre-accept gate

Scope implemented:

- `contracts/Vault.tact`
- cell-based external CompactSessionRequest profile for TON/Tact feasibility
- external session signature verification using TVM Ed25519 `checkSignature`
- `session_sig_hash` includes genesis hash, Vault address, CapsuleHub address and compact request fields
- pre-accept rejection for malformed root, wrong session, wrong nonce, expired session, invalid signature
- post-accept nonce consumption for valid signed requests
- controlled invalid signed request charge from Message Budget
- canonical current discounted max charge getter and post-accept validation
- tests for valid signed request, invalid signature, duplicate nonce, bad max/profile, expired session

Explicitly not implemented:

- CapsuleHub send
- PendingPublish
- Vault -> CapsuleHub ACK/excess routing
- full post-accept body/header parse beyond hash/profile gate
- production external publish success path
- seal checks

Important implementation finding:

The earlier raw 268-byte CompactSessionRequest profile is not practical as a single TON external body cell and Tact pre-accept gas cannot safely compute the full discounted max-charge path before `acceptMessage`.

Milestone 5 therefore pins a TON cell-based compact request profile:

- root cell contains compact fields and refs
- one ref contains body/header hashes
- one ref contains the Ed25519 signature
- signature hash is computed from canonical cell fields, not raw byte offset layout

Security model:

- invalid external spam is rejected before `acceptMessage`
- only valid session signatures can reach `acceptMessage`
- after accept, nonce is consumed and invalid signed requests pay `INVALID_SESSION_REQUEST_CHARGE_TON`
- current discounted max-charge equality is checked after accept for valid signatures only

Commands run:

```bash
npm run build
npm test -- --reporter=dot
npm audit --omit=dev --audit-level=high
```

Results:

```text
9 test files passed, 55 tests passed
npm audit --omit=dev: 0 vulnerabilities
```

Hashes:

```text
VAULT_CODE_HASH = 65625427331628041c95ff7b291b146c9bbd9acb84250182cea4020f28c28c2f
VAULT_CODE_BOC_SHA256 = 550196f7f0f050928c0be198e4adb1443a010fe46d3dc2940f86e3e5254cfc4b
```
