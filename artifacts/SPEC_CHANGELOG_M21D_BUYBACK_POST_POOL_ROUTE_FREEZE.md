# SPEC CHANGELOG M21D - BuybackBurn post-pool route freeze

## Changed

- `BuybackBurn` no longer requires the STON.fi route to be frozen before genesis seal.
- Final genesis now seals `BuybackBurn` with:

```text
route_frozen = false
genesis_config_hash = hash(one_time_launch_controller)
```

- `FreezeBuybackRoute` can be called once after seal by the same one-time launch controller.
- When post-seal `FreezeBuybackRoute` succeeds, `BuybackBurn` clears `genesis_config_hash = 0`.

## Rationale

The ATH/TON liquidity pool is intentionally created only after the 15% activity-distribution / pool-launch gate. A pool created earlier would require seed liquidity and would be tradable immediately through contracts/aggregators.

Therefore the pool address cannot be a final-genesis requirement.

## Safety Rules

Before route freeze:

```text
AcceptBurnReserve rejects
ExecuteBuybackChunk rejects
authenticated route refund fallback rejects
```

Post-seal route freeze is allowed only while the buyback state is clean:

```text
phase = IDLE
reserve_due_ton = 0
route_refund_due_ton = 0
ath_burn_retry_due_atomic = 0
accepted_reserve_count = 0
```

After route freeze:

```text
route_frozen = true
genesis_config_hash = 0
```

No second route freeze is possible.

## Launch Order

```text
1. final genesis: BuybackBurn sealed, route_frozen=false
2. protocol accumulates TON in treasury/liquidity reserve until 15% distribution
3. create ATH/TON STON.fi pool with real liquidity
4. call FreezeBuybackRoute with final pool/router/pTON evidence
5. call FeeAccumulator.EnableBuybackSplit
6. buyback reserve flush and execution become available
```

## Release Verifier

`mainnet_genesis_verify` now requires:

```text
buyback_burn.route_frozen = false
buyback_burn.genesis_config_hash = non-zero launch controller hash
fee_accumulator.buyback_split_enabled = false
```

The STON.fi pool address is not part of final genesis; it belongs to the post-pool route-freeze evidence.
