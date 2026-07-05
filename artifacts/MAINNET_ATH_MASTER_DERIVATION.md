# Mainnet ATH Master Derivation

Status: DERIVED_MAINNET_ATH_MASTER_ADDRESS

- ath_master_derivation_ready: true
- production_deploy_executed: false

## Inputs

- treasuryOwnerAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- contentHash: 89d2c14e0df45caeb96782041f103925b748e342c172139ded857b3fb316d9fc

## Derived ATH Master

- athMasterAddress: EQADR4k12eu1jLxYHWaoDsO93GPUSuBupc-naSXquUFs4_d7
- athMasterStateInitHash: 03478935d9ebb58cbc581d66a80ec3bddc63d44ae06ea5cfa76925eab9416ce3
- athMasterCodeHash: 423e55fa3e47525d99734f8fc073af3f4b468937d6bf3b03a6226cc3a7ba4ede
- athMasterDataHash: b72aad2e17b322fe40e563de9923734abb541c6cb2a1cf05251be02d83a1b529
- treasuryOwnerAthWalletAddress: EQBr84luATL07rH2WkKHaqXzetHUQaK_7ZSqLzDW4CzFGNhv
- treasuryOwnerAthWalletStateInitHash: 6bf3896e0132f4eeb1f65a42876aa5f37ad1d441a2bfed94aa2f30d6e02cc518
- athWalletCodeHash: 58be31994b60678c2b36f3cc588a13c88ee670bc6930a91b8429c53a4312a1b9

## Treasury Supply Deployment

- required: true
- messageType: DeployTreasurySupply
- senderAddress: EQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOFkC
- recipientAthWalletAddress: EQBr84luATL07rH2WkKHaqXzetHUQaK_7ZSqLzDW4CzFGNhv
- amountAtomic: 100000000000000000
- requiredValueNanotons: 5000000
- downstreamWalletValueNanotons: 3000000
- ownerFirstHopExecReserveNanotons: 2000000
- proofRequired: required: post-deploy transaction plus official treasury ATH wallet balance proof

## Blockers

- none

## M20F Inputs

- athMasterAddress: EQADR4k12eu1jLxYHWaoDsO93GPUSuBupc-naSXquUFs4_d7
- athMasterCodeHash: 423e55fa3e47525d99734f8fc073af3f4b468937d6bf3b03a6226cc3a7ba4ede
- athDeploymentManifest: artifacts/CURRENT_CODE_HASHES.txt#ATHMASTER_CODE_HASH=423e55fa3e47525d99734f8fc073af3f4b468937d6bf3b03a6226cc3a7ba4ede
