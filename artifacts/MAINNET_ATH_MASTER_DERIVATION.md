# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 3ca983ee125c3b0a0bb89307eb8b24d6499017e80c1cdcab390372aa8a65426e

## Derived ATH Master

- athMasterAddress: EQBch6DQHDQuYADbZKAnQrwDAk5gn1GjVq1ts2y3hAL75pDZ
- athMasterStateInitHash: 5c87a0d01c342e6000db64a02742bc03024e609f51a356ad6db36cb78402fbe6
- athMasterCodeHash: c56c25ab453b26d34a42070d6e98f5c8459393c68be227cb19b2fa001eaa4ffe
- athMasterDataHash: 47817686d8e3a97527e6f0d19652ce52b80bb11c46cb7ac1e28d6b423718840a
- treasuryOwnerAthWalletAddress: EQBui2tnOxIyWLL-r_TVJihQ19hoD2M3HPi8SeCBFQi4eGHe
- treasuryOwnerAthWalletStateInitHash: 6e8b6b673b123258b2feaff4d5262850d7d8680f63371cf8bc49e0811508b878
- athWalletCodeHash: 00ab75605fedbb0240160d015c9c820fa4b6b40c972dd458f4896beadac391f6

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQBui2tnOxIyWLL-r_TVJihQ19hoD2M3HPi8SeCBFQi4eGHe
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQBch6DQHDQuYADbZKAnQrwDAk5gn1GjVq1ts2y3hAL75pDZ
- athMasterCodeHash: c56c25ab453b26d34a42070d6e98f5c8459393c68be227cb19b2fa001eaa4ffe
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=c56c25ab453b26d34a42070d6e98f5c8459393c68be227cb19b2fa001eaa4ffe
