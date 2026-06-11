import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  ATHTransferAck,
  ATHTransferFailed,
  ATHVesting,
  ClaimAthVesting,
} from '../build/ATHVesting/ATHVesting_ATHVesting';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';

const START_TIME = 1_700_000_000;
const YEAR_SECONDS = 31_536_000;
const TOTAL_VESTING_ATH = 10_000_000_000_000_000n;
const YEAR_UNLOCK_ATH = 100_000_000_000_000n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.ATH.VESTING.${label}`).digest());
}

async function deployAthWalletAt(
  blockchain: Blockchain,
  owner: Address,
  master: Address,
  balance: bigint,
  tonBalance = toNano('2'),
) {
  const zeroInit = await ATHWallet.init(0n, owner, master);
  const dataInit = await ATHWallet.init(balance, owner, master);
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

async function deployMockAt(blockchain: Blockchain, address: Address, tonBalance = toNano('2')) {
  const init = await MockAthWalletNoAck.init();
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: tonBalance,
    workchain: address.workChain,
  }));
  return blockchain.openContract(new MockAthWalletNoAck(address, init));
}

async function setup(options: { fundOfficialWallet?: boolean; mockBeneficiaryWallet?: boolean; startTime?: number } = {}) {
  const blockchain = await Blockchain.create();
  const startTime = options.startTime ?? START_TIME;
  blockchain.now = startTime;
  const caller = await blockchain.treasury('ath-vesting-caller');
  const attacker = await blockchain.treasury('ath-vesting-attacker');
  const beneficiary = await blockchain.treasury('ath-vesting-beneficiary');
  const master = fixtureAddress('ATH_MASTER');

  const vestingInit = await ATHVesting.init(master, beneficiary.address, BigInt(startTime));
  const vestingAddress = contractAddress(0, vestingInit);
  await blockchain.setShardAccount(vestingAddress, createShardAccount({
    address: vestingAddress,
    code: vestingInit.code,
    data: vestingInit.data,
    balance: toNano('2'),
    workchain: vestingAddress.workChain,
  }));
  const vesting = blockchain.openContract(new ATHVesting(vestingAddress, vestingInit));

  const config = await vesting.getGetVestingConfig();
  const beneficiaryAthWalletAddress = await vesting.getGetAthWalletAddress(beneficiary.address);
  let officialWallet: Awaited<ReturnType<typeof deployAthWalletAt>> | null = null;
  if (options.fundOfficialWallet !== false) {
    officialWallet = await deployAthWalletAt(blockchain, vesting.address, master, TOTAL_VESTING_ATH);
  }
  if (options.mockBeneficiaryWallet) {
    await deployMockAt(blockchain, beneficiaryAthWalletAddress);
  }

  return {
    blockchain,
    vesting,
    caller,
    attacker,
    beneficiary,
    master,
    officialWallet,
    officialAthWalletAddress: config.official_ath_wallet_address,
    beneficiaryAthWalletAddress,
  };
}

describe('ATHVesting', () => {
  it('ATH-VEST-01: releases 100k ATH per year to the fixed beneficiary through ATHWallet ACK', async () => {
    const env = await setup();

    let state = await env.vesting.getGetVestingState();
    expect(state.vested_ath).toBe(0n);
    expect(state.claimable_ath).toBe(0n);

    await env.vesting.send(env.caller.getSender(), { value: toNano('0.1') }, {
      $$type: 'ClaimAthVesting',
      query_id: 1n,
      amount: 1n,
    } as ClaimAthVesting);
    expect((await env.vesting.getGetVestingState()).claimed_ath).toBe(0n);

    env.blockchain.now = START_TIME + YEAR_SECONDS;
    await env.vesting.send(env.caller.getSender(), { value: toNano('0.2') }, {
      $$type: 'ClaimAthVesting',
      query_id: 1n,
      amount: YEAR_UNLOCK_ATH,
    } as ClaimAthVesting);

    state = await env.vesting.getGetVestingState();
    expect(state.phase).toBe(0n);
    expect(state.claimed_ath).toBe(YEAR_UNLOCK_ATH);
    expect(state.claimable_ath).toBe(0n);
    expect(state.last_terminal_query_id).toBe(1n);

    const beneficiaryWallet = env.blockchain.openContract(
      new ATHWallet(env.beneficiaryAthWalletAddress, await ATHWallet.init(0n, env.beneficiary.address, env.master)),
    );
    expect((await beneficiaryWallet.getGetWalletData()).balance).toBe(YEAR_UNLOCK_ATH);
    expect((await env.officialWallet!.getGetWalletData()).balance).toBe(TOTAL_VESTING_ATH - YEAR_UNLOCK_ATH);

    env.blockchain.now = START_TIME + (3 * YEAR_SECONDS);
    expect(await env.vesting.getGetClaimableAmount()).toBe(YEAR_UNLOCK_ATH * 2n);
    await env.vesting.send(env.attacker.getSender(), { value: toNano('0.2') }, {
      $$type: 'ClaimAthVesting',
      query_id: 2n,
      amount: YEAR_UNLOCK_ATH * 2n,
    } as ClaimAthVesting);

    state = await env.vesting.getGetVestingState();
    expect(state.claimed_ath).toBe(YEAR_UNLOCK_ATH * 3n);
    expect((await beneficiaryWallet.getGetWalletData()).balance).toBe(YEAR_UNLOCK_ATH * 3n);
  });

  it('RT-VEST-002: permissionless claims always pay the immutable beneficiary, never the caller', async () => {
    const env = await setup();
    env.blockchain.now = START_TIME + YEAR_SECONDS;

    const callerAthWallet = await deployAthWalletAt(env.blockchain, env.attacker.address, env.master, 0n);
    const beneficiaryWallet = env.blockchain.openContract(
      new ATHWallet(env.beneficiaryAthWalletAddress, await ATHWallet.init(0n, env.beneficiary.address, env.master)),
    );

    await env.vesting.send(env.attacker.getSender(), { value: toNano('0.2') }, {
      $$type: 'ClaimAthVesting',
      query_id: 1n,
      amount: YEAR_UNLOCK_ATH,
    } as ClaimAthVesting);

    expect((await env.vesting.getGetVestingState()).claimed_ath).toBe(YEAR_UNLOCK_ATH);
    expect((await callerAthWallet.getGetWalletData()).balance).toBe(0n);
    expect((await beneficiaryWallet.getGetWalletData()).balance).toBe(YEAR_UNLOCK_ATH);
    expect((await env.officialWallet!.getGetWalletData()).balance).toBe(TOTAL_VESTING_ATH - YEAR_UNLOCK_ATH);
  });

  it('ATH-VEST-02: caps vesting at 10M ATH and rejects over-claiming', async () => {
    const env = await setup({ startTime: 1 });
    env.blockchain.now = 1 + YEAR_SECONDS;

    await env.vesting.send(env.caller.getSender(), { value: toNano('0.2') }, {
      $$type: 'ClaimAthVesting',
      query_id: 1n,
      amount: YEAR_UNLOCK_ATH + 1n,
    } as ClaimAthVesting);
    expect((await env.vesting.getGetVestingState()).claimed_ath).toBe(0n);
    expect((await env.officialWallet!.getGetWalletData()).balance).toBe(TOTAL_VESTING_ATH);

    await env.vesting.send(env.attacker.getSender(), { value: toNano('0.2') }, {
      $$type: 'ClaimAthVesting',
      query_id: 1n,
      amount: 1n,
    } as ClaimAthVesting);
    expect((await env.vesting.getGetVestingState()).claimed_ath).toBe(0n);
    expect((await env.officialWallet!.getGetWalletData()).balance).toBe(TOTAL_VESTING_ATH);

    expect(await env.vesting.getGetVestedAmount(1n + (100n * BigInt(YEAR_SECONDS)))).toBe(TOTAL_VESTING_ATH);

    env.blockchain.now = 1 + (100 * YEAR_SECONDS);
    expect((await env.vesting.getGetVestingState()).vested_ath).toBe(TOTAL_VESTING_ATH);
    await env.vesting.send(env.caller.getSender(), { value: toNano('0.2') }, {
      $$type: 'ClaimAthVesting',
      query_id: 1n,
      amount: TOTAL_VESTING_ATH,
    } as ClaimAthVesting);
    expect((await env.vesting.getGetVestingState()).claimed_ath).toBe(TOTAL_VESTING_ATH);
    expect((await env.officialWallet!.getGetWalletData()).balance).toBe(0n);
  });

  it('RT-VEST-004: one full 100-year claim releases exactly 10M ATH and then rejects further claims', async () => {
    const env = await setup({ startTime: 1 });
    env.blockchain.now = 1 + (100 * YEAR_SECONDS);

    const beneficiaryWallet = env.blockchain.openContract(
      new ATHWallet(env.beneficiaryAthWalletAddress, await ATHWallet.init(0n, env.beneficiary.address, env.master)),
    );

    await env.vesting.send(env.caller.getSender(), { value: toNano('0.2') }, {
      $$type: 'ClaimAthVesting',
      query_id: 1n,
      amount: TOTAL_VESTING_ATH,
    } as ClaimAthVesting);

    let state = await env.vesting.getGetVestingState();
    expect(state.claimed_ath).toBe(TOTAL_VESTING_ATH);
    expect(state.claimable_ath).toBe(0n);
    expect((await env.officialWallet!.getGetWalletData()).balance).toBe(0n);
    expect((await beneficiaryWallet.getGetWalletData()).balance).toBe(TOTAL_VESTING_ATH);

    await env.vesting.send(env.caller.getSender(), { value: toNano('0.2') }, {
      $$type: 'ClaimAthVesting',
      query_id: 2n,
      amount: 1n,
    } as ClaimAthVesting);

    state = await env.vesting.getGetVestingState();
    expect(state.claimed_ath).toBe(TOTAL_VESTING_ATH);
    expect(state.last_terminal_query_id).toBe(1n);
    expect((await beneficiaryWallet.getGetWalletData()).balance).toBe(TOTAL_VESTING_ATH);
  });

  it('ATH-VEST-03: one pending claim blocks another and forged callbacks cannot clear it', async () => {
    const env = await setup({ mockBeneficiaryWallet: true });
    env.blockchain.now = START_TIME + YEAR_SECONDS;

    await env.vesting.send(env.caller.getSender(), { value: toNano('0.2') }, {
      $$type: 'ClaimAthVesting',
      query_id: 1n,
      amount: YEAR_UNLOCK_ATH,
    } as ClaimAthVesting);

    let state = await env.vesting.getGetVestingState();
    expect(state.phase).toBe(1n);
    expect(state.pending_query_id).toBe(1n);
    expect(state.pending_amount).toBe(YEAR_UNLOCK_ATH);
    expect(state.claimed_ath).toBe(0n);

    await env.vesting.send(env.caller.getSender(), { value: toNano('0.2') }, {
      $$type: 'ClaimAthVesting',
      query_id: 2n,
      amount: 1n,
    } as ClaimAthVesting);
    state = await env.vesting.getGetVestingState();
    expect(state.phase).toBe(1n);
    expect(state.pending_query_id).toBe(1n);

    await env.vesting.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferAck',
      query_id: 1n,
      amount: YEAR_UNLOCK_ATH,
    } as ATHTransferAck);
    expect((await env.vesting.getGetVestingState()).phase).toBe(1n);

    await env.vesting.send(env.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferFailed',
      query_id: 1n,
      amount: YEAR_UNLOCK_ATH,
    } as ATHTransferFailed);
    expect((await env.vesting.getGetVestingState()).phase).toBe(1n);

    await env.vesting.send(env.blockchain.sender(env.officialAthWalletAddress), { value: toNano('0.05') }, {
      $$type: 'ATHTransferFailed',
      query_id: 1n,
      amount: YEAR_UNLOCK_ATH,
    } as ATHTransferFailed);
    state = await env.vesting.getGetVestingState();
    expect(state.phase).toBe(0n);
    expect(state.claimed_ath).toBe(0n);
    expect(state.last_terminal_query_id).toBe(1n);
  });

  it('RT-VEST-003: failed claim clears pending and the next query id can claim without duplicate release', async () => {
    const env = await setup({ fundOfficialWallet: false });
    env.blockchain.now = START_TIME + YEAR_SECONDS;

    await env.vesting.send(env.caller.getSender(), { value: toNano('0.2') }, {
      $$type: 'ClaimAthVesting',
      query_id: 1n,
      amount: YEAR_UNLOCK_ATH,
    } as ClaimAthVesting);

    let state = await env.vesting.getGetVestingState();
    expect(state.phase).toBe(0n);
    expect(state.claimed_ath).toBe(0n);
    expect(state.claimable_ath).toBe(YEAR_UNLOCK_ATH);
    expect(state.last_terminal_query_id).toBe(1n);

    const officialWallet = await deployAthWalletAt(env.blockchain, env.vesting.address, env.master, TOTAL_VESTING_ATH);
    const beneficiaryWallet = env.blockchain.openContract(
      new ATHWallet(env.beneficiaryAthWalletAddress, await ATHWallet.init(0n, env.beneficiary.address, env.master)),
    );

    await env.vesting.send(env.attacker.getSender(), { value: toNano('0.2') }, {
      $$type: 'ClaimAthVesting',
      query_id: 2n,
      amount: YEAR_UNLOCK_ATH,
    } as ClaimAthVesting);

    state = await env.vesting.getGetVestingState();
    expect(state.claimed_ath).toBe(YEAR_UNLOCK_ATH);
    expect(state.claimable_ath).toBe(0n);
    expect(state.last_terminal_query_id).toBe(2n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(TOTAL_VESTING_ATH - YEAR_UNLOCK_ATH);
    expect((await beneficiaryWallet.getGetWalletData()).balance).toBe(YEAR_UNLOCK_ATH);
  });

  it('ATH-VEST-03B: wrong beneficiary-wallet ACK amount cannot finalize a pending claim', async () => {
    const env = await setup({ mockBeneficiaryWallet: true });
    env.blockchain.now = START_TIME + YEAR_SECONDS;

    await env.vesting.send(env.caller.getSender(), { value: toNano('0.2') }, {
      $$type: 'ClaimAthVesting',
      query_id: 1n,
      amount: YEAR_UNLOCK_ATH,
    } as ClaimAthVesting);

    await env.vesting.send(env.blockchain.sender(env.beneficiaryAthWalletAddress), { value: toNano('0.05') }, {
      $$type: 'ATHTransferAck',
      query_id: 1n,
      amount: YEAR_UNLOCK_ATH - 1n,
    } as ATHTransferAck);

    let state = await env.vesting.getGetVestingState();
    expect(state.phase).toBe(1n);
    expect(state.claimed_ath).toBe(0n);

    await env.vesting.send(env.blockchain.sender(env.beneficiaryAthWalletAddress), { value: toNano('0.05') }, {
      $$type: 'ATHTransferAck',
      query_id: 1n,
      amount: YEAR_UNLOCK_ATH,
    } as ATHTransferAck);

    state = await env.vesting.getGetVestingState();
    expect(state.phase).toBe(0n);
    expect(state.claimed_ath).toBe(YEAR_UNLOCK_ATH);
    expect(state.last_terminal_query_id).toBe(1n);
  });

  it('ATH-VEST-04: official ATHWallet request bounce clears pending without claiming', async () => {
    const env = await setup({ fundOfficialWallet: false });
    env.blockchain.now = START_TIME + YEAR_SECONDS;

    await env.vesting.send(env.caller.getSender(), { value: toNano('0.2') }, {
      $$type: 'ClaimAthVesting',
      query_id: 1n,
      amount: YEAR_UNLOCK_ATH,
    } as ClaimAthVesting);

    const state = await env.vesting.getGetVestingState();
    expect(state.phase).toBe(0n);
    expect(state.claimed_ath).toBe(0n);
    expect(state.last_terminal_query_id).toBe(1n);
  });

  it('ATH-VEST-05: master, beneficiary, and start time are immutable constructor facts', async () => {
    const env = await setup();
    const config = await env.vesting.getGetVestingConfig();
    expect(config.ath_master_address.equals(env.master)).toBe(true);
    expect(config.beneficiary_address.equals(env.beneficiary.address)).toBe(true);
    expect(config.start_time).toBe(BigInt(START_TIME));
    expect(config.period_seconds).toBe(BigInt(YEAR_SECONDS));
    expect(config.period_count).toBe(100n);
    expect(config.period_unlock_amount).toBe(YEAR_UNLOCK_ATH);
    expect(config.total_amount).toBe(TOTAL_VESTING_ATH);
  });
});
