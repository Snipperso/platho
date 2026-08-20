// GENERATED — do not edit by hand. `node scripts/bump_module_versions.mjs --run` derives this from the content of
// every asset listed below, so it moves on any deploy that changes anything and never on one that changes nothing.
// It was a hand-bumped counter until 2026-08-09; a missed bump meant a changed icon reached no device at all.
const CACHE_NAME = 'platho-pwa-8bd9761d2a33';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=339',
  './app.js?v=bf36260a7',
  './i18n.mjs?v=76',
  './i18n-strings.mjs?v=78',
  './boot-signal-field.mjs?v=1',
  './boot-signal-worker.js?v=1',
  './vendor/telegram-web-app.js?v=1',
  './boot-guard.js?v=6',
  './platho-config.mjs?v=122',
  './capsule-part-policy.mjs?v=10',
  './message-pricing-policy.mjs?v=14',
  './public-channel-subscriptions.mjs?v=50',
  './recipient-identities.mjs?v=6',
  './channels/platho.app/feed.json',
  './encrypted-message-store.mjs?v=6',
  './platho-wallet.mjs?v=33',
  './ton-mnemonic-wordlist.mjs?v=1',
  './pwa-contract-transactions.mjs?v=37',
  './publish-batch-orchestration.mjs?v=10',
  './ton-rpc-transport.mjs?v=76',
  './ton-dns-provider.mjs?v=54',
  './ath-ton-rpc-provider.mjs?v=55',
  './profile-registry-ton-rpc-provider.mjs?v=58',
  './username-ton-rpc-provider.mjs?v=60',
  './crypto/platho-crypto.mjs?v=15',
  './replay-store.mjs?v=1',
  './profile-avatar-media-store.mjs?v=1',
  './webp-encoder.mjs?v=1',
  './qr-code.mjs?v=1',
  './airdrop-pool-read.mjs?v=1',
  './airdrop-ticket-read.mjs?v=16',
  './conv-discovery.mjs?v=16',
  './conv-key-persist.mjs?v=4',
  './conv-key-store.mjs?v=2',
  './conv-lane-read.mjs?v=18',
  './conv-lane-send.mjs?v=16',
  './conv-lane.mjs?v=19',
  './conv-publish-browser.mjs?v=4',
  './conv-reply-bundle.mjs?v=5',
  './crypto/conv-routing.mjs?v=2',
  './crypto/intro-handshake.mjs',
  './intro-bucket.mjs?v=16',
  './intro-codec.mjs?v=2',
  './intro-cursor-store.mjs?v=1',
  './intro-lane-send.mjs?v=16',
  './intro-lane.mjs?v=22',
  './intro-publish-browser.mjs?v=16',
  './intro-receive-handler.mjs?v=4',
  './intro-receive.mjs',
  './intro-scan-policy.mjs?v=1',
  './intro-scan-runner.mjs?v=16',
  './intro-scan.mjs',
  './intro-send-coords.mjs?v=16',
  './intro-transport.mjs?v=17',
  './key-shard-register-browser.mjs?v=4',
  './key-shard-register-send.mjs?v=16',
  './key-shard-ton-rpc-provider.mjs?v=4',
  './market-stability-buy-send.mjs?v=3',
  './market-stability-read.mjs?v=1',
  './notes-lane.mjs?v=16',
  './public-lane-send.mjs?v=16',
  './public-lane.mjs?v=28',
  './public-publish-browser.mjs?v=4',
  './public-shard-ton-rpc-provider.mjs?v=4',
  './publish-price.mjs?v=1',
  './recovery-blob.mjs?v=5',
  './recovery-lane.mjs?v=16',
  './recovery-publish-browser.mjs?v=16',
  './recovery-transport.mjs?v=17',
  './shard-address.mjs?v=7',
  './shard-discovery.mjs?v=18',
  './shard-reader.mjs?v=16',
  './shard-rpc.mjs?v=16',
  './ton-stack-num.mjs?v=1',
  './wallet-send-fee.mjs?v=4',
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
];

self.addEventListener('install', (event) => {
  // Resilient precache: addAll is atomic, so a single missing or transiently
  // failing asset would abort the whole install and the device would stay on
  // the previous service worker (and its stale app shell — exactly how an old
  // cache without boot-guard can pin a device to a dark screen). Cache each
  // asset independently and never let one failure block activation; the
  // runtime fetch handler backfills anything that slipped through.
  // `cache: 'reload'` is what makes a CACHE_NAME bump actually mean something. A plain cache.add() fetches through
  // the browser HTTP cache, so an asset whose URL carries no ?v= — every icon SVG, the manifest, the images — was
  // re-cached from the SAME stale bytes and the new build shipped the old file. MEASURED: the owner reloaded onto
  // v856 and still saw the pre-fix toolbar glyph; only the URL-versioned modules had actually changed.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.allSettled(
      ASSETS.map((asset) => cache.add(new Request(asset, { cache: 'reload' }))),
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
