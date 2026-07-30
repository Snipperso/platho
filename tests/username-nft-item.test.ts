import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, contractAddress, Dictionary, toNano } from '@ton/core';
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
const ITEM_ACK_EXEC_RESERVE = 2_000_000n;   // mirrors USERNAME_ITEM_ACK_EXEC_RESERVE, raised 1M->2M in wave-8 (gate 18015 was 56,602 short)
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
  let current = cell;
  let first = true;
  const chunks: Buffer[] = [];
  while (current) {
    const slice = current.beginParse();
    if (first) {
      expect(slice.loadUint(8)).toBe(0);
      first = false;
    }
    chunks.push(slice.loadBuffer(Math.floor(slice.remainingBits / 8)));
    current = slice.remainingRefs > 0 ? slice.loadRef() : null;
  }
  return Buffer.concat(chunks).toString('utf8');
}

function decodeSvgDataUri(uri: string): string {
  const base64Prefix = 'data:image/svg+xml;base64,';
  if (uri.startsWith(base64Prefix)) {
    return Buffer.from(uri.slice(base64Prefix.length), 'base64').toString('utf8');
  }

  const utf8Prefix = 'data:image/svg+xml;utf8,';
  if (uri.startsWith(utf8Prefix)) {
    const rawSvg = uri.slice(utf8Prefix.length);
    try {
      return decodeURIComponent(rawSvg);
    } catch {
      return rawSvg;
    }
  }

  const encodedPrefix = 'data:image/svg+xml,';
  expect(uri.startsWith(encodedPrefix)).toBe(true);
  return decodeURIComponent(uri.slice(encodedPrefix.length));
}

function expectSafeSvgDataUri(uri: string) {
  expect(uri).toMatch(/^data:image\/svg\+xml,/);
  expect(uri).toContain('%3Csvg');
  expect(uri).toContain('%23');
  expect(uri).not.toContain('<svg');
  expect(uri).not.toContain('#');
}

function expectRawSvgData(svg: string) {
  expect(svg).toMatch(/^<svg /);
  expect(svg).toContain('#');
  expect(svg).not.toMatch(/^https?:|^ipfs:|^data:/);
}

function emptySlice() {
  return beginCell().endCell().beginParse();
}

// TEP-62 transfer body after query_id: new_owner, response_destination (MsgAddress —
// null renders addr_none$00), custom_payload (Maybe ^Cell), forward_amount, forward_payload.
function nftTransferPayload(
  newOwner: Address,
  responseDestination: Address | null,
  forwardAmount: bigint,
  forwardPayload = emptySlice(),
  customPayload: Cell | null = null,
) {
  const b = beginCell().storeAddress(newOwner);
  if (responseDestination) b.storeAddress(responseDestination);
  else b.storeUint(0, 2);
  b.storeMaybeRef(customPayload);
  b.storeCoins(forwardAmount);
  b.storeSlice(forwardPayload);
  return b.endCell().beginParse();
}

function inboundValue(tx: any): bigint {
  const info = tx?.inMessage?.info;
  if (info?.type !== 'internal') throw new Error('missing inbound internal value');
  return info.value.coins;
}

async function deployItem(name = 'platho') {
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

  const usernameHash = nameHash(name);
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
    mint_nonce: 1n,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name),
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
      mint_nonce: 1n,
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
      mint_nonce: 1n,
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
      payload: nftTransferPayload(nextOwner, responseDestination, 0n),
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
      payload: nftTransferPayload(nextOwner, responseDestination, 1_000_000n),
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
      payload: nftTransferPayload(nextOwner, responseDestination, 1_250_000n, forwardPayload),
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

  it('USERNAME-NFT-08: get_nft_data exposes slim TEP-64 content (name + description); per-item art removed', async () => {
    const { item } = await deployItem();

    const nftData = await item.getGetNftData();
    const content = nftData.individual_content.beginParse();
    expect(content.loadUint(8)).toBe(0); // on-chain marker

    const metadata = content.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    // The item now carries only the partial content; UsernameRegistry.get_nft_content adds the SVG art.
    expect(readSnakeText(metadata.get(metadataKey('name')))).toBe('platho.ath');
    expect(readSnakeText(metadata.get(metadataKey('description')))).toBe('Private correspondence is a right, not a privilege. This is a username NFT for Platho — the anonymous, post-quantum-encrypted, uncensorable messenger. A permanent, transferable, fully on-chain handle: the name others reach you by, held by no one but you. platho.app');
    expect(metadata.get(metadataKey('image'))).toBeUndefined();
    expect(metadata.get(metadataKey('image_data'))).toBeUndefined();
  });

  it('USERNAME-NFT-12: addr_none response_destination is accepted (TEP-62) and suppresses excesses', async () => {
    const { blockchain, item, ownerWallet } = await deployItem();
    const nextOwner = fixtureAddress('USERNAME_TRANSFER_ADDR_NONE_OWNER');

    const result = await item.send(blockchain.sender(ownerWallet), { value: 50_000_000n }, {
      $$type: 'NftTransfer',
      query_id: 81n,
      payload: nftTransferPayload(nextOwner, null, 0n),
    } as NftTransfer);

    const itemTx = findTransaction(result.transactions, { to: item.address, op: 0x5FCC3D14 });
    expect(itemTx).toBeDefined();
    expect((itemTx!.description as any).aborted).toBe(false);
    expect(itemTx!.outMessagesCount).toBe(0); // no forward, no excesses — value stays on the item
    expect((await item.getGetState()).owner_wallet.equals(nextOwner)).toBe(true);
  });

  it('USERNAME-NFT-13: excesses carry the explicit rest and the item balance never drops (GetGems shape)', async () => {
    const { blockchain, item, itemAddress, ownerWallet } = await deployItem();
    const nextOwner = fixtureAddress('USERNAME_TRANSFER_REST_OWNER');
    const responseDestination = fixtureAddress('USERNAME_TRANSFER_REST_RESPONSE');
    const balanceBefore = (await blockchain.getContract(itemAddress)).balance;

    // GetGems put-on-sale shape: value 0.213, forward 0.2.
    const value = 213_000_000n;
    const forwardAmount = 200_000_000n;
    const result = await item.send(blockchain.sender(ownerWallet), { value }, {
      $$type: 'NftTransfer',
      query_id: 82n,
      payload: nftTransferPayload(nextOwner, responseDestination, forwardAmount),
    } as NftTransfer);

    const notification = findTransaction(result.transactions, { from: item.address, to: nextOwner, op: 0x05138D91 });
    expect(notification).toBeDefined();
    expect(inboundValue(notification)).toBe(forwardAmount);

    // rest = value - exec reserve (2M) - forward - fwd-fee allowance (10M) = 1M exactly.
    const excesses = findTransaction(result.transactions, { from: item.address, to: responseDestination, op: 0xD53276DB });
    expect(excesses).toBeDefined();
    expect(inboundValue(excesses)).toBe(value - 2_000_000n - forwardAmount - 10_000_000n);

    // The v1 defect paid ~forward_amount out of the item's own balance; the fix must not.
    const balanceAfter = (await blockchain.getContract(itemAddress)).balance;
    expect(balanceAfter >= balanceBefore).toBe(true);
    expect((await item.getGetState()).owner_wallet.equals(nextOwner)).toBe(true);
  });

  it('USERNAME-NFT-14: GetGems put-on-sale transfer succeeds at a ~0.05 item balance (v1 failed action phase)', async () => {
    const { blockchain, item, itemAddress, ownerWallet } = await deployItem();
    const nextOwner = fixtureAddress('USERNAME_TRANSFER_LOW_BALANCE_OWNER');
    const responseDestination = fixtureAddress('USERNAME_TRANSFER_LOW_BALANCE_RESPONSE');

    // The GetGems server pre-flight emulates at a synthetic ~0.0505 item balance.
    const contract = await blockchain.getContract(itemAddress);
    const shard = contract.account;
    shard.account!.storage.balance.coins = 50_495_715n;
    await blockchain.setShardAccount(itemAddress, shard);

    const result = await item.send(blockchain.sender(ownerWallet), { value: 213_000_000n }, {
      $$type: 'NftTransfer',
      query_id: 83n,
      payload: nftTransferPayload(nextOwner, responseDestination, 200_000_000n),
    } as NftTransfer);

    const itemTx = findTransaction(result.transactions, { to: item.address, op: 0x5FCC3D14 });
    expect(itemTx).toBeDefined();
    expect((itemTx!.description as any).aborted).toBe(false);
    expect((itemTx!.description as any).actionPhase?.resultCode).toBe(0);
    expect(itemTx!.outMessagesCount).toBe(2);
    expect((await item.getGetState()).owner_wallet.equals(nextOwner)).toBe(true);
  });

  it('USERNAME-NFT-15: ref-encoded forward_payload (Either bit 1 + ^Cell) is forwarded verbatim', async () => {
    const { blockchain, item, ownerWallet } = await deployItem();
    const nextOwner = fixtureAddress('USERNAME_TRANSFER_REF_PAYLOAD_OWNER');
    const responseDestination = fixtureAddress('USERNAME_TRANSFER_REF_PAYLOAD_RESPONSE');
    const payloadRef = beginCell().storeUint(0xdeadbeef, 32).endCell();
    const forwardPayload = beginCell().storeBit(1).storeRef(payloadRef).endCell().beginParse();

    const result = await item.send(blockchain.sender(ownerWallet), { value: 40_000_000n }, {
      $$type: 'NftTransfer',
      query_id: 84n,
      payload: nftTransferPayload(nextOwner, responseDestination, 5_000_000n, forwardPayload),
    } as NftTransfer);

    const notification = findTransaction(result.transactions, { from: item.address, to: nextOwner, op: 0x05138D91 });
    expect(notification).toBeDefined();
    const body = notification!.inMessage!.body.beginParse();
    expect(body.loadUint(32)).toBe(0x05138D91);
    expect(body.loadUintBig(64)).toBe(84n);
    expect(body.loadAddress().equals(ownerWallet)).toBe(true);
    expect(body.loadBit()).toBe(true);
    expect(body.loadRef().hash().equals(payloadRef.hash())).toBe(true);
    expect(body.remainingBits).toBe(0);
    expect(body.remainingRefs).toBe(0);
  });

  it('USERNAME-NFT-17: custom_payload = Some(^Cell) is consumed and does not shift forward_amount/payload parsing', async () => {
    const { blockchain, item, ownerWallet } = await deployItem();
    const nextOwner = fixtureAddress('USERNAME_TRANSFER_CUSTOM_PAYLOAD_OWNER');
    const responseDestination = fixtureAddress('USERNAME_TRANSFER_CUSTOM_PAYLOAD_RESPONSE');
    const customPayload = beginCell().storeUint(0xc0ffee, 24).endCell();
    const payloadRef = beginCell().storeUint(0xfeedface, 32).endCell();
    const forwardPayload = beginCell().storeBit(1).storeRef(payloadRef).endCell().beginParse();

    const result = await item.send(blockchain.sender(ownerWallet), { value: 40_000_000n }, {
      $$type: 'NftTransfer',
      query_id: 86n,
      payload: nftTransferPayload(nextOwner, responseDestination, 5_000_000n, forwardPayload, customPayload),
    } as NftTransfer);

    const notification = findTransaction(result.transactions, { from: item.address, to: nextOwner, op: 0x05138D91 });
    expect(notification).toBeDefined();
    expect(inboundValue(notification)).toBe(5_000_000n); // forward_amount read exactly despite the Maybe ref
    const body = notification!.inMessage!.body.beginParse();
    body.loadUint(32); body.loadUintBig(64); body.loadAddress();
    expect(body.loadBit()).toBe(true);
    expect(body.loadRef().hash().equals(payloadRef.hash())).toBe(true); // custom_payload ref absent from outbound body
    expect(body.remainingRefs).toBe(0);
    expect((await item.getGetState()).owner_wallet.equals(nextOwner)).toBe(true);
  });

  it('USERNAME-NFT-16: transfer with value below the explicit budget throws 18035 and keeps the owner', async () => {
    const { blockchain, item, ownerWallet } = await deployItem();
    const nextOwner = fixtureAddress('USERNAME_TRANSFER_UNDERFUNDED_OWNER');
    const responseDestination = fixtureAddress('USERNAME_TRANSFER_UNDERFUNDED_RESPONSE');

    // budget = exec 2M + forward 200M + allowance 10M = 212M; send 211M.
    const result = await item.send(blockchain.sender(ownerWallet), { value: 211_000_000n }, {
      $$type: 'NftTransfer',
      query_id: 85n,
      payload: nftTransferPayload(nextOwner, responseDestination, 200_000_000n),
    } as NftTransfer);

    const itemTx = findTransaction(result.transactions, { to: item.address, op: 0x5FCC3D14 });
    expect((itemTx!.description as any).computePhase?.exitCode).toBe(18035);
    expect((await item.getGetState()).owner_wallet.equals(ownerWallet)).toBe(true);
  });

  it('USERNAME-NFT-07: non-owner cannot transfer username NFT', async () => {
    const { blockchain, item, ownerWallet } = await deployItem();
    const attacker = fixtureAddress('USERNAME_TRANSFER_ATTACKER');
    const nextOwner = fixtureAddress('USERNAME_TRANSFER_FORGED_OWNER');

    await item.send(blockchain.sender(attacker), { value: 14_000_000n }, {
      $$type: 'NftTransfer',
      query_id: 78n,
      payload: nftTransferPayload(nextOwner, attacker, 0n),
    } as NftTransfer);

    const state = await item.getGetState();
    expect(state.owner_wallet.equals(ownerWallet)).toBe(true);
  });
});
