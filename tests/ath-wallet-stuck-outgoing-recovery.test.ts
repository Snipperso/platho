import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { ATHVesting, ClaimAthVesting } from '../build/ATHVesting/ATHVesting_ATHVesting';
import { ATHRecoverStuckOutgoing, ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';


const START_TIME = 1_790_000_000;
const YEAR_SECONDS = 31_536_000;
const GRACE_SECONDS = 2_592_000;
const TOTAL_VESTING_ATH = 10_000_000_000_000_000n;
const YEAR_UNLOCK_ATH = 100_000_000_000_000n;

function fixtureAddress(label: string): Address {
  return new Address(0, createHash('sha256').update(`PLATHO.V1.ATH.STUCK.${label}`).digest());
}

async function deployAthWalletAt(blockchain: Blockchain, owner: Address, master: Address, balance: bigint) {
  const zeroInit = await ATHWallet.init(0n, owner, master);
  const dataInit = await ATHWallet.init(balance, owner, master);
  const address = contractAddress(owner.workChain, zeroInit);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: zeroInit.code,
    data: dataInit.data,
    balance: toNano('2'),
    workchain: address.workChain,
  }));
  return blockchain.openContract(new ATHWallet(address, zeroInit));
}

async function setup(options: { stuck?: boolean } = {}) {
  const blockchain = await Blockchain.create();
  blockchain.now = START_TIME;
  const caller = await blockchain.treasury('stuck-outgoing-caller');
  const master = fixtureAddress('ATH_MASTER');
  const beneficiary = await blockchain.treasury('stuck-outgoing-beneficiary');

  const vestingInit = await ATHVesting.init(master, beneficiary.address, BigInt(START_TIME));
  const vestingAddress = contractAddress(0, vestingInit);
  await blockchain.setShardAccount(vestingAddress, createShardAccount({
    address: vestingAddress,
    code: vestingInit.code,
    data: vestingInit.data,
    balance: toNano('2'),
    workchain: vestingAddress.workChain,
  }));
  const vesting = blockchain.openContract(new ATHVesting(vestingAddress, vestingInit));

  const officialWallet = await deployAthWalletAt(blockchain, vestingAddress, master, TOTAL_VESTING_ATH);
  const beneficiaryAthWalletAddress = await vesting.getGetAthWalletAddress(beneficiary.address);

  if (options.stuck) {
    const mockInit = await MockAthWalletNoAck.init();
    await blockchain.setShardAccount(beneficiaryAthWalletAddress, createShardAccount({
      address: beneficiaryAthWalletAddress,
      code: mockInit.code,
      data: mockInit.data,
      balance: toNano('2'),
      workchain: beneficiaryAthWalletAddress.workChain,
    }));
  }

  return { blockchain, vesting, officialWallet, caller, beneficiaryAthWalletAddress };
}

async function claimOneYear(env: Awaited<ReturnType<typeof setup>>) {
  env.blockchain.now = START_TIME + YEAR_SECONDS;
  await env.vesting.send(env.caller.getSender(), { value: toNano('0.2') }, {
    $$type: 'ClaimAthVesting',
    query_id: 1n,
    amount: YEAR_UNLOCK_ATH,
  } as ClaimAthVesting);
}

function recover(env: Awaited<ReturnType<typeof setup>>, value: string) {
  return env.officialWallet.send(env.caller.getSender(), { value: toNano(value) }, {
    $$type: 'ATHRecoverStuckOutgoing',
    query_id: 1n,
    recipient_wallet: env.beneficiaryAthWalletAddress,
  } as ATHRecoverStuckOutgoing);
}

function exitOf(result: { transactions: any[] }, dest: Address): number | undefined {
  const tx = result.transactions.find((t) => t.inMessage?.info?.dest?.equals?.(dest));
  return tx?.description?.computePhase?.exitCode;
}

describe('ATHWallet stuck outgoing recovery', () => {
  it('RECOVER-00: a terminal that never returns freezes the counterparty forever, and the ATH is off the balance', async () => {
    const env = await setup({ stuck: true });
    await claimOneYear(env);

    expect((await env.vesting.getGetVestingState()).phase).toBe(1n);
    expect((await env.officialWallet.getGetWalletData()).balance).toBe(TOTAL_VESTING_ATH - YEAR_UNLOCK_ATH);

    env.blockchain.now = START_TIME + (3 * YEAR_SECONDS);
    expect((await env.vesting.getGetVestingState()).phase).toBe(1n);

    await env.vesting.send(env.caller.getSender(), { value: toNano('0.2') }, {
      $$type: 'ClaimAthVesting',
      query_id: 2n,
      amount: YEAR_UNLOCK_ATH * 2n,
    } as ClaimAthVesting);
    const state = await env.vesting.getGetVestingState();
    expect(state.phase).toBe(1n);
    expect(state.pending_query_id).toBe(1n);
    expect(state.claimed_ath).toBe(0n);
  });

  it('RECOVER-01: after the grace the wallet unwinds it — ATH restored, counterparty freed, nothing lost', async () => {
    const env = await setup({ stuck: true });
    await claimOneYear(env);

    env.blockchain.now = START_TIME + YEAR_SECONDS + GRACE_SECONDS + 1;
    const res = await recover(env, '0.05');

    expect((await env.officialWallet.getGetWalletData()).balance).toBe(TOTAL_VESTING_ATH);

    expect(exitOf(res, env.vesting.address)).toBe(0);
    const state = await env.vesting.getGetVestingState();
    expect(state.phase).toBe(0n);
    expect(state.claimed_ath).toBe(0n);
    expect(state.last_terminal_query_id).toBe(1n);
    expect(state.claimable_ath).toBe(YEAR_UNLOCK_ATH);
  });

  it('RECOVER-02: a transfer that ALREADY succeeded cannot be unwound — no double spend', async () => {
    const env = await setup();
    await claimOneYear(env);

    const state = await env.vesting.getGetVestingState();
    expect(state.phase).toBe(0n);
    expect(state.claimed_ath).toBe(YEAR_UNLOCK_ATH);
    const balanceAfterDelivery = (await env.officialWallet.getGetWalletData()).balance;
    expect(balanceAfterDelivery).toBe(TOTAL_VESTING_ATH - YEAR_UNLOCK_ATH);

    env.blockchain.now = START_TIME + YEAR_SECONDS + GRACE_SECONDS + 1;
    const res = await recover(env, '0.05');
    expect(exitOf(res, env.officialWallet.address)).toBe(14251);
    expect((await env.officialWallet.getGetWalletData()).balance).toBe(balanceAfterDelivery);
  });

  it('RECOVER-03: inside the grace it is refused, so an in-flight transfer cannot be cancelled under it', async () => {
    const env = await setup({ stuck: true });
    await claimOneYear(env);

    env.blockchain.now = START_TIME + YEAR_SECONDS + GRACE_SECONDS - 1;
    const res = await recover(env, '0.05');
    expect(exitOf(res, env.officialWallet.address)).toBe(14252);
    expect((await env.officialWallet.getGetWalletData()).balance).toBe(TOTAL_VESTING_ATH - YEAR_UNLOCK_ATH);
    expect((await env.vesting.getGetVestingState()).phase).toBe(1n);
  });

  it('RECOVER-04: an underfunded call is refused before any state moves', async () => {
    const env = await setup({ stuck: true });
    await claimOneYear(env);

    env.blockchain.now = START_TIME + YEAR_SECONDS + GRACE_SECONDS + 1;
    const res = await recover(env, '0.005');
    expect(exitOf(res, env.officialWallet.address)).toBe(14250);
    expect((await env.officialWallet.getGetWalletData()).balance).toBe(TOTAL_VESTING_ATH - YEAR_UNLOCK_ATH);
    expect((await env.vesting.getGetVestingState()).phase).toBe(1n);
  });
});
