# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: d8a113e74ef44499e27b367992a2d579a045d1670644b79458edaa504860c6fb

## Derived ATH Master

- athMasterAddress: EQCF-3kT4hwskPW8qVPkROqEHMdGEONYn_edh3NLxJmBcFOi
- athMasterStateInitHash: 85fb7913e21c2c90f5bca953e444ea841cc74610e3589ff79d87734bc4998170
- athMasterCodeHash: 06ab47304838b2efcd3fb501736829f5d61e13522268e40096c1434dfa969df0
- athMasterDataHash: 0026a24eed5997dcef044656a9c00bd344afdf4d9d2535708624cd8ede1282ba
- treasuryOwnerAthWalletAddress: EQCMdCnGsSglzb-8kNOUFi-GxIwZ_XatudnjocESMCFsQo98
- treasuryOwnerAthWalletStateInitHash: 8c7429c6b12825cdbfbc90d394162f86c48c19fd76adb9d9e3a1c11230216c42
- athWalletCodeHash: 6d9d3dff2368d22a4148a48e71d6c91561b6db6ea64d7c14c506445202e13270

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQCMdCnGsSglzb-8kNOUFi-GxIwZ_XatudnjocESMCFsQo98
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQCF-3kT4hwskPW8qVPkROqEHMdGEONYn_edh3NLxJmBcFOi
- athMasterCodeHash: 06ab47304838b2efcd3fb501736829f5d61e13522268e40096c1434dfa969df0
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=06ab47304838b2efcd3fb501736829f5d61e13522268e40096c1434dfa969df0
