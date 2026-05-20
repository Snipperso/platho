# M44 Vault External Nonce Policy

Status: PASS.

This milestone records the Vault external-session nonce behavior as an explicit
v1 policy decision.

## Decision

Validly signed malformed external session requests consume replay nonce but do
not debit Message Budget, do not publish to CapsuleHub, and do not charge a
PLATO fee.

Invalid signatures and pre-accept structural/session failures still reject
without nonce or budget mutation.

## Rationale

Full deterministic publish-profile validation before `acceptMessage()` exceeds
TON external gas credit in sandbox. The safe v1 behavior is to accept a valid
signature only far enough to consume nonce for replay protection, then return
cleanly without value mutation when the deterministic profile/max-charge checks
fail.

## Verification

- `npm.cmd run test:file -- tests\vault-external-session-gate.test.ts`: PASS,
  1 file / 8 tests.
