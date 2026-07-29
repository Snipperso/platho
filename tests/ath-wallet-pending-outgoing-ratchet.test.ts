import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { readFileSync } from 'node:fs';
import { ATHWallet, ATHTransferRequest, ATHTransferAck } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PENDING-OUTGOING RATCHET — the map that had no bound, no prune, no getter and, until this file, no test.
//
// `pending_outgoing_transfers` gains an entry on every outgoing ATH transfer and loses one on exactly two
// paths: the recipient's ATHTransferAck, and a bounce. The ack is where the danger was. ATHWallet never calls
// accept_message, so an incoming internal message may burn at most value/gas_price units — and the ack was
// funded with a frozen 1,000,000, i.e. exactly 15,000 units at 66.667/unit. Clearing costs a hash plus a dict
// get and delete on a 257-bit key, and that grows with the DEPTH of the tree.
//
// MEASURED 2026-07-29 at the old 1M budget (worst of 24 sampled keys at each size):
//     N=1    -> 6,499 gas          N=2000 -> 14,724 (276 spare)
//     N=4000 -> 14,999, exit -14 on 2 of 24     N=6000 -> 6 of 24     N=9000 -> 10 of 24
// Past ~4,000 entries the ack simply ran out of gas. It is sent bounce:false, so nobody learned anything: the
// entry became PERMANENT while sending kept working on a budget 48x larger. Each stuck entry deepens the tree,
// so the failing fraction grows — a one-way ratchet toward the ~65,536-cell account ceiling, on an immutable
// contract, invisible from outside because this map has no getter.
//
// The fix is the constant: 1M -> 4M buys 60,000 units. These tests exist so the budget can never again be
// judged by reading rather than by running.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const ACK_VALUE = 4_000_000n;          // mirrors ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE
const GAS_PRICE = 66.667;              // basechain, config-21
const OLD_BUDGET_GAS = 15_000;         // what 1,000,000 bought — the ceiling the ack used to hit
const ENTRIES = 300;                   // deep enough that the tree is many levels; fast enough for the suite
const SAMPLE = 12;

function fixtureAddress(label: string): Address {
  return new Address(0, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

describe('PENDING-OUTGOING RATCHET — the ack must outlive the map it clears', () => {
  it('RATCHET-00: the source-ack constant is the one the measurement calls for', () => {
    // Read the contract rather than trust this file: a mirror that drifts is how the 1M survived unexamined.
    const src = readFileSync('contracts/ATHWallet.tact', 'utf8');
    const m = /const ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE: Int = (\d+);/.exec(src);
    expect(m, 'the constant must still exist under this name').not.toBeNull();
    const value = BigInt(m![1]);
    expect(value, 'the test mirror matches the contract').toBe(ACK_VALUE);

    const budgetGas = Number(value) / GAS_PRICE;
    // The worst cost ever measured was 14,999 — and that was the CAP, not the true cost, because it ran out.
    // Demand a multiple of the old ceiling so the margin is structural rather than a near miss.
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

    // A recipient that ACCEPTS and never acks is the only way entries survive — which is exactly the state the
    // ratchet needs. MockAthWalletNoAck sits at the derived recipient address for that purpose.
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
      await push(qid);   // put the entry back so the map keeps its depth
    }

    // The measurement, not a belief: the worst sampled clear must sit far below what the budget buys. If a future
    // change makes clearing dearer — a wider key, another dict op — this is where it shows up.
    const budgetGas = Number(ACK_VALUE) / GAS_PRICE;
    expect(worst, `worst clear used ${worst} of ${Math.floor(budgetGas)} available`).toBeLessThan(budgetGas / 2);
    // And it must be above the trivial single-entry cost, or the map was not actually deep and this proves nothing.
    expect(worst, 'the sampled map really is deep (a shallow map would clear near the 6,499 floor)').toBeGreaterThan(9_000);
  }, 600_000);
});
