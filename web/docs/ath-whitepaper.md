# ATH Whitepaper

## The Platho Protocol Token

ATH is the utility token of Platho. It is used for activity rewards, post-airdrop protocol-fee discounts, `.ath` usernames, profile avatar updates, market-stability sales, buyback, and burn.

ATH is not an administrative token. It grants no power to rewrite balances, pause operations, issue new supply, or change what users own. Its role is to power the app's economy and tie the use of Platho to on-chain accounting.

This document describes the ATH model in Platho.

## Core Parameters

ATH has a fixed total supply:

```text
100,000,000 ATH
```

Reference launch price:

```text
1 ATH = 0.001 GRAM
```

Fully diluted valuation at launch:

```text
100,000,000 ATH * 0.001 GRAM = 100,000 GRAM
```

ATH starts from a reference capitalisation of `100,000 GRAM`.

## Fixed Supply

ATH is issued by the `ATHMaster` contract. On initialisation, `ATHMaster` sets the fixed total supply to `100,000,000 ATH`.

There is no post-genesis mint function. `ATHMaster` implements no administrative minting, pause, blacklist, transfer tax, forced transfer, or emergency withdrawal.

The primary supply issuance happens once, through `DeployTreasurySupply`. It sends the entire supply to the treasury ATH wallet. Genesis issuance cannot be repeated.

Total supply decreases only through burning. `ATHMaster` accepts a burn only after an authenticated burn notification from the deterministic ATH wallet of the owner address. Once verified, `ATHMaster` reduces `total_supply` and sends `ATHBurnFinalized`.

Burning ATH is a real reduction of total supply, not a transfer to an unused address.

## Supply Allocation

The ATH supply is allocated across four categories:

| Category | Share | Amount |
| --- | ---: | ---: |
| Activity airdrop | 15% | 15,000,000 ATH |
| Initial liquidity | 15% | 15,000,000 ATH |
| Long-term protocol vesting | 10% | 10,000,000 ATH |
| Market stability reserve | 60% | 60,000,000 ATH |

This allocation sets the economic structure of Platho:

- 15% of the supply is distributed to users through activity in the app before the pool launches.
- 15% of the supply is used for initial liquidity.
- 10% of the supply is locked in immutable long-term vesting.
- 60% of the supply is funded into MarketStabilitySeller and locked at genesis, then sold in tranches above the launch price after the post-pool pricing freeze.

At final genesis the activity airdrop and the long-term vesting reserve are backed by the official ATH wallets of AirdropPool and ATHVesting, and the release verifier checks those balances before a production release. The `60,000,000 ATH` market-stability reserve is funded into MarketStabilitySeller and locked at final genesis, backed by its official seller ATH wallet, and the release verifier checks that backing before a production release. The reserve is capitalised from the start, but it is not sold until the pool launches, when a one-time evidence-bound pricing freeze sets the base tranche price.

## Long-Term Protocol Vesting

The long-term vesting reserve is:

```text
10,000,000 ATH
```

It is held in `ATHVesting`, not in a mutable treasury bucket. The vesting schedule is fixed in the contract:

```text
100,000 ATH per 365-day period
100 periods
10,000,000 ATH total
```

Anyone may trigger a payout claim once ATH has vested, but the beneficiary is immutable. The contract has no acceleration, beneficiary change, pause, administrative withdrawal, emergency exit, or discretionary release.

At final genesis the official `ATHWallet(owner = ATHVesting, master = ATHMaster)` must hold exactly `10,000,000 ATH`. The verifier also requires zero claimed ATH, an idle phase, and no pending transfers before launch.

This reserve is deliberately slow. It creates a long horizon for protocol development without placing a liquid 10M ATH bucket over the market at launch.

## Activity Airdrop

The activity airdrop is:

```text
15,000,000 ATH
```

Reward per successful publish:

```text
10 ATH
```

Every accepted capsule earns the sender `10 ATH`, the same on every lane. A failed publish attempt earns nothing.

Payout runs in batches rather than per capsule. Every delivery carries a fixed unrecoverable cost of roughly
`0.0166 GRAM`, and that cost does not depend on how much ATH the delivery carries. Paying out after every capsule would
cost more than those capsules collect in protocol fees, so the reward accumulates and arrives in one payment.

The airdrop is backed by the official ATH wallet of `AirdropPool`, which is where those `15,000,000 ATH` sit. When they
run out, activity rewards stop.

## Activity Price

Messages start from the current base price:

```text
0.0191 GRAM
```

Current exact figures before the ATH discount:

```text
private message:  0.0191 GRAM
first contact:    0.0178 GRAM
public post:      0.0203 GRAM
```

For a successful publish the user receives:

```text
10 ATH
```

At the reference launch price:

```text
10 ATH * 0.001 GRAM = 0.01 GRAM
```

This ties early ATH distribution to real use of the app. The reward is an activity bonus, not a refund, cashback, discount, or a promise that ATH offsets the GRAM cost of publishing. The reference launch value of `10 ATH` may be lower than the GRAM cost of a capsule, and that is deliberate: users receive early network ownership for real use, not a guaranteed reimbursement.

Capsule pricing: a public post from `0.0203 GRAM`, a private capsule from `0.0191 GRAM`. Larger public or private capsule blocks cost more, because the chosen body of 1, 2, 4, 8, 16, or 32 KiB changes the execution and storage reserve in the shard. The reward stays `10 ATH` per successfully finalised capsule, whatever the capsule size.

A private publish uses the hybrid security profile by default: X25519 + ML-KEM-768 + AES-GCM. There is no cheaper classical mode for private messages.

ATH may trade above or below the reference launch price once the official pool exists. The activity reward is not an investment return, an expectation of profit, or a price guarantee.

## Protocol Fee and User Price

The protocol fee is separate from the full cost to the user.

Protocol fee:

| Publish type | Protocol fee |
| --- | ---: |
| Public post | 0.010 GRAM |
| Hybrid private message | 0.010 GRAM |

The price to the user covers the protocol fee, the gas, and the endowment for storing the entry in its shard:

| Publication | Attached |
| --- | ---: |
| Private message | 0.0191 GRAM |
| First contact | 0.0178 GRAM |
| Public post or comment | 0.0203 GRAM |
| Avatar update | 0.0395 GRAM |
| Account activation | 0.0600 GRAM |

The client always attaches the larger of the two figures — the one needed to create the shard. The surplus is not lost: the shard keeps exactly what it needs and returns the remainder to the sender. If the network estimate comes back higher than expected, the client adds a margin on top; that is a margin rather than a payment, and it too is returned. ATH discounts apply to the protocol fee, not to network costs or storage reserves.

## ATH Discounts

ATH reduces message protocol fees once the activity airdrop has been fully distributed.

Discounts unlock only when the remaining activity airdrop is:

```text
airdrop_remaining_ath == 0 ATH
```

Until that point the protocol fee is paid in full.

Full discount threshold:

```text
10,000 ATH
```

If the ATH balance in the user's own ATH wallet is at least `10,000 ATH`, the user reaches the full protocol-fee discount tier for the Platho fee component. Network costs and storage reserves are still paid.

Below `10,000 ATH` the fee decreases linearly:

```text
raw_discounted_fee = ceil(full_fee * (10,000 ATH - min(user_ath_balance, 10,000 ATH)) / 10,000 ATH)
discounted_fee = raw_discounted_fee
```

The calculation rounds up. With current constants the full protocol fee is `0.010 GRAM` (`10,000,000 nanotons`) for both public and private capsules, and the maximum reduction is `0.010 GRAM` per capsule.

## Pool Launch

The ATH/GRAM pool launches after the full `15,000,000 ATH` activity airdrop has been distributed.

Launch sequence:

1. Users receive ATH through real use of Platho.
2. The full activity airdrop is distributed.
3. ATH discounts unlock.
4. The ATH/GRAM pool launches.
5. Post-pool route evidence and pricing evidence are frozen.
6. The buyback split is enabled.

The pool starts from the reference price:

```text
1 ATH = 0.001 GRAM
```

Initial liquidity allocation:

```text
15,000,000 ATH
```

The GRAM side at the launch price:

```text
15,000,000 ATH * 0.001 GRAM = 15,000 GRAM
```

Protocol fees collected before the pool launch fund the full GRAM side of the initial liquidity. This is part of the launch bootstrap and does not turn activity rewards into a GRAM-denominated claim.

The pool launches around a token that has already been distributed through use of the app. That is what separates ATH from an empty listing with no user base.

## FeeAccumulator

GRAM protocol fees are collected in `FeeAccumulator`.

Before the buyback split is enabled, all accumulated GRAM moves into the treasury bucket:

```text
accumulated_ton -> treasury_due_ton
```

`buyback_due_ton` does not grow until the split is enabled.

After `EnableBuybackSplit` the accumulated GRAM is divided:

```text
50% -> treasury_due_ton
50% -> buyback_due_ton
```

If the nanoton amount is odd, the remainder stays on the buyback side:

```text
treasury_amount = floor(amount * 50%)
buyback_amount = amount - treasury_amount
```

`EnableBuybackSplit` is a one-way action performed by the immutable treasury recipient after the pool launch and the buyback route freeze. It is a real one-time power: it cannot steal funds, pause, exit in an emergency, or change addresses, but it permanently changes FeeAccumulator's economics from treasury-only bootstrap accumulation to a 50/50 treasury/buyback split. It is enabled only after the pre-release check passes.

Platho's release powers are deliberately narrow and mostly one-time. They do exist, and they should be named honestly: the treasury owner deploys the primary ATH supply once; the genesis controller performs the pre-seal binding and the seal; the BuybackBurn launch controller freezes the post-pool route once; the MarketStabilitySeller pricing freeze is performed once by its launch controller; and the FeeAccumulator treasury recipient enables the one-way buyback split after the pre-release check. None of these roles is an emergency exit, a pause, an upgrade, an administrative withdrawal, or arbitrary control over balances.

## Buyback and Burn

Buyback runs through `FeeAccumulator` and `BuybackBurn`.

BuybackBurn accepts only a complete executable envelope:

```text
51.05 GRAM
```

Envelope structure:

```text
50.00 GRAM  - STON.fi offer amount
1.00 GRAM   - route forward gas
0.05 GRAM   - pTON transfer gas
```

A bare `50 GRAM` is not a valid buyback chunk. A buyback is accepted only as a complete route envelope.

Once the route is frozen, BuybackBurn performs a buyback as follows:

1. Accepts `51.05 GRAM` only from the bound FeeAccumulator.
2. Records the amount in `reserve_due_ton`.
3. On `ExecuteBuybackChunk` consumes one envelope.
4. Uses the frozen quote and the frozen minOut.
5. Sets the STON.fi deadline internally.
6. Sends the route through the frozen pTON wallet.
7. Accepts ATH only through BuybackBurn's official ATH wallet.
8. Verifies that the source wallet matches the frozen STON.fi pool.
9. Sends the received ATH to be burned through the official ATH wallet.
10. Completes the cycle only after `ATHBurnFinalized` from `ATHMaster`.

Buyback success is not defined by a router message, an outgoing burn request, or an ATHWallet burn notification. It is defined only when BuybackBurn receives an authenticated `ATHBurnFinalized` from ATHMaster. Until that finalisation arrives, BuybackBurn must still be treated as a pending-burn or retry state; dashboards and indexers must not count ATH as burned merely because a burn attempt was sent.

If a burn does not finalise, the received ATH moves into retry due. `RetryAthBurnDue` burns the whole retry-due amount.

## Username Fees

Registering a `.ath` username is paid in ATH through UsernameRegistry's official ATH wallet.

Prices:

| Name length | Price |
| ---: | ---: |
| 4 characters | 10,000 ATH |
| 5 characters | 1,000 ATH |
| 6+ characters | 100 ATH |

UsernameRegistry accepts only the exact price. Underpayment and overpayment do not create a name.

An accepted mint passes through a pending state and deploys a `UsernameNFTItem`. The payment is not recognised as revenue until the item is confirmed. Once the item is confirmed the amount is split:

```text
50% -> treasury_due_ath
50% -> burn_due_ath
```

A username mint is paid in ATH from the user's own wallet. Rejections for an invalid name, a wrong price, or a duplicate name are returned to the owner through the ATHWallet notification-refund path. UsernameRegistry maintains no separate external refund bucket for names.

ATH from a username mint becomes protocol revenue only after deployment of the corresponding item is confirmed.

Username authority is split deliberately: `UsernameRegistry` anchors the name to one exact `UsernameNFTItem`, and the item's state carries the current owner. Transferring the item transfers the name. The item provides standard NFT data and on-chain TEP-64 metadata, including `name = <username>.ath`; it does not depend on a Platho server for metadata. Name bytes are literal and are not normalised for display: names with leading, trailing, consecutive, or all-separator characters are valid as long as every byte is in the allowed set `a-z`, `0-9`, `_`, `-` and the length is 4..16. If an item deployment was attempted but the item ACK never reached the registry, `PrunePendingUsernameMint` is deliberately non-destructive: it does not guess failure, does not delete the pending state, and does not create refund due. The recovery path is a late `UsernameItemDeployedAck` or `UsernameNFTItem.ResendDeployedAck`, so an initialised item can still become authoritative. If an item deployment really does bounce, the registry asks the official ATH wallet to return the pending notification. The name-to-item anchor is the address derivation itself: `UsernameRegistry.get_username_item_address(name_hash)` yields the single address at which a name may live. A deployed `UsernameNFTItem` at any other address is not authoritative: clients, indexers, and UIs must not treat the item alone as ownership of the `.ath` name, and must not use the registry record's owner as the current owner after transfers.

## Profile Avatar Fees

The cost of a profile avatar update:

```text
100 ATH
```

An avatar update is paid in ATH from the user's own wallet: a transfer-with-notification from their ATH wallet to ProfileRegistry's official ATH wallet.

ProfileRegistry accepts an update only when every condition holds:

- the amount is exactly `100 ATH`;
- the sender is ProfileRegistry's official ATH wallet;
- the paying wallet is the owner's ATH wallet;
- the owner wallet is in the basechain;
- the avatar hash is non-zero;
- the stream id is non-zero;
- the part count is 1 to 16;
- the media format is WebP.

An accepted update creates a new avatar version and splits the fee:

```text
50 ATH -> treasury_due_ath
50 ATH -> burn_due_ath
```

A rejected avatar notification is returned through the ATHWallet notification-refund path. ProfileRegistry creates no separate refund bucket for malformed avatar updates.

ProfileRegistry prices and settles the payment but holds no profile state: the authenticated pointer to the avatar lives in the owner's own KeyShard. The image bytes live in PublicShard under the AVATAR domain; the client assembles the WebP from them or from a local cache and checks the bytes against the stored `avatar_hash`. Missing or truncated history is shown as unavailable.

## Market Stability Seller

MarketStabilitySeller is a public contract reserve that distributes ATH after the official pool launches:

```text
60,000,000 ATH
```

Its purpose is to reduce the early-market distortion caused by thin liquidity. At launch a small pool can be moved sharply by a small group of early buyers. When that happens, users who need ATH for real actions in Platho may be forced to buy into an artificial price spike.

MarketStabilitySeller creates a transparent supply ladder above the launch price. It sells ATH in fixed-size tranches. Each next tranche is more expensive than the previous one, and each tranche has a hard size limit. After the one-time evidence-bound pricing freeze, the tranche schedule is deterministic and cannot be changed by the team by hand.

If early speculators try to absorb a large amount of ATH, they buy from the public reserve at rising tranche prices instead of draining all the cheap liquidity from a thin pool and reselling it to users. If ordinary users need ATH for Platho, they can buy it at a known public tranche price without pushing a small pool vertically with a single wave of demand.

The reserve does not dump tokens on the market. It does not sell by itself and creates no sell pressure without demand. A sale happens only when a buyer voluntarily buys from the current tranche. With no demand, the reserve stays idle.

The on-chain utility of ATH is concrete:

- registering a `.ath` name is paid in ATH through UsernameRegistry;
- profile avatar pointer updates are paid in ATH through ProfileRegistry;
- ATH in the user's own wallet reduces the protocol fee on publications after the activity-distribution gate;
- accepted name and avatar fees create treasury due and burn due;
- BuybackBurn buys ATH with GRAM protocol fees and burns the received ATH through ATHMaster.

Publications are paid in GRAM straight from the wallet. ATH does not pay for the whole publish transaction. It reduces the protocol-fee component once the discount gate opens.

This ties ATH demand to specific protocol actions: `.ath` names, avatar updates, post-airdrop protocol-fee discounts, and buyback/burn pressure. MarketStabilitySeller expands available supply only as buyers take the next tranche, so early access is public and deterministic rather than dominated by a thin pool.

The reserve is sold only after the post-pool pricing freeze.

The pricing freeze is a real one-time launch power. It sets the base tranche price once from the pool-launch evidence, after which the launch controller hash is cleared. From then on MarketStabilitySeller cannot steal funds, pause sales, exit balances in an emergency, override buyers, or change the price schedule.

MarketStabilitySeller is capitalised at final genesis with the full `60,000,000 ATH` reserve, funded through the authenticated reserve-funding flow into the official seller ATH wallet, up to a hard cap of `60,000,000 ATH`. `mainnet:genesis:verify` checks that the seller carries the full reserve and that the backing of its official seller ATH wallet is at least `60,000,000 ATH` before a production release. An unsolicited ordinary ATH transfer into the official seller ATH wallet does not increase the accounted reserve, does not expand sellable supply, and may remain stuck; a wallet balance above `60,000,000 ATH` is treated as a warning rather than as extra reserve.

Selling is a separate post-pool step. The reserve is not sold before the pool launch, when the one-time evidence-bound pricing freeze sets the base tranche price; from then on the tranche schedule is deterministic and cannot be changed by the team by hand.

The reserve is split into 20 tranches:

```text
20 * 3,000,000 ATH = 60,000,000 ATH
```

Each tranche has a multiplier:

```text
x2, x3, x4, ..., x21
```

This creates a smooth price ladder. As the project grows more popular the market receives additional ATH supply, but each next tranche is more expensive than the previous one. Early demand does not hit a thin pool instantly, and the price rise does not turn into a vertical wall that makes a utility token awkward to use.

Purchase formula:

```text
price = ceil(base_tranche_price * current_multiplier * amount / 3,000,000 ATH)
```

`base_tranche_price` is frozen after the pool launch and matches the x1 pricing evidence exactly.

At the launch price of `1 ATH = 0.001 GRAM`, the x1 price of a single tranche is:

```text
3,000,000 ATH * 0.001 GRAM = 3,000 GRAM
```

Therefore:

| Tranche | Multiplier | Price per 3M ATH | Price per 1 ATH |
| ---: | ---: | ---: | ---: |
| 1 | x2 | 6,000 GRAM | 0.002 GRAM |
| 2 | x3 | 9,000 GRAM | 0.003 GRAM |
| 3 | x4 | 12,000 GRAM | 0.004 GRAM |
| ... | ... | ... | ... |
| 15 | x16 | 48,000 GRAM | 0.016 GRAM |
| ... | ... | ... | ... |
| 20 | x21 | 63,000 GRAM | 0.021 GRAM |

A single purchase cannot cross a tranche boundary. This prevents buying ATH from the next tranche at the previous tranche's price.

GRAM revenue is recognised only after the ATH has been delivered to the buyer. If the ATH transfer fails or bounces, the reserve is restored, the buyer gets back the GRAM principal they paid, and treasury due does not increase.

After the final x21 tranche is sold, MarketStabilitySeller no longer regulates the price of ATH. From that point the price is set entirely by the market: liquidity, available supply, demand for `.ath` names, avatar updates, post-airdrop protocol-fee discounts, and buyback/burn pressure.

Even at the x21 step the reference valuation stays moderate relative to the utility model:

```text
1 ATH = 0.021 GRAM
100,000,000 ATH = 2,100,000 GRAM
```

At the x21 step MarketStabilitySeller has completed its programmed reserve release. After that the price of ATH is set entirely by the market through liquidity, usage demand, available supply, and buyback/burn pressure. The only remaining protocol distribution is the slow long-term vesting schedule, capped at `100,000 ATH` per year.

## Treasury and Burn Buckets

UsernameRegistry and ProfileRegistry use the same ATH fee-split model:

```text
accepted ATH fee -> 50% treasury_due_ath + 50% burn_due_ath
```

Flushing treasury due sends ATH to the treasury recipient through the official ATH wallet.

Flushing burn due sends an ATH burn request through the official ATH wallet. Supply decreases only after the burn is finalised in ATHMaster.

Failure and bounce paths restore the due buckets. The accounting is preserved until the downstream transfer or burn completes.

## ATHWallet Accounting

ATH balances live in deterministic ATHWallet contracts.

ATHWallet handles:

- genesis supply crediting;
- an ordinary transfer;
- a transfer with notification;
- a username mint notification;
- a profile avatar notification;
- a burn request;
- a notification acknowledgement;
- pruning of a stale notification;
- recovery after a bounce or failure.

Contracts that accept ATH as payment do not accept direct messages from arbitrary addresses. They accept notifications only from their own official ATHWallet. Source-wallet authentication happens inside ATHWallet through deterministic wallet derivation.

ATH exposes TEP-74-like transfer entry points for generic jetton tooling, but Platho's protocol actions use authenticated ATH notification messages. External integrations must not assume that Platho notification flows emit a generic `JettonTransferNotification`.

Outgoing internal transfers in ATHWallet are protected by source-side pending accounting and a source-side acknowledgement. A balance is not restored from a bounce body without proof of a pending operation.

## ATH Lifecycle

1. `ATHMaster` creates the fixed supply of `100,000,000 ATH`.
2. A one-time treasury deployment receives the supply into the treasury ATH wallet.
3. The supply is allocated across activity, liquidity, long-term vesting, and market stability.
4. Users publish messages by paying directly from their own wallet.
5. A successful publish credits a `10 ATH` activity reward.
6. Once the full `15,000,000 ATH` activity airdrop is distributed and `airdrop_remaining_ath == 0`, ATH protocol-fee discounts unlock.
7. The ATH/GRAM pool launches at the reference price `1 ATH = 0.001 GRAM`.
8. Post-pool route evidence and pricing evidence are frozen.
9. MarketStabilitySeller sells the reserve through tranches x2..x21.
10. Once the split is enabled, FeeAccumulator divides GRAM protocol fees between treasury and buyback.
11. BuybackBurn buys ATH with GRAM protocol fees and burns ATH through ATHMaster.
12. Name and profile fees create ATH treasury due and ATH burn due.
13. Total supply gradually decreases through authenticated burns.

## Final Model

ATH ties four layers of Platho together:

1. **App usage** — messages create activity rewards.
2. **Paid features** — names and avatars require ATH.
3. **Discounts** — an ATH balance reduces the protocol fee after the distribution gate.
4. **Supply reduction** — part of the ATH fees and of the buyback result is burned through ATHMaster.

The model starts from a fixed supply and a reference valuation of `100,000 GRAM`. The primary distribution to users is tied to real paid usage: messages start from `0.0191 GRAM` — currently `0.0191 GRAM` for a private message and `0.0203 GRAM` for a public post — plus a `10 ATH` activity bonus per finalised capsule. Larger public or private size classes cost more. This bonus is not a refund, a reimbursement, or a promise of profit. After the first 15% of the supply is distributed, the pool launches, protocol-fee discounts unlock, and the buyback path opens.

ATH exists as a working token inside Platho: it is distributed through activity, used in paid actions, reduces the protocol fee, is sold from the reserve along a defined ladder, and is burned through on-chain burning. After the market-stability ladder, the future price of ATH is set by the market and by protocol usage.
