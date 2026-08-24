import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createPublicLane } from '../web/public-lane.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE FIND-CHANNELS PAGE FILLS AS IT SWEEPS.
//
// Owner, 2026-08-20, during the influx: the discovery page reads up to 32 beacon buckets one after another and
// showed nothing until the last one returned. With few channels that was invisible; with many it is the whole
// experience of the page.
//
// The sweep now reports what it has after each bucket. Correctness rests on one property: absorbing a growing
// catalog repeatedly must produce exactly the list a single whole-sweep absorb would — otherwise a streamed page
// and a cached one would disagree, which is worse than a slow page.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');
const lane = readFileSync('web/public-lane.mjs', 'utf8');

describe('DISCOVERSTREAM — beacons are reported as they are read', () => {
  it('DISCOVERSTREAM-01: the sweep reports after EACH bucket, inside the loop', () => {
    const fn = lane.slice(lane.indexOf('async sweepChannelCatalog('));
    const body = fn.slice(0, fn.indexOf('async readChannelPosts('));
    const loopAt = body.indexOf('for (const state of buckets)');
    const callAt = body.indexOf('onProgress([...byWallet.values()], { done, total: buckets.length })');
    const returnAt = body.indexOf('return [...byWallet.values()];');
    expect(loopAt).toBeGreaterThan(-1);
    expect(callAt).toBeGreaterThan(loopAt);
    expect(callAt, 'reporting after the loop is the bug, not the fix').toBeLessThan(returnAt);
    // And the frame says HOW FAR the sweep is, so the screen can count down under the cards (DISCOVERSTREAM-07).
    expect(body).toContain('done += 1;');
  });

  it('DISCOVERSTREAM-05: no ranking wall in front of the first bucket, and no cap on how many are read', () => {
    // MEASURED 2026-08-21 on mainnet: 142 live beacon buckets (walletHash % 1024 spreads the directory by
    // design). The sweep ranked them by entry_count FIRST — one sequential get_view per live bucket — and only then
    // read the top 32: the first card waited behind ~147 requests on the one serial pump, and three quarters of
    // the described channels were never read at all. Streaming inside the loop (DISCOVERSTREAM-01) could not help
    // a loop that started 142 requests late.
    const fn = lane.slice(lane.indexOf('async sweepChannelCatalog('));
    const body = fn.slice(0, fn.indexOf('async readChannelPosts('));
    const loopAt = body.indexOf('for (const state of buckets)');
    expect(loopAt).toBeGreaterThan(-1);
    // Nothing between the states batch and the loop reads a bucket: the order is the FREE lt from accountStates —
    // and only ACTIVE buckets are read (an uninit or 'unknown' row is not readable: get_page throws exit -13).
    expect(body.slice(0, loopAt)).not.toContain('provider.getView(');
    expect(body.slice(0, loopAt)).not.toContain('readShardPosts(');
    expect(body.slice(0, loopAt)).toContain('const ltOf = (state) =>');
    expect(body.slice(0, loopAt)).toContain(".filter((state) => state.status === 'active')");
    // Every live bucket by default — the cap is opt-in, never the default.
    expect(body).toMatch(/async sweepChannelCatalog\(\{ eraWindow = 3, topBuckets = null, onProgress = null \} = \{\}\)/);
    expect(body).toContain(': ordered.length;');
    // And a bucket whose marker has not moved is served from the snapshot cache — the same gate the channel read
    // uses; a bucket whose rows came back WITHOUT bodies is not cached as empty (the pump may have declined them).
    expect(body.slice(loopAt)).toContain('readShardSnapshot(key, marker)');
    expect(body.slice(loopAt)).toContain('if (posts.length > 0 || BigInt(first.entry_count ?? 0n) === 0n) {');
    expect(body.slice(loopAt)).toContain('writeShardSnapshot(key, marker, { posts, from: 0n, entryCount: first.entry_count });');
    // The app asks for everything: topBuckets: Infinity at the call site (the lane reads that as "all of them").
    const call = app.slice(app.indexOf('catalog = await lane.sweepChannelCatalog({'), app.indexOf('catalog = await lane.sweepChannelCatalog({') + 200);
    expect(call).toContain('topBuckets: Infinity');
  });

  it('DISCOVERSTREAM-02: a throwing consumer cannot stop the sweep', () => {
    const fn = lane.slice(lane.indexOf('async sweepChannelCatalog('));
    const body = fn.slice(0, fn.indexOf('async readChannelPosts('));
    const callAt = body.indexOf('onProgress([...byWallet.values()], { done, total: buckets.length })');
    expect(callAt).toBeGreaterThan(-1);
    // The remaining buckets are the user's channels; a bad frame in the caller must not cost them.
    expect(body.slice(callAt - 40, callAt + 160)).toContain('catch');
  });

  it('DISCOVERSTREAM-03: a sweep with no consumer behaves exactly as before', async () => {
    // The optional callback must not be load-bearing: a reader built without one still returns its catalog.
    const lane = createPublicLane({
      runGetMethod: async () => { throw new Error('no buckets in this fixture'); },
      now: () => 1_787_000_000,
      endpoint: 'https://x/api/v3/accountStates',
      // No beacon bucket is live, so the sweep returns empty — the point is that it RETURNS rather than
      // throwing on a missing callback.
      fetch: async () => ({ ok: true, status: 200, json: async () => ({ accounts: [], messages: [] }) }),
    });
    await expect(lane.sweepChannelCatalog({ topBuckets: 4 })).resolves.toEqual([]);
  });

  it('DISCOVERSTREAM-04: absorbing partials repeatedly equals absorbing the whole catalog once', () => {
    const body = app.slice(app.indexOf('async function discoverChannelsFromBeacon('));
    const fn = body.slice(0, body.indexOf('async function discoverChannels('));
    // The dedup set is what makes re-delivery harmless — assert it guards the accept, not just the render.
    expect(fn).toContain('if (!wallet || seen.has(wallet)) continue;');
    expect(fn).toContain('seen.add(wallet);');
    // And the full catalog is absorbed once more at the end, so a bucket that produced nothing new mid-sweep
    // cannot leave the final list short.
    const lastAbsorb = fn.lastIndexOf('absorb(catalog);');
    const cacheWrite = fn.indexOf('publicDiscoveryCache = { at: Date.now(), results };', lastAbsorb);
    expect(lastAbsorb).toBeGreaterThan(-1);
    expect(cacheWrite).toBeGreaterThan(lastAbsorb);
  });

  it('DISCOVERSTREAM-05: a failed sweep keeps what already streamed in', () => {
    const body = app.slice(app.indexOf('async function discoverChannelsFromBeacon('));
    const fn = body.slice(0, body.indexOf('async function discoverChannels('));
    const catchAt = fn.indexOf('beacon sweep failed');
    // Falling back to a cache that is older than what is already on screen would take channels AWAY on failure.
    expect(fn.slice(catchAt, catchAt + 400)).toContain('if (results.length > 0)');
  });

  it('DISCOVERSTREAM-06: a late partial cannot repaint a panel the user has left', () => {
    // The sweep keeps running after the screen closes, so the token check belongs INSIDE the painter — the one both
    // the open and the refresh hand to the sweep, built per load so it carries that load's token.
    expect(app).toContain('const results = await discoverChannels({ onPartial: publicDiscoveryPartialPainter(token) });');
    expect(app).toContain('const results = await discoverChannels({ force: true, onPartial: publicDiscoveryPartialPainter(token) });');
    const painter = app.slice(app.indexOf('function publicDiscoveryPartialPainter(token)'));
    const cb = painter.indexOf('return (partial, progress) => {');
    expect(cb).toBeGreaterThan(-1);
    expect(painter.slice(cb, cb + 200)).toContain('token !== publicDiscoveryLoadToken');
    expect(painter.slice(cb, cb + 200)).toContain('!publicDiscoveryOpen');
  });

  it('DISCOVERSTREAM-07: a still-sweeping list says so, under the cards', () => {
    // The status line under the cards says "still looking… N of M" while the sweep's progress is remembered
    // (publicDiscoveryProgress, from the painter's frames); only a FINISHED sweep may say "nothing found".
    const render = app.slice(app.indexOf('function renderPublicDiscovery(options'));
    const body = render.slice(0, render.indexOf('function discoveryCardIdentityButton'));
    // The list is reconciled (KEYROW-*), so the status is a keyed entry like every other child — its text is
    // computed once, up front, because the signature is what decides whether the line is rebuilt at all.
    expect(body).toContain('const statusText = publicDiscoveryStatusText(progress, { shownCount: shown.length, loading, error: options.error === true });');
    expect(body).toContain("key: 'status',");
    expect(body).toContain('status.textContent = statusText;');
    const statusText = app.slice(app.indexOf('function publicDiscoveryStatusText(progress'), app.indexOf('function updatePublicDiscoveryStatusLine'));
    expect(statusText).toContain('const sweeping = loading || progress !== null;');
    expect(statusText).toContain('if (sweeping) return publicDiscoverySweepStatusText(progress);');
    const sweepText = app.slice(app.indexOf('function publicDiscoverySweepStatusText(progress'));
    expect(sweepText.slice(0, 800)).toContain("t('public.discoverScanning', { done, total, left: Math.max(0, total - done) })");
    expect(sweepText.slice(0, 800)).toContain("t('public.discoverLoading')");
  });
});
