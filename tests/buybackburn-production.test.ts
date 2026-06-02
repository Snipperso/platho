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
  EnableBuybackSplit,
  FeeAccumulator,
  FlushBuybackDue,
  SplitAccumulated,
} from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import {
  ATHWallet,
  JettonTransfer,
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
const ACCOUNTING_RECYCLE_EXEC_RESERVE = 2_000_000n;
const ROUTE_REFUND_EXEC_RESERVE = 2_000_000n;
const OFFER = toNano('50');
const PHASE_IDLE = 0n;
const PHASE_PENDING_STONFI_SWAP = 1n;
const DEADLINE_MAX_AHEAD_SECONDS = 900n;
const ATH_TOTAL_SUPPLY_ATOMIC = 100000000000000000n;
const ATH_TRANSFER_NOTIFY_MIN_VALUE = 30_000_000n;
const BUYBACK_ROUTE_NOTIFY_MIN_VALUE = 35_000_000n;
const BUYBACK_ROUTE_ATH_NOTIFY_FORWARD_GAS = 40_000_000n;
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
  const stonfiAthSourceOwner = await blockchain.treasury('buyback-stonfi-ath-source-owner');
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
  const stonfiAskJettonWallet = await athWalletAddress(stonfiAthSourceOwner.address, athMasterAddress);

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
    stonfiAthSourceOwner,
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

async function bindAndSealWithoutRoute(env: Awaited<ReturnType<typeof setup>>) {
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
    stonfi_ath_source_owner_address: env.stonfiAthSourceOwner.address,
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
    quote_out_atomic_ath: 100_000n,
    dex_min_out_atomic_ath: 95_000n,
  } as ExecuteBuybackChunk);
}

async function sendStandardStonfiAthOutput(
  env: Awaited<ReturnType<typeof setup>>,
  queryId: bigint,
  amount: bigint,
  forwardTonAmount: bigint,
  sourceBalance = 200_000n,
) {
  const stonfiSourceWallet = await deployAthWallet(
    env.blockchain,
    env.stonfiAthSourceOwner.address,
    env.athMasterAddress,
    sourceBalance,
  );

  await stonfiSourceWallet.send(env.stonfiAthSourceOwner.getSender(), { value: toNano('0.3') }, {
    $$type: 'JettonTransfer',
    query_id: queryId,
    amount,
    destination: env.buyback.address,
    response_destination: env.stonfiAthSourceOwner.address,
    custom_payload: null,
    forward_ton_amount: forwardTonAmount,
    forward_payload: beginCell().endCell().beginParse(),
  } as JettonTransfer);

  return stonfiSourceWallet;
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
      ask_jetton_wallet_address: fixtureAddress('MASTERCHAIN_ASK_JETTON_WALLET', -1),
    }));
    expect((await env.buyback.getGetBuybackBurnConfig()).route_frozen).toBe(false);

    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, routeFreeze(env, {
      ask_jetton_wallet_address: fixtureAddress('MISMATCHED_BASECHAIN_ASK_JETTON_WALLET'),
    }));
    expect((await env.buyback.getGetBuybackBurnConfig()).route_frozen).toBe(false);

    await freezeAndSeal(env);

    const sealed = await env.buyback.getGetBuybackBurnConfig();
    expect(sealed.sealed).toBe(true);
    expect(sealed.genesis_config_hash).toBe(0n);
    expect(sealed.fee_accumulator_address.equals(env.feeAccumulator.address)).toBe(true);
    expect(sealed.route_frozen).toBe(true);
    expect(sealed.ask_jetton_wallet_address.equals(env.stonfiAskJettonWallet)).toBe(true);
    expect(sealed.stonfi_ath_source_owner_address.equals(env.stonfiAthSourceOwner.address)).toBe(true);
    expect(sealed.ask_jetton_wallet_address.equals(await athWalletAddress(env.stonfiAthSourceOwner.address, env.athMasterAddress))).toBe(true);
    expect(sealed.ask_jetton_wallet_address.equals(await athWalletAddress(env.stonfiPoolOwner.address, env.athMasterAddress))).toBe(false);

    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindBuybackFeeAccumulator',
      deployment_manifest_hash: MANIFEST_HASH,
      fee_accumulator_address: env.attacker.address,
    } as BindBuybackFeeAccumulator);

    const afterPostSealAttempt = await env.buyback.getGetBuybackBurnConfig();
    expect(afterPostSealAttempt.fee_accumulator_address.equals(env.feeAccumulator.address)).toBe(true);
  });

  it('BUYBACK-02B: can seal before pool launch, then freeze the STON.fi route exactly once', async () => {
    const env = await setup();

    await bindAndSealWithoutRoute(env);

    let config = await env.buyback.getGetBuybackBurnConfig();
    expect(config.sealed).toBe(true);
    expect(config.route_frozen).toBe(false);
    expect(config.genesis_config_hash).toBe(addressHash(env.controller.address));

    await env.buyback.send(env.feeAccumulator.getSender(), { value: ENVELOPE + ACCEPT_RESERVE_EXEC_RESERVE }, {
      $$type: 'AcceptBurnReserve',
      amount: ENVELOPE,
    } as AcceptBurnReserve);
    expect((await env.buyback.getGetBuybackBurnState()).reserve_due_ton).toBe(0n);

    await env.buyback.send(env.operator.getSender(), { value: toNano('0.1') }, {
      $$type: 'ExecuteBuybackChunk',
      query_id: 1n,
      quote_out_atomic_ath: 100_000n,
      dex_min_out_atomic_ath: 95_000n,
    } as ExecuteBuybackChunk);
    let state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.reserve_due_ton).toBe(0n);
    expect(state.route_refund_due_ton).toBe(0n);

    await env.buyback.send(env.stonfiRouter.getSender(), { value: toNano('1') }, null);
    state = await env.buyback.getGetBuybackBurnState();
    expect(state.route_refund_due_ton).toBe(0n);

    await env.buyback.send(
      env.attacker.getSender(),
      { value: ENVELOPE + ACCOUNTING_RECYCLE_EXEC_RESERVE },
      {
        $$type: 'RecycleRouteRefundReserve',
      } as RecycleRouteRefundReserve,
    );
    state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.reserve_due_ton).toBe(0n);
    expect(state.route_refund_due_ton).toBe(0n);
    expect((await env.buyback.getGetBuybackBurnConfig()).route_frozen).toBe(false);

    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, routeFreeze(env, {
      stonfi_pool_address_ton_ath: env.attacker.address,
      ask_jetton_wallet_address: await athWalletAddress(env.attacker.address, env.athMasterAddress),
    }));
    expect((await env.buyback.getGetBuybackBurnConfig()).route_frozen).toBe(false);

    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, routeFreeze(env));

    config = await env.buyback.getGetBuybackBurnConfig();
    expect(config.route_frozen).toBe(true);
    expect(config.genesis_config_hash).toBe(0n);
    expect(config.stonfi_pool_address_ton_ath.equals(env.stonfiPoolOwner.address)).toBe(true);
    expect(config.stonfi_ath_source_owner_address.equals(env.stonfiAthSourceOwner.address)).toBe(true);

    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, routeFreeze(env, {
      route_evidence_hash: ROUTE_EVIDENCE_HASH + 1n,
    }));
    config = await env.buyback.getGetBuybackBurnConfig();
    expect(config.route_evidence_hash).toBe(ROUTE_EVIDENCE_HASH);

    await acceptReserve(env);
    expect((await env.buyback.getGetBuybackBurnState()).reserve_due_ton).toBe(ENVELOPE);
  });

  it('BUYBACK-02C: post-seal route freeze rejects non-basechain STON.fi endpoints before freezing', async () => {
    const env = await setup();

    await bindAndSealWithoutRoute(env);

    const badEndpointOverrides: Array<[keyof FreezeBuybackRoute, Address]> = [
      ['stonfi_router_address', fixtureAddress('MASTERCHAIN_STONFI_ROUTER', -1)],
      ['stonfi_pool_address_ton_ath', fixtureAddress('MASTERCHAIN_STONFI_POOL', -1)],
      ['stonfi_pton_wallet_address', fixtureAddress('MASTERCHAIN_STONFI_PTON_WALLET', -1)],
      ['stonfi_referral_address', fixtureAddress('MASTERCHAIN_STONFI_REFERRAL', -1)],
    ];

    for (const [field, address] of badEndpointOverrides) {
      await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, routeFreeze(env, {
        [field]: address,
      } as Partial<FreezeBuybackRoute>));
      expect((await env.buyback.getGetBuybackBurnConfig()).route_frozen).toBe(false);
    }

    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, routeFreeze(env));

    const config = await env.buyback.getGetBuybackBurnConfig();
    expect(config.route_frozen).toBe(true);
    expect(config.genesis_config_hash).toBe(0n);
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

    await productionFeeAccumulator.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'EnableBuybackSplit',
    } as EnableBuybackSplit);

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

  it('BUYBACK-03C: production FeeAccumulator flush before route freeze bounces and restores buyback due', async () => {
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
    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealBuybackBurnGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealBuybackBurnGenesis);

    expect((await env.buyback.getGetBuybackBurnConfig()).route_frozen).toBe(false);

    await productionFeeAccumulator.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'EnableBuybackSplit',
    } as EnableBuybackSplit);

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

    expect((await productionFeeAccumulator.getGetState()).buyback_due_ton).toBe(ENVELOPE);
    expect((await env.buyback.getGetBuybackBurnState()).reserve_due_ton).toBe(0n);
    expect((await env.buyback.getGetBuybackBurnTotals()).accepted_reserve_count).toBe(0n);
  });

  it('BUYBACK-04: execution sends the exact STON.fi pTON body with BuybackBurn refund and excess receivers', async () => {
    const env = await setup();
    await freezeAndSeal(env);
    await acceptReserve(env);

    await env.buyback.send(env.operator.getSender(), { value: toNano('0.01') }, {
      $$type: 'ExecuteBuybackChunk',
      query_id: 1n,
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
    expect(swap.details.dexCustomPayloadForwardGasAmount).toBe(BUYBACK_ROUTE_ATH_NOTIFY_FORWARD_GAS.toString());
    expect(swap.details.hasDexCustomPayload).toBe(true);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_PENDING_STONFI_SWAP);
  });

  it('BUYBACK-04H: rejects caller-chosen high minOut so protocol-funded route gas cannot be griefed', async () => {
    const env = await setup();
    await freezeAndSeal(env);
    await acceptReserve(env);

    const result = await env.buyback.send(env.attacker.getSender(), { value: toNano('0.1') }, {
      $$type: 'ExecuteBuybackChunk',
      query_id: 1n,
      quote_out_atomic_ath: 200_000n,
      dex_min_out_atomic_ath: 190_000n,
    } as ExecuteBuybackChunk);

    expect(findTransaction(result.transactions, {
      from: env.buyback.address,
      to: env.stonfiPtonWallet.address,
      op: OP_PTON_TON_TRANSFER,
    })).toBeUndefined();

    const state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.reserve_due_ton).toBe(ENVELOPE);
    expect(state.pending_query_id).toBe(0n);
    expect(state.route_refund_due_ton).toBe(0n);
    expect(state.last_terminal_query_id).toBe(0n);
  });

  it('BUYBACK-04K: treats the frozen route quote/minOut as a fixed execution floor, not a live dynamic quote', async () => {
    const env = await setup();
    await freezeAndSeal(env);
    await acceptReserve(env);

    for (const [quoteOut, dexMinOut] of [
      [94_000n, 94_000n],
      [150_000n, 142_500n],
    ] as const) {
      const result = await env.buyback.send(env.attacker.getSender(), { value: toNano('0.1') }, {
        $$type: 'ExecuteBuybackChunk',
        query_id: 1n,
        quote_out_atomic_ath: quoteOut,
        dex_min_out_atomic_ath: dexMinOut,
      } as ExecuteBuybackChunk);

      expect(findTransaction(result.transactions, {
        from: env.buyback.address,
        to: env.stonfiPtonWallet.address,
        op: OP_PTON_TON_TRANSFER,
      })).toBeUndefined();

      const state = await env.buyback.getGetBuybackBurnState();
      expect(state.phase).toBe(PHASE_IDLE);
      expect(state.reserve_due_ton).toBe(ENVELOPE);
      expect(state.pending_query_id).toBe(0n);
      expect(state.last_terminal_query_id).toBe(0n);
    }

    await executeBuyback(env, 1n);
    const state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_PENDING_STONFI_SWAP);
    expect(state.pending_query_id).toBe(1n);
    expect(state.pending_dex_min_out_atomic_ath).toBe(95_000n);
  });

  it('BUYBACK-04I: uses a contract-computed route deadline for permissionless execution', async () => {
    const env = await setup();
    await freezeAndSeal(env);
    await acceptReserve(env);

    const now = BigInt(env.blockchain.now ?? 0);
    const result = await env.buyback.send(env.attacker.getSender(), { value: toNano('0.1') }, {
      $$type: 'ExecuteBuybackChunk',
      query_id: 1n,
      quote_out_atomic_ath: 100_000n,
      dex_min_out_atomic_ath: 95_000n,
    } as ExecuteBuybackChunk);

    const ptonTx = findTransaction(result.transactions, {
      from: env.buyback.address,
      to: env.stonfiPtonWallet.address,
      op: OP_PTON_TON_TRANSFER,
    });
    expect(ptonTx).toBeDefined();

    const decoded = decodePtonTonTransferBodyV21(inboundBody(ptonTx));
    const swap = decodeStonfiSwapBodyV21(decoded.forwardPayload!);
    const expectedDeadline = now + DEADLINE_MAX_AHEAD_SECONDS;

    expect(swap.deadline).toBe(expectedDeadline.toString());

    const state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_PENDING_STONFI_SWAP);
    expect(state.pending_deadline).toBe(expectedDeadline);
    expect(state.reserve_due_ton).toBe(0n);
  });

  it('BUYBACK-04J: no ATH notification and no route refund remains pending after grace', async () => {
    const env = await setup();
    await freezeAndSeal(env);
    await acceptReserve(env);
    await executeBuyback(env, 1n);

    env.blockchain.now = (env.blockchain.now ?? 0) + 1801;
    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'RecoverStonfiRouteRefund',
      query_id: 1n,
    } as RecoverStonfiRouteRefund);

    const state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_PENDING_STONFI_SWAP);
    expect(state.pending_query_id).toBe(1n);
    expect(state.route_refund_due_ton).toBe(0n);
    expect(state.ath_burn_retry_due_atomic).toBe(0n);
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

    env.blockchain.now = (env.blockchain.now ?? 0) + 1801;
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

    env.blockchain.now = (env.blockchain.now ?? 0) + 1801;
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

    await env.buyback.send(env.attacker.getSender(), { value: ACCOUNTING_RECYCLE_EXEC_RESERVE }, {
      $$type: 'RecycleRouteRefundReserve',
    } as RecycleRouteRefundReserve);

    state = await env.buyback.getGetBuybackBurnState();
    expect(state.route_refund_due_ton).toBe(routeRefundCredit(ENVELOPE + dust) - ENVELOPE);
    expect(state.reserve_due_ton).toBe(ENVELOPE);
  });

  it('BUYBACK-04G: exact full route refund can be recycled with caller-funded shortfall top-up', async () => {
    const env = await setup();
    await freezeAndSeal(env);

    await env.buyback.send(env.stonfiRouter.getSender(), { value: ENVELOPE }, null);
    let state = await env.buyback.getGetBuybackBurnState();
    expect(state.route_refund_due_ton).toBe(routeRefundCredit(ENVELOPE));
    expect(state.route_refund_due_ton).toBeLessThan(ENVELOPE);
    expect(state.reserve_due_ton).toBe(0n);

    await env.buyback.send(env.attacker.getSender(), { value: ACCOUNTING_RECYCLE_EXEC_RESERVE }, {
      $$type: 'RecycleRouteRefundReserve',
    } as RecycleRouteRefundReserve);
    state = await env.buyback.getGetBuybackBurnState();
    expect(state.route_refund_due_ton).toBe(routeRefundCredit(ENVELOPE));
    expect(state.reserve_due_ton).toBe(0n);

    const shortfall = ENVELOPE - state.route_refund_due_ton;
    await env.buyback.send(env.attacker.getSender(), { value: ACCOUNTING_RECYCLE_EXEC_RESERVE + shortfall }, {
      $$type: 'RecycleRouteRefundReserve',
    } as RecycleRouteRefundReserve);

    state = await env.buyback.getGetBuybackBurnState();
    expect(state.route_refund_due_ton).toBe(0n);
    expect(state.reserve_due_ton).toBe(ENVELOPE);
  });

  it('BUYBACK-05: standard jetton ATH output is translated into authenticated burn and clears pending state', async () => {
    const env = await setup();
    await freezeAndSeal(env);
    await acceptReserve(env);
    await executeBuyback(env, 1n);

    const stonfiSourceWallet = await sendStandardStonfiAthOutput(
      env,
      1n,
      100_000n,
      BUYBACK_ROUTE_ATH_NOTIFY_FORWARD_GAS,
    );

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
    expect((await stonfiSourceWallet.getGetWalletData()).balance).toBe(100_000n);

    await acceptReserve(env);
    await executeBuyback(env, 1n);
    const afterReuseAttempt = await env.buyback.getGetBuybackBurnState();
    expect(afterReuseAttempt.phase).toBe(PHASE_IDLE);
    expect(afterReuseAttempt.reserve_due_ton).toBe(ENVELOPE);
  });

  it('BUYBACK-05C: authenticated ATH route notification surplus is accounted as route refund', async () => {
    const env = await setup();
    await freezeAndSeal(env);
    await acceptReserve(env);
    await executeBuyback(env, 1n);

    const highNotifyValue = toNano('0.1');
    await sendStandardStonfiAthOutput(env, 1n, 100_000n, highNotifyValue);

    const state = await env.buyback.getGetBuybackBurnState();
    const totals = await env.buyback.getGetBuybackBurnTotals();
    const jetton = await env.athMaster.getGetJettonData();
    const officialWallet = env.blockchain.openContract(new ATHWallet(env.officialAthWallet));

    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.pending_query_id).toBe(0n);
    expect(state.route_refund_due_ton).toBe(highNotifyValue - BUYBACK_ROUTE_NOTIFY_MIN_VALUE);
    expect(totals.executed_buyback_count).toBe(1n);
    expect(totals.burned_ath_total_atomic).toBe(100_000n);
    expect(jetton.total_supply).toBe(ATH_TOTAL_SUPPLY_ATOMIC - 100_000n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(0n);
  });

  it('BUYBACK-05B: authenticated low-value ATH route notification becomes retry-due instead of a stuck swap', async () => {
    const env = await setup();
    await freezeAndSeal(env);
    await acceptReserve(env);
    await executeBuyback(env, 1n);

    await sendStandardStonfiAthOutput(env, 1n, 100_000n, ATH_TRANSFER_NOTIFY_MIN_VALUE);

    const officialWallet = env.blockchain.openContract(new ATHWallet(env.officialAthWallet));
    let state = await env.buyback.getGetBuybackBurnState();
    let totals = await env.buyback.getGetBuybackBurnTotals();

    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.pending_query_id).toBe(0n);
    expect(state.last_terminal_query_id).toBe(1n);
    expect(state.ath_burn_retry_due_atomic).toBe(100_000n);
    expect(totals.executed_buyback_count).toBe(0n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(100_000n);

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

  it('BUYBACK-05D: route notify value threshold separates retry from immediate burn', async () => {
    for (const [notifyValue, expectedRetryDue, expectedExecutedCount] of [
      [BUYBACK_ROUTE_NOTIFY_MIN_VALUE - 1n, 100_000n, 0n],
      [BUYBACK_ROUTE_NOTIFY_MIN_VALUE, 0n, 1n],
    ] as const) {
      const env = await setup();
      await freezeAndSeal(env);
      await acceptReserve(env);
      await executeBuyback(env, 1n);

      await sendStandardStonfiAthOutput(env, 1n, 100_000n, notifyValue);

      const state = await env.buyback.getGetBuybackBurnState();
      const totals = await env.buyback.getGetBuybackBurnTotals();
      const officialWallet = env.blockchain.openContract(new ATHWallet(env.officialAthWallet));

      expect(state.phase).toBe(PHASE_IDLE);
      expect(state.pending_query_id).toBe(0n);
      expect(state.ath_burn_retry_due_atomic).toBe(expectedRetryDue);
      expect(totals.executed_buyback_count).toBe(expectedExecutedCount);
      expect(totals.burned_ath_total_atomic).toBe(expectedExecutedCount === 0n ? 0n : 100_000n);
      expect((await officialWallet.getGetWalletData()).balance).toBe(expectedRetryDue);
    }
  });

  it('BUYBACK-05E: ordinary ATH sent to the official BuybackBurn ATH wallet is untracked and not burn-due', async () => {
    const env = await setup();
    await freezeAndSeal(env);

    const beforeState = await env.buyback.getGetBuybackBurnState();
    const beforeTotals = await env.buyback.getGetBuybackBurnTotals();

    const stonfiSourceWallet = await sendStandardStonfiAthOutput(
      env,
      77n,
      123_000n,
      0n,
      200_000n,
    );

    const state = await env.buyback.getGetBuybackBurnState();
    const totals = await env.buyback.getGetBuybackBurnTotals();
    const officialWallet = env.blockchain.openContract(new ATHWallet(env.officialAthWallet));
    const jetton = await env.athMaster.getGetJettonData();

    expect(state.phase).toBe(beforeState.phase);
    expect(state.reserve_due_ton).toBe(beforeState.reserve_due_ton);
    expect(state.pending_query_id).toBe(beforeState.pending_query_id);
    expect(state.route_refund_due_ton).toBe(beforeState.route_refund_due_ton);
    expect(state.ath_burn_retry_due_atomic).toBe(beforeState.ath_burn_retry_due_atomic);
    expect(totals.accepted_reserve_count).toBe(beforeTotals.accepted_reserve_count);
    expect(totals.executed_buyback_count).toBe(beforeTotals.executed_buyback_count);
    expect(totals.burned_ath_total_atomic).toBe(beforeTotals.burned_ath_total_atomic);
    expect(jetton.total_supply).toBe(ATH_TOTAL_SUPPLY_ATOMIC);
    expect((await officialWallet.getGetWalletData()).balance).toBe(123_000n);
    expect((await stonfiSourceWallet.getGetWalletData()).balance).toBe(77_000n);
  });

  it('BUYBACK-06: authenticated burn failure becomes retry-due and can be finalized later', async () => {
    const env = await setup({ deployAthMaster: false });
    await freezeAndSeal(env);
    await acceptReserve(env);
    await executeBuyback(env, 1n);

    await sendStandardStonfiAthOutput(env, 1n, 100_000n, BUYBACK_ROUTE_NOTIFY_MIN_VALUE);

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

  it('BUYBACK-06B: multiple failed burns aggregate into one exact retry burn', async () => {
    const env = await setup({ deployAthMaster: false });
    await freezeAndSeal(env);
    await acceptReserve(env);
    await executeBuyback(env, 1n);

    await sendStandardStonfiAthOutput(env, 1n, 100_000n, BUYBACK_ROUTE_NOTIFY_MIN_VALUE, 500_000n);

    await acceptReserve(env);
    await executeBuyback(env, 2n);
    await sendStandardStonfiAthOutput(env, 2n, 200_000n, BUYBACK_ROUTE_NOTIFY_MIN_VALUE, 500_000n);

    const officialWallet = env.blockchain.openContract(new ATHWallet(env.officialAthWallet));
    let state = await env.buyback.getGetBuybackBurnState();
    let totals = await env.buyback.getGetBuybackBurnTotals();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.last_terminal_query_id).toBe(2n);
    expect(state.ath_burn_retry_due_atomic).toBe(300_000n);
    expect(totals.executed_buyback_count).toBe(0n);
    expect(totals.burned_ath_total_atomic).toBe(0n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(300_000n);

    await env.buyback.send(env.operator.getSender(), { value: toNano('0.1') }, {
      $$type: 'RetryAthBurnDue',
      query_id: 3n,
      amount: 100_000n,
    } as RetryAthBurnDue);
    state = await env.buyback.getGetBuybackBurnState();
    expect(state.ath_burn_retry_due_atomic).toBe(300_000n);

    await env.blockchain.setShardAccount(env.athMasterAddress, createShardAccount({
      address: env.athMasterAddress,
      code: env.athMasterInit.code,
      data: env.athMasterInit.data,
      balance: toNano('2'),
      workchain: env.athMasterAddress.workChain,
    }));

    await env.buyback.send(env.operator.getSender(), { value: toNano('0.1') }, {
      $$type: 'RetryAthBurnDue',
      query_id: 3n,
      amount: 300_000n,
    } as RetryAthBurnDue);

    state = await env.buyback.getGetBuybackBurnState();
    totals = await env.buyback.getGetBuybackBurnTotals();
    const jetton = await env.athMaster.getGetJettonData();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.pending_query_id).toBe(0n);
    expect(state.ath_burn_retry_due_atomic).toBe(0n);
    expect(totals.executed_buyback_count).toBe(1n);
    expect(totals.burned_ath_total_atomic).toBe(300_000n);
    expect(jetton.total_supply).toBe(ATH_TOTAL_SUPPLY_ATOMIC - 300_000n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(0n);
  });
});
