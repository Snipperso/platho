# ProfileRegistry Storage Economics Report

Status: **PASS**

Sandbox evidence for the two properties that survived the 2026-07-21 pointer move: the registry account does NOT grow with the number of profiles (it used to grow 5.0000 cells each, capping the product at 13,076 profiles silently), and a settled purchase does not cost the registry TON. Per-profile storage endowments are gone with the state they funded; the buyer KeyShard funds its own rent, measured in tests/key-shard.test.ts KS-RENT-01. This is not a mainnet rent oracle; it is a release gate.

ProfileRegistry code hash: `8cf1577a88e4c1c46641008244430820670906cdd17d63dc04de86dc2a32533a`

| Case | Owners | Updates | Retained delta | Registry cells | Cells per owner |
|---|---:|---:|---:|---:|---:|
| DIRECT_FIRST_AVATAR | 1 | 1 | 55654729 | 3 | 0 |
| DIRECT_REPEAT_AVATAR | 1 | 1 | 55628595 | 3 | 0 |
| DIRECT_MANY_OWNERS_12 | 12 | 12 | 667852980 | 3 | 0 |
| DIRECT_MANY_UPDATES_ONE_OWNER_10 | 1 | 10 | 556308944 | 3 | 0 |

Minimum retained margin gate: **1000000 nanotons**.
Worst retained margin: **55628595 nanotons**.
Worst cells per owner (must be 0): **0**.
