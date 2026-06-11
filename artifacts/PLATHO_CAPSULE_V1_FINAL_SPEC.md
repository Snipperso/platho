# Platho Capsule V1 Final Specification

Status: final v1 source of truth for PWA, CapsuleHub, tests, and audit.

This document intentionally supersedes earlier draft language that allowed JSON envelopes, hash-only messages with no
retrievable publish body, off-chain message bodies, variable-size capsule payloads, or multi-block payloads inside one
capsule. Platho v1 message bodies are accepted as binary payload cells in Vault -> CapsuleHub publish transactions and
authenticated by compact `CapsuleHub` entry state. Local history, static feeds, QR/export packages, and mirrors are cache
or transport conveniences only; they are not the v1 delivery source of truth.

## Fixed Capsule Unit

One capsule contains exactly one encrypted user payload slot selected from the supported size classes:
1, 2, 4, 8, 16, or 32 KiB. The 1 KiB class is exactly one encrypted 1024-byte useful payload slot.

Small text, payment checks, and small images are padded inside the selected slot. Long text and images are split into
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

`Export chunk bytes` means `PLC1` package/export framing. The Vault -> CapsuleHub publish body carries the assembled
`PLB1` body bytes in a snake cell, not the `PLC1` wrapper.

## CapsuleHub Storage

Private publish messages carry three retrievable cells in the accepted transaction body:

- `header_0`: exact `PH0B` header bytes in a `ton-snake-byte-cell.v1` cell.
- `header_1`: exact `PH1B` header bytes in a `ton-snake-byte-cell.v1` cell.
- `body`: exact `PLB1` encrypted body bytes in a `ton-snake-byte-cell.v1` cell.

`CapsuleHub` validates all three cells and persists only compact authenticated state: `publish_id`, `created_at = now()`,
`header_0`, `header_1`, and `body_hash`. `header_0_hash`, `header_1_hash`, and `body_hash` are the TON `Cell.hash()`
values of those exact cells. A hash without a matching accepted publish transaction body is not a readable v1 message.

Public publish messages carry two retrievable cells in the accepted transaction body:

- `header`: compact `PPH1` public metadata bytes in a `ton-snake-byte-cell.v1` cell.
- `body`: raw public content bytes in a `ton-snake-byte-cell.v1` cell.

`CapsuleHub` validates both cells and persists only `publish_id`, `created_at = now()`, `author_wallet`, `header`, and
`body_hash`. The PWA reconstructs the body from TON message history and verifies it against `body_hash` before display or
decryption.

Public content is visible to everyone, so public bodies are not encrypted, not padded to private capsule ciphertext size, and not
assigned a postquantum profile. Public text, image, and avatar bodies use the smallest fitting 1, 2, 4, 8, 16, or
32 KiB public capsule size class. Public header metadata does not reduce that body budget. Public
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
body                                     UTF-8 text bytes, 1..32768 by size_class
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
body                                     UTF-8 text bytes, 1..32768 by size_class
```

For `kind = 3` public image post, the header is 68 bytes and the body is WebP image bytes, `1..32768` by size class. For
`kind = 4` public image comment, the header is 72 bytes and includes the same parent fields as text comments. For
`kind = 5` public avatar media, the header is 68 bytes and the body is WebP avatar image bytes, `1..32768` by size class.
Public v1 uses `media_format = 0` for text and `media_format = 1` for WebP image/avatar parts.

`profile_version` and `avatar_hash` are wallet-profile pointers. They let a post point at the avatar version the author
had selected at publish time. Zero values mean no profile avatar pointer. Comments do not carry a profile pointer because
their parent reference already consumes the same compact header budget; clients may display the comment author's current
ProfileRegistry avatar when available.

Comment flags must be zero. `part_count = 1` for a one-capsule post/comment; longer public text or image data is split
into separate entries with the same `stream_id`, increasing `part_index` from zero, after filling each entry up to the
smallest fitting public size class, capped at 32 KiB. The PWA groups comments under posts by
`parent_entry_id` and `parent_body_hash` only when the parent post allows comments. CapsuleHub does not index comment
relationships, count comments, moderate content, or enforce social semantics; it stores compact public header metadata,
body hashes, timestamps, and indexes. Public body cells remain in accepted publish transaction bodies and are recovered
from message history before being verified against CapsuleHub hashes.

The official PWA exposes image compression targets before splitting into public size-class entries:

- low: WebP target <= 8 KiB.
- medium: WebP target <= 16 KiB.
- good: WebP target <= 32 KiB.
- maximum: WebP target <= 64 KiB, encoded as two 32 KiB public entries when needed.

Public product copy may say messages start from `0.0337 TON`; that is also the current exact public per-entry base
example for a 1 KiB public entry. Larger public size classes cost more because they reserve more CapsuleHub/Vault
execution capacity, but a 26 KiB avatar is one 32 KiB public entry rather than 26 separate 1 KiB entries.

CapsuleHub does not store page counters. Clients may derive page windows from sequential `entry_id` values if they want
paginated reads. A capsule published at a page boundary costs the same as any other capsule of the same profile; v1 must
not charge the first entry of a page a separate page-storage reserve.

## PWA Message Price

The official PWA may display a simple public product label of `from 0.0337 TON`, while detailed pricing surfaces display
current exact net base prices per capsule/post before ATH discount. The `0.030 TON` value is only the fixed CapsuleHub
ACK reserve, not a product "from" price:

- public post: from `0.0337 TON`.
- `hybrid-v1` private 1 KiB capsule: from `0.0347 TON`.

Those prices include the full Platho protocol fee of `0.01 TON`, CapsuleHub compact-index storage endowment, Vault local
execution reserve, and the expected ACK refund. Separately, if the PWA's current conservative fee estimate is greater
than the included network-fee allowance of `0.005 TON`, it adds only the overage, rounded upward to `0.001 TON` steps:

```text
surcharge = ceil(max(estimated_network_fee - included_network_fee_allowance, 0) / 0.001 TON) * 0.001 TON
public_entry_price     = 0.0337 TON + surcharge
hybrid_1KiB_price      = 0.0347 TON + surcharge
hybrid_larger_classes  = canonical_net_price(size_class) + surcharge
```

Example: if the estimate is `0.0065 TON`, the PWA charges `0.0357 TON` per public capsule and `0.0367 TON` per hybrid private 1 KiB capsule. If the estimate is
`0.065 TON`, the PWA caps the normal surcharge at `0.050 TON`, charging `0.0837 TON` per public capsule and `0.0847 TON` per hybrid private 1 KiB capsule unless a stricter manual override path is used.

Current `hybrid-v1` private net prices before surcharge and ATH discount are: 1 KiB `0.0347 TON`, 2 KiB `0.0366 TON`,
4 KiB `0.0403 TON`, 8 KiB `0.0479 TON`, 16 KiB `0.0632 TON`, and 32 KiB `0.0937 TON`. The PWA must show the final hold
and net cost for the selected content size before signing.

All public and private publishes go through Vault. For Vault auth-signed publishes, the PWA signs
`max_charge >= canonical_max_charge` by adding the same surcharge. The PWA must check the user's internal Vault TON
balance against the full hold for the send plan before signing. CapsuleHub has no direct user publish ABI in final v1;
the CapsuleHub call is always Vault -> CapsuleHub.

The surcharge is intentionally one-way once CapsuleHub accepts the publish. CapsuleHub success ACK returns only the fixed
publish ACK reserve of `30,000,000` nanotons (`0.030 TON`); after Vault processes that ACK, the user is credited roughly
`25,800,000` nanotons in internal Vault TON balance. The signed amount above the canonical required value is retained in
CapsuleHub as network/storage reserve overage. It is not `accrued_plato_fee_ton` and not a Vault refund.

CapsuleHub exposes live private/public entry counters for reserve accounting. Its protected raw TON reserve is:

```text
protected = accrued_plato_fee_ton
          + max(100 TON, 1.25 * live_index_1y_storage_reserve)
```

where `live_index_1y_storage_reserve` is based on currently unpruned private/public compact indexes, not historical
`latest_id` counters. A permissionless `SweepExcessReserve` call may move only raw balance above that protected amount
to FeeAccumulator as `DepositProtocolFee`. Before buyback split is enabled this eventually becomes treasury due; after
the split is enabled it follows the normal treasury/buyback split. Sweep is not part of the user publish path and must
not add gas to ordinary message sending. If the sweep deposit bounces, CapsuleHub intentionally reclassifies the
returned amount as backed `accrued_plato_fee_ton` so the value can be retried through the normal fee flush path.
Normal partial `FlushFees` calls must be at least the current public protocol fee (`0.010 TON`); a smaller amount is
valid only when it is the entire remaining accrued bucket, so discounted dust can still be finalized.

`CapsuleHub` entries include a contract timestamp, not a client-clock timestamp. The PWA uses entry `created_at` for
message ordering and bounded transaction-history lookup. Compact index/header entries are retained for at least the
configured one-year window and can be pruned permissionlessly after that window; body availability depends on TON
message-history provider coverage and local encrypted cache.

`protocol_fee_paid` exists only on Vault -> CapsuleHub publish messages, because Vault is the contract that knows the
sender's ATH discount state. This keeps public channels and private messages on the same discount path. The discount
path is locked until Vault activity rewards have fully distributed the 15,000,000 ATH activity airdrop and
`airdrop_remaining_ath == 0`; before that gate, Vault pays the full message protocol fee. After unlock, ATH can reduce
only the protocol-fee component. With the current `0.010 TON` (`10,000,000 nanotons`) full protocol fee, a user at the
`10,000 ATH` threshold receives the full protocol-fee discount for that component; network costs and storage reserves
are still paid.

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

- `size_class` in `{1,2,4,8,16,32}`, `crypto_suite = 2`, implied suite `hybrid-v1`.

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
- `3` payment check: `asset:u8 || reserved:u8 || amount:u128 || intent_id:uint256 || secret32:uint256`, 82 bytes.

Payment check bodies do not include `tx`, activation time, or expiry. The receiver claims with `intent_id + secret32`.
If claim fails because the sender cancelled or the check was already claimed, the Russian UI message is:
"чек уже активирован или отменён отправителем."

## Multi-Part Logical Messages

The PWA chooses the smallest supported capsule class that can hold each independent text or image part, up to 32 KiB.
Content larger than 32 KiB is split into multiple independent capsules:

- all parts share the same encrypted `stream_id`;
- `part_count` is the total number of capsules for that logical item;
- `part_index` is `0..part_count-1`;
- each part is independently stored as a normal CapsuleHub entry;
- grouping metadata is encrypted and must not appear in public CapsuleHub fields.

For each Send action, the PWA builds the full capsule plan locally, prices every capsule against Vault canonical charges,
checks the user's internal Vault TON balance for the total hold, and then submits the capsules through sequential signed
Vault external publishes. Multi-part text and compressed images are allowed when the Vault balance can cover the full
plan.

## Export Package Fragment

`PLC1` is package/export framing, not the `PLB1` accepted publish body. CapsuleHub stores compact metadata and hashes,
while accepted publish bodies are recovered from transaction history:

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
- More than one selected payload slot inside one capsule.
- Legacy pre-release capsule formats.
