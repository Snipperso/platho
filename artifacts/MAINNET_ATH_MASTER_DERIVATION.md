# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 3f02381090c27e0cd36e7f6098979dcbecd6ee0ea2154ddb2cea1412a9caf8ea

## Derived ATH Master

- athMasterAddress: EQBYtK4_sxTw2Z7bp8DuzQ2Nz09MWU7nmcHmPzovsUN9vxL-
- athMasterStateInitHash: 58b4ae3fb314f0d99edba7c0eecd0d8dcf4f4c594ee799c1e63f3a2fb1437dbf
- athMasterCodeHash: 1292f049451f70dc285c1247c9624890b2909298142a6c6760ccafa1428c4c88
- athMasterDataHash: f8a92c631215d2005f29a89a354b438c1d1c031c2d5715250dafe17e38fa3f31
- treasuryOwnerAthWalletAddress: EQDa464U-R8o-bT-Y1-2F6JBfxZCEOJclTILQxF8GHejQwrC
- treasuryOwnerAthWalletStateInitHash: dae3ae14f91f28f9b4fe635fb617a2417f164210e25c95320b43117c1877a343
- athWalletCodeHash: 4c90b0f1b65eea96df7992409e1819b73f63f1ae2ecb9f651c42174c85f7b88d

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQDa464U-R8o-bT-Y1-2F6JBfxZCEOJclTILQxF8GHejQwrC
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQBYtK4_sxTw2Z7bp8DuzQ2Nz09MWU7nmcHmPzovsUN9vxL-
- athMasterCodeHash: 1292f049451f70dc285c1247c9624890b2909298142a6c6760ccafa1428c4c88
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=1292f049451f70dc285c1247c9624890b2909298142a6c6760ccafa1428c4c88
