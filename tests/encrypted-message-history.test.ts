import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MESSAGE_HISTORY_MAX_PER_THREAD,
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

  it('HISTORY-04: prunes old encrypted records per CONVERSATION, not across the app', async () => {
    const store = await createMemoryEncryptedMessageHistoryStore({ maxPerThread: 2 });
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
    expect(store.maxPerThread).toBe(2);
    expect(store.persistent).toBe(false);
  });

  it('HISTORY-04B: a busy conversation cannot evict a quiet one', async () => {
    // The cap used to be 500 across the whole app, pruned by time over every conversation at once, so the busiest
    // chat ate the quietest one's past and a person messaging for years did not have their history. Per thread
    // that is structurally impossible, which is the point of the change rather than a side effect of it.
    const store = await createMemoryEncryptedMessageHistoryStore({ maxPerThread: 2 });
    await store.putMessage({ threadId: 'quiet', createdAt: NOW, message: { type: 'in', text: 'the only quiet one' } });
    for (let i = 0; i < 10; i += 1) {
      await store.putMessage({ threadId: 'busy', createdAt: NOW + 10 + i, message: { type: 'out', text: `busy ${i}` } });
    }

    const quiet = await store.listMessages({ threadId: 'quiet' });
    expect(quiet.map((r) => r.message.text), 'ten messages elsewhere must not touch this thread')
      .toEqual(['the only quiet one']);
    expect((await store.listMessages({ threadId: 'busy' })).map((r) => r.message.text)).toEqual(['busy 8', 'busy 9']);
  });

  it('HISTORY-04C: a window reads the NEWEST n and pages back from there', async () => {
    // What makes lazy loading possible: opening a dialog decrypts its window, not its history. The ordering is
    // asserted because the threadId index is keyed by thread, NOT by time — slicing before sorting would take an
    // arbitrary n and call them the latest.
    const store = await createMemoryEncryptedMessageHistoryStore({ maxPerThread: 50 });
    for (let i = 0; i < 20; i += 1) {
      await store.putMessage({ threadId: 't', createdAt: NOW + i, message: { type: 'in', text: `m${i}` } });
    }

    const newest = await store.listMessages({ threadId: 't', limit: 5 });
    expect(newest.map((r) => r.message.text)).toEqual(['m15', 'm16', 'm17', 'm18', 'm19']);

    const older = await store.listMessages({ threadId: 't', limit: 5, before: newest[0].createdAt });
    expect(older.map((r) => r.message.text)).toEqual(['m10', 'm11', 'm12', 'm13', 'm14']);
  });

  it('HISTORY-04D: headers carry every capsule id and no message body', async () => {
    // Deduplicating an arriving capsule must not depend on what is loaded in memory: a manual sync asks the chain
    // to re-deliver, and a partially-loaded thread would otherwise re-insert what it already stored. Headers give
    // that check every id ever written, at no decryption cost — which is also why they must stay bodyless.
    const store = await createMemoryEncryptedMessageHistoryStore();
    await store.putMessage({
      threadId: 't', createdAt: NOW, message: { type: 'in', text: 'secret body', capsule: { id: 'capsule-7' } },
    });

    const headers = await store.listMessageHeaders();
    expect(headers).toHaveLength(1);
    expect(headers[0].capsuleId).toBe('capsule-7');
    expect(headers[0].threadId).toBe('t');
    expect(JSON.stringify(headers), 'a header must never carry the message body').not.toContain('secret body');
  });

  it('HISTORY-05: exposes the default local history retention envelope', async () => {
    const store = await createMemoryEncryptedMessageHistoryStore();

    expect(DEFAULT_MESSAGE_HISTORY_MAX_PER_THREAD).toBe(2000);
    expect(store.maxPerThread).toBe(2000);
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
});
