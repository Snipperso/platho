
import { createShardStatesRequest, createShardMessagesWithSourceReader } from './shard-rpc.mjs?v=70';
import { M21C_VAULT_PUBLISH_OPCODE } from './m21c-envelope.mjs?v=5';
import { WRITES_GENERATION } from './cutover-epoch.mjs?v=7';
import { isUnknownAccountState, readAccountStates, changeMarkerOf } from './shard-reader.mjs?v=109';
import { createPublicShardTonRpcProvider } from './public-shard-ton-rpc-provider.mjs?v=44';
import { PUBLIC_PUBLISH_OPCODE } from './public-publish-browser.mjs?v=84';
import { publicShardAddressBytesFor, rawAddress } from './shard-address.mjs?v=47';
import { generationForUnixSeconds } from './cutover-epoch.mjs?v=7';
import {
  publicBeaconScanAddresses,
  publicBeaconPartitionKeyFor,
  publicAvatarScanAddresses,
  PUBLIC_AVATAR_ERA_WINDOW,
  PUBLIC_SEQ_PROBE,
  publicWalletHash,
  publicChannelPartitionKey,
  publicThreadPartitionKey,
  publicPostUid,
  publicEpochTag,
  publicEraOf,
  publicEraGenerations,
  addrKey,
  notePublicAddressGeneration,
  publicAddressGenerationOf,
} from './shard-discovery.mjs?v=104';

const PS_KIND_CHANNEL = 0;
const PS_KIND_THREAD = 1;
const PS_KIND_BEACON = 2;

const PAGE_ROWS = 96;

const PUBLIC_CHANNEL_ERA_WINDOW = 14;

const PUBLIC_LATEST_POST_WINDOW = 32n;

const PUBLIC_ALL_FEED_ERA_WINDOW = 3;

export function createPublicLane({
  runGetMethod,
  endpoint = null,
  apiKey = null,
  fetch: fetchImpl = null,
  strict = false,
  now = () => Math.floor(Date.now() / 1000),
} = {}) {
  if (typeof runGetMethod !== 'function') throw new Error('createPublicLane requires runGetMethod');

  const rpc = { endpoint, apiKey, fetch: fetchImpl ?? undefined, strict };
  const statesRequest = createShardStatesRequest(rpc);
const PUBLIC_READ_OPCODES = Object.freeze(WRITES_GENERATION >= 18
  ? [PUBLIC_PUBLISH_OPCODE, M21C_VAULT_PUBLISH_OPCODE]
  : [PUBLIC_PUBLISH_OPCODE]);
const PUBLIC_READ_OPCODES_17 = Object.freeze([PUBLIC_PUBLISH_OPCODE]);
async function publicShardAddressNoted(generation, partitionKey, epochTag) {
  const address = rawAddress(await publicShardAddressBytesFor(generation, partitionKey, epochTag));
  notePublicAddressGeneration(address, generation);
  return address;
}
function narrowedByGeneration(reader) {
  return (address, options = {}) => (options?.opcode === undefined && publicAddressGenerationOf(address) === 17
    ? reader(address, { ...options, opcode: PUBLIC_READ_OPCODES_17 })
    : reader(address, options));
}
const CHANNEL_READ_OPTIONS = Object.freeze({ priority: 'background', skipIfRateLimited: false, rateLimitRetries: 1 });
const readMessagesWithSource = narrowedByGeneration(createShardMessagesWithSourceReader({ ...rpc, strict: true, opcode: PUBLIC_READ_OPCODES, requestOptions: CHANNEL_READ_OPTIONS }));
  const provider = createPublicShardTonRpcProvider({ transport: { runGetMethod } });

  const readStates = (addresses) => readAccountStates(addresses, { request: statesRequest });

  const LATEST_READ_OPTIONS = Object.freeze({ priority: 'profile', skipIfRateLimited: false });
  const latestStatesRequest = createShardStatesRequest({ ...rpc, strict: true, requestOptions: LATEST_READ_OPTIONS });
  const readLatestStates = (addresses) => readAccountStates(addresses, { request: latestStatesRequest });
  const readLatestMessagesWithSource = narrowedByGeneration(createShardMessagesWithSourceReader({ ...rpc, strict: true, opcode: PUBLIC_READ_OPCODES, requestOptions: LATEST_READ_OPTIONS }));

  const headReaderSets = new Map();
  const headAddressMemo = new Map();
  const HEAD_ADDRESS_MEMO_MAX = 16_384;
  async function channelShardAddress(wallet, hash, seq, generation, epochTag) {
    const key = `${wallet}|${generation}|${seq}|${epochTag}`;
    const known = headAddressMemo.get(key);
    if (known) {
      headAddressMemo.delete(key);
      headAddressMemo.set(key, known);
      notePublicAddressGeneration(known, generation);
      return known;
    }
    const address = (await publicShardAddressNoted(generation, await publicChannelPartitionKey(hash, seq), epochTag));
    if (headAddressMemo.size >= HEAD_ADDRESS_MEMO_MAX) headAddressMemo.delete(headAddressMemo.keys().next().value);
    headAddressMemo.set(key, address);
    return address;
  }
  function headReadersFor(requestOptions) {
    const priority = requestOptions?.priority ?? 'background';
    const skipIfRateLimited = requestOptions?.skipIfRateLimited !== false;
    const key = `${priority}|${skipIfRateLimited}`;
    let readers = headReaderSets.get(key);
    if (!readers) {
      const callOptions = Object.freeze({ priority, skipIfRateLimited });
      const request = createShardStatesRequest({ ...rpc, strict: true, requestOptions: callOptions });
      readers = {
        callOptions,
        readStates: (addresses) => readAccountStates(addresses, { request, deferOnTransient: true }),
        readMessages: narrowedByGeneration(createShardMessagesWithSourceReader({ ...rpc, strict: true, opcode: PUBLIC_READ_OPCODES, requestOptions: callOptions })),
      };
      headReaderSets.set(key, readers);
    }
    return readers;
  }

  const SHARD_SNAPSHOT_MAX = 512;
  const shardSnapshots = new Map();

  function readShardSnapshot(key, marker) {
    if (marker === null || marker === undefined) return null;
    const hit = shardSnapshots.get(key);
    if (!hit || hit.marker !== marker) return null;
    shardSnapshots.delete(key);
    shardSnapshots.set(key, hit);
    return hit.posts;
  }

  function peekShardSnapshot(key) {
    const held = shardSnapshots.get(key);
    if (!held) return null;
    shardSnapshots.delete(key);
    shardSnapshots.set(key, held);
    return { marker: held.marker, value: held.posts };
  }

  const shortWindowReads = new Map();
  const SHORT_WINDOW_READS_KEPT = 3;
  function windowWorthKeeping(key, marker, whole) {
    if (whole) { shortWindowReads.delete(key); return true; }
    const seen = shortWindowReads.get(key);
    const reads = seen && seen.marker === marker ? seen.reads + 1 : 1;
    shortWindowReads.delete(key);
    while (shortWindowReads.size >= SHARD_SNAPSHOT_MAX) shortWindowReads.delete(shortWindowReads.keys().next().value);
    shortWindowReads.set(key, { marker, reads });
    return reads >= SHORT_WINDOW_READS_KEPT;
  }

  function writeShardSnapshot(key, marker, posts) {
    if (marker === null || marker === undefined) return;
    shardSnapshots.delete(key);
    shardSnapshots.set(key, { marker, posts });
    while (shardSnapshots.size > SHARD_SNAPSHOT_MAX) {
      const oldest = shardSnapshots.keys().next();
      if (oldest.done) break;
      shardSnapshots.delete(oldest.value);
    }
  }
  const LATEST_SNAPSHOT_MAX = 256;
  const latestSnapshots = new Map();
  function readLatestSnapshot(key, marker) {
    if (marker === null || marker === undefined) return null;
    const hit = latestSnapshots.get(key);
    if (!hit || hit.marker !== marker) return null;
    latestSnapshots.delete(key);
    latestSnapshots.set(key, hit);
    return hit.posts;
  }
  function writeLatestSnapshot(key, marker, posts) {
    if (marker === null || marker === undefined) return;
    latestSnapshots.delete(key);
    latestSnapshots.set(key, { marker, posts });
    while (latestSnapshots.size > LATEST_SNAPSHOT_MAX) {
      const oldest = latestSnapshots.keys().next();
      if (oldest.done) break;
      latestSnapshots.delete(oldest.value);
    }
  }

  async function readChannelPostsManyImpl(channelWallets, {
    eraWindow = PUBLIC_CHANNEL_ERA_WINDOW, seqProbe = PUBLIC_SEQ_PROBE, deep = null, onChannelError = null, requestClass = null,
  } = {}) {
    const nowUnix = now();
    const era = publicEraOf(PS_KIND_CHANNEL, nowUnix);
    const wallets = [...new Set((channelWallets ?? []).map((w) => String(w)).filter(Boolean))];
    const optionsOf = new Map();
    for (const wallet of wallets) {
      let options = {};
      try { options = (typeof deep === 'function' ? deep(wallet) : null) ?? {}; } catch { options = {}; }
      optionsOf.set(wallet, options);
    }
    const coordsByWallet = new Map();
    const allAddresses = [];
    for (const wallet of wallets) {
      const hash = publicWalletHash(wallet);
      const coords = [];
      const asked = Number(optionsOf.get(wallet)?.eraWindow);
      const window = Number.isInteger(asked) && asked > 0 ? Math.min(eraWindow, asked) : eraWindow;
      for (let e = era; e > era - window && e >= 0; e -= 1) {
        const epochTag = publicEpochTag(PS_KIND_CHANNEL, e);
        for (const generation of publicEraGenerations(PS_KIND_CHANNEL, e)) {
          for (let seq = 0; seq < seqProbe; seq += 1) {
            const address = await channelShardAddress(wallet, hash, seq, generation, epochTag);
            coords.push({ address, epochTag, seq, generation });
            allAddresses.push(address);
          }
        }
      }
      coordsByWallet.set(wallet, coords);
    }
    const live = wallets.length === 0 ? new Map() : await readersOf(requestClass).readStates(allAddresses);
    const failures = new Map();
    const out = new Map();
    for (const wallet of wallets) {
      try {
        out.set(wallet, await readChannelPostsFromStates(wallet, coordsByWallet.get(wallet) ?? [], live, { ...(optionsOf.get(wallet) ?? {}), readers: readersOf(requestClass) }));
        if ((coordsByWallet.get(wallet) ?? []).some((coord) => isUnknownAccountState(live.get(addrKey(coord.address))))
          && typeof onChannelError === 'function') {
          try { onChannelError(wallet, Object.assign(new Error('a shard of this channel was not answered for'), { code: 'PUBLIC_CHANNEL_STATE_UNKNOWN' })); } catch { }
        }
      } catch (error) {
        out.set(wallet, []);
        failures.set(wallet, error);
        if (typeof onChannelError === 'function') { try { onChannelError(wallet, error); } catch { } }
      }
    }
    return out;
    }

  async function readChannelPostsFromStates(channelWallet, coords, live, { backfillPages = 0, burstPages = 0, knownRange = null, readers = LANE_READERS } = {}) {
    const posts = [];
    Object.defineProperty(posts, 'hidden', { value: [], enumerable: false, writable: true });
    let budget = Math.max(0, Math.trunc(Number(backfillPages) || 0));
    let burstBudget = Math.max(0, Math.trunc(Number(burstPages) || 0));
    Object.defineProperty(posts, 'gaps', { value: [], enumerable: false, writable: true });
    const callerHolds = (coord) => {
      if (typeof knownRange !== 'function') return null;
      try {
        const held = knownRange(coord.epochTag, coord.seq, coord.generation);
        const min = Number(held?.min);
        const max = Number(held?.max);
        if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return null;
        return { min, max };
      } catch { return null; }
    };
    for (const coord of coords) {
      const state = live.get(addrKey(coord.address));
      if (!state || state.status !== 'active') continue;
      const key = addrKey(coord.address);
      const marker = changeMarkerOf(state);
      const held = peekShardSnapshot(key);
      const fresh = held !== null && marker !== null && held.marker === marker ? held.value : null;
      const rows = new Map();
      const take = (list) => { for (const row of list ?? []) rows.set(String(row.entry_id), row); };
      let count = null;
      let windowFrom = null;
      let oldestLt = null;
      let walkedLt = held?.value?.walkedLt ?? null;
      if (fresh) {
        take(fresh.posts);
        count = Number.isFinite(Number(fresh.entryCount)) ? Number(fresh.entryCount) : null;
        windowFrom = Number.isFinite(Number(fresh.from)) ? Number(fresh.from) : null;
        oldestLt = fresh.oldestLt ?? null;
      } else {
        const tail = await readers.readShardPosts(state.address);
        take(tail.posts);
        count = Number(tail.entry_count ?? 0);
        windowFrom = Math.max(0, count - PAGE_ROWS);
        oldestLt = tail.oldestLt ?? null;
        const holds = callerHolds(coord);
        if (count > 0 && Number(coord.generation ?? 17) >= 18 && (held !== null || (holds && holds.min < windowFrom))) {
          try {
            const map = await provider.getHiddenIds(state.address, { callOptions: readers.callOptions });
            posts.hidden.push({ epochTag: String(coord.epochTag), seq: coord.seq, generation: coord.generation,
              entryCount: count, ids: [...map.hidden], complete: map.complete });
          } catch (error) {
            void error;
          }
        }
      }
      let walked = Number.isFinite(Number(held?.value?.walked)) ? Number(held.value.walked) : windowFrom;
      if (windowFrom !== null && windowFrom < walked) walked = windowFrom;
      const holds = callerHolds(coord);
      const segments = [];
      if (windowFrom !== null) {
        const deepTop = Math.min(walked, holds === null ? walked : holds.min);
        if (holds !== null && windowFrom > holds.max + 1) segments.push({ top: windowFrom, floor: holds.max + 1, anchor: oldestLt, burst: true });
        if (deepTop > 0) segments.push({ top: deepTop, floor: 0, anchor: deepTop === windowFrom ? oldestLt : (deepTop === walked ? walkedLt : null) });
      }
      for (const segment of segments) {
        let cursor = segment.top;
        let cursorLt = segment.anchor;
        const spendable = () => (segment.burst === true && burstBudget > 0) || budget > 0;
        while (spendable() && cursor > segment.floor) {
          const start = Math.max(segment.floor, cursor - PAGE_ROWS);
          const endLt = cursorLt === null ? null : (() => {
            try { return String(BigInt(cursorLt) - 1n); } catch { return null; }
          })();
          const page = await readers.readShardPosts(state.address, {
            fromId: start,
            maxCount: BigInt(cursor - start),
            ...(endLt === null ? { messagesByRowTime: true } : { messagesEndLt: endLt }),
          });
          take(page.posts);
          cursorLt = page.oldestLt ?? cursorLt;
          cursor = start;
          if (segment.burst === true && burstBudget > 0) burstBudget -= 1;
          else budget -= 1;
          if (segment.floor === 0) { walked = cursor; walkedLt = cursorLt; }
        }
        if (segment.burst === true && cursor > segment.floor) {
          posts.gaps.push({ epochTag: String(coord.epochTag), seq: coord.seq, generation: coord.generation, floor: segment.floor, top: cursor });
        }
      }
      const merged = [...rows.values()];
      if (merged.length > 0 || count === 0) {
        const kept = windowFrom === null ? merged : merged.filter((row) => Number(row.entry_id) >= windowFrom);
        const whole = fresh !== null || count === 0 || windowFrom === null || kept.length >= count - windowFrom;
        if (windowWorthKeeping(key, marker, whole)) writeShardSnapshot(key, marker, { posts: kept, from: windowFrom, entryCount: count, oldestLt, walked, walkedLt });
      }
      for (const p of merged) posts.push({ ...p, channelWallet, channelEpochTag: coord.epochTag, channelShardSeq: coord.seq, generation: coord.generation });
    }
    posts.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    return posts;
  }

const readShardPosts = (address, options = {}) => provider.readPosts(address, { readMessagesWithSource, callOptions: { cacheTtlMs: 0 }, ...options });
  const LANE_READERS = Object.freeze({ readStates, readShardPosts, callOptions: undefined });
  const classReaders = new Map();
  function readersOf(requestClass, { wait = false } = {}) {
    const cls = (typeof requestClass === 'function' ? requestClass() : requestClass) || 'background';
    if (cls === 'background' && !wait) return LANE_READERS;
    const name = wait ? `${cls}:wait` : cls;
    let readers = classReaders.get(name);
    if (!readers) {
      const callOptions = Object.freeze({ priority: cls, cacheTtlMs: 0, ...(wait ? { skipIfRateLimited: false, rateLimitRetries: 2 } : {}) });
      const request = createShardStatesRequest({ ...rpc, requestOptions: callOptions, ...(wait ? { strict: true } : {}) });
      const messages = narrowedByGeneration(createShardMessagesWithSourceReader({
        ...rpc, strict: true, opcode: PUBLIC_READ_OPCODES, requestOptions: Object.freeze({ ...CHANNEL_READ_OPTIONS, priority: cls, ...(wait ? { skipIfRateLimited: false, rateLimitRetries: 2 } : {}) }),
      }));
      readers = Object.freeze({
        readStates: (addresses) => readAccountStates(addresses, { request }),
        readShardPosts: (address, options = {}) => provider.readPosts(address, { readMessagesWithSource: messages, callOptions, ...options }),
        callOptions,
      });
      classReaders.set(name, readers);
    }
    return readers;
  }
  const PUBLIC_SWEEP_BUCKET_CAP = 64;

  const threadCoordsByUid = async (postUid, { firstEra = null, seqProbe = PUBLIC_SEQ_PROBE, nowUnix = now() } = {}) => {
    const threadPks = [];
    for (let seq = 0; seq < seqProbe; seq += 1) threadPks.push(await publicThreadPartitionKey(postUid, seq));
    const nowThreadEra = publicEraOf(PS_KIND_THREAD, nowUnix);
    const MAX_THREAD_ERAS = 14;
    const startEra = firstEra === null || firstEra === undefined
      ? Math.max(0, nowThreadEra - MAX_THREAD_ERAS + 1)
      : Math.max(0, Math.min(Number(firstEra), nowThreadEra));
    const coords = [];
    const coordOf = new Map();
    for (let e = nowThreadEra, eras = 0; e >= startEra && eras < MAX_THREAD_ERAS; e -= 1, eras += 1) {
      for (const generation of publicEraGenerations(PS_KIND_THREAD, e)) {
        for (let seq = 0; seq < threadPks.length; seq += 1) {
          const threadPk = threadPks[seq];
          const epochTag = publicEpochTag(PS_KIND_THREAD, e);
          const address = (await publicShardAddressNoted(generation, threadPk, epochTag));
          coords.push(address);
          coordOf.set(addrKey(address), { thread_pk: String(threadPk), thread_epoch_tag: String(epochTag), thread_seq: seq, thread_generation: generation });
        }
      }
    }
    return { coords, coordOf };
  };
  const readThreadByUidImpl = async (postUid, { firstEra = null, seqProbe = PUBLIC_SEQ_PROBE, olderThan = null, onProgress = null, states = null, requestClass = null } = {}) => {
    const { readStates, readShardPosts, callOptions: classCallOptions } = requestClass ? readersOf(requestClass) : LANE_READERS;
    const nowUnix = now();
    const { coords, coordOf } = await threadCoordsByUid(postUid, { firstEra, seqProbe, nowUnix });
    const live = states instanceof Map ? states : await readStates(coords);
    const posts = [];
    const cursors = {};
    const hidden = [];
    let shardsSeen = 0;
    const report = () => {
      if (typeof onProgress !== 'function') return;
      try {
        onProgress({
          posts: [...posts],
          cursors: { ...cursors },
          hasMore: Object.values(cursors).some((cursor) => Number(cursor.from) > 0),
          shardsSeen,
        });
      } catch { }
    };
    for (const address of coords) {
      const state = live.get(addrKey(address));
      if (!state || state.status !== 'active') continue;
      shardsSeen += 1;
      const key = addrKey(address);
      const marker = changeMarkerOf(state);
      const previous = olderThan?.[key];
      const paged = Number.isFinite(Number(previous?.from)) && Number(previous.from) > 0;
      if (previous && !paged) { cursors[key] = { from: 0, entryCount: Number(previous.entryCount ?? 0) }; report(); continue; }
      const pageStart = paged ? Math.max(0, Number(previous.from) - PAGE_ROWS) : 0;
      const pageRows = paged ? Number(previous.from) - pageStart : PAGE_ROWS;
      const fromId = paged ? BigInt(pageStart) : null;
      const snapshot = paged ? null : readShardSnapshot(key, marker);
      const heldBefore = peekShardSnapshot(key) !== null;
      const where = coordOf.get(key) ?? {};
      if (snapshot) {
        posts.push(...snapshot.posts.map((post) => (post.shard_key && post.thread_pk ? post : { ...post, ...where, shard_key: key })));
        cursors[key] = { from: snapshot.from, entryCount: snapshot.entryCount, oldestLt: snapshot.oldestLt ?? null };
        report();
        continue;
      }
      const previousOldestLt = previous?.oldestLt == null ? null : (() => { try { return String(BigInt(previous.oldestLt) - 1n); } catch { return null; } })();
      const { posts: shardPosts, entry_count: entryCount, oldestLt } = await readShardPosts(address, {
        ...(fromId === null ? {} : { fromId, maxCount: BigInt(pageRows) }),
        ...(paged && previousOldestLt !== null ? { messagesEndLt: previousOldestLt } : {}),
        ...(paged && previousOldestLt === null ? { messagesByRowTime: true } : {}),
      });
      const count = Number(entryCount ?? 0);
      const from = fromId === null ? Math.max(0, count - PAGE_ROWS) : Number(fromId);
      if (!paged && count > 0 && Number(where.thread_generation ?? 17) >= 18 && (heldBefore || count > PAGE_ROWS)) {
        try {
          const map = await provider.getHiddenIds(address, classCallOptions ? { callOptions: classCallOptions } : {});
          hidden.push({ epochTag: where.thread_epoch_tag, seq: where.thread_seq, generation: where.thread_generation,
            entryCount: count, ids: [...map.hidden], complete: map.complete });
        } catch (error) {
          void error;
        }
      }
      const stampedPosts = shardPosts.map((post) => ({ ...post, ...where, shard_key: key }));
      const wholeThread = count === 0 || shardPosts.filter((post) => Number(post.entry_id) >= from).length >= count - from;
      if (!paged && (shardPosts.length > 0 || count === 0) && windowWorthKeeping(key, marker, wholeThread)) writeShardSnapshot(key, marker, { posts: stampedPosts, from, entryCount: count, oldestLt: oldestLt ?? null });
      posts.push(...stampedPosts);
      cursors[key] = { from, entryCount: count, oldestLt: oldestLt ?? null };
      report();
    }
    const hasMore = Object.values(cursors).some((cursor) => Number(cursor.from) > 0);
    return { posts, cursors, hasMore, shardsSeen, hidden, states: live };
  };
  return {
    async sweepChannelCatalog({ eraWindow = 3, topBuckets = PUBLIC_SWEEP_BUCKET_CAP, onProgress = null, waitForTurn = null, requestClass = null } = {}) {
      const turn = async () => { if (typeof waitForTurn === 'function') await waitForTurn(); };
      const nowUnix = now();
      const addresses = await publicBeaconScanAddresses(nowUnix, eraWindow);
      await turn();
      const states = await readersOf(requestClass).readStates(addresses);
      if (states.size === 0) return [];

      const ltOf = (state) => { try { return BigInt(state?.lastLt ?? 0); } catch { return 0n; } };
      const ordered = [...states.values()]
        .filter((state) => state.status === 'active')
        .sort((a, b) => (ltOf(a) < ltOf(b) ? 1 : ltOf(a) > ltOf(b) ? -1 : 0));
      const limit = Number.isFinite(Number(topBuckets)) && Number(topBuckets) > 0 ? Number(topBuckets) : ordered.length;
      const buckets = ordered.slice(0, limit);

      const byWallet = new Map();
      const delisted = new Set();
      let done = 0;
      for (const state of buckets) {
        await turn();
        const key = addrKey(state.address);
        const marker = changeMarkerOf(state);
        const snapshot = readShardSnapshot(key, marker);
        let posts;
        if (snapshot) {
          posts = snapshot.posts;
        } else {
          const readers = readersOf(requestClass);
          const first = await readers.readShardPosts(state.address, { fromId: 0n });
          posts = first.posts;
          if (first.entry_count > 96n) {
            const tail = await readers.readShardPosts(state.address, { entryCount: first.entry_count });
            const merged = new Map();
            for (const post of [...tail.posts, ...posts]) merged.set(String(post.entry_id), post);
            posts = [...merged.values()];
          }
          const bucketRows = Number(first.entry_count ?? 0n);
          if ((posts.length > 0 || bucketRows === 0) && windowWorthKeeping(key, marker, posts.length >= Math.min(bucketRows, bucketRows > 96 ? 192 : 96))) {
            writeShardSnapshot(key, marker, { posts, from: 0n, entryCount: first.entry_count });
          }
        }
        for (const post of posts) {
          if (!post.publisher) continue;
          const wallet = addrKey(post.publisher);
          if (post.hidden === true) { delisted.add(wallet); byWallet.delete(wallet); continue; }
          if (delisted.has(wallet)) continue;
          const prev = byWallet.get(wallet);
          if (!prev || post.created_at > prev.announcedAt) {
            byWallet.set(wallet, { channelWallet: post.publisher, announcedAt: post.created_at, card: post.body });
          }
        }
        done += 1;
        if (typeof onProgress === 'function') {
          try { onProgress([...byWallet.values()], { done, total: buckets.length, delisted: [...delisted] }); }
          catch { }
        }
      }
      const found = [...byWallet.values()];
      Object.defineProperty(found, 'delisted', { value: [...delisted], enumerable: false });
      return found;
    },

    async readChannelPosts(channelWallet, options = {}) {
      const byWallet = await readChannelPostsManyImpl([channelWallet], {
        ...options,
        deep: () => ({ backfillPages: options.backfillPages ?? 0, burstPages: options.burstPages ?? 0, knownRange: options.knownRange ?? null }),
      });
      return byWallet.get(String(channelWallet)) ?? [];
    },

    readChannelPostsMany: (channelWallets, options) => readChannelPostsManyImpl(channelWallets, options),

    async readWriteShardSeq(args) {
      const target = await this.readWriteShard(args);
      return target ? target.seq : null;
    },

    async readWriteShard({ kind, partitionKeyOf, epochTag, need = 1, nowUnix = null, seqProbe = PUBLIC_SEQ_PROBE, requestClass = null } = {}) {
      if (typeof partitionKeyOf !== 'function') throw new Error('readWriteShard requires partitionKeyOf');
      const readers = requestClass ? readersOf(requestClass) : LANE_READERS;
      const probeUnix = nowUnix ?? now();
      const writeGeneration = generationForUnixSeconds(probeUnix);
      const coords = [];
      for (let seq = 0; seq < seqProbe; seq += 1) {
        coords.push({ seq, address: (await publicShardAddressNoted(writeGeneration, await partitionKeyOf(seq), epochTag)) });
      }
      const live = await readers.readStates(coords.map((c) => c.address));
      for (const coord of coords) {
        const state = live.get(addrKey(coord.address));
        if (state && isUnknownAccountState(state)) continue;
        if (!state || state.status !== 'active') return { seq: coord.seq, live: false };
        try {
          const view = await provider.getView(state.address, readers.callOptions ?? {});
          const entryCount = Number(view.entry_count ?? 0);
          const safeCap = Number(view.safe_cap ?? 0);
          if (safeCap > 0 && entryCount + Number(need) <= safeCap) return { seq: coord.seq, live: true, entries: entryCount };
        } catch { }
      }
      return null;
    },

    async readBeaconBucketRoom(buckets, { nowUnix = null } = {}) {
      const list = [...new Set((buckets ?? []).map((b) => Number(b)).filter((b) => Number.isInteger(b) && b >= 0))];
      const out = new Map();
      if (list.length === 0) return out;
      const probeUnix = nowUnix ?? now();
      const epochTag = publicEpochTag(PS_KIND_BEACON, publicEraOf(PS_KIND_BEACON, probeUnix));
      const writeGeneration = generationForUnixSeconds(probeUnix);
      const coords = [];
      for (const bucket of list) {
        coords.push({ bucket, address: (await publicShardAddressNoted(writeGeneration, await publicBeaconPartitionKeyFor(writeGeneration, bucket), epochTag)) });
      }
      const live = await readStates(coords.map((c) => c.address));
      for (const coord of coords) {
        const state = live.get(addrKey(coord.address));
        if (state && isUnknownAccountState(state)) {
          out.set(coord.bucket, { live: null, entryCount: null, safeCap: null, room: null });
          continue;
        }
        if (!state || state.status !== 'active') {
          out.set(coord.bucket, { live: false, entryCount: 0, safeCap: null, room: Number.POSITIVE_INFINITY });
          continue;
        }
        try {
          const view = await provider.getView(state.address);
          const entryCount = Number(view.entry_count ?? 0);
          const safeCap = Number(view.safe_cap ?? 0);
          out.set(coord.bucket, { live: true, entryCount, safeCap, room: safeCap > 0 ? safeCap - entryCount : null });
        } catch {
          out.set(coord.bucket, { live: true, entryCount: null, safeCap: null, room: null });
        }
      }
      return out;
    },

    async readLatestChannelPosts(channelWallet, { eraWindow = PUBLIC_CHANNEL_ERA_WINDOW, seqProbe = PUBLIC_SEQ_PROBE, maxCount = PUBLIC_LATEST_POST_WINDOW, beforeEra = null } = {}) {
      const nowUnix = now();
      const hash = publicWalletHash(channelWallet);
      const era = publicEraOf(PS_KIND_CHANNEL, nowUnix);
      const top = beforeEra === null ? era : Math.min(era, Number(beforeEra) - 1);
      const coords = [];
      for (let e = top; e > era - eraWindow && e >= 0; e -= 1) {
        const epochTag = publicEpochTag(PS_KIND_CHANNEL, e);
        for (const generation of publicEraGenerations(PS_KIND_CHANNEL, e)) {
          for (let seq = 0; seq < seqProbe; seq += 1) {
            const address = (await publicShardAddressNoted(generation, await publicChannelPartitionKey(hash, seq), epochTag));
            coords.push({ address, epochTag, seq, era: e, generation });
          }
        }
      }
      if (coords.length === 0) return { posts: [], era: null, exhausted: true };
      const live = await readLatestStates(coords.map((c) => c.address));
      const isLive = (coord) => { const state = live.get(addrKey(coord.address)); return Boolean(state && state.status === 'active'); };
      const newestLive = coords.find(isLive);
      if (!newestLive) return { posts: [], era: null, exhausted: true };
      const newestEra = newestLive.era;
      const exhausted = !coords.some((coord) => coord.era < newestEra && isLive(coord));
      const posts = [];
      for (const coord of coords) {
        if (coord.era !== newestEra || !isLive(coord)) continue;
        const state = live.get(addrKey(coord.address));
        const key = addrKey(coord.address);
        const marker = changeMarkerOf(state);
        const full = readShardSnapshot(key, marker);
        let shardPosts = full ? full.posts : readLatestSnapshot(key, marker);
        if (!shardPosts) {
          const tail = await provider.readPosts(state.address, {
            readMessagesWithSource: readLatestMessagesWithSource,
            maxCount: BigInt(maxCount),
            callOptions: { priority: LATEST_READ_OPTIONS.priority },
          });
          shardPosts = tail.posts;
          if (shardPosts.length > 0 || BigInt(tail.entry_count ?? 0n) === 0n) writeLatestSnapshot(key, marker, shardPosts);
        }
        for (const p of shardPosts) posts.push({ ...p, channelWallet, channelEpochTag: coord.epochTag, channelShardSeq: coord.seq, generation: coord.generation });
      }
      posts.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
      return { posts, era: newestEra, exhausted };
    },

    async probeChannelHeads(channelWallets, { eraWindow = PUBLIC_ALL_FEED_ERA_WINDOW, seqProbe = PUBLIC_SEQ_PROBE, requestOptions = null } = {}) {
      const readers = headReadersFor(requestOptions);
      const nowUnix = now();
      const era = publicEraOf(PS_KIND_CHANNEL, nowUnix);
      const wallets = [...new Set((channelWallets ?? []).map((wallet) => String(wallet)).filter(Boolean))];
      const coordsByWallet = new Map();
      const addresses = [];
      for (const wallet of wallets) {
        const hash = publicWalletHash(wallet);
        const coords = [];
        for (let e = era; e > era - eraWindow && e >= 0; e -= 1) {
          const epochTag = publicEpochTag(PS_KIND_CHANNEL, e);
          for (const generation of publicEraGenerations(PS_KIND_CHANNEL, e)) {
            for (let seq = 0; seq < seqProbe; seq += 1) {
              const address = await channelShardAddress(wallet, hash, seq, generation, String(epochTag));
              coords.push({ address, era: e, epochTag: String(epochTag), seq, generation });
              addresses.push(address);
            }
          }
        }
        coordsByWallet.set(wallet, coords);
      }
      const states = addresses.length === 0 ? new Map() : await readers.readStates(addresses);
      const out = new Map();
      for (const wallet of wallets) {
        const shards = [];
        let unknown = false;
        for (const coord of coordsByWallet.get(wallet) ?? []) {
          const state = states.get(addrKey(coord.address));
          if (state && isUnknownAccountState(state)) { unknown = true; continue; }
          if (!state || state.status !== 'active') continue;
          shards.push({ ...coord, key: addrKey(coord.address), address: state.address, marker: changeMarkerOf(state), lastLt: state.lastLt ?? null });
        }
        out.set(wallet, { shards, unknown });
      }
      return out;
    },

    async readChannelHead(channelWallet, shard, { maxCount = PUBLIC_LATEST_POST_WINDOW, requestOptions = null, heldCount = null } = {}) {
      const readers = headReadersFor(requestOptions);
      const rowsWanted = Number(maxCount);
      const full = readShardSnapshot(shard.key, shard.marker);
      let rows;
      let entryCount;
      let fresh = null;
      const hidden = [];
      if (full) {
        entryCount = Number(full.entryCount ?? (full.posts ?? []).length);
        rows = (full.posts ?? []).filter((row) => Number(row?.entry_id ?? -1) >= entryCount - rowsWanted);
      } else {
        const count = Number((await provider.getPage(shard.address, 0n, 0n, { ...readers.callOptions, cacheTtlMs: 0 })).entry_count ?? 0n);
        const held = Number.isSafeInteger(heldCount) && heldCount >= 0 && heldCount <= count ? heldCount : null;
        if (held !== null && count > 0 && Number(shard.generation ?? 17) >= 18) {
          try {
            const map = await provider.getHiddenIds(shard.address, { callOptions: readers.callOptions });
            hidden.push({ epochTag: String(shard.epochTag), seq: shard.seq, generation: shard.generation,
              entryCount: count, ids: [...map.hidden], complete: map.complete });
          } catch (error) {
            void error;
          }
        }
        if (held !== null && held === count) return { posts: [], entryCount: count, fresh: 0, unchanged: true, hidden };
        const window = held === null ? rowsWanted : Math.min(rowsWanted, count - held);
        const tail = await provider.readPosts(shard.address, {
          readMessagesWithSource: readers.readMessages,
          maxCount: BigInt(window),
          entryCount: BigInt(count),
          callOptions: { ...readers.callOptions, cacheTtlMs: 0 },
        });
        rows = tail.posts ?? [];
        entryCount = Number(tail.entry_count ?? count);
        if (held !== null && window < rowsWanted) fresh = window;
      }
      const posts = rows.map((row) => ({ ...row, channelWallet, channelEpochTag: shard.epochTag, channelShardSeq: shard.seq, generation: shard.generation }));
      posts.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
      return { posts, entryCount, fresh, unchanged: false, hidden };
    },

    async readPostAt(channelWallet, channelEpochTag, channelShardSeq, shardEntryId, { window = 16, generation = null, requestClass = null } = {}) {
      const readers = requestClass ? readersOf(requestClass, { wait: true }) : LANE_READERS;
      const seq = Number(channelShardSeq) || 0;
      const epochTag = BigInt(channelEpochTag);
      const pk = await publicChannelPartitionKey(publicWalletHash(channelWallet), seq);
      const era = Number(epochTag & 0xFFFFFFFFn);
      const candidates = generation === null
        ? publicEraGenerations(PS_KIND_CHANNEL, era)
        : [Number(generation)];
      const out = [];
      for (const gen of candidates) {
        const address = (await publicShardAddressNoted(gen, pk, epochTag));
        const live = await readers.readStates([address]);
        const state = live.get(addrKey(address));
        if (!state || state.status !== 'active') continue;
        const { posts } = await readers.readShardPosts(state.address, {
          fromId: BigInt(shardEntryId), maxCount: BigInt(window),
        });
        for (const post of posts) {
          out.push({ ...post, channelWallet, channelEpochTag: String(epochTag), channelShardSeq: seq, generation: gen });
        }
      }
      return out;
    },

    async readEntryAt({ generation, partitionKey, epochTag, entryId, window = 1, requestClass = null, following = false }) {
      const readers = requestClass ? readersOf(requestClass, { wait: true }) : LANE_READERS;
      const address = (await publicShardAddressNoted(Number(generation), BigInt(partitionKey), BigInt(epochTag)));
      const live = await readers.readStates([address]);
      const state = live.get(addrKey(address));
      if (!state || state.status !== 'active') return [];
      const { posts } = await readers.readShardPosts(state.address, { fromId: BigInt(entryId), maxCount: BigInt(window) });
      return following ? posts.filter((post) => BigInt(post.entry_id) >= BigInt(entryId)) : posts.filter((post) => BigInt(post.entry_id) === BigInt(entryId));
    },

    async readThreadComments(channelWallet, channelEpochTag, entryId, { channelShardSeq = 0, seqProbe = PUBLIC_SEQ_PROBE, olderThan = null, onProgress = null, generation = 17, requestClass = null } = {}) {
      const channelPk = await publicChannelPartitionKey(publicWalletHash(channelWallet), channelShardSeq);
      const postUid = await publicPostUid(channelPk, channelEpochTag, entryId, generation);
      const postEra = Number(BigInt(channelEpochTag) & 0xFFFFFFFFn);
      return readThreadByUidImpl(postUid, { firstEra: postEra, seqProbe, olderThan, onProgress, requestClass });
    },

    threadCoordsByUid: (postUid, options) => threadCoordsByUid(postUid, options),

    readStates: (addresses, requestClass = null) => (requestClass ? readersOf(requestClass).readStates(addresses) : readStates(addresses)),

    readThreadByUid: (postUid, options) => readThreadByUidImpl(postUid, options),

    async readAvatarParts(ownerWallet, { eraWindow = PUBLIC_AVATAR_ERA_WINDOW } = {}) {
      const nowUnix = now();
      const hash = publicWalletHash(ownerWallet);
      const addresses = await publicAvatarScanAddresses(hash, nowUnix, eraWindow);
      const live = await readStates(addresses);
      const collected = [];
      let shard = null;
      for (const address of addresses) {
        const state = live.get(addrKey(address));
        if (!state || state.status !== 'active') continue;
        const { posts } = await readShardPosts(state.address);
        if (posts.length > 0) {
          if (!shard) shard = state.address;
          collected.push(...posts);
        }
      }
      return { shard, posts: collected };
    },
  };
}
