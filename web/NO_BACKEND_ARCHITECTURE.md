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

## On-chain message delivery

The PWA does not use manual signed JSON packages as the v1 delivery layer. Accepted messages are reconstructed from retrievable encrypted binary payload cells stored by `CapsuleHub`.

Public recipient keys are registered in `Vault` key records. Private key material is derived from the embedded Platho wallet seed; exporting/importing that seed is the only supported account recovery path.

Private capsule on-chain cells use the final binary layout in `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`: `PH0B` header0 is 140 bytes, `PH1B` header1 is 30 bytes, and each `platho.byte-layout.v1` body carries exactly one encrypted 1024-byte user payload slot for both standard and postquantum capsules.

The UI must not expose manual public-key bundle exchange, QR package sharing, raw package JSON paste, or encrypted-capsule file import/export as production flows.

## Wallet avatars

Avatars are also backend-free. The image bytes are compressed to WebP and published as public `CapsuleHub` avatar capsules. `ProfileRegistry` stores the paid wallet-level pointer and ATH accounting state. The PWA may cache reconstructed data URLs locally, but display must remain reconstructable from `ProfileRegistry` getters plus `CapsuleHub` public entries. No CDN or profile API is part of v1 delivery.

## Local encrypted history

Message history is device-local and encrypted at rest with a non-extractable WebCrypto AES-GCM key stored in IndexedDB. If IndexedDB is unavailable, the PWA falls back to encrypted in-memory history for the current session instead of writing plaintext to a weaker persistent store.

The clear IndexedDB record keeps only query metadata such as record id, thread id, timestamp, direction, and optional capsule id. Message text, UI meta, and capsule payload references live inside the authenticated ciphertext. Editing the clear metadata or ciphertext makes decryption fail.

## Vault chain reads

Production key trust must be anchored to Vault contract state, not to a local UI claim. The static runtime includes `vault-ton-rpc-provider.mjs`, a backend-free provider skeleton for TON `runGetMethod` transports:

- `get_user(owner)` is called with the owner wallet encoded as a TON address slice BoC.
- `get_key_record(current_key_id)` is called with the current key id returned by Vault.
- Returned stack values are decoded into the same `VaultUserView` and `VaultKeyRecordView` shapes used by the client verifier.

The provider can use a configured `globalThis.plathoTonRpcTransport` or a TON Center v3 compatible endpoint. If the transport, Vault address, getter response, or record binding is missing or malformed, the PWA stays fail-closed.

## TON DNS recipient lookup

`.ton` recipient routes are resolved in the static PWA before Vault key lookup. The runtime includes `ton-dns-provider.mjs`, which calls TON DNS `dnsresolve` through the same replaceable TON `runGetMethod` transport model:

- domain names are normalized to lowercase `.ton` and encoded in TON DNS internal order;
- the wallet category is `sha256("wallet")`;
- `dns_smc_address#9fd3` records resolve to the recipient wallet address;
- `dns_next_resolver#ba93` records are followed with a bounded recursion limit.

If the TON DNS root address, transport, resolver response, or wallet record is missing or malformed, the PWA stays fail-closed and does not send a message.

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

Runtime mode, network labels, embedded Platho wallet policy, Vault provider lookup, TON DNS lookup, and preview fixtures live in `web/platho-config.mjs`. A production bundle must replace that file with `mode: 'production'`, `network.chain: 'mainnet'`, static provider modules or root addresses, and final contract addresses before the release gate can pass.
