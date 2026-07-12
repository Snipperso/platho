const CACHE_NAME = 'platho-pwa-prototype-v852';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=266',
  './app.js?v=777',
  './i18n.mjs?v=29',
  './i18n-strings.mjs?v=29',
  './boot-signal-field.mjs?v=1',
  './boot-signal-worker.js?v=1',
  './vendor/telegram-web-app.js?v=1',
  './boot-guard.js?v=6',
  './platho-config.mjs?v=105',
  './capsule-part-policy.mjs?v=8',
  './message-pricing-policy.mjs?v=14',
  './public-channel-subscriptions.mjs?v=18',
  './recipient-identities.mjs?v=6',
  './channels/platho.app/feed.json',
  './encrypted-message-store.mjs?v=5',
  './platho-wallet.mjs?v=18',
  './ton-mnemonic-wordlist.mjs?v=1',
  './pwa-contract-transactions.mjs?v=33',
  './publish-batch-orchestration.mjs?v=7',
  './vault-ton-rpc-provider.mjs?v=62',
  './ton-dns-provider.mjs?v=40',
  './capsulehub-ton-rpc-provider.mjs?v=59',
  './ath-ton-rpc-provider.mjs?v=42',
  './profile-registry-ton-rpc-provider.mjs?v=44',
  './username-ton-rpc-provider.mjs?v=47',
  './crypto/platho-crypto.mjs?v=12',
  './replay-store.mjs?v=1',
  './profile-avatar-media-store.mjs?v=1',
  './vault-chain-provider.mjs?v=8',
  './webp-encoder.mjs?v=1',
  './qr-code.mjs?v=1',
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
  './assets/icons/chat.svg',
  './assets/icons/chat-outline.svg',
  './assets/icons/broadcast.svg',
  './assets/icons/vault.svg',
  './assets/icons/user.svg',
  './assets/icons/eye.svg',
  './assets/icons/eye-off.svg',
  './assets/icons/search.svg',
  './assets/icons/plus.svg',
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
  './assets/icons/bolt.svg',
  './assets/icons/gear.svg',
  './assets/icons/install.svg',
  './assets/icons/open-app.svg',
  './assets/icons/info.svg',
  './assets/icons/copy.svg',
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
];

self.addEventListener('install', (event) => {
  // Resilient precache: addAll is atomic, so a single missing or transiently
  // failing asset would abort the whole install and the device would stay on
  // the previous service worker (and its stale app shell — exactly how an old
  // cache without boot-guard can pin a device to a dark screen). Cache each
  // asset independently and never let one failure block activation; the
  // runtime fetch handler backfills anything that slipped through.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.allSettled(
      ASSETS.map((asset) => cache.add(asset)),
    )),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function cacheSameOrigin(request, response) {
  const url = new URL(request.url);
  if (response?.ok && url.origin === self.location.origin) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

async function cachedAppShell() {
  return await caches.match('./index.html') || await caches.match('./') || null;
}

function appShellCacheRequest() {
  return new Request(new URL('./index.html', self.location.href).href);
}

const NAVIGATION_NETWORK_TIMEOUT_MS = 6000;

function fetchWithTimeout(request, timeoutMs) {
  if (typeof AbortController === 'undefined') return fetch(request);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function navigationResponse(event) {
  // Network-first so a fresh release (new app shell + boot-guard) always wins
  // over a stale cached shell, but time-bounded so a slow or partially
  // filtered network cannot hang the page on a blank screen: fall back to the
  // cached shell instead of spinning forever.
  // cache:'no-cache' is LOAD-BEARING: a plain fetch(request) is answered by the
  // browser's HTTP cache first, and the server sends NO Cache-Control on the
  // shell — so webviews (worst: Telegram Mini App) heuristically served a STALE
  // index.html (old ?v= asset URLs) for hours without ever asking the network,
  // and devices kept running old builds despite "network-first". no-cache
  // forces a conditional revalidation (ETag -> cheap 304, or the fresh shell).
  try {
    const shellRequest = new Request(event.request.url, { cache: 'no-cache', credentials: 'same-origin' });
    const response = await fetchWithTimeout(shellRequest, NAVIGATION_NETWORK_TIMEOUT_MS);
    return await cacheSameOrigin(appShellCacheRequest(), response);
  } catch (error) {
    return await cachedAppShell() || Response.error();
  }
}

async function staleWhileRevalidate(event) {
  const request = event.request;
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((response) => cacheSameOrigin(request, response))
    .catch(() => cached || Response.error());
  if (cached) {
    event.waitUntil(network.catch(() => undefined));
    return cached;
  }
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(navigationResponse(event));
    return;
  }

  event.respondWith(staleWhileRevalidate(event));
});
