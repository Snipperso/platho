# ATHWallet Tombstone Economics Report

Status: **PASS**

Sandbox evidence that finalized/pruned ATH notification tombstones retain at least ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT after conservatively subtracting the terminal ACK/prune caller value. This is not a mainnet rent oracle; it is release evidence that the value envelope preserves tombstone backing across supported notification variants.

ATHWallet code hash: `bbe3157b05b8d9cc7bae1a3aacd690301e3a16a45a0657b96fb28fdfcf442f50`
Required tombstone endowment: **20000000 nanotons**.

| Case | Terminal | Inbound | Terminal caller value | Retained excl. terminal | Margin |
|---|---|---:|---:|---:|---:|
| NORMAL_NOTIFY_ACK | ack | 74000000 | 1000000 | 23937462 | 3937462 |
| VAULT_USERNAME_NOTIFY_ACK | ack | 76000000 | 1000000 | 24975662 | 4975662 |
| VAULT_PROFILE_NOTIFY_ACK | ack | 76000000 | 1000000 | 24894261 | 4894261 |
| NORMAL_NOTIFY_STALE_PRUNE | prune | 74000000 | 2000000 | 25022805 | 5022805 |

Worst retained margin: **3937462 nanotons**.
