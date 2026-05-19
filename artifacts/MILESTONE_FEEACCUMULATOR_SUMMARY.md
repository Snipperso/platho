# Platho FeeAccumulator milestone 1: due-bucket split and flush proof

Scope implemented:

- `contracts/FeeAccumulator.tact`
- immutable `capsule_hub_address`
- immutable `treasury_receiver_address`
- immutable `buyback_burn_address`
- `OP_DEPOSIT_PROTOCOL_FEE(amount)`
- `OP_SPLIT_ACCUMULATED()`
- `OP_FLUSH_TREASURY_DUE(amount)`
- `OP_FLUSH_BUYBACK_DUE(amount)`
- `BuybackBurn.OP_ACCEPT_BURN_RESERVE(amount)` body emission
- bounce recovery for BuybackBurn due flush
- exact integer split and dust-to-buyback rule
- no empty fallback behavior

Explicitly not implemented:

- CapsuleHub
- Vault
- BuybackBurn execution / STON.fi route
- UsernameRegistry
- Treasury receiver contract implementation
- deployment/seal checks
- storage reserve top-up profile
- admin/owner override/pause/upgrade/governance/rescue/fallback paths

Commands run:

```bash
npm run build
npm test -- --reporter=verbose
npm audit --omit=dev
```

Results:

```text
FeeAccumulator code hash = 23447916ab0d350b57f394172b7c57cdfa228f1bdd0811fa022051df678f3fff
vitest: 3 test files passed, 14 tests passed
npm audit --omit=dev: 0 vulnerabilities
```

FeeAccumulator tests covered:

```text
FEE-01: accepts protocol fee deposit only from immutable CapsuleHub and accounted principal must be funded
FEE-DUE-01/01A/01B: split is internal only, exact in nanotons, dust goes to buyback
FEE-DUE-05: treasury flush uses immutable terminal receiver and debits treasury_due_ton by requested amount
FEE-DUE-06: buyback flush bounce restores buyback_due_ton
FEE-DUE-07: buyback flush to deployed receiver is not treated as treasury final profile
NO-ADMIN: empty fallback rejected and cannot mutate accounting
```

Important implementation note:

`OP_DEPOSIT_PROTOCOL_FEE(amount)` accounts `amount` as principal and requires inbound message value to be at least `amount`. Extra inbound value is treated as execution/storage reserve. This is the practical TON gas-compatible interpretation of exact accounted protocol fee deposit.

