# M41 BuybackBurn ATHWallet ATHMaster Seam

Status: PASS.

This milestone closes the BuybackBurn -> ATHWallet -> ATHMaster route-notify
boundary risk.

## Closed Finding

- BBATH-01: upstream `notify_value = 35,000,000` nanotons no longer leaves
  BuybackBurn stuck in `PENDING_STONFI_SWAP`.

## Change

ATHWallet now sends both notification messages with
`SendPayFwdFeesSeparately`:

- `AthTransferNotification`
- `AthTransferNotificationMintUsername`

That makes `notify_value` mean exact destination value, rather than value minus
forward fee.

## Regression

BuybackBurn happy-path seam tests now use the production boundary
`35,000,000` nanotons instead of `0.1 TON`.

## Verification

- `npm.cmd run build`: PASS.
- `node scripts\hash_codes.js`: PASS.
- Focused seam tests:
  `tests\buybackburn-production.test.ts`,
  `tests\buybackburn-auth-negative-matrix.test.ts`,
  `tests\ath-burn-finalization.test.ts`,
  `tests\ath-wallet-transfer.test.ts`: 4 files / 30 tests PASS.
- M18 artifact integrity: PASS.
- `npm.cmd test`: 68 files / 291 tests PASS.

## Hashes

- `ATH_WALLET_CODE_HASH=b1edef475b60e5f4da111b8226a767aa807f96b9382acb659fa97a4672535b98`
- `ATHMASTER_CODE_HASH=fecd0b4fd3435ed3b7ca88d3542e7c452bc474c3c9bbb8103bbe19f3f64710ce`
- `BUYBACKBURN_CODE_HASH=94eeb47e3a6bf90c7e0ebf374a34acd699ce3163bb8df6b30c550f8b0f777c0f`
- `VAULT_CODE_HASH=b1c08d999bb7eb0f664e7296ea20ff2997b8221340c1cd177e3b5839dd2c59c0`
- `USERNAME_REGISTRY_CODE_HASH=7894e8e91e4959b70b3be353c5cce500eb27f8b4c454aa2b6b83983d202d7887`

## Notes

- BBATH-02 remains an operational value-flow note: route notify value should stay
  bounded and production-like.
- BBATH-03 was already closed by M35: partial `RetryAthBurnDue` is forbidden.
- Production remains blocked by the existing mainnet route, funding, address,
  and final-genesis evidence gates.
