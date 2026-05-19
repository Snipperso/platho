# Platho v1 Open Values Profile Update: M19A STON.fi Route Discovery Draft

**Version:** v0.19-stonfi-route-discovery-draft  
**Status:** DRAFT, not final route freeze  
**Companion milestone:** `platho-stonfi-route-discovery-m19a.zip`

This update records the exact STON.fi v2.1 SDK-derived TON -> jetton payload profile that Platho BuybackBurn must use once the real ATH/TON route exists and is pinned.

This profile does **not** unblock production `BuybackBurn` yet.

## Official Source Used

Implementation discovery used the official npm package:

```text
@ston-fi/sdk = 2.7.0
repository = https://github.com/ston-fi/sdk/tree/main/packages/sdk
export = @ston-fi/sdk/dex/v2_1
```

Inspected source paths from the package source maps:

```text
src/contracts/dex/v2_1/router/BaseRouterV2_1.ts
src/contracts/dex/v2_1/constants.ts
src/contracts/pTON/v2_1/PtonV2_1.ts
src/contracts/pTON/v2_1/constants.ts
```

## STON.fi v2.1 Constants Observed

```text
DEX_OP_SWAP = 0x6664de2a
PTON_OP_TON_TRANSFER = 0x01f3835d
BaseRouterV2_1.swapTonToJetton.forwardGasAmount = 0.3 TON = 300_000_000 nanotons
PtonV2_1.tonTransfer.gas = 0.01 TON = 10_000_000 nanotons
Default referralValue = 10 BPS
```

## SDK Route Shape: TON -> Jetton

The SDK path is:

```text
BaseRouterV2_1.getSwapTonToJettonTxParams(...)
  -> BaseRouterV2_1.createSwapBody(...)
  -> PtonV2_1.getTonTransferTxParams(...)
  -> PtonV2_1.createTonTransferBody(...)
```

The external sender sends a pTON transfer message to the selected pTON wallet for the router.

## pTON TON Transfer Body V2.1

```text
root:
  op: uint32 = 0x01f3835d
  query_id: uint64
  ton_amount: coins
  refund_address: MsgAddress
  has_forward_payload: bit
  forward_payload: ^Cell if has_forward_payload == 1
```

For BuybackBurn, `ton_amount` MUST be exactly:

```text
BUYBACK_CHUNK_TON = 50 TON = 50_000_000_000 nanotons
```

The total outbound value with SDK defaults is:

```text
50 TON + 0.3 TON + 0.01 TON = 50.31 TON = 50_310_000_000 nanotons
```

This value must be validated against live route simulation before final code freeze.

## STON.fi Swap Forward Payload V2.1

```text
root:
  op: uint32 = 0x6664de2a
  ask_jetton_wallet_address: MsgAddress
  refund_address: MsgAddress
  excesses_address: MsgAddress
  deadline: uint64
  details: ^Cell

ref details:
  min_ask_amount: coins
  receiver_address: MsgAddress
  dex_custom_payload_forward_gas_amount: coins
  dex_custom_payload: Maybe ^Cell
  refund_forward_gas_amount: coins
  refund_payload: Maybe ^Cell
  referral_value_bps: uint16
  referral_address: MsgAddressMaybe
```

The Platho `dex_min_out` field maps exactly to:

```text
ref details.min_ask_amount
```

## BuybackBurn Implications

Production BuybackBurn must enforce:

```text
buyback_amount_ton == 50 TON
dex_min_out >= BUYBACK_MIN_ATH_OUT_PER_50_TON
STON.fi swap details.min_ask_amount == dex_min_out
```

BuybackBurn success must not be inferred from STON.fi router claims.

Success path remains:

```text
STON.fi route transfers ATH
-> official BuybackBurn ATH wallet receives ATH
-> ATH wallet notifies BuybackBurn
-> BuybackBurn burns ATH
-> ATH Master sends ATHBurnFinalized
-> BuybackBurn clears pending state only after authenticated burn finalization
```

## Still Unresolved Before Final Route Freeze

```text
ATH_MASTER_ADDRESS final deployment address
STONFI_ROUTER_ADDRESS selected production v2 router address
STONFI_POOL_ADDRESS_TON_ATH selected TON/ATH pool address
STONFI_PTON_ADDRESS / pTON wallet route address for selected router
STONFI_VAULT_ADDRESS if selected route requires it
STONFI_FORWARD_GAS_REQUIREMENTS validated against selected route and live tx simulation
BUYBACK_MIN_ATH_OUT_PER_50_TON from liquidity/route tests
raw official SDK/API-generated tx sample for real 50 TON -> ATH route
swap/refund/bounce behavior from selected STON.fi route sample transactions
```

## Implementation Rule

Until all unresolved values above are filled, production `BuybackBurn` remains blocked.

No DeDust route, route switch, null route, disabled route, compatibility route, or fallback route is part of Platho v1.
