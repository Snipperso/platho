import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { readFileSync } from 'node:fs';
import { ATHWallet, ATHTransferRequest, ATHTransferAck } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';


const ACK_VALUE = 4_000_000n;
const GAS_PRICE = 66.667;
const OLD_BUDGET_GAS = 15_000;
const ENTRIES = 300;
const SAMPLE = 12;

function fixtureAddress(label: string): Address {
  return new Address(0, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

describe('PENDING-OUTGOING RATCHET — the ack must outlive the map it clears', () => {
  it('RATCHET-00: the source-ack constant is the one the measurement calls for', () => {
    const src = readFileSync('contracts/ATHWallet.tact', 'utf8');
    const m = /const ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE: Int = (\d+);/.exec(src);
    expect(m, 'the constant must still exist under this name').not.toBeNull();
    const value = BigInt(m![1]);
    expect(value, 'the test mirror matches the contract').toBe(ACK_VALUE);

    const budgetGas = Number(value) / GAS_PRICE;
    expect(budgetGas, `${value} buys ${Math.floor(budgetGas)} gas units`).toBeGreaterThan(OLD_BUDGET_GAS * 3);
  });

  it('RATCHET-01: clearing a deep map succeeds, and does so with real headroom', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const owner = await bc.treasury('ratchet-owner');
    const master = fixtureAddress('RATCHET_MASTER');
    const recipientOwner = fixtureAddress('RATCHET_RECIPIENT_OWNER');

    const zeroInit = await ATHWallet.init(0n, owner.address, master);
    const dataInit = await ATHWallet.init(10n ** 18n, owner.address, master);
    const srcAddr = contractAddress(0, zeroInit);
    await bc.setShardAccount(srcAddr, createShardAccount({
      address: srcAddr, code: zeroInit.code, data: dataInit.data, balance: toNano('2000'), workchain: 0,
    }));
    const src = bc.openContract(new ATHWallet(srcAddr, zeroInit));

    const recipientAddr = contractAddress(0, await ATHWallet.init(0n, recipientOwner, master));
    const mockInit = await MockAthWalletNoAck.init();
    await bc.setShardAccount(recipientAddr, createShardAccount({
      address: recipientAddr, code: mockInit.code, data: mockInit.data, balance: toNano('100'), workchain: 0,
    }));
    const ackFrom = bc.sender(recipientAddr);

    const push = (qid: bigint) => src.send(owner.getSender(), { value: toNano('0.2') }, {
      $$type: 'ATHTransferRequest',
      query_id: qid, amount: 1000n, recipient: recipientOwner, response_destination: owner.address,
    } as ATHTransferRequest);

    for (let i = 0; i < ENTRIES; i += 1) await push(BigInt(100000 + i));

    let worst = 0;
    for (let s = 0; s < SAMPLE; s += 1) {
      const qid = BigInt(100000 + Math.floor((ENTRIES - 1) * (s + 1) / (SAMPLE + 1)));
      const res = await src.send(ackFrom, { value: ACK_VALUE }, {
        $$type: 'ATHTransferAck', query_id: qid, amount: 1000n,
      } as ATHTransferAck);
      const tx: any = res.transactions.find((t: any) =>
        t.inMessage?.info?.dest?.toString() === srcAddr.toString() && t.description?.type === 'generic');
      const cp = tx?.description?.computePhase;
      expect(cp?.exitCode, `clearing entry ${qid} must not run out of gas`).toBe(0);
      expect(cp?.success, `clearing entry ${qid} must succeed`).toBe(true);
      worst = Math.max(worst, Number(cp?.gasUsed ?? 0));
      await push(qid);
    }

    const budgetGas = Number(ACK_VALUE) / GAS_PRICE;
    expect(worst, `worst clear used ${worst} of ${Math.floor(budgetGas)} available`).toBeLessThan(budgetGas / 2);
    expect(worst, 'the sampled map really is deep (a shallow map would clear near the 6,499 floor)').toBeGreaterThan(9_000);
  }, 600_000);
});
