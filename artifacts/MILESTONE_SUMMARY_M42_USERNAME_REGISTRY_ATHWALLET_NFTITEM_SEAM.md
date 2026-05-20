# M42 UsernameRegistry ATHWallet NFTItem Seam

Status: PASS.

This milestone locks the UsernameRegistry -> ATHWallet -> UsernameNFTItem
production mint seam.

## Covered Findings

- UNSEAM-01: old `35M` / `36M` / `37M` owner request values do not debit
  source ATH or create Registry state, while `50M` reaches the full mint path.
- UNSEAM-02: username mint overpayment is covered by the existing bounded
  ATHWallet owner-facing mint path and non-dust owner excess refund behavior.

## Change

ATHWallet notify transfers now reserve `7,000,000` nanotons for recipient-side
notification execution and `10,000,000` nanotons for the owner-facing first hop.
This makes the owner-facing minimum full-path safe for recipient ATH wallet
notification, Registry processing, item deploy, and ACK.

## Verification

- Focused seam tests:
  `tests\username-registry-ath-wallet-integration.test.ts`,
  `tests\username-registry-paid-mint.test.ts`,
  `tests\username-registry-refund-flush.test.ts`,
  `tests\username-registry-due-flush.test.ts`,
  `tests\username-registry-prune-pending-mint.test.ts`,
  `tests\username-nft-item.test.ts`,
  `tests\ath-wallet-boundary-negative.test.ts`,
  `tests\vault-ath-integration.test.ts`: PASS, 8 files / 36 tests.
- `npm.cmd test`: PASS, 68 files / 292 tests.

## Production Note

ATHWallet bytecode changes in this milestone. Production remains blocked by the
existing mainnet route, funding, address, and final-genesis evidence gates.
