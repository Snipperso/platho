import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  ATHTransferAck,
  ATHTransferFailed,
  AthTransferNotification,
  BindMarketStabilityOfficialAthWallet,
  BindMarketStabilityReserveFunder,
  BindMarketStabilityTreasury,
  BuyMarketStabilityAth,
  FlushMarketStabilityTreasuryTon,
  FreezeMarketStabilityPricing,
  MarketStabilitySeller,
  SealMarketStabilityGenesis,
} from '../build/MarketStabilitySeller/MarketStabilitySeller_MarketStabilitySeller';
import {
  ATHTransferRequestWithNotify,
  ATHWallet,
} from '../build/ATHWallet/ATHWallet_ATHWallet';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';

const MANIFEST_HASH = 0xababababababababababababababababababababababababababababababababn;
const PRICING_EVIDENCE_HASH = 0xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdn;
const TRANCHE = 3_000_000_000_000_000n;
const TOTAL_RESERVE = 45_000_000_000_000_000n;
const BASE_TRANCHE_PRICE = toNano('1');
const NOTIFY_VALUE = 80_000_000n;
const BUY_TRANSFER_REQUEST_VALUE = 30_000_000n;
const BUY_EXEC_RESERVE = 2_000_000n;
const FUNDING_NOTIFY_VALUE = toNano('0.2');

function addressHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

function senderKey(owner: Address): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(0x41544e49, 32)
    .storeAddress(owner)
    .endCell()
    .hash()
    .toString('hex')) % 4_294_967_296n;
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.MARKET.STABILITY.${label}`).digest());
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

async function athWalletAddress(owner: Address, athMaster: Address): Promise<Address> {
  const init = await ATHWallet.init(0n, owner, athMaster);
  return contractAddress(owner.workChain, init);
}

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const controller = await blockchain.treasury('market-stability-controller');
  const reserveFunder = await blockchain.treasury('market-stability-reserve-funder');
  const buyer = await blockchain.treasury('market-stability-buyer');
  const recipient = await blockchain.treasury('market-stability-recipient');
  const attacker = await blockchain.treasury('market-stability-attacker');
  const flusher = await blockchain.treasury('market-stability-flusher');
  const treasury = await blockchain.treasury('market-stability-ton-treasury');
  const athMaster = fixtureAddress('ATH_MASTER');

  const sellerInit = await MarketStabilitySeller.init(addressHash(controller.address), athMaster);
  const sellerAddress = contractAddress(0, sellerInit);
  await blockchain.setShardAccount(sellerAddress, createShardAccount({
    address: sellerAddress,
    code: sellerInit.code,
    data: sellerInit.data,
    balance: toNano('2'),
    workchain: sellerAddress.workChain,
  }));
  const seller = blockchain.openContract(new MarketStabilitySeller(sellerAddress, sellerInit));
  const officialAthWallet = await seller.getGetOfficialAthWalletAddress();

  const reserveFunderAthWallet = await deployAthWallet(
    blockchain,
    reserveFunder.address,
    athMaster,
    TOTAL_RESERVE + TRANCHE,
  );

  return {
    blockchain,
    seller,
    controller,
    reserveFunder,
    reserveFunderAthWallet,
    buyer,
    recipient,
    attacker,
    flusher,
    treasury,
    athMaster,
    officialAthWallet,
  };
}

async function bindFreezeSeal(env: Awaited<ReturnType<typeof setup>>) {
  await bindCore(env);

  await freezePricing(env);

  await env.seller.send(env.controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealMarketStabilityGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealMarketStabilityGenesis);
}

async function bindCore(env: Awaited<ReturnType<typeof setup>>) {
  await env.seller.send(env.controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindMarketStabilityReserveFunder',
    deployment_manifest_hash: MANIFEST_HASH,
    reserve_funder_address: env.reserveFunder.address,
  } as BindMarketStabilityReserveFunder);

  await env.seller.send(env.controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindMarketStabilityOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: env.officialAthWallet,
  } as BindMarketStabilityOfficialAthWallet);

  await env.seller.send(env.controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindMarketStabilityTreasury',
    deployment_manifest_hash: MANIFEST_HASH,
    ton_treasury_receiver_address: env.treasury.address,
  } as BindMarketStabilityTreasury);
}

async function freezePricing(env: Awaited<ReturnType<typeof setup>>) {
  await env.seller.send(env.controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'FreezeMarketStabilityPricing',
    deployment_manifest_hash: MANIFEST_HASH,
    base_tranche_price_nanotons: BASE_TRANCHE_PRICE,
    evidence_x1_tranche_quote_nanotons: BASE_TRANCHE_PRICE,
    pricing_evidence_hash: PRICING_EVIDENCE_HASH,
  } as FreezeMarketStabilityPricing);
}

async function sealOnly(env: Awaited<ReturnType<typeof setup>>) {
  await env.seller.send(env.controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealMarketStabilityGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealMarketStabilityGenesis);
}

async function fundReserve(env: Awaited<ReturnType<typeof setup>>, amount: bigint, queryId = 1n) {
  await fundReserveFrom(env, env.reserveFunder, env.reserveFunderAthWallet, amount, queryId);
}

async function fundReserveFrom(
  env: Awaited<ReturnType<typeof setup>>,
  sourceOwner: Awaited<ReturnType<Blockchain['treasury']>>,
  sourceAthWallet: Awaited<ReturnType<typeof deployAthWallet>>,
  amount: bigint,
  queryId = 1n,
) {
  await sourceAthWallet.send(sourceOwner.getSender(), { value: FUNDING_NOTIFY_VALUE }, {
    $$type: 'ATHTransferRequestWithNotify',
    query_id: queryId,
    amount,
    recipient: env.seller.address,
    response_destination: sourceOwner.address,
    notify_destination: env.seller.address,
    notify_value: NOTIFY_VALUE,
  } as ATHTransferRequestWithNotify);
}

async function officialSellerAthWallet(env: Awaited<ReturnType<typeof setup>>) {
  return env.blockchain.openContract(new ATHWallet(env.officialAthWallet, await ATHWallet.init(0n, env.seller.address, env.athMaster)));
}

async function deployWrongMasterAthWalletAt(
  blockchain: Blockchain,
  address: Address,
  owner: Address,
  correctMaster: Address,
  wrongMaster: Address,
  athBalance: bigint,
) {
  const correctInit = await ATHWallet.init(0n, owner, correctMaster);
  const wrongDataInit = await ATHWallet.init(athBalance, owner, wrongMaster);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: correctInit.code,
    data: wrongDataInit.data,
    balance: toNano('1'),
    workchain: address.workChain,
  }));
  return blockchain.openContract(new ATHWallet(address, correctInit));
}

describe('MarketStabilitySeller', () => {
  it('MSTAB-01: binds, freezes pricing, accepts reserve funding, and clears ATHWallet notification pending', async () => {
    const env = await setup();

    await env.seller.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindMarketStabilityReserveFunder',
      deployment_manifest_hash: MANIFEST_HASH,
      reserve_funder_address: env.attacker.address,
    } as BindMarketStabilityReserveFunder);
    expect((await env.seller.getGetMarketStabilitySellerConfig()).reserve_funder_bound).toBe(false);

    await bindFreezeSeal(env);
    const config = await env.seller.getGetMarketStabilitySellerConfig();
    expect(config.sealed).toBe(true);
    expect(config.pricing_frozen).toBe(true);
    expect(config.genesis_config_hash).toBe(0n);
    expect(config.official_ath_wallet_address.equals(env.officialAthWallet)).toBe(true);

    await fundReserve(env, TRANCHE * 2n);

    const state = await env.seller.getGetMarketStabilitySellerState();
    expect(state.reserve_due_ath).toBe(TRANCHE * 2n);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).reserve_funded_total_ath).toBe(TRANCHE * 2n);

    const officialWallet = env.blockchain.openContract(new ATHWallet(env.officialAthWallet, await ATHWallet.init(0n, env.seller.address, env.athMaster)));
    expect((await officialWallet.getGetWalletData()).balance).toBe(TRANCHE * 2n);
    const pending = await officialWallet.getGetPendingNotification(1n, senderKey(env.reserveFunder.address));
    expect(pending.exists).toBe(false);
  });

  it('MSTAB-01B: can seal before pool pricing, then freeze pricing once before reserve funding', async () => {
    const env = await setup();
    await bindCore(env);
    await sealOnly(env);
    const reserveFunderInitialAth = (await env.reserveFunderAthWallet.getGetWalletData()).balance;

    let config = await env.seller.getGetMarketStabilitySellerConfig();
    expect(config.sealed).toBe(true);
    expect(config.pricing_frozen).toBe(false);
    expect(config.genesis_config_hash).not.toBe(0n);

    await fundReserve(env, TRANCHE);
    expect((await env.seller.getGetMarketStabilitySellerState()).reserve_due_ath).toBe(0n);
    expect((await env.reserveFunderAthWallet.getGetWalletData()).balance).toBe(reserveFunderInitialAth);
    expect((await (await officialSellerAthWallet(env)).getGetWalletData()).balance).toBe(0n);
    expect((await (await officialSellerAthWallet(env)).getGetPendingNotification(1n, senderKey(env.reserveFunder.address))).exists).toBe(false);

    await freezePricing(env);
    config = await env.seller.getGetMarketStabilitySellerConfig();
    expect(config.pricing_frozen).toBe(true);
    expect(config.genesis_config_hash).toBe(0n);

    await fundReserve(env, TRANCHE, 2n);
    expect((await env.seller.getGetMarketStabilitySellerState()).reserve_due_ath).toBe(TRANCHE);
  });

  it('MSTAB-01D: forged and non-bound funding notifications do not move Seller reserve or keep ATH', async () => {
    const env = await setup();
    await bindFreezeSeal(env);

    await env.seller.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'AthTransferNotification',
      query_id: 710n,
      sender_key: senderKey(env.reserveFunder.address),
      amount: TRANCHE,
      sender_wallet: env.reserveFunder.address,
    } as AthTransferNotification);

    expect((await env.seller.getGetMarketStabilitySellerState()).reserve_due_ath).toBe(0n);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).reserve_funded_total_ath).toBe(0n);

    const wrongFunder = await env.blockchain.treasury('market-stability-wrong-reserve-funder');
    const wrongFunderAthWallet = await deployAthWallet(env.blockchain, wrongFunder.address, env.athMaster, TRANCHE);
    const wrongFunderInitialAth = (await wrongFunderAthWallet.getGetWalletData()).balance;

    await fundReserveFrom(env, wrongFunder, wrongFunderAthWallet, TRANCHE, 711n);

    const officialWallet = await officialSellerAthWallet(env);
    expect((await env.seller.getGetMarketStabilitySellerState()).reserve_due_ath).toBe(0n);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).reserve_funded_total_ath).toBe(0n);
    expect((await wrongFunderAthWallet.getGetWalletData()).balance).toBe(wrongFunderInitialAth);
    expect((await officialWallet.getGetWalletData()).balance).toBe(0n);
    expect((await officialWallet.getGetPendingNotification(711n, senderKey(wrongFunder.address))).exists).toBe(false);
  });

  it('MSTAB-01C: rejects launch evidence mismatch in both pricing directions before freezing', async () => {
    const env = await setup();
    await bindCore(env);
    await sealOnly(env);

    await env.seller.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'FreezeMarketStabilityPricing',
      deployment_manifest_hash: MANIFEST_HASH,
      base_tranche_price_nanotons: BASE_TRANCHE_PRICE,
      evidence_x1_tranche_quote_nanotons: BASE_TRANCHE_PRICE - 1n,
      pricing_evidence_hash: PRICING_EVIDENCE_HASH,
    } as FreezeMarketStabilityPricing);
    expect((await env.seller.getGetMarketStabilitySellerConfig()).pricing_frozen).toBe(false);

    await env.seller.send(env.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'FreezeMarketStabilityPricing',
      deployment_manifest_hash: MANIFEST_HASH,
      base_tranche_price_nanotons: 1n,
      evidence_x1_tranche_quote_nanotons: BASE_TRANCHE_PRICE,
      pricing_evidence_hash: PRICING_EVIDENCE_HASH,
    } as FreezeMarketStabilityPricing);

    const config = await env.seller.getGetMarketStabilitySellerConfig();
    expect(config.pricing_frozen).toBe(false);
    expect(config.base_tranche_price_nanotons).toBe(0n);
    expect(config.evidence_x1_tranche_quote_nanotons).toBe(0n);
    expect(config.genesis_config_hash).not.toBe(0n);

    await freezePricing(env);
    expect((await env.seller.getGetMarketStabilitySellerConfig()).pricing_frozen).toBe(true);
  });

  it('MSTAB-02: sells only at the current tranche floor, advances x2 to x3, and flushes TON to treasury', async () => {
    const env = await setup();
    await bindFreezeSeal(env);
    await fundReserve(env, TRANCHE * 2n);

    const x2Price = await env.seller.getGetQuoteTonForAmount(TRANCHE);
    expect(x2Price).toBe(BASE_TRANCHE_PRICE * 2n);

    await env.seller.send(env.buyer.getSender(), { value: x2Price + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE - 1n }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 1n,
      amount: TRANCHE,
      recipient: env.recipient.address,
    } as BuyMarketStabilityAth);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).sold_ath_total).toBe(0n);

    await env.seller.send(env.buyer.getSender(), { value: x2Price + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 1n,
      amount: TRANCHE,
      recipient: env.recipient.address,
    } as BuyMarketStabilityAth);

    const recipientWalletAddress = await athWalletAddress(env.recipient.address, env.athMaster);
    const recipientWallet = env.blockchain.openContract(new ATHWallet(recipientWalletAddress, await ATHWallet.init(0n, env.recipient.address, env.athMaster)));
    expect((await recipientWallet.getGetWalletData()).balance).toBe(TRANCHE);

    let state = await env.seller.getGetMarketStabilitySellerState();
    expect(state.reserve_due_ath).toBe(TRANCHE);
    expect(state.treasury_due_ton).toBe(x2Price);
    expect(state.completed_tranche_count).toBe(1n);
    expect(state.current_multiplier).toBe(3n);
    expect(state.last_terminal_query_id).toBe(1n);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).sold_ath_total).toBe(TRANCHE);

    const x3Price = await env.seller.getGetQuoteTonForAmount(TRANCHE);
    expect(x3Price).toBe(BASE_TRANCHE_PRICE * 3n);

    await env.seller.send(env.flusher.getSender(), { value: toNano('0.01') }, {
      $$type: 'FlushMarketStabilityTreasuryTon',
      amount: x2Price + 1n,
    } as FlushMarketStabilityTreasuryTon);
    state = await env.seller.getGetMarketStabilitySellerState();
    expect(state.treasury_due_ton).toBe(x2Price);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).treasury_flushed_ton_total).toBe(0n);

    await env.seller.send(env.flusher.getSender(), { value: toNano('0.01') }, {
      $$type: 'FlushMarketStabilityTreasuryTon',
      amount: x2Price,
    } as FlushMarketStabilityTreasuryTon);
    state = await env.seller.getGetMarketStabilitySellerState();
    expect(state.treasury_due_ton).toBe(0n);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).treasury_flushed_ton_total).toBe(x2Price);
  });

  it('MSTAB-02B: failed ATH delivery restores reserve and refunds buyer principal', async () => {
    const env = await setup();
    await bindFreezeSeal(env);
    await fundReserve(env, TRANCHE);

    const rejectingRecipientOwner = env.recipient.address;
    const rejectingRecipientWalletAddress = await athWalletAddress(rejectingRecipientOwner, env.athMaster);
    const rejectingRecipientWallet = await deployWrongMasterAthWalletAt(
      env.blockchain,
      rejectingRecipientWalletAddress,
      rejectingRecipientOwner,
      env.athMaster,
      fixtureAddress('ATH_MASTER_REJECTING_RECIPIENT'),
      123n,
    );

    const price = await env.seller.getGetQuoteTonForAmount(TRANCHE);
    const buyerBefore = (await env.blockchain.getContract(env.buyer.address)).balance;
    const officialWallet = await officialSellerAthWallet(env);
    const officialBefore = (await officialWallet.getGetWalletData()).balance;
    const recipientBefore = (await rejectingRecipientWallet.getGetWalletData()).balance;

    await env.seller.send(env.buyer.getSender(), { value: price + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 1n,
      amount: TRANCHE,
      recipient: rejectingRecipientOwner,
    } as BuyMarketStabilityAth);

    let state = await env.seller.getGetMarketStabilitySellerState();
    let totals = await env.seller.getGetMarketStabilitySellerTotals();
    const buyerAfter = (await env.blockchain.getContract(env.buyer.address)).balance;

    expect(state.phase).toBe(0n);
    expect(state.reserve_due_ath).toBe(TRANCHE);
    expect(state.treasury_due_ton).toBe(0n);
    expect(state.last_terminal_query_id).toBe(1n);
    expect(totals.sold_ath_total).toBe(0n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(officialBefore);
    expect((await rejectingRecipientWallet.getGetWalletData()).balance).toBe(recipientBefore);
    expect(buyerAfter).toBeGreaterThan(buyerBefore - BUY_TRANSFER_REQUEST_VALUE - BUY_EXEC_RESERVE - toNano('0.05'));

    await env.seller.send(env.buyer.getSender(), { value: price + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 1n,
      amount: TRANCHE,
      recipient: env.attacker.address,
    } as BuyMarketStabilityAth);
    expect((await env.seller.getGetMarketStabilitySellerState()).reserve_due_ath).toBe(TRANCHE);

    await env.seller.send(env.buyer.getSender(), { value: price + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 2n,
      amount: TRANCHE,
      recipient: env.attacker.address,
    } as BuyMarketStabilityAth);

    const successRecipientWalletAddress = await athWalletAddress(env.attacker.address, env.athMaster);
    const successRecipientWallet = env.blockchain.openContract(new ATHWallet(successRecipientWalletAddress, await ATHWallet.init(0n, env.attacker.address, env.athMaster)));
    state = await env.seller.getGetMarketStabilitySellerState();
    totals = await env.seller.getGetMarketStabilitySellerTotals();
    expect(state.reserve_due_ath).toBe(0n);
    expect(state.treasury_due_ton).toBe(price);
    expect(state.last_terminal_query_id).toBe(2n);
    expect(totals.sold_ath_total).toBe(TRANCHE);
    expect((await successRecipientWallet.getGetWalletData()).balance).toBe(TRANCHE);
  });

  it('MSTAB-02C: accepted transfer request without ATHWallet callback leaves sale pending and blocks new sales', async () => {
    const env = await setup();
    await bindFreezeSeal(env);
    await fundReserve(env, TRANCHE);

    const mockAthWalletInit = await MockAthWalletNoAck.init();
    await env.blockchain.setShardAccount(env.officialAthWallet, createShardAccount({
      address: env.officialAthWallet,
      code: mockAthWalletInit.code,
      data: mockAthWalletInit.data,
      balance: toNano('1'),
      workchain: env.officialAthWallet.workChain,
    }));

    const price = await env.seller.getGetQuoteTonForAmount(TRANCHE);
    await env.seller.send(env.buyer.getSender(), { value: price + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 1n,
      amount: TRANCHE,
      recipient: env.recipient.address,
    } as BuyMarketStabilityAth);

    let state = await env.seller.getGetMarketStabilitySellerState();
    let totals = await env.seller.getGetMarketStabilitySellerTotals();
    expect(state.phase).toBe(1n);
    expect(state.reserve_due_ath).toBe(0n);
    expect(state.treasury_due_ton).toBe(0n);
    expect(state.last_terminal_query_id).toBe(0n);
    expect(totals.sold_ath_total).toBe(0n);

    await env.seller.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferAck',
      query_id: 1n,
      amount: TRANCHE,
    } as ATHTransferAck);
    await env.seller.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferFailed',
      query_id: 1n,
      amount: TRANCHE,
    } as ATHTransferFailed);
    await env.seller.send(env.buyer.getSender(), { value: price + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 2n,
      amount: TRANCHE,
      recipient: env.attacker.address,
    } as BuyMarketStabilityAth);

    state = await env.seller.getGetMarketStabilitySellerState();
    totals = await env.seller.getGetMarketStabilitySellerTotals();
    expect(state.phase).toBe(1n);
    expect(state.reserve_due_ath).toBe(0n);
    expect(state.treasury_due_ton).toBe(0n);
    expect(state.last_terminal_query_id).toBe(0n);
    expect(totals.sold_ath_total).toBe(0n);
  });

  it('MSTAB-03: rejects over-cap reserve funding and over-tranche buys before mutation', async () => {
    const env = await setup();
    await bindFreezeSeal(env);
    await fundReserve(env, TOTAL_RESERVE, 1n);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).reserve_funded_total_ath).toBe(TOTAL_RESERVE);

    const reserveFunderBeforeOverCap = (await env.reserveFunderAthWallet.getGetWalletData()).balance;
    const officialWallet = await officialSellerAthWallet(env);
    const officialBeforeOverCap = (await officialWallet.getGetWalletData()).balance;
    await fundReserve(env, 1n, 2n);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).reserve_funded_total_ath).toBe(TOTAL_RESERVE);
    expect((await env.seller.getGetMarketStabilitySellerState()).reserve_due_ath).toBe(TOTAL_RESERVE);
    expect((await env.reserveFunderAthWallet.getGetWalletData()).balance).toBe(reserveFunderBeforeOverCap);
    expect((await officialWallet.getGetWalletData()).balance).toBe(officialBeforeOverCap);
    expect((await officialWallet.getGetPendingNotification(2n, senderKey(env.reserveFunder.address))).exists).toBe(false);

    const price = await env.seller.getGetQuoteTonForAmount(TRANCHE);
    await env.seller.send(env.buyer.getSender(), { value: price + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE + toNano('1') }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 1n,
      amount: TRANCHE + 1n,
      recipient: env.recipient.address,
    } as BuyMarketStabilityAth);

    const state = await env.seller.getGetMarketStabilitySellerState();
    expect(state.phase).toBe(0n);
    expect(state.reserve_due_ath).toBe(TOTAL_RESERVE);
    expect(state.treasury_due_ton).toBe(0n);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).sold_ath_total).toBe(0n);

    await env.seller.send(env.buyer.getSender(), { value: price + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE + toNano('1') }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 1n,
      amount: TRANCHE,
      recipient: env.seller.address,
    } as BuyMarketStabilityAth);

    const afterSelfRecipient = await env.seller.getGetMarketStabilitySellerState();
    expect(afterSelfRecipient.phase).toBe(0n);
    expect(afterSelfRecipient.reserve_due_ath).toBe(TOTAL_RESERVE);
    expect(afterSelfRecipient.treasury_due_ton).toBe(0n);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).sold_ath_total).toBe(0n);
  });

  it('MSTAB-04: rejects funding before seal and buys before pricing without moving ATH reserve', async () => {
    const env = await setup();
    const reserveFunderInitialAth = (await env.reserveFunderAthWallet.getGetWalletData()).balance;

    await fundReserve(env, TRANCHE);
    expect((await env.seller.getGetMarketStabilitySellerState()).reserve_due_ath).toBe(0n);
    expect((await env.reserveFunderAthWallet.getGetWalletData()).balance).toBe(reserveFunderInitialAth);

    await bindCore(env);
    await sealOnly(env);
    await env.seller.send(env.buyer.getSender(), { value: BASE_TRANCHE_PRICE * 2n + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 1n,
      amount: 1n,
      recipient: env.recipient.address,
    } as BuyMarketStabilityAth);

    const state = await env.seller.getGetMarketStabilitySellerState();
    expect(state.phase).toBe(0n);
    expect(state.reserve_due_ath).toBe(0n);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).sold_ath_total).toBe(0n);
  });

  it('MSTAB-05: rejects buys above partially funded reserve before mutation', async () => {
    const env = await setup();
    await bindFreezeSeal(env);
    const partialReserve = TRANCHE / 2n;
    await fundReserve(env, partialReserve);

    const amount = partialReserve + 1n;
    const price = await env.seller.getGetQuoteTonForAmount(amount);
    await env.seller.send(env.buyer.getSender(), { value: price + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 1n,
      amount,
      recipient: env.recipient.address,
    } as BuyMarketStabilityAth);

    const state = await env.seller.getGetMarketStabilitySellerState();
    expect(state.phase).toBe(0n);
    expect(state.reserve_due_ath).toBe(partialReserve);
    expect(state.treasury_due_ton).toBe(0n);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).sold_ath_total).toBe(0n);
  });

  it('MSTAB-06: sells through the x16 tranche and rejects post-sellout buys', async () => {
    const env = await setup();
    await bindFreezeSeal(env);
    await fundReserve(env, TOTAL_RESERVE);

    for (let i = 0; i < 15; i += 1) {
      const queryId = BigInt(i + 1);
      const multiplier = BigInt(i + 2);
      const price = await env.seller.getGetQuoteTonForAmount(TRANCHE);
      expect(price).toBe(BASE_TRANCHE_PRICE * multiplier);
      const recipient = fixtureAddress(`SELLOUT_RECIPIENT_${i}`);
      await env.seller.send(env.buyer.getSender(), { value: price + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
        $$type: 'BuyMarketStabilityAth',
        query_id: queryId,
        amount: TRANCHE,
        recipient,
      } as BuyMarketStabilityAth);
    }

    let state = await env.seller.getGetMarketStabilitySellerState();
    let totals = await env.seller.getGetMarketStabilitySellerTotals();
    expect(state.reserve_due_ath).toBe(0n);
    expect(state.completed_tranche_count).toBe(15n);
    expect(totals.sold_ath_total).toBe(TOTAL_RESERVE);

    await env.seller.send(env.buyer.getSender(), { value: BASE_TRANCHE_PRICE * 17n + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 16n,
      amount: 1n,
      recipient: env.recipient.address,
    } as BuyMarketStabilityAth);

    state = await env.seller.getGetMarketStabilitySellerState();
    totals = await env.seller.getGetMarketStabilitySellerTotals();
    expect(state.reserve_due_ath).toBe(0n);
    expect(totals.sold_ath_total).toBe(TOTAL_RESERVE);
    expect(state.last_terminal_query_id).toBe(15n);
  });
});
