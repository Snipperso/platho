# ATHWallet Tombstone Economics Report

Status: **PASS**

Sandbox evidence that finalized/pruned ATH notification tombstones retain at least ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT after conservatively subtracting the terminal ACK/prune caller value. This is not a mainnet rent oracle; it is release evidence that the value envelope preserves tombstone backing across supported notification variants.

ATHWallet code hash: `4c90b0f1b65eea96df7992409e1819b73f63f1ae2ecb9f651c42174c85f7b88d`
Required tombstone endowment: **2000000 nanotons**.

| Case | Terminal | Inbound | Terminal caller value | Retained excl. terminal | Margin |
|---|---|---:|---:|---:|---:|
| NORMAL_NOTIFY_ACK | ack | 41000000 | 1000000 | 5704328 | 3704328 |
| USERNAME_NOTIFY_ACK | ack | 41000000 | 1000000 | 5705194 | 3705194 |
| PROFILE_NOTIFY_ACK | ack | 41000000 | 1000000 | 5564527 | 3564527 |
| VAULT_USERNAME_NOTIFY_ACK | ack | 43000000 | 1000000 | 6783127 | 4783127 |
| VAULT_PROFILE_NOTIFY_ACK | ack | 43000000 | 1000000 | 6651260 | 4651260 |
| JETTON_NOTIFY_ACK | ack | 41000000 | 1000000 | 5607860 | 3607860 |
| NORMAL_NOTIFY_STALE_PRUNE | prune | 41000000 | 2000000 | 6755162 | 4755162 |

Worst retained margin: **3564527 nanotons**.
