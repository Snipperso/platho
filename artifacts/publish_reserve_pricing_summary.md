# Publish Reserve Pricing Report

Status: **PASS**

Current code hashes:

- Vault: `0d61d8de253b3bc49f50d8a46006de2082909a4d7743aa0e994cb701ace1083b`
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
| public_post | 33700000 | 4436242 | 1229956 | 2154668 | 1394040 | 28600000 | 34200000 | 39800000 |
| private_hybrid_1k | 34700000 | 8276084 | 2140023 | 2154668 | 2124022 | 39600000 | 48100000 | 56600000 |
| private_hybrid_2k | 36600000 | 9167702 | 2207356 | 2154668 | 2124022 | 41600000 | 50100000 | 58600000 |
| private_hybrid_4k | 40300000 | 10916207 | 2328023 | 2154668 | 2124022 | 45300000 | 53800000 | 62300000 |
| private_hybrid_8k | 47900000 | 14356618 | 2555356 | 2154668 | 2124022 | 52700000 | 61200000 | 69700000 |
| private_hybrid_16k | 63200000 | 21222794 | 3001489 | 2154668 | 2124022 | 67300000 | 75800000 | 84300000 |
| private_hybrid_32k | 93700000 | 34881257 | 3858156 | 2154668 | 2124022 | 96300000 | 104800000 | 113300000 |
