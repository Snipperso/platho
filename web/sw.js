const CACHE_NAME = 'platho-pwa-a6e15bbde0b3';
const ASSETS = [
  './',
  './index.html',
  './privacy.html',
  './terms.html',
  './styles.css?v=618',
  './app.js?v=bfe30acaf',
  './i18n.mjs?v=298',
  './i18n-strings.mjs?v=298',
  './boot-signal-field.mjs?v=16',
  './cutover-epoch.mjs?v=7',
  './boot-signal-worker.js?v=19',
  './vendor/telegram-web-app.js?v=3',
  './vendor/lottie-web/lottie_light_canvas.min.js?v=1',
  './boot-guard.js?v=17',
  './platho-config.mjs?v=176',
  './capsule-part-policy.mjs?v=23',
  './message-pricing-policy.mjs?v=15',
  './public-channel-subscriptions.mjs?v=283',
  './thread-list-order.mjs?v=5',
  './keyed-rows.mjs?v=3',
  './recipient-identities.mjs?v=114',
  './channels/platho.app/feed.json',
  './encrypted-message-store.mjs?v=22',
  './platho-wallet.mjs?v=94',
  './ton-mnemonic-wordlist.mjs?v=2',
  './pwa-contract-transactions.mjs?v=59',
  './ton-rpc-transport.mjs?v=112',
  './ton-dns-provider.mjs?v=96',
  './ath-ton-rpc-provider.mjs?v=94',
  './profile-registry-ton-rpc-provider.mjs?v=95',
  './username-ton-rpc-provider.mjs?v=96',
  './crypto/platho-crypto.mjs?v=31',
  './replay-store.mjs?v=8',
  './profile-avatar-media-store.mjs?v=7',
  './sealed-cache.mjs?v=6',
  './storage-resecure.mjs?v=20',
  './ath-wallet-code.mjs?v=2',
  './telegram-launch.mjs?v=2',
  './wallet-keyring.mjs?v=7',
  './wallet-assets.mjs?v=34',
  './verified-assets.mjs?v=6',
  './asset-pictures.mjs?v=8',
  './wallet-transfers.mjs?v=16',
  './wallet-swap.mjs?v=22',
  './swap-pools.mjs?v=6',
  './wallet-swap-dedust.mjs?v=15',
  './dedust-pools.mjs?v=7',
  './swap-routes.mjs?v=23',
  './pool-activity.mjs?v=6',
  './pool-state.mjs?v=5',
  './price-history.mjs?v=14',
  './nft-market.mjs?v=14',
  './webp-encoder.mjs?v=1',
  './qr-code.mjs?v=1',
  './conv-discovery.mjs?v=105',
  './conv-key-persist.mjs?v=44',
  './conv-key-store.mjs?v=27',
  './conv-lane-read.mjs?v=122',
  './conv-lane-send.mjs?v=137',
  './crypto/group-lane.mjs?v=8',
  './group-protocol.mjs?v=31',
  './public-reactions.mjs?v=31',
  './group-lane-send.mjs?v=98',
  './group-lane-read.mjs?v=75',
  './group-store.mjs?v=42',
  './group-record-store.mjs?v=15',
  './group-runtime.mjs?v=118',
  './public-group-protocol.mjs?v=11',
  './public-group-runtime.mjs?v=28',
  './group-entry-fee.mjs?v=13',
  './fee-vault-read.mjs?v=55',
  './fee-vault.mjs?v=39',
  './conv-lane.mjs?v=134',
  './conv-publish-browser.mjs?v=48',
  './conv-reply-bundle.mjs?v=29',
  './m21c-envelope.mjs?v=5',
  './device-secret-store.mjs?v=11',
  './at-rest-seal.mjs?v=5',
  './crypto/conv-routing.mjs?v=9',
  './crypto/intro-handshake.mjs?v=8',
  './intro-bucket.mjs?v=104',
  './intro-codec.mjs?v=4',
  './intro-cursor-store.mjs?v=16',
  './intro-lane-send.mjs?v=136',
  './intro-lane.mjs?v=136',
  './intro-publish-browser.mjs?v=105',
  './intro-receive-handler.mjs?v=32',
  './intro-receive.mjs?v=84',
  './intro-scan-policy.mjs?v=6',
  './intro-scan-runner.mjs?v=114',
  './intro-scan.mjs?v=16',
  './intro-send-coords.mjs?v=106',
  './intro-send-state.mjs?v=5',
  './intro-transport.mjs?v=112',
  './key-shard-register-browser.mjs?v=46',
  './key-shard-register-send.mjs?v=91',
  './key-shard-ton-rpc-provider.mjs?v=45',
  './market-stability-buy-send.mjs?v=65',
  './market-stability-read.mjs?v=3',
  './message-plain-text.mjs?v=5',
  './notes-lane.mjs?v=113',
  './public-lane-send.mjs?v=145',
  './public-lane.mjs?v=165',
  './public-publish-browser.mjs?v=84',
  './public-shard-ton-rpc-provider.mjs?v=44',
  './publish-price.mjs?v=17',
  './shard-debt.mjs?v=83',
  './moderation.mjs?v=80',
  './recovery-blob.mjs?v=31',
  './recovery-lane.mjs?v=134',
  './recovery-publish-browser.mjs?v=103',
  './recovery-transport.mjs?v=111',
  './shard-address.mjs?v=47',
  './vault-account.mjs?v=74',
  './frozen-account.mjs?v=25',
  './shard-code.mjs?v=6',
  './shard-code-18.mjs?v=2',
  './ath-request-reserve.mjs?v=10',
  './publish-final-cost.mjs?v=18',
  './shard-discovery.mjs?v=104',
  './shard-reader.mjs?v=109',
  './shard-rpc.mjs?v=70',
  './telegram-gift-nfts.mjs?v=27',
  './ton-stack-num.mjs?v=2',
  './username-nft-owned.mjs?v=40',
  './username-nft-transfer.mjs?v=23',
  './wallet-send-fee.mjs?v=66',
  './vendor/@noble/hashes/hkdf.js',
  './vendor/@jsquash/webp/codec/enc/webp_enc.js',
  './vendor/@jsquash/webp/codec/enc/webp_enc.wasm',
  './vendor/@noble/curves/abstract/curve.js',
  './vendor/@noble/curves/abstract/edwards.js',
  './vendor/@noble/curves/abstract/fft.js',
  './vendor/@noble/curves/abstract/frost.js',
  './vendor/@noble/curves/abstract/hash-to-curve.js',
  './vendor/@noble/curves/abstract/modular.js',
  './vendor/@noble/curves/abstract/montgomery.js',
  './vendor/@noble/curves/abstract/oprf.js',
  './vendor/@noble/curves/abstract/weierstrass.js',
  './vendor/@noble/curves/ed25519.js',
  './vendor/@noble/curves/misc.js',
  './vendor/@noble/curves/nist.js',
  './vendor/@noble/curves/secp256k1.js',
  './vendor/@noble/curves/utils.js',
  './vendor/@noble/hashes/_blake.js',
  './vendor/@noble/hashes/_md.js',
  './vendor/@noble/hashes/_u64.js',
  './vendor/@noble/hashes/blake1.js',
  './vendor/@noble/hashes/blake2.js',
  './vendor/@noble/hashes/hmac.js',
  './vendor/@noble/hashes/legacy.js',
  './vendor/@noble/hashes/pbkdf2.js',
  './vendor/@noble/hashes/sha2.js',
  './vendor/@noble/hashes/sha3.js',
  './vendor/@noble/hashes/utils.js',
  './vendor/@noble/post-quantum/_crystals.js',
  './vendor/@noble/post-quantum/ml-kem.js',
  './vendor/@noble/post-quantum/utils.js',
  './manifest.webmanifest',
  './manifest.webmanifest?v=3',
  './assets/platho-icon.svg',
  './assets/platho-icon.png',
  './assets/platho-icon-192.png',
  './assets/platho-icon-192.png?v=3',
  './assets/platho-icon-512.png',
  './assets/platho-icon-512.png?v=3',
  './assets/platho-logo-transparent.png',
  './assets/icons/wallet.svg',
  './assets/icons/qr.svg',
  './assets/icons/send.svg',
  './assets/icons/shield.svg',
  './assets/icons/close.svg',
  './assets/icons/chat.svg',
  './assets/icons/chat-outline.svg',
  './assets/icons/broadcast.svg',
  './assets/icons/vault.svg',
  './assets/icons/user.svg',
  './assets/icons/eye.svg',
  './assets/icons/eye-off.svg',
  './assets/icons/search.svg',
  './assets/icons/plus.svg',
  './assets/icons/share.svg',
  './assets/icons/flag.svg',
  './assets/icons/bell-plus.svg',
  './assets/icons/bell-on.svg',
  './assets/icons/image.svg',
  './assets/icons/link.svg',
  './assets/icons/down.svg',
  './assets/icons/up.svg',
  './assets/icons/back.svg',
  './assets/icons/chevron-down.svg',
  './assets/icons/refresh.svg',
  './assets/icons/swap-circular.svg',
  './assets/icons/swap-vertical.svg',
  './assets/icons/text-select.svg',
  './assets/icons/expand.svg?v=2',
  './assets/icons/collapse.svg?v=2',
  './assets/icons/bolt.svg',
  './assets/icons/gear.svg',
  './assets/icons/install.svg',
  './assets/icons/open-app.svg',
  './assets/icons/info.svg',
  './assets/icons/copy.svg',
  './assets/icons/trash.svg',
  './assets/icons/download.svg',
  './assets/icons/compass.svg',
  './assets/icons/about.svg',
  './assets/icons/smiley.svg',
  './assets/icons/heading.svg',
  './assets/icons/bold.svg',
  './assets/icons/italic.svg',
  './assets/icons/list.svg',
  './assets/icons/quote.svg',
  './assets/icons/align-center.svg',
  './assets/icons/align-justify.svg',
  './docs/about-platho.md',
  './docs/ath-whitepaper.md',
  './docs/crypto-protocol.md',
  './docs/privacy-policy.md',
  './docs/terms-of-use.md',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const previous = (await caches.keys()).filter((key) => key !== CACHE_NAME);
    const olds = [];
    for (const key of previous) { try { olds.push(await caches.open(key)); } catch { } }
    await Promise.allSettled(ASSETS.map(async (asset) => {
      if (await cache.match(asset)) return;
      if (/\.(?:mjs|js|css)\?v=[A-Za-z0-9]+$/.test(asset)) {
        for (const old of olds) {
          const held = await old.match(asset);
          if (held && held.ok && !held.redirected) { await cache.put(asset, held.clone()); return; }
        }
      }
      await cache.add(new Request(asset, { cache: 'reload' }));
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const urlOf = (asset) => new URL(asset, self.location.href).href;
    const held = new Set((await cache.keys()).map((request) => request.url));
    const missing = ASSETS.filter((asset) => !held.has(urlOf(asset)));
    await Promise.allSettled(missing.map((asset) => cache.add(new Request(asset, { cache: 'reload' }))));
    const after = new Set((await cache.keys()).map((request) => request.url));
    const keys = (await caches.keys()).filter((key) => key !== CACHE_NAME);
    if (ASSETS.every((asset) => after.has(urlOf(asset)))) {
      await Promise.all(keys.map((key) => caches.delete(key)));
    } else if (keys.length > 1) {
      await Promise.all(keys.slice(0, -1).map((key) => caches.delete(key)));
    }
  })());
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'platho-window-count' && event.ports?.[0]) {
    event.waitUntil((async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      event.ports[0].postMessage({ windows: windows.length });
    })());
  }
});

async function cacheSameOrigin(request, response) {
  const url = new URL(request.url);
  if (response?.ok && url.origin === self.location.origin) {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    } catch { }
  }
  return response;
}

async function matchCurrentFirst(request, options = undefined) {
  try {
    const current = await caches.open(CACHE_NAME);
    const held = await current.match(request, options);
    if (held) return held;
  } catch { }
  return await caches.match(request, options) || null;
}

let precacheCompletionAt = 0;
async function completePrecacheIfNeeded() {
  const keys = await caches.keys();
  if (keys.every((key) => key === CACHE_NAME)) return;
  const nowMs = Date.now();
  if (nowMs - precacheCompletionAt < 60_000) return;
  precacheCompletionAt = nowMs;
  const cache = await caches.open(CACHE_NAME);
  const urlOf = (asset) => new URL(asset, self.location.href).href;
  const held = new Set((await cache.keys()).map((request) => request.url));
  const missing = ASSETS.filter((asset) => !held.has(urlOf(asset)));
  await Promise.allSettled(missing.map((asset) => cache.add(new Request(asset, { cache: 'reload' }))));
  const after = new Set((await cache.keys()).map((request) => request.url));
  if (ASSETS.every((asset) => after.has(urlOf(asset)))) {
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
  }
}

async function cachedAppShell() {
  const shell = await matchCurrentFirst('./') || await matchCurrentFirst('./index.html') || null;
  if (shell && shell.redirected) return new Response(shell.body, { status: shell.status, statusText: shell.statusText, headers: shell.headers });
  return shell;
}

function appShellCacheRequest() {
  return new Request(new URL('./index.html', self.location.href).href);
}

const NAVIGATION_NETWORK_TIMEOUT_MS = 6000;
const ASSET_NETWORK_TIMEOUT_MS = 30000;

function fetchWithTimeout(request, timeoutMs) {
  if (typeof AbortController === 'undefined') return fetch(request);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function navigationResponse(event) {
  try { event.waitUntil?.(completePrecacheIfNeeded().catch(() => {})); } catch { }
  try {
    const shellRequest = new Request(event.request.url, { cache: 'no-cache', credentials: 'same-origin' });
    const response = await fetchWithTimeout(shellRequest, NAVIGATION_NETWORK_TIMEOUT_MS);
    if (!response.ok) {
      const own = await cachedIgnoringVersion(event.request);
      if (own && !own.redirected) return own;
      const shell = await cachedAppShell();
      if (shell) return shell;
      return response;
    }
    if (!(await cachedAppShell())) await cacheSameOrigin(appShellCacheRequest(), response);
    return response;
  } catch (error) {
    { const own = await cachedIgnoringVersion(event.request); if (own && !own.redirected) return own; }
    return await cachedAppShell() || Response.error();
  }
}

async function cachedIgnoringVersion(request) {
  try {
    return await matchCurrentFirst(request, { ignoreSearch: true });
  } catch (error) {
    return null;
  }
}

async function cacheFirst(event) {
  const request = event.request;
  if (request.url.includes('platho_version_check')) {
    try { return await fetchWithTimeout(request, ASSET_NETWORK_TIMEOUT_MS); } catch { return Response.error(); }
  }
  const cached = await matchCurrentFirst(request);
  if (cached) return cached;
  try {
    const response = await fetchWithTimeout(request, ASSET_NETWORK_TIMEOUT_MS);
    if (!response.ok) return await cachedIgnoringVersion(request) || response;
    return await cacheSameOrigin(request, response);
  } catch (error) {
    return await cachedIgnoringVersion(request) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/clear-site-storage') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(navigationResponse(event));
    return;
  }

  event.respondWith(cacheFirst(event));
});
