# Platho M17 Gas / Reserve Sanity Report

Status: **PASS**

Sandbox gas/reserve sanity pass for implemented subset. Not a final mainnet gas freeze. Thresholds are broad regression guards, not protocol reserves.

| Scenario | Operations | Total fees, nanotons | Max op fee, nanotons | Max gas used |
|---|---:|---:|---:|---:|
| ATH_TRANSFER_SUCCESS | 1 | 2073596 | 2073596 | 9613 |
| ATH_BURN_SUCCESS | 1 | 1307069 | 1307069 | 7840 |
| CAPSULEHUB_DIRECT_PUBLISH_AND_FLUSH_BOUNCE | 3 | 3350005 | 1258690 | 13586 |
| FEEACCUMULATOR_SPLIT_FLUSH | 4 | 2023140 | 619113 | 4582 |
| USERNAME_REGISTRY_MINT_FLUSH_PRUNE | 7 | 20839830 | 4049441 | 32492 |
| VAULT_EXTERNAL_PUBLISH | 2 | 11073093 | 6558447 | 46503 |

## Operation details

### ATH_TRANSFER_SUCCESS

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| owner_to_recipient_wallet | 4 | 2073596 | 1135549 | 9613 | 0 | 0 |

### ATH_BURN_SUCCESS

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| wallet_to_master_burn_finalized | 4 | 1307069 | 558023 | 7840 | 0 | 0 |

### CAPSULEHUB_DIRECT_PUBLISH_AND_FLUSH_BOUNCE

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| private_direct_publish | 2 | 1258690 | 905734 | 13586 | 0 | 0 |
| public_direct_publish | 2 | 1102358 | 772601 | 11589 | 0 | 0 |
| flush_fee_to_missing_accumulator_bounce | 3 | 988957 | 697533 | 10043 | 0 | 0 |

### FEEACCUMULATOR_SPLIT_FLUSH

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| deposit_protocol_fee | 2 | 462024 | 270823 | 2868 | 0 | 0 |
| split_accumulated | 2 | 472357 | 262289 | 3151 | 0 | 0 |
| flush_treasury_due | 3 | 619113 | 327689 | 4582 | 0 | 0 |
| flush_buyback_due_bounce | 3 | 469646 | 270823 | 2340 | 1 | 1 |

### USERNAME_REGISTRY_MINT_FLUSH_PRUNE

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| valid_username_mint_with_item_ack | 4 | 3885690 | 2314243 | 32492 | 1 | 1 |
| invalid_username_refund_due | 2 | 1572958 | 1368090 | 20080 | 1 | 1 |
| flush_ath_refund_due | 5 | 4049441 | 1265356 | 18361 | 0 | 0 |
| flush_treasury_due_ath | 5 | 4010751 | 1235356 | 17911 | 0 | 0 |
| flush_burn_due_ath | 5 | 3137292 | 1030689 | 14930 | 0 | 0 |
| stuck_pending_mint_creation_no_ack | 3 | 2660645 | 2314243 | 32492 | 1 | 1 |
| prune_stale_pending_mint | 2 | 1523053 | 1238659 | 15069 | 0 | 0 |

### VAULT_EXTERNAL_PUBLISH

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| external_private_publish_to_capsulehub_ack | 3 | 6558447 | 3383157 | 46503 | 0 | 0 |
| external_private_publish_to_missing_capsulehub_bounce | 3 | 4514646 | 3383157 | 46503 | 1 | 0 |

## Result

No implemented-subset scenario exceeded the broad M17 sanity thresholds. This does not finalize mainnet gas constants; it only prevents obvious reserve regressions while BuybackBurn/STON.fi values remain blocked.
