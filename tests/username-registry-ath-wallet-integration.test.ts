import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  AthTransferNotificationMintUsername,
  BindOfficialAthWallet,
  BindUsernameVault,
  SealGenesis,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import {
  ATHWallet,
  ATHTransferRequestMintUsername,
} from '../build/ATHWallet/ATHWallet_ATHWallet';

const MANIFEST_HASH = 0x7171717100000000000000000000000000000000000000000000000000001111n;
const NAME_HASH_DOMAIN = 0xC5CC7CD6n;
const PRICE_6_PLUS = 100_000_000_000n;
const OP_USERNAME_MINT_NOTIFICATION = 0x89129D5F;
const OP_ATH_TRANSFER_NOTIFICATION_ACK = 0x472D9D7E;
const USERNAME_MINT_NOTIFY_VALUE = 32_000_000n;
const USERNAME_MINT_OLD_OWNER_MIN_VALUE = 35_000_000n;
const USERNAME_MINT_CANONICAL_OWNER_VALUE = 53_000_000n;

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

async function athWalletAddress(owner: Address, athMaster: Address): Promise<Address> {
  const init = await ATHWallet.init(0n, owner, athMaster);
  return contractAddress(owner.workChain, init);
}

async function deployAthWallet(
  blockchain: Blockchain,
  owner: Address,
  athMaster: Address,
  athBalance: bigint,
  tonBalance = toNano('1'),
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

async function contractBalance(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const controller = await blockchain.treasury('username-prod-path-controller');
  const user = await blockchain.treasury('username-prod-path-user');
  const placeholderAthWallet = fixtureAddress('USERNAME_PROD_PATH_PLACEHOLDER_ATH_WALLET');
  const athMaster = fixtureAddress('USERNAME_PROD_PATH_ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('USERNAME_PROD_PATH_TREASURY');
  const vaultAddress = fixtureAddress('USERNAME_PROD_PATH_VAULT');

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
  const officialAthWalletAddress = await athWalletAddress(registryAddress, athMaster);

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

  const userAthWallet = await deployAthWallet(blockchain, user.address, athMaster, PRICE_6_PLUS * 2n);
  const officialAthWalletInit = await ATHWallet.init(0n, registryAddress, athMaster);
  const officialAthWallet = blockchain.openContract(new ATHWallet(officialAthWalletAddress, officialAthWalletInit));

  return { blockchain, registry, user, userAthWallet, officialAthWallet };
}

async function mintViaProductionWallet(params: {
  user: any;
  userAthWallet: any;
  registry: any;
  amount: bigint;
  queryId: bigint;
  username: string;
  requestValue?: bigint;
}) {
  return await params.userAthWallet.send(params.user.getSender(), { value: params.requestValue ?? toNano('0.25') }, {
    $$type: 'ATHTransferRequestMintUsername',
    query_id: params.queryId,
    amount: params.amount,
    recipient: params.registry.address,
    response_destination: params.user.address,
    notify_value: USERNAME_MINT_NOTIFY_VALUE,
    username_len: BigInt(Buffer.from(params.username, 'ascii').length),
    username: usernameSlice(params.username),
  } as ATHTransferRequestMintUsername);
}

describe('UsernameRegistry integration with production ATHWallet', () => {
  it('USERNAME-ATH-PROD-01: user wallet can mint through official ATH wallet, not a direct test-only notification', async () => {
    const { blockchain, registry, user, userAthWallet, officialAthWallet } = await setup();
    const username = 'platho';
    const hash = nameHash(username);

    const result = await mintViaProductionWallet({
      user,
      userAthWallet,
      registry,
      amount: PRICE_6_PLUS,
      queryId: 42n,
      username,
    });

    const record = await registry.getGetNameRecord(hash);
    const source = await userAthWallet.getGetWalletData();
    const official = await officialAthWallet.getGetWalletData();

    expect(record.exists).toBe(true);
    expect(record.owner_wallet.equals(user.address)).toBe(true);
    expect(source.balance).toBe(PRICE_6_PLUS);
    expect(official.balance).toBe(PRICE_6_PLUS);
    expect(await contractBalance(blockchain, officialAthWallet.address)).toBeLessThan(toNano('0.01'));
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

  it('USERNAME-ATH-PROD-01B: direct mint notification is rejected, while the same mint through production ATHWallet succeeds', async () => {
    const { registry, user, userAthWallet } = await setup();
    const username = 'authok';
    const hash = nameHash(username);

    await registry.send(user.getSender(), { value: toNano('0.15') }, {
      $$type: 'AthTransferNotificationMintUsername',
      query_id: 420n,
      amount: PRICE_6_PLUS,
      sender_key: 0n,
      owner_wallet: user.address,
      username_len: BigInt(Buffer.from(username, 'ascii').length),
      username: usernameSlice(username),
    } as AthTransferNotificationMintUsername);

    expect((await registry.getGetNameRecord(hash)).exists).toBe(false);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);
    expect(await registry.getGetRefundDue(user.address)).toBe(0n);
    expect((await registry.getGetGlobal()).refund_due_count).toBe(0n);

    await mintViaProductionWallet({
      user,
      userAthWallet,
      registry,
      amount: PRICE_6_PLUS,
      queryId: 421n,
      username,
    });

    const record = await registry.getGetNameRecord(hash);
    expect(record.exists).toBe(true);
    expect(record.owner_wallet.equals(user.address)).toBe(true);
  });

  it('USERNAME-ATH-PROD-02: underpay through production wallet records refund due and does not mint', async () => {
    const { blockchain, registry, user, userAthWallet, officialAthWallet } = await setup();
    const username = 'underp';
    const underpay = PRICE_6_PLUS - 1n;
    const beforeRegistryBalance = await contractBalance(blockchain, registry.address);

    const result = await mintViaProductionWallet({
      user,
      userAthWallet,
      registry,
      amount: underpay,
      queryId: 43n,
      username,
    });

    const record = await registry.getGetNameRecord(nameHash(username));
    const official = await officialAthWallet.getGetWalletData();
    const afterRegistryBalance = await contractBalance(blockchain, registry.address);

    expect(record.exists).toBe(false);
    expect(await registry.getGetRefundDue(user.address)).toBe(underpay);
    expect(official.balance).toBe(underpay);
    expect(afterRegistryBalance - beforeRegistryBalance).toBeLessThan(toNano('0.015'));
    expect(findTransaction(result.transactions, {
      from: registry.address,
      to: user.address,
      success: true,
    })).toBeDefined();
  });

  it('USERNAME-ATH-PROD-02B: official wallet balance backs accepted revenue and rejected refund due', async () => {
    const { registry, user, userAthWallet, officialAthWallet } = await setup();
    const underpay = PRICE_6_PLUS - 1n;

    await mintViaProductionWallet({
      user,
      userAthWallet,
      registry,
      amount: PRICE_6_PLUS,
      queryId: 430n,
      username: 'backok',
    });
    await mintViaProductionWallet({
      user,
      userAthWallet,
      registry,
      amount: underpay,
      queryId: 431n,
      username: 'backno',
    });

    const global = await registry.getGetGlobal();
    const official = await officialAthWallet.getGetWalletData();
    const refundDue = await registry.getGetRefundDue(user.address);
    const backedDue = global.treasury_due_ath + global.burn_due_ath + refundDue;

    expect(global.name_record_count).toBe(1n);
    expect(global.refund_due_count).toBe(1n);
    expect(global.treasury_due_ath).toBe(PRICE_6_PLUS / 2n);
    expect(global.burn_due_ath).toBe(PRICE_6_PLUS / 2n);
    expect(refundDue).toBe(underpay);
    expect(official.balance).toBe(PRICE_6_PLUS + underpay);
    expect(official.balance).toBeGreaterThanOrEqual(backedDue);
  });

  it('USERNAME-ATH-PROD-03: old 35M/36M/37M owner values do not debit source ATH, while 50M reaches Registry full path', async () => {
    const { registry, user, userAthWallet, officialAthWallet } = await setup();

    await mintViaProductionWallet({
      user,
      userAthWallet,
      registry,
      amount: PRICE_6_PLUS,
      queryId: 44n,
      username: 'minaa',
      requestValue: USERNAME_MINT_OLD_OWNER_MIN_VALUE,
    });
    await mintViaProductionWallet({
      user,
      userAthWallet,
      registry,
      amount: PRICE_6_PLUS,
      queryId: 45n,
      username: 'minab',
      requestValue: USERNAME_MINT_OLD_OWNER_MIN_VALUE + 1_000_000n,
    });
    await mintViaProductionWallet({
      user,
      userAthWallet,
      registry,
      amount: PRICE_6_PLUS,
      queryId: 46n,
      username: 'minac',
      requestValue: USERNAME_MINT_OLD_OWNER_MIN_VALUE + 2_000_000n,
    });

    expect((await registry.getGetNameRecord(nameHash('minaa'))).exists).toBe(false);
    expect((await registry.getGetNameRecord(nameHash('minab'))).exists).toBe(false);
    expect((await registry.getGetNameRecord(nameHash('minac'))).exists).toBe(false);
    expect((await userAthWallet.getGetWalletData()).balance).toBe(PRICE_6_PLUS * 2n);

    const result = await mintViaProductionWallet({
      user,
      userAthWallet,
      registry,
      amount: PRICE_6_PLUS,
      queryId: 47n,
      username: 'minokay',
      requestValue: USERNAME_MINT_CANONICAL_OWNER_VALUE,
    });

    expect((await registry.getGetNameRecord(nameHash('minokay'))).exists).toBe(true);
    expect((await userAthWallet.getGetWalletData()).balance).toBe(PRICE_6_PLUS);
    expect((await officialAthWallet.getGetWalletData()).balance).toBe(PRICE_6_PLUS);
    expect(findTransaction(result.transactions, {
      from: officialAthWallet.address,
      to: registry.address,
      op: OP_USERNAME_MINT_NOTIFICATION,
      success: true,
    })).toBeDefined();
  });
});
