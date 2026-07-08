# ATH Whitepaper

## The Platho Protocol Token

ATH is the utility token of Platho. It is used for activity rewards, post-airdrop protocol-fee discounts, `.ath` usernames, profile avatar updates, market-stability sales, buyback, and burn.

ATH is not an administrative token. It does not grant the ability to rewrite balances, pause operations, mint new supply, or change user ownership rules. Its role is to power the application economy and connect Platho usage with on-chain accounting.

This document describes the ATH model in Platho.

## Core Parameters

ATH has a fixed total supply:

```text
100,000,000 ATH
```

The launch reference price is:

```text
1 ATH = 0.001 GRAM
```

The launch fully diluted valuation is:

```text
100,000,000 ATH * 0.001 GRAM = 100,000 GRAM
```

ATH starts from a reference capitalization of `100,000 GRAM`.

## Fixed Supply

ATH is issued by `ATHMaster`. On initialization, `ATHMaster` sets the fixed total supply to `100,000,000 ATH`.

There is no post-genesis mint function. `ATHMaster` does not implement admin minting, pause, blacklist, transfer tax, force transfer, or rescue drain.

Initial supply deployment is performed once through `DeployTreasurySupply`. It sends the full supply to the treasury ATH wallet. The genesis supply deployment cannot be repeated.

Total supply decreases only through burn. `ATHMaster` accepts a burn only after an authenticated burn notification from the deterministic ATH wallet of the owner address. After verification, `ATHMaster` decreases `total_supply` and sends `ATHBurnFinalized`.

ATH burn is a real reduction of total supply, not a transfer to an unused address.

## Supply Allocation

ATH supply is allocated across four categories:

| Category | Share | Amount |
| --- | ---: | ---: |
| Activity airdrop | 15% | 15,000,000 ATH |
| Initial liquidity | 15% | 15,000,000 ATH |
| Long-term protocol vesting | 10% | 10,000,000 ATH |
| Market stability reserve | 60% | 60,000,000 ATH |

This allocation defines the economic structure of Platho:

- 15% of supply is distributed to users through application activity before the pool launch.
- 15% of supply is used for initial liquidity.
- 10% of supply is locked in immutable long-term vesting.
- 60% of supply is funded into MarketStabilitySeller and locked at genesis, then sold in tranches above the launch price after the post-pool pricing freeze.

The activity airdrop and long-term vesting reserve are backed at final genesis by the official ATH wallets of Vault and ATHVesting, and the release verifier checks those balances before production release. The `60,000,000 ATH` market-stability reserve is funded into MarketStabilitySeller and locked at final genesis, backed by its official seller ATH wallet, and the release verifier checks that backing before production release. The reserve is capitalized from the start, but it is not sold until after pool launch, when the one-time evidence-bound pricing freeze sets the base tranche price.

## Long-Term Protocol Vesting

The long-term vesting reserve is:

```text
10,000,000 ATH
```

It is held by `ATHVesting`, not by a mutable treasury bucket. The vesting schedule is fixed in the contract:

```text
100,000 ATH per 365-day period
100 periods
10,000,000 ATH total
```

Anyone may trigger a claim once ATH is vested, but the beneficiary is immutable. The contract has no acceleration, beneficiary change, pause, admin sweep, rescue drain, or discretionary release function.

At final genesis, the official `ATHWallet(owner = ATHVesting, master = ATHMaster)` must contain exactly `10,000,000 ATH`. The verifier also requires zero claimed ATH, idle phase, and no pending transfer before launch.

This reserve is intentionally slow. It creates a long horizon for protocol development without placing a liquid 10M ATH bucket above the market at launch.

## Activity Airdrop

The activity airdrop is:

```text
15,000,000 ATH
```

Reward per successful publish:

```text
10 ATH
```

The reward is credited to the user's internal ATH balance in Vault after a successful publish. A successful publish means that Vault sent the payload to CapsuleHub, CapsuleHub accepted the entry, and Vault received the acknowledgement.

Failed publish attempts do not create activity rewards.

Reward accounting:

```text
user.ath_balance += 10 ATH
airdrop_remaining -= 10 ATH
```

If the remaining airdrop bucket is below 10 ATH, the remaining amount is credited. Once the bucket is exhausted, new activity rewards stop.

The activity airdrop is accounted for in Vault and backed by the pre-funded official Vault ATH wallet.

Vault ATH deposits are supported only through the user's ATHWallet transfer-with-notify flow
(`ATHTransferRequestWithNotify`) into Vault. A manual ordinary ATH transfer to the official Vault ATHWallet is
unsupported: it can increase the raw official wallet balance, but it does not create `Vault.user.ath_balance` and must
not be shown by the PWA as a deposit path.

Vault ATH withdrawals are signed external Vault commands. The downstream ATHWallet deployment, transfer, storage, and
ACK execution reserve is paid from the user's internal Vault GRAM balance. Vault credits back only authenticated
ACK/fail/bounce value it receives, minus the local refund reserve and capped by the reserved internal value.

## Activity Price

Messages start from the current public base price:

```text
from 0.0337 GRAM
```

Current exact canonical examples before ATH discount are:

```text
public post: 0.0337 GRAM
hybrid private 1 KiB capsule: 0.0347 GRAM
```

For a successful publish, the user receives:

```text
10 ATH
```

At the launch reference price:

```text
10 ATH * 0.001 GRAM = 0.01 GRAM
```

This ties the early ATH distribution to real application usage. The reward is an activity bonus, not a refund, cashback,
rebate, or promise that ATH will compensate the GRAM cost of a publish. The launch reference value of `10 ATH` can be
lower than the GRAM cost of the capsule, and that is intentional: users receive early network ownership for real usage,
not a guaranteed reimbursement.

Capsule pricing: 1 KiB public posts start from `0.0337 GRAM` and hybrid private 1 KiB capsules from `0.0347 GRAM`. Larger public or private capsule blocks cost more because the selected 1, 2, 4, 8, 16, or 32 KiB
body changes the Vault/CapsuleHub execution and storage reserve. The reward remains `10 ATH` per successfully finalized
capsule, regardless of capsule size.

Private publishing uses the hybrid security profile by default: X25519 + ML-KEM-768 + AES-GCM. There is no cheaper classical private-message mode.

ATH may trade above or below the launch reference price after the official pool exists. The activity reward is not an investment return, a profit expectation, or a price guarantee.

## Protocol Fee and User Price

Inside Vault, protocol fee is separate from the full user-facing cost.

Protocol fee:

| Publish type | Protocol fee |
| --- | ---: |
| Public post | 0.010 GRAM |
| Hybrid private message | 0.010 GRAM |

The user-facing price includes protocol fee, compact index/header storage endowment, Vault local execution reserve, and the expected ACK refund:

| Publish type | User-facing price |
| --- | ---: |
| Public (from) | from 0.0337 GRAM |
| Current public post exact example | 0.0337 GRAM |
| Current hybrid private 1 KiB exact example | 0.0347 GRAM |

If the PWA receives a higher conservative network estimate, it adds the estimated overage to the canonical max charge, rounded up to clean `0.001 GRAM` steps. ATH discounts apply to protocol fee, not to network costs or storage reserves. This surcharge is a signed safety margin: if CapsuleHub accepts the publish, the success ACK returns only the fixed publish ACK reserve of `30,000,000` nanotons (`0.030 GRAM`). After Vault processes that ACK, the user is credited roughly `25,800,000` nanotons in internal Vault GRAM balance. The part above the canonical required value remains in CapsuleHub as network/storage reserve overage. It is not returned to Vault and is not counted as `accrued_plato_fee_ton` at publish time. Only raw surplus above CapsuleHub's protected reserve may later be swept permissionlessly to FeeAccumulator, where it follows normal treasury/buyback accounting. CapsuleHub stores compact authenticated entry metadata and the body hash; the heavy body is recovered from accepted publish transaction history and verified locally.

## ATH Discounts

ATH reduces message protocol fees after the activity airdrop has been fully distributed.

Discounts unlock only when the remaining activity airdrop is:

```text
airdrop_remaining_ath == 0 ATH
```

Before this point, protocol fee is paid in full.

Full discount threshold:

```text
10,000 ATH
```

If the user's internal ATH balance in Vault is at least `10,000 ATH`, the user reaches the full protocol-fee discount tier for the Platho fee component. Network costs and storage reserves are still paid.

If the balance is below `10,000 ATH`, the fee decreases linearly:

```text
raw_discounted_fee = ceil(full_fee * (10,000 ATH - min(user_ath_balance, 10,000 ATH)) / 10,000 ATH)
discounted_fee = raw_discounted_fee
```

The calculation rounds up. With current constants, the full protocol fee is `0.010 GRAM` (`10,000,000 nanotons`) for both public and private capsules, and the maximum reduction is `0.010 GRAM` per capsule.

## Pool Launch

The ATH/GRAM pool launches after the full `15,000,000 ATH` activity airdrop has been distributed.

The launch sequence is:

1. Users receive ATH through real Platho usage.
2. The full activity airdrop is distributed.
3. ATH discounts unlock.
4. The ATH/GRAM pool launches.
5. Post-pool route evidence and pricing evidence are frozen.
6. Buyback split is enabled.

The pool starts from the reference price:

```text
1 ATH = 0.001 GRAM
```

Initial liquidity allocation:

```text
15,000,000 ATH
```

GRAM side at the launch price:

```text
15,000,000 ATH * 0.001 GRAM = 15,000 GRAM
```

Protocol fees collected before the pool launch fund the full GRAM side of the initial liquidity. This is part of the
launch bootstrap and does not turn activity rewards into a GRAM-denominated claim.

The pool launches around a token that has already been distributed through application usage. This separates ATH from an empty listing without a user base.

## FeeAccumulator

GRAM protocol fees are collected in `FeeAccumulator`.

Before buyback split is enabled, all accumulated GRAM moves to the treasury bucket:

```text
accumulated_ton -> treasury_due_ton
```

`buyback_due_ton` does not grow before the split is enabled.

After `EnableBuybackSplit`, accumulated GRAM is split:

```text
50% -> treasury_due_ton
50% -> buyback_due_ton
```

If the amount is odd in nanotons, the remainder stays on the buyback side:

```text
treasury_amount = floor(amount * 50%)
buyback_amount = amount - treasury_amount
```

`EnableBuybackSplit` is a one-way action executed by the immutable treasury receiver after pool launch and buyback route
freeze. This is a real one-time authority: it cannot steal funds, pause, rescue, or change addresses, but it permanently
changes FeeAccumulator economics from bootstrap treasury-only accumulation to the 50/50 treasury/buyback split. It is
enabled only after the release preflight passes.

Platho's release authorities are deliberately narrow and mostly one-shot. They still exist and must be named honestly:
the treasury owner deploys the initial ATH supply once; the genesis controller performs pre-seal binding and sealing;
the BuybackBurn launch controller freezes the post-pool route once; the MarketStabilitySeller pricing freeze is performed
once by its launch controller; and the FeeAccumulator treasury receiver enables the one-way buyback split after preflight. None of these
roles is a rescue, pause, upgrade, admin drain, or arbitrary balance-control mechanism.

## Buyback and Burn

Buyback is executed through `FeeAccumulator` and `BuybackBurn`.

BuybackBurn accepts only a full execution envelope:

```text
51.05 GRAM
```

Envelope structure:

```text
50.00 GRAM  - STON.fi offer amount
1.00 GRAM   - route forward gas
0.05 GRAM   - pTON transfer gas
```

Raw `50 GRAM` is not a valid buyback chunk. Buyback is accepted only as a full route envelope.

After route freeze, BuybackBurn executes a buyback as follows:

1. Accepts `51.05 GRAM` only from the bound FeeAccumulator.
2. Records the amount in `reserve_due_ton`.
3. On `ExecuteBuybackChunk`, consumes one envelope.
4. Uses the frozen quote and frozen minOut.
5. Sets the STON.fi deadline internally.
6. Sends the route through the frozen pTON wallet.
7. Accepts ATH only through the official BuybackBurn ATH wallet.
8. Verifies that the source wallet matches the frozen STON.fi pool.
9. Sends the received ATH to burn through the official ATH wallet.
10. Completes the cycle only after `ATHBurnFinalized` from `ATHMaster`.

Buyback success is not defined by a router message, outbound burn request, or ATHWallet burn notification. It is defined
only when BuybackBurn receives authenticated `ATHBurnFinalized` from ATHMaster. Until that finalization arrives,
BuybackBurn must still be treated as pending burn or retry state; dashboards and indexers must not count the ATH as
burned merely because a burn attempt was sent.

If burn does not finalize, the received ATH moves into retry due. `RetryAthBurnDue` burns the full retry due amount.

## Username Fees

`.ath` username registration is paid in ATH through the official UsernameRegistry ATH wallet.

Prices:

| Name length | Price |
| ---: | ---: |
| 4 characters | 10,000 ATH |
| 5 characters | 1,000 ATH |
| 6+ characters | 100 ATH |

UsernameRegistry accepts only the exact price. Underpay and overpay do not create a name.

An accepted mint goes through pending state and deploys `UsernameNFTItem`. Before item acknowledgement, the payment is not recognized as revenue. After item acknowledgement, the amount is split:

```text
50% -> treasury_due_ath
50% -> burn_due_ath
```

Username mint is Vault-funded. Invalid username, wrong price, or duplicate-name rejections bounce through the
official ATH wallet notification path so Vault can restore the user's internal ATH. UsernameRegistry does not maintain a
direct external username refund bucket in the current Vault-funded flow.

ATH from username mint becomes protocol revenue only after deployment of the corresponding item is confirmed.

Username authority is split deliberately: `UsernameRegistry` anchors the name to one exact `UsernameNFTItem`, and the
item state carries the current owner. Transfers of the item transfer the username. The item exposes standard NFT data
and TEP-64 on-chain metadata, including `name = <username>.ath`; it does not depend on a Platho server for metadata.
Username bytes are literal and not display-normalized: leading, trailing, consecutive, and all-separator names are
valid when every byte is in the allowed `a-z`, `0-9`, `_`, `-` set and length is 4..16.
If item deployment was attempted but the item ACK never reached the registry, `PrunePendingUsernameMint` is intentionally
non-destructive: it does not guess failure, delete pending state, or create refund due. The recovery path is a late
`UsernameItemDeployedAck` or `UsernameNFTItem.ResendDeployedAck`, so an initialized item can still become authoritative.
If the item deployment actually bounces, the registry asks the official ATH wallet to refund the pending notification.
A deployed `UsernameNFTItem` without `UsernameRegistry.name_records[name_hash]` pointing to that exact item is
non-authoritative: clients, indexers, and UI must not treat the item alone as ownership of the `.ath` name, and must not
use the registry record owner as the current owner after transfers.

## Profile Avatar Fees

Profile avatar update costs:

```text
100 ATH
```

Profile avatar updates are Vault-funded. The PWA sends `SetProfileAvatarFromVaultBalance` to Vault; Vault pays through its official ATH wallet notification path into the official ProfileRegistry ATH wallet. Direct user-wallet avatar payment is not supported.

ProfileRegistry accepts the update only when all conditions are met:

- amount is exactly `100 ATH`;
- sender is the official ProfileRegistry ATH wallet;
- payer wallet is the bound Vault;
- owner wallet is in basechain;
- avatar hash is not zero;
- stream id is not zero;
- part count is from 1 to 16;
- media format is WebP.

An accepted update creates a new avatar version and splits the fee:

```text
50 ATH -> treasury_due_ath
50 ATH -> burn_due_ath
```

A rejected avatar notification is refunded through the ATHWallet notification bounce path. ProfileRegistry does not create a separate refund bucket for malformed avatar updates.

ProfileRegistry stores the authenticated avatar pointer, not permanent image bytes. The PWA must reconstruct avatar WebP data from public CapsuleHub entries or local cache and verify the bytes against the stored `avatar_hash`; missing or pruned history is shown as unavailable.

## Market Stability Seller

MarketStabilitySeller is a public contract reserve that distributes ATH after the official pool launch:

```text
60,000,000 ATH
```

Its purpose is to reduce the early-market distortion caused by thin liquidity. At launch, a small pool can be moved sharply by a small group of early buyers. If that happens, users who need ATH for actual Platho actions can be forced to buy into an artificial price spike.

MarketStabilitySeller creates a transparent supply staircase above the launch price. It sells ATH in fixed-size tranches. Each next tranche is more expensive than the previous one, and each tranche has a hard size limit. After the one-time evidence-bound pricing freeze, the tranche schedule is deterministic and cannot be manually changed by the team.

If early speculators try to absorb a large amount of ATH, they buy from the public reserve at increasing tranche prices instead of extracting all cheap liquidity from a thin pool and reselling it to users. If ordinary users need ATH for Platho, they can buy it at a known public tranche price without pushing a small pool vertically with a single demand wave.

The reserve does not dump tokens into the market. It does not sell by itself and does not create sell pressure without demand. A sale happens only when a buyer voluntarily purchases from the current tranche. If there is no demand, the reserve remains idle.

The on-chain utility of ATH is specific:

- `.ath` username registration is paid in ATH through UsernameRegistry;
- profile avatar pointer updates are paid in ATH through ProfileRegistry;
- ATH held in the user's internal Vault balance reduces the protocol fee for Vault publishes after the activity-distribution gate;
- accepted username and avatar fees create treasury due and burn due;
- BuybackBurn buys ATH with protocol GRAM fees and burns the received ATH through ATHMaster.

Vault publishes are paid in GRAM. ATH does not pay the whole publish transaction. It reduces the protocol-fee component after the discount gate is open.

This makes ATH demand tied to concrete protocol actions: `.ath` names, avatar updates, post-airdrop Vault protocol-fee discounts, and buyback/burn pressure. MarketStabilitySeller expands available supply only as buyers take the next tranche, so early access is public and deterministic instead of being dominated by a thin pool.

The reserve is sold only after post-pool pricing freeze.

Pricing freeze is a real one-time launch authority. It sets the base tranche price once from pool-launch evidence, then the launch controller hash is cleared. After that, MarketStabilitySeller cannot steal funds, pause sales, rescue balances, override buyers, or mutate the price schedule.

MarketStabilitySeller is capitalized at final genesis with the full `60,000,000 ATH` reserve, funded through the
authenticated reserve-funder flow into the official seller ATH wallet, up to the hard cap of `60,000,000 ATH`.
`mainnet:genesis:verify` checks that the seller carries the full reserve and that its official seller ATH wallet backing
is at least `60,000,000 ATH` before production release. An unsolicited ordinary ATH transfer into the official seller ATH
wallet does not increase the accounted reserve, does not expand sellable supply, and can remain stuck; a wallet balance
above `60,000,000 ATH` is treated as a warning, not as additional reserve.

Selling is a separate post-pool step. The reserve is not sold until after pool launch, when the one-time evidence-bound
pricing freeze sets the base tranche price; from then on the tranche schedule is deterministic and cannot be manually
changed by the team.

The reserve is split into 20 tranches:

```text
20 * 3,000,000 ATH = 60,000,000 ATH
```

Each tranche has a multiplier:

```text
x2, x3, x4, ..., x21
```

This creates a smooth price staircase. As project popularity grows, the market receives additional ATH supply, but each next tranche is more expensive than the previous one. Early demand does not hit a thin pool immediately, and price growth does not become a vertical wall that makes the utility token inconvenient to use.

Purchase formula:

```text
price = ceil(base_tranche_price * current_multiplier * amount / 3,000,000 ATH)
```

`base_tranche_price` is frozen after pool launch and exactly matches the x1 pricing evidence.

At the launch price `1 ATH = 0.001 GRAM`, the x1 price of one tranche is:

```text
3,000,000 ATH * 0.001 GRAM = 3,000 GRAM
```

Therefore:

| Tranche | Multiplier | Price for 3M ATH | Price per 1 ATH |
| ---: | ---: | ---: | ---: |
| 1 | x2 | 6,000 GRAM | 0.002 GRAM |
| 2 | x3 | 9,000 GRAM | 0.003 GRAM |
| 3 | x4 | 12,000 GRAM | 0.004 GRAM |
| ... | ... | ... | ... |
| 15 | x16 | 48,000 GRAM | 0.016 GRAM |
| ... | ... | ... | ... |
| 20 | x21 | 63,000 GRAM | 0.021 GRAM |

A single purchase cannot cross a tranche boundary. This prevents buying ATH from the next tranche at the previous tranche price.

GRAM revenue is recognized only after ATH is delivered to the buyer. If ATH transfer fails or bounces, the reserve is restored, the buyer receives the paid GRAM principal back, and treasury due does not increase.

After the final x21 tranche is sold, MarketStabilitySeller no longer regulates the ATH price. From that point, price is fully determined by the market: liquidity, available supply, demand for `.ath` names, avatar updates, post-airdrop Vault protocol-fee discounts, and buyback/burn pressure.

Even at the x21 step, reference valuation remains moderate relative to the utility model:

```text
1 ATH = 0.021 GRAM
100,000,000 ATH = 2,100,000 GRAM
```

At the x21 step, MarketStabilitySeller has finished its programmed reserve release. After that, ATH price is fully market-determined by liquidity, usage demand, available supply, and buyback/burn pressure. The only remaining protocol allocation is the slow long-term vesting schedule, capped at `100,000 ATH` per year.

## Treasury and Burn Buckets

UsernameRegistry and ProfileRegistry use the same ATH fee split model:

```text
accepted ATH fee -> 50% treasury_due_ath + 50% burn_due_ath
```

Treasury due flush sends ATH to the treasury receiver through the official ATH wallet.

Burn due flush sends an ATH burn request through the official ATH wallet. Supply decreases only after burn finalization in ATHMaster.

Fail and bounce paths restore due buckets. Accounting is preserved until the downstream transfer or burn is completed.

## ATHWallet Accounting

ATH balances live in deterministic ATHWallet contracts.

ATHWallet handles:

- genesis supply credit;
- ordinary transfer;
- transfer with notify;
- username mint notify;
- profile avatar notify;
- burn request;
- notification acknowledgement;
- stale notification prune;
- bounce/fail recovery.

Contracts that accept ATH as payment do not accept direct messages from arbitrary addresses. They accept notifications only from their official ATHWallet. Source wallet authentication is performed inside ATHWallet through deterministic wallet derivation.

ATH exposes TEP-74-like transfer entrypoints for generic jetton tooling, but Platho protocol actions use authenticated ATH notification messages. External integrations must not assume that Platho notify flows emit a generic `JettonTransferNotification`.

Outgoing internal transfers in ATHWallet are protected by source-side pending accounting and source acknowledgement. Balance is not restored from a bounce body without pending proof.

## ATH Lifecycle

1. `ATHMaster` creates fixed supply of `100,000,000 ATH`.
2. Treasury deploy one-shot receives supply in the treasury ATH wallet.
3. Supply is allocated across activity, liquidity, long-term vesting, and market stability.
4. Users publish messages through Vault.
5. A successful publish credits `10 ATH` activity reward.
6. After the full `15,000,000 ATH` activity airdrop is distributed and `airdrop_remaining_ath == 0`, ATH protocol-fee discounts unlock.
7. The ATH/GRAM pool launches at reference price `1 ATH = 0.001 GRAM`.
8. Post-pool route evidence and pricing evidence are frozen.
9. MarketStabilitySeller sells reserve through x2..x21 tranches.
10. After split is enabled, FeeAccumulator divides protocol GRAM fees between treasury and buyback.
11. BuybackBurn buys ATH with GRAM protocol fees and burns ATH through ATHMaster.
12. Username and profile fees create ATH treasury due and ATH burn due.
13. Total supply gradually decreases through authenticated burns.

## Final Model

ATH connects four layers of Platho:

1. **Application usage** - messages create activity rewards.
2. **Paid features** - usernames and avatars require ATH.
3. **Discounts** - ATH balance reduces protocol fee after the distribution gate.
4. **Supply reduction** - part of ATH fees and buyback output is burned through ATHMaster.

The model begins with fixed supply and reference valuation of `100,000 GRAM`. The primary user distribution is tied to real paid usage: messages start from `0.0337 GRAM` — currently `0.0337 GRAM` for a 1 KiB public post and `0.0347 GRAM` for a hybrid private 1 KiB capsule, plus a `10 ATH` activity bonus per finalized capsule. Larger public or private size classes cost more. That bonus is not a refund, reimbursement, or profit promise. After the first 15% of supply is distributed, the pool launches, protocol-fee discounts unlock, and the buyback path opens.

ATH exists as a working token inside Platho: it is distributed through activity, used in paid actions, reduces protocol fee, is sold from reserve through a defined staircase, and is burned through on-chain burn. After the market-stability staircase, the future ATH price is determined by the market and protocol usage.
