# Publish Reserve Pricing Report

Status: **PASS**

Current code hashes:

- Vault: `60a5bb63d11f510606038d633f30cf62d4fab87cc98c91c0f1b424b7acf9e0d2`
- CapsuleHub: `2edc2f92dcc3942793f6315fa2d3a35fc79f37e10dc645c038400b70584731e3`
- ATHWallet: `6d9d3dff2368d22a4148a48e71d6c91561b6db6ea64d7c14c506445202e13270`

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
| public_1k | 59500000 | 33700000 | 34671007 | 6812420 | 2550734 | 2265801 | 1147664 | 35800000 | 40400000 | 45000000 |
| public_2k | 66500000 | 40700000 | 35931940 | 7685306 | 2612734 | 2265801 | 1147664 | 37600000 | 42200000 | 46800000 |
| public_4k | 70200000 | 44400000 | 38445140 | 9424145 | 2728067 | 2265801 | 1147664 | 41300000 | 45900000 | 50500000 |
| public_8k | 77800000 | 52000000 | 43462874 | 12894888 | 2950067 | 2265801 | 1147664 | 48700000 | 53300000 | 57900000 |
| public_16k | 93100000 | 67300000 | 53509674 | 19846665 | 3392067 | 2265801 | 1147664 | 63400000 | 68000000 | 72600000 |
| public_32k | 123600000 | 97800000 | 73562609 | 33716461 | 4248734 | 2265801 | 1147664 | 92900000 | 97500000 | 102100000 |
| private_hybrid_1k | 60500000 | 34700000 | 32285406 | 8670461 | 3669067 | 2265801 | 2856891 | 45200000 | 56600000 | 68000000 |
| private_hybrid_2k | 62400000 | 36600000 | 33544607 | 9543346 | 3729334 | 2265801 | 2856891 | 47000000 | 58400000 | 69800000 |
| private_hybrid_4k | 66100000 | 40300000 | 36056073 | 11282185 | 3842934 | 2265801 | 2856891 | 50700000 | 62100000 | 73500000 |
| private_hybrid_8k | 73700000 | 47900000 | 41072074 | 14752929 | 4063201 | 2265801 | 2856891 | 58200000 | 69600000 | 81000000 |
| private_hybrid_16k | 89000000 | 63200000 | 51117142 | 21704705 | 4503468 | 2265801 | 2856891 | 73000000 | 84400000 | 95800000 |
| private_hybrid_32k | 119500000 | 93700000 | 71170743 | 35574501 | 5360801 | 2265801 | 2856891 | 102400000 | 113800000 | 125200000 |
