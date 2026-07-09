# Publish Reserve Pricing Report

Status: **PASS**

Current code hashes:

- Vault: `b1db818389ae2be7fb429a7d5957e5eadcb3875cdef9bb956c1a40d6e56cd5f6`
- CapsuleHub: `cbd14315cb61365039df65b48874cbf10cf31fbab9d2d4009cc08ac4b6feb344`
- ATHWallet: `042e3ac22f441e988a2652cb346f61f61c10263d87c688e237ec00c03fac1466`

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
| public_1k | 169800000 | 39000000 | 39186807 | 6833576 | 4558001 | 2265801 | 2167330 | 41900000 | 50600000 | 59200000 |
| public_2k | 170800000 | 40200000 | 40447740 | 7706462 | 4620001 | 2265801 | 2167330 | 43800000 | 52500000 | 61100000 |
| public_4k | 171800000 | 42700000 | 42960940 | 9445300 | 4735334 | 2265801 | 2167330 | 47400000 | 56100000 | 64700000 |
| public_8k | 174800000 | 47800000 | 47978674 | 12916043 | 4957334 | 2265801 | 2167330 | 54900000 | 63600000 | 72200000 |
| public_16k | 179800000 | 57800000 | 58025475 | 19867819 | 5399334 | 2265801 | 2167330 | 69600000 | 78300000 | 86900000 |
| public_32k | 189300000 | 77900000 | 78078410 | 33737616 | 6256001 | 2265801 | 2167330 | 99100000 | 107800000 | 116400000 |
| private_hybrid_1k | 162600000 | 33900000 | 34148073 | 8678995 | 5531734 | 2265801 | 2872290 | 48900000 | 60400000 | 71900000 |
| private_hybrid_2k | 163200000 | 35200000 | 35407274 | 9551880 | 5592001 | 2265801 | 2872290 | 50800000 | 62300000 | 73800000 |
| private_hybrid_4k | 164800000 | 37700000 | 37918740 | 11290718 | 5705601 | 2265801 | 2872290 | 54500000 | 66000000 | 77500000 |
| private_hybrid_8k | 167300000 | 42700000 | 42934741 | 14761462 | 5925868 | 2265801 | 2872290 | 61900000 | 73400000 | 84900000 |
| private_hybrid_16k | 172300000 | 52700000 | 52979808 | 21713238 | 6366134 | 2265801 | 2872290 | 76700000 | 88200000 | 99700000 |
| private_hybrid_32k | 181800000 | 72800000 | 73033410 | 35583035 | 7223468 | 2265801 | 2872290 | 106100000 | 117600000 | 129100000 |
