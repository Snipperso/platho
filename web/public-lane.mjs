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
//   * RANKING BY entry_count, the mandatory fix, IS done here (sweepChannelCatalog reads get_view for the live
//     buckets and sorts by entry_count), never by last_transaction_lt — a bucket touched by a StateInit-less
//     value message moves lt without any gate firing, so lt-ranking is the beacon-firehose an attacker buys for a
//     forward fee.
//
// WHY ITS OWN MODULE rather than lines in app.js: app.js cannot be tested without a browser; here the whole lane
// runs against a stub transport and a fixed clock, the way the intro lane does.

import { createShardStatesRequest, createShardMessagesWithSourceReader } from './shard-rpc.mjs?v=15';
import { readAccountStates, changeMarkerOf } from './shard-reader.mjs?v=14';
import { createPublicShardTonRpcProvider } from './public-shard-ton-rpc-provider.mjs?v=4';
import { PUBLIC_PUBLISH_OPCODE } from './public-publish-browser.mjs?v=4';
import { publicShardAddressBytes, rawAddress } from './shard-address.mjs?v=7';
import {
  publicBeaconScanAddresses,
  publicAvatarScanAddresses,
  PUBLIC_SEQ_PROBE,
  publicWalletHash,
  publicChannelPartitionKey,
  publicThreadPartitionKey,
  publicPostUid,
  publicEpochTag,
  publicEraOf,
  addrKey,
} from './shard-discovery.mjs?v=16';

const PS_KIND_CHANNEL = 0;
const PS_KIND_THREAD = 1;

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
 * [OWNER 2026-08-04: "in the channel itself posts should honestly hang for a year".] Freshness in channel
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
  now = () => Math.floor(Date.now() / 1000),
} = {}) {
  if (typeof runGetMethod !== 'function') throw new Error('createPublicLane requires runGetMethod');

  const rpc = { endpoint, apiKey, fetch: fetchImpl ?? undefined };
  const statesRequest = createShardStatesRequest(rpc);
  // `opcode` keeps the 128-row window spent on real posts. A channel's shard address is publicly derivable
  // (partition key from the wallet + epoch tag), so anyone could send it 128 cheap messages and push every paid
  // post out of the newest-first window — the feed would show only the freshest posts, or nothing at all.
  const readMessagesWithSource = createShardMessagesWithSourceReader({ ...rpc, opcode: PUBLIC_PUBLISH_OPCODE });
  const provider = createPublicShardTonRpcProvider({ transport: { runGetMethod } });

  const readStates = (addresses) => readAccountStates(addresses, { request: statesRequest });

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
  const SHARD_SNAPSHOT_MAX = 256;                 // ~256 era-shards of comments; bounded so a long session cannot grow it
  const shardSnapshots = new Map();               // addrKey -> { marker, posts }

  function readShardSnapshot(key, marker) {
    const hit = shardSnapshots.get(key);
    if (!hit || hit.marker !== marker) return null;
    shardSnapshots.delete(key);                   // reinsert: Map keeps insertion order, so this is the LRU bump
    shardSnapshots.set(key, hit);
    return hit.posts;
  }

  function writeShardSnapshot(key, marker, posts) {
    shardSnapshots.delete(key);
    shardSnapshots.set(key, { marker, posts });
    while (shardSnapshots.size > SHARD_SNAPSHOT_MAX) {
      const oldest = shardSnapshots.keys().next();
      if (oldest.done) break;
      shardSnapshots.delete(oldest.value);
    }
  }
  /** posts of one shard, authenticated: get_page + /messages(+source) matched by commit. */
  // Reads the shard's NEWEST window (readPosts anchors at the tail and extends one page back when a multipart
  // post straddles the boundary). `entryCount` lets a caller that already read get_view skip the probe getter.
  const readShardPosts = (address, options = {}) => provider.readPosts(address, { readMessagesWithSource, ...options });

  return {
    /**
     * DISCOVERY. Sweep the beacon directory, keep only live buckets, rank them by entry_count (NOT lt), read the
     * top-K buckets' announcements, and return a deduped channel list — newest announcement per wallet.
     *
     * Returns [{ channelWallet, announcedAt, card }] where card is the beacon body cell (the client renders it,
     * but MUST treat its avatar_hash as advisory — the authoritative avatar pointer is the paid KeyShard one).
     */
    async sweepChannelCatalog({ eraWindow = 3, topBuckets = 16 } = {}) {
      const nowUnix = now();
      const addresses = await publicBeaconScanAddresses(nowUnix, eraWindow);
      const states = await readStates(addresses);
      if (states.size === 0) return [];

      // Rank LIVE buckets by entry_count. accountStates gives no entry_count, so read get_view for the live ones;
      // that is one getter per live bucket, and only live buckets exist in `states` (absent ones cost nothing).
      const live = [...states.values()];
      const ranked = [];
      for (const state of live) {
        try {
          const view = await provider.getView(state.address);
          ranked.push({ address: state.address, entryCount: view.entry_count });
        } catch { /* a bucket that will not answer get_view is skipped, not fatal */ }
      }
      ranked.sort((a, b) => (a.entryCount < b.entryCount ? 1 : a.entryCount > b.entryCount ? -1 : 0));

      const byWallet = new Map();
      for (const bucket of ranked.slice(0, topBuckets)) {
        // entryCount is already known from the ranking read above — hand it over so readPosts skips its own
        // entry_count probe and still anchors its window at the NEWEST announcements.
        const { posts } = await readShardPosts(bucket.address, { entryCount: bucket.entryCount });
        for (const post of posts) {
          if (!post.publisher) continue;
          const key = addrKey(post.publisher);
          const prev = byWallet.get(key);
          if (!prev || post.created_at > prev.announcedAt) {
            byWallet.set(key, { channelWallet: post.publisher, announcedAt: post.created_at, card: post.body });
          }
        }
      }
      return [...byWallet.values()];
    },

    /**
     * A channel's posts over the era window, authenticated and newest-first. `channelWallet` is the channel's
     * identity — a channel IS a wallet in clean-17. Returns { entry counts unused here } a flat post list.
     */
    async readChannelPosts(channelWallet, { eraWindow = PUBLIC_CHANNEL_ERA_WINDOW, seqProbe = PUBLIC_SEQ_PROBE } = {}) {
      const nowUnix = now();
      const hash = publicWalletHash(channelWallet);
      const era = publicEraOf(PS_KIND_CHANNEL, nowUnix);
      // Build (address, epochTag, seq) coordinates rather than a bare address list, so every post can be tagged with
      // the epoch_tag of the shard it lives in. A comment's thread shard is f(post_uid) and post_uid folds the
      // channel epoch_tag, so without this the reader could not derive where to read (or write) a post's comments.
      const coords = [];
      for (let e = era; e > era - eraWindow && e >= 0; e -= 1) {
        const epochTag = publicEpochTag(PS_KIND_CHANNEL, e);
        for (let seq = 0; seq < seqProbe; seq += 1) {
          const address = rawAddress(await publicShardAddressBytes(await publicChannelPartitionKey(hash, seq), epochTag));
          coords.push({ address, epochTag, seq });
        }
      }
      const live = await readStates(coords.map((c) => c.address));
      const posts = [];
      for (const coord of coords) {
        const state = live.get(addrKey(coord.address));
        if (!state) continue;
        // THE SAME MARKER GATE THE THREAD READ HAS USED ALL ALONG, and the reason the window above can span a year
        // at all: without it, every live shard of every past era would have its history re-read on every feed sync.
        // A CLOSED era cannot change — its shards are past the publish gate's +/-1 slack — so after one read they
        // cost exactly their row in the batched accountStates call above, forever.
        const key = addrKey(coord.address);
        const marker = changeMarkerOf(state);
        const snapshot = readShardSnapshot(key, marker);
        const shardPosts = snapshot ? snapshot.posts : (await readShardPosts(state.address)).posts;
        // ONE VALUE SHAPE for the shared snapshot cache. The thread read stores where its window starts alongside the
        // rows (it can page backwards); a channel read never pages, but it must write the same record or the two
        // would read each other's entries as the wrong type the first time their shard addresses ever met.
        if (!snapshot) writeShardSnapshot(key, marker, { posts: shardPosts, from: null, entryCount: null });
        for (const p of shardPosts) posts.push({ ...p, channelWallet, channelEpochTag: coord.epochTag, channelShardSeq: coord.seq });
      }
      posts.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
      return posts;
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
    async readPostAt(channelWallet, channelEpochTag, channelShardSeq, shardEntryId, { window = 16 } = {}) {
      const seq = Number(channelShardSeq) || 0;
      const epochTag = BigInt(channelEpochTag);
      const pk = await publicChannelPartitionKey(publicWalletHash(channelWallet), seq);
      const address = rawAddress(await publicShardAddressBytes(pk, epochTag));
      const live = await readStates([address]);
      const state = live.get(addrKey(address));
      // ACTIVE, not merely present: a publicly-derivable address can be touched into existence uninitialised, and
      // get_page on an uninit account throws exit -13 (the same trap the thread read documents).
      if (!state || state.status !== 'active') return [];
      const { posts } = await readShardPosts(state.address, {
        fromId: BigInt(shardEntryId), maxCount: BigInt(window),
      });
      return posts.map((post) => ({
        ...post, channelWallet, channelEpochTag: String(epochTag), channelShardSeq: seq,
      }));
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
    async readThreadComments(channelWallet, channelEpochTag, entryId, { channelShardSeq = 0, threadShardSeq = 0, olderThan = null } = {}) {
      const nowUnix = now();
      const channelPk = await publicChannelPartitionKey(publicWalletHash(channelWallet), channelShardSeq);
      const postUid = await publicPostUid(channelPk, channelEpochTag, entryId);
      const threadPk = await publicThreadPartitionKey(postUid, threadShardSeq);   // era-independent; only epoch_tag moves the address
      // Comments land in the thread shard of their WRITE-time era, so over a post's ~1-year life they accumulate
      // ACROSS thread eras — reading only the current era silently dropped every earlier comment. Scan every thread
      // era from the post's era (extracted from its channel epoch_tag; channel and thread share the 30-day granularity)
      // up to now, in ONE accountStates batch, then get_page only the LIVE ones. Bounded against a hostile epoch_tag.
      const nowThreadEra = publicEraOf(PS_KIND_THREAD, nowUnix);
      const postEra = Number(BigInt(channelEpochTag) & 0xFFFFFFFFn);
      const startEra = Math.max(0, Math.min(postEra, nowThreadEra));
      const MAX_THREAD_ERAS = 14;   // ~1 year of 30-day eras + slack
      const coords = [];
      for (let e = nowThreadEra; e >= startEra && coords.length < MAX_THREAD_ERAS; e -= 1) {
        coords.push(rawAddress(await publicShardAddressBytes(threadPk, publicEpochTag(PS_KIND_THREAD, e))));
      }
      const live = await readStates(coords);
      const posts = [];
      const cursors = {};
      let shardsSeen = 0;
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
        if (previous && !paged) { cursors[key] = { from: 0, entryCount: Number(previous.entryCount ?? 0) }; continue; }
        // The count is clamped as well as the start. Asking for a full page from a clamped start would re-read rows
        // the caller already holds — 72 of them in the 120-comment case, every time the button is pressed — and the
        // merge would hide it, so the waste would never show up as a bug.
        const pageStart = paged ? Math.max(0, Number(previous.from) - PAGE_ROWS) : 0;
        const pageRows = paged ? Number(previous.from) - pageStart : PAGE_ROWS;
        const fromId = paged ? BigInt(pageStart) : null;
        // The snapshot cache holds a shard's NEWEST window, so it may only answer the unpaged read. Serving it for a
        // paged one would hand back the newest rows under the guise of older ones.
        const snapshot = paged ? null : readShardSnapshot(key, marker);
        if (snapshot) {
          posts.push(...snapshot.posts);
          cursors[key] = { from: snapshot.from, entryCount: snapshot.entryCount };
          continue;
        }
        const { posts: shardPosts, entry_count: entryCount } = await readShardPosts(address, {
          ...(fromId === null ? {} : { fromId, maxCount: BigInt(pageRows) }),
        });
        const count = Number(entryCount ?? 0);
        const from = fromId === null ? Math.max(0, count - PAGE_ROWS) : Number(fromId);
        if (!paged) writeShardSnapshot(key, marker, { posts: shardPosts, from, entryCount: count });
        posts.push(...shardPosts);
        cursors[key] = { from, entryCount: count };
      }
      // hasMore asks the only question the button needs: is there a row BEFORE what we have read, anywhere in the
      // thread. A shard whose window already starts at 0 is exhausted and contributes nothing.
      const hasMore = Object.values(cursors).some((cursor) => Number(cursor.from) > 0);
      return { posts, cursors, hasMore, shardsSeen };
    },

    /**
     * The RAW avatar parts for a wallet: the message bodies of the wallet's live AVATAR shard, newest-first,
     * unassembled. Assembling them into image bytes and verifying sha256 against the PAID KeyShard pointer is the
     * media slice's job — this only fetches, because how N parts group was not yet measured (surface map §5.2).
     */
    async readAvatarParts(ownerWallet, { eraWindow = 3 } = {}) {
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
