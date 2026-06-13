# Session 3 — Vault batch publish path: surgical plan

Grounded in the actual `contracts/Vault.tact` source (private publish external read at 1992-2079),
`C:\tmp\research_vault-publish-internals.md` (exact line map), and `PLATHO_PUBLISH_V2_VPB2_SPEC_DRAFT.md`
v0.3. Goal: implement the batch publish path as a careful diff over the proven Vault, keeping the audited
ATH / genesis / withdrawal / intent logic untouched. Execute edits in the order below, building after each
group so a failure is localized.

## Constants in scope (the spec's structural set; gas calibrated in Session 5)

Add (Vault.tact top, near the existing domains at ~28-63 and the publish constants at ~79-133):
- Signing/derivation domains: `VAULT_BATCH_PUBLISH_SIGNING_DOMAIN = 0x56504232` (VPB2),
  `VAULT_BATCH_PUBLISH_ID_DOMAIN = 0x42504931` (BPI1), `CAPSULE_ENTRY_PUBLISH_ID_DOMAIN = 0x45504931`
  (EPI1). Retire `VAULT_PUBLISH_SIGNING_DOMAIN` (VPB1, 0x56504231) usage.
- `MAX_BATCH_PARTS = 20`; `VPB2_VERSION = 1`; `RECEIPT_RING_K = 20`.
- `EXT_HARD_CELLS = 8192`, `EXT_HARD_BITS = 2097152` (provable protocol-cap import floor — §3.1).
- Structural gas constants (named, INITIAL estimates; Session-5 calibration finalizes):
  `WALK_GAS_PER_PART_MAX`, `REJECT_BASE_GAS`, `VAULT_BATCH_BASE_GAS`, `VAULT_PART_GAS(kind,class)` table,
  `HUB_PART_GAS(...)`, `HUB_BATCH_BASE_GAS`, `ACK_GAS`. (Runtime-priced via getComputeFee/getForwardFee.)
- `ACK_MIN_FORWARD = 30000000`; `STORAGE_RESERVE_*` (keepalive 1e6 + endowment private 3.3e6 / public
  7.4e6) carried from V1; `PROTOCOL_FEE_TON = 10000000` (kept).
- New opcodes: external `PublishBatchFromVaultBalance = 0x7E1F5041`; hub `PublishBatchToHub = 0xA4F862D1`;
  ack `CapsuleHubBatchAck = 0x874E5771`. Retire `0x7E1F5031/32`.

Remove after the batch path lands: the per-size-class `*_LOCAL_EXEC_RESERVE` tables (replaced by runtime
fee pricing) — do this LAST (Session 5) to avoid breaking other refs mid-session.

## Edit group A — outer-envelope `end_parse` hardening on ALL 10 accepting externals (the import-fee drain fix)

The confirmed drain (transaction.cpp-verified): an attacker pads the external OUTSIDE `signed_payload`
(the body cell has 3 spare ref slots + trailing bits, uncovered by the signature) and the Vault pays the
inflated import fee. Fix (§3.1 step 0): after reading `op | owner_wallet | signature | signed_payload`,
assert the inbound external body has **zero remaining bits and zero remaining refs**, PRE-accept (a
failing check throws before acceptMessage → no import fee charged).

The 10 accepting externals (research fact 24): WithdrawTon (1332), WithdrawAth (1399),
ReplaceMessagingKeys (1681), CreateReceiveIntent (1799), ClaimReceiveIntent (1919), CancelReceiveIntent
(1969), SetProfileAvatar (2335), MintUsername (2445), + the two publishes (1992/2164 → replaced by the
batch external). For each: the receiver's `external(msg: X)` already destructures the message; add the
zero-remainder assertion on the raw inbound body slice. Tact note: the generated parser does NOT
`end_parse` the outer body — verify whether Tact exposes the remainder; if the message struct uses
`Slice as remaining` or fixed fields, add an explicit guard. **Measure pre-accept gas after adding** —
the existing 11-bit-prefix hack (2007) exists precisely because extra pre-accept work blew the 10k credit;
the end_parse is O(1) (a bits()/refs() check on the already-parsed outer slice), so it should fit, but
gate G1 must confirm at the 64 KiB worst case.

For the 8 non-publish externals this is the COMPLETE fix (their signed payloads are fixed-shape and
already exact-validated, so no internal padding is possible once the envelope is strict). Only the batch
publish needs the additional import floor (group C) because its payload is legitimately variable.

### Group A — STATUS: DONE (5 of 8 protected) + critical Tact mechanism findings (2026-06-13)

**How to access the raw external body in Tact — settled empirically (load-bearing for group C):**
- `inMsg()` — WRONG. Correct external layout, BUT using it anywhere has a GLOBAL codegen side effect
  that breaks the production ATH deposit flow (vault-ath-integration: 16 tests fail; the internal
  AthTransferNotification path stops creating the user). Confirmed by isolating `inMsg()` alone.
- `context().raw` — WRONG. No global side effect (context() is already used), BUT for EXTERNAL messages
  its layout is NOT `op|owner|sig|ref` (parse hits TVM exit 7 / breaks canonical externals). It follows
  the *internal* message layout; unusable for externals.
- **`field: Slice as remaining` on the message — CORRECT.** Tact parses it (right layout), no codegen
  side effect. Detects extra refs (`padding.refs()`) AND trailing bits (`padding.bits()`). This is the
  mechanism to use in the batch message (group C).

**Implementation:** added `envelope_padding: Slice as remaining` to 5 messages (WithdrawTon, WithdrawAth,
ReplaceMessagingKeys, SetProfileAvatar, MintUsername) + a `requireEmptyEnvelopePadding(padding)` helper
called first in each receiver (throws 16900 trailing-bits / 16901 extra-refs). Verified by
`tests/vault-key-records.test.ts` VAULT-ENVELOPE-01: a validly-signed external padded with an extra ref
or trailing bits is rejected PRE-accept (so no import fee) with the exact codes, while the canonical body
succeeds. Store* construction ripple fixed (4 sites: vault-ath avatar/username, pwa-contract-transactions
avatar/username — pass `envelope_padding: beginCell().endCell().asSlice()`).

**Gas-constrained exception (3 of 8 NOT protected):** the receive-intent externals (CreateReceiveIntent,
ClaimReceiveIntent, CancelReceiveIntent) sit at the 10k pre-accept gas credit edge (they already dropped
the address-prefix throw to fit). Adding the `Slice as remaining` parse + check pushes them OUT OF GAS
pre-accept (exit -14). Reverted the field+check on these 3 — they keep the pre-existing (small, live-V1)
drain exposure, documented. To protect them later would require freeing pre-accept gas elsewhere in those
receivers. The batch publish (group C) controls its own budget, so it gets the envelope check + import
floor from the start.

## Edit group B — receipts ring (UserState + write points)

- `UserState` (struct 349-355, currently 832 bits / 0 refs in its own ref cell, 191 bits headroom): add
  ONE ref to a receipts root cell holding 4 children × 5 slots (`RECEIPT_RING_K = 20`), slot 184 bits
  `{nonce:u64, action:u8, result:u8, aux:u64, part_count:u8, at:u32}`. Slot index = `nonce mod 20`.
- Helper `receiptWrite(user, nonce, action, result, aux, part_count)` and `receiptUpdateByNonce(owner,
  nonce, result, aux)` (locate child = (nonce mod 20)/5, pos = (nonce mod 20)%5; verify slot.nonce before
  overwrite — eviction/late-ACK safe).
- Write points (§4.2): every one of the 9 nonce consumers writes a receipt at the same commit that
  consumes the nonce (action codes 1-9). Every V1 post-accept silent `return` becomes a receipt-visible
  reject or a pre-accept throw — release gate G3 asserts no post-accept `return` lacks a receipt write.
- `Pending*Payment` structs (avatar `PendingProfileAvatarPayment`, username `PendingUsernameMintPayment`)
  gain a `nonce:u64` field; their registry-ACK/bounce/tombstone handlers call receiptUpdateByNonce.
- New getters: `get_user_receipts(owner)` → `{exists, publish_nonce, pending_publish_count, slots[20]}`
  (flat scalars + ring cells; Orbs-v2-portable encoding); `get_pending_publish(bounce_id)` →
  `{exists, nonce, publish_kind, part_count, created_at, tombstone}`.
- `VAULT_USER_STATE_STORAGE_ENDOWMENT` resized for the 3→5-cell user footprint (Session-5 generator).

### Group B — STATUS: infrastructure DONE + verified (2026-06-13)

Implemented and tested: `ReceiptSlot` struct (184 bits), `receipts: map<Int as uint8, ReceiptSlot>`
field on `UserState` (chose a map over hand-packed 4-children cells — idiomatic, correct, dynamic
indexing; the rent difference is ~0.001 TON/yr, negligible vs the bug risk of manual bit-packing on an
immutable contract), `emptyUser` default, action codes `ACT_*` (1-9) + result codes `RES_*` +
`AUX_BATCH_LEVEL`, helpers `writeReceipt(user,nonce,action,result,aux,part_count)` and
`updateReceipt(user,nonce,result,aux)` (eviction-safe: only overwrites if `slot.nonce == nonce`), and the
`get_user_receipts(owner)` getter → `{exists, publish_nonce, receipts}`. Verified by
`tests/vault-key-records.test.ts` VAULT-RECEIPT-01: ReplaceMessagingKeys (sync) writes a `RES_CONFIRMED`
receipt at slot `nonce mod 20`, readable via the getter with correct nonce/action/result; empty before
any action. Broad regression green (53 tests). The map nests inside UserState (its own ref cell) with no
issue.

**Group B write points — DONE + verified (2026-06-13).** All 8 non-publish nonce consumers now write a
receipt at `user.publish_nonce += 1` (uniform `user = self.writeReceipt(user, user.publish_nonce - 1,
ACT_X, RES_PROCESSING, 0, 0)`): WithdrawTon/Ath, ReplaceMessagingKeys, CreateReceiveIntent,
ClaimReceiveIntent (→ recipient's ring), CancelReceiveIntent, SetProfileAvatar, MintUsername. Decision:
non-publish receipts are a simple **action log** — RES_PROCESSING ("action accepted at nonce N", always
accurate). The receipt write is POST-accept (under the 1M tx budget, not the 10k pre-accept credit), so
the gas-tight intents are unaffected (verified: receive-intent tests green). Broad regression green (53
tests). VAULT-RECEIPT-01 updated to assert PROCESSING.

**Group B remaining (deferred refinement / group C):** the CONFIRMED transition for non-publish is
OPTIONAL (the client confirms completion via get_user / target contracts) — if added later it's
`updateReceipt` at the sync success-point / async ACK+bounce handlers, needing a `nonce` field on
`PendingAthWithdrawal`/`Pending*Payment`. The FULL receipt lifecycle (PROCESSING→CONFIRMED→RJ_* rejects,
the core feature) is implemented for the batch publish path in group C, along with `get_pending_publish`.
The two old publish externals keep no receipt (replaced in C).

## Edit group C — the batch external `PublishBatchFromVaultBalance` (replaces both publish externals)

### Group C — C1 (foundations) DONE + builds (2026-06-13)

Added + compiling: signing domains `VAULT_BATCH_PUBLISH_SIGNING_DOMAIN` (VPB2 0x56504232),
`VAULT_BATCH_PUBLISH_ID_DOMAIN` (BPI1), `CAPSULE_ENTRY_PUBLISH_ID_DOMAIN` (EPI1); constants
`MAX_BATCH_PARTS=20`, `VPB2_VERSION=1`, `EXT_HARD_CELLS=8192`/`EXT_HARD_BITS=2^21` (config-43 cap; Session 5
may tighten to the sandbox fee-maximizer), `ACK_MIN_FORWARD`, `PROTOCOL_FEE_TON_BATCH`,
`STORAGE_RESERVE_PRIVATE/PUBLIC`, structural GAS placeholders (`VAULT_BATCH_BASE_GAS`, `*_PART_GAS_*`,
`HUB_*`, `WALK_GAS_PER_PART_MAX`, `REJECT_BASE_GAS`, `ACK_GAS` — calibrated in Session 5), and `RJ_*` reject
codes; messages `PublishBatchFromVaultBalance` (op 0x7E1F5041, with `envelope_padding: Slice as remaining`
drain-fix), `PublishBatchToHub` (op 0xA4F862D1, `marketing: Cell?` for public-only), `CapsuleHubBatchAck`
(op 0x874E5771); struct `PendingBatchPublish` (765 bits, full publish_id); contract field
`pending_batch_publishes: map<Int, PendingBatchPublish>` + init default. Regression green.

**DESIGN CLARIFICATION for C2 (spec §3.1 vs §3.6 reconciled):** `canonical_total` (the value the client
signs as `max_charge`, checked post-accept at §3.3 step 7) MUST use the **EXT_HARD worst-case import**
term — the SAME as `BatchChargeFloor` — so `canonical_total ≥ BatchChargeFloor` and honest sends clear
the pre-accept gate (G10). On the SUCCESS path the Vault retains only the **measured** import
(`getForwardFee(measured ext stats)`) + Vault compute + Vault→Hub fwd; the over-hold
(`EXT_HARD_import − measured_import`) rides to the Hub in the call value and returns to the user via the
mode-128 ACK. So: HOLD = EXT_HARD import (refundable); RETENTION = measured import. (The spec's §3.6
"vault_retained" in canonical_total means the EXT_HARD-import hold version, not the §3.3-success measured
retention — implement canonical with EXT_HARD import.) Verified by fee primitives `getForwardFee(cells,
bits, false)` / `getComputeFee(gas, false)` (top-level Tact 1.6 funcs).

### Receiver design (C2, to implement)

Replace the two `external(PublishPrivateFromVaultBalance)` (1992-2162) and
`external(PublishPublicFromVaultBalance)` (2164-2317) with ONE `external(PublishBatchFromVaultBalance)`.

Pre-accept (mirrors the V1 preamble 1993-2042 but for the VPB2 root, + end_parse + the floor):
1. envelope end_parse (group A); sealed; user exists; auth_pubkey; checkSignature.
2. root parse + binding: domain==VPB2; manifest; vault hash (keep the 11-bit prefix advance trick);
   kind∈{1,2}; owner prefix+hash; clientNonce==publish_nonce; vpb2_version==1;
   1<=part_count<=MAX_BATCH_PARTS; root remaining bits==0 & refs==1.
3. `max_charge >= BatchChargeFloor` where floor = `getForwardFee(EXT_HARD_CELLS, EXT_HARD_BITS, false)
   + getComputeFee(WALK_GAS_PER_PART_MAX*part_count, false) + getComputeFee(REJECT_BASE_GAS, false)`.
4. `user.ton_balance >= max_charge`. acceptMessage.

Accept (single debit point — §3.2): `ton_balance -= max_charge; publish_nonce += 1;
receiptWrite(clientNonce, ACT_PUBLISH_BATCH=7, RES_PROCESSING, 0, part_count); commit()`.

Post-accept single walk over the linked part list (§3.3): per part — exact shape (784 private / 528
public; refs; last has no successor; walked count==part_count); class/suite; exact payload-cell shapes
via bounded computeDataSize BEFORE hashing (cell-bomb defense); recompute Cell.hash() == signed fields;
adjacent-duplicate guard (anti-bloat only). Accumulate canonical charge. Then: max_charge>=canonical_total
else RJ_UNDERPRICED; publish_id!=0 else RJ_ID_ZERO; no live pending at bounce_id else RJ_PENDING_COLLISION.

Reject (uniform, §3.3): `reject_fee = getForwardFee(EXT_HARD_CELLS, EXT_HARD_BITS, false) +
getComputeFee(REJECT_GAS(part_count), false)` (import term is WORST-CASE, never measured-prefix);
`receiptUpdateByNonce(RJ_*, aux=failing_part_index|AUX_BATCH_LEVEL); ton_balance += max_charge -
reject_fee; commit(); return`. By construction reject_fee <= floor <= max_charge → refund >= 0.

Success: `vault_retained = getForwardFee(ext stats, false) [import] + getComputeFee(VAULT_BATCH_GAS, false)
+ getForwardFee(hub-message stats, false) [fwd-out]`; write `PendingBatchPublish`; commit;
send `PublishBatchToHub` (bounce:true, SendPayGasSeparately, value = max_charge - vault_retained).

Identifiers (§3.4): `parts_root_hash = signed_root.ref[0].hash()`; `publish_id = hash(BPI1 ‖ manifest ‖
owner ‖ clientNonce ‖ parts_root_hash ‖ kind ‖ part_count)`; `bounce_id = publish_id mod 2^64`;
`bounce_tag = hash(publish_id) mod 2^160`.

`PendingBatchPublish` (§3.5, 765 bits): `{owner_wallet, tombstone, refund_to_vault=true, nonce,
publish_kind, part_count, publish_id:u256 (full), refundable_amount, created_at}`. Prune/tombstone flow
carried from V1 (24h+24h).

## Edit group D — hub message + ACK receiver + bounce (Vault side)

- New message `PublishBatchToHub` (op 0xA4F862D1): op + bounce_id(64) + bounce_tag(160) + publish_id(256)
  FIRST (survive bounce truncation) + kind + part_count + protocol_fee_total + author_wallet + ref[0]
  parts list + ref[1] marketing cell (public).
- ACK receiver `CapsuleHubBatchAck` (op 0x874E5771): sender==capsule_hub; pending at publish_id mod 2^64;
  pending.publish_id==msg.publish_id (full equality); credit `min(max(value - VAULT_ACK_EXEC_RESERVE, 0),
  pending.refundable_amount)`; `creditActivityAirdrop(min(pending.part_count*10 ATH, remaining))`;
  receiptUpdateByNonce(pending.nonce → RES_CONFIRMED, first_entry_id); delete pending.
- `bounced(PublishBatchToHub)` (§5.5): TOTAL by construction — silently absorb on any sender/pending/tag
  mismatch (never throw); on match refund + receiptUpdateByNonce(RES_BOUNCED_REFUNDED) + delete.
- Retire the V1 `PublishPrivateFromVault`/`PublishPublicFromVault` messages + their bounce handlers
  (2557-2595) + the single ACK handler (2535-2555).

## Edit group E — successor manifest (§6)

`AnnounceSuccessorManifest{successor_manifest_hash, successor_vault}`: sender==genesis_controller; sealed;
one-shot (record must be unset, irreversible). `get_successor()` getter. No auto-switch semantics (client
guardrails are doc-level).

## Build/verify checkpoints (per group)

After A: build + measure pre-accept gas of one external (G1 sanity). After B: build + a receipt
read/write unit test. After C+D: build + a batch publish→ACK happy-path sandbox test (single part, then
20×1K) + a forced-reject test (part 17 invalid → receipt names index 16, refund>=0). After E: build.
Full gas/non-drift/release-gate matrix + the regeneration cascade are Session 5.

## Risks / watch-items

- Pre-accept 10k credit: the end_parse + VPB2 root parse + floor (3 fee primitives) must fit at 64 KiB
  worst case. The fee primitives are single TVM instructions (verified). If tight, the 11-bit-prefix trick
  pattern shows the budget is real — G1 is a hard gate.
- Tact `external` outer-body remainder access for end_parse: confirm the mechanism (the generated parser
  may need an explicit guard; the message defines `signed_payload:^Cell` as the last field).
- UserState +1 ref (5-cell footprint) changes Vault.init? No — UserState is map-valued, not init. But the
  storage endowment + rent tests rebaseline (Session 5).
- All Vault.init-signature-referencing scripts (deployment_manifest, pricing, gas harness, mainnet_*)
  break if init changes — the batch path does NOT change Vault.init (only receivers/getters/structs), so
  init stays stable. Keep it that way.
