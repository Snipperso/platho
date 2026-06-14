# CapsuleHub Storage Economics Report

Status: **PASS**

Sandbox evidence for canonical final CapsuleHub index cells. Body payload cells are validated in the publish transaction and authenticated by stored hashes, but only compact headers/indexes remain in CapsuleHub state. Pages are virtual ranges derived from entry ids. Retained margin includes accrued protocol fee because FlushFees is gated by protectedReserve(), so accrued fee cannot be drained while index storage reserve is not backed. This is not a mainnet storage-rent oracle.

CapsuleHub code hash: `f72823a4c01afd938143201dddff03f5193143e116366ce35a69e46662607791`
Minimum retained margin gate: **1000000 nanotons**.

| Case | Inbound | Fee delta | Balance delta | Retained non-fee | Required storage | Margin |
|---|---:|---:|---:|---:|---:|---:|
| VAULT_PRIVATE_HYBRID_1K | 52375000 | 10000000 | 15375000 | 5375000 | 4300000 | 11075000 |
| VAULT_PRIVATE_HYBRID_2K | 52375000 | 10000000 | 15375000 | 5375000 | 4300000 | 11075000 |
| VAULT_PRIVATE_HYBRID_4K | 52375000 | 10000000 | 15375000 | 5375000 | 4300000 | 11075000 |
| VAULT_PRIVATE_HYBRID_8K | 52375000 | 10000000 | 15375000 | 5375000 | 4300000 | 11075000 |
| VAULT_PRIVATE_HYBRID_16K | 52375000 | 10000000 | 15375000 | 5375000 | 4300000 | 11075000 |
| VAULT_PRIVATE_HYBRID_32K | 52375000 | 10000000 | 15375000 | 5375000 | 4300000 | 11075000 |
| VAULT_PUBLIC_1K | 57500000 | 10000000 | 20500000 | 10500000 | 8400000 | 12100000 |
| VAULT_PUBLIC_2K | 57500000 | 10000000 | 20500000 | 10500000 | 8400000 | 12100000 |
| VAULT_PUBLIC_4K | 57500000 | 10000000 | 20500000 | 10500000 | 8400000 | 12100000 |
| VAULT_PUBLIC_8K | 57500000 | 10000000 | 20500000 | 10500000 | 8400000 | 12100000 |
| VAULT_PUBLIC_16K | 57500000 | 10000000 | 20500000 | 10500000 | 8400000 | 12100000 |
| VAULT_PUBLIC_32K | 57500000 | 10000000 | 20500000 | 10500000 | 8400000 | 12100000 |

Worst retained margin: **11075000 nanotons**.
