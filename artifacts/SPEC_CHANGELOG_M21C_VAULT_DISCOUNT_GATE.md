# SPEC CHANGELOG M21C - Vault message discount gate

## Changed

- Vault message protocol-fee discounts are locked until the 15% activity-distribution / pool-launch gate.
- The gate is derived from existing Vault airdrop accounting:

```text
message_discount_unlocked =
  airdrop_remaining_ath <= 15,000,000 ATH
```

- Before the gate:

```text
discounted_fee(owner, full_fee) = full_fee
```

- After the gate, the existing ATH discount curve applies:

```text
discount_base = 10,000 ATH
user_ath = min(user.ath_balance, discount_base)
discounted_fee = ceil(full_fee * (discount_base - user_ath) / discount_base)
```

## Rationale

The first `15,000,000 ATH` activity rewards are the liquidity-bootstrap phase.
Users still mine ATH through paid messages, but those ATH do not reduce message protocol fees until the official pool-launch threshold is reached.

This keeps early protocol TON available for liquidity reserve / treasury instead of allowing heavily discounted mining before the pool exists.

## PWA

The PWA mirrors the on-chain rule:

- if Vault global airdrop state is unavailable, message discounts are treated as locked;
- the composer shows `ATH discount 0% (locked until 15%)`;
- after the on-chain threshold is visible, normal ATH discount display and pricing resume.

## Unchanged

- Activity reward remains `10 ATH` per successful paid publish.
- Total activity airdrop remains `15,000,000 ATH`.
- Username/profile ATH utility is not changed by this gate.
- FeeAccumulator buyback split remains separately gated by M21B.
