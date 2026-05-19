import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  DepositProtocolFee,
  FeeAccumulator,
  FlushBuybackDue,
  SplitAccumulated,
} from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { createScaledBuybackBurnHarnessM20T } from '../scripts/m20t_scaled_buybackburn_harness';

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.M20T.SCALED.${label}`).digest());
}

async function setupFeeAccumulator(buybackAddress: Address) {
  const blockchain = await Blockchain.create();
  const capsuleHub = await blockchain.treasury('m20t-scaled-capsule-hub');
  const operator = await blockchain.treasury('m20t-scaled-operator');
  const treasury = await blockchain.treasury('m20t-scaled-treasury');
  const init = await FeeAccumulator.init(treasury.address, buybackAddress);
  const address = contractAddress(0, init);

  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('2'),
    workchain: address.workChain,
  }));

  return {
    fee: blockchain.openContract(new FeeAccumulator(address, init)),
    capsuleHub,
    operator,
  };
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

describe('M20T scaled BuybackBurn harness profile', () => {
  it('M20T-SCALED-01: pins 0.5105 TON as a 1/100 scaled harness envelope only', () => {
    const profile = createScaledBuybackBurnHarnessM20T();

    expect(profile.status).toBe('SCALED_HARNESS_ONLY_NOT_PRODUCTION_ENVELOPE');
    expect(profile.notMainnetRouteFreeze).toBe(true);
    expect(profile.notProductionBuybackBurnUnlock).toBe(true);
    expect(profile.values.scaledOfferAmountNanotons).toBe(toNano('0.5').toString());
    expect(profile.values.scaledRouteForwardGasNanotons).toBe(toNano('0.01').toString());
    expect(profile.values.scaledPtonTransferGasNanotons).toBe(toNano('0.0005').toString());
    expect(profile.values.scaledTotalFundingEnvelopeNanotons).toBe(toNano('0.5105').toString());
    expect(profile.values.productionTotalFundingEnvelopeNanotons).toBe(toNano('51.05').toString());
    expect(Object.values(profile.invariants).every(Boolean)).toBe(true);
  });

  it('M20T-SCALED-02: production FeeAccumulator still rejects 0.5105 TON buyback flush', async () => {
    const buyback = fixtureAddress('UNDEPLOYED_BUYBACK');
    const { fee, capsuleHub, operator } = await setupFeeAccumulator(buyback);
    const profile = createScaledBuybackBurnHarnessM20T();
    const scaledEnvelope = BigInt(profile.values.scaledTotalFundingEnvelopeNanotons);

    await depositAndSplit(fee, capsuleHub, scaledEnvelope * 2n);
    expect((await fee.getGetState()).buyback_due_ton).toBe(scaledEnvelope);

    await fee.send(operator.getSender(), { value: toNano('0.05') }, {
      $$type: 'FlushBuybackDue',
      amount: scaledEnvelope,
    } as FlushBuybackDue);

    expect((await fee.getGetState()).buyback_due_ton).toBe(scaledEnvelope);
  });
});
