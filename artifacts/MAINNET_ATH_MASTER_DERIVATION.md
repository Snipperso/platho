# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 5fc276fff0ea9a149774e7f9207ba42038349c727724e48bab5a303b7a4d4cf3

## Derived ATH Master

- athMasterAddress: EQA1Xa56qP5Ebe3yprAEQWf4Rg_cc39xhwIP1802Jql2oUsA
- athMasterStateInitHash: 355dae7aa8fe446dedf2a6b0044167f8460fdc737f7187020fd7cd3626a976a1
- athMasterCodeHash: b1d76721386af55046ea573e7f7d41673e8e68629fd06aef3889b121e1d66780
- athMasterDataHash: 3b4892a6045498e3f1d6a4e653ff40ce436e187095ecad84784323b528db6640
- treasuryOwnerAthWalletAddress: EQAE6J0fWanMG2RyvLW1TEdShC_7CnqBZkDIK3Yuq7nzQmuI
- treasuryOwnerAthWalletStateInitHash: 04e89d1f59a9cc1b6472bcb5b54c4752842ffb0a7a816640c82b762eabb9f342
- athWalletCodeHash: 3d0f027840bc604e1e69d19f764543372f362096e2ead3c689c83e8f00966ce4

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQAE6J0fWanMG2RyvLW1TEdShC_7CnqBZkDIK3Yuq7nzQmuI
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQA1Xa56qP5Ebe3yprAEQWf4Rg_cc39xhwIP1802Jql2oUsA
- athMasterCodeHash: b1d76721386af55046ea573e7f7d41673e8e68629fd06aef3889b121e1d66780
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=b1d76721386af55046ea573e7f7d41673e8e68629fd06aef3889b121e1d66780
