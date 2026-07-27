# Platho PWA no-backend contract

This prototype is designed around a hard constraint: the app must keep working without a proprietary backend.

## Allowed runtime dependencies

- Static app files: HTML, CSS, JavaScript, manifest, service worker, icons.
- User-controlled wallet connection.
- Public TON RPC endpoints chosen by the production bundle or host integration. User-selectable RPC requires an explicit settings UI; the current static bundle treats custom transports as a host/config hook.
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
- Any public or auditable state should be verifiable from contracts and signed events. Heavy message bodies are recovered from TON transaction history and checked against contract hashes, so provider history coverage affects availability.
- If a feature cannot be implemented without a centralized backend, it should be marked as blocked instead of quietly adding one.

## On-chain message delivery

The PWA does not use manual signed JSON packages as the v1 delivery layer. Accepted messages are reconstructed from accepted Vault -> CapsuleHub publish transaction bodies, authenticated by the compact `CapsuleHub` entry state (`body_hash`, headers, `entry_id`, and contract `created_at`).

Public recipient keys are registered in `Vault` key records. Private key material is derived from the user's 24-word TON recovery phrase; exporting/importing that phrase is the only supported account recovery path.

Private capsule publish bodies use the final binary layout in `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`: `PH0B` header0 is 140 bytes, `PH1B` header1 is 30 bytes, and each `platho.byte-layout.v1` body carries exactly one encrypted user payload slot selected from the 1, 2, 4, 8, 16, or 32 KiB hybrid size classes. CapsuleHub stores the compact authenticated index/header state and body hash, not the heavy encrypted body cell; the PWA retrieves that body through replaceable TON message-history providers and verifies the hash before decrypting.

The UI must not expose manual public-key bundle exchange, QR package sharing, raw package JSON paste, or encrypted-capsule file import/export as production flows.

## Wallet avatars

Avatars are also backend-free. The image bytes are compressed to WebP and published as public `CapsuleHub` avatar capsules. `ProfileRegistry` stores the paid wallet-level pointer and ATH accounting state. The PWA may cache reconstructed data URLs locally, but display must verify the reconstructed bytes against the `ProfileRegistry` avatar hash. If the public capsule body is pruned, missing from RPC history, or absent from local cache, the avatar is unavailable rather than trusted from an unverified source. No CDN or profile API is part of v1 delivery.

The on-chain avatar registration is an owner-signed pointer trust model. `Vault`/`ProfileRegistry` validate ownership, payment route, media format, part count, and pointer shape, but they do not re-read `CapsuleHub` public entries or reassemble media bytes on-chain. The production PWA therefore must refuse to sign avatar registration until `CapsuleHub` entries for the owner are visible, all declared parts are present in one stream, and the assembled WebP SHA-256 equals the registered `avatarHash`. Reusing an already-published identical avatar is an explicit recovery path, not proof that a fresh public publish BOC was accepted.

## Local encrypted history

Message history is device-local and encrypted at rest with a non-extractable WebCrypto AES-GCM key stored in IndexedDB. If IndexedDB is unavailable, the PWA falls back to encrypted in-memory history for the current session instead of writing plaintext to a weaker persistent store.

The clear IndexedDB record keeps only query metadata such as record id, thread id, timestamp, direction, and optional capsule id. Message text, UI meta, and capsule payload references live inside the authenticated ciphertext. Editing the clear metadata or ciphertext makes decryption fail.

## Vault chain reads

Production key trust must be anchored to Vault contract state, not to a local UI claim. The static runtime includes `ton-rpc-transport.mjs`, a backend-free provider skeleton for TON `runGetMethod` transports:

- `get_user(owner)` is called with the owner wallet encoded as a TON address slice BoC.
- `get_key_record(current_key_id)` is called with the current key id returned by Vault.
- Returned stack values are decoded into the same `VaultUserView` and `VaultKeyRecordView` shapes used by the client verifier.

The provider can use a configured `globalThis.plathoTonRpcTransport` or TON Center v3 compatible endpoints. In production, critical reads require enough concrete configured providers for cross-checking; a missing host custom transport is not the same thing as a user-selected RPC. If the transport, Vault address, getter response, or record binding is missing or malformed, the PWA stays fail-closed.

## Censorship survival mode

The static bundle must keep working if the Platho RPC gateway host is blocked by a network operator or state. The production config therefore carries a keyless direct TonCenter provider that is verifier-only in normal operation and a full emergency fallback (reads, `sendBoc` broadcast, and message history) when every primary transport hard-fails. The transport layer parks a primary after repeated connectivity failures, routes traffic through the emergency provider at its ~1 rps public budget with strict request prioritization (send path before background sync), stretches background message sync intervals, and periodically re-probes the parked gateway so normal service resumes automatically. In this degraded single-provider mode dual-provider verification is structurally impossible: own-action pre-sign reads fall back to unverified reads behind an explicit degraded-transport gate, post-broadcast nonce polling is always unverified and tolerant, and publish confirmation continues through the Vault ACK history path. Recipient key-record trust gates keep their fail-closed verification requirements. Slow but alive beats fail-closed dead for the messenger itself; features that strictly require cross-checked reads degrade until the gateway returns.

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
