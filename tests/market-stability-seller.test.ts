import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
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
  MarketStabilitySeller,
  SealMarketStabilityGenesis,
} from '../build/MarketStabilitySeller/MarketStabilitySeller_MarketStabilitySeller';
import {
  ATHRecoverStuckOutgoing,
  ATHTransferRequestWithNotify,
  ATHWallet,
} from '../build/ATHWallet/ATHWallet_ATHWallet';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';

const MANIFEST_HASH = 0xababababababababababababababababababababababababababababababababn;
const TRANCHE = 3_000_000_000_000_000n;
const TOTAL_RESERVE = 60_000_000_000_000_000n;
// Mirrors the contract's own constant, parsed from source so a change on one side cannot silently diverge.
const BASE_TRANCHE_PRICE = (() => {
  const src = readFileSync('contracts/MarketStabilitySeller.tact', 'utf8');
  const m = src.match(/const\s+MARKET_STABILITY_BASE_TRANCHE_PRICE\s*:\s*Int\s*=\s*(\d+)/);
  if (!m) throw new Error('MARKET_STABILITY_BASE_TRANCHE_PRICE not found in the contract');
  return BigInt(m[1]);
})();
const NOTIFY_VALUE = 80_000_000n;
const BUY_TRANSFER_REQUEST_VALUE = 58_000_000n; // F11/#3: mirrors MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE (48M->58M, +10M downstream margin)
const BUY_EXEC_RESERVE = 2_000_000n;
const FUNDING_NOTIFY_VALUE = toNano('0.2');
const ATH_SENDER_KEY_MOD = 1n << 160n;
const MARKET_STABILITY_TREASURY_FLUSH_EXEC_RESERVE = 2_000_000n;

function addressHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

function senderKey(owner: Address, queryId: bigint): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(0x41544e49, 32)
    .storeUint(queryId, 64)
    .storeAddress(owner)
    .endCell()
    .hash()
    .toString('hex')) % ATH_SENDER_KEY_MOD;
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.MARKET.STABILITY.${label}`).digest());
}

async function contractBalance(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

function inboundValue(tx: any): bigint {
  const info = tx?.inMessage?.info;
  if (info?.type !== 'internal') throw new Error('missing inbound internal value');
  return info.value.coins;
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

async function bindAndSeal(env: Awaited<ReturnType<typeof setup>>) {
  await bindCore(env);

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

    await bindAndSeal(env);
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
    const pending = await officialWallet.getGetPendingNotification(1n, senderKey(env.reserveFunder.address, 1n));
    expect(pending.exists).toBe(false);
  });

  it('MSTAB-01B genesis-lock: the reserve funds + locks at genesis, before any pool or buyer exists', async () => {
    const env = await setup();
    await bindCore(env);
    await sealOnly(env);
    const reserveFunderInitialAth = (await env.reserveFunderAthWallet.getGetWalletData()).balance;

    let config = await env.seller.getGetMarketStabilitySellerConfig();
    expect(config.sealed).toBe(true);
    expect(config.genesis_config_hash).toBe(0n);

    // clean-12 GENESIS-LOCK: the market-maker reserve is committed + locked at genesis, before any pool or buyer
    // exists, so it never sits under the owner's unilateral control.
    await fundReserve(env, TRANCHE);
    expect((await env.seller.getGetMarketStabilitySellerState()).reserve_due_ath).toBe(TRANCHE);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).reserve_funded_total_ath).toBe(TRANCHE);
    // the ATH actually moved into the Seller's official wallet (custody committed) and out of the funder
    expect((await env.reserveFunderAthWallet.getGetWalletData()).balance).toBe(reserveFunderInitialAth - TRANCHE);
    expect((await (await officialSellerAthWallet(env)).getGetWalletData()).balance).toBe(TRANCHE);

    // the locked reserve is sellable at the constant schedule with no further privileged step of any kind
    config = await env.seller.getGetMarketStabilitySellerConfig();
    expect(config.pricing_frozen).toBe(true);
    expect(config.base_tranche_price_nanotons).toBe(BASE_TRANCHE_PRICE);
    expect((await env.seller.getGetMarketStabilitySellerState()).reserve_due_ath).toBe(TRANCHE);
  });

  it('MSTAB-01D: forged and non-bound funding notifications do not move Seller reserve or keep ATH', async () => {
    const env = await setup();
    await bindAndSeal(env);

    await env.seller.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'AthTransferNotification',
      query_id: 710n,
      sender_key: senderKey(env.reserveFunder.address, 1n),
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
    expect((await officialWallet.getGetPendingNotification(711n, senderKey(wrongFunder.address, 711n))).exists).toBe(false);
  });

  it('MSTAB-01C: the tranche price is a compile-time constant, live from deploy with no ceremony', async () => {
    const env = await setup();

    // Before ANY binding or sealing the schedule is already quotable: no key, in any order, can set it wrong.
    const bornWith = await env.seller.getGetMarketStabilitySellerConfig();
    expect(bornWith.pricing_frozen).toBe(true);
    expect(bornWith.base_tranche_price_nanotons).toBe(BASE_TRANCHE_PRICE);

    // The owner's model: a 15M ATH / 15k GRAM pool => 0.001 GRAM per ATH => 3000 GRAM per 3M ATH tranche at x1.
    expect(BASE_TRANCHE_PRICE).toBe((TRANCHE * toNano('15000')) / 15_000_000_000_000_000n);

    await bindCore(env);
    await sealOnly(env);
    const sealed = await env.seller.getGetMarketStabilitySellerConfig();
    expect(sealed.pricing_frozen).toBe(true);
    expect(sealed.base_tranche_price_nanotons).toBe(BASE_TRANCHE_PRICE);
    expect(sealed.genesis_config_hash).toBe(0n);
  });

  it('MSTAB-01E: the whole x2..x21 schedule is derived from the constant, not stored', async () => {
    const env = await setup();

    // Selling starts at x2 and every tranche is priced by its own multiplier.
    expect(await env.seller.getGetQuoteTonForAmount(TRANCHE)).toBe(BASE_TRANCHE_PRICE * 2n);

    // A partial buy is priced pro rata within the tranche, rounded UP so a dust split cannot underpay.
    expect(await env.seller.getGetQuoteTonForAmount(TRANCHE / 2n)).toBe(BASE_TRANCHE_PRICE);
    expect(await env.seller.getGetQuoteTonForAmount(1n)).toBe(
      (BASE_TRANCHE_PRICE * 2n + TRANCHE - 1n) / TRANCHE,
    );
  });

  it('MSTAB-02: sells only at the current tranche floor, advances x2 to x3, and flushes TON to treasury', async () => {
    const env = await setup();
    await bindAndSeal(env);
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

    const dustTail = MARKET_STABILITY_TREASURY_FLUSH_EXEC_RESERVE - 1n;
    await env.seller.send(env.flusher.getSender(), { value: toNano('0.01') }, {
      $$type: 'FlushMarketStabilityTreasuryTon',
      amount: dustTail,
    } as FlushMarketStabilityTreasuryTon);
    state = await env.seller.getGetMarketStabilitySellerState();
    expect(state.treasury_due_ton).toBe(x2Price);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).treasury_flushed_ton_total).toBe(0n);

    const largePartialFlush = x2Price - dustTail;
    await env.seller.send(env.flusher.getSender(), { value: toNano('0.01') }, {
      $$type: 'FlushMarketStabilityTreasuryTon',
      amount: largePartialFlush,
    } as FlushMarketStabilityTreasuryTon);
    state = await env.seller.getGetMarketStabilitySellerState();
    expect(state.treasury_due_ton).toBe(dustTail);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).treasury_flushed_ton_total).toBe(largePartialFlush);

    await env.seller.send(env.flusher.getSender(), { value: toNano('0.01') }, {
      $$type: 'FlushMarketStabilityTreasuryTon',
      amount: dustTail,
    } as FlushMarketStabilityTreasuryTon);
    state = await env.seller.getGetMarketStabilitySellerState();
    expect(state.treasury_due_ton).toBe(0n);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).treasury_flushed_ton_total).toBe(x2Price);
  });

  it('RT-MSTAB-004/MSTAB-02B: failed ATH delivery restores reserve, refunds buyer principal, and preserves treasury backing', async () => {
    const env = await setup();
    await bindAndSeal(env);
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

  it('RT-MSTAB-004B: failed delivery leaves existing treasury due raw-backed while refunding only the failed buyer payment', async () => {
    const env = await setup();
    await bindAndSeal(env);
    await fundReserve(env, TRANCHE);

    const officialWallet = await officialSellerAthWallet(env);
    const firstAmount = 1n;
    const firstPrice = await env.seller.getGetQuoteTonForAmount(firstAmount);
    await env.seller.send(env.buyer.getSender(), { value: firstPrice + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 1n,
      amount: firstAmount,
      recipient: env.recipient.address,
    } as BuyMarketStabilityAth);

    const treasuryDueBeforeFailure = (await env.seller.getGetMarketStabilitySellerState()).treasury_due_ton;
    const soldBeforeFailure = (await env.seller.getGetMarketStabilitySellerTotals()).sold_ath_total;
    const officialBeforeFailure = (await officialWallet.getGetWalletData()).balance;
    expect(treasuryDueBeforeFailure).toBe(firstPrice);
    expect(soldBeforeFailure).toBe(firstAmount);

    const failingAmount = TRANCHE - firstAmount;
    const failingRecipientOwner = env.attacker.address;
    const failingRecipientWalletAddress = await athWalletAddress(failingRecipientOwner, env.athMaster);
    const failingRecipientWallet = await deployWrongMasterAthWalletAt(
      env.blockchain,
      failingRecipientWalletAddress,
      failingRecipientOwner,
      env.athMaster,
      fixtureAddress('ATH_MASTER_REJECTING_SECOND_RECIPIENT'),
      77n,
    );
    const recipientBefore = (await failingRecipientWallet.getGetWalletData()).balance;
    const failingPrice = await env.seller.getGetQuoteTonForAmount(failingAmount);
    const result = await env.seller.send(env.buyer.getSender(), { value: failingPrice + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 2n,
      amount: failingAmount,
      recipient: failingRecipientOwner,
    } as BuyMarketStabilityAth);

    const refundTx = findTransaction(result.transactions, {
      from: env.seller.address,
      to: env.buyer.address,
      success: true,
    });
    expect(refundTx).toBeDefined();
    expect(inboundValue(refundTx)).toBe(failingPrice);

    const state = await env.seller.getGetMarketStabilitySellerState();
    const totals = await env.seller.getGetMarketStabilitySellerTotals();
    expect(state.phase).toBe(0n);
    expect(state.treasury_due_ton).toBe(treasuryDueBeforeFailure);
    expect(state.reserve_due_ath).toBe(TRANCHE - firstAmount);
    expect(totals.sold_ath_total).toBe(soldBeforeFailure);
    expect((await officialWallet.getGetWalletData()).balance).toBe(officialBeforeFailure);
    expect((await failingRecipientWallet.getGetWalletData()).balance).toBe(recipientBefore);
    expect(await contractBalance(env.blockchain, env.seller.address)).toBeGreaterThanOrEqual(treasuryDueBeforeFailure);
  });

  it('MSTAB-02C: accepted transfer request without ATHWallet callback leaves sale pending and blocks new sales', async () => {
    const env = await setup();
    await bindAndSeal(env);
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

  it('MSTAB-02D: a recipient that never acks froze the whole reserve — the wallet-side unwind frees it and repays the buyer', async () => {
    const env = await setup();
    await bindAndSeal(env);
    await fundReserve(env, TRANCHE);

    // The realistic stuck shape, unlike MSTAB-02C above: the Seller's OWN wallet is the genuine ATHWallet (its address
    // is code-derived, so nothing else can ever live there), and it is the RECIPIENT that swallows the internal
    // transfer without acking and without bouncing. The Seller then has no terminal coming and no clock of its own.
    const recipientAthWallet = contractAddress(0, await ATHWallet.init(0n, env.recipient.address, env.athMaster));
    const mockInit = await MockAthWalletNoAck.init();
    await env.blockchain.setShardAccount(recipientAthWallet, createShardAccount({
      address: recipientAthWallet,
      code: mockInit.code,
      data: mockInit.data,
      balance: toNano('1'),
      workchain: recipientAthWallet.workChain,
    }));

    const price = await env.seller.getGetQuoteTonForAmount(TRANCHE);
    const buyerBefore = await env.buyer.getBalance();
    await env.seller.send(env.buyer.getSender(), { value: price + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 1n,
      amount: TRANCHE,
      recipient: env.recipient.address,
    } as BuyMarketStabilityAth);

    // Frozen: the buyer paid, the reserve is gone from the books, and SealMarketStabilityGenesis left no
    // administrative command that could ever unstick it.
    let state = await env.seller.getGetMarketStabilitySellerState();
    expect(state.phase).toBe(1n);
    expect(state.reserve_due_ath).toBe(0n);
    expect(await env.buyer.getBalance()).toBeLessThan(buyerBefore - price);

    const sellerWallet = await officialSellerAthWallet(env);
    expect((await sellerWallet.getGetWalletData()).balance).toBe(0n);

    // 30 days later anyone may unwind it at the wallet, which is the only party that knows the transfer never landed.
    env.blockchain.now = 1_700_000_000 + 2_592_000 + 1;
    await sellerWallet.send(env.flusher.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHRecoverStuckOutgoing',
      query_id: 1n,
      recipient_wallet: recipientAthWallet,
    } as ATHRecoverStuckOutgoing);

    // The ATH is back in the Seller's wallet AND back on its books, the phase is free, and the buyer was repaid the
    // principal — the sale simply never happened. Nothing was sold twice and nothing was written off.
    expect((await sellerWallet.getGetWalletData()).balance).toBe(TRANCHE);
    state = await env.seller.getGetMarketStabilitySellerState();
    expect(state.phase).toBe(0n);
    expect(state.reserve_due_ath).toBe(TRANCHE);
    expect(state.treasury_due_ton).toBe(0n);
    expect(state.last_terminal_query_id).toBe(1n);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).sold_ath_total).toBe(0n);
    expect(await env.buyer.getBalance()).toBeGreaterThan(buyerBefore - price);
  });

  it('MSTAB-07: a flush moves the CONTRACT\'s money, never the caller\'s, and the caller is made whole', async () => {
    const env = await setup();
    await bindAndSeal(env);
    await fundReserve(env, TRANCHE);

    const amount = 1n; // 1 atomic unit of ATH — priced by ceilDiv at 1 nanoton
    const price = await env.seller.getGetQuoteTonForAmount(amount);
    await env.seller.send(env.buyer.getSender(), { value: price + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 1n,
      amount,
      recipient: env.recipient.address,
    } as BuyMarketStabilityAth);

    const due = (await env.seller.getGetMarketStabilitySellerState()).treasury_due_ton;
    expect(due).toBe(price);

    // The grief: pay the flush yourself. Before the change return, the inbound value covered the outgoing leg exactly,
    // so the due fell while the contract's own nanotons stayed — and once the due hits zero, 23261 seals them in.
    const sellerBefore = (await env.blockchain.getContract(env.seller.address)).balance;
    const flusherBefore = await env.flusher.getBalance();
    const funded = toNano('0.5');
    await env.seller.send(env.flusher.getSender(), { value: funded }, {
      $$type: 'FlushMarketStabilityTreasuryTon',
      amount: due,
    } as FlushMarketStabilityTreasuryTon);

    const sellerAfter = (await env.blockchain.getContract(env.seller.address)).balance;
    const flusherAfter = await env.flusher.getBalance();

    expect((await env.seller.getGetMarketStabilitySellerState()).treasury_due_ton).toBe(0n);

    // MEASURED both directions. The contract really paid: its balance fell, and it did not rise by the funded amount.
    expect(sellerAfter).toBeLessThan(sellerBefore);
    // And SendRemainingValue did NOT drain it — the drop stays within the flushed amount plus a few fees, nowhere near
    // the 0.5 GRAM that was sent in. This is the half of the assertion that catches an over-send.
    expect(sellerBefore - sellerAfter).toBeLessThan(due + toNano('0.02'));
    // The caller got their funding back, minus gas only — so there is nothing left to subsidise a flush with.
    expect(flusherBefore - flusherAfter).toBeLessThan(toNano('0.02'));
  });

  it('MSTAB-08: a buyer no longer has to guess the exact next query id, but a used one is still refused', async () => {
    const env = await setup();
    await bindAndSeal(env);
    await fundReserve(env, TRANCHE);

    // Far ahead of last_terminal_query_id + 1: under the old rule this bounced on 23013, which is what made the lane
    // grievable — an attacker only had to take the one number that worked.
    const price = await env.seller.getGetQuoteTonForAmount(1n);
    await env.seller.send(env.buyer.getSender(), { value: price + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 987654n,
      amount: 1n,
      recipient: env.recipient.address,
    } as BuyMarketStabilityAth);

    let state = await env.seller.getGetMarketStabilitySellerState();
    expect(state.phase).toBe(0n);
    expect(state.last_terminal_query_id).toBe(987654n);
    expect((await env.seller.getGetMarketStabilitySellerTotals()).sold_ath_total).toBe(1n);

    // Monotonicity is what the sequence was for, and it survives: at or below the last terminal is still refused.
    const res = await env.seller.send(env.buyer.getSender(), { value: price + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 987654n,
      amount: 1n,
      recipient: env.recipient.address,
    } as BuyMarketStabilityAth);
    expect(findTransaction(res.transactions, { on: env.seller.address, exitCode: 23013 })).toBeTruthy();
    expect((await env.seller.getGetMarketStabilitySellerTotals()).sold_ath_total).toBe(1n);
  });

  it('MSTAB-09: MEASURED — what TON the official ATH wallet is left with after genesis funding', async () => {
    // TIER-2 QUESTION, and the one the contract-level rent measurements do not answer. The 60,000,000 ATH does not
    // live in MarketStabilitySeller — it lives in its official ATHWallet, a separate account with its own rent. That
    // wallet is created by the genesis funding transfer and, unlike the Seller, receives nothing again until a sale
    // happens. Sales are on NO clock at all here, so "until a sale happens" can be years.
    const env = await setup();
    await bindAndSeal(env);
    await fundReserve(env, TRANCHE);

    const wallet = await officialSellerAthWallet(env);
    expect((await wallet.getGetWalletData()).balance, 'the reserve really landed').toBe(TRANCHE);
    const ton = (await env.blockchain.getContract(env.officialAthWallet)).balance;

    // MEASURED: an ATHWallet is 81 code cells, so with its account and data ~84 cells; at the frozen 64,962 per
    // cell-year that is 5,456,808 a year. Report the horizon rather than assert a number nobody measured.
    const perYear = 5_456_808n;
    process.stderr.write(`[MSTAB-09] official wallet TON after funding: ${ton}  => ${Number(ton) / Number(perYear)} years of rent
`);

    // THE MEASUREMENT, pinned as a fact rather than as a wish: the transfer float alone is FOUR AND A HALF years for
    // the wallet holding 60% of supply, and no amount of overpaying the transfer changes it — everything above
    // ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT is refunded to the sender. That is why the ceremony now carries W01..W04
    // (RENT-HORIZON-03), and why this assertion states the shortfall instead of hiding it behind a passing threshold.
    expect(ton, 'the transfer float alone is a handful of years — the endowment MUST come from the ceremony step')
      .toBeLessThan(perYear * 6n);
    expect(ton, 'and it is at least the storage endowment the transfer carries').toBeGreaterThan(20_000_000n);
  });

  it('MSTAB-03: rejects over-cap reserve funding and over-tranche buys before mutation', async () => {
    const env = await setup();
    await bindAndSeal(env);
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
    expect((await officialWallet.getGetPendingNotification(2n, senderKey(env.reserveFunder.address, 2n))).exists).toBe(false);

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
    await bindAndSeal(env);
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

  it('RT-MSTAB-003/MSTAB-06: sells through x21, accounts exact treasury sum, flushes all, and rejects post-sellout buys', async () => {
    const env = await setup();
    await bindAndSeal(env);
    await fundReserve(env, TOTAL_RESERVE);
    let expectedTreasuryDue = 0n;

    for (let i = 0; i < 20; i += 1) {
      const queryId = BigInt(i + 1);
      const multiplier = BigInt(i + 2);
      const price = await env.seller.getGetQuoteTonForAmount(TRANCHE);
      expect(price).toBe(BASE_TRANCHE_PRICE * multiplier);
      expectedTreasuryDue += price;
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
    expect(state.completed_tranche_count).toBe(20n);
    expect(state.treasury_due_ton).toBe(expectedTreasuryDue);
    expect(expectedTreasuryDue).toBe(BASE_TRANCHE_PRICE * 230n);
    expect(totals.sold_ath_total).toBe(TOTAL_RESERVE);
    expect(totals.treasury_flushed_ton_total).toBe(0n);
    expect((await (await officialSellerAthWallet(env)).getGetWalletData()).balance).toBe(0n);

    await env.seller.send(env.buyer.getSender(), { value: BASE_TRANCHE_PRICE * 22n + BUY_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE }, {
      $$type: 'BuyMarketStabilityAth',
      query_id: 21n,
      amount: 1n,
      recipient: env.recipient.address,
    } as BuyMarketStabilityAth);

    state = await env.seller.getGetMarketStabilitySellerState();
    totals = await env.seller.getGetMarketStabilitySellerTotals();
    expect(state.reserve_due_ath).toBe(0n);
    expect(state.treasury_due_ton).toBe(expectedTreasuryDue);
    expect(totals.sold_ath_total).toBe(TOTAL_RESERVE);
    expect(state.last_terminal_query_id).toBe(20n);

    const flush = await env.seller.send(env.flusher.getSender(), { value: toNano('0.01') }, {
      $$type: 'FlushMarketStabilityTreasuryTon',
      amount: expectedTreasuryDue,
    } as FlushMarketStabilityTreasuryTon);
    const treasuryTx = findTransaction(flush.transactions, {
      from: env.seller.address,
      to: env.treasury.address,
      success: true,
    });
    expect(treasuryTx).toBeDefined();
    expect(inboundValue(treasuryTx)).toBe(expectedTreasuryDue);

    state = await env.seller.getGetMarketStabilitySellerState();
    totals = await env.seller.getGetMarketStabilitySellerTotals();
    expect(state.reserve_due_ath).toBe(0n);
    expect(state.treasury_due_ton).toBe(0n);
    expect(totals.sold_ath_total).toBe(TOTAL_RESERVE);
    expect(totals.treasury_flushed_ton_total).toBe(expectedTreasuryDue);
  });
});
