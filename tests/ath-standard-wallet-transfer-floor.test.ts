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
const FWD_FEE_ALLOWANCE = 21_000_000n;
const FLOOR = INTERNAL_EXEC + SOURCE_ACK + NOTIFY_ENDOWMENT + NOTIFY_EXEC + FWD_FEE_ALLOWANCE + OWNER_REQUEST_EXEC;

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
  it('WALLETFLOOR-01: MEASURED — a plain TEP-74 transfer needs 0.056 GRAM, and 0.05 is refused', async () => {
    const { bc, owner, recipient, master, wallet, recipientWallet } = await setup();

    // 0.05 GRAM is not an arbitrary probe: it is what Tonkeeper attaches for a jetton transfer by default, and what
    // it displayed on the screen where the estimation failed.
    const short = await wallet.send(owner.getSender(), { value: 50_000_000n },
      transfer(9001n, recipient, owner.address, 0n));
    const rejected = findTransaction(short.transactions, { to: wallet.address, exitCode: 14704 });
    expect(rejected, 'a 0.05 GRAM transfer must be the one that fails, and fail on the VALUE gate 14704 — if it '
      + 'fails on something else this test is measuring the wrong thing').toBeDefined();
    expect((await bc.getContract(recipientWallet)).balance, 'and nothing moved').toBe(0n);

    // One nanoton below the computed floor: pins the floor exactly rather than somewhere in a range.
    const justUnder = await wallet.send(owner.getSender(), { value: FLOOR - 1n },
      transfer(9002n, recipient, owner.address, 0n));
    expect(findTransaction(justUnder.transactions, { to: wallet.address, exitCode: 14704 }),
      `${FLOOR - 1n} must still be refused`).toBeDefined();

    const atFloor = await wallet.send(owner.getSender(), { value: FLOOR },
      transfer(9003n, recipient, owner.address, 0n));
    expect(findTransaction(atFloor.transactions, { to: wallet.address, exitCode: 14704 }),
      `${FLOOR} is the floor and must be accepted`).toBeUndefined();
    expect((await bc.openContract(ATHWallet.fromAddress(recipientWallet)).getGetWalletData()).balance,
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

  it('WALLETFLOOR-03: asking for a notification raises the floor by exactly the forward amount', async () => {
    // The other shape a wallet sends: forward_ton_amount > 0 so the recipient gets a JettonTransferNotification.
    // 14703 refuses anything between 1 and ATH_TRANSFER_NOTIFY_MIN_VALUE, so the smallest notifying transfer is
    // FLOOR + 45,000,000 = 0.101 GRAM — worth knowing before an integration attaches 0.05 and calls the token broken.
    const { bc, owner, recipient, wallet, recipientWallet } = await setup();
    const NOTIFY_MIN = 45_000_000n;

    const short = await wallet.send(owner.getSender(), { value: FLOOR },
      transfer(9101n, recipient, owner.address, NOTIFY_MIN));
    expect(findTransaction(short.transactions, { to: wallet.address, exitCode: 14704 }),
      'the plain floor is not enough once a notification is requested').toBeDefined();

    const ok = await wallet.send(owner.getSender(), { value: FLOOR + NOTIFY_MIN },
      transfer(9102n, recipient, owner.address, NOTIFY_MIN));
    expect(findTransaction(ok.transactions, { to: wallet.address, exitCode: 14704 }),
      'and the floor plus the forward amount is').toBeUndefined();
    expect((await bc.openContract(ATHWallet.fromAddress(recipientWallet)).getGetWalletData()).balance).toBe(1_000n);
  }, 180_000);
});
