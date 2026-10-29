import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


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
    expect(body).toContain('if (!(await cachedAppShell()))');
    expect(body).not.toMatch(/return await cacheSameOrigin\(appShellCacheRequest\(\), response\);/);
  });

  it('OFFLINE-02: the fresh shell still reaches the page — freshness was not traded away', () => {
    const body = navigationBody();
    expect(body).toContain('fetchWithTimeout(shellRequest, NAVIGATION_NETWORK_TIMEOUT_MS)');
    expect(body).toContain('return response;');
    expect(body).toContain('return await cachedAppShell() || Response.error();');
  });

  it('OFFLINE-03: a missing versioned asset falls back to the same file under another version', () => {
    expect(sw).toContain('async function cachedIgnoringVersion(request)');
    expect(sw).toMatch(/matchCurrentFirst\(request,\s*\{\s*ignoreSearch:\s*true\s*\}\)/);
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
    const exactAt = body.indexOf('await matchCurrentFirst(request)');
    const looseAt = body.indexOf('cachedIgnoringVersion');
    expect(exactAt).toBeGreaterThan(-1);
    expect(exactAt).toBeLessThan(looseAt);
  });

  it('OFFLINE-06: a cached file is served without re-asking the network', () => {
    expect(sw, 'the background revalidation is back').not.toContain('staleWhileRevalidate');
    const body = cacheFirstBody();
    const cachedAt = body.indexOf('if (cached) return cached;');
    const fetchAt = cachedAt + body.slice(cachedAt).search(/await fetchWithTimeout\(request,/);
    expect(cachedAt).toBeGreaterThan(-1);
    expect(fetchAt, 'the asset fetch is no longer time-bounded').toBeGreaterThan(-1);
    expect(cachedAt).toBeLessThan(fetchAt);
  });

  it('OFFLINE-07: the shell is still fetched from the network, or updates would never arrive', () => {
    const handler = sw.slice(sw.indexOf("self.addEventListener('fetch'"));
    expect(handler).toContain("event.request.mode === 'navigate'");
    expect(handler).toContain('event.respondWith(navigationResponse(event))');
    expect(handler).toContain('event.respondWith(cacheFirst(event))');
  });

  it('OFFLINE-05: the shell and every asset it needs are precached under ONE cache name', () => {
    const assets = sw.slice(sw.indexOf('const ASSETS = ['), sw.indexOf('];', sw.indexOf('const ASSETS = [')));
    expect(assets).toContain("'./index.html'");
    expect(assets).toMatch(/'\.\/app\.js\?v=b[0-9a-f]{8}'/);
    expect(sw).toMatch(/const CACHE_NAME = 'platho-pwa-[0-9a-f]{12}';/);
  });
});
