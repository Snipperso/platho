# UsernameRegistry / UsernameNFTItem Storage Economics Report

Status: **PASS**

Sandbox evidence that username mint and item recovery paths retain enough TON against the explicit V1 endowment model. This is not a mainnet rent oracle; it is a release gate against underfunded permanent UsernameRegistry records and UsernameNFTItem state.

UsernameRegistry code hash: `eb8b3ffad3a2da34d4c10e1ab8b2918f87e40c39b175cb46600d0a6ec7f59990`
UsernameNFTItem code hash: `73d19a15d46c24d0eda7047d073490b7166d01322399751108be40ae2fda2eab`

| Case | Kind | Registry delta | Registry endowment | Registry margin | Item delta/balance | Item floor | Item margin |
|---|---|---:|---:|---:|---:|---:|---:|
| SUCCESS_4_CHAR | successful_mint | 97212931 | 6000000 | 91212931 | 496052598 | 15900000 | 480152598 |
| SUCCESS_5_CHAR | successful_mint | 97152063 | 6000000 | 91152063 | 495997998 | 15900000 | 480097998 |
| SUCCESS_6_PLUS | successful_mint | 97094130 | 6000000 | 91094130 | 495943398 | 15900000 | 480043398 |
| ITEM_DEPLOY_BOUNCE_REFUND_REQUEST | item_bounce | 505958193 | 0 | 505958193 | 0 | 0 | 0 |
| ITEM_RESEND_ACK_CALLER_FUNDED | item_resend | 0 | 0 | 0 | 3051796 | 15900000 | 483095194 |
| ITEM_TRANSFER_EXACT_MIN | item_transfer | 0 | 0 | 0 | 0 | 15900000 | 480043398 |
| ITEM_TRANSFER_WITH_FORWARD | item_transfer | 0 | 0 | 0 | 11357798 | 15900000 | 491401196 |

Minimum storage margin gate: **1000000 nanotons**.
Worst relevant registry margin: **91094130 nanotons**.
Worst relevant item margin: **480043398 nanotons**.
