import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { readFileSync } from 'node:fs';
import { ATHWallet, ATHTransferRequestWithNotify, AthTransferNotificationAck } from '../build/ATHWallet/ATHWallet_ATHWallet';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// ATHWALLET GROWTH — the ceiling that used to cap usernames and profiles, and the guard that it stays gone.
//
// A .ath name and a paid avatar are bought with ATH, and every purchase lands on the registry's ONE official ATH
// wallet. That wallet used to write a PERMANENT replay tombstone per purchase (`processed_notifications`, with zero
// .del anywhere), so it grew ~3 cells per sale and hit the ~65536-cell account ceiling at ~21,845 sales — for the
// whole product, forever, against a million-user target. The refusal at that wall is SILENT: compute reports exit 0
// and the write fails in ACTION with code 50, so the wallet reports a successful transaction.
//
// A jetton wallet is a singleton by TEP-74 — one per (owner, master) — so this could NOT be fixed by the sharding
// that solves the registries' own ceilings. The tombstone was removed instead on 2026-07-19; ATHWallet.tact's state
// declaration carries the full argument for why it never protected the balance.
//
// THESE TESTS ARE THE GUARD THAT IT STAYS REMOVED. If anyone reintroduces a per-notification permanent map, the
// growth measurement below goes red, rather than the ceiling being rediscovered in production years later.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const SRC = readFileSync('contracts/ATHWallet.tact', 'utf8');
const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 0x41544e49n;               // "ATNI"
const ATH_SENDER_KEY_MOD = 1461501637330902918203684832716283019655932542976n;   // 2^160

/** Mirrors ATHWallet.compute_sender_key so the ack can name the pending entry the transfer created. */
function senderKey(senderOwner: Address, queryId: bigint): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(ATH_TRANSFER_NOTIFY_ID_DOMAIN, 32)
    .storeUint(queryId, 64)
    .storeAddress(senderOwner)
    .endCell()
    .hash()
    .toString('hex')) % ATH_SENDER_KEY_MOD;
}

const fixtureAddress = (label: string) =>
  new Address(0, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());

/** Unique cells in the account's data tree — what the account-state ceiling actually counts. */
function countCells(root: any): number {
  const seen = new Set<string>();
  const walk = (c: any) => {
    const h = c.hash().toString('hex');
    if (seen.has(h)) return;          // storage deduplicates identical cells, so the counter must too
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
    // Blunt and structural: the field itself must not exist. A reintroduction under another name would still be
    // caught by the measurement below, but this fails faster and names what happened.
    expect(/processed_notifications\s*:/.test(SRC), 'the tombstone map must not be declared').toBe(false);
    expect(/processed_notifications\s*\.\s*set/.test(SRC), 'and nothing may write one').toBe(false);
    // Removing the tombstone must NOT have taken its neighbour with it. 14315/14565/14665 close the one reachable
    // double-processing window — a duplicate arriving while the first is still pending — and they are what actually
    // protects the balance. The gate-drop-on-rewrite trap has been caught three times in this project.
    expect(/throwUnless\(14315,\s*!self\.pending_notifications\.exists/.test(SRC), 'plain lane in-flight guard').toBe(true);
    expect(/throwUnless\(14565,\s*!self\.pending_notifications\.exists/.test(SRC), 'username lane in-flight guard').toBe(true);
    expect(/throwUnless\(14665,\s*!self\.pending_notifications\.exists/.test(SRC), 'profile lane in-flight guard').toBe(true);
  });

  it('ATHTOMB-02: the receiving wallet does not grow across many settled purchases', async () => {
    // THE MEASUREMENT, on the real transfer path. Each iteration is a distinct sale from a distinct buyer, settled
    // end to end (transfer -> notification -> owner ack) — exactly what a registry's official wallet sees. Before
    // this change the wallet grew ~3 cells per sale, forever. It must now return to the same size after each
    // settlement, so a million sales cost the same state as one.
    const bc = await Blockchain.create();
    const master = fixtureAddress('ATHTOMB_MASTER');
    const registryOwner = await bc.treasury('athtomb-registry-owner');
    const recipientInit = await ATHWallet.init(0n, registryOwner.address, master);
    const recipientAddress = contractAddress(0, recipientInit);
    const recipient = bc.openContract(new ATHWallet(recipientAddress, recipientInit));

    const cellsAfter: number[] = [];
    const SALES = 25;
    for (let i = 0; i < SALES; i += 1) {
      // Advance the clock every iteration so no two pending entries are byte-identical: identical cells deduplicate
      // in storage and would understate growth. That trap produced a 4.5x understatement elsewhere in this repo.
      bc.now = 1_790_000_000 + i * 91;
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

      // The owner (the registry) acks — this is the step that used to mint the permanent tombstone.
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

    // The balance really moved, so the sales were real and not silently refused.
    expect((await recipient.getGetWalletData()).balance, 'every sale credited the official wallet').toBe(BigInt(10 * SALES));
    expect(marginal, 'a settled sale must leave NO permanent residue on the official wallet').toBe(0);
    expect(cellsAfter[SALES - 1], 'the wallet is the same size as after the first sale').toBe(cellsAfter[0]);
  }, 600_000);
});
