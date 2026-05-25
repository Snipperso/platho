import { describe, expect, it } from 'vitest';
import {
  messagePartCount,
  messagePartCountForBytes,
  SINGLE_CAPSULE_USEFUL_BYTES,
  singleCapsuleMessageFits,
  splitBytesToParts,
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
});
