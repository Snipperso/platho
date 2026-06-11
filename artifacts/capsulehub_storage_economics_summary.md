# CapsuleHub Storage Economics Report

Status: **PASS**

Sandbox evidence for canonical final CapsuleHub index cells. Body payload cells are validated in the publish transaction and authenticated by stored hashes, but only compact headers/indexes remain in CapsuleHub state. Pages are virtual ranges derived from entry ids. Retained margin includes accrued protocol fee because FlushFees is gated by protectedReserve(), so accrued fee cannot be drained while index storage reserve is not backed. This is not a mainnet storage-rent oracle.

CapsuleHub code hash: `2d16b0ba66fc6df66b1f890890b96ea0aaa5a7ece2ef2db8368c4f045ea40e7a`
Minimum retained margin gate: **1000000 nanotons**.

| Case | Inbound | Fee delta | Balance delta | Retained non-fee | Required storage | Margin |
|---|---:|---:|---:|---:|---:|---:|
| VAULT_PRIVATE_HYBRID_1K | 48500000 | 10000000 | 15541064 | 5541064 | 4300000 | 11241064 |
| VAULT_PRIVATE_HYBRID_2K | 48600000 | 10000000 | 15573731 | 5573731 | 4300000 | 11273731 |
| VAULT_PRIVATE_HYBRID_4K | 48800000 | 10000000 | 15653064 | 5653064 | 4300000 | 11353064 |
| VAULT_PRIVATE_HYBRID_8K | 49300000 | 10000000 | 15925731 | 5925731 | 4300000 | 11625731 |
| VAULT_PRIVATE_HYBRID_16K | 50100000 | 10000000 | 16273598 | 6273598 | 4300000 | 11973598 |
| VAULT_PRIVATE_HYBRID_32K | 51900000 | 10000000 | 17216264 | 7216264 | 4300000 | 12916264 |
| VAULT_PUBLIC_1K | 52600000 | 10000000 | 20591931 | 10591931 | 8400000 | 12191931 |
| VAULT_PUBLIC_2K | 52700000 | 10000000 | 20622864 | 10622864 | 8400000 | 12222864 |
| VAULT_PUBLIC_4K | 52900000 | 10000000 | 20700464 | 10700464 | 8400000 | 12300464 |
| VAULT_PUBLIC_8K | 53400000 | 10000000 | 20971398 | 10971398 | 8400000 | 12571398 |
| VAULT_PUBLIC_16K | 54200000 | 10000000 | 21323531 | 11323531 | 8400000 | 12923531 |
| VAULT_PUBLIC_32K | 56000000 | 10000000 | 22267531 | 12267531 | 8400000 | 13867531 |

Worst retained margin: **11241064 nanotons**.
