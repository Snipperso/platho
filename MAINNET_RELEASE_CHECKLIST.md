# Platho Mainnet Release Checklist

This is the short operational checklist for the current canonical release. It does not replace
`DEPLOYMENT_RUNBOOK.md`; it is the final go/no-go sheet used to keep the release order and funding
state unambiguous.

## Canonical Tokenomics

The canonical ATH allocation for this release is:

| Bucket | Amount | Release handling |
| --- | ---: | --- |
| Activity airdrop | `15,000,000 ATH` | Pre-funded into the official Vault ATH wallet at final genesis. |
| Initial ATH/TON liquidity | `15,000,000 ATH` | Used for the initial pool launch against the target `100,000 TON` reference cap. |
| Long-term protocol vesting | `10,000,000 ATH` | Locked in immutable `ATHVesting`, `100,000 ATH` unlock per 365-day period for `100` periods. |
| MarketStabilitySeller reserve | `60,000,000 ATH` | Funded after pricing freeze through the bound reserve-funder notify-flow. |

MarketStabilitySeller uses `20` fixed tranches of `3,000,000 ATH`, from `x2` through `x21` of the
initial pool price. Older lower-reserve notes are obsolete for the current archive.

Activity rewards are `10 ATH` per finalized capsule as an early activity bonus. They are not a refund,
cashback, reimbursement, investment return, or price guarantee.

## Non-Negotiable Release Order

The production chain is:

```text
fresh build and tests
-> final manifest with real mainnet addresses
-> code hash and StateInit hash artifacts
-> deploy and pre-seal bindings
-> exact final genesis funding
-> live getter snapshot
-> mainnet:genesis:verify PASS
-> production PWA mainnet release for activity airdrop
-> distribute the 15,000,000 ATH activity airdrop through Vault
-> verify Vault airdrop_remaining_ath == 0 and airdrop_distributed_ath == 15,000,000 ATH
-> initial ATH/TON pool launch
-> BuybackBurn route freeze preflight and route freeze
-> MarketStabilitySeller pricing freeze
-> MarketStabilitySeller reserve funding and readiness PASS
-> EnableBuybackSplit preflight PASS
-> EnableBuybackSplit
```

Do not swap the order. Do not use M20F route preflight, MarketStabilitySeller readiness, or any
post-pool script as a substitute for `mainnet:genesis:verify`.

## Final Genesis Funding State

At final genesis, before the pool launch and before any public user activity, the live getter
snapshot must prove this state:

| Component | Required state |
| --- | --- |
| `ATHMaster` | `total_supply == 100,000,000 ATH`, treasury supply deployed exactly once. |
| Official Vault ATH wallet | Balance exactly `15,000,000 ATH`. No underfunding, no overfunding. |
| `Vault` | `airdrop_remaining_ath == 15,000,000 ATH`, distributed `0`, no users, no pending publish or withdrawal state. |
| Official `ATHVesting` ATH wallet | Balance exactly `10,000,000 ATH`. |
| `ATHVesting` | Correct beneficiary/schedule, claimed `0`, idle phase, no pending transfer. |
| UsernameRegistry official ATH wallet | Balance `0`; may still be `uninit` at the deterministic StateInit address. |
| ProfileRegistry official ATH wallet | Balance `0`; may still be `uninit` at the deterministic StateInit address. |
| BuybackBurn official ATH wallet | Balance `0`; may still be `uninit` at the deterministic StateInit address. |
| MarketStabilitySeller official ATH wallet | Balance `0`; may still be `uninit` at the deterministic StateInit address. |
| `FeeAccumulator` | Split disabled, all buckets `0`. |
| `BuybackBurn` | Sealed, route not frozen, launch controller retained, all due/pending/retry/totals `0`. |
| `MarketStabilitySeller` | Sealed, pricing not frozen, launch controller retained, reserve/sale/tranche/treasury/pending state `0`. |
| `CapsuleHub` | Latest ids and accrued fees `0`. |
| Username/Profile registries | No records, pending mints, dues, or pending flushes. |

The initial liquidity allocation is not a user balance and is not a protocol liability inside Vault,
Vesting, BuybackBurn, or MarketStabilitySeller at final genesis. It must have its own transaction
proof when the ATH/TON pool is launched.

Protocol fees collected before the pool launch are not expected to fully fund the TON side of initial
liquidity. The launch may require project/treasury funding in addition to protocol revenue.

## Post-Genesis Required State

After `mainnet:genesis:verify` passes:

| Step | Required proof |
| --- | --- |
| Production PWA release | Mainnet config, production bundle, crypto review gate, and hosting headers pass. |
| Activity airdrop distribution | Vault `airdrop_remaining_ath == 0` and `airdrop_distributed_ath == 15,000,000 ATH`. |
| Initial pool launch | Only after activity airdrop distribution; `15,000,000 ATH` paired against the target `100,000 TON` reference cap. |
| Buyback route freeze | M20F evidence from final mainnet STON.fi API/SDK params; no testnet route data. |
| Buyback route state | `route_frozen == true`, route controller burned, frozen quote/minOut and route actors match evidence. |
| Pricing freeze | `base_tranche_price_nanotons == evidence_x1_tranche_quote_nanotons`; pricing controller burned. |
| Seller reserve funding | `reserve_due_ath == 60,000,000 ATH`, `reserve_funded_total_ath == 60,000,000 ATH`. |
| Seller official ATH wallet | Balance at least `60,000,000 ATH`; official seller ATH wallet balance above the reserve is a warning, not sellable reserve, and can remain stuck. |
| Buyback split enable | Vault airdrop remaining `== 0`, BuybackBurn route frozen and clean, M20F ready, FeeAccumulator split still disabled. |

MarketStabilitySeller may be partially funded at runtime, but partial funding is not release
readiness. Manual ordinary ATH transfers into the official seller ATH wallet are unsupported and
do not increase sellable reserve. For full-launch reserve funding, use one authenticated
notify-flow transfer for the whole `60,000,000 ATH`; chunked funding is an intentional partial-sale
mode, not the default release ceremony.

## Username Resolver Invariant

All `.ath` username resolvers, PWA views, bots, explorers, and indexers must resolve ownership as:

```text
UsernameRegistry.name_records[name_hash].item_address
-> exact UsernameNFTItem
-> UsernameNFTItem.owner_wallet
```

The registry record remains the authoritative name-to-item anchor. `UsernameRegistry.get_name_record.owner_wallet`
is a registration snapshot for legacy/reporting context, not the current owner after transfer. It must not be used as
the owner for messaging, payments, profile display, username transfer checks, or wallet identity after the item has
become transferable.

Username mint finality is intentionally conservative: production release evidence must verify the
`UsernameNFTItem` code hash, deterministic item address derivation, and the registry item
deployment ACK/bounce path before treating Vault-funded username mints as live.

## Command Gates Before Production PWA Release

Run these before producing the final archive, publishing the production PWA, or calling any mainnet transaction:

```powershell
npm.cmd run build
npm.cmd test
node scripts\hash_codes.js
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\deployment_manifest_m15.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\conformance_m16.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\artifact_integrity_m18.ts
npm.cmd run mainnet:manifest:draft
npm.cmd run mainnet:deploy:packet
npm.cmd run mainnet:tx:dry-run
npm.cmd run mainnet:genesis:verify
npm.cmd run preprod:check
npm.cmd run web:deploy:prepare:prod
npm.cmd run audit:archive
```

Any hard failure stops the release. A script that is waiting for final mainnet input is not a pass.

## Post-Pool Command Gates

Run these only after `mainnet:genesis:verify` has passed, the production PWA is released, the full activity airdrop has been distributed, and the initial ATH/TON pool exists:

```powershell
npm.cmd run m20f:collect
npm.cmd run m20f:preflight
npm.cmd run market-stability:readiness
npm.cmd run buyback:enable-preflight
```

Any hard failure stops the post-pool launch phase. A script that is waiting for final pool input is not a pass.

## Authorities To Name Honestly

The release has narrow one-shot or one-way authorities. They are not rescue, pause, upgrade, admin
drain, or arbitrary balance-control levers, but they must stay visible in docs and checklists:

| Authority | Scope |
| --- | --- |
| `ath_treasury_owner` | Sends one-shot `ATHMaster.DeployTreasurySupply`. |
| `genesis_controller_one_shot` | Performs pre-seal bindings and seal actions. |
| BuybackBurn launch controller | Freezes the post-pool STON.fi route once. |
| MarketStabilitySeller launch controller | Freezes the post-pool base tranche price once. |
| FeeAccumulator treasury receiver | Enables one-way buyback split after preflight. |

In the current contract model, the `buyback_burn_launch_controller` and
`market_stability_seller_launch_controller` addresses intentionally equal
`genesis_controller_one_shot`, because both post-pool freeze surfaces use the retained
`genesis_config_hash`. Do not retire, destroy, lose, or archive this controller key merely after
genesis seal. It remains a narrow launch authority until both post-pool freezes are complete and
live getters prove:

```text
BuybackBurn.route_frozen == true
BuybackBurn.genesis_config_hash == 0
MarketStabilitySeller.pricing_frozen == true
MarketStabilitySeller.genesis_config_hash == 0
```

## Stop Conditions

Stop the release immediately if any of these happen:

- Any open C/H/M finding remains unresolved.
- Current `HEAD` does not match the archive reviewed for release.
- Code hash artifacts disagree with fresh build output.
- The final manifest hash does not recompute from final manifest contents.
- Any protocol-owned or official ATH wallet address is not basechain.
- Official wallet funding is underfunded or overfunded where exact funding is required.
- A post-pool readiness script is used without a prior `mainnet:genesis:verify` PASS.
- M20T harness addresses appear as production BuybackBurn addresses.
- The production PWA bundle contains testnet config, local secrets, SSH keys, or draft Russian docs.
- The production PWA host does not enforce the checked-in CSP/security headers.
- The service worker install cache omits runtime vendor crypto modules required by first offline launch.
- The external audit archive was not produced by `npm.cmd run audit:archive`, or contains browser profiles, cookies, IndexedDB, Local Storage, session data, local env files, seed material, private keys, old zip archives, `node_modules`, or `.git`.
