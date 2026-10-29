import { atRestTag, openAtRest, sealAtRest } from './at-rest-seal.mjs?v=5';

const SEAL_DOMAIN = 'PLATHO.SEALED.CACHE.V1';
const RANKS_DOMAIN = 'PLATHO.SEALED.CACHE.RANKS.V1';
const VALUE_PAD = 1024;
const RANKS_PAD = 4096;
const RANK_INDEX = 'r';
const RANKS_ID = 'ranks';
const RANKS_SAVE_DELAY_MS = 1_500;
const DEFAULT_CAP = 300;
const PUT_MANY_CHUNK_BYTES = 4 * 1024 * 1024;

const capOf = (value) => (Number.isInteger(value) && value > 0 ? value : DEFAULT_CAP);
const specOf = (value) => (typeof value === 'number' ? { cap: capOf(value), ranked: false } : { cap: capOf(value?.cap), ranked: value?.ranked === true });

function rankClock() {
  let top = 0;
  return {
    next(rankAt) {
      if (Number.isFinite(rankAt)) { top = Math.max(top, rankAt); return rankAt; }
      top += 1;
      return top;
    },
    see(rank) { if (Number.isFinite(rank)) top = Math.max(top, rank); },
  };
}

export function createMemoryCacheStore({ cap = DEFAULT_CAP } = {}) {
  const entries = new Map();
  const bound = capOf(cap);
  const clock = rankClock();
  const evict = () => {
    while (entries.size > bound) {
      let lowest = null;
      for (const [key, entry] of entries) if (lowest === null || entry.rank < lowest.rank) lowest = { key, rank: entry.rank };
      entries.delete(lowest.key);
    }
  };
  return {
    async get(key) {
      if (!key || !entries.has(key)) return null;
      return { hash: key, url: entries.get(key).url };
    },
    async getMany(keys) {
      const out = new Map();
      for (const key of new Set((keys ?? []).filter(Boolean))) if (entries.has(key)) out.set(key, entries.get(key).url);
      return out;
    },
    async getAll() {
      const out = new Map();
      for (const [key, entry] of entries) out.set(key, entry.url);
      return out;
    },
    async records() {
      return [...entries.entries()].map(([key, entry]) => ({ hash: key, url: entry.url, rank: entry.rank })).sort((a, b) => a.rank - b.rank);
    },
    async put(key, url, { rankAt = null } = {}) {
      if (!key || typeof url !== 'string') return;
      entries.delete(key);
      entries.set(key, { url, rank: clock.next(rankAt) });
      evict();
    },
    async putMany(list) {
      for (const [key, url, options] of list ?? []) {
        if (!key || typeof url !== 'string') continue;
        entries.delete(key);
        entries.set(key, { url, rank: clock.next(options?.rankAt ?? null) });
      }
      evict();
    },
    async delete(key) { entries.delete(key); },
    close() { entries.clear(); },
    get type() { return 'memory'; },
  };
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

async function openCacheDatabase(indexedDB, dbName, names) {
  const open = (version) => new Promise((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(dbName) : indexedDB.open(dbName, version);
    request.onupgradeneeded = () => {
      for (const name of names) {
        if (request.result.objectStoreNames.contains(name)) continue;
        request.result.createObjectStore(name, { keyPath: 'id' }).createIndex(RANK_INDEX, 'r');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { try { db.close(); } catch { } };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
  const db = await open(undefined);
  if (names.every((name) => db.objectStoreNames.contains(name))) return db;
  const next = db.version + 1;
  db.close();
  return open(next);
}

export async function openSealedCacheStores({ dbName, keys, namespaces, indexedDB = globalThis.indexedDB }) {
  if (!keys?.seal || !keys?.index) throw new Error('the sealed caches need the wallet\'s keys');
  if (!indexedDB) throw new Error('IndexedDB is unavailable');
  const names = Object.keys(namespaces ?? {});
  const db = await openCacheDatabase(indexedDB, dbName, names);
  const stores = {};
  try {
    for (const name of names) {
      // eslint-disable-next-line no-await-in-loop
      stores[name] = await sealedStoreOf(db, name, keys, specOf(namespaces[name]));
    }
  } catch (error) {
    try { db.close(); } catch { }
    throw error;
  }
  return {
    stores,
    async close() {
      await Promise.all(Object.values(stores).map((store) => store.flush().catch(() => {})));
      try { db.close(); } catch { }
    },
  };
}

async function sealedStoreOf(db, name, keys, { cap, ranked }) {
  const tagOf = (key) => atRestTag(keys.index, `cache:${name}`, String(key));
  const open = async (record, key = null) => {
    if (!record?.x || record.id === RANKS_ID) return null;
    const value = await openAtRest(keys.seal, { domain: SEAL_DOMAIN, aad: { store: name, id: String(record.id) }, sealed: record }).catch(() => null);
    if (!value || typeof value.url !== 'string' || (key !== null && value.key !== String(key))) return null;
    return value;
  };
  const read = async (work) => {
    const transaction = db.transaction(name, 'readonly');
    const result = await work(transaction.objectStore(name));
    await transactionDone(transaction).catch(() => {});
    return result;
  };

  let counter = await read(async (store) => {
    const cursor = await requestToPromise(store.index(RANK_INDEX).openCursor(null, 'prev'));
    const top = Number(cursor?.value?.r ?? 0);
    return Number.isFinite(top) && top > 0 ? top : 0;
  });

  const clock = rankClock();
  const ranks = ranked ? new Map() : null;
  if (ranked) {
    const [book, ids] = await read((store) => Promise.all([requestToPromise(store.get(RANKS_ID)), requestToPromise(store.getAllKeys())]));
    const opened = book?.x ? await openAtRest(keys.seal, { domain: RANKS_DOMAIN, aad: { store: name }, sealed: book }).catch(() => null) : null;
    const known = new Map(Array.isArray(opened?.ranks) ? opened.ranks : []);
    for (const id of ids ?? []) {
      if (id === RANKS_ID) continue;
      const rank = Number(known.get(id));
      ranks.set(id, Number.isFinite(rank) ? rank : -Infinity);
      clock.see(rank);
    }
  }

  let writes = Promise.resolve();
  const serially = (work) => { const run = writes.then(work, work); writes = run.catch(() => {}); return run; };

  let ranksDirty = false;
  let ranksTimer = null;
  const writeRanks = () => serially(async () => {
    if (!ranksDirty) return;
    ranksDirty = false;
    const held = [...ranks.entries()].filter(([, rank]) => Number.isFinite(rank));
    const sealed = await sealAtRest(keys.seal, { domain: RANKS_DOMAIN, aad: { store: name }, value: { ranks: held }, padTo: RANKS_PAD, binary: true });
    const write = db.transaction(name, 'readwrite');
    write.objectStore(name).put({ id: RANKS_ID, r: -1, n: sealed.n, x: sealed.x });
    await transactionDone(write);
  });
  const noteRanksChanged = () => {
    ranksDirty = true;
    if (ranksTimer) return;
    ranksTimer = setTimeout(() => { ranksTimer = null; writeRanks().catch(() => { ranksDirty = true; }); }, RANKS_SAVE_DELAY_MS);
  };

  const enforceCap = async () => {
    if (ranks) {
      if (ranks.size <= cap) return;
      const drop = [...ranks.entries()].sort((a, b) => a[1] - b[1]).slice(0, ranks.size - cap).map(([id]) => id);
      const write = db.transaction(name, 'readwrite');
      for (const id of drop) write.objectStore(name).delete(id);
      await transactionDone(write);
      for (const id of drop) ranks.delete(id);
      noteRanksChanged();
      return;
    }
    const write = db.transaction(name, 'readwrite');
    const store = write.objectStore(name);
    let excess = Number(await requestToPromise(store.count())) - cap;
    if (excess > 0) {
      const request = store.index(RANK_INDEX).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || excess <= 0) return;
        cursor.delete();
        excess -= 1;
        cursor.continue();
      };
    }
    await transactionDone(write);
  };

  const get = async (key) => {
    if (!key) return null;
    const id = await tagOf(key);
    const value = await open(await read((store) => requestToPromise(store.get(id))), key);
    return value ? { hash: key, url: value.url } : null;
  };

  return {
    get,
    async touch(key) {
      if (!key || ranks) return;
      await serially(async () => {
        const id = await tagOf(key);
        const write = db.transaction(name, 'readwrite');
        const store = write.objectStore(name);
        const held = await requestToPromise(store.get(id));
        if (held && Number(held.r) < counter - Math.floor(cap / 2)) {
          counter += 1;
          store.put({ ...held, r: counter });
        }
        await transactionDone(write);
      });
    },
    async getMany(keyList) {
      const out = new Map();
      const unique = [...new Set((keyList ?? []).filter(Boolean))];
      if (unique.length === 0) return out;
      const ids = await Promise.all(unique.map((key) => tagOf(key)));
      const records = await read((store) => Promise.all(ids.map((id) => requestToPromise(store.get(id)))));
      const values = await Promise.all(records.map((record, at) => open(record, unique[at])));
      unique.forEach((key, at) => { if (values[at]) out.set(key, values[at].url); });
      return out;
    },
    async getAll() {
      const records = await read((store) => requestToPromise(store.getAll()));
      const out = new Map();
      for (const value of await Promise.all((records ?? []).map((record) => open(record)))) if (value) out.set(value.key, value.url);
      return out;
    },
    async put(key, url, { rankAt = null } = {}) {
      if (!key || typeof url !== 'string') return;
      await serially(async () => {
        const id = await tagOf(key);
        counter += 1;
        const sealed = await sealAtRest(keys.seal, { domain: SEAL_DOMAIN, aad: { store: name, id }, value: { key: String(key), url }, padTo: VALUE_PAD, binary: true });
        const write = db.transaction(name, 'readwrite');
        write.objectStore(name).put({ id, r: counter, n: sealed.n, x: sealed.x });
        await transactionDone(write);
        if (ranks) { ranks.set(id, clock.next(rankAt)); noteRanksChanged(); }
        try { await enforceCap(); } catch { }
      });
    },
    async putMany(list) {
      const given = (list ?? []).filter((entry) => entry?.[0] && typeof entry[1] === 'string');
      if (given.length === 0) return;
      const batch = ranks ? given : given.slice(-cap);
      await serially(async () => {
        for (let from = 0; from < batch.length;) {
          let to = from;
          for (let bytes = 0; to < batch.length && (to === from || bytes + batch[to][1].length <= PUT_MANY_CHUNK_BYTES); to += 1) bytes += batch[to][1].length;
          const chunk = batch.slice(from, to);
          // eslint-disable-next-line no-await-in-loop
          const rows = await Promise.all(chunk.map(async ([key, url]) => {
            const id = await tagOf(key);
            const sealed = await sealAtRest(keys.seal, { domain: SEAL_DOMAIN, aad: { store: name, id }, value: { key: String(key), url }, padTo: VALUE_PAD, binary: true });
            return { id, sealed };
          }));
          const write = db.transaction(name, 'readwrite');
          const store = write.objectStore(name);
          for (const { id, sealed } of rows) {
            counter += 1;
            store.put({ id, r: counter, n: sealed.n, x: sealed.x });
          }
          // eslint-disable-next-line no-await-in-loop
          await transactionDone(write);
          if (ranks) chunk.forEach(([, , options], at) => ranks.set(rows[at].id, clock.next(options?.rankAt ?? null)));
          from = to;
        }
        if (ranks) noteRanksChanged();
        try { await enforceCap(); } catch { }
      });
    },
    async delete(key) {
      if (!key) return;
      await serially(async () => {
        const id = await tagOf(key);
        const write = db.transaction(name, 'readwrite');
        write.objectStore(name).delete(id);
        await transactionDone(write);
        if (ranks?.delete(id)) noteRanksChanged();
      });
    },
    async flush() {
      if (ranksTimer) { clearTimeout(ranksTimer); ranksTimer = null; }
      if (ranks) await writeRanks();
      await writes;
    },
    get type() { return 'sealed-indexeddb'; },
  };
}
