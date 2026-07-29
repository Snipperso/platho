import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { ATHVesting, ClaimAthVesting } from '../build/ATHVesting/ATHVesting_ATHVesting';
import { ATHRecoverStuckOutgoing, ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';

// Wave-8 HIGH. Every contract that spends ATH parks in a PENDING phase until a terminal comes back from this wallet
// lane. Before ATHRecoverStuckOutgoing existed, a terminal that never arrived froze that counterparty permanently —
// for MarketStabilitySeller, the whole 60,000,000 ATH reserve plus a buyer's paid TON.
//
// The point of this file is NOT that an escape exists. It is that the escape never has to GUESS: the pending entry is
// deleted by the recipient's ack, so its presence after the grace PROVES the ATH never moved. RECOVER-02 is therefore
// the load-bearing test — it shows a completed transfer cannot be unwound a second time.

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
    // A recipient that swallows the internal transfer without acking and without bouncing. This is the ONLY way a
    // pending entry can outlive its transaction, and it is what the recovery is calibrated against.
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

    // Waiting changes nothing on its own: not one handler in ATHVesting reads a clock, so PENDING is terminal.
    // (Three years, not a century: past ~100 years the contract's own rent leaves it unable to answer a getter at
    // all — a separate wave-8 finding, deliberately not entangled with this one.)
    env.blockchain.now = START_TIME + (3 * YEAR_SECONDS);
    expect((await env.vesting.getGetVestingState()).phase).toBe(1n);

    // And the freeze is total, not partial: two more years have vested, but gate 24100 admits a claim only from IDLE,
    // so not one atomic unit of the remaining 9,900,000 ATH can ever be released again.
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

    // The ATH comes back to the wallet it was debited from, exactly.
    expect((await env.officialWallet.getGetWalletData()).balance).toBe(TOTAL_VESTING_ATH);

    // ATHTransferFailed reached the vesting contract and cleared PENDING through the path that already existed.
    expect(exitOf(res, env.vesting.address)).toBe(0);
    const state = await env.vesting.getGetVestingState();
    expect(state.phase).toBe(0n);
    expect(state.claimed_ath).toBe(0n);
    expect(state.last_terminal_query_id).toBe(1n);
    // The tranche is claimable again — the beneficiary lost nothing.
    expect(state.claimable_ath).toBe(YEAR_UNLOCK_ATH);
  });

  it('RECOVER-02: a transfer that ALREADY succeeded cannot be unwound — no double spend', async () => {
    const env = await setup(); // real ATHWallet at the recipient: the transfer completes and acks
    await claimOneYear(env);

    const state = await env.vesting.getGetVestingState();
    expect(state.phase).toBe(0n);
    expect(state.claimed_ath).toBe(YEAR_UNLOCK_ATH);
    const balanceAfterDelivery = (await env.officialWallet.getGetWalletData()).balance;
    expect(balanceAfterDelivery).toBe(TOTAL_VESTING_ATH - YEAR_UNLOCK_ATH);

    // Wait out the grace and try to "recover" a delivery that happened. The recipient's ack already deleted the
    // entry, so there is nothing to unwind and the wallet refuses instead of minting the amount a second time.
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
    const res = await recover(env, '0.005'); // below the 12,000,000 floor the ATHTransferFailed leg needs
    expect(exitOf(res, env.officialWallet.address)).toBe(14250);
    expect((await env.officialWallet.getGetWalletData()).balance).toBe(TOTAL_VESTING_ATH - YEAR_UNLOCK_ATH);
    expect((await env.vesting.getGetVestingState()).phase).toBe(1n);
  });
});
