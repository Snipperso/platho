const DEFAULT_DB_NAME = 'platho-local-message-history-v1';
const KEY_STORE_NAME = 'historyKeys';
const MESSAGE_STORE_NAME = 'encryptedMessages';
const PENDING_PAYMENT_CHECK_STORE_NAME = 'pendingPaymentChecks';
const DEFAULT_KEY_ID = 'device-history-key-v1';
const MESSAGE_HISTORY_VERSION = 1;
const MESSAGE_HISTORY_DB_VERSION = 2;
const MESSAGE_HISTORY_DOMAIN = 'PLATHO.LOCAL.MESSAGE_HISTORY.V1';
const PENDING_PAYMENT_CHECK_THREAD_ID = 'pending-payment-check-ledger';
const PENDING_PAYMENT_CHECK_MESSAGE_TYPE = 'payment-check-pending';
const AES_GCM_NONCE_BYTES = 12;
export const DEFAULT_MESSAGE_HISTORY_MAX_RECORDS = 500;

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
  return JSON.parse(JSON.stringify(value));
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

function normalizePendingPaymentCheckInput(input) {
  const record = safeClone(assertObject(input, 'pending payment check input'));
  const id = assertString(
    record.id ?? record.ledgerId ?? record.intentIdHex ?? record.intentId,
    'pending payment check id',
  );
  const createdAtInput = Number(record.createdAtMs ?? record.createdAt);
  const createdAt = Number.isFinite(createdAtInput) && createdAtInput > 0 ? createdAtInput : Date.now();
  return {
    id,
    threadId: PENDING_PAYMENT_CHECK_THREAD_ID,
    createdAt,
    thread: null,
    message: {
      ...record,
      type: PENDING_PAYMENT_CHECK_MESSAGE_TYPE,
      id,
      ledgerId: id,
      createdAt,
    },
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

function pendingPaymentCheckFromOpenedRecord(record) {
  const message = assertObject(record.message, 'pending payment check record');
  return {
    ...safeClone(message),
    id: record.id,
    ledgerId: record.id,
    createdAt: message.createdAt ?? record.createdAt,
  };
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
    if (!db.objectStoreNames.contains(PENDING_PAYMENT_CHECK_STORE_NAME)) {
      const store = db.createObjectStore(PENDING_PAYMENT_CHECK_STORE_NAME, { keyPath: 'id' });
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

async function pruneIndexedDbMessages(db, maxRecords) {
  const tx = db.transaction(MESSAGE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(MESSAGE_STORE_NAME);
  const count = await requestToPromise(store.count());
  if (count <= maxRecords) {
    await transactionDone(tx);
    return;
  }
  const toDelete = count - maxRecords;
  let deleted = 0;
  const cursorRequest = store.index('createdAt').openCursor();
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor || deleted >= toDelete) return;
    cursor.delete();
    deleted += 1;
    cursor.continue();
  };
  await transactionDone(tx);
}

export async function createIndexedDbEncryptedMessageHistoryStore(options = {}) {
  const db = await openHistoryDb(options.dbName ?? DEFAULT_DB_NAME);
  const key = await getOrCreateStoredKey(db);
  const maxRecords = options.maxRecords ?? DEFAULT_MESSAGE_HISTORY_MAX_RECORDS;

  return {
    async putMessage(input) {
      const record = await sealMessageHistoryRecord(key, input);
      const tx = db.transaction(MESSAGE_STORE_NAME, 'readwrite');
      tx.objectStore(MESSAGE_STORE_NAME).put(record);
      await transactionDone(tx);
      await pruneIndexedDbMessages(db, maxRecords);
      return { id: record.id, threadId: record.threadId, createdAt: record.createdAt };
    },
    async listMessages(filter = {}) {
      return (await this.listMessagesDetailed(filter)).messages;
    },
    async listMessagesDetailed(filter = {}) {
      const tx = db.transaction(MESSAGE_STORE_NAME, 'readonly');
      const store = tx.objectStore(MESSAGE_STORE_NAME);
      const source = filter.threadId
        ? store.index('threadId').getAll(filter.threadId)
        : store.getAll();
      const records = await requestToPromise(source);
      await transactionDone(tx);
      return openMessageHistoryRecords(key, records);
    },
    async putPendingPaymentCheck(input) {
      const record = await sealMessageHistoryRecord(key, normalizePendingPaymentCheckInput(input));
      const tx = db.transaction(PENDING_PAYMENT_CHECK_STORE_NAME, 'readwrite');
      tx.objectStore(PENDING_PAYMENT_CHECK_STORE_NAME).put(record);
      await transactionDone(tx);
      return { id: record.id, createdAt: record.createdAt };
    },
    async getPendingPaymentCheck(id) {
      const tx = db.transaction(PENDING_PAYMENT_CHECK_STORE_NAME, 'readonly');
      const record = await requestToPromise(tx.objectStore(PENDING_PAYMENT_CHECK_STORE_NAME).get(id));
      await transactionDone(tx);
      if (!record) return null;
      return pendingPaymentCheckFromOpenedRecord(await openMessageHistoryRecord(key, record));
    },
    async listPendingPaymentChecks() {
      const tx = db.transaction(PENDING_PAYMENT_CHECK_STORE_NAME, 'readonly');
      const records = await requestToPromise(tx.objectStore(PENDING_PAYMENT_CHECK_STORE_NAME).getAll());
      await transactionDone(tx);
      const opened = await openMessageHistoryRecords(key, records);
      return {
        records: opened.messages.map(pendingPaymentCheckFromOpenedRecord),
        failed: opened.failed,
      };
    },
    async removePendingPaymentCheck(id) {
      const tx = db.transaction(PENDING_PAYMENT_CHECK_STORE_NAME, 'readwrite');
      tx.objectStore(PENDING_PAYMENT_CHECK_STORE_NAME).delete(id);
      await transactionDone(tx);
    },
    get type() {
      return 'indexeddb';
    },
    get maxRecords() {
      return maxRecords;
    },
    get persistent() {
      return true;
    },
  };
}

export async function createMemoryEncryptedMessageHistoryStore(options = {}) {
  const key = options.key ?? await createHistoryKey();
  const records = new Map();
  const pendingPaymentChecks = new Map();
  const maxRecords = options.maxRecords ?? DEFAULT_MESSAGE_HISTORY_MAX_RECORDS;

  function prune() {
    const ordered = [...records.values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    for (const record of ordered.slice(0, Math.max(0, ordered.length - maxRecords))) {
      records.delete(record.id);
    }
  }

  return {
    async putMessage(input) {
      const record = await sealMessageHistoryRecord(key, input);
      records.set(record.id, record);
      prune();
      return { id: record.id, threadId: record.threadId, createdAt: record.createdAt };
    },
    async listMessages(filter = {}) {
      return (await this.listMessagesDetailed(filter)).messages;
    },
    async listMessagesDetailed(filter = {}) {
      const selected = [...records.values()]
        .filter((record) => !filter.threadId || record.threadId === filter.threadId)
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      return openMessageHistoryRecords(key, selected);
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
    async putPendingPaymentCheck(input) {
      const record = await sealMessageHistoryRecord(key, normalizePendingPaymentCheckInput(input));
      pendingPaymentChecks.set(record.id, record);
      return { id: record.id, createdAt: record.createdAt };
    },
    async getPendingPaymentCheck(id) {
      const record = pendingPaymentChecks.get(id);
      if (!record) return null;
      return pendingPaymentCheckFromOpenedRecord(await openMessageHistoryRecord(key, record));
    },
    async listPendingPaymentChecks() {
      const opened = await openMessageHistoryRecords(key, [...pendingPaymentChecks.values()]);
      return {
        records: opened.messages.map(pendingPaymentCheckFromOpenedRecord),
        failed: opened.failed,
      };
    },
    async removePendingPaymentCheck(id) {
      pendingPaymentChecks.delete(id);
    },
    dumpEncryptedPendingPaymentCheckRecords() {
      return safeClone([...pendingPaymentChecks.values()]);
    },
    replaceEncryptedPendingPaymentCheckRecords(recordsInput = []) {
      pendingPaymentChecks.clear();
      for (const record of recordsInput ?? []) {
        if (!record?.id) continue;
        pendingPaymentChecks.set(record.id, safeClone(record));
      }
    },
    get type() {
      return 'memory';
    },
    get maxRecords() {
      return maxRecords;
    },
    get persistent() {
      return false;
    },
  };
}
