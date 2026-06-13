# Platho Redeploy — Implementation Plan

Date: 2026-06-12. Companion to `REDEPLOY_V2_DESIGN_DRAFT_RU.md` (design + owner decisions) and
`PLATHO_PUBLISH_V2_VPB2_SPEC_DRAFT.md` (publish-path spec v0.3). This plan sequences the work into
sessions, records the AAA+ design calls made on the smaller forks, and maps the release-machinery cascade
that every contract change triggers.

Framing (owner, 2026-06-12): this is **a methodical diff over the proven contracts**, not a rewrite. The
audited ATH / genesis / withdrawal / intent / fee / airdrop logic is carried unchanged. A full re-genesis
of all 9 contracts is happening regardless (owner Q1: clean slate, new ATH); the work below packs the
batch-publish feature + confirmed-bug fixes into that mandatory redeploy window. No shortcuts, no
crutches.

## The release-machinery cascade (applies to EVERY contract change)

The repo is a deterministic hash-locked pipeline; any `.tact` edit cascades:

```
edit .tact → npm run build (tact_build.js, all 19 projects)
           → node scripts/hash_codes.js   (MANUAL — not in npm scripts; writes artifacts/*CODE_HASH*.txt)
           → regenerate vectors           (5 generators embed code hashes; m18 checks them)
           → regenerate pricing/gas        (publish_reserve_pricing.ts, gas_reserve_m17.ts)
           → regenerate deployment manifest (deployment_manifest_m15.ts → hash → on-chain Bind/Seal)
           → refresh integrity locks        (conformance_m16.ts, artifact_integrity_m18.ts SHA-locks every source file)
           → full suite (vitest, ~98 files) + release-truth-single-source.test.ts
```

Ordering hazard (m18 SHA-locks every file in `contracts/ scripts/ tests/`): the integrity lock can only
be re-pinned **after** all sibling edits in a session are final. So each session ends with one lock-refresh
+ full-suite pass, never mid-session. `hash_codes.js` is easy to forget (not wired into npm) and its
omission produces confusing cross-file mismatches — it is step 2 of every rebuild.

Single-source-of-truth debt to fix (VPB2 §10 G5): pricing constants are currently hand-duplicated in
THREE places (`contracts/*.tact`, `publish_reserve_pricing.ts` CURRENT map, `web/message-pricing-policy.mjs`)
plus the manifest constants block. Session 2's generator collapses this; until then, edits touch all
copies.

## Session 1 — Username NFT collection-render + registry/profile semantics  *(most isolated; start here)*

Goal: kill the username-NFT rent bug (item BoC is 37,949 bytes of SVG-in-CODE; endowment dies ~242 days)
by moving rendering to the collection (registry), shrinking the item, and dropping the redundant
percent-encoded art copy. Plus the small companion semantics.

Verified facts that shape it:
- The ~38KB is the item's **code cell** (SVG string literals in render helpers), not its data. Data is
  already compact (`UsernameNFTItem.tact:76-83`).
- Art is stored **twice**: raw (`appendSvg*Tile` → `image_data`) and percent-encoded (`appendSvgUri*` →
  `image` data-URI). The username alphabet is URI-safe, so the encoded copy is redundant — keep one, no
  runtime percent-encoding (that path is the 3–4M-gas trap to avoid).
- `get_nft_content(index, individual_content)` on the registry is a pure passthrough today
  (`UsernameRegistry.tact:656-658`). `index == name_hash` is **one-way** — the username is NOT derivable
  from it, so the username MUST travel in `individual_content` from the item to the registry renderer.

Steps:
1. **Empirical gate — RESOLVED (multi-source research, 2026-06-12).** Verdict: flow (A) is canonical and
   authoritative. getgems, Tonkeeper/tonapi, toncenter v3, and tonviewer ALL obtain item content by
   calling the collection's `get_nft_content(index, individual_content)`; none shortcut to the item's
   `get_nft_data` content. TEP-62 explicitly makes `individual_content` the *partial* part the collection
   completes; the official `ton-blockchain/token-contract` reference collection composes content on-chain
   in `get_nft_content` (the load-bearing precedent for our heavier SVG-rendering version). TON DNS /
   telemint prove slim items render fine but use passthrough `get_nft_content` (composed off-chain), so
   the on-chain-composition precedent is the reference token-contract, not DNS. **Decision: proceed.**
   Keep a minimal-but-valid TEP-64 on-chain content cell in the item (`name = "<username>.ath"` +
   `description`) as a fallback for rare non-standard direct-readers — NO SVG in the item. A testnet
   render check on getgems/tonkeeper remains a Session-1 exit confirmation, but it no longer gates the
   architecture.
2. Move all render helpers (`appendUsernameSvgChar`, `appendSvg*Tile`, tier tiles, `appendSvgDefs/Shell`,
   `snakeImageDataCell`, `individualContent`) from `UsernameNFTItem.tact:147-643` INTO
   `UsernameRegistry.tact`, re-parameterized to take `(username_len, username slice)` instead of `self.*`.
3. Rewrite registry `get_nft_content` to render the TEP-64 on-chain content (marker=0 + name/description/
   image_data dict) from the username carried in `individual_content`. **Wire format (AAA+ call):** the
   slim item's `individual_content` is a length-prefixed raw blob `{marker:u8=0x01 private-render-input,
   username_len:u8, username:slice}` — trivial to parse, no dict overhead. The item ALSO exposes a minimal
   self-describing public content (`name = "<username>.ath"`) for naive direct readers until the empirical
   gate clears.
4. Delete the percent-encoded URI render path entirely (`appendSvgUri*`, `snakeImageCell` —
   `UsernameNFTItem.tact:213-218, 337-451, 497-552, 570-637`). Keep raw `image_data` only (re-confirm
   marketplaces accept raw SVG `image_data`; if a data-URI `image` is required, store the percent-encoded
   **static markup** once in the registry, still no runtime encoding).
5. Shrink item: `individualContent()`/`get_nft_data` return the slim blob, not the art.
6. **Companion semantics (AAA+ calls):**
   - Rename `NameRecord.owner_wallet → minter_wallet` (`UsernameRegistry.tact:73-77`, writes :483-487,
     view :102-107/:668-685, client decoder `username-ton-rpc-provider.mjs:173`). Clean rename now since
     redeploy; client already treats it as non-authoritative.
   - ProfileRegistry active username (see below) — note: lives in ProfileRegistry, grouped here as the
     "username identity" change set.
   - `PROFILE_AVATAR_MAX_PARTS 16 → 2` in BOTH `ProfileRegistry.tact:21` AND `Vault.tact:121` (lockstep —
     Vault has its own copy; mismatch causes a wasted 100-ATH bounce). Update `profile-registry.test.ts`
     PROFILE-02B (reject 3, accept 2) and fixtures using part_count 8.
7. Rebaseline `username_registry_storage_economics.ts` item floor (item far smaller now).
8. Tests: rewrite `username-nft-item.test.ts` USERNAME-NFT-08/08A/08B for the slim payload; ADD registry
   `get_nft_content` render tests (currently zero coverage).

**Scope note (2026-06-12):** the **active-username feature** (new on-chain pointer) is MOVED to Session 3
(Vault), because it adds a new Vault external + signing domain, and bundling all new Vault externals into
one session avoids touching Vault twice. Session 1 keeps: collection-render, `minter_wallet` rename,
avatar cap 16→2. The ProfileRegistry struct/getter/receive for the active username land together with its
Vault external in Session 3. Design calls below stand; they execute in Session 3.

AAA+ design calls (active username, from the ProfileRegistry grounding):
- **Free, not 100 ATH** to set the active username (charging to switch which of your own names is shown
  is hostile). Flows as a plain signed `Vault → ProfileRegistry` internal (new Vault external
  `SetActiveUsernameFromVaultBalance`, new domain `VUA1 = 0x56554132`*, consumes `publish_nonce` for
  replay-ordering), gated registry-side on `sender()==vault_address`. (* pick a free domain value at
  freeze; `0x56554131` 'VUA1' collides phonetically with VUN1 — verify uniqueness in the registry.)
- **Delegate validation to readers, do NOT bind UsernameRegistry into ProfileRegistry.** Store
  `ProfileUsernameRecord{owner_wallet, username_item_address, name_hash, updated_at}` in
  `map<Address, …>`; resolution = read item `get_state.owner_wallet == profile owner` (item is
  authoritative; a transferred-away name auto-resolves "not active"). This matches the existing
  `resolveAuthoritativeUsernameItemOwnership` rule and avoids adding a genesis binding (validate-at-set
  would go stale on transfer anyway, so the binding buys nothing). Carry `name_hash` in the message so
  the reader can cross-check `record.item_address == derive(name_hash)` without an extra read.
- New getter `get_active_username(owner)` (get-method count 6→7; update ABI snapshots).

Session 1 exit: testnet marketplace gate documented + decided; contracts build; full suite green;
hashes/vectors/manifest/locks refreshed.

**Session 1 STATUS (2026-06-12) — contract work DONE + functionally verified.** Implemented: collection
render (item 37,949 → 1,352 B; registry +2 KB net thanks to the initOf-embedded-item cancellation),
`minter_wallet` rename (+ doc), avatar cap 16→2 (ProfileRegistry + Vault). All 3 contracts compile.
New `tests/username-collection-render.test.ts` proves the renderer works end-to-end (EPIC/RARE/COMMON +
16-char two-row + reject-too-short). Affected tests fixed: item 08/08A/08B collapsed to a slim-content
test; profile avatar fixtures + PROFILE-02B boundary (reject 3, accept 2); name-record
`.owner_wallet`→`.minter_wallet` across 6 test files (20 sites; KeyRecord/avatar untouched); vault-ath
avatar part_count 3→2. **All functional tests green (the 6 username/vault-ath files: 57 passed).** The
~30 remaining full-suite reds are EXCLUSIVELY the regeneration cascade (CURRENT_CODE_HASHES staleness →
m16-CONF-03, storage-economics live-hash compares, m20f; stored artifacts → vectors, manifest, m18 lock,
release-truth, storage report JSONs). CONFIRMED none is a real regression.

**Regeneration-cascade sequencing decision:** the hash/vector/manifest/m18-lock/test-summary regeneration
is NOT run per-session — it is CONSOLIDATED ONCE in Session 5, because Sessions 2–4 change Vault/CapsuleHub
again (re-changing hashes), so per-session regen is wasted work and fights the m18 source-lock ordering
hazard. Interim full-suite reds on integrity-lock tests are expected during multi-session contract dev;
the per-feature unit/functional tests are the dev-time gate. Remaining Session-1 items folded into
Session 5: regenerate hashes/vectors/manifest, rebaseline username/profile storage-economics artifacts,
testnet render check on getgems/Tonkeeper.

## Ordering refinement (2026-06-12, after machinery study)

The Session-2 generator's gas constants (`HUB_PART_GAS`, `VAULT_BATCH_GAS`, `WALK_GAS_MAX`, …) can only be
MEASURED against the deployed batch contracts — which Sessions 3–4 build. Contract ↔ constant is a
calibration loop, not a linear dependency. The VPB2 spec resolves it: contracts price at RUNTIME via TVM
fee primitives over immutable STRUCTURAL constants; gas values are calibrated from measurement once the
contracts exist. Consequences for sequencing:

- **`EXT_HARD_STATS` is settled by reasoning, not measurement:** the provably-safe pin is the protocol
  message caps `(EXT_HARD_CELLS = 8192, EXT_HARD_BITS = 2^21 = 2_097_152)` →
  `getForwardFee ≈ 0.1945 TON` at the pinned snapshot (`lump 66_667 + ceil((4_369_067·2^21 +
  436_906_667·8192)/2^16)`). The tighter byte-reachable ~0.072 TON is NOT provable for an immutable
  contract (BoC construction space is unbounded), so we take the safe cap. The hold is refundable and,
  with batching, per-external not per-message.
- **The Session-2 generator merges into the Session-5 calibration.** There is no significant
  contract-independent generator work that blocks Session 3: the capacity matrix is byte-arithmetic
  (already in the spec), storage endowments are `getStorageFee` over the spec's fixed cell shapes, and
  the gas constants need the contracts. So Sessions 3–4 write the contracts using spec-defined structural
  constants with named initial gas values; Session 5 measures + finalizes them (the single-source
  generator + byte-identical-regen gate).
- **Revised order: Session 1 (done) → Session 3 (Vault) → Session 4 (Hub) → Session 5 (generator +
  calibration + all regeneration + release gates) → Session 6 (client) → Session 7 (genesis).** Session 2
  as a standalone phase is dissolved into Session 5.

## Session 2 — Structural-constant + capacity/gas generator  *(DISSOLVED into Session 5 — see ordering refinement above)*

Invert the current hand-duplicated pricing into one generator (extend `publish_reserve_pricing.ts`).
Emits: structural contract constants (cells/bits/gas per kind×class), storage endowments via
`getStorageFee`, `EXT_HARD_STATS` (sandbox-measured fee-maximizing ≤65,535-byte external + config-43 cap
fallback), `VAULT_USER_STATE_STORAGE_ENDOWMENT` (5-cell footprint), `web/message-pricing-policy.mjs`,
`artifacts/vpb2_capacity_gas_matrix.json`, shared vectors, gateway deltas. Redesign the CURRENT-map echo
pattern (contracts no longer carry nanoton constants — they price at runtime via TVM primitives, so the
generator emits *structure*, and the report validates runtime pricing vs measurement). Re-read live
mainnet config 25/43 at deploy.

## Session 3 — Vault batch publish path

Per VPB2 §2–§6: new external `PublishBatchFromVaultBalance` (op `0x7E1F5041`); **outer-envelope
`end_parse` on ALL 10 accepting externals** (kills the confirmed import-fee drain for free, §3.1 step 0);
`BatchChargeFloor` (runtime `getForwardFee(EXT_HARD_STATS)` + walk + reject); single `max_charge` debit at
accept; post-accept single walk → atomic reject WITH refund (`EXT_HARD` reject_fee); `PendingBatchPublish`
(full publish_id); receipt ring K=20 + write points on all 9 actions + `Pending*Payment` nonce plumbing;
`AnnounceSuccessorManifest` one-shot; new domains VPB2/BPI1/EPI1, retire VPB1 + ops `0x7E1F5031/32`;
replace constants `Vault.tact:79-133` with runtime fee pricing over generator structurals;
`get_user_receipts` + `get_pending_publish`. Depends on Session 2.

## Session 4 — CapsuleHub batch ingest + ACK + paginated getters

Per VPB2 §5,§8: `PublishBatchToHub` (op `0xA4F862D1`) validate-all-then-commit-all (Phase A scalars +
early value lower-bound, B structural + full value gate with ×1.25 storage buffer, C hashing, D commit
with no `commit()` in loop, per-entry `EPI1` id); `CapsuleHubBatchAck` (op `0x874E5771`) mode-128 +
`ReserveAddOriginalBalance`; `get_private_entries` + `get_private_entry_range`/`get_public_entry_range`
(`HUB_GETTER_MAX_ENTRIES ≥ 20`, single-cell dict encoding); replace `get_canonical_publish_charge` with
`get_charge_constants`; drop page dead fields. Depends on Sessions 2–3.

## Session 5 — Negative matrices, gas harness, vectors, manifests, release gates

Rebaseline `gas_reserve_m17.ts` for batch (1..20 parts, mixed-class, adversarial-to-65,535-byte). Release
gates G1–G10 (pre-accept ≤10k; Vault non-drift incl. padded-external at snapshot+classic; receipt
coverage; Hub effectiveBalance−protectedReserve non-decreasing; byte-identical regen; m15/m16/m18 +
manifests; bounce totality; OOG walk ≤50% of 1M; config-drift; honest-send liveness). New shared vector
generators + `artifact_integrity_m18.ts` stableArtifacts/codeHashChecks extension. Regenerate manifest
(decide V2 domain/version — `PLATHO.V2.*` vs M15 bump 16) keeping `deployment_manifest_m15.ts` and
`mainnet_genesis_verify.ts` final-genesis preimage in agreement. Depends on Sessions 3–4.

## Session 6 — Client rework

New publish/confirm/sync over receipts + paginated getters; mirror pre-validator (shared vectors);
batched body-recovery parser rewrite (`capsulehub-ton-rpc-provider.mjs`, dual-provider verify);
degraded-mode reject policy; pre-signed `n+1` post-reject recovery; gateway opcode/getter allowlist
deltas (`platho-rpc-gateway.py`); active-username picker (prefer on-chain pointer over the
`platho.wallet.linkedPlathoUsername.v1` localStorage); NFT transfer UI; retire ack-history/absence-proof/
wedge machinery; `web/platho-config.mjs` manifest hash + SW cache bump. Depends on Session 4.

## Session 7 — Genesis ceremony, verify, switch

Full re-genesis of all 9 contracts with new ATH (Q1); bind/seal; hash-equality gates (ATHWallet
byte-identical vs new ATHMaster); deploy-time re-read of live config 25/43; `mainnet_genesis_verify.ts`;
drain owner test TON from old Vault; hard manifest switch in client. Migration is a trivial checklist (no
real users). Depends on Sessions 5–6.

## Open forks deferred to their session (not blocking start)

- Manifest domain/version for V2 (`PLATHO.V2.*` new vs M15 bumped) — Session 5.
- Whether `web/message-pricing-policy.mjs` is fully generator-emitted (G5) or hand-maintained against a
  generated JSON — Session 2.
- Exact `EXT_HARD_STATS` value (sandbox measurement) — Session 2.
- Whether any contract is added (e.g. a separate render contract) vs the stable 11-contract set — decided
  in Session 1 (default: keep the set; render lives in the existing registry).
