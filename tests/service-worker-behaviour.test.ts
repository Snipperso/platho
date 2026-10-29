import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';


const ORIGIN = 'https://platho.app';
const BASE = `${ORIGIN}/`;
const source = readFileSync('web/sw.js', 'utf8');

const keyOf = (input: any) => new URL(typeof input === 'string' ? input : input.url, BASE).href;

function makeCaches(network: (request: any) => Promise<Response> = async () => { throw new TypeError('no network'); }) {
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
      add: async (request: any) => { const response = await network(request); if (!response || !response.ok) throw new TypeError('add: not ok'); entries.set(keyOf(request), response); },
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
  caches: () => Map<string, Map<string, Response>>;
};

function loadWorker(network: (request: any) => Promise<Response>): Loaded {
  const handlers: Record<string, (event: any) => void> = {};
  const caches = makeCaches(network);
  const self = {
    location: { href: BASE, origin: ORIGIN },
    addEventListener: (type: string, handler: any) => { handlers[type] = handler; },
    skipWaiting: () => {},
    clients: { claim: () => {} },
    registration: { scope: BASE },
  };
  class ScopedRequest extends Request {
    constructor(input: any, init?: any) { super(typeof input === 'string' ? new URL(input, BASE).href : input, init); }
  }
  const context: any = {
    self, caches: caches.api, Request: ScopedRequest, Response, Headers, URL, AbortController,
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
    caches: () => caches.store,
  };
}

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
    const worker = loadWorker(async () => new Response('<h1>502 Bad Gateway</h1>', { status: 502 }));
    worker.seed(cacheName(), './index.html', new Response('<!doctype html><title>Platho</title>'));

    const served = await serve(worker, '/', 'navigate');
    expect(served, 'the worker did not answer the navigation at all').not.toBeNull();
    expect(served!.status).toBe(200);
    expect(await served!.text()).toContain('Platho');
  });

  it('SWRUN-02: with no network at all, navigation still gets the cached shell', async () => {
    const worker = loadWorker(async () => { throw new TypeError('Failed to fetch'); });
    worker.seed(cacheName(), './index.html', new Response('<!doctype html><title>Platho</title>'));

    const served = await serve(worker, '/', 'navigate');
    expect(await served!.text()).toContain('Platho');
  });

  it('SWRUN-03: a healthy server still wins over the cached shell', async () => {
    const worker = loadWorker(async () => new Response('<!doctype html><title>NEW BUILD</title>'));
    worker.seed(cacheName(), './index.html', new Response('<!doctype html><title>OLD BUILD</title>'));

    const served = await serve(worker, '/', 'navigate');
    expect(await served!.text()).toContain('NEW BUILD');
  });

  it('SWRUN-04: with nothing cached, the server error is passed through rather than swallowed', async () => {
    const worker = loadWorker(async () => new Response('down', { status: 503 }));
    const served = await serve(worker, '/', 'navigate');
    expect(served!.status).toBe(503);
  });

  it('SWRUN-05: a 502 for a module falls back to the same file under another version', async () => {
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
    const worker = loadWorker(async () => new Response('<h1>502</h1>', { status: 502 }));
    await serve(worker, '/late.mjs?v=1', 'cors');
    expect([...worker.cacheOf(cacheName()).keys()]).not.toContain(`${ORIGIN}/late.mjs?v=1`);
  });

  it('SWRUN-10: a working network beats a cached copy under a different version', async () => {
    const worker = loadWorker(async () => new Response('the new build'));
    worker.seed(cacheName(), './app.js?v=OLD', new Response('the old build'));

    const served = await serve(worker, '/app.js?v=NEW', 'cors');
    expect(await served!.text()).toBe('the new build');
  });

  it('SWRUN-09: a server that accepts and never answers cannot hang the page forever', async () => {
    const navigation = source.slice(source.indexOf('async function navigationResponse'));
    expect(navigation.slice(0, navigation.indexOf('async function', 10)))
      .toContain('fetchWithTimeout(shellRequest, NAVIGATION_NETWORK_TIMEOUT_MS)');
    const assets = source.slice(source.indexOf('async function cacheFirst'));
    expect(assets.slice(0, assets.indexOf("self.addEventListener('fetch'")))
      .toContain('fetchWithTimeout(request, ASSET_NETWORK_TIMEOUT_MS)');
    const navMs = Number((source.match(/NAVIGATION_NETWORK_TIMEOUT_MS = (\d+)/) ?? [])[1]);
    const assetMs = Number((source.match(/ASSET_NETWORK_TIMEOUT_MS = (\d+)/) ?? [])[1]);
    expect(assetMs).toBeGreaterThan(navMs * 2);
  });


  const assetsOf = () => {
    const from = source.indexOf('const ASSETS = [');
    const to = source.indexOf('];', from);
    return [...source.slice(from, to).matchAll(/'([^']+)'/g)].map((m) => m[1]);
  };
  const lifecycle = async (worker: Loaded, type: 'install' | 'activate') => {
    let held: Promise<any> = Promise.resolve();
    worker.handlers[type]({ waitUntil: (promise: Promise<any>) => { held = promise; } });
    await held;
  };

  it('SWRUN-11: the offline shell is never a REDIRECTED response — a navigation answered with one is a network error', async () => {
    class Redirected extends Response { get redirected() { return true; } }
    const worker = loadWorker(async () => { throw new TypeError('Failed to fetch'); });
    worker.seed(cacheName(), './index.html', new Redirected('<!doctype html><title>Platho</title>'));
    const served = await serve(worker, '/', 'navigate');
    expect(served, 'answered').not.toBeNull();
    expect(served!.redirected, 'never redirected').toBe(false);
    expect(await served!.text()).toContain('Platho');
    expect(source).toContain("const shell = await matchCurrentFirst('./') || await matchCurrentFirst('./index.html') || null;");
  });

  it('SWRUN-12: a release install copies the URL-versioned entries it already holds and fetches only what is new', async () => {
    const list = assetsOf();
    const versioned = list.find((a) => /\.(?:mjs|js|css)\?v=[A-Za-z0-9]+$/.test(a))!;
    const vendored = list.find((a) => /vendor\/.*\.js\?v=\d+$/.test(a))!;
    const counted = list.find((a) => /\.(?:svg|png|webmanifest)\?v=\d+$/.test(a))!;
    const plain = list.find((a) => !/[?&]v=/.test(a) && a !== './' && a !== './index.html')!;
    expect(versioned && vendored && counted && plain, `the list has every shape: ${[versioned, vendored, counted, plain].join(' ')}`).toBeTruthy();
    const worker = loadWorker(async (request: any) => new Response(`net:${keyOf(request)}`));
    for (const asset of [versioned, vendored, counted, plain]) worker.seed('platho-previous', asset, new Response('old bytes'));
    await lifecycle(worker, 'install');
    const fresh = worker.cacheOf(cacheName());
    expect(fresh.size, 'the whole list is present').toBe(list.length);
    expect(await fresh.get(keyOf(versioned))!.text(), 'a versioned module was copied, not fetched').toBe('old bytes');
    expect(await fresh.get(keyOf(vendored))!.text(), 'a versioned vendor script too — its content is gated since round 5').toBe('old bytes');
    expect(await fresh.get(keyOf(counted))!.text(), 'a hand-counted icon or manifest is fetched afresh: nothing holds its counter to its bytes').toMatch(/^net:/);
    expect(await fresh.get(keyOf(plain))!.text(), 'an unversioned one is always fetched afresh').toMatch(/^net:/);
  });

  it('SWRUN-13: the previous release stays until this one is whole — activate fills what install missed, and only then clears', async () => {
    const list = assetsOf();
    const versioned = list.find((a) => /[?&]v=/.test(a))!;
    let failing: string | null = versioned;
    const worker = loadWorker(async (request: any) => (failing && keyOf(request) === keyOf(failing) ? new Response('nope', { status: 503 }) : new Response('ok')));
    worker.seed('platho-previous', './', new Response('old shell'));
    await lifecycle(worker, 'install');
    expect(worker.cacheOf(cacheName()).has(keyOf(versioned)), 'the failing asset is absent after install').toBe(false);
    await lifecycle(worker, 'activate');
    expect(worker.caches().has('platho-previous'), 'the previous release is kept while this one is incomplete').toBe(true);
    failing = null;
    await lifecycle(worker, 'activate');
    expect(worker.cacheOf(cacheName()).has(keyOf(versioned)), 'the missing entry was fetched on activate').toBe(true);
    expect(worker.caches().has('platho-previous'), 'and only then does the old cache go').toBe(false);
  });

  it('SWRUN-14: the update probe is answered from the network and never written into a cache', async () => {
    const worker = loadWorker(async () => new Response('<!doctype html><script src="/app.js?v=b1"></script>'));
    const served = await serve(worker, '/?platho_version_check=123', 'cors');
    expect(served).not.toBeNull();
    expect(await served!.text()).toContain('app.js?v=b1');
    for (const [name, entries] of worker.caches()) {
      for (const href of entries.keys()) expect(href, `cached in ${name}`).not.toContain('platho_version_check');
    }
  });

  it('SWRUN-15: a page that ships as its own document is served as itself when the network is gone, not as the messenger', async () => {
    expect(assetsOf()).toContain('./privacy.html');
    expect(assetsOf()).toContain('./terms.html');
    for (const network of [async () => { throw new TypeError('Failed to fetch'); }, async () => new Response('down', { status: 503 })]) {
      const worker = loadWorker(network as any);
      worker.seed(cacheName(), './', new Response('<!doctype html><title>Platho</title>'));
      worker.seed(cacheName(), './privacy.html', new Response('<!doctype html><title>Privacy</title>'));
      const served = await serve(worker, '/privacy.html', 'navigate');
      expect(await served!.text()).toContain('Privacy');
      const shell = await serve(worker, '/', 'navigate');
      expect(await shell!.text(), 'the messenger still gets its shell').toContain('Platho');
    }
  });



  it('SWRUN-16: with a previous release still cached, the CURRENT release answers first — the shell and an asset', async () => {
    const worker = loadWorker(async () => { throw new TypeError('Failed to fetch'); });
    worker.seed('platho-pwa-OLD', './', new Response('<!doctype html><title>OLD</title>'));
    worker.seed('platho-pwa-OLD', './assets/icons/bold.svg', new Response('old icon'));
    worker.seed(cacheName(), './', new Response('<!doctype html><title>NEW</title>'));
    worker.seed(cacheName(), './assets/icons/bold.svg', new Response('new icon'));
    expect(await (await serve(worker, '/', 'navigate'))!.text()).toContain('NEW');
    expect(await (await serve(worker, '/assets/icons/bold.svg', 'cors'))!.text()).toBe('new icon');
    worker.seed('platho-pwa-OLD', './assets/icons/only-old.svg', new Response('only old'));
    expect(await (await serve(worker, '/assets/icons/only-old.svg', 'cors'))!.text()).toBe('only old');
  });

  it('SWRUN-17: the update probe is the network\'s answer or none — never a cached shell, whatever the server does', async () => {
    const worker = loadWorker(async () => new Response('down', { status: 502 }));
    worker.seed('platho-pwa-OLD', './', new Response('<!doctype html><script src="/app.js?v=OLDBUILD"></script>'));
    worker.seed(cacheName(), './', new Response('<!doctype html><script src="/app.js?v=NEWBUILD"></script>'));
    const served = await serve(worker, '/?platho_version_check=1', 'cors');
    expect(served!.status, 'the server\'s own answer').toBe(502);
    expect(await served!.text()).not.toContain('OLDBUILD');
    const offline = loadWorker(async () => { throw new TypeError('Failed to fetch'); });
    offline.seed(cacheName(), './', new Response('<!doctype html><script src="/app.js?v=NEWBUILD"></script>'));
    const none = await serve(offline, '/?platho_version_check=2', 'cors');
    expect(none!.ok, 'offline: no answer, not a cached one').toBe(false);
  });

  it('SWRUN-18: a navigation while a previous cache survives finishes the install and lets the old cache go', async () => {
    const list = assetsOf();
    const versioned = list.find((a) => /\.(?:mjs|js|css)\?v=[A-Za-z0-9]+$/.test(a))!;
    let failing: string | null = versioned;
    const worker = loadWorker(async (request: any) => (failing && keyOf(request) === keyOf(failing) ? new Response('nope', { status: 503 }) : new Response('<!doctype html><title>Platho</title>')));
    worker.seed('platho-previous', './', new Response('old shell'));
    await lifecycle(worker, 'install');
    await lifecycle(worker, 'activate');
    expect(worker.caches().has('platho-previous'), 'kept while incomplete').toBe(true);
    expect(worker.cacheOf(cacheName()).has(keyOf(versioned))).toBe(false);
    failing = null;
    let held: Promise<any> = Promise.resolve();
    worker.handlers.fetch({ request: { url: BASE, mode: 'navigate', method: 'GET' }, respondWith: () => {}, waitUntil: (p: Promise<any>) => { held = p; } });
    await held;
    expect(worker.cacheOf(cacheName()).has(keyOf(versioned)), 'the missing entry was fetched on the navigation').toBe(true);
    expect(worker.caches().has('platho-previous'), 'and the previous release went').toBe(false);
  });

  it('SWRUN-19: at most one previous release survives an install that keeps failing', async () => {
    const list = assetsOf();
    const versioned = list.find((a) => /\.(?:mjs|js|css)\?v=[A-Za-z0-9]+$/.test(a))!;
    const worker = loadWorker(async (request: any) => (keyOf(request) === keyOf(versioned) ? new Response('nope', { status: 503 }) : new Response('ok')));
    worker.seed('platho-pwa-older', './', new Response('older'));
    worker.seed('platho-pwa-old', './', new Response('old'));
    await lifecycle(worker, 'install');
    await lifecycle(worker, 'activate');
    const survivors = [...worker.caches().keys()].filter((k) => k !== cacheName());
    expect(survivors, 'one previous release at most, the newest').toEqual(['platho-pwa-old']);
  });

});
