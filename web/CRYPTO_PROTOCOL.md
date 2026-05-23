# Platho message crypto protocol

This document describes the client-side message encryption implemented by the static PWA prototype.

## Suites

| Suite | Contract value | Purpose |
| --- | ---: | --- |
| `classical-v1` | `1` | Standard private messages using X25519 plus AES-GCM. |
| `hybrid-v1` | `2` | Long-term private messages using X25519 plus ML-KEM-768 plus AES-GCM. |

The contract values match `CRYPTO_SUITE_CLASSICAL = 1` and `CRYPTO_SUITE_HYBRID = 2` in `contracts/Vault.tact`.

## Key bundles

Every embedded Platho wallet seed deterministically derives a messaging identity with an encryption key pair and an Ed25519 signing key. The public encryption key material is exported as a public key bundle:

- `keyId`: SHA-256 based identifier over the public key material.
- `x25519PublicKey`: 32-byte classical ECDH public key.
- `mlKem768PublicKey`: 1184-byte ML-KEM-768 public key for `hybrid-v1`.
- `mlKem768PublicKeyHash`: SHA-256 of the ML-KEM-768 public key.
- `mlKem768PublicKeyLen`: always `1184` for `hybrid-v1`.

The PWA recomputes `keyId`, `mlKem768PublicKeyHash`, and `mlKem768PublicKeyLen` before encryption. A bundle that claims a mismatched id, suite, contract suite, hash, or length is rejected.

Classical recipient lookup is fully defined by the on-chain `enc_pubkey` and `sign_pubkey`. Hybrid recipient lookup is defined by those fields plus the full on-chain `pq_kem_pubkey` cell stored in the active Vault key record. The hash and length remain in the record as compact binding fields, but the full ML-KEM-768 public key is what lets another client actually encrypt a `hybrid-v1` capsule.

## Signed bundles

The PWA can export a signed public key bundle. The signed payload includes:

- protocol domain `PLATHO.MESSAGING.KEY_BUNDLE.SIGNATURE.V1`;
- issue and optional expiry timestamps;
- optional owner wallet and Vault address placeholders;
- the public encryption bundle;
- the 32-byte Ed25519 signing public key.

The signature covers the stable JSON payload and is verified before the bundle is trusted. This prevents silent local bundle tampering and gives the client the exact `sign_pubkey` that Vault stores in `KeyRecord`.

The PWA `keyId` is a client bundle identifier. It does not replace the Vault contract's `current_key_id`, which is computed on-chain from owner address, key generation, signing key, encryption key, PQ hash, PQ length, and crypto suite. A production client must verify the bundle against the Vault key record before trusting it for a wallet identity.

The signed bundle is a messaging-key self-signature. Wallet ownership is anchored by Vault activation: the embedded Platho wallet sends `RegisterMessagingKeys`/`ReplaceMessagingKeys`, and recipients verify the signed bundle against the active on-chain key record for that wallet.

## Wallet ownership

The production PWA does not use an external wallet connector. A user creates or imports an embedded Platho wallet seed, and the PWA
deterministically derives both the TON wallet key and the messaging encryption/signing keys from that seed. Vault
activation is the ownership anchor: the embedded wallet signs and sends `RegisterMessagingKeys` or `ReplaceMessagingKeys`
from the same wallet that owns the on-chain key record.

Recipients trust a messaging bundle only after checking it against the active Vault key record for that wallet:

- the record owner is the expected wallet;
- `enc_pubkey` and `sign_pubkey` match the signed bundle;
- hybrid records expose the full `pq_kem_pubkey` cell, not only its hash;
- the decoded ML-KEM-768 key bytes hash to `pq_kem_pubkey_hash`;
- the active `current_key_id` points at the verified key record.

The profile export/import flow handles the embedded wallet seed. There is no separate messaging key backup and no
external wallet connection mode in final v1.

## Compact byte layout

Private capsule on-chain cells use the final `platho.byte-layout.v1` binary layout. The PWA may wrap capsules in JSON for export/share UI, but the cells stored by `CapsuleHub` are binary bytes, not JSON and not an off-chain pointer.

Every publish goes through Vault as a wallet-funded message. The embedded Platho wallet pays the canonical Vault publish
charge directly, so there is no separate prepaid publish layer. Multi-segment text and image sends are just
multiple wallet-funded capsule publishes in one wallet transaction when the wallet has enough TON. If the wallet is not
available, the PWA stays in preview-only single-capsule mode and must not expose attachments.

PWA message pricing is per capsule. `classical-v1` has a base price of `0.010 TON`; `hybrid-v1` has a base price of
`0.020 TON`. Both include `0.005 TON` of estimated network cost. If the PWA's conservative fee estimate is higher, it
adds `ceil((estimate - 0.005 TON) / 0.001 TON) * 0.001 TON` as a surcharge. Contract calls still start from their
canonical required values: Vault publishes send `maxCharge = canonical_max_charge + surcharge`. CapsuleHub has no direct
user publish ABI in final v1; every publish is Vault -> CapsuleHub so ATH discounts apply.

Public posts and comments are a separate open profile, not private capsules without encryption. They store a compact
`PPH1` public header cell plus a raw public body cell. Public body text is `1..1024` UTF-8 bytes for both posts and
comments; public image bodies are `1..1024` compressed media bytes per part. Header metadata never reduces the user's
1024-byte body budget. Public posts have no postquantum option; their base price is `0.010 TON` plus the same
network-fee surcharge rule. `kind = 1` is a public post; post `flags` bit 0 closes comments for that post. `kind = 2` is
a one-level public comment with `parent_entry_id:uint64` and `parent_body_hash:uint256` in the header. `kind = 3` is a
public image post, `kind = 4` is a public image comment, and `kind = 5` is public wallet avatar media. Public headers also carry `stream_id:uint128`,
`part_index:uint16`, `part_count:uint16`, and `media_format:u8`; public v1 uses `media_format = 0` for text and
`media_format = 1` for WebP image/avatar parts. Public post, image post, and avatar headers also carry
`profile_version:uint32` and `avatar_hash:uint256`; zero means no avatar pointer. Long public text or image data is reconstructed from multiple 1024-byte entries
without reducing the useful body budget. The official PWA compresses selected images to WebP targets of 8 KiB
(`low`), 16 KiB (`medium`), 32 KiB (`good`, default), or 64 KiB (`maximum`) before splitting. There is no edit/delete/reaction/moderation or counter layer in v1.

Wallet avatars are paid profile updates, not off-chain assets. The avatar bytes are published as `kind = 5` public
CapsuleHub entries, then `ProfileRegistry` records the authenticated wallet pointer:
`version`, `avatar_hash`, first `avatar_entry_id`, `avatar_stream_id`, `avatar_part_count`, and `media_format`. Readers
resolve the profile pointer from the signed private header or public post header, verify the matching ProfileRegistry
record, fetch the avatar public entries from CapsuleHub, concatenate parts in index order, and require the reconstructed
WebP bytes to hash to `avatar_hash`. Local avatar cache is only a speed-up; the source of truth is CapsuleHub plus
ProfileRegistry.

`header0_cell` stores exactly 140 bytes:

```text
PH0B
|| version:u8
|| publish_kind:u8
|| size_class:u8
|| crypto_suite:u8
|| sender_key_id:32 bytes
|| recipient_key_id:32 bytes
|| sender_sign_pubkey:32 bytes
|| profile_version:uint32
|| avatar_hash:uint256
```

`header1_cell` stores exactly 30 bytes:

```text
PH1B
|| version:u8
|| flags:u8 = 0
|| created_at_s:u32
|| expires_at_s:u32
|| client_nonce:16 bytes
```

`size_class + crypto_suite` imply the suite. `profile_version` and `avatar_hash` point to the sender wallet avatar at
send time and are covered by the header hash plus sender signature. `recipient_sign_pubkey` and thread hashes are
intentionally not stored in public header cells. Thread/grouping data belongs inside encrypted capsule metadata.

Each encrypted body is assembled as:

```text
PLB1 || version:u8 || suite:u8 || flags:u8 || reserved:u8
     || message_id:u128
     || aes_gcm_nonce:12 bytes
     || x25519_ephemeral_public:32 bytes
     || ml_kem_768_ciphertext:1088 bytes, only for hybrid-v1
     || aes_gcm_ciphertext_and_tag
```

The AES-GCM plaintext is one fixed capsule slot:

```text
PCP1
|| version:u8
|| kind:u8
|| flags:u8
|| media_format:u8
|| stream_id:u128
|| part_index:u16
|| part_count:u16
|| content_len:u16
|| reserved:u16
|| payload[1024]
```

The useful content area is exactly 1024 bytes per capsule. A message with 1 byte, 500 bytes, or 1024 bytes of useful text has the same encrypted plaintext size. Messages above 1024 useful bytes are split into multiple capsules with encrypted `stream_id`, `part_index`, and `part_count` metadata. One capsule never contains more than one 1024-byte useful payload slot.

Content kinds:

- `1` text: UTF-8 bytes, up to 1024 useful bytes per capsule.
- `2` image: compressed image bytes; `media_format` is `1` WebP, `2` AVIF, `3` JPEG, or `4` PNG.
- `3` payment check: `asset:u8 || reserved:u8 || amount:u128 || intent_id:uint256 || secret32:uint256`.

Payment check bodies intentionally do not include `tx`, activation time, or expiry. The receiver claims by `intent_id + secret32`; if the sender already cancelled the check or it was already claimed, the UI says that the check was already claimed or cancelled by the sender.

The encrypted body may be wrapped for export/share as:

```text
PLC1 || version:u8 || suite:u8 || chunk_index:u8 || chunk_total:u8 || message_id:u128 || body_slice
```

For the final one-slot capsule, `chunk_total` is always `1`. `PLC1` is package/export framing only. `CapsuleHub.body` stores the assembled `PLB1` body bytes in a snake cell.

Final v1 private limits:

| Suite | Useful cap per capsule | Body bytes | Export chunk bytes |
| --- | ---: | ---: | ---: |
| `classical-v1` | 1024 bytes | 1,140 bytes | 1,164 bytes |
| `hybrid-v1` | 1024 bytes | 2,228 bytes | 2,252 bytes |

The canonical source for this layout is `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`.

AES-GCM uses a 12-byte nonce and a 16-byte tag. The ciphertext length equals plaintext length plus the tag.

The compact body prefix, `header0Hash`, and `header1Hash` are passed as AES-GCM additional authenticated data. Changing binary routing headers, suite, nonce, KEM ciphertext, chunk bytes, or sender signature makes verification or decryption fail.

Before decryption the client also checks:

- compact body suite matches `header0`;
- recipient key id matches `header0.recipientKeyId`;
- `classical-v1` bodies do not carry ML-KEM ciphertext;
- `hybrid-v1` bodies do carry a 1088-byte ML-KEM ciphertext;
- every chunk has the same suite, message id, and chunk total.

## Key derivation

For `classical-v1`:

```text
x25519_secret = X25519(sender_ephemeral_secret, recipient_x25519_public)
message_key   = HKDF-SHA-256(x25519_secret, compact_aad_hash)
```

For `hybrid-v1`:

```text
x25519_secret = X25519(sender_ephemeral_secret, recipient_x25519_public)
mlkem_secret  = ML-KEM-768.Encapsulate(recipient_mlkem_public)
message_key   = HKDF-SHA-256(x25519_secret || mlkem_secret, compact_aad_hash)
```

The plaintext is encrypted with AES-256-GCM.

The implementation rejects all-zero X25519 shared secrets to avoid accepting low-order public keys.

## Private encrypted capsules

The client wraps compact encrypted bodies in a private capsule before publication. A private capsule has:

- `header0`: the 140-byte `PH0B` binary routing header described above.
- `header1`: the 30-byte `PH1B` binary replay header described above.
- `body`: `platho.byte-layout.v1` chunk metadata plus base64url-encoded binary chunks.
- `hashes`: TON `Cell.hash()` values for the exact on-chain cells that contain `header0`, `header1`, and the encrypted body bytes.
- `chainCells`: base64 BOC payloads using `ton-snake-byte-cell.v1`; these are the cells stored by `CapsuleHub`, not an off-chain pointer.
- `senderSignature`: Ed25519 signature over the capsule id and all three hashes.

For `hybrid-v1`, the capsule uses CapsuleHub's long-term pair:

```text
size_class   = 2
crypto_suite = 2
```

The publication draft maps directly to `PublishPrivateFromVault`:

```text
header_0_hash = Cell.hash(header_0_cell)
header_1_hash = Cell.hash(header_1_cell)
body_hash     = Cell.hash(body_cell)
header_0_cell = snake-cell(header0 bytes)
header_1_cell = snake-cell(header1 bytes)
body_cell     = snake-cell(compact encrypted body bytes)
```

Vault publish messages carry `protocol_fee_paid`, because Vault is the discount authority for ATH-backed pricing.

The useful payload capacity is the capacity of the encrypted body bytes that are actually serialized into `body_cell` and accepted by `CapsuleHub`. A hash without the matching persisted cell is not a published message. Local history is cache only; it does not define delivery in v1.

For Vault external session signing, the hashes-ref order remains contract-compatible:

```text
body_hash || header_0_hash || header_1_hash
```

The compact body is bound to `header0Hash` and `header1Hash` through AES-GCM AAD. Replacing headers, body chunks, suite metadata, sender signature, capsule context, or the BOC payload cells makes verification fail before the message is accepted.

## Delivery source of truth

Accepted v1 private messages are the encrypted payload cells stored by `CapsuleHub`. The production PWA does not expose manual public-bundle or encrypted-capsule JSON package exchange.

Public messaging keys are registered in `Vault` key records. A sender must resolve and verify the recipient key record before encrypting a private capsule. Local encrypted history is a device cache only; it does not define delivery.

The embedded Platho wallet seed is the single user secret. The PWA deterministically derives the TON wallet key and the messaging encryption/signing keys from that seed. The profile export/import flow therefore handles only the wallet seed; there is no separate messaging-key backup.

## Replay and expiry policy

Private capsules default to a 24-hour TTL and are capped at 30 days. The verifier rejects:

- capsules created too far in the future;
- expired capsules;
- TTLs above the policy cap;
- duplicated capsule ids in the caller-provided replay cache.

The replay cache is local state; production clients can back it with IndexedDB or another device-local store. No backend is required.

## No-backend rule

The encryption layer does not require a Platho backend. A server may host static files, but delivered messages must remain reconstructable from `CapsuleHub` chain state and the server never receives plaintext, private keys, or a server-side session secret.

## Vault registration draft

The client can derive a `RegisterMessagingKeys` draft from a verified signed bundle:

- `enc_pubkey`: 32-byte X25519 public key as uint256.
- `sign_pubkey`: 32-byte Ed25519 signing public key as uint256.
- `pq_kem_pubkey_hash`: SHA-256 of the ML-KEM-768 public key for `hybrid-v1`, otherwise zero.
- `pq_kem_pubkey_len`: `1184` for `hybrid-v1`, otherwise zero.
- `pq_kem_pubkey`: canonical snake-cell containing exactly 1184 ML-KEM-768 public-key bytes for `hybrid-v1`, otherwise an empty cell.
- `crypto_suite_mask`: `1` for `classical-v1`, `2` for `hybrid-v1`.

This draft is submitted by the embedded Platho wallet activation flow. Once the wallet is activated in Vault, other activated users can resolve its public messaging key record and encrypt private capsules to it.

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

- `owner_wallet` matches the embedded Platho wallet address;
- `enc_pubkey` matches the X25519 public key;
- `sign_pubkey` matches the bundle signing public key;
- `pq_kem_pubkey`, `pq_kem_pubkey_hash`, and `pq_kem_pubkey_len` match the ML-KEM-768 material;
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

The prototype currently proves message encryption, signed bundle validation, encrypted local message history, embedded Platho wallet derivation, local Vault registration draft generation, fail-closed Vault chain binding, Vault key-record field binding, private capsule hashing, sender signatures, durable replay storage, wallet seed export/import, and replay checks. Before production private messaging, the client still needs production Vault provider configuration, key rotation UI, and external cryptographic review.
