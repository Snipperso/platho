# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 7ce6583b780de229643059581154bc2347aa5f647468ad593b1256f1d30a4b1a

## Derived ATH Master

- athMasterAddress: EQBoDJZGQ8ZJ3rsu3btdMNZ7_-qami9WMQLlrkwndjczlkv-
- athMasterStateInitHash: 680c964643c649debb2eddbb5d30d67bffea9a9a2f563102e5ae4c2776373396
- athMasterCodeHash: b1d76721386af55046ea573e7f7d41673e8e68629fd06aef3889b121e1d66780
- athMasterDataHash: c931868507757fec43a9da6b81a5cc769ce864773d758bf6836dc869a1d7138c
- treasuryOwnerAthWalletAddress: EQD9Tw91EkGpyJucD8sQpyWD3BqJNOsBh0I6KItr3beNNfEL
- treasuryOwnerAthWalletStateInitHash: fd4f0f751241a9c89b9c0fcb10a72583dc1a8934eb0187423a288b6bddb78d35
- athWalletCodeHash: 3d0f027840bc604e1e69d19f764543372f362096e2ead3c689c83e8f00966ce4

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQD9Tw91EkGpyJucD8sQpyWD3BqJNOsBh0I6KItr3beNNfEL
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQBoDJZGQ8ZJ3rsu3btdMNZ7_-qami9WMQLlrkwndjczlkv-
- athMasterCodeHash: b1d76721386af55046ea573e7f7d41673e8e68629fd06aef3889b121e1d66780
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=b1d76721386af55046ea573e7f7d41673e8e68629fd06aef3889b121e1d66780
