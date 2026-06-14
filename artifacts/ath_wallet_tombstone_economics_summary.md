# ATHWallet Tombstone Economics Report

Status: **PASS**

Sandbox evidence that finalized/pruned ATH notification tombstones retain at least ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT after conservatively subtracting the terminal ACK/prune caller value. This is not a mainnet rent oracle; it is release evidence that the value envelope preserves tombstone backing across supported notification variants.

ATHWallet code hash: `3d0f027840bc604e1e69d19f764543372f362096e2ead3c689c83e8f00966ce4`
Required tombstone endowment: **20000000 nanotons**.

| Case | Terminal | Inbound | Terminal caller value | Retained excl. terminal | Margin |
|---|---|---:|---:|---:|---:|
| NORMAL_NOTIFY_ACK | ack | 59000000 | 1000000 | 23751794 | 3751794 |
| VAULT_USERNAME_NOTIFY_ACK | ack | 61000000 | 1000000 | 24836260 | 4836260 |
| VAULT_PROFILE_NOTIFY_ACK | ack | 61000000 | 1000000 | 24710060 | 4710060 |
| JETTON_NOTIFY_ACK | ack | 59000000 | 1000000 | 23647994 | 3647994 |
| NORMAL_NOTIFY_STALE_PRUNE | prune | 59000000 | 2000000 | 24833241 | 4833241 |

Worst retained margin: **3647994 nanotons**.
