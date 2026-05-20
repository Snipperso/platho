# Platho M34 ATHMaster Genesis Value Flow Fix

Status: **PASS**

Scope: fixes local ATHMaster genesis supply deployment value-flow findings from the ATHMaster audit section.

## Closed Findings

- ATHM-01: `DeployTreasurySupply` no longer accepts the old `3_000_000` nanotons exact minimum that could not deliver the required downstream reserve after first-hop fees.
- ATHM-02: `DeployTreasurySupply` no longer forwards caller overpayment into the treasury ATH wallet as unaccounted TON balance. M47 refines this rule: dust excess below `100_000` nanotons is retained as ATHMaster reserve instead of attempting a refund that can fail the action phase.

## Current Rule

- Required caller value: `5_000_000` nanotons.
- Downstream treasury ATH wallet value: `3_000_000` nanotons.
- ATHMaster first-hop execution reserve: `2_000_000` nanotons.
- Outbound genesis credit uses `SendPayFwdFeesSeparately`.
- Caller non-dust overpayment is refunded to `response_destination`, which must equal `treasury_owner`.
- Dust overpayment below `100_000` nanotons is retained as ATHMaster reserve.

## Verification

- `npm.cmd run build`: PASS
- `npm.cmd run test:file -- tests\ath-wallet-derivation.test.ts tests\ath-wallet-boundary-negative.test.ts tests\ath-burn-finalization.test.ts tests\mainnet-ath-master-derivation.test.ts`: 4 files / 24 tests PASS
- `npm.cmd test`: 70 files / 305 tests PASS
- M16 conformance: PASS
- M18 artifact integrity: PASS

## Hashes

- `ATHMASTER_CODE_HASH=4d88d83ed5d795eb25f947e8c9f1d19ad7cbedeae93562e27d73b65b54f5a62f`
- `ATH_WALLET_CODE_HASH=5c0cf65ee7b44b239a87d181b9167a406b935ac0d0879e8727e96c2e4d68064a`
- `DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH=8b3fa3c3ea993fac281a104a9bd14637b5c571fca79d98bc1b16d95479c09947`

## Mainnet Note

`scripts/mainnet_ath_master_derivation.ts` now records the safe treasury supply deployment value:

- `requiredValueNanotons=5000000`
- `downstreamWalletValueNanotons=3000000`
- `ownerFirstHopExecReserveNanotons=2000000`

The mainnet derivation artifact still correctly reports `BLOCKED_MISSING_FINAL_MAINNET_ATH_MASTER_INPUTS` until final mainnet treasury owner and content inputs are supplied.

## Production Note

This closes the local ATHMaster genesis value-flow findings only. The implemented-subset manifest remains non-final while mainnet genesis and STON.fi route blockers remain open.
