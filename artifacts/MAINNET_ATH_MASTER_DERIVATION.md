# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 3ca983ee125c3b0a0bb89307eb8b24d6499017e80c1cdcab390372aa8a65426e

## Derived ATH Master

- athMasterAddress: EQDu2C0DyneE5rsksFp26V0FC4ed9BW0qiXjV-NNHbbqmfNt
- athMasterStateInitHash: eed82d03ca7784e6bb24b05a76e95d050b879df415b4aa25e357e34d1db6ea99
- athMasterCodeHash: 505ad76f54fadf986b384ebfba0cf751310e9589a64b70d1ee7228dd8da94f7f
- athMasterDataHash: 47817686d8e3a97527e6f0d19652ce52b80bb11c46cb7ac1e28d6b423718840a
- treasuryOwnerAthWalletAddress: EQDqUOO59hit9IzwjNC8L8NecVvvfcmzbGEIB13JFxfVqF85
- treasuryOwnerAthWalletStateInitHash: ea50e3b9f618adf48cf08cd0bc2fc35e715bef7dc9b36c6108075dc91717d5a8
- athWalletCodeHash: 844a125f5d950c7c965bbab08a1e523acf5186750f0c648bbd98b95f2378f719

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQDqUOO59hit9IzwjNC8L8NecVvvfcmzbGEIB13JFxfVqF85
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQDu2C0DyneE5rsksFp26V0FC4ed9BW0qiXjV-NNHbbqmfNt
- athMasterCodeHash: 505ad76f54fadf986b384ebfba0cf751310e9589a64b70d1ee7228dd8da94f7f
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=505ad76f54fadf986b384ebfba0cf751310e9589a64b70d1ee7228dd8da94f7f
