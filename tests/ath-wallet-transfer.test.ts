import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { ATHWallet, ATHTransferRequest, ATHTransferRequestWithNotify } from '../build/ATHWallet/ATHWallet_ATHWallet';

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

async function deployWallet(blockchain: Blockchain, owner: Address, master: Address, balance: bigint) {
  const zeroInit = await ATHWallet.init(0n, owner, master);
  const dataInit = await ATHWallet.init(balance, owner, master);
  const address = contractAddress(owner.workChain, zeroInit);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: zeroInit.code,
    data: dataInit.data,
    balance: toNano('1'),
    workchain: address.workChain,
  }));
  return blockchain.openContract(new ATHWallet(address, zeroInit));
}

describe('ATH wallet transfer profile', () => {
  it('ATH-XFER-01: owner-authorized transfer debits source wallet and credits deterministic recipient wallet', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = await blockchain.treasury('ath-transfer-source-owner');
    const recipientOwner = fixtureAddress('ATH_TRANSFER_RECIPIENT_OWNER');
    const master = fixtureAddress('ATH_TRANSFER_MASTER');
    const amount = 123_456_789n;

    const sourceWallet = await deployWallet(blockchain, sourceOwner.address, master, 1_000_000_000n);
    const recipientInit = await ATHWallet.init(0n, recipientOwner, master);
    const recipientAddress = contractAddress(recipientOwner.workChain, recipientInit);

    await sourceWallet.send(sourceOwner.getSender(), { value: toNano('0.2') }, {
      $$type: 'ATHTransferRequest',
      query_id: 101n,
      amount,
      recipient: recipientOwner,
      response_destination: sourceOwner.address,
    } as ATHTransferRequest);

    const recipientWallet = blockchain.openContract(new ATHWallet(recipientAddress, recipientInit));
    const sourceData = await sourceWallet.getGetWalletData();
    const recipientData = await recipientWallet.getGetWalletData();

    expect(sourceData.balance).toBe(1_000_000_000n - amount);
    expect(recipientData.balance).toBe(amount);
    expect(recipientData.owner_address.equals(recipientOwner)).toBe(true);
    expect(recipientData.ath_master_address.equals(master)).toBe(true);
  });

  it('ATH-XFER-02: non-owner cannot transfer and failed request does not debit source wallet', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = await blockchain.treasury('ath-transfer-owner-2');
    const attacker = await blockchain.treasury('ath-transfer-attacker');
    const recipientOwner = fixtureAddress('ATH_TRANSFER_RECIPIENT_OWNER_2');
    const master = fixtureAddress('ATH_TRANSFER_MASTER_2');
    const sourceWallet = await deployWallet(blockchain, sourceOwner.address, master, 777n);

    await sourceWallet.send(attacker.getSender(), { value: toNano('0.1') }, {
      $$type: 'ATHTransferRequest',
      query_id: 102n,
      amount: 100n,
      recipient: recipientOwner,
      response_destination: sourceOwner.address,
    } as ATHTransferRequest);

    const sourceData = await sourceWallet.getGetWalletData();
    expect(sourceData.balance).toBe(777n);
  });

  it('ATH-XFER-03: transfer-to-dead-address is still not burn and only credits deterministic wallet for that owner address', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = await blockchain.treasury('ath-transfer-source-owner-3');
    const deadOwner = fixtureAddress('ATH_DEAD_OWNER');
    const master = fixtureAddress('ATH_TRANSFER_MASTER_3');
    const sourceWallet = await deployWallet(blockchain, sourceOwner.address, master, 500n);
    const deadInit = await ATHWallet.init(0n, deadOwner, master);
    const deadWalletAddress = contractAddress(deadOwner.workChain, deadInit);

    await sourceWallet.send(sourceOwner.getSender(), { value: toNano('0.2') }, {
      $$type: 'ATHTransferRequest',
      query_id: 103n,
      amount: 200n,
      recipient: deadOwner,
      response_destination: sourceOwner.address,
    } as ATHTransferRequest);

    const deadWallet = blockchain.openContract(new ATHWallet(deadWalletAddress, deadInit));
    expect((await sourceWallet.getGetWalletData()).balance).toBe(300n);
    expect((await deadWallet.getGetWalletData()).balance).toBe(200n);
  });

  it('ATH-XFER-04: pending notifications are keyed by sender owner plus query id', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwnerA = await blockchain.treasury('ath-transfer-notify-source-a');
    const sourceOwnerB = await blockchain.treasury('ath-transfer-notify-source-b');
    const recipientOwner = await blockchain.treasury('ath-transfer-notify-recipient');
    const master = fixtureAddress('ATH_TRANSFER_NOTIFY_MASTER');

    const sourceWalletA = await deployWallet(blockchain, sourceOwnerA.address, master, 1_000n);
    const sourceWalletB = await deployWallet(blockchain, sourceOwnerB.address, master, 1_000n);
    const recipientInit = await ATHWallet.init(0n, recipientOwner.address, master);
    const recipientAddress = contractAddress(recipientOwner.address.workChain, recipientInit);
    const queryId = 404n;

    await sourceWalletA.send(sourceOwnerA.getSender(), { value: toNano('0.3') }, {
      $$type: 'ATHTransferRequestWithNotify',
      query_id: queryId,
      amount: 100n,
      recipient: recipientOwner.address,
      response_destination: sourceOwnerA.address,
      notify_destination: recipientOwner.address,
      notify_value: toNano('0.05'),
    } as ATHTransferRequestWithNotify);

    await sourceWalletB.send(sourceOwnerB.getSender(), { value: toNano('0.3') }, {
      $$type: 'ATHTransferRequestWithNotify',
      query_id: queryId,
      amount: 200n,
      recipient: recipientOwner.address,
      response_destination: sourceOwnerB.address,
      notify_destination: recipientOwner.address,
      notify_value: toNano('0.05'),
    } as ATHTransferRequestWithNotify);

    const recipientWallet = blockchain.openContract(new ATHWallet(recipientAddress, recipientInit));
    expect((await recipientWallet.getGetWalletData()).balance).toBe(300n);
  });
});
