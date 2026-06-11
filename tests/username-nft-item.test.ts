import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, Dictionary, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import {
  UsernameNFTItem,
  InitializeUsernameItem,
  NftTransfer,
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
  return BigInt('0x' + beginCell()
    .storeUint(0xC5CC7CD6, 32)
    .storeBuffer(Buffer.from(name, 'ascii'))
    .endCell()
    .hash()
    .toString('hex'));
}

function usernameSlice(name: string) {
  return beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse();
}

function metadataKey(field: string): bigint {
  return BigInt('0x' + createHash('sha256').update(field).digest('hex'));
}

function readSnakeText(cell: any): string {
  const slice = cell.beginParse();
  expect(slice.loadUint(8)).toBe(0);
  return slice.loadBuffer(Math.floor(slice.remainingBits / 8)).toString('utf8');
}

function emptySlice() {
  return beginCell().endCell().beginParse();
}

function inboundValue(tx: any): bigint {
  const info = tx?.inMessage?.info;
  if (info?.type !== 'internal') throw new Error('missing inbound internal value');
  return info.value.coins;
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
  const itemInit = await UsernameNFTItem.init(registryAddress, usernameHash);
  const itemAddress = contractAddress(registryAddress.workChain, itemInit);
  await blockchain.setShardAccount(itemAddress, createShardAccount({
    address: itemAddress,
    code: itemInit.code,
    data: itemInit.data,
    balance: toNano('1'),
    workchain: itemAddress.workChain,
  }));
  const item = blockchain.openContract(new UsernameNFTItem(itemAddress, itemInit));
  await item.send(blockchain.sender(registryAddress), { value: ITEM_ACK_RESEND_RESERVE }, {
    $$type: 'InitializeUsernameItem',
    owner_wallet: ownerWallet,
    username_len: 6n,
    username: usernameSlice('platho'),
  } as InitializeUsernameItem);

  return { blockchain, caller, ownerWallet, registry, registryAddress, item, itemAddress, usernameHash };
}

describe('UsernameNFTItem v1 milestone', () => {
  it('USERNAME-NFT-00A: initialization accepts canonical separator characters and still rejects uppercase aliases', async () => {
    const blockchain = await Blockchain.create();
    const registry = await blockchain.treasury('username-nft-canonical-registry');
    const ownerWallet = fixtureAddress('USERNAME_CANONICAL_OWNER');
    const validHash = nameHash('name_1-x');
    const validInit = await UsernameNFTItem.init(registry.address, validHash);
    const validAddress = contractAddress(registry.address.workChain, validInit);
    await blockchain.setShardAccount(validAddress, createShardAccount({
      address: validAddress,
      code: validInit.code,
      data: validInit.data,
      balance: toNano('1'),
      workchain: validAddress.workChain,
    }));
    const validItem = blockchain.openContract(new UsernameNFTItem(validAddress, validInit));

    await validItem.send(registry.getSender(), { value: ITEM_ACK_RESEND_RESERVE }, {
      $$type: 'InitializeUsernameItem',
      owner_wallet: ownerWallet,
      username_len: 8n,
      username: usernameSlice('name_1-x'),
    } as InitializeUsernameItem);

    expect((await validItem.getGetState()).initialized).toBe(true);

    const invalidHash = nameHash('Name_1-x');
    const invalidInit = await UsernameNFTItem.init(registry.address, invalidHash);
    const invalidAddress = contractAddress(registry.address.workChain, invalidInit);
    await blockchain.setShardAccount(invalidAddress, createShardAccount({
      address: invalidAddress,
      code: invalidInit.code,
      data: invalidInit.data,
      balance: toNano('1'),
      workchain: invalidAddress.workChain,
    }));
    const invalidItem = blockchain.openContract(new UsernameNFTItem(invalidAddress, invalidInit));

    await invalidItem.send(registry.getSender(), { value: ITEM_ACK_RESEND_RESERVE }, {
      $$type: 'InitializeUsernameItem',
      owner_wallet: ownerWallet,
      username_len: 8n,
      username: usernameSlice('Name_1-x'),
    } as InitializeUsernameItem);

    expect((await invalidItem.getGetState()).initialized).toBe(false);
  });

  it('USERNAME-NFT-01: item StateInit deterministically binds registry address and name hash, not current owner', async () => {
    const { ownerWallet, registryAddress, itemAddress, usernameHash } = await deployItem();
    const otherOwner = fixtureAddress('USERNAME_OTHER_OWNER_WALLET');

    const repeatInit = await UsernameNFTItem.init(registryAddress, usernameHash);
    const repeatAddress = contractAddress(registryAddress.workChain, repeatInit);
    const otherOwnerStillSameInit = await UsernameNFTItem.init(registryAddress, usernameHash);
    const otherOwnerStillSameAddress = contractAddress(registryAddress.workChain, otherOwnerStillSameInit);

    expect(itemAddress.equals(repeatAddress)).toBe(true);
    expect(itemAddress.equals(otherOwnerStillSameAddress)).toBe(true);
    expect(ownerWallet.equals(otherOwner)).toBe(false);
  });

  it('USERNAME-NFT-02: ResendDeployedAck is permissionless and sends immutable owner/name identity to registry', async () => {
    const { caller, registry, item, ownerWallet, usernameHash } = await deployItem();
    const before = await registry.getGetState();

    const result = await item.send(caller.getSender(), { value: ITEM_ACK_RESEND_RESERVE }, {
      $$type: 'ResendDeployedAck',
    } as ResendDeployedAck);

    const state = await registry.getGetState();
    expect(state.ack_count).toBe(before.ack_count + 1n);
    expect(state.last_name_hash).toBe(usernameHash);
    expect(state.last_owner_wallet.equals(ownerWallet)).toBe(true);
    const ackTx = findTransaction(result.transactions, {
      from: item.address,
      to: registry.address,
    });
    expect(inboundValue(ackTx)).toBe(ITEM_ACK_FORWARD_RESERVE);
  });

  it('USERNAME-NFT-04: underfunded ResendDeployedAck is rejected to prevent storage-reserve drain', async () => {
    const { blockchain, caller, registry, item, itemAddress } = await deployItem();
    const before = await registry.getGetState();

    await item.send(caller.getSender(), { value: ITEM_ACK_RESEND_RESERVE - 1n }, {
      $$type: 'ResendDeployedAck',
    } as ResendDeployedAck);

    expect((await registry.getGetState()).ack_count).toBe(before.ack_count);

    const beforeItemBalance = (await blockchain.getContract(itemAddress)).balance;
    await item.send(caller.getSender(), { value: ITEM_ACK_RESEND_RESERVE }, {
      $$type: 'ResendDeployedAck',
    } as ResendDeployedAck);
    const afterItemBalance = (await blockchain.getContract(itemAddress)).balance;

    expect((await registry.getGetState()).ack_count).toBe(before.ack_count + 1n);
    expect(afterItemBalance).toBeGreaterThanOrEqual(beforeItemBalance);
  });

  it('USERNAME-NFT-05: ResendDeployedAck rejects large overpayment instead of trapping excess TON', async () => {
    const { caller, registry, item } = await deployItem();
    const before = await registry.getGetState();

    await item.send(caller.getSender(), { value: toNano('0.05') }, {
      $$type: 'ResendDeployedAck',
    } as ResendDeployedAck);

    expect((await registry.getGetState()).ack_count).toBe(before.ack_count);
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

  it('USERNAME-NFT-06: owner can transfer username NFT and get_nft_data follows the new owner', async () => {
    const { blockchain, item, ownerWallet, registryAddress, usernameHash } = await deployItem();
    const nextOwner = fixtureAddress('USERNAME_TRANSFER_NEXT_OWNER');
    const responseDestination = fixtureAddress('USERNAME_TRANSFER_RESPONSE');

    await item.send(blockchain.sender(ownerWallet), { value: 14_000_000n }, {
      $$type: 'NftTransfer',
      query_id: 77n,
      new_owner: nextOwner,
      response_destination: responseDestination,
      custom_payload: null,
      forward_amount: 0n,
      forward_payload: emptySlice(),
    } as NftTransfer);

    const state = await item.getGetState();
    const nftData = await item.getGetNftData();
    expect(state.owner_wallet.equals(nextOwner)).toBe(true);
    expect(state.name_hash).toBe(usernameHash);
    expect(nftData.owner_address.equals(nextOwner)).toBe(true);
    expect(nftData.collection_address.equals(registryAddress)).toBe(true);
  });

  it('USERNAME-NFT-06A: owner notification normalizes empty forward payload to TEP-62 inline empty payload', async () => {
    const { blockchain, item, ownerWallet } = await deployItem();
    const nextOwner = fixtureAddress('USERNAME_TRANSFER_NOTIFY_OWNER');
    const responseDestination = fixtureAddress('USERNAME_TRANSFER_NOTIFY_RESPONSE');

    const result = await item.send(blockchain.sender(ownerWallet), { value: 20_000_000n }, {
      $$type: 'NftTransfer',
      query_id: 79n,
      new_owner: nextOwner,
      response_destination: responseDestination,
      custom_payload: null,
      forward_amount: 1_000_000n,
      forward_payload: emptySlice(),
    } as NftTransfer);

    const notification = findTransaction(result.transactions, {
      from: item.address,
      to: nextOwner,
      op: 0x05138D91,
    });
    expect(notification).toBeDefined();
    const body = notification!.inMessage!.body.beginParse();
    expect(body.loadUint(32)).toBe(0x05138D91);
    expect(body.loadUintBig(64)).toBe(79n);
    expect(body.loadAddress().equals(ownerWallet)).toBe(true);
    expect(body.loadBit()).toBe(false);
    expect(body.remainingBits).toBe(0);
    expect(body.remainingRefs).toBe(0);
    expect((await item.getGetState()).owner_wallet.equals(nextOwner)).toBe(true);
  });

  it('RT-UNFT-004: forward transfer assigns ownership and notifies non-contract recipient without rollback', async () => {
    const { blockchain, item, ownerWallet } = await deployItem();
    const nextOwner = fixtureAddress('USERNAME_TRANSFER_NON_CONTRACT_OWNER');
    const responseDestination = fixtureAddress('USERNAME_TRANSFER_NON_CONTRACT_RESPONSE');
    const forwardPayload = beginCell().storeUint(0xabc, 12).endCell().beginParse();

    const result = await item.send(blockchain.sender(ownerWallet), { value: 22_000_000n }, {
      $$type: 'NftTransfer',
      query_id: 80n,
      new_owner: nextOwner,
      response_destination: responseDestination,
      custom_payload: null,
      forward_amount: 1_250_000n,
      forward_payload: forwardPayload,
    } as NftTransfer);

    const notification = findTransaction(result.transactions, {
      from: item.address,
      to: nextOwner,
      op: 0x05138D91,
    });
    expect(notification).toBeDefined();
    const info = notification!.inMessage!.info;
    expect(info.type).toBe('internal');
    if (info.type === 'internal') {
      expect(info.bounce).toBe(false);
      expect(info.value.coins).toBe(1_250_000n);
    }
    const body = notification!.inMessage!.body.beginParse();
    expect(body.loadUint(32)).toBe(0x05138D91);
    expect(body.loadUintBig(64)).toBe(80n);
    expect(body.loadAddress().equals(ownerWallet)).toBe(true);
    expect(body.loadUint(12)).toBe(0xabc);
    expect(body.remainingBits).toBe(0);
    expect(body.remainingRefs).toBe(0);

    const state = await item.getGetState();
    expect(state.owner_wallet.equals(nextOwner)).toBe(true);
  });

  it('USERNAME-NFT-08: get_nft_data exposes TEP-64 on-chain username metadata without server URI', async () => {
    const { item } = await deployItem();

    const nftData = await item.getGetNftData();
    const content = nftData.individual_content.beginParse();
    expect(content.loadUint(8)).toBe(0);

    const metadata = content.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    expect(readSnakeText(metadata.get(metadataKey('name')))).toBe('platho.ath');
    expect(readSnakeText(metadata.get(metadataKey('description')))).toBe('Platho username');
  });

  it('USERNAME-NFT-07: non-owner cannot transfer username NFT', async () => {
    const { blockchain, item, ownerWallet } = await deployItem();
    const attacker = fixtureAddress('USERNAME_TRANSFER_ATTACKER');
    const nextOwner = fixtureAddress('USERNAME_TRANSFER_FORGED_OWNER');

    await item.send(blockchain.sender(attacker), { value: 14_000_000n }, {
      $$type: 'NftTransfer',
      query_id: 78n,
      new_owner: nextOwner,
      response_destination: attacker,
      custom_payload: null,
      forward_amount: 0n,
      forward_payload: emptySlice(),
    } as NftTransfer);

    const state = await item.getGetState();
    expect(state.owner_wallet.equals(ownerWallet)).toBe(true);
  });
});
