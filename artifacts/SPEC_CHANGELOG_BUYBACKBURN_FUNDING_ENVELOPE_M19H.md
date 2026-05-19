# Spec Changelog — M19H BuybackBurn Funding Envelope

## Accepted freeze-candidate clarification

M19B introduced conservative STON.fi route gas:

```text
50 TON offer + 1.05 TON route gas = 51.05 TON total route send value
```

M19H clarifies the upstream funding consequence:

```text
FeeAccumulator must fund a complete buyback execution envelope of 51.05 TON.
```

The future BuybackBurn must still use exactly 50 TON as the STON.fi offer amount. The extra 1.05 TON is route execution funding only.

## Why this matters

If FeeAccumulator sends only 50 TON to BuybackBurn, BuybackBurn cannot execute a conservative 50 TON STON.fi swap without either:

1. underfunding the route, or
2. reducing the offer principal below 50 TON.

Both are forbidden for v1.

## Contract status

No production contract logic changed in M19H. This milestone adds a profile, a generator, and conformance tests.
