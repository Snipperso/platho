const CACHE_NAME = 'platho-pwa-c82fa3c36d1c';
const ASSETS = [
  './',
  './index.html',
  './privacy.html',
  './terms.html',
  './styles.css?v=632',
  './app.js?v=b7cf3f8d5',
  './i18n.mjs?v=325',
  './i18n-strings.mjs?v=325',
  './boot-signal-field.mjs?v=16',
  './cutover-epoch.mjs?v=7',
  './boot-signal-worker.js?v=19',
  './vendor/telegram-web-app.js?v=3',
  './vendor/lottie-web/lottie_light_canvas.min.js?v=1',
  './boot-guard.js?v=17',
  './platho-config.mjs?v=180',
  './capsule-part-policy.mjs?v=24',
  './message-pricing-policy.mjs?v=15',
  './public-channel-subscriptions.mjs?v=311',
  './thread-list-order.mjs?v=5',
  './keyed-rows.mjs?v=3',
  './recipient-identities.mjs?v=141',
  './channels/platho.app/feed.json',
  './encrypted-message-store.mjs?v=23',
  './platho-wallet.mjs?v=98',
  './ton-mnemonic-wordlist.mjs?v=2',
  './pwa-contract-transactions.mjs?v=60',
  './ton-rpc-transport.mjs?v=116',
  './ton-dns-provider.mjs?v=100',
  './ath-ton-rpc-provider.mjs?v=98',
  './profile-registry-ton-rpc-provider.mjs?v=99',
  './username-ton-rpc-provider.mjs?v=101',
  './crypto/platho-crypto.mjs?v=32',
  './replay-store.mjs?v=8',
  './profile-avatar-media-store.mjs?v=7',
  './sealed-cache.mjs?v=6',
  './storage-resecure.mjs?v=20',
  './ath-wallet-code.mjs?v=2',
  './telegram-launch.mjs?v=2',
  './wallet-keyring.mjs?v=7',
  './wallet-assets.mjs?v=58',
  './verified-assets.mjs?v=9',
  './asset-pictures.mjs?v=11',
  './wallet-transfers.mjs?v=23',
  './wallet-swap.mjs?v=32',
  './swap-pools.mjs?v=9',
  './wallet-swap-dedust.mjs?v=25',
  './dedust-pools.mjs?v=10',
  './swap-routes.mjs?v=33',
  './pool-activity.mjs?v=9',
  './pool-state.mjs?v=5',
  './price-history.mjs?v=16',
  './nft-market.mjs?v=50',
  './nft-collections.mjs?v=5',
  './asset-communities.mjs?v=4',
  './webp-encoder.mjs?v=1',
  './qr-code.mjs?v=1',
  './conv-discovery.mjs?v=109',
  './conv-key-persist.mjs?v=45',
  './conv-key-store.mjs?v=27',
  './conv-lane-read.mjs?v=126',
  './conv-lane-send.mjs?v=141',
  './crypto/group-lane.mjs?v=8',
  './group-protocol.mjs?v=32',
  './public-reactions.mjs?v=32',
  './group-lane-send.mjs?v=102',
  './group-lane-read.mjs?v=79',
  './group-store.mjs?v=43',
  './group-record-store.mjs?v=16',
  './group-runtime.mjs?v=122',
  './public-group-protocol.mjs?v=11',
  './public-group-runtime.mjs?v=29',
  './group-entry-fee.mjs?v=14',
  './fee-vault-read.mjs?v=59',
  './fee-vault.mjs?v=40',
  './conv-lane.mjs?v=138',
  './conv-publish-browser.mjs?v=49',
  './conv-reply-bundle.mjs?v=30',
  './m21c-envelope.mjs?v=5',
  './device-secret-store.mjs?v=12',
  './at-rest-seal.mjs?v=5',
  './crypto/conv-routing.mjs?v=9',
  './crypto/intro-handshake.mjs?v=8',
  './intro-bucket.mjs?v=108',
  './intro-codec.mjs?v=4',
  './intro-cursor-store.mjs?v=16',
  './intro-lane-send.mjs?v=140',
  './intro-lane.mjs?v=140',
  './intro-publish-browser.mjs?v=109',
  './intro-receive-handler.mjs?v=33',
  './intro-receive.mjs?v=88',
  './intro-scan-policy.mjs?v=6',
  './intro-scan-runner.mjs?v=118',
  './intro-scan.mjs?v=17',
  './intro-send-coords.mjs?v=110',
  './intro-send-state.mjs?v=5',
  './intro-transport.mjs?v=116',
  './key-shard-register-browser.mjs?v=47',
  './key-shard-register-send.mjs?v=95',
  './key-shard-ton-rpc-provider.mjs?v=46',
  './market-stability-buy-send.mjs?v=69',
  './market-stability-read.mjs?v=3',
  './message-plain-text.mjs?v=5',
  './notes-lane.mjs?v=117',
  './public-lane-send.mjs?v=149',
  './public-lane.mjs?v=169',
  './public-publish-browser.mjs?v=88',
  './public-shard-ton-rpc-provider.mjs?v=45',
  './publish-price.mjs?v=17',
  './shard-debt.mjs?v=87',
  './moderation.mjs?v=84',
  './recovery-blob.mjs?v=32',
  './recovery-lane.mjs?v=138',
  './recovery-publish-browser.mjs?v=107',
  './recovery-transport.mjs?v=115',
  './shard-address.mjs?v=48',
  './vault-account.mjs?v=78',
  './frozen-account.mjs?v=29',
  './shard-code.mjs?v=6',
  './shard-code-18.mjs?v=2',
  './ath-request-reserve.mjs?v=11',
  './publish-final-cost.mjs?v=19',
  './shard-discovery.mjs?v=108',
  './shard-reader.mjs?v=113',
  './shard-rpc.mjs?v=74',
  './telegram-gift-nfts.mjs?v=28',
  './ton-stack-num.mjs?v=2',
  './username-nft-owned.mjs?v=45',
  './username-nft-transfer.mjs?v=24',
  './wallet-send-fee.mjs?v=70',
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
