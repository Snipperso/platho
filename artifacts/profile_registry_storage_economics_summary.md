# ProfileRegistry Storage Economics Report

Status: **PASS**

Sandbox evidence that accepted ProfileRegistry avatar updates retain enough TON after ACK/refund actions to cover the permanent avatar record and owner-version map endowments. This is not a mainnet rent oracle; it is a release gate against underfunded permanent avatar pointer growth.

ProfileRegistry code hash: `4bb7e84048b4ed42312d686032f4da649f33cdbb035ad8f8d9a444ac9b7ba4f1`

| Case | Updates | Vault-funded | Retained delta | Permanent endowment | Margin |
|---|---:|---|---:|---:|---:|
| DIRECT_FIRST_AVATAR | 1 | false | 10349999 | 9000000 | 1349999 |
| DIRECT_REPEAT_AVATAR | 1 | false | 7261599 | 6000000 | 1261599 |
| VAULT_FIRST_AVATAR | 1 | true | 10266199 | 9000000 | 1266199 |
| VAULT_REPEAT_AVATAR | 1 | true | 7177799 | 6000000 | 1177799 |
| DIRECT_MANY_OWNERS_12 | 12 | false | 121049987 | 108000000 | 13049987 |
| DIRECT_MANY_UPDATES_ONE_OWNER_10 | 10 | false | 75079389 | 63000000 | 12079389 |
| VAULT_MANY_UPDATES_ONE_OWNER_10 | 10 | true | 74199723 | 63000000 | 11199723 |

Minimum retained margin gate: **1000000 nanotons**.
Worst retained margin vs permanent endowment: **1177799 nanotons**.
