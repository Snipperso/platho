import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ATHWallet, JettonTransfer } from '../build/ATHWallet/ATHWallet_ATHWallet';

// CAN AN ORDINARY WALLET SEND ATH?
//
// Asked 2026-07-31, mid-ceremony, after Tonkeeper refused a transfer with "Jetton transfer estimation failed" and
// showed a fee of 0.05 GRAM. ATHWallet does implement TEP-74 (`JettonTransfer`, 0x0F8A7EA5), so the token is not
// exotic — the question is the VALUE gate 14704 in front of it, which every existing test funds far past.
//
// tests/ath-wallet-transfer.test.ts and its neighbours all send toNano('0.3'). That is how a floor stays unmeasured:
// the positive tests prove the path works when money is not scarce, and the one number a real wallet actually
// attaches is never tried. What follows is the floor itself, measured, plus the value a standard wallet sends.

const OWNER_REQUEST_EXEC = 2_000_000n;
const INTERNAL_EXEC = 2_000_000n;
const SOURCE_ACK = 4_000_000n;
const NOTIFY_ENDOWMENT = 20_000_000n;
const NOTIFY_EXEC = 7_000_000n;
const FWD_FEE_ALLOWANCE = 8_000_000n;

// [CORRECTED 2026-08-01] NOTIFY_EXEC is no longer part of the no-notification floor: it paid for a notification the
// branch never sends, and the receiving gate 14717 never asked for it. With that term gone and the forward allowance
// measured down from 21M to 8M, the plain floor is 36,000,000 — below the 50,000,000 a standard wallet attaches.
const FLOOR = OWNER_REQUEST_EXEC + (INTERNAL_EXEC + SOURCE_ACK + NOTIFY_ENDOWMENT) + FWD_FEE_ALLOWANCE;

/** What a standard wallet attaches for a jetton transfer, and what Tonkeeper showed when it refused ATH. */
const WALLET_DEFAULT_ATTACH = 50_000_000n;

/** Same shape the existing wallet suite uses: a fixture master, and the source wallet seeded with a balance. */
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

    // THE PROPERTY THIS FILE EXISTS FOR. 0.05 GRAM is not an arbitrary probe: it is what Tonkeeper attaches for a
    // jetton transfer, and what it displayed on the screen where it refused to send ATH on 2026-07-31. Until the
    // floor was corrected this transfer died on gate 14704 and the token could not leave a standard wallet at all.
    const standard = await wallet.send(owner.getSender(), { value: WALLET_DEFAULT_ATTACH },
      transfer(9001n, recipient, owner.address, 0n));
    expect(findTransaction(standard.transactions, { to: wallet.address, exitCode: 14704 }),
      `${WALLET_DEFAULT_ATTACH} is what an ordinary wallet attaches; if the value gate refuses it, ATH cannot be `
      + 'sent from Tonkeeper and the token is unusable outside this app').toBeUndefined();
    expect((await bc.openContract(ATHWallet.fromAddress(recipientWallet)).getGetWalletData()).balance,
      'and the ATH actually arrives').toBe(1_000n);
    expect(FLOOR, 'the floor must stay clear of what wallets attach, with room to spare')
      .toBeLessThan(WALLET_DEFAULT_ATTACH);

    // And the floor itself, pinned to the nanoton so it cannot drift back up unnoticed.
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
    // Without this the test above compares one literal to another: delete a term from 14704 and the measurement
    // simply moves with it, staying green while the wallet's real requirement changed.
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
    // A wallet attaches a comment by putting it in forward_payload with a TINY forward_ton_amount, so the recipient
    // emits the notification that carries the text. Gates 14703 and 14713 used to refuse the whole range from 1 to
    // 45,000,000, so ATH could not be sent with a message. That floor was measured, but for the custom notify lanes,
    // where it lets a refused registry purchase refund itself past gate 14212; the standard lane is fire-and-forget
    // and never needed it.
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
    // MEASURED BEFORE THE FIX: three transfers left 44,047,996 / 88,099,059 / 132,150,122 on the recipient — about
    // 44,000,000 each, permanently, because the excess was a fixed 1,000,000 and an ATHWallet has NO entry point
    // that pays TON back to its owner. Of 55,425,870 spent per transfer, only ~6,800,000 was fee.
    //
    // After: the wallet keeps the storage endowment it may have just been deployed with and returns the rest.
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

  it('WALLETFLOOR-03: asking for a notification raises the floor by the forward amount plus the notify reserve', async () => {
    // The other shape a wallet sends: forward_ton_amount > 0 so the recipient gets a JettonTransferNotification.
    // The two branches do NOT share a floor, and the difference is not just the forward amount: the notifying branch
    // pays NOTIFY_EXEC (7M) and drops INTERNAL_EXEC (2M), matching arrival gate 14714 instead of 14717.
    const NOTIFY_MIN = 45_000_000n;
    const NOTIFY_FLOOR = OWNER_REQUEST_EXEC + (NOTIFY_MIN + SOURCE_ACK + NOTIFY_EXEC + NOTIFY_ENDOWMENT)
      + FWD_FEE_ALLOWANCE;

    const a = await setup();
    const short = await a.wallet.send(a.owner.getSender(), { value: NOTIFY_FLOOR - 1n },
      transfer(9101n, a.recipient, a.owner.address, NOTIFY_MIN));
    expect(findTransaction(short.transactions, { to: a.wallet.address, exitCode: 14704 }),
      `${NOTIFY_FLOOR - 1n} must be refused once a notification is requested`).toBeDefined();

    const b = await setup();
    const ok = await b.wallet.send(b.owner.getSender(), { value: NOTIFY_FLOOR },
      transfer(9102n, b.recipient, b.owner.address, NOTIFY_MIN));
    expect(findTransaction(ok.transactions, { to: b.wallet.address, exitCode: 14704 }),
      `${NOTIFY_FLOOR} is the notifying floor and must be accepted`).toBeUndefined();
    expect((await b.bc.openContract(ATHWallet.fromAddress(b.recipientWallet)).getGetWalletData()).balance)
      .toBe(1_000n);
  }, 180_000);
});
