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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTRO-BUCKET — which bucket a first contact goes into, and the guard that stops it going somewhere unread.
//
// Before this there was no rule at all: `bucket` was an argument both builders passed straight through, with no
// default, no derivation and no shipping caller. That is survivable exactly once. The first line of real code
// that picks a bucket decides the shape of the network, and one of the choices — writing above the read space —
// is a permanent, silent, unretryable loss of a first contact.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const cellOf = (f: number) => beginCell().storeBuffer(Buffer.alloc(64, f)).endCell();
const CLOCK = 1_790_000_000;

describe('INTRO-BUCKET — the write-side rule, and the guard around it', () => {
  it('BKT-01: an unread bucket is REFUSED by both builders — the silent-loss class made impossible', async () => {
    // THE PROPERTY WORTH MOST IN THIS FILE. IntroShard.init accepts any uint32 bucket and no contract gate looks
    // at it, while every reader is clamped to INTRO_READ_SPACE. So publishing to bucket 1024 succeeds on chain:
    // exit 0, fee charged, change returned, wallet reports success — and no recipient ever derives that address.
    // No error, no bounce, no gap in any sequence, and gate 13684 closes the epoch so it cannot even be retried.
    // Nothing rejected it anywhere: not the builders, not the contract, not a test.
    const common = { epoch: epochOf(CLOCK), r: 1n, viewTag: 2n, header0: cellOf(1), body: cellOf(2), value: toNano('0.05') };

    for (const bucket of [INTRO_READ_SPACE, INTRO_READ_SPACE + 1, 4_294_967_295, -1]) {
      await expect(buildIntroPublish({ ...common, bucket } as any), `reference builder must refuse ${bucket}`)
        .rejects.toThrow(/outside the read space/);
      await expect(buildIntroPublishBrowser({ ...common, bucket } as any), `browser builder must refuse ${bucket}`)
        .rejects.toThrow(/outside the read space/);
    }

    // And the last readable bucket is still accepted, so the guard is a boundary and not a blanket. The browser
    // builder takes the client's own cell type, not @ton/core's — that difference is the whole reason it exists.
    await expect(buildIntroPublish({ ...common, bucket: INTRO_READ_SPACE - 1 } as any)).resolves.toBeTruthy();
    const browserCell = browserBeginCell().uint(1n, 8, 'x').endCell();
    await expect(buildIntroPublishBrowser({
      ...common, bucket: INTRO_READ_SPACE - 1, header0: browserCell, body: browserCell,
    } as any)).resolves.toBeTruthy();
  });

  it('BKT-02: the two builders mirror INTRO_READ_SPACE by hand — the mirrors must agree', () => {
    // publish-builder.mjs is the INDEPENDENT reference the browser derivation is pinned against, so it must not
    // import from the browser modules; it therefore holds its own copy of the constant. Two hand-held copies of
    // one number is exactly the drift this project keeps getting bitten by, so read both out of the sources.
    const reference = /const INTRO_READ_SPACE_MIRROR = (\d+);/.exec(readFileSync('web/publish-builder.mjs', 'utf8'))?.[1];
    const browser = /export const INTRO_READ_SPACE = (\d+);/.exec(readFileSync('web/shard-discovery.mjs', 'utf8'))?.[1];
    expect(reference, 'the reference builder must declare its mirror').toBeDefined();
    expect(browser, 'shard-discovery must declare the read space').toBeDefined();
    expect(reference, 'the mirrors must not drift').toBe(browser);
    expect(Number(browser)).toBe(INTRO_READ_SPACE);
  });

  it('BKT-03: writes pack DENSELY FROM THE BOTTOM, which is what keeps everyone else\'s scan small', async () => {
    // A recipient must look at every LIVE bucket of every epoch in its window, so the live-bucket count is a cost
    // every scanning phone pays. Spreading uniformly would maximise it; packing from the bottom minimises it. It
    // costs nothing in privacy — the index says nothing about the recipient, who is behind the stealth view_tag.
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
    // Headroom is not decoration: several senders choose from the same chain state and cannot see each other's
    // in-flight messages. Without it the last slots of a bucket are a thundering herd and every loser is bounced
    // by gate 13680 instead of delivered.
    const epoch = epochOf(CLOCK);
    const at = (n: number) => chooseIntroBucket({ epoch, readBucketFill: async (_e, b) => (b === 0 ? n : 0) });

    expect(await at(0), 'empty -> bucket 0').toBe(0);
    expect(await at(INTRO_SAFE_CAP - INTRO_BUCKET_HEADROOM - 1), 'just inside the headroom -> still bucket 0').toBe(0);
    expect(await at(INTRO_SAFE_CAP - INTRO_BUCKET_HEADROOM), 'exactly at the headroom -> still bucket 0').toBe(0);
    expect(await at(INTRO_SAFE_CAP - INTRO_BUCKET_HEADROOM + 1), 'past the headroom -> roll up').toBe(1);
    expect(await at(INTRO_SAFE_CAP), 'a full bucket -> roll up').toBe(1);
  });

  it('BKT-05: a refused bucket is skipped on retry, so a stale view walks upward instead of hammering', async () => {
    // The rule OBSERVES rather than schedules, so a client acting on stale information is normal, not exceptional.
    // What must not happen is that it retries into the same full shard for ever. Gate 13680 refuses in COMPUTE,
    // which bounces and refunds, and the caller moves up.
    const epoch = epochOf(CLOCK);
    const readBucketFill = async () => 0;
    expect(await chooseIntroBucket({ epoch, readBucketFill })).toBe(0);
    expect(await chooseIntroBucket({ epoch, readBucketFill, skip: new Set([0]) })).toBe(1);
    expect(await chooseIntroBucket({ epoch, readBucketFill, skip: new Set([0, 1, 2]) })).toBe(3);
  });

  it('BKT-06: a full read space is an ERROR, not a write into the void', async () => {
    // readSpace x IS_SAFE_CAP first contacts in one day — 8.2M at the current numbers. The wrong answer would be
    // to write above the space anyway; the honest one is to fail loudly, because widening the space requires
    // readers to ship first and nobody can do that from inside a send.
    await expect(chooseIntroBucket({
      epoch: epochOf(CLOCK), readSpace: 4, readBucketFill: async () => INTRO_SAFE_CAP,
    })).rejects.toThrow(/every one of 4 INTRO buckets/);
  });

  it('BKT-07: the chosen bucket really is writable on chain — the rule agrees with gate 13680', async () => {
    // Ties the client convention to the contract rather than to another constant in the same repo: publish into
    // the bucket the rule picks and check the shard accepts it.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const epoch = epochOf(bc.now);
    const payer = await bc.treasury('bkt-payer');

    const readBucketFill = async (_e: number, b: number) => {
      const addr = contractAddress(0, await IntroShard.init(BigInt(epoch), BigInt(b)));
      try { return Number((await bc.openContract(IntroShard.fromAddress(addr)).getGetView()).next_id); }
      catch { return 0; }                                   // never deployed
    };

    const bucket = await chooseIntroBucket({ epoch, readBucketFill });
    expect(bucket, 'a fresh epoch starts at the bottom').toBe(0);

    const built = await buildIntroPublish({
      epoch, bucket, r: 5n, viewTag: 6n, header0: cellOf(3), body: cellOf(4), value: 15_608_000n,
    });
    const res = await payer.send({ to: built.to, value: 15_608_000n, body: built.body, init: built.init, bounce: true } as any);
    const tx = (res.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(built.to));
    expect(tx?.description?.computePhase?.exitCode, 'the shard accepts the chosen bucket').toBe(0);

    // And after that publish the rule still returns bucket 0 — density, not rotation.
    expect(await chooseIntroBucket({ epoch, readBucketFill }), 'the next sender joins the same bucket').toBe(0);
  }, 300_000);
});
