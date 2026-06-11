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
});
