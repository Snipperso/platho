# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 3f02381090c27e0cd36e7f6098979dcbecd6ee0ea2154ddb2cea1412a9caf8ea

## Derived ATH Master

- athMasterAddress: EQC4jzjGi7YMrC1cMIdvUiCZK8cBZuPr7Emj7K7ntx8ZKaiL
- athMasterStateInitHash: b88f38c68bb60cac2d5c30876f5220992bc70166e3ebec49a3ecaee7b71f1929
- athMasterCodeHash: 06ab47304838b2efcd3fb501736829f5d61e13522268e40096c1434dfa969df0
- athMasterDataHash: f8a92c631215d2005f29a89a354b438c1d1c031c2d5715250dafe17e38fa3f31
- treasuryOwnerAthWalletAddress: EQBbtu1khxlLLU-z5rrePwu4ND8GACrGIZXrXLl-0gz2RvGC
- treasuryOwnerAthWalletStateInitHash: 5bb6ed6487194b2d4fb3e6bade3f0bb8343f06002ac62195eb5cb97ed20cf646
- athWalletCodeHash: 6d9d3dff2368d22a4148a48e71d6c91561b6db6ea64d7c14c506445202e13270

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQBbtu1khxlLLU-z5rrePwu4ND8GACrGIZXrXLl-0gz2RvGC
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQC4jzjGi7YMrC1cMIdvUiCZK8cBZuPr7Emj7K7ntx8ZKaiL
- athMasterCodeHash: 06ab47304838b2efcd3fb501736829f5d61e13522268e40096c1434dfa969df0
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=06ab47304838b2efcd3fb501736829f5d61e13522268e40096c1434dfa969df0
