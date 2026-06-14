# Publish Reserve Pricing Report

Status: **PASS**

Current code hashes:

- Vault: `2cde6f6839b062374600628689008fc68d7d7757622a691287638829adbf08eb`
- CapsuleHub: `f72823a4c01afd938143201dddff03f5193143e116366ce35a69e46662607791`
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
| public_1k | 161000000 | 34700000 | 34671007 | 6820953 | 2550734 | 2265801 | 1163063 | 35900000 | 40500000 | 45200000 |
| public_2k | 161600000 | 36000000 | 35931940 | 7693839 | 2612734 | 2265801 | 1163063 | 37700000 | 42300000 | 47000000 |
| public_4k | 162800000 | 38500000 | 38445140 | 9432678 | 2728067 | 2265801 | 1163063 | 41400000 | 46000000 | 50700000 |
| public_8k | 165300000 | 43500000 | 43462874 | 12903421 | 2950067 | 2265801 | 1163063 | 48900000 | 53500000 | 58200000 |
| public_16k | 170200000 | 53600000 | 53509674 | 19855198 | 3392067 | 2265801 | 1163063 | 63600000 | 68200000 | 72900000 |
| public_32k | 180100000 | 73600000 | 73562609 | 33724994 | 4248734 | 2265801 | 1163063 | 93000000 | 97600000 | 102300000 |
| private_hybrid_1k | 156500000 | 32300000 | 32285406 | 8678995 | 3669067 | 2265801 | 2872289 | 45200000 | 56700000 | 68200000 |
| private_hybrid_2k | 157200000 | 33600000 | 33544607 | 9551880 | 3729334 | 2265801 | 2872289 | 47100000 | 58600000 | 70100000 |
| private_hybrid_4k | 158400000 | 36100000 | 36056073 | 11290718 | 3842934 | 2265801 | 2872289 | 50700000 | 62200000 | 73700000 |
| private_hybrid_8k | 160900000 | 41100000 | 41072074 | 14761462 | 4063201 | 2265801 | 2872289 | 58200000 | 69700000 | 81200000 |
| private_hybrid_16k | 165800000 | 51200000 | 51117142 | 21713238 | 4503468 | 2265801 | 2872289 | 73000000 | 84500000 | 96000000 |
| private_hybrid_32k | 175700000 | 71200000 | 71170743 | 35583035 | 5360801 | 2265801 | 2872289 | 102400000 | 113900000 | 125400000 |
