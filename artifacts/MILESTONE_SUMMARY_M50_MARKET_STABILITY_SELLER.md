# M50 - Market Stability Seller

Status: implemented and manifest-pinned.

## Summary

M50 adds `MarketStabilitySeller`, an immutable direct ATH seller for the final `45%` market stability reserve.

The seller releases ATH in fifteen `3,000,000 ATH` tranches at x2 through x16 from the initial official ATH/TON pool price. It does not depend on a DEX route or oracle. Buyers must pay the configured floor price directly; if the market never supports that price, the tranche remains unsold.

## Money Invariants

- Total accepted reserve funding is capped at `45,000,000 ATH`.
- A single sale can consume only the current tranche remainder.
- Buyer TON principal becomes `treasury_due_ton` only after recipient ATH wallet ACK.
- Failed or bounced ATH transfer restores `reserve_due_ath` and refunds buyer principal.
- Treasury TON flush goes only to the immutable treasury receiver.

## Genesis Invariants

- Reserve funder, official ATH wallet, TON treasury receiver, and pricing evidence are bound before seal.
- Official ATH wallet must equal deterministic `ATHWallet(owner = MarketStabilitySeller, master = ATHMaster)`.
- Pricing must be frozen before seal.
- Seal clears the genesis controller hash.

## Verification

Focused coverage:

```text
tests/market-stability-seller.test.ts
tests/deployment-manifest-m15.test.ts
tests/storage-topup-abi.test.ts
tests/m16-conformance-static.test.ts
```

Build artifact:

```text
MARKET_STABILITY_SELLER_CODE_HASH
```

