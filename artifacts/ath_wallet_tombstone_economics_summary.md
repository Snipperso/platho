# ATHWallet Tombstone Economics Report

Status: **PASS**

Sandbox evidence that finalized/pruned ATH notification tombstones retain at least ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT after conservatively subtracting the terminal ACK/prune caller value. This is not a mainnet rent oracle; it is release evidence that the value envelope preserves tombstone backing across supported notification variants.

ATHWallet code hash: `8ab0003bb57c01a359cb9d7642a3c15d7a1550d989fcf8bca6677f7da874e077`
Required tombstone endowment: **20000000 nanotons**.

| Case | Terminal | Inbound | Terminal caller value | Retained excl. terminal | Margin |
|---|---|---:|---:|---:|---:|
| NORMAL_NOTIFY_ACK | ack | 77000000 | 1000000 | 23864861 | 3864861 |
| VAULT_USERNAME_NOTIFY_ACK | ack | 79000000 | 1000000 | 24911461 | 4911461 |
| VAULT_PROFILE_NOTIFY_ACK | ack | 79000000 | 1000000 | 24818861 | 4818861 |
| NORMAL_NOTIFY_STALE_PRUNE | prune | 77000000 | 2000000 | 24936946 | 4936946 |

Worst retained margin: **3864861 nanotons**.
