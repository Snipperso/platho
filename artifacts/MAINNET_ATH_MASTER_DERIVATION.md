# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 3ca983ee125c3b0a0bb89307eb8b24d6499017e80c1cdcab390372aa8a65426e

## Derived ATH Master

- athMasterAddress: EQCwgUL-uUQ_4TH01KvNgXvTwwEqpyeUgPoZ8XxqvPEBJu2V
- athMasterStateInitHash: b08142feb9443fe131f4d4abcd817bd3c3012aa7279480fa19f17c6abcf10126
- athMasterCodeHash: 11c19a1bc4eba30eda102cc5825c28732de909bde4d21a1db7e059093b2311f3
- athMasterDataHash: 47817686d8e3a97527e6f0d19652ce52b80bb11c46cb7ac1e28d6b423718840a
- treasuryOwnerAthWalletAddress: EQC5wi35EUtCu2ZyVKzPSTMtzDFs4bEhNyvjmQbearDwVhvt
- treasuryOwnerAthWalletStateInitHash: b9c22df9114b42bb667254accf49332dcc316ce1b121372be39906de6ab0f056
- athWalletCodeHash: 8ab0003bb57c01a359cb9d7642a3c15d7a1550d989fcf8bca6677f7da874e077

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQC5wi35EUtCu2ZyVKzPSTMtzDFs4bEhNyvjmQbearDwVhvt
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQCwgUL-uUQ_4TH01KvNgXvTwwEqpyeUgPoZ8XxqvPEBJu2V
- athMasterCodeHash: 11c19a1bc4eba30eda102cc5825c28732de909bde4d21a1db7e059093b2311f3
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=11c19a1bc4eba30eda102cc5825c28732de909bde4d21a1db7e059093b2311f3
