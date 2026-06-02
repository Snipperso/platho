import { Address, beginCell, contractAddress, storeStateInit } from '@ton/core';
import { Cell } from '@ton/core';
import { createHash } from 'crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { UsernameRegistry } from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';

const NAME_HASH_DOMAIN = 0xC5CC7CD6n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function nameHash(name: string): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(NAME_HASH_DOMAIN, 32)
    .storeBuffer(Buffer.from(name, 'ascii'))
    .endCell()
    .hash()
    .toString('hex'));
}

function codeHash(path: string): string {
  const cell = Cell.fromBoc(readFileSync(path))[0];
  return cell.hash().toString('hex');
}

async function itemVector(name: string, owner: Address, registryAddress: Address) {
  const h = nameHash(name);
  const init = await UsernameNFTItem.init(registryAddress, h);
  const stateInitHash = beginCell().store(storeStateInit(init)).endCell().hash().toString('hex');
  return {
    name,
    initial_owner_wallet: owner.toString(),
    item_workchain: registryAddress.workChain,
    name_hash: h.toString(16).padStart(64, '0'),
    username_item_data_cell_hash: init.data.hash().toString('hex'),
    username_item_state_init_hash: stateInitHash,
    derived_item_address: contractAddress(registryAddress.workChain, init).toString(),
  };
}

async function main() {
  const placeholderAthWallet = fixtureAddress('USERNAME_REGISTRY_PLACEHOLDER_ATH_WALLET');
  const athMasterAddress = fixtureAddress('ATH_MASTER_FOR_USERNAME_REGISTRY');
  const treasuryAthReceiver = fixtureAddress('USERNAME_REGISTRY_TREASURY_ATH_RECEIVER');
  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, fixtureAddress('GENESIS_CONTROLLER'));
  const registryAddress = contractAddress(0, registryInit);
  const officialAthWalletInit = await ATHWallet.init(0n, registryAddress, athMasterAddress);
  const officialAthWalletAddress = contractAddress(registryAddress.workChain, officialAthWalletInit);

  const vectors = {
    profile: 'PLATHO.V1.USERNAME_REGISTRY_FOUNDATION_M9',
    username_registry_code_hash: codeHash('build/UsernameRegistry/UsernameRegistry_UsernameRegistry.code.boc'),
    username_nft_item_code_hash: codeHash('build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem.code.boc'),
    ath_wallet_code_hash: codeHash('build/ATHWallet/ATHWallet_ATHWallet.code.boc'),
    username_registry_initial_address: registryAddress.toString(),
    username_registry_initial_data_cell_hash: registryInit.data.hash().toString('hex'),
    username_registry_initial_state_init_hash: beginCell().store(storeStateInit(registryInit)).endCell().hash().toString('hex'),
    ath_master_fixture_address: athMasterAddress.toString(),
    username_registry_official_ath_wallet_address: officialAthWalletAddress.toString(),
    username_registry_official_ath_wallet_data_cell_hash: officialAthWalletInit.data.hash().toString('hex'),
    username_registry_official_ath_wallet_state_init_hash: beginCell().store(storeStateInit(officialAthWalletInit)).endCell().hash().toString('hex'),
    prices: [
      { name_len: 1, valid_length: false, price_ath_atomic: '0' },
      { name_len: 3, valid_length: false, price_ath_atomic: '0' },
      { name_len: 4, valid_length: true, price_ath_atomic: '10000000000000' },
      { name_len: 5, valid_length: true, price_ath_atomic: '1000000000000' },
      { name_len: 6, valid_length: true, price_ath_atomic: '100000000000' },
      { name_len: 12, valid_length: true, price_ath_atomic: '100000000000' },
      { name_len: 16, valid_length: true, price_ath_atomic: '100000000000' },
      { name_len: 17, valid_length: false, price_ath_atomic: '0' },
    ],
    item_vectors: [
      await itemVector('platho', fixtureAddress('USERNAME_REGISTRY_ITEM_OWNER'), registryAddress),
      await itemVector('larisa', fixtureAddress('USERNAME_REGISTRY_MASTERCHAIN_OWNER', -1), registryAddress),
    ],
  };

  mkdirSync('artifacts', { recursive: true });
  writeFileSync('artifacts/username_registry_foundation_vectors.json', JSON.stringify(vectors, null, 2));
  console.log(JSON.stringify(vectors, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
