# UsernameRegistry / UsernameNFTItem Storage Economics Report

Status: **PASS**

Sandbox evidence that username mint and item recovery paths retain enough TON against the explicit V1 endowment model. This is not a mainnet rent oracle; it is a release gate against underfunded permanent UsernameRegistry records and UsernameNFTItem state.

UsernameRegistry code hash: `89cf045874c3dc415409d702d51906cf6e8ce1f8ae9cf1bd64e6bf0c6b254570`
UsernameNFTItem code hash: `eccbea500b135059a1a46bae5c833b28ad263aae0258a146e9f98d8f7b843910`

| Case | Kind | Registry delta | Registry endowment | Registry margin | Item delta/balance | Item floor | Item margin |
|---|---|---:|---:|---:|---:|---:|---:|
| SUCCESS_4_CHAR | successful_mint | 132562730 | 6000000 | 126562730 | 496052598 | 15900000 | 480152598 |
| SUCCESS_5_CHAR | successful_mint | 132499531 | 6000000 | 126499531 | 495997998 | 15900000 | 480097998 |
| SUCCESS_6_PLUS | successful_mint | 132439263 | 6000000 | 126439263 | 495943398 | 15900000 | 480043398 |
| ITEM_DEPLOY_BOUNCE_REFUND_REQUEST | item_bounce | 541348660 | 0 | 541348660 | 0 | 0 | 0 |
| ITEM_RESEND_ACK_CALLER_FUNDED | item_resend | 0 | 0 | 0 | 2972863 | 15900000 | 483016261 |
| ITEM_TRANSFER_EXACT_MIN | item_transfer | 0 | 0 | 0 | 11409998 | 15900000 | 491453396 |
| ITEM_TRANSFER_WITH_FORWARD | item_transfer | 0 | 0 | 0 | 11368598 | 15900000 | 491411996 |

Minimum storage margin gate: **1000000 nanotons**.
Worst relevant registry margin: **126439263 nanotons**.
Worst relevant item margin: **480043398 nanotons**.
