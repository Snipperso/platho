# Platho Capsule V1 Final Specification

Status: final v1 source of truth for PWA, CapsuleHub, tests, and audit.

This document intentionally supersedes earlier draft language that allowed JSON envelopes, hash-only messages, off-chain
message bodies, variable-size capsule payloads, or multi-block payloads inside one capsule. Platho v1 messages are stored
as retrievable encrypted payload cells in `CapsuleHub`. Local history, static feeds, QR/export packages, and mirrors are
cache or transport conveniences only; they are not the v1 delivery source of truth.

## Fixed Capsule Unit

One capsule contains exactly one encrypted 1024-byte user payload slot.

Small text, payment checks, and small images are padded inside this slot. Long text and images are split into multiple
capsules with encrypted sequence metadata. A single capsule must never reveal from its physical size whether it contains
text, a payment check, an image, or a continuation part.

The only visible size distinction is the selected crypto suite:

| Suite | `size_class` | `crypto_suite` | Useful payload slot | Encrypted body bytes | Export chunk bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `classical-v1` | `1` | `1` | 1024 | 1140 | 1164 |
| `hybrid-v1` | `2` | `2` | 1024 | 2228 | 2252 |

`Export chunk bytes` means `PLC1` package/export framing. `CapsuleHub.body` stores the assembled `PLB1` body bytes in a
snake cell, not the `PLC1` wrapper.

## CapsuleHub Storage

Private publish messages store three retrievable cells:

- `header_0`: exact `PH0B` header bytes in a `ton-snake-byte-cell.v1` cell.
- `header_1`: exact `PH1B` header bytes in a `ton-snake-byte-cell.v1` cell.
- `body`: exact `PLB1` encrypted body bytes in a `ton-snake-byte-cell.v1` cell.

`header_0_hash`, `header_1_hash`, and `body_hash` are the TON `Cell.hash()` values of those exact cells. A hash without
the matching persisted cell is not a v1 message.

Public publish messages store two retrievable cells:

- `header`: compact `PPH1` public metadata bytes in a `ton-snake-byte-cell.v1` cell.
- `body`: raw public content bytes in a `ton-snake-byte-cell.v1` cell.

Public content is visible to everyone, so public bodies are not encrypted, not padded to private capsule size, and not
assigned a postquantum profile. Public text bodies are `1..1024` UTF-8 bytes for both posts and comments. Public image
bodies are `1..1024` compressed media bytes per entry. Public header metadata does not reduce either body budget. Public
publish messages must also include the fixed on-chain marker:

```text
marketing_note:uint152 = ASCII "sent via Platho.App"
```

The official messenger UI must not render that marker as message text.

Public payloads are immutable. There is no edit/delete/reaction/counter layer in v1.

```text
PPH1                                      4 bytes
version:u8 = 1                           1
kind:u8                                  1
flags:u8                                1
media_format:u8                          1
stream_id:uint128                        16
part_index:uint16                        2
part_count:uint16                        2
part_reserved:uint32 = 0                 4
profile_version:uint32                   4, posts/images/avatar only
avatar_hash:uint256                      32, posts/images/avatar only
```

For `kind = 1` public post:

```text
header bytes                             68
body                                     UTF-8 text bytes, 1..1024
```

Post flags:

```text
bit 0 = 1                                comments closed for this post
bits 1..7 = 0                            reserved
```

For `kind = 2` one-level public comment:

```text
parent_entry_id:uint64                   8
parent_body_hash:uint256                 32
header bytes                             72
body                                     UTF-8 text bytes, 1..1024
```

For `kind = 3` public image post, the header is 68 bytes and the body is WebP image bytes, `1..1024` per part. For
`kind = 4` public image comment, the header is 72 bytes and includes the same parent fields as text comments. For
`kind = 5` public avatar media, the header is 68 bytes and the body is WebP avatar image bytes, `1..1024` per part.
Public v1 uses `media_format = 0` for text and `media_format = 1` for WebP image/avatar parts.

`profile_version` and `avatar_hash` are wallet-profile pointers. They let a post point at the avatar version the author
had selected at publish time. Zero values mean no profile avatar pointer. Comments do not carry a profile pointer because
their parent reference already consumes the same compact header budget; clients may display the comment author's current
ProfileRegistry avatar when available.

Comment flags must be zero. `part_count = 1` for a one-capsule post/comment; longer public text or image data is split
into separate entries with the same `stream_id`, increasing `part_index` from zero. The PWA groups comments under posts by
`parent_entry_id` and `parent_body_hash` only when the parent post allows comments. CapsuleHub does not index comment
relationships, count comments, moderate content, or enforce social semantics; it only stores the public header/body cells.

The official PWA exposes two image compression targets before splitting into 1024-byte entries:

- standard: WebP target <= 8 KiB.
- improved: WebP target <= 16 KiB.

The public per-post base price is `0.010 TON`, using the same surcharge rule as `classical-v1`.

CapsuleHub does not store page counters. Clients may derive page windows from sequential `entry_id` values if they want
paginated reads. A capsule published at a page boundary costs the same as any other capsule of the same profile; v1 must
not charge the first entry of a page a separate page-storage reserve.

## PWA Message Price

The official PWA displays simple base prices per capsule/post:

- public post: `0.010 TON`.
- `classical-v1`: `0.010 TON`.
- `hybrid-v1`: `0.020 TON`.

Those prices include up to `0.005 TON` of estimated network/execution cost. If the PWA's current conservative fee
estimate is greater than `0.005 TON`, it adds only the overage, rounded upward to `0.001 TON` steps:

```text
surcharge = ceil(max(estimated_network_fee - 0.005 TON, 0) / 0.001 TON) * 0.001 TON
standard_price = 0.010 TON + surcharge
hybrid_price   = 0.020 TON + surcharge
```

Example: if the estimate is `0.0065 TON`, the PWA charges `0.012 TON` for `classical-v1` and `0.022 TON` for
`hybrid-v1`. If the estimate is `0.065 TON`, the PWA charges `0.070 TON` and `0.080 TON`.

All public and private publishes go through Vault. For Vault session publishes, the PWA signs
`max_charge >= canonical_max_charge` by adding the same surcharge. If a user has no allocated Message Budget, the PWA may
ask for a wallet-confirmed Vault publish transaction for the single capsule, but the CapsuleHub call is still
Vault -> CapsuleHub. CapsuleHub has no direct user publish ABI in final v1.

`protocol_fee_paid` exists only on Vault -> CapsuleHub publish messages, because Vault is the contract that knows the
sender's ATH discount state. This keeps public channels and private messages on the same discount path. The discount
path is locked until Vault activity rewards have distributed 15,000,000 ATH; before that gate, Vault pays the full
message protocol fee.

## Header 0

`header_0` is exactly 140 bytes:

```text
PH0B                                      4 bytes
version:u8                               1
publish_kind:u8                          1
size_class:u8                            1
crypto_suite:u8                          1
sender_key_id                            32
recipient_key_id                         32
sender_sign_pubkey                       32
profile_version:uint32                   4
avatar_hash:uint256                      32
```

Allowed private pairs are fixed:

- `size_class = 1`, `crypto_suite = 1`, implied suite `classical-v1`.
- `size_class = 2`, `crypto_suite = 2`, implied suite `hybrid-v1`.

`profile_version` and `avatar_hash` are the sender wallet avatar pointer at send time. Zero values mean no avatar pointer.
They are part of `header_0`, so they are covered by the header hash and sender signature. `recipient_sign_pubkey` is
intentionally not stored in each capsule. The sender key must be self-contained for signature verification; the recipient
already has their own key material.

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
aes_gcm_ciphertext_and_tag               fixed plaintext slot + 16-byte tag
```

The fixed plaintext slot is 1056 bytes: 32 bytes of encrypted capsule metadata plus 1024 user payload bytes.

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
payload[1024]                            1024
```

`content_len` is the number of meaningful bytes in `payload`. All bytes after `content_len` must be zero. `part_index` is
zero-based and must be less than `part_count`.

Content kinds:

- `1` text: UTF-8 bytes. The PWA must split text only on valid UTF-8 boundaries.
- `2` image: compressed image bytes. `media_format` is `1` WebP, `2` AVIF, `3` JPEG, `4` PNG.
- `3` payment check: `asset:u8 || reserved:u8 || amount:u128 || intent_id:uint256 || secret32:uint256`, 82 bytes.

Payment check bodies do not include `tx`, activation time, or expiry. The receiver claims with `intent_id + secret32`.
If claim fails because the sender cancelled or the check was already claimed, the Russian UI message is:
"чек уже активирован или отменён отправителем."

## Multi-Part Logical Messages

For content longer than 1024 bytes, the PWA creates multiple capsules:

- all parts share the same encrypted `stream_id`;
- `part_count` is the total number of capsules for that logical item;
- `part_index` is `0..part_count-1`;
- each part is independently stored as a normal CapsuleHub entry;
- grouping metadata is encrypted and must not appear in public CapsuleHub fields.

Without an allocated Vault Message Budget, the PWA must allow only one capsule per Send action and must not expose
attachments. With an allocated Message Budget, the PWA may send multi-part text or compressed images without repeatedly
asking the wallet to approve each capsule.

## Export Package Fragment

`PLC1` is package/export framing, not the body stored by `CapsuleHub`:

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
computing `body_hash` or publishing to `CapsuleHub`.

## Cryptographic Binding

AES-GCM uses a 12-byte nonce and a 16-byte tag. The message key is derived from:

- X25519 shared secret for `classical-v1`;
- X25519 shared secret plus ML-KEM-768 shared secret for `hybrid-v1`.

The compact AAD is:

```text
PLATHO.COMPACT_BODY.AAD.V1 || body_prefix || header0_hash || header1_hash
```

The capsule id is derived from `header0_hash`, `header1_hash`, and `body_hash`. The sender Ed25519 signature covers the
capsule id, the three cell hashes, sender/recipient key ids, and validity timestamps.

## Forbidden In V1

- JSON message envelopes inside `CapsuleHub`.
- Off-chain pointers as the source of message delivery.
- IPFS/TON Storage/static mirror as required message storage.
- Variable-size plaintext payloads inside one capsule.
- More than one 1024-byte user payload slot inside one capsule.
- Legacy pre-release capsule formats.
