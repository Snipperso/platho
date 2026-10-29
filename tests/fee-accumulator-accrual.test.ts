import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { AirdropTicket } from '../build/AirdropTicket/AirdropTicket_AirdropTicket';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { FEE_SINK } from './helpers/fee-sink-fixture';


const RS_PROTOCOL_FEE = 10_000_000n;
const OP_TICKET_CREDIT = 0x41544331;

const ticketData = (owner: Address) => beginCell().storeUint(0, 1).storeAddress(owner).endCell();
const shardData = (pk: bigint, epoch: bigint) =>
  beginCell().storeUint(0, 1).storeInt(pk, 257).storeInt(epoch, 257).endCell();

async function setup() {
  const bc = await Blockchain.create();
  bc.now = 1_790_000_000;
  const treasury = await bc.treasury('fa-treasury');
  const buyback = await bc.treasury('fa-buyback');
  const pool = await bc.treasury('fa-pool');
  const publisher = await bc.treasury('fa-publisher');

  const init = await FeeAccumulator.init(treasury.address, buyback.address);
  await bc.setShardAccount(FEE_SINK, createShardAccount({
    address: FEE_SINK, code: init.code, data: init.data, balance: toNano('5'), workchain: 0,
  }));
  const fa = bc.openContract(new FeeAccumulator(FEE_SINK, init));

  const shardCode = (await RecordShard.init(1n, 1n)).code;
  const ticketCode = (await AirdropTicket.init(treasury.address)).code;
  const bind = (body: any) => fa.send(treasury.getSender(), { value: toNano('0.1') }, body);
  await bind({ $$type: 'BindShardCode', shard_code: shardCode });
  await bind({ $$type: 'BindTicketCode', ticket_code: ticketCode });
  await bind({ $$type: 'BindAirdropPool', airdrop_pool_address: pool.address });

  return { bc, fa, treasury, pool, publisher, shardCode, ticketCode };
}

function realShard(shardCode: any, pk: bigint, epoch: bigint) {
  return contractAddress(0, { code: shardCode, data: shardData(pk, epoch) });
}

describe('FEE ACCUMULATOR ACCRUAL — a capsule fee becomes a credit, and only a real shard can say so', () => {
  it('FAACC-01: only a real shard address may deposit a capsule fee', async () => {
    const { bc, fa, publisher, shardCode, ticketCode } = await setup();
    const stranger = await bc.treasury('fa-stranger');
    const ticketAddr = contractAddress(0, { code: ticketCode, data: ticketData(publisher.address) });

    const body = {
      $$type: 'DepositCapsuleFee', amount: RS_PROTOCOL_FEE,
      lane: 0n, init_arg0: 0x1234n, init_arg1: 20290n, publisher: publisher.address,
    } as any;

    await fa.send(stranger.getSender(), { value: toNano('0.05') }, body);
    expect((await bc.getContract(ticketAddr)).accountState?.type, 'no ticket may be created by a stranger')
      .not.toBe('active');
    expect((await fa.getGetState()).accumulated_ton, 'and nothing is accounted').toBe(0n);

    const shard = realShard(shardCode, 0x1234n, 20290n);
    await fa.send(bc.sender(shard), { value: toNano('0.05') }, body);
    expect((await fa.getGetState()).accumulated_ton, 'the fee reaches the pool whole').toBe(RS_PROTOCOL_FEE);
    const ticket = bc.openContract(new AirdropTicket(ticketAddr));
    expect((await ticket.getGetTicket()).credits, 'and the publisher gets exactly one credit').toBe(1n);
  });

  it('FAACC-02: a shard cannot mint credits by lying about which shard it is', async () => {
    const { bc, fa, publisher, shardCode } = await setup();
    const shard = realShard(shardCode, 0x1234n, 20290n);

    await fa.send(bc.sender(shard), { value: toNano('0.05') }, {
      $$type: 'DepositCapsuleFee', amount: RS_PROTOCOL_FEE,
      lane: 0n,
      init_arg0: 0x9999n,
      init_arg1: 20290n, publisher: publisher.address,
    } as any);

    expect((await fa.getGetState()).accumulated_ton, 'a mismatched identity must be refused').toBe(0n);
  });

  it('FAACC-03: MEASURE what attaching StateInit to every credit costs', async () => {
    const { bc, fa, publisher, shardCode, ticketCode } = await setup();
    const shard = realShard(shardCode, 0x1234n, 20290n);
    const ticketAddr = contractAddress(0, { code: ticketCode, data: ticketData(publisher.address) });

    const deposit = (n: number) => fa.send(bc.sender(shard), { value: toNano('0.05') }, {
      $$type: 'DepositCapsuleFee', amount: RS_PROTOCOL_FEE,
      lane: 0n, init_arg0: 0x1234n, init_arg1: 20290n, publisher: publisher.address,
    } as any);

    const first = await deposit(1);
    const second = await deposit(2);

    const creditFwd = (r: any) => {
      const tx = findTransaction(r.transactions, { from: FEE_SINK, to: ticketAddr, op: OP_TICKET_CREDIT });
      return tx?.inMessage?.info.type === 'internal' ? tx.inMessage.info.fwdFee : 0n;
    };
    const total = (r: any) => r.transactions.reduce((s: bigint, tx: any) => s + tx.totalFees.coins, 0n);

    // eslint-disable-next-line no-console
    console.log([
      '[FAACC-03] cost of crediting a ticket, StateInit attached every time',
      `  first credit  (ticket created): fwd fee ${creditFwd(first)}   chain fees ${total(first)}`,
      `  second credit (already exists): fwd fee ${creditFwd(second)}   chain fees ${total(second)}`,
      `  redundant-StateInit overhead per capsule: ${total(second)} against the ${RS_PROTOCOL_FEE} fee`,
      `  => ${(Number(total(second)) / Number(RS_PROTOCOL_FEE) * 100).toFixed(2)}% of the fee`,
    ].join('\n'));

    expect((await bc.openContract(new AirdropTicket(ticketAddr)).getGetTicket()).credits, 'both credits landed').toBe(2n);
    expect(total(second), 'crediting must cost well under the fee it accompanies').toBeLessThan(RS_PROTOCOL_FEE / 2n);
  });

  it('FAACC-BACKING: [token-cluster audit CRIT] TicketRedeem must not over-send from the sink balance', async () => {
    const { bc, fa, publisher, ticketCode } = await setup();
    const ticketAddr = contractAddress(0, { code: ticketCode, data: ticketData(publisher.address) });

    const before = (await bc.getContract(FEE_SINK)).balance;
    const inbound = toNano('0.1');
    await fa.send(bc.sender(ticketAddr), { value: inbound }, {
      $$type: 'TicketRedeem', credits_k: 10n, owner: publisher.address,
    } as any);
    const after = (await bc.getContract(FEE_SINK)).balance;

    const drained = before - after;
    expect(drained, `the sink balance fell by ${drained} — it is funding the 60M accrue leg from its own balance`)
      .toBeLessThan(5_000_000n);

    expect(drained, `MEASURED balance delta across one redeem: ${-drained} (positive means the reserve covers it)`)
      .toBeLessThanOrEqual(0n);
  });
});
