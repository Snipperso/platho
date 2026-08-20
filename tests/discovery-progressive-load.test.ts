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
    const loopAt = body.indexOf('for (const bucket of ranked.slice(0, topBuckets))');
    const callAt = body.indexOf('onProgress([...byWallet.values()])');
    const returnAt = body.indexOf('return [...byWallet.values()];');
    expect(loopAt).toBeGreaterThan(-1);
    expect(callAt).toBeGreaterThan(loopAt);
    expect(callAt, 'reporting after the loop is the bug, not the fix').toBeLessThan(returnAt);
  });

  it('DISCOVERSTREAM-02: a throwing consumer cannot stop the sweep', () => {
    const fn = lane.slice(lane.indexOf('async sweepChannelCatalog('));
    const body = fn.slice(0, fn.indexOf('async readChannelPosts('));
    const callAt = body.indexOf('onProgress([...byWallet.values()])');
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
    const open = app.slice(app.indexOf('async function openPublicDiscovery()'));
    const body = open.slice(0, open.indexOf('function renderPublicDiscovery'));
    const cb = body.indexOf('onPartial: (partial)');
    expect(cb).toBeGreaterThan(-1);
    // The sweep keeps running after the screen closes; the token check belongs INSIDE the callback too.
    expect(body.slice(cb, cb + 260)).toContain('token !== publicDiscoveryLoadToken');
    expect(body.slice(cb, cb + 260)).toContain('!publicDiscoveryOpen');
  });

  it('DISCOVERSTREAM-07: a still-sweeping list says so, under the cards', () => {
    const render = app.slice(app.indexOf('function renderPublicDiscovery(options'));
    const body = render.slice(0, render.indexOf('function discoveryCardIdentityButton'));
    const cardsAt = body.indexOf('publicDiscoveryBody.append(buildDiscoveryCard(channel))');
    const partialAt = body.indexOf("options.partial === true");
    expect(cardsAt).toBeGreaterThan(-1);
    // Under, not instead of: a short list mid-sweep must not read as a finished short list.
    expect(partialAt).toBeGreaterThan(cardsAt);
    expect(body.slice(partialAt)).toContain("t('public.discoverLoading')");
  });
});
