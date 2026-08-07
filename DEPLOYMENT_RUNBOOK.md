# Platho Deployment Runbook

Internal runbook for testnet rehearsal and mainnet genesis. This is not marketing copy and does not replace audit review. Its purpose is simple: keep launch steps deterministic, auditable, and hard to improvise.

Before any mainnet action, read `MAINNET_RELEASE_CHECKLIST.md`. It is the compact go/no-go sheet for release order, exact funding, post-pool gates, and stop conditions.

## Canonical ATH tokenomics for auditors

The current canonical ATH model is:

```text
15,000,000 ATH activity airdrop
15,000,000 ATH initial ATH/TON liquidity
10,000,000 ATH long-term protocol vesting reserve
60,000,000 ATH MarketStabilitySeller reserve
```

Short form: `15M` activity airdrop, `15M` initial liquidity, `10M` long-term vesting, and `60M` MarketStabilitySeller reserve.

The protocol fee IS the TON side of initial liquidity, and the two numbers are one ledger, not two:
`15,000,000 ATH` of activity airdrop at `10 ATH` per capsule is `1,500,000` capsules, and `1,500,000` capsules at
`0.01 GRAM` is `15,000 GRAM`. Paired against the `15,000,000 ATH` liquidity allocation that is the `0.001 GRAM`
reference price exactly. Every 10 ATH handed out is paid for by the 0.01 GRAM collected for the same capsule.

This is why the per-capsule fee is structural rather than a revenue line: remove it and the pool has no TON side.
It must not be described as a liability owed to activity-airdrop users.

How the fee actually reaches the sink: every publish forwards it. `RecordShard` and `IntroShard` emit one
`DepositProtocolFee` to `FeeAccumulator` in the same transaction that stores the record, so a shard's balance is
its own rent and eviction bounties and NOTHING ELSE. The fee never accumulates on chain waiting for someone to
extract it, and protocol revenue does not depend on anybody choosing to run eviction.

An earlier revision pooled the fee inside each shard and remitted it once per shard. That existed solely to pay
`FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE` once instead of a million times — and that constant was wrong: sized for
the rare bulk flush of the clean-16 `CapsuleHub` (a contract clean-17 removed) at `2,000,000`, it was 18% of a
per-capsule fee. Measured against the live mainnet
gas config (config-21: flat 6667 for the first 100 units, then 66.667/unit), one deposit really costs `199,068`.
The constant is now `400,000`, and `FeeAccumulator.SweepUnaccounted` reclaims whatever the gas does not burn.

THE PUBLISHER PAYS TRANSPORT, so the pool books the fee whole and `1,500,000` capsules give exactly `15,000 GRAM`.
Minimum publish is `14,200,000` nanotons on CONV and `14,008,000` on INTRO.

GENESIS ORDERING — this is a real constraint and it was briefly documented as non-existent. `FeeAccumulator` has
no `deployment_id`, so its address is fixed by its code and the two owner wallets; but its CODE changed in this
release, which moved its address, and the shards carry that address as a compile-time constant. Build in this
order: `FeeAccumulator` code -> its StateInit address -> shard code -> shard addresses. There is no cycle, but
walking it out of order silently points every shard's fee at a dead address. Pinned by
`tests/shard-fee-passthrough.test.ts` PT-04/PT-04b, which derive the address fresh rather than trusting a literal.

RETENTION IS ENFORCED BY RETIREMENT, NOT EVICTION. Per-record eviction was deleted on 2026-07-19. One
permissionless `RetireShard` call drops a shard's whole map and destroys the account; its compute is a MEASURED
constant 5140 gas whatever the shard holds, against 425_835 to clear 64 of 1024 records entry by entry. The
death instant is a pure function of the address — the publish gate admits only epoch +/-1, so everything is dead
by `(epoch+2)*86400 + RETENTION` — and `get_view().retire_at` publishes it, so no client ever recomputes it.
The INTRO gate adds four epochs of slack (`IS_RETIRE_SLACK`) because the bare instant coincided to the SECOND
with the moment a shard leaves the client's scan window.

WHY THE EVICTION BOUNTY WENT: it charged per RECORD for work that costs a flat amount per SHARD. At RS_SAFE_CAP
it collected 3.28 GRAM to fund a 0.00096 GRAM job while still underfunding a one-record shard, where a real w5
wallet LOST 191_740 sweeping. Every publisher paid 0.0008 GRAM for a service nobody would ever perform.

PUBLISH PRICES, both published in `get_view`:

| | steady-state `min_value` | first publish `deploy_min_value` |
| --- | ---: | ---: |
| CONV | `13,400,000` (0.0134 GRAM) | `16,900,000` (0.0169 GRAM) |
| INTRO | `13,110,000` (0.013110 GRAM) | `15,610,000` (0.015610 GRAM) |

A client MUST pay the deploy figure whenever the target account is absent OR `record_count`/`next_id` is 0. The
extra funds the account's own life and the single call that ends it; charging it explicitly replaced leaving it
to `ReserveAtMost`, which silently clamped and left a minimally-funded shard 201_469 short of its own target.

Retiring pays its caller the shard's whole residual, top-up included. That is deliberate — it is the payment for
cleanup on a shard a year past its last possible write — and it is why a one-record shard is worth retiring at
all. The protection is the time gate, not a bound on the payout.

The `10M` long-term vesting reserve is held by immutable `ATHVesting`, backed by its official ATH wallet, and unlocks `100,000 ATH` per 365-day period for `100` periods. It is not a liquid operations bucket.

MarketStabilitySeller uses `20` tranches of `3,000,000 ATH`, from `x2` through `x21` of the initial pool price. Older lower-reserve, shorter-seller notes are obsolete and must not be used as an audit baseline for current archives.

Short tranche form: `20` tranches of `3M ATH`, from `x2` through `x21`.

The launch pool target is `100,000 TON`, so the initial reference price is:

```text
1 ATH = 0.001 TON
```

During the activity airdrop, each successfully finalized capsule receives `10 ATH`, regardless of public/private type or size class. Public product copy may say messages start from `0.0337 TON`; current exact canonical examples are 1 KiB public capsules from `0.0337 TON` and hybrid private 1 KiB capsules from `0.0347 TON`, with larger public or private capsule blocks costing more because they reserve more execution/storage capacity. Extra TON pays for the selected capsule execution/storage/security profile, not for farming more ATH. The `10 ATH` reward is an activity bonus for real usage, not a refund, cashback, reimbursement, investment return, or price guarantee.

## Stop Rule

Do not proceed with deployment if any of these are false:

- the fresh external audit archive matches current `HEAD`;
- `npm test` passes;
- M16 conformance and M18 artifact integrity pass against current artifacts;
- final manifest code hashes match current build outputs;
- final manifest constants match the canonical tokenomics above;
- no secrets, seed phrases, vanity private material, local `.env` files, SSH keys, or server scripts are included in git or external audit archives.
- external audit archives are produced only with `npm.cmd run audit:archive`; do not zip the workspace manually.

Any open C/H/M finding stops deployment. Low notes can proceed only if they are either fixed or explicitly accepted as non-blocking release notes.

## Sensitive Local Files

Vanity wallet candidates are local sensitive material:

```text
artifacts/local/vanity-wallet-candidates.jsonl
artifacts/local/vanity-wallet-candidates.summary.json
```

These files must not be committed, sent to external audit, published in docs, or used as public address lists. Only the selected public addresses belong in final manifest artifacts.

Repository-safe examples may exist as `.example` files. Real mnemonics, deployer keys, RPC credentials, server SSH keys, and production environment files must stay outside git.

## Launch Roles

All launch roles must be finalized in the manifest before mainnet rehearsal.

| Role | Purpose |
| --- | --- |
| `genesis_controller_one_shot` | Performs pre-seal binding and seal actions for staged contracts. In the current model this same address is also the BuybackBurn and MarketStabilitySeller launch controller until their post-pool freeze calls clear the retained controller hashes. |
| `ath_treasury_owner` | Owner of the treasury ATH wallet and the only sender for `ATHMaster.DeployTreasurySupply`. |
| `ton_treasury_receiver` | Receives TON treasury buckets from FeeAccumulator and MarketStabilitySeller flushes. |
| `treasury_ath_receiver` | Receives ATH treasury share from UsernameRegistry. |
| `profile_registry_treasury_ath_receiver` | Receives ATH treasury share from ProfileRegistry avatar fees. |
| `ath_long_term_vesting_beneficiary` | Receives immutable ATHVesting releases of `100,000 ATH` per 365-day period. |
| `market_stability_reserve_funder` | Funds the `60,000,000 ATH` MarketStabilitySeller reserve through the official ATH notification path. |
| `ath_long_term_vesting_official_ath_wallet` | Deterministic `ATHWallet(owner = ATHVesting, master = ATHMaster)`, funded exactly with `10,000,000 ATH` before final genesis. |
| `buyback_burn_official_ath_wallet` | Deterministic `ATHWallet(owner = BuybackBurn, master = ATHMaster)`, used for STON.fi ATH output and burn. |
| `airdrop_pool_official_ath_wallet` | Deterministic `ATHWallet(owner = AirdropPool, master = ATHMaster)`, funded exactly for the activity airdrop before final genesis. Replaces the clean-15 `vault_official_ath_wallet`; `Vault` no longer exists. |

There is no privileged buyback executor in the current model. `ExecuteBuybackChunk`, recovery, recycle, and retry flows are permissionless but constrained by route freeze, frozen quote/minOut, phase, value, and accounting guards.

These launch roles are narrow authorities, not broad control levers. Do not describe launch control as absent from every step. The honest wording is: there is no rescue, pause, upgrade, admin drain, or arbitrary balance-control authority, while these one-shot or one-way authorities remain explicit:

- `ath_treasury_owner` sends the one-shot `ATHMaster.DeployTreasurySupply`;
- `genesis_controller_one_shot` performs pre-seal binding and seal actions;
- BuybackBurn launch controller performs the one-time post-pool route freeze;
- MarketStabilitySeller launch controller performs the one-time post-pool pricing freeze;
- FeeAccumulator treasury receiver performs the one-way `EnableBuybackSplit` after release preflight.

The role name `genesis_controller_one_shot` is historical shorthand for the pre-seal phase, not a
license to retire that key immediately after seal. The current manifest intentionally requires the
BuybackBurn launch controller and MarketStabilitySeller launch controller to be the same address as
`genesis_controller_one_shot`, because both contracts retain that controller hash until post-pool
freeze. Keep the controller secure until `BuybackBurn.route_frozen == true`,
`BuybackBurn.genesis_config_hash == 0`, `MarketStabilitySeller.pricing_frozen == true`, and
`MarketStabilitySeller.genesis_config_hash == 0` are proven by live getters.

## Local Release Gate

Before any testnet or mainnet rehearsal:

```powershell
npm.cmd run build
npm.cmd test
node scripts\hash_codes.js
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\generate_ath_wallet_vectors.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\generate_deployment_ath_binding_vectors.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\generate_username_registry_foundation_vectors.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\generate_username_registry_mint_vectors.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\generate_username_nft_item_vectors.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\deployment_manifest_m15.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\conformance_m16.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\artifact_integrity_m18.ts
```

Stop if:

- code hashes changed without regenerated artifacts;
- M16 or M18 reports do not match current build outputs;
- `git status` contains unexpected tracked changes;
- audit archive contents do not match current release intent.
- anyone tries to replace `mainnet:genesis:verify` with M20F route preflight, M20T harness evidence, or MarketStabilitySeller readiness.

## Phase 1: Final Addresses And Manifest

1. Select final mainnet addresses and role owners.
2. Verify any vanity addresses come from the local secure candidate file, not from chat history or screenshots.
3. Build the final deployment manifest with `FINAL_GENESIS` status.
4. Fill:
   - all final addresses;
   - current code hashes;
   - StateInit hashes;
   - `ath_total_supply_atomic = 100000000000000000`;
   - `vault_activity_airdrop_total_atomic = 15000000000000000` — a legacy KEY NAME kept deliberately. `Vault` no
     longer exists; the custodian is `AirdropPool`. The key is not renamed because the live manifest, the genesis
     verifier, and the deployed evidence all read it by this exact name, and renaming a field the verifier matches by
     string is a silent-failure change, not a cleanup;
   - `ath_long_term_vesting_allocation_atomic = 10000000000000000`;
   - `ath_long_term_vesting_period_count = 100`;
   - `ath_long_term_vesting_period_seconds = 31536000`;
   - `ath_long_term_vesting_period_unlock_amount_atomic = 100000000000000`;
   - `ath_market_stability_reserve_allocation_atomic = 60000000000000000`;
   - empty `blockers_before_final_genesis`.
5. Verify all protocol-owned and official ATH wallet addresses are basechain.
6. Verify every official ATH wallet:
   - owner equals the corresponding contract address;
   - master equals final ATHMaster;
   - address matches the manifest-derived wallet address.
7. Recompute final `manifest_hash_hex` from canonical manifest contents, including addresses, code hashes, StateInit hashes, constants, blockers, status, profile, and version metadata.

Useful artifacts:

```text
artifacts/deployment_manifest_implemented_subset_m15.json
artifacts/deployment_ath_wallet_binding_vectors.json
artifacts/mainnet_genesis_verify_input_template.json
scripts/mainnet_genesis_verify.ts
```

## Phase 2: Deploy, Pre-Seal Binding, And Pre-Seal Funding

Keep deploy order simple and auditable.

1. Deploy `ATHMaster`.
2. Call `ATHMaster.DeployTreasurySupply` from `ath_treasury_owner`.
3. Verify:
   - `treasury_supply_deployed == true`;
   - `total_supply == 100,000,000 ATH`;
   - treasury ATH wallet received the genesis supply.
4. Deploy immutable `FeeAccumulator` with:
   - `treasury_receiver_address`;
   - `buyback_burn_address`.
5. Deploy immutable `ATHVesting` with:
   - final ATHMaster address;
   - final `ath_long_term_vesting_beneficiary`;
   - final vesting start time.
6. Deploy staged contracts:
   - `BuybackBurn`;
   - `MarketStabilitySeller`;
   - `AirdropPool` — the clean-17 custodian of the 15M activity airdrop. It **replaces `Vault`**, which no longer
     exists (neither does `CapsuleHub`: the public/avatar lane is the lazily-deployed `PublicShard`, not a genesis
     contract). Deployed STAGED: `manifest_hash = 0`, `config_hash = 0`, unsealed — its address must not depend on
     the manifest hash that commits to its address, so the real hash is bound at `AirdropSealGenesis`;
   - `UsernameRegistry`;
   - `ProfileRegistry`.
7. Perform pre-seal bindings by `genesis_controller_one_shot` (except the FeeAccumulator leg, noted below):
   - `BuybackBurn.BindBuybackFeeAccumulator`;
   - `BuybackBurn.BindBuybackOfficialAthWallet`;
   - `MarketStabilitySeller.BindMarketStabilityReserveFunder`;
   - `MarketStabilitySeller.BindMarketStabilityOfficialAthWallet`;
   - `MarketStabilitySeller.BindMarketStabilityTreasury`;
   - `BuybackBurn.BindBuybackTreasury` — **without it `SealBuybackBurnGenesis` throws 22509 and BuybackBurn can never be sealed**; it fixes permanently where the contract sweeps stuck TON, so confirm the address is the intended protocol treasury before signing;
   - `AirdropPool.AirdropBindAthMaster.ath_master_address`;
   - `AirdropPool.AirdropBindAthMaster.pool_ath_wallet_address` (this and the previous entry are the SAME on-chain message, which carries both fields — send it once);
   - `AirdropPool.AirdropBindCreditIssuer.credit_issuer_address` (bind the **FeeAccumulator** address — the clean-17 airdrop distributor; the field name is a clean-16 holdover, there is no CreditIssuer contract);
   - `AirdropPool.AirdropBindTreasury.treasury_address`;
   - `FeeAccumulator.BindAirdropPool.airdrop_pool_address` — **signed by `ton_treasury_receiver`, NOT the genesis controller** (FeeAccumulator gate 15050 `requireTreasury`; a genesis-controller signature bounces exit 15050 and the accrual routing is never wired);
   - `FeeAccumulator.BindShardCode.shard_code`, `FeeAccumulator.BindIntroShardCode.intro_shard_code`, `FeeAccumulator.BindPublicShardCode.public_shard_code`, `FeeAccumulator.BindTicketCode.ticket_code` — the four lane/ticket CODE binds, **all signed by `ton_treasury_receiver`** (same `requireTreasury` gate 15050 as the pool bind above). Each carries the compiled code cell, and the packet records its hash. **Without them the sink rejects EVERY capsule fee (gate 15055) and every `TicketRedeem` (15060): publishing still appears to succeed, but 0 GRAM reaches the pool and the 15M ATH activity airdrop is permanently unreachable.**
   - `UsernameRegistry.BindOfficialAthWallet`;
   - `ProfileRegistry.BindProfileOfficialAthWallet`.
8. Fund the genesis-backed official ATH wallets — these are packet steps `F01` and `F02`, and they are signed
   **BEFORE the seals in step 10, not after**. The dry-run packet lists them in a separate `funding_messages`
   array that appears AFTER `control_messages`, so working the file top to bottom would seal first. Do not.
   The whole point of the ordering is that an unsealed contract can still be corrected: if a transfer lands on a
   wrongly-derived wallet and the contracts are already sealed, the mistake is permanent.
   - `F01`: transfer exactly `15,000,000 ATH` from the treasury ATH wallet to `airdrop_pool_official_ath_wallet`;
   - `F02`: transfer exactly `10,000,000 ATH` from the treasury ATH wallet to
     `ath_long_term_vesting_official_ath_wallet`.
   In both, the Tonkeeper target is the **Treasury Owner ATHWallet**, and the message's recipient field is the
   recipient OWNER contract — the official ATHWallet is derived inside ATHWallet, never addressed directly.
9. Verify the pre-seal funding landed:
   - `airdrop_pool_official_ath_wallet.owner == AirdropPool`;
   - `airdrop_pool_official_ath_wallet.master == ATHMaster`;
   - `airdrop_pool_official_ath_wallet.balance == 15,000,000 ATH`;
   - `ath_long_term_vesting_official_ath_wallet.owner == ATHVesting`;
   - `ath_long_term_vesting_official_ath_wallet.master == ATHMaster`;
   - `ath_long_term_vesting_official_ath_wallet.balance == 10,000,000 ATH`.
9b. Upload and seal the username collection art and TEP-64 metadata (audit W1: this step was missing from the
   runbook entirely, and nothing in the packet or the verifier enforces it):
   - `UsernameRegistry.UploadArt` parts, then `UsernameRegistry.SealArt`;
   - `UsernameRegistry.UploadCollectionMeta` parts, then `UsernameRegistry.SealCollectionMeta`.
   - **Why it matters:** `get_collection_content` is gated by `throwUnless(19360, meta_sealed)`, so a collection
     sealed without metadata serves NOTHING to wallets and marketplaces: the username NFTs ship with no image and no
     TEP-64 content, permanently. **[CORRECTED 2026-07-31]** This paragraph used to warn that `SealGenesis` does not
     require `art_sealed` / `meta_sealed` and would seal happily without them. That is no longer true: the registry's
     `SealGenesis` now carries `throwUnless(19045, art_sealed)` and `throwUnless(19046, meta_sealed)`, deliberately
     placed after every pre-existing gate. Signing `S02` before this step now fails loudly instead of silently
     producing an art-less collection — but confirm both getters report sealed anyway, because a seal that aborts
     mid-ceremony on a one-shot controller message is still the thing to avoid.
9c. Endow the four protocol-owned official ATHWallets — packet steps `W01`–`W04`, signed here, after the funding and
   before the seals, so the Phase 3 verification reads the endowed balances rather than assuming them.
   - Each is an `ATHWalletTopUpStorageReserve` of `600,000,000` nanoton sent **to the official ATHWallet itself**,
     not to its owner contract. No authority is granted and no state changes; the value simply becomes storage float.
   - The target must be signed **non-bounceable (`UQ`)**. `W01`'s wallet is created by the separate MSS reserve
     funding script and `W04`'s not until BuybackBurn's first buyback, so two of the four addresses do not exist yet.
     Value parked on an uninit address survives the later deploy (measured, `CEREMONY-W-01`); the bounceable form
     returns it immediately while the send still reports success (`CEREMONY-W-02`).
   - **Why it matters:** these four wallets hold 85,000,000 of the 100,000,000 ATH and can never be redeployed. The
     ATH transfer leg that creates them carries only `20,000,000` of storage endowment — about 3.7 years of rent at
     the measured 5,456,808/year, with the account frozen at roughly 22 years. `600,000,000` buys about 110.
   - Unlike the seals this step is permissionless and repeatable after genesis, so a miss here is recoverable — it is
     written down because until 2026-07-31 it appeared in no order, no runbook, and no `--phase` of the broadcaster.
10. Seal staged contracts only after the funding checks above pass. Exactly five seals, matching packet steps
   `S01`–`S05` one for one — if the packet and this list ever disagree, stop and reconcile before signing:
   - `AirdropPool.AirdropSealGenesis` (`S01`) — this is where the real manifest hash is bound;
   - `UsernameRegistry.SealGenesis` (`S02`);
   - `ProfileRegistry.SealGenesis` (`S03`);
   - `BuybackBurn.SealBuybackBurnGenesis` (`S04`);
   - `MarketStabilitySeller.SealMarketStabilityGenesis` (`S05`).

Stop immediately if any post-seal binding still succeeds.

## Phase 3: Final Genesis Verification

Before final genesis verification, only allowed genesis actions may have happened. There must be no user publishes, profile updates, username mints, public posts, buyback reserve accepts, market reserve funding, or market sales.

Required pre-seal funding and clean state:

- ATHMaster treasury supply is deployed exactly once.
- AirdropPool official ATH wallet balance equals exactly `15,000,000 ATH`.
- AirdropPool reports `remaining_budget == 15,000,000 ATH`, `distributed_total == 0`, `claim_count == 0`.
- ATHVesting official ATH wallet balance equals exactly `10,000,000 ATH`.
- ATHVesting is clean: zero claimed amount, idle phase, and no pending transfer.
- UsernameRegistry official ATH wallet balance is zero; it may still be `uninit` at the deterministic StateInit address.
- ProfileRegistry official ATH wallet balance is zero; it may still be `uninit` at the deterministic StateInit address.
- BuybackBurn official ATH wallet balance is zero; it may still be `uninit` at the deterministic StateInit address.
- MarketStabilitySeller official ATH wallet balance is zero; it may still be `uninit` at the deterministic StateInit address.
- FeeAccumulator buckets are zero.
- BuybackBurn route is not frozen and all due, pending, retry, and total counters are zero.
- MarketStabilitySeller pricing is not frozen and reserve, sale, tranche, treasury, and pending state is zero.

Fill the live getter snapshot from:

```text
artifacts/mainnet_genesis_verify_input_template.json
```

Run:

```powershell
npm.cmd run mainnet:genesis:verify
```

`MAINNET_GENESIS_VERIFIED` is valid only if the verifier proves:

- manifest hash commits to final manifest contents;
- fixed tokenomics constants match the canonical model;
- ATHMaster supply and treasury deployment are correct;
- AirdropPool airdrop backing is exact, not underfunded or overfunded (`funded_amount == total_pool == remaining_budget`);
- ATHVesting schedule, beneficiary, clean state, and exact official wallet backing are correct;
- official ATH wallets for AirdropPool and ATHVesting are active and exactly funded;
- zero-balance official ATH wallets for UsernameRegistry, ProfileRegistry, BuybackBurn, and MarketStabilitySeller are either active with zero ATH or `uninit` at the deterministic StateInit address committed by the manifest;
- Username/Profile records, dues, and pending flushes are zero;
- FeeAccumulator buckets are zero;
- BuybackBurn route/pending/due/totals are clean;
- MarketStability pricing/reserve/sold/tranche/pending state is clean.

## Phase 4: Production PWA And Activity Airdrop

After clean final genesis:

1. Release the production PWA only after production config, crypto review, hosting headers, and static bundle gates pass.
2. Distribute the `15,000,000 ATH` activity airdrop through AirdropPool, which accrues per publish via `FeeAccumulator` -> `AirdropTicket` -> `AirdropAccrue`. There is no bulk hand-out step: the pool pays on claim.
3. Keep BuybackBurn route freeze, MarketStabilitySeller pricing freeze, and EnableBuybackSplit blocked during this distribution phase (the `60,000,000 ATH` seller reserve is already funded and locked at genesis).
4. Verify `AirdropPool.remaining_budget == 0` and `AirdropPool.distributed_total == 15,000,000 ATH`.

Do not launch the initial ATH/TON pool before the activity airdrop is fully distributed. The pool
is post-airdrop, not immediately post-genesis.

## Phase 5: Pool Launch, Route Freeze, And Pricing Freeze

After clean final genesis and complete activity airdrop distribution:

1. Launch the initial ATH/TON pool with target reference cap `100,000 TON`.
2. Capture final pool launch price evidence.
3. Collect STON.fi route evidence for BuybackBurn.
4. Fill:

```text
artifacts/m20f_mainnet_route_freeze_input_template.json
```

5. Run:

```powershell
npm.cmd run m20f:preflight
```

6. If M20F passes, call `BuybackBurn.FreezeBuybackRoute`.
7. Verify:
   - `route_frozen == true`;
   - `genesis_config_hash == 0`;
   - frozen route actors match evidence;
   - frozen source owner and ask wallet are consistent;
   - frozen quote/minOut match evidence;
   - all STON.fi endpoint addresses are basechain.
8. Freeze MarketStabilitySeller pricing:
   - `base_tranche_price_nanotons == evidence_x1_tranche_quote_nanotons`;
   - `pricing_evidence_hash != 0`;
   - post-freeze `genesis_config_hash == 0`.

The release chain at this point is strict: final manifest, live getter snapshot, `mainnet:genesis:verify` PASS, production PWA/activity airdrop distribution, then pool launch, post-pool route/pricing preflights and freezes, then reserve/readiness/buyback-split gates. M20F and MarketStabilitySeller readiness are not replacements for final genesis verification.

MarketStabilitySeller pricing freeze is a real one-time launch authority. It sets the base tranche price once from pool-launch evidence. It cannot steal funds, pause, rescue, or mutate pricing after freeze, but release docs must keep this authority explicit.

The controller key used for the genesis seal must not be retired before this phase. In this release
model, the same controller address performs pre-seal genesis actions and the two post-pool freeze
actions; only after both freeze getters show `genesis_config_hash == 0` is the controller retired.

Then fill and run:

```text
artifacts/market_stability_seller_readiness_input_template.json
npm.cmd run market-stability:readiness
```

This readiness step is post-pool and supplemental. It is not a replacement for `npm.cmd run mainnet:genesis:verify`.
The required order is: clean final genesis verifier pass (which certifies the genesis-funded reserve via authenticated reserve funding), production PWA release, complete `15,000,000 ATH`
activity airdrop distribution, initial pool launch, post-pool `FreezeMarketStabilityPricing`, then MarketStabilitySeller readiness. Do not use
`market-stability:readiness` as a standalone release gate.

Readiness must block:

- underpriced or overpriced base/evidence mismatch;
- malformed decimal evidence;
- partial reserve accounting;
- previous sale/tranche/pending state;
- wrong official wallet;
- non-basechain reserve funder or TON treasury receiver.

## Phase 6: Market Stability Reserve

MarketStabilitySeller is a staged distribution surface, not a core PWA screen. It releases reserve ATH only when buyers pay the current public tranche price, so early demand can be absorbed without forcing all users through a thin pool.

Procedure:

1. The `60,000,000 ATH` reserve is funded and locked into the official MarketStabilitySeller ATH wallet at genesis (right after `SealGenesis`) as one authenticated reserve-funder notify-flow transfer through the production ATHWallet notify path — funding requires only a sealed seller and does NOT require the pricing freeze, and `mainnet:genesis:verify` certifies it. If funding was deliberately chunked, treat the seller as partially live after the first chunk and do not announce seller readiness until the checks below pass.
2. Readiness checks:
   - `reserve_due_ath == 60,000,000 ATH`;
   - `reserve_funded_total_ath == 60,000,000 ATH`;
   - official seller ATH wallet balance is at least `60,000,000 ATH`;
   - previous sale, tranche, treasury, and pending state is zero.
3. Partial reserve funding is valid runtime state, but it is not full-launch readiness. Do not mark MarketStabilitySeller ready while either `reserve_due_ath` or `reserve_funded_total_ath` is below `60,000,000 ATH`, even if the raw official wallet balance is higher.
4. Official seller ATH wallet balance above `60,000,000 ATH` is a readiness warning, not a blocker. Seller sales are bounded by `reserve_due_ath`, not by raw wallet balance. Unsolicited excess ATH is not tracked reserve, does not expand sellable supply, and can remain stuck.
5. Fund only through the bound `market_stability_reserve_funder` notify-flow. Do not fund the official seller ATH wallet with manual ordinary ATH transfers, and do not present that wallet as a generic deposit address in PWA or ops copy.
6. The PWA does not need a MarketStabilitySeller buyer screen for v1. This is a protocol and market mechanism, not a required user messaging flow.

After the `x21` tranche clears, MarketStabilitySeller no longer regulates price. Further price discovery belongs to the market.

## Phase 6: Enable Buyback Split

`FeeAccumulator.EnableBuybackSplit` is one-way. It is a real one-time authority of the immutable treasury receiver:
it cannot steal funds, pause, rescue, or change addresses, but it permanently changes FeeAccumulator economics from
bootstrap treasury-only accumulation to the 50/50 treasury/buyback split. Do not call it because the launch "looks close
enough".

Before enabling, fill the input for:

```text
scripts/enable_buyback_split_preflight.ts
npm.cmd run buyback:enable-preflight
```

Preflight must prove:

- AirdropPool activity airdrop `remaining_budget == 0`;
- FeeAccumulator split is still disabled;
- `buyback_due_ton == 0`;
- BuybackBurn is sealed;
- BuybackBurn route is frozen;
- BuybackBurn launch controller is burned;
- FeeAccumulator and BuybackBurn bindings match;
- BuybackBurn live state is clean;
- BuybackBurn totals are zero;
- M20F evidence is ready.

Only after PASS may the treasury receiver call `FeeAccumulator.EnableBuybackSplit`.

## Phase 7: Operations After Launch

Allowed recurring operations:

- `FeeAccumulator.SplitAccumulated`;
- `FeeAccumulator.FlushTreasuryDue`;
- `FeeAccumulator.FlushBuybackDue` only for a complete `51.05 TON` envelope;
- `BuybackBurn.ExecuteBuybackChunk` with frozen quote/minOut;
- `BuybackBurn.RecoverStonfiRouteRefund` only after deadline/grace and large current refund;
- `BuybackBurn.RecycleRouteRefundReserve` only after route freeze;
- `BuybackBurn.RetryAthBurnDue` only for full retry due;
- UsernameRegistry due flushes;
- ProfileRegistry due flushes;
- MarketStabilitySeller treasury flush.

Buyback due below one full `51.05 TON` execution envelope remains queued in FeeAccumulator until later protocol fees
complete the next envelope. Do not send partial buyback reserve to BuybackBurn.

Operational dashboards and indexers must treat buyback burn success as `ATHBurnFinalized` received by BuybackBurn from
ATHMaster. ATHWallet sending `ATHBurnNotification`, or BuybackBurn sending an outbound burn request, is only a burn
attempt. It must not clear pending state or count burned ATH unless BuybackBurn receives the authenticated finalization.

Do not add emergency rescue, pause, admin drain, upgrade, or governance paths without a separate audit cycle. If an operation gets stuck, first prove the exact stuck path, then design a narrow fix.

## PWA Deployment

Before publishing the PWA:

```powershell
npm.cmd run web:deploy:prepare:prod
```

Verify:

- production static bundle contains `web/docs/*.md`;
- PWA runtime config points to final mainnet addresses;
- no draft Russian documents are included in the published bundle;
- no testnet addresses are present in production config;
- service worker cache version is bumped;
- service worker precaches the runtime noble vendor modules used by wallet and message crypto;
- production hosting uses the checked-in Caddy/Nginx security headers, including strict CSP, `nosniff`, `no-referrer`, and camera/microphone/geolocation denial;
- CSP `connect-src` names only same-origin and the approved production TON RPC hosts;
- CSP `script-src` is hash-free: the bundle ships no inline scripts and no inline import map (vendor modules use relative imports, and the Telegram WebApp SDK is self-hosted under `web/vendor/`), so there is no content hash to recompute before deploy;
- `/` and `/index.html` both serve the same PWA entry;
- docs viewer opens:
  - About Platho;
  - ATH Whitepaper;
  - Crypto Protocol.

## What Belongs In The PWA

User-facing PWA flows:

- wallet create, import, and seed export;
- key activation, rotation, and sync;
- private messages;
- public posts, channels, and comments;
- image attachments;
- `.ath` username mint and failed mint refund claim;
- profile avatar upload/update;
- ATH stats and burn visibility.

Do not add v1 PWA screens for:

- MarketStabilitySeller tranche purchases;
- generic ATH transfer UI;
- keeper-only prune, recycle, recovery, or retry panels;
- genesis, seal, route-freeze, pricing-freeze, or preflight controls.

Those remain deployment and operations scripts. The user interface should stay focused on user actions.

## Final Go / No-Go

Mainnet go is possible only if:

- fresh audit pass has no open C/H/M findings;
- current `HEAD` matches the audit archive;
- CI passes;
- final genesis verifier passes;
- M20F route-freeze preflight passes;
- MarketStability readiness passes after pool, pricing, and reserve funding;
- EnableBuybackSplit preflight passes before one-way enable;
- deployment artifacts, transaction hashes, code hashes, getter snapshots, and final manifest are archived immutably.
- external audit archives pass the archive hygiene guard and contain no browser profiles, cookies, IndexedDB, Local Storage, session data, local env files, seed material, private keys, old zip archives, `node_modules`, or `.git`.

Any fail here stops the launch.
