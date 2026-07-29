# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 3ca983ee125c3b0a0bb89307eb8b24d6499017e80c1cdcab390372aa8a65426e

## Derived ATH Master

- athMasterAddress: EQCaAEiVCCOWzZNJu5pw-l5FRf1_WsaSQ3xzlHFjL4nr4sHG
- athMasterStateInitHash: 9a004895082396cd9349bb9a70fa5e4545fd7f5ac692437c739471632f89ebe2
- athMasterCodeHash: f13064144b521ad9943e488e3e75d29c56739b3d9d993c5d3a7db0d98f5c9208
- athMasterDataHash: 47817686d8e3a97527e6f0d19652ce52b80bb11c46cb7ac1e28d6b423718840a
- treasuryOwnerAthWalletAddress: EQAdGOp8b44m32X0nCTUIATFuE2-3yvZPPBpYiTMAjxY0y9j
- treasuryOwnerAthWalletStateInitHash: 1d18ea7c6f8e26df65f49c24d42004c5b84dbedf2bd93cf0696224cc023c58d3
- athWalletCodeHash: 591289edc1df5fce99b028a10ed9dfc35d865bf07598dea42ec2361721641e6f

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQAdGOp8b44m32X0nCTUIATFuE2-3yvZPPBpYiTMAjxY0y9j
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQCaAEiVCCOWzZNJu5pw-l5FRf1_WsaSQ3xzlHFjL4nr4sHG
- athMasterCodeHash: f13064144b521ad9943e488e3e75d29c56739b3d9d993c5d3a7db0d98f5c9208
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=f13064144b521ad9943e488e3e75d29c56739b3d9d993c5d3a7db0d98f5c9208
