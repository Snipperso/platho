# Publish Reserve Pricing Report

Status: **PASS**

Current code hashes:

- Vault: `a4dc953ed8f4eda13aba885b9942b05836a7e291a9215946bbfa8d87698ffc4e`
- CapsuleHub: `fc0dd2f1b836145e25ccd51c0f7ab8acfc9f9dcf832e86e4c17f04a886789f0e`
- ATHWallet: `4c90b0f1b65eea96df7992409e1819b73f63f1ae2ecb9f651c42174c85f7b88d`

Policy: current contract constants are the release constants. Observed fees are measured with the bundled sandbox config matching the audited TON mainnet basechain fee snapshot. The x2 columns are reference sizing only; PASS does not require reserves to equal a 2x target.

Fee snapshot:

- Source: @ton/sandbox defaultConfig, verified against TON mainnet config on 2026-06-02
- Config 18 latest basechain storage since: `1777500000`
- Config 18 basechain bit/cell prices ps: `0` / `135`
- Config 21 flat gas price: `6667`
- Config 21 gas price: `4369067`
- Config 25 lump/bit/cell prices: `66667` / `4369067` / `436906667`

| Case | Current net | Vault fee | Capsule fee | ACK fee | 1y storage | Reference x2 net 1y | Reference x2 net 3y | Reference x2 net 5y |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| public_post | 33700000 | 4399909 | 1229956 | 2179001 | 1394040 | 28500000 | 34100000 | 39700000 |
| private_hybrid_1k | 34700000 | 8253750 | 2140023 | 2179001 | 2124022 | 39600000 | 48100000 | 56600000 |
| private_hybrid_2k | 36600000 | 9145369 | 2207356 | 2179001 | 2124022 | 41500000 | 50000000 | 58500000 |
| private_hybrid_4k | 40300000 | 10893874 | 2328023 | 2179001 | 2124022 | 45200000 | 53700000 | 62200000 |
| private_hybrid_8k | 47900000 | 14334285 | 2555356 | 2179001 | 2124022 | 52600000 | 61100000 | 69600000 |
| private_hybrid_16k | 63200000 | 21200461 | 3001489 | 2179001 | 2124022 | 67300000 | 75800000 | 84300000 |
| private_hybrid_32k | 93700000 | 34858924 | 3858156 | 2179001 | 2124022 | 96300000 | 104800000 | 113300000 |
