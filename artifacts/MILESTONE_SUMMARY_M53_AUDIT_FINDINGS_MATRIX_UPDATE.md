# M53 Audit Findings Matrix Update

Date: 2026-05-21

Status: documentation / audit coordination update. This is not a mainnet production approval.

## Scope

This pass records two acknowledged audit findings in a shared matrix so future audit rounds do not re-open them as brand-new discoveries without new evidence:

- `UNFT-01`: `UsernameNFTItem.ResendDeployedAck` rejected-ACK / overpay retention footgun.
- `VCAP-01`: Vault <-> CapsuleHub late ACK after stale prune traps returned TON as raw Vault balance.

## Files Added

- `artifacts/AUDIT_FINDINGS_MATRIX.md`
- `artifacts/audit_findings_matrix.json`

## Classification

Both findings are recorded as `ACKNOWLEDGED_OPEN`.

They are not classified as P0/P1:

- `UNFT-01` is capped, caller-funded, and does not corrupt ATH or username accounting.
- `VCAP-01` requires delayed CapsuleHub response beyond stale pending TTL; normal publish/ACK flow remains passing.

## Follow-Up Direction

`UNFT-01` needs an ABI/product decision:

- document resend as caller-funded top-up/recovery behavior;
- split initial deploy ACK and public resend ABI;
- or add resend-specific bounded refund semantics.

`VCAP-01` has a preferred small-design fix:

- prune should leave a compact late-response tombstone;
- late authenticated ACK/bounce can credit capped returned TON to active message budget or `ton_balance`;
- tombstone expires separately.

## Verification

No contract code changed in this pass. This is an audit artifact update only.
