# Immutable-contract audit — CapsuleHub.tact + Vault.tact (2026-06-22)

Multi-agent adversarial audit (72 agents, 8 lenses, 3 skeptics/finding + synthesis).
Counts: 21 findings | confirmed (>=2 votes) 4 | disputed (1) 9 | refuted (0) 8.
Scope: messaging core only (CapsuleHub + Vault). ATH/Username/Profile/FeeAccumulator NOT audited here.

---

## Verdict: GO-WITH-FIXES — do not seal genesis until the state-growth/rent endgame is resolved.

The new public author/parent index is structurally correct and faithfully mirrors the proven private
mechanism. The one true blocker is the **state-growth + storage-rent endgame**, which is a PROJECT-WIDE,
PRE-EXISTING property (the private side already shipped it on clean-09) — not a regression from the public
index. clean-10 is the window to fix it symmetrically.

---

## CONFIRMED (>=2 votes)

### [BLOCKER] State growth + rent + no eviction (CapsuleHub.tact:21,312-319,694-699,803-832,900-935; Vault.tact:359)
- Live state only ever GROWS on publish (public_entries/private_entries + 4 index dicts are .set-only).
- The only shrink path `receive(PruneCapsuleEntry)` (:900) is permissionless, **pays the caller nothing**
  (no rebate of the freed endowment), age-gated 1yr, and has **ZERO callers in web/** → in practice nothing
  is ever pruned, on public OR the already-live private side.
- Per-entry endowment ~13M nanoton (`(1M+9.4M)*1.25`) funds only ~7-8 yrs at the genuine config-18 rate
  (~240k nanoton/cell/yr) vs the project's assumed ~67k basis (~3.6x light).
- Endgame: cumulative rent > inflow → balance trends to the TON freeze/deletion threshold → total,
  unfixable loss of the messaging core (Vault.tact:5 = no admin/pause/upgrade/rescue).
- Fix (pick >=1, pre-genesis, apply to BOTH public and private): (1) opportunistic bounded eviction folded
  into each publish, paid from the new entry's value; (2) pay the pruner a gas rebate from the pruned
  endowment (self-incentivised); (3) fixed-window ring per index; (4) re-size endowment to the genuine
  100-yr rate + a committed perpetual funded keeper bot.

### [HIGH] authorKeyId has no production client derivation (CapsuleHub.tact:549-551; web/*.mjs)
- Contract keys the author index by `hash(storeAddress(addr))` (full 267-bit address). NO production client
  computes it (only a comment at capsulehub-ton-rpc-provider.mjs:1062). The existing helper
  `basechainAddressHashValue` returns the BARE 256-bit account hash = a DIFFERENT value.
- Dormant (no callers yet) → latent landmine: wiring the wrong key makes getPublicAuthorIndex return
  exists:false for EVERY author, indistinguishable from "no posts".
- Fix (do this when writing the client read-path): add `computePublicAuthorKeyId(addr)` =
  `beginCell().address(addr).endCell().hash()`, route all callers through it, cross-impl test vs the test
  kit's `addressCellHash()`. Do NOT reuse basechainAddressHashValue.

### [HIGH->MED] Middle-prune link truncation (CapsuleHub.tact:588-622 public, :509-545 private)
- prune helpers patch latest_entry_link only when pruning the HEAD; never rewire a successor's prev_link.
  A middle prune leaves a dangling prev_link → backward walk hits a deleted id (exists:false) → silently
  truncates, dropping older entries. entry_count keeps the historical total → diverges from reachable count.
- Adversary (prune is sender-unrestricted, age-gated only) can prune a 1yr-old middle comment to truncate a
  feed. Mitigants: tail (oldest-first) prune order creates no hole; orphans still addressable by id;
  get_public_page recovery exists. Inherited from the private design (documented intentional).
- Fix: pin the immutable client contract — entry_count is a historical UPPER BOUND not a walk length;
  clients tolerate holes; define a deterministic recovery read that isn't O(total).

### [MED] Recalibration evidence uncommitted (hygiene)
- The constant changes + regenerated evidence are uncommitted; commit contract+build+CODE_HASHES+economics
  reports ATOMICALLY, re-run full suite at that commit, verify served hash by byte size — before clean-10.

---

## NEEDS HUMAN DECISION (disputed; immutable stakes)

- **A. Retention model (CRITICAL vs LOW)** — is per-entry data a 1-year-retention model (then eviction must
  be FORCED or FUNDED — currently neither) or persist-forever (then endowment ~13-17x under-funded)? This is
  the GO/NO-GO decision; same root as the blocker.
- **B. Public/comment gas gates** — the recalibration's gas proof is validated almost entirely on the
  PRIVATE branch; no committed test exercises a multi-part PUBLIC batch or a COMMENT (parent_link!=0) part.
  Margins measured-safe in-session. Recommend adding the 3 committed gates before genesis (cheap, high assurance).
- **C. 2106 uint32 clamp (Vault.tact:2625-2627)** — tombstoneExpiresAt clamped to UINT32_MAX (2106) and
  stored into a uint64 field; collapses the 24h late-settlement grace post-2106 (year ~80 of 100). Gratuitous
  (field is uint64). Recommend removing the clamp.

---

## SCALE & LONGEVITY
- Counter/id overflow: SAFE. entryId/latest_id/entry_count/latest_entry_link all uint64 (~1.8e19 >> ~1e12 at
  billions/yr×100yr); author-index key uint256 (no collision); per-op gas O(64) dict depth, scale-independent.
- Dominant long-term failure mode: the storage-rent endgame above — the design does NOT survive it as-is.
- Virtual-page entry_count overstates reachable after prune (bounded <=256/page); use live_count from get_state.

## DEAD / DUP
- PruneCapsuleEntry effectively dead in production (no callers) — operational half of the blocker.
- Exit-code collisions across receivers (13500/01/02/30, 13510/11/12/20 reused) — cosmetic/observability only.
- comment parent existence unchecked (intentional, mirrors private retained-history hint).

## RESIDUAL RISK (confirm before sealing)
- **Confirm LIVE mainnet config-18 prices (cell_price_ps/bit_price_ps) against the deploy target** — the entire
  economics verdict pivots on this number; the committed snapshot has bit_price_ps=0 (makes the +128 entry bits
  free in the model).
- The ~67k/cell/yr rate basis is shared project-wide → the sibling contracts (ATH/Username/Profile/FeeAcc) may
  also be under-calibrated; re-derive across ALL contracts before any immutable deploy.
- Low-severity money warts (sub-1e-5 TON/msg drift; self-inflicted reject overcharge) — optional hardening.
