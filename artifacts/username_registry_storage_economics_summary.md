# UsernameRegistry / UsernameNFTItem Storage Economics Report

Status: **PASS**

Sandbox evidence that username mint and item recovery paths retain enough TON against the explicit V1 endowment model. This is not a mainnet rent oracle; it is a release gate against underfunded permanent UsernameRegistry records and UsernameNFTItem state.

UsernameRegistry code hash: `f248b46c3a298f6dba28ceac051c50ee294a2dc4e6de5879d8fd3635e4cecfc2`
UsernameNFTItem code hash: `73d19a15d46c24d0eda7047d073490b7166d01322399751108be40ae2fda2eab`

| Case | Kind | Registry delta | Registry endowment | Registry margin | Item delta/balance | Item floor | Item margin |
|---|---|---:|---:|---:|---:|---:|---:|
| SUCCESS_4_CHAR | successful_mint | 132590197 | 6000000 | 126590197 | 496052598 | 15900000 | 480152598 |
| SUCCESS_5_CHAR | successful_mint | 132526997 | 6000000 | 126526997 | 495997998 | 15900000 | 480097998 |
| SUCCESS_6_PLUS | successful_mint | 132466730 | 6000000 | 126466730 | 495943398 | 15900000 | 480043398 |
| ITEM_DEPLOY_BOUNCE_REFUND_REQUEST | item_bounce | 541376127 | 0 | 541376127 | 0 | 0 | 0 |
| ITEM_RESEND_ACK_CALLER_FUNDED | item_resend | 0 | 0 | 0 | 2972863 | 15900000 | 483016261 |
| ITEM_TRANSFER_EXACT_MIN | item_transfer | 0 | 0 | 0 | 0 | 15900000 | 480043398 |
| ITEM_TRANSFER_WITH_FORWARD | item_transfer | 0 | 0 | 0 | 11357798 | 15900000 | 491401196 |

Minimum storage margin gate: **1000000 nanotons**.
Worst relevant registry margin: **126466730 nanotons**.
Worst relevant item margin: **480043398 nanotons**.
