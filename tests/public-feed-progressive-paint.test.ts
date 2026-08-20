import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE FEED FILLS WHILE IT SCANS, INSTEAD OF APPEARING WHEN THE SCAN IS DONE.
//
// Owner, 2026-08-20, after the influx: "Всю публичную ленту засрали. Можно сделать, чтобы лента не целиком
// появлялась после сканирования всего, а прямо в процессе сканирования постепенно?"
//
// The pass built a private copy of the feed cache and assigned it after the loop. With a handful of channels
// nobody noticed; with a crowd of them the screen stays empty for the whole walk and then fills at once.
//
// THE SNAPSHOT WAS THERE FOR A REASON and this gate is mostly about that reason: unsubscribing a channel or
// switching wallets mid-pass bumps publicSyncInvalidationEpoch, and writing a pre-invalidation snapshot would
// resurrect what the user just removed. Painting early is only safe while that guarantee survives, so the check
// must now run BEFORE EVERY per-channel write rather than once at the end.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

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
    // The exact shape of the old bug: build `nextFeedCache`, assign it once the loop is over.
    expect(body).not.toContain('const nextFeedCache');
    expect(body).not.toMatch(/publicChannelFeedCache\s*=\s*nextFeedCache/);
  });

  it('FEEDPAINT-02: each channel is committed to the LIVE cache inside the loop', () => {
    const body = syncBody();
    const loopAt = body.indexOf('for (const channel of feedChannels)');
    const writeAt = body.indexOf('publicChannelFeedCache = {');
    expect(loopAt).toBeGreaterThan(-1);
    expect(writeAt).toBeGreaterThan(loopAt);
    // Merged onto the CURRENT cache, not a copy taken before the walk — otherwise the last write would still
    // clobber whatever happened during it.
    expect(body).toContain('...publicChannelFeedCache,');
  });

  it('FEEDPAINT-03: the invalidation guard runs before EVERY write, not once at the end', () => {
    const body = syncBody();
    const loopAt = body.indexOf('for (const channel of feedChannels)');
    const guardAt = body.indexOf('publicSyncInvalidationEpoch !== invalidationEpochAtStart');
    const writeAt = body.indexOf('publicChannelFeedCache = {');
    expect(guardAt).toBeGreaterThan(loopAt);      // inside the loop
    expect(guardAt).toBeLessThan(writeAt);        // and ahead of the write it protects
    expect(body).toContain("discarded: 'invalidated'");
    // Abandoning the pass, not just skipping one channel: the rest of the walk is built on the same stale premise.
    expect(body.slice(guardAt, writeAt)).toContain('return false;');
  });

  it('FEEDPAINT-04: the first channel paints at once, the rest are throttled', () => {
    const body = syncBody();
    // The complaint was about the first frame — an empty screen versus a filling one.
    expect(body).toContain('paint(touched.length === 1)');
    expect(body).toContain('PUBLIC_FEED_PROGRESSIVE_PAINT_MS');
    expect(app).toMatch(/const PUBLIC_FEED_PROGRESSIVE_PAINT_MS = \d+;/);
  });

  it('FEEDPAINT-05: a failed paint cannot abort the walk', () => {
    const body = syncBody();
    const paintAt = body.indexOf('const paint = (force)');
    expect(paintAt).toBeGreaterThan(-1);
    // Rendering is a side effect of the sync, not its purpose: a throw in the renderer must not cost the user
    // the channels that had not been read yet.
    const paintFn = body.slice(paintAt, body.indexOf('for (const channel of feedChannels)', paintAt));
    expect(paintFn).toContain('catch');
  });
});
