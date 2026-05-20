import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import {
  BuybackBurn,
  AcceptBurnReserve,
  BindBuybackFeeAccumulator,
  BindBuybackOfficialAthWallet,
  ExecuteBuybackChunk,
  FreezeBuybackRoute,
  RecycleRouteRefundReserve,
  RecoverStonfiRouteRefund,
  RetryAthBurnDue,
  SealBuybackBurnGenesis,
} from '../build/BuybackBurn/BuybackBurn_BuybackBurn';
import {
  DepositProtocolFee,
  FeeAccumulator,
  FlushBuybackDue,
  SplitAccumulated,
} from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import {
  ATHWallet,
  ATHTransferRequestWithNotify,
} from '../build/ATHWallet/ATHWallet_ATHWallet';
import {
  addressRaw,
  decodePtonTonTransferBodyV21,
  decodeStonfiSwapBodyV21,
} from '../scripts/stonfi_v2_1_route_lib';

const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const ROUTE_EVIDENCE_HASH = 0x111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000n;
const ENVELOPE = toNano('51.05');
const ACCEPT_RESERVE_EXEC_RESERVE = 2_000_000n;
const ROUTE_REFUND_EXEC_RESERVE = 2_000_000n;
const OFFER = toNano('50');
const PHASE_IDLE = 0n;
const PHASE_PENDING_STONFI_SWAP = 1n;
const ATH_TOTAL_SUPPLY_ATOMIC = 100000000000000000n;
const BUYBACK_ROUTE_NOTIFY_MIN_VALUE = 35_000_000n;
const OP_PTON_TON_TRANSFER = 0x01f3835d;
const UINT64_MAX = 18446744073709551615n;

function routeRefundCredit(value: bigint): bigint {
  return value > ROUTE_REFUND_EXEC_RESERVE ? value - ROUTE_REFUND_EXEC_RESERVE : 0n;
}

function addressHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.BUYBACK.${label}`).digest());
}

async function athWalletAddress(owner: Address, athMaster: Address): Promise<Address> {
  const init = await ATHWallet.init(0n, owner, athMaster);
  return contractAddress(owner.workChain, init);
}

async function deployAthWallet(
  blockchain: Blockchain,
  owner: Address,
  athMaster: Address,
  athBalance: bigint,
  tonBalance = toNano('2'),
) {
  const zeroInit = await ATHWallet.init(0n, owner, athMaster);
  const dataInit = await ATHWallet.init(athBalance, owner, athMaster);
  const address = contractAddress(owner.workChain, zeroInit);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: zeroInit.code,
    data: dataInit.data,
    balance: tonBalance,
    workchain: address.workChain,
  }));
  return blockchain.openContract(new ATHWallet(address, zeroInit));
}

async function deployFeeAccumulator(
  blockchain: Blockchain,
  treasuryReceiver: Address,
  buybackBurn: Address,
) {
  const init = await FeeAccumulator.init(treasuryReceiver, buybackBurn);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('2'),
    workchain: address.workChain,
  }));
  return blockchain.openContract(new FeeAccumulator(address, init));
}

async function setup(options: { deployAthMaster?: boolean } = {}) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const controller = await blockchain.treasury('buyback-controller');
  const feeAccumulator = await blockchain.treasury('buyback-fee-accumulator');
  const operator = await blockchain.treasury('buyback-operator');
  const attacker = await blockchain.treasury('buyback-attacker');
  const treasuryOwner = await blockchain.treasury('buyback-ath-treasury-owner');
  const stonfiRouter = await blockchain.treasury('buyback-stonfi-router');
  const stonfiPoolOwner = await blockchain.treasury('buyback-stonfi-pool-owner');
  const stonfiPtonWallet = await blockchain.treasury('buyback-stonfi-pton-wallet');
  const stonfiReferral = await blockchain.treasury('buyback-stonfi-referral');

  const athMasterInit = await ATHMaster.init(
    treasuryOwner.address,
    beginCell().storeBuffer(Buffer.from('ATH')).endCell(),
  );
  const athMasterAddress = contractAddress(0, athMasterInit);
  if (options.deployAthMaster !== false) {
    await blockchain.setShardAccount(athMasterAddress, createShardAccount({
      address: athMasterAddress,
      code: athMasterInit.code,
      data: athMasterInit.data,
      balance: toNano('2'),
      workchain: athMasterAddress.workChain,
    }));
  }
  const athMaster = blockchain.openContract(new ATHMaster(athMasterAddress, athMasterInit));

  const buybackInit = await BuybackBurn.init(addressHash(controller.address), athMasterAddress);
  const buybackAddress = contractAddress(0, buybackInit);
  await blockchain.setShardAccount(buybackAddress, createShardAccount({
    address: buybackAddress,
    code: buybackInit.code,
    data: buybackInit.data,
    balance: toNano('2'),
    workchain: buybackAddress.workChain,
  }));
  const buyback = blockchain.openContract(new BuybackBurn(buybackAddress, buybackInit));
  const officialAthWallet = await buyback.getGetOfficialAthWalletAddress();
  const stonfiAskJettonWallet = await athWalletAddress(stonfiPoolOwner.address, athMasterAddress);

  return {
    blockchain,
    buyback,
    athMaster,
    controller,
    feeAccumulator,
    operator,
    attacker,
    stonfiRouter,
    stonfiPoolOwner,
    stonfiPtonWallet,
    stonfiReferral,
    athMasterInit,
    athMasterAddress,
    officialAthWallet,
    stonfiAskJettonWallet,
  };
}

async function freezeAndSeal(
  env: Awaited<ReturnType<typeof setup>>,
  routeOverrides: Partial<FreezeBuybackRoute> = {},
) {
  await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindBuybackFeeAccumulator',
    deployment_manifest_hash: MANIFEST_HASH,
    fee_accumulator_address: env.feeAccumulator.address,
  } as BindBuybackFeeAccumulator);

  await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindBuybackOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: env.officialAthWallet,
  } as BindBuybackOfficialAthWallet);

  await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, routeFreeze(env, routeOverrides));

  await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealBuybackBurnGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealBuybackBurnGenesis);
}

function routeFreeze(env: Awaited<ReturnType<typeof setup>>, overrides: Partial<FreezeBuybackRoute> = {}): FreezeBuybackRoute {
  const base: FreezeBuybackRoute = {
    $$type: 'FreezeBuybackRoute',
    deployment_manifest_hash: MANIFEST_HASH,
    stonfi_router_address: env.stonfiRouter.address,
    stonfi_pool_address_ton_ath: env.stonfiPoolOwner.address,
    stonfi_pton_wallet_address: env.stonfiPtonWallet.address,
    ask_jetton_wallet_address: env.stonfiAskJettonWallet,
    stonfi_referral_address: env.stonfiReferral.address,
    referral_value_bps: 0n,
    buyback_min_ath_out_per_50_ton_atomic: 95_000n,
    evidence_quote_out_atomic_ath: 100_000n,
    evidence_dex_min_out_atomic_ath: 95_000n,
    route_evidence_hash: ROUTE_EVIDENCE_HASH,
  };
  return { ...base, ...overrides, $$type: 'FreezeBuybackRoute' };
}

async function acceptReserve(env: Awaited<ReturnType<typeof setup>>) {
  await env.buyback.send(env.feeAccumulator.getSender(), { value: ENVELOPE + ACCEPT_RESERVE_EXEC_RESERVE }, {
    $$type: 'AcceptBurnReserve',
    amount: ENVELOPE,
  } as AcceptBurnReserve);
}

async function executeBuyback(env: Awaited<ReturnType<typeof setup>>, queryId = 1n) {
  return await env.buyback.send(env.operator.getSender(), { value: toNano('0.1') }, {
    $$type: 'ExecuteBuybackChunk',
    query_id: queryId,
    deadline: BigInt((env.blockchain.now ?? 0) + 600),
    quote_out_atomic_ath: 100_000n,
    dex_min_out_atomic_ath: 95_000n,
  } as ExecuteBuybackChunk);
}

function inboundBody(tx: any): Cell {
  const body = tx?.inMessage?.body;
  if (!body) throw new Error('missing inbound body');
  return body;
}

function inboundValue(tx: any): bigint {
  const info = tx?.inMessage?.info;
  if (info?.type !== 'internal') throw new Error('missing inbound internal value');
  return info.value.coins;
}

describe('Production BuybackBurn candidate', () => {
  it('BUYBACK-01: derives the official ATH wallet after the BuybackBurn address exists', async () => {
    const env = await setup();
    const expectedOfficial = await athWalletAddress(env.buyback.address, env.athMasterAddress);

    expect(env.officialAthWallet.equals(expectedOfficial)).toBe(true);
    expect((await env.buyback.getGetBuybackBurnConfig()).official_ath_wallet_bound).toBe(false);

    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindBuybackOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: fixtureAddress('WRONG_OFFICIAL_WALLET'),
    } as BindBuybackOfficialAthWallet);
    expect((await env.buyback.getGetBuybackBurnConfig()).official_ath_wallet_bound).toBe(false);

    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindBuybackOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: env.officialAthWallet,
    } as BindBuybackOfficialAthWallet);

    const config = await env.buyback.getGetBuybackBurnConfig();
    expect(config.official_ath_wallet_bound).toBe(true);
    expect(config.official_ath_wallet_address.equals(expectedOfficial)).toBe(true);
  });

  it('BUYBACK-02: binds fee, official ATH wallet, and route once before seal; seal burns the genesis controller surface', async () => {
    const env = await setup();

    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindBuybackFeeAccumulator',
      deployment_manifest_hash: MANIFEST_HASH,
      fee_accumulator_address: env.attacker.address,
    } as BindBuybackFeeAccumulator);
    expect((await env.buyback.getGetBuybackBurnConfig()).fee_bound).toBe(false);

    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, routeFreeze(env, {
      ask_jetton_wallet_address: fixtureAddress('WRONG_ASK_JETTON_WALLET'),
    }));
    expect((await env.buyback.getGetBuybackBurnConfig()).route_frozen).toBe(false);

    await freezeAndSeal(env);

    const sealed = await env.buyback.getGetBuybackBurnConfig();
    expect(sealed.sealed).toBe(true);
    expect(sealed.genesis_config_hash).toBe(0n);
    expect(sealed.fee_accumulator_address.equals(env.feeAccumulator.address)).toBe(true);
    expect(sealed.route_frozen).toBe(true);

    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindBuybackFeeAccumulator',
      deployment_manifest_hash: MANIFEST_HASH,
      fee_accumulator_address: env.attacker.address,
    } as BindBuybackFeeAccumulator);

    const afterPostSealAttempt = await env.buyback.getGetBuybackBurnConfig();
    expect(afterPostSealAttempt.fee_accumulator_address.equals(env.feeAccumulator.address)).toBe(true);
  });

  it('BUYBACK-03: accepts only the exact 51.05 TON envelope from the bound FeeAccumulator after seal', async () => {
    const env = await setup();

    await env.buyback.send(env.feeAccumulator.getSender(), { value: ENVELOPE + ACCEPT_RESERVE_EXEC_RESERVE }, {
      $$type: 'AcceptBurnReserve',
      amount: ENVELOPE,
    } as AcceptBurnReserve);
    expect((await env.buyback.getGetBuybackBurnState()).reserve_due_ton).toBe(0n);

    await freezeAndSeal(env);

    await env.buyback.send(env.attacker.getSender(), { value: ENVELOPE }, {
      $$type: 'AcceptBurnReserve',
      amount: ENVELOPE,
    } as AcceptBurnReserve);
    expect((await env.buyback.getGetBuybackBurnState()).reserve_due_ton).toBe(0n);

    await env.buyback.send(env.feeAccumulator.getSender(), { value: toNano('50') }, {
      $$type: 'AcceptBurnReserve',
      amount: toNano('50'),
    } as AcceptBurnReserve);
    expect((await env.buyback.getGetBuybackBurnState()).reserve_due_ton).toBe(0n);

    await acceptReserve(env);

    const state = await env.buyback.getGetBuybackBurnState();
    const totals = await env.buyback.getGetBuybackBurnTotals();
    expect(state.reserve_due_ton).toBe(ENVELOPE);
    expect(totals.accepted_reserve_count).toBe(1n);
  });

  it('BUYBACK-03B: production FeeAccumulator delivers the exact 51.05 TON reserve envelope to BuybackBurn', async () => {
    const env = await setup();
    const productionFeeAccumulator = await deployFeeAccumulator(
      env.blockchain,
      env.controller.address,
      env.buyback.address,
    );

    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindBuybackFeeAccumulator',
      deployment_manifest_hash: MANIFEST_HASH,
      fee_accumulator_address: productionFeeAccumulator.address,
    } as BindBuybackFeeAccumulator);
    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindBuybackOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: env.officialAthWallet,
    } as BindBuybackOfficialAthWallet);
    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, routeFreeze(env));
    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealBuybackBurnGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealBuybackBurnGenesis);

    const protocolFeePrincipal = ENVELOPE * 2n;
    await productionFeeAccumulator.send(env.operator.getSender(), { value: protocolFeePrincipal + toNano('0.1') }, {
      $$type: 'DepositProtocolFee',
      amount: protocolFeePrincipal,
    } as DepositProtocolFee);
    await productionFeeAccumulator.send(env.operator.getSender(), { value: toNano('0.1') }, {
      $$type: 'SplitAccumulated',
    } as SplitAccumulated);
    expect((await productionFeeAccumulator.getGetState()).buyback_due_ton).toBe(ENVELOPE);

    await productionFeeAccumulator.send(env.operator.getSender(), { value: toNano('0.1') }, {
      $$type: 'FlushBuybackDue',
      amount: ENVELOPE,
    } as FlushBuybackDue);

    expect((await productionFeeAccumulator.getGetState()).buyback_due_ton).toBe(0n);
    expect((await env.buyback.getGetBuybackBurnState()).reserve_due_ton).toBe(ENVELOPE);
  });

  it('BUYBACK-04: execution sends the exact STON.fi pTON body with BuybackBurn refund and excess receivers', async () => {
    const env = await setup();
    await freezeAndSeal(env);
    await acceptReserve(env);

    await env.buyback.send(env.operator.getSender(), { value: toNano('0.01') }, {
      $$type: 'ExecuteBuybackChunk',
      query_id: 1n,
      deadline: BigInt((env.blockchain.now ?? 0) + 600),
      quote_out_atomic_ath: 100_000n,
      dex_min_out_atomic_ath: 95_000n,
    } as ExecuteBuybackChunk);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_IDLE);
    expect((await env.buyback.getGetBuybackBurnState()).reserve_due_ton).toBe(ENVELOPE);

    const result = await executeBuyback(env, 1n);
    const ptonTx = findTransaction(result.transactions, {
      from: env.buyback.address,
      to: env.stonfiPtonWallet.address,
      op: OP_PTON_TON_TRANSFER,
    });
    expect(ptonTx).toBeDefined();
    expect(inboundValue(ptonTx)).toBe(ENVELOPE);

    const decoded = decodePtonTonTransferBodyV21(inboundBody(ptonTx));
    const swap = decodeStonfiSwapBodyV21(decoded.forwardPayload!);

    expect(decoded.queryId).toBe('1');
    expect(decoded.tonAmount).toBe(OFFER.toString());
    expect(addressRaw(decoded.refundAddress)).toBe(addressRaw(env.buyback.address));
    expect(addressRaw(swap.refundAddress)).toBe(addressRaw(env.buyback.address));
    expect(addressRaw(swap.excessesAddress)).toBe(addressRaw(env.buyback.address));
    expect(addressRaw(swap.details.receiverAddress)).toBe(addressRaw(env.officialAthWallet));
    expect(swap.details.minAskAmount).toBe('95000');
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_PENDING_STONFI_SWAP);
  });

  it('BUYBACK-04B: pTON transfer bounce records returned TON as route refund without restoring a retryable envelope', async () => {
    const env = await setup();
    const undeployedPtonWallet = fixtureAddress('UNDEPLOYED_PTON_WALLET');
    await freezeAndSeal(env, {
      stonfi_pton_wallet_address: undeployedPtonWallet,
    });
    await acceptReserve(env);

    const result = await executeBuyback(env, 1n);
    const ptonTx = findTransaction(result.transactions, {
      from: env.buyback.address,
      to: undeployedPtonWallet,
      op: OP_PTON_TON_TRANSFER,
    });
    expect(ptonTx).toBeDefined();

    const state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.reserve_due_ton).toBe(0n);
    expect(state.route_refund_due_ton > 0n).toBe(true);
    expect(state.route_refund_due_ton <= ENVELOPE).toBe(true);
    expect(state.pending_query_id).toBe(0n);

    await executeBuyback(env, 2n);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_IDLE);
  });

  it('BUYBACK-04F: rejects uint64_max query jumps so permissionless callers cannot brick future buybacks', async () => {
    const env = await setup();
    const undeployedPtonWallet = fixtureAddress('UNDEPLOYED_PTON_WALLET_F039');
    await freezeAndSeal(env, {
      stonfi_pton_wallet_address: undeployedPtonWallet,
    });
    await acceptReserve(env);

    await executeBuyback(env, UINT64_MAX);
    let state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.reserve_due_ton).toBe(ENVELOPE);
    expect(state.last_terminal_query_id).toBe(0n);

    await executeBuyback(env, 1n);
    state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.reserve_due_ton).toBe(0n);
    expect(state.last_terminal_query_id).toBe(1n);
    expect(state.route_refund_due_ton > 0n).toBe(true);

    await acceptReserve(env);
    await executeBuyback(env, 2n);
    state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.reserve_due_ton).toBe(0n);
    expect(state.last_terminal_query_id).toBe(2n);
  });

  it('BUYBACK-04C: route refund/excess cannot prematurely clear a pending swap, but can be recovered after grace', async () => {
    const env = await setup();
    const refundValue = toNano('50.5');
    await freezeAndSeal(env);
    await acceptReserve(env);
    await executeBuyback(env, 1n);

    await env.buyback.send(env.stonfiRouter.getSender(), { value: refundValue }, null);
    let state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_PENDING_STONFI_SWAP);
    expect(state.route_refund_due_ton).toBe(routeRefundCredit(refundValue));

    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'RecoverStonfiRouteRefund',
      query_id: 1n,
    } as RecoverStonfiRouteRefund);
    state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_PENDING_STONFI_SWAP);
    expect(state.pending_query_id).toBe(1n);

    env.blockchain.now = (env.blockchain.now ?? 0) + 1501;
    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'RecoverStonfiRouteRefund',
      query_id: 1n,
    } as RecoverStonfiRouteRefund);

    state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.pending_query_id).toBe(0n);
    expect(state.route_refund_due_ton).toBe(routeRefundCredit(refundValue));
  });

  it('BUYBACK-04D: recovery uses only the current swap refund delta, not old dust or small success excess', async () => {
    const env = await setup();
    const oldRouteDue = toNano('48.9');
    const smallExcess = toNano('0.2');
    await freezeAndSeal(env);
    await acceptReserve(env);

    await env.buyback.send(env.stonfiRouter.getSender(), { value: oldRouteDue }, null);
    await executeBuyback(env, 1n);
    await env.buyback.send(env.stonfiRouter.getSender(), { value: smallExcess }, null);

    env.blockchain.now = (env.blockchain.now ?? 0) + 1501;
    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'RecoverStonfiRouteRefund',
      query_id: 1n,
    } as RecoverStonfiRouteRefund);

    const state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_PENDING_STONFI_SWAP);
    expect(state.pending_query_id).toBe(1n);
    expect(state.route_refund_due_ton).toBe(routeRefundCredit(oldRouteDue) + routeRefundCredit(smallExcess));
  });

  it('BUYBACK-04E: full accumulated route refunds can be recycled into exactly one new reserve envelope', async () => {
    const env = await setup();
    const dust = toNano('0.1');
    await freezeAndSeal(env);

    await env.buyback.send(env.stonfiRouter.getSender(), { value: ENVELOPE + dust }, null);
    let state = await env.buyback.getGetBuybackBurnState();
    expect(state.route_refund_due_ton).toBe(routeRefundCredit(ENVELOPE + dust));
    expect(state.reserve_due_ton).toBe(0n);

    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.001') }, {
      $$type: 'RecycleRouteRefundReserve',
    } as RecycleRouteRefundReserve);
    state = await env.buyback.getGetBuybackBurnState();
    expect(state.route_refund_due_ton).toBe(routeRefundCredit(ENVELOPE + dust));
    expect(state.reserve_due_ton).toBe(0n);

    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'RecycleRouteRefundReserve',
    } as RecycleRouteRefundReserve);

    state = await env.buyback.getGetBuybackBurnState();
    expect(state.route_refund_due_ton).toBe(routeRefundCredit(ENVELOPE + dust) - ENVELOPE);
    expect(state.reserve_due_ton).toBe(ENVELOPE);
  });

  it('BUYBACK-05: authenticated ATH notification from the official wallet burns through ATHMaster and clears pending state', async () => {
    const env = await setup();
    await freezeAndSeal(env);
    await acceptReserve(env);
    await executeBuyback(env, 1n);

    const stonfiSourceWallet = await deployAthWallet(
      env.blockchain,
      env.stonfiPoolOwner.address,
      env.athMasterAddress,
      200_000n,
    );

    await stonfiSourceWallet.send(env.stonfiPoolOwner.getSender(), { value: toNano('0.3') }, {
      $$type: 'ATHTransferRequestWithNotify',
      query_id: 1n,
      amount: 100_000n,
      recipient: env.buyback.address,
      response_destination: env.stonfiPoolOwner.address,
      notify_destination: env.buyback.address,
      notify_value: BUYBACK_ROUTE_NOTIFY_MIN_VALUE,
    } as ATHTransferRequestWithNotify);

    const state = await env.buyback.getGetBuybackBurnState();
    const totals = await env.buyback.getGetBuybackBurnTotals();
    const jetton = await env.athMaster.getGetJettonData();
    const officialWallet = env.blockchain.openContract(new ATHWallet(env.officialAthWallet));

    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.pending_query_id).toBe(0n);
    expect(totals.executed_buyback_count).toBe(1n);
    expect(totals.burned_ath_total_atomic).toBe(100_000n);
    expect(jetton.total_supply).toBe(ATH_TOTAL_SUPPLY_ATOMIC - 100_000n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(0n);

    await acceptReserve(env);
    await executeBuyback(env, 1n);
    const afterReuseAttempt = await env.buyback.getGetBuybackBurnState();
    expect(afterReuseAttempt.phase).toBe(PHASE_IDLE);
    expect(afterReuseAttempt.reserve_due_ton).toBe(ENVELOPE);
  });

  it('BUYBACK-06: authenticated burn failure becomes retry-due and can be finalized later', async () => {
    const env = await setup({ deployAthMaster: false });
    await freezeAndSeal(env);
    await acceptReserve(env);
    await executeBuyback(env, 1n);

    const stonfiSourceWallet = await deployAthWallet(
      env.blockchain,
      env.stonfiPoolOwner.address,
      env.athMasterAddress,
      200_000n,
    );

    await stonfiSourceWallet.send(env.stonfiPoolOwner.getSender(), { value: toNano('0.3') }, {
      $$type: 'ATHTransferRequestWithNotify',
      query_id: 1n,
      amount: 100_000n,
      recipient: env.buyback.address,
      response_destination: env.stonfiPoolOwner.address,
      notify_destination: env.buyback.address,
      notify_value: BUYBACK_ROUTE_NOTIFY_MIN_VALUE,
    } as ATHTransferRequestWithNotify);

    let state = await env.buyback.getGetBuybackBurnState();
    let totals = await env.buyback.getGetBuybackBurnTotals();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.pending_query_id).toBe(0n);
    expect(state.ath_burn_retry_due_atomic).toBe(100_000n);
    expect(totals.executed_buyback_count).toBe(0n);
    expect(totals.burned_ath_total_atomic).toBe(0n);

    const officialWallet = env.blockchain.openContract(new ATHWallet(env.officialAthWallet));
    expect((await officialWallet.getGetWalletData()).balance).toBe(100_000n);

    await env.blockchain.setShardAccount(env.athMasterAddress, createShardAccount({
      address: env.athMasterAddress,
      code: env.athMasterInit.code,
      data: env.athMasterInit.data,
      balance: toNano('2'),
      workchain: env.athMasterAddress.workChain,
    }));

    await env.buyback.send(env.operator.getSender(), { value: toNano('0.01') }, {
      $$type: 'RetryAthBurnDue',
      query_id: 2n,
      amount: 100_000n,
    } as RetryAthBurnDue);

    state = await env.buyback.getGetBuybackBurnState();
    expect(state.ath_burn_retry_due_atomic).toBe(100_000n);
    expect(state.phase).toBe(PHASE_IDLE);

    await env.buyback.send(env.operator.getSender(), { value: toNano('0.1') }, {
      $$type: 'RetryAthBurnDue',
      query_id: 2n,
      amount: 100_000n,
    } as RetryAthBurnDue);

    state = await env.buyback.getGetBuybackBurnState();
    totals = await env.buyback.getGetBuybackBurnTotals();
    const jetton = await env.athMaster.getGetJettonData();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.pending_query_id).toBe(0n);
    expect(state.ath_burn_retry_due_atomic).toBe(0n);
    expect(totals.executed_buyback_count).toBe(1n);
    expect(totals.burned_ath_total_atomic).toBe(100_000n);
    expect(jetton.total_supply).toBe(ATH_TOTAL_SUPPLY_ATOMIC - 100_000n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(0n);
  });
});
