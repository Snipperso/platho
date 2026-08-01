import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ATHWallet, JettonTransfer, storeJettonInternalTransfer } from '../build/ATHWallet/ATHWallet_ATHWallet';

// WHAT AN ATH TRANSFER ACTUALLY COSTS, measured rather than declared.
//
// The gates state what a caller must attach. This file states what the chain actually charges, which is the only
// honest basis for sizing those gates. Written 2026-08-01, after the transfer floor (0.056) turned out to sit above
// what an ordinary wallet attaches (0.05) — making ATH unsendable from Tonkeeper — and after the largest term in
// that floor, ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE = 21,000,000, turned out to be the one big constant in the
// contract with no recorded measurement behind it.
//
// Numbers are REPORTED, and only loosely pinned. A test that froze today's fee schedule would fail on a config
// change that costs nobody anything; what must not drift silently is the ORDER OF MAGNITUDE between the allowance
// and the fee it exists to cover.

const MASTER = new Address(0, createHash('sha256').update('PLATHO.V1.TEST.COST_MASTER').digest());
const OWNER_B = new Address(0, createHash('sha256').update('PLATHO.V1.TEST.COST_OWNER_B').digest());

async function fresh() {
  const bc = await Blockchain.create();
  bc.now = 1_790_000_000;
  return bc;
}

async function placeWallet(bc: any, owner: Address, athBalance: bigint, ton: bigint) {
  const zeroInit = await ATHWallet.init(0n, owner, MASTER);
  const dataInit = await ATHWallet.init(athBalance, owner, MASTER);
  const address = contractAddress(0, zeroInit);
  await bc.setShardAccount(address, createShardAccount({
    address, code: zeroInit.code, data: dataInit.data, balance: ton, workchain: 0,
  }));
  return address;
}

/** The real sender path: an owner signs JettonTransfer, the wallet builds the internal message (with StateInit). */
async function sendReal(bc: any, ownerTreasury: any, sourceWallet: Address, attach: bigint,
  forward: bigint, payloadCells = 0, queryId = 1n) {
  let payload = beginCell().endCell();
  if (payloadCells > 0) {
    payload = beginCell().storeUint(0, 8).endCell();
    for (let i = 1; i < payloadCells; i += 1) payload = beginCell().storeUint(i, 32).storeRef(payload).endCell();
  }
  return bc.openContract(ATHWallet.fromAddress(sourceWallet)).send(ownerTreasury.getSender(), { value: attach }, {
    $$type: 'JettonTransfer', query_id: queryId, amount: 1_000n, destination: OWNER_B,
    response_destination: ownerTreasury.address, custom_payload: null,
    forward_ton_amount: forward, forward_payload: payload.beginParse(),
  } as JettonTransfer);
}

describe('what an ATH transfer really costs', () => {
  it('COST-01: the forward fee of the sender leg, by payload size and by whether the recipient exists', async () => {
    const rows: Array<[string, number, bigint]> = [];
    for (const deployed of [false, true]) {
      for (const cells of [0, 1, 8, 32, 100, 250]) {
        const bc = await fresh();
        const owner = await bc.treasury('cost-owner-a');
        const sourceWallet = await placeWallet(bc, owner.address, 1_000_000n, toNano('1'));
        const target = contractAddress(0, await ATHWallet.init(0n, OWNER_B, MASTER));
        if (deployed) await placeWallet(bc, OWNER_B, 0n, 100_000_000n);

        const res = await sendReal(bc, owner, sourceWallet, toNano('0.5'), 0n, cells);
        const t = res.transactions.find((x: any) => x.inMessage?.info?.dest?.equals?.(target));
        const fee = (t as any)?.inMessage?.info?.forwardFee ?? 0n;
        rows.push([deployed ? 'уже есть' : 'разворачивается', cells, fee]);
        console.log(`  получатель ${(deployed ? 'уже есть' : 'разворачивается').padEnd(16)} payload ${String(cells).padStart(3)} яч. -> forward = ${fee}`);
      }
    }

    // Read the allowance out of the contract rather than restating it: this test exists to compare the ALLOWANCE
    // against the measured FEE, and a copy of the allowance here would compare a literal to a literal.
    const src = readFileSync('contracts/ATHWallet.tact', 'utf8');
    const declared = BigInt(src.match(/const ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE: Int = (\d+);/)![1]);
    const worst = rows.reduce((m, r) => (r[2] > m ? r[2] : m), 0n);
    console.log(`\n  ХУДШИЙ ЗАМЕРЕННЫЙ forward = ${worst}   запас в контракте = ${declared}  (${(Number(declared) / Number(worst)).toFixed(2)}x)`);
    expect(worst, 'the forward fee must stay below the allowance sized for it, or ordinary transfers arrive short '
      + 'and bounce').toBeLessThan(declared);
    expect(declared, 'and the allowance must keep a real margin over the worst measured case — at least 1.5x, or a '
      + 'slightly larger payload than anything measured here starts bouncing').toBeGreaterThan(worst * 3n / 2n);
  }, 900_000);

  it('COST-02: the smallest value an EXISTING recipient wallet really accepts, per branch', async () => {
    // Direct message from the correctly derived sibling address, so gate 14711 passes and only the value varies.
    // The deploy case cannot be probed this way (a raw message cannot carry the StateInit here); it is covered
    // end-to-end by COST-03.
    for (const [label, forward] of [['без уведомления', 0n], ['уведомление 45M', 45_000_000n],
      ['уведомление 1 нанотон', 1n]] as Array<[string, bigint]>) {
      let low = 1_000_000n; let high = 300_000_000n; let lastExit = -1; let q = 1n;
      while (low < high) {
        const mid = (low + high) / 2n;
        const bc = await fresh();
        const owner = await bc.treasury('cost-owner-a');
        const sourceWallet = await placeWallet(bc, owner.address, 1_000_000n, toNano('1'));
        const target = await placeWallet(bc, OWNER_B, 0n, 100_000_000n);
        const res = await bc.sendMessage(internal({
          from: sourceWallet, to: target, value: mid, bounce: true,
          body: beginCell().store(storeJettonInternalTransfer({
            $$type: 'JettonInternalTransfer', query_id: q, amount: 1_000n, from: owner.address,
            response_address: owner.address, forward_ton_amount: forward,
            forward_payload: beginCell().endCell().beginParse(),
          })).endCell(),
        }));
        q += 1n;
        const t = res.transactions.find((x: any) => x.inMessage?.info?.dest?.equals?.(target));
        const exit = (t as any)?.description?.computePhase?.exitCode ?? -1;
        if (exit === 0) high = mid; else { low = mid + 1n; lastExit = exit; }
      }
      console.log(`  приём "${label}": реальный пол = ${low}  (отказ: exit ${lastExit})`);
    }
    expect(true).toBe(true);
  }, 900_000);

  it('COST-04: the custom lane — what an arriving ATHInternalTransfer really needs', async () => {
    // Measured separately because the two lanes do NOT compose the same terms. ATHTransferRequest's required_value
    // (gate 14204) omits ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE, while the arrival gate 14212 demands it. Today the
    // 21,000,000 forward allowance is fat enough to hide the gap; shrink the allowance without noticing this and the
    // lane breaks. This is the number the sender's gate must actually be built from.
    const { storeATHInternalTransfer } = await import('../build/ATHWallet/ATHWallet_ATHWallet');
    let low = 1_000_000n; let high = 200_000_000n; let lastExit = -1; let q = 1n;
    while (low < high) {
      const mid = (low + high) / 2n;
      const bc = await fresh();
      const owner = await bc.treasury('cost-owner-a');
      const sourceWallet = await placeWallet(bc, owner.address, 1_000_000n, toNano('1'));
      const target = await placeWallet(bc, OWNER_B, 0n, 100_000_000n);
      const res = await bc.sendMessage(internal({
        from: sourceWallet, to: target, value: mid, bounce: true,
        body: beginCell().store(storeATHInternalTransfer({
          $$type: 'ATHInternalTransfer', query_id: q, amount: 1_000n, sender_owner: owner.address,
          response_destination: owner.address,
        } as any)).endCell(),
      }));
      q += 1n;
      const t = res.transactions.find((x: any) => x.inMessage?.info?.dest?.equals?.(target));
      const exit = (t as any)?.description?.computePhase?.exitCode ?? -1;
      if (exit === 0) high = mid; else { low = mid + 1n; lastExit = exit; }
    }
    console.log(`  приём ATHInternalTransfer: реальный пол = ${low}  (отказ: exit ${lastExit})`);
    console.log(`  гейт отправителя 14204 закладывает: 2M+3M+20M+21M+2M = 48000000, без SOURCE_ACK`);
    expect(true).toBe(true);
  }, 600_000);

  it('COST-05: the custom lane returns change too, not only the standard one', async () => {
    // [ADDED 2026-08-01, tier 2/3 outside-in pass] The change fix landed on JettonInternalTransfer and skipped
    // ATHInternalTransfer — and the custom lane is the one every protocol PAYOUT uses: vesting claims,
    // MarketStabilitySeller sales, airdrop deliveries, both registries. Each funds the leg from a hand-set constant
    // far above the gate (58,000,000 from vesting and MSS, 48,000,000 from the registries, against 39,000,000), so
    // the surplus was landing on the recipient's wallet and staying — the same burial, on the larger flows.
    const { storeATHInternalTransfer } = await import('../build/ATHWallet/ATHWallet_ATHWallet');
    const bc = await fresh();
    const owner = await bc.treasury('cost-owner-a');
    const sourceWallet = await placeWallet(bc, owner.address, 1_000_000n, toNano('1'));
    const target = await placeWallet(bc, OWNER_B, 0n, 0n);
    const responder = await bc.treasury('cost-responder');

    const ARRIVAL_MIN = 29_000_000n;          // gate 14212: EXEC + ACK + SOURCE_ACK + ENDOWMENT
    const sent = 53_000_000n;                 // what a 58,000,000 payout leg delivers after the sender's own reserve
    const before = (await bc.getContract(responder.address)).balance;
    await bc.sendMessage(internal({
      from: sourceWallet, to: target, value: sent, bounce: true,
      body: beginCell().store(storeATHInternalTransfer({
        $$type: 'ATHInternalTransfer', query_id: 1n, amount: 1_000n, sender_owner: owner.address,
        response_destination: responder.address,
      } as any)).endCell(),
    }));

    const returned = (await bc.getContract(responder.address)).balance - before;
    const kept = (await bc.getContract(target)).balance;
    console.log(`  кастомная полоса: прислали ${sent}  вернулось ${returned}  осталось у получателя ${kept}`);

    expect(returned, 'the payer must get the surplus back rather than have it buried on the recipient wallet')
      .toBeGreaterThan(10_000_000n);
    expect(kept, 'and the recipient must still keep what gate 14212 required it to keep')
      .toBeGreaterThanOrEqual(ARRIVAL_MIN - 10_000_000n);
    expect(readFileSync('contracts/ATHWallet.tact', 'utf8'),
      'the subtraction must stay tied to the gate, not to a copy of its value')
      .toMatch(/let excess: Int = context\(\)\.value - ATH_INTERNAL_TRANSFER_ARRIVAL_MIN/);
  }, 300_000);

  it('COST-03: end to end at the current floor — what is delivered, what is kept, what comes back', async () => {
    const bc = await fresh();
    const owner = await bc.treasury('cost-owner-a');
    const sourceWallet = await placeWallet(bc, owner.address, 1_000_000n, toNano('1'));
    const target = contractAddress(0, await ATHWallet.init(0n, OWNER_B, MASTER));

    const ownerBefore = (await bc.getContract(owner.address)).balance;
    const res = await sendReal(bc, owner, sourceWallet, 56_000_000n, 0n, 0);
    const arrival = res.transactions.find((x: any) => x.inMessage?.info?.dest?.equals?.(target));
    const delivered = (arrival as any)?.inMessage?.info?.value?.coins ?? 0n;
    const fee = (arrival as any)?.inMessage?.info?.forwardFee ?? 0n;

    const ownerAfter = (await bc.getContract(owner.address)).balance;
    const recipientTon = (await bc.getContract(target)).balance;
    const senderTon = (await bc.getContract(sourceWallet)).balance;

    console.log(`  прикреплено          56000000`);
    console.log(`  доехало              ${delivered}   (forward ${fee})`);
    console.log(`  осталось получателю  ${recipientTon}`);
    console.log(`  кошелёк отправителя  ${senderTon} (было 1000000000)`);
    console.log(`  владелец потратил    ${ownerBefore - ownerAfter}`);
    expect((await bc.openContract(ATHWallet.fromAddress(target)).getGetWalletData()).balance).toBe(1_000n);
  }, 300_000);
});
