# Platho Publish V2 (VPB2) Specification — DRAFT v0.3

Status: DRAFT for the V2 full re-genesis. Becomes the publish-path source of truth at ABI freeze.
Owner decisions of 2026-06-12 (artifacts/REDEPLOY_V2_DESIGN_DRAFT_RU.md section 7) are normative inputs.
v0.2 incorporated the 5-critic adversarial review of v0.1 (2 critical, 16 major). v0.3 incorporates the
3-verifier review of v0.2 (1 critical import-fee drain — confirmed against TON source + sandbox — and 7
major) — changelog in section 14. Constants marked `TBM` are finalized by the extended m17 gas harness
and the structural-constants generator before ABI freeze; their *formulas* and *sizing policy* here are
normative now.

Scope: Vault external publish path, Vault↔CapsuleHub batch protocol, per-user receipts, CapsuleHub read
API, batched body recovery, successor-manifest record. Out of scope (companion V2 specs):
UsernameRegistry collection-render, `NameRecord.minter_wallet` rename, ProfileRegistry
`username_item_address` + `PROFILE_AVATAR_MAX_PARTS = 2`.

All owner decisions resolved (latest: batch airdrop — section 13, resolved 2026-06-12).

> **SECURITY DISCLOSURE — pre-existing V1 import-fee drain (confirmed 2026-06-12).** The currently
> deployed V1 Vault is already drainable: a registered user appends padding to an accepting external (on
> the envelope's spare refs — uncovered by the signature — or inside the signed subtree) up to the
> 65,535-byte protocol cap; the validator charges the Vault pool the full import fee
> (`transaction.cpp` confirmed; sandbox-measured 572.3 nanoton/byte at the snapshot config) while the
> user's ledger debit stays fixed. Net ≈ 0.03 TON/attack snapshot (≈ 0.56 TON classic), slow-bleed,
> across **all 10 accepting external receivers** (no `end_parse` on the inbound external in the generated
> parser). Severity is modest per attack and there are **no real adversaries** today (only the owner has
> a registered key on the test deployment), so no emergency action is required — but V1 has no
> upgrade/pause path, so the structural fix lands in V2 (section 3.1 steps 0 + 5). The same
> envelope-strictness (`end_parse`) + worst-case import floor MUST be applied to the other 9 accepting
> externals (withdraw ×2, receive-intent ×3, key-replace, avatar, username) as a companion change —
> their fixed-shape payloads need only the cheap envelope `end_parse` (no variable import floor).

## 0. Relationship to V1 documents

- `PLATHO_CAPSULE_V1_FINAL_SPEC.md` remains authoritative for all capsule **content** formats: `PH0B`,
  `PH1B`, `PLB1`, `PCP1`, `PPH1`, `PLC1`, size classes, crypto suites, AAD, body geometry — carried into
  V2 **byte-for-byte unchanged**. VPB2 changes only how capsules are *submitted, charged, confirmed, and
  read back*. The full amendment list to the V1 document is section 12.
- VPB1 (`0x56504231`) is **retired**. V2 deploys with no single-publish receivers; a batch with
  `part_count = 1` is the only single-capsule path. Exactly one publish ABI exists.

## 1. Signature domain registry (V2)

| Domain | Value | ASCII | Use | Status |
| --- | --- | --- | --- | --- |
| `VAULT_BATCH_PUBLISH_SIGNING_DOMAIN` | `0x56504232` | `VPB2` | signed batch publish root | **new** |
| `VAULT_BATCH_PUBLISH_ID_DOMAIN` | `0x42504931` | `BPI1` | batch publish_id derivation | **new** |
| `CAPSULE_ENTRY_PUBLISH_ID_DOMAIN` | `0x45504931` | `EPI1` | per-entry publish_id derivation | **new** |
| `VAULT_PUBLISH_SIGNING_DOMAIN` (`VPB1`) | `0x56504231` | `VPB1` | single publish | **retired** |
| `VTW1`, `VWA1`, `VRC1`, `VRK1`, `VPA1`, `VUN1` signing domains | — | — | unchanged | kept |
| `ENTRY_UID_DOMAIN_VAULT_PRIVATE` / `_PUBLIC` | `0xD1190201/2` | — | unchanged | kept |
| id-derivation domains (`RCID`, `RCCM`, `ADPI`, `AWID`, `KEYI`, `VPAI`, `VUNI`, `PRAV`, username hash) | — | — | unchanged | kept |

Verified collision-free against all 100+ deployed opcodes and domains (critic-checked). `BPI1`/`EPI1`
disjointness gives per-entry publish ids provable separation from batch ids, V1 ids, and entry uids.
Every signed payload embeds the V2 `deployment_manifest_hash`, so all V1 signatures are invalid against
V2 by construction.

## 2. External message: `PublishBatchFromVaultBalance`

Opcode: `0x7E1F5041` (frozen at ABI freeze). Outer body:

```text
op:u32 = 0x7E1F5041
owner_wallet:Address
signature:bytes64                         Ed25519 over signed_payload.hash()
signed_payload:^Cell                      the VPB2 signed root
```

### 2.1 Signed root (exactly 1016 bits, exactly 1 ref)

```text
domain:u32        = 0x56504232 'VPB2'
deployment_manifest_hash:u256
vault_address_hash:u256
publish_kind:u8                           1 = private, 2 = public (batch-level; parts never mix kinds)
owner_address_hash:u256
client_nonce:u64                          must equal user.publish_nonce
max_charge:u128                           full signed debit, nanoton
part_count:u8                             1..MAX_BATCH_PARTS
vpb2_version:u8   = 1
ref[0] -> first part cell
```

### 2.2 Part cells (singly linked, list order = part_index order)

Private part (`publish_kind = 1`) — exactly 784 bits; refs: 4 with a successor, 3 for the last part
(note: at the TVM 4-ref ceiling; deliberate, no spare ref — evolution happens via `vpb2_version`):

```text
size_class:u8                             in {1,2,4,8,16,32}; MAY vary between parts
crypto_suite:u8   = 2                     hybrid-v1
header_0_hash:u256
header_1_hash:u256
body_hash:u256
ref[0..2] -> header_0, header_1, body     exact V1 cell shapes (PH0B 2c/1120b/1r, PH1B 1c/240b/0r, PLB1 per class)
ref[3]    -> next part cell               absent on the last part
```

Public part (`publish_kind = 2`) — exactly 528 bits; refs: 3 with a successor, 2 for the last part:

```text
size_class:u8
reserved:u8       = 0
header_hash:u256
body_hash:u256
ref[0..1] -> header, body                 PPH1 (max 1c/576b/0r), body byte-aligned bounded by class
ref[2]    -> next part cell               absent on the last part
```

Hash fields are TON `Cell.hash()` of the exact referenced cells. The parts list cell graph is forwarded
Vault→Hub **as-is** (zero re-serialization), so all stored hashes and uids keep V1 semantics.

### 2.3 Capacity (normative client matrix; external hard ceiling 65,535 bytes, client target 48 KiB)

Uniform-class maxima per external: `20×1K / 14×2K / 8×4K / 4×8K / 2×16K / 1×32K`.
`MAX_BATCH_PARTS = 20`. Mixed-class batches of one kind are allowed; the client must keep the assembled
external ≤ 48 KiB target and within the published gas/capacity artifact (section 10), which is measured
over **adversarial mixed-class compositions up to the hard ceiling**, not only uniform profiles. Two
32 KiB parts never fit one external; a maximum-quality photo (product cap 64 KB = exactly 2×32K parts —
owner-corrected, never 3) remains 2 sequential externals with nonce pipelining (8.3).

**Batching policy (normative, supersedes v0.1):** a batch MAY combine already-queued parts of *multiple*
logical sends of the same kind (this is the design intent — the documented 10-message burst becomes ONE
external). The atomic-reject blast radius is mitigated by the mandatory client mirror pre-validator
(8.2); client SHOULD group by recipient-readiness and MUST only batch parts already fully built and
priced.

## 3. Vault processing

### 3.0 Fee primitives (normative mechanism)

V2 prices execution and forwarding at **runtime** via the TVM fee primitives (Tact ≥1.6:
`getComputeFee`, `getForwardFee`, `getStorageFee`, single-instruction cost), applied to **immutable
structural constants** (cells / bits / gas amounts per kind × class, emitted by the generator from the
measured matrix). No nanoton fee constant is frozen into the contracts; only *structure* is frozen.
Consequences:

- prices automatically track the live config (snapshot today ≈ 6× cheaper than classic) — no hidden
  margin, no insolvency on config revert: Q4 and classic-solvency cease to be in tension;
- the classic schedule survives only in release gates (section 10): all flows are simulated under
  classic config and must stay solvent and non-drifting;
- the user-facing hold ≈ canonical price at the *current* config (no 6× inflated hold).

This replaces v0.1's classic-sized nanoton constants — deviation from the reviewed design draft,
accepted to resolve critical findings E1/E2 (section 14).

### 3.1 Pre-accept (throws; free; O(1) in part count and payload size — 10k external gas credit)

**Why this gate exists (confirmed against TON source + sandbox, 2026-06-12).** A validator imports an
inbound external by debiting the destination's *own balance* the import fee
`lump_price + ceil((bit_price·bits + cell_price·cells)/2^16)` computed over the **entire** external cell
graph minus the root (`transaction.cpp` `unpack_input_msg` L955-987, `MsgPrices::compute_fwd_fees`
L2412-2417). The fee is irreversible once `acceptMessage` is called, **even if the transaction
post-accept-returns** (L1037, L2006). It is NOT charged if the message is never accepted (signature
fails pre-accept → no transaction, no fee — L3435-3442). The Vault cannot cheaply measure the inbound
external's true size pre-accept (walking it blows the 10k credit), and the signature covers only
`signed_payload.hash()`, so an attacker pads either the parts subtree (which they sign) or the outer
envelope's spare refs (uncovered by the signature) up to the protocol cap and the Vault pays the inflated
import on a batch it then rejects. V1 is already exposed to this on every accepting external (see the
disclosure note in section 0 / the V1-exposure artifact); V2 closes it with steps 0 and 5 below.

In order:

0. **Outer-envelope strictness:** after reading `op | owner_wallet | signature | signed_payload`, assert
   the inbound external body has **zero remaining bits and zero remaining refs** (`end_parse`-equivalent).
   This rejects all padding placed OUTSIDE `signed_payload` *pre-accept* (no `acceptMessage`, hence no
   import fee — the clean unconditional drain dies for free). Applies to all V2 accepting externals.
1. `requireSealed`; user exists; `auth_pubkey != 0`.
2. `checkSignature(signed_payload.hash(), signature, auth_pubkey)`.
3. root parse + binding: `domain == VPB2`; manifest matches; `vault_address_hash` matches;
   `publish_kind ∈ {1,2}`; owner basechain + `owner_address_hash` matches; `client_nonce ==
   user.publish_nonce`; `vpb2_version == 1`; `1 <= part_count <= MAX_BATCH_PARTS`.
4. root shape: after the 1016-bit parse, remaining bits == 0 and refs == 1.
5. charge floor: `max_charge >= BatchChargeFloor` where

   ```text
   BatchChargeFloor(part_count) = BATCH_FLOOR_BASE_PIN + BATCH_FLOOR_PER_PART_PIN × part_count
       // BATCH_FLOOR_BASE_PIN  ≈ getForwardFee(EXT_HARD_STATS) + getComputeFee(REJECT_BASE_GAS), pinned
       // BATCH_FLOOR_PER_PART_PIN ≈ getComputeFee(WALK_GAS_PER_PART_MAX),                          pinned
   ```

   **The floor is a PINNED affine constant, NOT a runtime `getForwardFee`/`getComputeFee` expression.**
   This is a hard requirement discovered by measurement, not a preference: this receiver's mandatory
   pre-accept work (envelope check + `requireSealed` + `users.get` + `checkSignature` + the root prefix
   parse) already sits within a few hundred gas of the **10,000-gas pre-accept credit**, and a single
   pre-accept `getForwardFee(EXT_HARD_STATS)` pushes it OVER (sandbox: the receiver OOGs at ~10,011 with
   the fee primitive, fits comfortably with the pinned constant). So the worst-case-import HOLD is
   precomputed at freeze and inlined as pure arithmetic. `EXT_HARD_STATS = (EXT_HARD_CELLS, EXT_HARD_BITS)`
   still provably upper-bounds the import of ANY legal inbound external (config-43 message cap
   `(2^13, 2^21)` ⇒ `getForwardFee ≈ 0.195 TON` at the snapshot config — sandbox-measured 194,490,145 nanoton,
   pinned UP to 0.200 TON for config headroom); the per-part term pins `getComputeFee(WALK_GAS_PER_PART_MAX)`
   (sandbox 1,333,334 ⇒ pinned 1,500,000). The pins MUST NOT be scaled by the *signed* part sizes (v0.1/v0.2
   used `min(n × PART_32K_STATS, …)`, which undercounts envelope/subtree padding — that reintroduces the drain).

   `reject_fee` (3.3) uses the **same pinned formula**, so `reject_fee == BatchChargeFloor`, and the
   pre-accept gate `max_charge >= BatchChargeFloor` makes the reject refund `max_charge − reject_fee >= 0`
   **by construction, at any config**. The Vault recovers its real import as long as each pin ≥ its runtime
   value — release gate **10.G2** asserts exactly that (`BATCH_FLOOR_BASE_PIN ≥ getForwardFee(EXT_HARD_STATS)
   + getComputeFee(REJECT_BASE_GAS)` and `BATCH_FLOOR_PER_PART_PIN ≥ getComputeFee(WALK_GAS_PER_PART_MAX)`
   at the freeze config, with margin), and the generator **re-pins** every release. Trade-off vs runtime
   pricing: a TON fwd-fee config increase beyond the pinned headroom between re-pins would under-gate; this
   is the documented, bounded cost of fitting the 10k credit, and it touches ONLY the pre-accept hold —
   every post-accept fee (canonical_total gate, success retention, ACK) stays runtime-priced and precise.

6. balance gate: `user.ton_balance >= max_charge`.

**Non-over-gating (honest sends pass):** `canonical_total` (3.6) carries a runtime `getForwardFee(EXT_HARD_STATS)`
import term PLUS the per-part fee/storage/ACK costs, whose sum dominates the pinned floor's compute terms, so
`canonical_total ≥ BatchChargeFloor` with tens-of-millions-of-nanoton margin even for `part_count = 1` (release
gate 10.G10). The worst-case import is gated as a refundable **hold**, not a charge: on success the Vault
retains only its *actual measured* import (3.3) and the over-hold (~0.07 TON snapshot, per external/batch,
refunded within seconds via the mode-128 ACK) returns to the user. The parts list is **never traversed
pre-accept**; release gate 10.G1 measures the worst-case pre-accept path against the 10k credit (current
headroom is small by design — G1 is a hard gate so any future pre-accept addition that breaks it is caught).

### 3.2 Accept point

```text
acceptMessage()
user.ton_balance -= max_charge                       // full signed debit, single debit point
user.publish_nonce += 1
receipt_write(client_nonce, ACT_PUBLISH_BATCH, RES_PROCESSING, aux=0, part_count, now())
commit()
```

From here the outcome is **always observable** in the receipt ring; no silent returns exist in V2.

**Residual risk acknowledged (single-debit design):** a compute-phase out-of-gas DURING the post-accept
walk reverts to this commit — `max_charge` is debited, the nonce is burned, the receipt is stuck
`RES_PROCESSING`, and there is no on-chain refund (the TON sits as unowned Vault balance). This is the
price of the single-debit-point design; it is made **provably unreachable** (not merely unlikely) by
release gate 10.G8, which bounds the worst-case post-accept walk gas to ≤ 50% of the 1,000,000-gas
basechain transaction limit across adversarial mixed-class batches at `part_count = MAX_BATCH_PARTS`.
The walk is bounded because every per-part `computeDataSize` throws at a per-class cap (so a cell-bomb
costs a bounded amount and converts to a reject, never an OOG). G8 is a hard freeze gate.

### 3.3 Post-accept validation (single walk; any failure → atomic reject WITH refund)

Per part `i`: (1) exact part-cell shape (bits 784/528; refs 3-4/2-3; last part has no successor; walked
count == `part_count`); (2) class/suite fields valid, hash fields non-zero; (3) exact payload-cell
shapes per class **before hashing** (`computeDataSize` bounded by per-class caps — cell-bomb defense);
(4) recompute payload `Cell.hash()` == signed hash fields; (5) adjacent-duplicate guard — parts `i` and
`i-1` must differ in their hash tuple. **The guard is an anti-bloat tripwire only; it is NOT a dedup or
anti-farming defense** (see section 13); (6) accumulate canonical charge components (3.6).

After the walk: (7) `max_charge >= canonical_total`, else `RJ_UNDERPRICED`; (8) `publish_id != 0` else
`RJ_ID_ZERO`; (9) no live pending at `bounce_id` else `RJ_PENDING_COLLISION`.

**Reject path (uniform):**

```text
reject_fee = BatchChargeFloor(part_count)                            // the SAME pinned affine constant (3.1 step 5)
receipt_update(client_nonce → RJ_*, aux = failing part_index, or aux = AUX_BATCH_LEVEL = 2^64-1)
user.ton_balance += max_charge - reject_fee                          // reject_fee == BatchChargeFloor <= max_charge
commit(); return
```

`reject_fee` is **identical** to the pinned `BatchChargeFloor` (3.1 step 5) — NOT a measured-prefix
`getForwardFee(measured)`. An early-abort reject stops the walk at the failing part, so a measured prefix
would under-count the full external the Vault already paid import on at accept (under-recovery ~37M nanoton
snapshot for a 1-part-fail on a 20-part external — a drain). Because `reject_fee == BatchChargeFloor` and the
pre-accept gate guarantees `max_charge >= BatchChargeFloor`, the refund is `>= 0` on **every** reject including
the cheapest early abort, **at any config** (no runtime fee primitive on this path either — it reuses the same
pin, so reject stays cheap and solvent regardless of TON fee config). The pin ≥ runtime-import invariant (gate
10.G2) ensures the Vault recovers its real import. The user loses the worst-case import their padded/malformed
external could have caused, plus the bounded walk compute, plus one nonce; the receipt names the failing part.
Reject codes are stable ABI (6.4). Release gate 10.G2 includes reject AND padded-external paths in the
Vault-balance non-drift matrix.

**Success path:**

```text
measured_import = getForwardFee(MEASURED_ext_cells, MEASURED_ext_bits, false)   // ACTUAL import of THIS external
                                                                                // (envelope INCLUDED): the full walked
                                                                                // external the Vault really paid for
vault_retained  = measured_import
                + getComputeFee(VAULT_BATCH_GAS(kind, classes), false)          // Vault compute, structural constants
                + getForwardFee(HUB_MSG_cells, HUB_MSG_bits, false)             // Vault→Hub fwd (SendPayGasSeparately
                                                                                //   → Vault pays it)
pending_publishes.set(bounce_id, PendingBatchPublish{...})
commit()
send PublishBatchToHub (bounce: true, SendPayGasSeparately, value = max_charge - vault_retained)
```

On the SUCCESS path the Vault retains only its **actual measured** import (the external passed the
zero-padding envelope check in 3.1 step 0 and the per-part shape walk, so `measured_import ≤
EXT_HARD_STATS` import always — the floor over-hold collapses to the real cost here) + Vault compute +
the Vault→Hub forward fee — all three named explicitly (v0.1 omitted forwarding; critical finding). The
difference `BatchChargeFloor_import − measured_import` (the worst-case over-hold) rides to the Hub inside
the value and returns to the user via the mode-128 ACK (5.3). Net user cost = actual chain costs +
explicit protocol fee — Q4 holds mechanically; the only non-returned surplus is the documented ×0.25
storage buffer (3.6).

### 3.4 Identifiers (unchanged from v0.1)

```text
parts_root_hash = signed_root.ref[0].hash()           // commits every part field and payload cell (verified)
publish_id      = hash(cell{'BPI1' ‖ manifest ‖ owner_wallet ‖ client_nonce ‖ parts_root_hash ‖ kind ‖ part_count})
bounce_id       = publish_id mod 2^64                 // pending key (narrow for bounce recovery)
bounce_tag      = hash(cell{publish_id}) mod 2^160
```

### 3.5 `PendingBatchPublish` (one cell, 765 bits)

```text
owner_wallet:Address | tombstone:Bool | refund_to_vault:Bool = true | nonce:u64
publish_kind:u8 | part_count:u8 | publish_id:u256 (FULL — ACK verifies by equality)
refundable_amount:u128 (= hub call value) | created_at:u32
```

Prune/tombstone flow carried from V1 (24h stale TTL → tombstone 24h TTL → delete; prune never refunds —
fail-closed). Receipt write points: tombstone creation updates the slot (by `pending.nonce`, guarded) to
`RES_TOMBSTONED`; a tombstone-window ACK/bounce overwrites to `RES_CONFIRMED`/`RES_BOUNCED_REFUNDED`.

**Pending observability (new):** `get_user_receipts` (6.5) includes `pending_publish_count` for the
owner, and `get_pending_publish(bounce_id)` returns `{exists, nonce, publish_kind, part_count,
created_at, tombstone}`. The client computes `bounce_id` locally (all `publish_id` inputs are known to
the signer). This makes the 6.4 diagnosis matrix implementable.

### 3.6 Canonical charge (affine; runtime-priced structural components)

```text
canonical_total = getForwardFee(EXT_HARD_CELLS, EXT_HARD_BITS, false)    // import HOLD — WORST CASE, not measured
                + getComputeFee(VAULT_BATCH_GAS(kind, n), false)         // Vault compute
                + getForwardFee(HUB_MSG_cells, HUB_MSG_bits, false)      // Vault->Hub fwd (measured; pays SendPayGasSeparately)
                + Σ_i [ discountedFee(owner, PROTOCOL_FEE_TON)           // 10,000,000 full, per part
                      + getComputeFee(HUB_PART_GAS(kind, class_i), false)
                      + STORAGE_RESERVE(kind) × 125/100 ]               // keepalive + endowment, with the
                                                                         // protectedReserve buffer INCLUDED (5.2)
                + getComputeFee(HUB_BATCH_BASE_GAS, false)
                + ACK_MIN_FORWARD                                        // floor for the ACK leg, returned via ACK
```

**Import term is the WORST CASE, not `vault_retained`'s measured import (resolves the v0.3 ambiguity).**
`canonical_total` is the value the honest client signs as `max_charge`; it MUST clear BOTH the floor gate
(3.1 step 5, which holds `getForwardFee(EXT_HARD_STATS)`) AND the underpriced gate (3.3 step 7). Were the
import term the *measured* `vault_retained` import, a small batch (e.g. 1×8K, whose downstream Σ is only
~5M nanoton) could fall below `BatchChargeFloor` (whose import is the ~72M–195M EXT_HARD constant) and an
honest send would fail its own floor gate. So `canonical_total` carries the SAME EXT_HARD import term as the
floor, guaranteeing `canonical_total ≥ BatchChargeFloor` by construction (G10). On success the Vault retains
only the *measured* import (3.3 `vault_retained`); the import over-hold `EXT_HARD_import − measured_import`
(~0.07 TON snapshot) rides to the Hub in the call value and returns via the mode-128 ACK.

The `getForwardFee(HUB_MSG_cells, HUB_MSG_bits)` term is **measured** (the same value used in `vault_retained`,
so it cancels exactly in `call_value = canonical_total − vault_retained`). `HUB_MSG_STATS` covers the full
`PublishBatchToHub` cell tree — a fixed `HUB_BATCH_MSG_ROOT_BITS = 924`-bit root cell + the parts subtree
(`measured_ext − the 1016-bit signed root`) + the optional marketing cell (public: +1 cell / +152 bits). It is
NOT the bare parts subtree: under `SendPayGasSeparately` the Vault pays this forward from its own retention,
so omitting it (or the root/marketing overhead) under-funds the Hub leg on large batches (where the import
over-hold is small but the forward is large) — a drain. Generator re-pins `HUB_BATCH_MSG_ROOT_BITS` from the
compiled ABI; gate G2 asserts no drift.

`STORAGE_RESERVE(kind)` = keepalive 1,000,000 + entry endowment (private 3,300,000 / public 7,400,000;
re-derived by the generator via `getStorageFee(entry cells, bits, 1 year)` at freeze). The ×1.25 factor
funds the Hub's `protectedReserve` buffer so fee flush/sweep can never freeze (5.2; major finding S1).
The aggregate `Σ_i [...]` is computed as `part_count × (...)` on the aggregate, NOT a per-part sum of
pre-divided terms, so the `×125/100` integer division matches 5.2/5.3 bit-for-bit regardless of whether
the generator's `STORAGE_RESERVE` is divisible by 4 (minor finding).

Margin policy (owner decision Q4): protocol *profit* margin exists ONLY in `PROTOCOL_FEE_TON` per part.
Honest accounting of the other components (review):
- compute / import / forward components are actual-cost; their unspent remainder DOES return via the ACK.
- the storage components do **not** fully return: the ×1.0 endowment funds the entry's own 1-year
  storage, and the ×0.25 buffer plus any snapshot-vs-actual surplus is retained by the Hub and becomes
  **treasury-sweepable** (`SweepExcessReserve` → FeeAccumulator) after the entry is pruned. This is
  storage-funding and deferred treasury revenue that the OWNER controls — it is transparent and on-chain,
  not hidden margin in inflated reserves (the Q4 concern was classic-sized exec constants pocketed
  silently; this is the documented storage buffer). Quantified: ~5/6 of each classic-sized endowment is
  eventually sweepable at snapshot prices.

Hold-vs-net (informative, pinned 2026-04-30 snapshot; recomputed in review): 4×8K private ≈ 0.11–0.12 TON
net vs 0.192 as 4 V1 singles (**−34 to −38%**); 20×1K ≈ 0.40 TON net vs 0.69 (**−42%**). The earlier
"−45%" was optimistic. At classic config the same formulas price ~6× higher automatically and stay
solvent.

## 4. Receipts

### 4.1 Storage

`UserState` gains ONE ref to a receipts root cell with 4 child cells × 5 slots = `RECEIPT_RING_K = 20`
slots of 184 bits (`{nonce:u64, action:u8, result:u8, aux:u64, part_count:u8, at:u32}`). Slot index =
`nonce mod 20` → child `idx / 5`, position `idx % 5`. All updates locate by nonce and verify
`slot.nonce` before writing (eviction-safe, late-ACK-safe; verified by review).

K rationale (revised after review): the documented worst burst is 10 near-simultaneous messages; under
the 2.3 batching policy that is normally ONE nonce, but the degenerate case (10 sequential externals +
avatar + username + withdrawals in flight) must not evict live `RES_PROCESSING` slots — K=20 gives the
documented burst 2× headroom at a storage cost of ~5 cells/user. `VAULT_USER_STATE_STORAGE_ENDOWMENT`
is resized by the generator for the 3→5-cell user footprint (major finding E5; the constant and its
derivation appear in the section-10 artifact).

### 4.2 Write points (exhaustive)

Every consumer of `user.publish_nonce` writes a receipt at the same commit that consumes the nonce — the
nine V2 action types (V1's ten receivers minus the publish merge): WithdrawTon, WithdrawAth,
ReplaceMessagingKeys, CreateReceiveIntent, ClaimReceiveIntent (recipient's nonce), CancelReceiveIntent,
PublishBatch, SetProfileAvatar, MintUsername. Every V1 silent return (17 private + 14 public) is now a
pre-accept throw (free) or a receipt-visible reject. **Pending payment structs for avatar and username
flows (`PendingProfileAvatarPayment`, `PendingUsernameMintPayment` and their registry-ACK/bounce/
tombstone handlers) gain a `nonce:u64` field with the same slot-locate-and-guard update discipline**;
username-mint finality = the registry ACK, not the ATH transfer leg. Release gate 10.G3: every
`return` after `acceptMessage` in Vault.tact is preceded by a receipt write.

### 4.3 Action codes (u8): `1..9` as listed above.

### 4.4 Result codes (u8, stable ABI; shared vectors in artifacts)

```text
0x00 RES_PROCESSING            non-terminal — thin client timeout fallback stays
0x01 RES_CONFIRMED             aux = first_entry_id (publish)
0x02 RES_BOUNCED_REFUNDED      retryable
0x03 RES_TOMBSTONED            written at tombstone creation; may be overwritten by 0x01/0x02 in the window
0x11 RJ_PART_SHAPE             rebuild-without-part        aux = part_index
0x12 RJ_CLASS_OR_SUITE         permanent                   aux = part_index
0x13 RJ_HASH_MISMATCH          rebuild-without-part        aux = part_index
0x14 RJ_PAYLOAD_SHAPE          rebuild-without-part        aux = part_index
0x15 RJ_DUPLICATE_ADJACENT     rebuild-without-part        aux = part_index
0x16 RJ_UNDERPRICED            retryable after re-pricing  aux = AUX_BATCH_LEVEL
0x17 RJ_INSUFFICIENT_BALANCE   (reserved; balance is fully pre-accept-gated in v0.2)
0x18 RJ_ID_ZERO                permanent anomaly           aux = AUX_BATCH_LEVEL
0x19 RJ_PENDING_COLLISION      retryable (wait ACK/prune)  aux = AUX_BATCH_LEVEL
0x20+ ATH-flow codes           avatar/username lifecycles; struct changes in 4.2 normative now,
                               code numbering frozen at ABI freeze
AUX_BATCH_LEVEL = 2^64 - 1
```

(Root-shape failures are pre-accept throws in v0.2 and have no receipt code.)

Diagnosis matrix (client-normative): `RES_PROCESSING` + pending exists (3.5 getters) → in flight;
`RES_PROCESSING` + pending absent → out-of-gas post-accept → thin timeout; **no slot holds nonce n →
evicted** → fall back to entry match (publish) or thin timeout (non-publish).

### 4.5 Getter

`get_user_receipts(owner)` → flat scalars `{exists, publish_nonce:u64, pending_publish_count:u32}` plus
the ring as cells. **Encoding discipline (normative for ALL new getters, Vault and Hub): flat scalar
stack items and plain cells/one-level dicts only — no nested tuples** (Orbs v2 normalization supports
only num/slice/cell; verified against the gateway).

### 4.6 Trust model

Receipts are a discovery accelerator, NOT a trust anchor. "Delivered" still requires self-authenticated
entry verification (hash match against locally held material) under the verified-cursor policy
(d3472cd). Honesty note (review): the message-history dependency is removed for *confirmation*, but
**body recovery for recipients still reads transaction history** (section 7) — content availability on
history-less providers is unchanged from V1 by design.

Degraded-mode reject policy (normative; major finding C6): an UNVERIFIED `RJ_*` receipt may trigger only
retry-safe behavior (resend-as-is, deposit, re-price). `rebuild-without-part` and permanent
terminalization REQUIRE a verified read of the receipt — a fabricated reject from a lying provider must
never cause content loss. When verification is structurally degraded, a reject terminalizes only after N
consistent unverified polls over T with the nonce observed consumed (N, T mirror the existing
structurally-degraded carve-outs in the client).

## 5. Vault → CapsuleHub protocol

### 5.1 `PublishBatchToHub` — opcode `0xA4F862D1`

Root (923 bits: op 32 + bounce_id 64 + bounce_tag 160 + publish_id 256 + kind 8 + part_count 8 +
protocol_fee_total 128 + author_wallet 267): op + 224 recovery bits FIRST (survive bounce truncation —
verified):

```text
op:u32 | bounce_id:u64 | bounce_tag:u160 | publish_id:u256
publish_kind:u8 | part_count:u8 | protocol_fee_total:u128 | author_wallet:Address
ref[0] -> first part cell (exact signed list)
ref[1] -> marketing cell {marketing_note:u152 = "sent via Platho.App"}   public batches only
```

### 5.2 Hub processing — validate-all-then-commit-all

Phase A (scalars): sealed; `sender() == vault_address`; `publish_id != 0`; `part_count ∈
[1, MAX_BATCH_PARTS]`; counter headroom; `protocol_fee_total ∈ [0, part_count × FULL_FEE]` (restores the
V1 per-entry fee bound); public: marketing cell equals the constant.

Phase B (structural pass, before hashing): per-part exact shapes (V1 `requireExactPayloadCell`
semantics, bounded `computeDataSize`); accumulate and check:

```text
required_value = protocol_fee_total
               + getComputeFee(HUB_BATCH_BASE_GAS + Σ HUB_PART_GAS(kind, class_i), false)
               + part_count × STORAGE_RESERVE(kind) × 125/100          // 1.25 buffer carried IN the value
               + ACK_MIN_FORWARD
throwUnless(context().value >= required_value)
```

The ×1.25 term makes each batch deliver its own `protectedReserve` growth (`indexStorageReserve` =
base × 125/100, CapsuleHub.tact:325-337) — fee flush and sweep can never be frozen by entry growth
(major finding S1). Release gate 10.G4: `effectiveBalance − protectedReserve` non-decreasing across the
publish matrix.

**Cross-transaction config-drift cushion (major finding, economics).** `required_value` is recomputed at
Hub-tx time T2 against `context().value`, which was fixed by the Vault at T1 (a different block) — if the
live fee config rises between T1 and T2 the runtime-priced gas terms grow and a *Vault-validated* batch
would bounce, burning the Phase-B walk gas and returning the user a not-quite-whole refund. Two
mitigations, both normative:
1. The Vault prices `canonical_total` (3.6) and the forwarded value with a drift cushion: every
   runtime-priced Hub-side component (Hub compute, ACK forward) is multiplied by
   `(CONFIG_DRIFT_NUM / CONFIG_DRIFT_DEN)` ≥ 1 (generator constant, e.g. 5/4 = +25%); the cushion rides
   in `context().value`, is unspent on the normal path, and returns to the user via the mode-128 ACK, so
   it costs the honest user nothing.
2. The Hub value gate is split: a **cheap lower-bound check moves into Phase A** (before the
   `computeDataSize` walk) — `context().value >= protocol_fee_total + part_count × MIN_PER_PART_VALUE +
   ACK_MIN_FORWARD` — so any unavoidable bounce (a drift beyond the cushion) is detected with O(1) gas
   and the 5.5 refund is near-whole. The full `required_value` check stays at the end of Phase B.

Release gate 10.G9: simulate a config rise within the cushion (no bounce) and beyond it (early Phase-A
bounce, refund ≥ value − O(1) gas) across the publish matrix.

Phase C (hashing): per-part payload `Cell.hash()` vs part hash fields; private: parse sender/recipient
key ids from `header_0` (V1 layout).

Phase D (commit; **no `commit()` inside loops**): per part in order — sequential `entry_id`; push
sender/recipient indexes (private) in part order; store entry (headers + hashes; body NOT stored);
`entry.publish_id = hash(cell{'EPI1' ‖ batch_publish_id ‖ part_index:u16})`; uid per V1 scheme; live
counters per entry; `accrued_plato_fee_ton += protocol_fee_total` once per batch.

Any throw in A–C aborts atomically (nothing stored, no fee, message bounces). Per-part failure
attribution via bounce is impossible by protocol (224-bit truncation) — attribution lives in Vault
reject receipts; Hub-side throws after a Vault-valid batch are limited to value/seal/sender/counter
classes plus true anomalies.

### 5.3 Batch ACK — `CapsuleHubBatchAck`, opcode `0x874E5771`

```text
op:u32 | publish_id:u256 | first_entry_id:u64 | part_count:u8 | batch_uid:u256
```

`batch_uid` = hash over the part-ordered per-entry uids (client cross-check; no on-chain consumer —
accepted cost, noted). Value mechanics:

```text
rawReserve(protocol_fee_total + part_count × STORAGE_RESERVE(kind) × 125/100,
           ReserveAtMost | ReserveAddOriginalBalance)                  // protect pre-existing balance
send ACK, mode 128 (carry all unreserved), bounce: false
```

User refund = actual unspent remainder of the batch's own value (gas-true; no fixed-0.030 fiction, no
stranded overpay). Pre-existing Hub balance is protected up to per-tx storage-fee dust (precision noted
by review). `ACK_MIN_FORWARD` (30,000,000 floor inside `required_value`) guarantees the ACK always
affords its forward fee; worst-case refund stays positive (verified ≈ +25M after ack fees).

### 5.4 Vault ACK receiver

`sender() == capsule_hub_address`; pending exists at `publish_id mod 2^64`; `pending.publish_id ==
msg.publish_id` (full equality). Then: credit `min(max(context().value − VAULT_ACK_EXEC_RESERVE, 0),
pending.refundable_amount)` to `user.ton_balance` — **capped at `refundable_amount`, matching the bounce
path 5.5 and V1 `refundPendingPublish` (Vault.tact:976-977); an uncapped credit would be an
unbacked-ledger insolvency primitive** (`VAULT_ACK_EXEC_RESERVE` = runtime `getComputeFee(ACK_GAS,
false)`); `creditActivityAirdrop(owner, min(pending.part_count × 10 ATH,
airdrop_remaining))` (Q2; `part_count` sourced from the pending record, never from the message);
receipt update by `pending.nonce` (slot-guarded) → `RES_CONFIRMED`, `aux = first_entry_id`; delete
pending; decrement count.

### 5.5 Bounce recovery (total by construction)

`bounced(PublishBatchToHub)`: if sender is not the hub, OR no pending at `msg.bounce_id`, OR the stored
`hash(cell{pending.publish_id}) mod 2^160 != msg.bounce_tag` — **silently absorb** (value joins the
Vault balance, fail-closed; the handler MUST NOT throw on any input — a delayed bounce after
tombstone-delete must not strand in a throwing handler). On match: refund
`min(context().value − VAULT_ACK_EXEC_RESERVE, pending.refundable_amount)` to the ledger; receipt →
`RES_BOUNCED_REFUNDED`; delete pending. Negative-matrix item: no input makes this handler throw.

## 6. Successor-manifest record (new section; design §3 item restored)

One-shot, genesis-controller-only record in the V2 Vault announcing a future successor deployment:

```text
message AnnounceSuccessorManifest { successor_manifest_hash:u256, successor_vault:Address }
- sender == genesis_controller; sealed required; record must be unset (one-shot, irreversible)
get_successor() → { announced:Bool, successor_manifest_hash:u256, successor_vault:Address, announced_at:u32 }
```

**Controller authentication post-seal + storage discipline (implementation, 2026-06-13).** `genesis_config_hash`
holds `hash(cell{controller})` pre-seal but is repurposed to the airdrop pool AT seal, so the controller
identity must be preserved separately to authenticate this post-seal announcement. It is stored — together with
the successor record — in a single **ref-stored** field `genesis_ext: Cell` (layout `controller_hash:u256 |
announced:Bool | (if announced) successor_manifest_hash:u256, successor_vault:Address, announced_at:u32`), built
in `init` from the pre-seal `genesis_config_hash` and rewritten on announce. Ref-storage is REQUIRED, not
stylistic: an inline `u256` field is deserialized by `contract_load` on every message inside the 10k pre-accept
credit and pushed a gas-edge external (signed ATH withdrawal) to OOG; the `Cell` ref costs only a pointer load
there and parses lazily in the (rare) announce handler + `get_successor` getter. Auth check:
`hash(cell{storeAddress(sender())}) == controller_hash`. The one-shot guard reads the `announced` bit.

Immutability is preserved (a data record, not an upgrade path); the NEXT migration becomes discoverable
in-protocol — clients poll `get_successor` at low frequency and surface the migration UX. This redeploy
suffers split-brain precisely because V1 lacks this record.

**Security of the announcement key (major finding).** Post-seal the contract has no admin/upgrade/pause
path, so this announcement is the genesis-controller key's ONLY standing post-seal power — and its sole
purpose is to set the migration *trust root*. A compromise of that key while the record is unset (the
normal state for V2's entire life) lets an attacker announce a fake `successor_vault` and the one-shot
guard then permanently locks out the real owner, potentially funnelling users and deposits. Mandatory
mitigations:
- **Custody:** the genesis-controller key is held in HSM/multisig and SHOULD be retired (provably
  destroyed) after the genesis ceremony if no successor is foreseen; document it as a standing
  high-value target.
- **The record carries NO auto-switch semantics.** Clients MUST NEVER auto-migrate on reading
  `get_successor`. It is a hint only.
- **Out-of-band confirmation (normative client UX):** before acting on an announced successor, the
  client MUST verify `successor_manifest_hash` AND `successor_vault` against the official multi-channel
  announcement and require explicit user confirmation. The migration UX presents the values for manual
  comparison; it never switches silently.

## 7. Body recovery V2 (new section; normative for client + gateway)

Bodies remain history-recovered (entries store hashes only). With batching, ONE Hub transaction carries
up to `MAX_BATCH_PARTS` bodies under opcode `0xA4F862D1`:

- Lookup keys: destination = CapsuleHub, opcode `0xA4F862D1`, `created_at` time bucket (V1 discipline).
  The V1 per-entry `body_hash` root-match shortcut is DEAD for batches — parsers MUST match by walking
  the part list.
- Part matching rule: given an entry, recover `(batch_publish_id, part_index)` by walking the candidate
  message's parts comparing the entry's stored hashes (`header_0_hash`/`header_1_hash`/`body_hash`
  private; `header`+`body_hash` public); `entry.publish_id` is one-way (`EPI1`), so hash-walk matching
  is the normative mechanism, optionally confirmed by recomputing `EPI1(batch_publish_id, part_index)`.
- `web/capsulehub-ton-rpc-provider.mjs` parser is REWRITTEN for the batch layout (single-part V1 opcodes
  do not exist on V2 deployments), including dual-provider verify of recovered bodies.
- Gateway deltas (allowlists for the new opcode and the new getter names in
  `deploy/platho-rpc-gateway.py`) are emitted as part of the section-10 artifact set — config drift here
  silently kills emergency-fallback body recovery.

## 8. CapsuleHub read API V2

### 8.1 `get_private_entries(key_id, role, from_link, limit)`

Single-cell dict encoding (4.5 discipline). Items: `{entry_id, entry_link, prev_link(role), created_at,
publish_id, header_0:^Cell, header_1:^Cell, body_hash, tail_truncated:Bool}` plus a head echo
`{latest_entry_link, entry_count}` — one verified call both imports a window and legally advances the
verified cursor (d3472cd-compatible). `tail_truncated` signals middle-prune; fall back to 8.2.

### 8.2 `get_private_entry_range(from_id, count)` / `get_public_entry_range(from_id, count)`

Sequential-id windows, prune-independent.

**Normative floor (review):** `HUB_GETTER_MAX_ENTRIES >= MAX_BATCH_PARTS (= 20)` for both getter
families; m17-extended validates the get-method gas at limit 20 (a 20-item response ≈ 6 KB — feasible,
verified); if measurement ever fails, `MAX_BATCH_PARTS` shrinks to match. Client default window stays 8;
sync and confirmation flows may request up to the floor. Sync acceptance: cold 200-entry account =
200/20 = **10 calls** (consistent now); 20×1K batch confirms in **2 logical getter calls**
(`get_user_receipts` → `get_private_entry_range(first_entry_id, 20)`), dual-provider verification
doubles transport requests, not logical calls.

### 8.3 Carried / changed

`get_private_entry`, `get_public_entry`, index getters unchanged. Page getters kept minus dead fields
(`opened_at`, `updated_at`). `get_canonical_publish_charge` is REPLACED by `get_charge_constants()`
returning the structural-constant table (client prices via config + table). `get_user` keeps its V1
shape; `get_user_receipts` and `get_pending_publish` added Vault-side (4.5, 3.5).

## 9. Client protocol (normative summary)

1. **Plan**: assemble parts (V1 formats); group already-queued parts of the same kind — across logical
   sends — into batches per 2.3 and the capacity/gas artifact.
2. **Mirror pre-validate**: client-side mirror of every Vault/Hub shape check, tested against the SAME
   shared vectors as the contracts; a mirror-passing batch cannot hit a permanent reject.
3. **Sign & send**: nonce `n`; multi-external plans pre-sign `n, n+1, …` and send back-to-back. A
   successor fails pre-accept (free) ONLY if `n` itself failed pre-accept. **If batch `n` is rejected
   POST-accept, the pre-signed `n+1` is still accepted** (nonce advanced at accept) — therefore after
   ANY `RJ_*` the client MUST wait for terminal receipts of all in-flight pre-signed batches, then
   rebuild and resend ONLY the failed batch's parts (never the whole plan — double-publish guard); the
   partial-delivery window for multi-external logical messages is protocol behavior and documented UX.
4. **Confirm**: poll `get_user_receipts` (tolerant unverified post-broadcast polls allowed; terminal
   transitions per 4.6 degraded policy). On `RES_CONFIRMED` → `get_private_entry_range(first_entry_id,
   part_count)` → local hash verification → delivered.
5. **Reject handling**: by code class, under the 4.6 degraded-mode policy (unverified rejects are
   retry-safe only).
6. Multi-device: unsupported, last-writer-wins (serial nonce + shared ring) — documented.

## 10. Generated artifacts and release gates (single source of truth)

Generator (extension of `scripts/publish_reserve_pricing.ts`) emits from one pinned input set
(structural measurement matrix over {kind} × {class} × part_counts INCLUDING adversarial mixed-class
compositions at the 65,535-byte ceiling):

1. Structural contract constants (cells/bits/gas tables; storage endowments via `getStorageFee` at
   freeze; `VAULT_USER_STATE_STORAGE_ENDOWMENT` resized for the 5-cell user footprint).
2. `web/message-pricing-policy.mjs` + capacity matrix module (client pricing = config × tables).
3. `artifacts/vpb2_capacity_gas_matrix.json` (client + m17-extended thresholds).
4. Shared vectors: reject codes, hub throw classes, receipt transitions, bounce-truncation,
   ACK reserve/mode-128 accounting, body-recovery part-matching.
5. Gateway config deltas (opcode + getter allowlists).

Release gates: **G1** worst-case pre-accept gas ≤ 10,000 (64 KiB external, part_count=20, 1×32K, fee
primitives included); **G2** Vault-balance non-drift across success AND reject paths at snapshot AND
classic config, adversarial mixed-class, **including padded-external attacks (the floor covers
worst-case import for any sendable external — section 3.1)**; **G3** every post-accept `return`
receipt-covered; **G4** Hub `effectiveBalance − protectedReserve` non-decreasing; **G5** byte-identical
regeneration; **G6** m15/m16/m18 + deployment manifests regenerated; **G7** bounce-handler totality (no
throwing input); **G8** worst-case POST-accept Vault walk gas ≤ 50% of the 1,000,000-gas tx limit
(adversarial mixed-class, `part_count = MAX_BATCH_PARTS`) — makes the 3.2 OOG forfeiture provably
unreachable; **G9** config-drift simulation: a rise within `CONFIG_DRIFT` does not bounce a
Vault-validated batch, a rise beyond it bounces in Phase A with refund ≥ value − O(1) gas (5.2);
**G10** honest-send liveness: `canonical_total(min batch) ≥ BatchChargeFloor` across the matrix so the
floor never blocks an honest minimal send (1×1K private, 1-part public).

## 11. Acceptance criteria

- 20×1K batch confirms end-to-end in exactly 2 logical getter calls; forced reject of part 17 →
  receipt names index 16 → client resends the failed batch only, no content loss, no double-publish.
- Kill-the-RPC drill: 6 nonces in flight, reads blocked → recovery on 1 rps keyless toncenter → all
  sends reach terminal states without ack-history, **including a forced reject terminalizing under the
  4.6 degraded policy**.
- Cold 200-entry sync ≤ 10 getter calls (gateway); completes on keyless fallback.
- No silent nonce burn reachable in the negative matrix; no input throws the bounce handler.
- Batched body recovery: recipient recovers all 20 bodies of one batch tx on gateway AND keyless paths.

## 12. PLATHO_CAPSULE_V1_FINAL_SPEC amendments (re-derived; applied at ABI freeze)

1. Lines 36–53 (*CapsuleHub Storage*): "Private publish messages carry three retrievable cells…" /
   public "two retrievable cells" → per-PART cells inside a batch envelope (section 5.1); body recovery
   per section 7.
2. Lines 130–133: the public per-entry "0.0337 TON" worked example → re-derived from V2 runtime pricing
   at publication time.
3. Lines 139–173 (*PWA Message Price*): per-capsule price composition and surcharge → affine batch
   formula (3.6); "0.030 TON fixed ACK reserve" → `ACK_MIN_FORWARD` floor + mode-128 actual remainder;
   "the signed amount above canonical … is retained in CapsuleHub … not a Vault refund" → INVERTED by
   the mode-128 ACK (unspent value returns to the user's vault balance).
4. Lines 298–312 (*Multi-Part Logical Messages*): "sequential signed Vault external publishes" →
   batched submission; sequential externals only for plans exceeding one external, with nonce
   pipelining and the 9.3 reject-recovery rule.

Everything else — capsule unit, cell formats, crypto binding, forbidden list — unchanged.

## 13. Batch airdrop economics — RESOLVED (owner decision, 2026-06-12)

**Decision: canonical 10 ATH strictly per capsule (per part), no caps** — i.e.
`creditActivityAirdrop(min(part_count × 10 ATH, airdrop_remaining))` stands as specified in 5.4.

Owner rationale (normative invariant): pool liquidity is collected from protocol fees, and the funding
floor is **≥ 15,000 TON collected by the time the 15M-ATH airdrop is exhausted**. This invariant holds
*mechanically* under per-capsule crediting, because the same per-capsule unit that earns 10 ATH also
pays the full `PROTOCOL_FEE_TON = 0.01 TON` (the ATH fee discount is gated until
`airdrop_remaining == 0`, so every airdrop-earning capsule pays the full fee): draining 15,000,000 ATH
requires exactly 1,500,000 fee-paying capsules → exactly 15,000 TON of accrued protocol fees, regardless
of batching, farming intensity, or wall-clock speed. Farming is therefore a purchase of ATH from the
protocol at ~0.0019 TON/ATH, of which the 0.001 TON/ATH fee component IS the liquidity being collected;
faster drain = faster funding, never cheaper funding. "More is allowed, less is not" — satisfied:
fee revenue can only exceed 15,000 TON (non-airdrop-credited activity after exhaustion, public posts,
rejects), never undercut it.

Release-gate corollary (10.G2 extension): assert in the negative matrix that no path credits airdrop
ATH without accruing the full per-part protocol fee in the same batch.

Quantified context (informative): V2 batching makes the drain ~20× faster in transactions (~75,000
externals) and removes ~1 TON/10 ATH of V1 execution overhead, but the fee floor above is
batching-invariant. The adjacent-duplicate guard (3.3) remains anti-bloat only.

Second owner rationale (why no anti-farming defense is needed at all): the pool launches with the
separate 15M-ATH liquidity allocation against the ≥15,000 TON collected — list price 0.001 TON/ATH.
Farming cost basis ≈ 0.0019 TON/ATH is ~1.9× the pool price, so farm-to-dump is irrational by
construction; a farmer is underwater at launch and is simply an early believer who pre-funded the
liquidity. Cutting their ATH would be unfair and is unnecessary.

## 14. v0.1 → v0.2 changelog (adversarial review responses)

Critical: runtime fee primitives replace classic-sized nanoton retention (hidden-margin/Q4 violation +
savings inversion — E1); import + Vault→Hub forward fees added as named components (insolvency — E2).
Major: gate redesigned to `max_charge` floor with runtime `BatchChargeFloor` (replaces part_count ×
worst constant); reject fee = measured actual (was self-contradictory "small constant"); Hub retains
×1.25 storage buffer (fee-flush freeze — S1); multi-send batching restored (serial-latency regression —
C1); K=10→20 with eviction row in the diagnosis matrix (C2); `HUB_GETTER_MAX_ENTRIES ≥ 20` normative
floor (pedant/C3); pending observability getters added (C4); pre-signed `n+1` post-reject recovery rule
(C5); degraded-mode reject policy (content-loss primitive — C6); body-recovery section added (C7);
getter encoding discipline globalized (C8); successor-manifest section restored; `BATCH_HUB_BASE_GAS` in
the Hub value gate; V1 amendment list re-derived (4 passages); avatar/username pending-nonce plumbing;
10k-credit release gate; user-state endowment resized. Minor: ACK `part_count` u16→u8; 65,535-byte
ceiling stated exactly; per-entry fee bound restored at Hub; bounce handler total-by-construction;
`RJ_ROOT_SHAPE` removed (pre-accept); `AUX_BATCH_LEVEL` defined; airdrop part_count sourced from
pending; storage-fee dust precision; batch_uid cost noted; farming numbers surfaced as section 13.
New-decision register (consciously accepted deviations from the reviewed design): runtime-priced
charges (3.0), gate-on-max_charge (3.1), K=20, mixed-class batches, marketing cell as ref[1], public
part form (528 bits), `get_charge_constants` replacing the V1 charge getter.

## 15. v0.2 → v0.3 changelog (3-verifier review of the runtime-pricing rewrite)

**Critical (import-fee drain, confirmed against `transaction.cpp` + @ton/sandbox):** the v0.2
`BatchChargeFloor` scaled the import term by `part_count` (`min(n × PART_32K_STATS, EXT_HARD)`), which
counts only the *signed* parts and undercounts attacker padding outside `signed_payload` — TON charges
import on the FULL external regardless. Fixed (3.1): (a) new pre-accept **outer-envelope `end_parse`**
(step 0) rejects envelope padding *before* `acceptMessage`, so it costs the attacker the message and the
Vault nothing; (b) floor import term is now the **part_count-independent** `getForwardFee(EXT_HARD_STATS)`
worst-case constant; (c) `canonical_total` and `reject_fee` carry the SAME `EXT_HARD_STATS` import term so
`canonical ≥ floor` (honest sends pass) and `reject_fee ≥ actual import` (no early-abort under-recovery);
(d) on success the Vault retains only the *measured* import and the over-hold refunds via the mode-128
ACK. Disclosure that V1 is already exposed on all 10 accepting externals (section 0); companion fix
(envelope `end_parse` + floor) scoped for the other 9.

**Major:** ACK credit capped at `refundable_amount` matching the bounce path and V1 (5.4 —
unbacked-ledger insolvency primitive otherwise); OOG-post-accept forfeiture made provably unreachable via
release gate G8 bounding the post-accept walk to ≤ 50% of the 1M tx limit, residual acknowledged (3.2);
cross-transaction config-drift cushion + Phase-A early value gate so an in-flight price rise does not
bounce a Vault-validated batch and any unavoidable bounce is near-whole (5.2, gate G9);
successor-manifest key hardening — no auto-switch, out-of-band confirmation, HSM/multisig + retirement
(section 6).

**Minor:** `PublishBatchToHub` root corrected to 923 bits (Address workchain); honest accounting that the
×0.25 storage buffer is transparent treasury revenue, not hidden margin (3.6); savings restated −34…−42%
(was −45%); aggregate `×125/100` rounding pinned (3.6); honest-send liveness gate G10; padded-external
path added to the non-drift gate G2.

**EXT_HARD_STATS sizing (open at freeze):** generator pins the fee-maximizing legal ≤65,535-byte external
(sandbox-confirmed, ~0.072 TON snapshot hold) with the config-43 cap `(8192, 2^21)` (~0.195 TON) as the
provable fallback; live mainnet config 25/43 re-read at deploy time. The hold is refundable and
per-external (batching collapses bursts to one external), so the steady-state balance requirement is
~0.07 TON per concurrent in-flight batch.
