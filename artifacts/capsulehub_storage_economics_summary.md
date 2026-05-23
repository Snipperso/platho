# CapsuleHub Storage Economics Report

Status: **PASS**

Sandbox evidence for canonical final CapsuleHub cells. Page boundaries are metadata-only and do not change publish price. This proves current v1 private fixed-size payloads and bounded public payloads retain the configured non-fee entry reserve after transaction fees; it is not a mainnet storage-rent oracle.

| Case | Inbound | Fee delta | Balance delta | Retained non-fee | Required storage | Margin |
|---|---:|---:|---:|---:|---:|---:|
| VAULT_PRIVATE_STANDARD | 43000000 | 5000000 | 11358998 | 6358998 | 5000000 | 1358998 |
| VAULT_PRIVATE_HYBRID | 49000000 | 10000000 | 17286931 | 7286931 | 5000000 | 2286931 |
| VAULT_PUBLIC_STANDARD | 40000000 | 5000000 | 8703731 | 3703731 | 2000000 | 1703731 |

Worst retained margin: **1358998 nanotons**.
