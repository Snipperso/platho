# Platho Capsule V1 Final Specification

Status: final v1 source of truth for the capsule unit, PWA, shard contracts, tests, and audit.

Rebaselined onto clean-17 on 2026-08-07. The capsule unit, size classes, body prefix, plaintext slot, multi-part
assembly, export framing, and cryptographic binding are unchanged from the clean-15 text. What changed is everything
around them: `Vault` and `CapsuleHub` were deleted, publishing is direct-paid to per-lane shard accounts, header0 split
into a 40-byte CONV form and a 42-byte INTRO form, the sender identity moved inside the AEAD, and prices are labelled in
GRAM. `web/CRYPTO_PROTOCOL.md` is the companion document and carries the derivation domains and the lane model.

This document intentionally supersedes earlier draft language that allowed JSON envelopes, hash-only messages with no
retrievable publish body, off-chain message bodies, variable-size capsule payloads, or multi-block payloads inside one
capsule. Platho v1 message bodies are accepted as binary payload cells in publish transactions and authenticated by
compact shard entry state. Local history, static feeds, QR/export packages, and mirrors are cache or transport
conveniences only; they are not the v1 delivery source of truth.

## Fixed Capsule Unit

One capsule contains exactly one encrypted user payload slot selected from the supported size classes:
1, 2, 4, 8, 16, or 32 KiB. The 1 KiB class is exactly one encrypted 1024-byte useful payload slot.

Small text, documents, and small images are padded inside the selected slot. Long text and images are split into
independent capsules with encrypted sequence metadata so the receiver can assemble the original message. A capsule's size
class is visible on-chain, but the body type remains encrypted.

V1 private publishing accepts only the hybrid crypto suite:

| Suite | `size_class` | `crypto_suite` | Useful payload slot | Encrypted body bytes | Export chunk bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `hybrid-v1` | `1` | `2` | 1024 | 2228 | 2252 |
| `hybrid-v1` | `2` | `2` | 2048 | 3252 | 3276 |
| `hybrid-v1` | `4` | `2` | 4096 | 5300 | 5324 |
| `hybrid-v1` | `8` | `2` | 8192 | 9396 | 9420 |
| `hybrid-v1` | `16` | `2` | 16384 | 17588 | 17612 |
| `hybrid-v1` | `32` | `2` | 32768 | 33972 | 33996 |

`Export chunk bytes` means `PLC1` package/export framing. The publish body carries the assembled `PLB1` body bytes in a
snake cell, not the `PLC1` wrapper.

The useful slot is the *slot*, not the user's content budget. The identity section (68 bytes) and, when present, the
sender-recovery section (64 bytes) are carved out of it, so user content fits `useful_slot - reserved_tail`. Every builder
and every caller that pre-encodes a payload must compute that tail through the same helper.

## Shard Storage

Publishing is direct-paid: an external message signed by the user's own wallet key, sent straight to the shard account
that owns the lane. There is no hub, no internal balance, and no relayer. Each shard address is a pure function of data
the client already holds, so a reader computes it locally and needs no index:

| Lane | Contract | Address is a function of |
| --- | --- | --- |
| CONV — established conversation | `RecordShard` | `bucket_key`, `epoch` |
| INTRO — first contact | `IntroShard` | `epoch`, sender-chosen `bucket` |
| RECOVERY — the user's own slots | `RecoveryShard` | `self_bucket_key` |
| PUBLIC — feed, threads, avatars | `PublicShard` | `kind`, channel coordinates |
| KEYS — one wallet's messaging keys | `KeyShard` | owner wallet address |

Private publish messages carry three retrievable cells in the accepted transaction body:

- `header_0`: exact `PH0C` header bytes in a `ton-snake-byte-cell.v1` cell.
- `header_1`: exact `PH1B` header bytes in a `ton-snake-byte-cell.v1` cell.
- `body`: exact `PLB1` encrypted body bytes in a `ton-snake-byte-cell.v1` cell.

The shard validates the cells and persists only compact authenticated state: the entry id, `created_at = now()`, the
header commitment, and the body hash. Those hashes are the TON `Cell.hash()` values of those exact cells. A hash without a
matching accepted publish transaction body is not a readable v1 message.

Write authority on a CONV shard is knowledge of its `bucket_key`, which only the conversation's two participants can
derive, plus a per-direction write signature the reader verifies. A body whose write signature does not verify is dropped
by the reader, so junk sent to a publicly-derivable address never surfaces.

Public publish messages carry two retrievable cells in the accepted transaction body:

- `header`: compact `PPH2` public metadata bytes in a `ton-snake-byte-cell.v1` cell.
- `body`: raw public content bytes in a `ton-snake-byte-cell.v1` cell.

`PublicShard` treats the header as opaque data and never parses it: it commits only to
`H(PS_BODY_DOMAIN || header.hash || body.hash)`. The header layout is therefore a client convention, and the writer and
reader must stay each other's exact inverse or a post authenticates against nothing. The PWA reconstructs the body from
TON message history and verifies it against the stored commitment before display.

Public content is visible to everyone, so public bodies are not encrypted, not padded to private capsule ciphertext size, and not
assigned a postquantum profile. Public text, image, and avatar bodies use the smallest fitting 1, 2, 4, 8, 16, or
32 KiB public capsule size class. Public header metadata does not reduce that body budget. Public
publish messages must also include the fixed on-chain marker:

```text
marketing_note:uint152 = ASCII "sent via Platho.App"
```

The official messenger UI must not render that marker as message text.

Public payloads are immutable. There is no edit/delete/reaction/counter layer in v1.

The public header is one uniform 32-byte cell for every kind:

```text
PPH2                                      4 bytes
version:u8 = 2                           1
kind:u8                                  1
flags:u8                                 1
media_format:u8                          1
stream_id:uint128                        16
part_index:uint16                        2
part_count:uint16                        2
created_at:uint32                        4
```

`PPH2` dropped three `PPH1` fields the shard model made redundant or unsafe:

- the profile pointer (`profile_version` + `avatar_hash`) advertised an avatar straight from the post header, bypassing
  the paid `KeyShard` pointer. The authoritative avatar pointer is `KeyShard`'s.
- `parent_entry_id`: there is no global monotonic entry id. A comment's parent is the thread shard it lives in, whose
  address is a function of the post's own coordinates, so routing already binds it.
- `parent_hash`: the reader derives the thread shard from those coordinates and therefore already holds the parent.

`stream_id`, `part_index`, and `part_count` stay at their `PPH1` offsets so one walker handles both versions.
`created_at` is the client's declared post time, stable across a multipart post's per-part contract stamps.

Kinds: `1` post, `2` comment, `3` image post, `4` image comment, `5` avatar media, `6` document post, `7` document
comment. Post flags bit 0 closes comments for that post; bits 1..7 are reserved. Comment flags must be zero.
`media_format` is `0` for text and `1` for WebP media.

An entry's identity is its coordinates, not a counter: `entryId = channelEpochTag.channelShardSeq.shardEntryId`.

`part_count = 1` for a one-entry post or comment; longer public text or image data is split into separate entries with the
same `stream_id` and increasing `part_index`, after filling each entry up to the smallest fitting public size class,
capped at 32 KiB. `PublicShard` does not index comment relationships, count comments, moderate content, or enforce social
semantics; it stores the compact commitment, the timestamp, and the row. Public body cells remain in accepted publish
transaction bodies and are recovered from message history before verification.

`get_page` returns at most 96 rows, which keeps the get-method under its gas ceiling. Reads must be tail-anchored: a
head-anchored read shows an empty feed as soon as a shard holds more rows than one page.

The official PWA exposes image compression targets before splitting into public size-class entries:

- low: WebP target <= 8 KiB.
- medium: WebP target <= 16 KiB.
- good: WebP target <= 32 KiB.
- maximum: WebP target <= 64 KiB, encoded as two 32 KiB public entries when needed.

Larger public size classes cost more because they reserve more shard execution and storage capacity, but a 26 KiB avatar
is one 32 KiB public entry rather than 26 separate 1 KiB entries.

A capsule published at a page boundary costs the same as any other capsule of the same profile; v1 must not charge the
first entry of a page a separate page-storage reserve.

## PWA Message Price

A publish carries a fixed canonical value straight to the shard. There is no internal balance to check, no signed
spending ceiling, and no ACK refund to wait for. The canonical values live in `web/publish-price.mjs` and are pinned by
`tests/publish-builder.test.ts`:

| Publish | Value, nanotons | GRAM |
| --- | ---: | ---: |
| CONV capsule | `19,100,000` | `0.0191` |
| INTRO capsule | `17,810,000` | `0.0178` |
| Public channel post | `20,300,000` | `0.0203` |
| Public thread comment | `20,300,000` | `0.0203` |
| Public beacon | `31,400,000` | `0.0314` |
| Public avatar | `39,500,000` | `0.0395` |
| Recovery slot write | `38,400,000` | `0.0384` |
| KeyShard register | `60,000,000` | `0.0600` |

Each value includes the full Platho protocol fee of `0.01 GRAM`, the shard's storage endowment, and its execution
reserve. A recovery-slot overwrite returns the surplus, so one figure covers both the first write and a rewrite. Larger
private size classes cost more by canonical class.

The PWA must show the final hold and net cost for the selected content size before signing, and must fail closed —
hiding the publish action — when chain access or the price policy is unavailable.

The protocol fee flows *through* the shard to `FeeAccumulator`; it is never accumulated inside the shard. The publisher
pays it, so a shard holds no fee bucket to protect, sweep, or flush. `FeeAccumulator` splits GRAM protocol fees between
treasury and buyback once the split is enabled.

An entry's `created_at` is a contract timestamp, not a client clock. The PWA uses it for ordering and for bounded
transaction-history lookup; a client header timestamp remains authenticated payload metadata, never discovery authority.
Retention is one year for public posts and recovery entries (`31,536,000` seconds) and one week for INTRO entries
(`604,800` seconds). After its window a shard is retireable in one permissionless call; body availability depends on TON
message-history provider coverage and the local encrypted cache.

ATH protocol-fee discounts stay locked until the activity airdrop has fully distributed its `15,000,000 ATH` and
`airdrop_remaining_ath == 0`. Before that gate every publish pays the full `0.01 GRAM` protocol fee. After unlock, ATH can
reduce only the protocol-fee component; network costs and storage reserves are still paid.

## Header 0

`header_0` has one 8-byte meta prefix and a per-lane tail. The CONV form is exactly 40 bytes:

```text
PH0C                                      4 bytes
version:u8                               1
publish_kind:u8 = 1                      1
size_class:u8                            1
crypto_suite:u8                          1
bucket_key                               32
```

`bucket_key` sits at bytes 8..40 — bits 64..320 — which is the exact window the contract extractor reads
(`loadUint(64); loadUint(256)`), so client serialization and on-chain extraction agree byte for byte.

The INTRO form is exactly 42 bytes:

```text
PH0C                                      4 bytes
version:u8                               1
publish_kind:u8 = 3                      1
size_class:u8                            1
crypto_suite:u8                          1
ephemeral_R                              32
view_tag:uint16                          2
```

The legacy private form is 74 bytes and carries `sender_key_id`, `ephemeral_scan_pub`, and `view_tag` after the meta
prefix. Write rejects any `publish_kind` other than `1` on that layout, so a self-consistent legacy header cannot be
minted claiming INTRO and be misrouted into the intro pool.

Allowed private pairs are fixed: `size_class` in `{1,2,4,8,16,32}`, `crypto_suite = 2`, implied suite `hybrid-v1`.

Neither lane header carries a recipient label, a sender signing key, or a profile pointer. `recipient_key_id`,
`sender_sign_pubkey`, `profile_version`, and `avatar_hash` were removed from `header_0` in clean-16: the recipient routing
label is gone by design, and the sender identity moved into the encrypted body as the 68-byte identity section
(`sign_pubkey:32 || profile_version:u32 || avatar_hash:u256`). Only a party that can open the body sees who sent it.

## Header 1

`header_1` is exactly 30 bytes:

```text
PH1B                                      4 bytes
version:u8                               1
flags:u8 = 0                             1
created_at_s:u32                         4
expires_at_s:u32                         4
client_nonce                             16
```

Header timestamps are second-granularity. Any thread/grouping metadata belongs in encrypted capsule metadata, not in
public header cells.

## Body Prefix

Every private body begins with `PLB1`:

```text
PLB1                                      4 bytes
version:u8                               1
suite:u8                                 1
flags:u8 = 0                             1
reserved:u8 = 0                          1
message_id:u128                          16
aes_gcm_nonce                            12
x25519_ephemeral_public                  32
ml_kem_768_ciphertext                    1088, only for hybrid-v1
aes_gcm_ciphertext_and_tag               selected plaintext slot + 16-byte tag
```

The selected plaintext slot is `32 + useful_payload_bytes`: 32 bytes of encrypted capsule metadata plus the selected
1, 2, 4, 8, 16, or 32 KiB user payload slot. The sender pads unused payload bytes with zeroes inside the selected class.

## Encrypted Plaintext Slot

AES-GCM plaintext is exactly:

```text
PCP1                                      4 bytes
version:u8                               1
kind:u8                                  1
flags:u8                                 1
media_format:u8                          1
stream_id:u128                           16
part_index:u16                           2
part_count:u16                           2
content_len:u16                          2
reserved:u16 = 0                         2
payload[useful_payload_bytes]            1024, 2048, 4096, 8192, 16384, or 32768
```

`content_len` is the number of meaningful bytes in `payload`. All bytes after `content_len` must be zero. `part_index` is
zero-based and must be less than `part_count`. `useful_payload_bytes` is derived from the signed `size_class`; it is not
chosen by the decrypted payload itself.

Content kinds:

- `1` text: UTF-8 bytes. The PWA must split text only on valid UTF-8 boundaries.
- `2` image: compressed image bytes. `media_format` is `1` WebP, `2` AVIF, `3` JPEG, `4` PNG.
- `4` document: file bytes, using the same part machinery as images.

Type `3` is reserved and unused. It was the payment-check body; that feature was retired and the byte was deliberately not
reassigned, so a body written by an old client can never be reinterpreted as a new content type.

The plaintext also carries the sections that clean-16 moved out of the cleartext header, appended after the payload slot:
the 68-byte identity section always, and the 64-byte `PSR1` sender-recovery section when body `flags` bit 0 is set. The
sender-recovery section wraps the message key under `PLATHO.SENDER_RECOVERY.KEY.V1` so a sender can reread its own
outgoing message after a device restore. Optional AEAD-protected metadata sections, selected by payload `flags`, are
`PSW1` sender wallet (69 bytes), `PRW1` recipient wallet (37 bytes), and `PSN1` sender username (up to 25 bytes).

## Multi-Part Logical Messages

The PWA chooses the smallest supported capsule class that can hold each independent text or image part, up to 32 KiB.
Content larger than 32 KiB is split into multiple independent capsules:

- all parts share the same encrypted `stream_id`;
- `part_count` is the total number of capsules for that logical item;
- `part_index` is `0..part_count-1`;
- each part is independently stored as a normal shard entry;
- grouping metadata is encrypted and must not appear in cleartext shard fields.

For each Send action, the PWA builds the full capsule plan locally, prices every capsule against the canonical publish
values, checks the user's wallet balance against the total, and then submits the capsules as sequential signed externals
from that wallet.

All outgoing sends share one request queue. Two queues mean parallel connections, which freezes low-end devices, and a
batch that bypasses the queue starves the RPC pump. The external-message limit is 65,535 bytes, measured in bytes rather
than in parts. A large external that follows another large one takes 24–203 seconds to land while small ones take 2–3, and
an image publish always carries two large externals — so the lane paces them rather than firing them together.

## Export Package Fragment

`PLC1` is package/export framing, not the `PLB1` accepted publish body. A shard stores compact metadata and hashes, while
accepted publish bodies are recovered from transaction history:

```text
PLC1                                      4 bytes
version:u8                               1
suite:u8                                 1
chunk_index:u8                           1
chunk_total:u8                           1
message_id:u128                          16
body_slice                               variable
```

For the final one-slot capsule body, `chunk_total` is always `1`. The PWA must assemble the `PLB1` body bytes before
computing the body hash or publishing to a shard.

## Cryptographic Binding

AES-GCM uses a 12-byte nonce and a 16-byte tag. The message key is derived from:

- X25519 shared secret plus ML-KEM-768 shared secret for `hybrid-v1`.

The compact AAD is:

```text
PLATHO.COMPACT_BODY.AAD.V1 || body_prefix || header0_hash || header1_hash
```

The capsule id is derived from `header0_hash`, `header1_hash`, and `body_hash`. The sender Ed25519 signature covers the
capsule id, the three cell hashes, the sender's profile version and avatar hash, and the validity timestamps — plus each
lane's own routing field, so a signature cannot be replayed across lanes:

- CONV binds `bucket_key`;
- INTRO binds `ephemeral_R` and `view_tag`;
- the legacy private form binds `sender_key_id` and `view_tag`.

## Forbidden In V1

- JSON message envelopes inside shard state.
- Off-chain pointers as the source of message delivery.
- IPFS/TON Storage/static mirror as required message storage.
- Variable-size plaintext payloads inside one capsule.
- More than one selected payload slot inside one capsule.
- Legacy pre-release capsule formats.
