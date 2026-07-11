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

  it('PWA-PROFILE-CODEC-03: owner-username round-trips, is byte-capped, and old-format blocks decode to "" (no crash)', async () => {
    const m = await import('../web/capsule-part-policy.mjs');
    // Round-trip WITH a username (bare name, no ".ath").
    const withName = m.decodeProfileBlockContent(m.encodeProfileBlockContent({ description: 'hi', tags: ['a', 'b'], ownerUsername: 'glasnost' }));
    expect(withName!.ownerUsername).toBe('glasnost');
    expect(withName!.description).toBe('hi');
    expect(withName!.tags).toEqual(['a', 'b']);
    // No linked name -> zero-length username field, decodes to ''.
    const noName = m.decodeProfileBlockContent(m.encodeProfileBlockContent({ description: 'hi', tags: ['a'], ownerUsername: '' }));
    expect(noName!.ownerUsername).toBe('');
    // Username is byte-capped.
    const capped = m.decodeProfileBlockContent(m.encodeProfileBlockContent({ description: '', tags: [], ownerUsername: 'x'.repeat(200) }));
    expect(m.utf8ByteLength(capped!.ownerUsername)).toBeLessThanOrEqual(m.PROFILE_USERNAME_MAX_BYTES);
    // FORWARD/BACKWARD COMPAT: a pre-username (old-format) block — [version][descLen][desc][tagCount][tags] with NO
    // trailing username — must decode cleanly (description+tags intact, ownerUsername '') and NEVER crash/null.
    const enc = new TextEncoder();
    const desc = enc.encode('old channel');
    const tag = enc.encode('freespeech');
    const old = new Uint8Array(1 + 2 + desc.length + 1 + (1 + tag.length));
    old[0] = m.PROFILE_BLOCK_CONTENT_VERSION;
    old[1] = (desc.length >> 8) & 0xff; old[2] = desc.length & 0xff;
    old.set(desc, 3);
    let o = 3 + desc.length; old[o++] = 1; old[o++] = tag.length; old.set(tag, o);
    const decodedOld = m.decodeProfileBlockContent(old);
    expect(decodedOld).not.toBe(null);
    expect(decodedOld!.description).toBe('old channel');
    expect(decodedOld!.tags).toEqual(['freespeech']);
    expect(decodedOld!.ownerUsername).toBe('');
    // A truncated username trailer must never null the profile — description+tags survive, username falls back to ''.
    const full = m.encodeProfileBlockContent({ description: 'hi', tags: ['a'], ownerUsername: 'glasnost' });
    const chopped = full.slice(0, full.length - 3);
    const decodedChop = m.decodeProfileBlockContent(chopped);
    expect(decodedChop).not.toBe(null);
    expect(decodedChop!.description).toBe('hi');
    expect(decodedChop!.ownerUsername).toBe('');
  });

  it('PWA-SHARE-CODEC-01: shared-post content round-trips exactly (chain coords + snapshot + flags, incl. non-ASCII)', async () => {
    const m = await import('../web/capsule-part-policy.mjs');
    const share = {
      entryId: '123456789',
      bodyHash: `0x${'ab'.repeat(32)}`,
      authorWallet: '0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      author: 'канал «Гласность»',
      title: 'Заголовок поста 🌍',
      snippet: 'Первый абзац.\n\nВторой абзац с эмодзи 🚀 и текстом.',
      hasImage: true,
      textTruncated: false,
    };
    const decoded = m.decodeShareBlockContent(m.encodeShareBlockContent(share));
    expect(decoded).toEqual(share);
    // uint64 bounds — 0 and max round-trip, negatives/overflow throw (the REPLY-CODEC-02 contract).
    const base = { ...share, author: '', title: '', snippet: '' };
    expect(m.decodeShareBlockContent(m.encodeShareBlockContent({ ...base, entryId: '0' }))?.entryId).toBe('0');
    expect(m.decodeShareBlockContent(m.encodeShareBlockContent({ ...base, entryId: '18446744073709551615' }))?.entryId)
      .toBe('18446744073709551615');
    expect(() => m.encodeShareBlockContent({ ...base, entryId: '-1' })).toThrow();
    expect(() => m.encodeShareBlockContent({ ...base, entryId: '18446744073709551616' })).toThrow();
    // bodyHash + authorWallet are REQUIRED (the share gate mirrors the comment gate).
    expect(() => m.encodeShareBlockContent({ ...base, bodyHash: '0x1234' })).toThrow();
    expect(() => m.encodeShareBlockContent({ ...base, authorWallet: '' })).toThrow();
  });

  it('PWA-SHARE-CODEC-02: byte caps (unicode-safe), truncation flag survives a pre-truncated draft, null-on-malformed', async () => {
    const m = await import('../web/capsule-part-policy.mjs');
    const base = {
      entryId: '7',
      bodyHash: `0x${'cd'.repeat(32)}`,
      authorWallet: '0:bb',
    };
    // Snippet/author/title are BYTE-capped on encode, never mid-codepoint.
    const capped = m.decodeShareBlockContent(m.encodeShareBlockContent({
      ...base,
      author: 'я'.repeat(200),
      title: 'ж'.repeat(200),
      snippet: 'ю'.repeat(5000),
    }));
    expect(m.utf8ByteLength(capped!.author)).toBeLessThanOrEqual(m.SHARE_AUTHOR_MAX_BYTES);
    expect(m.utf8ByteLength(capped!.title)).toBeLessThanOrEqual(m.SHARE_TITLE_MAX_BYTES);
    expect(m.utf8ByteLength(capped!.snippet)).toBeLessThanOrEqual(m.SHARE_SNIPPET_MAX_BYTES);
    // The encoder's own cut sets the flag...
    expect(capped!.textTruncated).toBe(true);
    // ...and a draft PRE-truncated by the composer (echo == wire) keeps the flag even though the re-cut is a no-op.
    const preCut = m.decodeShareBlockContent(m.encodeShareBlockContent({ ...base, snippet: 'short', textTruncated: true }));
    expect(preCut!.textTruncated).toBe(true);
    expect(preCut!.hasImage).toBe(false);
    // Malformed / future frames decode to null — a bad share block never poisons the carrying message.
    expect(m.decodeShareBlockContent(new Uint8Array())).toBe(null);
    expect(m.decodeShareBlockContent(new Uint8Array(64).fill(9))).toBe(null); // future version byte
    const good = m.encodeShareBlockContent({ ...base, author: 'ab', title: 'cd', snippet: 'ef' });
    expect(m.decodeShareBlockContent(good.slice(0, 44))).toBe(null); // chopped inside the wallet field
    const badWalletLen = good.slice();
    badWalletLen[42] = 0xff; // wallet length points past the buffer
    expect(m.decodeShareBlockContent(badWalletLen)).toBe(null);
  });
});
