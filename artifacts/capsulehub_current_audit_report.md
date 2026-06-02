# CapsuleHub Current Audit Report

Date: 2026-05-22

Scope: `contracts/CapsuleHub.tact` after direct publish removal and final capsule byte layout adoption.

## Result

No new local P0/P1/P2 CapsuleHub money or liveness findings were found in this pass.

The current local CapsuleHub surface is intentionally small:

- deploy binding: `BindDeploymentManifest`, `SealGenesis`
- publish: `PublishPrivateFromVault`, `PublishPublicFromVault`
- retention: `PruneCapsuleEntry`
- fee movement: `FlushFees`
- maintenance: `TopUpStorageReserve`
- getters: entry/state reads

Direct user publish ABI is absent. Public and private publish entries are accepted only from the bound Vault address.

## Confirmed Invariants

- Unsealed CapsuleHub rejects publish and flush paths.
- Only the genesis controller can bind and seal.
- Post-seal rebinding is rejected.
- Non-Vault publish sender cannot create entries or ACKs.
- Private publish requires the final fixed byte layout:
  - `header_0`: 140 bytes
  - `header_1`: 30 bytes
  - hybrid body: 1204 bytes of cryptographic overhead plus exactly one selected useful slot: 1, 2, 4, 8, 16, or 32 KiB
- Public publish validates a retrievable compact `PPH1` header cell plus a raw body cell from 1 to 1024 text bytes in the accepted publish transaction body.
- Public publish requires the clear on-chain marker `sent via Platho.App`.
- CapsuleHub stores compact authenticated headers/indexes, body hash, publish id, and contract `created_at`; heavy bodies remain in accepted publish transaction bodies and are verified by hash.
- Compact private/public entries can be permissionlessly pruned after the configured retention window.
- Page boundaries are metadata-only and do not change publish pricing.
- Protocol fee accrual is exact to `protocol_fee_paid`.
- Discounted dust fee can be final-flushed when it is the whole accrued bucket.
- Fee flush sends `amount + 2_000_000` to FeeAccumulator with `SendPayFwdFeesSeparately`; the old 30M ACK reserve is no longer used on this path.
- Fee flush bounce restores `accrued_plato_fee_ton`.
- Empty fallback rejects and does not mutate state.
- `TopUpStorageReserve` grants no authority and does not mutate counters or fee buckets.

## Carried Seam

`VCAP-01` was fixed after this local CapsuleHub pass in Vault:

If Vault pruned a stale `PendingPublish` and the real CapsuleHub ACK arrived later, Vault rejected the ACK because routing state was gone. Since CapsuleHub sends ACK with `bounce: false`, returned TON became raw Vault balance and was not credited to the user.

The fix is in Vault: prune now keeps a compact tombstone in the existing `pending_publishes` map. Late authenticated ACK/bounce can refund capped returned TON until tombstone expiry. This remains a seam issue rather than a local CapsuleHub finding.

## Not Findings In This Pass

- CapsuleHub does not deduplicate `publish_id` locally. Vault is the trusted ingress and owns nonce/pending collision control.
- CapsuleHub does not validate decrypted private header/body semantics beyond final cell sizes and hashes. Official PWA-created payloads are covered; manually signed malformed payloads are not a contract-level protection target by current policy.
- CapsuleHub does not parse public channel semantics. Public `PPH1` header bytes and raw body bytes are stored and retrievable; post/comment interpretation belongs to the PWA/public message format.
- Deployment topology mistakes such as wrong Vault/FeeAccumulator address are handled by manifest and mainnet genesis verification gates, not by adding runtime policy to CapsuleHub.

## Verification

Commands run:

```text
node scripts\tact_build.js --config tact.config.json --project CapsuleHub
npm.cmd run test:file -- tests/capsulehub.test.ts tests/capsulehub-boundary-negative.test.ts tests/capsulehub-auth-negative-matrix.test.ts tests/capsulehub-state-invariants.test.ts tests/capsulehub-storage-economics.test.ts tests/capsulehub-final-capsule-layout.test.ts tests/vault-m6-publish.test.ts tests/vault-prune-pending-publish.test.ts tests/spec-onchain-message-source.test.ts -- --reporter=dot
npx.cmd ts-node scripts\capsulehub_storage_economics.ts
npx.cmd ts-node scripts\gas_reserve_m17.ts
npx.cmd ts-node scripts\conformance_m16.ts
```

Results:

- CapsuleHub build: PASS
- Focused CapsuleHub/seam/spec tests: 9 files, 35 tests passed
- CapsuleHub storage economics: PASS, 3 cases, worst retained margin 1_479_532 nanotons
- M17 gas reserve sanity: PASS, 6 scenarios
- M16 conformance: PASS
