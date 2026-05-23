# Platho M17 Gas / Reserve Sanity Report

Status: **PASS**

Sandbox gas/reserve sanity pass for implemented subset. Not a final mainnet gas freeze. Thresholds are broad regression guards, not protocol reserves.

| Scenario | Operations | Total fees, nanotons | Max op fee, nanotons | Max gas used |
|---|---:|---:|---:|---:|
| ATH_TRANSFER_SUCCESS | 1 | 2812499 | 2812499 | 11621 |
| ATH_BURN_SUCCESS | 1 | 1366069 | 1366069 | 7950 |
| CAPSULEHUB_VAULT_PUBLISH_AND_FLUSH_BOUNCE | 3 | 3633202 | 1565089 | 22907 |
| FEEACCUMULATOR_SPLIT_FLUSH | 4 | 2038073 | 632179 | 4778 |
| USERNAME_REGISTRY_MINT_FLUSH_PRUNE | 7 | 24347951 | 5071077 | 38299 |
| VAULT_WALLET_PUBLISH | 2 | 9941209 | 5192905 | 34282 |

## Operation details

### ATH_TRANSFER_SUCCESS

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| owner_to_recipient_wallet | 4 | 2812499 | 1806785 | 11621 | 0 | 0 |

### ATH_BURN_SUCCESS

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| wallet_to_master_burn_finalized | 4 | 1366069 | 565356 | 7950 | 0 | 0 |

### CAPSULEHUB_VAULT_PUBLISH_AND_FLUSH_BOUNCE

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| private_vault_publish | 2 | 1565089 | 1565089 | 22907 | 1 | 0 |
| public_vault_publish | 2 | 1222356 | 1222356 | 17766 | 1 | 0 |
| flush_fee_to_missing_accumulator_bounce | 3 | 845757 | 554333 | 7895 | 0 | 0 |

### FEEACCUMULATOR_SPLIT_FLUSH

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| deposit_protocol_fee | 2 | 462024 | 270823 | 2868 | 0 | 0 |
| split_accumulated | 2 | 472357 | 262289 | 3151 | 0 | 0 |
| flush_treasury_due | 3 | 632179 | 340755 | 4778 | 0 | 0 |
| flush_buyback_due_bounce | 3 | 471513 | 270823 | 2368 | 1 | 1 |

### USERNAME_REGISTRY_MINT_FLUSH_PRUNE

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| valid_username_mint_with_item_ack | 5 | 4404422 | 2727509 | 38299 | 2 | 1 |
| invalid_username_refund_due | 3 | 2060489 | 1763555 | 25668 | 2 | 1 |
| flush_ath_refund_due | 5 | 5071077 | 1806785 | 22602 | 0 | 0 |
| flush_treasury_due_ath | 5 | 4781721 | 1820919 | 18134 | 0 | 0 |
| flush_burn_due_ath | 5 | 3213491 | 1030689 | 14930 | 0 | 0 |
| stuck_pending_mint_creation_no_ack | 4 | 3165977 | 2727509 | 38299 | 2 | 1 |
| prune_stale_pending_mint | 2 | 1650774 | 1366380 | 15788 | 0 | 0 |

### VAULT_WALLET_PUBLISH

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| wallet_private_publish_to_capsulehub_ack | 5 | 5192905 | 2591152 | 34282 | 1 | 1 |
| wallet_private_publish_to_missing_capsulehub_bounce | 5 | 4748304 | 2591152 | 34282 | 1 | 0 |

## Result

No implemented-subset scenario exceeded the broad M17 sanity thresholds. This does not finalize mainnet gas constants; it only prevents obvious reserve regressions while BuybackBurn/STON.fi values remain blocked.
