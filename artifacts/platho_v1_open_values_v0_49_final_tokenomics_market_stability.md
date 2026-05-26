# Platho v1 Open Values v0.49 - Final ATH Tokenomics and Market Stability Reserve

Status: allocation policy fixed. M50 adds the concrete immutable seller implementation for this policy.

## Fixed supply

ATH total supply remains fixed:

- `ATH_TOTAL_SUPPLY = 100,000,000 ATH`
- `ATH_DECIMALS = 9`
- `ATH_TOTAL_SUPPLY_ATOMIC = 100,000,000,000,000,000`

There is no mint-after-deploy mechanism.

## Final allocation

```text
Community activity airdrop:      15%   15,000,000 ATH
Initial liquidity:               15%   15,000,000 ATH
Treasury / operations:           10%   10,000,000 ATH
Market stability reserve:        60%   60,000,000 ATH
Founder allocation:               0%            0 ATH
TOTAL:                          100%  100,000,000 ATH
```

The allocation intentionally removes founder-token grants. Founder/team upside from ATH reserve flow exists only if the token reaches market milestones and reserve tranches execute under the market-stability policy.

There is no bug-bounty token reserve in this fixed allocation. Contract immutability means bug bounty commitments, if any, should be funded from treasury / operations rather than a protocol token bucket that expects post-deploy contract changes.

## Market stability reserve

The market stability reserve is designed to add ATH liquidity into strong post-launch demand instead of letting early thin liquidity make protocol utility prices unusable.

The reserve is not a discretionary founder wallet, partnership budget, or manual market-dump bucket.

Reserve size:

```text
60,000,000 ATH
60% of fixed supply
```

Tranche policy:

```text
x2  initial pool price: 3,000,000 ATH
x3  initial pool price: 3,000,000 ATH
x4  initial pool price: 3,000,000 ATH
x5  initial pool price: 3,000,000 ATH
x6  initial pool price: 3,000,000 ATH
x7  initial pool price: 3,000,000 ATH
x8  initial pool price: 3,000,000 ATH
x9  initial pool price: 3,000,000 ATH
x10 initial pool price: 3,000,000 ATH
x11 initial pool price: 3,000,000 ATH
x12 initial pool price: 3,000,000 ATH
x13 initial pool price: 3,000,000 ATH
x14 initial pool price: 3,000,000 ATH
x15 initial pool price: 3,000,000 ATH
x16 initial pool price: 3,000,000 ATH
x17 initial pool price: 3,000,000 ATH
x18 initial pool price: 3,000,000 ATH
x19 initial pool price: 3,000,000 ATH
x20 initial pool price: 3,000,000 ATH
x21 initial pool price: 3,000,000 ATH
```

Total released if all milestones execute:

```text
20 tranches * 3,000,000 ATH = 60,000,000 ATH
```

Price multipliers are measured from the initial official ATH/TON pool price recorded at pool launch. A tranche should not be released below its configured multiplier floor.

TON proceeds from executed reserve sales go to treasury / operations. Treasury use is an off-chain allocation decision; the on-chain invariant is only that ATH reserve release is milestone-gated and non-founder by default.

## Implementation boundary

M49 fixes allocation policy. M50 implements the separate immutable market-stability seller contract for that policy.

Before the reserve is used operationally, final pool-launch pricing evidence, seller code hash, official seller ATH wallet funding proof, and deployment manifest evidence must be archived. Until then, reserve ATH should remain inert in treasury custody and must not be treated as an active protocol mechanism.
