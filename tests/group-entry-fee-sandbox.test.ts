import { describe, expect, it } from 'vitest';
import { Address, Cell, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ATHWallet } from '../build/ATHMaster/ATHMaster_ATHWallet';
import {
  ATH_BURN_NOTIFICATION_OP, ATH_INTERNAL_TRANSFER_OP, groupEntryPaymentMessages, groupEntryQueryId, groupEntryShares, verifyGroupEntryPayment,
} from '../web/group-entry-fee.mjs';


const fixtureAddress = (label: string) => new Address(0, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
const ENTRY_FEE = '5000000001';

async function scene() {
  const blockchain = await Blockchain.create();
  const payer = await blockchain.treasury('entry-payer');
  const roomOwner = fixtureAddress('ROOM_OWNER');
  const content = beginCell().storeBuffer(Buffer.from('ATH')).endCell();
  const masterInit = await ATHMaster.init(fixtureAddress('TREASURY_OWNER'), content, 0n);
  const masterAddress = contractAddress(0, masterInit);
  await blockchain.setShardAccount(masterAddress, createShardAccount({
    address: masterAddress, code: masterInit.code, data: masterInit.data, balance: toNano('1'), workchain: 0,
  }));
  const payerWalletInit = await ATHWallet.init(0n, payer.address, masterAddress);
  const payerWalletAddress = contractAddress(0, payerWalletInit);
  const funded = await ATHWallet.init(10_000_000_000n, payer.address, masterAddress);
  await blockchain.setShardAccount(payerWalletAddress, createShardAccount({
    address: payerWalletAddress, code: payerWalletInit.code, data: funded.data, balance: toNano('1'), workchain: 0,
  }));
  const ownerWalletAddress = contractAddress(0, await ATHWallet.init(0n, roomOwner, masterAddress));
  const master = blockchain.openContract(new ATHMaster(masterAddress, masterInit));
  return { blockchain, payer, roomOwner, masterAddress, payerWalletAddress, ownerWalletAddress, master };
}

function rowsOf(transactions: any[], from: Address, to: Address) {
  const rows: any[] = [];
  for (const tx of transactions) {
    for (const message of tx.outMessages.values()) {
      if (message.info.type !== 'internal') continue;
      if (!message.info.src.equals(from) || !message.info.dest.equals(to)) continue;
      rows.push({ message_content: { body: message.body.toBoc().toString('base64') }, created_at: tx.now });
    }
  }
  return rows;
}

describe('GROUP-ENTRY-FEE — the two legs on the real contracts', () => {
  it('FEE-SBX-01: the client\'s two messages, at the client\'s own attached values, are accepted end to end — the owner\'s wallet is deployed with the owner\'s half, the supply drops by the burned half — and the rows they leave satisfy the verifier', async () => {
    const { blockchain, payer, roomOwner, masterAddress, payerWalletAddress, ownerWalletAddress, master } = await scene();
    const groupId = new Uint8Array(32).fill(0x44);
    const groupKey = new Uint8Array(32).fill(0x55);
    const queryId = groupEntryQueryId(groupId, groupKey);
    const shares = groupEntryShares(ENTRY_FEE);
    const supplyBefore = (await master.getGetJettonData()).total_supply;
    const messages = groupEntryPaymentMessages({
      athWalletAddress: payerWalletAddress.toString(), payerWallet: payer.address.toString(), ownerWallet: roomOwner.toString(),
      entryFee: ENTRY_FEE, queryId,
    });
    const transactions: any[] = [];
    for (const message of messages) {
      const result = await payer.send({ to: Address.parse(message.address), value: BigInt(message.amount), body: Cell.fromBase64(message.payload), bounce: true });
      transactions.push(...result.transactions.filter((tx: any) => !tx.inMessage?.info?.dest?.equals?.(payer.address)));
    }
    for (const tx of transactions) {
      const description: any = tx.description;
      expect(description.type).toBe('generic');
      expect(description.aborted, `aborted transaction at ${tx.inMessage?.info?.dest?.toString?.()}`).toBe(false);
      expect(description.computePhase.type).toBe('vm');
      expect(description.computePhase.success, `compute failed with exit ${description.computePhase.exitCode}`).toBe(true);
      expect(description.actionPhase?.success ?? true).toBe(true);
    }
    const ownerWallet = blockchain.openContract(new ATHWallet(ownerWalletAddress, await ATHWallet.init(0n, roomOwner, masterAddress)));
    expect((await ownerWallet.getGetWalletData()).balance).toBe(shares.owner);
    const payerWallet = blockchain.openContract(new ATHWallet(payerWalletAddress, await ATHWallet.init(0n, payer.address, masterAddress)));
    expect((await payerWallet.getGetWalletData()).balance).toBe(10_000_000_000n - shares.total);
    expect((await master.getGetJettonData()).total_supply).toBe(supplyBefore - shares.burn);
    const transferRows = rowsOf(transactions, payerWalletAddress, ownerWalletAddress);
    const burnRows = rowsOf(transactions, payerWalletAddress, masterAddress);
    expect(transferRows.length).toBe(1);
    expect(burnRows.length).toBe(1);
    const verdict = verifyGroupEntryPayment({ transferRows, burnRows, queryId, payer: payer.address.toRawString(), shares });
    expect(verdict).toMatchObject({ paid: true, ownerPaid: true, burnPaid: true, ownerSum: shares.owner, burnSum: shares.burn });
    expect(Cell.fromBase64(transferRows[0].message_content.body).beginParse().loadUint(32)).toBe(ATH_INTERNAL_TRANSFER_OP);
    expect(Cell.fromBase64(burnRows[0].message_content.body).beginParse().loadUint(32)).toBe(ATH_BURN_NOTIFICATION_OP);
    expect(verifyGroupEntryPayment({ transferRows, burnRows: [], queryId, payer: payer.address.toRawString(), shares }).paid).toBe(false);
    expect(verifyGroupEntryPayment({ transferRows: [], burnRows, queryId, payer: payer.address.toRawString(), shares }).paid).toBe(false);
  });

  it('FEE-SBX-02: one nanoton under the client\'s estimate is refused by the wallet before any ATH moves — the estimate is the gate, not a guess above it', async () => {
    const { blockchain, payer, roomOwner, payerWalletAddress, masterAddress, master } = await scene();
    const queryId = groupEntryQueryId(new Uint8Array(32).fill(0x44), new Uint8Array(32).fill(0x55));
    const supplyBefore = (await master.getGetJettonData()).total_supply;
    const messages = groupEntryPaymentMessages({
      athWalletAddress: payerWalletAddress.toString(), payerWallet: payer.address.toString(), ownerWallet: roomOwner.toString(),
      entryFee: ENTRY_FEE, queryId,
    });
    for (const message of messages) {
      const result = await payer.send({ to: Address.parse(message.address), value: BigInt(message.amount) - 1n, body: Cell.fromBase64(message.payload), bounce: true });
      const first: any = result.transactions.find((tx: any) => tx.inMessage?.info?.dest?.equals(payerWalletAddress));
      expect(first.description.computePhase.success, 'the wallet refuses the underfunded request').toBe(false);
    }
    const payerWallet = blockchain.openContract(new ATHWallet(payerWalletAddress, await ATHWallet.init(0n, payer.address, masterAddress)));
    expect((await payerWallet.getGetWalletData()).balance, 'no ATH moved').toBe(10_000_000_000n);
    expect((await master.getGetJettonData()).total_supply).toBe(supplyBefore);
  });
});
