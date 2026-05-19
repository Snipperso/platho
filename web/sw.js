const CACHE_NAME = 'platho-pwa-prototype-v17';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './platho-config.mjs',
  './no-backend-transport.mjs',
  './transport-share.mjs',
  './encrypted-message-store.mjs',
  './vault-ton-rpc-provider.mjs',
  './crypto/platho-crypto.mjs',
  './crypto/ton-wallet-stateinit.mjs',
  './replay-store.mjs',
  './vault-chain-provider.mjs',
  './manifest.webmanifest',
  './tonconnect-manifest.json',
  './vendor/@tonconnect/ui/tonconnect-ui.min.js',
  './vendor/qrcode-generator/qrcode.js',
  './vendor/qrcode-generator/package.json',
  './assets/platho-icon.svg',
  './assets/platho-icon.png',
  './assets/icons/chat.svg',
  './assets/icons/broadcast.svg',
  './assets/icons/vault.svg',
  './assets/icons/user.svg',
  './assets/icons/search.svg',
  './assets/icons/plus.svg',
  './assets/icons/call.svg',
  './assets/icons/more.svg',
  './assets/icons/attach.svg',
  './assets/icons/send.svg',
  './assets/icons/refresh.svg',
  './assets/icons/down.svg',
  './assets/icons/up.svg',
  './assets/icons/bolt.svg',
  './assets/icons/gear.svg',
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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const url = new URL(event.request.url);
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      });
    }),
  );
});
