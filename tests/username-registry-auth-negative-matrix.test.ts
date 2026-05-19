import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet,
  SealGenesis,
  AthTransferNotificationMintUsername,
  UsernameItemDeployedAck,
  FlushAthRefundDue,
  FlushTreasuryAthDue,
  ATHTransferAck,
  ATHTransferFailed,
  ATHBurnFinalized,
  ATHBurnFailed,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { MockUsernameNFTItemNoAck } from '../build/MockUsernameNFTItemNoAck/MockUsernameNFTItemNoAck_MockUsernameNFTItemNoAck';
import { MockVaultAthWallet } from '../build/MockVaultAthWallet/MockVaultAthWallet_MockVaultAthWallet';

const MANIFEST_HASH = 0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaan;
const NAME_HASH_DOMAIN = 0xC5CC7CD6n;
const PRICE_6_PLUS = 100_000_000_000n;
const HALF_PRICE = 50_000_000_000n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.USERNAME.AUTH.${label}`).digest());
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

async function deploySealedRegistryWithMockOfficial() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('username-auth-deployer');
  const attacker = await blockchain.treasury('username-auth-attacker');
  const flusher = await blockchain.treasury('username-auth-flusher');
  const placeholderAthWallet = fixtureAddress('PLACEHOLDER_ATH_WALLET');
  const athMasterAddress = fixtureAddress('ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('TREASURY_ATH_RECEIVER');

  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, deployer.address);
  const registryAddress = contractAddress(0, registryInit);
  const mockOfficialInit = await MockVaultAthWallet.init(false);

  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('3'),
    workchain: registryAddress.workChain,
  }));

  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));
  const mockOfficialAddress = await registry.getGetAthWalletAddress(registryAddress);
  await blockchain.setShardAccount(mockOfficialAddress, createShardAccount({
    address: mockOfficialAddress,
    code: mockOfficialInit.code,
    data: mockOfficialInit.data,
    balance: toNano('2'),
    workchain: mockOfficialAddress.workChain,
  }));
  const mockOfficial = blockchain.openContract(new MockVaultAthWallet(mockOfficialAddress, mockOfficialInit));

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: mockOfficialAddress,
  } as BindOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, mockOfficial, mockOfficialAddress, attacker, flusher, athMasterAddress, treasuryAthReceiver };
}

async function sendMintFromOfficialAddress(
  blockchain: Blockchain,
  registry: any,
  officialAddress: Address,
  ownerWallet: Address,
  name: string,
  amount = PRICE_6_PLUS,
) {
  await registry.send(blockchain.sender(officialAddress), { value: toNano('0.15') }, {
    $$type: 'AthTransferNotificationMintUsername',
    query_id: 911n,
    amount,
    owner_wallet: ownerWallet,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name),
  } as AthTransferNotificationMintUsername);
}

async function installNoAckAt(blockchain: Blockchain, address: Address) {
  const noAckInit = await MockUsernameNFTItemNoAck.init();
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: noAckInit.code,
    data: noAckInit.data,
    balance: toNano('0.05'),
    workchain: address.workChain,
  }));
}

describe('UsernameRegistry negative authorization matrix', () => {
  it('USERNAME-REG-AUTH-NEG-01: forged mint notification and forged item ACK cannot create a name record', async () => {
    const { registry, attacker } = await deploySealedRegistryWithMockOfficial();
    const ownerWallet = fixtureAddress('FORGED_MINT_OWNER');
    const hash = nameHash('forged');

    await registry.send(attacker.getSender(), { value: toNano('0.15') }, {
      $$type: 'AthTransferNotificationMintUsername',
      query_id: 1n,
      amount: PRICE_6_PLUS,
      owner_wallet: ownerWallet,
      username_len: 6n,
      username: usernameSlice('forged'),
    } as AthTransferNotificationMintUsername);
    expect((await registry.getGetNameRecord(hash)).exists).toBe(false);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);

    await registry.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'UsernameItemDeployedAck',
      name_hash: hash,
      owner_wallet: ownerWallet,
    } as UsernameItemDeployedAck);
    expect((await registry.getGetNameRecord(hash)).exists).toBe(false);
    expect((await registry.getGetGlobal()).name_record_count).toBe(0n);
  });

  it('USERNAME-REG-AUTH-NEG-02: forged item ACK cannot finalize an existing pending mint', async () => {
    const ctx = await deploySealedRegistryWithMockOfficial();
    const ownerWallet = fixtureAddress('PENDING_OWNER');
    const hash = nameHash('stuckx');
    const itemAddress = await ctx.registry.getGetUsernameItemAddress(ownerWallet, hash);
    await installNoAckAt(ctx.blockchain, itemAddress);

    await sendMintFromOfficialAddress(ctx.blockchain, ctx.registry, ctx.mockOfficialAddress, ownerWallet, 'stuckx');
    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(true);

    await ctx.registry.send(ctx.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'UsernameItemDeployedAck',
      name_hash: hash,
      owner_wallet: ownerWallet,
    } as UsernameItemDeployedAck);

    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(true);
    expect((await ctx.registry.getGetNameRecord(hash)).exists).toBe(false);
  });

  it('USERNAME-REG-AUTH-NEG-03: forged refund/treasury transfer callbacks cannot clear pending flushes', async () => {
    const ctx = await deploySealedRegistryWithMockOfficial();
    const refundOwner = fixtureAddress('REFUND_OWNER');
    const treasuryOwner = fixtureAddress('TREASURY_OWNER');

    await sendMintFromOfficialAddress(ctx.blockchain, ctx.registry, ctx.mockOfficialAddress, refundOwner, 'Larisa');
    expect(await ctx.registry.getGetRefundDue(refundOwner)).toBe(PRICE_6_PLUS);
    await ctx.registry.send(ctx.flusher.getSender(), { value: toNano('0.05') }, {
      $$type: 'FlushAthRefundDue',
      query_id: 7001n,
      owner_wallet: refundOwner,
    } as FlushAthRefundDue);
    expect((await ctx.registry.getGetPendingRefundFlush(7001n)).exists).toBe(true);
    expect(await ctx.registry.getGetRefundDue(refundOwner)).toBe(0n);

    await ctx.registry.send(ctx.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferAck',
      query_id: 7001n,
      amount: PRICE_6_PLUS,
    } as ATHTransferAck);
    await ctx.registry.send(ctx.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferFailed',
      query_id: 7001n,
      amount: PRICE_6_PLUS,
    } as ATHTransferFailed);
    expect((await ctx.registry.getGetPendingRefundFlush(7001n)).exists).toBe(true);
    expect(await ctx.registry.getGetRefundDue(refundOwner)).toBe(0n);

    await sendMintFromOfficialAddress(ctx.blockchain, ctx.registry, ctx.mockOfficialAddress, treasuryOwner, 'treasy');
    expect((await ctx.registry.getGetGlobal()).treasury_due_ath).toBe(HALF_PRICE);
    await ctx.registry.send(ctx.flusher.getSender(), { value: toNano('0.05') }, {
      $$type: 'FlushTreasuryAthDue',
      query_id: 8001n,
    } as FlushTreasuryAthDue);
    expect((await ctx.registry.getGetPendingTreasuryFlush(8001n)).exists).toBe(true);
    expect((await ctx.registry.getGetGlobal()).treasury_due_ath).toBe(0n);

    await ctx.registry.send(ctx.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferAck',
      query_id: 8001n,
      amount: HALF_PRICE,
    } as ATHTransferAck);
    await ctx.registry.send(ctx.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferFailed',
      query_id: 8001n,
      amount: HALF_PRICE,
    } as ATHTransferFailed);
    expect((await ctx.registry.getGetPendingTreasuryFlush(8001n)).exists).toBe(true);
    expect((await ctx.registry.getGetGlobal()).treasury_due_ath).toBe(0n);
  });

  it('USERNAME-REG-AUTH-NEG-04: forged burn callbacks cannot mutate burn due without authenticated pending flow', async () => {
    const ctx = await deploySealedRegistryWithMockOfficial();

    await ctx.registry.send(ctx.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHBurnFinalized',
      query_id: 9001n,
      amount: HALF_PRICE,
      owner_address: ctx.registry.address,
    } as ATHBurnFinalized);
    await ctx.registry.send(ctx.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHBurnFailed',
      query_id: 9001n,
      amount: HALF_PRICE,
    } as ATHBurnFailed);

    const global = await ctx.registry.getGetGlobal();
    expect(global.pending_burn_flush_count).toBe(0n);
    expect(global.burn_due_ath).toBe(0n);
  });
});
