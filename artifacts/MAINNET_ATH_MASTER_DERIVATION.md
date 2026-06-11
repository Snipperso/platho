# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 2bd5a2a31ae443cd1c1b812ae7a255ed556fa22b3b391082c3593cca99067816

## Derived ATH Master

- athMasterAddress: EQB4sZxJa8CAaRBbFb8-33j3mA9scMCz0zqTy42qEnWnVvaM
- athMasterStateInitHash: 78b19c496bc08069105b15bf3edf78f7980f6c70c0b3d33a93cb8daa1275a756
- athMasterCodeHash: 06ab47304838b2efcd3fb501736829f5d61e13522268e40096c1434dfa969df0
- athMasterDataHash: 1c6483b57a841cdb12a18e5ba97f8dda21d03ffceb387e60a0d42f5d04f89ab2
- treasuryOwnerAthWalletAddress: EQDT5UIuiiV0mzmOkg46nIHeyCqPYKYgM1F-aCHyovB5KsLt
- treasuryOwnerAthWalletStateInitHash: d3e5422e8a25749b398e920e3a9c81dec82a8f60a62033517e6821f2a2f0792a
- athWalletCodeHash: 6d9d3dff2368d22a4148a48e71d6c91561b6db6ea64d7c14c506445202e13270

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQDT5UIuiiV0mzmOkg46nIHeyCqPYKYgM1F-aCHyovB5KsLt
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQB4sZxJa8CAaRBbFb8-33j3mA9scMCz0zqTy42qEnWnVvaM
- athMasterCodeHash: 06ab47304838b2efcd3fb501736829f5d61e13522268e40096c1434dfa969df0
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=06ab47304838b2efcd3fb501736829f5d61e13522268e40096c1434dfa969df0
