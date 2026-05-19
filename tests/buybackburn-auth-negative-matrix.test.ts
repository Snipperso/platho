import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  AcceptBurnReserve,
  ATHBurnFailed,
  AthTransferNotification,
  BindBuybackFeeAccumulator,
  BindBuybackOfficialAthWallet,
  BuybackBurn,
  ExecuteBuybackChunk,
  FreezeBuybackRoute,
  RecoverStonfiRouteRefund,
  RecycleRouteRefundReserve,
  RetryAthBurnDue,
  SealBuybackBurnGenesis,
} from '../build/BuybackBurn/BuybackBurn_BuybackBurn';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import {
  ATHTransferRequestWithNotify,
  ATHWallet,
} from '../build/ATHWallet/ATHWallet_ATHWallet';

const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const ALT_MANIFEST_HASH = MANIFEST_HASH + 1n;
const ROUTE_EVIDENCE_HASH = 0x111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000n;
const ENVELOPE = toNano('51.05');
const ACCEPT_RESERVE_EXEC_RESERVE = 2_000_000n;
const ROUTE_REFUND_EXEC_RESERVE = 2_000_000n;
const OFFER = toNano('50');
const PTON_TRANSFER_GAS = 50_000_000n;
const ACCOUNTING_RECYCLE_EXEC_RESERVE = 2_000_000n;
const ATH_BURN_REQUEST_VALUE = 30_000_000n;
const PHASE_IDLE = 0n;
const PHASE_PENDING_STONFI_SWAP = 1n;
const PHASE_PENDING_ATH_BURN = 2n;

function routeRefundCredit(value: bigint): bigint {
  return value > ROUTE_REFUND_EXEC_RESERVE ? value - ROUTE_REFUND_EXEC_RESERVE : 0n;
}

function addressHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.BUYBACK.NEG.${label}`).digest());
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

async function setup(options: { deployAthMaster?: boolean } = {}) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const controller = await blockchain.treasury('bb-neg-controller');
  const feeAccumulator = await blockchain.treasury('bb-neg-fee-accumulator');
  const operator = await blockchain.treasury('bb-neg-operator');
  const attacker = await blockchain.treasury('bb-neg-attacker');
  const treasuryOwner = await blockchain.treasury('bb-neg-ath-treasury-owner');
  const stonfiRouter = await blockchain.treasury('bb-neg-stonfi-router');
  const stonfiPoolOwner = await blockchain.treasury('bb-neg-stonfi-pool-owner');
  const wrongPoolOwner = await blockchain.treasury('bb-neg-wrong-pool-owner');
  const stonfiPtonWallet = await blockchain.treasury('bb-neg-stonfi-pton-wallet');
  const stonfiReferral = await blockchain.treasury('bb-neg-stonfi-referral');

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
    athMasterInit,
    athMasterAddress,
    controller,
    feeAccumulator,
    operator,
    attacker,
    stonfiRouter,
    stonfiPoolOwner,
    wrongPoolOwner,
    stonfiPtonWallet,
    stonfiReferral,
    officialAthWallet,
    stonfiAskJettonWallet,
  };
}

function routeFreeze(
  env: Awaited<ReturnType<typeof setup>>,
  overrides: Partial<FreezeBuybackRoute> = {},
): FreezeBuybackRoute {
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

async function freezeAndSeal(env: Awaited<ReturnType<typeof setup>>) {
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

  await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, routeFreeze(env));

  await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealBuybackBurnGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealBuybackBurnGenesis);
}

async function acceptReserve(env: Awaited<ReturnType<typeof setup>>) {
  await env.buyback.send(env.feeAccumulator.getSender(), { value: ENVELOPE + ACCEPT_RESERVE_EXEC_RESERVE }, {
    $$type: 'AcceptBurnReserve',
    amount: ENVELOPE,
  } as AcceptBurnReserve);
}

async function executeBuyback(env: Awaited<ReturnType<typeof setup>>, queryId = 77n) {
  await env.buyback.send(env.operator.getSender(), { value: toNano('0.1') }, {
    $$type: 'ExecuteBuybackChunk',
    query_id: queryId,
    deadline: BigInt((env.blockchain.now ?? 0) + 600),
    quote_out_atomic_ath: 100_000n,
    dex_min_out_atomic_ath: 95_000n,
  } as ExecuteBuybackChunk);
}

async function sendStonfiAthNotify(
  env: Awaited<ReturnType<typeof setup>>,
  owner: Address,
  sender: ReturnType<typeof env.stonfiPoolOwner.getSender>,
  amount: bigint,
  queryId: bigint,
  notifyValue = toNano('0.1'),
) {
  const sourceWallet = await deployAthWallet(
    env.blockchain,
    owner,
    env.athMasterAddress,
    500_000n,
  );

  await sourceWallet.send(sender, { value: toNano('0.3') }, {
    $$type: 'ATHTransferRequestWithNotify',
    query_id: queryId,
    amount,
    recipient: env.buyback.address,
    response_destination: owner,
    notify_destination: env.buyback.address,
    notify_value: notifyValue,
  } as ATHTransferRequestWithNotify);
}

describe('BuybackBurn auth and negative matrix', () => {
  it('rejects forged genesis actions, inconsistent manifests, and invalid route freeze parameters', async () => {
    const env = await setup();

    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindBuybackFeeAccumulator',
      deployment_manifest_hash: MANIFEST_HASH,
      fee_accumulator_address: env.attacker.address,
    } as BindBuybackFeeAccumulator);
    expect((await env.buyback.getGetBuybackBurnConfig()).fee_bound).toBe(false);

    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindBuybackFeeAccumulator',
      deployment_manifest_hash: MANIFEST_HASH,
      fee_accumulator_address: env.feeAccumulator.address,
    } as BindBuybackFeeAccumulator);

    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindBuybackOfficialAthWallet',
      deployment_manifest_hash: ALT_MANIFEST_HASH,
      official_ath_wallet_address: env.officialAthWallet,
    } as BindBuybackOfficialAthWallet);
    expect((await env.buyback.getGetBuybackBurnConfig()).official_ath_wallet_bound).toBe(false);

    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindBuybackOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: env.officialAthWallet,
    } as BindBuybackOfficialAthWallet);

    for (const invalidRoute of [
      routeFreeze(env, { buyback_min_ath_out_per_50_ton_atomic: 0n }),
      routeFreeze(env, { route_evidence_hash: 0n }),
      routeFreeze(env, { referral_value_bps: 101n }),
      routeFreeze(env, { ask_jetton_wallet_address: fixtureAddress('WRONG_ASK_WALLET') }),
      routeFreeze(env, { evidence_quote_out_atomic_ath: 100_000n, evidence_dex_min_out_atomic_ath: 94_999n }),
      routeFreeze(env, { evidence_quote_out_atomic_ath: 200_000n, evidence_dex_min_out_atomic_ath: 189_999n }),
    ]) {
      await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, invalidRoute);
      expect((await env.buyback.getGetBuybackBurnConfig()).route_frozen).toBe(false);
    }

    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, routeFreeze(env));

    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealBuybackBurnGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealBuybackBurnGenesis);
    expect((await env.buyback.getGetBuybackBurnConfig()).sealed).toBe(false);

    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealBuybackBurnGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealBuybackBurnGenesis);

    const sealed = await env.buyback.getGetBuybackBurnConfig();
    expect(sealed.sealed).toBe(true);
    expect(sealed.genesis_config_hash).toBe(0n);
  });

  it('accepts reserve only from the bound FeeAccumulator with exact envelope and backed value', async () => {
    const env = await setup();

    await env.buyback.send(env.feeAccumulator.getSender(), { value: ENVELOPE + ACCEPT_RESERVE_EXEC_RESERVE }, {
      $$type: 'AcceptBurnReserve',
      amount: ENVELOPE,
    } as AcceptBurnReserve);
    expect((await env.buyback.getGetBuybackBurnState()).reserve_due_ton).toBe(0n);

    await freezeAndSeal(env);

    for (const [sender, value, amount] of [
      [env.attacker.getSender(), ENVELOPE, ENVELOPE],
      [env.feeAccumulator.getSender(), OFFER, OFFER],
      [env.feeAccumulator.getSender(), ENVELOPE - 1n, ENVELOPE],
    ] as const) {
      await env.buyback.send(sender, { value }, {
        $$type: 'AcceptBurnReserve',
        amount,
      } as AcceptBurnReserve);
      expect((await env.buyback.getGetBuybackBurnState()).reserve_due_ton).toBe(0n);
      expect((await env.buyback.getGetBuybackBurnTotals()).accepted_reserve_count).toBe(0n);
    }

    await acceptReserve(env);
    expect((await env.buyback.getGetBuybackBurnState()).reserve_due_ton).toBe(ENVELOPE);
    expect((await env.buyback.getGetBuybackBurnTotals()).accepted_reserve_count).toBe(1n);
  });

  it('rejects malformed or underfunded execute requests and preserves pending single-flight state', async () => {
    const env = await setup();
    await freezeAndSeal(env);

    await executeBuyback(env, 1n);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_IDLE);

    await acceptReserve(env);

    const now = BigInt(env.blockchain.now ?? 0);
    const invalidExecs: ExecuteBuybackChunk[] = [
      { $$type: 'ExecuteBuybackChunk', query_id: 0n, deadline: now + 600n, quote_out_atomic_ath: 100_000n, dex_min_out_atomic_ath: 95_000n },
      { $$type: 'ExecuteBuybackChunk', query_id: 2n, deadline: now, quote_out_atomic_ath: 100_000n, dex_min_out_atomic_ath: 95_000n },
      { $$type: 'ExecuteBuybackChunk', query_id: 3n, deadline: now + 901n, quote_out_atomic_ath: 100_000n, dex_min_out_atomic_ath: 95_000n },
      { $$type: 'ExecuteBuybackChunk', query_id: 4n, deadline: now + 600n, quote_out_atomic_ath: 0n, dex_min_out_atomic_ath: 95_000n },
      { $$type: 'ExecuteBuybackChunk', query_id: 5n, deadline: now + 600n, quote_out_atomic_ath: 100_000n, dex_min_out_atomic_ath: 94_999n },
      { $$type: 'ExecuteBuybackChunk', query_id: 6n, deadline: now + 600n, quote_out_atomic_ath: 200_000n, dex_min_out_atomic_ath: 189_999n },
    ];

    for (const msg of invalidExecs) {
      await env.buyback.send(env.operator.getSender(), { value: toNano('0.1') }, msg);
      const state = await env.buyback.getGetBuybackBurnState();
      expect(state.phase).toBe(PHASE_IDLE);
      expect(state.reserve_due_ton).toBe(ENVELOPE);
    }

    await env.buyback.send(env.operator.getSender(), { value: PTON_TRANSFER_GAS - 1n }, {
      $$type: 'ExecuteBuybackChunk',
      query_id: 7n,
      deadline: now + 600n,
      quote_out_atomic_ath: 100_000n,
      dex_min_out_atomic_ath: 95_000n,
    } as ExecuteBuybackChunk);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_IDLE);
    expect((await env.buyback.getGetBuybackBurnState()).reserve_due_ton).toBe(ENVELOPE);

    await executeBuyback(env, 8n);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_PENDING_STONFI_SWAP);

    await acceptReserve(env);
    await executeBuyback(env, 9n);
    const pending = await env.buyback.getGetBuybackBurnState();
    expect(pending.phase).toBe(PHASE_PENDING_STONFI_SWAP);
    expect(pending.pending_query_id).toBe(8n);
    expect(pending.reserve_due_ton).toBe(ENVELOPE);
  });

  it('keeps STON.fi swap pending across forged or invalid ATH notifications', async () => {
    const env = await setup();
    await freezeAndSeal(env);
    await acceptReserve(env);
    await executeBuyback(env, 20n);

    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification',
      query_id: 20n,
      amount: 100_000n,
      sender_key: 0n,
      sender_wallet: env.stonfiPoolOwner.address,
    } as AthTransferNotification);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_PENDING_STONFI_SWAP);

    await sendStonfiAthNotify(env, env.stonfiPoolOwner.address, env.stonfiPoolOwner.getSender(), 94_999n, 20n);
    let state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_PENDING_STONFI_SWAP);
    expect(state.pending_received_ath_atomic).toBe(0n);

    await sendStonfiAthNotify(env, env.wrongPoolOwner.address, env.wrongPoolOwner.getSender(), 100_000n, 20n);
    state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_PENDING_STONFI_SWAP);
    expect(state.pending_received_ath_atomic).toBe(0n);

    await sendStonfiAthNotify(env, env.stonfiPoolOwner.address, env.stonfiPoolOwner.getSender(), 100_000n, 20n, toNano('0.02'));
    state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_PENDING_STONFI_SWAP);
    expect(state.pending_received_ath_atomic).toBe(0n);
  });

  it('rejects premature route recovery and recycles only a full returned envelope with caller-funded reserve', async () => {
    const env = await setup();
    await freezeAndSeal(env);

    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.1') }, null);
    expect((await env.buyback.getGetBuybackBurnState()).route_refund_due_ton).toBe(0n);

    await acceptReserve(env);
    await executeBuyback(env, 30n);

    await env.buyback.send(env.stonfiRouter.getSender(), { value: toNano('48.999') }, null);
    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'RecoverStonfiRouteRefund',
      query_id: 30n,
    } as RecoverStonfiRouteRefund);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_PENDING_STONFI_SWAP);

    env.blockchain.now = (env.blockchain.now ?? 0) + 1501;
    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'RecoverStonfiRouteRefund',
      query_id: 30n,
    } as RecoverStonfiRouteRefund);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_PENDING_STONFI_SWAP);

    await env.buyback.send(env.stonfiPoolOwner.getSender(), { value: toNano('0.005') }, null);
    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'RecoverStonfiRouteRefund',
      query_id: 31n,
    } as RecoverStonfiRouteRefund);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_PENDING_STONFI_SWAP);

    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'RecoverStonfiRouteRefund',
      query_id: 30n,
    } as RecoverStonfiRouteRefund);
    let state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.reserve_due_ton).toBe(0n);

    await env.buyback.send(env.attacker.getSender(), { value: ACCOUNTING_RECYCLE_EXEC_RESERVE }, {
      $$type: 'RecycleRouteRefundReserve',
    } as RecycleRouteRefundReserve);
    state = await env.buyback.getGetBuybackBurnState();
    expect(state.reserve_due_ton).toBe(0n);
    expect(state.route_refund_due_ton).toBe(
      routeRefundCredit(toNano('48.999')) + routeRefundCredit(toNano('0.005')),
    );

    await env.buyback.send(env.stonfiRouter.getSender(), { value: ENVELOPE }, null);
    await env.buyback.send(env.attacker.getSender(), { value: ACCOUNTING_RECYCLE_EXEC_RESERVE - 1n }, {
      $$type: 'RecycleRouteRefundReserve',
    } as RecycleRouteRefundReserve);
    state = await env.buyback.getGetBuybackBurnState();
    expect(state.reserve_due_ton).toBe(0n);

    await env.buyback.send(env.attacker.getSender(), { value: ACCOUNTING_RECYCLE_EXEC_RESERVE }, {
      $$type: 'RecycleRouteRefundReserve',
    } as RecycleRouteRefundReserve);
    state = await env.buyback.getGetBuybackBurnState();
    expect(state.reserve_due_ton).toBe(ENVELOPE);
    expect(state.route_refund_due_ton).toBe(
      routeRefundCredit(toNano('48.999'))
        + routeRefundCredit(toNano('0.005'))
        + routeRefundCredit(ENVELOPE)
        - ENVELOPE,
    );
  });

  it('keeps ATH retry due unchanged across malformed retry attempts', async () => {
    const env = await setup({ deployAthMaster: false });
    await freezeAndSeal(env);
    await acceptReserve(env);
    await executeBuyback(env, 40n);

    await sendStonfiAthNotify(env, env.stonfiPoolOwner.address, env.stonfiPoolOwner.getSender(), 100_000n, 40n);

    let state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.ath_burn_retry_due_atomic).toBe(100_000n);

    for (const [value, msg] of [
      [toNano('0.1'), { $$type: 'RetryAthBurnDue', query_id: 0n, amount: 100_000n }],
      [toNano('0.1'), { $$type: 'RetryAthBurnDue', query_id: 41n, amount: 100_001n }],
      [ATH_BURN_REQUEST_VALUE - 1n, { $$type: 'RetryAthBurnDue', query_id: 41n, amount: 100_000n }],
    ] as const) {
      await env.buyback.send(env.attacker.getSender(), { value }, msg as RetryAthBurnDue);
      state = await env.buyback.getGetBuybackBurnState();
      expect(state.phase).toBe(PHASE_IDLE);
      expect(state.ath_burn_retry_due_atomic).toBe(100_000n);
    }

    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.1') }, {
      $$type: 'ATHBurnFailed',
      query_id: 40n,
      amount: 100_000n,
    } as ATHBurnFailed);
    state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.ath_burn_retry_due_atomic).toBe(100_000n);

    await env.blockchain.setShardAccount(env.athMasterAddress, createShardAccount({
      address: env.athMasterAddress,
      code: env.athMasterInit.code,
      data: env.athMasterInit.data,
      balance: toNano('2'),
      workchain: env.athMasterAddress.workChain,
    }));

    await env.buyback.send(env.operator.getSender(), { value: toNano('0.1') }, {
      $$type: 'RetryAthBurnDue',
      query_id: 41n,
      amount: 100_000n,
    } as RetryAthBurnDue);

    state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.ath_burn_retry_due_atomic).toBe(0n);
    expect((await env.buyback.getGetBuybackBurnTotals()).executed_buyback_count).toBe(1n);
  });
});
