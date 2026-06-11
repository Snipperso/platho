import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { createFundingEnvelopeProfileM19H } from '../scripts/buybackburn_funding_envelope_m19h';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  FeeAccumulator,
  DepositProtocolFee,
  EnableBuybackSplit,
  SplitAccumulated,
  FlushTreasuryDue,
  FlushBuybackDue,
} from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

async function setup(options?: { buybackDeployed?: boolean }) {
  const blockchain = await Blockchain.create();
  const capsuleHub = await blockchain.treasury('capsule-hub');
  const attacker = await blockchain.treasury('attacker');
  const operator = await blockchain.treasury('operator');
  const treasury = await blockchain.treasury('treasury-receiver');
  const buyback = options?.buybackDeployed === false
    ? fixtureAddress('UNDEPLOYED_BUYBACK')
    : (await blockchain.treasury('buyback-burn')).address;

  const init = await FeeAccumulator.init(treasury.address, buyback);
  const address = contractAddress(0, init);

  await blockchain.setShardAccount(
    address,
    createShardAccount({
      address,
      code: init.code,
      data: init.data,
      balance: toNano('1'),
      workchain: address.workChain,
    }),
  );

  const fee = blockchain.openContract(new FeeAccumulator(address, init));
  return { blockchain, fee, capsuleHub, attacker, operator, treasury, buyback };
}

async function depositAndSplit(fee: any, capsuleHub: any, amount: bigint) {
  await fee.send(capsuleHub.getSender(), { value: amount + toNano('0.1') }, {
    $$type: 'DepositProtocolFee',
    amount,
  } as DepositProtocolFee);

  await fee.send(capsuleHub.getSender(), { value: toNano('0.05') }, {
    $$type: 'SplitAccumulated',
  } as SplitAccumulated);
}

async function enableBuybackSplit(fee: any, treasury: any) {
  await fee.send(treasury.getSender(), { value: toNano('0.05') }, {
    $$type: 'EnableBuybackSplit',
  } as EnableBuybackSplit);
}

describe('FeeAccumulator v1 milestone', () => {
  it('FEE-01: accepts permissionless protocol fee deposits and credits exact accounted principal only', async () => {
    const { fee, capsuleHub, attacker } = await setup();
    const amount = 101n;

    await fee.send(attacker.getSender(), { value: 100n }, {
      $$type: 'DepositProtocolFee',
      amount,
    } as DepositProtocolFee);
    expect((await fee.getGetState()).accumulated_ton).toBe(0n);

    await fee.send(attacker.getSender(), { value: amount + toNano('0.1') }, {
      $$type: 'DepositProtocolFee',
      amount,
    } as DepositProtocolFee);
    expect((await fee.getGetState()).accumulated_ton).toBe(amount);

    await fee.send(capsuleHub.getSender(), { value: amount + toNano('0.2') }, {
      $$type: 'DepositProtocolFee',
      amount,
    } as DepositProtocolFee);
    expect((await fee.getGetState()).accumulated_ton).toBe(amount * 2n);
  });

  it('FEE-DUE-01: bootstrap split sends all protocol fees to treasury/liquidity before buyback is enabled', async () => {
    const { fee, capsuleHub } = await setup();
    const amount = 101n;

    await depositAndSplit(fee, capsuleHub, amount);

    const state = await fee.getGetState();
    expect(state.accumulated_ton).toBe(0n);
    expect(state.treasury_due_ton).toBe(amount);
    expect(state.buyback_due_ton).toBe(0n);
    expect(state.treasury_due_ton + state.buyback_due_ton).toBe(amount);
    expect(state.buyback_split_enabled).toBe(false);
  });

  it('FEE-DUE-01B: treasury can enable buyback split once; after that dust goes to buyback', async () => {
    const { fee, capsuleHub, attacker, treasury } = await setup();
    const amount = 101n;

    await fee.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'EnableBuybackSplit',
    } as EnableBuybackSplit);
    expect((await fee.getGetState()).buyback_split_enabled).toBe(false);

    await enableBuybackSplit(fee, treasury);
    expect((await fee.getGetState()).buyback_split_enabled).toBe(true);

    await fee.send(treasury.getSender(), { value: toNano('0.05') }, {
      $$type: 'EnableBuybackSplit',
    } as EnableBuybackSplit);
    expect((await fee.getGetState()).buyback_split_enabled).toBe(true);

    await depositAndSplit(fee, capsuleHub, amount);

    const state = await fee.getGetState();
    expect(state.accumulated_ton).toBe(0n);
    expect(state.treasury_due_ton).toBe(50n);
    expect(state.buyback_due_ton).toBe(51n);
    expect(state.treasury_due_ton + state.buyback_due_ton).toBe(amount);
  });

  it('FEE-DUE-01C: enabling buyback split sweeps already accumulated bootstrap fees to treasury', async () => {
    const { fee, capsuleHub, treasury } = await setup();
    const preBootstrapAmount = 101n;
    const postBootstrapAmount = 103n;

    await fee.send(capsuleHub.getSender(), { value: preBootstrapAmount + toNano('0.1') }, {
      $$type: 'DepositProtocolFee',
      amount: preBootstrapAmount,
    } as DepositProtocolFee);
    expect((await fee.getGetState()).accumulated_ton).toBe(preBootstrapAmount);

    await enableBuybackSplit(fee, treasury);

    let state = await fee.getGetState();
    expect(state.buyback_split_enabled).toBe(true);
    expect(state.accumulated_ton).toBe(0n);
    expect(state.treasury_due_ton).toBe(preBootstrapAmount);
    expect(state.buyback_due_ton).toBe(0n);

    await depositAndSplit(fee, capsuleHub, postBootstrapAmount);

    state = await fee.getGetState();
    expect(state.accumulated_ton).toBe(0n);
    expect(state.treasury_due_ton).toBe(preBootstrapAmount + 51n);
    expect(state.buyback_due_ton).toBe(52n);
  });

  it('FEE-DUE-01D: enabling buyback split preserves existing treasury due and sweeps only pending accumulation', async () => {
    const { fee, capsuleHub, treasury } = await setup();
    const alreadySplitBootstrapAmount = 101n;
    const unsplitBootstrapAmount = 103n;

    await depositAndSplit(fee, capsuleHub, alreadySplitBootstrapAmount);
    await fee.send(capsuleHub.getSender(), { value: unsplitBootstrapAmount + toNano('0.1') }, {
      $$type: 'DepositProtocolFee',
      amount: unsplitBootstrapAmount,
    } as DepositProtocolFee);

    let state = await fee.getGetState();
    expect(state.accumulated_ton).toBe(unsplitBootstrapAmount);
    expect(state.treasury_due_ton).toBe(alreadySplitBootstrapAmount);
    expect(state.buyback_due_ton).toBe(0n);

    await enableBuybackSplit(fee, treasury);

    state = await fee.getGetState();
    expect(state.buyback_split_enabled).toBe(true);
    expect(state.accumulated_ton).toBe(0n);
    expect(state.treasury_due_ton).toBe(alreadySplitBootstrapAmount + unsplitBootstrapAmount);
    expect(state.buyback_due_ton).toBe(0n);
  });

  it('FEE-DUE-05: treasury flush uses immutable terminal receiver and debits treasury_due_ton only by requested amount', async () => {
    const { fee, capsuleHub, operator, treasury } = await setup();
    const amount = toNano('1');

    await depositAndSplit(fee, capsuleHub, amount);
    const beforeTreasuryBalance = (await treasury.getBalance());
    const treasuryDue = amount;

    await fee.send(operator.getSender(), { value: toNano('0.1') }, {
      $$type: 'FlushTreasuryDue',
      amount: treasuryDue,
    } as FlushTreasuryDue);

    const state = await fee.getGetState();
    const afterTreasuryBalance = (await treasury.getBalance());
    expect(state.treasury_due_ton).toBe(0n);
    expect(state.buyback_due_ton).toBe(0n);
    expect(afterTreasuryBalance).toBeGreaterThan(beforeTreasuryBalance);
  });

  it('FEE-DUE-06: M19H buyback flush bounce restores the complete 51.05 TON envelope', async () => {
    const { fee, capsuleHub, operator, treasury } = await setup({ buybackDeployed: false });
    const oneEnvelope = BigInt(createFundingEnvelopeProfileM19H().values.feeAccumulatorFlushAmountNanotons);

    await enableBuybackSplit(fee, treasury);
    await depositAndSplit(fee, capsuleHub, oneEnvelope * 2n);
    expect((await fee.getGetState()).buyback_due_ton).toBe(oneEnvelope);

    await fee.send(operator.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushBuybackDue',
      amount: oneEnvelope,
    } as FlushBuybackDue);

    const state = await fee.getGetState();
    expect(state.buyback_due_ton).toBe(oneEnvelope);
  });

  it('FEE-DUE-07: M19H buyback flush to deployed receiver debits exactly one complete 51.05 TON envelope', async () => {
    const { fee, capsuleHub, operator, treasury } = await setup({ buybackDeployed: true });
    const oneEnvelope = BigInt(createFundingEnvelopeProfileM19H().values.feeAccumulatorFlushAmountNanotons);

    await enableBuybackSplit(fee, treasury);
    await depositAndSplit(fee, capsuleHub, oneEnvelope * 2n);
    expect((await fee.getGetState()).buyback_due_ton).toBe(oneEnvelope);

    await fee.send(operator.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushBuybackDue',
      amount: oneEnvelope,
    } as FlushBuybackDue);

    const state = await fee.getGetState();
    expect(state.buyback_due_ton).toBe(0n);
  });

  it('FEE-DUE-08/M19H: raw 50 TON buyback offer principal is rejected as an incomplete funding envelope', async () => {
    const { fee, capsuleHub, operator, treasury } = await setup({ buybackDeployed: true });
    const oneEnvelope = BigInt(createFundingEnvelopeProfileM19H().values.feeAccumulatorFlushAmountNanotons);

    await enableBuybackSplit(fee, treasury);
    await depositAndSplit(fee, capsuleHub, oneEnvelope * 2n);
    expect((await fee.getGetState()).buyback_due_ton).toBe(oneEnvelope);

    await fee.send(operator.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushBuybackDue',
      amount: toNano('50'),
    } as FlushBuybackDue);

    const state = await fee.getGetState();
    expect(state.buyback_due_ton).toBe(oneEnvelope);
  });

  it('RT-FEE-001: sub-envelope buyback tail stays queued until future fees complete one envelope', async () => {
    const { fee, capsuleHub, operator, treasury } = await setup({ buybackDeployed: true });
    const oneEnvelope = BigInt(createFundingEnvelopeProfileM19H().values.feeAccumulatorFlushAmountNanotons);
    const tail = toNano('20');

    await enableBuybackSplit(fee, treasury);
    await depositAndSplit(fee, capsuleHub, tail * 2n);
    expect((await fee.getGetState()).buyback_due_ton).toBe(tail);

    await fee.send(operator.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushBuybackDue',
      amount: tail,
    } as FlushBuybackDue);
    expect((await fee.getGetState()).buyback_due_ton).toBe(tail);

    await depositAndSplit(fee, capsuleHub, (oneEnvelope - tail) * 2n);
    expect((await fee.getGetState()).buyback_due_ton).toBe(oneEnvelope);

    await fee.send(operator.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushBuybackDue',
      amount: oneEnvelope,
    } as FlushBuybackDue);
    expect((await fee.getGetState()).buyback_due_ton).toBe(0n);
  });

  it('NO-ADMIN: empty fallback is rejected and cannot mutate accounting', async () => {
    const { fee, attacker } = await setup();

    await fee.send(attacker.getSender(), { value: toNano('0.1') }, null);

    const state = await fee.getGetState();
    expect(state.accumulated_ton).toBe(0n);
    expect(state.treasury_due_ton).toBe(0n);
    expect(state.buyback_due_ton).toBe(0n);
  });
});
