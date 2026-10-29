import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { toNano, beginCell, contractAddress } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { chooseIntroBucket, assertReadableBucket, INTRO_BUCKET_HEADROOM } from '../web/intro-bucket.mjs';
import { INTRO_READ_SPACE, epochOf } from '../web/shard-discovery.mjs';
import { INTRO_SAFE_CAP } from '../web/intro-scan-policy.mjs';
import { buildIntroPublish } from '../web/publish-builder.mjs';
import { buildIntroPublishBrowser } from '../web/intro-publish-browser.mjs';
import { beginCell as browserBeginCell } from '../web/pwa-contract-transactions.mjs';


const cellOf = (f: number) => beginCell().storeBuffer(Buffer.alloc(64, f)).endCell();
const CLOCK = 1_790_000_000;

describe('INTRO-BUCKET — the write-side rule, and the guard around it', () => {
  it('BKT-01: an unread bucket is REFUSED by both builders — the silent-loss class made impossible', async () => {
    const common = { epoch: epochOf(CLOCK), r: 1n, viewTag: 2n, header0: cellOf(1), body: cellOf(2), value: toNano('0.05') };

    for (const bucket of [INTRO_READ_SPACE, INTRO_READ_SPACE + 1, 4_294_967_295, -1]) {
      await expect(buildIntroPublish({ ...common, bucket } as any), `reference builder must refuse ${bucket}`)
        .rejects.toThrow(/outside the read space/);
      await expect(buildIntroPublishBrowser({ ...common, bucket } as any), `browser builder must refuse ${bucket}`)
        .rejects.toThrow(/outside the read space/);
    }

    await expect(buildIntroPublish({ ...common, bucket: INTRO_READ_SPACE - 1 } as any)).resolves.toBeTruthy();
    const browserCell = browserBeginCell().uint(1n, 8, 'x').endCell();
    await expect(buildIntroPublishBrowser({
      ...common, bucket: INTRO_READ_SPACE - 1, header0: browserCell, body: browserCell,
    } as any)).resolves.toBeTruthy();
  });

  it('BKT-02: the two builders mirror INTRO_READ_SPACE by hand — the mirrors must agree', () => {
    const reference = /const INTRO_READ_SPACE_MIRROR = (\d+);/.exec(readFileSync('web/publish-builder.mjs', 'utf8'))?.[1];
    const browser = /export const INTRO_READ_SPACE = (\d+);/.exec(readFileSync('web/shard-discovery.mjs', 'utf8'))?.[1];
    expect(reference, 'the reference builder must declare its mirror').toBeDefined();
    expect(browser, 'shard-discovery must declare the read space').toBeDefined();
    expect(reference, 'the mirrors must not drift').toBe(browser);
    expect(Number(browser)).toBe(INTRO_READ_SPACE);
  });

  it('BKT-03: writes pack DENSELY FROM THE BOTTOM, which is what keeps everyone else\'s scan small', async () => {
    const fill = new Map<number, number>();
    const readBucketFill = async (_e: number, b: number) => fill.get(b) ?? 0;
    const epoch = epochOf(CLOCK);

    for (let i = 0; i < 5; i += 1) {
      const b = await chooseIntroBucket({ epoch, readBucketFill });
      expect(b, 'everything lands in bucket 0 while it has room').toBe(0);
      fill.set(b, (fill.get(b) ?? 0) + 1);
    }
    expect(fill.size, 'exactly one bucket is live').toBe(1);
  });

  it('BKT-04: it rolls over to the next bucket only as one fills, with headroom for concurrent senders', async () => {
    const epoch = epochOf(CLOCK);
    const at = (n: number) => chooseIntroBucket({ epoch, readBucketFill: async (_e, b) => (b === 0 ? n : 0) });

    expect(await at(0), 'empty -> bucket 0').toBe(0);
    expect(await at(INTRO_SAFE_CAP - INTRO_BUCKET_HEADROOM - 1), 'just inside the headroom -> still bucket 0').toBe(0);
    expect(await at(INTRO_SAFE_CAP - INTRO_BUCKET_HEADROOM), 'exactly at the headroom -> still bucket 0').toBe(0);
    expect(await at(INTRO_SAFE_CAP - INTRO_BUCKET_HEADROOM + 1), 'past the headroom -> roll up').toBe(1);
    expect(await at(INTRO_SAFE_CAP), 'a full bucket -> roll up').toBe(1);
  });

  it('BKT-05: a refused bucket is skipped on retry, so a stale view walks upward instead of hammering', async () => {
    const epoch = epochOf(CLOCK);
    const readBucketFill = async () => 0;
    expect(await chooseIntroBucket({ epoch, readBucketFill })).toBe(0);
    expect(await chooseIntroBucket({ epoch, readBucketFill, skip: new Set([0]) })).toBe(1);
    expect(await chooseIntroBucket({ epoch, readBucketFill, skip: new Set([0, 1, 2]) })).toBe(3);
  });

  it('BKT-06: a full read space is an ERROR, not a write into the void', async () => {
    await expect(chooseIntroBucket({
      epoch: epochOf(CLOCK), readSpace: 4, readBucketFill: async () => INTRO_SAFE_CAP,
    })).rejects.toThrow(/every one of 4 INTRO buckets/);
  });

  it('BKT-07: the chosen bucket really is writable on chain — the rule agrees with gate 13680', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const epoch = epochOf(bc.now);
    const payer = await bc.treasury('bkt-payer');

    const readBucketFill = async (_e: number, b: number) => {
      const addr = contractAddress(0, await IntroShard.init(BigInt(epoch), BigInt(b)));
      try { return Number((await bc.openContract(IntroShard.fromAddress(addr)).getGetView()).next_id); }
      catch { return 0; }
    };

    const bucket = await chooseIntroBucket({ epoch, readBucketFill });
    expect(bucket, 'a fresh epoch starts at the bottom').toBe(0);

    const built = await buildIntroPublish({
      epoch, bucket, r: 5n, viewTag: 6n, header0: cellOf(3), body: cellOf(4), value: 17_810_000n,
    });
    const res = await payer.send({ to: built.to, value: 17_810_000n, body: built.body, init: built.init, bounce: true } as any);
    const tx = (res.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(built.to));
    expect(tx?.description?.computePhase?.exitCode, 'the shard accepts the chosen bucket').toBe(0);

    expect(await chooseIntroBucket({ epoch, readBucketFill }), 'the next sender joins the same bucket').toBe(0);
  }, 300_000);
});
