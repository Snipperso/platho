import { describe, expect, it } from 'vitest';
import {
  hasMessageBudgetAllocation,
  messagePartCount,
  messagePartCountForBytes,
  SINGLE_CAPSULE_USEFUL_BYTES,
  singleCapsuleMessageFits,
  splitBytesToParts,
  splitUtf8ToParts,
  truncateUtf8ToBytes,
  utf8ByteLength,
} from '../web/message-budget-policy.mjs';

describe('PWA message budget policy', () => {
  it('PWA-MSG-BUDGET-01: wallet-confirmed mode allows exactly one 1024-byte useful segment', () => {
    expect(SINGLE_CAPSULE_USEFUL_BYTES).toBe(1024);
    expect(singleCapsuleMessageFits('a'.repeat(1024), false)).toBe(true);
    expect(singleCapsuleMessageFits('a'.repeat(1025), false)).toBe(false);
    expect(singleCapsuleMessageFits('a'.repeat(1025), true)).toBe(true);
  });

  it('PWA-MSG-BUDGET-02: UTF-8 byte accounting handles Cyrillic and emoji', () => {
    expect(utf8ByteLength('hello')).toBe(5);
    expect(utf8ByteLength('Привет')).toBe(12);
    expect(utf8ByteLength('⚡')).toBe(3);
    expect(utf8ByteLength('🚀')).toBe(4);
  });

  it('PWA-MSG-BUDGET-03: truncation keeps valid UTF-8 symbol boundaries', () => {
    expect(truncateUtf8ToBytes('a🚀b', 5)).toBe('a🚀');
    expect(truncateUtf8ToBytes('Привет', 5)).toBe('Пр');
    expect(utf8ByteLength(truncateUtf8ToBytes('🚀'.repeat(300), 1024))).toBe(1024);
  });

  it('PWA-MSG-BUDGET-04: active Vault Message Budget unlocks multi-segment sends', () => {
    expect(hasMessageBudgetAllocation(null)).toBe(false);
    expect(hasMessageBudgetAllocation({ message_budget_ton: 0n })).toBe(false);
    expect(hasMessageBudgetAllocation({ message_budget_ton: 1n })).toBe(true);
    expect(hasMessageBudgetAllocation({ messageBudgetTon: '10000000' })).toBe(true);
  });

  it('PWA-MSG-BUDGET-05: send plan counts 1024-byte parts without splitting UTF-8 symbols', () => {
    expect(messagePartCountForBytes(0)).toBe(1);
    expect(messagePartCountForBytes(1024)).toBe(1);
    expect(messagePartCountForBytes(1025)).toBe(2);
    expect(messagePartCount('a'.repeat(2049))).toBe(3);

    const parts = splitUtf8ToParts('a'.repeat(1023) + '🚀' + 'b', 1024);
    expect(parts).toHaveLength(2);
    expect(utf8ByteLength(parts[0])).toBe(1023);
    const byteParts = splitBytesToParts(new Uint8Array(8 * 1024 + 17).fill(1), SINGLE_CAPSULE_USEFUL_BYTES);
    expect(byteParts).toHaveLength(9);
    expect(byteParts[0]).toHaveLength(1024);
    expect(byteParts[8]).toHaveLength(17);
    expect(parts[1]).toBe('🚀b');
  });
});
