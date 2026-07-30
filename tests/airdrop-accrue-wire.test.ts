import { describe, expect, it } from 'vitest';
import { Address, contractAddress, beginCell, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { AirdropPool } from '../build/AirdropPool/AirdropPool_AirdropPool';
import { AirdropTicket } from '../build/AirdropTicket/AirdropTicket_AirdropTicket';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { FA_BUYBACK } from './helpers/fee-sink-fixture';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AIRDROP-ACCRUE-WIRE — the two sides of one opcode, put in the same room.
//
// FeeAccumulator does not import AirdropPool (that would rebuild the code cycle); it declares AirdropAccrue
// LOCALLY with the same opcode, and a comment promising the two mirror each other. Nothing checked the promise.
//
// Every existing test of this path substitutes a stub for the other side — tests/fee-accumulator-accrual.test.ts
// uses blockchain.treasury('fa-pool') as the pool, tests/shard-fee-passthrough.test.ts uses a bare address
// constant — so both sides were green while never having met. This suite is the meeting.
//
// The stake is the whole airdrop: 15,000,000 ATH, 15% of supply. A claim debits the ticket's credits FIRST
// (AirdropTicket), FeeAccumulator then acks the ticket that the redeem succeeded, and only afterwards does the
// pool get a chance to refuse. If the pool refuses, the credits are gone and the ATH never moves.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const FA_TREASURY = Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH');
const OP_AIRDROP_ACCRUE = 0x41445210;
const MANIFEST = 0x41435752455F57495245000000000000000000000000000000000000000001n;
const TOTAL_POOL = 15_000_000_000_000_000n;   // AIRDROP_TOTAL_POOL — 15M ATH, gate 26044 wants it EXACTLY

const ticketData = (owner: Address) => beginCell().storeUint(0, 1).storeAddress(owner).endCell();

describe('AIRDROP-ACCRUE-WIRE — FeeAccumulator and AirdropPool must agree on one message', () => {
  it('ACCRUE-WIRE-01: the accrual REACHES the pool and is accepted', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const funder = await bc.treasury('accrue-funder');
    const publisher = await bc.treasury('accrue-publisher');

    // A real pool, sealed exactly as genesis leaves it, not a treasury stub. This single substitution is the whole
    // difference from the suites that already cover this path and pass.
    //
    // Note WHAT is bound as the distributor: FeeAccumulator. AirdropPool still calls the role "credit issuer"
    // because clean-16 filled it with CreditIssuer, but in clean-17 the anonymous-payment layer is gone and the
    // accrual comes from the fee sink. The pool is agnostic to which — the bind is by address.
    const athMaster = await bc.treasury('accrue-ath-master');
    const poolWallet = await bc.treasury('accrue-pool-wallet');
    const treasuryWallet = await bc.treasury('accrue-treasury');
    const controller = await bc.treasury('accrue-controller');

    const sink = bc.openContract(await FeeAccumulator.fromInit(FA_TREASURY, FA_BUYBACK));

    const pool = bc.openContract(await AirdropPool.fromInit(controller.address, MANIFEST, 0n, false));
    await pool.send(funder.getSender(), { value: toNano('5') }, { $$type: 'AirdropTopUpStorageReserve' } as any);
    const gen = (body: any, v = '0.1') => pool.send(controller.getSender(), { value: toNano(v) }, body);
    await gen({ $$type: 'AirdropBindAthMaster', ath_master_address: athMaster.address, pool_ath_wallet_address: poolWallet.address });
    await gen({ $$type: 'AirdropBindCreditIssuer', credit_issuer_address: sink.address });
    await gen({ $$type: 'AirdropBindTreasury', treasury_address: treasuryWallet.address });
    await pool.send(poolWallet.getSender(), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification', query_id: 1n, sender_key: 0n, amount: TOTAL_POOL, sender_wallet: treasuryWallet.address,
    } as any);
    await gen({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: MANIFEST });
    expect((await pool.getGetGlobal()).sealed, 'the pool must be sealed before it will accrue anything').toBe(true);

    await sink.send(funder.getSender(), { value: toNano('1') }, { $$type: 'TopUpStorageReserve' } as any);
    const gov = bc.sender(FA_TREASURY);
    await sink.send(gov, { value: toNano('0.1') }, { $$type: 'BindShardCode', shard_code: (await RecordShard.init(1n, 1n)).code } as any);
    await sink.send(gov, { value: toNano('0.1') }, { $$type: 'BindIntroShardCode', intro_shard_code: (await IntroShard.init(1n, 1n)).code } as any);
    await sink.send(gov, { value: toNano('0.1') }, { $$type: 'BindTicketCode', ticket_code: (await AirdropTicket.init(FA_TREASURY)).code } as any);
    await sink.send(gov, { value: toNano('0.1') }, { $$type: 'BindAirdropPool', airdrop_pool_address: pool.address } as any);

    // Credit a ticket the way a real publish does, then claim it.
    const ticketAddr = contractAddress(0, {
      code: (await AirdropTicket.init(FA_TREASURY)).code,
      data: ticketData(publisher.address),
    });
    // AT_MIN_CLAIM_CREDITS = 10: a claim below the batching threshold is refused outright (27012), so the ticket
    // must be credited past it before anything reaches the pool.
    for (let i = 0; i < 70; i++) {
      bc.now = CLOCK + i * 97;
      await sink.send(bc.sender(await shardAddressFor(i)), { value: toNano('0.05') }, {
        $$type: 'DepositCapsuleFee',
        amount: 10_000_000n,
        lane: 0n,
        publisher: publisher.address,
        init_arg0: BigInt(i + 1),
        init_arg1: 1n,
      } as any);
    }
    const ticket = bc.openContract(AirdropTicket.fromAddress(ticketAddr));
    const credits = (await ticket.getGetTicket()).credits;
    expect(credits, 'the publisher must hold claimable credits before the claim').toBeGreaterThan(0n);

    const claim = await ticket.send(publisher.getSender(), { value: toNano('1') }, { $$type: 'TicketClaim' } as any);

    const atPool = (claim.transactions as any[]).find((t) => {
      if (!t.inMessage?.info?.dest?.equals?.(pool.address)) return false;
      const body = t.inMessage.body?.beginParse?.();
      return body && body.remainingBits >= 32 && body.preloadUint(32) === OP_AIRDROP_ACCRUE;
    });

    // eslint-disable-next-line no-console
    console.log([
      '[ACCRUE-WIRE-01] the accrual as the pool actually receives it',
      `  reached the pool          ${Boolean(atPool)}`,
      `  compute exit             ${atPool?.description?.computePhase?.exitCode}`,
      `  ticket credits after     ${(await ticket.getGetTicket()).credits} (was ${credits})`,
      `  pool distributed_total     ${(await pool.getGetGlobal()).distributed_total}`,
    ].join('\n'));

    // The severity is not one lost claim. TicketClaim moves credits into `in_flight` BEFORE the pool sees the
    // message, and gate 27011 refuses any further claim while in_flight != 0. FeeAccumulator has no
    // bounced<AirdropAccrue> handler, so nothing ever clears it.
    const after = await ticket.getGetTicket();
    // eslint-disable-next-line no-console
    console.log(`  ticket in_flight after   ${after.in_flight}  <- 27011 refuses every later claim while this is non-zero`);
    expect(after.in_flight, 'a failed accrual must not strand the credits in flight forever').toBe(0n);

    expect(atPool, 'the accrual must reach the pool at all').toBeDefined();
    expect(atPool?.description?.computePhase?.exitCode,
      'the pool must ACCEPT the accrual FeeAccumulator actually sends — exit 9 is a body-layout mismatch, and it '
      + 'costs the publisher their credits because the ticket was debited and acked before the pool ever ran')
      .toBe(0);
    expect((await pool.getGetGlobal()).distributed_total,
      'and the ATH must actually move — this is the 15,000,000 ATH airdrop').toBeGreaterThan(0n);
  }, 300_000);

  it('ACCRUE-WIRE-02: EVERY declaration of opcode 0x41445210 is byte-identical', async () => {
    // The structural twin of the test above. FeeAccumulator and CreditIssuer each declare AirdropAccrue LOCALLY
    // rather than importing it (importing would drag AirdropPool's code in and rebuild the address cycle). That is
    // a sound decision, and it turns "they mirror each other" into a promise nothing enforced.
    //
    // Sweep the whole contracts/ directory rather than naming two files: the bug existed precisely because a THIRD
    // declaration was added when FeeAccumulator was wired to the pool for clean-17, and a two-file check written
    // today would miss the fourth one written tomorrow.
    const { readFileSync, readdirSync } = await import('node:fs');
    const declarations = new Map<string, string>();
    for (const file of readdirSync('contracts').filter((f) => f.endsWith('.tact'))) {
      const source = readFileSync(`contracts/${file}`, 'utf8');
      const match = /message\(0x41445210\)\s+AirdropAccrue\s*\{([^}]*)\}/.exec(source);
      if (!match) continue;
      const shape = match[1].split(/\r?\n/).map((l) => l.split('//')[0].trim()).filter(Boolean).join(' ');
      declarations.set(file, shape);
    }

    // eslint-disable-next-line no-console
    console.log(['[ACCRUE-WIRE-02] every declaration of opcode 0x41445210',
      ...[...declarations].map(([f, d]) => `  ${f.padEnd(22)} ${d}`)].join('\n'));

    expect(declarations.size, 'the opcode must be declared somewhere, or this test is vacuous').toBeGreaterThan(1);
    const shapes = new Set(declarations.values());
    expect([...shapes], 'one opcode, one wire format — a mismatch on the LAST field is a silent cell underflow')
      .toHaveLength(1);
  });

  it('ACCRUE-WIRE-03: EVERY declaration of opcode 0x52535046 (DepositCapsuleFee) is byte-identical', async () => {
    // The same guard for the fee-carrying message. RecordShard, IntroShard, PublicShard and FeeAccumulator each
    // declare DepositCapsuleFee LOCALLY (a shard cannot import the sink without rebuilding the address cycle), and
    // a drift here does not underflow — it moves the fee to a body FeeAccumulator's gate 15055 rejects, so every
    // publish's fee bounces. PublicShard added a fourth copy on 2026-07-21; sweeping the directory catches a fifth.
    const { readFileSync, readdirSync } = await import('node:fs');
    const declarations = new Map<string, string>();
    for (const file of readdirSync('contracts').filter((f) => f.endsWith('.tact'))) {
      const source = readFileSync(`contracts/${file}`, 'utf8');
      const match = /message\(0x52535046\)\s+DepositCapsuleFee\s*\{([^}]*)\}/.exec(source);
      if (!match) continue;
      declarations.set(file, match[1].split(/\r?\n/).map((l) => l.split('//')[0].trim()).filter(Boolean).join(' '));
    }

    // eslint-disable-next-line no-console
    console.log(['[ACCRUE-WIRE-03] every declaration of opcode 0x52535046',
      ...[...declarations].map(([f, d]) => `  ${f.padEnd(22)} ${d}`)].join('\n'));

    expect(declarations.size, 'DepositCapsuleFee must be declared in more than one place, or this is vacuous').toBeGreaterThan(2);
    expect([...new Set(declarations.values())], 'one fee message, one wire format — a drift bounces every fee')
      .toHaveLength(1);
  });
});

/** A distinct bound shard address per credit, so gate 15055 accepts each deposit as a different shard. */
async function shardAddressFor(i: number): Promise<Address> {
  return contractAddress(0, {
    code: (await RecordShard.init(1n, 1n)).code,
    data: beginCell().storeUint(0, 1).storeInt(BigInt(i + 1), 257).storeInt(1n, 257).endCell(),
  });
}
