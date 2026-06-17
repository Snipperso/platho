# UsernameRegistry / UsernameNFTItem Storage Economics Report

Status: **PASS**

Sandbox evidence that username mint and item recovery paths retain enough TON against the explicit V1 endowment model. This is not a mainnet rent oracle; it is a release gate against underfunded permanent UsernameRegistry records and UsernameNFTItem state.

UsernameRegistry code hash: `b496e93d3e523b564b0af826eb2d80faec38fdb9ff495cb5b35f8552d408d189`
UsernameNFTItem code hash: `73d19a15d46c24d0eda7047d073490b7166d01322399751108be40ae2fda2eab`

| Case | Kind | Registry delta | Registry endowment | Registry margin | Item delta/balance | Item floor | Item margin |
|---|---|---:|---:|---:|---:|---:|---:|
| SUCCESS_4_CHAR | successful_mint | 96914798 | 6000000 | 90914798 | 496052598 | 15900000 | 480152598 |
| SUCCESS_5_CHAR | successful_mint | 96853930 | 6000000 | 90853930 | 495997998 | 15900000 | 480097998 |
| SUCCESS_6_PLUS | successful_mint | 96795997 | 6000000 | 90795997 | 495943398 | 15900000 | 480043398 |
| ITEM_DEPLOY_BOUNCE_REFUND_REQUEST | item_bounce | 505651526 | 0 | 505651526 | 0 | 0 | 0 |
| ITEM_RESEND_ACK_CALLER_FUNDED | item_resend | 0 | 0 | 0 | 3014329 | 15900000 | 483057727 |
| ITEM_TRANSFER_EXACT_MIN | item_transfer | 0 | 0 | 0 | 0 | 15900000 | 480043398 |
| ITEM_TRANSFER_WITH_FORWARD | item_transfer | 0 | 0 | 0 | 11357798 | 15900000 | 491401196 |

Minimum storage margin gate: **1000000 nanotons**.
Worst relevant registry margin: **90795997 nanotons**.
Worst relevant item margin: **480043398 nanotons**.
