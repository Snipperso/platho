import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  ATHWallet,
  ATHInternalTransfer,
  ATHInternalTransferWithNotify,
} from '../build/ATHWallet/ATHWallet_ATHWallet';
import { ATHMaster, ATHBurnNotification } from '../build/ATHMaster/ATHMaster_ATHMaster';

const ATH_INTERNAL_TRANSFER_EXEC_RESERVE = 2_000_000n;
const ATH_BURN_NOTIFICATION_EXEC_RESERVE = 2_000_000n;
const ATH_TRANSFER_NOTIFY_ACK_VALUE = 1_000_000n;
const ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT = 2_000_000n;
const ATH_TRANSFER_NOTIFY_EXEC_RESERVE = 2_000_000n;
const ATH_TRANSFER_NOTIFY_MIN_VALUE = 30_000_000n;

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
});
