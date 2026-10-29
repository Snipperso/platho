import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ATHWallet, JettonTransfer } from '../build/ATHWallet/ATHWallet_ATHWallet';


const OWNER_REQUEST_EXEC = 2_000_000n;
const INTERNAL_EXEC = 2_000_000n;
const SOURCE_ACK = 4_000_000n;
const NOTIFY_ENDOWMENT = 20_000_000n;
const NOTIFY_EXEC = 7_000_000n;
const FWD_FEE_ALLOWANCE = 8_000_000n;

const FLOOR = OWNER_REQUEST_EXEC + (INTERNAL_EXEC + SOURCE_ACK + NOTIFY_ENDOWMENT) + FWD_FEE_ALLOWANCE;

const WALLET_DEFAULT_ATTACH = 50_000_000n;

async function setup() {
  const bc = await Blockchain.create();
  bc.now = 1_790_000_000;
  const owner = await bc.treasury('ath-floor-owner');
  const recipient = new Address(0, createHash('sha256').update('PLATHO.V1.TEST.ATH_FLOOR_RECIPIENT').digest());
  const master = new Address(0, createHash('sha256').update('PLATHO.V1.TEST.ATH_FLOOR_MASTER').digest());

  const zeroInit = await ATHWallet.init(0n, owner.address, master);
  const dataInit = await ATHWallet.init(1_000_000_000n, owner.address, master);
  const address = contractAddress(0, zeroInit);
  await bc.setShardAccount(address, createShardAccount({
    address, code: zeroInit.code, data: dataInit.data, balance: toNano('1'), workchain: 0,
  }));
  const wallet = bc.openContract(new ATHWallet(address, zeroInit));
  const recipientWallet = contractAddress(0, await ATHWallet.init(0n, recipient, master));
  return { bc, owner, recipient, master, wallet, recipientWallet };
}

function transfer(queryId: bigint, destination: any, response: any, forward: bigint): JettonTransfer {
  return {
    $$type: 'JettonTransfer',
    query_id: queryId,
    amount: 1_000n,
    destination,
    response_destination: response,
    custom_payload: null,
    forward_ton_amount: forward,
    forward_payload: beginCell().endCell().beginParse(),
  } as JettonTransfer;
}

describe('what an ordinary wallet must attach to move ATH', () => {
  it('WALLETFLOOR-01: MEASURED — what a standard wallet attaches is enough to move ATH', async () => {
    const { bc, owner, recipient, master, wallet, recipientWallet } = await setup();

    const standard = await wallet.send(owner.getSender(), { value: WALLET_DEFAULT_ATTACH },
      transfer(9001n, recipient, owner.address, 0n));
    expect(findTransaction(standard.transactions, { to: wallet.address, exitCode: 14704 }),
      `${WALLET_DEFAULT_ATTACH} is what an ordinary wallet attaches; if the value gate refuses it, ATH cannot be `
      + 'sent from Tonkeeper and the token is unusable outside this app').toBeUndefined();
    expect((await bc.openContract(ATHWallet.fromAddress(recipientWallet)).getGetWalletData()).balance,
      'and the ATH actually arrives').toBe(1_000n);
    expect(FLOOR, 'the floor must stay clear of what wallets attach, with room to spare')
      .toBeLessThan(WALLET_DEFAULT_ATTACH);

    const fresh1 = await setup();
    const justUnder = await fresh1.wallet.send(fresh1.owner.getSender(), { value: FLOOR - 1n },
      transfer(9002n, recipient, fresh1.owner.address, 0n));
    expect(findTransaction(justUnder.transactions, { to: fresh1.wallet.address, exitCode: 14704 }),
      `${FLOOR - 1n} must still be refused`).toBeDefined();

    const fresh2 = await setup();
    const atFloor = await fresh2.wallet.send(fresh2.owner.getSender(), { value: FLOOR },
      transfer(9003n, recipient, fresh2.owner.address, 0n));
    expect(findTransaction(atFloor.transactions, { to: fresh2.wallet.address, exitCode: 14704 }),
      `${FLOOR} is the floor and must be accepted`).toBeUndefined();
    expect((await fresh2.bc.openContract(ATHWallet.fromAddress(fresh2.recipientWallet)).getGetWalletData()).balance,
      'and at the floor the ATH actually arrives').toBe(1_000n);
    expect(master.workChain, 'sanity: the fixture master is basechain, so 14601/14602 are not what fired').toBe(0);
  }, 180_000);

  it('WALLETFLOOR-02: the floor is the gate, not a number copied beside it', async () => {
    const src = readFileSync('contracts/ATHWallet.tact', 'utf8');
    const gate = src.match(/receive\(msg: JettonTransfer\)[\s\S]*?throwUnless\(14704, context\(\)\.value >= required_value\)/);
    expect(gate, 'JettonTransfer must still gate on required_value under 14704').toBeTruthy();
    for (const term of ['ATH_INTERNAL_TRANSFER_EXEC_RESERVE', 'ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE',
      'ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT', 'ATH_TRANSFER_NOTIFY_EXEC_RESERVE',
      'ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE', 'ATH_OWNER_REQUEST_EXEC_RESERVE']) {
      expect(gate![0], `the JettonTransfer floor must still include ${term}`).toContain(term);
    }
  });

  it('WALLETFLOOR-04: a transfer carrying a comment is accepted, and the notification reaches the recipient', async () => {
    const { bc, owner, recipient, wallet, recipientWallet } = await setup();
    const comment = beginCell().storeUint(0, 32).storeStringTail('hello').endCell();

    const res = await wallet.send(owner.getSender(), { value: 60_000_000n }, {
      $$type: 'JettonTransfer', query_id: 9201n, amount: 1_000n, destination: recipient,
      response_destination: owner.address, custom_payload: null, forward_ton_amount: 1n,
      forward_payload: comment.beginParse(),
    } as JettonTransfer);

    expect(findTransaction(res.transactions, { to: wallet.address, exitCode: 14703 }),
      'a one-nanoton forward is how a comment is attached; refusing it means ATH cannot be sent with a message')
      .toBeUndefined();
    expect(res.transactions.some((t: any) => t.inMessage?.info?.dest?.equals?.(recipient)),
      'and the notification carrying the comment must actually reach the recipient owner').toBe(true);
    expect((await bc.openContract(ATHWallet.fromAddress(recipientWallet)).getGetWalletData()).balance).toBe(1_000n);
  }, 180_000);

  it('WALLETFLOOR-05: the change comes back instead of being buried in the recipient wallet', async () => {
    const { bc, owner, recipient, wallet, recipientWallet } = await setup();

    const spent: bigint[] = [];
    for (const n of [1, 2, 3]) {
      const before = (await bc.getContract(owner.address)).balance;
      await wallet.send(owner.getSender(), { value: FLOOR },
        transfer(BigInt(9300 + n), recipient, owner.address, 0n));
      spent.push(before - (await bc.getContract(owner.address)).balance);
    }
    const retained = (await bc.getContract(recipientWallet)).balance;
    const perTransfer = retained / 3n;

    expect(perTransfer, 'the recipient must not keep materially more than the storage endowment it is owed')
      .toBeLessThan(NOTIFY_ENDOWMENT + 5_000_000n);
    expect(perTransfer, 'and it must still keep the endowment — an under-funded wallet is the unrecoverable case')
      .toBeGreaterThanOrEqual(NOTIFY_ENDOWMENT);
    expect(spent[0], 'a transfer must cost the sender well under what it cost when the change was buried')
      .toBeLessThan(40_000_000n);
  }, 300_000);

  it('WALLETFLOOR-06: the recipient keeps its endowment whatever the comment weighs', async () => {
    const results: bigint[] = [];
    for (const cells of [0, 32, 100]) {
      const { bc, owner, recipient, wallet, recipientWallet } = await setup();
      let payload = beginCell().endCell();
      if (cells > 0) {
        let chain = beginCell().storeUint(0, 1000).endCell();
        for (let i = 1; i < cells; i += 1) chain = beginCell().storeUint(i % 2, 1000).storeRef(chain).endCell();
        payload = beginCell().storeUint(0, 8).storeRef(chain).endCell();
      }
      const res = await wallet.send(owner.getSender(), { value: 120_000_000n }, {
        $$type: 'JettonTransfer', query_id: BigInt(9400 + cells), amount: 1_000n, destination: recipient,
        response_destination: owner.address, custom_payload: null, forward_ton_amount: 1n,
        forward_payload: payload.beginParse(),
      } as JettonTransfer);

      const refused = findTransaction(res.transactions, { to: wallet.address, exitCode: 14704 });
      if (refused) continue;
      const balance = (await bc.getContract(recipientWallet)).balance;
      expect(balance, `payload ${cells} cells: an accepted transfer must leave the endowment whole`)
        .toBeGreaterThanOrEqual(NOTIFY_ENDOWMENT);
      results.push(balance);
    }
    expect(results.length, 'the honest comment sizes must be accepted, not all refused').toBeGreaterThan(1);
    const spread = results.reduce((m, v) => (v > m ? v : m)) - results.reduce((m, v) => (v < m ? v : m));
    expect(spread, `what the wallet keeps still moves with the payload (spread ${spread}) — that dependence was the `
      + 'defect, and a fee schedule change must not be able to reintroduce it quietly').toBeLessThan(1_000n);
  }, 300_000);

  it('WALLETFLOOR-03: asking for a notification raises the floor by the forward amount plus the notify reserve', async () => {
    const NOTIFY_MIN = 45_000_000n;
    const NOTIFY_FLOOR = OWNER_REQUEST_EXEC + (NOTIFY_MIN + SOURCE_ACK + NOTIFY_EXEC + NOTIFY_ENDOWMENT)
      + FWD_FEE_ALLOWANCE;

    const a = await setup();
    const short = await a.wallet.send(a.owner.getSender(), { value: NOTIFY_FLOOR },
      transfer(9101n, a.recipient, a.owner.address, NOTIFY_MIN));
    expect(findTransaction(short.transactions, { to: a.wallet.address, exitCode: 14704 }),
      `${NOTIFY_FLOOR} covers every fixed term but not the forward fee, and must be refused`).toBeDefined();

    const b = await setup();
    const ok = await b.wallet.send(b.owner.getSender(), { value: NOTIFY_FLOOR + 1_000_000n },
      transfer(9102n, b.recipient, b.owner.address, NOTIFY_MIN));
    expect(findTransaction(ok.transactions, { to: b.wallet.address, exitCode: 14704 }),
      'the fixed floor plus a small forward-fee allowance must be accepted').toBeUndefined();
    expect((await b.bc.openContract(ATHWallet.fromAddress(b.recipientWallet)).getGetWalletData()).balance)
      .toBe(1_000n);
  }, 180_000);
});
