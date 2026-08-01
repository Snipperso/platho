# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 3ca983ee125c3b0a0bb89307eb8b24d6499017e80c1cdcab390372aa8a65426e

## Derived ATH Master

- athMasterAddress: EQCvsogx5ocjZuvrPrZ7V2Y2tFE8wCdKHDeD7ITz0xXD9GBe
- athMasterStateInitHash: afb28831e6872366ebeb3eb67b576636b4513cc0274a1c3783ec84f3d315c3f4
- athMasterCodeHash: f675316b7490aaf3ec07f47815baacc4f34dbdf2fba14d5f37107e39e78428a7
- athMasterDataHash: 47817686d8e3a97527e6f0d19652ce52b80bb11c46cb7ac1e28d6b423718840a
- treasuryOwnerAthWalletAddress: EQAbThPFCBKmBqMQnZKW7VtU_0A1zhBAnsDcwwJp61_Edvz8
- treasuryOwnerAthWalletStateInitHash: 1b4e13c50812a606a3109d9296ed5b54ff4035ce10409ec0dcc30269eb5fc476
- athWalletCodeHash: acd9da0504631016a6e20164e6f3d094de2385aa249bcf17e18dd709f8b698ee

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQAbThPFCBKmBqMQnZKW7VtU_0A1zhBAnsDcwwJp61_Edvz8
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQCvsogx5ocjZuvrPrZ7V2Y2tFE8wCdKHDeD7ITz0xXD9GBe
- athMasterCodeHash: f675316b7490aaf3ec07f47815baacc4f34dbdf2fba14d5f37107e39e78428a7
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=f675316b7490aaf3ec07f47815baacc4f34dbdf2fba14d5f37107e39e78428a7
