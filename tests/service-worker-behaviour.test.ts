import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE WORKER IS RUN HERE, NOT READ.
//
// Every other test of web/sw.js reads it as text, and on 2026-08-20 ten of them passed over a defect that made
// the app unusable whenever the server was failing rather than absent. The owner found it by hand, with the one
// experiment no text assertion could imitate:
//
//     "turn the phone's internet off and start the app -> it opens.
//      start it while the server is down            -> it dies."
//
// The difference is that a dead server ANSWERS. With no network, fetch rejects, the catch runs, and the cached
// shell is served. A server returning 502/503/504 resolves the promise — to fetch, a reply is a success — so the
// catch never runs and the page is handed an error document instead of the app already on the device. Reading
// the source, both paths look like "network-first with a cache fallback". Only running it tells them apart.
//
// So this file loads the real sw.js into a sandbox with a real CacheStorage-shaped cache and a programmable
// network, dispatches actual fetch events, and asserts what the page RECEIVES.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const ORIGIN = 'https://platho.app';
const BASE = `${ORIGIN}/`;
const source = readFileSync('web/sw.js', 'utf8');

const keyOf = (input: any) => new URL(typeof input === 'string' ? input : input.url, BASE).href;

/** Enough of CacheStorage for the worker: put/match/keys/delete, plus the ignoreSearch lookup it relies on. */
function makeCaches() {
  const store = new Map<string, Map<string, Response>>();
  const search = (entries: Map<string, Response>, request: any, options?: any) => {
    const wanted = keyOf(request);
    const direct = entries.get(wanted);
    if (direct) return direct;
    if (!options?.ignoreSearch) return undefined;
    const path = new URL(wanted).pathname;
    for (const [href, response] of entries) if (new URL(href).pathname === path) return response;
    return undefined;
  };
  const open = async (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const entries = store.get(name)!;
    return {
      put: async (request: any, response: Response) => { entries.set(keyOf(request), response); },
      match: async (request: any, options?: any) => search(entries, request, options),
      keys: async () => [...entries.keys()].map((href) => ({ url: href })),
      delete: async (request: any) => entries.delete(keyOf(request)),
      addAll: async (urls: string[]) => { for (const u of urls) entries.set(keyOf(u), new Response('x')); },
    };
  };
  return {
    store,
    api: {
      open,
      match: async (request: any, options?: any) => {
        for (const entries of store.values()) {
          const hit = search(entries, request, options);
          if (hit) return hit;
        }
        return undefined;
      },
      keys: async () => [...store.keys()],
      delete: async (name: string) => store.delete(name),
    },
  };
}

type Loaded = {
  handlers: Record<string, (event: any) => void>;
  cacheOf: (name: string) => Map<string, Response>;
  seed: (name: string, url: string, response: Response) => void;
};

function loadWorker(network: (request: any) => Promise<Response>): Loaded {
  const handlers: Record<string, (event: any) => void> = {};
  const caches = makeCaches();
  const self = {
    location: { href: BASE, origin: ORIGIN },
    addEventListener: (type: string, handler: any) => { handlers[type] = handler; },
    skipWaiting: () => {},
    clients: { claim: () => {} },
    registration: { scope: BASE },
  };
  const context: any = {
    self, caches: caches.api, Request, Response, Headers, URL, AbortController,
    setTimeout, clearTimeout, console,
    fetch: (request: any) => network(request),
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'sw.js' });
  return {
    handlers,
    cacheOf: (name) => caches.store.get(name) ?? new Map(),
    seed: (name, url, response) => {
      if (!caches.store.has(name)) caches.store.set(name, new Map());
      caches.store.get(name)!.set(keyOf(url), response);
    },
  };
}

/** Dispatch one fetch event and return what the page would receive (or null if the worker did not respond). */
async function serve(worker: Loaded, url: string, mode: 'navigate' | 'cors'): Promise<Response | null> {
  let answer: Promise<Response> | null = null;
  worker.handlers.fetch({
    request: { url: new URL(url, BASE).href, mode, method: 'GET' },
    respondWith: (promise: Promise<Response>) => { answer = promise; },
  });
  return answer ? await answer : null;
}

const cacheName = () => (source.match(/const CACHE_NAME = '([^']+)'/) ?? [])[1] as string;

describe('SERVICE WORKER — what the page actually receives', () => {
  it('SWRUN-01: a failing server (502) on navigation gets the CACHED shell, not the error page', async () => {
    // THE REPORTED BUG. Airplane mode worked; a broken server did not.
    const worker = loadWorker(async () => new Response('<h1>502 Bad Gateway</h1>', { status: 502 }));
    worker.seed(cacheName(), './index.html', new Response('<!doctype html><title>Platho</title>'));

    const served = await serve(worker, '/', 'navigate');
    expect(served, 'the worker did not answer the navigation at all').not.toBeNull();
    expect(served!.status).toBe(200);
    expect(await served!.text()).toContain('Platho');
  });

  it('SWRUN-02: with no network at all, navigation still gets the cached shell', async () => {
    // The path that always worked — kept here so a fix to SWRUN-01 cannot quietly break it.
    const worker = loadWorker(async () => { throw new TypeError('Failed to fetch'); });
    worker.seed(cacheName(), './index.html', new Response('<!doctype html><title>Platho</title>'));

    const served = await serve(worker, '/', 'navigate');
    expect(await served!.text()).toContain('Platho');
  });

  it('SWRUN-03: a healthy server still wins over the cached shell', async () => {
    // Network-first has to survive the fix, or every device pins itself to whatever build it installed first.
    const worker = loadWorker(async () => new Response('<!doctype html><title>NEW BUILD</title>'));
    worker.seed(cacheName(), './index.html', new Response('<!doctype html><title>OLD BUILD</title>'));

    const served = await serve(worker, '/', 'navigate');
    expect(await served!.text()).toContain('NEW BUILD');
  });

  it('SWRUN-04: with nothing cached, the server error is passed through rather than swallowed', async () => {
    // A first-ever visit during an outage has no shell to fall back to. Returning the real response keeps the
    // failure visible instead of turning it into an empty promise or a blank page.
    const worker = loadWorker(async () => new Response('down', { status: 503 }));
    const served = await serve(worker, '/', 'navigate');
    expect(served!.status).toBe(503);
  });

  it('SWRUN-05: a 502 for a module falls back to the same file under another version', async () => {
    // The second half of the same defect. cacheSameOrigin already refused to STORE a non-ok response, but it
    // returned one — so the page received an error document where app.js was expected, failed to parse it, and
    // the boot guard reported "resource failed" with the right bytes sitting in the cache all along.
    const worker = loadWorker(async () => new Response('<h1>502</h1>', { status: 502 }));
    worker.seed(cacheName(), './app.js?v=OLD', new Response('export const build = "cached";'));

    const served = await serve(worker, '/app.js?v=NEW', 'cors');
    expect(served!.status).toBe(200);
    expect(await served!.text()).toContain('cached');
  });

  it('SWRUN-06: a cached asset is served without asking the network at all', async () => {
    let asked = 0;
    const worker = loadWorker(async () => { asked += 1; return new Response('from network'); });
    worker.seed(cacheName(), './app.js?v=NEW', new Response('from cache'));

    const served = await serve(worker, '/app.js?v=NEW', 'cors');
    expect(await served!.text()).toBe('from cache');
    expect(asked, 'the immutable asset was revalidated against the network').toBe(0);
  });

  it('SWRUN-07: a fresh asset is fetched AND stored, so the next start needs no network', async () => {
    const worker = loadWorker(async () => new Response('fresh module'));
    const served = await serve(worker, '/late.mjs?v=1', 'cors');
    expect(await served!.text()).toBe('fresh module');
    expect([...worker.cacheOf(cacheName()).keys()]).toContain(`${ORIGIN}/late.mjs?v=1`);
  });

  it('SWRUN-08: a non-ok asset response is never written into the cache', async () => {
    // Storing a 502 would make the outage permanent for that device — every later start would serve it happily
    // from cache with no network involved at all.
    const worker = loadWorker(async () => new Response('<h1>502</h1>', { status: 502 }));
    await serve(worker, '/late.mjs?v=1', 'cors');
    expect([...worker.cacheOf(cacheName()).keys()]).not.toContain(`${ORIGIN}/late.mjs?v=1`);
  });

  it('SWRUN-10: a working network beats a cached copy under a different version', async () => {
    // The property OFFLINE-03 was protecting when it asserted "the loose fallback comes after catch". That
    // positional rule stopped being expressible once a second failure path appeared, so the property is asserted
    // directly instead: if the loose lookup ever ran in front of a live network, every device would pin itself
    // to whatever old build happens to be cached and updates would silently stop arriving.
    const worker = loadWorker(async () => new Response('the new build'));
    worker.seed(cacheName(), './app.js?v=OLD', new Response('the old build'));

    const served = await serve(worker, '/app.js?v=NEW', 'cors');
    expect(await served!.text()).toBe('the new build');
  });

  it('SWRUN-09: a server that accepts and never answers cannot hang the page forever', async () => {
    // Both network paths are time-bounded. Asserted on the source because faking a 30s stall in a unit test
    // would either slow the suite by 30 seconds or prove only that fake timers work.
    const navigation = source.slice(source.indexOf('async function navigationResponse'));
    expect(navigation.slice(0, navigation.indexOf('async function', 10)))
      .toContain('fetchWithTimeout(shellRequest, NAVIGATION_NETWORK_TIMEOUT_MS)');
    const assets = source.slice(source.indexOf('async function cacheFirst'));
    expect(assets.slice(0, assets.indexOf("self.addEventListener('fetch'")))
      .toContain('fetchWithTimeout(request, ASSET_NETWORK_TIMEOUT_MS)');
    // The asset bound must stay well clear of the navigation one: the shell has a cached twin a second away, an
    // asset on a cache miss usually does not, and cutting a slow module download short breaks a working load.
    const navMs = Number((source.match(/NAVIGATION_NETWORK_TIMEOUT_MS = (\d+)/) ?? [])[1]);
    const assetMs = Number((source.match(/ASSET_NETWORK_TIMEOUT_MS = (\d+)/) ?? [])[1]);
    expect(assetMs).toBeGreaterThan(navMs * 2);
  });
});
