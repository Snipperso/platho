# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: d8a113e74ef44499e27b367992a2d579a045d1670644b79458edaa504860c6fb

## Derived ATH Master

- athMasterAddress: EQA_iaT8mdvUOV-ffbA0FU_vN1KLzW_gdUNJiPuprdJ1pjty
- athMasterStateInitHash: 3f89a4fc99dbd4395f9f7db034154fef37528bcd6fe075434988fba9add275a6
- athMasterCodeHash: b1d76721386af55046ea573e7f7d41673e8e68629fd06aef3889b121e1d66780
- athMasterDataHash: 0026a24eed5997dcef044656a9c00bd344afdf4d9d2535708624cd8ede1282ba
- treasuryOwnerAthWalletAddress: EQDL6QLVJg0s07JivsJM2D-ZOoxnAvOGCvruIcW8KLZiD-0d
- treasuryOwnerAthWalletStateInitHash: cbe902d5260d2cd3b262bec24cd83f993a8c6702f3860afaee21c5bc28b6620f
- athWalletCodeHash: 3d0f027840bc604e1e69d19f764543372f362096e2ead3c689c83e8f00966ce4

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQDL6QLVJg0s07JivsJM2D-ZOoxnAvOGCvruIcW8KLZiD-0d
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQA_iaT8mdvUOV-ffbA0FU_vN1KLzW_gdUNJiPuprdJ1pjty
- athMasterCodeHash: b1d76721386af55046ea573e7f7d41673e8e68629fd06aef3889b121e1d66780
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=b1d76721386af55046ea573e7f7d41673e8e68629fd06aef3889b121e1d66780
