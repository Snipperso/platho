# Platho M17 Gas / Reserve Sanity Report

Status: **PASS**

Sandbox gas/reserve sanity pass for implemented subset. Not a final mainnet gas freeze. Thresholds are broad regression guards, not protocol reserves.

| Scenario | Operations | Total fees, nanotons | Max op fee, nanotons | Max gas used |
|---|---:|---:|---:|---:|
| ATH_TRANSFER_SUCCESS | 1 | 2378103 | 2378103 | 9847 |
| ATH_BURN_SUCCESS | 1 | 1321536 | 1321536 | 7932 |
| CAPSULEHUB_DIRECT_PUBLISH_AND_FLUSH_BOUNCE | 3 | 3363605 | 1258690 | 13586 |
| FEEACCUMULATOR_SPLIT_FLUSH | 4 | 2038073 | 632179 | 4778 |
| USERNAME_REGISTRY_MINT_FLUSH_PRUNE | 7 | 22178420 | 4536481 | 32478 |
| VAULT_EXTERNAL_PUBLISH | 2 | 11394627 | 6717781 | 46783 |

## Operation details

### ATH_TRANSFER_SUCCESS

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| owner_to_recipient_wallet | 4 | 2378103 | 1426856 | 9847 | 0 | 0 |

### ATH_BURN_SUCCESS

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| wallet_to_master_burn_finalized | 4 | 1321536 | 564156 | 7932 | 0 | 0 |

### CAPSULEHUB_DIRECT_PUBLISH_AND_FLUSH_BOUNCE

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| private_direct_publish | 2 | 1258690 | 905734 | 13586 | 0 | 0 |
| public_direct_publish | 2 | 1102358 | 772601 | 11589 | 0 | 0 |
| flush_fee_to_missing_accumulator_bounce | 3 | 1002557 | 711133 | 10247 | 0 | 0 |

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
| valid_username_mint_with_item_ack | 4 | 3955801 | 2317221 | 32478 | 1 | 1 |
| invalid_username_refund_due | 3 | 1884556 | 1625955 | 23604 | 2 | 1 |
| flush_ath_refund_due | 5 | 4536481 | 1447889 | 21099 | 0 | 0 |
| flush_treasury_due_ath | 5 | 4315258 | 1423789 | 17911 | 0 | 0 |
| flush_burn_due_ath | 5 | 3151758 | 1030689 | 14930 | 0 | 0 |
| stuck_pending_mint_creation_no_ack | 3 | 2717356 | 2317221 | 32478 | 1 | 1 |
| prune_stale_pending_mint | 2 | 1617210 | 1332816 | 15788 | 0 | 0 |

### VAULT_EXTERNAL_PUBLISH

| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |
|---|---:|---:|---:|---:|---:|---:|
| external_private_publish_to_capsulehub_ack | 3 | 6717781 | 3401824 | 46783 | 0 | 0 |
| external_private_publish_to_missing_capsulehub_bounce | 3 | 4676846 | 3401824 | 46783 | 1 | 0 |

## Result

No implemented-subset scenario exceeded the broad M17 sanity thresholds. This does not finalize mainnet gas constants; it only prevents obvious reserve regressions while BuybackBurn/STON.fi values remain blocked.
