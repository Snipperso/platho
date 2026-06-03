# ProfileRegistry Storage Economics Report

Status: **PASS**

Sandbox evidence that accepted ProfileRegistry avatar updates retain enough TON after ACK/refund actions to cover the permanent avatar record and owner-version map endowments. This is not a mainnet rent oracle; it is a release gate against underfunded permanent avatar pointer growth.

ProfileRegistry code hash: `6437b6631d0b310781fef9efa214640c69a3ae684dae2c4be5b463a673ed7e29`

| Case | Updates | Retained delta | Permanent endowment | Margin |
|---|---:|---:|---:|---:|
| VAULT_FIRST_AVATAR | 1 | 10302399 | 9000000 | 1302399 |
| VAULT_REPEAT_AVATAR | 1 | 7213999 | 6000000 | 1213999 |
| VAULT_MANY_OWNERS_12 | 12 | 120562122 | 108000000 | 12562122 |
| VAULT_MANY_UPDATES_ONE_OWNER_10 | 10 | 74561723 | 63000000 | 11561723 |

Minimum retained margin gate: **1000000 nanotons**.
Worst retained margin vs permanent endowment: **1213999 nanotons**.
