# ATHWallet Tombstone Economics Report

Status: **PASS**

Sandbox evidence that finalized/pruned ATH notification tombstones retain at least ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT after conservatively subtracting the terminal ACK/prune caller value. This is not a mainnet rent oracle; it is release evidence that the value envelope preserves tombstone backing across supported notification variants.

ATHWallet code hash: `042e3ac22f441e988a2652cb346f61f61c10263d87c688e237ec00c03fac1466`
Required tombstone endowment: **20000000 nanotons**.

| Case | Terminal | Inbound | Terminal caller value | Retained excl. terminal | Margin |
|---|---|---:|---:|---:|---:|
| NORMAL_NOTIFY_ACK | ack | 59000000 | 1000000 | 23751794 | 3751794 |
| VAULT_USERNAME_NOTIFY_ACK | ack | 61000000 | 1000000 | 24836260 | 4836260 |
| VAULT_PROFILE_NOTIFY_ACK | ack | 61000000 | 1000000 | 24710060 | 4710060 |
| NORMAL_NOTIFY_STALE_PRUNE | prune | 59000000 | 2000000 | 24834533 | 4834533 |

Worst retained margin: **3751794 nanotons**.
