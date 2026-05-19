# Spec Changelog: M16A Test Orchestration Timeout Fix

Status: accepted tooling-only fix.

No protocol behavior, contract storage, message payload, opcode, reserve, manifest, or economics rule was changed.

The only accepted change is test tooling:

```text
Vitest all-suite pool changed from threads to vmThreads.
```

Reason:

```text
The old worker pool could hang after reporting all tests passed. vmThreads exits cleanly and preserves deterministic single-worker execution.
```
