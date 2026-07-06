# Platho M17 Gas / Reserve Sanity Report

Status: **PASS**

Sandbox gas/reserve sanity pass for implemented subset. Not a final mainnet gas freeze. Thresholds are broad regression guards, not protocol reserves.

| Scenario | Operations | Total fees, nanotons | Max op fee, nanotons | Max gas used |
|---|---:|---:|---:|---:|
| ATH_TRANSFER_SUCCESS | 1 | 4015673 | 4015673 | 14601 |
| ATH_BURN_SUCCESS | 1 | 1384469 | 1384469 | 8226 |
| CAPSULEHUB_VAULT_PUBLISH_AND_FLUSH_BOUNCE | 3 | 11106914 | 5462134 | 81360 |
| FEEACCUMULATOR_SPLIT_FLUSH | 7 | 4114566 | 907445 | 5901 |
| USERNAME_REGISTRY_MINT_FLUSH_PRUNE | 6 | 22415887 | 6305229 | 41572 |
| VAULT_BALANCE_PUBLISH | 2 | 19181146 | 10481550 | 96926 |

## Operation details

### ATH_TRANSFER_SUCCESS

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| owner_to_recipient_wallet | 5 | 4015673 | 2343136 | 14601 | 0 | 0 |

### ATH_BURN_SUCCESS

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| wallet_to_master_burn_finalized | 4 | 1384469 | 583756 | 8226 | 0 | 0 |

### CAPSULEHUB_VAULT_PUBLISH_AND_FLUSH_BOUNCE

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| private_vault_publish | 2 | 5462134 | 5462134 | 81360 | 1 | 0 |
| public_vault_publish | 2 | 4558001 | 4558001 | 67798 | 1 | 0 |
| flush_fee_to_missing_accumulator_bounce | 3 | 1086779 | 795355 | 11597 | 1 | 1 |

### FEEACCUMULATOR_SPLIT_FLUSH

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| deposit_bootstrap_protocol_fee | 2 | 468424 | 270823 | 2964 | 0 | 0 |
| enable_buyback_split | 2 | 486090 | 262289 | 3357 | 0 | 0 |
| flush_bootstrap_treasury_due | 3 | 649713 | 358289 | 5041 | 0 | 0 |
| deposit_post_enable_protocol_fee | 2 | 470424 | 271356 | 2986 | 0 | 0 |
| split_accumulated | 2 | 482757 | 262289 | 3307 | 0 | 0 |
| flush_treasury_due | 3 | 649713 | 358289 | 5041 | 0 | 0 |
| flush_buyback_due_bounce | 4 | 907445 | 421400 | 5901 | 1 | 0 |

### USERNAME_REGISTRY_MINT_FLUSH_PRUNE

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| valid_username_mint_with_item_ack | 4 | 6079485 | 3172928 | 41572 | 1 | 1 |
| invalid_username_rejected_notification | 2 | 1386556 | 1130822 | 16629 | 2 | 2 |
| flush_treasury_due_ath | 6 | 6305229 | 2343136 | 20806 | 0 | 0 |
| flush_burn_due_ath | 5 | 3600225 | 1194023 | 17380 | 0 | 0 |
| stuck_pending_mint_creation_no_ack | 2 | 3314462 | 3172928 | 41572 | 0 | 0 |
| prune_stale_pending_mint | 3 | 1729930 | 1424935 | 9971 | 1 | 1 |

### VAULT_BALANCE_PUBLISH

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| vault_balance_private_publish_to_capsulehub_ack | 2 | 8699596 | 8678995 | 96926 | 0 | 0 |
| vault_balance_private_publish_to_missing_capsulehub_bounce | 3 | 10481550 | 8678995 | 96926 | 1 | 0 |

## Result

No implemented-subset scenario exceeded the broad M17 sanity thresholds. This does not finalize mainnet gas constants; it only prevents obvious reserve regressions while BuybackBurn/STON.fi values remain blocked.
