# Publish Reserve Pricing Report

Status: **PASS**

Current code hashes:

- Vault: `265128b6433387ba900e130a73410b7a6cce1436983b4a81af16a59cefe75bf8`
- CapsuleHub: `fc0dd2f1b836145e25ccd51c0f7ab8acfc9f9dcf832e86e4c17f04a886789f0e`
- ATHWallet: `6d9d3dff2368d22a4148a48e71d6c91561b6db6ea64d7c14c506445202e13270`

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
| public_post | 33700000 | 4441909 | 1229956 | 2147134 | 1394040 | 28500000 | 34100000 | 39700000 |
| private_hybrid_1k | 34700000 | 8295750 | 2140023 | 2147134 | 2124022 | 39500000 | 48000000 | 56500000 |
| private_hybrid_2k | 36600000 | 9187369 | 2207356 | 2147134 | 2124022 | 41500000 | 50000000 | 58500000 |
| private_hybrid_4k | 40300000 | 10935874 | 2328023 | 2147134 | 2124022 | 45200000 | 53700000 | 62200000 |
| private_hybrid_8k | 47900000 | 14376285 | 2555356 | 2147134 | 2124022 | 52600000 | 61100000 | 69600000 |
| private_hybrid_16k | 63200000 | 21242461 | 3001489 | 2147134 | 2124022 | 67200000 | 75700000 | 84200000 |
| private_hybrid_32k | 93700000 | 34900924 | 3858156 | 2147134 | 2124022 | 96300000 | 104800000 | 113300000 |
