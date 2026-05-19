# Platho message crypto protocol

This document describes the client-side message encryption implemented by the static PWA prototype.

## Suites

| Suite | Contract value | Purpose |
| --- | ---: | --- |
| `classical-v1` | `1` | Standard private messages using X25519 plus AES-GCM. |
| `hybrid-v1` | `2` | Long-term private messages using X25519 plus ML-KEM-768 plus AES-GCM. |

The contract values match `CRYPTO_SUITE_CLASSICAL = 1` and `CRYPTO_SUITE_HYBRID = 2` in `contracts/Vault.tact`.

## Key bundles

Every device has a messaging identity with an encryption key pair and an Ed25519 signing key. The public encryption key material is exported as a public key bundle:

- `keyId`: SHA-256 based identifier over the public key material.
- `x25519PublicKey`: 32-byte classical ECDH public key.
- `mlKem768PublicKey`: 1184-byte ML-KEM-768 public key for `hybrid-v1`.
- `mlKem768PublicKeyHash`: SHA-256 of the ML-KEM-768 public key.
- `mlKem768PublicKeyLen`: always `1184` for `hybrid-v1`.

The PWA recomputes `keyId`, `mlKem768PublicKeyHash`, and `mlKem768PublicKeyLen` before encryption. A bundle that claims a mismatched id, suite, contract suite, hash, or length is rejected.

Only hashes and lengths need to be registered on-chain. The full ML-KEM public key can be distributed through the client bundle, QR exchange, IPFS, TON Storage, or another replaceable static mirror.

## Signed bundles

The PWA can export a signed public key bundle. The signed payload includes:

- protocol domain `PLATHO.MESSAGING.KEY_BUNDLE.SIGNATURE.V1`;
- issue and optional expiry timestamps;
- optional owner wallet and Vault address placeholders;
- the public encryption bundle;
- the 32-byte Ed25519 signing public key.

The signature covers the stable JSON payload and is verified before the bundle is trusted. This prevents silent local bundle tampering and gives the client the exact `sign_pubkey` that Vault stores in `KeyRecord`.

The PWA `keyId` is a client bundle identifier. It does not replace the Vault contract's `current_key_id`, which is computed on-chain from owner address, key generation, signing key, encryption key, PQ hash, PQ length, and crypto suite. A production client must verify the bundle against the Vault key record before trusting it for a wallet identity.

The signed bundle is a messaging-key self-signature. It is then wrapped by an outer wallet ownership proof so a recipient can verify that a TON wallet endorsed this exact bundle.

## Wallet ownership proof

Wallet ownership uses TON Connect `ton_proof`; the old local Ed25519 preview helper is not part of the PWA flow anymore. The client creates a JSON payload string containing:

- protocol domain `PLATHO.WALLET.KEY_BUNDLE.OWNERSHIP.V1`;
- the signed bundle hash;
- the bundle `keyId`;
- optional Vault address;
- issue and expiry timestamps;
- a fresh nonce.

The wallet signs the standard TON Connect proof message:

```text
sha256(0xffff || "ton-connect" || sha256("ton-proof-item-v2/" || address || app_domain || timestamp || payload))
```

The verifier reconstructs this message, checks the Ed25519 signature, enforces the expected app domain, rejects stale proof timestamps, rejects expired payloads, and confirms that the payload's bundle hash and key id match the exact signed bundle.

The verifier accepts raw TON addresses and user-friendly base64/base64url addresses after CRC16-CCITT validation. The verifier is intentionally fail-closed unless the wallet public key is supplied by a verified source: parsed `walletStateInit`, an on-chain `get_public_key` lookup, or an explicit trusted test harness option.

The static PWA parses standard TON wallet `walletStateInit` BoCs in-browser. It verifies the StateInit root hash against the connected account address, compares the code hash with the official standard wallet code hashes, and extracts the Ed25519 public key with version-aware layouts:

- V1/V2: `seqno:uint32`, `public_key:uint256`;
- V3/V4: `seqno:uint32`, `wallet_id/subwallet_id:uint32`, `public_key:uint256`;
- V5R1: `is_signature_allowed:bool`, `seqno:uint32`, `wallet_id:uint32`, `public_key:uint256`.

Unsupported wallet code hashes are rejected rather than trusted. A future on-chain `get_public_key` fallback can expand compatibility for non-standard wallets without weakening this default.

## Envelope

Each encrypted message stores a JSON envelope:

- `version`: `1`.
- `suite`: `classical-v1` or `hybrid-v1`.
- `contractSuite`: `1` or `2`.
- `alg`: `X25519`, optional `ML-KEM-768`, `HKDF-SHA-256`, `AES-256-GCM`.
- `senderKeyId`, `recipientKeyId`.
- `nonce`: 12-byte AES-GCM nonce.
- `kem.x25519EphemeralPublicKey`: sender ephemeral X25519 public key.
- `kem.mlKem768Ciphertext`: 1088-byte ML-KEM ciphertext for `hybrid-v1`.
- `ciphertext`: AES-GCM ciphertext plus 128-bit tag.

The protected header is stable-JSON encoded and passed as AES-GCM additional authenticated data. Changing metadata such as `recipientKeyId`, suite, nonce, or KEM ciphertext makes decryption fail.

Before decryption the client also checks:

- envelope suite matches the recipient key pair;
- contract suite is canonical for the suite;
- algorithm labels are canonical for the suite;
- `classical-v1` envelopes do not carry ML-KEM ciphertext;
- `hybrid-v1` envelopes do carry ML-KEM ciphertext;
- `recipientKeyId` matches the recipient key pair.

## Key derivation

For `classical-v1`:

```text
x25519_secret = X25519(sender_ephemeral_secret, recipient_x25519_public)
message_key   = HKDF-SHA-256(x25519_secret, protected_header)
```

For `hybrid-v1`:

```text
x25519_secret = X25519(sender_ephemeral_secret, recipient_x25519_public)
mlkem_secret  = ML-KEM-768.Encapsulate(recipient_mlkem_public)
message_key   = HKDF-SHA-256(x25519_secret || mlkem_secret, protected_header)
```

The plaintext is encrypted with AES-256-GCM.

The implementation rejects all-zero X25519 shared secrets to avoid accepting low-order public keys.

## Private encrypted capsules

The client wraps encrypted envelopes in a private capsule before publication. A private capsule has:

- `header0`: routing and contract profile metadata: private publish kind, `sizeClass`, `cryptoSuite`, suite, sender key id, recipient key id, sender signing public key, recipient signing public key.
- `header1`: replay policy metadata: `createdAt`, `expiresAt`, `clientNonce`, optional thread id, and purpose.
- `body`: the encrypted message envelope.
- `hashes`: SHA-256 hashes for `header0`, `header1`, and `body`.
- `senderSignature`: Ed25519 signature over the capsule id and all three hashes.

For `hybrid-v1`, the capsule uses CapsuleHub's long-term pair:

```text
size_class   = 2
crypto_suite = 2
```

The publication draft maps directly to `PublishPrivateFromVault` / `PublishPrivateDirect`:

```text
header_0_hash = SHA-256(header0)
header_1_hash = SHA-256(header1)
body_hash     = SHA-256(body)
```

For Vault external session signing, the hashes-ref order remains contract-compatible:

```text
body_hash || header_0_hash || header_1_hash
```

The encrypted envelope is also bound to `header0Hash`, `header1Hash`, `clientNonce`, and thread id through AES-GCM AAD context. Replacing headers, body, suite metadata, sender signature, or capsule context makes verification fail before the message is accepted.

## No-backend transport packages

The static PWA wraps exchangeable crypto objects in portable JSON packages:

- `platho.public-bundle.v1`: a signed public key bundle plus redundant transport metadata. Import verifies the signed bundle and rejects key id or suite mismatches.
- `platho.private-capsule.v1`: an encrypted private capsule plus redundant routing metadata. Import verifies the capsule, rejects metadata mismatches, enforces expiry, and can use the local replay cache before decryption.

The package layer is deliberately carrier-agnostic. A user can move a package as a file, QR payload, messenger attachment, IPFS object, TON Storage object, or any other replaceable channel. The transport store persists packages and counters only; decrypted plaintext is not written to that store.

The QR/share UI is a carrier layer only. It serializes the exact transport JSON accepted by import, renders a QR only when the package fits QR capacity, and otherwise falls back to clipboard, Web Share, or file export. Large encrypted capsules are not truncated or silently converted into partial QR payloads.

## Replay and expiry policy

Private capsules default to a 24-hour TTL and are capped at 30 days. The verifier rejects:

- capsules created too far in the future;
- expired capsules;
- TTLs above the policy cap;
- duplicated capsule ids in the caller-provided replay cache.

The replay cache is local state; production clients can back it with IndexedDB or another device-local store. No backend is required.

## No-backend rule

The encryption layer does not require a Platho backend. A server may host static files or encrypted blobs, but it never receives plaintext, private keys, or a server-side session secret.

## Vault registration draft

The client can derive a `RegisterMessagingKeys` draft from a verified signed bundle:

- `enc_pubkey`: 32-byte X25519 public key as uint256.
- `sign_pubkey`: 32-byte Ed25519 signing public key as uint256.
- `pq_kem_pubkey_hash`: SHA-256 of the ML-KEM-768 public key for `hybrid-v1`, otherwise zero.
- `pq_kem_pubkey_len`: `1184` for `hybrid-v1`, otherwise zero.
- `crypto_suite_mask`: `1` for `classical-v1`, `2` for `hybrid-v1`.

This draft is not submitted by the static prototype yet; it is the deterministic payload the wallet flow will send to Vault once testnet funding is ready.

## Vault key record binding

After the wallet has registered keys on-chain, the client must fetch:

- the wallet `UserState.current_key_id`;
- the `VaultKeyRecordView` for that key id.

The PWA exposes this as a fail-closed provider bridge in `web/vault-chain-provider.mjs`. The bridge expects a provider with:

```js
{
  async getUser(ownerWallet) {},
  async getKeyRecord(currentKeyId) {},
}
```

If no provider is configured, Vault binding stays unavailable rather than accepting a local draft or UI placeholder. A production/static deployment can install a provider on `globalThis.plathoVaultChainProvider` that reads the deployed Vault through a TON API mirror or light-client compatible transport.

The static runtime includes `web/vault-ton-rpc-provider.mjs` as the production-provider skeleton. It can wrap a TON Center v3 compatible `runGetMethod` endpoint or a custom `globalThis.plathoTonRpcTransport`. The provider:

- encodes `get_user(owner)` owner addresses as `slice` BoC stack items;
- calls `get_key_record(current_key_id)` with a numeric stack item;
- decodes getter stacks into `VaultUserView` and `VaultKeyRecordView`;
- fails closed if the RPC transport, Vault address, getter response, or key-record binding is unavailable.

The client-side verifier checks that the active Vault record matches the verified signed bundle:

- `owner_wallet` matches the wallet proof;
- `enc_pubkey` matches the X25519 public key;
- `sign_pubkey` matches the bundle signing public key;
- `pq_kem_pubkey_hash` and `pq_kem_pubkey_len` match the ML-KEM-768 material;
- `crypto_suite_mask` matches the suite;
- `revoked_lt` is zero;
- optional `current_key_id` points to the fetched record id.

The client does not invent the on-chain key id. Vault computes it from owner address, key generation, key fields, PQ length, and suite. The client verifies the fetched record instead.

## Durable replay store

The PWA uses IndexedDB for private capsule replay protection when available, with a memory fallback. The store keeps capsule ids until their capsule expiry and prunes expired entries locally. This is device-local state and does not require a server.

## Encrypted local message history

The PWA also has a device-local encrypted message history store. It uses a non-extractable WebCrypto AES-GCM-256 key saved in IndexedDB and stores every message body as authenticated ciphertext. The record header keeps only local query metadata: id, thread id, timestamp, direction, and optional capsule id.

The header is bound as AES-GCM additional authenticated data. Changing thread id, timestamp, direction, capsule id, nonce, or ciphertext prevents the record from opening. If IndexedDB is unavailable, the app falls back to encrypted in-memory history for that session and avoids writing plaintext to persistent browser storage.

## Remaining production work

The prototype currently proves message encryption, signed bundle validation, no-backend public-bundle/capsule transport packages, encrypted local message history, TON Connect UI payload wiring, TON Connect proof payload/signature validation, standard TON wallet `walletStateInit` public-key/address verification, local Vault registration draft generation, fail-closed Vault chain binding, Vault key-record field binding, private capsule hashing, sender signatures, durable replay storage, and replay/expiry checks. Before production private messaging, the client still needs production Vault provider configuration, key rotation UI, history backup/recovery UX, optional on-chain public-key fallback for non-standard wallets, and external cryptographic review.
