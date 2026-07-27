# Platho message crypto protocol

This document describes the client-side message encryption implemented by the Platho PWA.

## Encryption

Private messages use X25519 + ML-KEM-768 + AES-GCM — the single private-message suite (`hybrid-v1`, contract value `2`).

## Key bundles

Every 24-word GRAM recovery phrase created or imported by the PWA deterministically derives a messaging identity with an encryption key pair and an Ed25519 signing key. The public encryption key material is exported as a public key bundle:

- `keyId`: SHA-256 based identifier over the public key material.
- `x25519PublicKey`: 32-byte classical ECDH public key.
- `mlKem768PublicKey`: 1184-byte ML-KEM-768 public key for `hybrid-v1`.
- `mlKem768PublicKeyHash`: SHA-256 of the ML-KEM-768 public key.
- `mlKem768PublicKeyLen`: always `1184` for `hybrid-v1`.

The PWA recomputes `keyId`, `mlKem768PublicKeyHash`, and `mlKem768PublicKeyLen` before encryption. A bundle that claims a mismatched id, suite, contract suite, hash, or length is rejected.

Recipient lookup is defined by the on-chain `enc_pubkey`, `sign_pubkey`, and the full on-chain `pq_kem_pubkey` cell stored in the active Vault key record. The hash and length remain in the record as compact binding fields, but the full ML-KEM-768 public key is what lets another client actually encrypt a `hybrid-v1` capsule.

## Signed bundles

The PWA can export a signed public key bundle. The signed payload includes:

- protocol domain `PLATHO.MESSAGING.KEY_BUNDLE.SIGNATURE.V1`;
- issue and optional expiry timestamps;
- optional owner wallet and Vault address placeholders;
- the public encryption bundle;
- the 32-byte Ed25519 signing public key.

The signature covers the stable JSON payload and is verified before the bundle is trusted. This prevents silent local bundle tampering and gives the client the exact `sign_pubkey` that Vault stores in `KeyRecord`.

The PWA `keyId` is a client bundle identifier. It does not replace the Vault contract's `current_key_id`, which is computed on-chain from owner address, key generation, signing key, encryption key, PQ hash, PQ length, and crypto suite. A production client must verify the bundle against the Vault key record before trusting it for a wallet identity.

The signed bundle is a messaging-key self-signature. Wallet ownership is anchored by Vault activation: the embedded Platho wallet sends `RegisterMessagingKeys`, later `ReplaceMessagingKeys` rotations are Vault-auth-signed external messages, and recipients verify the signed bundle against the active on-chain key record for that wallet.

## Wallet ownership

The production PWA does not use an external wallet connector. A user creates or imports a normal 24-word GRAM recovery phrase, and the PWA
deterministically derives the GRAM wallet key, a separate Vault auth key, and the messaging encryption/signing keys from that phrase. Vault
activation is the ownership anchor: the embedded wallet signs and sends `RegisterMessagingKeys` from the same wallet that owns the on-chain key record.
`ReplaceMessagingKeys` rotates only the public receive/messaging key record; it does not rotate the Vault auth key.

Recipients trust a messaging bundle only after checking it against the active Vault key record for that wallet:

- the record owner is the expected wallet;
- `enc_pubkey` and `sign_pubkey` match the signed bundle;
- hybrid records expose the full `pq_kem_pubkey` cell, not only its hash;
- the decoded ML-KEM-768 key bytes hash to `pq_kem_pubkey_hash`;
- the active `current_key_id` points at the verified key record.

The profile export/import flow handles the 24-word GRAM recovery phrase. There is no separate messaging key backup and no
external wallet connection mode.

## Compact byte layout

Private capsule on-chain cells use the final `platho.byte-layout.v1` binary layout. The PWA may wrap capsules in JSON for export/share UI, but the protocol payload is binary bytes, not JSON and not an off-chain pointer. `CapsuleHub` stores compact authenticated headers/indexes plus the body hash; the encrypted body cell stays in the accepted publish transaction body and is reconstructed from TON message history, then verified against the stored hashes.

Every publish goes through Vault as a Vault-balance funded signed external message. The user first funds their internal
Vault GRAM balance, then the PWA signs a publish request with the active `auth_pubkey`; a relayer can submit the
external message without holding the wallet key or the messaging signing key. The signed payload is domain-separated with `VPB1`,
`deployment_manifest_hash`, the target Vault address, and the publish kind before owner, nonce, max charge, and payload.
The GRAM value that CapsuleHub actually sends back in an ACK or bounce is credited to the user's internal Vault GRAM
balance, capped by the tracked pending publish refund amount. If the Vault balance or chain access is not available, the
PWA fails closed and must not expose publish actions.

Because `auth_pubkey` authorizes Vault-balance spending, compromising the local messaging signing key alone does not authorize
Vault publish, payment-check, username, or avatar actions. A messaging signing-key compromise can still affect message-level
identity signatures, so key replacement revokes the old public receive key record for future inbound encryption checks.

PWA message pricing is per capsule. With current reserves and no ATH discount, exact canonical examples are 1 KiB public entries from `0.0337 GRAM` and `hybrid-v1` 1 KiB private
capsules from `0.0347 GRAM`; larger public or private size classes cost more by canonical class. This includes the full
Platho protocol fee of `0.01 GRAM`, CapsuleHub compact-index storage endowment, Vault local execution reserve, and the
expected ACK refund. Separately, if the PWA's conservative fee estimate is higher than the included network-fee
allowance of `0.005 GRAM`, it adds
the rounded overage as a surcharge. Contract calls still start from their canonical
required values: Vault publishes send `maxCharge = canonical_max_charge + surcharge`. CapsuleHub has no direct user
publish ABI; every publish is Vault -> CapsuleHub. ATH discounts apply only after the Vault activity airdrop
has distributed 15,000,000 ATH; before that gate, message protocol fees use the full `0.01 GRAM` fee. The PWA must show the final
hold and net cost for the selected content size before signing.

The surcharge is a signed network/storage safety margin, not a refundable fee bucket. CapsuleHub accepts Vault publishes
when the attached value is at least the canonical required value, but a successful publish ACK returns only the fixed
publish ACK reserve of `30,000,000` nanotons (`0.030 GRAM`). After Vault processes that ACK, the user is credited roughly
`25,800,000` nanotons in internal Vault GRAM balance. Any signed surcharge above the canonical required value remains in
CapsuleHub as network/storage reserve overage; it is not returned to Vault and is not counted as
`accrued_plato_fee_ton`.

CapsuleHub protects raw GRAM reserve equal to `accrued_plato_fee_ton + max(100 GRAM, 1.25 * live_index_1y_storage_reserve)`.
The live reserve uses unpruned private/public entry counters rather than historical `latest_id` counters. A separate
permissionless `SweepExcessReserve` call can move only surplus above that protected amount to FeeAccumulator as
`DepositProtocolFee`, where it follows the normal treasury/buyback split. Ordinary message sending does not perform this
sweep. If that sweep deposit bounces, the returned amount is intentionally reclassified as backed
`accrued_plato_fee_ton` so it can be retried through the normal fee flush path.
Normal partial `FlushFees` calls must be at least the current public protocol fee (`0.010 GRAM`); a smaller amount is
valid only when it is the entire remaining accrued bucket, so discounted dust can still be finalized.

CapsuleHub records `created_at = now()` for every private and public entry. The PWA uses that contract timestamp for ordering and for bounded transaction-history lookup; client header timestamps remain authenticated payload metadata, not discovery authority. Compact entry metadata can be pruned permissionlessly after the configured one-year retention window, while body availability depends on the chosen TON provider's message-history coverage and the user's local encrypted cache.

Vault ATH balance is credited through explicit notify-flow accounting, not by scanning the raw official wallet balance.
The supported deposit path is the user's ATHWallet `ATHTransferRequestWithNotify` into Vault. Manual ordinary ATH
transfer to the official Vault ATHWallet is unsupported and must not be displayed as a deposit address or treated as a
Vault ledger credit. ATH withdrawal from Vault is a signed external Vault command. Its downstream ATHWallet
deploy/transfer/ACK reserve is paid from the user's internal Vault GRAM balance, and Vault credits back only
authenticated ACK/fail/bounce value it receives, minus local refund reserve and capped by the reserved internal value.

Public posts and comments are a separate open profile, not private capsules without encryption. They store a compact
`PPH1` public header cell plus a raw public body cell. Public body text and public image/avatar bytes use the same
1, 2, 4, 8, 16, or 32 KiB public capsule size classes as the user-visible body budget. Header metadata never reduces
that body budget. Public posts have no postquantum option; public messages start from `0.0337 GRAM`,
while the current exact public base example is `0.0337 GRAM` plus the same
network-fee surcharge rule. `kind = 1` is a public post; post `flags` bit 0 closes comments for that post. `kind = 2` is
a one-level public comment with `parent_entry_id:uint64` and `parent_body_hash:uint256` in the header. `kind = 3` is a
public image post, `kind = 4` is a public image comment, and `kind = 5` is public wallet avatar media. Public headers also carry `stream_id:uint128`,
`part_index:uint16`, `part_count:uint16`, and `media_format:u8`; public headers use `media_format = 0` for text and
`media_format = 1` for WebP image/avatar parts. Public post, image post, and avatar headers also carry
`profile_version:uint32` and `avatar_hash:uint256`; zero means no avatar pointer. Long public text or image data is reconstructed from multiple entries
only after each entry has used the smallest fitting public size class up to 32 KiB. The official PWA compresses selected images to WebP targets of 8 KiB
(`low`), 16 KiB (`medium`), 32 KiB (`good`, default), or 64 KiB (`maximum`) before splitting. There is no edit/delete/reaction/moderation or counter layer.

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

The AES-GCM plaintext is one fixed capsule slot selected by `size_class`:

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
|| payload[useful_size]
```

The useful content area is padded to the selected 1, 2, 4, 8, 16, or 32 KiB private capsule class. A message with 1 byte, 500 bytes, or 1024 bytes of useful text has the same encrypted plaintext size in the 1 KiB class. Messages above the selected class are split into independent capsules with encrypted `stream_id`, `part_index`, and `part_count` metadata. One capsule never mixes unrelated text/image units; the receiver assembles independent capsules back into the original message.

Content kinds:

- `1` text: UTF-8 bytes, up to the selected useful private capsule size.
- `2` image: compressed WebP image bytes, up to the selected useful private capsule size (`media_format = 1`).
- `3` payment check: `asset:u8 || reserved:u8 || amount:u128 || intent_id:uint256 || secret32:uint256`.

Payment check bodies intentionally do not include `tx`, activation time, or expiry. The receiver claims by `intent_id + secret32`; if the sender already cancelled the check or it was already claimed, the UI says that the check was already claimed or cancelled by the sender.

The encrypted body may be wrapped for export/share as:

```text
PLC1 || version:u8 || suite:u8 || chunk_index:u8 || chunk_total:u8 || message_id:u128 || body_slice
```

For the final capsule body, `chunk_total` is always `1`. `PLC1` is package/export framing only. The accepted Vault -> CapsuleHub publish transaction carries the assembled `PLB1` body bytes in a snake cell; CapsuleHub persists only compact authenticated metadata and hashes.

Final private limits:

| Suite | Useful cap per capsule | Body bytes | Export chunk bytes |
| --- | ---: | ---: | ---: |
| `hybrid-v1` | 1 KiB | 2,228 bytes | 2,252 bytes |
| `hybrid-v1` | 2 KiB | 3,252 bytes | 3,276 bytes |
| `hybrid-v1` | 4 KiB | 5,300 bytes | 5,324 bytes |
| `hybrid-v1` | 8 KiB | 9,396 bytes | 9,420 bytes |
| `hybrid-v1` | 16 KiB | 17,588 bytes | 17,612 bytes |
| `hybrid-v1` | 32 KiB | 33,972 bytes | 33,996 bytes |

The canonical source for this layout is `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`.

AES-GCM uses a 12-byte nonce and a 16-byte tag. The ciphertext length equals plaintext length plus the tag.

The compact body prefix, `header0Hash`, and `header1Hash` are passed as AES-GCM additional authenticated data. Changing binary routing headers, suite, nonce, KEM ciphertext, chunk bytes, or sender signature makes verification or decryption fail.

Before decryption the client also checks:

- compact body suite matches `header0`;
- recipient key id matches `header0.recipientKeyId`;
- `hybrid-v1` bodies do carry a 1088-byte ML-KEM ciphertext;
- every chunk has the same suite, message id, and chunk total.

## Key derivation

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
- `chainCells`: base64 BOC payloads using `ton-snake-byte-cell.v1`; these are the cells accepted in the Vault -> CapsuleHub publish transaction and authenticated by `CapsuleHub`, not an off-chain pointer.
- `senderSignature`: Ed25519 signature over the capsule id and all three hashes.

For `hybrid-v1`, the capsule uses CapsuleHub's hybrid profile:

```text
size_class   in {1,2,4,8,16,32}
crypto_suite = 2
```

The private capsule draft maps to the Vault -> CapsuleHub `PublishPrivateFromVault` body after the signed
`PublishPrivateFromVaultBalance` external request is accepted by Vault:

```text
header_0_hash = Cell.hash(header_0_cell)
header_1_hash = Cell.hash(header_1_cell)
body_hash     = Cell.hash(body_cell)
header_0_cell = snake-cell(header0 bytes)
header_1_cell = snake-cell(header1 bytes)
body_cell     = snake-cell(compact encrypted body bytes)
```

Vault publish messages carry `protocol_fee_paid`, because Vault is the discount authority for ATH-backed pricing.

The useful payload capacity is the capacity of the encrypted body bytes that are actually serialized into `body_cell` and accepted by `CapsuleHub`. A hash without the matching accepted publish transaction body is not a readable message. Local history is cache only; it does not define delivery.

For Vault external publish signing, the hashes-ref order remains contract-compatible:

```text
body_hash || header_0_hash || header_1_hash
```

The compact body is bound to `header0Hash` and `header1Hash` through AES-GCM AAD. Replacing headers, body chunks, suite metadata, sender signature, capsule context, or the BOC payload cells makes verification fail before the message is accepted.

## Delivery source of truth

Accepted private messages are compact CapsuleHub entries plus the encrypted payload cells carried by the accepted publish transaction body. The PWA retrieves those cells from TON message history and verifies them against CapsuleHub hashes before decrypting. The production PWA does not expose manual public-bundle or encrypted-capsule JSON package exchange.

Public messaging keys are registered in `Vault` key records. A sender must resolve and verify the recipient key record before encrypting a private capsule. Local encrypted history is a device cache only; it does not define delivery.

`.ath` username authority has two parts. `UsernameRegistry.get_name_record` proves that a name exists and points to the
exact `UsernameNFTItem` for that name. The current owner is then read from that item state. Transfers change the item
owner; the registry record remains the name-to-item anchor. The item exposes standard NFT data and TEP-64 on-chain
metadata, including `name = <username>.ath`, without a server-hosted metadata URI. Username bytes are deliberately
literal: leading, trailing, consecutive, and all-separator names are valid when every byte is in the allowed `a-z`,
`0-9`, `_`, `-` set and length is 4..16. If a pending mint becomes stale after
a missing item ACK, `PrunePendingUsernameMint` is non-destructive: it proves the stale condition but does not delete
pending state or create refund due. A deployed item becomes an authoritative username only after the registry finalizes
the matching name record through a valid late ACK or `ResendDeployedAck`. Clients and indexers must ignore item-only
ownership claims and must not use the registry record owner as the current owner after transfers.

The 24-word GRAM recovery phrase is the single user secret. The PWA deterministically derives the GRAM wallet key and the messaging encryption/signing keys from that phrase. The profile export/import flow therefore handles only the recovery phrase; there is no separate messaging-key backup.

## Replay and expiry policy

Private capsules default to a 24-hour TTL and are capped at 30 days. Live/off-chain capsule package verification rejects:

- capsules created too far in the future;
- expired capsules;
- TTLs above the policy cap;
- duplicated capsule ids in the caller-provided replay cache.

Chain-history import is different: when a private entry is already accepted by CapsuleHub and the body is recovered from
accepted TON transaction history or the local encrypted cache, the PWA verifies the entry hashes, body/header cells, and
decryption, but it does not reject solely because the header expiry is in the past. Otherwise retained chain history would
become unreadable by design.

The replay cache is local state; production clients can back it with IndexedDB or another device-local store. No backend is required.

## No-backend rule

The encryption layer does not require a Platho backend. A server may host static files, but private delivery is anchored by `CapsuleHub` chain state plus accepted publish transaction bodies: the compact entry proves the hashes, and the body must still be available from TON message history or the user's local encrypted cache. The server never receives plaintext, private keys, or a server-side session secret.

## Vault registration draft

The client can derive a `RegisterMessagingKeys` draft from a verified signed bundle:

- `enc_pubkey`: 32-byte X25519 public key as uint256.
- `sign_pubkey`: 32-byte Ed25519 signing public key as uint256.
- `auth_pubkey`: separate 32-byte Ed25519 Vault auth public key as uint256.
- `pq_kem_pubkey_hash`: SHA-256 of the ML-KEM-768 public key.
- `pq_kem_pubkey_len`: `1184`.
- `pq_kem_pubkey`: canonical snake-cell containing exactly 1184 ML-KEM-768 public-key bytes.
- `crypto_suite_mask`: `2` for `hybrid-v1`.

This draft is submitted by the embedded Platho wallet activation flow. Once the wallet is activated in Vault, other activated users can resolve its public messaging key record and encrypt private capsules to it.

## Vault key record binding

After the wallet has registered keys on-chain, the client must fetch:

- the wallet `UserState.current_key_id`;
- for the user's own unlocked wallet, `UserState.auth_pubkey` matching the locally derived Vault auth public key;
- the `VaultKeyRecordView` for that key id.

> **clean-17.** The Vault contract this chapter describes is clean-15. Under clean-17 the same binding is read from the wallet's OWN KeyShard contract (`web/key-shard-ton-rpc-provider.mjs`), whose address is derived from the wallet — so a record can only ever hold keys that wallet registered. The provider bridge `web/vault-chain-provider.mjs` was removed with the Vault.

```js
{
  async getUser(ownerWallet) {},
  async getKeyRecord(currentKeyId) {},
}
```

If no provider is configured, Vault binding stays unavailable rather than accepting a local draft or UI placeholder. A production/static deployment can install a provider on `globalThis.plathoVaultChainProvider` that reads the deployed Vault through a TON API mirror or light-client compatible transport.

The static runtime includes `web/vault-ton-rpc-provider.mjs` as the production-provider skeleton. It can wrap TON Center v3 compatible endpoints or a custom `globalThis.plathoTonRpcTransport` installed by the host bundle. The current PWA does not expose a built-in user RPC settings screen. The provider:

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
