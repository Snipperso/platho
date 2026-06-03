# ATHWallet Tombstone Economics Report

Status: **PASS**

Sandbox evidence that finalized/pruned ATH notification tombstones retain at least ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT after conservatively subtracting the terminal ACK/prune caller value. This is not a mainnet rent oracle; it is release evidence that the value envelope preserves tombstone backing across supported notification variants.

ATHWallet code hash: `6d9d3dff2368d22a4148a48e71d6c91561b6db6ea64d7c14c506445202e13270`
Required tombstone endowment: **2000000 nanotons**.

| Case | Terminal | Inbound | Terminal caller value | Retained excl. terminal | Margin |
|---|---|---:|---:|---:|---:|
| NORMAL_NOTIFY_ACK | ack | 41000000 | 1000000 | 5751794 | 3751794 |
| VAULT_USERNAME_NOTIFY_ACK | ack | 43000000 | 1000000 | 6836260 | 4836260 |
| VAULT_PROFILE_NOTIFY_ACK | ack | 43000000 | 1000000 | 6710060 | 4710060 |
| JETTON_NOTIFY_ACK | ack | 41000000 | 1000000 | 5647994 | 3647994 |
| NORMAL_NOTIFY_STALE_PRUNE | prune | 41000000 | 2000000 | 6833293 | 4833293 |

Worst retained margin: **3647994 nanotons**.
