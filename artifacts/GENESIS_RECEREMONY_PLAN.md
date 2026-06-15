# Platho Mainnet Genesis Re-Ceremony Plan — Fixed UsernameRegistry

**Status:** DRAFT FOR OWNER REVIEW. This is a planning document only. Do NOT deploy, broadcast,
or edit contracts based on this file until the owner approves and the pre-flight gates pass.

**Date:** 2026-06-15
**Branch context:** `codex/username-nft-safe-image-uri` (generator fix uncommitted: commits f5a6e6a +
96c3c99 referenced in the task; current working tree carries the UsernameRegistry SVG fix).

---

## 0. Why a full re-ceremony is forced (one-paragraph recap)

The live mainnet genesis (deployed + verified 2026-06-14, manifest hash `5980b2a2…`) is **immutable** —
`contracts/UsernameRegistry.tact:4` and `contracts/Vault.tact:5` explicitly state no
admin/owner/pause/**upgrade**/setcode/governance path exists (confirmed by grep: the only `upgrade`/`setcode`
hits are comments saying there is none, and Vault.tact:1295 is a migration-*hint* comment, not a setcode path).
The Vault is **sealed** (`snapshot.vault.sealed=true`) and was bound to the old registry pre-seal
(`Vault.BindUsernameRegistry`, see `scripts/mainnet_deploy_packet.ts:255`, gated by `requireUnsealed()`).
The registry code hash changes with the SVG fix (`783ebf58…` → new), and `UsernameNFTItem` code is embedded
in the registry (`initOf` in `deriveItemAddress`), so the item child also changes. A new registry cannot be
bound into the sealed Vault. Therefore the fix can only ship by **re-running the entire genesis ceremony on a
fresh, non-colliding address set**, orphaning the current live deployment.

Live state is **pre-adoption** (`vault.user_count=0`, `vault.name_record_count=0`,
`username_registry.name_record_count=0`, `pending_mint_count=0`), so nothing of user value is lost on-chain
besides the two demo names `platho.ath` / `sexybitch.ath` and the orphaned ATH token + DeFi suite (see §8).

---

## 1. The address-derivation problem — THE KEY QUESTION

### 1.1 How addresses are derived (deterministic, no salt field)

All genesis addresses are derived 100% deterministically inside
`scripts/mainnet_final_manifest_draft.ts` (`buildDraft`) and re-derived identically in
`scripts/mainnet_tx_dry_run_packet.ts` (`deriveState`). The inputs are:
- the **manual role addresses** in `artifacts/local/mainnet_roles.local.json`, and
- the **contract code** (the compiled `build/*/*.code.boc`).

There is **no nonce/salt parameter** in any init. The init signatures (read from source) are:

| Contract | init signature (file:line) | Address depends on |
| --- | --- | --- |
| ATHMaster | `init(athTreasuryOwner, athContent)` (draft.ts:196) | `ath_treasury_owner` role + ATH metadata content cell |
| ATHVesting | `init(athMaster, vestingBeneficiary, startTime)` (draft.ts:202) | ATHMaster addr + beneficiary role + start time |
| BuybackBurn | `init(addressHash(genesisController), athMaster)` (draft.ts:205) | **genesis controller** + ATHMaster |
| MarketStabilitySeller | `init(addressHash(genesisController), athMaster)` (draft.ts:208) | **genesis controller** + ATHMaster |
| FeeAccumulator | `init(tonTreasuryReceiver, buybackBurnAddr)` (draft.ts:211) | ton-treasury-receiver role + BuybackBurn |
| **Vault** | `init(genesisController, athMaster, capsulePlaceholder, addressHash(genesisController), false, false, 0)` (draft.ts:214; `Vault.tact:538`) | **genesis controller** (twice) + ATHMaster + placeholder |
| CapsuleHub | `init(feeAccumulator, vaultPlaceholder, false, false, 0, genesisController)` (draft.ts:217) | FeeAccumulator + placeholder + **genesis controller** |
| **UsernameRegistry** | `init(athPlaceholder, athMaster, treasuryAthReceiver, false, 0, 0, genesisController)` (draft.ts:220; `UsernameRegistry.tact:185`) | placeholder + ATHMaster + treasury-ath-receiver + **genesis controller** + **registry code** |
| ProfileRegistry | `init(athPlaceholder, athMaster, profileTreasury, false, 0, 0, genesisController)` (draft.ts:223) | placeholder + ATHMaster + profile-treasury + **genesis controller** |
| Official ATHWallets | `ATHWallet.init(0, ownerContract, athMaster)` | owner contract addr + ATHMaster |

`addressHash(addr)` = `BigInt('0x' + beginCell().storeAddress(addr).endCell().hash())`
(draft.ts:68). The Vault's `vault_ath_wallet_address` *init slot* is also fed the genesis-controller
address (draft.ts:214, first arg) — i.e. the controller appears in the Vault init **twice**.

### 1.2 What collides if we keep the current roles and only change registry code

If we rebuild with the fixed registry but keep `mainnet_roles.local.json` unchanged:
- **UsernameRegistry** and **username_registry_official_ath_wallet** → NEW addresses (code changed). ✅
- **Every other contract** (Vault, CapsuleHub, ProfileRegistry, BuybackBurn, MSS, FeeAccumulator,
  ATHMaster, ATHVesting, all their official ATH wallets) → **IDENTICAL** to the live sealed set,
  because none of their inits reference the registry address or code.

That is fatal: the "new" Vault address would BE the live sealed Vault (`UQC5gVebW…`,
`snapshot.vault.sealed=true`). We cannot re-deploy/re-bind a sealed contract. The deploy-packet builder
also hard-fails on this — `validateDistinctManifestAddresses` (mainnet_deploy_packet.ts:140) only checks
distinctness *within* the new set, not against the live chain, so the collision would only surface at
broadcast time when the Vault deploy external is rejected (account already active). **We must force a
fresh Vault.**

### 1.3 The mechanism to get a clean, non-colliding new set

**Change the `genesis_controller_one_shot` role address** in `artifacts/local/mainnet_roles.local.json`
(currently `UQBZ8Lh9AuO1e9XcFBJ0NmE10IY9FoVpQeoABd9V5ninPATH`). Note `buyback_launch_controller` and
`market_stability_launch_controller` are validated to **equal** the genesis controller
(`requireSameAddress`, draft.ts:188-189) — so all three move together (they are one wallet today).

Changing the genesis controller forks, via the table above:
- Vault (controller appears twice in init) → NEW ✅ (fresh, **unsealed** → bindable)
- CapsuleHub (controller in init) → NEW ✅
- ProfileRegistry (controller in init) → NEW ✅
- BuybackBurn (`addressHash(controller)`) → NEW ✅
- MarketStabilitySeller (`addressHash(controller)`) → NEW ✅
- FeeAccumulator (depends on BuybackBurn, which moved) → NEW ✅
- All official ATH wallets of the above (owner contract moved) → NEW ✅

But it does **NOT** move:
- **ATHMaster** — init is `(ath_treasury_owner, athContent)`; neither changes → SAME address as live
  (`UQA_iaT8mdvU…`). **COLLISION.** ATHMaster is `active` on the live chain
  (`snapshot.ath_master.account_state=active`, treasury supply already deployed).
- **ATHVesting** — `(athMaster, beneficiary, startTime)`; if all three are unchanged → SAME address. COLLISION.
- **ath_treasury_owner_ath_wallet** — `(0, treasuryOwner, athMaster)` → SAME. COLLISION (and it
  holds 75M ATH on the live chain).

**Therefore changing only the genesis controller is INSUFFICIENT.** To get a fully clean set we must
ALSO change `ath_treasury_owner` (which re-forks ATHMaster → which re-forks ATHVesting, all official ATH
wallets, the treasury-owner ATH wallet, and the 100M supply re-mint). The cleanest, least-error-prone
approach is therefore:

> **Mint a fresh set of vanity role wallets and change ALL protocol-role addresses, treating this as a
> brand-new genesis on a brand-new address space.** At minimum the two *structural roots* must change:
> `ath_treasury_owner` (forks ATHMaster subtree) and `genesis_controller_one_shot` (forks
> Vault/registry subtree). The treasury-receiver roles (`ton_treasury_receiver`,
> `treasury_ath_receiver`, `profile_registry_treasury_ath_receiver`, `ath_long_term_vesting_beneficiary`,
> `market_stability_*`) do not *have* to change to avoid collisions, but the manifest validators forbid
> them from equaling any protocol role (mainnet_deploy_packet.ts:131-174,
> mainnet_genesis_verify.ts:527-570), which is automatically satisfied as long as the receivers are
> ordinary external wallets distinct from the new contract set.

**Decision required from owner (see §9):** confirm we re-mint BOTH new structural-root vanity wallets
(`ath_treasury_owner` + `genesis_controller_one_shot`), funded fresh, and whether the treasury-receiver
roles get new wallets too (recommended yes, for a clean break and to avoid any cross-genesis confusion;
the old `…PATH`/`…OATH`/`…FkC` vanity wallets remain associated with the orphaned genesis).

> **Open verification TODO before execution:** after editing the roles file, run
> `npm run mainnet:manifest:draft` and diff the resulting `addresses` block against
> `artifacts/mainnet_genesis_verify_input.json` to PROVE every contract address differs from the live
> set (a simple set-intersection must be empty). Do NOT rely on reasoning alone — confirm zero overlap.
> The manifest draft has no built-in "differs from live chain" guard, so this diff is a manual gate.

### 1.4 ATH metadata content cell

ATHMaster init also takes the ATH metadata content cell (`artifacts/ath_metadata_content.json`, loaded by
`readAthContentCell`, draft.ts:135). If the new genesis keeps the same ATH token metadata, this is unchanged
and ATHMaster's address depends only on the (new) treasury-owner role. No action needed unless the owner
wants new token metadata.

---

## 2. The original ceremony sequence (reconstructed from repo tooling)

The ceremony is fully encoded in `scripts/mainnet_deploy_packet.ts` (human-readable runbook) and
`scripts/mainnet_tx_dry_run_packet.ts` (the exact serialized BOCs). The Tonkeeper "пульт" (32-step console)
that drives it is `scripts/mainnet_tonkeeper_console.mjs`, reading
`artifacts/local/mainnet_tx_dry_run_packet.json`. Phases:

**Phase 1 — Deploy contracts (D01–D10):**
- D01 ATHMaster (signer: `ath_treasury_owner`)
- D02 `ATHMaster.DeployTreasurySupply` (signer: `ath_treasury_owner`) → mints 100M ATH to treasury-owner ATH wallet
- D03 BuybackBurn, D04 MarketStabilitySeller (signer: `genesis_controller_one_shot`)
- D05 FeeAccumulator (signer: `ton_treasury_receiver`)
- D06 ATHVesting (signer: `ath_long_term_vesting_beneficiary`)
- D07 Vault, D08 CapsuleHub, **D09 UsernameRegistry**, D10 ProfileRegistry (signer: `genesis_controller_one_shot`)

**Phase 2 — Pre-seal bindings (B01–B14, signer: `genesis_controller_one_shot`):** each carries the
`deployment_manifest_hash`. Order/targets are pinned in `requiredPreSealBindings` (mainnet_deploy_packet.ts:245):
BuybackBurn fee-accumulator + official-ath; MSS reserve-funder + official-ath + treasury; Vault
bind-manifest(→CapsuleHub) + official-ath + ProfileRegistry + **UsernameRegistry**; CapsuleHub
bind-manifest(→Vault); UsernameRegistry official-ath + Vault; ProfileRegistry official-ath + Vault.

**Phase 3 — Pre-seal funding (F01–F02, signer: `ath_treasury_owner`):** `ATHTransferRequest` from the
**treasury-owner ATH wallet** (NOT the official wallet directly): F01 → 15M ATH to Vault (airdrop backing),
F02 → 10M ATH to ATHVesting backing. Recipient field = the owner *contract* address; ATHWallet derives
the official child internally (see the safety warning at mainnet_deploy_packet.ts:445).

**Phase 4 — Seal (S01–S06, signer: `genesis_controller_one_shot`):** Vault, CapsuleHub, UsernameRegistry,
ProfileRegistry, BuybackBurn, MarketStabilitySeller — each with the manifest hash. After seal, all
re-binding must fail (a hard-stop check).

**Phase 5 — Final genesis verification:** `npm run mainnet:genesis:verify` against a freshly collected
live snapshot → `issue_codes` must be `[]`.

### 2.1 D09 (UsernameRegistry) MUST go gateway-direct (not TonConnect)

D09's StateInit is ~56 KB (on-chain SVG art) → ~75 KB base64 as a TonConnect message, exceeding the
TonConnect bridge limit, so the Tonkeeper console hangs forever on D09 (memory: `mainnet-genesis-launched`).
Use `scripts/mainnet_deploy_d09_username_registry.mjs` instead: it builds the signed external **offline**
from the canonical packet StateInit, hard-checks the StateInit cell hash + derived target + embedded
code/data hashes, refuses if the external ≥ 65535 bytes, and broadcasts via the gateway `/api/v3/message`
(`rpc.platho.app` holds the toncenter key server-side). It auto-detects the funded deployer wallet version
(v5r1/v4r2/v3r2). **All other deploys (D01-D08, D10) + all bindings/seals/funding go through the normal
TonConnect console.** D09 is the only oversized step.

> **TODO (script adaptation):** the D09 script hardcodes
> `--mnemonic-file artifacts/local/deployer.secret` in its usage text. That file is the COMPROMISED burner
> (see §3.3). Re-run it with a fresh `--mnemonic-file` pointing at the NEW clean deployer seed. The script
> reads whatever path is passed; no code change needed, but never reuse `deployer.secret`.

---

## 3. Funding

### 3.1 Per-contract observed live endowments (from `mainnet_genesis_verify_input.json` snapshot)

These are the TON balances each contract retained after the 2026-06-14 ceremony (≈100-yr config-18 rent
endowments per commit `6cdbde0`):

| Contract | Live balance (nanoTON) | ≈ TON |
| --- | ---: | ---: |
| ath_master | 496,975,821 | 0.497 |
| vault | 744,431,687 | 0.744 |
| market_stability_seller | 695,414,275 | 0.695 |
| capsulehub | 599,025,150 | 0.599 |
| username_registry | 647,119,124 | 0.647 |
| profile_registry | 797,456,559 | 0.797 |
| buyback_burn | 646,196,251 | 0.646 |
| fee_accumulator | 499,841,866 | 0.500 |
| ath_long_term_vesting | 499,800,266 | 0.500 |
| **subtotal (9 contracts)** | | **≈ 5.62 TON** |

The official ATH wallets (vault/vesting/treasury-owner) carry only ATH, not TON, and are deployed as a
side-effect of the ATHTransferRequest funding hops — no separate TON endowment line beyond the message values.

### 3.2 Deploy gas + control-message values (from the packet builders)

- `DEPLOY_VALUE_RECOMMENDED = 0.5 TON` per deploy × 9 contract deploys (D01,D03-D10) = **4.5 TON**
  (this is the message value that becomes the contract endowment above + deploy gas; the ~0.5-0.8 TON
  balances in §3.1 are what survived after deploy gas, so 0.5 TON/deploy is the right budget line and
  already overlaps the endowments — do not double-count: the 4.5 TON IS the §3.1 funding).
- `DEPLOY_TREASURY_SUPPLY_VALUE = 0.01 TON` (D02).
- `CONTROL_VALUE_RECOMMENDED = 0.05 TON` × 14 bindings (B01-B14) + 6 seals (S01-S06) = 20 messages = **1.0 TON**.
- Funding messages F01/F02 `value_recommended = 0.058 TON` each = **0.116 TON** (ATHTransferRequest floor
  is 0.048 TON, recommended 0.058 carries a forward-fee buffer — mainnet_tx_dry_run_packet.ts:76-77).
- D09 gateway-direct deploy reserves `value + 0.06 TON` gas headroom in the script (`need = value + 60_000_000n`).

### 3.3 Funding table (what the deployer wallet must hold)

| Line | TON |
| --- | ---: |
| 9 contract deploys @ 0.5 (D01,D03-D10) | 4.50 |
| D02 DeployTreasurySupply | 0.01 |
| 14 pre-seal bindings @ 0.05 | 0.70 |
| 6 seals @ 0.05 | 0.30 |
| F01 + F02 funding @ 0.058 | 0.12 |
| Wallet-deploy + per-tx forward fees (deployer is a wallet; first tx deploys it) | ~0.20 |
| **Subtotal** | **≈ 5.83 TON** |
| Safety buffer (failed/retried tx, fee spikes, D09 resend headroom) | +3.00 |
| **Recommended funded amount** | **≈ 9 TON** (round to 10 TON for comfort) |

This matches the memory estimate ("~7-10 mainnet TON for the suite + 100yr rent endowments",
`username-nft-redesign-redeploy`). **Plus** whatever TON the owner wants pre-loaded into the
treasury-receiver / launch-controller wallets for their own gas. The 100M ATH supply is minted on-chain by
D02 (no extra TON cost beyond gas).

### 3.4 Deployer / signer wallet requirements — MUST be fresh

The packet assigns signer **roles**, but the actual *deploy gas* for D01-D10 + bindings + seals is paid by
the role wallets (`ath_treasury_owner`, `genesis_controller_one_shot`, `ton_treasury_receiver`,
`ath_long_term_vesting_beneficiary`) signing in Tonkeeper, EXCEPT D09 which is paid by the wallet behind
`--mnemonic-file` in the gateway-direct script.

- **Do NOT use `artifacts/local/deployer.secret`** — its 24-word seed was pasted into chat during the
  2026-06-14 D09 deploy and is treated as fully compromised (memory: `mainnet-genesis-launched`,
  "Security debt to close").
- **Do NOT use the V4 probe wallet** `0:d293c724…` (the throwaway probe-collection deployer, ~0.08 TON left).
- The new D09 deployer must be a **FRESH wallet** funded by the owner, with its seed kept in a NEW gitignored
  file (e.g. `artifacts/local/deployer2.secret`), never pasted anywhere.
- The new structural-root vanity wallets (`ath_treasury_owner`, `genesis_controller_one_shot`) must be
  fresh and held in Tonkeeper Pro (the current ones are "Tonkeeper Pro imported vanity wallet" per the
  roles file). They sign D01-D10/bindings/seals via the TonConnect console.

> **Burner-sweep debt (still open):** before/independent of this ceremony, sweep the remaining ~4.5 TON
> from the compromised burner to a clean wallet via Tonkeeper, then delete `artifacts/local/deployer.secret`
> (memory: `mainnet-genesis-launched`). This is housekeeping, not a ceremony blocker, but should be done so
> the compromised seed holds nothing.

---

## 4. Step-by-step re-ceremony runbook

> Pre-condition: the UsernameRegistry SVG fix is finalized and **owner-approved** (already done per memory:
> the render fix is confirmed on all tiers via the live probe collection). The fix is currently UNCOMMITTED.

### Stage A — Code + evidence preparation (off-chain, local)
1. **Commit the generator fix** (only when owner asks) — `contracts/UsernameRegistry.tact` SVG builder
   changes (flatten nested logo `<svg>`→`<g transform="matrix(...)">`, `teal` gradient →
   `objectBoundingBox`) + the updated `tests/username-collection-render.test.ts`. Commit on the working
   branch `codex/username-nft-safe-image-uri` (or a fresh branch).
2. **Rebuild contracts:** `npm run build` (= `node scripts/tact_build.js --config tact.config.json`). This
   regenerates `build/UsernameRegistry/*.code.boc` (new hash) and the embedded `UsernameNFTItem` child.
3. **Regenerate ALL pinned evidence in dependency order** (see §5 — this greens the 3 red tests and the
   release-truth suite).
4. **Run the full test suite** `npx vitest run --testTimeout=30000` → must be 0-failed-0-skipped before any
   on-chain action.

### Stage B — New address derivation (off-chain, local)
5. **Mint fresh vanity wallets** for `ath_treasury_owner` and `genesis_controller_one_shot` (and optionally
   the treasury-receiver roles) — `npm run wallet:vanity` (`scripts/vanity_ton_wallet.mjs`) or Tonkeeper Pro.
   Keep seeds offline/gitignored.
6. **Edit `artifacts/local/mainnet_roles.local.json`** — set the new role addresses (genesis controller +
   its two `*_launch_controller` mirrors must stay equal; treasury owner; receivers as decided).
7. `npm run mainnet:manifest:draft` → regenerates `artifacts/local/mainnet_final_manifest_draft.json`
   (new manifest hash, new addresses). The script enforces: future vesting start time, treasury receivers
   not protocol-owned, distinct core addresses.
8. **COLLISION GATE (manual):** diff the new `manifest.addresses` against
   `artifacts/mainnet_genesis_verify_input.json` `manifest.addresses`. Every contract address (vault,
   capsulehub, username_registry, profile_registry, buyback_burn, market_stability_seller, fee_accumulator,
   ath_master, ath_long_term_vesting + all official ATH wallets) must be ABSENT from the live set. If
   ANY overlaps → stop, the role change was insufficient (revisit §1.3).
9. `npm run mainnet:deploy:packet` → regenerates `artifacts/local/mainnet_deploy_packet.json` +
   `MAINNET_DEPLOY_PACKET.md` (validates bindings/seals/distinctness).
10. `npm run mainnet:tx:dry-run` → regenerates `artifacts/local/mainnet_tx_dry_run_packet.json` (the exact
    BOCs the console + the D09 script consume) + `MAINNET_TX_DRY_RUN_PACKET.md`.

### Stage C — Fund the deployer/signers (on-chain)
11. Owner funds the fresh `genesis_controller_one_shot` wallet with ≈10 TON (it pays D03,D04,D07,D08,D10,
    all bindings, all seals), the fresh `ath_treasury_owner` wallet (D01,D02,F01,F02 + ATHMaster endowment),
    `ton_treasury_receiver` (D05), `ath_long_term_vesting_beneficiary` (D06), and the **fresh D09 deployer
    wallet** (≈1 TON: 0.5 deploy + gas + buffer). See §3.3. Keep the D09 seed in a new gitignored file.

### Stage D — Execute the ceremony (on-chain, ordered)
12. Start the console: `npm run mainnet:tonkeeper:console` (serves the 32-step "пульт" at 127.0.0.1:8787
    reading the new dry-run packet). Connect Tonkeeper.
13. **D01** ATHMaster → stop-check: total_supply=100M, treasury_owner matches new role, treasury_supply_deployed=false.
14. **D02** DeployTreasurySupply → treasury-owner ATH wallet holds exactly 100M ATH; treasury_supply_deployed=true.
15. **D03** BuybackBurn, **D04** MarketStabilitySeller, **D05** FeeAccumulator, **D06** ATHVesting,
    **D07** Vault, **D08** CapsuleHub → each unsealed/unbound per its stop-check.
16. **D09 UsernameRegistry — gateway-direct, NOT the console:**
    `node scripts/mainnet_deploy_d09_username_registry.mjs --mnemonic-file artifacts/local/deployer2.secret`
    (dry-run first; then add `--broadcast`). It verifies the StateInit hash == packet, derives to the new
    target, embeds the new registry code+data, < 65535 bytes, then broadcasts via the gateway and waits for
    ACTIVE. (The console's D09 step is skipped/observed-only.)
17. **D10** ProfileRegistry (console).
18. **B01–B14** pre-seal bindings (console, genesis controller signer) — verify each getter shows the bound
    value before proceeding.
19. **F01** 15M ATH → Vault, **F02** 10M ATH → ATHVesting (console, treasury-owner signer). Stop-check:
    Vault official ATH wallet = exactly 15M; ATHVesting official = exactly 10M.
20. **S01–S06** seals (console). After each: getter shows sealed=true + deployment_manifest_hash == new
    manifest hash. **Hard-stop if any post-seal binding still succeeds.**

### Stage E — On-chain verification
21. Collect a fresh live snapshot: `node artifacts/local/collect_mainnet_genesis_snapshot.mjs` (the local,
    gitignored collector — memory `mainnet-genesis-launched` references it; it is NOT in `scripts/`, it lives
    under `artifacts/local/`). It writes a fresh `artifacts/mainnet_genesis_verify_input.json` with the new
    addresses + getter snapshot + `evidenceRefs`.
    > **TODO/verify:** confirm `artifacts/local/collect_mainnet_genesis_snapshot.mjs` still points at the
    > gateway and emits the schema `mainnet_genesis_verify.ts` expects (it produced the current input). If it
    > hardcodes the OLD addresses, update it to read them from the new manifest draft.
22. `npm run mainnet:genesis:verify` → `artifacts/mainnet_genesis_verify_report.json` must read
    `status: MAINNET_GENESIS_VERIFIED`, `issue_codes: []`. Then set
    `artifacts/MAINNET_GENESIS_VERIFIED.txt` = `true`.
23. **Render spot-check:** mint a real name on the new registry from a CLEAN wallet (never the burner) and
    confirm it renders in tonapi (`https://c.tonapi.io/onchain/image/{raw 0:hex item addr}/nft` → 200
    image/png) AND in GetGems AND in Tonkeeper. Item address via `get_username_item_address(name_hash)`
    where `name_hash = beginCell().storeUint(0xC5CC7CD6,32).storeSlice(username).endCell().hash()`
    (memory `username-nft-image-tonapi-render`).

### Stage F — PWA + gateway re-alignment (see §6)
24. Repoint `web/platho-config.mjs`, regenerate the static deploy prep, deploy the PWA, and re-sync the
    gateway env message-allowlist. Then run `npm run preprod:check`.

---

## 5. Evidence-regeneration checklist (greens the red tests)

The 3 currently-red tests fail because the registry source changed but `build/` and the pinned artifacts
were generated from the OLD source. Regeneration in **dependency order** (the order is authoritative — it
is exactly the order used in commit `6cdbde0`'s rebaseline; `artifact_integrity_m18` MUST be LAST):

| # | Artifact(s) | Regen command | Greens which red test |
| --- | --- | --- | --- |
| 1 | `build/**` (incl. new UsernameRegistry + UsernameNFTItem code) | `npm run build` | (prerequisite for all) |
| 2 | `CURRENT_CODE_HASHES.txt`, `CURRENT_PRODUCTION_CODE_HASHES.txt`, per-contract `*_CODE_HASH.txt` (incl. `USERNAME_REGISTRY_CODE_HASH.txt`, `USERNAME_NFT_ITEM_CODE_HASH.txt`) | `node scripts/hash_codes.js` | **M16-CONF-03** (m16-conformance-static) |
| 3 | `username_registry_storage_economics_report.json` + summary | `ts-node scripts/username_registry_storage_economics.ts` | **USERNAME-STORAGE-01 & -02** (username-registry-storage-economics) |
| 4 | other storage-economics + tombstone reports (capsulehub/profile/ath-wallet-tombstone) | their respective `scripts/*_storage_economics.ts` / `ath_wallet_tombstone_economics.ts` | keeps economics suite green |
| 5 | username vector files: `username_nft_item_vectors.json`, `username_registry_mint_vectors.json`, `username_registry_foundation_vectors.json` | `scripts/generate_username_nft_item_vectors.ts`, `…mint_vectors.ts`, `…foundation_vectors.ts` | vector suite + M18 vector_checks |
| 6 | ATH wallet + deployment-binding vectors | `npm run vectors` (`generate_ath_wallet_vectors.ts`) + `generate_deployment_ath_binding_vectors.ts` | M18 vector_checks |
| 7 | `m17_gas_reserve_sanity_report.json` | `scripts/gas_reserve_m17.ts` | M18 checks |
| 8 | implemented-subset manifest (m15) | `scripts/deployment_manifest_m15.ts` | M16-CONF-04 |
| 9 | `m16_conformance_report.json` | `ts-node scripts/conformance_m16.ts` | **M16-CONF-03** stored-report half |
| 10 | local mainnet draft/packet/dry-run (new manifest hash + addresses) | `mainnet:manifest:draft` → `mainnet:deploy:packet` → `mainnet:tx:dry-run` | (feeds the ceremony) |
| 11 | publish reserve pricing report | `scripts/publish_reserve_pricing.ts` | pricing suite |
| 12 | ath-master + M20F address derivations (proofRefs → new hashes) | `mainnet:ath-master:derive`, `m20f:derive-addresses` | M20F suite |
| 13 | `mainnet_genesis_verify_input.json` + report | (Stage E, post-deploy) `collect_mainnet_genesis_snapshot.mjs` + `mainnet:genesis:verify` | **m18 FINAL_GENESIS branch** + preprod |
| 14 | `m18_artifact_integrity_report.json`, `m18_artifact_lock.json` (**LAST**) | `ts-node scripts/artifact_integrity_m18.ts` (writes by default) | **M18-ARTIFACT-01** (m18-artifact-integrity) |
| 15 | `CURRENT_FULL_TEST_SUMMARY.json` (test counts/PASS) | hand-update after the full green run (no generator) | `release-truth-single-source` |
| 16 | `web_static_deploy_prep.*` (after web edits) | `prepare_static_web_deploy.mjs --mode preview` + `--mode production` | `static-web-deploy-prep` WEB-DEPLOY-05 |

Notes:
- **M16-CONF-03** (`tests/m16-conformance-static.test.ts:418`) compares built code hash vs `*_CODE_HASH.txt`
  AND vs the stored `m16_conformance_report.json` → needs steps 2 + 9.
- **USERNAME-STORAGE-01/02** (`tests/username-registry-storage-economics.test.ts:21,55`) compares the
  report's `code_hashes.username_registry`/`username_nft_item` against `CURRENT_CODE_HASHES.txt` → needs
  steps 2 + 3.
- **M18-ARTIFACT-01** (`tests/m18-artifact-integrity.test.ts:6`) recomputes the whole stable-artifact lock;
  it expects `manifest.status` to be `FINAL_GENESIS` only when `MAINNET_GENESIS_VERIFIED.txt=true` (else the
  `IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS` branch with the two known blockers). So pre-deploy, step 14 passes
  in the implemented-subset branch; post-deploy (step 13 done, VERIFIED=true) it passes in the FINAL_GENESIS
  branch. Regenerate step 14 LAST in BOTH passes.
- The `release-evidence-rebaseline` memory rule applies: any `web/` edit or test-file add/remove also breaks
  `CURRENT_FULL_TEST_SUMMARY.json` (count) + `web_static_deploy_prep` (byte sizes) — steps 15 + 16.

---

## 6. PWA + gateway re-alignment

Per the `server-deploy-status` memory **"REDEPLOY CHECKLIST — on every contract migration re-sync ALL THREE
seams"**:

### Seam 1 — `web/platho-config.mjs` (PWA addresses + manifest hash)
Update these literals to the NEW genesis values, then bump the `?v=` cache-buster on touched modules:
- `vault.address` (line 127) — currently `UQC5gVebW…`
- `vault.deploymentManifestHash` (line 128) — currently `5980b2a2…` → new manifest hash. **Critical:**
  `prepare_static_web_deploy.mjs:254` hard-fails production if this ≠ the verified manifest hash.
- `capsuleHub.address` (line 148), `feeAccumulator.address` (line 152), `ath.masterAddress` (line 155),
  `usernameRegistry.address` (line 158), `profileRegistry.address` (line 161).
- Provider modules `vault-ton-rpc-provider.mjs`, `*-ton-rpc-provider.mjs`, `ton-dns-provider.mjs` — verify
  none of them hardcode the old addresses (grep them); bump their `?v=` query when changed.
- The `publicChannels[].authorWallet` / `identityVariants` (`platho.ath`) demo values reference the old
  genesis — decide whether to keep, update, or drop (the old `platho.ath` name will be orphaned; §8).

### Seam 2 — `scripts/prepare_static_web_deploy.mjs` `ROOT_RUNTIME_FILES`
The bundle allowlist (line 21) must include every relative import reachable from `app.js`. If any provider
module changes name/version, ensure it stays selected (guarded by `tests/web-bundle-graph-complete.test.ts`).
Regenerate with `--mode preview` + `--mode production`. Then deploy via the proven **bash tar+ssh** path
(NOT `deploy_static_web.ps1`, which corrupts the tar — memory `server-deploy-status` DEPLOY GOTCHA):
```
tar --force-local -cf /c/tmp/x.tar -C artifacts/platho-web-static-production .
ssh -i ~/.ssh/platho_deploy_ed25519 -o BatchMode=yes \
    -o UserKnownHostsFile=artifacts/local/njalla_known_hosts \
    platho-deploy@45.142.141.141 "release-<UTCts>-<sha12>" < /c/tmp/x.tar
```
(`sha12` = first 12 of `runtime.bundleSha256` in `artifacts/web_static_deploy_prep.json`; Caddy serves
`/srv/platho/current` on `45.142.141.141`.)

### Seam 3 — gateway env message-allowlist (`/etc/platho/rpc-gateway.env` on the server)
`PLATHO_RPC_ALLOWED_MESSAGE_DESTINATIONS` / `_SOURCES` currently hold the OLD raw addresses
(`deploy/platho-rpc-gateway.env.example:16-17`): Vault `0:b981579b…91030`, CapsuleHub
`0:b1e27f91…abfd1712`. Update both to the NEW Vault + CapsuleHub **raw `0:hex`** addresses (the
`mainnet_genesis_verify_input.json` snapshot stores these as the account/state-init hashes). Opcodes
(`PLATHO_RPC_ALLOWED_MESSAGE_OPCODES=0xa4f862c0,0xa4f862d1,0x8c2a76b7,0x874e576a`) stay the same (the VPB2
batch op `0xa4f862d1` is already present). Edit via sudo with a timestamped `.bak`, then
`systemctl restart platho-rpc-gateway.service`; verify a body-history fetch to the new CapsuleHub returns
200 and a random opcode still 403. Also update repo `deploy/platho-rpc-gateway.env.example` +
`tests/platho-rpc-gateway.test.ts` to the new addresses.
> **SSH note:** the admin write needs the `settings.local.json` allow rule
> `Bash(ssh -i ~/.ssh/platho_njalla_ed25519:*)` (the auto-mode classifier blocks prod-security-config writes
> otherwise) — memory `server-deploy-status`.

---

## 7. Pre-flight gates (all must pass) + rollback

**Off-chain gates (before any broadcast):**
- G1: `npm run build` clean; new UsernameRegistry + UsernameNFTItem code hashes recorded.
- G2: Full suite `npx vitest run --testTimeout=30000` = 0 failed / 0 skipped, with all evidence regenerated
  (§5 steps 1-12,14,15). The 3 red tests (M18-ARTIFACT-01, M16-CONF-03, USERNAME-STORAGE-01/02) green.
- G3: COLLISION GATE (§4 step 8) — new manifest addresses share ZERO entries with the live set.
- G4: Dry-run the D09 script (no `--broadcast`) — it must verify StateInit hash == packet, derive to the
  new target, embed code+data, and report external < 65535 bytes.

**On-chain gates (during/after ceremony):**
- G5: every D0x/Bxx/Sxx stop-check passes before the next step (per packet `stop_check` fields).
- G6: post-seal, every re-binding attempt fails (hard-stop in the packet).
- G7: `npm run mainnet:genesis:verify` → `issue_codes: []`, `MAINNET_GENESIS_VERIFIED`; set the .txt true.
- G8: render spot-check (§4 step 23) — minted name renders 200 in tonapi + visible in GetGems + Tonkeeper.

**Release gates (before flipping the PWA):**
- G9: `npm run preprod:check` (`scripts/preprod_guard.mjs`) PASS with the new addresses + manifest hash.
- G10: PWA deployed, gateway env re-synced + verified (200 for new CapsuleHub body history).

**Rollback / abort:**
- **Before D02 / before any seal:** abort is cheap — the deployed-but-unsealed contracts are abandoned
  (lose only their ~0.5 TON deploy values). Fix the issue, re-derive a fresh address set (new controller),
  and restart. NEVER reuse a partially-deployed address set after an abort (collision risk).
- **After seal but before PWA flip:** the new genesis is live but the PWA still points at the OLD genesis;
  the old genesis keeps working for existing users. You can pause and resume the PWA re-alignment, or, if the
  new genesis is found defective, abandon it and re-ceremony AGAIN on yet another fresh set (the old genesis
  remains the production target meanwhile). **There is no on-chain rollback** — sealed genesis is immutable;
  "rollback" = keep the PWA on the prior genesis.
- **PWA rollback:** deploy-key `list` then `rollback <prev-release>`. **Gateway rollback:** restore
  `/opt/platho/platho-rpc-gateway.py.bak-20260611-153535` (or the env `.bak`) + restart the unit.

---

## 8. Orphaning + cleanup

What becomes orphaned when the PWA repoints to the new genesis:
- The current live genesis address set (`mainnet_genesis_verify_input.json`): Vault `UQC5gVebW…`, CapsuleHub
  `UQCx4n…`, ATHMaster `UQA_iaT8…`, UsernameRegistry `UQBFGzBR…`, ProfileRegistry, FeeAccumulator,
  BuybackBurn, MSS, ATHVesting — all sealed/immutable, left running but unreferenced.
- The demo usernames **platho.ath** and **sexybitch.ath** (minted on the old registry) — orphaned. If the
  owner wants `platho.ath` on the new genesis, re-mint it on the NEW registry from a clean wallet
  (Stage E spot-check is a natural place to do this).
- The **live ATH token** (old ATHMaster, 100M supply) + the entire DeFi suite (BuybackBurn route, MSS
  pricing, vesting schedule) — orphaned on the old genesis. The new ceremony mints a brand-new 100M ATH on
  the new ATHMaster. Any external holders of the OLD ATH (there should be none pre-adoption; treasury holds
  75M, vault 15M, vesting 10M, all protocol-internal) are stranded on the old token. **Confirm no external
  ATH distribution happened before orphaning** (snapshot shows airdrop_distributed_ath=0, sold_ath_total=0,
  burned=0 — all clean).
- **Burner-sweep debt** (independent housekeeping): sweep ~4.5 TON from the compromised
  `artifacts/local/deployer.secret` burner to a clean wallet, then delete the file (§3.4).
- The TON in the orphaned old contracts (≈5.6 TON of rent endowments + 0.5-0.8 TON each) is **NOT
  recoverable** — sealed contracts have no withdrawal path. This is a sunk cost of the redeploy.

---

## 9. Open questions / risks needing owner decisions

1. **Scope of new roles (§1.3):** confirm we re-mint BOTH structural-root vanity wallets (`ath_treasury_owner`
   + `genesis_controller_one_shot`). Re-mint the treasury-receiver/beneficiary roles too (recommended for a
   clean break), or reuse the existing `…OATH`/`…FkC` receiver wallets (allowed — they don't collide, only
   protocol roles do)? This changes which addresses appear in the new manifest.
2. **ATH token identity:** keep the same ATH metadata (`artifacts/ath_metadata_content.json`) so only the
   ATHMaster *address* changes, or also refresh token metadata? (No technical need to change it.)
3. **`platho.ath` continuity:** re-mint `platho.ath` (and any others) on the new registry, and from which
   clean wallet?
4. **Vesting start time:** `mainnet_roles.local.json` has `ath_long_term_vesting_start_time_unix=1796515200`.
   `mainnet:manifest:draft` requires it to be in the **future** (draft.ts:163). Confirm it is still future at
   re-ceremony time (1796515200 = 2026-12-… — verify it hasn't passed; if it has, pick a new future date).
5. **Funding source:** which owner wallet funds the ≈10 TON ceremony + the ATHMaster endowment, and is it
   distinct from any compromised/probe wallet?
6. **`collect_mainnet_genesis_snapshot.mjs` health (§4 step 21):** it lives in `artifacts/local/` (gitignored),
   not `scripts/`. Verify it still works and emits the schema `mainnet_genesis_verify.ts` expects, and that it
   reads the NEW addresses (from the regenerated manifest draft) rather than hardcoded old ones. If broken, it
   must be adapted before Stage E.
7. **Timing of the PWA flip:** flip immediately after G7/G8, or run both geneses in parallel briefly? (Old
   genesis keeps serving existing — zero — users until the flip.)
8. **Commit timing:** the generator fix + all regenerated evidence are uncommitted. Confirm when to commit
   (the task says do not commit; the owner must explicitly request it before/after the ceremony).

---

## 10. Key file / script reference (cited during investigation)

- Ceremony runbook builder: `scripts/mainnet_deploy_packet.ts` (phases, bindings list :245, seals :417, hard-stops :506)
- Exact BOC builder: `scripts/mainnet_tx_dry_run_packet.ts` (deploy values :70-77, deriveState :200)
- Address derivation (authoritative): `scripts/mainnet_final_manifest_draft.ts` (inits :196-261, `addressHash` :68)
- D09 gateway-direct deploy: `scripts/mainnet_deploy_d09_username_registry.mjs`
- TonConnect console ("пульт"): `scripts/mainnet_tonkeeper_console.mjs`
- Genesis verifier: `scripts/mainnet_genesis_verify.ts` (manifest-hash domain :425, code-hash cross-check :298)
- Code-hash regen: `scripts/hash_codes.js`; artifact lock: `scripts/artifact_integrity_m18.ts`
- Storage economics: `scripts/username_registry_storage_economics.ts`
- Contract inits: `contracts/Vault.tact:538`, `contracts/UsernameRegistry.tact:185`
- Roles file: `artifacts/local/mainnet_roles.local.json` (genesis controller, treasury owner)
- Live snapshot / address set: `artifacts/mainnet_genesis_verify_input.json`
- Pinned hashes: `artifacts/CURRENT_CODE_HASHES.txt`, `USERNAME_REGISTRY_CODE_HASH.txt` (both still `783ebf58…`, pre-rebuild)
- PWA config: `web/platho-config.mjs` (vault :127, manifest hash :128, registry :158)
- Static deploy prep: `scripts/prepare_static_web_deploy.mjs` (manifest-hash guard :254, ROOT_RUNTIME_FILES :21)
- Gateway env: `deploy/platho-rpc-gateway.env.example` (message allowlist :16-18)
- Memory: `mainnet-genesis-launched`, `username-nft-redesign-redeploy`, `username-nft-image-tonapi-render`,
  `server-deploy-status`, `release-evidence-rebaseline`.
