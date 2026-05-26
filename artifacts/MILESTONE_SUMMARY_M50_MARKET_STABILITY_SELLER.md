# M50 - Market Stability Seller

Status: implemented and manifest-pinned.

## Summary

M50 adds `MarketStabilitySeller`, an immutable direct ATH seller for the final `60%` market stability reserve.

The seller releases ATH in twenty `3,000,000 ATH` tranches at x2 through x21 from the initial official ATH/TON pool price. It does not depend on a DEX route or oracle. Buyers must pay the configured floor price directly; if the market never supports that price, the tranche remains unsold.

## Money Invariants

- Total accepted reserve funding is capped at `60,000,000 ATH`.
- Reserve funding is counted only through authenticated ATH notification from the bound reserve funder notify-flow.
- A single sale can consume only the current tranche remainder.
- Buyer TON principal becomes `treasury_due_ton` only after recipient ATH wallet ACK.
- Failed or bounced ATH transfer restores `reserve_due_ath` and refunds buyer principal.
- Treasury TON flush goes only to the immutable treasury receiver.
- Seller sales are bounded by `reserve_due_ath`, not by raw official wallet balance.
- Manual ordinary ATH transfer to the official seller wallet is unsupported. Unsolicited excess ATH sent this way is not tracked reserve, can remain stuck, and is treated by readiness as a warning rather than sellable supply.
- Partial reserve funding and partial sales are valid runtime states, but they are not full-launch readiness. Readiness must require `reserve_due_ath == 60,000,000 ATH`, `reserve_funded_total_ath == 60,000,000 ATH`, and official seller ATH wallet backing of at least `60,000,000 ATH`.

## Genesis Invariants

- Reserve funder, official ATH wallet, and TON treasury receiver are bound before seal.
- Official ATH wallet must equal deterministic `ATHWallet(owner = MarketStabilitySeller, master = ATHMaster)`.
- Pricing may be frozen before seal or once after seal while reserve, treasury, and sale state are still zero.
- Frozen `base_tranche_price_nanotons` must exactly equal the captured `evidence_x1_tranche_quote_nanotons`; underpriced base values are rejected.
- Seal clears the genesis controller hash only if pricing was already frozen; otherwise the post-pool pricing freeze clears it.
- Final genesis evidence must prove any retained post-pool launch controller hash matches the manifest controller address.
- Pricing freeze is a real one-time launch authority: it sets the base tranche price once, then no price mutation, admin override, pause, rescue, upgrade, or governance path remains.
- MarketStabilitySeller readiness is post-pool and supplemental. It must run only after `mainnet:genesis:verify` has passed, pricing has been frozen, and reserve funding has occurred; it is not a standalone replacement for final genesis verification.

## Verification

Focused coverage:

```text
tests/market-stability-seller.test.ts
tests/deployment-manifest-m15.test.ts
tests/storage-topup-abi.test.ts
tests/m16-conformance-static.test.ts
tests/mainnet-genesis-verify.test.ts
```

Build artifact:

```text
MARKET_STABILITY_SELLER_CODE_HASH
```
