import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet,
  BindUsernameVault,
  SealGenesis,
  AthTransferNotificationMintUsername,
  FlushAthRefundDue,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';

const MANIFEST_HASH = 0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaan;
const PRICE_6_PLUS = 100_000_000_000n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function usernameSlice(name: string) {
  return beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse();
}

async function deploySealedRegistryWithOfficialWallet(officialWalletBalance: bigint) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const deployer = await blockchain.treasury('username-registry-m11-deployer');
  const flusher = await blockchain.treasury('username-registry-m11-flusher');
  const placeholderAthWallet = fixtureAddress('USERNAME_REGISTRY_PLACEHOLDER_ATH_WALLET_M11');
  const athMasterAddress = fixtureAddress('USERNAME_REGISTRY_ATH_MASTER_M11');
  const treasuryAthReceiver = fixtureAddress('USERNAME_REGISTRY_TREASURY_ATH_RECEIVER');
  const vaultAddress = fixtureAddress('USERNAME_REGISTRY_VAULT_M11');

  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, deployer.address);
  const registryAddress = contractAddress(0, registryInit);

  const officialZeroInit = await ATHWallet.init(0n, registryAddress, athMasterAddress);
  const officialBalanceInit = await ATHWallet.init(officialWalletBalance, registryAddress, athMasterAddress);
  const officialAthWalletAddress = contractAddress(registryAddress.workChain, officialZeroInit);

  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('2'),
    workchain: registryAddress.workChain,
  }));
  await blockchain.setShardAccount(officialAthWalletAddress, createShardAccount({
    address: officialAthWalletAddress,
    code: officialZeroInit.code,
    data: officialBalanceInit.data,
    balance: toNano('2'),
    workchain: officialAthWalletAddress.workChain,
  }));

  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));
  const officialAthWallet = blockchain.openContract(new ATHWallet(officialAthWalletAddress, officialZeroInit));

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWalletAddress,
  } as BindOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameVault',
    deployment_manifest_hash: MANIFEST_HASH,
    vault_address: vaultAddress,
  } as BindUsernameVault);

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, registryAddress, officialAthWallet, officialAthWalletAddress, athMasterAddress, flusher };
}

async function createRefundDue(blockchain: Blockchain, registry: any, officialAthWalletAddress: Address, ownerWallet: Address, amount = PRICE_6_PLUS) {
  await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.1') }, {
    $$type: 'AthTransferNotificationMintUsername',
    query_id: 501n,
    amount,
    sender_key: 0n,
    owner_wallet: ownerWallet,
    username_len: 6n,
    username: usernameSlice('Larisa'),
  } as AthTransferNotificationMintUsername);
}

describe('UsernameRegistry ATH refund flush milestone', () => {
  it('USERNAME-REG-M11-01: FlushAthRefundDue sends bounce-safe ATH transfer, clears due on recipient wallet ACK, and credits recipient ATH wallet', async () => {
    const { blockchain, registry, officialAthWallet, officialAthWalletAddress, athMasterAddress, flusher } = await deploySealedRegistryWithOfficialWallet(PRICE_6_PLUS);
    const ownerWallet = fixtureAddress('USERNAME_M11_REFUND_OWNER');

    await createRefundDue(blockchain, registry, officialAthWalletAddress, ownerWallet);
    expect(await registry.getGetRefundDue(ownerWallet)).toBe(PRICE_6_PLUS);

    const recipientAthWalletAddress = await registry.getGetAthWalletAddress(ownerWallet);
    await registry.send(flusher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushAthRefundDue',
      query_id: 9001n,
      owner_wallet: ownerWallet,
    } as FlushAthRefundDue);

    const recipientInit = await ATHWallet.init(0n, ownerWallet, athMasterAddress);
    const recipientWallet = blockchain.openContract(new ATHWallet(recipientAthWalletAddress, recipientInit));

    expect(await registry.getGetRefundDue(ownerWallet)).toBe(0n);
    expect((await registry.getGetPendingRefundFlushFor(ownerWallet, 9001n)).exists).toBe(false);
    expect((await registry.getGetGlobal()).pending_refund_flush_count).toBe(0n);
    expect((await registry.getGetGlobal()).refund_due_count).toBe(0n);
    expect((await officialAthWallet.getGetWalletData()).balance).toBe(0n);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(PRICE_6_PLUS);
  });

  it('USERNAME-REG-M11-02: official ATH wallet request bounce restores refund due and clears pending flush', async () => {
    const { blockchain, registry, officialAthWallet, officialAthWalletAddress, flusher } = await deploySealedRegistryWithOfficialWallet(0n);
    const ownerWallet = fixtureAddress('USERNAME_M11_REFUND_OWNER_BOUNCE');

    await createRefundDue(blockchain, registry, officialAthWalletAddress, ownerWallet);
    expect(await registry.getGetRefundDue(ownerWallet)).toBe(PRICE_6_PLUS);

    await registry.send(flusher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushAthRefundDue',
      query_id: 9002n,
      owner_wallet: ownerWallet,
    } as FlushAthRefundDue);

    expect(await registry.getGetRefundDue(ownerWallet)).toBe(PRICE_6_PLUS);
    expect((await registry.getGetPendingRefundFlushFor(ownerWallet, 9002n)).exists).toBe(false);
    expect((await registry.getGetGlobal()).pending_refund_flush_count).toBe(0n);
    expect((await registry.getGetGlobal()).refund_due_count).toBe(1n);
    expect((await officialAthWallet.getGetWalletData()).balance).toBe(0n);
  });
});
