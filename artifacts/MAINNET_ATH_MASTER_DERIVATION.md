# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: d7bead8b433f5ee1ee2a2bd0659f01837e7761fcc48e855449dbdf7543fb52e2

## Derived ATH Master

- athMasterAddress: EQDOvjnz6XUQgS0PbFNbTKSu2bR98haXDlOsAIr_5LH6GKYR
- athMasterStateInitHash: cebe39f3e97510812d0f6c535b4ca4aed9b47df216970e53ac008affe4b1fa18
- athMasterCodeHash: 423e55fa3e47525d99734f8fc073af3f4b468937d6bf3b03a6226cc3a7ba4ede
- athMasterDataHash: cee465385fd058d9debd29fcf84cff99c8ae3fcdb290c632890eb02ddc74c0c8
- treasuryOwnerAthWalletAddress: EQBDmAHUxk0gaTo7prHQc5YLRFpLB4wArbddw96FMKawjxlf
- treasuryOwnerAthWalletStateInitHash: 439801d4c64d20693a3ba6b1d073960b445a4b078c00adb75dc3de8530a6b08f
- athWalletCodeHash: 58be31994b60678c2b36f3cc588a13c88ee670bc6930a91b8429c53a4312a1b9

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQBDmAHUxk0gaTo7prHQc5YLRFpLB4wArbddw96FMKawjxlf
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQDOvjnz6XUQgS0PbFNbTKSu2bR98haXDlOsAIr_5LH6GKYR
- athMasterCodeHash: 423e55fa3e47525d99734f8fc073af3f4b468937d6bf3b03a6226cc3a7ba4ede
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=423e55fa3e47525d99734f8fc073af3f4b468937d6bf3b03a6226cc3a7ba4ede
