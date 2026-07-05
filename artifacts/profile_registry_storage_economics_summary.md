# ProfileRegistry Storage Economics Report

Status: **PASS**

Sandbox evidence that accepted ProfileRegistry avatar updates retain enough TON after ACK/refund actions to cover the permanent avatar record and owner-version map endowments. This is not a mainnet rent oracle; it is a release gate against underfunded permanent avatar pointer growth.

ProfileRegistry code hash: `7fe92293fbf9afabb5cd65c3275c0f80e8fb38fcf796b7143f90b3f9187663bc`

| Case | Updates | Retained delta | Permanent endowment | Margin |
|---|---:|---:|---:|---:|
| VAULT_FIRST_AVATAR | 1 | 46302399 | 45000000 | 1302399 |
| VAULT_REPEAT_AVATAR | 1 | 37213999 | 36000000 | 1213999 |
| VAULT_MANY_OWNERS_12 | 12 | 552562122 | 540000000 | 12562122 |
| VAULT_MANY_UPDATES_ONE_OWNER_10 | 10 | 380561723 | 369000000 | 11561723 |

Minimum retained margin gate: **1000000 nanotons**.
Worst retained margin vs permanent endowment: **1213999 nanotons**.
