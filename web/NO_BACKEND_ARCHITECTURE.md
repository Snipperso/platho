# Platho PWA no-backend contract

This prototype is designed around a hard constraint: the app must keep working without a proprietary backend.

## Allowed runtime dependencies

- Static app files: HTML, CSS, JavaScript, manifest, service worker, icons.
- An embedded wallet derived from the user's own recovery phrase. There is no external wallet connector.
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

The PWA does not use manual signed JSON packages as the v1 delivery layer. Accepted messages are reconstructed from accepted publish transaction bodies and authenticated by the compact shard entry state (body hash, header hash, entry id, and contract `created_at`).

Delivery is sharded and direct-paid. A publish is an external message signed by the user's own wallet key and sent straight to the target shard account; there is no internal balance, no discount authority, no relayer, and no issuer anywhere in the path. Each lane has its own contract, and every address is a pure function of data the client already holds, so a reader needs no directory and no index:

- `RecordShard(bucket_key, epoch)` — one direction of one conversation for one day.
- `IntroShard(epoch, bucket)` — first contact, in a sender-chosen bucket the recipient scans.
- `RecoveryShard(self_bucket_key)` — the user's own slots, epoch-independent.
- `PublicShard(kind, coordinates)` — channels, threads, beacons, and avatar media.

Public recipient keys live in the wallet's own `KeyShard` account, whose address is derived from that wallet address, so a record can only ever hold keys that wallet registered. Private key material is derived from the user's 24-word recovery phrase; exporting/importing that phrase is the only supported account recovery path.

Private capsule publish bodies use the binary layout specified in `web/CRYPTO_PROTOCOL.md`: `PH0C` header0 is 40 bytes on the CONV lane and 42 bytes on the INTRO lane, `PH1B` header1 is 30 bytes, and each `platho.byte-layout.v1` body carries exactly one encrypted user payload slot selected from the 1, 2, 4, 8, 16, or 32 KiB hybrid size classes. A shard stores the compact authenticated entry state and the `body_hash`, not the heavy encrypted body cell; the PWA retrieves that body through replaceable TON message-history providers and verifies it against the stored hashes before decrypting.

The UI must not expose manual public-key bundle exchange, QR package sharing, raw package JSON paste, or encrypted-capsule file import/export as production flows.

## Wallet avatars

Avatars are also backend-free. The image bytes are compressed to WebP and published as `kind = 5` entries in the `AVATAR` domain of `PublicShard`. The authoritative pointer lives in the owner's `KeyShard`; `ProfileRegistry` prices and settles the ATH charge and is not the pointer's source of truth. The PWA may cache reconstructed data URLs locally, but display must verify the reconstructed bytes against the recorded avatar hash. If the public entry body is pruned, missing from RPC history, or absent from local cache, the avatar is unavailable rather than trusted from an unverified source. No CDN or profile API is part of v1 delivery.

On-chain avatar registration is an owner-signed pointer trust model. The contracts validate ownership, payment, media format, part count, and pointer shape, but they do not re-read public entries or reassemble media bytes on-chain. The production PWA therefore must refuse to sign avatar registration until the owner's public entries are visible, all declared parts are present in one stream, and the assembled WebP SHA-256 equals the registered `avatarHash`. Reusing an already-published identical avatar is an explicit recovery path, not proof that a fresh publish was accepted.

There are two independent readers of that pointer. Both must be updated together when the record layout changes; updating one leaves the other reading a field that no longer exists, and it fails silently.

## Local encrypted history

Message history is device-local and encrypted at rest with a non-extractable WebCrypto AES-GCM key stored in IndexedDB. If IndexedDB is unavailable, the PWA falls back to encrypted in-memory history for the current session instead of writing plaintext to a weaker persistent store.

The clear IndexedDB record keeps only query metadata such as record id, thread id, timestamp, direction, and optional capsule id. Message text, UI meta, and capsule payload references live inside the authenticated ciphertext. Editing the clear metadata or ciphertext makes decryption fail.

## KeyShard chain reads

Production key trust must be anchored to contract state, not to a local UI claim. The static runtime includes `ton-rpc-transport.mjs`, a backend-free provider skeleton for TON `runGetMethod` transports, and `key-shard-ton-rpc-provider.mjs` on top of it:

- the account address is derived locally from the owner wallet — there is no lookup that could return someone else's record;
- the record is read from that one account and decoded into the view the client verifier consumes;
- `keyId` is recomputed from `enc_pubkey` and the ML-KEM public-key hash and must equal the id being resolved.

The provider can use a configured `globalThis.plathoTonRpcTransport` or TON Center v3 compatible endpoints. If the transport, the derived address, the getter response, or the record binding is missing or malformed, the PWA stays fail-closed and does not encrypt to an unverified key.

## Censorship survival mode

The static bundle must keep working if one RPC host is blocked by a network operator or state.

Reads go through toncenter. Cross-provider verification of every critical read was removed: it made each critical read wait for a second provider, which was the actual source of the send latency once blamed on the slower provider. A second provider that performs no reads does not reproduce that cost and does not buy back that assurance either — so the honest statement is that reads are single-source and the client compensates by treating one bad read as transient rather than as truth.

Broadcast has three keyless entry points — toncenter, tonapi, and tonhub v4, all verified to accept an anonymous `sendBoc`. A retry knocks on the *next* door rather than the same one, so a single blocked or rate-limiting host cannot silence a send. A new host must also be added to the CSP, or the door is closed before it is opened.

Rate limiting is answered with a ladder of 2/5/15/40/60 seconds that resets on the first success. A flat aggressive retry turned one incidental 429 into a minute of silence, because the limiter's bucket is per second and per IP.

All outgoing sends share one request queue. A second queue means parallel connections, which freezes low-end devices; the invariant is gated rather than left to convention.

A `200` from an endpoint means *queued*, not *executed*. A send is green only once the capsule is visible on chain.

## TON DNS recipient lookup

`.ton` recipient routes are resolved in the static PWA before the KeyShard key lookup. The runtime includes `ton-dns-provider.mjs`, which calls TON DNS `dnsresolve` through the same replaceable TON `runGetMethod` transport model:

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

Use `npm.cmd run web:deploy:prepare:prod` only after `npm.cmd run preprod:check` passes. The production package intentionally blocks while testnet labels, testnet env files, or missing provider configuration remain in the workspace.

Runtime mode, network labels, embedded Platho wallet policy, shard and registry addresses, TON DNS lookup, and preview fixtures live in `web/platho-config.mjs`. A production bundle must replace that file with `mode: 'production'`, `network.chain: 'mainnet'`, static provider modules or root addresses, and final contract addresses before the release gate can pass.
