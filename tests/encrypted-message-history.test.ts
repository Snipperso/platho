import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MESSAGE_HISTORY_MAX_RECORDS,
  createMemoryEncryptedMessageHistoryStore,
  openMessageHistoryRecord,
  sealMessageHistoryRecord,
} from '../web/encrypted-message-store.mjs';

const NOW = Date.UTC(2026, 0, 2, 9, 30, 0);

async function createAesKey() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

describe('encrypted local message history', () => {
  it('HISTORY-01: stores message plaintext only inside encrypted records', async () => {
    const store = await createMemoryEncryptedMessageHistoryStore();
    await store.putMessage({
      threadId: 'thread-alpha',
      createdAt: NOW,
      thread: {
        id: 'thread-alpha',
        name: 'Alice',
        subtitle: 'Wallet address',
        identityVariants: [{ type: 'wallet_address', value: '0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', label: 'Alice wallet' }],
      },
      message: {
        type: 'out',
        text: 'local history secret',
        meta: 'hybrid-v1 capsule export',
        capsule: { id: 'capsule-alpha' },
      },
    });

    const raw = JSON.stringify(store.dumpEncryptedRecords());
    const restored = await store.listMessages({ threadId: 'thread-alpha' });

    expect(raw).not.toContain('local history secret');
    expect(raw).not.toContain('hybrid-v1 capsule export');
    expect(raw).not.toContain('Alice wallet');
    expect(restored).toHaveLength(1);
    expect(restored[0].message.text).toBe('local history secret');
    expect(restored[0].threadId).toBe('thread-alpha');
    expect(restored[0].thread.name).toBe('Alice');
  });

  it('HISTORY-02: authenticated metadata detects clear header tampering', async () => {
    const key = await createAesKey();
    const record = await sealMessageHistoryRecord(key, {
      id: 'record-alpha',
      threadId: 'thread-alpha',
      createdAt: NOW,
      message: {
        type: 'in',
        text: 'tamper sensitive',
        meta: 'hybrid-v1 import',
      },
    });

    await expect(openMessageHistoryRecord(key, {
      ...record,
      threadId: 'thread-beta',
    })).rejects.toThrow();
  });

  it('HISTORY-03: authenticated ciphertext detects encrypted body tampering', async () => {
    const key = await createAesKey();
    const record = await sealMessageHistoryRecord(key, {
      id: 'record-beta',
      threadId: 'thread-alpha',
      createdAt: NOW,
      message: {
        type: 'out',
        text: 'ciphertext sensitive',
        meta: 'sealed',
      },
    });
    const tamperedCiphertext = Buffer.from(record.ciphertext, 'base64url');
    tamperedCiphertext[tamperedCiphertext.length - 1] ^= 0x01;

    await expect(openMessageHistoryRecord(key, {
      ...record,
      ciphertext: tamperedCiphertext.toString('base64url'),
    })).rejects.toThrow();
  });

  it('HISTORY-04: prunes old encrypted records by max record count', async () => {
    const store = await createMemoryEncryptedMessageHistoryStore({ maxRecords: 2 });
    await store.putMessage({
      threadId: 'thread-alpha',
      createdAt: NOW,
      message: { type: 'out', text: 'oldest', meta: 'sealed' },
    });
    await store.putMessage({
      threadId: 'thread-alpha',
      createdAt: NOW + 1,
      message: { type: 'out', text: 'middle', meta: 'sealed' },
    });
    await store.putMessage({
      threadId: 'thread-alpha',
      createdAt: NOW + 2,
      message: { type: 'out', text: 'newest', meta: 'sealed' },
    });

    const restored = await store.listMessages({ threadId: 'thread-alpha' });

    expect(restored.map((record) => record.message.text)).toEqual(['middle', 'newest']);
    expect(JSON.stringify(store.dumpEncryptedRecords())).not.toContain('oldest');
    expect(store.maxRecords).toBe(2);
    expect(store.persistent).toBe(false);
  });

  it('HISTORY-05: exposes the default local history retention envelope', async () => {
    const store = await createMemoryEncryptedMessageHistoryStore();

    expect(DEFAULT_MESSAGE_HISTORY_MAX_RECORDS).toBe(500);
    expect(store.maxRecords).toBe(500);
    expect(store.persistent).toBe(false);
  });

  it('HISTORY-06: one corrupt encrypted record is quarantined without blocking valid history', async () => {
    const key = await createAesKey();
    const store = await createMemoryEncryptedMessageHistoryStore({ key });
    const records = await Promise.all(['one', 'two', 'three'].map((text, index) => sealMessageHistoryRecord(key, {
      id: `record-${text}`,
      threadId: 'thread-alpha',
      createdAt: NOW + index,
      message: { type: 'in', text, meta: 'sealed' },
    })));
    const firstCiphertextChar = records[1].ciphertext[0] === 'A' ? 'B' : 'A';
    const corrupt = { ...records[1], ciphertext: `${firstCiphertextChar}${records[1].ciphertext.slice(1)}` };
    store.replaceEncryptedRecords([records[0], corrupt, records[2]]);

    const detailed = await store.listMessagesDetailed({ threadId: 'thread-alpha' });
    const restored = await store.listMessages({ threadId: 'thread-alpha' });

    expect(detailed.messages.map((record) => record.message.text)).toEqual(['one', 'three']);
    expect(detailed.failed).toHaveLength(1);
    expect(detailed.failed[0]).toMatchObject({ id: 'record-two', threadId: 'thread-alpha' });
    expect(restored.map((record) => record.message.text)).toEqual(['one', 'three']);
  });

  it('HISTORY-07: pending payment checks use an encrypted unpruned ledger', async () => {
    const store = await createMemoryEncryptedMessageHistoryStore({ maxRecords: 1 });
    await store.putPendingPaymentCheck({
      id: 'payment-check:alpha',
      intentId: '123',
      payment: {
        asset: '0',
        amount: '1000',
        intentId: '123',
        secret32Hex: 'a'.repeat(64),
      },
      status: 'intent_confirmed',
      recoveryNote: 'refund this pending check',
      createdAt: NOW,
    });
    await store.putMessage({
      threadId: 'thread-alpha',
      createdAt: NOW + 1,
      message: { type: 'out', text: 'message one', meta: 'sealed' },
    });
    await store.putMessage({
      threadId: 'thread-alpha',
      createdAt: NOW + 2,
      message: { type: 'out', text: 'message two', meta: 'sealed' },
    });

    const messages = await store.listMessages({ threadId: 'thread-alpha' });
    const pending = await store.listPendingPaymentChecks();
    const rawMessages = JSON.stringify(store.dumpEncryptedRecords());
    const rawPending = JSON.stringify(store.dumpEncryptedPendingPaymentCheckRecords());

    expect(messages.map((record) => record.message.text)).toEqual(['message two']);
    expect(pending.records).toHaveLength(1);
    expect(pending.records[0]).toMatchObject({
      id: 'payment-check:alpha',
      intentId: '123',
      status: 'intent_confirmed',
    });
    expect(rawMessages).not.toContain('message one');
    expect(rawPending).not.toContain('refund this pending check');

    await store.removePendingPaymentCheck('payment-check:alpha');
    expect((await store.listPendingPaymentChecks()).records).toHaveLength(0);
  });
});
