# CapsuleHub Storage Economics Report

Status: **PASS**

Sandbox evidence for canonical final CapsuleHub index cells. Body payload cells are validated in the publish transaction and authenticated by stored hashes, but only compact headers/indexes remain in CapsuleHub state. Pages are virtual ranges derived from entry ids; this is not a mainnet storage-rent oracle.

CapsuleHub code hash: `fc0dd2f1b836145e25ccd51c0f7ab8acfc9f9dcf832e86e4c17f04a886789f0e`
Minimum retained margin gate: **1000000 nanotons**.

| Case | Inbound | Fee delta | Balance delta | Retained non-fee | Required storage | Margin |
|---|---:|---:|---:|---:|---:|---:|
| VAULT_PRIVATE_HYBRID_1K | 48500000 | 10000000 | 16287798 | 6287798 | 4300000 | 1987798 |
| VAULT_PRIVATE_HYBRID_2K | 48600000 | 10000000 | 16320464 | 6320464 | 4300000 | 2020464 |
| VAULT_PRIVATE_HYBRID_4K | 48800000 | 10000000 | 16399798 | 6399798 | 4300000 | 2099798 |
| VAULT_PRIVATE_HYBRID_8K | 49300000 | 10000000 | 16672464 | 6672464 | 4300000 | 2372464 |
| VAULT_PRIVATE_HYBRID_16K | 50100000 | 10000000 | 17026331 | 7026331 | 4300000 | 2726331 |
| VAULT_PRIVATE_HYBRID_32K | 51900000 | 10000000 | 17969664 | 7969664 | 4300000 | 3669664 |
| VAULT_PUBLIC_POST | 50800000 | 10000000 | 19497864 | 9497864 | 8400000 | 1097864 |

Worst retained margin: **1097864 nanotons**.
