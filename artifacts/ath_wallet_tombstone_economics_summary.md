# ATHWallet Tombstone Economics Report

Status: **PASS**

Sandbox evidence that finalized/pruned ATH notification tombstones retain at least ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT after conservatively subtracting the terminal ACK/prune caller value. This is not a mainnet rent oracle; it is release evidence that the value envelope preserves tombstone backing across supported notification variants.

ATHWallet code hash: `844a125f5d950c7c965bbab08a1e523acf5186750f0c648bbd98b95f2378f719`
Required tombstone endowment: **20000000 nanotons**.

| Case | Terminal | Inbound | Terminal caller value | Retained excl. terminal | Margin |
|---|---|---:|---:|---:|---:|
| NORMAL_NOTIFY_ACK | ack | 77000000 | 1000000 | 23931795 | 3931795 |
| VAULT_USERNAME_NOTIFY_ACK | ack | 79000000 | 1000000 | 24969995 | 4969995 |
| VAULT_PROFILE_NOTIFY_ACK | ack | 79000000 | 1000000 | 24888594 | 4888594 |
| NORMAL_NOTIFY_STALE_PRUNE | prune | 77000000 | 2000000 | 25011300 | 5011300 |

Worst retained margin: **3931795 nanotons**.
