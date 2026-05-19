import { Address, beginCell, contractAddress } from '@ton/core';
import { createHash } from 'crypto';
import { writeFileSync, readFileSync } from 'fs';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { Vault } from '../build/Vault/Vault_Vault';

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.DEPLOY.${label}`).digest());
}


function addressHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

async function main() {
  const treasuryOwner = fixtureAddress('ATH_TREASURY_OWNER');
  const content = beginCell().storeBuffer(Buffer.from('ATH')).endCell();
  const athMasterInit = await ATHMaster.init(treasuryOwner, content);
  const athMasterAddress = contractAddress(0, athMasterInit);
  const athWalletCodeBoc = readFileSync('build/ATHWallet/ATHWallet_ATHWallet.code.boc');

  const capsulePlaceholder = fixtureAddress('VAULT_PLACEHOLDER_CAPSULEHUB');
  const genesisController = fixtureAddress('GENESIS_CONTROLLER');
  const vaultInit = await Vault.init(genesisController, athMasterAddress, capsulePlaceholder, addressHash(genesisController), false, false, 0n);
  const vaultAddress = contractAddress(0, vaultInit);

  const officialVaultAthWalletInit = await ATHWallet.init(0n, vaultAddress, athMasterAddress);
  const officialVaultAthWallet = contractAddress(vaultAddress.workChain, officialVaultAthWalletInit);

  const circularVaultInit = await Vault.init(officialVaultAthWallet, athMasterAddress, capsulePlaceholder, addressHash(genesisController), false, false, 0n);
  const circularVaultAddress = contractAddress(0, circularVaultInit);

  const vector = {
    profile: 'PLATHO.V1.DEPLOYMENT_ATH_WALLET_BINDING_V1',
    ath_master_address: athMasterAddress.toString(),
    ath_wallet_code_boc_sha256: Buffer.from(createHash('sha256').update(athWalletCodeBoc).digest()).toString('hex'),
    ath_wallet_code_cell_hash: officialVaultAthWalletInit.code.hash().toString('hex'),
    vault_preseal_controller_slot_address: genesisController.toString(),
    vault_genesis_controller_address: genesisController.toString(),
    vault_initial_address: vaultAddress.toString(),
    vault_official_ath_wallet_address: officialVaultAthWallet.toString(),
    vault_official_ath_wallet_data_cell_hash: officialVaultAthWalletInit.data.hash().toString('hex'),
    vault_official_ath_wallet_state_init_hash: beginCell().store(store => {
      store.storeUint(0, 1); // split_depth none
      store.storeUint(0, 1); // special none
      store.storeUint(1, 1).storeRef(officialVaultAthWalletInit.code);
      store.storeUint(1, 1).storeRef(officialVaultAthWalletInit.data);
      store.storeUint(0, 1); // libraries none
    }).endCell().hash().toString('hex'),
    circular_stateinit_address_if_official_wallet_were_stored_initially: circularVaultAddress.toString(),
    circularity_proof_address_changes: !circularVaultAddress.equals(vaultAddress),
    binding_order: [
      'deploy Vault with vault_ath_wallet_address temporarily set to genesis_controller and sealed=false',
      'compute Vault address from initial StateInit',
      'derive official ATH wallet from owner=Vault address and ATH master/wallet code',
      'genesis_controller sends BindOfficialAthWallet before OP_SEAL_GENESIS',
      'OP_SEAL_GENESIS freezes bound official ATH wallet forever',
    ],
  };

  writeFileSync('artifacts/deployment_ath_wallet_binding_vectors.json', JSON.stringify(vector, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
