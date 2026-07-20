import { Address, beginCell, contractAddress, storeStateInit, Cell } from '@ton/core';
import { createHash } from 'crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { UsernameRegistry } from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';
import { ATHWallet, storeATHTransferRequestRegistryMintUsername } from '../build/ATHWallet/ATHWallet_ATHWallet';

const NAME_HASH_DOMAIN = 0xC5CC7CD6n;
const OP_ATH_TRANSFER_NOTIFICATION_VAULT_MINT_USERNAME = 0x89129D60n;
const OP_ATH_TRANSFER_REQUEST_VAULT_MINT_USERNAME = 0x4154481Cn;
// The registry retains 6M + 500M item deploy reserve + 1M ack + 4M state-growth = 511M, so the mint notification
// it receives must clear that floor. Canonical mint value the Vault/client carries is 600M (511M + exec/fwd margin).
const USERNAME_MINT_NOTIFY_VALUE_NANOTONS = 600000000n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function codeHash(path: string): string {
  const cell = Cell.fromBoc(readFileSync(path))[0];
  return cell.hash().toString('hex');
}

function nameHash(name: string): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(NAME_HASH_DOMAIN, 32)
    .storeBuffer(Buffer.from(name, 'ascii'))
    .endCell()
    .hash()
    .toString('hex'));
}

function mintPayload(payer: Address, owner: Address, name: string, amount: bigint, queryId = 1n) {
  return beginCell()
    .storeUint(OP_ATH_TRANSFER_NOTIFICATION_VAULT_MINT_USERNAME, 32)
    .storeUint(queryId, 64)
    .storeUint(0n, 160)
    .storeUint(amount, 128)
    .storeAddress(payer)
    .storeAddress(owner)
    .storeUint(Buffer.from(name, 'ascii').length, 8)
    .storeBuffer(Buffer.from(name, 'ascii'))
    .endCell();
}

function mintRequestPayload(vault: Address, owner: Address, registryAddress: Address, name: string, amount: bigint, queryId = 1n) {
  return beginCell().store(storeATHTransferRequestRegistryMintUsername({
    $$type: 'ATHTransferRequestRegistryMintUsername',
    query_id: queryId,
    amount,
    recipient: registryAddress,
    response_destination: vault,
    notify_value: USERNAME_MINT_NOTIFY_VALUE_NANOTONS,
    owner_wallet: owner,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse(),
  })).endCell();
}

async function itemVector(name: string, owner: Address, vault: Address, registryAddress: Address, amount: bigint) {
  const h = nameHash(name);
  const init = await UsernameNFTItem.init(registryAddress, h);
  return {
    username: name,
    username_hex: Buffer.from(name, 'ascii').toString('hex'),
    initial_owner_wallet: owner.toString(),
    item_workchain: registryAddress.workChain,
    price_ath_atomic: amount.toString(),
    name_hash: '0x' + h.toString(16).padStart(64, '0'),
    vault_ath_transfer_request_mint_username_boc_base64: mintRequestPayload(vault, owner, registryAddress, name, amount).toBoc().toString('base64'),
    official_wallet_vault_mint_notification_boc_base64: mintPayload(vault, owner, name, amount).toBoc().toString('base64'),
    username_item_data_cell_hash: init.data.hash().toString('hex'),
    username_item_state_init_hash: beginCell().store(storeStateInit(init)).endCell().hash().toString('hex'),
    derived_item_address: contractAddress(registryAddress.workChain, init).toString(),
  };
}

async function main() {
  const placeholderAthWallet = fixtureAddress('USERNAME_REGISTRY_PLACEHOLDER_ATH_WALLET');
  const athMasterAddress = fixtureAddress('ATH_MASTER_FOR_USERNAME_REGISTRY');
  const treasuryAthReceiver = fixtureAddress('USERNAME_REGISTRY_TREASURY_ATH_RECEIVER');
  const vaultAddress = fixtureAddress('USERNAME_REGISTRY_VAULT');
  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, fixtureAddress('GENESIS_CONTROLLER'));
  const registryAddress = contractAddress(0, registryInit);
  const officialAthWalletInit = await ATHWallet.init(0n, registryAddress, athMasterAddress);
  const officialAthWalletAddress = contractAddress(registryAddress.workChain, officialAthWalletInit);

  const vectors = {
    profile: 'PLATHO.V1.USERNAME_REGISTRY_PAID_MINT_M10_M13_ACK_RESERVE',
    constants: {
      ATH_TRANSFER_REQUEST_VAULT_MINT_USERNAME_OPCODE: `0x${OP_ATH_TRANSFER_REQUEST_VAULT_MINT_USERNAME.toString(16).toUpperCase()}`,
      ATH_TRANSFER_NOTIFICATION_VAULT_MINT_USERNAME_OPCODE: `0x${OP_ATH_TRANSFER_NOTIFICATION_VAULT_MINT_USERNAME.toString(16).toUpperCase()}`,
      USERNAME_MINT_NOTIFY_VALUE_NANOTONS: USERNAME_MINT_NOTIFY_VALUE_NANOTONS.toString(),
      USERNAME_NAME_HASH_DOMAIN: '0xC5CC7CD6',
      USERNAME_MAX_LENGTH: 16,
      USERNAME_NFT_ITEM_DEPLOY_RESERVE_NANOTONS: '500000000',
      USERNAME_ITEM_ACK_FORWARD_RESERVE_NANOTONS: '3000000',
      USERNAME_ATH_NOTIFICATION_ACK_VALUE_NANOTONS: '1000000',
      USERNAME_TREASURY_SHARE_BPS: 5000,
      USERNAME_BURN_SHARE_BPS: 5000,
    },
    code_hashes: {
      username_registry: codeHash('build/UsernameRegistry/UsernameRegistry_UsernameRegistry.code.boc'),
      username_nft_item: codeHash('build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem.code.boc'),
      ath_wallet: codeHash('build/ATHWallet/ATHWallet_ATHWallet.code.boc'),
    },
    registry: {
      initial_address: registryAddress.toString(),
      initial_data_cell_hash: registryInit.data.hash().toString('hex'),
      initial_state_init_hash: beginCell().store(storeStateInit(registryInit)).endCell().hash().toString('hex'),
      ath_master_fixture_address: athMasterAddress.toString(),
      official_ath_wallet_address: officialAthWalletAddress.toString(),
      official_ath_wallet_state_init_hash: beginCell().store(storeStateInit(officialAthWalletInit)).endCell().hash().toString('hex'),
    },
    valid_mint_vectors: [
      await itemVector('abcd', fixtureAddress('USERNAME_M10_VECTOR_OWNER_4'), vaultAddress, registryAddress, 10000000000000n),
      await itemVector('abcde', fixtureAddress('USERNAME_M10_VECTOR_OWNER_5'), vaultAddress, registryAddress, 1000000000000n),
      await itemVector('platho', fixtureAddress('USERNAME_M10_VECTOR_OWNER_6'), vaultAddress, registryAddress, 100000000000n),
      await itemVector('user123', fixtureAddress('USERNAME_M10_VECTOR_OWNER_DIGITS'), vaultAddress, registryAddress, 100000000000n),
      await itemVector('user_name', fixtureAddress('USERNAME_M10_VECTOR_OWNER_UNDERSCORE'), vaultAddress, registryAddress, 100000000000n),
      await itemVector('user-name', fixtureAddress('USERNAME_M10_VECTOR_OWNER_HYPHEN'), vaultAddress, registryAddress, 100000000000n),
    ],
    invalid_examples: [
      { username: 'abc', reason: 'length < 4' },
      { username: 'Larisa', reason: 'uppercase byte' },
      { username: 'user.name', reason: 'dot byte' },
      { username: 'abcdefghijklmnopq', reason: 'length > 16' },
      { username: 'плато', reason: 'non-ASCII bytes' },
    ],
  };

  mkdirSync('artifacts', { recursive: true });
  writeFileSync('artifacts/username_registry_mint_vectors.json', JSON.stringify(vectors, null, 2) + '\n');
  console.log(JSON.stringify(vectors, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
