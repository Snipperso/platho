import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


const app = readFileSync('web/app.js', 'utf8');

function syncBody(): string {
  const start = app.indexOf('async function syncPublicChannelFromShards()');
  expect(start).toBeGreaterThan(-1);
  const rest = app.slice(start);
  const end = rest.indexOf('async function syncPublicChannelFromChain()');
  expect(end).toBeGreaterThan(-1);
  return rest.slice(0, end);
}

describe('FEEDPAINT — the walk shows what it has as it goes', () => {
  it('FEEDPAINT-01: the deferred whole-cache write is gone', () => {
    const body = syncBody();
    expect(body).not.toContain('const nextFeedCache');
    expect(body).not.toMatch(/publicChannelFeedCache\s*=\s*nextFeedCache/);
  });

  it('FEEDPAINT-02: each channel is committed to the LIVE cache inside the loop', () => {
    const body = syncBody();
    const loopAt = body.indexOf('for (const channel of feedChannels)');
    const writeAt = body.indexOf('publicChannelFeedCache = {');
    expect(loopAt).toBeGreaterThan(-1);
    expect(writeAt).toBeGreaterThan(loopAt);
    expect(body).toContain('...publicChannelFeedCache,');
  });

  it('FEEDPAINT-03: the invalidation guard runs before EVERY write, not once at the end', () => {
    const body = syncBody();
    const loopAt = body.indexOf('for (const channel of feedChannels)');
    const guardAt = body.indexOf('publicSyncInvalidationEpoch !== invalidationEpochAtStart) {');
    const writeAt = body.indexOf('publicChannelFeedCache = {');
    expect(guardAt).toBeGreaterThan(loopAt);
    expect(guardAt).toBeLessThan(writeAt);
    expect(body).toContain("discarded: 'invalidated'");
    expect(body.slice(guardAt, writeAt)).toContain('return false;');
  });

  it('FEEDPAINT-04: the first channel paints at once, the rest are throttled', () => {
    const body = syncBody();
    expect(body).toContain('paint(touched.length === 1)');
    expect(body).toContain('PUBLIC_FEED_PROGRESSIVE_PAINT_MS');
    expect(app).toMatch(/const PUBLIC_FEED_PROGRESSIVE_PAINT_MS = \d+;/);
  });

  it('FEEDPAINT-05: a failed paint cannot abort the walk', () => {
    const body = syncBody();
    const paintAt = body.indexOf('const paint = (force)');
    expect(paintAt).toBeGreaterThan(-1);
    const paintFn = body.slice(paintAt, body.indexOf('for (const channel of feedChannels)', paintAt));
    expect(paintFn).toContain('catch');
  });
});
