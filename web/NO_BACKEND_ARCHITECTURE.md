# Platho PWA no-backend contract

This prototype is designed around a hard constraint: the app must keep working without a proprietary backend.

## Allowed runtime dependencies

- Static app files: HTML, CSS, JavaScript, manifest, service worker, icons.
- User-controlled wallet connection.
- Public TON RPC endpoints chosen or replaceable by the user.
- Smart contracts as the shared state and settlement layer.
- Local device storage for drafts, UI state, cached messages, and key material that never leaves the device unencrypted.
- Optional static mirrors for the same immutable app bundle.

## Not allowed

- Central API server required for login, profile lookup, message delivery, audit status, or buyback execution.
- Hidden telemetry endpoints.
- Server-side sessions.
- Server-side private key custody.
- Push-only workflows that stop working when one domain, cloud account, or vendor is blocked.

## Product rules

- The first screen must be the usable messenger, not a landing page.
- Identity should be wallet/account based, with local aliases as convenience only.
- Sensitive content must be encrypted before it touches any transport or shared storage.
- Any public or auditable state should be reconstructable from contracts and signed events.
- If a feature cannot be implemented without a centralized backend, it should be marked as blocked instead of quietly adding one.

## Portable transport

The PWA can exchange data through signed JSON packages instead of a backend:

- `platho.public-bundle.v1` carries a signed public messaging bundle. Import verifies the key id, suite, bundle signature, and expiry before trusting it for encryption.
- `platho.private-capsule.v1` carries a private encrypted capsule. Import verifies capsule hashes, sender signature, expiry, and replay policy before local decryption.

These packages can move through files, QR, local messenger attachment, IPFS, TON Storage, or any other replaceable carrier. Persistent local transport state stores only public bundles, encrypted capsules, and routing metadata. Plaintext is shown in memory after decryption and is not written into the transport store.

The UI supports several backend-free carriers:

- QR for packages small enough to fit QR capacity, primarily public key bundles.
- Clipboard/Web Share for public bundles and encrypted capsules.
- File import/export for larger capsules and devices without Web Share support.
- Text paste import for raw package JSON.

## Local encrypted history

Message history is device-local and encrypted at rest with a non-extractable WebCrypto AES-GCM key stored in IndexedDB. If IndexedDB is unavailable, the PWA falls back to encrypted in-memory history for the current session instead of writing plaintext to a weaker persistent store.

The clear IndexedDB record keeps only query metadata such as record id, thread id, timestamp, direction, and optional capsule id. Message text, UI meta, and capsule payload references live inside the authenticated ciphertext. Editing the clear metadata or ciphertext makes decryption fail.

## Vault chain reads

Production key trust must be anchored to Vault contract state, not to a local UI claim. The static runtime includes `vault-ton-rpc-provider.mjs`, a backend-free provider skeleton for TON `runGetMethod` transports:

- `get_user(owner)` is called with the owner wallet encoded as a TON address slice BoC.
- `get_key_record(current_key_id)` is called with the current key id returned by Vault.
- Returned stack values are decoded into the same `VaultUserView` and `VaultKeyRecordView` shapes used by the client verifier.

The provider can use a configured `globalThis.plathoTonRpcTransport` or a TON Center v3 compatible endpoint. If the transport, Vault address, getter response, or record binding is missing or malformed, the PWA stays fail-closed.

## Distribution model

The preferred production shape is a static bundle that can be hosted in several places at once:

- conventional static hosting for easy access;
- IPFS or similar content-addressed mirrors;
- TON Storage or another TON-native mirror when ready;
- direct downloadable bundle for sideloading as a PWA.

Telegram Mini App can be an entry point, but the PWA must remain independently usable because Telegram itself is a platform dependency.

## Static deploy package

Use `npm.cmd run web:deploy:prepare` to build a preview static bundle from the runtime files only. The package excludes local docs, preview screenshots, and the local development server.

Use `npm.cmd run web:deploy:prepare:prod` only after `npm.cmd run preprod:check` passes. The production package intentionally blocks while testnet labels, testnet env files, or missing Vault provider configuration remain in the workspace.

Runtime mode, network labels, TonConnect manifest policy, Vault provider lookup, and preview fixtures live in `web/platho-config.mjs`. A production bundle must replace that file with `mode: 'production'`, `network.chain: 'mainnet'`, and a static Vault chain provider module before the release gate can pass.
