# UsernameRegistry / UsernameNFTItem Storage Economics Report

Status: **PASS**

Sandbox evidence that username mint and item recovery paths retain enough TON against the explicit V1 endowment model. This is not a mainnet rent oracle; it is a release gate against underfunded permanent UsernameRegistry records and UsernameNFTItem state.

UsernameRegistry code hash: `0d01ed009d3cbddcd37e098985177a2531c918aa6e1ea3567a2cb57cf88c4afb`
UsernameNFTItem code hash: `0a4cbac7aaa5899c12d4e2e72126aa8381f4c90ab1e3f547f49f7bfab9746ef1`

| Case | Kind | Registry delta | Registry endowment | Registry margin | Item delta/balance | Item floor | Item margin |
|---|---|---:|---:|---:|---:|---:|---:|
| SUCCESS_4_CHAR | successful_mint | 197131397 | 6000000 | 191131397 | 825052598 | 15900000 | 809152598 |
| SUCCESS_5_CHAR | successful_mint | 197070531 | 6000000 | 191070531 | 824997998 | 15900000 | 809097998 |
| SUCCESS_6_PLUS | successful_mint | 197012597 | 6000000 | 191012597 | 824943398 | 15900000 | 809043398 |
| ITEM_DEPLOY_BOUNCE_REFUND_REQUEST | item_bounce | 934704927 | 0 | 934704927 | 0 | 0 | 0 |
| ITEM_RESEND_ACK_CALLER_FUNDED | item_resend | 0 | 0 | 0 | 3020263 | 15900000 | 812063661 |
| ITEM_TRANSFER_EXACT_MIN | item_transfer | 0 | 0 | 0 | 11404332 | 15900000 | 820447730 |
| ITEM_TRANSFER_WITH_FORWARD | item_transfer | 0 | 0 | 0 | 11362931 | 15900000 | 820406329 |

Minimum storage margin gate: **1000000 nanotons**.
Worst relevant registry margin: **191012597 nanotons**.
Worst relevant item margin: **809043398 nanotons**.
