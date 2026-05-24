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
- Sells ATH directly to buyers at frozen tranche floor prices x2..x16.
- Requires buyer-funded local reserve and downstream ATH transfer value.
- Finalizes sale only after recipient ATH wallet ACK.
- Restores ATH reserve and refunds buyer principal on transfer fail/bounce.
- Flushes TON proceeds only to immutable treasury.

## Not Added

- No DEX route.
- No oracle read.
- No admin sale override.
- No pause, rescue, upgrade, governance, or post-seal pricing mutation.
- No reserve funding or sale before pricing is frozen.
