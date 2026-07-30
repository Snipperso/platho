# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 3ca983ee125c3b0a0bb89307eb8b24d6499017e80c1cdcab390372aa8a65426e

## Derived ATH Master

- athMasterAddress: EQCjx1rh8ZMFDayugnM_mEwEZ6zEvrrDSqQFmJad_FV67nbj
- athMasterStateInitHash: a3c75ae1f193050dacae82733f984c0467acc4bebac34aa40598969dfc557aee
- athMasterCodeHash: e06fec0f10c39460f1c09a82993b44abbe6000bdcbf627aa07f247f9064b57b3
- athMasterDataHash: 47817686d8e3a97527e6f0d19652ce52b80bb11c46cb7ac1e28d6b423718840a
- treasuryOwnerAthWalletAddress: EQB97V3Zn8KnoV799477_OcDGEMdk4NfC6SW23Z7YO2I3Bp3
- treasuryOwnerAthWalletStateInitHash: 7ded5dd99fc2a7a15efdf78efbfce70318431d93835f0ba496db767b60ed88dc
- athWalletCodeHash: 968b7aad44576ed0a4c109bb25a2df8bd8f897f2e14247dd37155bb4b2ca84cf

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQB97V3Zn8KnoV799477_OcDGEMdk4NfC6SW23Z7YO2I3Bp3
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQCjx1rh8ZMFDayugnM_mEwEZ6zEvrrDSqQFmJad_FV67nbj
- athMasterCodeHash: e06fec0f10c39460f1c09a82993b44abbe6000bdcbf627aa07f247f9064b57b3
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=e06fec0f10c39460f1c09a82993b44abbe6000bdcbf627aa07f247f9064b57b3
