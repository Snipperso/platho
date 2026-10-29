import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { readFileSync } from 'node:fs';
import { ATHWallet, ATHTransferRequestWithNotify, AthTransferNotificationAck } from '../build/ATHWallet/ATHWallet_ATHWallet';


const SRC = readFileSync('contracts/ATHWallet.tact', 'utf8');
const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 0x41544e49n;
const ATH_SENDER_KEY_MOD = 1461501637330902918203684832716283019655932542976n;

function senderKey(senderOwner: Address, queryId: bigint): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(ATH_TRANSFER_NOTIFY_ID_DOMAIN, 32)
    .storeUint(queryId, 64)
    .storeAddress(senderOwner)
    .endCell()
    .hash()
    .toString('hex')) % ATH_SENDER_KEY_MOD;
}

const CLOCK_BASE = 1_790_000_000;

const fixtureAddress = (label: string) =>
  new Address(0, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());

function countCells(root: any): number {
  const seen = new Set<string>();
  const walk = (c: any) => {
    const h = c.hash().toString('hex');
    if (seen.has(h)) return;
    seen.add(h);
    for (const r of c.refs) walk(r);
  };
  walk(root);
  return seen.size;
}

async function deployWallet(bc: Blockchain, owner: Address, master: Address, balance: bigint) {
  const zeroInit = await ATHWallet.init(0n, owner, master);
  const dataInit = await ATHWallet.init(balance, owner, master);
  const address = contractAddress(owner.workChain, zeroInit);
  await bc.setShardAccount(address, createShardAccount({
    address, code: zeroInit.code, data: dataInit.data, balance: toNano('5'), workchain: address.workChain,
  }));
  return bc.openContract(new ATHWallet(address, zeroInit));
}

describe('ATHWALLET GROWTH — the official wallet must not grow per purchase', () => {
  it('ATHTOMB-01: the permanent replay tombstone is GONE, and the guard that protects the balance is not', () => {
    expect(/processed_notifications\s*:/.test(SRC), 'the tombstone map must not be declared').toBe(false);
    expect(/processed_notifications\s*\.\s*set/.test(SRC), 'and nothing may write one').toBe(false);
    expect(/throwUnless\(14315,\s*!self\.pending_notifications\.exists/.test(SRC), 'plain lane in-flight guard').toBe(true);
    expect(/throwUnless\(14565,\s*!self\.pending_notifications\.exists/.test(SRC), 'username lane in-flight guard').toBe(true);
    expect(/throwUnless\(14665,\s*!self\.pending_notifications\.exists/.test(SRC), 'profile lane in-flight guard').toBe(true);
  });

  it('ATHTOMB-02: the receiving wallet does not grow across many settled purchases', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK_BASE;
    const master = fixtureAddress('ATHTOMB_MASTER');
    const registryOwner = await bc.treasury('athtomb-registry-owner');
    const recipientInit = await ATHWallet.init(0n, registryOwner.address, master);
    const recipientAddress = contractAddress(0, recipientInit);
    const recipient = bc.openContract(new ATHWallet(recipientAddress, recipientInit));

    const cellsAfter: number[] = [];
    const SALES = 25;
    for (let i = 0; i < SALES; i += 1) {
      bc.now = CLOCK_BASE + i * 91;
      const buyerOwner = await bc.treasury(`athtomb-buyer-${i}`);
      const buyer = await deployWallet(bc, buyerOwner.address, master, 1_000n);
      const queryId = BigInt(9000 + i);

      await buyer.send(buyerOwner.getSender(), { value: toNano('0.3') }, {
        $$type: 'ATHTransferRequestWithNotify',
        query_id: queryId,
        amount: 10n,
        recipient: registryOwner.address,
        response_destination: buyerOwner.address,
        notify_destination: registryOwner.address,
        notify_value: toNano('0.05'),
      } as ATHTransferRequestWithNotify);

      await recipient.send(registryOwner.getSender(), { value: toNano('0.05') }, {
        $$type: 'AthTransferNotificationAck',
        query_id: queryId,
        amount: 10n,
        sender_key: senderKey(buyerOwner.address, queryId),
      } as AthTransferNotificationAck);

      const state: any = (await bc.getContract(recipientAddress)).account?.account?.storage?.state;
      cellsAfter.push(countCells(state.state.data));
    }

    const marginal = (cellsAfter[SALES - 1] - cellsAfter[SALES - 6]) / 5;
    // eslint-disable-next-line no-console
    console.log([
      `[ATHTOMB-02] cells after 1 settled sale: ${cellsAfter[0]}`,
      `             cells after ${SALES} settled sales: ${cellsAfter[SALES - 1]}`,
      `             MARGINAL cells per sale: ${marginal.toFixed(2)}   (was 3.00 with the tombstone)`,
    ].join('\n'));

    expect((await recipient.getGetWalletData()).balance, 'every sale credited the official wallet').toBe(BigInt(10 * SALES));
    expect(marginal, 'a settled sale must leave NO permanent residue on the official wallet').toBe(0);
    expect(cellsAfter[SALES - 1], 'the wallet is the same size as after the first sale').toBe(cellsAfter[0]);
  }, 600_000);

  it('ATHTOMB-03: MEASURED — an UNSETTLED escrow backlog, and whether it can lock the owner out of their own ATH', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK_BASE;
    const master = fixtureAddress('ATHTOMB3_MASTER');
    const victimOwner = await bc.treasury('athtomb3-victim');
    const victim = await deployWallet(bc, victimOwner.address, master, 1_000_000n);
    const victimAddress = victim.address;
    const cellsOf = async () => {
      const state: any = (await bc.getContract(victimAddress)).account?.account?.storage?.state;
      return countCells(state.state.data);
    };

    const base = await cellsOf();
    const N = 40;
    for (let i = 0; i < N; i += 1) {
      bc.now = CLOCK_BASE + i * 91;
      const attackerOwner = await bc.treasury(`athtomb3-att-${i}`);
      const attacker = await deployWallet(bc, attackerOwner.address, master, 10n);
      await attacker.send(attackerOwner.getSender(), { value: toNano('0.3') }, {
        $$type: 'ATHTransferRequestWithNotify',
        query_id: BigInt(7000 + i),
        amount: 1n,
        recipient: victimOwner.address,
        response_destination: attackerOwner.address,
        notify_destination: victimOwner.address,
        notify_value: toNano('0.05'),
      } as ATHTransferRequestWithNotify);
    }

    const loaded = await cellsOf();
    const perEntry = (loaded - base) / N;
    const ceilingEntries = Math.floor((65536 - loaded) / Math.max(perEntry, 0.01)) + N;
    process.stderr.write(`[ATHTOMB-03] base=${base} after ${N} unsettled=${loaded} per-entry=${perEntry.toFixed(2)} cells`
      + `  => ~${ceilingEntries} entries to the ~65536-cell ceiling
`);

    expect(loaded, 'an unsettled escrow grows the wallet').toBeGreaterThan(base);

    const before = (await victim.getGetWalletData()).balance;
    const dest = await bc.treasury('athtomb3-dest');
    const res = await victim.send(victimOwner.getSender(), { value: toNano('0.2') }, {
      $$type: 'ATHTransferRequest',
      query_id: 424242n,
      amount: 500n,
      recipient: dest.address,
      response_destination: victimOwner.address,
    } as any);
    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals?.(victimAddress));
    expect(tx?.description?.computePhase?.exitCode, 'the owner-initiated spend is admitted').toBe(0);
    expect(tx?.description?.aborted, 'and it does not abort in ACTION behind a green exit code').toBe(false);
    expect((await victim.getGetWalletData()).balance, 'the ATH really left').toBe(before - 500n);
  }, 300_000);
});
