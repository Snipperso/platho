# UsernameRegistry / UsernameNFTItem Storage Economics Report

Status: **PASS**

Sandbox evidence that username mint/refund/item recovery paths retain enough TON against the explicit V1 endowment model. This is not a mainnet rent oracle; it is a release gate against underfunded permanent UsernameRegistry records, refund-due entries, and UsernameNFTItem state.

UsernameRegistry code hash: `f5b445a179a420128fbc78660e79986d6aba1bfb185d4f183c4ce41681a7c36e`
UsernameNFTItem code hash: `3ad1c971f6b04e67e8dafcb0624aa794e996761420500cdf10d4edc77a2037ce`

| Case | Kind | Registry delta | Registry endowment | Registry margin | Item delta/balance | Item floor | Item margin |
|---|---|---:|---:|---:|---:|---:|---:|
| SUCCESS_4_CHAR | successful_mint | 7841797 | 6000000 | 1841797 | 17052598 | 15900000 | 1152598 |
| SUCCESS_5_CHAR | successful_mint | 7780931 | 6000000 | 1780931 | 16997998 | 15900000 | 1097998 |
| SUCCESS_6_PLUS | successful_mint | 7722997 | 6000000 | 1722997 | 16943398 | 15900000 | 1043398 |
| REJECTED_NEW_REFUND_DUE | refund_due | 6323866 | 4000000 | 2323866 | 0 | 0 | 0 |
| REJECTED_EXISTING_REFUND_DUE | existing_refund_due | 2323799 | 0 | 2323799 | 0 | 0 | 0 |
| ITEM_DEPLOY_BOUNCE_REFUND_REQUEST | item_bounce | 26565994 | 0 | 26565994 | 0 | 0 | 0 |
| ITEM_RESEND_ACK_CALLER_FUNDED | item_resend | 0 | 0 | 0 | 3020263 | 15900000 | 4063661 |
| ITEM_TRANSFER_EXACT_MIN | item_transfer | 0 | 0 | 0 | 0 | 15900000 | 1043398 |
| ITEM_TRANSFER_WITH_FORWARD | item_transfer | 0 | 0 | 0 | 11357798 | 15900000 | 12401196 |

Minimum storage margin gate: **1000000 nanotons**.
Worst relevant registry margin: **1722997 nanotons**.
Worst relevant item margin: **1043398 nanotons**.
