import { Address, contractAddress } from '@ton/core';
import { createHash } from 'crypto';
import { writeFileSync, readFileSync } from 'fs';
import { Cell } from '@ton/core';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.USERNAME_NFT.${label}`).digest());
}

function nameHash(name: string): bigint {
  return BigInt(`0x${createHash('sha256').update(`PLATHO.V1.USERNAME.${name}`).digest('hex')}`);
}

async function vector(name: string, ownerLabel: string, registryLabel: string, workchain = 0) {
  const owner = fixtureAddress(ownerLabel, workchain);
  const registry = fixtureAddress(registryLabel, workchain);
  const hash = nameHash(name);
  const init = await UsernameNFTItem.init(owner, registry, hash);
  return {
    name,
    owner_wallet: owner.toString(),
    username_registry_address: registry.toString(),
    name_hash: '0x' + hash.toString(16).padStart(64, '0'),
    data_cell_hash: init.data.hash().toString('hex'),
    state_init_hash: init.data && init.code ? contractAddress(workchain, init).hash.toString('hex') : null,
    derived_item_address: contractAddress(workchain, init).toString(),
  };
}

async function main() {
  const code = Cell.fromBoc(readFileSync('build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem.code.boc'))[0];
  const vectors = {
    profile: 'PLATHO.V1.USERNAME_NFT_ITEM_V1',
    username_nft_item_code_hash: code.hash().toString('hex'),
    derivation_formula: 'addr_std(owner_workchain, cell_hash(StateInit{code=USERNAME_NFT_ITEM_CODE_CELL,data=UsernameNFTItemDataV1(owner_wallet,username_registry_address,name_hash)}))',
    items: [
      await vector('platho', 'OWNER_PLATHO', 'REGISTRY', 0),
      await vector('larisa', 'OWNER_LARISA', 'REGISTRY', 0),
      await vector('testname', 'OWNER_MASTERCHAIN', 'REGISTRY_MASTERCHAIN', -1),
    ],
  };
  writeFileSync('artifacts/username_nft_item_vectors.json', JSON.stringify(vectors, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
