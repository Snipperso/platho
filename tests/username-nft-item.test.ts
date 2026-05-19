import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameNFTItem,
  ResendDeployedAck,
  TopUpStorageReserve,
} from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';
import {
  MockUsernameRegistryAckSink,
} from '../build/MockUsernameRegistryAckSink/MockUsernameRegistryAckSink_MockUsernameRegistryAckSink';

const ITEM_ACK_FORWARD_RESERVE = 3_000_000n;
const ITEM_ACK_EXEC_RESERVE = 1_000_000n;
const ITEM_ACK_RESEND_RESERVE = ITEM_ACK_FORWARD_RESERVE + ITEM_ACK_EXEC_RESERVE;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function nameHash(name: string): bigint {
  return BigInt(`0x${createHash('sha256').update(`PLATHO.V1.USERNAME.${name}`).digest('hex')}`);
}

async function deployItem() {
  const blockchain = await Blockchain.create();
  const caller = await blockchain.treasury('username-nft-item-caller');
  const ownerWallet = fixtureAddress('USERNAME_OWNER_WALLET');
  const initialOwner = fixtureAddress('USERNAME_REGISTRY_INITIAL_OWNER');

  const registryInit = await MockUsernameRegistryAckSink.init(initialOwner);
  const registryAddress = contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('1'),
    workchain: registryAddress.workChain,
  }));
  const registry = blockchain.openContract(new MockUsernameRegistryAckSink(registryAddress, registryInit));

  const usernameHash = nameHash('platho');
  const itemInit = await UsernameNFTItem.init(ownerWallet, registryAddress, usernameHash);
  const itemAddress = contractAddress(0, itemInit);
  await blockchain.setShardAccount(itemAddress, createShardAccount({
    address: itemAddress,
    code: itemInit.code,
    data: itemInit.data,
    balance: toNano('1'),
    workchain: itemAddress.workChain,
  }));
  const item = blockchain.openContract(new UsernameNFTItem(itemAddress, itemInit));

  return { blockchain, caller, ownerWallet, registry, registryAddress, item, itemAddress, usernameHash };
}

describe('UsernameNFTItem v1 milestone', () => {
  it('USERNAME-NFT-01: item StateInit deterministically binds owner wallet, registry address, and name hash', async () => {
    const { ownerWallet, registryAddress, itemAddress, usernameHash } = await deployItem();

    const repeatInit = await UsernameNFTItem.init(ownerWallet, registryAddress, usernameHash);
    const repeatAddress = contractAddress(0, repeatInit);

    expect(itemAddress.equals(repeatAddress)).toBe(true);
  });

  it('USERNAME-NFT-02: ResendDeployedAck is permissionless and sends immutable owner/name identity to registry', async () => {
    const { caller, registry, item, ownerWallet, usernameHash } = await deployItem();

    await item.send(caller.getSender(), { value: toNano('0.05') }, {
      $$type: 'ResendDeployedAck',
    } as ResendDeployedAck);

    const state = await registry.getGetState();
    expect(state.ack_count).toBe(1n);
    expect(state.last_name_hash).toBe(usernameHash);
    expect(state.last_owner_wallet.equals(ownerWallet)).toBe(true);
  });

  it('USERNAME-NFT-04: underfunded ResendDeployedAck is rejected to prevent storage-reserve drain', async () => {
    const { blockchain, caller, registry, item, itemAddress } = await deployItem();

    await item.send(caller.getSender(), { value: ITEM_ACK_RESEND_RESERVE - 1n }, {
      $$type: 'ResendDeployedAck',
    } as ResendDeployedAck);

    expect((await registry.getGetState()).ack_count).toBe(0n);

    const beforeItemBalance = (await blockchain.getContract(itemAddress)).balance;
    await item.send(caller.getSender(), { value: ITEM_ACK_RESEND_RESERVE }, {
      $$type: 'ResendDeployedAck',
    } as ResendDeployedAck);
    const afterItemBalance = (await blockchain.getContract(itemAddress)).balance;

    expect((await registry.getGetState()).ack_count).toBe(1n);
    expect(afterItemBalance).toBeGreaterThanOrEqual(beforeItemBalance);
  });

  it('USERNAME-NFT-03: TopUpStorageReserve grants no ownership/name mutation and empty fallback is rejected', async () => {
    const { caller, item, ownerWallet, registryAddress, usernameHash } = await deployItem();

    await item.send(caller.getSender(), { value: toNano('0.05') }, {
      $$type: 'TopUpStorageReserve',
    } as TopUpStorageReserve);

    const afterTopUp = await item.getGetState();
    expect(afterTopUp.owner_wallet.equals(ownerWallet)).toBe(true);
    expect(afterTopUp.username_registry_address.equals(registryAddress)).toBe(true);
    expect(afterTopUp.name_hash).toBe(usernameHash);

    await item.send(caller.getSender(), { value: toNano('0.05') }, null);

    const afterFallback = await item.getGetState();
    expect(afterFallback.owner_wallet.equals(ownerWallet)).toBe(true);
    expect(afterFallback.username_registry_address.equals(registryAddress)).toBe(true);
    expect(afterFallback.name_hash).toBe(usernameHash);
  });
});
