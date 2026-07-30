import { describe, expect, it } from 'vitest';
import { Address, contractAddress, beginCell, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { readFileSync } from 'node:fs';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { AirdropPool } from '../build/AirdropPool/AirdropPool_AirdropPool';
import { AirdropTicket } from '../build/AirdropTicket/AirdropTicket_AirdropTicket';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { FA_BUYBACK, FEE_SINK } from './helpers/fee-sink-fixture';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// IN-FLIGHT DEAD-MAN — the interlock that had no way out.
//
// TicketRedeemAck is the ONLY thing that clears in_flight on a successful claim. It is sent bounce:false and
// FeeAccumulator funds it with a RESIDUAL: inbound minus the 60,000,000 accrue leg minus its own 2,000,000
// reserve. At exactly AT_CLAIM_MIN_VALUE that residual is 539,131 against an ack costing 196,134 to run.
//
// And this account is never endowed. It is deployed BY its first credit and keeps only the scraps of one —
// MEASURED 402,532 on the deploy, +401,599 per credit after — against 974,433/year of rent. A ticket that stops
// publishing runs to zero and then accrues DEBT, and the claim does not pay that debt off, because its whole
// inbound value leaves again with the redeem. So the debt is still standing when the ack arrives, it eats the
// 539,131, and the ack cannot run. bounce:false means nobody is told.
//
// MEASURED 2026-07-29 over the whole real chain (real FeeAccumulator, real AirdropPool), ticket with 12 credits:
//     1,800 days  ack exit 0        in_flight cleared
//     1,950 days  ack exit -14      in_flight STUCK at 12
//     2,005 days+ compute SKIPPED   in_flight STUCK at 12    <- no exit code at all
// The claim SUCCEEDS — the pool pays the ATH. What dies is the ticket: 27011 refuses every later claim and
// 27031 refuses every export, so all future credits are stranded and the clean-18 migration hook goes with them.
//
// These tests reproduce that jam and prove TicketUnjam is the way out.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const DAY = 24 * 3600;
const FA_TREASURY = Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH');
const MANIFEST = 0x41435752455F57495245000000000000000000000000000000000000000001n;
const TOTAL_POOL = 15_000_000_000_000_000n;
const AT_CLAIM_MIN_VALUE = 63_000_000n;
const OP_TICKET_REDEEM_ACK = 0x41544334;
const JAM_AGE_DAYS = 2005;          // measured: past here the ack's compute is skipped outright

const ticketData = (owner: Address) => beginCell().storeUint(0, 1).storeAddress(owner).endCell();

/** The whole real chain: FeeAccumulator at the address the ticket has baked in, a sealed pool behind it. */
async function chain(tag: string) {
  const bc = await Blockchain.create();
  bc.now = CLOCK;
  const funder = await bc.treasury(`${tag}-funder`);
  const publisher = await bc.treasury(`${tag}-publisher`);
  const stranger = await bc.treasury(`${tag}-stranger`);

  const faInit = await FeeAccumulator.init(FA_TREASURY, FA_BUYBACK);
  await bc.setShardAccount(FEE_SINK, createShardAccount({
    address: FEE_SINK, code: faInit.code, data: faInit.data, balance: toNano('10'), workchain: 0,
  }));
  const sink = bc.openContract(new FeeAccumulator(FEE_SINK, faInit));

  const athMaster = await bc.treasury(`${tag}-ath-master`);
  const poolWallet = await bc.treasury(`${tag}-pool-wallet`);
  const treasuryWallet = await bc.treasury(`${tag}-treasury`);
  const controller = await bc.treasury(`${tag}-controller`);
  const pool = bc.openContract(await AirdropPool.fromInit(controller.address, MANIFEST, 0n, false));
  await pool.send(funder.getSender(), { value: toNano('5') }, { $$type: 'AirdropTopUpStorageReserve' } as any);
  const gen = (body: any) => pool.send(controller.getSender(), { value: toNano('0.1') }, body);
  await gen({ $$type: 'AirdropBindAthMaster', ath_master_address: athMaster.address, pool_ath_wallet_address: poolWallet.address });
  await gen({ $$type: 'AirdropBindCreditIssuer', credit_issuer_address: FEE_SINK });
  await gen({ $$type: 'AirdropBindTreasury', treasury_address: treasuryWallet.address });
  await pool.send(poolWallet.getSender(), { value: toNano('0.1') }, {
    $$type: 'AthTransferNotification', query_id: 1n, sender_key: 0n, amount: TOTAL_POOL, sender_wallet: treasuryWallet.address,
  } as any);
  await gen({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST });

  const gov = bc.sender(FA_TREASURY);
  await sink.send(gov, { value: toNano('0.1') }, { $$type: 'BindShardCode', shard_code: (await RecordShard.init(1n, 1n)).code } as any);
  await sink.send(gov, { value: toNano('0.1') }, { $$type: 'BindIntroShardCode', intro_shard_code: (await IntroShard.init(1n, 1n)).code } as any);
  await sink.send(gov, { value: toNano('0.1') }, { $$type: 'BindTicketCode', ticket_code: (await AirdropTicket.init(FA_TREASURY)).code } as any);
  await sink.send(gov, { value: toNano('0.1') }, { $$type: 'BindAirdropPool', airdrop_pool_address: pool.address } as any);

  const ticketAddr = contractAddress(0, {
    code: (await AirdropTicket.init(FA_TREASURY)).code,
    data: ticketData(publisher.address),
  });
  let fee = 0;
  /** Credit the ticket the way a real publish does — through FeeAccumulator, not by hand. */
  const publish = async (n: number) => {
    for (let i = 0; i < n; i += 1, fee += 1) {
      await sink.send(bc.sender(contractAddress(0, await RecordShard.init(BigInt(fee + 1), 1n))), { value: toNano('0.05') }, {
        $$type: 'DepositCapsuleFee', amount: 10_000_000n, lane: 0n, publisher: publisher.address,
        init_arg0: BigInt(fee + 1), init_arg1: 1n,
      } as any);
    }
  };
  return { bc, publisher, stranger, ticketAddr, publish, ticket: () => bc.openContract(AirdropTicket.fromAddress(ticketAddr)) };
}

/** Same idiom tests/airdrop-pool.test.ts uses — read the exit code off the transaction, no matcher plugin. */
function exitOf(res: any, dest: Address): number {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());
  return Number(tx?.description?.computePhase?.exitCode ?? -999);
}

const ackTxOf = (res: any, dest: Address) => (res.transactions as any[]).find((t) => {
  if (!t.inMessage?.info?.dest?.equals?.(dest)) return false;
  const b = t.inMessage.body?.beginParse?.();
  return b && b.remainingBits >= 32 && b.preloadUint(32) === OP_TICKET_REDEEM_ACK;
});

describe('IN-FLIGHT DEAD-MAN — a settlement that never returns must not be terminal', () => {
  it('DEADMAN-00: the grace and the stamp exist in the CONTRACT, not just in this file', () => {
    // Read the source, not a mirror. A mirrored constant that drifts is how a frozen 1,000,000 once survived
    // unexamined in ATHWallet; the same discipline applies here.
    const src = readFileSync('contracts/AirdropTicket.tact', 'utf8');
    const grace = /const AT_INFLIGHT_DEADMAN_GRACE_SECONDS: Int = (\d+);/.exec(src);
    expect(grace, 'the dead-man grace must exist under this name').not.toBeNull();
    const seconds = Number(grace![1]);
    // Long enough that it cannot race an honest settlement (which completes in the same chain of transactions,
    // seconds after the claim), short enough that a jammed publisher is not locked out for a season.
    expect(seconds).toBeGreaterThanOrEqual(24 * 3600);
    expect(seconds).toBeLessThanOrEqual(30 * DAY);
    expect(src, 'the claim must stamp when the credits went into flight').toMatch(/self\.in_flight_at = now\(\);/);
    expect(src, 'both clearing paths must clear the stamp too').toMatch(/self\.in_flight_at = 0;/);
  });

  it('DEADMAN-01: the jam reproduces, and TicketUnjam is the way out', async () => {
    const env = await chain('jam');
    await env.publish(12);
    expect((await env.ticket().getGetTicket()).credits).toBe(12n);

    // Age the ticket past the point where its own storage debt outweighs what the ack carries.
    env.bc.now = CLOCK + JAM_AGE_DAYS * DAY;
    const claim = await env.ticket().send(env.publisher.getSender(), { value: AT_CLAIM_MIN_VALUE },
      { $$type: 'TicketClaim' } as any);

    const ack = ackTxOf(claim, env.ticketAddr);
    expect(ack, 'the ack is emitted — it simply cannot run').toBeDefined();
    // THE DEFECT, reproduced: the ack arrives, its compute never happens, and nothing bounces. An exit-code
    // check sees nothing here at all — there is no exit code to see.
    expect(ack.description.computePhase.type,
      'the ack must be the SKIPPED-compute case this test exists for; if this ever reads "vm" the fixture stopped '
      + 'reproducing the jam and everything below proves nothing').toBe('skipped');
    const jammed = await env.ticket().getGetTicket();
    expect(jammed.in_flight, 'in_flight is stuck — this is the jam').toBe(12n);
    expect(jammed.credits, 'and the credits are already gone, so nothing can be re-claimed').toBe(0n);
    expect(jammed.in_flight_at, 'the dead-man clock started at the claim').toBe(BigInt(CLOCK + JAM_AGE_DAYS * DAY));

    // Before this fix that was the end of the ticket. Both doors are shut:
    const blockedClaim = await env.ticket().send(env.publisher.getSender(), { value: AT_CLAIM_MIN_VALUE },
      { $$type: 'TicketClaim' } as any);
    expect(exitOf(blockedClaim, env.ticketAddr), 'a jammed ticket refuses every later claim').toBe(27011);
    const blockedExport = await env.ticket().send(env.publisher.getSender(), { value: toNano('0.05') },
      { $$type: 'TicketExportCredits', to: env.stranger.address } as any);
    expect(exitOf(blockedExport, env.ticketAddr), 'and refuses the clean-18 export too').toBe(27031);

    // The grace has not elapsed, so the release is refused.
    const tooEarly = await env.ticket().send(env.publisher.getSender(), { value: toNano('0.05') },
      { $$type: 'TicketUnjam' } as any);
    expect(exitOf(tooEarly, env.ticketAddr), 'the grace has not elapsed').toBe(27042);
    expect((await env.ticket().getGetTicket()).in_flight, 'and nothing moved').toBe(12n);

    // Past the grace it works — and the value the owner attaches STAYS in the account, because this handler
    // sends nothing. That is what re-endows a ticket the rent had emptied.
    const grace = Number((await env.ticket().getGetTicket()).unjam_grace_seconds);
    env.bc.now = CLOCK + JAM_AGE_DAYS * DAY + grace + 1;
    await env.ticket().send(env.publisher.getSender(), { value: toNano('0.05') }, { $$type: 'TicketUnjam' } as any);
    const freed = await env.ticket().getGetTicket();
    expect(freed.in_flight, 'the interlock is released').toBe(0n);
    expect(freed.in_flight_at, 'and so is the clock').toBe(0n);

    // The ticket is genuinely alive again: new credits accrue, and a claim now settles cleanly.
    await env.publish(10);
    expect((await env.ticket().getGetTicket()).credits).toBe(10n);
    const again = await env.ticket().send(env.publisher.getSender(), { value: AT_CLAIM_MIN_VALUE },
      { $$type: 'TicketClaim' } as any);
    const ack2 = ackTxOf(again, env.ticketAddr);
    expect(ack2?.description?.computePhase?.type, 'the re-endowed account can afford its own settlement').toBe('vm');
    expect(ack2?.description?.computePhase?.exitCode).toBe(0);
    expect((await env.ticket().getGetTicket()).in_flight, 'and it clears itself, as it always should have').toBe(0n);
  }, 300_000);

  it('DEADMAN-02: the release is the owner\'s alone, and only of something actually in flight', async () => {
    const env = await chain('auth');
    await env.publish(12);

    // Nothing in flight yet: there is nothing to release.
    const nothing = await env.ticket().send(env.publisher.getSender(), { value: toNano('0.05') },
      { $$type: 'TicketUnjam' } as any);
    expect(exitOf(nothing, env.ticketAddr), 'nothing is in flight to release').toBe(27041);

    env.bc.now = CLOCK + JAM_AGE_DAYS * DAY;
    await env.ticket().send(env.publisher.getSender(), { value: AT_CLAIM_MIN_VALUE }, { $$type: 'TicketClaim' } as any);
    expect((await env.ticket().getGetTicket()).in_flight).toBe(12n);

    env.bc.now = CLOCK + (JAM_AGE_DAYS + 30) * DAY;
    const stranger = await env.ticket().send(env.stranger.getSender(), { value: toNano('0.05') },
      { $$type: 'TicketUnjam' } as any);
    expect(exitOf(stranger, env.ticketAddr), 'only the owner may release it').toBe(27040);
    expect((await env.ticket().getGetTicket()).in_flight, 'a stranger may not touch the interlock').toBe(12n);
  }, 300_000);

  it('DEADMAN-03: a bounce arriving after a release still restores the credits', async () => {
    // The one interleaving that could be argued to double-spend: release the interlock, then have the redeem's
    // bounce turn up. It cannot double-spend, because a bounce means the pool never paid — the credits come
    // back, exactly as they would have without the release.
    const env = await chain('bounce');
    await env.publish(12);
    const before = (await env.ticket().getGetTicket()).credits;

    env.bc.now = CLOCK + JAM_AGE_DAYS * DAY;
    await env.ticket().send(env.publisher.getSender(), { value: AT_CLAIM_MIN_VALUE }, { $$type: 'TicketClaim' } as any);
    expect((await env.ticket().getGetTicket()).in_flight).toBe(before);

    env.bc.now = CLOCK + (JAM_AGE_DAYS + 30) * DAY;
    await env.ticket().send(env.publisher.getSender(), { value: toNano('0.05') }, { $$type: 'TicketUnjam' } as any);
    expect((await env.ticket().getGetTicket()).in_flight).toBe(0n);

    // Now the late bounce. Only the first 224 bits of a bounced body survive, which is why credits_k is first.
    const body = beginCell()
      .storeUint(0xFFFFFFFF, 32)
      .storeUint(0x41544333, 32)
      .storeUint(Number(before), 32)
      .endCell();
    await env.bc.sendMessage({
      info: {
        type: 'internal', ihrDisabled: true, bounce: false, bounced: true,
        src: FEE_SINK, dest: env.ticketAddr, value: { coins: toNano('0.05') },
        ihrFee: 0n, forwardFee: 0n, createdLt: 0n, createdAt: 0,
      },
      body,
    } as any);

    const after = await env.ticket().getGetTicket();
    expect(after.credits, 'a bounce means the pool never paid, so the credits must come back').toBe(before);
    expect(after.in_flight, 'and the interlock stays released').toBe(0n);
  }, 300_000);
});
