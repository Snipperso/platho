const CACHE_NAME = 'platho-pwa-prototype-v332';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=126',
  './app.js?v=270',
  './platho-config.mjs?v=49',
  './capsule-part-policy.mjs?v=3',
  './message-pricing-policy.mjs?v=10',
  './public-channel-subscriptions.mjs?v=6',
  './recipient-identities.mjs?v=4',
  './channels/platho.app/feed.json',
  './encrypted-message-store.mjs?v=3',
  './platho-wallet.mjs?v=10',
  './ton-mnemonic-wordlist.mjs?v=1',
  './pwa-contract-transactions.mjs?v=18',
  './vault-ton-rpc-provider.mjs?v=20',
  './ton-dns-provider.mjs?v=11',
  './capsulehub-ton-rpc-provider.mjs?v=18',
  './ath-ton-rpc-provider.mjs?v=11',
  './profile-registry-ton-rpc-provider.mjs?v=14',
  './username-ton-rpc-provider.mjs?v=16',
  './crypto/platho-crypto.mjs?v=6',
  './replay-store.mjs?v=1',
  './vault-chain-provider.mjs?v=3',
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
  './assets/icons/down.svg',
  './assets/icons/up.svg',
  './assets/icons/back.svg',
  './assets/icons/chevron-down.svg',
  './assets/icons/refresh.svg',
  './assets/icons/swap-circular.svg',
  './assets/icons/bolt.svg',
  './assets/icons/gear.svg',
  './assets/icons/install.svg',
  './assets/icons/open-app.svg',
  './assets/icons/info.svg',
  './assets/icons/copy.svg',
  './assets/icons/download.svg',
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
