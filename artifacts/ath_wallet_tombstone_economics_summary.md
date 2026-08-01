# ATHWallet Tombstone Economics Report

Status: **PASS**

Sandbox evidence that finalized/pruned ATH notification tombstones retain at least ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT after conservatively subtracting the terminal ACK/prune caller value. This is not a mainnet rent oracle; it is release evidence that the value envelope preserves tombstone backing across supported notification variants.

ATHWallet code hash: `0ec124d7ad05428b347ef1615831f9e60e5c4df5d2f0a0127a9c9df7ccdd9b20`
Required tombstone endowment: **20000000 nanotons**.

| Case | Terminal | Inbound | Terminal caller value | Retained excl. terminal | Margin |
|---|---|---:|---:|---:|---:|
| NORMAL_NOTIFY_ACK | ack | 77000000 | 1000000 | 23931795 | 3931795 |
| VAULT_USERNAME_NOTIFY_ACK | ack | 79000000 | 1000000 | 24969995 | 4969995 |
| VAULT_PROFILE_NOTIFY_ACK | ack | 79000000 | 1000000 | 24888594 | 4888594 |
| NORMAL_NOTIFY_STALE_PRUNE | prune | 77000000 | 2000000 | 25011268 | 5011268 |

Worst retained margin: **3931795 nanotons**.
