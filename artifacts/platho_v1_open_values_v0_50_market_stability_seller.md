# Platho v1 Open Values v0.50 - Market Stability Seller

Status: implemented-subset contract added; production use remains blocked until final pool-launch pricing evidence and reserve funding proof are archived.

## Purpose

The market stability reserve is an explicit release valve for post-launch demand. It is designed to add ATH supply only when buyers are willing to pay milestone prices from the initial official ATH/TON pool price.

The seller does not route through STON.fi. It sells ATH directly at fixed tranche floor prices. If the live pool is trading above a tranche floor, arbitrageurs or users can buy from the seller and move ATH into the market. If demand is not strong enough to clear the floor, the tranche stays unsold.

## Reserve

```text
Total reserve:     60,000,000 ATH
Tranche count:     20
Tranche size:       3,000,000 ATH
Multipliers:        x2 through x21
```

## Contract Model

`MarketStabilitySeller` owns no discretionary sale key after seal.

Operational custody:

- ATH reserve sits in the official `ATHWallet(owner = MarketStabilitySeller)`.
- Reserve funding is accepted only from the bound reserve funder ATH owner.
- Buyers pay TON directly to `MarketStabilitySeller`.
- Successful ATH delivery creates `treasury_due_ton`.
- Permissionless flush sends treasury TON to the immutable treasury receiver.
- Sellable reserve is bounded by `reserve_due_ath`, not by raw official wallet balance.
- Manual ordinary ATH transfer to the official seller wallet is unsupported; unsolicited ATH sent this way is not tracked reserve, does not expand sellable supply, and can remain stuck.
- Partial reserve funding and partial sales are valid runtime states, but they are not full-launch readiness.

The contract uses existing ATH wallet mechanics:

- `AthTransferNotification` to accept reserve funding;
- `AthTransferNotificationAck` to clear the official wallet pending notification;
- `ATHTransferRequest` to deliver sold ATH;
- `ATHTransferAck`, `ATHTransferFailed`, and bounced request recovery to finalize or restore state.

## Release Gates

The seller may be sealed before the official pool exists. In that inert state, the one-time launch controller hash remains present only so pricing can be frozen after pool-launch evidence exists. No reserve funding or sale is accepted before pricing is frozen.

Before reserve use:

- the final official ATH/TON pool launch price must be captured;
- `base_tranche_price_nanotons` must exactly equal `evidence_x1_tranche_quote_nanotons` and be frozen either before seal or by the one-time post-seal launch controller while seller sales state is still zero (the `60,000,000 ATH` reserve is genesis-funded and locked, not zero, at freeze);
- post-seal pricing freeze must clear the launch controller hash;
- if the seller is sealed before pricing, final genesis evidence must prove the retained launch controller hash matches the manifest controller address;
- the seller official ATH wallet must be funded with the full 60,000,000 ATH reserve through authenticated ATH notification before production readiness;
- readiness must prove `reserve_due_ath == 60,000,000 ATH`, `reserve_funded_total_ath == 60,000,000 ATH`, and official seller ATH wallet backing of at least 60,000,000 ATH;
- official seller ATH wallet balance above 60,000,000 ATH is a readiness warning only; it is not treated as extra reserve;
- the deployed code hash, StateInit hash, official ATH wallet address, reserve funder, treasury receiver, and pricing evidence hash must be archived.
- `npm.cmd run market-stability:readiness` must pass against the post-pool getter snapshot before the first reserve sale is treated as production-ready.

`market-stability:readiness` is not a substitute for the full final genesis verifier. The intended release order is:
`mainnet:genesis:verify` PASS (certifying the genesis reserve funded via authenticated reserve funding), post-pool pricing freeze, then seller readiness PASS.

Pricing freeze is a real one-time launch authority. It sets the base tranche price once from pool-launch evidence and clears the launch controller hash. No post-freeze price mutation, admin sale override, pause, upgrade, rescue, or governance path exists.
This is still an authority and must be named as such in release docs.
