# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 3ca983ee125c3b0a0bb89307eb8b24d6499017e80c1cdcab390372aa8a65426e

## Derived ATH Master

- athMasterAddress: EQCThzitzPXm2dH9psaVkZlkAcHqzCJjcBpD29b5closNeq-
- athMasterStateInitHash: 938738adccf5e6d9d1fda6c69591996401c1eacc2263701a43dbd6f9725a2c35
- athMasterCodeHash: 3fdd932b40bbf7d8f2fae5fdd2a141452437275310c57f750daf60bf6efcfbb8
- athMasterDataHash: 3fa0a60b65bf24eb32b96da8d2ae343154d8a8b814fc487b625ca43ef0894527
- treasuryOwnerAthWalletAddress: EQBWFwZxN7u4H4wTB3HQMfLYqPRti52z2YZfgOLLlR3vakJy
- treasuryOwnerAthWalletStateInitHash: 5617067137bbb81f8c130771d031f2d8a8f46d8b9db3d9865f80e2cb951def6a
- athWalletCodeHash: 8ab0003bb57c01a359cb9d7642a3c15d7a1550d989fcf8bca6677f7da874e077

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQBWFwZxN7u4H4wTB3HQMfLYqPRti52z2YZfgOLLlR3vakJy
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQCThzitzPXm2dH9psaVkZlkAcHqzCJjcBpD29b5closNeq-
- athMasterCodeHash: 3fdd932b40bbf7d8f2fae5fdd2a141452437275310c57f750daf60bf6efcfbb8
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=3fdd932b40bbf7d8f2fae5fdd2a141452437275310c57f750daf60bf6efcfbb8
