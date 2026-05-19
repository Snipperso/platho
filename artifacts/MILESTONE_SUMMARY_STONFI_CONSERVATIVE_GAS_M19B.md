# M19B: STON.fi Conservative Gas / Excess Profile

M19B adds a conservative draft funding profile for future BuybackBurn.

## Result

```text
BUYBACK_OFFER_AMOUNT_TON = 50 TON
BUYBACK_ROUTE_FORWARD_GAS = 1.00 TON
BUYBACK_PTON_TRANSFER_GAS = 0.05 TON
BUYBACK_TOTAL_STONFI_SEND_VALUE = 51.05 TON
```

All refund/excess addresses must be BuybackBurn.

## Important

M19B does not implement BuybackBurn and does not mark the STON.fi route as final. The production route remains blocked until real ATH/TON route addresses, quote policy, and live route behavior are pinned.

## Tests

```text
M19B-01 conservative overfunding preserves exact 50 TON offer and dex_min_out
M19B-02 overfunding changes total message value but not payload identity
M19B-03 refund/excess leak to non-BuybackBurn address is rejected
```
