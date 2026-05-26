const CACHE_NAME = 'platho-pwa-prototype-v122';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './platho-config.mjs',
  './capsule-part-policy.mjs',
  './message-pricing-policy.mjs',
  './public-channel-subscriptions.mjs',
  './recipient-identities.mjs',
  './channels/platho.app/feed.json',
  './encrypted-message-store.mjs',
  './platho-wallet.mjs',
  './pwa-contract-transactions.mjs',
  './vault-ton-rpc-provider.mjs',
  './ton-dns-provider.mjs',
  './capsulehub-ton-rpc-provider.mjs',
  './ath-ton-rpc-provider.mjs',
  './profile-registry-ton-rpc-provider.mjs',
  './username-ton-rpc-provider.mjs',
  './crypto/platho-crypto.mjs',
  './replay-store.mjs',
  './vault-chain-provider.mjs',
  './manifest.webmanifest',
  './assets/platho-icon.svg',
  './assets/platho-icon.png',
  './assets/platho-icon-192.png',
  './assets/platho-icon-512.png',
  './assets/platho-logo-transparent.png',
  './assets/icons/chat.svg',
  './assets/icons/chat-outline.svg',
  './assets/icons/broadcast.svg',
  './assets/icons/vault.svg',
  './assets/icons/user.svg',
  './assets/icons/search.svg',
  './assets/icons/plus.svg',
  './assets/icons/image.svg',
  './assets/icons/down.svg',
  './assets/icons/up.svg',
  './assets/icons/back.svg',
  './assets/icons/chevron-down.svg',
  './assets/icons/refresh.svg',
  './assets/icons/bolt.svg',
  './assets/icons/gear.svg',
  './assets/icons/install.svg',
  './assets/icons/info.svg',
  './docs/about-platho.md',
  './docs/ath-whitepaper.md',
  './docs/crypto-protocol.md',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
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

async function navigationResponse(event) {
  try {
    const response = await fetch(event.request);
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
