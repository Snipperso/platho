# CapsuleHub Storage Economics Report

Status: **PASS**

Sandbox evidence for canonical final CapsuleHub cells. Page boundaries are metadata-only and do not change publish price. This proves current v1 private fixed-size payloads and bounded public payloads retain the configured non-fee entry reserve after transaction fees; it is not a mainnet storage-rent oracle.

| Case | Inbound | Fee delta | Balance delta | Retained non-fee | Required storage | Margin |
|---|---:|---:|---:|---:|---:|---:|
| VAULT_PRIVATE_STANDARD | 43000000 | 5000000 | 11356064 | 6356064 | 5000000 | 1356064 |
| VAULT_PRIVATE_HYBRID | 49000000 | 10000000 | 17283998 | 7283998 | 5000000 | 2283998 |
| VAULT_PUBLIC_STANDARD | 40000000 | 5000000 | 8700798 | 3700798 | 2000000 | 1700798 |

Worst retained margin: **1356064 nanotons**.
