export const RESECURE_STATE_KEY = 'platho.storage.resecure.v1';
export const RESECURE_ATTEMPTS_KEY = 'platho.storage.resecure.attempts.v1';
export const RESECURE_MAX_ATTEMPTS = 2;
export const RESECURE_UNCONFIRMED_KEY = 'platho.storage.resecure.unconfirmed.v1';
export const RESECURE_MAX_UNCONFIRMED = 5;
export const RESECURE_UNANSWERED_KEY = 'platho.storage.resecure.unanswered.v1';
export const RESECURE_PARKED_UNTIL_KEY = 'platho.storage.resecure.parkedUntil.v1';
export const RESECURE_MAX_UNANSWERED = 5;
export const RESECURE_UNANSWERED_PARK_MS = 7 * 86_400_000;
export const RESECURE_PROBE_TIMEOUT_MS = 5_000;
export const RESECURE_CLEAR_TIMEOUT_MS = 20_000;
export const RESECURE_ABORT_SETTLE_MS = 3_000;
export const RESECURE_WRITE_CHUNK = 1_000;
export const RESECURE_RECOVER_KEY = 'platho.storage.resecure.recover.v1';
export const RESECURE_RECOVER_SETTLED_KEY = 'platho.storage.resecure.recoverSettled.v1';
export const RESECURE_CLEARED_KEY = 'platho.storage.resecure.cleared.v1';
export const RESECURE_WINDOW_LOCK = 'platho.storage.windows';
export const RESECURE_WINDOW_WAIT_MS = 120_000;
export const RESECURE_WALLET_RECORD_KEY = 'platho.wallet.encrypted.v1';
export const RESECURE_LEGACY_WALLET_KEY = 'platho.wallet.recovery.v1';
export const RESECURE_BACKUP_PENDING_KEY = 'platho.wallet.keybackup.pending.v1';
export function walletWithoutBackup(localStorage) {
  try {
    if (localStorage.getItem(RESECURE_LEGACY_WALLET_KEY) !== null) return true;
    if (localStorage.getItem(RESECURE_WALLET_RECORD_KEY) === null) return false;
    const pending = JSON.parse(localStorage.getItem(RESECURE_BACKUP_PENDING_KEY) ?? '[]');
    return !Array.isArray(pending) || pending.length > 0;
  } catch {
    return true;
  }
}
export const RESECURE_HEAP_FACTOR = 1.3;
export const RESECURE_HEAP_SHARE = 0.5;
export const RESECURE_HEAP_ASSUMED_BYTES = 512 * 1024 * 1024;
export function resecureFits({ usage, heapLimit = null } = {}) {
  if (typeof usage !== 'number' || !Number.isFinite(usage) || usage < 0) return false;
  const limit = Number(heapLimit) > 0 ? Number(heapLimit) : RESECURE_HEAP_ASSUMED_BYTES;
  return usage * RESECURE_HEAP_FACTOR <= limit * RESECURE_HEAP_SHARE;
}

export const RESECURE_SPILL_CHUNK_BYTES = 4 * 1024 * 1024;
export const RESECURE_HISTORY_DB_PREFIX = 'platho-local-message-history-v1';
export const RESECURE_SPILL_BATCH = 1_000;
export const RESECURE_SPILL_MAX_BYTES = 2 * 1024 * 1024 * 1024;

const CARRY = Object.freeze({
  UNDEFINED: 0, NULL: 1, FALSE: 2, TRUE: 3, NUMBER: 4, UTF8: 5, UTF16: 6, BIGINT: 7, DATE: 8, ARRAY: 9, OBJECT: 10, BUFFER: 11, VIEW: 12,
  MAP: 13, SET: 14,
});
const CARRY_VIEWS = Object.freeze(['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array',
  'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array', 'DataView']);
const CARRY_MAX_DEPTH = 64;
const UNCARRIED = Symbol('uncarried');
const carryTag = (value) => Object.prototype.toString.call(value).slice(8, -1);
const carryUtf8 = new TextEncoder();
const carryText = new TextDecoder('utf-8', { fatal: true });

function wellFormedText(text) {
  if (typeof text.isWellFormed === 'function') return text.isWellFormed();
  for (let i = 0; i < text.length; i += 1) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      i += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function carryWriter() {
  let bytes = new Uint8Array(1024);
  let view = new DataView(bytes.buffer);
  let at = 0;
  const room = (n) => {
    if (at + n <= bytes.length) return;
    let size = bytes.length * 2;
    while (size < at + n) size *= 2;
    const grown = new Uint8Array(size);
    grown.set(bytes.subarray(0, at));
    bytes = grown;
    view = new DataView(bytes.buffer);
  };
  return {
    get size() { return at; },
    byte(value) { room(1); bytes[at] = value; at += 1; },
    uint(value) {
      room(8);
      let rest = value;
      while (rest >= 0x80) { bytes[at] = (rest % 0x80) | 0x80; at += 1; rest = Math.floor(rest / 0x80); }
      bytes[at] = rest;
      at += 1;
    },
    float(value) { room(8); view.setFloat64(at, value, true); at += 8; },
    raw(part) { room(part.length); bytes.set(part, at); at += part.length; },
    span(from) { return bytes.subarray(from, at); },
    rewind(to) { at = to; },
    take() { return bytes.slice(0, at); },
  };
}

function carryReader(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 0;
  const need = (n) => { if (n > bytes.length - at) throw new Error('a carried record ends early'); };
  return {
    get done() { return at >= bytes.length; },
    get left() { return bytes.length - at; },
    byte() { need(1); const value = bytes[at]; at += 1; return value; },
    uint() {
      let value = 0;
      let scale = 1;
      for (;;) {
        need(1);
        const part = bytes[at];
        at += 1;
        value += (part & 0x7f) * scale;
        if (part < 0x80) return value;
        scale *= 0x80;
        if (scale > 2 ** 56) throw new Error('a carried length runs on');
      }
    },
    float() { need(8); const value = view.getFloat64(at, true); at += 8; return value; },
    raw(n) { need(n); const part = bytes.slice(at, at + n); at += n; return part; },
  };
}

function carryString(text, writer) {
  if (wellFormedText(text)) {
    const bytes = carryUtf8.encode(text);
    writer.byte(CARRY.UTF8);
    writer.uint(bytes.length);
    writer.raw(bytes);
    return;
  }
  const units = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i += 1) {
    const unit = text.charCodeAt(i);
    units[i * 2] = unit & 0xff;
    units[i * 2 + 1] = unit >> 8;
  }
  writer.byte(CARRY.UTF16);
  writer.uint(text.length);
  writer.raw(units);
}

function readCarriedString(reader, tag) {
  if (tag === CARRY.UTF8) return carryText.decode(reader.raw(reader.uint()));
  if (tag !== CARRY.UTF16) throw new Error('a carried key is not a string');
  const length = reader.uint();
  const units = reader.raw(length * 2);
  let text = '';
  for (let from = 0; from < length; from += 4096) {
    const end = Math.min(length, from + 4096);
    const part = new Array(end - from);
    for (let i = from; i < end; i += 1) part[i - from] = units[i * 2] | (units[i * 2 + 1] << 8);
    text += String.fromCharCode(...part);
  }
  return text;
}

function carryValue(value, writer, seen, depth) {
  if (depth > CARRY_MAX_DEPTH) throw UNCARRIED;
  if (value === undefined) { writer.byte(CARRY.UNDEFINED); return; }
  if (value === null) { writer.byte(CARRY.NULL); return; }
  switch (typeof value) {
    case 'boolean': writer.byte(value ? CARRY.TRUE : CARRY.FALSE); return;
    case 'number': writer.byte(CARRY.NUMBER); writer.float(value); return;
    case 'string': carryString(value, writer); return;
    case 'bigint': {
      const digits = carryUtf8.encode(value.toString());
      writer.byte(CARRY.BIGINT);
      writer.uint(digits.length);
      writer.raw(digits);
      return;
    }
    case 'object': break;
    default: throw UNCARRIED;
  }
  if (seen.has(value)) throw UNCARRIED;
  seen.add(value);
  const tag = carryTag(value);
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) throw UNCARRIED;
    for (let i = 0; i < value.length; i += 1) if (!Object.prototype.hasOwnProperty.call(value, i)) throw UNCARRIED;
    writer.byte(CARRY.ARRAY);
    writer.uint(value.length);
    for (let i = 0; i < value.length; i += 1) carryValue(value[i], writer, seen, depth + 1);
    return;
  }
  if (tag === 'Object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && Object.getPrototypeOf(proto) !== null) throw UNCARRIED;
    const keys = Object.keys(value);
    writer.byte(CARRY.OBJECT);
    writer.uint(keys.length);
    for (const key of keys) {
      carryString(key, writer);
      carryValue(value[key], writer, seen, depth + 1);
    }
    return;
  }
  if (tag === 'Date') { writer.byte(CARRY.DATE); writer.float(Date.prototype.getTime.call(value)); return; }
  if (tag === 'ArrayBuffer') {
    if (value.resizable === true) throw UNCARRIED;
    writer.byte(CARRY.BUFFER);
    writer.uint(value.byteLength);
    writer.raw(new Uint8Array(value));
    return;
  }
  if (ArrayBuffer.isView(value)) {
    const kind = CARRY_VIEWS.indexOf(tag);
    const { buffer } = value;
    if (kind < 0 || carryTag(buffer) !== 'ArrayBuffer' || buffer.resizable === true || seen.has(buffer)) throw UNCARRIED;
    seen.add(buffer);
    writer.byte(CARRY.VIEW);
    writer.byte(kind);
    writer.uint(value.byteOffset);
    writer.uint(tag === 'DataView' ? value.byteLength : value.length);
    writer.uint(buffer.byteLength);
    writer.raw(new Uint8Array(buffer));
    return;
  }
  if (tag === 'Map') {
    writer.byte(CARRY.MAP);
    writer.uint(value.size);
    for (const [key, item] of Map.prototype.entries.call(value)) {
      carryValue(key, writer, seen, depth + 1);
      carryValue(item, writer, seen, depth + 1);
    }
    return;
  }
  if (tag === 'Set') {
    writer.byte(CARRY.SET);
    writer.uint(value.size);
    for (const item of Set.prototype.values.call(value)) carryValue(item, writer, seen, depth + 1);
    return;
  }
  throw UNCARRIED;
}

function readCarried(reader, depth = 0) {
  if (depth > CARRY_MAX_DEPTH) throw new Error('a carried record nests too deep');
  const tag = reader.byte();
  switch (tag) {
    case CARRY.UNDEFINED: return undefined;
    case CARRY.NULL: return null;
    case CARRY.FALSE: return false;
    case CARRY.TRUE: return true;
    case CARRY.NUMBER: return reader.float();
    case CARRY.UTF8: case CARRY.UTF16: return readCarriedString(reader, tag);
    case CARRY.BIGINT: return BigInt(carryText.decode(reader.raw(reader.uint())));
    case CARRY.DATE: return new Date(reader.float());
    case CARRY.ARRAY: {
      const length = reader.uint();
      if (length > reader.left) throw new Error('a carried list is longer than its bytes');
      const out = new Array(length);
      for (let i = 0; i < length; i += 1) out[i] = readCarried(reader, depth + 1);
      return out;
    }
    case CARRY.OBJECT: {
      const count = reader.uint();
      if (count > reader.left) throw new Error('a carried object is longer than its bytes');
      const out = {};
      for (let i = 0; i < count; i += 1) {
        const key = readCarriedString(reader, reader.byte());
        Object.defineProperty(out, key, { value: readCarried(reader, depth + 1), writable: true, enumerable: true, configurable: true });
      }
      return out;
    }
    case CARRY.BUFFER: return reader.raw(reader.uint()).buffer;
    case CARRY.VIEW: {
      const kind = CARRY_VIEWS[reader.byte()];
      const byteOffset = reader.uint();
      const length = reader.uint();
      const buffer = reader.raw(reader.uint()).buffer;
      const View = kind ? globalThis[kind] : null;
      if (typeof View !== 'function') throw new Error('a carried view of a kind this engine lacks');
      return new View(buffer, byteOffset, length);
    }
    case CARRY.MAP: {
      const size = reader.uint();
      if (size > reader.left) throw new Error('a carried map is longer than its bytes');
      const out = new Map();
      for (let i = 0; i < size; i += 1) {
        const key = readCarried(reader, depth + 1);
        out.set(key, readCarried(reader, depth + 1));
      }
      return out;
    }
    case CARRY.SET: {
      const size = reader.uint();
      if (size > reader.left) throw new Error('a carried set is longer than its bytes');
      const out = new Set();
      for (let i = 0; i < size; i += 1) out.add(readCarried(reader, depth + 1));
      return out;
    }
    default: throw new Error(`a carried record with an unknown tag ${tag}`);
  }
}

function sameCarriedBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function sameCarried(a, b, depth = 0) {
  if (depth > CARRY_MAX_DEPTH) return false;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object') return Object.is(a, b);
  const tag = carryTag(a);
  if (tag !== carryTag(b)) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (!sameCarried(a[i], b[i], depth + 1)) return false;
    return true;
  }
  if (tag === 'Object') {
    const keys = Object.keys(a);
    const others = Object.keys(b);
    if (keys.length !== others.length) return false;
    for (let i = 0; i < keys.length; i += 1) if (keys[i] !== others[i] || !sameCarried(a[keys[i]], b[others[i]], depth + 1)) return false;
    return true;
  }
  if (tag === 'Date') return Object.is(Date.prototype.getTime.call(a), Date.prototype.getTime.call(b));
  if (tag === 'ArrayBuffer') return sameCarriedBytes(new Uint8Array(a), new Uint8Array(b));
  if (ArrayBuffer.isView(a)) {
    if (!ArrayBuffer.isView(b) || a.byteOffset !== b.byteOffset || a.byteLength !== b.byteLength) return false;
    if (tag !== 'DataView' && a.length !== b.length) return false;
    return sameCarriedBytes(new Uint8Array(a.buffer), new Uint8Array(b.buffer));
  }
  if (tag === 'Map' || tag === 'Set') {
    if (a.size !== b.size) return false;
    const left = tag === 'Map' ? [...Map.prototype.entries.call(a)] : [...Set.prototype.values.call(a)];
    const right = tag === 'Map' ? [...Map.prototype.entries.call(b)] : [...Set.prototype.values.call(b)];
    return left.every((item, i) => sameCarried(item, right[i], depth + 1));
  }
  return false;
}

function carryRecordInto(writer, key, value) {
  const start = writer.size;
  try {
    carryValue(key, writer, new Set(), 0);
    carryValue(value, writer, new Set(), 0);
    const reader = carryReader(writer.span(start));
    const keyBack = readCarried(reader);
    const valueBack = readCarried(reader);
    if (reader.done && sameCarried(key, keyBack) && sameCarried(value, valueBack)) return true;
  } catch { }
  writer.rewind(start);
  return false;
}

export function carryRecordBytes(key, value) {
  const writer = carryWriter();
  return carryRecordInto(writer, key, value) ? writer.take() : null;
}

export function readCarriedRecords(bytes) {
  const reader = carryReader(bytes);
  const out = [];
  while (!reader.done) out.push([readCarried(reader), readCarried(reader)]);
  return out;
}

async function carryDigest(bytes) {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  let hex = '';
  for (const byte of digest) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

function resecureCarriage(carriage, usage) {
  if (!carriage || typeof carriage.Blob !== 'function' || typeof carriage.keyRange?.lowerBound !== 'function') return null;
  if (typeof globalThis.crypto?.subtle?.digest !== 'function') return null;
  if (usage !== null && usage > RESECURE_SPILL_MAX_BYTES) return null;
  return {
    Blob: carriage.Blob,
    keyRange: carriage.keyRange,
    chunkBytes: Number(carriage.chunkBytes) > 0 ? Number(carriage.chunkBytes) : RESECURE_SPILL_CHUNK_BYTES,
    batch: Number(carriage.batch) > 0 ? Number(carriage.batch) : RESECURE_SPILL_BATCH,
  };
}

async function readCarryBatch(db, storeName, carriage, after) {
  const read = db.transaction(storeName, 'readonly');
  const keys = [];
  const values = [];
  let bytes = 0;
  const more = await new Promise((resolve, reject) => {
    const request = read.objectStore(storeName).openCursor(after === undefined ? undefined : carriage.keyRange.lowerBound(after, true));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { resolve(false); return; }
      keys.push(cursor.primaryKey);
      values.push(cursor.value);
      bytes += approxBytes(cursor.value) + approxBytes(cursor.primaryKey);
      if (bytes >= carriage.chunkBytes || keys.length >= carriage.batch) { resolve(true); return; }
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
  await transactionDone(read);
  return { keys, values, more };
}

async function rankedKeysOfStore(db, storeName) {
  const read = db.transaction(storeName, 'readonly');
  const store = read.objectStore(storeName);
  if (!store.indexNames?.contains?.(RESECURE_HISTORY_ORDER_INDEX)) { await transactionDone(read); return null; }
  const ranked = [];
  let conversation = -1;
  let tag;
  let rank = 0;
  await new Promise((resolve, reject) => {
    const request = store.index(RESECURE_HISTORY_ORDER_INDEX).openKeyCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { resolve(); return; }
      const t = Array.isArray(cursor.key) ? cursor.key[0] : cursor.key;
      if (conversation < 0 || t !== tag) { conversation += 1; tag = t; rank = 0; } else rank += 1;
      ranked.push([rank, conversation, cursor.primaryKey]);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
  const total = await new Promise((resolve, reject) => { const request = store.count(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  await transactionDone(read);
  ranked.sort((one, other) => one[0] - other[0] || one[1] - other[1]);
  return { keys: ranked.map((entry) => entry[2]), unplaced: total - ranked.length };
}
async function readCarryValues(db, storeName, keys) {
  const read = db.transaction(storeName, 'readonly');
  const store = read.objectStore(storeName);
  const values = await Promise.all(keys.map((key) => new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  })));
  await transactionDone(read);
  return values;
}
const carryKeyId = (key) => (typeof key === 'string' ? `s:${key}` : `j:${JSON.stringify(key)}`);

async function carryStoreOut(db, storeName, carriage) {
  const chunks = [];
  const kept = [];
  let count = 0;
  let writer = carryWriter();
  let records = 0;
  const seal = async () => {
    const bytes = writer.take();
    chunks.push({ blob: new carriage.Blob([bytes]), records, digest: await carryDigest(bytes) });
    writer = carryWriter();
    records = 0;
  };
  const take = async (key, value) => {
    count += 1;
    if (carryRecordInto(writer, key, value)) records += 1;
    else kept.push([key, value]);
    if (writer.size >= carriage.chunkBytes) await seal();
  };
  const ranked = await rankedKeysOfStore(db, storeName);
  const carried = ranked ? new Set() : null;
  if (ranked) {
    for (let from = 0; from < ranked.keys.length; from += carriage.batch) {
      const keys = ranked.keys.slice(from, from + carriage.batch);
      // eslint-disable-next-line no-await-in-loop
      const values = await readCarryValues(db, storeName, keys);
      for (let i = 0; i < keys.length; i += 1) {
        if (values[i] === undefined) continue;
        carried.add(carryKeyId(keys[i]));
        // eslint-disable-next-line no-await-in-loop
        await take(keys[i], values[i]);
      }
    }
  }
  if (!ranked || ranked.unplaced > 0) {
    let after;
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const batch = await readCarryBatch(db, storeName, carriage, after);
      for (let i = 0; i < batch.keys.length; i += 1) {
        if (carried?.has(carryKeyId(batch.keys[i]))) continue;
        // eslint-disable-next-line no-await-in-loop
        await take(batch.keys[i], batch.values[i]);
      }
      if (!batch.more || batch.keys.length === 0) break;
      after = batch.keys[batch.keys.length - 1];
    }
  }
  if (records > 0) await seal();
  return { chunks, kept, count };
}

async function carriageReadsBack(snapshot) {
  try {
    for (const database of snapshot.databases) {
      for (const spec of database.stores) {
        for (const part of spec.chunks ?? []) {
          // eslint-disable-next-line no-await-in-loop
          const bytes = new Uint8Array(await part.blob.arrayBuffer());
          // eslint-disable-next-line no-await-in-loop
          if (await carryDigest(bytes) !== part.digest) return false;
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

export const RESECURE_PATH = '/clear-site-storage';
export const RESECURE_HEADER = 'X-Platho-Resecure';
export const RESECURE_CONFIRMATION = 'cleared';
export const RESECURE_PROBE = 'probe';
export const RESECURE_READY = 'ready';
export const RESECURE_COOKIE = '__Host-platho_resecure';
export const RESECURE_COOKIE_MAX_AGE_S = 30 * 86_400;
export const RESECURE_LEGACY_COOKIE = 'platho_resecure';
export const RESECURE_SHARED_SITE_SUFFIXES = Object.freeze(['tgcloud.ai']);
function legacyCookieTrusted(hostname = globalThis.location?.hostname) {
  return !resecureHostShared(hostname);
}
export function resecureHostShared(hostname = globalThis.location?.hostname) {
  const host = String(hostname ?? '').toLowerCase();
  return RESECURE_SHARED_SITE_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export function sweepSharedHostCookies(document, { hostname = globalThis.location?.hostname } = {}) {
  const host = String(hostname ?? '').toLowerCase();
  const suffix = RESECURE_SHARED_SITE_SUFFIXES.find((entry) => host === entry || host.endsWith(`.${entry}`));
  if (!suffix || !document) return 0;
  let entries = [];
  try {
    entries = [...new Set(String(document.cookie ?? '').split(/;\s*/).map((part) => part.trim()).filter(Boolean))];
  } catch { return 0; }
  for (const entry of entries) {
    const at = entry.indexOf('=');
    const head = at > 0 ? `${entry.slice(0, at).trim()}=` : entry.replace(/^=/, '');
    for (const scope of [`Domain=${suffix}; Path=/`, `Domain=.${suffix}; Path=/`, 'Path=/']) {
      for (const partition of ['', '; Partitioned']) {
        try { document.cookie = `${head}; ${scope}; Max-Age=0; Secure; SameSite=None${partition}`; } catch { }
      }
    }
  }
  return entries.length;
}

const requestToPromise = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const transactionDone = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error);
  transaction.onabort = () => reject(transaction.error);
});
const openDatabase = (indexedDB, name, version = undefined, upgrade = null) => new Promise((resolve, reject) => {
  const request = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
  request.onupgradeneeded = () => { try { upgrade?.(request.result); } catch (error) { reject(error); } };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error(`the database ${name} is held open elsewhere`));
});

export async function listDatabases(indexedDB) {
  if (typeof indexedDB?.databases !== 'function') throw new Error('this browser cannot list its databases');
  return (await indexedDB.databases()).filter((entry) => typeof entry?.name === 'string');
}

function entriesOf(storage) {
  const out = [];
  for (let i = 0; i < (storage?.length ?? 0); i += 1) {
    const key = storage.key(i);
    if (key !== null) out.push([key, storage.getItem(key)]);
  }
  return out;
}

export async function snapshotOriginStorage({
  indexedDB, localStorage, sessionStorage = null, carries = () => true, cacheRank = () => -1, cacheBudgetBytes = RESECURE_CACHE_CARRY_BUDGET_BYTES,
  keeps = () => true, carryOut = null,
}) {
  const local = entriesOf(localStorage);
  const heldWallet = local.some(([key]) => key === RESECURE_WALLET_RECORD_KEY || key === RESECURE_LEGACY_WALLET_KEY);
  let session = [];
  try { session = sessionStorage ? entriesOf(sessionStorage) : []; } catch { session = []; }
  const databases = [];
  const caches = [];
  for (const { name, version } of await listDatabases(indexedDB)) {
    if (!keeps(name, { heldWallet })) continue;
    // eslint-disable-next-line no-await-in-loop
    const db = await openDatabase(indexedDB, name);
    try {
      const stores = [];
      for (const storeName of [...db.objectStoreNames]) {
        const read = db.transaction(storeName, 'readonly');
        const store = read.objectStore(storeName);
        const indexes = [...store.indexNames].map((indexName) => {
          const index = store.index(indexName);
          return { name: indexName, keyPath: index.keyPath, unique: index.unique, multiEntry: index.multiEntry };
        });
        const carried = carries(name, storeName);
        const spec = { name: storeName, keyPath: store.keyPath, autoIncrement: store.autoIncrement, indexes, keys: [], values: [] };
        if (carried && carryOut) {
          // eslint-disable-next-line no-await-in-loop
          await transactionDone(read);
          // eslint-disable-next-line no-await-in-loop
          Object.assign(spec, await carryStoreOut(db, storeName, carryOut));
        } else {
          // eslint-disable-next-line no-await-in-loop
          const [keys, values] = carried ? await Promise.all([requestToPromise(store.getAllKeys()), requestToPromise(store.getAll())]) : [[], []];
          // eslint-disable-next-line no-await-in-loop
          await transactionDone(read);
          spec.keys = keys;
          spec.values = values;
        }
        const rank = carried ? -1 : cacheRank(name, storeName);
        if (rank >= 0) { spec.cache = true; caches.push({ name, rank, spec }); }
        stores.push(spec);
      }
      databases.push({ name, version: Number(version) || db.version, stores });
    } finally {
      db.close();
    }
  }
  let used = 0;
  for (const { name, spec } of caches.sort((a, b) => a.rank - b.rank)) {
    if (used >= cacheBudgetBytes) break;
    // eslint-disable-next-line no-await-in-loop
    const read = await readStoreWithinBudget(indexedDB, name, spec.name, cacheBudgetBytes - used).catch(() => null);
    if (!read) continue;
    spec.keys = read.keys;
    spec.values = read.values;
    used += read.bytes;
  }
  return { local, session, databases, cacheBytes: used };
}

function approxBytes(value, depth = 0) {
  if (value === null || value === undefined) return 8;
  if (typeof value === 'string') return value.length;
  if (typeof value !== 'object') return 8;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (depth > 4) return 64;
  let sum = 32;
  if (Array.isArray(value)) { for (const item of value) sum += approxBytes(item, depth + 1); return sum; }
  for (const key of Object.keys(value)) sum += key.length + approxBytes(value[key], depth + 1);
  return sum;
}

async function readStoreWithinBudget(indexedDB, dbName, storeName, budget) {
  const db = await openDatabase(indexedDB, dbName);
  try {
    const read = db.transaction(storeName, 'readonly');
    const keys = [];
    const values = [];
    let bytes = 0;
    const fits = await new Promise((resolve, reject) => {
      const request = read.objectStore(storeName).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { resolve(true); return; }
        bytes += approxBytes(cursor.value) + approxBytes(cursor.primaryKey);
        if (bytes > budget) { resolve(false); return; }
        keys.push(cursor.primaryKey);
        values.push(cursor.value);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
    await transactionDone(read).catch(() => {});
    return fits ? { keys, values, bytes } : null;
  } finally {
    db.close();
  }
}

export async function snapshotCacheStorage(caches, { budgetBytes = RESECURE_CACHE_STORAGE_BUDGET_BYTES } = {}) {
  if (!caches || typeof caches.keys !== 'function') return [];
  const out = [];
  let used = 0;
  for (const name of [...await caches.keys()].reverse()) {
    // eslint-disable-next-line no-await-in-loop
    const cache = await caches.open(name);
    const entries = [];
    let bytes = 0;
    let fits = true;
    // eslint-disable-next-line no-await-in-loop
    for (const request of await cache.keys()) {
      // eslint-disable-next-line no-await-in-loop
      const response = await cache.match(request);
      if (!response || response.type === 'opaque' || response.status < 200 || response.status > 299) continue;
      // eslint-disable-next-line no-await-in-loop
      const body = await response.arrayBuffer();
      bytes += body.byteLength + request.url.length;
      if (used + bytes > budgetBytes) { fits = false; break; }
      const headers = [...response.headers.entries()].filter(([header]) => !/^set-cookie2?$/i.test(header));
      entries.push({ url: request.url, status: response.status, statusText: response.statusText, headers, body });
    }
    if (!fits) break;
    used += bytes;
    out.push({ name, entries });
  }
  return out;
}

export async function restoreCacheStorage(carried, caches) {
  if (!caches || typeof caches.open !== 'function' || !Array.isArray(carried) || carried.length === 0) return 0;
  let present = null;
  try { present = new Set(await caches.keys()); } catch { present = null; }
  let written = 0;
  for (const { name, entries } of carried) {
    if (present?.has(name)) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      const cache = await caches.open(name);
      for (const entry of entries) {
        // eslint-disable-next-line no-await-in-loop
        await cache.put(new Request(entry.url), new Response(entry.body, { status: entry.status, statusText: entry.statusText, headers: entry.headers }));
        written += 1;
      }
    } catch { }
  }
  return written;
}

const carriedCount = (spec) => (Number.isInteger(spec.count) ? spec.count : spec.values.length);
const recordCount = (database) => database.stores.reduce((sum, store) => sum + carriedCount(store), 0);

function carriedSources(spec) {
  const sources = [];
  if (spec.values.length > 0) sources.push({ read: async () => spec.values.map((value, at) => [spec.keys[at], value]) });
  if ((spec.kept ?? []).length > 0) sources.push({ read: async () => spec.kept });
  for (const part of spec.chunks ?? []) {
    sources.push({
      read: async () => {
        const bytes = new Uint8Array(await part.blob.arrayBuffer());
        if (await carryDigest(bytes) !== part.digest) throw new Error('a carried part came back changed');
        return readCarriedRecords(bytes);
      },
      done: () => { part.blob = null; },
    });
  }
  return sources;
}
const RESECURE_HISTORY_ORDER_INDEX = 'convOrder';
export const RESECURE_SHORT_WRITE_BACK_KEY = 'platho.storage.resecure.shortWriteBack.v1';
function oldestFirst(spec, records) {
  if (!(spec.indexes ?? []).some((index) => index.name === RESECURE_HISTORY_ORDER_INDEX)) return records;
  const conversations = new Map();
  const unplaced = [];
  for (const record of records) {
    const value = record?.[1];
    const o = Number(value?.o);
    if (value?.t === undefined || value?.t === null || !Number.isFinite(o)) { unplaced.push(record); continue; }
    const key = String(value.t);
    if (!conversations.has(key)) conversations.set(key, []);
    conversations.get(key).push(record);
  }
  const placed = [];
  let conversation = 0;
  for (const list of conversations.values()) {
    list.sort((one, other) => Number(one[1].o) - Number(other[1].o));
    for (let rank = 0; rank < list.length; rank += 1) placed.push([rank, conversation, list[rank]]);
    conversation += 1;
  }
  placed.sort((one, other) => one[0] - other[0] || one[1] - other[1]);
  return [...placed.map((entry) => entry[2]), ...unplaced];
}
export const RESECURE_WRITE_RETRY_MS = Object.freeze([250, 1_000, 3_000]);
async function writeCarriedBatch(db, spec, batch, disk = { full: false }) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const write = db.transaction(spec.name, 'readwrite');
      const store = write.objectStore(spec.name);
      for (const [key, value] of batch) {
        if (spec.keyPath === null) store.put(value, key); else store.put(value);
      }
      // eslint-disable-next-line no-await-in-loop
      await transactionDone(write);
      return;
    } catch (error) {
      if (error?.name === 'QuotaExceededError' && (disk.full || attempt >= 1)) { disk.full = true; throw error; }
      if (error?.name !== 'QuotaExceededError' || attempt >= RESECURE_WRITE_RETRY_MS.length) throw error;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => { setTimeout(resolve, RESECURE_WRITE_RETRY_MS[attempt]); });
    }
  }
}

export const RESECURE_CACHE_DATABASES = Object.freeze([
  'platho-profile-avatar-media-v1', 'platho-telegram-gifts-v1', 'platho-telegram-gift-art-v1', 'platho-username-nfts-v1',
  'platho-channel-gift-dress-v1', 'platho-latest-posts-v1', 'platho-public-comments-v1', 'platho-public-post-media-v1',
  'platho-channel-catalogue-v1', 'platho-all-feed-v1', 'platho-all-feed-media-v1',
]);
export const RESECURE_SEALED_CACHE_DATABASE = 'platho-sealed-cache-v1';
export const RESECURE_RETIRED_CACHE_DATABASES = Object.freeze(['platho-public-entry-bodies-v1', 'platho-public-comment-parts-v1']);

export function resecureKeepsDatabase(dbName, { heldWallet = false } = {}) {
  const base = String(dbName ?? '').split('.')[0];
  if (RESECURE_RETIRED_CACHE_DATABASES.includes(base)) return false;
  if (heldWallet && RESECURE_CACHE_DATABASES.includes(base)) return false;
  return true;
}
export const RESECURE_SEALED_CACHE_CARRIED_STORES = Object.freeze(['facePointers', 'walletSets']);

export const RESECURE_CACHE_CARRY_BUDGET_BYTES = 16 * 1024 * 1024;
export const RESECURE_CACHE_STORAGE_BUDGET_BYTES = 24 * 1024 * 1024;
export const RESECURE_CACHE_NAMESPACES = Object.freeze([
  'avatarMedia', 'giftLists', 'giftArt', 'nftLists', 'giftDress', 'latestPosts', 'publicComments', 'publicPostMedia',
  'channelCatalogue', 'allFeed', 'allFeedMedia',
]);
export const RESECURE_CACHE_CARRY_ORDER = Object.freeze([
  'channelCatalogue', 'giftLists', 'nftLists', 'walletAssets', 'giftDress', 'latestPosts', 'allFeed', 'shardPlans', 'laneMarks', 'avatarMedia',
  'publicComments', 'giftArt', 'publicPostMedia', 'allFeedMedia',
]);
export function resecureCacheCarryRank(dbName, storeName) {
  const base = String(dbName ?? '').split('.')[0];
  const plain = RESECURE_CACHE_DATABASES.indexOf(base);
  const namespace = plain >= 0 ? RESECURE_CACHE_NAMESPACES[plain] : (base === RESECURE_SEALED_CACHE_DATABASE ? String(storeName) : null);
  return namespace === null ? -1 : RESECURE_CACHE_CARRY_ORDER.indexOf(namespace);
}
export function resecureCarriesStore(dbName, storeName) {
  const base = String(dbName ?? '').split('.')[0];
  if (RESECURE_CACHE_DATABASES.includes(base)) return false;
  if (base === RESECURE_SEALED_CACHE_DATABASE) return RESECURE_SEALED_CACHE_CARRIED_STORES.includes(String(storeName));
  return true;
}

export function writeBackLocalStorage(snapshot, localStorage) {
  return writeBackEntries(snapshot.local, localStorage);
}
export function writeBackSessionStorage(snapshot, sessionStorage) {
  return sessionStorage ? writeBackEntries(snapshot.session ?? [], sessionStorage) : 0;
}
function writeBackEntries(entries, storage) {
  let written = 0;
  for (const [key, value] of entries) {
    try {
      if (storage.getItem(key) !== null) continue;
      storage.setItem(key, value);
      written += 1;
    } catch { }
  }
  return written;
}

export async function restoreOriginStorage(snapshot, { indexedDB, localStorage, localDone = false, chunk = RESECURE_WRITE_CHUNK }) {
  const localWritten = localDone ? 0 : writeBackLocalStorage(snapshot, localStorage);
  let present = new Set();
  try { present = new Set((await listDatabases(indexedDB)).map((entry) => entry.name)); } catch { present = new Set(); }
  const databases = [];
  const failed = [];
  const history = (database) => (String(database.name).startsWith(RESECURE_HISTORY_DB_PREFIX) ? 0 : 1);
  const disk = { full: false };
  for (const database of [...snapshot.databases].sort((a, b) => history(a) - history(b) || recordCount(a) - recordCount(b))) {
    if (present.has(database.name)) continue;
    let db;
    try {
      // eslint-disable-next-line no-await-in-loop
      db = await openDatabase(indexedDB, database.name, database.version, (fresh) => {
        for (const spec of database.stores) {
          const store = fresh.createObjectStore(spec.name, { keyPath: spec.keyPath, autoIncrement: spec.autoIncrement });
          for (const index of spec.indexes) store.createIndex(index.name, index.keyPath, { unique: index.unique, multiEntry: index.multiEntry });
        }
      });
    } catch {
      failed.push(database.name);
      continue;
    }
    let whole = true;
    try {
      for (const spec of database.stores) {
        let storeWhole = true;
        for (const source of carriedSources(spec)) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const records = oldestFirst(spec, await source.read());
            for (let from = 0; from < records.length; from += chunk) {
              // eslint-disable-next-line no-await-in-loop
              await writeCarriedBatch(db, spec, records.slice(from, from + chunk), disk);
            }
            source.done?.();
          } catch {
            storeWhole = false;
          }
        }
        if (!storeWhole) {
          if (spec.cache) continue;
          whole = false;
          failed.push(`${database.name}/${spec.name}`);
        }
      }
    } finally {
      db.close();
    }
    if (whole) databases.push(database.name);
  }
  return { localWritten, databases, failed };
}

export async function verifyOriginStorage(snapshot, { indexedDB, localStorage }) {
  const missingLocal = snapshot.local.filter(([key]) => localStorage.getItem(key) === null).map(([key]) => key);
  const shortStores = [];
  let present = null;
  try { present = new Set((await listDatabases(indexedDB)).map((entry) => entry.name)); } catch { present = null; }
  for (const database of snapshot.databases) {
    if (!present || !present.has(database.name)) { shortStores.push(`${database.name}/*`); continue; }
    // eslint-disable-next-line no-await-in-loop
    const db = await openDatabase(indexedDB, database.name);
    try {
      for (const spec of database.stores) {
        if (![...db.objectStoreNames].includes(spec.name)) { shortStores.push(`${database.name}/${spec.name}`); continue; }
        if (spec.cache) continue;
        const read = db.transaction(spec.name, 'readonly');
        // eslint-disable-next-line no-await-in-loop
        const count = await requestToPromise(read.objectStore(spec.name).count());
        if (count < carriedCount(spec)) shortStores.push(`${database.name}/${spec.name}`);
      }
    } finally {
      db.close();
    }
  }
  return { ok: missingLocal.length === 0 && shortStores.length === 0, missingLocal, shortStores };
}

export async function siteStorageClearProbe({ fetch, path = RESECURE_PATH, timeoutMs = RESECURE_PROBE_TIMEOUT_MS }) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(path, {
      method: 'GET', cache: 'no-store', credentials: 'same-origin', headers: { [RESECURE_HEADER]: RESECURE_PROBE }, ...(controller ? { signal: controller.signal } : {}),
    });
    return response.status === 204 && response.headers.get(RESECURE_HEADER) === RESECURE_READY ? 'ready' : 'refused';
  } catch {
    return 'unreachable';
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export async function siteStorageClearAvailable(options) {
  return (await siteStorageClearProbe(options)) === 'ready';
}

export async function askSiteStorageClear({ fetch, path = RESECURE_PATH, timeoutMs = RESECURE_CLEAR_TIMEOUT_MS }) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(path, {
      method: 'GET', cache: 'no-store', credentials: 'same-origin', headers: { [RESECURE_HEADER]: '1' }, ...(controller ? { signal: controller.signal } : {}),
    });
    return response.status === 204 && response.headers.get(RESECURE_HEADER) === RESECURE_CONFIRMATION ? 'cleared' : 'unconfirmed';
  } catch {
    return 'unanswered';
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export async function requestSiteStorageClear({ fetch, path = RESECURE_PATH }) {
  return (await askSiteStorageClear({ fetch, path })) === 'cleared';
}

export async function resecureOriginStorage({
  indexedDB, localStorage, sessionStorage = null, fetch, document = null, onStep = null, carries = resecureCarriesStore, keeps = resecureKeepsDatabase,
  clearTimeoutMs = RESECURE_CLEAR_TIMEOUT_MS,
  caches = null, cacheRank = resecureCacheCarryRank, cacheBudgetBytes = RESECURE_CACHE_CARRY_BUDGET_BYTES, cacheStorageBudgetBytes = RESECURE_CACHE_STORAGE_BUDGET_BYTES,
  abortSettleMs = RESECURE_ABORT_SETTLE_MS, estimateUsage = null, heapLimit = null, blobCarriage = null,
}) {
  const step = (name) => { try { onStep?.(name); } catch { } };
  step('probe');
  const probe = await siteStorageClearProbe({ fetch });
  if (probe !== 'ready') return { outcome: probe === 'unreachable' ? 'unreachable' : 'not-confirmed', databases: 0 };
  let carryOut = null;
  let usage = null;
  if (typeof estimateUsage === 'function') {
    let listed = null;
    try { listed = (await listDatabases(indexedDB)).length; } catch { listed = null; }
    try { usage = await estimateUsage(); } catch { usage = null; }
    if (typeof usage !== 'number' || !Number.isFinite(usage)) usage = null;
    if (usage === 0 && listed !== 0) usage = null;
    if (!resecureFits({ usage, heapLimit })) {
      carryOut = resecureCarriage(blobCarriage, usage);
      if (!carryOut) return { outcome: 'too-large', databases: 0, usage };
    }
  }
  step('snapshot');
  const snapshot = await snapshotOriginStorage({ indexedDB, localStorage, sessionStorage, carries, cacheRank, cacheBudgetBytes, keeps, carryOut });
  if (carryOut && !(await carriageReadsBack(snapshot))) return { outcome: 'too-large', databases: 0, usage, carried: false };
  let carriedFiles = [];
  try { carriedFiles = await snapshotCacheStorage(caches, { budgetBytes: cacheStorageBudgetBytes }); } catch { carriedFiles = []; }
  const before = snapshot.databases.length;
  const heldWallet = snapshot.local.some(([key]) => key === RESECURE_WALLET_RECORD_KEY || key === RESECURE_LEGACY_WALLET_KEY);
  setResecureCookie(document, heldWallet ? 'writing-wallet' : 'writing');
  step('clear');
  const answer = await askSiteStorageClear({ fetch, timeoutMs: clearTimeoutMs });
  step('write');
  let localWritten = writeBackLocalStorage(snapshot, localStorage);
  let sessionWritten = writeBackSessionStorage(snapshot, sessionStorage);
  const goneNow = async () => {
    let listed = null;
    try { listed = new Set((await listDatabases(indexedDB)).map((entry) => entry.name)); } catch { listed = null; }
    return { listed, gone: listed === null ? before : snapshot.databases.filter((database) => !listed.has(database.name)).length };
  };
  let { listed: present, gone } = await goneNow();
  if (gone > 0) { try { localStorage.setItem(RESECURE_CLEARED_KEY, String(Date.now())); } catch { } }
  if (answer === 'unanswered' && localWritten === 0 && sessionWritten === 0 && gone === 0 && present !== null && abortSettleMs > 0) {
    await new Promise((resolve) => { setTimeout(resolve, abortSettleMs); });
    localWritten = writeBackLocalStorage(snapshot, localStorage);
    sessionWritten = writeBackSessionStorage(snapshot, sessionStorage);
    ({ listed: present, gone } = await goneNow());
  }
  if (localWritten === 0 && sessionWritten === 0 && gone === 0 && present !== null) {
    await restoreCacheStorage(carriedFiles, caches).catch(() => 0);
    setResecureCookie(document, null);
    if (answer === 'unanswered') return { outcome: 'unanswered', databases: before };
    if (answer !== 'cleared') return { outcome: 'not-confirmed', databases: before };
    if (before > 0 || snapshot.local.length > 0) return { outcome: 'not-cleared', databases: before };
  }
  const databasesCleared = before === 0 || gone > 0 || present === null;
  let written = { localWritten, databases: [], failed: [] };
  try {
    const restored = await restoreOriginStorage(snapshot, { indexedDB, localStorage, localDone: true });
    written = { ...restored, localWritten };
  } catch {
    written = { localWritten, databases: [], failed: snapshot.databases.map((database) => database.name) };
  }
  const filesWritten = await restoreCacheStorage(carriedFiles, caches).catch(() => 0);
  written = { ...written, filesWritten };
  step('verify');
  let check = { ok: false, missingLocal: [], shortStores: [] };
  try { check = await verifyOriginStorage(snapshot, { indexedDB, localStorage }); } catch { }
  setResecureCookie(document, null);
  const whole = check.ok && written.failed.length === 0;
  if (!databasesCleared && whole) return { outcome: 'not-cleared', databases: before, written, check };
  return { outcome: whole ? 'restored' : 'short', databases: before, written, check };
}

function setResecureCookie(document, value) {
  if (!document) return;
  try {
    document.cookie = value
      ? `${RESECURE_COOKIE}=${value}; path=/; max-age=${RESECURE_COOKIE_MAX_AGE_S}; SameSite=Strict; Secure`
      : `${RESECURE_COOKIE}=; path=/; max-age=0; SameSite=Strict; Secure`;
    if (!value) document.cookie = `${RESECURE_LEGACY_COOKIE}=; path=/; max-age=0; SameSite=Strict; Secure`;
  } catch { }
}

function resecureCookieValue(document, { hostname = globalThis.location?.hostname } = {}) {
  if (resecureHostShared(hostname)) return null;
  try {
    const parts = String(document?.cookie ?? '').split(/;\s*/);
    const named = (name) => { const part = parts.find((entry) => entry.startsWith(`${name}=`)); return part ? part.slice(name.length + 1) : null; };
    return named(RESECURE_COOKIE) ?? (legacyCookieTrusted(hostname) ? named(RESECURE_LEGACY_COOKIE) : null);
  } catch {
    return null;
  }
}
export function resecureWasInterrupted(document, options = {}) {
  const value = resecureCookieValue(document, options);
  return value === 'writing' || value === 'writing-wallet';
}
export function resecureInterruptedHeldWallet(document, options = {}) {
  return resecureCookieValue(document, options) === 'writing-wallet';
}
export function clearResecureCookie(document) {
  setResecureCookie(document, null);
}
