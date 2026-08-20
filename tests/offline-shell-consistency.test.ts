import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE APP MUST OPEN WHEN ITS SERVER IS DEAD.
//
// 2026-08-20, during the outage: the owner's own device showed the boot guard's "resource failed:
// app.js?v=bf36260a7" while every byte it needed was sitting in the cache under the previous release's URL. And
// it was UNSTABLE — some users opened the app offline without trouble, which is the tell.
//
// The shell and the asset URLs it names are versioned together and precached together under one CACHE_NAME. The
// navigation handler cached every fresh shell it fetched, straight into the CURRENT cache, so a device that
// happened to load the site between a deploy and its service-worker update ended up with a NEW shell asking a
// cache that only held OLD assets. Online, the network hides it. Offline, the app will not start.
//
// Whether a user was broken came down to which minute they last opened the site. That is the randomness.
//
// For a no-backend app this is the worst kind of bug: there is no server, and without the server it did not run.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const sw = readFileSync('web/sw.js', 'utf8');

function navigationBody(): string {
  const start = sw.indexOf('async function navigationResponse(event)');
  expect(start).toBeGreaterThan(-1);
  return sw.slice(start, sw.indexOf('async function', start + 10));
}

function cacheFirstBody(): string {
  const start = sw.indexOf('async function cacheFirst(event)');
  expect(start, 'cacheFirst is gone — the asset strategy changed without this gate noticing').toBeGreaterThan(-1);
  return sw.slice(start, sw.indexOf("self.addEventListener('fetch'", start));
}

describe('OFFLINE — a cached release stays internally consistent', () => {
  it('OFFLINE-01: navigation never overwrites a cached shell', () => {
    const body = navigationBody();
    // The write survives only as a BACKFILL for a cache that has no shell at all.
    expect(body).toContain('if (!(await cachedAppShell()))');
    // …and it must be guarded, not unconditional. This is the exact line that caused the outage behaviour.
    expect(body).not.toMatch(/return await cacheSameOrigin\(appShellCacheRequest\(\), response\);/);
  });

  it('OFFLINE-02: the fresh shell still reaches the page — freshness was not traded away', () => {
    const body = navigationBody();
    // Network-first has to stay: a cached shell that outlives its release pins devices to an old build.
    expect(body).toContain('fetchWithTimeout(shellRequest, NAVIGATION_NETWORK_TIMEOUT_MS)');
    expect(body).toContain('return response;');
    // And the offline path is still the cached shell rather than an error page.
    expect(body).toContain('return await cachedAppShell() || Response.error();');
  });

  it('OFFLINE-03: a missing versioned asset falls back to the same file under another version', () => {
    expect(sw).toContain('async function cachedIgnoringVersion(request)');
    expect(sw).toMatch(/caches\.match\(request,\s*\{\s*ignoreSearch:\s*true\s*\}\)/);
    // Only when the network has ALREADY failed — never in front of a live network, or every device would be
    // pinned to whatever old copy happens to be cached.
    //
    // This used to assert "the fallback appears after `catch`", which stopped being the right question on
    // 2026-08-20: a server answering 502 never reaches the catch, and the app died on error documents while the
    // bytes it needed sat in the cache. There are now TWO failure paths, and what matters is that each call site
    // is guarded BY A FAILURE — not where it sits in the file.
    const body = cacheFirstBody();
    const sites = body.match(/cachedIgnoringVersion/g) ?? [];
    expect(sites.length, 'a new call site appeared — prove it is only reachable after the network failed')
      .toBe(2);
    expect(body, 'the non-ok path no longer falls back to another version')
      .toContain('if (!response.ok) return await cachedIgnoringVersion(request) || response;');
    const catchAt = body.indexOf('catch (error)');
    expect(catchAt).toBeGreaterThan(-1);
    expect(body.slice(catchAt), 'the thrown-error path no longer falls back').toContain('cachedIgnoringVersion');
  });

  it('OFFLINE-04: the exact URL still wins when it is cached', () => {
    const body = cacheFirstBody();
    // ignoreSearch must not become the primary lookup: an exact hit is the right build, a loose hit is a guess.
    const exactAt = body.indexOf('await caches.match(request)');
    const looseAt = body.indexOf('cachedIgnoringVersion');
    expect(exactAt).toBeGreaterThan(-1);
    expect(exactAt).toBeLessThan(looseAt);
  });

  it('OFFLINE-06: a cached file is served without re-asking the network', () => {
    // Was stale-while-revalidate, which fetched every asset again on every app open "in case it changed". These
    // URLs carry their content's version, so a cached response cannot go stale — the revalidation was ~6 MB of
    // requests per repeat visit asking about files that are immutable by construction.
    expect(sw, 'the background revalidation is back').not.toContain('staleWhileRevalidate');
    const body = cacheFirstBody();
    const cachedAt = body.indexOf('if (cached) return cached;');
    // The asset fetch is time-bounded now, so the old `await fetch(request)` needle no longer exists. Match the
    // call by name rather than by its exact argument list, or this gate breaks again on the next change here.
    const fetchAt = body.search(/await fetchWithTimeout\(request,/);
    expect(cachedAt).toBeGreaterThan(-1);
    expect(fetchAt, 'the asset fetch is no longer time-bounded').toBeGreaterThan(-1);
    // The network is reached only AFTER a cache miss, never alongside a hit.
    expect(cachedAt).toBeLessThan(fetchAt);
  });

  it('OFFLINE-07: the shell is still fetched from the network, or updates would never arrive', () => {
    // The one thing that must NOT be cache-first: it is how a device learns a new release exists.
    const handler = sw.slice(sw.indexOf("self.addEventListener('fetch'"));
    expect(handler).toContain("event.request.mode === 'navigate'");
    expect(handler).toContain('event.respondWith(navigationResponse(event))');
    expect(handler).toContain('event.respondWith(cacheFirst(event))');
  });

  it('OFFLINE-05: the shell and every asset it needs are precached under ONE cache name', () => {
    // The property the navigation write was breaking. index.html and the entry module must both be in the list
    // that CACHE_NAME is derived from, or "consistent release" means nothing.
    const assets = sw.slice(sw.indexOf('const ASSETS = ['), sw.indexOf('];', sw.indexOf('const ASSETS = [')));
    expect(assets).toContain("'./index.html'");
    expect(assets).toMatch(/'\.\/app\.js\?v=b[0-9a-f]{8}'/);
    expect(sw).toMatch(/const CACHE_NAME = 'platho-pwa-[0-9a-f]{12}';/);
  });
});
