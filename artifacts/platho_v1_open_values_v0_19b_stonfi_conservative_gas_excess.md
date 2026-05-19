# Platho v1 Open Values Profile Update v0.19B

**Status:** draft, not final route freeze  
**Scope:** STON.fi v2.1 conservative gas/excess profile for future BuybackBurn  
**Rule:** this profile does not unblock production BuybackBurn until real ATH/TON route addresses, liquidity quote policy, and live route behavior are pinned.

## Conservative buyback route funding

```text
BUYBACK_OFFER_AMOUNT_TON = 50 TON = 50_000_000_000 nanotons
STONFI_SDK_DEFAULT_ROUTER_FORWARD_GAS = 0.3 TON = 300_000_000 nanotons
STONFI_SDK_DEFAULT_PTON_TRANSFER_GAS = 0.01 TON = 10_000_000 nanotons
BUYBACK_ROUTE_FORWARD_GAS = 1.00 TON = 1_000_000_000 nanotons
BUYBACK_PTON_TRANSFER_GAS = 0.05 TON = 50_000_000 nanotons
BUYBACK_TOTAL_STONFI_SEND_VALUE = 51.05 TON = 51_050_000_000 nanotons
```

`BUYBACK_OFFER_AMOUNT_TON` is the amount offered to the STON.fi swap.
`BUYBACK_ROUTE_FORWARD_GAS` and `BUYBACK_PTON_TRANSFER_GAS` are conservative route funding values.

The contract MUST NOT reduce the offer amount to pay route gas.

```text
pton.ton_amount == 50 TON
swap.details.min_ask_amount == dex_min_out
message.value == 51.05 TON
```

## Refund / excess routing

All STON.fi/pTON refund and excess routes MUST point to BuybackBurn:

```text
pTON ton-transfer refund_address = BuybackBurn
STON.fi swap refund_address = BuybackBurn
STON.fi swap excesses_address = BuybackBurn
```

No executor, user wallet, treasury, or arbitrary sender address may receive STON.fi route excess/refund in v1.

## Success signal

A successful buyback is not proven by a router payload or excess/refund message.

The only success chain for future BuybackBurn is:

```text
ATH received by official BuybackBurn ATH wallet
-> BuybackBurn accepts notification only from official ATH wallet
-> BuybackBurn burns ATH
-> ATH Master sends ATHBurnFinalized
-> BuybackBurn clears pending state
```

## Remaining blockers

```text
ATH_MASTER_ADDRESS final deployment address
STONFI_ROUTER_ADDRESS selected production v2 router address
STONFI_POOL_ADDRESS_TON_ATH selected TON/ATH pool address
STONFI_PTON_ADDRESS / pTON wallet route address for selected router
STONFI_VAULT_ADDRESS if selected route requires it
BUYBACK_MIN_ATH_OUT_PER_50_TON from liquidity/route tests
live-route proof that overfunded excess/refund returns to BuybackBurn
```

Until these are pinned, BuybackBurn implementation remains blocked.
