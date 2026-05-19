# Platho M17 Gas / Reserve Sanity Report

Status: **PASS**

Sandbox gas/reserve sanity pass for implemented subset. Not a final mainnet gas freeze. Thresholds are broad regression guards, not protocol reserves.

| Scenario | Operations | Total fees, nanotons | Max op fee, nanotons | Max gas used |
|---|---:|---:|---:|---:|
| ATH_TRANSFER_SUCCESS | 1 | 2270282 | 2270282 | 9808 |
| ATH_BURN_SUCCESS | 1 | 1313202 | 1313202 | 7932 |
| CAPSULEHUB_DIRECT_PUBLISH_AND_FLUSH_BOUNCE | 3 | 3350005 | 1258690 | 13586 |
| FEEACCUMULATOR_SPLIT_FLUSH | 4 | 2023140 | 619113 | 4582 |
| USERNAME_REGISTRY_MINT_FLUSH_PRUNE | 7 | 21349790 | 4246127 | 32492 |
| VAULT_EXTERNAL_PUBLISH | 2 | 11337893 | 6682647 | 46654 |

## Operation details

### ATH_TRANSFER_SUCCESS

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| owner_to_recipient_wallet | 4 | 2270282 | 1319035 | 9808 | 0 | 0 |

### ATH_BURN_SUCCESS

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| wallet_to_master_burn_finalized | 4 | 1313202 | 564156 | 7932 | 0 | 0 |

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
| valid_username_mint_with_item_ack | 4 | 3916690 | 2314243 | 32492 | 1 | 1 |
| invalid_username_refund_due | 2 | 1603958 | 1368090 | 20080 | 1 | 1 |
| flush_ath_refund_due | 5 | 4246127 | 1319035 | 18361 | 0 | 0 |
| flush_treasury_due_ath | 5 | 4207437 | 1315968 | 17911 | 0 | 0 |
| flush_burn_due_ath | 5 | 3143425 | 1030689 | 14930 | 0 | 0 |
| stuck_pending_mint_creation_no_ack | 3 | 2691645 | 2314243 | 32492 | 1 | 1 |
| prune_stale_pending_mint | 2 | 1540508 | 1256114 | 15069 | 0 | 0 |

### VAULT_EXTERNAL_PUBLISH

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| external_private_publish_to_capsulehub_ack | 3 | 6682647 | 3393224 | 46654 | 0 | 0 |
| external_private_publish_to_missing_capsulehub_bounce | 3 | 4655246 | 3393224 | 46654 | 1 | 0 |

## Result

No implemented-subset scenario exceeded the broad M17 sanity thresholds. This does not finalize mainnet gas constants; it only prevents obvious reserve regressions while BuybackBurn/STON.fi values remain blocked.
