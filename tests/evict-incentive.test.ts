import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { toNano, beginCell, contractAddress } from '@ton/core';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { buildIntroPublish, buildConvPublish } from '../web/publish-builder.mjs';
import { epochOf } from '../web/shard-discovery.mjs';
import { ed25519 } from '@noble/curves/ed25519.js';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// EVICT-INCENTIVE — does anyone actually have a reason to call eviction?
//
// This test did not exist, and its absence hid a hole that reached the edge of the seal. Every claim this project
// makes about bounded state rests on eviction happening: the one-week INTRO retention (so that the first-contact
// graph does not persist and "a later scan finds nothing"), the one-year CONV retention, the reclamation of dead
// shards. External keeper daemons are FORBIDDEN here — the founding rule — so the only possible caller is an
// ordinary self-interested participant. That makes profitability not a nicety but the mechanism itself.
//
// Measured on 2026-07-18, BEFORE the fix, a full 64-entry sweep LOST the caller 19_012_953 nanoton on INTRO and
// 12_598_501 on CONV. Nobody would ever have called it, so nothing would ever have been evicted: intros would have
// persisted for the life of the shard and get_view_tags would have kept serving them — the exact opposite of the
// lane's stated purpose.
//
// The cause was structural, not a mistuned number: the payout was the freed STORAGE endowment, and a storage
// endowment is by construction consumed by the storage it paid for, so at eviction time there is nothing left of
// it. The floor also (correctly) protects accrued_fee, which belongs to the liquidity pool rather than the caller.
// The fix is a separate per-entry EVICT_BOUNTY, funded at publish, held untouched, released only on eviction.
//
// The old tests could not have caught this. PB-12 pins that a NO-OP eviction cannot drain the shard and PB-13 pins
// that a genuine one does not run off with a top-up — both are upper bounds on the payout. Nothing anywhere
// asserted a LOWER bound, and the whole retention story depends on the lower bound.
//
// AND THE FIRST VERSION OF THIS TEST WAS ITSELF TOO WEAK — an adversarial review caught it. It pinned only n=16
// and n=64, which is exactly the region where the sign was still positive, and it called the SMALL batch "the
// harder case". The opposite is true: marginal gas per evicted entry grows with dictionary DEPTH (measured on
// CONV: 283_082 per entry at 64 records, 366_519 at 256, 449_853 at 1024, 533_186 at the 4096 SAFE_CAP), so the
// hard case is a FULL shard. A bounty calibrated at 64 records went loss-making from ~80 upward. DEEP-01/DEEP-02
// below pin the caps themselves, because the caps are what the immutable contract actually permits.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const cell = (f: number) => beginCell().storeBuffer(Buffer.alloc(64, f)).endCell();

// Clock after the Apr-2026 config-18 switch — before it a cell-year costs 240631 plus billed bits instead of
// 64962 with bits free, which would misprice every rent figure this test depends on.
const CLOCK = 1_790_000_000;

describe('EVICT-INCENTIVE — eviction only happens if calling it pays', () => {
  // Two batch sizes: the full IS_EVICT_CAP/RS_EVICT_CAP sweep, and a small one. The small batch is the harder
  // case — the call's fixed overhead is amortised over fewer entries — so a bounty that only works at 64 would
  // leave a shard with a short tail of stale entries permanently unswept.
  it.each([16, 64])('an INTRO sweep of %i pays its caller more than it costs', async (n) => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const epoch = epochOf(bc.now);
    const payer = await bc.treasury('ei-payer');
    const bucket = 5n;
    for (let i = 0; i < n; i += 1) {
      const b = await buildIntroPublish({ epoch, bucket, r: BigInt(i + 1), viewTag: BigInt(i), header0: cell(i), body: cell(i + 1), value: toNano('0.05') });
      await payer.send({ to: b.to, value: b.value, body: b.body, init: b.init, bounce: true } as any);
    }
    const shard = bc.openContract(IntroShard.fromAddress(contractAddress(0, await IntroShard.init(BigInt(epoch), bucket))));
    expect((await shard.getGetView()).live_count).toBe(BigInt(n));
    expect((await shard.getGetView()).accrued_bounty, 'each intro pre-funds its own eviction').toBe(BigInt(n) * 900_000n);

    bc.now = bc.now! + 604800 + 86400;   // past the one-week retention
    const keeper = await bc.treasury('ei-keeper');
    const before = (await bc.getContract(keeper.address)).balance;
    await shard.send(keeper.getSender(), { value: toNano('0.5') }, { $$type: 'EvictIntros', max_count: BigInt(n) } as any);
    const net = (await bc.getContract(keeper.address)).balance - before;

    expect((await shard.getGetView()).live_count, 'the sweep actually cleared the entries').toBe(0n);
    expect(net, `an INTRO sweep of ${n} must leave the caller ahead, not out of pocket`).toBeGreaterThan(0n);
    expect((await shard.getGetView()).accrued_bounty, 'the bounty was paid out, not double-held').toBe(0n);
    // The protocol fee is no longer any of this receiver's business: it leaves at PUBLISH time, straight to
    // FeeAccumulator, so eviction moves only the bounty. See tests/shard-fee-passthrough.test.ts.
  }, 300_000);

  it.each([16, 64])('a CONV sweep of %i pays its caller more than it costs', async (n) => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const epoch = epochOf(bc.now);
    const payer = await bc.treasury('ei-payer2');
    const secret = new Uint8Array(32).fill(0x33);
    const publicKey = ed25519.getPublicKey(secret);
    let to: any = null;
    for (let i = 0; i < n; i += 1) {
      const b = await buildConvPublish({ writePublicKey: publicKey, writeSecret: secret, seq: BigInt(i + 1), epoch, header0: cell(i), header1: cell(i + 1), body: cell(i + 2), value: toNano('0.05') });
      to = b.to;
      await payer.send({ to: b.to, value: b.value, body: b.body, init: b.init, bounce: true } as any);
    }
    const shard = bc.openContract(RecordShard.fromAddress(to));
    expect((await shard.getGetView()).live_count).toBe(BigInt(n));
    expect((await shard.getGetView()).accrued_bounty).toBe(BigInt(n) * 800_000n);

    bc.now = bc.now! + 31536000 + 86400;   // past the one-year retention
    const keeper = await bc.treasury('ei-keeper2');
    const before = (await bc.getContract(keeper.address)).balance;
    await shard.send(keeper.getSender(), { value: toNano('0.5') }, { $$type: 'EvictRecords', max_count: BigInt(n) } as any);
    const net = (await bc.getContract(keeper.address)).balance - before;

    expect((await shard.getGetView()).live_count).toBe(0n);
    expect(net, `a CONV sweep of ${n} must leave the caller ahead, not out of pocket`).toBeGreaterThan(0n);
    expect((await shard.getGetView()).accrued_bounty).toBe(0n);
    // The fee left at publish time; eviction moves only the bounty. See tests/shard-fee-passthrough.test.ts.
  }, 300_000);

  it('DEEP-01: a sweep of a FULL CONV shard still pays — the bounty is sized at RS_SAFE_CAP, not at a small batch', async () => {
    // 4096 records is what the contract permits, so it is what the bounty must survive. Measured marginal gas at
    // this depth is 533_186 per entry against a 800_000 bounty.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const epoch = epochOf(bc.now);
    const payer = await bc.treasury('deep-payer');
    const secret = new Uint8Array(32).fill(0x55);
    const publicKey = ed25519.getPublicKey(secret);
    let to: any = null;
    for (let i = 0; i < 4096; i += 1) {
      const b = await buildConvPublish({ writePublicKey: publicKey, writeSecret: secret, seq: BigInt(i + 1), epoch, header0: cell(i & 255), header1: cell((i + 1) & 255), body: cell((i + 2) & 255), value: toNano('0.05') });
      to = b.to;
      await payer.send({ to: b.to, value: b.value, body: b.body, init: b.init, bounce: true } as any);
    }
    const shard = bc.openContract(RecordShard.fromAddress(to));
    expect((await shard.getGetView()).live_count).toBe(4096n);

    bc.now = bc.now! + 31536000 + 86400;
    const keeper = await bc.treasury('deep-keeper');
    const before = (await bc.getContract(keeper.address)).balance;
    await shard.send(keeper.getSender(), { value: toNano('1') }, { $$type: 'EvictRecords', max_count: 64n } as any);
    const net = (await bc.getContract(keeper.address)).balance - before;
    expect(net, 'sweeping a FULL shard must still pay the caller').toBeGreaterThan(0n);
  }, 1_800_000);

  it('DEEP-02: a long-idle shard is no harder to sweep than a fresh one — rent is not charged to the caller', async () => {
    // The first fix reserved max(floor, original - freed - payout), and because the publish path reserves those
    // same terms relatively, the clamp always won and the shard's ENTIRE accumulated rent came out of the caller.
    // A decade of arrears made the first sweep cost the caller their whole attached value. Now the reserve lets go
    // of the bounty alone, so idle time cannot enter the caller's ledger at all.
    const run = async (idleYears: number) => {
      const bc = await Blockchain.create();
      bc.now = CLOCK;
      const epoch = epochOf(bc.now);
      const payer = await bc.treasury('idle-payer');
      const secret = new Uint8Array(32).fill(0x66);
      const publicKey = ed25519.getPublicKey(secret);
      let to: any = null;
      for (let i = 0; i < 128; i += 1) {
        const b = await buildConvPublish({ writePublicKey: publicKey, writeSecret: secret, seq: BigInt(i + 1), epoch, header0: cell(i & 255), header1: cell((i + 1) & 255), body: cell((i + 2) & 255), value: toNano('0.05') });
        to = b.to;
        await payer.send({ to: b.to, value: b.value, body: b.body, init: b.init, bounce: true } as any);
      }
      const shard = bc.openContract(RecordShard.fromAddress(to));
      bc.now = bc.now! + 31536000 * idleYears + 86400;
      const keeper = await bc.treasury('idle-keeper');
      const before = (await bc.getContract(keeper.address)).balance;
      await shard.send(keeper.getSender(), { value: toNano('1') }, { $$type: 'EvictRecords', max_count: 64n } as any);
      return (await bc.getContract(keeper.address)).balance - before;
    };
    const fresh = await run(1);
    const stale = await run(10);
    expect(fresh, 'a 1-year-idle sweep pays').toBeGreaterThan(0n);
    // Exact equality is restored now that eviction carries no protocol money: nothing in this receiver depends
    // on the shard's balance any more except the bounty itself, so idle time cannot enter the caller's ledger.
    expect(stale, 'a 10-year-idle sweep pays the SAME — arrears are not the caller problem').toBe(fresh);
  }, 1_800_000);

  it('publishing and self-evicting is not a profit loop — the bounty is refunded, never minted', async () => {
    // The bounty is money the publisher put in. If a round trip paid out MORE than it took in, an attacker could
    // farm the shard by publishing junk and immediately reclaiming it. Here the publisher and the evictor are the
    // same party, so the round trip must be a net LOSS (they pay gas twice and the fee once).
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const epoch = epochOf(bc.now);
    const actor = await bc.treasury('ei-actor');
    const bucket = 9n;
    const before = (await bc.getContract(actor.address)).balance;
    for (let i = 0; i < 16; i += 1) {
      const b = await buildIntroPublish({ epoch, bucket, r: BigInt(i + 1), viewTag: BigInt(i), header0: cell(i), body: cell(i + 1), value: toNano('0.05') });
      await actor.send({ to: b.to, value: b.value, body: b.body, init: b.init, bounce: true } as any);
    }
    const shard = bc.openContract(IntroShard.fromAddress(contractAddress(0, await IntroShard.init(BigInt(epoch), bucket))));
    bc.now = bc.now! + 604800 + 86400;
    await shard.send(actor.getSender(), { value: toNano('0.5') }, { $$type: 'EvictIntros', max_count: 16n } as any);
    const net = (await bc.getContract(actor.address)).balance - before;
    expect(net, 'a publish-then-evict round trip must cost the actor, not pay them').toBeLessThan(0n);
  }, 300_000);
});
