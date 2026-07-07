# Evidence for Larisa: Vault publish accept/budget re-audit

Date: 2026-06-08

Current git HEAD short hash: `6f4f065`

Working tree state: dirty. This archive is a focused source/evidence bundle, not a clean release tag.

## Current code hashes

Vault:

```text
cb0adbd4ac2c934af6e92ffed4673b87fc2c996de45c05bfe7bf2f1741948019
```

CapsuleHub:

```text
2d16b0ba66fc6df66b1f890890b96ea0aaa5a7ece2ef2db8368c4f045ea40e7a
```

`MAINNET_GENESIS_VERIFIED.txt`:

```text
false
```

This is expected after the Vault hash changed. Fresh mainnet genesis/deploy artifacts must be regenerated and verified before production deploy.

## Local test evidence

Focused publish/security gate suite:

```text
npm.cmd run test:file -- tests\vault-external-session-gate.test.ts tests\vault-m6-publish.test.ts tests\m16-conformance-static.test.ts
Test Files  3 passed (3)
Tests       52 passed (52)
```

Avatar/profile/PWA transaction suite:

```text
npm.cmd run test:file -- tests\vault-ath-integration.test.ts tests\profile-registry.test.ts tests\pwa-contract-transactions.test.ts
Test Files  3 passed (3)
Tests       67 passed (67)
```

Pending publish / contract invariant suite:

```text
npm.cmd run test:file -- tests\vault-prune-pending-publish.test.ts tests\vault-ton-state-invariants.test.ts tests\capsulehub-state-invariants.test.ts tests\capsulehub-final-capsule-layout.test.ts
Test Files  4 passed (4)
Tests       8 passed (8)
```

Full suite:

```text
npm.cmd test
Test Files  98 passed (98)
Tests       892 passed (892)
```

## Local audit summary before external review

No new blocker/critical issue was found in the compact Vault publish accept/budget fix.

The intended invariant now is:

- pre-accept gates stay small enough for large public/avatar publish externals;
- local reserve backing is still required before `acceptMessage()`;
- nonce and local reserve are consumed immediately after accept;
- malformed, underpriced, or shape-invalid authenticated payloads do not send anything to CapsuleHub;
- if a CapsuleHub send happens, `remainingCharge = maxCharge - localExecReserve` is checked and debited before the pending publish and outbound message are committed.

The main residual operational risk is not a contract approval issue by itself: production deployment still needs fresh genesis/deploy verification because the Vault code hash changed.
