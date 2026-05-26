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
-> initial ATH/TON pool launch
-> BuybackBurn route freeze preflight and route freeze
-> MarketStabilitySeller pricing freeze
-> MarketStabilitySeller reserve funding and readiness PASS
-> EnableBuybackSplit preflight PASS
-> EnableBuybackSplit
-> production PWA bundle
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
| UsernameRegistry official ATH wallet | Balance `0`. |
| ProfileRegistry official ATH wallet | Balance `0`. |
| BuybackBurn official ATH wallet | Balance `0`. |
| MarketStabilitySeller official ATH wallet | Balance `0`. |
| `FeeAccumulator` | Split disabled, all buckets `0`. |
| `BuybackBurn` | Sealed, route not frozen, launch controller retained, all due/pending/retry/totals `0`. |
| `MarketStabilitySeller` | Sealed, pricing not frozen, launch controller retained, reserve/sale/tranche/treasury/pending state `0`. |
| `CapsuleHub` | Latest ids and accrued fees `0`. |
| Username/Profile registries | No records, pending mints, dues, or pending flushes. |

The initial liquidity allocation is not a user balance and is not a protocol liability inside Vault,
Vesting, BuybackBurn, or MarketStabilitySeller at final genesis. It must have its own transaction
proof when the ATH/TON pool is launched.

## Post-Pool Required State

After `mainnet:genesis:verify` passes:

| Step | Required proof |
| --- | --- |
| Initial pool launch | `15,000,000 ATH` paired against the target `100,000 TON` reference cap. |
| Buyback route freeze | M20F evidence from final mainnet STON.fi API/SDK params; no testnet route data. |
| Buyback route state | `route_frozen == true`, route controller burned, frozen quote/minOut and route actors match evidence. |
| Pricing freeze | `base_tranche_price_nanotons == evidence_x1_tranche_quote_nanotons`; pricing controller burned. |
| Seller reserve funding | `reserve_due_ath == 60,000,000 ATH`, `reserve_funded_total_ath == 60,000,000 ATH`. |
| Seller official ATH wallet | Balance at least `60,000,000 ATH`; excess is a warning, not sellable reserve. |
| Buyback split enable | Vault airdrop remaining `== 0`, BuybackBurn route frozen and clean, M20F ready, FeeAccumulator split still disabled. |

MarketStabilitySeller may be partially funded at runtime, but partial funding is not release
readiness. Manual ordinary ATH transfers into the official seller ATH wallet are unsupported and
do not increase sellable reserve.

## Command Gates

Run these before producing the final archive or calling any mainnet transaction:

```powershell
npm.cmd run build
npm.cmd test
node scripts\hash_codes.js
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\deployment_manifest_m15.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\conformance_m16.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\artifact_integrity_m18.ts
```

Run these only with final live inputs:

```powershell
npm.cmd run mainnet:genesis:verify
npm.cmd run m20f:collect
npm.cmd run m20f:preflight
npm.cmd run market-stability:readiness
npm.cmd run buyback:enable-preflight
npm.cmd run web:deploy:prepare:prod
```

Any hard failure stops the release. A script that is waiting for final mainnet input is not a pass.

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
