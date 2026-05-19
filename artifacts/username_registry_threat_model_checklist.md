# UsernameRegistry Threat Model Checklist

Status: local engineering hardening pass, not an independent audit or formal proof.

Date: 2026-05-17

## Covered Locally

- Official ATH wallet binding and seal flow.
- Paid username mint from authenticated official ATH wallet notification.
- Raw username byte validation, exact price tiers, duplicate finalized names, duplicate pending names.
- ATH notification ACK after pending mint or refund-due state is recorded.
- Underfunded paid-mint notifications reject without partial registry state.
- Deterministic UsernameNFTItem deploy and registry ACK finalization.
- Permissionless UsernameNFTItem ACK resend with caller-funded reserve.
- Refund due accounting and refund flush success/bounce/failure restoration.
- Treasury due flush success/failure restoration.
- Burn due flush finalized/failed restoration.
- Stale pending mint prune and late ACK rejection.
- Forged mint notifications, item ACKs, transfer callbacks, and burn callbacks from unauthorized senders.
- Min-1 and exact-min boundaries for paid mint, invalid refund due, item ACK resend, refund flush, treasury flush, and burn flush.
- Deterministic state-machine walks for records, pending mints, refund due, treasury due, and burn due.

## Local Invariants

- `name_record_count` equals modeled finalized username records.
- `pending_mint_count` equals modeled pending username mints.
- `refund_due_count` equals owners with positive modeled refund due.
- `treasury_due_ath` and `burn_due_ath` equal modeled post-ACK accounting.
- Stale prune moves pending price back to owner refund due and does not create a name record.
- Forged callbacks do not clear pending flushes or mutate due buckets.

## Residual Assumptions

- Sandbox gas and forwarding behavior is a proxy, not final mainnet gas proof.
- UsernameRegistry depends on the official ATH wallet honoring notification ACK semantics.
- Permanent refund/pending maps still require final storage-rent/economic sizing.
- No independent human audit has reviewed this hardening pass.
- No formal model checker has proven all reachable states.

## Recommended Before Final Genesis

- Independent Tact/security review focused on paid mint, refund/treasury/burn flush, and async callback authority.
- Testnet/mainnet gas envelope measurement for paid mint, item deploy ACK, refund flush, treasury flush, burn flush, and stale prune.
- Final storage-rent policy for pending mint and refund due state.
- Keep this contract frozen unless the full focused suite and global suite are rerun.
