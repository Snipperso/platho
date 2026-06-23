# CapsuleHub Storage Economics Report

Status: **PASS**

Sandbox evidence for canonical final CapsuleHub index cells. Body payload cells are validated in the publish transaction and authenticated by stored hashes, but only compact headers/indexes remain in CapsuleHub state. Pages are virtual ranges derived from entry ids. Retained margin includes accrued protocol fee because FlushFees is gated by protectedReserve(), so accrued fee cannot be drained while index storage reserve is not backed. This is not a mainnet storage-rent oracle.

CapsuleHub code hash: `b7ec6e2dfa9426ebab383883c85fe47a0d126c940b41ee614ef9b2c30f84d21a`
Minimum retained margin gate: **1000000 nanotons**.

| Case | Inbound | Fee delta | Balance delta | Retained non-fee | Required storage | Margin |
|---|---:|---:|---:|---:|---:|---:|
| VAULT_PRIVATE_HYBRID_1K | 59375000 | 10000000 | 15375000 | 5375000 | 4300000 | 11075000 |
| VAULT_PRIVATE_HYBRID_2K | 59375000 | 10000000 | 15375000 | 5375000 | 4300000 | 11075000 |
| VAULT_PRIVATE_HYBRID_4K | 59375000 | 10000000 | 15375000 | 5375000 | 4300000 | 11075000 |
| VAULT_PRIVATE_HYBRID_8K | 59375000 | 10000000 | 15375000 | 5375000 | 4300000 | 11075000 |
| VAULT_PRIVATE_HYBRID_16K | 59375000 | 10000000 | 15375000 | 5375000 | 4300000 | 11075000 |
| VAULT_PRIVATE_HYBRID_32K | 59375000 | 10000000 | 15375000 | 5375000 | 4300000 | 11075000 |
| VAULT_PUBLIC_1K | 67000000 | 10000000 | 23000000 | 13000000 | 10400000 | 12600000 |
| VAULT_PUBLIC_2K | 67000000 | 10000000 | 23000000 | 13000000 | 10400000 | 12600000 |
| VAULT_PUBLIC_4K | 67000000 | 10000000 | 23000000 | 13000000 | 10400000 | 12600000 |
| VAULT_PUBLIC_8K | 67000000 | 10000000 | 23000000 | 13000000 | 10400000 | 12600000 |
| VAULT_PUBLIC_16K | 67000000 | 10000000 | 23000000 | 13000000 | 10400000 | 12600000 |
| VAULT_PUBLIC_32K | 67000000 | 10000000 | 23000000 | 13000000 | 10400000 | 12600000 |

Worst retained margin: **11075000 nanotons**.
