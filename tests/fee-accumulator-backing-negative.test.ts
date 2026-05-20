import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { findTransaction } from '@ton/test-utils';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  FeeAccumulator,
  DepositProtocolFee,
  SplitAccumulated,
  FlushTreasuryDue,
  FlushBuybackDue,
} from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { createFundingEnvelopeProfileM19H } from '../scripts/buybackburn_funding_envelope_m19h';

const DEPOSIT_EXEC_RESERVE = 2_000_000n;
const SPLIT_EXEC_RESERVE = 2_000_000n;
const FLUSH_EXEC_RESERVE = 5_000_000n;
const MIN_TREASURY_FLUSH_TON = FLUSH_EXEC_RESERVE;
const BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE = 2_000_000n;
const OP_ACCEPT_BURN_RESERVE = 0x594BA505;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.FEE.BND.${label}`).digest());
}

async function setup(options?: { buybackDeployed?: boolean; initialBalance?: bigint }) {
  const blockchain = await Blockchain.create();
  const donor = await blockchain.treasury('fee-bnd-donor');
  const operator = await blockchain.treasury('fee-bnd-operator');
  const treasury = await blockchain.treasury('fee-bnd-treasury');
  const buyback = options?.buybackDeployed === false
    ? fixtureAddress('UNDEPLOYED_BUYBACK')
    : (await blockchain.treasury('fee-bnd-buyback')).address;

  const init = await FeeAccumulator.init(treasury.address, buyback);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: options?.initialBalance ?? 0n,
    workchain: address.workChain,
  }));

  return {
    blockchain,
    fee: blockchain.openContract(new FeeAccumulator(address, init)),
    donor,
    operator,
    treasury,
    buyback,
  };
}

async function contractBalance(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

function inboundValue(tx: any): bigint {
  const info = tx?.inMessage?.info;
  if (info?.type !== 'internal') throw new Error('missing inbound internal value');
  return info.value.coins;
}

async function depositAndSplit(fee: any, donor: any, amount: bigint) {
  await fee.send(donor.getSender(), { value: amount + DEPOSIT_EXEC_RESERVE }, {
    $$type: 'DepositProtocolFee',
    amount,
  } as DepositProtocolFee);
  await fee.send(donor.getSender(), { value: SPLIT_EXEC_RESERVE }, {
    $$type: 'SplitAccumulated',
  } as SplitAccumulated);
}

describe('FeeAccumulator backing and caller-funded execution boundaries', () => {
  it('FEE-BACKING-01: deposits require separate execution reserve and preserve principal backing', async () => {
    const { blockchain, fee, donor } = await setup();
    const amount = toNano('1');

    await fee.send(donor.getSender(), { value: amount + DEPOSIT_EXEC_RESERVE - 1n }, {
      $$type: 'DepositProtocolFee',
      amount,
    } as DepositProtocolFee);
    expect((await fee.getGetState()).accumulated_ton).toBe(0n);

    await fee.send(donor.getSender(), { value: amount + DEPOSIT_EXEC_RESERVE }, {
      $$type: 'DepositProtocolFee',
      amount,
    } as DepositProtocolFee);

    const state = await fee.getGetState();
    expect(state.accumulated_ton).toBe(amount);
    expect(await contractBalance(blockchain, fee.address)).toBeGreaterThanOrEqual(state.accumulated_ton);
  });

  it('FEE-BACKING-02: split and treasury flush require caller-funded execution reserve', async () => {
    const { blockchain, fee, donor, operator, treasury } = await setup();
    const amount = toNano('2');

    await fee.send(donor.getSender(), { value: amount + DEPOSIT_EXEC_RESERVE }, {
      $$type: 'DepositProtocolFee',
      amount,
    } as DepositProtocolFee);

    await fee.send(donor.getSender(), { value: SPLIT_EXEC_RESERVE - 1n }, {
      $$type: 'SplitAccumulated',
    } as SplitAccumulated);
    expect((await fee.getGetState()).accumulated_ton).toBe(amount);

    await fee.send(donor.getSender(), { value: SPLIT_EXEC_RESERVE }, {
      $$type: 'SplitAccumulated',
    } as SplitAccumulated);
    const treasuryDue = (await fee.getGetState()).treasury_due_ton;

    const underfundedTreasuryFlush = await fee.send(operator.getSender(), { value: FLUSH_EXEC_RESERVE - 1n }, {
      $$type: 'FlushTreasuryDue',
      amount: treasuryDue,
    } as FlushTreasuryDue);
    expect(findTransaction(underfundedTreasuryFlush.transactions, {
      from: fee.address,
      to: treasury.address,
      success: true,
    })).toBeUndefined();
    expect((await fee.getGetState()).treasury_due_ton).toBe(treasuryDue);

    const beforeBalance = await contractBalance(blockchain, fee.address);
    const exactTreasuryFlush = await fee.send(operator.getSender(), { value: FLUSH_EXEC_RESERVE }, {
      $$type: 'FlushTreasuryDue',
      amount: treasuryDue,
    } as FlushTreasuryDue);
    const treasuryFlushTx = findTransaction(exactTreasuryFlush.transactions, {
      from: fee.address,
      to: treasury.address,
      success: true,
    });
    expect(treasuryFlushTx).toBeDefined();
    expect(inboundValue(treasuryFlushTx)).toBe(treasuryDue);
    const afterBalance = await contractBalance(blockchain, fee.address);
    expect((await fee.getGetState()).treasury_due_ton).toBe(0n);
    expect(beforeBalance - afterBalance).toBeLessThanOrEqual(treasuryDue);
  });

  it('FEE-BACKING-02B: treasury flush rejects dust partial fragments but permits final dust flush', async () => {
    const { fee, donor, operator, treasury } = await setup();
    await depositAndSplit(fee, donor, MIN_TREASURY_FLUSH_TON * 4n);

    const startingTreasuryDue = (await fee.getGetState()).treasury_due_ton;
    expect(startingTreasuryDue).toBe(MIN_TREASURY_FLUSH_TON * 2n);

    const partialDust = 10_000n;
    const rejectedDust = await fee.send(operator.getSender(), { value: FLUSH_EXEC_RESERVE }, {
      $$type: 'FlushTreasuryDue',
      amount: partialDust,
    } as FlushTreasuryDue);
    expect(findTransaction(rejectedDust.transactions, {
      from: fee.address,
      to: treasury.address,
      success: true,
    })).toBeUndefined();
    expect((await fee.getGetState()).treasury_due_ton).toBe(startingTreasuryDue);

    const acceptedPartial = await fee.send(operator.getSender(), { value: FLUSH_EXEC_RESERVE }, {
      $$type: 'FlushTreasuryDue',
      amount: MIN_TREASURY_FLUSH_TON,
    } as FlushTreasuryDue);
    expect(findTransaction(acceptedPartial.transactions, {
      from: fee.address,
      to: treasury.address,
      success: true,
    })).toBeDefined();
    expect((await fee.getGetState()).treasury_due_ton).toBe(MIN_TREASURY_FLUSH_TON);

    const finalDust = 10_000n;
    const second = await setup();
    await depositAndSplit(second.fee, second.donor, finalDust * 2n);
    expect((await second.fee.getGetState()).treasury_due_ton).toBe(finalDust);

    const acceptedFinalDust = await second.fee.send(second.operator.getSender(), { value: FLUSH_EXEC_RESERVE }, {
      $$type: 'FlushTreasuryDue',
      amount: finalDust,
    } as FlushTreasuryDue);
    const finalDustTx = findTransaction(acceptedFinalDust.transactions, {
      from: second.fee.address,
      to: second.treasury.address,
    });
    expect(finalDustTx).toBeDefined();
    expect(inboundValue(finalDustTx)).toBe(finalDust);
    expect((await second.fee.getGetState()).treasury_due_ton).toBe(0n);
  });

  it('FEE-BACKING-03: buyback flush requires caller-funded reserve before sending the envelope', async () => {
    const { fee, donor, operator, buyback } = await setup({ buybackDeployed: false });
    const oneEnvelope = BigInt(createFundingEnvelopeProfileM19H().values.feeAccumulatorFlushAmountNanotons);

    await depositAndSplit(fee, donor, oneEnvelope * 2n);
    expect((await fee.getGetState()).buyback_due_ton).toBe(oneEnvelope);

    const underfundedBuybackFlush = await fee.send(operator.getSender(), { value: FLUSH_EXEC_RESERVE + BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE - 1n }, {
      $$type: 'FlushBuybackDue',
      amount: oneEnvelope,
    } as FlushBuybackDue);
    expect(findTransaction(underfundedBuybackFlush.transactions, {
      from: fee.address,
      to: buyback,
      op: OP_ACCEPT_BURN_RESERVE,
    })).toBeUndefined();
    expect((await fee.getGetState()).buyback_due_ton).toBe(oneEnvelope);

    const exactBuybackFlush = await fee.send(operator.getSender(), { value: FLUSH_EXEC_RESERVE + BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE }, {
      $$type: 'FlushBuybackDue',
      amount: oneEnvelope,
    } as FlushBuybackDue);
    const sentEnvelope = findTransaction(exactBuybackFlush.transactions, {
      from: fee.address,
      to: buyback,
      op: OP_ACCEPT_BURN_RESERVE,
    });
    expect(sentEnvelope).toBeDefined();
    expect(inboundValue(sentEnvelope)).toBe(oneEnvelope + BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE);
    expect((await fee.getGetState()).buyback_due_ton).toBe(oneEnvelope);
  });
});
