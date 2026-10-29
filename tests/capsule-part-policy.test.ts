import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  messagePartCount,
  messagePartCountForBytes,
  MAX_CAPSULE_USEFUL_BYTES,
  encodeProfileBlockContent,
  decodeProfileBlockContent,
  decodeShareBlockContent,
  decodeFileBlockContent,
  encodeFileBlockContent,
  mediaTypeIn,
  PROFILE_DESCRIPTION_MAX_BYTES,
  PROFILE_TAG_MAX_BYTES,
  PROFILE_MAX_TAGS,
  SHARE_SNIPPET_MAX_BYTES,
  SHARE_TITLE_MAX_BYTES,
  normalizeProfileGroups,
  PROFILE_GROUPS_MAX,
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
    expect(appSource).not.toMatch(/function privateTextPartsForSend\s*\(/);
    const convSend = appSource.slice(
      appSource.indexOf('async function attemptConvMessagePublishDirect'),
      appSource.indexOf('async function attemptPrivateComposerMessagePublish'),
    );
    expect(convSend).toMatch(/messageDocumentBytesFromDraft\(\s*context\.text, context\.attachments/);
    expect(convSend).toMatch(/splitBytesToCapsuleParts\(documentBytes, MAX_CAPSULE_USEFUL_BYTES,\s*\{/);
    expect(convSend).toMatch(/perPartOverheadBytes: privateCompactPayloadOverhead\(senderOptions\)/);
    expect(convSend).not.toMatch(/splitUtf8ToParts\(/);
  });

  it('PWA-REPLY-CODEC-01: reply content round-trips exactly (incl. non-ASCII author/snippet)', () => {
    const decoded = decodeReplyBlockContent(encodeReplyBlockContent({
      refEntryId: '42',
      author: 'Пример.ath',
      snippet: 'Привет, мир! 🌍',
    }));
    expect(decoded).toEqual({ refEntryId: '42', author: 'Пример.ath', snippet: 'Привет, мир! 🌍' });
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
      author: 'ю'.repeat(200),
      snippet: 'щ'.repeat(500),
    }));
    expect(utf8ByteLength(decoded!.author)).toBeLessThanOrEqual(REPLY_AUTHOR_MAX_BYTES);
    expect(utf8ByteLength(decoded!.snippet)).toBeLessThanOrEqual(REPLY_SNIPPET_MAX_BYTES);
    expect(decoded!.author).toBe('ю'.repeat(32));
    expect(decoded!.snippet).toBe('щ'.repeat(80));
  });

  it('PWA-REPLY-CODEC-04: malformed/future content decodes to null — a bad quote must never poison the message', () => {
    expect(decodeReplyBlockContent(new Uint8Array())).toBe(null);
    expect(decodeReplyBlockContent(new Uint8Array([1, 0, 0, 0]))).toBe(null);
    expect(decodeReplyBlockContent(new Uint8Array([9, 0, 0, 0, 0, 0, 0, 0, 42, 0]))).toBe(null);
    const bad = encodeReplyBlockContent({ refEntryId: '1', author: 'ab', snippet: '' });
    bad[9] = 200;
    expect(decodeReplyBlockContent(bad)).toBe(null);
  });
});

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
    const decoded = m.decodeFileBlockContent(m.encodeFileBlockContent({
      name: 'ю'.repeat(600), mime: '', bytes: new Uint8Array([1]),
    }));
    expect(m.utf8ByteLength(decoded!.name)).toBeLessThanOrEqual(m.FILE_NAME_MAX_BYTES);
    expect(decoded!.mime).toBe('application/octet-stream');
    expect(() => m.encodeFileBlockContent({ name: 'a', mime: 'x', bytes: new Uint8Array() })).toThrow();
    expect(m.decodeFileBlockContent(new Uint8Array())).toBe(null);
    expect(m.decodeFileBlockContent(new Uint8Array([9, 0, 1, 65, 0, 1]))).toBe(null);
    const truncated = m.encodeFileBlockContent({ name: 'ab', mime: 'x', bytes: new Uint8Array([1, 2]) });
    truncated[1] = 0xff; truncated[2] = 0xff;
    expect(m.decodeFileBlockContent(truncated)).toBe(null);
  });
});

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
    expect(m.normalizeProfileTags([' TON ', 'ton', 'Nature', 'nature', ''])).toEqual(['ton', 'nature']);
    expect(m.normalizeProfileTags(Array.from({ length: 50 }, (_, i) => `t${i}`)).length).toBe(m.PROFILE_MAX_TAGS);
    const capped = m.decodeProfileBlockContent(m.encodeProfileBlockContent({ description: 'я'.repeat(600), tags: [] }));
    expect(m.utf8ByteLength(capped!.description)).toBeLessThanOrEqual(m.PROFILE_DESCRIPTION_MAX_BYTES);
    expect(capped!.tags).toEqual([]);
    const empty = m.decodeProfileBlockContent(m.encodeProfileBlockContent({ description: '', tags: [] }));
    expect(empty!.description).toBe('');
    expect(m.decodeProfileBlockContent(new Uint8Array())).toBe(null);
    expect(m.decodeProfileBlockContent(new Uint8Array([9, 0, 0, 0]))).toBe(null);
    const truncated = m.encodeProfileBlockContent({ description: 'ab', tags: ['x'] });
    truncated[1] = 0xff; truncated[2] = 0xff;
    expect(m.decodeProfileBlockContent(truncated)).toBe(null);
  });

  it('PWA-PROFILE-CODEC-04: the channel look is a trailer after the username — round-trips, adds nothing when absent, and old blocks decode to null', async () => {
    const m = await import('../web/capsule-part-policy.mjs');
    const address = '0:' + 'ab'.repeat(32);
    const dressed = m.decodeProfileBlockContent(m.encodeProfileBlockContent({
      description: 'hi', tags: ['a'], ownerUsername: 'glasnost', appearance: { kind: 'telegram-gift', itemAddress: address.toUpperCase() },
    }));
    expect(dressed!.ownerUsername).toBe('glasnost');
    expect(dressed!.appearance).toEqual({ kind: 'telegram-gift', itemAddress: address });
    const nameless = m.decodeProfileBlockContent(m.encodeProfileBlockContent({ description: 'hi', tags: [], ownerUsername: '', appearance: { kind: 'telegram-gift', itemAddress: address } }));
    expect(nameless!.ownerUsername).toBe('');
    expect(nameless!.appearance).toEqual({ kind: 'telegram-gift', itemAddress: address });
    const plain = m.encodeProfileBlockContent({ description: 'hi', tags: ['a'], ownerUsername: 'glasnost' });
    const explicitNone = m.encodeProfileBlockContent({ description: 'hi', tags: ['a'], ownerUsername: 'glasnost', appearance: null });
    expect(Array.from(explicitNone)).toEqual(Array.from(plain));
    expect(m.decodeProfileBlockContent(plain)!.appearance).toBe(null);
    expect(m.normalizeProfileAppearance({ kind: 'telegram-gift', itemAddress: 'EQnot-raw' })).toBe(null);
    expect(m.normalizeProfileAppearance({ kind: 'sticker', itemAddress: address })).toBe(null);

    const look = m.encodeProfileBlockContent({ description: 'hi', tags: ['a'], ownerUsername: 'glasnost', appearance: {
      kind: 'look', theme: 'light', background: 'plasma', settings: [45, 7, 300, 120], itemAddress: address.toUpperCase(),
    } });
    expect(m.decodeProfileBlockContent(look)!.appearance).toEqual({ kind: 'look', theme: 'light', background: 'plasma', settings: [45, 7, 300, 120], itemAddress: address });
    const bare = m.encodeProfileBlockContent({ description: '', tags: [], ownerUsername: '', appearance: { kind: 'look', theme: 'dark', background: 'nodes', settings: [200, 50, 150, 0], itemAddress: null } });
    expect(m.decodeProfileBlockContent(bare)!.appearance).toEqual({ kind: 'look', theme: 'dark', background: 'nodes', settings: [200, 50, 150, 0], itemAddress: null });
    expect(m.normalizeProfileAppearance({ kind: 'look', theme: 'light', background: 'plasma', settings: [9999, 0, -1], itemAddress: null }))
      .toEqual({ kind: 'look', theme: 'light', background: 'plasma', settings: [100, 1, 25, 50], itemAddress: null });
    expect(m.normalizeProfileAppearance({ kind: 'look', theme: 'neon', background: 'none', settings: [], itemAddress: 'EQnot-raw' }))
      .toEqual({ kind: 'look', theme: 'dark', background: 'none', settings: [], itemAddress: null });
    const futureLook = m.encodeProfileBlockContent({ description: '', tags: [], ownerUsername: '', appearance: { kind: 'look', theme: 'light', background: 'plasma', settings: [30, 5, 175, 50], itemAddress: address } });
    const tampered = new Uint8Array(futureLook);
    const kindAt = tampered.length - (1 + 1 + 1 + 1 + 8 + 1 + address.length);
    expect(tampered[kindAt]).toBe(m.PROFILE_APPEARANCE_KIND_LOOK);
    tampered[kindAt + 2] = 9;
    expect(m.decodeProfileBlockContent(tampered)!.appearance).toEqual({ kind: 'look', theme: 'light', background: null, settings: [], itemAddress: address });
    expect(m.decodeProfileBlockContent(m.encodeProfileBlockContent({ description: 'hi', tags: [], ownerUsername: '', appearance: { kind: 'telegram-gift', itemAddress: address } }))!.appearance)
      .toEqual({ kind: 'telegram-gift', itemAddress: address });
    const withLook = m.encodeProfileBlockContent({ description: 'hi', tags: ['a'], ownerUsername: 'glasnost', appearance: { kind: 'telegram-gift', itemAddress: address } });
    expect(Array.from(withLook.subarray(0, plain.length))).toEqual(Array.from(plain));
    expect(withLook.length).toBe(plain.length + 1 + 1 + address.length);
    const cut = withLook.subarray(0, withLook.length - 5);
    const decodedCut = m.decodeProfileBlockContent(cut);
    expect(decodedCut!.description).toBe('hi');
    expect(decodedCut!.ownerUsername).toBe('glasnost');
    expect(decodedCut!.appearance).toBe(null);
  });

  it('PWA-PROFILE-CODEC-03: owner-username round-trips, is byte-capped, and old-format blocks decode to "" (no crash)', async () => {
    const m = await import('../web/capsule-part-policy.mjs');
    const withName = m.decodeProfileBlockContent(m.encodeProfileBlockContent({ description: 'hi', tags: ['a', 'b'], ownerUsername: 'glasnost' }));
    expect(withName!.ownerUsername).toBe('glasnost');
    expect(withName!.description).toBe('hi');
    expect(withName!.tags).toEqual(['a', 'b']);
    const noName = m.decodeProfileBlockContent(m.encodeProfileBlockContent({ description: 'hi', tags: ['a'], ownerUsername: '' }));
    expect(noName!.ownerUsername).toBe('');
    const capped = m.decodeProfileBlockContent(m.encodeProfileBlockContent({ description: '', tags: [], ownerUsername: 'x'.repeat(200) }));
    expect(m.utf8ByteLength(capped!.ownerUsername)).toBeLessThanOrEqual(m.PROFILE_USERNAME_MAX_BYTES);
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

    const base = { ...share, author: '', title: '', snippet: '' };
    for (const id of ['688.0.1', '0', '18446744073709551615', '4294967296.3.127']) {
      expect(m.decodeShareBlockContent(m.encodeShareBlockContent({ ...base, entryId: id }))?.entryId, id).toBe(id);
    }
    expect(() => m.encodeShareBlockContent({ ...base, entryId: '' })).toThrow();
    expect(() => m.encodeShareBlockContent({ ...base, entryId: 'x'.repeat(m.SHARE_ENTRY_ID_MAX_BYTES + 1) })).toThrow();
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
    const capped = m.decodeShareBlockContent(m.encodeShareBlockContent({
      ...base,
      author: 'я'.repeat(200),
      title: 'ж'.repeat(200),
      snippet: 'ю'.repeat(5000),
    }));
    expect(m.utf8ByteLength(capped!.author)).toBeLessThanOrEqual(m.SHARE_AUTHOR_MAX_BYTES);
    expect(m.utf8ByteLength(capped!.title)).toBeLessThanOrEqual(m.SHARE_TITLE_MAX_BYTES);
    expect(m.utf8ByteLength(capped!.snippet)).toBeLessThanOrEqual(m.SHARE_SNIPPET_MAX_BYTES);
    expect(capped!.textTruncated).toBe(true);
    const preCut = m.decodeShareBlockContent(m.encodeShareBlockContent({ ...base, snippet: 'short', textTruncated: true }));
    expect(preCut!.textTruncated).toBe(true);
    expect(preCut!.hasImage).toBe(false);
    expect(m.decodeShareBlockContent(new Uint8Array())).toBe(null);
    expect(m.decodeShareBlockContent(new Uint8Array(64).fill(9))).toBe(null);
    const good = m.encodeShareBlockContent({ ...base, author: 'ab', title: 'cd', snippet: 'ef' });
    const walletLenAt = 3 + good[2] + 32;
    expect(m.decodeShareBlockContent(good.slice(0, walletLenAt + 2))).toBe(null);
    const badWalletLen = good.slice();
    badWalletLen[walletLenAt] = 0xff;
    expect(m.decodeShareBlockContent(badWalletLen)).toBe(null);
    const badEntryIdLen = good.slice();
    badEntryIdLen[2] = 0xff;
    expect(m.decodeShareBlockContent(badEntryIdLen)).toBe(null);
  });
});

describe('profile block worn gift', () => {
  it('PWA-PROFILE-CODEC-05: the worn gift is its own trailer behind the appearance — round-trips, rides an empty appearance, and old blocks decode to null', async () => {
    const m = await import('../web/capsule-part-policy.mjs');
    const worn = '0:' + 'cd'.repeat(32);
    const channel = '0:' + 'ab'.repeat(32);
    const both = m.decodeProfileBlockContent(m.encodeProfileBlockContent({
      description: 'hi', tags: ['a'], ownerUsername: 'glasnost',
      appearance: { kind: 'look', theme: 'dark', background: 'plasma', settings: [1, 2, 3, 4], itemAddress: channel },
      wornGift: worn.toUpperCase(),
    }));
    expect(both!.appearance!.itemAddress).toBe(channel);
    expect(both!.wornGift).toBe(worn);
    const cardOnly = m.decodeProfileBlockContent(m.encodeProfileBlockContent({ description: 'hi', tags: [], ownerUsername: '', appearance: null, wornGift: worn }));
    expect(cardOnly!.appearance).toBe(null);
    expect(cardOnly!.wornGift).toBe(worn);
    const plain = m.encodeProfileBlockContent({ description: 'hi', tags: ['a'], ownerUsername: 'glasnost' });
    const explicitNone = m.encodeProfileBlockContent({ description: 'hi', tags: ['a'], ownerUsername: 'glasnost', wornGift: null });
    expect(Array.from(explicitNone)).toEqual(Array.from(plain));
    expect(m.decodeProfileBlockContent(plain)!.wornGift).toBe(null);
    expect(m.normalizeProfileWornGift('EQnot-raw')).toBe(null);
    expect(m.decodeProfileBlockContent(m.encodeProfileBlockContent({ description: 'hi', tags: [], wornGift: 'EQnot-raw' }))!.wornGift).toBe(null);
  });

  it('PROFGROUPS-01: the rooms a card advertises ride the profile block, and cost what they weigh', () => {
    const base = { description: 'a channel', tags: ['news'], ownerUsername: 'glasnost' };
    const plain = encodeProfileBlockContent(base);
    const withRooms = encodeProfileBlockContent({
      ...base,
      groups: [{ groupId: 'ab'.repeat(32), name: 'the kitchen' }, { groupId: 'cd'.repeat(32), name: 'the yard' }],
    });
    const back = decodeProfileBlockContent(withRooms);
    expect(back.groups.map((g: any) => g.name)).toEqual(['the kitchen', 'the yard']);
    expect(back.groups[0].groupId).toBe('ab'.repeat(32));
    expect(back.description, 'the fields in front of the trailer are untouched').toBe(base.description);
    expect(back.ownerUsername).toBe('glasnost');
    expect(decodeProfileBlockContent(plain).groups).toEqual([]);
    expect(withRooms.length - plain.length).toBe(2 + 1 + (32 + 1 + 11) + (32 + 1 + 8));
  });

  it('PROFGROUPS-03: a public room names its founder and owner on the card, in a trailer a private-only card never carries', () => {
    const base = { description: 'a channel', tags: ['one'], ownerUsername: '', appearance: null, wornGift: null };
    const founder = '11'.repeat(32);
    const owner = '22'.repeat(32);
    const rooms = [{ groupId: 'ab'.repeat(32), name: 'the square', founder, owner }, { groupId: 'cd'.repeat(32), name: 'the kitchen' }];
    const back = decodeProfileBlockContent(encodeProfileBlockContent({ ...base, groups: rooms }));
    expect(back.groups.map((g: any) => [g.name, g.founder ?? null, g.owner ?? null])).toEqual([['the square', founder, owner], ['the kitchen', null, null]]);
    const privateOnly = encodeProfileBlockContent({ ...base, groups: [{ groupId: 'cd'.repeat(32), name: 'the kitchen' }] });
    const privateOnlyAgain = encodeProfileBlockContent({ ...base, groups: [{ groupId: 'cd'.repeat(32), name: 'the kitchen', founder: 'nothex', owner: '' }] });
    expect(privateOnlyAgain.length).toBe(privateOnly.length);
    expect(decodeProfileBlockContent(privateOnly).groups[0].founder).toBeUndefined();
    const withFounders = encodeProfileBlockContent({ ...base, groups: rooms });
    const withoutFounders = encodeProfileBlockContent({ ...base, groups: rooms.map(({ groupId, name }) => ({ groupId, name })) });
    expect(withFounders.length - withoutFounders.length).toBe(1 + rooms.length * 64);
    const cut = decodeProfileBlockContent(withFounders.subarray(0, withFounders.length - 10));
    expect(cut.groups.map((g: any) => g.name)).toEqual(['the square', 'the kitchen']);
    expect(cut.groups[0].founder).toBeUndefined();
    expect(normalizeProfileGroups([{ groupId: 'ab'.repeat(32), name: 'x', founder: '0'.repeat(64) }])[0].founder).toBeUndefined();
  });

  it('PROFGROUPS-02: the trailers stay in order, and the cap holds', () => {
    const base = { description: 'a channel', tags: [], ownerUsername: '' };
    const gift = `0:${'ab'.repeat(32)}`;
    const rooms = [{ groupId: 'ef'.repeat(32), name: 'room' }];
    const both = decodeProfileBlockContent(encodeProfileBlockContent({ ...base, wornGift: gift, groups: rooms }));
    expect(both.wornGift).toBe(gift);
    expect(both.groups.map((g: any) => g.groupId)).toEqual(['ef'.repeat(32)]);
    const roomsOnly = decodeProfileBlockContent(encodeProfileBlockContent({ ...base, groups: rooms }));
    expect(roomsOnly.wornGift).toBeNull();
    expect(roomsOnly.groups.map((g: any) => g.name)).toEqual(['room']);
    const many = Array.from({ length: 20 }, (_, index) => ({
      groupId: index.toString(16).padStart(2, '0').repeat(32), name: `r${index}`,
    }));
    expect(decodeProfileBlockContent(encodeProfileBlockContent({ ...base, groups: many })).groups.length).toBe(PROFILE_GROUPS_MAX);
    const twice = [{ groupId: 'ab'.repeat(32), name: 'a' }, { groupId: 'ab'.repeat(32), name: 'b' }];
    expect(normalizeProfileGroups(twice).length).toBe(1);
    expect(normalizeProfileGroups([{ groupId: 'nothex', name: 'x' }]).length, 'and a bad id is no room').toBe(0);
  });


  it('R6D-01: a PROFILE frame hand-built past the encoder\'s caps decodes to the caps', () => {
    const description = new TextEncoder().encode('d'.repeat(65_000));
    const frame = new Uint8Array(3 + description.length + 1 + 255 * 256);
    frame[0] = 1; frame[1] = description.length >> 8; frame[2] = description.length & 0xff;
    frame.set(description, 3);
    let at = 3 + description.length;
    frame[at] = 255; at += 1;
    for (let i = 0; i < 255; i += 1) { frame[at] = 255; frame.fill(0x74, at + 1, at + 256); frame[at + 1] = 0x61 + (i % 26); frame[at + 2] = 0x61 + Math.floor(i / 26); at += 256; }
    const decoded = decodeProfileBlockContent(frame)!;
    expect(decoded).not.toBeNull();
    expect(utf8ByteLength(decoded.description)).toBeLessThanOrEqual(PROFILE_DESCRIPTION_MAX_BYTES);
    expect(decoded.tags.length).toBeLessThanOrEqual(PROFILE_MAX_TAGS);
    expect(decoded.tags.length).toBeGreaterThan(0);
    for (const t of decoded.tags) expect(utf8ByteLength(t)).toBeLessThanOrEqual(PROFILE_TAG_MAX_BYTES);
  });

  it('R6D-02: REPLY and SHARE frames read their trailing text bounded, not as the rest of the frame', () => {
    const reply = new Uint8Array(10 + 200 + 30_000);
    reply[0] = 1; reply[9] = 200;
    reply.fill(0x41, 10, 210); reply.fill(0x42, 210);
    const r = decodeReplyBlockContent(reply)!;
    expect(utf8ByteLength(r.author)).toBeLessThanOrEqual(REPLY_AUTHOR_MAX_BYTES);
    expect(utf8ByteLength(r.snippet)).toBeLessThanOrEqual(REPLY_SNIPPET_MAX_BYTES);
    const share = decodeShareBlockContent(new Uint8Array([2, 0, 3, 0x31, 0x32, 0x33, ...new Array(32).fill(0xab), 1, 0x30, 255, ...new Array(255).fill(0x41), 255, ...new Array(255).fill(0x42), ...new Array(30_000).fill(0x43)]))!;
    expect(share).not.toBeNull();
    expect(utf8ByteLength(share.title)).toBeLessThanOrEqual(SHARE_TITLE_MAX_BYTES);
    expect(utf8ByteLength(share.snippet)).toBeLessThanOrEqual(SHARE_SNIPPET_MAX_BYTES);
    expect(share.entryId).toBe('123');
  });

  it('R6D-03: a FILE block\'s media type is a media type or the octet default — a comma in it broke the data: URL in silence', () => {
    expect(mediaTypeIn('text/plain,evil')).toBe('application/octet-stream');
    expect(mediaTypeIn('image/png')).toBe('image/png');
    expect(mediaTypeIn('Application/PDF')).toBe('application/pdf');
    expect(mediaTypeIn('')).toBe('application/octet-stream');
    const encoded = encodeFileBlockContent({ name: 'a.txt', mime: 'text/plain', bytes: new Uint8Array([1, 2]) });
    const hostile = Uint8Array.from(encoded);
    hostile[4 + 5 + 4] = 0x2c;
    expect(decodeFileBlockContent(hostile)!.mime).toBe('application/octet-stream');
    expect(decodeFileBlockContent(encoded)!.mime).toBe('text/plain');
  });

});
