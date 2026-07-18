# UsernameRegistry / UsernameNFTItem Storage Economics Report

Status: **PASS**

Sandbox evidence that username mint and item recovery paths retain enough TON against the explicit V1 endowment model. This is not a mainnet rent oracle; it is a release gate against underfunded permanent UsernameRegistry records and UsernameNFTItem state.

UsernameRegistry code hash: `e010d1de9b45110ce5dd7e426c585d668d1831d666b60d7be458df4b1a6307bd`
UsernameNFTItem code hash: `eccbea500b135059a1a46bae5c833b28ad263aae0258a146e9f98d8f7b843910`

| Case | Kind | Registry delta | Registry endowment | Registry margin | Item delta/balance | Item floor | Item margin |
|---|---|---:|---:|---:|---:|---:|---:|
| SUCCESS_4_CHAR | successful_mint | 196563530 | 6000000 | 190563530 | 825052598 | 15900000 | 809152598 |
| SUCCESS_5_CHAR | successful_mint | 196500331 | 6000000 | 190500331 | 824997998 | 15900000 | 809097998 |
| SUCCESS_6_PLUS | successful_mint | 196440063 | 6000000 | 190440063 | 824943398 | 15900000 | 809043398 |
| ITEM_DEPLOY_BOUNCE_REFUND_REQUEST | item_bounce | 934349460 | 0 | 934349460 | 0 | 0 | 0 |
| ITEM_RESEND_ACK_CALLER_FUNDED | item_resend | 0 | 0 | 0 | 2972863 | 15900000 | 812016261 |
| ITEM_TRANSFER_EXACT_MIN | item_transfer | 0 | 0 | 0 | 11409998 | 15900000 | 820453396 |
| ITEM_TRANSFER_WITH_FORWARD | item_transfer | 0 | 0 | 0 | 11368598 | 15900000 | 820411996 |

Minimum storage margin gate: **1000000 nanotons**.
Worst relevant registry margin: **190440063 nanotons**.
Worst relevant item margin: **809043398 nanotons**.
