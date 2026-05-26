import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import {
  ATHWallet,
  ATHInternalTransfer,
  ATHInternalTransferMintUsername,
  ATHInternalTransferProfileAvatar,
  ATHInternalTransferWithNotify,
  ATHTransferRequest,
  ATHTransferRequestWithNotify,
  AthTransferNotificationAck,
  PruneStaleNotification,
  storeATHInternalTransfer,
  storeATHInternalTransferMintUsername,
  storeATHInternalTransferProfileAvatar,
  storeATHInternalTransferWithNotify,
  storeATHTransferRequestWithNotify,
  storeAthTransferNotification,
} from '../build/ATHWallet/ATHWallet_ATHWallet';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';

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

  it('ATH-XFER-03B: forged bounced internal transfers cannot mint wallet balance', async () => {
    const blockchain = await Blockchain.create();
    const owner = await blockchain.treasury('ath-forged-bounce-owner');
    const attacker = await blockchain.treasury('ath-forged-bounce-attacker');
    const master = fixtureAddress('ATH_FORGED_BOUNCE_MASTER');
    const wallet = await deployWallet(blockchain, owner.address, master, 0n);
    const amount = 1_000_000_000_000n;
    const username = Buffer.from('platho', 'ascii');

    const forgedBodies = [
      beginCell().store(storeATHInternalTransfer({
        $$type: 'ATHInternalTransfer',
        query_id: 301n,
        amount,
        sender_owner: owner.address,
        response_destination: owner.address,
      } as ATHInternalTransfer)).endCell(),
      beginCell().store(storeATHInternalTransferWithNotify({
        $$type: 'ATHInternalTransferWithNotify',
        query_id: 302n,
        amount,
        sender_owner: owner.address,
        response_destination: owner.address,
        notify_destination: owner.address,
        notify_value: toNano('0.03'),
      } as ATHInternalTransferWithNotify)).endCell(),
      beginCell().store(storeATHInternalTransferMintUsername({
        $$type: 'ATHInternalTransferMintUsername',
        query_id: 303n,
        amount,
        sender_owner: owner.address,
        response_destination: owner.address,
        notify_value: toNano('0.03'),
        username_len: BigInt(username.length),
        username: beginCell().storeBuffer(username).endCell().beginParse(),
      } as ATHInternalTransferMintUsername)).endCell(),
      beginCell().store(storeATHInternalTransferProfileAvatar({
        $$type: 'ATHInternalTransferProfileAvatar',
        query_id: 304n,
        amount,
        sender_owner: owner.address,
        response_destination: owner.address,
        notify_value: toNano('0.03'),
        avatar_hash: 0xabcden,
        avatar_entry_id: 1n,
        avatar_stream_id: 2n,
        avatar_part_count: 1n,
        media_format: 1n,
      } as ATHInternalTransferProfileAvatar)).endCell(),
    ];

    for (const body of forgedBodies) {
      await blockchain.sendMessage(internal({
        from: attacker.address,
        to: wallet.address,
        value: toNano('0.05'),
        bounced: true,
        bounce: false,
        body: beginCell()
          .storeUint(0xffffffff, 32)
          .storeSlice(body.beginParse())
          .endCell(),
      }));
      expect((await wallet.getGetWalletData()).balance).toBe(0n);
    }
  });

  it('ATH-XFER-03C: legitimate recipient bounce restores once and consumes outgoing proof', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = await blockchain.treasury('ath-legit-bounce-source');
    const recipientOwner = fixtureAddress('ATH_LEGIT_BOUNCE_RECIPIENT');
    const master = fixtureAddress('ATH_LEGIT_BOUNCE_MASTER');
    const wrongMaster = fixtureAddress('ATH_LEGIT_BOUNCE_WRONG_MASTER');
    const amount = 250n;
    const queryId = 305n;

    const sourceWallet = await deployWallet(blockchain, sourceOwner.address, master, 1_000n);
    const recipientCorrectInit = await ATHWallet.init(0n, recipientOwner, master);
    const recipientWrongDataInit = await ATHWallet.init(0n, recipientOwner, wrongMaster);
    const recipientAddress = contractAddress(recipientOwner.workChain, recipientCorrectInit);
    await blockchain.setShardAccount(recipientAddress, createShardAccount({
      address: recipientAddress,
      code: recipientCorrectInit.code,
      data: recipientWrongDataInit.data,
      balance: toNano('1'),
      workchain: recipientAddress.workChain,
    }));

    await sourceWallet.send(sourceOwner.getSender(), { value: toNano('0.2') }, {
      $$type: 'ATHTransferRequest',
      query_id: queryId,
      amount,
      recipient: recipientOwner,
      response_destination: sourceOwner.address,
    } as ATHTransferRequest);

    expect((await sourceWallet.getGetWalletData()).balance).toBe(1_000n);

    await blockchain.sendMessage(internal({
      from: recipientAddress,
      to: sourceWallet.address,
      value: toNano('0.05'),
      bounced: true,
      bounce: false,
      body: beginCell()
        .storeUint(0xffffffff, 32)
        .store(storeATHInternalTransfer({
          $$type: 'ATHInternalTransfer',
          query_id: queryId,
          amount,
          sender_owner: sourceOwner.address,
          response_destination: sourceOwner.address,
        } as ATHInternalTransfer))
        .endCell(),
    }));

    expect((await sourceWallet.getGetWalletData()).balance).toBe(1_000n);
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

  it('ATH-XFER-05B2: colliding same-query notify reject restores the source wallet balance', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_150_000;
    const ownerA = rawFixtureAddress('0:1bfcc4a48a30afb134facb308d9f58389f3cb4b618811901f564cb2c8a95e78c');
    const ownerB = rawFixtureAddress('0:a6b6dd711ce9361e0a359d587f2c996b746919067ca4dbce81827916e9618347');
    const recipientOwner = await blockchain.treasury('ath-transfer-colliding-restore-recipient');
    const pruner = await blockchain.treasury('ath-transfer-colliding-restore-pruner');
    const master = fixtureAddress('ATH_TRANSFER_COLLIDING_RESTORE_MASTER');
    const queryId = 516n;
    const key = senderKey(ownerA);
    expect(senderKey(ownerB)).toBe(key);

    const recipientInit = await ATHWallet.init(0n, recipientOwner.address, master);
    const recipientAddress = contractAddress(recipientOwner.address.workChain, recipientInit);
    const recipientWallet = await deployWallet(blockchain, recipientOwner.address, master, 0n);
    const sourceWalletB = await deployWallet(blockchain, ownerB, master, 1_000n);

    const sourceInitA = await ATHWallet.init(0n, ownerA, master);
    const sourceAddressA = contractAddress(ownerA.workChain, sourceInitA);

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

    blockchain.now = (blockchain.now ?? 0) + ATH_PENDING_NOTIFICATION_TTL + 1;
    await recipientWallet.send(pruner.getSender(), { value: toNano('0.05') }, {
      $$type: 'PruneStaleNotification',
      query_id: queryId,
      sender_key: key,
    } as PruneStaleNotification);

    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(false);

    const collidingOwnerRequest = await blockchain.sendMessage(internal({
      from: ownerB,
      to: sourceWalletB.address,
      value: toNano('0.3'),
      body: beginCell().store(storeATHTransferRequestWithNotify({
        $$type: 'ATHTransferRequestWithNotify',
        query_id: queryId,
        amount: 70n,
        recipient: recipientOwner.address,
        response_destination: ownerB,
        notify_destination: recipientOwner.address,
        notify_value: toNano('0.03'),
      } as ATHTransferRequestWithNotify)).endCell(),
    }));

    expect(findTransaction(collidingOwnerRequest.transactions, {
      from: sourceWalletB.address,
      to: recipientAddress,
      success: false,
    })).toBeDefined();
    expect((await sourceWalletB.getGetWalletData()).balance).toBe(1_000n);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(false);
  });

  it('ATH-XFER-05C: processed notify tombstone is shared by username and profile-avatar variants', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_200_000;
    const sourceOwner = await blockchain.treasury('ath-transfer-shared-domain-source');
    const recipientOwner = await blockchain.treasury('ath-transfer-shared-domain-recipient');
    const pruner = await blockchain.treasury('ath-transfer-shared-domain-pruner');
    const master = fixtureAddress('ATH_TRANSFER_SHARED_NOTIFY_DOMAIN_MASTER');
    const queryId = 525n;
    const key = senderKey(sourceOwner.address);

    const sourceWallet = await deployWallet(blockchain, sourceOwner.address, master, 1_000n);
    const recipientInit = await ATHWallet.init(0n, recipientOwner.address, master);
    const recipientAddress = contractAddress(recipientOwner.address.workChain, recipientInit);
    const recipientWallet = blockchain.openContract(new ATHWallet(recipientAddress, recipientInit));

    await sourceWallet.send(sourceOwner.getSender(), { value: toNano('0.051') }, {
      $$type: 'ATHTransferRequestWithNotify',
      query_id: queryId,
      amount: 100n,
      recipient: recipientOwner.address,
      response_destination: sourceOwner.address,
      notify_destination: recipientOwner.address,
      notify_value: toNano('0.03'),
    } as ATHTransferRequestWithNotify);

    blockchain.now = (blockchain.now ?? 0) + ATH_PENDING_NOTIFICATION_TTL + 1;
    await recipientWallet.send(pruner.getSender(), { value: toNano('0.05') }, {
      $$type: 'PruneStaleNotification',
      query_id: queryId,
      sender_key: key,
    } as PruneStaleNotification);

    const username = Buffer.from('platho', 'ascii');
    const usernameReuse = await blockchain.sendMessage(internal({
      from: sourceWallet.address,
      to: recipientAddress,
      value: toNano('0.05'),
      body: beginCell().store(storeATHInternalTransferMintUsername({
        $$type: 'ATHInternalTransferMintUsername',
        query_id: queryId,
        amount: 70n,
        sender_owner: sourceOwner.address,
        response_destination: sourceOwner.address,
        notify_value: toNano('0.03'),
        username_len: BigInt(username.length),
        username: beginCell().storeBuffer(username).endCell().beginParse(),
      } as ATHInternalTransferMintUsername)).endCell(),
    }));

    expect(findTransaction(usernameReuse.transactions, {
      from: sourceWallet.address,
      to: recipientAddress,
      success: false,
    })).toBeDefined();

    const profileReuse = await blockchain.sendMessage(internal({
      from: sourceWallet.address,
      to: recipientAddress,
      value: toNano('0.05'),
      body: beginCell().store(storeATHInternalTransferProfileAvatar({
        $$type: 'ATHInternalTransferProfileAvatar',
        query_id: queryId,
        amount: 80n,
        sender_owner: sourceOwner.address,
        response_destination: sourceOwner.address,
        notify_value: toNano('0.03'),
        avatar_hash: 0x1234n,
        avatar_entry_id: 1n,
        avatar_stream_id: 2n,
        avatar_part_count: 1n,
        media_format: 1n,
      } as ATHInternalTransferProfileAvatar)).endCell(),
    }));

    expect(findTransaction(profileReuse.transactions, {
      from: sourceWallet.address,
      to: recipientAddress,
      success: false,
    })).toBeDefined();
    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(false);
  });

  it('ATH-XFER-05D: bounced profile-avatar notification refunds ATH to original sender wallet', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = await blockchain.treasury('ath-transfer-profile-bounce-source');
    const recipientOwner = await blockchain.treasury('ath-transfer-profile-bounce-recipient');
    const master = fixtureAddress('ATH_TRANSFER_PROFILE_BOUNCE_MASTER');
    const queryId = 535n;
    const amount = 100n;

    const sourceWallet = await deployWallet(blockchain, sourceOwner.address, master, 0n);
    const recipientWallet = await deployWallet(blockchain, recipientOwner.address, master, 0n);
    const key = senderKey(sourceOwner.address);

    await blockchain.sendMessage(internal({
      from: sourceWallet.address,
      to: recipientWallet.address,
      value: toNano('0.05'),
      body: beginCell().store(storeATHInternalTransferProfileAvatar({
        $$type: 'ATHInternalTransferProfileAvatar',
        query_id: queryId,
        amount,
        sender_owner: sourceOwner.address,
        response_destination: sourceOwner.address,
        notify_value: toNano('0.03'),
        avatar_hash: 0x9876n,
        avatar_entry_id: 7n,
        avatar_stream_id: 8n,
        avatar_part_count: 2n,
        media_format: 1n,
      } as ATHInternalTransferProfileAvatar)).endCell(),
    }));

    expect((await sourceWallet.getGetWalletData()).balance).toBe(0n);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(amount);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(true);

    await blockchain.sendMessage(internal({
      from: recipientOwner.address,
      to: recipientWallet.address,
      value: toNano('0.05'),
      bounced: true,
      bounce: false,
      body: beginCell()
        .storeUint(0xffffffff, 32)
        .storeUint(0xA11A7001, 32)
        .storeUint(queryId, 64)
        .storeUint(amount, 128)
        .storeUint(key, 32)
        .endCell(),
    }));

    expect((await sourceWallet.getGetWalletData()).balance).toBe(amount);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(0n);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(false);
  });

  it('ATH-XFER-05F: bounced notify refund is not blocked by another outgoing transfer with the same query id', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = await blockchain.treasury('ath-transfer-refund-collision-source');
    const recipientOwner = await blockchain.treasury('ath-transfer-refund-collision-recipient');
    const master = fixtureAddress('ATH_TRANSFER_REFUND_COLLISION_MASTER');
    const queryId = 536n;
    const amount = 100n;
    const existingPendingAmount = 7n;
    const otherRecipientOwner = fixtureAddress('ATH_REFUND_COLLISION_OTHER_RECIPIENT');
    const otherRecipientInit = await ATHWallet.init(0n, otherRecipientOwner, master);
    const otherRecipientWalletAddress = contractAddress(otherRecipientOwner.workChain, otherRecipientInit);
    const mockNoAckInit = await MockAthWalletNoAck.init();

    const sourceWallet = await deployWallet(blockchain, sourceOwner.address, master, 0n);
    const recipientWallet = await deployWallet(blockchain, recipientOwner.address, master, existingPendingAmount);
    await blockchain.setShardAccount(otherRecipientWalletAddress, createShardAccount({
      address: otherRecipientWalletAddress,
      code: mockNoAckInit.code,
      data: mockNoAckInit.data,
      balance: toNano('1'),
      workchain: otherRecipientWalletAddress.workChain,
    }));
    const key = senderKey(sourceOwner.address);

    await recipientWallet.send(recipientOwner.getSender(), { value: toNano('0.2') }, {
      $$type: 'ATHTransferRequest',
      query_id: queryId,
      amount: existingPendingAmount,
      recipient: otherRecipientOwner,
      response_destination: recipientOwner.address,
    } as ATHTransferRequest);

    expect((await recipientWallet.getGetWalletData()).balance).toBe(0n);

    await blockchain.sendMessage(internal({
      from: sourceWallet.address,
      to: recipientWallet.address,
      value: toNano('0.05'),
      body: beginCell().store(storeATHInternalTransferProfileAvatar({
        $$type: 'ATHInternalTransferProfileAvatar',
        query_id: queryId,
        amount,
        sender_owner: sourceOwner.address,
        response_destination: sourceOwner.address,
        notify_value: toNano('0.03'),
        avatar_hash: 0x9876n,
        avatar_entry_id: 7n,
        avatar_stream_id: 8n,
        avatar_part_count: 2n,
        media_format: 1n,
      } as ATHInternalTransferProfileAvatar)).endCell(),
    }));

    expect((await recipientWallet.getGetWalletData()).balance).toBe(amount);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(true);

    await blockchain.sendMessage(internal({
      from: recipientOwner.address,
      to: recipientWallet.address,
      value: toNano('0.05'),
      bounced: true,
      bounce: false,
      body: beginCell()
        .storeUint(0xffffffff, 32)
        .storeUint(0xA11A7001, 32)
        .storeUint(queryId, 64)
        .storeUint(amount, 128)
        .storeUint(key, 32)
        .endCell(),
    }));

    expect((await sourceWallet.getGetWalletData()).balance).toBe(amount);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(0n);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(false);

    await blockchain.sendMessage(internal({
      from: otherRecipientWalletAddress,
      to: recipientWallet.address,
      value: toNano('0.05'),
      bounced: true,
      bounce: false,
      body: beginCell()
        .storeUint(0xffffffff, 32)
        .store(storeATHInternalTransfer({
          $$type: 'ATHInternalTransfer',
          query_id: queryId,
          amount: existingPendingAmount,
          sender_owner: recipientOwner.address,
          response_destination: recipientOwner.address,
        } as ATHInternalTransfer))
        .endCell(),
    }));

    expect((await recipientWallet.getGetWalletData()).balance).toBe(existingPendingAmount);
  });

  it('ATH-XFER-05G: bounced notify refund is not blocked by same-query outgoing to the same refund wallet', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = await blockchain.treasury('ath-transfer-refund-same-wallet-source');
    const recipientOwner = await blockchain.treasury('ath-transfer-refund-same-wallet-recipient');
    const master = fixtureAddress('ATH_TRANSFER_REFUND_SAME_WALLET_MASTER');
    const queryId = 537n;
    const amount = 100n;
    const existingPendingAmount = 9n;
    const sourceWalletInit = await ATHWallet.init(0n, sourceOwner.address, master);
    const sourceWalletAddress = contractAddress(sourceOwner.address.workChain, sourceWalletInit);
    const mockNoAckInit = await MockAthWalletNoAck.init();

    const recipientWallet = await deployWallet(blockchain, recipientOwner.address, master, existingPendingAmount);
    await blockchain.setShardAccount(sourceWalletAddress, createShardAccount({
      address: sourceWalletAddress,
      code: mockNoAckInit.code,
      data: mockNoAckInit.data,
      balance: toNano('1'),
      workchain: sourceWalletAddress.workChain,
    }));
    const key = senderKey(sourceOwner.address);

    await recipientWallet.send(recipientOwner.getSender(), { value: toNano('0.2') }, {
      $$type: 'ATHTransferRequest',
      query_id: queryId,
      amount: existingPendingAmount,
      recipient: sourceOwner.address,
      response_destination: recipientOwner.address,
    } as ATHTransferRequest);

    expect((await recipientWallet.getGetWalletData()).balance).toBe(0n);

    await blockchain.sendMessage(internal({
      from: sourceWalletAddress,
      to: recipientWallet.address,
      value: toNano('0.05'),
      body: beginCell().store(storeATHInternalTransferProfileAvatar({
        $$type: 'ATHInternalTransferProfileAvatar',
        query_id: queryId,
        amount,
        sender_owner: sourceOwner.address,
        response_destination: sourceOwner.address,
        notify_value: toNano('0.03'),
        avatar_hash: 0x9876n,
        avatar_entry_id: 7n,
        avatar_stream_id: 8n,
        avatar_part_count: 2n,
        media_format: 1n,
      } as ATHInternalTransferProfileAvatar)).endCell(),
    }));

    expect((await recipientWallet.getGetWalletData()).balance).toBe(amount);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(true);

    const bouncedNotifyResult = await blockchain.sendMessage(internal({
      from: recipientOwner.address,
      to: recipientWallet.address,
      value: toNano('0.05'),
      bounced: true,
      bounce: false,
      body: beginCell()
        .storeUint(0xffffffff, 32)
        .storeUint(0xA11A7001, 32)
        .storeUint(queryId, 64)
        .storeUint(amount, 128)
        .storeUint(key, 32)
        .endCell(),
    }));

    expect(findTransaction(bouncedNotifyResult.transactions, {
      from: recipientWallet.address,
      to: sourceWalletAddress,
      success: true,
    })).toBeDefined();
    expect((await recipientWallet.getGetWalletData()).balance).toBe(0n);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(false);

    await blockchain.sendMessage(internal({
      from: sourceWalletAddress,
      to: recipientWallet.address,
      value: toNano('0.05'),
      bounced: true,
      bounce: false,
      body: beginCell()
        .storeUint(0xffffffff, 32)
        .store(storeATHInternalTransfer({
          $$type: 'ATHInternalTransfer',
          query_id: queryId,
          amount: existingPendingAmount,
          sender_owner: recipientOwner.address,
          response_destination: recipientOwner.address,
        } as ATHInternalTransfer))
        .endCell(),
    }));

    expect((await recipientWallet.getGetWalletData()).balance).toBe(existingPendingAmount);
  });

  it('ATH-XFER-05E: forged bounced notifications cannot refund or delete pending notification state', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = await blockchain.treasury('ath-transfer-forged-notify-source');
    const recipientOwner = await blockchain.treasury('ath-transfer-forged-notify-recipient');
    const attacker = await blockchain.treasury('ath-transfer-forged-notify-attacker');
    const master = fixtureAddress('ATH_TRANSFER_FORGED_NOTIFY_MASTER');
    const amount = 100n;
    const key = senderKey(sourceOwner.address);
    const username = Buffer.from('platho', 'ascii');

    const sourceWallet = await deployWallet(blockchain, sourceOwner.address, master, 0n);
    const recipientWallet = await deployWallet(blockchain, recipientOwner.address, master, 0n);

    await blockchain.sendMessage(internal({
      from: sourceWallet.address,
      to: recipientWallet.address,
      value: toNano('0.05'),
      body: beginCell().store(storeATHInternalTransferWithNotify({
        $$type: 'ATHInternalTransferWithNotify',
        query_id: 551n,
        amount,
        sender_owner: sourceOwner.address,
        response_destination: sourceOwner.address,
        notify_destination: recipientOwner.address,
        notify_value: toNano('0.03'),
      } as ATHInternalTransferWithNotify)).endCell(),
    }));
    await blockchain.sendMessage(internal({
      from: sourceWallet.address,
      to: recipientWallet.address,
      value: toNano('0.05'),
      body: beginCell().store(storeATHInternalTransferMintUsername({
        $$type: 'ATHInternalTransferMintUsername',
        query_id: 552n,
        amount,
        sender_owner: sourceOwner.address,
        response_destination: sourceOwner.address,
        notify_value: toNano('0.03'),
        username_len: BigInt(username.length),
        username: beginCell().storeBuffer(username).endCell().beginParse(),
      } as ATHInternalTransferMintUsername)).endCell(),
    }));
    await blockchain.sendMessage(internal({
      from: sourceWallet.address,
      to: recipientWallet.address,
      value: toNano('0.05'),
      body: beginCell().store(storeATHInternalTransferProfileAvatar({
        $$type: 'ATHInternalTransferProfileAvatar',
        query_id: 553n,
        amount,
        sender_owner: sourceOwner.address,
        response_destination: sourceOwner.address,
        notify_value: toNano('0.03'),
        avatar_hash: 0x9876n,
        avatar_entry_id: 7n,
        avatar_stream_id: 8n,
        avatar_part_count: 2n,
        media_format: 1n,
      } as ATHInternalTransferProfileAvatar)).endCell(),
    }));

    expect((await recipientWallet.getGetWalletData()).balance).toBe(amount * 3n);

    const forgedNotifications = [
      { op: 0x472D9D7Dn, queryId: 551n },
      { op: 0x89129D5Fn, queryId: 552n },
      { op: 0xA11A7001n, queryId: 553n },
    ];

    for (const { op, queryId } of forgedNotifications) {
      await blockchain.sendMessage(internal({
        from: attacker.address,
        to: recipientWallet.address,
        value: toNano('0.05'),
        bounced: true,
        bounce: false,
        body: beginCell()
          .storeUint(0xffffffff, 32)
          .storeUint(op, 32)
          .storeUint(queryId, 64)
          .storeUint(amount, 128)
          .storeUint(key, 32)
          .endCell(),
      }));
    }

    expect((await sourceWallet.getGetWalletData()).balance).toBe(0n);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(amount * 3n);
    expect((await recipientWallet.getGetPendingNotification(551n, key)).exists).toBe(true);
    expect((await recipientWallet.getGetPendingNotification(552n, key)).exists).toBe(true);
    expect((await recipientWallet.getGetPendingNotification(553n, key)).exists).toBe(true);
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

    await sourceWallet.send(sourceOwner.getSender(), { value: toNano('0.051') }, {
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
