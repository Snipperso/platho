# M54 Vault Publish Bounce Tag Hardening

## Summary

Vault -> CapsuleHub publish messages now carry a compact bounce proof:

```text
publish_bounce_id  = publish_id mod 2^64
publish_bounce_tag = hash(cell { publish_id:uint256 }) mod 2^160
```

The field order is intentionally:

```text
opcode:uint32
publish_bounce_id:uint64
publish_bounce_tag:uint160
publish_id:uint256
...
```

This keeps the 64-bit bounce slot and the 160-bit tag inside the 224 payload bits that Tact can read from a bounced message after the opcode.

## Rationale

`CapsuleHubPublishAck` still carries and verifies the full 256-bit `publish_id`.

Typed bounce handlers cannot read the full `publish_id`: TON bounced bodies only expose a bounded prefix of the original message body. Before M54, Vault bounce recovery routed only by the 64-bit `publish_bounce_id`. That was already bounded by pending-slot uniqueness and tombstone rules, but it left ACK and bounce authentication asymmetric.

M54 adds `publish_bounce_tag` so bounce recovery validates a compact proof derived from the full `publish_id` before refunding and deleting `PendingPublish`.

## Contract Impact

Changed messages:

```text
PublishPrivateFromVault {
  bounce_id:uint64
  bounce_tag:uint160
  publish_id:uint256
  ...
}

PublishPublicFromVault {
  bounce_id:uint64
  bounce_tag:uint160
  publish_id:uint256
  ...
}
```

No new storage.
No new admin surface.
No PWA-facing message change.

Vault computes the tag before sending to CapsuleHub. CapsuleHub stores and ACKs as before; it only needs the ABI layout update so typed bounces return the tag.

## Verification

Focused regression:

```text
npm run test:file -- tests\vault-prune-pending-publish.test.ts tests\vault-m6-publish.test.ts tests\capsulehub.test.ts tests\capsulehub-boundary-negative.test.ts tests\capsulehub-state-invariants.test.ts tests\capsulehub-auth-negative-matrix.test.ts tests\capsulehub-final-capsule-layout.test.ts --reporter=dot --maxWorkers=1 --pool=forks
```

Result:

```text
7 test files passed
34 tests passed
```

Additional artifacts regenerated:

```text
artifacts/CURRENT_CODE_HASHES.txt
artifacts/deployment_manifest_implemented_subset_m15.json
artifacts/capsulehub_storage_economics_report.json
artifacts/m17_gas_reserve_sanity_report.json
```
