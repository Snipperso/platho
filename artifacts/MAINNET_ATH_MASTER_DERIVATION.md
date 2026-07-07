# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 3ca983ee125c3b0a0bb89307eb8b24d6499017e80c1cdcab390372aa8a65426e

## Derived ATH Master

- athMasterAddress: EQAMx3PgZCEDrGtsOcfK82wONP8RkMRHSR-4DDTUuEIFcANe
- athMasterStateInitHash: 0cc773e0642103ac6b6c39c7caf36c0e34ff1190c447491fb80c34d4b8420570
- athMasterCodeHash: 1a0856b150d4eca477bdac094b2fd86e4a7dcd7d09825945fe9b230abf090544
- athMasterDataHash: 47817686d8e3a97527e6f0d19652ce52b80bb11c46cb7ac1e28d6b423718840a
- treasuryOwnerAthWalletAddress: EQAV7hrftTZdBYGbnfcvEFnhYJSwS4nyT12OSB47EdhmQ4mA
- treasuryOwnerAthWalletStateInitHash: 15ee1adfb5365d05819b9df72f1059e16094b04b89f24f5d8e481e3b11d86643
- athWalletCodeHash: 042e3ac22f441e988a2652cb346f61f61c10263d87c688e237ec00c03fac1466

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQAV7hrftTZdBYGbnfcvEFnhYJSwS4nyT12OSB47EdhmQ4mA
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQAMx3PgZCEDrGtsOcfK82wONP8RkMRHSR-4DDTUuEIFcANe
- athMasterCodeHash: 1a0856b150d4eca477bdac094b2fd86e4a7dcd7d09825945fe9b230abf090544
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=1a0856b150d4eca477bdac094b2fd86e4a7dcd7d09825945fe9b230abf090544
