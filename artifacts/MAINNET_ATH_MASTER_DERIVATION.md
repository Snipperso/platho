# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 3ca983ee125c3b0a0bb89307eb8b24d6499017e80c1cdcab390372aa8a65426e

## Derived ATH Master

- athMasterAddress: EQAgI5LDBV4bRZsRLXLA2702vWGLMWIDb5Y-mDfblkmZ10Ws
- athMasterStateInitHash: 202392c3055e1b459b112d72c0dbbd36bd618b3162036f963e9837db964999d7
- athMasterCodeHash: 5be811775447e9fbd8e63d6188610243afb9783cd8a9ffa6a3a02b9b2f009f5f
- athMasterDataHash: 47817686d8e3a97527e6f0d19652ce52b80bb11c46cb7ac1e28d6b423718840a
- treasuryOwnerAthWalletAddress: EQBJWgGdZxxBwzuC9Sb6FYvHdIZHJuAIlg0DDbU9m6r-2MjJ
- treasuryOwnerAthWalletStateInitHash: 495a019d671c41c33b82f526fa158bc774864726e008960d030db53d9baafed8
- athWalletCodeHash: 0ec124d7ad05428b347ef1615831f9e60e5c4df5d2f0a0127a9c9df7ccdd9b20

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQBJWgGdZxxBwzuC9Sb6FYvHdIZHJuAIlg0DDbU9m6r-2MjJ
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQAgI5LDBV4bRZsRLXLA2702vWGLMWIDb5Y-mDfblkmZ10Ws
- athMasterCodeHash: 5be811775447e9fbd8e63d6188610243afb9783cd8a9ffa6a3a02b9b2f009f5f
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=5be811775447e9fbd8e63d6188610243afb9783cd8a9ffa6a3a02b9b2f009f5f
