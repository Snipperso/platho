# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 3ca983ee125c3b0a0bb89307eb8b24d6499017e80c1cdcab390372aa8a65426e

## Derived ATH Master

- athMasterAddress: EQCUyOTDWzXbHxJudqnetxedPDr_CHlWH1NIMlyMUjGUQupg
- athMasterStateInitHash: 94c8e4c35b35db1f126e76a9deb7179d3c3aff0879561f5348325c8c52319442
- athMasterCodeHash: 6cbf3e996bb89614821761e3b5abf9f9be956e2fa046d2a9e9001c8601b88887
- athMasterDataHash: 47817686d8e3a97527e6f0d19652ce52b80bb11c46cb7ac1e28d6b423718840a
- treasuryOwnerAthWalletAddress: EQCB6PHbJYaJH20VgWwJE98VUfgJyG3sL-WJuAE_Fq_7aG6G
- treasuryOwnerAthWalletStateInitHash: 81e8f1db2586891f6d15816c0913df1551f809c86dec2fe589b8013f16affb68
- athWalletCodeHash: bbe3157b05b8d9cc7bae1a3aacd690301e3a16a45a0657b96fb28fdfcf442f50

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQCB6PHbJYaJH20VgWwJE98VUfgJyG3sL-WJuAE_Fq_7aG6G
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQCUyOTDWzXbHxJudqnetxedPDr_CHlWH1NIMlyMUjGUQupg
- athMasterCodeHash: 6cbf3e996bb89614821761e3b5abf9f9be956e2fa046d2a9e9001c8601b88887
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=6cbf3e996bb89614821761e3b5abf9f9be956e2fa046d2a9e9001c8601b88887
