import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  FeeAccumulator,
  DepositProtocolFee,
  EnableBuybackSplit,
  SplitAccumulated,
  FlushBuybackDue,
} from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { createFundingEnvelopeProfileM19H } from '../scripts/buybackburn_funding_envelope_m19h';

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

async function setupFeeAccumulator(buybackAddress: Address) {
  const blockchain = await Blockchain.create();
  const capsuleHub = await blockchain.treasury('capsule-hub');
  const operator = await blockchain.treasury('operator');
  const treasury = await blockchain.treasury('treasury-receiver');

  const init = await FeeAccumulator.init(treasury.address, buybackAddress);
  const address = contractAddress(0, init);

  await blockchain.setShardAccount(
    address,
    createShardAccount({
      address,
      code: init.code,
      data: init.data,
      balance: toNano('2'),
      workchain: address.workChain,
    }),
  );

  const fee = blockchain.openContract(new FeeAccumulator(address, init));
  return { blockchain, fee, capsuleHub, operator, treasury };
}

async function depositAndSplit(fee: any, capsuleHub: any, amount: bigint) {
  await fee.send(capsuleHub.getSender(), { value: amount + toNano('0.2') }, {
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

describe('M19H BuybackBurn funding envelope profile', () => {
  it('M19H-01: one buyback funding envelope is 51.05 TON total while preserving exactly 50 TON offer principal', () => {
    const profile = createFundingEnvelopeProfileM19H();

    expect(profile.values.buybackOfferAmountNanotons).toBe(toNano('50').toString());
    expect(profile.values.buybackRouteForwardGasNanotons).toBe(toNano('1').toString());
    expect(profile.values.buybackPtonTransferGasNanotons).toBe(toNano('0.05').toString());
    expect(profile.values.buybackRouteGasTotalNanotons).toBe(toNano('1.05').toString());
    expect(profile.values.feeAccumulatorFlushAmountNanotons).toBe(toNano('51.05').toString());
    expect(profile.invariants.totalFundingEqualsOfferPlusRouteGas).toBe(true);
    expect(profile.invariants.routeGasIsNotAthPurchasePrincipal).toBe(true);
  });

  it('M19H-02: 100 TON accumulated protocol fees split to only 50 TON buyback due, which is insufficient for one conservative envelope', async () => {
    const buyback = fixtureAddress('UNDEPLOYED_BUYBACK_M19H');
    const { fee, capsuleHub, operator, treasury } = await setupFeeAccumulator(buyback);
    const profile = createFundingEnvelopeProfileM19H();
    const oneEnvelope = BigInt(profile.values.feeAccumulatorFlushAmountNanotons);

    await enableBuybackSplit(fee, treasury);
    await depositAndSplit(fee, capsuleHub, toNano('100'));
    expect((await fee.getGetState()).buyback_due_ton).toBe(toNano('50'));

    await fee.send(operator.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushBuybackDue',
      amount: oneEnvelope,
    } as FlushBuybackDue);

    expect((await fee.getGetState()).buyback_due_ton).toBe(toNano('50'));
  });

  it('M19H-03: 102.10 TON accumulated protocol fees produce exactly one 51.05 TON buyback funding envelope and bounce restores it', async () => {
    const buyback = fixtureAddress('UNDEPLOYED_BUYBACK_M19H');
    const { fee, capsuleHub, operator, treasury } = await setupFeeAccumulator(buyback);
    const profile = createFundingEnvelopeProfileM19H();
    const oneEnvelope = BigInt(profile.values.feeAccumulatorFlushAmountNanotons);

    await enableBuybackSplit(fee, treasury);
    await depositAndSplit(fee, capsuleHub, toNano('102.10'));
    expect((await fee.getGetState()).buyback_due_ton).toBe(oneEnvelope);

    await fee.send(operator.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushBuybackDue',
      amount: oneEnvelope,
    } as FlushBuybackDue);

    // The sink is undeployed, so FeeAccumulator bounce recovery restores the full funding envelope.
    expect((await fee.getGetState()).buyback_due_ton).toBe(oneEnvelope);
  });

  it('M19H-04: FeeAccumulator contract pins the same 51.05 TON buyback funding envelope constant as the profile', () => {
    const contractSource = readFileSync(join(process.cwd(), 'contracts/FeeAccumulator.tact'), 'utf8');
    const profile = createFundingEnvelopeProfileM19H();

    expect(contractSource).toContain(`const BUYBACK_FUNDING_ENVELOPE_NANOTONS: Int = ${profile.values.feeAccumulatorFlushAmountNanotons};`);
    expect(profile.values.feeAccumulatorFlushAmountNanotons).toBe(toNano('51.05').toString());
  });

  it('M19H-05: FeeAccumulator rejects 50 TON offer principal even when buyback_due_ton can fund a full envelope', async () => {
    const buyback = fixtureAddress('BUYBACK_M19H_RAW_50_REJECTED');
    const { fee, capsuleHub, operator, treasury } = await setupFeeAccumulator(buyback);
    const profile = createFundingEnvelopeProfileM19H();
    const oneEnvelope = BigInt(profile.values.feeAccumulatorFlushAmountNanotons);

    await enableBuybackSplit(fee, treasury);
    await depositAndSplit(fee, capsuleHub, oneEnvelope * 2n);
    expect((await fee.getGetState()).buyback_due_ton).toBe(oneEnvelope);

    await fee.send(operator.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushBuybackDue',
      amount: toNano('50'),
    } as FlushBuybackDue);

    expect((await fee.getGetState()).buyback_due_ton).toBe(oneEnvelope);
  });

});
