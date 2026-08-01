import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  AcceptBurnReserve,
  ATHBurnFailed,
  ATHBurnFinalized,
  AthTransferNotification,
  BindBuybackFeeAccumulator,
  BindBuybackOfficialAthWallet,
  BindBuybackTreasury,
  BuybackBurn,
  storeBuybackBurn$Data,
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
  JettonTransfer,
  JettonTransferNotification,
} from '../build/ATHWallet/ATHWallet_ATHWallet';

const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const ALT_MANIFEST_HASH = MANIFEST_HASH + 1n;
const ROUTE_EVIDENCE_HASH = 0x111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000n;
const ENVELOPE = toNano('51.05');
const ACCEPT_RESERVE_EXEC_RESERVE = 2_000_000n;
const ROUTE_REFUND_EXEC_RESERVE = 2_000_000n;
const ROUTE_REFUND_RECOVERY_EXEC_RESERVE = 2_000_000n;
const OFFER = toNano('50');
const PTON_TRANSFER_GAS = 50_000_000n;
const ACCOUNTING_RECYCLE_EXEC_RESERVE = 2_000_000n;
const ATH_BURN_REQUEST_VALUE = 30_000_000n;
// 2026-07-20: ATHWallet.ATH_TRANSFER_NOTIFY_MIN_VALUE floor rose to 45M and BuybackBurn's paired route-notify
// buffer went 35M->50M (BuybackBurn.tact:16-27). A forward_ton_amount below 45M is now rejected at ATHWallet
// gate 14703, so the STON.fi notification never fires and the phase stays PENDING_STONFI_SWAP. Must be >= 45M;
// the canonical production suite (buybackburn-production.test.ts:54) already uses 50M.
const BUYBACK_ROUTE_NOTIFY_MIN_VALUE = 50_000_000n;
const PHASE_IDLE = 0n;
const PHASE_PENDING_STONFI_SWAP = 1n;
const BURN_DEADMAN_GRACE_SECONDS = 21600; // BUYBACK_STUCK_BURN_DEADMAN_GRACE_SECONDS
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
  const stonfiAthSourceOwner = await blockchain.treasury('bb-neg-stonfi-ath-source-owner');
  const wrongPoolOwner = await blockchain.treasury('bb-neg-wrong-pool-owner');
  const stonfiPtonWallet = await blockchain.treasury('bb-neg-stonfi-pton-wallet');
  const stonfiReferral = await blockchain.treasury('bb-neg-stonfi-referral');
  const sweepTreasury = await blockchain.treasury('bb-neg-sweep-treasury');

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
    buybackInit,
    athMaster,
    athMasterInit,
    athMasterAddress,
    controller,
    feeAccumulator,
    operator,
    attacker,
    stonfiRouter,
    stonfiPoolOwner,
    stonfiAthSourceOwner,
    wrongPoolOwner,
    stonfiPtonWallet,
    stonfiReferral,
    sweepTreasury,
    officialAthWallet,
    stonfiAskJettonWallet,
  };
}

async function forcePendingAthBurn(
  env: Awaited<ReturnType<typeof setup>>,
  queryId = 7n,
  amount = 123_456n,
) {
  const balance = (await env.blockchain.getContract(env.buyback.address)).balance;
  const data = beginCell().storeBit(true).store(storeBuybackBurn$Data({
    $$type: 'BuybackBurn$Data',
    genesis_config_hash: 0n,
    deployment_manifest_hash: MANIFEST_HASH,
    ath_master_address: env.athMasterAddress,
    fee_accumulator_address: env.feeAccumulator.address,
    official_ath_wallet_address: env.officialAthWallet,
    stonfi_router_address: env.stonfiRouter.address,
    stonfi_pool_address_ton_ath: env.stonfiPoolOwner.address,
    stonfi_ath_source_owner_address: env.stonfiAthSourceOwner.address,
    stonfi_pton_wallet_address: env.stonfiPtonWallet.address,
    ask_jetton_wallet_address: env.stonfiAskJettonWallet,
    stonfi_referral_address: env.stonfiReferral.address,
    fee_bound: true,
    official_ath_wallet_bound: true,
    route_frozen: true,
    sealed: true,
    treasury_address: env.sweepTreasury.address,
    treasury_bound: true,
    last_burn_at: BigInt(env.blockchain.now ?? 0),
    // [2026-07-29] The dead-man gate reads its OWN clock now, not last_burn_at — see the wave-8 fix in
    // contracts/BuybackBurn.tact. This fixture forges post-seal state by hand, so it must carry both.
    deadman_armed_at: BigInt(env.blockchain.now ?? 0),
    referral_value_bps: 0n,
    buyback_min_ath_out_per_50_ton_atomic: 95_000n,
    evidence_quote_out_atomic_ath: 100_000n,
    evidence_dex_min_out_atomic_ath: 95_000n,
    route_evidence_hash: ROUTE_EVIDENCE_HASH,
    phase: PHASE_PENDING_ATH_BURN,
    reserve_due_ton: 0n,
    pending_query_id: queryId,
    pending_deadline: BigInt((env.blockchain.now ?? 0) + 600),
    pending_route_refund_start_ton: 0n,
    pending_dex_min_out_atomic_ath: 95_000n,
    pending_received_ath_atomic: amount,
    pending_burn_at: BigInt(env.blockchain.now ?? 0),
    route_refund_due_ton: 0n,
    ath_burn_retry_due_atomic: 0n,
    last_terminal_query_id: queryId - 1n,
    accepted_reserve_count: 1n,
    executed_buyback_count: 0n,
    burned_ath_total_atomic: 0n,
  })).endCell();
  await env.blockchain.setShardAccount(env.buyback.address, createShardAccount({
    address: env.buyback.address,
    code: env.buybackInit.code,
    data,
    balance,
    workchain: env.buyback.address.workChain,
  }));
}

type BuybackBurnData = Parameters<typeof storeBuybackBurn$Data>[0];

async function forceSealedUnfrozenPostSealState(
  env: Awaited<ReturnType<typeof setup>>,
  overrides: Partial<BuybackBurnData> = {},
) {
  const balance = (await env.blockchain.getContract(env.buyback.address)).balance;
  const base: BuybackBurnData = {
    $$type: 'BuybackBurn$Data',
    genesis_config_hash: addressHash(env.controller.address),
    deployment_manifest_hash: MANIFEST_HASH,
    ath_master_address: env.athMasterAddress,
    fee_accumulator_address: env.feeAccumulator.address,
    official_ath_wallet_address: env.officialAthWallet,
    stonfi_router_address: env.stonfiRouter.address,
    stonfi_pool_address_ton_ath: env.stonfiPoolOwner.address,
    stonfi_ath_source_owner_address: env.stonfiAthSourceOwner.address,
    stonfi_pton_wallet_address: env.stonfiPtonWallet.address,
    ask_jetton_wallet_address: env.stonfiAskJettonWallet,
    stonfi_referral_address: env.stonfiReferral.address,
    fee_bound: true,
    official_ath_wallet_bound: true,
    route_frozen: false,
    sealed: true,
    treasury_address: env.sweepTreasury.address,
    treasury_bound: true,
    last_burn_at: BigInt(env.blockchain.now ?? 0),
    // [2026-07-29] The dead-man gate reads its OWN clock now, not last_burn_at — see the wave-8 fix in
    // contracts/BuybackBurn.tact. This fixture forges post-seal state by hand, so it must carry both.
    deadman_armed_at: BigInt(env.blockchain.now ?? 0),
    referral_value_bps: 0n,
    buyback_min_ath_out_per_50_ton_atomic: 0n,
    evidence_quote_out_atomic_ath: 0n,
    evidence_dex_min_out_atomic_ath: 0n,
    route_evidence_hash: 0n,
    phase: PHASE_IDLE,
    reserve_due_ton: 0n,
    pending_query_id: 0n,
    pending_deadline: 0n,
    pending_route_refund_start_ton: 0n,
    pending_dex_min_out_atomic_ath: 0n,
    pending_received_ath_atomic: 0n,
    pending_burn_at: 0n,
    route_refund_due_ton: 0n,
    ath_burn_retry_due_atomic: 0n,
    last_terminal_query_id: 0n,
    accepted_reserve_count: 0n,
    executed_buyback_count: 0n,
    burned_ath_total_atomic: 0n,
  };
  const data = beginCell().storeBit(true).store(storeBuybackBurn$Data({
    ...base,
    ...overrides,
    $$type: 'BuybackBurn$Data',
  })).endCell();
  await env.blockchain.setShardAccount(env.buyback.address, createShardAccount({
    address: env.buyback.address,
    code: env.buybackInit.code,
    data,
    balance,
    workchain: env.buyback.address.workChain,
  }));
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
    $$type: 'BindBuybackTreasury',
    deployment_manifest_hash: MANIFEST_HASH,
    treasury_address: env.sweepTreasury.address,
  } as BindBuybackTreasury);

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

async function executeBuyback(env: Awaited<ReturnType<typeof setup>>, queryId = 1n) {
  await env.buyback.send(env.operator.getSender(), { value: toNano('0.1') }, {
    $$type: 'ExecuteBuybackChunk',
    query_id: queryId,
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
  notifyValue = BUYBACK_ROUTE_NOTIFY_MIN_VALUE,
) {
  const sourceWallet = await deployAthWallet(
    env.blockchain,
    owner,
    env.athMasterAddress,
    500_000n,
  );

  // clean-12: STON.fi's router pays out via a STANDARD TEP-74 jetton transfer, so simulate the swap-out with a
  // JettonTransfer to the source ATH wallet (destination = BuybackBurn). Its wallet then emits the standard
  // 0x7362D09C JettonTransferNotification that BuybackBurn (Lane A) consumes — NOT the old custom Lane B path.
  await sourceWallet.send(sender, { value: toNano('0.5') }, {
    $$type: 'JettonTransfer',
    query_id: queryId,
    amount,
    destination: env.buyback.address,
    response_destination: owner,
    custom_payload: null,
    forward_ton_amount: notifyValue,
    forward_payload: beginCell().endCell().asSlice(),
  } as JettonTransfer);
}

function exitOf(res: any, dest: Address): number {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());
  return Number(tx?.description?.computePhase?.exitCode ?? -999);
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
      routeFreeze(env, { ask_jetton_wallet_address: fixtureAddress('MASTERCHAIN_ASK_WALLET', -1) }),
      routeFreeze(env, { ask_jetton_wallet_address: fixtureAddress('MISMATCHED_BASECHAIN_ASK_WALLET') }),
      routeFreeze(env, { evidence_quote_out_atomic_ath: 100_000n, evidence_dex_min_out_atomic_ath: 94_999n }),
      routeFreeze(env, { evidence_quote_out_atomic_ath: 200_000n, evidence_dex_min_out_atomic_ath: 189_999n }),
      routeFreeze(env, { evidence_quote_out_atomic_ath: 100_000n, evidence_dex_min_out_atomic_ath: 100_001n }),
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
      $$type: 'BindBuybackTreasury',
      deployment_manifest_hash: MANIFEST_HASH,
      treasury_address: env.sweepTreasury.address,
    } as BindBuybackTreasury);

    await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealBuybackBurnGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealBuybackBurnGenesis);

    const sealed = await env.buyback.getGetBuybackBurnConfig();
    expect(sealed.sealed).toBe(true);
    expect(sealed.genesis_config_hash).toBe(0n);
  });

  it('RT-BUY-005: rejects post-seal route freeze after any dirty money-state blocker', async () => {
    const cases: Array<[string, Partial<BuybackBurnData>]> = [
      ['reserve_due_ton', { reserve_due_ton: 1n }],
      ['route_refund_due_ton', { route_refund_due_ton: 1n }],
      ['ath_burn_retry_due_atomic', { ath_burn_retry_due_atomic: 1n }],
      ['accepted_reserve_count', { accepted_reserve_count: 1n }],
      ['phase', {
        phase: PHASE_PENDING_STONFI_SWAP,
        pending_query_id: 1n,
        pending_deadline: 1_700_001_000n,
        pending_route_refund_start_ton: 0n,
        pending_dex_min_out_atomic_ath: 95_000n,
      }],
    ];

    for (const [, overrides] of cases) {
      const env = await setup();
      await forceSealedUnfrozenPostSealState(env, overrides);

      await env.buyback.send(env.controller.getSender(), { value: toNano('0.05') }, routeFreeze(env));

      const config = await env.buyback.getGetBuybackBurnConfig();
      expect(config.route_frozen).toBe(false);
      expect(config.genesis_config_hash).toBe(addressHash(env.controller.address));
    }
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

    const invalidExecs: ExecuteBuybackChunk[] = [
      { $$type: 'ExecuteBuybackChunk', query_id: 0n, quote_out_atomic_ath: 100_000n, dex_min_out_atomic_ath: 95_000n },
      { $$type: 'ExecuteBuybackChunk', query_id: 2n, quote_out_atomic_ath: 100_000n, dex_min_out_atomic_ath: 95_000n },
      { $$type: 'ExecuteBuybackChunk', query_id: 1n, quote_out_atomic_ath: 0n, dex_min_out_atomic_ath: 95_000n },
      { $$type: 'ExecuteBuybackChunk', query_id: 1n, quote_out_atomic_ath: 100_000n, dex_min_out_atomic_ath: 94_999n },
      { $$type: 'ExecuteBuybackChunk', query_id: 1n, quote_out_atomic_ath: 200_000n, dex_min_out_atomic_ath: 189_999n },
      { $$type: 'ExecuteBuybackChunk', query_id: 1n, quote_out_atomic_ath: 200_000n, dex_min_out_atomic_ath: 190_000n },
      { $$type: 'ExecuteBuybackChunk', query_id: 1n, quote_out_atomic_ath: 100_000n, dex_min_out_atomic_ath: 100_001n },
    ];

    for (const msg of invalidExecs) {
      await env.buyback.send(env.operator.getSender(), { value: toNano('0.1') }, msg);
      const state = await env.buyback.getGetBuybackBurnState();
      expect(state.phase).toBe(PHASE_IDLE);
      expect(state.reserve_due_ton).toBe(ENVELOPE);
    }

    await env.buyback.send(env.operator.getSender(), { value: PTON_TRANSFER_GAS - 1n }, {
      $$type: 'ExecuteBuybackChunk',
      query_id: 1n,
      quote_out_atomic_ath: 100_000n,
      dex_min_out_atomic_ath: 95_000n,
    } as ExecuteBuybackChunk);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_IDLE);
    expect((await env.buyback.getGetBuybackBurnState()).reserve_due_ton).toBe(ENVELOPE);

    await executeBuyback(env, 1n);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_PENDING_STONFI_SWAP);

    await acceptReserve(env);
    await executeBuyback(env, 2n);
    const pending = await env.buyback.getGetBuybackBurnState();
    expect(pending.phase).toBe(PHASE_PENDING_STONFI_SWAP);
    expect(pending.pending_query_id).toBe(1n);
    expect(pending.reserve_due_ton).toBe(ENVELOPE);
  });

  it('keeps STON.fi swap pending across forged or invalid ATH notifications', async () => {
    const env = await setup();
    await freezeAndSeal(env);
    await acceptReserve(env);
    await executeBuyback(env, 1n);

    // forged standard notification straight from the attacker (not from BuybackBurn's official ATH wallet) -> 22300
    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.1') }, {
      $$type: 'JettonTransferNotification',
      query_id: 1n,
      amount: 100_000n,
      sender: env.stonfiAthSourceOwner.address,
      forward_payload: beginCell().endCell().asSlice(),
    } as JettonTransferNotification);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_PENDING_STONFI_SWAP);

    await sendStonfiAthNotify(env, env.stonfiAthSourceOwner.address, env.stonfiAthSourceOwner.getSender(), 94_999n, 1n);
    let state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_PENDING_STONFI_SWAP);
    expect(state.pending_received_ath_atomic).toBe(0n);

    await sendStonfiAthNotify(env, env.wrongPoolOwner.address, env.wrongPoolOwner.getSender(), 100_000n, 1n);
    state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_PENDING_STONFI_SWAP);
    expect(state.pending_received_ath_atomic).toBe(0n);

    // [CORRECTED 2026-08-01] This case used to assert the swap stays PENDING, and it did — but for a reason outside
    // BuybackBurn: ATHWallet's gate 14703 refused every forward_ton_amount between 1 and 45,000,000, so a 0.02
    // notification never left the sender's wallet. That floor has been removed from the standard lane (it belonged
    // to the custom notify lanes, and it made ATH unsendable with a comment), so the notification now arrives and
    // BuybackBurn's OWN under-funded branch runs — the one at `context().value < BUYBACK_ROUTE_NOTIFY_MIN_VALUE`.
    //
    // That branch is not a failure path: it books the ATH as burn-due for retry and closes the cycle, losing
    // nothing. So the assertion changes from "nothing happened" to "the designed retry path happened", which is a
    // stronger check — the branch was previously unreachable at this value and therefore never exercised end to end.
    const beforeRetryDue = (await env.buyback.getGetBuybackBurnState()).ath_burn_retry_due_atomic;
    await sendStonfiAthNotify(env, env.stonfiAthSourceOwner.address, env.stonfiAthSourceOwner.getSender(), 100_000n, 1n, toNano('0.02'));
    state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase, 'an under-funded notification must close the cycle, not strand it').toBe(PHASE_IDLE);
    expect(state.pending_received_ath_atomic, 'and must not be treated as a received swap').toBe(0n);
    expect(state.ath_burn_retry_due_atomic - beforeRetryDue,
      'the ATH must be booked as burn-due for retry rather than dropped').toBe(100_000n);
  });

  it('rejects premature route recovery and recycles only a full returned envelope with caller-funded reserve', async () => {
    const env = await setup();
    await freezeAndSeal(env);

    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.1') }, null);
    expect((await env.buyback.getGetBuybackBurnState()).route_refund_due_ton).toBe(0n);

    await acceptReserve(env);
    await executeBuyback(env, 1n);

    await env.buyback.send(env.stonfiRouter.getSender(), { value: toNano('48.999') }, null);
    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'RecoverStonfiRouteRefund',
      query_id: 1n,
    } as RecoverStonfiRouteRefund);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_PENDING_STONFI_SWAP);

    env.blockchain.now = (env.blockchain.now ?? 0) + 1801;
    await env.buyback.send(env.attacker.getSender(), { value: ROUTE_REFUND_RECOVERY_EXEC_RESERVE - 1n }, {
      $$type: 'RecoverStonfiRouteRefund',
      query_id: 1n,
    } as RecoverStonfiRouteRefund);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_PENDING_STONFI_SWAP);

    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'RecoverStonfiRouteRefund',
      query_id: 1n,
    } as RecoverStonfiRouteRefund);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_PENDING_STONFI_SWAP);

    await env.buyback.send(env.stonfiPoolOwner.getSender(), { value: toNano('0.005') }, null);
    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'RecoverStonfiRouteRefund',
      query_id: 2n,
    } as RecoverStonfiRouteRefund);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_PENDING_STONFI_SWAP);

    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'RecoverStonfiRouteRefund',
      query_id: 1n,
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
    await executeBuyback(env, 1n);

    await sendStonfiAthNotify(env, env.stonfiAthSourceOwner.address, env.stonfiAthSourceOwner.getSender(), 100_000n, 1n);

    let state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.ath_burn_retry_due_atomic).toBe(100_000n);

    for (const [value, msg] of [
      [toNano('0.1'), { $$type: 'RetryAthBurnDue', query_id: 0n, amount: 100_000n }],
      [toNano('0.1'), { $$type: 'RetryAthBurnDue', query_id: 2n, amount: 1n }],
      [toNano('0.1'), { $$type: 'RetryAthBurnDue', query_id: 2n, amount: 100_001n }],
      [ATH_BURN_REQUEST_VALUE - 1n, { $$type: 'RetryAthBurnDue', query_id: 2n, amount: 100_000n }],
      [ATH_BURN_REQUEST_VALUE, { $$type: 'RetryAthBurnDue', query_id: 2n, amount: 100_000n }],
      [ATH_BURN_REQUEST_VALUE + ROUTE_REFUND_EXEC_RESERVE - 1n, { $$type: 'RetryAthBurnDue', query_id: 2n, amount: 100_000n }],
    ] as const) {
      await env.buyback.send(env.attacker.getSender(), { value }, msg as RetryAthBurnDue);
      state = await env.buyback.getGetBuybackBurnState();
      expect(state.phase).toBe(PHASE_IDLE);
      expect(state.ath_burn_retry_due_atomic).toBe(100_000n);
      expect((await env.buyback.getGetBuybackBurnTotals()).executed_buyback_count).toBe(0n);
    }

    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.1') }, {
      $$type: 'ATHBurnFailed',
      query_id: 1n,
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

    await env.buyback.send(env.operator.getSender(), { value: ATH_BURN_REQUEST_VALUE + ROUTE_REFUND_EXEC_RESERVE }, {
      $$type: 'RetryAthBurnDue',
      query_id: 2n,
      amount: 100_000n,
    } as RetryAthBurnDue);

    state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.ath_burn_retry_due_atomic).toBe(0n);
    expect((await env.buyback.getGetBuybackBurnTotals()).executed_buyback_count).toBe(1n);
  });

  it('rejects malformed ATHMaster finalization while preserving pending burn state', async () => {
    const env = await setup();
    await forcePendingAthBurn(env, 7n, 123_456n);

    for (const [sender, msg] of [
      [env.attacker.address, { $$type: 'ATHBurnFinalized', query_id: 7n, amount: 123_456n, owner_address: env.buyback.address }],
      [env.athMasterAddress, { $$type: 'ATHBurnFinalized', query_id: 8n, amount: 123_456n, owner_address: env.buyback.address }],
      [env.athMasterAddress, { $$type: 'ATHBurnFinalized', query_id: 7n, amount: 123_457n, owner_address: env.buyback.address }],
      [env.athMasterAddress, { $$type: 'ATHBurnFinalized', query_id: 7n, amount: 123_456n, owner_address: env.attacker.address }],
    ] as const) {
      await env.buyback.send(env.blockchain.sender(sender), { value: toNano('0.01') }, msg as ATHBurnFinalized);
      const state = await env.buyback.getGetBuybackBurnState();
      const totals = await env.buyback.getGetBuybackBurnTotals();
      expect(state.phase).toBe(PHASE_PENDING_ATH_BURN);
      expect(state.pending_query_id).toBe(7n);
      expect(state.pending_received_ath_atomic).toBe(123_456n);
      expect(totals.executed_buyback_count).toBe(0n);
      expect(totals.burned_ath_total_atomic).toBe(0n);
    }

    await env.buyback.send(env.blockchain.sender(env.athMasterAddress), { value: toNano('0.01') }, {
      $$type: 'ATHBurnFinalized',
      query_id: 7n,
      amount: 123_456n,
      owner_address: env.buyback.address,
    } as ATHBurnFinalized);

    const state = await env.buyback.getGetBuybackBurnState();
    const totals = await env.buyback.getGetBuybackBurnTotals();
    expect(state.phase).toBe(PHASE_IDLE);
    expect(state.pending_query_id).toBe(0n);
    expect(state.pending_received_ath_atomic).toBe(0n);
    expect(totals.executed_buyback_count).toBe(1n);
    expect(totals.burned_ath_total_atomic).toBe(123_456n);
  });

  it('BURN-DEADMAN-01: [wave-8 MED] PENDING_ATH_BURN has a time-only exit, so a lost reply cannot brick the contract', async () => {
    // THE DEFECT THIS PINS. That phase had exactly three ways out and all three were the DELIVERY of a reply:
    // ATHBurnFinalized, ATHBurnFailed, or a bounce of our own ATHBurn. ATHMaster sends the finalization with
    // bounce:true and has no bounced handler for it, so a receiver-side failure here simply evaporated and the
    // contract stayed in PENDING_ATH_BURN forever — 22211 kills ExecuteBuybackChunk, 22360 kills the recycle,
    // 22540 kills the sweep, and genesis_config_hash is already zeroed so no controller can help. Meanwhile
    // AcceptBurnReserve does not check the phase and keeps pouring 51.05 GRAM into a contract that can neither
    // spend nor release it. F11 gave PENDING_STONFI_SWAP exactly this guarantee; the burn phase simply lacked it.
    const env = await setup();
    await forcePendingAthBurn(env, 7n, 123_456n);
    const stuckAt = env.blockchain.now ?? 0;

    const tooEarly = await env.buyback.send(env.operator.getSender(), { value: toNano('0.05') }, {
      $$type: 'RecoverStuckAthBurn', query_id: 7n,
    } as any);
    expect(exitOf(tooEarly, env.buyback.address), 'a live burn settles in seconds and must not be pre-empted').toBe(22382);
    expect((await env.buyback.getGetBuybackBurnState()).phase).toBe(PHASE_PENDING_ATH_BURN);

    const wrongId = await env.buyback.send(env.operator.getSender(), { value: toNano('0.05') }, {
      $$type: 'RecoverStuckAthBurn', query_id: 8n,
    } as any);
    expect(exitOf(wrongId, env.buyback.address), 'and it must name the cycle it is recovering').toBe(22381);

    env.blockchain.now = stuckAt + BURN_DEADMAN_GRACE_SECONDS + 1;
    await env.buyback.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'RecoverStuckAthBurn', query_id: 7n,
    } as any);

    const state = await env.buyback.getGetBuybackBurnState();
    expect(state.phase, 'past the grace ANY sender can unstick it — nothing is paid out, so this is safe').toBe(PHASE_IDLE);
    expect(state.pending_query_id).toBe(0n);
    expect(state.pending_burn_at).toBe(0n);
    // We cannot know whether the ATH burned or not, so it stays retryable. If it DID burn, the retry fails at the
    // wallet, returns as ATHBurnFailed and re-credits — loud and harmless. Losing real ATH to avoid that would be
    // the wrong trade.
    expect(state.ath_burn_retry_due_atomic, 'the ATH must remain accounted for').toBe(123_456n);

    // And the contract is genuinely usable again.
    const state2 = await env.buyback.getGetBuybackBurnState();
    expect(state2.phase).toBe(PHASE_IDLE);
  });
});
