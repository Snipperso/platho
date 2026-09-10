// public-lane — the assembly of the clean-17 PUBLIC read path, wired together in one place.
//
// The pieces are all tested on their own: shard-discovery derives the beacon/channel/thread/avatar addresses and
// the per-kind partition keys, shard-rpc reads accounts in batch and history (with source) for bodies,
// shard-reader batches accountStates and diffs cursors, and public-shard-ton-rpc-provider turns get_page + those
// bodies into authenticated posts. What did not exist was anything that put them together — the app imported none
// of it, so the whole lane was a library with no caller.
//
// THIS FILE IS THE SEAM. It stops at returning authenticated posts and a channel catalogue; what a post MEANS in
// the UI — how it renders, which thread it opens, what the feed order is on screen — is the app's decision.
//
// TWO THINGS IT DELIBERATELY DOES NOT DO YET, both because guessing would bury a real decision in plumbing:
//   * MULTIPART ASSEMBLY. readPosts matches one message to one entry, so a post that fits one body cell (text, a
//     comment, a beacon card) is complete. How a LARGE post or an avatar splits across entries — the old
//     streamId/partIndex grouping — was NOT verified by the surface map (its §5.2), so this lane exposes the raw
//     per-entry posts and leaves grouping to the media slice that can measure it. readAvatarParts returns the
//     parts unassembled for the same reason.
//   * BUCKET ORDER, and this paragraph used to describe something the code does not do. It claimed ranking by
//     entry_count "IS done here (sweepChannelCatalog reads get_view for the live buckets and sorts by
//     entry_count)". It does not: it sorts by last_transaction_lt, and has since 2026-08-21, when the
//     entry_count rank was removed because it cost a get_view per live bucket — a 142-request wall in front of
//     the first card, ranking sets of 1-3 entries. That removal was right, and it was safe for a stated reason:
//     with EVERY bucket read, lt decided only paint order, so there was nothing for a firehose to displace.
//     🔴 THE CAP CHANGED THAT AND THE ARGUMENT HAS NOT BEEN REPLACED. Since 2026-08-29 the sweep reads
//     PUBLIC_SWEEP_BUCKET_CAP buckets, so the order is a CUT — and this file's own warning applies again: a
//     bucket touched by a StateInit-less value message moves lt with no gate firing, so an attacker can buy the
//     top of the default sweep for a forward fee per bucket. It is not a regression the cap introduced out of
//     nowhere; it is a property the previous design paid for by reading everything, which does not scale.
//     Recorded here rather than patched, because every candidate fix trades something real: entry_count costs a
//     getter per bucket, balance is buyable more expensively, and rotation trades recency for coverage.
//
// WHY ITS OWN MODULE rather than lines in app.js: app.js cannot be tested without a browser; here the whole lane
// runs against a stub transport and a fixed clock, the way the intro lane does.

import { createShardStatesRequest, createShardMessagesWithSourceReader } from './shard-rpc.mjs?v=40';
import { isUnknownAccountState, readAccountStates, changeMarkerOf } from './shard-reader.mjs?v=61';
import { createPublicShardTonRpcProvider } from './public-shard-ton-rpc-provider.mjs?v=28';
import { PUBLIC_PUBLISH_OPCODE } from './public-publish-browser.mjs?v=37';
import { publicShardAddressBytesFor, rawAddress } from './shard-address.mjs?v=29';
import { generationForUnixSeconds } from './cutover-epoch.mjs?v=4';
import {
  publicBeaconScanAddresses,
  publicBeaconPartitionKey,
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
} from './shard-discovery.mjs?v=58';

const PS_KIND_CHANNEL = 0;
const PS_KIND_THREAD = 1;
const PS_KIND_BEACON = 2;

// Rows per shard read. PublicShard caps get_page at PS_PAGE_CAP = 96 to keep the getter under its gas ceiling, and
// the provider's readPosts defaults to the same — so this is the contract's number, not a tuning knob. It is also
// the size of one "show earlier comments" step.
const PAGE_ROWS = 96;

/**
 * How far back a CHANNEL is read — the CONTRACT'S retention, not a guess.
 *
 * PublicShard keeps a CHANNEL post for PS_RETENTION_POST = 1 year, and a CHANNEL era is 30 days, so a year is
 * 12.17 eras: 13 full ones plus the current partial. The reader used to stop at 3 — ninety days — which meant a
 * channel's own posts vanished from it while they were still on chain, still paid for, and still readable by
 * anything that asked for the right era. Fine for a news feed, wrong for anything serialized: publish a book a
 * chapter at a time and the opening chapters disappear from the channel three months in.
 *
 * [decided 2026-08-04] Freshness in channel
 * DISCOVERY is a separate question and stays narrow — sweepChannelCatalog keeps its own window. Note that BEACON
 * and AVATAR use the 1-year era, so an eraWindow of 3 there already means three years; only CHANNEL/THREAD count
 * in 30-day steps.
 *
 * Widening is cheap by construction: the era addresses all ride ONE batched accountStates call (14 eras x 4
 * overflow shards = 56 addresses, against a measured 1024-address ceiling), and the marker gate in readChannelPosts
 * means a closed era is read once and never again.
 */
const PUBLIC_CHANNEL_ERA_WINDOW = 14;

/**
 * How many tail rows a "latest post" read takes from a channel's newest live shard. A post is at most 16 parts,
 * so 32 rows hold the newest post whole with a spare for the straddle case (readPosts extends one page back when
 * a stream in the window is incomplete). Small on purpose: this window is read for a CARD, not for the channel.
 */
const PUBLIC_LATEST_POST_WINDOW = 32n;

/**
 * Build the PUBLIC read lane.
 *
 * `runGetMethod` is the app's existing transport method, passed in (not imported) so this stays testable.
 * `now` is injectable and MUST be in a sandbox — the era window is derived from it, and an era that does not
 * match the chain reads real addresses, finds nothing, and reports a clean empty pass (the same silent-empty
 * failure that has bitten the intro lane twice). Production passes nothing and gets Date.now().
 */
export function createPublicLane({
  runGetMethod,
  endpoint = null,
  apiKey = null,
  fetch: fetchImpl = null,
  strict = false,
  now = () => Math.floor(Date.now() / 1000),
} = {}) {
  if (typeof runGetMethod !== 'function') throw new Error('createPublicLane requires runGetMethod');

  // `strict` DEFAULTS OFF, and must: in the app a rate-limited read has to degrade into a short feed rather than a
  // thrown screen — the reader is a phone under a per-second limit and a missing row costs the user nothing but a
  // refresh. An OFFLINE WALKER inherits the opposite requirement. shard-rpc returns an empty result when the pump
  // drops a request, so for a walker whose output is a record of record, "nobody published" and "I could not ask"
  // arrive as the same value — and the run that saw nothing looks exactly like the run where nothing happened.
  // Passing strict makes the unasked question throw, which is the only form in which it can be noticed.
  const rpc = { endpoint, apiKey, fetch: fetchImpl ?? undefined, strict };
  const statesRequest = createShardStatesRequest(rpc);
  // `opcode` keeps the 128-row window spent on real posts. A channel's shard address is publicly derivable
  // (partition key from the wallet + epoch tag), so anyone could send it 128 cheap messages and push every paid
  // post out of the newest-first window — the feed would show only the freshest posts, or nothing at all.
  const readMessagesWithSource = createShardMessagesWithSourceReader({ ...rpc, opcode: PUBLIC_PUBLISH_OPCODE });
  const provider = createPublicShardTonRpcProvider({ transport: { runGetMethod } });

  const readStates = (addresses) => readAccountStates(addresses, { request: statesRequest });

  // THE CARD READ'S OWN TRANSPORT SHAPE (readLatestChannelPosts). A Discover card's latest-post read is asked for
  // a card the user is LOOKING AT, while the sweep that produced the card is still reading buckets behind it at
  // background priority. On the one strict-priority pump the card read goes ahead of the sweep ('profile' outranks
  // 'background') and behind the user's own messages and wallet. It is STRICT and NOT skippable, because its answer
  // is kept for the panel's life: a request the pump dropped must throw (the card is simply asked again the next
  // time it is seen), never read as "this channel has no posts".
  const LATEST_READ_OPTIONS = Object.freeze({ priority: 'profile', skipIfRateLimited: false });
  const latestStatesRequest = createShardStatesRequest({ ...rpc, strict: true, requestOptions: LATEST_READ_OPTIONS });
  const readLatestStates = (addresses) => readAccountStates(addresses, { request: latestStatesRequest });
  const readLatestMessagesWithSource = createShardMessagesWithSourceReader({ ...rpc, strict: true, opcode: PUBLIC_PUBLISH_OPCODE, requestOptions: LATEST_READ_OPTIONS });

  // ─────────────────────────────────────────────────────────────────────────────────────────────────────
  // SHARD SNAPSHOT CACHE — re-reading a shard that cannot have changed must cost nothing.
  //
  // It was written for comment threads and named after them, but its key is a SHARD ADDRESS and its value is that
  // shard's posts — which is exactly what a channel read needs too. Channels went without it and paid for a full
  // history read of every live shard on every sync; giving them the same cache is a rename, not a second copy.
  // [2026-08-04, when the channel read window was widened to the retention year]
  //
  // The CapsuleHub path had incremental reads: a snapshot boundary let an unchanged thread come back with ZERO
  // body reads. The shard loader lost that and re-read the whole thread on every open — cheaper than the Hub
  // (a shard per post, not one shared log) but still two RPC calls per era shard, every time, for a thread
  // nobody had touched.
  //
  // KEYED ON THE CHANGE MARKER, NOT ON entry_count. The roadmap proposed entry_count, and it would work, but it
  // costs a get_page probe per shard to learn. `last_transaction_lt` says the same thing STRICTLY EARLIER: it
  // already arrives in the batched accountStates call this read makes anyway, so an unchanged thread now costs
  // exactly the one request it takes to prove it is unchanged. The marker is monotonic per account and moves on
  // any inbound transaction, so it can be stale in the harmless direction only (a bounced write re-reads for
  // nothing); it cannot report "unchanged" for a shard that accepted a comment.
  //
  // PER SHARD, not per thread: a post's comments accumulate across era shards, so a year-old thread with one new
  // comment re-reads one shard and serves the rest from the snapshot.
  const SHARD_SNAPSHOT_MAX = 512;                 // era-shards of comments + channel shards + the ~142 live beacon buckets (one discovery sweep must not evict every thread); bounded so a long session cannot grow it
  const shardSnapshots = new Map();               // addrKey -> { marker, posts }

  function readShardSnapshot(key, marker) {
    // A null marker is "nothing measured" (an 'unknown' accountStates row — the endpoint refused the address):
    // never a cache hit, never a cache key. Otherwise a shard nobody could read would be served from the snapshot
    // for good.
    if (marker === null || marker === undefined) return null;
    const hit = shardSnapshots.get(key);
    if (!hit || hit.marker !== marker) return null;
    shardSnapshots.delete(key);                   // reinsert: Map keeps insertion order, so this is the LRU bump
    shardSnapshots.set(key, hit);
    return hit.posts;
  }

  // THE RECORD REGARDLESS OF THE MARKER. readShardSnapshot answers "is this shard unchanged since I read it",
  // which is the only question a reader that always takes the newest window has. A reader that walks BACKWARDS has
  // a second one — "how deep have I already been down this shard" — and that answer survives the shard moving:
  // entries are append-only, so a page read at entry 300 is still that page after entry 4000 arrives. Not a cache
  // hit and not gated like one; it still bumps the LRU, because a shard being walked is a shard in use.
  function peekShardSnapshot(key) {
    const held = shardSnapshots.get(key);
    if (!held) return null;
    shardSnapshots.delete(key);
    shardSnapshots.set(key, held);
    return { marker: held.marker, value: held.posts };
  }

  function writeShardSnapshot(key, marker, posts) {
    if (marker === null || marker === undefined) return;   // see readShardSnapshot: an unmeasured shard is not cached
    shardSnapshots.delete(key);
    shardSnapshots.set(key, { marker, posts });
    while (shardSnapshots.size > SHARD_SNAPSHOT_MAX) {
      const oldest = shardSnapshots.keys().next();
      if (oldest.done) break;
      shardSnapshots.delete(oldest.value);
    }
  }
  // THE LATEST-WINDOW CACHE — a SECOND, smaller map on purpose. A "latest post" read takes PUBLIC_LATEST_POST_WINDOW
  // tail rows of a shard, and the shared snapshot above is keyed only by (shard, marker): had the small window been
  // written there, the next full channel read with the same marker would have been served those few rows as the
  // whole shard, and a channel screen would have lost its older posts to a card. The small read therefore reads the
  // shared cache when it can (a full snapshot IS the answer, and free) but writes only here.
  const LATEST_SNAPSHOT_MAX = 256;                // one entry per visited card's live era shard (~142 on the measured directory); bounded so a long Discover session cannot grow it
  const latestSnapshots = new Map();              // addrKey -> { marker, posts }
  function readLatestSnapshot(key, marker) {
    if (marker === null || marker === undefined) return null;   // an unmeasured shard is never a hit — see readShardSnapshot
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
    eraWindow = PUBLIC_CHANNEL_ERA_WINDOW, seqProbe = PUBLIC_SEQ_PROBE, deep = null, onChannelError = null,
  } = {}) {
    const nowUnix = now();
    const era = publicEraOf(PS_KIND_CHANNEL, nowUnix);
    const wallets = [...new Set((channelWallets ?? []).map((w) => String(w)).filter(Boolean))];
    // Build (address, epochTag, seq) coordinates rather than a bare address list, so every post can be tagged with
    // the epoch_tag of the shard it lives in. A comment's thread shard is f(post_uid) and post_uid folds the
    // channel epoch_tag, so without this the reader could not derive where to read (or write) a post's comments.
    const coordsByWallet = new Map();
    const allAddresses = [];
    for (const wallet of wallets) {
      const hash = publicWalletHash(wallet);
      const coords = [];
      for (let e = era; e > era - eraWindow && e >= 0; e -= 1) {
        const epochTag = publicEpochTag(PS_KIND_CHANNEL, e);
        // Era-expanded [CUTOVER.md item 3]: the one era straddling the flip is probed in both generations.
        for (const generation of publicEraGenerations(PS_KIND_CHANNEL, e)) {
          for (let seq = 0; seq < seqProbe; seq += 1) {
            const address = rawAddress(await publicShardAddressBytesFor(generation, await publicChannelPartitionKey(hash, seq), epochTag));
            // THE GENERATION RIDES THE COORDINATE [round 5]. In the straddling era two coords share an epochTag
            // and a seq and differ ONLY by generation, and both shards number entries from 0 — so a post tagged
            // with epochTag+seq alone is no longer uniquely named, and the feed would merge two distinct posts.
            coords.push({ address, epochTag, seq, generation });
            allAddresses.push(address);
          }
        }
      }
      coordsByWallet.set(wallet, coords);
    }
    // ONE request set for the whole feed. readAccountStates chunks at ACCOUNT_STATES_MAX_PER_CALL and halves the
    // chunk on a refusal, so this is the same reader that was already there — asked once instead of K times.
    const live = wallets.length === 0 ? new Map() : await readStates(allAddresses);
    const failures = new Map();
    const out = new Map();
    for (const wallet of wallets) {
      // ONE CHANNEL'S FAILURE STAYS ITS OWN. The per-channel loop this replaced wrapped every read in a try/catch
      // and skipped the channel that threw; batching the STATE read must not turn one unreadable shard into a
      // dead pass for the whole feed. An empty answer is what the caller already handled — its feed cache is
      // merge-only, so nothing it already holds is lost.
      try {
        out.set(wallet, await readChannelPostsFromStates(wallet, coordsByWallet.get(wallet) ?? [], live,
          (typeof deep === 'function' ? deep(wallet) : null) ?? {}));
      } catch (error) {
        out.set(wallet, []);
        failures.set(wallet, error);
        if (typeof onChannelError === 'function') { try { onChannelError(wallet, error); } catch { /* the caller's log is not this read's problem */ } }
      }
    }
    return out;
    }

  /**
   * One channel's posts, given the shard states somebody already read. Split out of readChannelPosts so the feed
   * can read EVERY channel's states in one batched call and still assemble them one at a time — see
   * readChannelPostsMany for the measurement that made that necessary.
   */
  async function readChannelPostsFromStates(channelWallet, coords, live, { backfillPages = 0, knownRange = null } = {}) {
    const posts = [];
    // THE HIDDEN BITS OF ROWS THE CALLER ALREADY HOLDS [CUTOVER item 15, round 2]: a shard that moved is re-read
    // only in its newest window, so a hide on an older entry never reached a device that had cached it. For every
    // shard that moved AND that this reader or its caller held rows of, one get_hidden gives every entry's bit;
    // the caller applies them to its cache (upsertPublicChainPosts). Carried on the array, beside the posts.
    Object.defineProperty(posts, 'hidden', { value: [], enumerable: false, writable: true });   // beside the posts, invisible to a deep-equal of the list
    let budget = Math.max(0, Math.trunc(Number(backfillPages) || 0));
    const callerHolds = (coord) => {
      if (typeof knownRange !== 'function') return null;
      // A caller's bad mark must not cost the read: an unusable answer means "holds nothing known", and that
      // walks as far as the budget allows rather than refusing to walk at all.
      try {
        // The generation completes the coordinate [round 6]: in the straddling era (epoch_tag, seq) names two
        // shard accounts, both numbering entries from 0, so a mark asked without it answers for the wrong shard
        // and the deep segment below is never built. The coord has carried it since round 5 — this call was the
        // one place that dropped it, forty lines under the comment that says the pair is no longer unique.
        const held = knownRange(coord.epochTag, coord.seq, coord.generation);
        const min = Number(held?.min);
        const max = Number(held?.max);
        if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return null;
        return { min, max };
      } catch { return null; }
    };
    for (const coord of coords) {
      const state = live.get(addrKey(coord.address));
      if (!state || state.status !== 'active') continue;   // 'unknown' (refused by the endpoint) / uninit rows are not readable
      // THE SAME MARKER GATE THE THREAD READ HAS USED ALL ALONG, and the reason the era window can span a year at
      // all: without it, every live shard of every past era would have its history re-read on every feed sync.
      // A CLOSED era cannot change — its shards are past the publish gate's +/-1 slack — so after one read they
      // cost exactly their row in the batched accountStates call above, forever.
      const key = addrKey(coord.address);
      const marker = changeMarkerOf(state);
      const held = peekShardSnapshot(key);
      const fresh = held !== null && marker !== null && held.marker === marker ? held.value : null;
      const rows = new Map();                      // entry_id -> row; a later read of the same entry wins
      const take = (list) => { for (const row of list ?? []) rows.set(String(row.entry_id), row); };
      let count = null;        // entry_count as of the newest window read
      let windowFrom = null;   // where that newest window starts
      let oldestLt = null;     // lt of the oldest body matched in it — the anchor the next page down needs
      let walkedLt = held?.value?.walkedLt ?? null;   // and the anchor at the deepest row this lane has asked for
      if (fresh) {
        take(fresh.posts);
        count = Number.isFinite(Number(fresh.entryCount)) ? Number(fresh.entryCount) : null;
        windowFrom = Number.isFinite(Number(fresh.from)) ? Number(fresh.from) : null;
        oldestLt = fresh.oldestLt ?? null;
      } else {
        const tail = await readShardPosts(state.address);
        take(tail.posts);
        count = Number(tail.entry_count ?? 0);
        windowFrom = Math.max(0, count - PAGE_ROWS);
        oldestLt = tail.oldestLt ?? null;
        // the shard moved: if anyone holds rows below the window just read, their hidden bits may have moved too
        const holds = callerHolds(coord);
        if (count > 0 && (held !== null || (holds && holds.min < windowFrom))) {
          try {
            const map = await provider.getHiddenIds(state.address);
            posts.hidden.push({ epochTag: String(coord.epochTag), seq: coord.seq, generation: coord.generation,
              entryCount: count, ids: [...map.hidden], complete: map.complete });
          } catch (error) {
            // the bits stay as held; the next move asks again
            void error;
          }
        }
      }
      // ONE VALUE SHAPE for the shared snapshot cache, and the thread read's shape: rows, where the window starts,
      // the body anchor. `walked` is this reader's own field — the deepest row it has ASKED for on this shard, kept
      // ACROSS marker moves (entries are append-only, so a page read once stays read) and used below so a page is
      // never fetched twice in a session even when the caller's mark cannot move, which is what happens when an
      // entry's body never decodes and the caller's floor therefore stays where it was.
      let walked = Number.isFinite(Number(held?.value?.walked)) ? Number(held.value.walked) : windowFrom;
      if (windowFrom !== null && windowFrom < walked) walked = windowFrom;
      // WHAT IS MISSING, IN RANGES, newest first — and there are TWO kinds of missing, which is the whole reason a
      // single "walk down to here" mark is not enough:
      //   * THE BURST ABOVE. More than PAGE_ROWS entries can arrive between two passes, and then the newest window
      //     does not touch what the caller already had: the entries in between belong to nobody's read. A mark that
      //     only said "how deep have I been" would have skipped them silently and forever, which is the same
      //     silent-loss shape as the defect this walk exists to repair.
      //   * THE HISTORY BELOW what the caller holds, which is the walk proper.
      // `walked` guards only the second: it is where this lane has already ASKED on this shard, so a page is not
      // re-fetched in a session even when the caller's mark cannot move.
      const holds = callerHolds(coord);
      const segments = [];
      if (windowFrom !== null) {
        const deepTop = Math.min(walked, holds === null ? walked : holds.min);
        if (holds !== null && windowFrom > holds.max + 1) segments.push({ top: windowFrom, floor: holds.max + 1, anchor: oldestLt });
        // THE ANCHOR OF THE DEEP SEGMENT IS WHATEVER lt WAS TAKEN AT ITS TOP: the newest window's oldest body when
        // the segment starts right below that window, the walk's own remembered anchor when it resumes deeper, and
        // nothing at all when the caller's mark starts it somewhere neither read reached — there the rows' own time
        // aims the bodies instead. MEASURED: aiming a segment that begins at the window with the row-time fallback
        // returned 32 rows of 96, because +/-600s around entries seconds apart is still the newest 128.
        if (deepTop > 0) segments.push({ top: deepTop, floor: 0, anchor: deepTop === windowFrom ? oldestLt : (deepTop === walked ? walkedLt : null) });
      }
      for (const segment of segments) {
        let cursor = segment.top;
        let cursorLt = segment.anchor;
        while (budget > 0 && cursor > segment.floor) {
          const start = Math.max(segment.floor, cursor - PAGE_ROWS);
          const endLt = cursorLt === null ? null : (() => {
            try { return String(BigInt(cursorLt) - 1n); } catch { return null; }
          })();
          const page = await readShardPosts(state.address, {
            fromId: start,
            maxCount: BigInt(cursor - start),
            // The INTRO lane's +/-600s technique, which readPosts implements for exactly this case.
            ...(endLt === null ? { messagesByRowTime: true } : { messagesEndLt: endLt }),
          });
          take(page.posts);
          cursorLt = page.oldestLt ?? cursorLt;
          cursor = start;
          budget -= 1;
          if (segment.floor === 0) { walked = cursor; walkedLt = cursorLt; }
        }
      }
      const merged = [...rows.values()];
      // THE NEWEST WINDOW IS WHAT THE LANE KEEPS — see the note on `knownRange` above for why the walked rows are
      // handed over rather than held. A window whose bodies were DECLINED by the paced pump (a non-strict
      // /messages answers [] under a rate limit) must not be remembered as "this shard is empty" until the marker
      // moves, which is the same gate the thread read uses.
      if (merged.length > 0 || count === 0) {
        const kept = windowFrom === null ? merged : merged.filter((row) => Number(row.entry_id) >= windowFrom);
        writeShardSnapshot(key, marker, { posts: kept, from: windowFrom, entryCount: count, oldestLt, walked, walkedLt });
      }
      for (const p of merged) posts.push({ ...p, channelWallet, channelEpochTag: coord.epochTag, channelShardSeq: coord.seq, generation: coord.generation });
    }
    posts.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    return posts;
  }

  /** posts of one shard, authenticated: get_page + /messages(+source) matched by commit. */
  // Reads the shard's NEWEST window (readPosts anchors at the tail and extends one page back when a multipart
  // post straddles the boundary). `entryCount` lets a caller that already read get_view skip the probe getter.
  const readShardPosts = (address, options = {}) => provider.readPosts(address, { readMessagesWithSource, ...options });
  const PUBLIC_SWEEP_BUCKET_CAP = 64;

  return {
    /**
     * DISCOVERY. Sweep the beacon directory and return a deduped channel list — newest announcement per wallet.
     *
     * Returns [{ channelWallet, announcedAt, card }] where card is the beacon body cell (the client renders it,
     * but MUST treat its avatar_hash as advisory — the authoritative avatar pointer is the paid KeyShard one).
     *
     * EVERY LIVE BUCKET, STREAMED, MOST RECENTLY TOUCHED FIRST — and no ranking pass in front of it.
     *
     * MEASURED 2026-08-21 on mainnet: 142 live beacon buckets (the bucket is walletHash % 1024, so the directory
     * is spread by design — roughly one bucket per described channel, 1-8 announcements each). The sweep used to
     * rank those buckets by entry_count before reading any of them — one sequential get_view per live bucket —
     * and only then read the top 32. Two things followed. The FIRST card could not appear before 3 + 142 + 2
     * requests on the one serial pump (~37s keyed, ~2.7 minutes keyless), which is the "nothing, nothing, then
     * channels" the owner reported; and only 32 of 142 buckets were ever read, so most described channels never
     * reached the page at all — a share that shrinks as the network grows. The ranking itself ranked nothing:
     * with 1-3 entries per bucket the top 32 were arbitrary.
     *
     * So: the order comes FREE from the accountStates batch (last_transaction_lt — the most recently touched
     * bucket first, which is what "recently active channels" means), every live bucket is read, and the catalog
     * is reported after each one. The first card now costs 3 + 2 requests. A bucket whose change marker has not
     * moved since this lane last read it is served from the lane's snapshot cache and costs nothing — the same
     * gate the channel and thread reads use — so a re-sweep five minutes later pays for the states batch and for
     * what actually changed.
     *
     * ON lt AS AN ORDER. The note at the top of this file stands: a value message moves a bucket's lt without any
     * gate firing, so lt is a poor RANK — which is why the old top-K cut refused it. With no cut there is nothing
     * to displace: lt decides only which bucket paints first, and the list keeps arrival order so cards do not
     * jump under the reader's finger. Sitting at the top costs a message either way (a publish under entry_count
     * ranking, a transfer here); neither is a defence, and this one is free to read.
     *
     * `topBuckets` survives as an optional CAP on how many buckets one sweep reads (null = all) — an emergency
     * knob, not the default. `onProgress(catalogSoFar)` is called after each bucket; its return value is ignored
     * and a throw from it cannot stop the sweep: painting is the caller's business, and a caller's bad frame must
     * not cost the remaining buckets. [OWNER 2026-08-20, during the user influx, and again 2026-08-21.]
     */
    /**
     * HOW MANY DIRECTORY BUCKETS ONE SWEEP OPENS. This is the constant that decides whether "Find channels"
     * survives scale, and until 2026-08-29 there was none: the caller asked for Infinity and the sweep read every
     * live bucket, so its cost grew linearly with the number of channels in the network.
     *
     * MEASURED against the 30 MiB/day budget this project already uses for a phone: one COLD sweep costs 10.6 MiB
     * at 10,000 channels, 89.7 MiB at 91,000 — more than the whole day — and gigabytes at millions. Enumerating a
     * directory cannot survive millions of users no matter how the buckets are arranged; the 192-row read window
     * was only the first symptom. [decided 2026-08-29]
     *
     * With a cap the sweep costs the same at ten thousand channels and at ten million: the state read of every
     * bucket (~670 KB, needed for the ordering and constant in N) plus this many buckets' newest window.
     * SIXTY-FOUR, and the first attempt at EIGHT was wrong for a reason worth keeping: it counted ANNOUNCEMENTS
     * per bucket, not CHANNELS. A wallet's bucket is walletHash % 1024 and fixed for life, so the mainnet shape
     * this lane already measured — 142 live buckets, 1-8 announcements each — is roughly ONE BUCKET PER CHANNEL.
     * The yield is therefore cap x channels-per-bucket, which at eight was eight cards, not "several hundred";
     * and because the screen's own filters (own wallet, already subscribed, no profile document) run AFTER the
     * cap, a reader who already follows the eight most recently touched channels saw an EMPTY screen telling
     * them no channels have descriptions yet. MEASURED by audit: 20 described channels on chain, 8 reaching the
     * screen, 12 never opened.
     * Sixty-four is still O(1) in network size — the sweep is dominated by the constant state read of every
     * bucket (~670 KB, needed for the ordering), and 64 buckets add ~700 KB, about 4.5% of the 30 MiB day.
     * Enumeration at 91,000 channels cost 89.7 MiB, so this keeps the ceiling gone while the screen stays useful.
     *
     * WHAT THIS TRADES: the catalogue is the RECENTLY ACTIVE part of the directory, not all of it. Finding a
     * SPECIFIC channel is not this path's job — that goes through usernames, which are one contract per name and
     * have no ceiling at all. `topBuckets: Infinity` still asks for everything, for a deliberate full walk.
     */
    async sweepChannelCatalog({ eraWindow = 3, topBuckets = PUBLIC_SWEEP_BUCKET_CAP, onProgress = null } = {}) {
      const nowUnix = now();
      const addresses = await publicBeaconScanAddresses(nowUnix, eraWindow);
      const states = await readStates(addresses);
      if (states.size === 0) return [];

      // Most recently touched first. lt arrives as a string of digits; compare as BigInt (a lexical compare of
      // unequal lengths would put 99 above 100).
      // ACTIVE only: a publicly-derivable bucket can be touched into an uninit account, and get_page on one throws
      // exit -13 (the same trap the thread read documents); an 'unknown' row (the endpoint refused the address)
      // is not readable either.
      const ltOf = (state) => { try { return BigInt(state?.lastLt ?? 0); } catch { return 0n; } };
      const ordered = [...states.values()]
        .filter((state) => state.status === 'active')
        .sort((a, b) => (ltOf(a) < ltOf(b) ? 1 : ltOf(a) > ltOf(b) ? -1 : 0));
      const limit = Number.isFinite(Number(topBuckets)) && Number(topBuckets) > 0 ? Number(topBuckets) : ordered.length;
      const buckets = ordered.slice(0, limit);

      const byWallet = new Map();
      const delisted = new Set();   // publishers with a hidden card in this sweep: no seq of theirs makes a card
      let done = 0;
      for (const state of buckets) {
        const key = addrKey(state.address);
        const marker = changeMarkerOf(state);
        const snapshot = readShardSnapshot(key, marker);
        let posts;
        if (snapshot) {
          posts = snapshot.posts;
        } else {
          // FROM ROW 0, which for a beacon bucket is the whole bucket: announcements per bucket are a handful, and
          // get_page(0, 96) returns them all AND the entry_count in one getter — so the tail-anchoring probe
          // readPosts would otherwise make first (get_page(0, 0)) is not needed here. The cap is honoured all the
          // same: a bucket that has outgrown one page also gets its tail read, so the newest announcements are
          // never the ones cut off.
          //
          // BOTH WINDOWS, and a 2026-08-29 attempt to read only the newest was REVERTED the same day. The
          // reasoning behind it — that a directory wants recent announcements, and that merging cost twice as
          // much — was wrong on both halves, and measurably so. The head read still runs either way because it is
          // where entry_count comes from, so dropping the merge saved NOTHING (identical get_page, /messages and
          // bytes) and lost every channel whose only announcement sits below the newest 96: a bucket holding four
          // quiet channels plus 96 re-saves by one busy wallet yielded 1 channel instead of 5. Buckets group
          // channels by walletHash, so the entries in one are DIFFERENT channels, not one channel's history.
          const first = await readShardPosts(state.address, { fromId: 0n });
          posts = first.posts;
          if (first.entry_count > 96n) {
            const tail = await readShardPosts(state.address, { entryCount: first.entry_count });
            const merged = new Map();
            for (const post of [...tail.posts, ...posts]) merged.set(String(post.entry_id), post);
            posts = [...merged.values()];
          }
          // ONE VALUE SHAPE for the shared snapshot cache — see readChannelPosts. NOT SNAPSHOTTED WHEN ROWS CAME
          // BACK WITHOUT BODIES: the pump drops a rate-limited /messages silently (skipIfRateLimited), and caching
          // that as "no announcements" would hide a channel until the bucket's marker moves — which for a directory
          // bucket can be never. An empty bucket (no rows at all) is cached as such.
          if (posts.length > 0 || BigInt(first.entry_count ?? 0n) === 0n) {
            writeShardSnapshot(key, marker, { posts, from: 0n, entryCount: first.entry_count });
          }
        }
        for (const post of posts) {
          if (!post.publisher) continue;
          const wallet = addrKey(post.publisher);
          // A HIDDEN ANNOUNCEMENT IS A DELISTED CHANNEL [audit 2026-09-05, round 2]. The contract keeps the bit across
          // a re-save precisely so a delisted channel cannot relist itself, and no reader honoured it: the catalogue
          // mapped every row to a card. Its posts stay where they are; the directory simply does not offer it.
          // ...ON EVERY SEQ OF THE PUBLISHER [round 3]: the bit lives on one account, and a new `shard_seq` is a new
          // account (0.041 GRAM), so the same announcer re-announced, unhidden, one seq up. A moderator's hide of a
          // channel card delists the PUBLISHER for the era, whichever of their accounts carries the newest row.
          if (post.hidden === true) { delisted.add(wallet); byWallet.delete(wallet); continue; }
          if (delisted.has(wallet)) continue;
          const prev = byWallet.get(wallet);
          if (!prev || post.created_at > prev.announcedAt) {
            byWallet.set(wallet, { channelWallet: post.publisher, announcedAt: post.created_at, card: post.body });
          }
        }
        done += 1;
        if (typeof onProgress === 'function') {
          // `{ done, total }` rides with every frame so a caller can say how far the sweep is, not only what it has.
          try { onProgress([...byWallet.values()], { done, total: buckets.length }); }
          catch { /* see the note on onProgress: the caller's paint is not this sweep's problem */ }
        }
      }
      return [...byWallet.values()];
    },

    /**
     * A channel's posts over the era window, authenticated and newest-first. `channelWallet` is the channel's
     * identity — a channel IS a wallet in clean-17. Returns a flat post list.
     *
     * ONE PAGE IS NOT A CHANNEL, and until 2026-08-29 one page was all this read ever took.
     *
     * MEASURED on a real PublicShard (PL-WINDOW-03): a channel holding 260 entries in one era shard read back
     * NINETY-SIX — entries 164..259. The other 164 were on chain, paid for, well inside PS_RETENTION_POST, and
     * unreachable by any client path, because four separate things pointed the same way: the publisher always
     * writes shard seq 0, get_page is capped at PS_PAGE_CAP = 96 rows, readPosts anchors that page at the TAIL,
     * and the "Show older posts" control only raises a RENDER cap over posts already in memory. A 30-day era
     * therefore showed its newest 96 ENTRIES and nothing before them: 3.2 single-part posts a day, or twelve
     * 8-part chapters, before a channel began losing its own beginning. [decided 2026-08-04] Widening the ERA window to a year was one half of that promise;
     * this is the other, and without it the wide window only meant more shards read one page deep.
     *
     * `backfillPages` IS THE BUDGET, IN PAGES BELOW THE NEWEST WINDOW, THAT THIS CALL MAY SPEND — across every
     * shard, newest era first. Zero (the default) is exactly the old cost: one page per live shard, which is what
     * the background feed pass over every followed channel still asks for.
     *
     * `knownRange(epochTag, seq)` IS WHAT THE CALLER ALREADY HOLDS for that shard, as `{ min, max }` entry ids —
     * the shape the CONV lane already proved (readIncoming's `knownSeqOf`), widened to both ends because a shard
     * can be missing entries at BOTH: below what the caller holds (its history) and above it (a burst that arrived
     * faster than one page between two passes). Only the missing ranges are fetched, newest first.
     *
     * It is deliberate that the lane does not keep the walked rows itself: a public part is up to 32 KiB and a
     * shard holds up to PS_SAFE_CAP = 4096 of them, so a fully walked shard is ~128 MiB — against a snapshot map
     * that holds up to SHARD_SNAPSHOT_MAX = 512 shards. The caller's feed cache is durable and merge-only
     * (upsertPublicChainPosts never prunes), so it is the right ledger; the lane keeps the newest window and the
     * coordinates of how deep it has been, and a pass whose result the caller throws away is simply re-read.
     *
     * The bodies page back WITH the rows (`messagesEndLt` = just below the previous page's oldest matched body —
     * the mechanism PCWINDOW-04 measured for "show earlier comments"). Without it a deep page of rows would be
     * matched against the newest 128 bodies and come back empty, which is the head/tail defect all over again.
     */
    async readChannelPosts(channelWallet, options = {}) {
      // NOT `this.readChannelPostsMany` — a lane method must survive being pulled off the object, which callers do.
      const byWallet = await readChannelPostsManyImpl([channelWallet], {
        ...options,
        deep: () => ({ backfillPages: options.backfillPages ?? 0, knownRange: options.knownRange ?? null }),
      });
      return byWallet.get(String(channelWallet)) ?? [];
    },

    /**
     * THE SAME READ, FOR EVERY FOLLOWED CHANNEL AT ONCE — one batched accountStates for the whole feed.
     *
     * MEASURED 2026-08-29 over the shipping lane: a pass across 100 followed channels issued ONE HUNDRED
     * accountStates requests, one per channel, 56 addresses each. The shared pump spaces requests at
     * TONCENTER_KEYLESS_REQUEST_SPACING_MS = 1100 ms without an API key, so the pass took ~110 s against its own
     * 30-second period — it could never finish before the next one was due — and 12.5 s with a key. The addresses
     * were never the problem: 5,600 of them fit six requests at ACCOUNT_STATES_MAX_PER_CALL = 1024, and the reader
     * has chunked them like that all along. Only the CALLER was per-channel.
     *
     * `deep(wallet)` decides which channels get more than their newest page — the reader's open channel, and only
     * it (see PUBLIC_CHANNEL_BACKFILL_PAGES in app.js). `onChannelError(wallet, error)`, when given, is called for
     * a channel whose own read threw; the rest of the feed is unaffected. Returns Map(wallet -> posts,
     * newest-first).
     */
    readChannelPostsMany: (channelWallets, options) => readChannelPostsManyImpl(channelWallets, options),

    /**
     * HOW FULL EACH OF THESE DIRECTORY BUCKETS IS, for the announcer that has to choose one.
     *
     * A bucket-era is capped at PS_SAFE_CAP and the live contract refuses a full one in COMPUTE (gate 13705), so a
     * beacon written into a full bucket bounces and the channel is simply not in Discover. MEASURED by audit:
     * 57.2 GRAM fills a bucket, and the BEACON era is a YEAR — so on the sealed contract that is a permanent,
     * targeted denial against anyone whose bucket an attacker chooses to fill.
     *
     * It is escapable, and the contract says so itself: the BEACON partition key is H(domain, bucket) with NO
     * sender folded in (PublicShard.tact:301, gate 13702 only checks that the key matches the address), and its
     * own overflow note says "overflow is the client's job". The reader sweeps every bucket and keys the catalogue
     * by the entry's `publisher`, which the VM stamps from sender() — so a beacon in ANY bucket is found, and
     * still advertises only its announcer. The bucket is a hint about where to look first, never an identity.
     *
     * Returns Map(bucket -> { live, entryCount, safeCap, room }). `room` is null when the shard could not be read,
     * which the caller must treat as "unknown", never as "full".
     */
    /**
     * WHICH SHARD SEQ A WRITE SHOULD LAND IN, for any kind that has an overflow space.
     *
     * [audit 2026-09-01, round 9.] PublicShard refuses at PS_SAFE_CAP with `throwUnless(13705, entry_count <
     * PS_SAFE_CAP)`, and its comment says "Overflow is the client's job: it rolls shard_seq to a fresh account and
     * readers probe 0..PS_SEQ_PROBE-1". The READER does probe four; the WRITER passed a literal 0 at every site,
     * so the mechanism the contract documents never ran. A channel reaching PS_SAFE_CAP entries in its era was
     * refused for the rest of that era, with no client signal beyond a six-minute "failed" — and a THREAD the
     * same, at PS_SAFE_CAP comments.
     *
     * Returns the first seq with room for `need` more entries, or null if every probed seq is full or unreadable.
     * One batched accountStates over the seq space plus a get_view for each live one, the same shape the beacon
     * roll uses — and the seqs are probed in order, so an untouched shard (the common answer, seq 0) costs the
     * batch and nothing else.
     */
    async readWriteShardSeq(args) {
      const target = await this.readWriteShard(args);
      return target ? target.seq : null;
    },

    /**
     * The shard seq a write of `need` entries should go to, AND whether that shard already exists on chain. The
     * second half is what lets a publish leave the StateInit off [audit 2026-09-05, round 1]: every part of every
     * public post carried the shard's code and data — on the direct door the wallet paid their forward fee (1.13M
     * nanoton a part on generation 17, 2.53M on 18), on the vault door twice, and the door decision counted them as
     * a cost of the discount and closed it for stakers under about 3,000 ATH. A shard this probe has just read as
     * active needs no halves; one it found empty or absent gets them on the first part alone.
     */
    async readWriteShard({ kind, partitionKeyOf, epochTag, need = 1, nowUnix = null, seqProbe = PUBLIC_SEQ_PROBE } = {}) {
      if (typeof partitionKeyOf !== 'function') throw new Error('readWriteShard requires partitionKeyOf');
      const probeUnix = nowUnix ?? now();
      // The WRITE-time generation, for the same reason the beacon probe uses it: within a straddling era the two
      // generations are different accounts, and room that exists only in the one nobody writes is not room.
      const writeGeneration = generationForUnixSeconds(probeUnix);
      const coords = [];
      for (let seq = 0; seq < seqProbe; seq += 1) {
        coords.push({ seq, address: rawAddress(await publicShardAddressBytesFor(writeGeneration, await partitionKeyOf(seq), epochTag)) });
      }
      const live = await readStates(coords.map((c) => c.address));
      for (const coord of coords) {
        const state = live.get(addrKey(coord.address));
        // An address the endpoint answered about and did not mention has never been written to — empty, and the
        // first such seq is exactly where a write belongs.
        if (state && isUnknownAccountState(state)) continue;          // unreadable: do not claim it has room
        if (!state || state.status !== 'active') return { seq: coord.seq, live: false };   // never written / emptied: all the room there is
        try {
          const view = await provider.getView(state.address);
          const entryCount = Number(view.entry_count ?? 0);
          const safeCap = Number(view.safe_cap ?? 0);
          if (safeCap > 0 && entryCount + Number(need) <= safeCap) return { seq: coord.seq, live: true };
        } catch { /* unreadable seq: try the next rather than claim it */ }
      }
      return null;
    },

    async readBeaconBucketRoom(buckets, { nowUnix = null } = {}) {
      const list = [...new Set((buckets ?? []).map((b) => Number(b)).filter((b) => Number.isInteger(b) && b >= 0))];
      const out = new Map();
      if (list.length === 0) return out;
      const probeUnix = nowUnix ?? now();
      const epochTag = publicEpochTag(PS_KIND_BEACON, publicEraOf(PS_KIND_BEACON, probeUnix));
      // The room probe measures where the WRITER would land, so it follows the WRITE-time generation — within
      // the straddling era, pre-E announcements sit in the clean-17 era-shard and post-E ones in the clean-18
      // shard of the same era index. Probing the read union here would let the roll pick a bucket whose room
      // exists only in a generation nobody writes any more.
      const writeGeneration = generationForUnixSeconds(probeUnix);
      const coords = [];
      for (const bucket of list) {
        coords.push({ bucket, address: rawAddress(await publicShardAddressBytesFor(writeGeneration, await publicBeaconPartitionKey(bucket), epochTag)) });
      }
      const live = await readStates(coords.map((c) => c.address));
      for (const coord of coords) {
        const state = live.get(addrKey(coord.address));
        // THREE ANSWERS, AND ONLY ONE OF THEM IS "UNKNOWN".
        //   * MISSING FROM THE RESULT — the endpoint answered and did not mention this address, which
        //     [[toncenter-omits-only-never-seen]] MEASURED to mean the indexer has never seen it: nothing was ever
        //     written to this bucket-era, so it is EMPTY. Conflating this with "unknown" would leave the roll below
        //     with nowhere to go, since almost every free bucket is one nobody has touched.
        //   * `unknown` — refused or unanswered. Nothing was measured; the caller must not read it as room.
        //   * uninit — touched and now empty. Also empty, and it costs a full row to say so.
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
          // safe_cap comes from the SHARD, not from a constant copied into the client: the number that refuses the
          // publish lives in the contract, and a second copy here would be a copy of a value someone else owns.
          const safeCap = Number(view.safe_cap ?? 0);
          out.set(coord.bucket, { live: true, entryCount, safeCap, room: safeCap > 0 ? safeCap - entryCount : null });
        } catch {
          out.set(coord.bucket, { live: true, entryCount: null, safeCap: null, room: null });
        }
      }
      return out;
    },

    /**
     * A channel's NEWEST posts, cheaply — for a card that shows "the latest post" and nothing else.
     *
     * [decided 2026-08-21] A card
     * cannot afford readChannelPosts: that is every era's live shard, each read whole, and the Discover list is
     * 142 channels of them. This read asks the same ONE batched accountStates over the channel's era/overflow
     * coordinates (cheap, and it is what says which shards are live at all), then reads ONLY the newest era that
     * has a live shard, and only PUBLIC_LATEST_POST_WINDOW tail rows of it. Three requests for a card, not thirty.
     *
     * Returns { posts, era, exhausted }: posts are the tail rows of that era's live shards, newest first, tagged
     * exactly like readChannelPosts tags them (the app decodes them with the same assembler); era is the era they
     * came from, null when the window holds no live shard; exhausted says no older era is left in the window. A
     * caller that finds no VISIBLE post in them (the era's tail was a profile update) asks again with
     * `beforeEra: era` and walks back one era at a time — profile-only shards are rare, so the loop is short.
     *
     * A full snapshot of a shard (a feed or channel read left it) is served as-is and costs nothing; the small
     * window is cached in its own map, keyed by the same change marker, so a re-render or a re-open is free and
     * the shared snapshot keeps its full window (see latestSnapshots above).
     */
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
            const address = rawAddress(await publicShardAddressBytesFor(generation, await publicChannelPartitionKey(hash, seq), epochTag));
            coords.push({ address, epochTag, seq, era: e, generation });
          }
        }
      }
      if (coords.length === 0) return { posts: [], era: null, exhausted: true };
      const live = await readLatestStates(coords.map((c) => c.address));
      // ACTIVE only — 'unknown' (refused by the endpoint) and uninit rows are not readable (get_page on an uninit
      // account throws exit -13, the trap every read in this lane documents). Coordinates run newest era first, so
      // the first live one names the newest live era.
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
            callOptions: { priority: LATEST_READ_OPTIONS.priority },   // get_page rides the same lane as the bodies
          });
          shardPosts = tail.posts;
          // The same gate as the sweep: a tail whose rows came back without bodies (the /messages window missed
          // them) is not remembered as "no posts" until the marker moves; a genuinely empty shard is.
          if (shardPosts.length > 0 || BigInt(tail.entry_count ?? 0n) === 0n) writeLatestSnapshot(key, marker, shardPosts);
        }
        for (const p of shardPosts) posts.push({ ...p, channelWallet, channelEpochTag: coord.epochTag, channelShardSeq: coord.seq, generation: coord.generation });
      }
      posts.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
      return { posts, era: newestEra, exhausted };
    },

    /**
     * ONE post, addressed directly by the coordinates a SHARE block carries.
     *
     * WHY THIS EXISTS. A reposted public post travels as a REFERENCE: entry id, body hash and author wallet, plus a
     * 4KB text snapshot and a "has image" flag. The reader had no way to follow that reference — the only resolver
     * looked in the LOCAL feed cache, and the recipient of a repost is by definition someone who probably does not
     * follow that channel. So the image never appeared and the text stayed a fragment, on a pointer that was
     * complete all along.
     *
     * ADDRESSED, NOT SCANNED. readChannelPosts would also find it, but it costs the whole channel — 14 eras x 4
     * overflow shards of accountStates plus a history read per live shard — and it reads each shard's NEWEST window,
     * so an OLD post (a book channel's early chapter) is not in it at any price. The feed id is
     * `epochTag.shardSeq.entryId`, which names the exact shard account and the exact row, so this reads that one
     * shard from that one entry forward. Cost does not grow with the channel.
     *
     * The window is forward on purpose: a multipart post (any post with an image) occupies consecutive entries and
     * the SHARE block points at its FIRST part, so its remaining parts are the entries just after it.
     *
     * KNOWN CEILING, stated rather than hidden: bodies come from /messages (newest-first, 8 pages x 128), so in a
     * shard carrying more than ~1024 publishes the oldest entries have no reachable body and this returns nothing
     * for them. The caller keeps the sender's snapshot in that case, which is exactly what it is for.
     */
    async readPostAt(channelWallet, channelEpochTag, channelShardSeq, shardEntryId, { window = 16, generation = null } = {}) {
      const seq = Number(channelShardSeq) || 0;
      const epochTag = BigInt(channelEpochTag);
      const pk = await publicChannelPartitionKey(publicWalletHash(channelWallet), seq);
      // WHICH GENERATION HOLDS IT. A coordinate that names one (an id minted after the flip carries it) addresses
      // exactly that shard. An older, generation-less reference in the straddling era has TWO candidates, and
      // they are not interchangeable: both shards number entries from 0, so entry k exists in both and is a
      // DIFFERENT post in each.
      //
      // SO EVERY CANDIDATE IS READ AND ALL OF THEM ARE RETURNED — the caller's `selectPost` is what decides
      // [audit 2026-08-31, round 5]. This used to stop at the first generation that yielded anything, which the
      // two callers turned into two different wrongs: a SHARE (which selects by body hash) got the other
      // generation's post, failed the hash and rendered nothing — the very failure this read exists to fix; and a
      // PERMALINK (which selects by entry id) got a post whose id MATCHED and rendered someone else's post under
      // the link. Returning both candidates lets the hash check find the right one and the id check see the
      // ambiguity. Every non-straddling era still has exactly one candidate, so this is one read as before.
      const era = Number(epochTag & 0xFFFFFFFFn);
      const candidates = generation === null
        ? publicEraGenerations(PS_KIND_CHANNEL, era)
        : [Number(generation)];
      const out = [];
      for (const gen of candidates) {
        const address = rawAddress(await publicShardAddressBytesFor(gen, pk, epochTag));
        const live = await readStates([address]);
        const state = live.get(addrKey(address));
        // ACTIVE, not merely present: a publicly-derivable address can be touched into existence uninitialised,
        // and get_page on an uninit account throws exit -13 (the same trap the thread read documents).
        if (!state || state.status !== 'active') continue;
        const { posts } = await readShardPosts(state.address, {
          fromId: BigInt(shardEntryId), maxCount: BigInt(window),
        });
        for (const post of posts) {
          out.push({ ...post, channelWallet, channelEpochTag: String(epochTag), channelShardSeq: seq, generation: gen });
        }
      }
      return out;
    },

    /**
     * ONE entry of ONE shard, named the way a report names it: generation, partition key, epoch tag, entry id
     * [CUTOVER item 15]. The moderators' queue reads the words behind a row with this — a moderator judges text,
     * not coordinates — and it costs one accountStates read and one page read, whatever kind the shard is.
     * Empty when the shard is not live, the entry is not there, or its body is past the reachable /messages window.
     */
    async readEntryAt({ generation, partitionKey, epochTag, entryId, window = 1 }) {
      const address = rawAddress(await publicShardAddressBytesFor(Number(generation), BigInt(partitionKey), BigInt(epochTag)));
      const live = await readStates([address]);
      const state = live.get(addrKey(address));
      if (!state || state.status !== 'active') return [];
      const { posts } = await readShardPosts(state.address, { fromId: BigInt(entryId), maxCount: BigInt(window) });
      return posts.filter((post) => BigInt(post.entry_id) === BigInt(entryId));
    },

    /**
     * The comment thread of one post. The caller holds the post's coordinates from having rendered it:
     * (channelWallet, channelEpochTag, entryId) plus the parent's channel overflow seq. post_uid folds the parent's
     * channel_pk (which uses channelShardSeq — NOT 0, or an overflow-shard post's thread would never be found),
     * then the THREAD shard for the current era. Comments are open to anyone who saw the post (gate 13702 folds
     * post_uid, not a wallet).
     *
     * LIVENESS FIRST: a post with no comments never deployed its thread shard, so a bare get_page would hit an
     * uninitialised account and throw exit -13. Check accountStates and return [] for the ordinary no-comments case.
     *
     * RETURNS { posts, cursors, hasMore, shardsSeen } — not a bare array, and both extra fields answer a question the
     * caller could not otherwise answer honestly:
     *
     *  * `cursors` / `hasMore` — HOW FAR BACK THIS READ GOT. get_page is capped at PS_PAGE_CAP = 96 rows by the
     *    contract and the window is anchored at the tail, so a busy post read back its newest 96 comments and the
     *    rest were on chain, paid for, and unreachable — MEASURED at 120 comments in tests/public-comment-window.
     *    Pass the returned cursors back as `olderThan` to read the page before them ("show earlier comments").
     *
     *  * `shardsSeen` — WHETHER THE THREAD EXISTS AT ALL. The caller used to infer "nobody has commented" from an
     *    empty result, which cannot tell an empty thread from a live one whose entries failed to decode. A shard
     *    that is live is proof somebody commented, whatever came back.
     */
    /**
     * `onProgress`, when given, is called with { posts, cursors, hasMore, shardsSeen } SO FAR after each live thread
     * shard — a thread's comments sit in one shard per 30-day era of its life, read newest era first, and a post a
     * year old has up to 14 of them behind one screen. Same contract as sweepChannelCatalog's: the return value is
     * ignored, a throw cannot stop the read, and the final return is the authoritative whole. [OWNER 2026-08-21:
     * "make comments load progressively, like the channel search and the feed."]
     */
    async readThreadComments(channelWallet, channelEpochTag, entryId, { channelShardSeq = 0, seqProbe = PUBLIC_SEQ_PROBE, olderThan = null, onProgress = null, generation = 17 } = {}) {
      const nowUnix = now();
      const channelPk = await publicChannelPartitionKey(publicWalletHash(channelWallet), channelShardSeq);
      // The PARENT's generation is part of its identity [round 5]: in the straddling era the gen-17 and gen-18
      // posts at the same (epoch_tag, seq, entry_id) are different posts, and folding the generation is what
      // gives them different threads instead of one shared pile of comments.
      const postUid = await publicPostUid(channelPk, channelEpochTag, entryId, generation);
      // ONE PARTITION KEY PER SEQ, because the WRITER rolls and this reader did not [audit 2026-09-02]. A thread
      // shard closes at PS_SAFE_CAP and the comment write moves to the next seq (resolvePublicWriteShardSeq,
      // PUBLIC_SEQ_PROBE deep) — while this function took a single `threadShardSeq` that defaulted to 0 and that
      // its only caller never passed. So past 4096 comments in an era every further comment landed on chain, was
      // paid for, and was read by nobody: the silent success this lane's own headers call the worst failure mode
      // it has. It needs no attacker — a popular post reaches it on its own.
      //
      // The channel reader has always probed seq 0..seqProbe-1 (and shard-discovery's notes already claimed THREAD
      // did too). Cost is a wider accountStates batch, which readAccountStates chunks, and nothing more: get_page
      // runs only for shards that come back ACTIVE, and for almost every post that is seq 0 alone.
      const threadPks = [];
      for (let seq = 0; seq < seqProbe; seq += 1) threadPks.push(await publicThreadPartitionKey(postUid, seq));
      // Comments land in the thread shard of their WRITE-time era, so over a post's ~1-year life they accumulate
      // ACROSS thread eras — reading only the current era silently dropped every earlier comment. Scan every thread
      // era from the post's era (extracted from its channel epoch_tag; channel and thread share the 30-day granularity)
      // up to now, in ONE accountStates batch, then get_page only the LIVE ones. Bounded against a hostile epoch_tag.
      const nowThreadEra = publicEraOf(PS_KIND_THREAD, nowUnix);
      const postEra = Number(BigInt(channelEpochTag) & 0xFFFFFFFFn);
      const startEra = Math.max(0, Math.min(postEra, nowThreadEra));
      const MAX_THREAD_ERAS = 14;   // ~1 year of 30-day eras + slack; the straddling era adds ONE extra address
      const coords = [];
      // WHERE EACH COMMENT LIVES rides with it [2026-09-04, CUTOVER item 15]: the thread shard's partition key,
      // epoch tag, seq and generation are what a report names and what a moderator opens — a comment row that
      // carried only its shard's address key could not be reported or hidden at all (audit, measured).
      const coordOf = new Map();
      for (let e = nowThreadEra, eras = 0; e >= startEra && eras < MAX_THREAD_ERAS; e -= 1, eras += 1) {
        // Era-expanded [CUTOVER.md item 3]: comments written on either side of the flip within the straddling
        // era sit in different generations' shards under the SAME era index — both are probed.
        for (const generation of publicEraGenerations(PS_KIND_THREAD, e)) {
          for (let seq = 0; seq < threadPks.length; seq += 1) {
            const threadPk = threadPks[seq];
            const epochTag = publicEpochTag(PS_KIND_THREAD, e);
            const address = rawAddress(await publicShardAddressBytesFor(generation, threadPk, epochTag));
            coords.push(address);
            coordOf.set(addrKey(address), { thread_pk: String(threadPk), thread_epoch_tag: String(epochTag), thread_seq: seq, thread_generation: generation });
          }
        }
      }
      const live = await readStates(coords);
      const posts = [];
      const cursors = {};
      // The hidden ids of thread shards that MOVED and this device already held: the caller applies them to the
      // comments it keeps below the window just read [round 3, the channel read's twin]. Carried beside the posts.
      const hidden = [];
      let shardsSeen = 0;
      // What the caller may paint NOW, after each shard: copies, so a consumer that keeps the arrays cannot see
      // them grow under its feet. hasMore is computed the same way the final answer computes it.
      const report = () => {
        if (typeof onProgress !== 'function') return;
        try {
          onProgress({
            posts: [...posts],
            cursors: { ...cursors },
            hasMore: Object.values(cursors).some((cursor) => Number(cursor.from) > 0),
            shardsSeen,
          });
        } catch { /* the caller's paint is not this read's problem — the remaining shards are the reader's comments */ }
      };
      for (const address of coords) {
        const state = live.get(addrKey(address));
        // ACTIVE, not merely present: readAccountStates reports touched-but-uninit accounts too (525 B, status
        // 'uninit'), and get_page on an uninit account throws exit -13 — a publicly-derivable touched address would
        // otherwise defeat a bare size check and break the read.
        if (!state || state.status !== 'active') continue;
        shardsSeen += 1;
        const key = addrKey(address);
        const marker = changeMarkerOf(state);
        // WHERE THIS SHARD'S WINDOW STARTS. Absent cursor = the newest page (readPosts anchors at the tail itself);
        // a cursor from a previous call = the page immediately BEFORE what has already been read. `from` reaching 0
        // means this shard is exhausted and asking again would re-read the same rows.
        const previous = olderThan?.[key];
        const paged = Number.isFinite(Number(previous?.from)) && Number(previous.from) > 0;
        if (previous && !paged) { cursors[key] = { from: 0, entryCount: Number(previous.entryCount ?? 0) }; report(); continue; }
        // The count is clamped as well as the start. Asking for a full page from a clamped start would re-read rows
        // the caller already holds — 72 of them in the 120-comment case, every time the button is pressed — and the
        // merge would hide it, so the waste would never show up as a bug.
        const pageStart = paged ? Math.max(0, Number(previous.from) - PAGE_ROWS) : 0;
        const pageRows = paged ? Number(previous.from) - pageStart : PAGE_ROWS;
        const fromId = paged ? BigInt(pageStart) : null;
        // The snapshot cache holds a shard's NEWEST window, so it may only answer the unpaged read. Serving it for a
        // paged one would hand back the newest rows under the guise of older ones.
        const snapshot = paged ? null : readShardSnapshot(key, marker);
        const heldBefore = peekShardSnapshot(key) !== null;   // this shard moved and this device holds its rows
        const where = coordOf.get(key) ?? {};
        if (snapshot) {
          // Older snapshots predate the stamps — served posts gain them here, since the shard is known at serve time.
          posts.push(...snapshot.posts.map((post) => (post.shard_key && post.thread_pk ? post : { ...post, ...where, shard_key: key })));
          cursors[key] = { from: snapshot.from, entryCount: snapshot.entryCount, oldestLt: snapshot.oldestLt ?? null };
          report();
          continue;
        }
        // THE BODIES MUST PAGE BACK WITH THE ROWS. get_page(fromId, …) returns older ROWS; the bodies come from
        // /messages, newest first, 128 at a time — so a paged read used to match rows 58..153 of a 250-comment
        // thread against the newest 128 bodies and find nothing: "show earlier comments" worked once (while the
        // rows still had bodies in that window) and then did nothing, with the button still showing (owner,
        // 2026-08-21). Each cursor now remembers the lt of the oldest body its window matched, and a paged read asks
        // /messages for the window ending just before it (toncenter `end_lt`, measured honoured). A cursor without an
        // lt (an endpoint that gave none) falls back to the newest window, which is the old behaviour, not a loss.
        const previousOldestLt = previous?.oldestLt == null ? null : (() => { try { return String(BigInt(previous.oldestLt) - 1n); } catch { return null; } })();
        // A cursor WITHOUT an lt used to fall back to the newest bodies window — honest for the page right behind
        // the tail, and the wrong END of the shard for a deep window. Synthesized cursors (the date-jump reader,
        // and the first-visit open that starts a thread at row 0) never have an lt, so their bodies are aimed by
        // the ROWS' OWN TIME instead (readPosts messagesByRowTime — the INTRO lane's ±600s technique).
        const { posts: shardPosts, entry_count: entryCount, oldestLt } = await readShardPosts(address, {
          ...(fromId === null ? {} : { fromId, maxCount: BigInt(pageRows) }),
          ...(paged && previousOldestLt !== null ? { messagesEndLt: previousOldestLt } : {}),
          ...(paged && previousOldestLt === null ? { messagesByRowTime: true } : {}),
        });
        const count = Number(entryCount ?? 0);
        const from = fromId === null ? Math.max(0, count - PAGE_ROWS) : Number(fromId);
        // Same gate as the sweep: a window whose bodies were DECLINED by the paced pump (a non-strict /messages
        // answers [] under a rate limit) must not be remembered as "no comments" until the marker moves.
        // The row's HOME SHARD rides each post: a reader's saved position must name where its row lives,
        // because entry_ids are 0-based per era shard and collide across them. Stamped BEFORE the snapshot write,
        // so the durable copy carries the stamp too.
        // ...and if this device held this shard before, ask which of its entries are hidden now: the rows it
        // holds below this window cannot learn it any other way.
        if (!paged && heldBefore && count > 0) {
          try {
            const map = await provider.getHiddenIds(address);
            hidden.push({ epochTag: where.thread_epoch_tag, seq: where.thread_seq, generation: where.thread_generation,
              entryCount: count, ids: [...map.hidden], complete: map.complete });
          } catch (error) {
            void error;   // the bits stay as held; the next move asks again
          }
        }
        const stampedPosts = shardPosts.map((post) => ({ ...post, ...where, shard_key: key }));
        if (!paged && (shardPosts.length > 0 || count === 0)) writeShardSnapshot(key, marker, { posts: stampedPosts, from, entryCount: count, oldestLt: oldestLt ?? null });
        posts.push(...stampedPosts);
        cursors[key] = { from, entryCount: count, oldestLt: oldestLt ?? null };
        report();
      }
      // hasMore asks the only question the button needs: is there a row BEFORE what we have read, anywhere in the
      // thread. A shard whose window already starts at 0 is exhausted and contributes nothing.
      const hasMore = Object.values(cursors).some((cursor) => Number(cursor.from) > 0);
      return { posts, cursors, hasMore, shardsSeen, hidden };
    },

    /**
     * The RAW avatar parts for a wallet: the message bodies of the wallet's live AVATAR shard, newest-first,
     * unassembled. Assembling them into image bytes and verifying sha256 against the PAID KeyShard pointer is the
     * media slice's job — this only fetches, because how N parts group was not yet measured (surface map §5.2).
     */
    // CUTOVER item 3 — CLOSED, and this note used to claim otherwise [corrected 2026-09-01, round 10]. It read
    // "a clean-18 client looks only at clean-18 addresses and a paid avatar published before the switch renders
    // BLANK", which stopped being true when the era sweeps were threaded: publicAvatarScanAddresses expands each
    // era through publicEraGenerations, so the era straddling E is probed in BOTH generations and every older era
    // in 17 alone. A stale comment asserting a live hole is the mirror of a stale comment asserting a live fix,
    // and this project has been burned by that shape — so it is stated as the code is, not as it once was.
    // The shape that made it dangerous still holds and is why the window is long: the two halves live apart. The
    // authenticated POINTER is in the owner's KeyShard, byte-identical across generations and untouched, while
    // these BYTES are entries in a PublicShard AVATAR shard whose address moves with the generation, and the
    // pointer carries no address, so nothing in it can lead here. PS_RETENTION_AVATAR is 94,608,000 — THREE
    // YEARS, the longest dual-read window in the generation — and re-obtaining an avatar costs 100 ATH.
    async readAvatarParts(ownerWallet, { eraWindow = PUBLIC_AVATAR_ERA_WINDOW } = {}) {
      const nowUnix = now();
      const hash = publicWalletHash(ownerWallet);
      const addresses = await publicAvatarScanAddresses(hash, nowUnix, eraWindow);   // newest AVATAR era first
      const live = await readStates(addresses);
      // AGGREGATE across live avatar shards in newest-first order, not "first in RPC Map order": a wallet that
      // (re)published its avatar in a different era than the newest keeps its current avatar in an OLDER shard, and
      // returning whichever shard the RPC listed first would lose it. The caller's sha256 == pointer.avatarHash match
      // then picks the authoritative set. ACTIVE-only for the same uninit/-13 reason as the thread read.
      const collected = [];
      let shard = null;
      for (const address of addresses) {
        const state = live.get(addrKey(address));
        if (!state || state.status !== 'active') continue;
        const messages = await readMessagesWithSource(state.address);
        if (messages.length > 0) {
          if (!shard) shard = state.address;
          collected.push(...messages);
        }
      }
      return { shard, messages: collected };
    },
  };
}
