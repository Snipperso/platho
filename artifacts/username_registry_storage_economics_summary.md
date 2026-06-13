# UsernameRegistry / UsernameNFTItem Storage Economics Report

Status: **PASS**

Sandbox evidence that username mint and item recovery paths retain enough TON against the explicit V1 endowment model. This is not a mainnet rent oracle; it is a release gate against underfunded permanent UsernameRegistry records and UsernameNFTItem state.

UsernameRegistry code hash: `0febf3487aefc1363eba3cce080a23d001c8764f3b7031f0859e5cc2d39ab566`
UsernameNFTItem code hash: `3ad1c971f6b04e67e8dafcb0624aa794e996761420500cdf10d4edc77a2037ce`

| Case | Kind | Registry delta | Registry endowment | Registry margin | Item delta/balance | Item floor | Item margin |
|---|---|---:|---:|---:|---:|---:|---:|
| SUCCESS_4_CHAR | successful_mint | 8434264 | 6000000 | 2434264 | 17052598 | 15900000 | 1152598 |
| SUCCESS_5_CHAR | successful_mint | 8373397 | 6000000 | 2373397 | 16997998 | 15900000 | 1097998 |
| SUCCESS_6_PLUS | successful_mint | 8315463 | 6000000 | 2315463 | 16943398 | 15900000 | 1043398 |
| ITEM_DEPLOY_BOUNCE_REFUND_REQUEST | item_bounce | 27179526 | 0 | 27179526 | 0 | 0 | 0 |
| ITEM_RESEND_ACK_CALLER_FUNDED | item_resend | 0 | 0 | 0 | 3051796 | 15900000 | 4095194 |
| ITEM_TRANSFER_EXACT_MIN | item_transfer | 0 | 0 | 0 | 0 | 15900000 | 1043398 |
| ITEM_TRANSFER_WITH_FORWARD | item_transfer | 0 | 0 | 0 | 11357798 | 15900000 | 12401196 |

Minimum storage margin gate: **1000000 nanotons**.
Worst relevant registry margin: **2315463 nanotons**.
Worst relevant item margin: **1043398 nanotons**.
