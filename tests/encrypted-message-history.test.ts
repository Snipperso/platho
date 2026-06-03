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
});
