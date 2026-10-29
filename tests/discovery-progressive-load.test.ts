import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createPublicLane } from '../web/public-lane.mjs';


const app = readFileSync('web/app.js', 'utf8');
const lane = readFileSync('web/public-lane.mjs', 'utf8');

describe('DISCOVERSTREAM — beacons are reported as they are read', () => {
  it('DISCOVERSTREAM-01: the sweep reports after EACH bucket, inside the loop', () => {
    const fn = lane.slice(lane.indexOf('async sweepChannelCatalog('));
    const body = fn.slice(0, fn.indexOf('async readChannelPosts('));
    const loopAt = body.indexOf('for (const state of buckets)');
    const callAt = body.indexOf('onProgress([...byWallet.values()], { done, total: buckets.length, delisted: [...delisted] })');
    const returnAt = body.indexOf('return found;');
    expect(loopAt).toBeGreaterThan(-1);
    expect(callAt).toBeGreaterThan(loopAt);
    expect(callAt, 'reporting after the loop is the bug, not the fix').toBeLessThan(returnAt);
    expect(body).toContain('done += 1;');
  });

  it('DISCOVERSTREAM-05: no ranking wall in front of the first bucket, and no cap on how many are read', () => {
    const fn = lane.slice(lane.indexOf('async sweepChannelCatalog('));
    const body = fn.slice(0, fn.indexOf('async readChannelPosts('));
    const loopAt = body.indexOf('for (const state of buckets)');
    expect(loopAt).toBeGreaterThan(-1);
    expect(body.slice(0, loopAt)).not.toContain('provider.getView(');
    expect(body.slice(0, loopAt)).not.toContain('readShardPosts(');
    expect(body.slice(0, loopAt)).toContain('const ltOf = (state) =>');
    expect(body.slice(0, loopAt)).toContain(".filter((state) => state.status === 'active')");
    expect(body).toMatch(/async sweepChannelCatalog\(\{ eraWindow = 3, topBuckets = [A-Za-z_][A-Za-z0-9_]*, onProgress = null, waitForTurn = null, requestClass = null \} = \{\}\)/);
    expect(body).toContain('ordered.slice(0, limit)');
    expect(body.slice(loopAt)).toContain('readShardSnapshot(key, marker)');
    expect(body.slice(loopAt)).toContain('if ((posts.length > 0 || bucketRows === 0) && windowWorthKeeping(key, marker, posts.length >= Math.min(bucketRows, bucketRows > 96 ? 192 : 96))) {');
    expect(body.slice(loopAt)).toContain('writeShardSnapshot(key, marker, { posts, from: 0n, entryCount: first.entry_count });');
    const call = app.slice(app.indexOf('catalog = await lane.sweepChannelCatalog({'), app.indexOf('catalog = await lane.sweepChannelCatalog({') + 400);
    expect(call).not.toContain('topBuckets: Infinity');
    expect(call).not.toContain('topBuckets: null');
  });

  it('DISCOVERSTREAM-02: a throwing consumer cannot stop the sweep', () => {
    const fn = lane.slice(lane.indexOf('async sweepChannelCatalog('));
    const body = fn.slice(0, fn.indexOf('async readChannelPosts('));
    const callAt = body.indexOf('onProgress([...byWallet.values()], { done, total: buckets.length, delisted: [...delisted] })');
    expect(callAt).toBeGreaterThan(-1);
    expect(body.slice(callAt - 40, callAt + 160)).toContain('catch');
  });

  it('DISCOVERSTREAM-03: a sweep with no consumer behaves exactly as before', async () => {
    const lane = createPublicLane({
      runGetMethod: async () => { throw new Error('no buckets in this fixture'); },
      now: () => 1_787_000_000,
      endpoint: 'https://x/api/v3/accountStates',
      fetch: async () => ({ ok: true, status: 200, json: async () => ({ accounts: [], messages: [] }) }),
    });
    await expect(lane.sweepChannelCatalog({ topBuckets: 4 })).resolves.toEqual([]);
  });

  it('DISCOVERSTREAM-04: absorbing partials repeatedly equals absorbing the whole catalog once', () => {
    const body = app.slice(app.indexOf('async function discoverChannelsFromBeacon('));
    const fn = body.slice(0, body.indexOf('async function discoverChannels('));
    expect(fn).toContain('if (!wallet || seen.has(wallet)) continue;');
    expect(fn).toContain('seen.add(wallet);');
    const lastAbsorb = fn.lastIndexOf('absorb(catalog);');
    const cacheWrite = fn.indexOf('publicDiscoveryCache = { at: Date.now(), results };', lastAbsorb);
    expect(lastAbsorb).toBeGreaterThan(-1);
    expect(cacheWrite).toBeGreaterThan(lastAbsorb);
  });

  it('DISCOVERSTREAM-05: a failed sweep keeps what already streamed in', () => {
    const body = app.slice(app.indexOf('async function discoverChannelsFromBeacon('));
    const fn = body.slice(0, body.indexOf('async function discoverChannels('));
    const catchAt = fn.indexOf('beacon sweep failed');
    expect(fn.slice(catchAt, catchAt + 400)).toContain('if (results.length > 0)');
  });

  it('DISCOVERSTREAM-06: a late partial cannot repaint a panel the user has left', () => {
    expect(app).toContain('const results = await discoverChannels({ onPartial: publicDiscoveryPartialPainter(token) });');
    expect(app).toContain('const results = await discoverChannels({ force: true, onPartial: publicDiscoveryPartialPainter(token) });');
    const painter = app.slice(app.indexOf('function publicDiscoveryPartialPainter(token)'));
    const cb = painter.indexOf('return (partial, progress) => {');
    expect(cb).toBeGreaterThan(-1);
    expect(painter.slice(cb, cb + 200)).toContain('token !== publicDiscoveryLoadToken');
    expect(painter.slice(cb, cb + 200)).toContain('!publicDiscoveryOpen');
  });

  it('DISCOVERSTREAM-07: a still-looking All feed says so, under its posts — only a finished read may say there are none', () => {
    const render = app.slice(app.indexOf('function renderPublicDiscovery(options'), app.indexOf("/** The reader's followed channels, as raw wallets"));
    expect(render).toContain('const working = !locked && allSectionLoading({ loading });');
    const loading = app.slice(app.indexOf('function allSectionLoading('), app.indexOf('function allSectionLoadingOnScreen('));
    expect(loading).toMatch(/return mode\?\.loading === true \|\| publicDiscoveryProgress !== null \|\| publicAllFeedPassRun !== null\s*\|\| \(publicAllFeedRestore !== null && !publicAllFeedRestored\);/);
    expect(render).toContain("const text = working ? t('public.allFeedLoadingMore') : t('public.allFeedStale');");
    expect(render).toMatch(/\? \[t\('public\.allFeedLoading'\), t\('common\.checking'\)\]/);
    expect(render).toContain("key: 'status',");
  });
});
