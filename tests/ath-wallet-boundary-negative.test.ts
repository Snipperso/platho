import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import {
  ATHWallet,
  ATHBurn,
  ATHInternalTransfer,
  ATHInternalTransferWithNotify,
  ATHTransferRequest,
  ATHTransferRequestMintUsername,
  ATHTransferRequestWithNotify,
} from '../build/ATHWallet/ATHWallet_ATHWallet';
import { ATHMaster, ATHBurnNotification } from '../build/ATHMaster/ATHMaster_ATHMaster';

const ATH_INTERNAL_TRANSFER_EXEC_RESERVE = 2_000_000n;
const ATH_BURN_NOTIFICATION_EXEC_RESERVE = 2_000_000n;
const ATH_TRANSFER_NOTIFY_ACK_VALUE = 1_000_000n;
const ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT = 2_000_000n;
const ATH_TRANSFER_NOTIFY_EXEC_RESERVE = 7_000_000n;
const ATH_TRANSFER_NOTIFY_MIN_VALUE = 30_000_000n;
const ATH_OWNER_REQUEST_EXEC_RESERVE = 2_000_000n;
const ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE = 10_000_000n;
const ATH_OWNER_BURN_MIN_VALUE = ATH_BURN_NOTIFICATION_EXEC_RESERVE + ATH_OWNER_REQUEST_EXEC_RESERVE;
const ATH_OWNER_TRANSFER_MIN_VALUE = ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_OWNER_REQUEST_EXEC_RESERVE;
const ATH_OWNER_NOTIFY_MIN_VALUE = ATH_TRANSFER_NOTIFY_MIN_VALUE
  + ATH_TRANSFER_NOTIFY_ACK_VALUE
  + ATH_TRANSFER_NOTIFY_EXEC_RESERVE
  + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT
  + ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.ATH.BND.${label}`).digest());
}

async function deployWallet(blockchain: Blockchain, owner: Address, master: Address, tokenBalance: bigint, tonBalance = toNano('1')) {
  const zeroInit = await ATHWallet.init(0n, owner, master);
  const dataInit = await ATHWallet.init(tokenBalance, owner, master);
  const address = contractAddress(owner.workChain, zeroInit);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: zeroInit.code,
    data: dataInit.data,
    balance: tonBalance,
    workchain: address.workChain,
  }));
  return {
    address,
    wallet: blockchain.openContract(new ATHWallet(address, zeroInit)),
  };
}

describe('ATH wallet/master value boundary negative matrix', () => {
  it('ATH-BND-01: recipient wallet rejects internal transfer without caller-funded execution reserve', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = fixtureAddress('SOURCE_OWNER');
    const recipientOwner = fixtureAddress('RECIPIENT_OWNER');
    const master = fixtureAddress('ATH_MASTER');
    const sourceInit = await ATHWallet.init(0n, sourceOwner, master);
    const sourceWalletAddress = contractAddress(sourceOwner.workChain, sourceInit);
    const { wallet: recipientWallet } = await deployWallet(blockchain, recipientOwner, master, 0n);

    await recipientWallet.send(blockchain.sender(sourceWalletAddress), { value: ATH_INTERNAL_TRANSFER_EXEC_RESERVE - 1n }, {
      $$type: 'ATHInternalTransfer',
      query_id: 1n,
      amount: 100n,
      sender_owner: sourceOwner,
      response_destination: sourceOwner,
    } as ATHInternalTransfer);

    expect((await recipientWallet.getGetWalletData()).balance).toBe(0n);

    await recipientWallet.send(blockchain.sender(sourceWalletAddress), { value: ATH_INTERNAL_TRANSFER_EXEC_RESERVE }, {
      $$type: 'ATHInternalTransfer',
      query_id: 4n,
      amount: 100n,
      sender_owner: sourceOwner,
      response_destination: sourceOwner,
    } as ATHInternalTransfer);

    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
  });

  it('ATH-BND-02: notify transfer requires notification value, ACK value, and recipient execution reserve', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = fixtureAddress('SOURCE_NOTIFY_OWNER');
    const recipientOwner = (await blockchain.treasury('ath-bnd-notify-recipient-owner')).address;
    const master = fixtureAddress('ATH_NOTIFY_MASTER');
    const sourceInit = await ATHWallet.init(0n, sourceOwner, master);
    const sourceWalletAddress = contractAddress(sourceOwner.workChain, sourceInit);
    const { wallet: recipientWallet } = await deployWallet(blockchain, recipientOwner, master, 0n);
    const required = ATH_TRANSFER_NOTIFY_MIN_VALUE
      + ATH_TRANSFER_NOTIFY_ACK_VALUE
      + ATH_TRANSFER_NOTIFY_EXEC_RESERVE
      + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT;

    await recipientWallet.send(blockchain.sender(sourceWalletAddress), { value: required - 1n }, {
      $$type: 'ATHInternalTransferWithNotify',
      query_id: 2n,
      amount: 100n,
      sender_owner: sourceOwner,
      response_destination: sourceOwner,
      notify_destination: recipientOwner,
      notify_value: ATH_TRANSFER_NOTIFY_MIN_VALUE,
    } as ATHInternalTransferWithNotify);

    expect((await recipientWallet.getGetWalletData()).balance).toBe(0n);

    await recipientWallet.send(blockchain.sender(sourceWalletAddress), { value: required }, {
      $$type: 'ATHInternalTransferWithNotify',
      query_id: 5n,
      amount: 100n,
      sender_owner: sourceOwner,
      response_destination: sourceOwner,
      notify_destination: recipientOwner,
      notify_value: ATH_TRANSFER_NOTIFY_MIN_VALUE,
    } as ATHInternalTransferWithNotify);

    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
  });

  it('ATH-BND-03: ATHMaster rejects burn notification without caller-funded execution reserve', async () => {
    const blockchain = await Blockchain.create();
    const owner = fixtureAddress('BURN_OWNER');
    const treasuryOwner = fixtureAddress('TREASURY_OWNER');
    const masterInit = await ATHMaster.init(treasuryOwner, beginCell().storeBuffer(Buffer.from('ATH')).endCell());
    const masterAddress = contractAddress(0, masterInit);
    await blockchain.setShardAccount(masterAddress, createShardAccount({
      address: masterAddress,
      code: masterInit.code,
      data: masterInit.data,
      balance: toNano('1'),
      workchain: masterAddress.workChain,
    }));
    const master = blockchain.openContract(new ATHMaster(masterAddress, masterInit));
    const walletInit = await ATHWallet.init(0n, owner, masterAddress);
    const walletAddress = contractAddress(owner.workChain, walletInit);
    const before = await master.getGetJettonData();

    await master.send(blockchain.sender(walletAddress), { value: ATH_BURN_NOTIFICATION_EXEC_RESERVE - 1n }, {
      $$type: 'ATHBurnNotification',
      query_id: 3n,
      amount: 100n,
      owner_address: owner,
      response_destination: owner,
    } as ATHBurnNotification);

    expect((await master.getGetJettonData()).total_supply).toBe(before.total_supply);

    await master.send(blockchain.sender(walletAddress), { value: ATH_BURN_NOTIFICATION_EXEC_RESERVE }, {
      $$type: 'ATHBurnNotification',
      query_id: 6n,
      amount: 100n,
      owner_address: owner,
      response_destination: owner,
    } as ATHBurnNotification);

    expect((await master.getGetJettonData()).total_supply).toBe(before.total_supply - 100n);
  });

  it('ATH-BND-04: owner transfer minimum covers the source-to-recipient hop before debit', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = await blockchain.treasury('ath-bnd-owner-transfer-source');
    const recipientOwner = fixtureAddress('OWNER_TRANSFER_RECIPIENT');
    const master = fixtureAddress('OWNER_TRANSFER_MASTER');
    const { wallet: sourceWallet } = await deployWallet(blockchain, sourceOwner.address, master, 1_000n);
    const recipientInit = await ATHWallet.init(0n, recipientOwner, master);
    const recipientAddress = contractAddress(recipientOwner.workChain, recipientInit);
    const recipientWallet = blockchain.openContract(new ATHWallet(recipientAddress, recipientInit));

    const oldExactMin = await sourceWallet.send(sourceOwner.getSender(), { value: ATH_INTERNAL_TRANSFER_EXEC_RESERVE }, {
      $$type: 'ATHTransferRequest',
      query_id: 40n,
      amount: 100n,
      recipient: recipientOwner,
      response_destination: sourceOwner.address,
    } as ATHTransferRequest);

    expect((await sourceWallet.getGetWalletData()).balance).toBe(1_000n);
    expect(findTransaction(oldExactMin.transactions, {
      from: sourceWallet.address,
      to: recipientAddress,
      success: true,
    })).toBeUndefined();

    await sourceWallet.send(sourceOwner.getSender(), { value: ATH_OWNER_TRANSFER_MIN_VALUE }, {
      $$type: 'ATHTransferRequest',
      query_id: 41n,
      amount: 100n,
      recipient: recipientOwner,
      response_destination: sourceOwner.address,
    } as ATHTransferRequest);

    expect((await sourceWallet.getGetWalletData()).balance).toBe(900n);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
  });

  it('ATH-BND-05: owner notify minimum covers the first hop before pending notification state is created', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = await blockchain.treasury('ath-bnd-owner-notify-source');
    const recipientOwner = await blockchain.treasury('ath-bnd-owner-notify-recipient');
    const master = fixtureAddress('OWNER_NOTIFY_MASTER');
    const { wallet: sourceWallet } = await deployWallet(blockchain, sourceOwner.address, master, 1_000n);
    const recipientInit = await ATHWallet.init(0n, recipientOwner.address, master);
    const recipientAddress = contractAddress(recipientOwner.address.workChain, recipientInit);
    const recipientWallet = blockchain.openContract(new ATHWallet(recipientAddress, recipientInit));
    const oldExactMin = ATH_TRANSFER_NOTIFY_MIN_VALUE
      + ATH_TRANSFER_NOTIFY_ACK_VALUE
      + ATH_TRANSFER_NOTIFY_EXEC_RESERVE
      + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT;

    const underfunded = await sourceWallet.send(sourceOwner.getSender(), { value: oldExactMin }, {
      $$type: 'ATHTransferRequestWithNotify',
      query_id: 50n,
      amount: 100n,
      recipient: recipientOwner.address,
      response_destination: sourceOwner.address,
      notify_destination: recipientOwner.address,
      notify_value: ATH_TRANSFER_NOTIFY_MIN_VALUE,
    } as ATHTransferRequestWithNotify);

    expect((await sourceWallet.getGetWalletData()).balance).toBe(1_000n);
    expect(findTransaction(underfunded.transactions, {
      from: sourceWallet.address,
      to: recipientAddress,
      success: true,
    })).toBeUndefined();

    await sourceWallet.send(sourceOwner.getSender(), { value: ATH_OWNER_NOTIFY_MIN_VALUE }, {
      $$type: 'ATHTransferRequestWithNotify',
      query_id: 51n,
      amount: 100n,
      recipient: recipientOwner.address,
      response_destination: sourceOwner.address,
      notify_destination: recipientOwner.address,
      notify_value: ATH_TRANSFER_NOTIFY_MIN_VALUE,
    } as ATHTransferRequestWithNotify);

    expect((await sourceWallet.getGetWalletData()).balance).toBe(900n);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
  });

  it('ATH-BND-06: owner burn minimum covers the source-to-master hop before supply is reduced', async () => {
    const blockchain = await Blockchain.create();
    const owner = await blockchain.treasury('ath-bnd-owner-burn-source');
    const treasuryOwner = fixtureAddress('OWNER_BURN_TREASURY');
    const masterInit = await ATHMaster.init(treasuryOwner, beginCell().storeBuffer(Buffer.from('ATH')).endCell());
    const masterAddress = contractAddress(0, masterInit);
    await blockchain.setShardAccount(masterAddress, createShardAccount({
      address: masterAddress,
      code: masterInit.code,
      data: masterInit.data,
      balance: toNano('1'),
      workchain: masterAddress.workChain,
    }));
    const master = blockchain.openContract(new ATHMaster(masterAddress, masterInit));
    const { wallet: sourceWallet } = await deployWallet(blockchain, owner.address, masterAddress, 1_000n);
    const before = await master.getGetJettonData();

    const oldExactMin = await sourceWallet.send(owner.getSender(), { value: ATH_BURN_NOTIFICATION_EXEC_RESERVE }, {
      $$type: 'ATHBurn',
      query_id: 60n,
      amount: 100n,
      response_destination: owner.address,
    } as ATHBurn);

    expect((await sourceWallet.getGetWalletData()).balance).toBe(1_000n);
    expect((await master.getGetJettonData()).total_supply).toBe(before.total_supply);
    expect(findTransaction(oldExactMin.transactions, {
      from: sourceWallet.address,
      to: masterAddress,
      success: true,
    })).toBeUndefined();

    await sourceWallet.send(owner.getSender(), { value: ATH_OWNER_BURN_MIN_VALUE }, {
      $$type: 'ATHBurn',
      query_id: 61n,
      amount: 100n,
      response_destination: owner.address,
    } as ATHBurn);

    expect((await sourceWallet.getGetWalletData()).balance).toBe(900n);
    expect((await master.getGetJettonData()).total_supply).toBe(before.total_supply - 100n);
  });

  it('ATH-BND-07: tiny notify owner excess does not cancel an otherwise valid transfer', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = await blockchain.treasury('ath-bnd-notify-dust-source');
    const recipientOwner = await blockchain.treasury('ath-bnd-notify-dust-recipient');
    const master = fixtureAddress('OWNER_NOTIFY_DUST_MASTER');
    const { wallet: sourceWallet } = await deployWallet(blockchain, sourceOwner.address, master, 1_000n);
    const recipientInit = await ATHWallet.init(0n, recipientOwner.address, master);
    const recipientAddress = contractAddress(recipientOwner.address.workChain, recipientInit);
    const recipientWallet = blockchain.openContract(new ATHWallet(recipientAddress, recipientInit));

    const result = await sourceWallet.send(sourceOwner.getSender(), { value: ATH_OWNER_NOTIFY_MIN_VALUE + 1n }, {
      $$type: 'ATHTransferRequestWithNotify',
      query_id: 70n,
      amount: 100n,
      recipient: recipientOwner.address,
      response_destination: sourceOwner.address,
      notify_destination: recipientOwner.address,
      notify_value: ATH_TRANSFER_NOTIFY_MIN_VALUE,
    } as ATHTransferRequestWithNotify);

    expect(findTransaction(result.transactions, {
      from: sourceWallet.address,
      to: recipientAddress,
      success: true,
    })).toBeDefined();
    expect((await sourceWallet.getGetWalletData()).balance).toBe(900n);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
  });

  it('ATH-BND-08: tiny mint-notify owner excess does not cancel an otherwise valid transfer', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = await blockchain.treasury('ath-bnd-mint-dust-source');
    const recipientOwner = await blockchain.treasury('ath-bnd-mint-dust-recipient');
    const master = fixtureAddress('OWNER_MINT_DUST_MASTER');
    const { wallet: sourceWallet } = await deployWallet(blockchain, sourceOwner.address, master, 1_000n);
    const recipientInit = await ATHWallet.init(0n, recipientOwner.address, master);
    const recipientAddress = contractAddress(recipientOwner.address.workChain, recipientInit);
    const recipientWallet = blockchain.openContract(new ATHWallet(recipientAddress, recipientInit));

    const username = Buffer.from('platho', 'ascii');
    const result = await sourceWallet.send(sourceOwner.getSender(), { value: ATH_OWNER_NOTIFY_MIN_VALUE + 1n }, {
      $$type: 'ATHTransferRequestMintUsername',
      query_id: 80n,
      amount: 100n,
      recipient: recipientOwner.address,
      response_destination: sourceOwner.address,
      notify_value: ATH_TRANSFER_NOTIFY_MIN_VALUE,
      username_len: BigInt(username.length),
      username: beginCell().storeBuffer(username).endCell().beginParse(),
    } as ATHTransferRequestMintUsername);

    expect(findTransaction(result.transactions, {
      from: sourceWallet.address,
      to: recipientAddress,
      success: true,
    })).toBeDefined();
    expect((await sourceWallet.getGetWalletData()).balance).toBe(900n);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
  });
});
