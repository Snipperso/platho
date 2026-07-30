# UsernameRegistry / UsernameNFTItem Storage Economics Report

Status: **PASS**

Sandbox evidence that username mint and item recovery paths retain enough TON against the explicit V1 endowment model. This is not a mainnet rent oracle; it is a release gate against underfunded permanent UsernameRegistry records and UsernameNFTItem state.

UsernameRegistry code hash: `2949bdfd7ff4e312a48eef663b054064e2235297277b6bc3849f4458b322fa37`
UsernameNFTItem code hash: `0df553413c4e61177c4a49ced30e509caeb6280b1879c29a6a71ded94b70622a`

| Case | Kind | Registry delta | Registry endowment | Registry margin | Item delta/balance | Item floor | Item margin |
|---|---|---:|---:|---:|---:|---:|---:|
| SUCCESS_4_CHAR | successful_mint | 196722998 | 6000000 | 190722998 | 824980331 | 15900000 | 809080331 |
| SUCCESS_5_CHAR | successful_mint | 196662130 | 6000000 | 190662130 | 824925731 | 15900000 | 809025731 |
| SUCCESS_6_PLUS | successful_mint | 196604197 | 6000000 | 190604197 | 824871131 | 15900000 | 808971131 |
| ITEM_DEPLOY_BOUNCE_REFUND_REQUEST | item_bounce | 150221461 | 0 | 150221461 | 0 | 0 | 0 |
| ITEM_RESEND_ACK_CALLER_FUNDED | item_resend | 0 | 0 | 0 | 0 | 15900000 | 808971131 |
| ITEM_TRANSFER_EXACT_MIN | item_transfer | 0 | 0 | 0 | 11321798 | 15900000 | 820292929 |
| ITEM_TRANSFER_WITH_FORWARD | item_transfer | 0 | 0 | 0 | 11261331 | 15900000 | 820232462 |

Minimum storage margin gate: **1000000 nanotons**.
Worst relevant registry margin: **190604197 nanotons**.
Worst relevant item margin: **808971131 nanotons**.
