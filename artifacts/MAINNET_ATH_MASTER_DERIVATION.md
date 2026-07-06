# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 459c23c452a35c8a55bdfe3cfdf24fed7297a9e148e199fa6ed50f45f38988ef

## Derived ATH Master

- athMasterAddress: EQAyC-MgeacFW5-FeqHYckzrbI06y40OmloCU5cxBIof6cLl
- athMasterStateInitHash: 320be32079a7055b9f857aa1d8724ceb6c8d3acb8d0e9a5a02539731048a1fe9
- athMasterCodeHash: 1a0856b150d4eca477bdac094b2fd86e4a7dcd7d09825945fe9b230abf090544
- athMasterDataHash: 2cac0320a8734fb6579a3031d590f8118adcf9033f89efc78d7cdb5c597210fe
- treasuryOwnerAthWalletAddress: EQBpqYgzu87Pu3nRxhsCtgo7yl69dkzzWchHA88GlJg_-pF0
- treasuryOwnerAthWalletStateInitHash: 69a98833bbcecfbb79d1c61b02b60a3bca5ebd764cf359c84703cf0694983ffa
- athWalletCodeHash: 042e3ac22f441e988a2652cb346f61f61c10263d87c688e237ec00c03fac1466

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQBpqYgzu87Pu3nRxhsCtgo7yl69dkzzWchHA88GlJg_-pF0
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQAyC-MgeacFW5-FeqHYckzrbI06y40OmloCU5cxBIof6cLl
- athMasterCodeHash: 1a0856b150d4eca477bdac094b2fd86e4a7dcd7d09825945fe9b230abf090544
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=1a0856b150d4eca477bdac094b2fd86e4a7dcd7d09825945fe9b230abf090544
