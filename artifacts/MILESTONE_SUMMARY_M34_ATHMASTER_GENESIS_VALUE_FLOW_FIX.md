# Platho M34 ATHMaster Genesis Value Flow Fix

Status: **PASS**

Scope: fixes local ATHMaster genesis supply deployment value-flow findings from the ATHMaster audit section.

## Closed Findings

- ATHM-01: `DeployTreasurySupply` no longer accepts the old `3_000_000` nanotons exact minimum that could not deliver the required downstream reserve after first-hop fees.
- ATHM-02: `DeployTreasurySupply` no longer forwards caller overpayment into the treasury ATH wallet as unaccounted TON balance.

## Current Rule

- Required caller value: `5_000_000` nanotons.
- Downstream treasury ATH wallet value: `3_000_000` nanotons.
- ATHMaster first-hop execution reserve: `2_000_000` nanotons.
- Outbound genesis credit uses `SendPayFwdFeesSeparately`.
- Caller overpayment is refunded to `response_destination`, which must equal `treasury_owner`.

## Verification

- `npm.cmd run build`: PASS
- `npm.cmd run test:file -- tests\ath-wallet-derivation.test.ts tests\ath-wallet-boundary-negative.test.ts tests\ath-burn-finalization.test.ts tests\mainnet-ath-master-derivation.test.ts`: 4 files / 21 tests PASS
- `npm.cmd test`: 67 files / 282 tests PASS
- M16 conformance: PASS
- M18 artifact integrity: PASS

## Hashes

- `ATHMASTER_CODE_HASH=83e0d67eea0dbf385aa716a931ce093f9fed25cad4304bc8caa866eec34a7cb5`
- `ATH_WALLET_CODE_HASH=bee2548d5aa56c9c45acd0ad7901052eb578858a6b8b95a57b83950b5a0baeb4`
- `DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH=70abd184bfc44ef281059e088a0755853b3b0d14950b374c36dddf0fb13c5080`

## Mainnet Note

`scripts/mainnet_ath_master_derivation.ts` now records the safe treasury supply deployment value:

- `requiredValueNanotons=5000000`
- `downstreamWalletValueNanotons=3000000`
- `ownerFirstHopExecReserveNanotons=2000000`

The mainnet derivation artifact still correctly reports `BLOCKED_MISSING_FINAL_MAINNET_ATH_MASTER_INPUTS` until final mainnet treasury owner and content inputs are supplied.

## Production Note

This closes the local ATHMaster genesis value-flow findings only. The implemented-subset manifest remains non-final while mainnet genesis and STON.fi route blockers remain open.
