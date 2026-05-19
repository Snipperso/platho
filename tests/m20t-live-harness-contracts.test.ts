import { describe, expect, it } from 'vitest';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { contractAddress, toNano } from '@ton/core';
import { M20TBuybackBurnHarness } from '../build/M20TBuybackBurnHarness/M20TBuybackBurnHarness_M20TBuybackBurnHarness';
import {
  M20TFeeAccumulatorHarness,
  FlushBuybackDue,
  M20TForwardWrongAcceptBurnReserve,
} from '../build/M20TFeeAccumulatorHarness/M20TFeeAccumulatorHarness_M20TFeeAccumulatorHarness';

const ENVELOPE = toNano('51.05');

async function setup() {
  const blockchain = await Blockchain.create();
  const controller = await blockchain.treasury('m20t-controller');
  const attacker = await blockchain.treasury('m20t-attacker');
  const runId = 20n;

  const buybackInit = await M20TBuybackBurnHarness.init(controller.address, runId);
  const buybackAddress = contractAddress(0, buybackInit);

  const feeInit = await M20TFeeAccumulatorHarness.init(controller.address, buybackAddress, ENVELOPE, runId);
  const feeAddress = contractAddress(0, feeInit);

  await blockchain.setShardAccount(buybackAddress, createShardAccount({
    address: buybackAddress,
    code: buybackInit.code,
    data: buybackInit.data,
    balance: toNano('0.1'),
    workchain: buybackAddress.workChain,
  }));

  await blockchain.setShardAccount(feeAddress, createShardAccount({
    address: feeAddress,
    code: feeInit.code,
    data: feeInit.data,
    balance: ENVELOPE + toNano('0.1'),
    workchain: feeAddress.workChain,
  }));

  const buyback = blockchain.openContract(new M20TBuybackBurnHarness(buybackAddress, buybackInit));
  const fee = blockchain.openContract(new M20TFeeAccumulatorHarness(feeAddress, feeInit));

  await buyback.send(controller.getSender(), { value: toNano('0.02') }, {
    $$type: 'M20TBindFeeAccumulator',
    fee_accumulator_address: feeAddress,
  });

  return { blockchain, buyback, fee, controller, attacker };
}

describe('M20T live testnet harness contracts', () => {
  it('M20T-LIVE-HARNESS-01: accepts exactly one 51.05 TON envelope from the bound fee path', async () => {
    const { buyback, fee, controller } = await setup();

    await fee.send(controller.getSender(), { value: toNano('0.02') }, {
      $$type: 'FlushBuybackDue',
      amount: toNano('50'),
    } as FlushBuybackDue);
    expect((await fee.getGetState()).buyback_due_ton).toBe(ENVELOPE);
    expect((await buyback.getGetState()).accepted_count).toBe(0n);

    await fee.send(controller.getSender(), { value: toNano('0.02') }, {
      $$type: 'FlushBuybackDue',
      amount: ENVELOPE,
    } as FlushBuybackDue);

    const feeState = await fee.getGetState();
    const buybackState = await buyback.getGetState();
    expect(feeState.buyback_due_ton).toBe(0n);
    expect(feeState.flush_count).toBe(1n);
    expect(buybackState.accepted_count).toBe(1n);
    expect(buybackState.total_accepted).toBe(ENVELOPE);
    expect(buybackState.last_amount).toBe(ENVELOPE);
  });

  it('M20T-LIVE-HARNESS-02: rejects wrong sender, wrong amount, and duplicate replay', async () => {
    const { buyback, fee, controller, attacker } = await setup();

    await buyback.send(attacker.getSender(), { value: toNano('0.02') }, {
      $$type: 'AcceptBurnReserve',
      amount: ENVELOPE,
    });
    expect((await buyback.getGetState()).accepted_count).toBe(0n);

    await fee.send(controller.getSender(), { value: toNano('0.04') }, {
      $$type: 'M20TForwardWrongAcceptBurnReserve',
      amount: toNano('50'),
      forward_value: toNano('0.02'),
    } as M20TForwardWrongAcceptBurnReserve);
    expect((await buyback.getGetState()).accepted_count).toBe(0n);

    await fee.send(controller.getSender(), { value: toNano('0.02') }, {
      $$type: 'FlushBuybackDue',
      amount: ENVELOPE,
    } as FlushBuybackDue);
    expect((await buyback.getGetState()).accepted_count).toBe(1n);

    await fee.send(controller.getSender(), { value: toNano('0.02') }, {
      $$type: 'FlushBuybackDue',
      amount: ENVELOPE,
    } as FlushBuybackDue);
    expect((await buyback.getGetState()).accepted_count).toBe(1n);
    expect((await fee.getGetState()).buyback_due_ton).toBe(0n);
  });
});
