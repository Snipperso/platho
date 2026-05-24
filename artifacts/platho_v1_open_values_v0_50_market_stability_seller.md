# Platho v1 Open Values v0.50 - Market Stability Seller

Status: implemented-subset contract added; production use remains blocked until final pool-launch pricing evidence and reserve funding proof are archived.

## Purpose

The market stability reserve is an explicit non-founder release valve for post-launch demand. It is designed to add ATH supply only when buyers are willing to pay milestone prices from the initial official ATH/TON pool price.

The seller does not route through STON.fi. It sells ATH directly at fixed tranche floor prices. If the live pool is trading above a tranche floor, arbitrageurs or users can buy from the seller and move ATH into the market. If demand is not strong enough to clear the floor, the tranche stays unsold.

## Reserve

```text
Total reserve:     45,000,000 ATH
Tranche count:     15
Tranche size:       3,000,000 ATH
Multipliers:        x2 through x16
Founder grant:      0 ATH
```

## Contract Model

`MarketStabilitySeller` owns no discretionary sale key after seal.

Operational custody:

- ATH reserve sits in the official `ATHWallet(owner = MarketStabilitySeller)`.
- Reserve funding is accepted only from the bound reserve funder ATH owner.
- Buyers pay TON directly to `MarketStabilitySeller`.
- Successful ATH delivery creates `treasury_due_ton`.
- Permissionless flush sends treasury TON to the immutable treasury receiver.

The contract uses existing ATH wallet mechanics:

- `AthTransferNotification` to accept reserve funding;
- `AthTransferNotificationAck` to clear the official wallet pending notification;
- `ATHTransferRequest` to deliver sold ATH;
- `ATHTransferAck`, `ATHTransferFailed`, and bounced request recovery to finalize or restore state.

## Release Gates

The seller may be sealed before the official pool exists. In that inert state, the one-time launch controller hash remains present only so pricing can be frozen after pool-launch evidence exists. No reserve funding or sale is accepted before pricing is frozen.

Before reserve use:

- the final official ATH/TON pool launch price must be captured;
- `base_tranche_price_nanotons` must be frozen either before seal or by the one-time post-seal launch controller while seller reserve/sales state is still zero;
- post-seal pricing freeze must clear the launch controller hash;
- if the seller is sealed before pricing, final genesis evidence must prove the retained launch controller hash matches the manifest controller address;
- the seller official ATH wallet must be funded with the 45,000,000 ATH reserve through authenticated ATH notification before sales;
- the deployed code hash, StateInit hash, official ATH wallet address, reserve funder, treasury receiver, and pricing evidence hash must be archived.

No post-seal price mutation, admin sale override, pause, upgrade, rescue, or governance path exists.
