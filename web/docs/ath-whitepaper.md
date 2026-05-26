# ATH Whitepaper

## The Platho Protocol Token

ATH is the utility token of Platho. It is used for activity rewards, publish discounts, `.ath` usernames, profile avatar updates, market-stability sales, buyback, and burn.

ATH is not an administrative token. It does not grant the ability to rewrite balances, pause operations, mint new supply, or change user ownership rules. Its role is to power the application economy and connect Platho usage with on-chain accounting.

This document describes the ATH model in Platho v1.

## Core Parameters

ATH has a fixed total supply:

```text
100,000,000 ATH
```

ATH uses 9 decimals:

```text
1 ATH = 1,000,000,000 atomic units
```

Total supply in atomic units:

```text
100,000,000,000,000,000
```

The launch reference price is:

```text
1 ATH = 0.001 TON
```

The launch fully diluted valuation is:

```text
100,000,000 ATH * 0.001 TON = 100,000 TON
```

ATH starts from a reference capitalization of `100,000 TON`.

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
| Treasury / operations | 10% | 10,000,000 ATH |
| Market stability reserve | 60% | 60,000,000 ATH |

This allocation defines the economic structure of Platho:

- 15% of supply is distributed to users through application activity before the pool launch.
- 15% of supply is used for initial liquidity.
- 10% of supply remains as an operations treasury reserve.
- 60% of supply is placed in MarketStabilitySeller and sold in tranches above the launch price.

The activity airdrop and market stability reserve are backed by real ATH wallet balances of the corresponding contracts. The release verifier checks these balances before final launch.

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

## Activity Price

A standard message costs the user:

```text
0.01 TON
```

For a successful publish, the user receives:

```text
10 ATH
```

At the launch reference price:

```text
10 ATH * 0.001 TON = 0.01 TON
```

This ties the early ATH distribution to the actual cost of an application action.

A post-quantum / hybrid message costs the user:

```text
0.02 TON
```

The reward remains:

```text
10 ATH
```

Hybrid publishing is more expensive because it uses a heavier security profile: X25519 + ML-KEM-768 + AES-GCM. The additional payment buys the security profile, not a higher farming rate.

## Protocol Fee and User Price

Inside Vault, protocol fee is separate from the full user-facing cost.

Protocol fee:

| Publish type | Protocol fee |
| --- | ---: |
| Standard private message | 0.005 TON |
| Public post | 0.005 TON |
| Long-term / hybrid private message | 0.010 TON |

The user-facing price includes protocol fee plus estimated network cost:

| Publish type | User-facing price |
| --- | ---: |
| Standard private / public | 0.010 TON |
| Long-term / hybrid private | 0.020 TON |

If the PWA receives a higher conservative network estimate, it adds a surcharge to the canonical max charge. ATH discounts apply to protocol fee, not to network costs or storage reserves.

## ATH Discounts

ATH reduces message protocol fees after the first half of the activity airdrop has been distributed.

Discounts unlock when remaining activity airdrop is not greater than:

```text
15,000,000 ATH
```

Before this point, protocol fee is paid in full.

Full discount threshold:

```text
10,000 ATH
```

If the user's internal ATH balance in Vault is at least `10,000 ATH`, the protocol fee for publishing becomes zero.

If the balance is below `10,000 ATH`, the fee decreases linearly:

```text
discounted_fee = full_fee * (10,000 ATH - user_ath_balance) / 10,000 ATH
```

The calculation rounds up. This prevents undercharging on fractional values.

## Pool Launch

The ATH/TON pool launches after the first `15,000,000 ATH` have been distributed through the activity airdrop.

The launch sequence is:

1. Users receive ATH through real Platho usage.
2. The first half of the activity airdrop is distributed.
3. ATH discounts unlock.
4. The ATH/TON pool launches.
5. Post-pool route evidence and pricing evidence are frozen.
6. Buyback split is enabled.

The pool starts from the reference price:

```text
1 ATH = 0.001 TON
```

Initial liquidity allocation:

```text
15,000,000 ATH
```

TON side at the launch price:

```text
15,000,000 ATH * 0.001 TON = 15,000 TON
```

The pool launches around a token that has already been distributed through application usage. This separates ATH from an empty listing without a user base.

## FeeAccumulator

TON protocol fees are collected in `FeeAccumulator`.

Before buyback split is enabled, all accumulated TON moves to the treasury bucket:

```text
accumulated_ton -> treasury_due_ton
```

`buyback_due_ton` does not grow before the split is enabled.

After `EnableBuybackSplit`, accumulated TON is split:

```text
50% -> treasury_due_ton
50% -> buyback_due_ton
```

If the amount is odd in nanotons, the remainder stays on the buyback side:

```text
treasury_amount = floor(amount * 50%)
buyback_amount = amount - treasury_amount
```

`EnableBuybackSplit` is a one-way action executed by the immutable treasury receiver after pool launch and buyback route freeze.

## Buyback and Burn

Buyback is executed through `FeeAccumulator` and `BuybackBurn`.

BuybackBurn accepts only a full execution envelope:

```text
51.05 TON
```

Envelope structure:

```text
50.00 TON  - STON.fi offer amount
1.00 TON   - route forward gas
0.05 TON   - pTON transfer gas
```

Raw `50 TON` is not a valid buyback chunk. Buyback is accepted only as a full route envelope.

After route freeze, BuybackBurn executes a buyback as follows:

1. Accepts `51.05 TON` only from the bound FeeAccumulator.
2. Records the amount in `reserve_due_ton`.
3. On `ExecuteBuybackChunk`, consumes one envelope.
4. Uses the frozen quote and frozen minOut.
5. Sets the STON.fi deadline internally.
6. Sends the route through the frozen pTON wallet.
7. Accepts ATH only through the official BuybackBurn ATH wallet.
8. Verifies that the source wallet matches the frozen STON.fi pool.
9. Sends the received ATH to burn through the official ATH wallet.
10. Completes the cycle only after `ATHBurnFinalized` from `ATHMaster`.

Buyback success is not defined by a router message. It is defined by actual ATH receipt in the official ATH wallet and burn finalization in ATHMaster.

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

A rejected mint creates refund due. This applies to invalid usernames, wrong price, duplicate name, item deploy bounce, and stale pending mint prune.

ATH from username mint becomes protocol revenue only after deployment of the corresponding item is confirmed.

## Profile Avatar Fees

Profile avatar update costs:

```text
100 ATH
```

The payment goes through the official ProfileRegistry ATH wallet.

ProfileRegistry accepts the update only when all conditions are met:

- amount is exactly `100 ATH`;
- sender is the official ProfileRegistry ATH wallet;
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

## Market Stability Seller

MarketStabilitySeller manages a separate reserve:

```text
60,000,000 ATH
```

This reserve exists to expand circulating ATH supply in a controlled way after pool launch. Its purpose is to distribute the token more broadly as demand grows while protecting the application economy during the early market phase.

ATH remains a utility token for Platho. It is used for discounts, names, profiles, and other application actions. If a small early community meets a rapidly rising market price, ATH becomes too expensive for its intended use. In that situation the token price rises on paper, but the application economy becomes worse: new users enter with more friction, paid features become heavier, and utility loses to speculation.

MarketStabilitySeller addresses this through a limited sale staircase. It does not fix the price forever and does not prevent market growth. It adds supply as demand appears, but does it step by step: each next part of the reserve is sold at a higher price.

The reserve is sold after post-pool pricing freeze.

Funding is accepted only:

- after seal;
- after pricing freeze;
- through the official seller ATH wallet;
- from the bound reserve funder;
- up to the total cap of `60,000,000 ATH`.

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

At the launch price `1 ATH = 0.001 TON`, the x1 price of one tranche is:

```text
3,000,000 ATH * 0.001 TON = 3,000 TON
```

Therefore:

| Tranche | Multiplier | Price for 3M ATH | Price per 1 ATH |
| ---: | ---: | ---: | ---: |
| 1 | x2 | 6,000 TON | 0.002 TON |
| 2 | x3 | 9,000 TON | 0.003 TON |
| 3 | x4 | 12,000 TON | 0.004 TON |
| ... | ... | ... | ... |
| 15 | x16 | 48,000 TON | 0.016 TON |
| ... | ... | ... | ... |
| 20 | x21 | 63,000 TON | 0.021 TON |

A single purchase cannot cross a tranche boundary. This prevents buying ATH from the next tranche at the previous tranche price.

TON revenue is recognized only after ATH is delivered to the buyer. If ATH transfer fails or bounces, the reserve is restored, the buyer receives the paid TON principal back, and treasury due does not increase.

After the final x21 tranche is sold, MarketStabilitySeller no longer regulates the ATH price. From that point, price is fully determined by the market: liquidity, demand, application usage, buyback pressure, and available supply.

Even at the x21 step, reference valuation remains moderate relative to the utility model:

```text
1 ATH = 0.021 TON
100,000,000 ATH = 2,100,000 TON
```

This is 21 times above launch valuation, while still leaving room for further growth without hidden internal reserves or additional minting. After x21, the protocol holds no separate reserve that can enter the market above users.

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

Outgoing internal transfers in ATHWallet are protected by source-side pending accounting and source acknowledgement. Balance is not restored from a bounce body without pending proof.

## ATH Lifecycle

1. `ATHMaster` creates fixed supply of `100,000,000 ATH`.
2. Treasury deploy one-shot receives supply in the treasury ATH wallet.
3. Supply is allocated across activity, liquidity, treasury, and market stability.
4. Users publish messages through Vault.
5. A successful publish credits `10 ATH` activity reward.
6. After the first `15,000,000 ATH` are distributed, ATH discounts unlock.
7. The ATH/TON pool launches at reference price `1 ATH = 0.001 TON`.
8. Post-pool route evidence and pricing evidence are frozen.
9. MarketStabilitySeller sells reserve through x2..x21 tranches.
10. After split is enabled, FeeAccumulator divides protocol TON fees between treasury and buyback.
11. BuybackBurn buys ATH with TON protocol fees and burns ATH through ATHMaster.
12. Username and profile fees create ATH treasury due and ATH burn due.
13. Total supply gradually decreases through authenticated burns.

## Final Model

ATH connects four layers of Platho:

1. **Application usage** - messages create activity rewards.
2. **Paid features** - usernames and avatars require ATH.
3. **Discounts** - ATH balance reduces protocol fee after the distribution gate.
4. **Supply reduction** - part of ATH fees and buyback output is burned through ATHMaster.

The model begins with fixed supply and reference valuation of `100,000 TON`. The primary user distribution is tied to the price of an action: `0.01 TON` for a standard message and `10 ATH` reward. After the first 15% of supply is distributed, the pool launches, discounts unlock, and the buyback path opens.

ATH exists as a working token inside Platho: it is distributed through activity, used in paid actions, reduces protocol fee, is sold from reserve through a defined staircase, and is burned through on-chain burn. After the market-stability staircase, the future ATH price is determined by the market and protocol usage.
