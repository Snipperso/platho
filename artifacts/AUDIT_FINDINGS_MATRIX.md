# Platho Audit Findings Matrix

Date: 2026-05-21

Status: live audit coordination matrix. This is not a mainnet production approval.

Purpose: keep acknowledged findings visible across audit rounds so already-triaged issues are not rediscovered as new blockers without new evidence.

## Open / Acknowledged Findings

| ID | Area | Severity | Status | Summary | Current Decision | Next Action |
|---|---|---:|---|---|---|---|
| UNFT-01 | UsernameNFTItem.ResendDeployedAck | P2 / low-medium money footgun | Acknowledged / open | Permissionless `ResendDeployedAck` can retain caller-funded TON in the item balance when the Registry rejects the ACK, for example after pending mint is already absent. The loss is capped by the current `20_000_000` nanotON resend max. | Not P0/P1. Do not bluntly require exact `4_000_000`, because initial Registry deploy uses the same ACK body and intentionally funds item storage with the deploy reserve. | Decide between documenting resend as caller-funded top-up/recovery behavior, splitting initial deploy ACK from public resend ABI, or adding resend-specific bounded refund semantics. |
| VCAP-01 | Vault <-> CapsuleHub late ACK after prune | P2 money/liveness | Acknowledged / open | If `PrunePendingPublish` removes a stale `PendingPublish` and the real CapsuleHub ACK arrives later, Vault rejects it because routing state is gone. The ACK value is `bounce: false`, so returned TON becomes raw Vault balance and is not credited to the user. | Normal Vault -> CapsuleHub publish flow remains passing. This is a delayed-message/stale-prune edge, not forged ACK or normal-flow accounting failure. | Preferred fix is a compact prune tombstone that can authenticate late ACK/bounce and credit capped returned TON to active budget or `ton_balance` until tombstone expiry. |

## Notes

- `UNFT-01` is distinct from the earlier M37 overpay cap. M37 prevents oversized public resend values above `20_000_000` nanotons, but does not make failed/no-pending resend refundable.
- `VCAP-01` should not be closed by making ACK bounceable alone. Without symmetric CapsuleHub recovery, that only moves the stuck-value problem to the other side of the seam.
- Neither finding is currently classified as P0/P1. Both remain relevant for audit follow-up and production readiness discussion.
