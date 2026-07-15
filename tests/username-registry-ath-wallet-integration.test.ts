import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  AthTransferNotificationVaultMintUsername,
  BindOfficialAthWallet,
  BindUsernameVault,
  SealGenesis,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import {
  ATHWallet,
  ATHTransferRequestVaultMintUsername,
} from '../build/ATHWallet/ATHWallet_ATHWallet';

const MANIFEST_HASH = 0x7171717100000000000000000000000000000000000000000000000000001111n;
const NAME_HASH_DOMAIN = 0xC5CC7CD6n;
const PRICE_6_PLUS = 100_000_000_000n;
const OP_USERNAME_MINT_NOTIFICATION = 0x89129D60;
const OP_ATH_TRANSFER_NOTIFICATION_ACK = 0x472D9D7E;
// Registry retains 6M + 500M item deploy reserve + 1M + 4M = 511M, so the notification value the registry
// receives must clear that floor. The ATHWallet vault-notify path adds ~15M ack/exec/storage overhead on top of
// notify_value, plus gas; the request value carried into the wallet must comfortably exceed notify_value by that
// overhead (with margin) so the official wallet stays active after forwarding the notification.
const USERNAME_MINT_NOTIFY_VALUE = 1_000_000_000n; // clean-16 L2/#14: covers the 100-year username endowment (~0.91 TON retainedValue)
const USERNAME_MINT_VAULT_REQUEST_VALUE = 1_100_000_000n; // > notify_value + forward fees

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function usernameSlice(name: string) {
  return beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse();
}

function nameHash(name: string): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(NAME_HASH_DOMAIN, 32)
    .storeBuffer(Buffer.from(name, 'ascii'))
    .endCell()
    .hash()
    .toString('hex'));
}

async function deployAthWallet(
  blockchain: Blockchain,
  owner: Address,
  athMaster: Address,
  athBalance: bigint,
  tonBalance = toNano('2'), // clean-16 L2/#14: raised to cover the 100-year username endowment (~0.9 TON reserve)
) {
  const zeroInit = await ATHWallet.init(0n, owner, athMaster);
  const dataInit = await ATHWallet.init(athBalance, owner, athMaster);
  const address = contractAddress(owner.workChain, zeroInit);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: zeroInit.code,
    data: dataInit.data,
    balance: tonBalance,
    workchain: address.workChain,
  }));
  return blockchain.openContract(new ATHWallet(address, zeroInit));
}

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const controller = await blockchain.treasury('username-vault-path-controller');
  const user = await blockchain.treasury('username-vault-path-user');
  const placeholderAthWallet = fixtureAddress('USERNAME_VAULT_PATH_PLACEHOLDER_ATH_WALLET');
  const athMaster = fixtureAddress('USERNAME_VAULT_PATH_ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('USERNAME_VAULT_PATH_TREASURY');
  const vaultAddress = fixtureAddress('USERNAME_VAULT_PATH_VAULT');

  const registryInit = await UsernameRegistry.init(
    placeholderAthWallet,
    athMaster,
    treasuryAthReceiver,
    false,
    0n,
    0n,
    controller.address,
  );
  const registryAddress = contractAddress(0, registryInit);
  const officialAthWalletInit = await ATHWallet.init(0n, registryAddress, athMaster);
  const officialAthWalletAddress = contractAddress(registryAddress.workChain, officialAthWalletInit);

  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('2'),
    workchain: registryAddress.workChain,
  }));
  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));

  await registry.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWalletAddress,
  } as BindOfficialAthWallet);
  await registry.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameVault',
    deployment_manifest_hash: MANIFEST_HASH,
    vault_address: vaultAddress,
  } as BindUsernameVault);
  await registry.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  const vaultAthWallet = await deployAthWallet(blockchain, vaultAddress, athMaster, PRICE_6_PLUS * 2n);
  const officialAthWallet = blockchain.openContract(new ATHWallet(officialAthWalletAddress, officialAthWalletInit));

  return { blockchain, registry, user, vaultAddress, vaultAthWallet, officialAthWallet };
}

async function mintViaVaultOfficialWallet(params: {
  blockchain: Blockchain;
  vaultAddress: Address;
  vaultAthWallet: any;
  registry: any;
  ownerWallet: Address;
  amount: bigint;
  queryId: bigint;
  username: string;
  requestValue?: bigint;
}) {
  return await params.vaultAthWallet.send(params.blockchain.sender(params.vaultAddress), { value: params.requestValue ?? USERNAME_MINT_VAULT_REQUEST_VALUE }, {
    $$type: 'ATHTransferRequestVaultMintUsername',
    query_id: params.queryId,
    amount: params.amount,
    recipient: params.registry.address,
    response_destination: params.vaultAddress,
    notify_value: USERNAME_MINT_NOTIFY_VALUE,
    owner_wallet: params.ownerWallet,
    username_len: BigInt(Buffer.from(params.username, 'ascii').length),
    username: usernameSlice(params.username),
  } as ATHTransferRequestVaultMintUsername);
}

describe('UsernameRegistry integration with Vault-owned ATHWallet', () => {
  it('USERNAME-ATH-VAULT-01: Vault-owned ATH wallet can mint for a user without a user-wallet product transaction', async () => {
    const { registry, blockchain, user, vaultAddress, vaultAthWallet, officialAthWallet } = await setup();
    const username = 'platho';
    const hash = nameHash(username);

    const result = await mintViaVaultOfficialWallet({
      blockchain,
      vaultAddress,
      vaultAthWallet,
      registry,
      ownerWallet: user.address,
      amount: PRICE_6_PLUS,
      queryId: 42n,
      username,
    });

    const record = await registry.getGetNameRecord(hash);
    const source = await vaultAthWallet.getGetWalletData();
    const official = await officialAthWallet.getGetWalletData();

    expect(record.exists).toBe(true);
    expect(record.minter_wallet.equals(user.address)).toBe(true);
    expect(source.balance).toBe(PRICE_6_PLUS);
    expect(official.balance).toBe(PRICE_6_PLUS);
    expect(findTransaction(result.transactions, {
      from: officialAthWallet.address,
      to: registry.address,
      op: OP_USERNAME_MINT_NOTIFICATION,
      success: true,
    })).toBeDefined();
    expect(findTransaction(result.transactions, {
      from: registry.address,
      to: officialAthWallet.address,
      op: OP_ATH_TRANSFER_NOTIFICATION_ACK,
      success: true,
    })).toBeDefined();
  });

  it('USERNAME-ATH-VAULT-02: direct user mint notification is rejected and creates no registry-side refund state', async () => {
    const { registry, user, vaultAddress } = await setup();
    const username = 'authok';
    const hash = nameHash(username);

    await registry.send(user.getSender(), { value: toNano('0.15') }, {
      $$type: 'AthTransferNotificationVaultMintUsername',
      query_id: 420n,
      amount: PRICE_6_PLUS,
      sender_key: 0n,
      payer_wallet: vaultAddress,
      owner_wallet: user.address,
      username_len: BigInt(Buffer.from(username, 'ascii').length),
      username: usernameSlice(username),
    } as AthTransferNotificationVaultMintUsername);

    const global = await registry.getGetGlobal();
    expect((await registry.getGetNameRecord(hash)).exists).toBe(false);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);
    expect(global.name_record_count).toBe(0n);
    expect(global.pending_mint_count).toBe(0n);
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.burn_due_ath).toBe(0n);
  });
});
