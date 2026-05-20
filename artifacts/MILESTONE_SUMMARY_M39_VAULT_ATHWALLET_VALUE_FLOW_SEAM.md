# M39 Vault ATHWallet Value Flow Seam

Status: PASS.

This milestone adds cross-contract regression coverage for the Vault <->
ATHWallet value-flow seam.

## Covered Findings

- VAH-01: `WithdrawAth` returned callback TON is credited back to the user's
  internal Vault `ton_balance`, capped by the original refundable value.
- VAH-02: ATH deposit overpayment does not leave a large TON excess in the
  official Vault ATH wallet.
- VAH-03: the old owner-facing notify minimum is rejected before source ATH is
  debited, while the canonical owner notify value reaches Vault.

## Verification

- Focused seam tests:
  `tests\vault-ath-integration.test.ts`,
  `tests\vault-ath-invariants.test.ts`,
  `tests\ath-wallet-transfer.test.ts`,
  `tests\ath-wallet-boundary-negative.test.ts`: 4 files / 20 tests PASS.
- `npm.cmd test`: 67 files / 285 tests PASS.

## Production Note

No contract bytecode changed in this milestone. The implemented-subset manifest
remains non-final until mainnet route, funding, address, and final-genesis
evidence blockers are closed.
