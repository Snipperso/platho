# SPEC CHANGELOG - M50 Market Stability Seller

## Added

- `contracts/MarketStabilitySeller.tact`.
- `MarketStabilitySeller` build target.
- `MARKET_STABILITY_SELLER_CODE_HASH` artifact.
- Implemented-subset deployment manifest fields for:
  - seller address;
  - seller official ATH wallet;
  - reserve funder;
  - TON treasury receiver;
  - code hash;
  - StateInit hashes.

## Behavior

- Accepts reserve ATH only through the official seller ATH wallet and only from the bound reserve funder domain.
- Can seal in an inert pre-pool state and freeze pricing exactly once later while reserve/sales state is still zero.
- Requires frozen base tranche price to exactly match the captured x1 launch-price evidence.
- Sells ATH directly to buyers at frozen tranche floor prices x2..x21.
- Requires buyer-funded local reserve and downstream ATH transfer value.
- Finalizes sale only after recipient ATH wallet ACK.
- Restores ATH reserve and refunds buyer principal on transfer fail/bounce.
- Flushes TON proceeds only to immutable treasury.
- Bounds sales by tracked `reserve_due_ath`, not by raw official wallet balance.
- Treats unsolicited excess ATH in the official seller wallet as unsupported donation dust: readiness may warn, but it is not sellable reserve and can remain stuck.

## Not Added

- No DEX route.
- No oracle read.
- No admin sale override.
- No pause, rescue, upgrade, governance, or post-freeze pricing mutation.
- No reserve funding or sale before pricing is frozen.
