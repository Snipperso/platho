# Platho v1 open values v0.20U — BuybackBurn implementation readiness gate

## Status

`M20U_READINESS_GATE_ONLY`.

This milestone turns the M19G/M19H/M20T discussion into a concrete readiness gate for a future production `BuybackBurn` implementation. It does not implement `BuybackBurn`, does not deploy anything, and does not claim STON.fi route freeze.

## Required before production implementation

Production `BuybackBurn` remains blocked until both are true:

```text
M20T_TESTNET_DEPLOYMENT_PROBE_COMPLETE = true
M20F_MAINNET_STONFI_ROUTE_FREEZE_READY = true
```

Testnet success alone is not enough. Mainnet route freeze alone is not enough. The future production implementation needs both behavior proof and final route evidence.

## Route-independent values

```text
BUYBACK_OFFER_AMOUNT = 50 TON = 50_000_000_000 nanotons
BUYBACK_ROUTE_FUNDING = 1.05 TON = 1_050_000_000 nanotons
BUYBACK_TOTAL_FUNDING_ENVELOPE = 51.05 TON = 51_050_000_000 nanotons
FEE_ACCUMULATOR_FLUSH_BUYBACK_DUE_AMOUNT = 51.05 TON
```

A raw `50 TON` buyback flush is not a complete conservative funding envelope after M19H/M19I.

## Candidate production surface, once unblocked

The future contract surface is limited to the minimum state machine already frozen in M19G:

```text
IDLE
PENDING_STONFI_SWAP
PENDING_ATH_BURN
```

Candidate messages:

```text
AcceptBurnReserve
ExecuteBuybackChunk
JettonTransferNotification
ATHBurnFinalized
Route refund/failure handling
RetryAthBurnDue
```

Immutable addresses:

```text
feeAccumulatorAddress
athMasterAddress
officialBuybackBurnAthWalletAddress
stonfiRouterAddress
stonfiPoolAddressTonAth
stonfiPtonWalletAddress
```

## Hard blockers

```text
M20T_TESTNET_DEPLOYMENT_PROBE_NOT_COMPLETE
M20F_MAINNET_STONFI_ROUTE_FREEZE_NOT_READY
```

## Forbidden shortcuts

```text
no fallback route
no route switch
no DeDust route
no ignored-error money send mode
no owner rescue
no pause/governance surface
no clearing pending swap from router claim alone
no clearing pending burn without ATHBurnFinalized from ATH Master
no treating testnet proof as mainnet route freeze
no setting BUYBACKBURN_IMPLEMENTATION_READY=true from templates/placeholders
```

## Codex guardrails

Codex may prepare and execute M20T deployment/probe when a funded disposable testnet wallet exists. Codex must stop with `NEED_TESTNET_TON` if funding is missing and must never commit seed phrases, private keys, `.env`, `.env.*`, `*.mnemonic`, `*.seed`, or `*.secret`.

M20U does not authorize production BuybackBurn implementation. It only defines when that implementation becomes allowed.
