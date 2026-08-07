# Platho message crypto protocol

Internal byte-level specification of the client-side message encryption implemented by the static PWA, as it exists in
clean-17. The user-facing description of the same protocol is `web/docs/crypto-protocol.md`; this document is the
auditor's copy and carries the wire layouts, derivation domains, and contract-side bindings.

Everything here is derived from shipped code: `web/crypto/platho-crypto.mjs` (capsule codec), `web/crypto/conv-routing.mjs`
(conversation key schedule), `web/shard-discovery.mjs` + `web/shard-address.mjs` (address derivation),
`web/pwa-contract-transactions.mjs` (public headers), `web/publish-price.mjs` (direct-pay values), and the contracts
under `contracts/`.

## Suites

| Suite | Contract value | Purpose |
| --- | ---: | --- |
| `hybrid-v1` | `2` | Private messages using X25519 plus ML-KEM-768 plus AES-256-GCM. |

V1 private publishing accepts only `CRYPTO_SUITE_HYBRID = 2`. The classical-only suite exists in the codec for tests and
is not a valid publish suite.

## Key bundles

Every 24-word GRAM recovery phrase created or imported by the PWA deterministically derives a messaging identity with an
X25519 encryption key pair, an ML-KEM-768 key pair, an Ed25519 signing key, and an X25519 scan key. The public material is
exported as a public key bundle:

- `keyId`: SHA-256 based identifier over the public key material.
- `x25519PublicKey`: 32-byte classical ECDH public key.
- `mlKem768PublicKey`: 1184-byte ML-KEM-768 public key.
- `mlKem768PublicKeyHash`: SHA-256 of the ML-KEM-768 public key.
- `mlKem768PublicKeyLen`: always `1184`.

The PWA recomputes `keyId`, `mlKem768PublicKeyHash`, and `mlKem768PublicKeyLen` before encryption. A bundle that claims a
mismatched id, suite, contract suite, hash, or length is rejected.

`keyId` is computed by the client, not by a contract:

```text
keyId = HKDF-SHA-256( x25519_public_key || ml_kem_768_public_key_hash , info = PLATHO.KEYID.HYBRID.V1 )[:32]
```

Because the id commits to both public keys, a party that knows a peer's `keyId` can verify that a bundle offered for that
id is the bundle the id was minted from. This is the first of the two checks that close first-contact impersonation.

Recipient lookup is defined by `enc_pubkey`, `sign_pubkey`, the scan public key, and the full `pq_kem_pubkey` cell stored
in the wallet's own **KeyShard** account. The hash and length remain in the record as compact binding fields, but the full
ML-KEM-768 public key is what lets another client actually encrypt a `hybrid-v1` capsule.

## Signed bundles

The PWA can export a signed public key bundle. The signed payload includes:

- protocol domain `PLATHO.MESSAGING.KEY_BUNDLE.SIGNATURE.V1`;
- issue and optional expiry timestamps;
- the optional owner wallet address;
- the public encryption bundle;
- the 32-byte Ed25519 signing public key.

The signature covers the stable JSON payload and is verified before the bundle is trusted. This prevents silent local
bundle tampering and gives the client the exact `sign_pubkey` the wallet's KeyShard stores.

A signed bundle is a messaging-key self-signature and proves nothing about wallet ownership on its own. Ownership is
anchored by the KeyShard address (below); recipients verify the bundle against the on-chain record.

## Wallet ownership

The production PWA does not use an external wallet connector. A user creates or imports a normal 24-word GRAM recovery
phrase, and the PWA deterministically derives the GRAM wallet key and the messaging encryption/signing/scan keys from that
phrase. There is no separate auth key and no internal contract-held balance: every publish is an external message signed by
the user's own wallet key and paid straight to the target shard.

Ownership is anchored by **address derivation**, not by a registry lookup:

```text
KeyShard address = f( StateInit( owner_wallet ) )
```

A wallet's KeyShard address is a pure function of that wallet address, so a record read from that address can only ever
hold keys that wallet registered. There is no shared key table in which one wallet could occupy another wallet's row, and
the reader needs no on-chain index to find the record — it computes the address locally and reads that one account.

Recipients trust a messaging bundle only after checking it against the KeyShard record for the expected wallet:

- the record was read from the address derived from the expected wallet;
- `enc_pubkey` and `sign_pubkey` match the signed bundle;
- the record exposes the full `pq_kem_pubkey` cell, not only its hash;
- the decoded ML-KEM-768 key bytes hash to `pq_kem_pubkey_hash`;
- `keyId` recomputed from `enc_pubkey` and `pq_kem_pubkey_hash` equals the id being resolved.

`web/key-shard-ton-rpc-provider.mjs` is the reader. It fails closed: if the RPC transport is unavailable or the record does
not bind, the client does not fall back to a local draft or a UI placeholder. Registration is priced at
`KEYSHARD_REGISTER_VALUE = 60,000,000` nanotons, which covers the account's own rent float plus register gas.

Key rotation writes a new record into the same account. The address does not move, so a rotation cannot be used to strand a
peer at an address nobody reads.

The profile export/import flow handles the 24-word GRAM recovery phrase. There is no separate messaging key backup and no
external wallet connection mode.

## Lanes

Private traffic is split into two lanes with different discovery models, plus a private per-user store and the public feed:

| Lane | Contract | Address is a function of | Header0 |
| --- | --- | --- | ---: |
| CONV — established conversation | `RecordShard` | `bucket_key`, `epoch` | 40 bytes |
| INTRO — first contact | `IntroShard` | `epoch`, sender-chosen `bucket` | 42 bytes |
| RECOVERY — the user's own slots | `RecoveryShard` | `self_bucket_key` | — |
| PUBLIC — feed, threads, avatars | `PublicShard` | `kind`, channel coordinates | 32 bytes (`PPH2`) |

A client that knows its own keys computes every one of these addresses locally, with zero on-chain requests. There is no
directory and no index to walk. Publishing is direct-paid to the derived address; writing a CONV bucket is authorized by
knowing its `bucket_key`, which only the conversation's two participants can derive.

## First contact (INTRO)

The sender does not know a shared secret yet, so it cannot address a bucket only the recipient can compute. Instead it
publishes to an `IntroShard` bucket of its own choosing and marks the entry so that only the intended recipient recognises
it.

Per message the sender draws an ephemeral X25519 pair `(e, R = e·G)` and computes, against the recipient's advertised scan
public key `S`:

```text
scan_shared = X25519(e, S)
view_tag    = HKDF-SHA-256( scan_shared ,
                            salt = PLATHO.STEALTH.VIEWTAG.SALT.V1 ,
                            info = PLATHO.STEALTH.VIEWTAG.V1 || R )[:2]      as uint16 big-endian
```

`R` and `view_tag` are the only routing data in the cleartext header. A recipient scanning a shard recomputes
`X25519(scan_secret, R)` and compares the two-byte tag before attempting any decryption, so a scan pass costs one ECDH and
one HKDF per entry.

`R` arrives from an untrusted endpoint and `IntroShard` stores it as an opaque uint256 — TVM has no cheap Curve25519
membership check. A degenerate point therefore costs one publish and yields the all-zero shared secret. Both belts reject
it (the vendored X25519 throws inside the ladder, and `assertNonZeroSharedSecret` sits behind that), and
`privateScanViewTagOrNull` converts that throw into a skipped record so one poisoned entry on a shared page cannot abort
every user's scan pass.

The handshake blob inside the encrypted body binds, in one AEAD-protected structure: both `keyId`s, the sender's X25519
encryption public key, the sender's ML-KEM-768 public key hash, both KEM ciphertexts, `R`, `view_tag`, and the intro nonce.
Two checks close impersonation:

1. the recipient recomputes `keyId = HKDF(enc_pubkey || ml_kem_hash, PLATHO.KEYID.HYBRID.V1)` from the material in the blob
   and requires it to equal the sender id the blob claims;
2. the blob carries a confirmation tag over the derived `K_root`, which only a party holding the matching secrets can
   produce.

`web/intro-cursor-store.mjs` keeps the delivered set as `epoch:bucket:entryId` in IndexedDB, so an entry is delivered to
the UI exactly once across reloads.

An INTRO entry is retained for `IS_INTRO_RETENTION = 604800` seconds (1 week). The shard for epoch `E` leaves the read
window at `(E+9)·86400` and becomes retireable at `(E+2)·86400 + IS_INTRO_RETENTION + IS_RETIRE_SLACK`.

## An established conversation (CONV)

Once both sides hold the pair secret, addressing becomes deterministic and carries no sender or recipient label at all.

```text
K_root  = HKDF-SHA-256( X25519(a,B) || ML-KEM-768.ss ,
                        salt = PLATHO.CONV.ROOT.SALT.V1 ,
                        info = PLATHO.CONV.ROOT.V1 || lo_keyId || hi_keyId )

K_epoch = HKDF-SHA-256( K_root ,
                        salt = PLATHO.CONV.RATCHET.SALT.V1 ,
                        info = PLATHO.CONV.RATCHET.V1 || u32be(epoch) )

bucket  = HKDF-SHA-256( K_epoch ,
                        salt = PLATHO.CONV.BUCKET.SALT.V1 ,
                        info = PLATHO.CONV.BUCKET.V1 || dir_byte || u32be(epoch) )[:32]
```

`lo_keyId`/`hi_keyId` are the two ids in byte order, so both sides derive the same root without agreeing on who is "first".
`dir_byte` is `0x00` for lo→hi and `0x01` for hi→lo, so each direction gets its own shard: A's outgoing address is B's
incoming address and neither side ever writes into its own read shard.

- `CONV_EPOCH_SECONDS = 86400` — one UTC day per bucket, so the address rotates daily without any negotiation.
- `CONV_RECV_WINDOW_W = 2` — a recipient scans `[epoch_now - W .. epoch_now]`, which absorbs clock skew and publish delay.
  After an absence the client widens the window to cover the gap instead of relying on the steady-state value.
- Writes are authenticated by a per-direction write key derived under `PLATHO.CONV.WRITE.SALT.V1` /
  `PLATHO.CONV.WRITE.V1`. `web/conv-lane.mjs` drops a body whose write signature does not verify, which is how junk sent to
  a publicly-derivable address never reaches the reader.

A shard's read window is 128 capsules per page. The window counts capsules rather than inbound messages, because a
direct-paid shard no longer carries fee deposits and top-ups in the same stream.

A conversation with no traffic must cost no history reads: the client gates the per-conversation history fetch on the
account's `last_transaction_lt`, so an idle day is one cheap account read, not `3N` history reads.

## The capsule

A private capsule is three pieces plus a signature:

- `header0`: the cleartext routing header — 40 bytes on CONV, 42 bytes on INTRO (layouts below).
- `header1`: the 30-byte `PH1B` replay header.
- `body`: `platho.byte-layout.v1` — a fixed prefix plus one AES-256-GCM ciphertext.
- `hashes`: TON `Cell.hash()` values for the exact on-chain cells that carry `header0`, `header1`, and the body bytes.
- `chainCells`: base64 BOC payloads using `ton-snake-byte-cell.v1` — the cells actually carried by the accepted publish
  transaction, not an off-chain pointer.
- `senderSignature`: Ed25519 over the capsule id and all three hashes, produced inside the encrypted body.

### header0 — CONV lane (40 bytes)

```text
PH0C
|| version:u8
|| publish_kind:u8 = 1
|| size_class:u8
|| crypto_suite:u8
|| bucket_key:32 bytes
```

`bucket_key` sits at bytes 8..40 (bits 64..320), which is the exact window the contract extractor reads
(`loadUint(64); loadUint(256)`), so client serialization and on-chain extraction agree byte for byte. There is no
recipient label, no sender key id, and no profile pointer in this header.

### header0 — INTRO lane (42 bytes)

```text
PH0C
|| version:u8
|| publish_kind:u8 = 3
|| size_class:u8
|| crypto_suite:u8
|| ephemeral_R:32 bytes
|| view_tag:u16
```

### header0 — legacy private lane (74 bytes)

```text
PH0C
|| version:u8
|| publish_kind:u8 = 1
|| size_class:u8
|| crypto_suite:u8
|| sender_key_id:32 bytes
|| ephemeral_scan_pub:32 bytes
|| view_tag:u16
```

Write rejects any `publish_kind` other than `1` on this layout, so a self-consistent legacy header cannot be minted
claiming INTRO and be misrouted into the intro pool.

### header1 (30 bytes)

```text
PH1B
|| version:u8
|| flags:u8 = 0
|| created_at_s:u32
|| expires_at_s:u32
|| client_nonce:16 bytes
```

### body

```text
PLB1 || version:u8 || suite:u8 || flags:u8 || reserved:u8
     || message_id:u128
     || aes_gcm_nonce:12 bytes
     || x25519_ephemeral_public:32 bytes            -- 68 bytes to here
     || ml_kem_768_ciphertext:1088 bytes
     || aes_gcm_ciphertext_and_tag
```

`flags` bit 0 marks the presence of the sender-recovery section inside the plaintext.

The AES-GCM plaintext is a fixed slot selected by `size_class`, followed by the sections that clean-16 moved out of the
cleartext header:

```text
PCP1
|| version:u8
|| type:u8
|| flags:u8
|| media_format:u8
|| stream_id:u128
|| part_index:u16
|| part_count:u16
|| content_len:u16
|| reserved:u16
|| payload[available]
|| identity_section[68]
|| sender_recovery_section[64]                      -- only when body flags bit 0 is set
```

The identity section is `ed25519_sign_pubkey:32 || profile_version:u32 || avatar_hash:u256`. It used to sit in cleartext
`header0`; inside the AEAD only a party that can open the body sees the sender's signing key, profile version, and avatar
pointer. The sender-recovery section (`PSR1`, 64 bytes) is the sender's own copy of the message key, wrapped under
`PLATHO.SENDER_RECOVERY.KEY.V1`, so a sender can reread its own outgoing message after a device restore.

Both sections are carved out of the useful area, not added to it:

```text
reserved_tail = 68 (identity) + 64 (sender recovery, when present)
available     = useful_size_class - reserved_tail
```

A caller that pre-encodes its payload — the CONV multi-part send does, to split a document across parts — must compute the
same reserved tail through `compactPayloadReservedTailBytes()`. Reserving only the sender-recovery section leaves every
size class 68 bytes off, which makes the first message of a conversation succeed and every message after it fail.

Content types:

- `1` text: UTF-8 bytes, up to `available`.
- `2` image: compressed image bytes; `media_format` is `1` WebP, `2` AVIF, `3` JPEG, `4` PNG.
- `4` document: file bytes with the same part machinery as images.

Type `3` is **reserved and unused**. It was the payment-check body; that feature was retired and the byte was not
reassigned, so an old client's check body cannot be reinterpreted as a new content type.

Optional AEAD-protected metadata sections, selected by payload `flags`: `PSW1` sender wallet (69 bytes, bit 0), `PRW1`
recipient wallet (37 bytes, bit 1), `PSN1` sender username (5-byte prefix, up to 25 bytes, bit 2).

The useful content area is padded to the selected class — 1, 2, 4, 8, 16, or 32 KiB — so a message with 1 byte, 500
bytes, or 892 bytes of text has the same encrypted size in the 1 KiB class. Messages above the class are split into independent capsules carrying encrypted
`stream_id`, `part_index`, and `part_count`. One capsule never mixes unrelated units.

Final v1 private sizes, with `body = 1204 + useful_size_class`:

| Suite | Useful class | Body bytes | Export chunk bytes |
| --- | ---: | ---: | ---: |
| `hybrid-v1` | 1 KiB | 2,228 | 2,252 |
| `hybrid-v1` | 2 KiB | 3,252 | 3,276 |
| `hybrid-v1` | 4 KiB | 5,300 | 5,324 |
| `hybrid-v1` | 8 KiB | 9,396 | 9,420 |
| `hybrid-v1` | 16 KiB | 17,588 | 17,612 |
| `hybrid-v1` | 32 KiB | 33,972 | 33,996 |

The export wrapper is package framing only:

```text
PLC1 || version:u8 || suite:u8 || chunk_index:u8 || chunk_total:u8 || message_id:u128 || body_slice
```

`chunk_total` is always `1` for a final capsule body. The accepted publish transaction carries the assembled `PLB1` bytes
in a snake cell; the shard persists compact authenticated metadata and hashes.

AES-GCM uses a 12-byte nonce and a 16-byte tag. The compact body prefix, `header0Hash`, and `header1Hash` are passed as
additional authenticated data under `PLATHO.COMPACT_BODY.AAD.V1`. Changing routing headers, suite, nonce, KEM ciphertext,
body bytes, or the sender signature makes verification or decryption fail before anything is accepted.

Before decryption the client also checks:

- the body suite matches `header0`;
- `hybrid-v1` bodies carry a 1088-byte ML-KEM ciphertext;
- every chunk has the same suite, message id, and chunk total.

## Key derivation

For `hybrid-v1`:

```text
x25519_secret = X25519(sender_ephemeral_secret, recipient_x25519_public)
mlkem_secret  = ML-KEM-768.Encapsulate(recipient_mlkem_public)
message_key   = HKDF-SHA-256(x25519_secret || mlkem_secret, compact_aad_hash)
```

The plaintext is encrypted with AES-256-GCM. The implementation rejects all-zero X25519 shared secrets, so a low-order
public key cannot be used to force a known secret.

## The public feed

Public posts and comments are a separate open profile, not private capsules with the encryption removed. A `PublicShard`
account is derived from its `kind` (`CHANNEL`, `THREAD`, `BEACON`, `AVATAR`) plus the channel coordinates, so a reader
walks to the exact account without an index.

The header is one uniform 32-byte cell:

```text
PPH2
|| version:u8 = 2
|| kind:u8
|| flags:u8
|| media_format:u8
|| stream_id:16 bytes
|| part_index:u16
|| part_count:u16
|| created_at:u32
```

`PublicShard` stores the header as an opaque ref and never parses it — it commits only to
`H(PS_BODY_DOMAIN || header.hash || body.hash)`. The header layout is therefore a client convention, and
`publicHeaderBytesV2` / `readPublicBodyBytesV2` must stay each other's exact inverse or a post authenticates against
nothing.

`PPH2` deliberately drops three `PPH1` fields: the profile pointer (an avatar advertised from a post header bypassed the
paid KeyShard pointer), `parent_entry_id` (there is no global monotonic entry id), and `parent_hash` (the reader derives the
thread shard from the post's coordinates and already holds the parent). `stream_id`, `part_index`, and `part_count` stay at
their `PPH1` offsets so one walker handles both versions.

Kinds: `1` post, `2` comment, `3` image post, `4` image comment, `5` avatar media, `6` document post, `7` document comment.
Post `flags` bit 0 closes comments for that post. `media_format` is `0` for text and `1` for WebP media. The official PWA
compresses selected images to WebP targets of 8 KiB (`low`), 16 KiB (`medium`), 32 KiB (`good`, default), or 64 KiB
(`maximum`) before splitting. There is no edit, delete, reaction, or moderation layer.

A public entry's identity is its coordinates, not a global counter:

```text
entryId = `${channelEpochTag}.${channelShardSeq}.${shardEntryId}`
```

`get_page` returns at most `PS_PAGE_CAP = 96` rows, chosen to keep the get-method under its gas ceiling. Reads are
tail-anchored: a reader that pages backwards from the newest row reaches the beginning of a long thread, while a
head-anchored read would show an empty feed once a shard held more rows than one page.

Public posts and threads are retained for `PS_RETENTION_POST = 31536000` seconds (1 year).

## Avatars

The authoritative avatar pointer lives in the owner's **KeyShard**, not in a post header and not in `ProfileRegistry`. The
image bytes are published as `kind = 5` entries in the `AVATAR` domain of `PublicShard`. `ProfileRegistry` prices and
settles the 100 ATH charge, split 50/50, and is not the pointer's source of truth.

A reader resolves the pointer from the sender's KeyShard, fetches the avatar entries, concatenates parts in index order,
and requires the reconstructed WebP bytes to hash to the recorded `avatar_hash`. The local avatar cache is a speed-up only.

There are two independent readers of that pointer; both must be updated together when the record layout changes.

## Payment

Every publish is an external message signed by the user's own wallet key, carrying the required value straight to the
target shard. There is no internal balance, no discount authority, no relayer, and no external service anywhere in the
path. The protocol fee is `0.01 GRAM` per capsule and flows *through* the shard to `FeeAccumulator`; it is never accumulated inside the shard, so a shard holds no fee bucket to protect, sweep, or flush.

Canonical direct-pay values, in nanotons (`web/publish-price.mjs`):

| Publish | Value |
| --- | ---: |
| CONV capsule | `19,100,000` |
| INTRO capsule | `17,810,000` |
| Public channel post | `20,300,000` |
| Public thread comment | `20,300,000` |
| Public beacon | `31,400,000` |
| Public avatar | `39,500,000` |
| Recovery slot write | `38,400,000` |
| KeyShard register | `60,000,000` |

A recovery-slot overwrite returns the surplus, so one figure covers both the first write and a rewrite. The PWA shows the
final hold and net cost for the selected content size before signing, and fails closed — hiding the publish action — when
chain access or the price policy is unavailable.

The external-message size limit is 65,535 bytes and is measured in **bytes**, not in parts. A large external message that
follows another large one takes 24–203 seconds to land, while small ones land in 2–3 seconds; an image publish always
carries two large externals, which is why the send lane paces them rather than firing them together.

## Recovery and private per-user storage

`RecoveryShard` is addressed by the user's own `self_bucket_key` and is epoch-independent — the slot is the owner key plus
its index. It holds `RECOVERY_MAX_SLOTS = 256` indexed conversation-recovery slots (roughly 40k conversations), plus named
slots above that range: `RECOVERY_NAMED_SLOTS = 16` reserved, index `256` for `PREFS` (subscription state), and 8 note
slots from index `257`.

Recovery entries are retained for `RS_RETENTION = 31536000` seconds (1 year), the same as public posts and the private
lane.

## Delivery source of truth

An accepted message is a compact shard entry plus the encrypted payload cells carried by the accepted publish transaction.
The PWA retrieves those cells from TON message history and verifies them against the shard's stored hashes before
decrypting. There is no manual bundle or capsule JSON exchange in the production PWA.

A `200` from an RPC endpoint means *queued*, not *executed*: an external with a stale seqno is dropped silently. A send is
green only when the capsule is visible on chain, never when the POST succeeded. A dropped external must be rebroadcast as
**the same bytes** — re-signing it produces a second message that can both land.

Local encrypted history is a device cache. It does not define delivery, and a thread that never persisted a message does
not exist after reload.

`.ath` username authority has two parts. `UsernameRegistry.get_username_item_address(name_hash)` derives the one exact
`UsernameNFTItem` address a name may live at — the derivation *is* the name-to-item anchor, which is why the registry's
stored `name_records` map could be deleted on 2026-07-20 (it capped the registry at roughly 21,503 names). The current
owner is then read from that item's `get_state()`, because the item is what a TEP-62 transfer moves. A `UsernameNFTItem`
deployed at any other address is non-authoritative and must not be treated as ownership of the name, and an owner read
from anywhere else — a cached record, an earlier generation's registry — is historical, not the current owner after a
transfer.

The item exposes TEP-64 on-chain metadata including `name = <username>.ath` without a server-hosted metadata URI.
Username bytes are deliberately literal: leading, trailing, consecutive, and all-separator names are valid when every byte
is in the allowed `a-z`, `0-9`, `_`, `-` set and the length is 4..16.

If an item deployment was attempted but its ACK never reached the registry, `PrunePendingUsernameMint` is deliberately
non-destructive: it proves the stale condition but does not guess failure, does not delete pending state, and does not
create refund due. The recovery path is a late `UsernameItemDeployedAck` or `UsernameNFTItem.ResendDeployedAck`, so an
initialised item can still become authoritative.

The 24-word GRAM recovery phrase is the single user secret. The PWA deterministically derives the wallet key and all
messaging keys from it, so profile export/import handles only that phrase.

## Replay and expiry policy

Private capsules default to a 24-hour TTL and are capped at 30 days. Live package verification rejects capsules created too
far in the future, expired capsules, TTLs above the cap, and duplicate capsule ids in the replay cache. Clock skew is
tolerated up to 5 minutes.

Chain-history import is different: once an entry is accepted on chain and the body is recovered from transaction history or
the local encrypted cache, the PWA verifies hashes, cells, and decryption but does not reject solely because the header
expiry has passed. Otherwise retained history would become unreadable by design.

## Durable replay store

The PWA uses IndexedDB for private capsule replay protection when available, with a memory fallback. The store keeps
capsule ids until their capsule expiry and prunes expired entries locally. This is device-local state and requires no
server.

## Encrypted local message history

The device-local message history uses a non-extractable WebCrypto AES-GCM-256 key saved in IndexedDB and stores every
message body as authenticated ciphertext. The record header keeps only local query metadata: id, thread id, timestamp,
direction, and optional capsule id, and is bound as additional authenticated data — changing any of it prevents the record
from opening. If IndexedDB is unavailable, the app falls back to encrypted in-memory history for that session rather than
writing plaintext to persistent browser storage.

A thread snapshot rides a message: it is serialized only when a message is written to encrypted history. A conversation
with no persisted message therefore does not survive a reload.

## No-backend rule

The encryption layer requires no Platho backend. A server may host static files, but delivery is anchored by shard chain
state plus accepted publish transaction bodies: the compact entry proves the hashes, and the body must still be available
from TON message history or the user's local encrypted cache. The server never receives plaintext, private keys, or a
server-side session secret. External infrastructure of any kind — issuer, relay, indexer, notification service — is
forbidden by design, not merely unused.

Reads go through toncenter. Broadcast has three keyless entry points (toncenter, tonapi, tonhub v4), tried in rotation so a
retry knocks on the *next* door rather than the same one; a new host must also be added to the CSP or the door is closed
before it is opened. All outgoing sends share one request queue — a second queue means parallel connections and a frozen
low-end device.

## Production status

The mainnet path uses embedded GRAM wallet derivation, KeyShard-anchored messaging keys bound by address derivation, signed
bundle validation, fail-closed chain binding, capsule cell hashing, in-body sender signatures, per-direction write-key
authentication on CONV, stealth first contact on INTRO, durable replay storage, encrypted local message history, and
recovery phrase export/import. Contracts are immutable after seal; migration hooks are built into clean-17 for the next
generation. Production deployment must keep the PWA configuration pinned to the verified mainnet manifest.
