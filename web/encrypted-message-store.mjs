const DEFAULT_DB_NAME = 'platho-local-message-history-v1';
const KEY_STORE_NAME = 'historyKeys';
const MESSAGE_STORE_NAME = 'encryptedMessages';
const DEFAULT_KEY_ID = 'device-history-key-v1';
const MESSAGE_HISTORY_VERSION = 1;
// DB stays at version 2: v2 added a now-removed pending-payment-check object store. The version is never
// lowered (IndexedDB throws VersionError on downgrade); fresh installs simply open v2 with key+message stores.
const MESSAGE_HISTORY_DB_VERSION = 2;
const MESSAGE_HISTORY_DOMAIN = 'PLATHO.LOCAL.MESSAGE_HISTORY.V1';
const AES_GCM_NONCE_BYTES = 12;
// Per CONVERSATION, not per app. ~1 KB per stored record was MEASURED, so 2000 is about 2 MB of disk for a
// conversation that actually reaches it — and a conversation is what a person thinks in, so that is the unit the
// budget belongs to. The number is a disk choice, not a display one: the app loads a WINDOW of the newest
// messages and pages back through the rest on demand.
export const DEFAULT_MESSAGE_HISTORY_MAX_PER_THREAD = 2000;

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function safeClone(value) {
  // BigInt-safe deep clone. Persisted message-history records can carry BigInt fields — e.g. a
  // publishResult/vaultPublish max_charge, which the batch-pricing rework made a BigInt.
  // Plain JSON.stringify throws "Do not know how to serialize a BigInt", which silently stranded the
  // ledger write (the send itself still went through). Stringify BigInts exactly as app.js safeJsonClone
  // does — the project-wide convention is to store BigInts as decimal strings (nonces, max_charge in
  // publishState parts are already stored that way), and the read-back consumers treat these fields as
  // opaque/diagnostic, never doing arithmetic on the cloned value.
  return JSON.parse(JSON.stringify(value, (_key, item) => (
    typeof item === 'bigint' ? item.toString() : item
  )));
}

function cryptoApi() {
  const crypto = globalThis.crypto;
  if (!crypto?.subtle || !crypto?.getRandomValues) {
    throw new Error('WebCrypto is unavailable');
  }
  return crypto;
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  cryptoApi().getRandomValues(bytes);
  return bytes;
}

function randomId() {
  if (cryptoApi().randomUUID) return cryptoApi().randomUUID();
  return bytesToBase64url(randomBytes(16));
}

function utf8(value) {
  return new TextEncoder().encode(value);
}

function text(bytes) {
  return new TextDecoder().decode(bytes);
}

function bytesToBase64url(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof Buffer !== 'undefined') return Buffer.from(input).toString('base64url');
  let binary = '';
  for (const byte of input) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64urlToBytes(value) {
  assertString(value, 'base64url');
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('Invalid base64url value');
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64url'));
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

async function createHistoryKey() {
  return cryptoApi().subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function normalizeMessageRecordInput(input) {
  assertObject(input, 'message history input');
  const message = assertObject(input.message, 'message history input.message');
  return {
    id: input.id ?? randomId(),
    threadId: assertString(input.threadId, 'message history input.threadId'),
    createdAt: input.createdAt ?? Date.now(),
    thread: input.thread && typeof input.thread === 'object' ? safeClone(input.thread) : null,
    type: assertString(message.type, 'message.type'),
    capsuleId: message.capsule?.id ?? null,
    message: safeClone(message),
  };
}

function recordAad(record) {
  return utf8(stableStringify({
    domain: MESSAGE_HISTORY_DOMAIN,
    version: MESSAGE_HISTORY_VERSION,
    id: record.id,
    threadId: record.threadId,
    createdAt: record.createdAt,
    type: record.type,
    capsuleId: record.capsuleId ?? null,
  }));
}

export async function sealMessageHistoryRecord(key, input) {
  const normalized = normalizeMessageRecordInput(input);
  const nonce = randomBytes(AES_GCM_NONCE_BYTES);
  const payload = utf8(JSON.stringify({
    version: MESSAGE_HISTORY_VERSION,
    threadId: normalized.threadId,
    createdAt: normalized.createdAt,
    thread: normalized.thread,
    message: normalized.message,
  }));
  const header = {
    version: MESSAGE_HISTORY_VERSION,
    alg: 'AES-256-GCM',
    keyId: DEFAULT_KEY_ID,
    id: normalized.id,
    threadId: normalized.threadId,
    createdAt: normalized.createdAt,
    type: normalized.type,
    capsuleId: normalized.capsuleId,
    nonce: bytesToBase64url(nonce),
  };
  const ciphertext = await cryptoApi().subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: recordAad(header),
      tagLength: 128,
    },
    key,
    payload,
  );
  return {
    ...header,
    ciphertext: bytesToBase64url(new Uint8Array(ciphertext)),
  };
}

export async function openMessageHistoryRecord(key, record) {
  assertObject(record, 'message history record');
  if (record.version !== MESSAGE_HISTORY_VERSION || record.alg !== 'AES-256-GCM') {
    throw new Error('Unsupported Platho message history record');
  }
  const nonce = base64urlToBytes(record.nonce);
  if (nonce.length !== AES_GCM_NONCE_BYTES) throw new Error('Invalid message history nonce');
  const plaintext = await cryptoApi().subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: recordAad(record),
      tagLength: 128,
    },
    key,
    base64urlToBytes(record.ciphertext),
  );
  const payload = assertObject(JSON.parse(text(new Uint8Array(plaintext))), 'message history payload');
  if (payload.version !== MESSAGE_HISTORY_VERSION) throw new Error('Unsupported message history payload');
  if (payload.threadId !== record.threadId || payload.createdAt !== record.createdAt) {
    throw new Error('Message history payload metadata mismatch');
  }
  return {
    id: record.id,
    threadId: record.threadId,
    createdAt: record.createdAt,
    type: record.type,
    capsuleId: record.capsuleId ?? null,
    thread: payload.thread && typeof payload.thread === 'object' ? payload.thread : null,
    message: assertObject(payload.message, 'message history payload.message'),
  };
}

async function openMessageHistoryRecords(key, records) {
  const opened = [];
  const failed = [];
  for (const record of records) {
    try {
      opened.push(await openMessageHistoryRecord(key, record));
    } catch (error) {
      failed.push({
        id: record?.id ?? null,
        threadId: record?.threadId ?? null,
        createdAt: record?.createdAt ?? null,
        error: String(error?.message ?? error ?? 'record blocked'),
      });
    }
  }
  opened.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  return { messages: opened, failed };
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function openHistoryDb(dbName) {
  if (!globalThis.indexedDB) throw new Error('IndexedDB is unavailable');
  const openRequest = indexedDB.open(dbName, MESSAGE_HISTORY_DB_VERSION);
  openRequest.onupgradeneeded = () => {
    const db = openRequest.result;
    if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
      db.createObjectStore(KEY_STORE_NAME, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(MESSAGE_STORE_NAME)) {
      const store = db.createObjectStore(MESSAGE_STORE_NAME, { keyPath: 'id' });
      store.createIndex('threadId', 'threadId');
      store.createIndex('createdAt', 'createdAt');
    }
  };
  return requestToPromise(openRequest);
}

async function getOrCreateStoredKey(db) {
  const readTx = db.transaction(KEY_STORE_NAME, 'readonly');
  const stored = await requestToPromise(readTx.objectStore(KEY_STORE_NAME).get(DEFAULT_KEY_ID));
  await transactionDone(readTx);
  if (stored?.key) return stored.key;

  const key = await createHistoryKey();
  const writeTx = db.transaction(KEY_STORE_NAME, 'readwrite');
  writeTx.objectStore(KEY_STORE_NAME).put({
    id: DEFAULT_KEY_ID,
    key,
    createdAt: Date.now(),
  });
  await transactionDone(writeTx);
  return key;
}

/**
 * Keep the newest `maxPerThread` records OF THIS THREAD.
 *
 * [WAS GLOBAL, FIXED 2026-08-08] The cap used to be 500 records across the whole app, pruned by createdAt over
 * every conversation at once. Two consequences, both silent: a person messaging for years simply did not have
 * their history on the device, and a burst in one chat EVICTED another chat's past — the busiest conversation ate
 * the quietest one. Per thread, neither can happen: a conversation's depth is its own, and nothing another
 * contact does can shorten it.
 *
 * Pruning one thread rather than the whole store also makes the work proportional to the write: a message lands in
 * exactly one conversation, so only that conversation's tail is examined.
 */
async function pruneIndexedDbThread(db, threadId, maxPerThread) {
  if (!threadId || !Number.isFinite(maxPerThread) || maxPerThread <= 0) return;
  const tx = db.transaction(MESSAGE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(MESSAGE_STORE_NAME);
  const index = store.index('threadId');
  const count = await requestToPromise(index.count(threadId));
  if (count <= maxPerThread) {
    await transactionDone(tx);
    return;
  }
  // Oldest first: the threadId index is not ordered by time, so the ids are collected and sorted by the CLEAR
  // createdAt header. Reading headers costs no decryption — that is the whole reason this stays cheap.
  const records = await requestToPromise(index.getAll(threadId));
  records.sort((a, b) => Number(a?.createdAt ?? 0) - Number(b?.createdAt ?? 0));
  for (const record of records.slice(0, count - maxPerThread)) {
    if (record?.id) store.delete(record.id);
  }
  await transactionDone(tx);
}

export async function createIndexedDbEncryptedMessageHistoryStore(options = {}) {
  const db = await openHistoryDb(options.dbName ?? DEFAULT_DB_NAME);
  const key = await getOrCreateStoredKey(db);
  const maxPerThread = options.maxPerThread ?? options.maxRecords ?? DEFAULT_MESSAGE_HISTORY_MAX_PER_THREAD;

  return {
    async putMessage(input) {
      const record = await sealMessageHistoryRecord(key, input);
      const tx = db.transaction(MESSAGE_STORE_NAME, 'readwrite');
      tx.objectStore(MESSAGE_STORE_NAME).put(record);
      await transactionDone(tx);
      await pruneIndexedDbThread(db, record.threadId, maxPerThread);
      return { id: record.id, threadId: record.threadId, createdAt: record.createdAt };
    },
    /**
     * Every record's CLEAR header — id, threadId, createdAt, type, capsuleId — and not one decryption.
     *
     * This is what lets history load lazily without losing a belt. Deduplication of an arriving capsule used to
     * scan the threads held in memory, so a partially-loaded thread would have re-inserted an old message the
     * chain re-delivered (a manual sync asks for exactly that with forceIndexRescan). Headers give the caller
     * every capsule id it has ever stored, at no crypto cost, so the check stops depending on what happens to be
     * in memory.
     */
    async listMessageHeaders() {
      const tx = db.transaction(MESSAGE_STORE_NAME, 'readonly');
      const records = await requestToPromise(tx.objectStore(MESSAGE_STORE_NAME).getAll());
      await transactionDone(tx);
      return records
        .map((record) => ({
          id: record?.id ?? null,
          threadId: record?.threadId ?? null,
          createdAt: Number(record?.createdAt ?? 0),
          type: record?.type ?? null,
          capsuleId: record?.capsuleId ?? null,
        }))
        .sort((a, b) => a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id)));
    },
    async listMessages(filter = {}) {
      return (await this.listMessagesDetailed(filter)).messages;
    },
    /**
     * `threadId` narrows to one conversation; `limit` takes the NEWEST that many; `before` (a createdAt) pages
     * further back. Only the selected window is decrypted — the cost of opening a dialog is its window, not its
     * history.
     */
    async listMessagesDetailed(filter = {}) {
      const tx = db.transaction(MESSAGE_STORE_NAME, 'readonly');
      const store = tx.objectStore(MESSAGE_STORE_NAME);
      const source = filter.threadId
        ? store.index('threadId').getAll(filter.threadId)
        : store.getAll();
      let records = await requestToPromise(source);
      await transactionDone(tx);
      if (Number.isFinite(filter.before)) {
        records = records.filter((record) => Number(record?.createdAt ?? 0) < Number(filter.before));
      }
      if (Number.isFinite(filter.limit) && filter.limit >= 0 && records.length > filter.limit) {
        // Sort BEFORE slicing: the threadId index is keyed by thread, not by time, so "the newest N" is only
        // meaningful after ordering. Slicing first would decrypt an arbitrary N and call them the latest.
        records.sort((a, b) => Number(a?.createdAt ?? 0) - Number(b?.createdAt ?? 0));
        records = records.slice(records.length - filter.limit);
      }
      return openMessageHistoryRecords(key, records);
    },
    // Deleting a message means deleting it HERE too. Removing it only from the in-memory thread leaves the record in
    // durable history, and the next restore merges it straight back — the user's delete would silently undo itself.
    async deleteMessage(id) {
      if (!id) return false;
      const tx = db.transaction(MESSAGE_STORE_NAME, 'readwrite');
      tx.objectStore(MESSAGE_STORE_NAME).delete(String(id));
      await transactionDone(tx);
      return true;
    },
    get type() {
      return 'indexeddb';
    },
    get maxPerThread() {
      return maxPerThread;
    },
    get persistent() {
      return true;
    },
  };
}

export async function createMemoryEncryptedMessageHistoryStore(options = {}) {
  const key = options.key ?? await createHistoryKey();
  const records = new Map();
  const maxPerThread = options.maxPerThread ?? options.maxRecords ?? DEFAULT_MESSAGE_HISTORY_MAX_PER_THREAD;

  // Per thread, mirroring the IndexedDB store. The fallback must not have DIFFERENT retention from the real one:
  // a device that fell back to memory would otherwise lose a different set of messages than the same device with
  // IndexedDB working, and the difference would only show up as "my history is shorter here".
  function prune() {
    const byThread = new Map();
    for (const record of records.values()) {
      const bucket = byThread.get(record.threadId) ?? [];
      bucket.push(record);
      byThread.set(record.threadId, bucket);
    }
    for (const bucket of byThread.values()) {
      bucket.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      for (const record of bucket.slice(0, Math.max(0, bucket.length - maxPerThread))) {
        records.delete(record.id);
      }
    }
  }

  return {
    async putMessage(input) {
      const record = await sealMessageHistoryRecord(key, input);
      records.set(record.id, record);
      prune();
      return { id: record.id, threadId: record.threadId, createdAt: record.createdAt };
    },
    // The SAME shape as the IndexedDB store, deliberately. A fallback that answered a narrower API would fail only
    // on devices where IndexedDB is unavailable — the ones nobody tests on.
    async listMessageHeaders() {
      return [...records.values()]
        .map((record) => ({
          id: record?.id ?? null,
          threadId: record?.threadId ?? null,
          createdAt: Number(record?.createdAt ?? 0),
          type: record?.type ?? null,
          capsuleId: record?.capsuleId ?? null,
        }))
        .sort((a, b) => a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id)));
    },
    async listMessages(filter = {}) {
      return (await this.listMessagesDetailed(filter)).messages;
    },
    async listMessagesDetailed(filter = {}) {
      let selected = [...records.values()]
        .filter((record) => !filter.threadId || record.threadId === filter.threadId)
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      if (Number.isFinite(filter.before)) {
        selected = selected.filter((record) => Number(record.createdAt) < Number(filter.before));
      }
      if (Number.isFinite(filter.limit) && filter.limit >= 0 && selected.length > filter.limit) {
        selected = selected.slice(selected.length - filter.limit);
      }
      return openMessageHistoryRecords(key, selected);
    },
    async deleteMessage(id) {
      if (!id) return false;
      return records.delete(String(id));
    },
    dumpEncryptedRecords() {
      return safeClone([...records.values()]);
    },
    replaceEncryptedRecords(recordsInput = []) {
      records.clear();
      for (const record of recordsInput ?? []) {
        if (!record?.id) continue;
        records.set(record.id, safeClone(record));
      }
      prune();
    },
    get type() {
      return 'memory';
    },
    get maxPerThread() {
      return maxPerThread;
    },
    get persistent() {
      return false;
    },
  };
}
