# Publish Reserve Pricing Report

Status: **PASS**

Current code hashes:

- Vault: `41d0e25a72d0505c4ef16503eb5d1d1dfed92bdc622fd6edc6b202166b998e87`
- CapsuleHub: `b7ec6e2dfa9426ebab383883c85fe47a0d126c940b41ee614ef9b2c30f84d21a`
- ATHWallet: `3d0f027840bc604e1e69d19f764543372f362096e2ead3c689c83e8f00966ce4`

Policy: the canonical max charge (hold), net price, and 0.010 TON protocol fee per size class are the client message-pricing-policy tables; the measured fees are sandbox evidence from a signed VPB2 batch external driven through the bound+sealed Vault + CapsuleHub at the current code hashes. Observed fees use the bundled sandbox config matching the audited TON mainnet basechain fee snapshot. The x2 columns are reference sizing only; PASS does not require reserves to equal a 2x target.

Fee snapshot:

- Source: @ton/sandbox defaultConfig, verified against TON mainnet config on 2026-06-02
- Config 18 latest basechain storage since: `1777500000`
- Config 18 basechain bit/cell prices ps: `0` / `135`
- Config 21 flat gas price: `6667`
- Config 21 gas price: `4369067`
- Config 25 lump/bit/cell prices: `66667` / `4369067` / `436906667`

| Case | Hold | Net price | Observed settled | Vault fee | Capsule fee | ACK fee | 1y storage | Reference x2 net 1y | Reference x2 net 3y | Reference x2 net 5y |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| public_1k | 169800000 | 39000000 | 38725740 | 6830109 | 4096934 | 2265801 | 1895932 | 40300000 | 47900000 | 55500000 |
| public_2k | 170800000 | 40200000 | 39986673 | 7702995 | 4158934 | 2265801 | 1895932 | 42300000 | 49900000 | 57500000 |
| public_4k | 171800000 | 42700000 | 42499873 | 9441834 | 4274267 | 2265801 | 1895932 | 45900000 | 53500000 | 61100000 |
| public_8k | 172800000 | 47800000 | 47517608 | 12912577 | 4496268 | 2265801 | 1895932 | 53300000 | 60900000 | 68500000 |
| public_16k | 175800000 | 57800000 | 57564409 | 19864353 | 4938268 | 2265801 | 1895932 | 68100000 | 75700000 | 83300000 |
| public_32k | 185300000 | 77900000 | 77617343 | 33734149 | 5794934 | 2265801 | 1895932 | 97500000 | 105100000 | 112700000 |
| private_hybrid_1k | 162600000 | 33900000 | 33674007 | 8678995 | 5057668 | 2265801 | 2872290 | 48000000 | 59500000 | 71000000 |
| private_hybrid_2k | 163200000 | 35200000 | 34933207 | 9551880 | 5117934 | 2265801 | 2872290 | 49900000 | 61400000 | 72900000 |
| private_hybrid_4k | 163600000 | 37700000 | 37444673 | 11290718 | 5231534 | 2265801 | 2872290 | 53500000 | 65000000 | 76500000 |
| private_hybrid_8k | 164000000 | 42700000 | 42460674 | 14761462 | 5451801 | 2265801 | 2872290 | 61000000 | 72500000 | 84000000 |
| private_hybrid_16k | 168300000 | 52700000 | 52505742 | 21713238 | 5892068 | 2265801 | 2872290 | 75700000 | 87200000 | 98700000 |
| private_hybrid_32k | 177800000 | 72800000 | 72559343 | 35583035 | 6749401 | 2265801 | 2872290 | 105100000 | 116600000 | 128100000 |
