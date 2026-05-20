# Mainnet ATH Master Derivation

Status: BLOCKED_MISSING_FINAL_MAINNET_ATH_MASTER_INPUTS

- ath_master_derivation_ready: false
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: not supplied
- contentHash: not derived

## Derived ATH Master

- athMasterAddress: not derived
- athMasterStateInitHash: not derived
- athMasterCodeHash: not derived
- athMasterDataHash: not derived
- treasuryOwnerAthWalletAddress: not derived
- treasuryOwnerAthWalletStateInitHash: not derived
- athWalletCodeHash: not derived

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: not ready
- recipientAthWalletAddress: not ready
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- MISSING_FINAL_MAINNET_ATH_MASTER_INPUTS

## M20F Inputs

- athMasterAddress: not ready
- athMasterCodeHash: not ready
- athDeploymentManifest: not ready
