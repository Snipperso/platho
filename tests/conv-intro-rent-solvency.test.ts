import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { toNano, beginCell } from '@ton/core';
import { ed25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { buildConvPublish, buildIntroPublish } from '../web/publish-builder.mjs';
import { CONV_PUBLISH_VALUE, CONV_MIN_VALUE, INTRO_PUBLISH_VALUE, INTRO_MIN_VALUE } from '../web/publish-price.mjs';
import { deployFeeSink } from './helpers/fee-sink-fixture';


const G8_MARGIN = 1.5;
const DAY = 86_400;
const CLOCK = 1_790_000_000;
const RS_RETENTION = 31_536_000;
const IS_INTRO_RETENTION = 604_800;
const IS_RETIRE_SLACK = 345_600;

const CONV_LIFETIME = 3 * DAY + RS_RETENTION;
const INTRO_LIFETIME = 3 * DAY + IS_INTRO_RETENTION + IS_RETIRE_SLACK;

const cellOf = (fill: number, bits = 256) =>
  beginCell().storeBuffer(Buffer.alloc(Math.ceil(bits / 8), fill)).endCell();

const writeKey = (fill: number) => {
  const secret = new Uint8Array(32).fill(fill);
  return { secret, publicKey: ed25519.getPublicKey(secret) };
};

async function chargeRent(bc: Blockchain, from: any, address: any, at: number) {
  bc.now = at;
  const poke = await from.send({ to: address, value: toNano('1'), bounce: false } as any);
  const tx: any = poke.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === address.toString());
  return BigInt(tx.description.storagePhase.storageFeesCollected);
}

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

    const modern = await measure(CLOCK);
    const legacy = await measure(1_690_000_000);
    const ratio = Number(legacy) / Number(modern);
    // eslint-disable-next-line no-console
    console.log(`[CI-RENT clock] 2023 rent=${legacy} vs post-2026 rent=${modern} ratio=${ratio.toFixed(2)}x`);
    expect(ratio, 'the pre-2026 schedule really is multiples more expensive — the clock is load-bearing')
      .toBeGreaterThan(5);
  }, 180_000);
});
