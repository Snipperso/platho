import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  messagePartCount,
  messagePartCountForBytes,
  MAX_CAPSULE_USEFUL_BYTES,
  SINGLE_CAPSULE_USEFUL_BYTES,
  singleCapsuleMessageFits,
  splitBytesToCapsuleParts,
  splitBytesToParts,
  splitUtf8ToCapsuleParts,
  splitUtf8ToParts,
  truncateUtf8ToBytes,
  utf8ByteLength,
  encodeReplyBlockContent,
  decodeReplyBlockContent,
  REPLY_AUTHOR_MAX_BYTES,
  REPLY_SNIPPET_MAX_BYTES,
} from '../web/capsule-part-policy.mjs';

describe('PWA capsule part policy', () => {
  it('PWA-CAPSULE-PART-01: unconnected wallet mode allows exactly one 1024-byte useful segment', () => {
    expect(SINGLE_CAPSULE_USEFUL_BYTES).toBe(1024);
    expect(singleCapsuleMessageFits('a'.repeat(1024), false)).toBe(true);
    expect(singleCapsuleMessageFits('a'.repeat(1025), false)).toBe(false);
    expect(singleCapsuleMessageFits('a'.repeat(1025), true)).toBe(true);
  });

  it('PWA-CAPSULE-PART-02: UTF-8 byte accounting handles Cyrillic and emoji', () => {
    expect(utf8ByteLength('hello')).toBe(5);
    expect(utf8ByteLength('\u041f\u0440\u0438\u0432\u0435\u0442')).toBe(12);
    expect(utf8ByteLength('\u26a1')).toBe(3);
    expect(utf8ByteLength('\ud83d\ude80')).toBe(4);
  });

  it('PWA-CAPSULE-PART-03: truncation keeps valid UTF-8 symbol boundaries', () => {
    expect(truncateUtf8ToBytes('a\ud83d\ude80b', 5)).toBe('a\ud83d\ude80');
    expect(truncateUtf8ToBytes('\u041f\u0440\u0438\u0432\u0435\u0442', 5)).toBe('\u041f\u0440');
    expect(utf8ByteLength(truncateUtf8ToBytes('\ud83d\ude80'.repeat(300), 1024))).toBe(1024);
  });

  it('PWA-CAPSULE-PART-04: Vault-balance publish mode unlocks multi-segment sends', () => {
    expect(singleCapsuleMessageFits('a'.repeat(1025), false)).toBe(false);
    expect(singleCapsuleMessageFits('a'.repeat(1025), true)).toBe(true);
  });

  it('PWA-CAPSULE-PART-05: send plan counts 1024-byte parts without splitting UTF-8 symbols', () => {
    expect(messagePartCountForBytes(0)).toBe(1);
    expect(messagePartCountForBytes(1024)).toBe(1);
    expect(messagePartCountForBytes(1025)).toBe(2);
    expect(messagePartCount('a'.repeat(2049))).toBe(3);

    const parts = splitUtf8ToParts('a'.repeat(1023) + '\ud83d\ude80' + 'b', 1024);
    expect(parts).toHaveLength(2);
    expect(utf8ByteLength(parts[0])).toBe(1023);
    const byteParts = splitBytesToParts(new Uint8Array(8 * 1024 + 17).fill(1), SINGLE_CAPSULE_USEFUL_BYTES);
    expect(byteParts).toHaveLength(9);
    expect(byteParts[0]).toHaveLength(1024);
    expect(byteParts[8]).toHaveLength(17);
    expect(parts[1]).toBe('\ud83d\ude80b');
  });

  it('PWA-CAPSULE-PART-06: Vault publish uses independent 1-32 KiB capsule sizes', () => {
    expect(MAX_CAPSULE_USEFUL_BYTES).toBe(32 * 1024);

    const tinyText = splitUtf8ToCapsuleParts('a'.repeat(1024));
    expect(tinyText).toHaveLength(1);
    expect(tinyText[0]).toMatchObject({ sizeClass: 1, usefulBytes: 1024 });

    const text2 = splitUtf8ToCapsuleParts('a'.repeat(2 * 1024));
    expect(text2).toHaveLength(1);
    expect(text2[0]).toMatchObject({ sizeClass: 2, usefulBytes: 2 * 1024 });

    const text32 = splitUtf8ToCapsuleParts('a'.repeat(32 * 1024));
    expect(text32).toHaveLength(1);
    expect(text32[0]).toMatchObject({ sizeClass: 32, usefulBytes: 32 * 1024 });

    const text33 = splitUtf8ToCapsuleParts('a'.repeat((32 * 1024) + 1));
    expect(text33.map((part) => part.sizeClass)).toEqual([32, 1]);

    const image33 = splitBytesToCapsuleParts(new Uint8Array((32 * 1024) + 1).fill(1));
    expect(image33.map((part) => part.sizeClass)).toEqual([32, 1]);
    expect(image33.map((part) => part.bytes.length)).toEqual([32 * 1024, 1]);

    const withSenderMetadata = splitUtf8ToCapsuleParts('a'.repeat(1024), MAX_CAPSULE_USEFUL_BYTES, {
      perPartOverheadBytes: 69,
    });
    expect(withSenderMetadata).toHaveLength(1);
    expect(withSenderMetadata[0]).toMatchObject({ sizeClass: 2, usefulBytes: 2 * 1024 });
  });

  it('PWA-CAPSULE-PART-07: private composer text path cannot fall back to legacy 1 KiB splitting', () => {
    const appSource = readFileSync(join(process.cwd(), 'web', 'app.js'), 'utf8');
    expect(appSource.match(/function privateTextCapsulePartsForSend\s*\(/g) ?? []).toHaveLength(1);
    expect(appSource).not.toMatch(/function privateTextPartsForSend\s*\(/);
    expect(appSource).toMatch(/function privateTextCapsulePartsForSend\s*\([^)]*\)[\s\S]*return splitUtf8ToCapsuleParts\(text, MAX_CAPSULE_USEFUL_BYTES,\s*\{/);
    expect(appSource).toMatch(/perPartOverheadBytes: privateCompactPayloadOverhead\(options\)/);
    expect(appSource).toMatch(/function createPrivateComposerCapsules[\s\S]*messageDocumentBytesFromDraft\(text, attachments/);
    expect(appSource).toMatch(/function createPrivateComposerCapsules[\s\S]*splitBytesToCapsuleParts\(documentBytes, MAX_CAPSULE_USEFUL_BYTES,\s*\{/);
    expect(appSource).toMatch(/function createPrivateComposerCapsules[\s\S]*perPartOverheadBytes: privateCompactPayloadOverhead\(options\)/);
    expect(appSource).not.toMatch(/function createPrivateComposerCapsules[\s\S]*splitUtf8ToParts\(text, SINGLE_CAPSULE_USEFUL_BYTES/);
  });

  // Swipe-to-reply (v646): the REPLY document block content codec — the wire bytes a reply quote rides in, on
  // BOTH surfaces (private messages + public document posts/comments share the PDC1 container).
  it('PWA-REPLY-CODEC-01: reply content round-trips exactly (incl. non-ASCII author/snippet)', () => {
    const decoded = decodeReplyBlockContent(encodeReplyBlockContent({
      refEntryId: '42',
      author: 'Лариса.ath',
      snippet: 'Привет, мир! 🌍',
    }));
    expect(decoded).toEqual({ refEntryId: '42', author: 'Лариса.ath', snippet: 'Привет, мир! 🌍' });
  });

  it('PWA-REPLY-CODEC-02: uint64 bounds — entry id 0 and max round-trip, negatives/overflow throw', () => {
    expect(decodeReplyBlockContent(encodeReplyBlockContent({ refEntryId: '0', author: '', snippet: '' }))?.refEntryId).toBe('0');
    expect(decodeReplyBlockContent(encodeReplyBlockContent({ refEntryId: '18446744073709551615', author: 'a', snippet: 'b' }))?.refEntryId)
      .toBe('18446744073709551615');
    expect(() => encodeReplyBlockContent({ refEntryId: '-1', author: '', snippet: '' })).toThrow();
    expect(() => encodeReplyBlockContent({ refEntryId: '18446744073709551616', author: '', snippet: '' })).toThrow();
  });

  it('PWA-REPLY-CODEC-03: author/snippet are BYTE-capped on encode (unicode-safe truncation, never mid-codepoint)', () => {
    const decoded = decodeReplyBlockContent(encodeReplyBlockContent({
      refEntryId: '7',
      author: 'ю'.repeat(200), // 2 bytes each -> capped to 64 bytes = 32 chars
      snippet: 'щ'.repeat(500), // capped to 160 bytes = 80 chars
    }));
    expect(utf8ByteLength(decoded!.author)).toBeLessThanOrEqual(REPLY_AUTHOR_MAX_BYTES);
    expect(utf8ByteLength(decoded!.snippet)).toBeLessThanOrEqual(REPLY_SNIPPET_MAX_BYTES);
    expect(decoded!.author).toBe('ю'.repeat(32));
    expect(decoded!.snippet).toBe('щ'.repeat(80));
  });

  it('PWA-REPLY-CODEC-04: malformed/future content decodes to null — a bad quote must never poison the message', () => {
    expect(decodeReplyBlockContent(new Uint8Array())).toBe(null);
    expect(decodeReplyBlockContent(new Uint8Array([1, 0, 0, 0]))).toBe(null); // truncated
    expect(decodeReplyBlockContent(new Uint8Array([9, 0, 0, 0, 0, 0, 0, 0, 42, 0]))).toBe(null); // future version
    // authorLen pointing past the buffer -> null, not a throw
    const bad = encodeReplyBlockContent({ refEntryId: '1', author: 'ab', snippet: '' });
    bad[9] = 200;
    expect(decodeReplyBlockContent(bad)).toBe(null);
  });
});

// File-block content codec (v652): the wire bytes an arbitrary attachment rides in.
describe('file block content codec', () => {
  it('PWA-FILE-CODEC-01: round-trips name/mime/bytes (incl. cyrillic filenames)', async () => {
    const m = await import('../web/capsule-part-policy.mjs');
    const bytes = new Uint8Array(1024).map((_, i) => (i * 13 + 7) & 0xff);
    const decoded = m.decodeFileBlockContent(m.encodeFileBlockContent({
      name: 'отчёт за июнь.pdf', mime: 'application/pdf', bytes,
    }));
    expect(decoded!.name).toBe('отчёт за июнь.pdf');
    expect(decoded!.mime).toBe('application/pdf');
    expect(Buffer.from(decoded!.bytes)).toEqual(Buffer.from(bytes));
  });

  it('PWA-FILE-CODEC-02: caps + defaults + null-on-malformed (a bad frame never poisons the message)', async () => {
    const m = await import('../web/capsule-part-policy.mjs');
    // Name is byte-capped unicode-safe; empty mime decodes to the octet-stream default.
    const decoded = m.decodeFileBlockContent(m.encodeFileBlockContent({
      name: 'ю'.repeat(600), mime: '', bytes: new Uint8Array([1]),
    }));
    expect(m.utf8ByteLength(decoded!.name)).toBeLessThanOrEqual(m.FILE_NAME_MAX_BYTES);
    expect(decoded!.mime).toBe('application/octet-stream');
    // Encode rejects empties; decode nulls on junk.
    expect(() => m.encodeFileBlockContent({ name: 'a', mime: 'x', bytes: new Uint8Array() })).toThrow();
    expect(m.decodeFileBlockContent(new Uint8Array())).toBe(null);
    expect(m.decodeFileBlockContent(new Uint8Array([9, 0, 1, 65, 0, 1]))).toBe(null); // future version
    const truncated = m.encodeFileBlockContent({ name: 'ab', mime: 'x', bytes: new Uint8Array([1, 2]) });
    truncated[1] = 0xff; truncated[2] = 0xff; // nameLen points past the buffer
    expect(m.decodeFileBlockContent(truncated)).toBe(null);
  });
});

// Channel-profile content codec: a channel's public self-description (free-text + user tags) rides here.
describe('profile block content codec', () => {
  it('PWA-PROFILE-CODEC-01: round-trips description + tags (incl. cyrillic)', async () => {
    const m = await import('../web/capsule-part-policy.mjs');
    const decoded = m.decodeProfileBlockContent(m.encodeProfileBlockContent({
      description: 'Канал про природу и походы 🏔️', tags: ['природа', 'походы', 'ton'],
    }));
    expect(decoded!.description).toBe('Канал про природу и походы 🏔️');
    expect(decoded!.tags).toEqual(['природа', 'походы', 'ton']);
  });

  it('PWA-PROFILE-CODEC-02: normalizes tags (lowercase/trim/dedupe/cap) + byte caps + null-on-malformed', async () => {
    const m = await import('../web/capsule-part-policy.mjs');
    // Tags are lowercased, trimmed, de-duplicated and capped at PROFILE_MAX_TAGS.
    expect(m.normalizeProfileTags([' TON ', 'ton', 'Nature', 'nature', ''])).toEqual(['ton', 'nature']);
    expect(m.normalizeProfileTags(Array.from({ length: 50 }, (_, i) => `t${i}`)).length).toBe(m.PROFILE_MAX_TAGS);
    // Description is byte-capped unicode-safe; empty description + no tags still round-trips.
    const capped = m.decodeProfileBlockContent(m.encodeProfileBlockContent({ description: 'я'.repeat(600), tags: [] }));
    expect(m.utf8ByteLength(capped!.description)).toBeLessThanOrEqual(m.PROFILE_DESCRIPTION_MAX_BYTES);
    expect(capped!.tags).toEqual([]);
    const empty = m.decodeProfileBlockContent(m.encodeProfileBlockContent({ description: '', tags: [] }));
    expect(empty!.description).toBe('');
    // Decode nulls on junk / future version / truncation — a bad profile block never poisons the post.
    expect(m.decodeProfileBlockContent(new Uint8Array())).toBe(null);
    expect(m.decodeProfileBlockContent(new Uint8Array([9, 0, 0, 0]))).toBe(null); // future version
    const truncated = m.encodeProfileBlockContent({ description: 'ab', tags: ['x'] });
    truncated[1] = 0xff; truncated[2] = 0xff; // descLen points past the buffer
    expect(m.decodeProfileBlockContent(truncated)).toBe(null);
  });
});
