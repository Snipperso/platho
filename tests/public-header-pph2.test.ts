import { describe, expect, it } from 'vitest';
import {
  publicHeaderBytesV2,
  readPublicBodyBytesV2,
  createPublicPostPayloadV2,
  readPublicPostPayloadV2,
  readPublicPartHeaderInfo,
  snakeCellFromBytes,
  PUBLIC_HEADER_MAGIC_V2,
  PUBLIC_HEADER_VERSION_V2,
  PUBLIC_HEADER_BYTES_V2,
  PUBLIC_BODY_KIND,
  PUBLIC_BODY_FLAGS,
  PUBLIC_BODY_MEDIA_FORMATS,
} from '../web/pwa-contract-transactions.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLIC-HEADER PPH2 — the clean-17 header. A header is client-defined opaque data the contract never parses, but
// the reader re-derives the body_commit from the exact header bytes, so encode and decode MUST be inverses. Three
// PPH1 fields are gone by design: the profile pointer (bypassed the paid avatar pointer — mandatory fix #4),
// parent_entry_id (no global entry id in the shard model), parent_hash (the reader already holds the parent). The
// result is ONE uniform 32-byte header, and these tests hold that shape and the decode guards in place.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const STREAM = 'ab'.repeat(16);   // 16 bytes, fixed so the header is deterministic
const CREATED = 1_790_000_123;
const bytesOf = (fill: number, len: number) => new Uint8Array(len).fill(fill);

const cases = [
  { name: 'post', input: { type: 'post', text: 'hello world', streamId: STREAM, createdAtSec: CREATED }, kind: PUBLIC_BODY_KIND.POST, type: 'post', text: 'hello world' },
  { name: 'comment', input: { type: 'comment', text: 'a reply', streamId: STREAM, createdAtSec: CREATED }, kind: PUBLIC_BODY_KIND.COMMENT, type: 'comment', text: 'a reply' },
  { name: 'image', input: { type: 'image', imageBytes: bytesOf(0x22, 300), streamId: STREAM, createdAtSec: CREATED, mediaFormat: PUBLIC_BODY_MEDIA_FORMATS.WEBP }, kind: PUBLIC_BODY_KIND.IMAGE_POST, type: 'image' },
  { name: 'image_comment', input: { type: 'image_comment', imageBytes: bytesOf(0x23, 120), streamId: STREAM, createdAtSec: CREATED, mediaFormat: PUBLIC_BODY_MEDIA_FORMATS.WEBP }, kind: PUBLIC_BODY_KIND.IMAGE_COMMENT, type: 'image_comment' },
  { name: 'avatar', input: { type: 'avatar', imageBytes: bytesOf(0x24, 900), streamId: STREAM, createdAtSec: CREATED }, kind: PUBLIC_BODY_KIND.AVATAR, type: 'avatar' },
  { name: 'document', input: { type: 'document', documentBytes: bytesOf(0x25, 500), streamId: STREAM, createdAtSec: CREATED }, kind: PUBLIC_BODY_KIND.DOCUMENT_POST, type: 'document' },
  { name: 'document_comment', input: { type: 'document_comment', documentBytes: bytesOf(0x26, 64), streamId: STREAM, createdAtSec: CREATED }, kind: PUBLIC_BODY_KIND.DOCUMENT_COMMENT, type: 'document_comment' },
];

describe('PUBLIC-HEADER PPH2', () => {
  it('PPH2-01: every kind round-trips through encode → decode', () => {
    for (const c of cases) {
      const header = publicHeaderBytesV2(c.input);
      const body = c.input.text !== undefined
        ? new TextEncoder().encode(c.input.text)
        : (c.input.imageBytes ?? c.input.documentBytes);
      const parsed = readPublicBodyBytesV2(header, body);
      expect(parsed.kind, `${c.name} kind`).toBe(c.kind);
      expect(parsed.type, `${c.name} type`).toBe(c.type);
      expect(parsed.stream_id, `${c.name} streamId`).toBe(`0x${STREAM}`);
      expect(parsed.partIndex, `${c.name} partIndex`).toBe(0);
      expect(parsed.partCount, `${c.name} partCount`).toBe(1);
      expect(parsed.createdAtSec, `${c.name} createdAt`).toBe(CREATED);
      if (c.text !== undefined) expect(parsed.text, `${c.name} text`).toBe(c.text);
    }
  });

  it('PPH2-02: the header is EXACTLY 32 bytes for every kind — one length to check', () => {
    for (const c of cases) {
      expect(publicHeaderBytesV2(c.input).length, `${c.name} header length`).toBe(PUBLIC_HEADER_BYTES_V2);
      expect(PUBLIC_HEADER_BYTES_V2).toBe(32);
    }
    expect(PUBLIC_HEADER_MAGIC_V2).toBe('PPH2');
    expect(PUBLIC_HEADER_VERSION_V2).toBe(2);
  });

  it('PPH2-03: the profile pointer and parent fields are gone — no avatar-from-header bypass, no parent id/hash', () => {
    // A post header does NOT vary in length or content whether or not an avatar was advertised: the field no longer
    // exists, so the paid KeyShard pointer is the only avatar source.
    const withAvatar = publicHeaderBytesV2({ type: 'post', text: 'x', streamId: STREAM, createdAtSec: CREATED, avatarHash: (1n << 255n), profileVersion: 9 });
    const without = publicHeaderBytesV2({ type: 'post', text: 'x', streamId: STREAM, createdAtSec: CREATED });
    expect(Buffer.from(withAvatar), 'avatar pointer input is ignored, header identical').toEqual(Buffer.from(without));

    const comment = readPublicBodyBytesV2(
      publicHeaderBytesV2({ type: 'comment', text: 'c', streamId: STREAM, createdAtSec: CREATED }),
      new TextEncoder().encode('c'),
    );
    expect('parentEntryId' in comment, 'no parent_entry_id').toBe(false);
    expect('parentHash' in comment, 'no parent_hash').toBe(false);
    expect('avatarHash' in comment, 'no avatar_hash').toBe(false);
    expect('profileVersion' in comment, 'no profile_version').toBe(false);
  });

  it('PPH2-04: COMMENTS_DISABLED round-trips on posts and is refused on non-posts', () => {
    const closed = readPublicBodyBytesV2(
      publicHeaderBytesV2({ type: 'post', text: 'x', streamId: STREAM, createdAtSec: CREATED, commentsAllowed: false }),
      new TextEncoder().encode('x'),
    );
    expect(closed.commentsAllowed, 'post carries the disabled flag').toBe(false);
    const open = readPublicBodyBytesV2(
      publicHeaderBytesV2({ type: 'post', text: 'x', streamId: STREAM, createdAtSec: CREATED }),
      new TextEncoder().encode('x'),
    );
    expect(open.commentsAllowed, 'default posts allow comments').toBe(true);
  });

  it('PPH2-05: decode REJECTS a corrupted header — the guards can actually fail', () => {
    const good = publicHeaderBytesV2({ type: 'post', text: 'x', streamId: STREAM, createdAtSec: CREATED });
    const body = new TextEncoder().encode('x');

    const badMagic = good.slice(); badMagic[0] ^= 0xff;
    expect(() => readPublicBodyBytesV2(badMagic, body)).toThrow(/magic/);

    const badVersion = good.slice(); badVersion[4] = 1;
    expect(() => readPublicBodyBytesV2(badVersion, body)).toThrow(/version/);

    expect(() => readPublicBodyBytesV2(good.slice(0, 31), body), 'a 31-byte header').toThrow(/length/);

    const badKind = good.slice(); badKind[5] = 99;
    expect(() => readPublicBodyBytesV2(badKind, body)).toThrow(/kind/);

    // a COMMENT (kind 2) may not carry WEBP media — an incoherent combination from history
    const badMedia = good.slice(); badMedia[5] = PUBLIC_BODY_KIND.COMMENT; badMedia[7] = PUBLIC_BODY_MEDIA_FORMATS.WEBP;
    expect(() => readPublicBodyBytesV2(badMedia, body)).toThrow(/media format/);

    // a comment may not carry post flags
    const badFlags = good.slice(); badFlags[5] = PUBLIC_BODY_KIND.COMMENT; badFlags[6] = PUBLIC_BODY_FLAGS.COMMENTS_DISABLED;
    expect(() => readPublicBodyBytesV2(badFlags, body)).toThrow(/flags/);
  });

  it('PPH2-06: createPublicPostPayloadV2 → readPublicPostPayloadV2 round-trips through cells, deterministically', async () => {
    const built = await createPublicPostPayloadV2({ type: 'post', text: 'through the cells', streamId: STREAM, createdAtSec: CREATED });
    expect(built.version).toBe(2);
    expect(built.headerBytes).toBe(32);
    // deterministic: same fixed input, same header hash
    const built2 = await createPublicPostPayloadV2({ type: 'post', text: 'through the cells', streamId: STREAM, createdAtSec: CREATED });
    expect(built2.headerHash, 'fixed input → fixed header hash').toBe(built.headerHash);

    const parsed = readPublicPostPayloadV2({ header: built.headerCell, body: built.bodyCell });
    expect(parsed.type).toBe('post');
    expect(parsed.text).toBe('through the cells');
    expect(parsed.stream_id).toBe(`0x${STREAM}`);
    expect(parsed.createdAtSec).toBe(CREATED);
  });

  it('PPH2-07: the multipart walker reads a PPH2 header at the shared offsets', () => {
    const header = publicHeaderBytesV2({ type: 'post', text: 'p', streamId: STREAM, createdAtSec: CREATED, partIndex: 2, partCount: 5 });
    const info = readPublicPartHeaderInfo(snakeCellFromBytes(header, 'h'));
    expect(info, 'PPH2 is walkable').not.toBeNull();
    expect(info!.streamId).toBe(`0x${STREAM}`);
    expect(info!.partIndex).toBe(2);
    expect(info!.partCount).toBe(5);
  });
});
