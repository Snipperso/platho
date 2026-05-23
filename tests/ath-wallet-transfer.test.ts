import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import {
  ATHWallet,
  ATHInternalTransferWithNotify,
  ATHTransferRequest,
  ATHTransferRequestWithNotify,
  AthTransferNotificationAck,
  PruneStaleNotification,
  storeATHInternalTransferWithNotify,
  storeAthTransferNotification,
} from '../build/ATHWallet/ATHWallet_ATHWallet';

const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 0x41544E49n;
const ATH_PENDING_NOTIFICATION_TTL = 86_400;

function senderKey(senderOwner: Address): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(ATH_TRANSFER_NOTIFY_ID_DOMAIN, 32)
    .storeAddress(senderOwner)
    .endCell()
    .hash()
    .toString('hex')) % 4_294_967_296n;
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function rawFixtureAddress(raw: string): Address {
  return Address.parseRaw(raw);
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

async function contractBalance(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
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

  it('ATH-XFER-04B: notify transfer does not strand owner overpayment in recipient ATH wallet', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = await blockchain.treasury('ath-transfer-notify-excess-source');
    const recipientOwner = await blockchain.treasury('ath-transfer-notify-excess-recipient');
    const master = fixtureAddress('ATH_TRANSFER_NOTIFY_EXCESS_MASTER');
    const sourceWallet = await deployWallet(blockchain, sourceOwner.address, master, 1_000n);
    const recipientInit = await ATHWallet.init(0n, recipientOwner.address, master);
    const recipientAddress = contractAddress(recipientOwner.address.workChain, recipientInit);

    await sourceWallet.send(sourceOwner.getSender(), { value: toNano('0.3') }, {
      $$type: 'ATHTransferRequestWithNotify',
      query_id: 414n,
      amount: 100n,
      recipient: recipientOwner.address,
      response_destination: sourceOwner.address,
      notify_destination: recipientOwner.address,
      notify_value: toNano('0.03'),
    } as ATHTransferRequestWithNotify);

    const recipientWallet = blockchain.openContract(new ATHWallet(recipientAddress, recipientInit));
    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
    expect(await contractBalance(blockchain, recipientAddress)).toBeLessThan(toNano('0.01'));
  });

  it('ATH-XFER-05: stale notify pending can be pruned when destination never ACKs', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;
    const sourceOwner = await blockchain.treasury('ath-transfer-stale-notify-source');
    const recipientOwner = await blockchain.treasury('ath-transfer-stale-notify-recipient');
    const pruner = await blockchain.treasury('ath-transfer-stale-notify-pruner');
    const master = fixtureAddress('ATH_TRANSFER_STALE_NOTIFY_MASTER');
    const queryId = 505n;

    const sourceWallet = await deployWallet(blockchain, sourceOwner.address, master, 1_000n);
    const recipientInit = await ATHWallet.init(0n, recipientOwner.address, master);
    const recipientAddress = contractAddress(recipientOwner.address.workChain, recipientInit);

    await sourceWallet.send(sourceOwner.getSender(), { value: toNano('0.3') }, {
      $$type: 'ATHTransferRequestWithNotify',
      query_id: queryId,
      amount: 100n,
      recipient: recipientOwner.address,
      response_destination: sourceOwner.address,
      notify_destination: recipientOwner.address,
      notify_value: toNano('0.05'),
    } as ATHTransferRequestWithNotify);

    const recipientWallet = blockchain.openContract(new ATHWallet(recipientAddress, recipientInit));
    const key = senderKey(sourceOwner.address);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(true);

    await recipientWallet.send(pruner.getSender(), { value: toNano('0.05') }, {
      $$type: 'PruneStaleNotification',
      query_id: queryId,
      sender_key: key,
    } as PruneStaleNotification);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(true);

    blockchain.now = (blockchain.now ?? 0) + ATH_PENDING_NOTIFICATION_TTL + 1;
    await recipientWallet.send(pruner.getSender(), { value: toNano('0.05') }, {
      $$type: 'PruneStaleNotification',
      query_id: queryId,
      sender_key: key,
    } as PruneStaleNotification);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(false);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);

    await recipientWallet.send(recipientOwner.getSender(), { value: toNano('0.05') }, {
      $$type: 'AthTransferNotificationAck',
      query_id: queryId,
      amount: 100n,
      sender_key: key,
    } as AthTransferNotificationAck);

    await sourceWallet.send(sourceOwner.getSender(), { value: toNano('0.3') }, {
      $$type: 'ATHTransferRequestWithNotify',
      query_id: queryId,
      amount: 70n,
      recipient: recipientOwner.address,
      response_destination: sourceOwner.address,
      notify_destination: recipientOwner.address,
      notify_value: toNano('0.05'),
    } as ATHTransferRequestWithNotify);

    expect((await sourceWallet.getGetWalletData()).balance).toBe(900n);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(false);
  });

  it('ATH-XFER-05B: pruned notification tombstone blocks later reuse of same query and sender-key slot', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_100_000;
    const ownerA = rawFixtureAddress('0:1bfcc4a48a30afb134facb308d9f58389f3cb4b618811901f564cb2c8a95e78c');
    const ownerB = rawFixtureAddress('0:a6b6dd711ce9361e0a359d587f2c996b746919067ca4dbce81827916e9618347');
    const recipientOwner = await blockchain.treasury('ath-transfer-colliding-recipient');
    const pruner = await blockchain.treasury('ath-transfer-colliding-pruner');
    const master = fixtureAddress('ATH_TRANSFER_COLLIDING_NOTIFY_MASTER');
    const queryId = 515n;
    const key = senderKey(ownerA);
    expect(senderKey(ownerB)).toBe(key);

    const recipientInit = await ATHWallet.init(0n, recipientOwner.address, master);
    const recipientAddress = contractAddress(recipientOwner.address.workChain, recipientInit);
    const recipientWallet = await deployWallet(blockchain, recipientOwner.address, master, 0n);
    const sourceInitA = await ATHWallet.init(0n, ownerA, master);
    const sourceAddressA = contractAddress(ownerA.workChain, sourceInitA);
    const sourceInitB = await ATHWallet.init(0n, ownerB, master);
    const sourceAddressB = contractAddress(ownerB.workChain, sourceInitB);

    await blockchain.sendMessage(internal({
      from: sourceAddressA,
      to: recipientAddress,
      value: toNano('0.05'),
      body: beginCell().store(storeATHInternalTransferWithNotify({
        $$type: 'ATHInternalTransferWithNotify',
        query_id: queryId,
        amount: 100n,
        sender_owner: ownerA,
        response_destination: ownerA,
        notify_destination: recipientOwner.address,
        notify_value: toNano('0.03'),
      } as ATHInternalTransferWithNotify)).endCell(),
    }));

    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(true);

    blockchain.now = (blockchain.now ?? 0) + ATH_PENDING_NOTIFICATION_TTL + 1;
    await recipientWallet.send(pruner.getSender(), { value: toNano('0.05') }, {
      $$type: 'PruneStaleNotification',
      query_id: queryId,
      sender_key: key,
    } as PruneStaleNotification);

    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(false);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);

    const collidingReuse = await blockchain.sendMessage(internal({
      from: sourceAddressB,
      to: recipientAddress,
      value: toNano('0.05'),
      body: beginCell().store(storeATHInternalTransferWithNotify({
        $$type: 'ATHInternalTransferWithNotify',
        query_id: queryId,
        amount: 70n,
        sender_owner: ownerB,
        response_destination: ownerB,
        notify_destination: recipientOwner.address,
        notify_value: toNano('0.03'),
      } as ATHInternalTransferWithNotify)).endCell(),
    }));

    expect(findTransaction(collidingReuse.transactions, {
      from: sourceAddressB,
      to: recipientAddress,
      success: false,
    })).toBeDefined();
    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(false);

    await recipientWallet.send(recipientOwner.getSender(), { value: toNano('0.05') }, {
      $$type: 'AthTransferNotificationAck',
      query_id: queryId,
      amount: 100n,
      sender_key: key,
    } as AthTransferNotificationAck);

    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(false);
  });

  it('ATH-XFER-06: low-value bounced notify does not debit before refund hop can be funded', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = await blockchain.treasury('ath-transfer-low-bounce-source');
    const recipientOwner = await blockchain.treasury('ath-transfer-low-bounce-recipient');
    const master = fixtureAddress('ATH_TRANSFER_LOW_BOUNCE_MASTER');
    const queryId = 606n;

    const sourceWallet = await deployWallet(blockchain, sourceOwner.address, master, 1_000n);
    const recipientInit = await ATHWallet.init(0n, recipientOwner.address, master);
    const recipientAddress = contractAddress(recipientOwner.address.workChain, recipientInit);

    await sourceWallet.send(sourceOwner.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferRequestWithNotify',
      query_id: queryId,
      amount: 100n,
      recipient: recipientOwner.address,
      response_destination: sourceOwner.address,
      notify_destination: recipientOwner.address,
      notify_value: toNano('0.03'),
    } as ATHTransferRequestWithNotify);

    const recipientWallet = blockchain.openContract(new ATHWallet(recipientAddress, recipientInit));
    const key = senderKey(sourceOwner.address);
    expect((await sourceWallet.getGetWalletData()).balance).toBe(900n);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(true);

    const bouncedBody = beginCell()
      .storeUint(0xffffffff, 32)
      .store(storeAthTransferNotification({
        $$type: 'AthTransferNotification',
        query_id: queryId,
        amount: 100n,
        sender_key: key,
        sender_wallet: sourceOwner.address,
      }))
      .endCell();

    await blockchain.sendMessage(internal({
      from: recipientOwner.address,
      to: recipientAddress,
      value: 5_000_000n,
      bounced: true,
      bounce: false,
      body: bouncedBody,
    }));

    expect((await sourceWallet.getGetWalletData()).balance).toBe(900n);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(true);
  });
});
