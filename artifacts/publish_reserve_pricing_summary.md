# Publish Reserve Pricing Report

Status: **PASS**

Current code hashes:

- Vault: `604cde90f95ad360e8ecaff18f03646b96dda863c924720b81f8024b53a24cf3`
- CapsuleHub: `2d16b0ba66fc6df66b1f890890b96ea0aaa5a7ece2ef2db8368c4f045ea40e7a`
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
| public_1k | 33700000 | 6558287 | 1936956 | 2130334 | 1394040 | 34200000 | 39800000 | 45400000 |
| public_2k | 40700000 | 7446306 | 2006023 | 2130334 | 1394040 | 36100000 | 41700000 | 47300000 |
| public_4k | 44400000 | 9185611 | 2128423 | 2130334 | 1394040 | 39800000 | 45400000 | 51000000 |
| public_8k | 52000000 | 12641088 | 2357489 | 2130334 | 1394040 | 47200000 | 52800000 | 58400000 |
| public_16k | 67300000 | 19505264 | 2805356 | 2130334 | 1394040 | 61900000 | 67500000 | 73100000 |
| public_32k | 97800000 | 33164394 | 3661356 | 2130334 | 1394040 | 90900000 | 96500000 | 102100000 |
| private_hybrid_1k | 34700000 | 8358550 | 2887823 | 2130334 | 2856892 | 42700000 | 54100000 | 65500000 |
| private_hybrid_2k | 36600000 | 9250169 | 2955156 | 2130334 | 2856892 | 44700000 | 56100000 | 67500000 |
| private_hybrid_4k | 40300000 | 10998674 | 3075823 | 2130334 | 2856892 | 48300000 | 59700000 | 71100000 |
| private_hybrid_8k | 47900000 | 14439085 | 3303156 | 2130334 | 2856892 | 55700000 | 67100000 | 78500000 |
| private_hybrid_16k | 63200000 | 21305261 | 3755289 | 2130334 | 2856892 | 70400000 | 81800000 | 93200000 |
| private_hybrid_32k | 93700000 | 34963724 | 4612623 | 2130334 | 2856892 | 99400000 | 110800000 | 122200000 |
