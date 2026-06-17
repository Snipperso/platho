# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 671f843b97a0ff4b0193b025e23f901aa7b0eb11d2fabc0c2652e0f73f16a1d2

## Derived ATH Master

- athMasterAddress: EQBbeKdVpDbcgalNLVEsCrtG3rTmw87vtzuRUM4B3X7IAAyo
- athMasterStateInitHash: 5b78a755a436dc81a94d2d512c0abb46deb4e6c3ceefb73b9150ce01dd7ec800
- athMasterCodeHash: b1d76721386af55046ea573e7f7d41673e8e68629fd06aef3889b121e1d66780
- athMasterDataHash: 6462d42075ca571a2b18afb01566b5a808cb391f0cd9ca3a3c93467fd4c5be29
- treasuryOwnerAthWalletAddress: EQBHiz3VVT_Uw9QOjQ5SpyFbZoBtdKK4E6JCpcjaEj16ePz6
- treasuryOwnerAthWalletStateInitHash: 478b3dd5553fd4c3d40e8d0e52a7215b66806d74a2b813a242a5c8da123d7a78
- athWalletCodeHash: 3d0f027840bc604e1e69d19f764543372f362096e2ead3c689c83e8f00966ce4

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQBHiz3VVT_Uw9QOjQ5SpyFbZoBtdKK4E6JCpcjaEj16ePz6
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQBbeKdVpDbcgalNLVEsCrtG3rTmw87vtzuRUM4B3X7IAAyo
- athMasterCodeHash: b1d76721386af55046ea573e7f7d41673e8e68629fd06aef3889b121e1d66780
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=b1d76721386af55046ea573e7f7d41673e8e68629fd06aef3889b121e1d66780
