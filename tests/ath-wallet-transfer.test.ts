import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import {
  ATHWallet,
  ATHInternalTransfer,
  ATHInternalTransferVaultMintUsername,
  ATHInternalTransferVaultProfileAvatar,
  ATHInternalTransferWithNotify,
  ATHTransferRequest,
  ATHTransferRequestWithNotify,
  AthTransferNotificationAck,
  AthTransferNotificationRefund,
  PruneStaleNotification,
  storeATHInternalTransfer,
  storeATHInternalTransferVaultMintUsername,
  storeATHInternalTransferVaultProfileAvatar,
  storeATHInternalTransferWithNotify,
  storeATHTransferRequestWithNotify,
  storeAthTransferNotification,
} from '../build/ATHWallet/ATHWallet_ATHWallet';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';

const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 0x41544E49n;
const ATH_SENDER_KEY_MOD = 1n << 160n;
const ATH_PENDING_NOTIFICATION_TTL = 86_400;
const ATH_PRUNE_NOTIFICATION_EXEC_RESERVE = 2_000_000n;

function senderKey(senderOwner: Address, queryId: bigint): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(ATH_TRANSFER_NOTIFY_ID_DOMAIN, 32)
    .storeUint(queryId, 64)
    .storeAddress(senderOwner)
    .endCell()
    .hash()
    .toString('hex')) % ATH_SENDER_KEY_MOD;
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
      beginCell().store(storeATHInternalTransferVaultMintUsername({
        $$type: 'ATHInternalTransferVaultMintUsername',
        query_id: 303n,
        amount,
        sender_owner: owner.address,
        response_destination: owner.address,
        notify_value: toNano('0.03'),
        owner_wallet: owner.address,
        username_len: BigInt(username.length),
        username: beginCell().storeBuffer(username).endCell().beginParse(),
      } as ATHInternalTransferVaultMintUsername)).endCell(),
      beginCell().store(storeATHInternalTransferVaultProfileAvatar({
        $$type: 'ATHInternalTransferVaultProfileAvatar',
        query_id: 304n,
        amount,
        sender_owner: owner.address,
        response_destination: owner.address,
        notify_value: toNano('0.03'),
        owner_wallet: owner.address,
        avatar_hash: 0xabcden,
        avatar_entry_id: 1n,
        avatar_stream_id: 2n,
        avatar_part_count: 1n,
        media_format: 1n,
      } as ATHInternalTransferVaultProfileAvatar)).endCell(),
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

  it('ATH-XFER-03D: non-canonical ATHWallet with init balance cannot credit a canonical wallet', async () => {
    const blockchain = await Blockchain.create();
    const attackerOwner = fixtureAddress('ATH_FAKE_INIT_BALANCE_OWNER');
    const victimOwner = await blockchain.treasury('ath-fake-init-victim-owner');
    const master = fixtureAddress('ATH_FAKE_INIT_BALANCE_MASTER');
    const amount = 1_000_000_000n;

    const victimWallet = await deployWallet(blockchain, victimOwner.address, master, 0n);
    const canonicalAttackerInit = await ATHWallet.init(0n, attackerOwner, master);
    const canonicalAttackerWalletAddress = contractAddress(attackerOwner.workChain, canonicalAttackerInit);
    const fakeWalletAddress = fixtureAddress('ATH_FAKE_INIT_BALANCE_NON_CANONICAL_WALLET');
    const fakeDataInit = await ATHWallet.init(amount, attackerOwner, master);
    expect(fakeWalletAddress.equals(canonicalAttackerWalletAddress)).toBe(false);
    await blockchain.setShardAccount(fakeWalletAddress, createShardAccount({
      address: fakeWalletAddress,
      code: canonicalAttackerInit.code,
      data: fakeDataInit.data,
      balance: toNano('1'),
      workchain: fakeWalletAddress.workChain,
    }));

    const forgedCredit = await victimWallet.send(blockchain.sender(fakeWalletAddress), { value: toNano('0.05') }, {
      $$type: 'ATHInternalTransfer',
      query_id: 306n,
      amount,
      sender_owner: attackerOwner,
      response_destination: attackerOwner,
    } as ATHInternalTransfer);

    expect(findTransaction(forgedCredit.transactions, {
      from: fakeWalletAddress,
      to: victimWallet.address,
      success: false,
      exitCode: 14211,
    })).toBeDefined();
    expect(findTransaction(forgedCredit.transactions, {
      from: victimWallet.address,
      to: fakeWalletAddress,
      success: true,
    })).toBeUndefined();
    expect((await victimWallet.getGetWalletData()).balance).toBe(0n);
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
    // The recipient legitimately retains the per-notification storage endowment
    // (ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT, raised 2M->20M). Threshold raised by the
    // 18M endowment delta so it still detects stranded owner overpayment with the same margin.
    expect(await contractBalance(blockchain, recipientAddress)).toBeLessThan(toNano('0.028'));
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
    const key = senderKey(sourceOwner.address, queryId);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(true);

    await recipientWallet.send(pruner.getSender(), { value: toNano('0.05') }, {
      $$type: 'PruneStaleNotification',
      query_id: queryId,
      sender_key: key,
    } as PruneStaleNotification);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(true);

    blockchain.now = (blockchain.now ?? 0) + ATH_PENDING_NOTIFICATION_TTL + 1;
    await recipientWallet.send(pruner.getSender(), { value: ATH_PRUNE_NOTIFICATION_EXEC_RESERVE - 1n }, {
      $$type: 'PruneStaleNotification',
      query_id: queryId,
      sender_key: key,
    } as PruneStaleNotification);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(true);

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

    // [REWRITTEN 2026-07-19 with the tombstone removal.] This tail used to assert that the resend was BLOCKED —
    // source still 900, recipient still 100 — because the permanent tombstone remembered the query_id forever.
    // That tombstone is gone (see the state declaration in ATHWallet.tact for why it never protected the balance),
    // so a resend after a prune now goes through. The property that matters is not that it is blocked, but that it
    // is PAID FOR: the second transfer debits the source a second time, so it is a second genuine purchase and not
    // value minted out of a replayed message. That is the exact residual the change accepts, so it is asserted here
    // rather than left implicit.
    expect((await sourceWallet.getGetWalletData()).balance, 'the resend debited the source a SECOND time').toBe(830n);
    expect((await recipientWallet.getGetWalletData()).balance, 'and credited the recipient exactly that amount').toBe(170n);
    // Conservation: every nanoATH credited is backed by one debited. 830 + 170 == 1000, the source's opening balance.
    const srcBal = (await sourceWallet.getGetWalletData()).balance;
    const dstBal = (await recipientWallet.getGetWalletData()).balance;
    expect(srcBal + dstBal, 'nothing was minted and nothing was lost').toBe(1_000n);
  });

  it('ATH-XFER-05A: processed notification tombstone blocks duplicate refund after ACK', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = await blockchain.treasury('ath-transfer-ack-tombstone-source');
    const recipientOwner = await blockchain.treasury('ath-transfer-ack-tombstone-recipient');
    const master = fixtureAddress('ATH_TRANSFER_ACK_TOMBSTONE_MASTER');
    const queryId = 509n;
    const amount = 100n;

    const sourceWallet = await deployWallet(blockchain, sourceOwner.address, master, 1_000n);
    const recipientInit = await ATHWallet.init(0n, recipientOwner.address, master);
    const recipientAddress = contractAddress(recipientOwner.address.workChain, recipientInit);
    const recipientWallet = blockchain.openContract(new ATHWallet(recipientAddress, recipientInit));
    const key = senderKey(sourceOwner.address, queryId);

    await sourceWallet.send(sourceOwner.getSender(), { value: toNano('0.2') }, {
      $$type: 'ATHTransferRequestWithNotify',
      query_id: queryId,
      amount,
      recipient: recipientOwner.address,
      response_destination: sourceOwner.address,
      notify_destination: recipientOwner.address,
      notify_value: toNano('0.03'),
    } as ATHTransferRequestWithNotify);

    expect((await recipientWallet.getGetWalletData()).balance).toBe(amount);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(true);

    await recipientWallet.send(recipientOwner.getSender(), { value: toNano('0.05') }, {
      $$type: 'AthTransferNotificationAck',
      query_id: queryId,
      amount,
      sender_key: key,
    } as AthTransferNotificationAck);

    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(false);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(amount);

    const duplicateRefund = await recipientWallet.send(recipientOwner.getSender(), { value: toNano('0.05') }, {
      $$type: 'AthTransferNotificationRefund',
      query_id: queryId,
      amount,
      sender_key: key,
    } as AthTransferNotificationRefund);

    expect(findTransaction(duplicateRefund.transactions, {
      from: recipientOwner.address,
      to: recipientWallet.address,
      success: false,
      exitCode: 14332,
    })).toBeDefined();
    expect(findTransaction(duplicateRefund.transactions, {
      from: recipientWallet.address,
      to: sourceWallet.address,
      success: true,
    })).toBeUndefined();
    expect((await sourceWallet.getGetWalletData()).balance).toBe(900n);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(amount);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(false);
  });

  it('ATH-XFER-05B: pruned notification tombstone does not block another sender sharing the old 32-bit slot', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_100_000;
    const ownerA = rawFixtureAddress('0:1bfcc4a48a30afb134facb308d9f58389f3cb4b618811901f564cb2c8a95e78c');
    const ownerB = rawFixtureAddress('0:a6b6dd711ce9361e0a359d587f2c996b746919067ca4dbce81827916e9618347');
    const recipientOwner = await blockchain.treasury('ath-transfer-colliding-recipient');
    const pruner = await blockchain.treasury('ath-transfer-colliding-pruner');
    const master = fixtureAddress('ATH_TRANSFER_COLLIDING_NOTIFY_MASTER');
    const queryId = 515n;
    const keyA = senderKey(ownerA, queryId);
    const keyB = senderKey(ownerB, queryId);
    expect(keyB).not.toBe(keyA);

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
      value: toNano('0.07'),
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
    expect((await recipientWallet.getGetPendingNotification(queryId, keyA)).exists).toBe(true);

    blockchain.now = (blockchain.now ?? 0) + ATH_PENDING_NOTIFICATION_TTL + 1;
    await recipientWallet.send(pruner.getSender(), { value: toNano('0.05') }, {
      $$type: 'PruneStaleNotification',
      query_id: queryId,
      sender_key: keyA,
    } as PruneStaleNotification);

    expect((await recipientWallet.getGetPendingNotification(queryId, keyA)).exists).toBe(false);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);

    const independentReuse = await blockchain.sendMessage(internal({
      from: sourceAddressB,
      to: recipientAddress,
      value: toNano('0.07'),
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

    expect(findTransaction(independentReuse.transactions, {
      from: sourceAddressB,
      to: recipientAddress,
      success: true,
    })).toBeDefined();
    expect((await recipientWallet.getGetWalletData()).balance).toBe(170n);
    expect((await recipientWallet.getGetPendingNotification(queryId, keyA)).exists).toBe(false);
    expect((await recipientWallet.getGetPendingNotification(queryId, keyB)).exists).toBe(true);

    await recipientWallet.send(recipientOwner.getSender(), { value: toNano('0.05') }, {
      $$type: 'AthTransferNotificationAck',
      query_id: queryId,
      amount: 100n,
      sender_key: keyA,
    } as AthTransferNotificationAck);

    expect((await recipientWallet.getGetWalletData()).balance).toBe(170n);
    expect((await recipientWallet.getGetPendingNotification(queryId, keyA)).exists).toBe(false);
    expect((await recipientWallet.getGetPendingNotification(queryId, keyB)).exists).toBe(true);
  });

  it('ATH-XFER-05B2: independent same-query notify debits source wallet despite old 32-bit slot collision', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_150_000;
    const ownerA = rawFixtureAddress('0:1bfcc4a48a30afb134facb308d9f58389f3cb4b618811901f564cb2c8a95e78c');
    const ownerB = rawFixtureAddress('0:a6b6dd711ce9361e0a359d587f2c996b746919067ca4dbce81827916e9618347');
    const recipientOwner = await blockchain.treasury('ath-transfer-colliding-restore-recipient');
    const pruner = await blockchain.treasury('ath-transfer-colliding-restore-pruner');
    const master = fixtureAddress('ATH_TRANSFER_COLLIDING_RESTORE_MASTER');
    const queryId = 516n;
    const keyA = senderKey(ownerA, queryId);
    const keyB = senderKey(ownerB, queryId);
    expect(keyB).not.toBe(keyA);

    const recipientInit = await ATHWallet.init(0n, recipientOwner.address, master);
    const recipientAddress = contractAddress(recipientOwner.address.workChain, recipientInit);
    const recipientWallet = await deployWallet(blockchain, recipientOwner.address, master, 0n);
    const sourceWalletB = await deployWallet(blockchain, ownerB, master, 1_000n);

    const sourceInitA = await ATHWallet.init(0n, ownerA, master);
    const sourceAddressA = contractAddress(ownerA.workChain, sourceInitA);

    await blockchain.sendMessage(internal({
      from: sourceAddressA,
      to: recipientAddress,
      value: toNano('0.07'),
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
      sender_key: keyA,
    } as PruneStaleNotification);

    expect((await recipientWallet.getGetWalletData()).balance).toBe(100n);
    expect((await recipientWallet.getGetPendingNotification(queryId, keyA)).exists).toBe(false);

    const independentOwnerRequest = await blockchain.sendMessage(internal({
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

    expect(findTransaction(independentOwnerRequest.transactions, {
      from: sourceWalletB.address,
      to: recipientAddress,
      success: true,
    })).toBeDefined();
    expect((await sourceWalletB.getGetWalletData()).balance).toBe(930n);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(170n);
    expect((await recipientWallet.getGetPendingNotification(queryId, keyA)).exists).toBe(false);
    expect((await recipientWallet.getGetPendingNotification(queryId, keyB)).exists).toBe(true);
  });

  // [REWRITTEN 2026-07-19 with the tombstone removal.] This case used to assert that the PERMANENT tombstone was
  // shared across the plain / username / profile-avatar lanes, so a query_id burned on one was burned on all three
  // forever. The tombstone is gone. What is still shared — and is the guard that actually protects the balance — is
  // the IN-FLIGHT check (14315 / 14565 / 14665) over one common key derivation: while a notification is pending on
  // any lane, the same key is refused on every lane. That is the only reachable double-processing window, so it is
  // what this case now pins. The "a resend is paid for by a second debit" property is covered by ATH-XFER-05, which
  // drives the real transfer path; here the reuse is a synthetic message from the source wallet's address and so
  // does not debit it.
  it('ATH-XFER-05C: the in-flight notify guard is shared by the username and profile-avatar lanes', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_200_000;
    const sourceOwner = await blockchain.treasury('ath-transfer-shared-domain-source');
    const recipientOwner = await blockchain.treasury('ath-transfer-shared-domain-recipient');
    const pruner = await blockchain.treasury('ath-transfer-shared-domain-pruner');
    const master = fixtureAddress('ATH_TRANSFER_SHARED_NOTIFY_DOMAIN_MASTER');
    const queryId = 525n;
    const key = senderKey(sourceOwner.address, queryId);

    const sourceWallet = await deployWallet(blockchain, sourceOwner.address, master, 1_000n);
    const recipientInit = await ATHWallet.init(0n, recipientOwner.address, master);
    const recipientAddress = contractAddress(recipientOwner.address.workChain, recipientInit);
    const recipientWallet = blockchain.openContract(new ATHWallet(recipientAddress, recipientInit));

    await sourceWallet.send(sourceOwner.getSender(), { value: toNano('0.069') }, {
      $$type: 'ATHTransferRequestWithNotify',
      query_id: queryId,
      amount: 100n,
      recipient: recipientOwner.address,
      response_destination: sourceOwner.address,
      notify_destination: recipientOwner.address,
      notify_value: toNano('0.03'),
    } as ATHTransferRequestWithNotify);

    // The notification is now PENDING. Both other lanes must refuse the same key while it is in flight — that is
    // the shared guard, and the prune below deliberately comes AFTER these two probes so the refusals can only be
    // the in-flight check and not anything left over from a prune.
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists, 'pending is in flight').toBe(true);

    const username = Buffer.from('platho', 'ascii');
    const usernameReuse = await blockchain.sendMessage(internal({
      from: sourceWallet.address,
      to: recipientAddress,
      value: toNano('0.07'),
      body: beginCell().store(storeATHInternalTransferVaultMintUsername({
        $$type: 'ATHInternalTransferVaultMintUsername',
        query_id: queryId,
        amount: 70n,
        sender_owner: sourceOwner.address,
        response_destination: sourceOwner.address,
        notify_value: toNano('0.03'),
        owner_wallet: recipientOwner.address,
        username_len: BigInt(username.length),
        username: beginCell().storeBuffer(username).endCell().beginParse(),
      } as ATHInternalTransferVaultMintUsername)).endCell(),
    }));

    expect(findTransaction(usernameReuse.transactions, {
      from: sourceWallet.address,
      to: recipientAddress,
      success: false,
    })).toBeDefined();

    const profileReuse = await blockchain.sendMessage(internal({
      from: sourceWallet.address,
      to: recipientAddress,
      value: toNano('0.07'),
      body: beginCell().store(storeATHInternalTransferVaultProfileAvatar({
        $$type: 'ATHInternalTransferVaultProfileAvatar',
        query_id: queryId,
        amount: 80n,
        sender_owner: sourceOwner.address,
        response_destination: sourceOwner.address,
        notify_value: toNano('0.03'),
        owner_wallet: recipientOwner.address,
        avatar_hash: 0x1234n,
        avatar_entry_id: 1n,
        avatar_stream_id: 2n,
        avatar_part_count: 1n,
        media_format: 1n,
      } as ATHInternalTransferVaultProfileAvatar)).endCell(),
    }));

    expect(findTransaction(profileReuse.transactions, {
      from: sourceWallet.address,
      to: recipientAddress,
      success: false,
    })).toBeDefined();
    // Neither refused message moved money, and the pending entry is untouched by the refusals.
    expect((await recipientWallet.getGetWalletData()).balance, 'a refused lane credits nothing').toBe(100n);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists, 'and leaves the pending alone').toBe(true);

    // Once the pending is genuinely cleared, the key is free again — a later transfer reusing it is a NEW transfer
    // that must pay its own way, which is the behaviour the tombstone used to forbid outright. Pruning now FREES
    // the entry rather than converting it into a permanent tombstone, so the wallet does not grow.
    blockchain.now = (blockchain.now ?? 0) + ATH_PENDING_NOTIFICATION_TTL + 1;
    await recipientWallet.send(pruner.getSender(), { value: toNano('0.05') }, {
      $$type: 'PruneStaleNotification',
      query_id: queryId,
      sender_key: key,
    } as PruneStaleNotification);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists, 'prune cleared it').toBe(false);
  });

  it('ATH-XFER-05C2: Vault/system notification cannot be pruned after TTL', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_250_000;
    const sourceOwner = await blockchain.treasury('ath-transfer-system-prune-source');
    const recipientOwner = await blockchain.treasury('ath-transfer-system-prune-recipient');
    const pruner = await blockchain.treasury('ath-transfer-system-prune-pruner');
    const master = fixtureAddress('ATH_TRANSFER_SYSTEM_PRUNE_MASTER');
    const queryId = 526n;
    const amount = 100n;
    const username = Buffer.from('platho', 'ascii');

    const sourceWallet = await deployWallet(blockchain, sourceOwner.address, master, 0n);
    const recipientWallet = await deployWallet(blockchain, recipientOwner.address, master, 0n);
    const key = senderKey(sourceOwner.address, queryId);

    await blockchain.sendMessage(internal({
      from: sourceWallet.address,
      to: recipientWallet.address,
      value: toNano('0.07'),
      body: beginCell().store(storeATHInternalTransferVaultMintUsername({
        $$type: 'ATHInternalTransferVaultMintUsername',
        query_id: queryId,
        amount,
        sender_owner: sourceOwner.address,
        response_destination: sourceOwner.address,
        notify_value: toNano('0.03'),
        owner_wallet: recipientOwner.address,
        username_len: BigInt(username.length),
        username: beginCell().storeBuffer(username).endCell().beginParse(),
      } as ATHInternalTransferVaultMintUsername)).endCell(),
    }));

    expect((await recipientWallet.getGetWalletData()).balance).toBe(amount);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(true);

    blockchain.now = (blockchain.now ?? 0) + ATH_PENDING_NOTIFICATION_TTL + 1;
    const pruneSystemPending = await recipientWallet.send(pruner.getSender(), { value: toNano('0.05') }, {
      $$type: 'PruneStaleNotification',
      query_id: queryId,
      sender_key: key,
    } as PruneStaleNotification);

    expect(findTransaction(pruneSystemPending.transactions, {
      from: pruner.address,
      to: recipientWallet.address,
      success: false,
      exitCode: 14353,
    })).toBeDefined();
    expect((await recipientWallet.getGetWalletData()).balance).toBe(amount);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(true);
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
    const key = senderKey(sourceOwner.address, queryId);

    await blockchain.sendMessage(internal({
      from: sourceWallet.address,
      to: recipientWallet.address,
      value: toNano('0.07'),
      body: beginCell().store(storeATHInternalTransferVaultProfileAvatar({
        $$type: 'ATHInternalTransferVaultProfileAvatar',
        query_id: queryId,
        amount,
        sender_owner: sourceOwner.address,
        response_destination: sourceOwner.address,
        notify_value: toNano('0.03'),
        owner_wallet: recipientOwner.address,
        avatar_hash: 0x9876n,
        avatar_entry_id: 7n,
        avatar_stream_id: 8n,
        avatar_part_count: 2n,
        media_format: 1n,
      } as ATHInternalTransferVaultProfileAvatar)).endCell(),
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
        .storeUint(0xA11A7002, 32)
        .storeUint(queryId, 64)
        .storeUint(key, 160)
        .storeUint(amount, 128)
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
    const key = senderKey(sourceOwner.address, queryId);

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
      value: toNano('0.07'),
      body: beginCell().store(storeATHInternalTransferVaultProfileAvatar({
        $$type: 'ATHInternalTransferVaultProfileAvatar',
        query_id: queryId,
        amount,
        sender_owner: sourceOwner.address,
        response_destination: sourceOwner.address,
        notify_value: toNano('0.03'),
        owner_wallet: recipientOwner.address,
        avatar_hash: 0x9876n,
        avatar_entry_id: 7n,
        avatar_stream_id: 8n,
        avatar_part_count: 2n,
        media_format: 1n,
      } as ATHInternalTransferVaultProfileAvatar)).endCell(),
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
        .storeUint(0xA11A7002, 32)
        .storeUint(queryId, 64)
        .storeUint(key, 160)
        .storeUint(amount, 128)
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

  it('ATH-XFER-05G: bounced notify refund fails closed on same-query outgoing to the same refund wallet', async () => {
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
    const key = senderKey(sourceOwner.address, queryId);

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
      value: toNano('0.07'),
      body: beginCell().store(storeATHInternalTransferVaultProfileAvatar({
        $$type: 'ATHInternalTransferVaultProfileAvatar',
        query_id: queryId,
        amount,
        sender_owner: sourceOwner.address,
        response_destination: sourceOwner.address,
        notify_value: toNano('0.03'),
        owner_wallet: recipientOwner.address,
        avatar_hash: 0x9876n,
        avatar_entry_id: 7n,
        avatar_stream_id: 8n,
        avatar_part_count: 2n,
        media_format: 1n,
      } as ATHInternalTransferVaultProfileAvatar)).endCell(),
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
        .storeUint(0xA11A7002, 32)
        .storeUint(queryId, 64)
        .storeUint(key, 160)
        .storeUint(amount, 128)
        .endCell(),
    }));
    expect(findTransaction(bouncedNotifyResult.transactions, {
      from: recipientOwner.address,
      to: recipientWallet.address,
      success: false,
      exitCode: 14230,
    })).toBeDefined();
    expect((await recipientWallet.getGetWalletData()).balance).toBe(amount);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(true);

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

    expect((await recipientWallet.getGetWalletData()).balance).toBe(amount + existingPendingAmount);
    expect((await recipientWallet.getGetPendingNotification(queryId, key)).exists).toBe(true);
  });

  it('ATH-XFER-05E: forged bounced notifications cannot refund or delete pending notification state', async () => {
    const blockchain = await Blockchain.create();
    const sourceOwner = await blockchain.treasury('ath-transfer-forged-notify-source');
    const recipientOwner = await blockchain.treasury('ath-transfer-forged-notify-recipient');
    const attacker = await blockchain.treasury('ath-transfer-forged-notify-attacker');
    const master = fixtureAddress('ATH_TRANSFER_FORGED_NOTIFY_MASTER');
    const amount = 100n;
    const username = Buffer.from('platho', 'ascii');

    const sourceWallet = await deployWallet(blockchain, sourceOwner.address, master, 0n);
    const recipientWallet = await deployWallet(blockchain, recipientOwner.address, master, 0n);

    await blockchain.sendMessage(internal({
      from: sourceWallet.address,
      to: recipientWallet.address,
      value: toNano('0.07'),
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
      value: toNano('0.07'),
      body: beginCell().store(storeATHInternalTransferVaultMintUsername({
        $$type: 'ATHInternalTransferVaultMintUsername',
        query_id: 552n,
        amount,
        sender_owner: sourceOwner.address,
        response_destination: sourceOwner.address,
        notify_value: toNano('0.03'),
        owner_wallet: recipientOwner.address,
        username_len: BigInt(username.length),
        username: beginCell().storeBuffer(username).endCell().beginParse(),
      } as ATHInternalTransferVaultMintUsername)).endCell(),
    }));
    await blockchain.sendMessage(internal({
      from: sourceWallet.address,
      to: recipientWallet.address,
      value: toNano('0.07'),
      body: beginCell().store(storeATHInternalTransferVaultProfileAvatar({
        $$type: 'ATHInternalTransferVaultProfileAvatar',
        query_id: 553n,
        amount,
        sender_owner: sourceOwner.address,
        response_destination: sourceOwner.address,
        notify_value: toNano('0.03'),
        owner_wallet: recipientOwner.address,
        avatar_hash: 0x9876n,
        avatar_entry_id: 7n,
        avatar_stream_id: 8n,
        avatar_part_count: 2n,
        media_format: 1n,
      } as ATHInternalTransferVaultProfileAvatar)).endCell(),
    }));

    expect((await recipientWallet.getGetWalletData()).balance).toBe(amount * 3n);

    const forgedNotifications = [
      { op: 0x472D9D7Dn, queryId: 551n },
      { op: 0x89129D60n, queryId: 552n },
      { op: 0xA11A7002n, queryId: 553n },
    ];

    for (const { op, queryId } of forgedNotifications) {
      const key = senderKey(sourceOwner.address, queryId);
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
          .storeUint(key, 160)
          .storeUint(amount, 128)
          .endCell(),
      }));
    }

    expect((await sourceWallet.getGetWalletData()).balance).toBe(0n);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(amount * 3n);
    expect((await recipientWallet.getGetPendingNotification(551n, senderKey(sourceOwner.address, 551n))).exists).toBe(true);
    expect((await recipientWallet.getGetPendingNotification(552n, senderKey(sourceOwner.address, 552n))).exists).toBe(true);
    expect((await recipientWallet.getGetPendingNotification(553n, senderKey(sourceOwner.address, 553n))).exists).toBe(true);
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

    await sourceWallet.send(sourceOwner.getSender(), { value: toNano('0.069') }, {
      $$type: 'ATHTransferRequestWithNotify',
      query_id: queryId,
      amount: 100n,
      recipient: recipientOwner.address,
      response_destination: sourceOwner.address,
      notify_destination: recipientOwner.address,
      notify_value: toNano('0.03'),
    } as ATHTransferRequestWithNotify);

    const recipientWallet = blockchain.openContract(new ATHWallet(recipientAddress, recipientInit));
    const key = senderKey(sourceOwner.address, queryId);
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
