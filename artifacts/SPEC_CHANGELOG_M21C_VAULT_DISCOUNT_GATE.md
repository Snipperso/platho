# SPEC CHANGELOG M21C - Vault message discount gate

## Changed

- Vault message protocol-fee discounts are locked until the full activity airdrop has been distributed.
- The gate is derived from existing Vault airdrop accounting:

```text
message_discount_unlocked =
  airdrop_remaining_ath == 0 ATH
```

- Before the gate:

```text
discounted_fee(owner, full_fee) = full_fee
```

- After the gate, the existing ATH discount curve applies:

```text
discount_base = 10,000 ATH
user_ath = min(user.ath_balance, discount_base)
raw_discounted_fee = ceil(full_fee * (discount_base - user_ath) / discount_base)
discounted_fee = raw_discounted_fee
```

At current constants, the full protocol fee is `0.010 TON` (`10,000,000 nanotons`) for both public and private capsules, and the maximum reduction is `0.010 TON` per capsule.

## Rationale

The full `15,000,000 ATH` activity rewards are the liquidity-bootstrap phase.
Users still earn ATH through paid messages, but those ATH do not reduce message protocol fees until the remaining activity airdrop is exactly zero.

This keeps early protocol TON available for liquidity reserve / treasury instead of allowing heavily discounted mining before the pool exists.

## PWA

The PWA mirrors the on-chain rule:

- if Vault global airdrop state is unavailable, message discounts are treated as locked;
- the composer says the ATH protocol-fee discount is locked until the activity airdrop is fully distributed;
- after the on-chain threshold is visible, normal ATH protocol-fee discount display and pricing resume, including the full protocol-fee discount at the `10,000 ATH` threshold.

## Unchanged

- Activity reward remains `10 ATH` per successful paid publish.
- Total activity airdrop remains `15,000,000 ATH`.
- Username/profile ATH utility is not changed by this gate.
- FeeAccumulator buyback split remains separately gated by M21B.
