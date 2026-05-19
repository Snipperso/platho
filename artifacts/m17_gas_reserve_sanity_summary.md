# Platho M17 Gas / Reserve Sanity Report

Status: **PASS**

Sandbox gas/reserve sanity pass for implemented subset. Not a final mainnet gas freeze. Thresholds are broad regression guards, not protocol reserves.

| Scenario | Operations | Total fees, nanotons | Max op fee, nanotons | Max gas used |
|---|---:|---:|---:|---:|
| ATH_TRANSFER_SUCCESS | 1 | 2359992 | 2359992 | 9808 |
| ATH_BURN_SUCCESS | 1 | 1313202 | 1313202 | 7932 |
| CAPSULEHUB_DIRECT_PUBLISH_AND_FLUSH_BOUNCE | 3 | 3350005 | 1258690 | 13586 |
| FEEACCUMULATOR_SPLIT_FLUSH | 4 | 2023140 | 619113 | 4582 |
| USERNAME_REGISTRY_MINT_FLUSH_PRUNE | 7 | 21834083 | 4518370 | 32606 |
| VAULT_EXTERNAL_PUBLISH | 2 | 11392425 | 6709913 | 46868 |

## Operation details

### ATH_TRANSFER_SUCCESS

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| owner_to_recipient_wallet | 4 | 2359992 | 1408745 | 9808 | 0 | 0 |

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
| valid_username_mint_with_item_ack | 4 | 3947734 | 2322554 | 32606 | 1 | 1 |
| invalid_username_refund_due | 2 | 1639668 | 1381067 | 20264 | 1 | 1 |
| flush_ath_refund_due | 5 | 4518370 | 1447889 | 21099 | 0 | 0 |
| flush_treasury_due_ath | 5 | 4297147 | 1405678 | 17911 | 0 | 0 |
| flush_burn_due_ath | 5 | 3143425 | 1030689 | 14930 | 0 | 0 |
| stuck_pending_mint_creation_no_ack | 3 | 2722689 | 2322554 | 32606 | 1 | 1 |
| prune_stale_pending_mint | 2 | 1565050 | 1280656 | 15069 | 0 | 0 |

### VAULT_EXTERNAL_PUBLISH

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| external_private_publish_to_capsulehub_ack | 3 | 6709913 | 3407490 | 46868 | 0 | 0 |
| external_private_publish_to_missing_capsulehub_bounce | 3 | 4682512 | 3407490 | 46868 | 1 | 0 |

## Result

No implemented-subset scenario exceeded the broad M17 sanity thresholds. This does not finalize mainnet gas constants; it only prevents obvious reserve regressions while BuybackBurn/STON.fi values remain blocked.
