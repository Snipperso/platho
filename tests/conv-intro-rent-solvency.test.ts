import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { toNano, beginCell } from '@ton/core';
import { ed25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { buildConvPublish, buildIntroPublish } from '../web/publish-builder.mjs';
import { CONV_PUBLISH_VALUE, CONV_MIN_VALUE, INTRO_PUBLISH_VALUE, INTRO_MIN_VALUE } from '../web/publish-price.mjs';
import { deployFeeSink } from './helpers/fee-sink-fixture';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONV / INTRO RENT SOLVENCY — the G8 seal gate, measured against the rent the chain ACTUALLY charges.
//
// WHY THIS FILE EXISTS. RecordShard and IntroShard both carry [RE-MEASURE BEFORE SEAL] on their endowment block,
// and both were last measured on 2026-07-19 — BEFORE their code changed on 2026-07-24. RecoveryShard and
// PublicShard each have a standing suite that re-measures them on every run; these two had none, so their
// numbers were a one-off note in a comment rather than a fact the build re-proves.
//
// The gap is not academic. Every measurement in this project that replaced a derivation moved the answer, and
// always in the same direction:
//   RecordShard   1.026x  (the "2 cells" model — 2 x 64962 x 1.5 happens to equal 3 x 64962, so a wrong cell
//                          count and a missing margin cancelled out and the constant LOOKED right)
//   IntroShard    1.21x   (a lifetime that the contract no longer had after per-entry eviction was deleted)
//   RecoveryShard          the cell model omitted the StateInit wrapper cell
//   PublicShard            base endowments were INSOLVENT and had to be raised 3.5M/7M/11M -> higher
// RS_BASE_ENDOWMENT is still 3_500_000 — the very figure PublicShard proved insolvent for itself. Its code is
// smaller, so it may well be fine; "may well be" is exactly what a seal gate exists to replace with a number.
//
// THREE THINGS THIS MEASURES THAT ARITHMETIC CANNOT:
//   1. THE CLOCK IS PART OF THE MEASUREMENT. config-18 is a SCHEDULE, not a constant: a cell-year cost 486975
//      before Apr-2026 and 64962 after. A sandbox left at its 2023 default prices rent ~7.5x high and has already
//      produced one false under-funding conclusion here. Pinned into the frozen-rate era.
//   2. THE FEE SINK MUST EXIST. A bounceable protocol fee sent to a non-existent sink BOUNCES BACK and inflates
//      the shard's retained balance, reporting a margin the live lane does not have.
//   3. WORST-CASE BIRTH. Both publish gates admit epoch-1, so a shard can be created a full day BEFORE its own
//      epoch and must survive from there to retire_at. Measuring from the epoch itself understates the life.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const G8_MARGIN = 1.5;
const DAY = 86_400;
const CLOCK = 1_790_000_000;            // inside the 64962/cell/year era
const RS_RETENTION = 31_536_000;        // 1 year
const IS_INTRO_RETENTION = 604_800;     // 1 week
const IS_RETIRE_SLACK = 345_600;        // 4 epochs

// retire_at = (epoch+2)*86400 + retention(+slack), and the earliest admissible birth is epoch-1 (gates 13656 /
// 13684). Worst-case life is therefore 3 days more than the retention window, not 2.
const CONV_LIFETIME = 3 * DAY + RS_RETENTION;                        // 31_795_200 ≈ 1.008 y
const INTRO_LIFETIME = 3 * DAY + IS_INTRO_RETENTION + IS_RETIRE_SLACK; // 1_209_600 = 14 d

const cellOf = (fill: number, bits = 256) =>
  beginCell().storeBuffer(Buffer.alloc(Math.ceil(bits / 8), fill)).endCell();

// The 32-byte SEED is the secret noble signs with — @ton/crypto's 64-byte expanded key is a different animal and
// the builder rejects it. Same helper shape the publish-builder suite uses.
const writeKey = (fill: number) => {
  const secret = new Uint8Array(32).fill(fill);
  return { secret, publicKey: ed25519.getPublicKey(secret) };
};

/** Advance to `at`, poke the account, and return the storage fee the chain charged for the whole span. */
async function chargeRent(bc: Blockchain, from: any, address: any, at: number) {
  bc.now = at;
  const poke = await from.send({ to: address, value: toNano('1'), bounce: false } as any);
  const tx: any = poke.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === address.toString());
  return BigInt(tx.description.storagePhase.storageFeesCollected);
}

/** The protocol fee must LEAVE the shard, or `retained` is inflated and the margin is a fiction. */
function feeLeft(result: any, opcode: number) {
  return (result.transactions as any[]).find((t) => {
    const body = t.inMessage?.body?.beginParse?.();
    return body && body.remainingBits >= 32 && body.preloadUint(32) === opcode;
  });
}

describe('CONV/INTRO RENT SOLVENCY — the G8 gate, re-measured on the current artifacts', () => {
  it('CI-RENT-01: a CONV shard survives its worst-case life at the 1.5x margin, empty and full-ish', async () => {
    for (const entries of [1, 12]) {
      const bc = await Blockchain.create();
      // Born a full day BEFORE its epoch — the earliest gate 13656 admits, so the longest life it can be asked for.
      const epoch = Math.floor(CLOCK / DAY) + 1;
      bc.now = CLOCK;
      await deployFeeSink(bc, { funderSeed: `ci-rent-conv-${entries}` });
      const payer = await bc.treasury(`ci-rent-conv-payer-${entries}`);
      const wk = writeKey(0x71);

      let first: any = null;
      let address: any = null;
      for (let seq = 1; seq <= entries; seq += 1) {
        const built = await buildConvPublish({
          writePublicKey: wk.publicKey, writeSecret: wk.secret, seq, epoch,
          header0: cellOf(0x11 + seq), header1: cellOf(0x22 + seq), body: cellOf(0x33 + seq, 512),
          // EXACTLY what the live client sends — no pre-funding. A pre-funded float sits on top of the endowment
          // and reads the margin high, which is the mistake this class of test exists to catch.
          value: seq === 1 ? CONV_PUBLISH_VALUE : CONV_MIN_VALUE,
        });
        address = built.to;
        const res = await payer.send({ to: built.to, value: built.value, body: built.body, init: built.init, bounce: true } as any);
        if (seq === 1) {
          first = res;
          const landed = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === built.to.toString());
          expect((landed as any)?.description?.computePhase?.exitCode, 'the CONV publish must land').toBe(0);
        }
      }

      expect(feeLeft(first, 0x52535046), 'the capsule fee must leave the shard, or `retained` is inflated').toBeDefined();
      const retained = (await bc.getContract(address)).balance;
      const rent = await chargeRent(bc, payer, address, CLOCK + CONV_LIFETIME);
      const margin = Number(retained) / Number(rent);
      // eslint-disable-next-line no-console
      console.log(`[CI-RENT conv n=${entries}] retained=${retained} rent(1.008y)=${rent} margin=${margin.toFixed(4)}x`);

      expect(rent, `CONV n=${entries} must not already be insolvent at its retire instant`).toBeLessThan(retained);
      expect(margin, `CONV n=${entries} delivers ${margin.toFixed(4)}x, below the ${G8_MARGIN}x rule`)
        .toBeGreaterThanOrEqual(G8_MARGIN);
    }
  }, 180_000);

  it('CI-RENT-02: an INTRO shard survives its worst-case 14-day life at the 1.5x margin', async () => {
    for (const entries of [1, 24]) {
      const bc = await Blockchain.create();
      const epoch = Math.floor(CLOCK / DAY) + 1;
      bc.now = CLOCK;
      await deployFeeSink(bc, { funderSeed: `ci-rent-intro-${entries}` });
      const payer = await bc.treasury(`ci-rent-intro-payer-${entries}`);

      let first: any = null;
      let address: any = null;
      for (let i = 0; i < entries; i += 1) {
        const built = await buildIntroPublish({
          epoch, bucket: 7,
          r: BigInt('0x' + 'a1'.repeat(32)) + BigInt(i), viewTag: (0x1234 + i) & 0xFFFF,
          header0: cellOf(0x41 + i), body: cellOf(0x51 + i, 512),
          value: i === 0 ? INTRO_PUBLISH_VALUE : INTRO_MIN_VALUE,
        });
        address = built.to;
        const res = await payer.send({ to: built.to, value: built.value, body: built.body, init: built.init, bounce: true } as any);
        if (i === 0) {
          first = res;
          const landed = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === built.to.toString());
          expect((landed as any)?.description?.computePhase?.exitCode, 'the INTRO publish must land').toBe(0);
        }
      }

      expect(feeLeft(first, 0x52535046), 'the capsule fee must leave the shard').toBeDefined();
      const retained = (await bc.getContract(address)).balance;
      const rent = await chargeRent(bc, payer, address, CLOCK + INTRO_LIFETIME);
      const margin = Number(retained) / Number(rent);
      // eslint-disable-next-line no-console
      console.log(`[CI-RENT intro n=${entries}] retained=${retained} rent(14d)=${rent} margin=${margin.toFixed(4)}x`);

      expect(rent, `INTRO n=${entries} must not already be insolvent at its retire instant`).toBeLessThan(retained);
      expect(margin, `INTRO n=${entries} delivers ${margin.toFixed(4)}x, below the ${G8_MARGIN}x rule`)
        .toBeGreaterThanOrEqual(G8_MARGIN);
    }
  }, 180_000);

  it('CI-RENT-03: the measurement itself is honest — the 2023 clock would have lied by ~7.5x', async () => {
    // The guard on the guard. If someone drops the CLOCK pin, every margin above inflates into a false failure
    // (or, on the other side of a constant change, a false pass). Pinning the ratio makes the schedule visible
    // rather than something a future reader has to already know.
    const measure = async (now: number) => {
      const bc = await Blockchain.create();
      const epoch = Math.floor(now / DAY) + 1;
      bc.now = now;
      await deployFeeSink(bc, { funderSeed: `ci-rent-clock-${now}` });
      const payer = await bc.treasury(`ci-rent-clock-payer-${now}`);
      const wk = writeKey(0x72);
      const built = await buildConvPublish({
        writePublicKey: wk.publicKey, writeSecret: wk.secret, seq: 1, epoch,
        header0: cellOf(0x11), header1: cellOf(0x22), body: cellOf(0x33, 512), value: CONV_PUBLISH_VALUE,
      });
      await payer.send({ to: built.to, value: built.value, body: built.body, init: built.init, bounce: true } as any);
      return chargeRent(bc, payer, built.to, now + CONV_LIFETIME);
    };

    const modern = await measure(CLOCK);              // post-Apr-2026: 64962/cell/year
    const legacy = await measure(1_690_000_000);      // 2023: 240631/cell/year + 481/bit/year
    const ratio = Number(legacy) / Number(modern);
    // eslint-disable-next-line no-console
    console.log(`[CI-RENT clock] 2023 rent=${legacy} vs post-2026 rent=${modern} ratio=${ratio.toFixed(2)}x`);
    expect(ratio, 'the pre-2026 schedule really is multiples more expensive — the clock is load-bearing')
      .toBeGreaterThan(5);
  }, 180_000);
});
