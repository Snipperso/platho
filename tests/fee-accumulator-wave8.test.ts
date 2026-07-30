import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { AirdropTicket } from '../build/AirdropTicket/AirdropTicket_AirdropTicket';
import { AirdropPool } from '../build/AirdropPool/AirdropPool_AirdropPool';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { FEE_SINK } from './helpers/fee-sink-fixture';

const NOW = 1_790_000_000;
const YEAR = 31_536_000;
const ENVELOPE = 51_050_000_000n; // BUYBACK_FUNDING_ENVELOPE_NANOTONS

async function setup() {
  const bc = await Blockchain.create();
  bc.now = NOW;
  const treasury = await bc.treasury('fa8-treasury');
  const buyback = await bc.treasury('fa8-buyback');
  const pool = await bc.treasury('fa8-pool');
  const publisher = await bc.treasury('fa8-publisher');

  const init = await FeeAccumulator.init(treasury.address, buyback.address);
  await bc.setShardAccount(FEE_SINK, createShardAccount({
    address: FEE_SINK, code: init.code, data: init.data, balance: toNano('5'), workchain: 0,
  }));
  const fa = bc.openContract(new FeeAccumulator(FEE_SINK, init));

  const ticketCode = (await AirdropTicket.init(treasury.address)).code;
  const bind = (body: any) => fa.send(treasury.getSender(), { value: toNano('0.1') }, body);
  await bind({ $$type: 'BindShardCode', shard_code: (await RecordShard.init(1n, 1n)).code });
  await bind({ $$type: 'BindTicketCode', ticket_code: ticketCode });
  await bind({ $$type: 'BindAirdropPool', airdrop_pool_address: pool.address });

  return { bc, fa, treasury, pool, publisher, ticketCode };
}

/** Put a small, sub-envelope amount into buyback_due through the ordinary split. */
async function seedDust(env: Awaited<ReturnType<typeof setup>>, principal: bigint) {
  // EnableBuybackSplit sweeps whatever has already accumulated straight into treasury_due, so the split must be
  // switched on BEFORE the principal arrives or none of it ever reaches the buyback lane.
  await env.fa.send(env.treasury.getSender(), { value: toNano('0.05') }, { $$type: 'EnableBuybackSplit' } as any);
  await env.fa.send(env.publisher.getSender(), { value: principal + toNano('0.05') }, {
    $$type: 'DepositProtocolFee', amount: principal,
  } as any);
  await env.fa.send(env.publisher.getSender(), { value: toNano('0.05') }, { $$type: 'SplitAccumulated' } as any);
}

describe('FeeAccumulator wave-8', () => {
  it('FAACC-BIND-01: the five one-shot genesis binds are OBSERVABLE, because nothing else can check them', async () => {
    // CEREMONY AUDIT. Every other contract has a seal that refuses while a bind is missing; this one has no seal, the
    // genesis verifier does not snapshot these fields, and the getter did not report them at all. A bind missed during
    // the ceremony is therefore silent — and permanent: each gate demands `== null`, so it cannot be re-bound, and
    // this contract's address is baked into four immutable contracts, so it cannot be replaced. The lane's fee deposit
    // (15055) or every TicketRedeem (15060) then refuses for good.
    const bc = await Blockchain.create();
    bc.now = NOW;
    const treasury = await bc.treasury('fa8b-treasury');
    const buyback = await bc.treasury('fa8b-buyback');
    const pool = await bc.treasury('fa8b-pool');

    const init = await FeeAccumulator.init(treasury.address, buyback.address);
    await bc.setShardAccount(FEE_SINK, createShardAccount({
      address: FEE_SINK, code: init.code, data: init.data, balance: toNano('5'), workchain: 0,
    }));
    const fa = bc.openContract(new FeeAccumulator(FEE_SINK, init));

    const fresh = await fa.getGetState();
    expect(fresh.shard_code_bound, 'a fresh sink reports every bind as missing').toBe(false);
    expect(fresh.intro_shard_code_bound).toBe(false);
    expect(fresh.public_shard_code_bound).toBe(false);
    expect(fresh.ticket_code_bound).toBe(false);
    expect(fresh.airdrop_pool_bound).toBe(false);

    const bind = (body: any) => fa.send(treasury.getSender(), { value: toNano('0.1') }, body);
    await bind({ $$type: 'BindShardCode', shard_code: (await RecordShard.init(1n, 1n)).code });
    await bind({ $$type: 'BindTicketCode', ticket_code: (await AirdropTicket.init(treasury.address)).code });
    await bind({ $$type: 'BindAirdropPool', airdrop_pool_address: pool.address });

    // The PARTIAL state is the one that matters: three landed, two did not, and the ceremony would have had no way to
    // see it. Now it does.
    const partial = await fa.getGetState();
    expect(partial.shard_code_bound).toBe(true);
    expect(partial.ticket_code_bound).toBe(true);
    expect(partial.airdrop_pool_bound).toBe(true);
    expect(partial.intro_shard_code_bound, 'and the two that were skipped are visible as skipped').toBe(false);
    expect(partial.public_shard_code_bound).toBe(false);
  });

  it('FAACC-DUST-01: a sub-envelope buyback remainder cannot leave — and the dead-man is the only way out', async () => {
    const env = await setup();
    await seedDust(env, toNano('1'));

    const dust = (await env.fa.getGetState()).buyback_due_ton;
    expect(dust, 'the split left less than one execution envelope').toBeGreaterThan(0n);
    expect(dust).toBeLessThan(ENVELOPE);

    // Gate 15034 wants the envelope EXACTLY, and BuybackBurn's own 22202 wants the same, so no flush of this amount
    // can ever be built. Before the dead-man existed there was no other outbound path for it at all.
    const beforeTreasuryDue = (await env.fa.getGetState()).treasury_due_ton;
    await env.fa.send(env.publisher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushBuybackDue', amount: dust,
    } as any);
    expect((await env.fa.getGetState()).buyback_due_ton, 'the dust is still stuck').toBe(dust);

    // Inside the inactivity year: refused, so an ordinary short split cannot be raided into the treasury.
    await env.fa.send(env.publisher.getSender(), { value: toNano('0.05') }, {
      $$type: 'ReclassifyStuckBuybackRemainder',
    } as any);
    expect((await env.fa.getGetState()).buyback_due_ton, 'the lane is not dead yet').toBe(dust);

    // A year with nothing arriving on the lane, and only then.
    env.bc.now = NOW + YEAR + 1;
    await env.fa.send(env.publisher.getSender(), { value: toNano('0.05') }, {
      $$type: 'ReclassifyStuckBuybackRemainder',
    } as any);
    const after = await env.fa.getGetState();
    expect(after.buyback_due_ton, 'reclassified in full').toBe(0n);
    expect(after.treasury_due_ton, 'and it landed in the lane that HAS a remainder exit').toBe(beforeTreasuryDue + dust);
  });

  it('FAACC-DUST-02: any activity on the buyback lane re-arms the clock', async () => {
    const env = await setup();
    await seedDust(env, toNano('1'));
    const dust = (await env.fa.getGetState()).buyback_due_ton;

    // Almost a year of silence, then one more split — a dead-man that did not re-arm would fire days later.
    env.bc.now = NOW + YEAR - 10;
    await seedDust(env, toNano('1'));
    expect((await env.fa.getGetState()).buyback_due_ton).toBeGreaterThan(dust);

    env.bc.now = NOW + YEAR + 100;
    const stillDue = (await env.fa.getGetState()).buyback_due_ton;
    await env.fa.send(env.publisher.getSender(), { value: toNano('0.05') }, {
      $$type: 'ReclassifyStuckBuybackRemainder',
    } as any);
    expect((await env.fa.getGetState()).buyback_due_ton, 'the clock restarted at the second split').toBe(stillDue);
  });

  it('FAACC-FLUSH-01: a treasury flush moves the CONTRACT balance, never the caller money', async () => {
    // TIER-3. 15022 required only FEEACCUMULATOR_FLUSH_EXEC_RESERVE from the caller while 15023 allowed flushing
    // exactly FEEACCUMULATOR_MIN_TREASURY_FLUSH_TON — the same 5,000,000. At that ratio the inbound covered the
    // outbound one for one: the treasury got paid, treasury_due_ton fell, and the contract's own nanotons stayed.
    // The identical shape was found in MarketStabilitySeller and fixed there first; this lane was not looked at in
    // the same pass. It was recoverable here (SweepUnaccounted reclassifies the stranded proceeds and
    // SplitAccumulated returns them) but recoverable-if-noticed is not the same as impossible.
    const env = await setup();
    await env.fa.send(env.publisher.getSender(), { value: toNano('1') + toNano('0.05') }, {
      $$type: 'DepositProtocolFee', amount: toNano('1'),
    } as any);
    await env.fa.send(env.publisher.getSender(), { value: toNano('0.05') }, { $$type: 'SplitAccumulated' } as any);

    const due = (await env.fa.getGetState()).treasury_due_ton;
    expect(due, 'there is real protocol revenue to flush').toBeGreaterThan(0n);

    const sinkBefore = (await env.bc.getContract(FEE_SINK)).balance;
    const callerBefore = await env.publisher.getBalance();
    const funded = toNano('0.5');
    await env.fa.send(env.publisher.getSender(), { value: funded }, {
      $$type: 'FlushTreasuryDue', amount: due,
    } as any);
    const sinkAfter = (await env.bc.getContract(FEE_SINK)).balance;

    expect((await env.fa.getGetState()).treasury_due_ton, 'the due is settled').toBe(0n);
    // MEASURED both ways: the contract really paid, and SendRemainingValue did not drain it past the flushed amount.
    expect(sinkBefore - sinkAfter, 'the contract funded the leg out of its own balance').toBeGreaterThan(0n);
    expect(sinkBefore - sinkAfter, 'and no more than the flushed amount plus fees').toBeLessThan(due + toNano('0.02'));
    // The caller is made whole, so a subsidy is not expressible.
    expect(callerBefore - (await env.publisher.getBalance()), 'the caller got their funding back')
      .toBeLessThan(toNano('0.02'));
  });

  it('FAACC-BOUNCE-01: a pool that refuses the accrual is now COUNTED instead of silently swallowed', async () => {
    const env = await setup();

    // Replace the stub pool with the real AirdropPool, unsealed — so AirdropAccrue is refused and bounces back.
    // Before this change the generated router took the unmatched-bounce path and returned, and the publisher's
    // already-debited credits vanished with no trace anywhere on chain.
    const poolInit = await AirdropPool.init(env.treasury.address, 0n, 0n, false);
    await env.bc.setShardAccount(env.pool.address, createShardAccount({
      address: env.pool.address, code: poolInit.code, data: poolInit.data, balance: toNano('1'), workchain: 0,
    }));

    expect((await env.fa.getGetState()).failed_accrual_count).toBe(0n);

    const ticketAddr = contractAddress(0, {
      code: env.ticketCode,
      data: (await AirdropTicket.init(env.publisher.address)).data,
    });
    await env.fa.send(env.bc.sender(ticketAddr), { value: toNano('0.1') }, {
      $$type: 'TicketRedeem', credits_k: 10n, owner: env.publisher.address,
    } as any);

    const state = await env.fa.getGetState();
    expect(state.failed_accrual_count, 'the refusal is now on the record').toBe(1n);
    expect(state.last_failed_accrual_purchase_id, 'and identifies which accrual it was').toBeGreaterThan(0n);
  });

  it('FAACC-CAP-01: a redeem above the pool\'s own credit cap is refused HERE, so the ticket keeps its credits', async () => {
    const env = await setup();
    const ticketAddr = contractAddress(0, {
      code: env.ticketCode,
      data: (await AirdropTicket.init(env.publisher.address)).data,
    });

    const res = await env.fa.send(env.bc.sender(ticketAddr), { value: toNano('0.1') }, {
      $$type: 'TicketRedeem', credits_k: 1001n, owner: env.publisher.address,
    } as any);

    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals?.(FEE_SINK));
    expect(tx?.description?.computePhase?.exitCode, 'fails in COMPUTE so it bounces to the ticket').toBe(15062);
  });
});
