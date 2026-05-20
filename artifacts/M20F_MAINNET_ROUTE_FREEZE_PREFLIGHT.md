# M20F Mainnet Route Freeze Preflight

Status: BLOCKED_MISSING_FINAL_MAINNET_INPUTS

## Flags

- M20T complete: true
- M19F route freeze ready: false
- M20F route freeze ready: false
- Production BuybackBurn unlocked: false
- Buyback route ATH notify upstream min: 40000000
- ATH notify owner request safe min: 50000000

## Blockers

- MISSING_FINAL_MAINNET_M20F_INPUTS
- M19F_ROUTE_EVIDENCE_DOSSIER_NOT_READY

## Missing Inputs

- M20F_MAINNET_ROUTE_FREEZE_INPUT
- FINAL_MAINNET_ATH_MASTER_ADDRESS
- FINAL_BUYBACKBURN_STATEINIT_ADDRESS
- OFFICIAL_BUYBACKBURN_ATH_WALLET_ADDRESS
- STONFI_API_SIMULATION_CAPTURE
- OFFICIAL_STONFI_SDK_OR_API_TX_PARAMS_CAPTURE
- MAINNET_REFUND_EXCESS_AND_FAILURE_PROOFS

## Rejected Non-Prod Inputs

- none

## Official Sources

- STON.fi SDK swap docs: https://docs.ston.fi/developer-section/dex/sdk/v2/swap
- STON.fi REST API docs: https://docs.ston.fi/developer-section/dex/api
- STON.fi REST API reference: https://docs.ston.fi/developer-section/dex/api/reference
- STON.fi API base URL: https://api.ston.fi
- @ston-fi/sdk version verified by npm: 2.7.0
- @ston-fi/api version verified by npm: 0.32.0

## Next Inputs

- Deploy/freeze final mainnet ATH master and capture immutable deployment manifest.
- Derive final production BuybackBurn StateInit address and official BuybackBurn ATH wallet.
- Use STON.fi API mainnet simulation for exact 50 TON -> ATH route and capture router metadata.
- Generate official @ston-fi/sdk/@ston-fi/api tx params from the simulation result.
- Capture router, pool, pTON, ATH master, and ATH wallet code hashes on mainnet.
- Prove success excesses, min_out failure refund, pTON refund, and bounce/failure behavior return to BuybackBurn.
- Prove BuybackBurn ATH route notify value is production-safe: upstream notify value must be >= 40,000,000 nanotons and must not leave BuybackBurn pending.
- Pin Vault ATH deposit and username mint owner request values to >= 50,000,000 nanotons or stricter current safe bounds.
- Feed the complete evidence dossier through M19F; only then may M20F_ROUTE_FREEZE_READY become true.

M20F is not complete until M19F passes with real mainnet evidence. Testnet M20T evidence must stay separate.
