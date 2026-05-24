# FeeAccumulator Threat Model Checklist

Status: local engineering hardening pass, not an independent audit or formal proof.

Date: 2026-05-17

## Covered Locally

- Permissionless `DepositProtocolFee(amount)` principal accounting.
- Deposit reserve boundary: underfunded principal-plus-exec reserve is rejected.
- Split accounting: bootstrap mode sends 100% to treasury/liquidity; after one-way buyback enable it uses exact 50/50 integer split with dust to buyback.
- Buyback split enable is one-way and restricted to the immutable treasury receiver.
- Buyback split enable sweeps any pre-enable `accumulated_ton` into `treasury_due_ton` so unsplit bootstrap fees cannot become buyback due after the gate opens.
- Split reserve boundary: underfunded split cannot move accumulated principal into due buckets.
- Treasury flush reserve boundary and immutable terminal receiver routing.
- Buyback flush exact 51.05 TON envelope enforcement.
- Buyback flush reserve boundary: underfunded caller cannot emit the buyback envelope.
- Buyback bounce recovery restores the complete envelope in covered bounce flows.
- Raw 50 TON buyback offer principal remains rejected as an incomplete funding envelope.
- Empty fallback rejection.

## Local Invariants

- `accumulated_ton + treasury_due_ton + buyback_due_ton` remains backed by real TON in covered caller-funded flows.
- Deposits account only declared principal; surplus is execution/storage reserve.
- Split preserves total accounted principal and sends no external value.
- Before `buyback_split_enabled`, split cannot increase `buyback_due_ton`.
- `EnableBuybackSplit` cannot convert already accumulated bootstrap fees into `buyback_due_ton`.
- Treasury flush only debits the requested treasury due amount after reserve checks.
- Buyback due can only be flushed as one complete M19H funding envelope.
- Failed buyback delivery restores the exact envelope amount to `buyback_due_ton`.

## Residual Assumptions

- Sandbox gas and forwarding behavior is a proxy, not final mainnet gas proof.
- `FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE = 0.002 TON` and `FEEACCUMULATOR_FLUSH_EXEC_RESERVE = 0.003 TON` are local conservative guards and should be remeasured on testnet/mainnet.
- Treasury receiver is a terminal immutable receiver; treasury flush is intentionally non-bounceable.
- Production BuybackBurn/STON.fi execution remains blocked until route values and final deployment are pinned.
- Initial final-genesis evidence must show `FeeAccumulator.buyback_split_enabled = false`; enabling belongs to the 15% activity distribution / pool-launch operations gate.
- No independent human audit has reviewed this hardening pass.
- No formal model checker has proven all reachable states.

## Recommended Before Final Genesis

- Independent Tact/security review focused on due-bucket backing and async bounce recovery.
- Testnet/mainnet gas envelope measurement for deposit, enable buyback split, split, treasury flush, and buyback bounce.
- Final deployment with a real BuybackBurn address instead of the blocked placeholder.
- Keep FeeAccumulator frozen only while focused FeeAccumulator/M19H, gas/conformance/integrity, full suite, and audit remain green.
