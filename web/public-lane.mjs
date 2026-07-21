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

import { createShardStatesRequest, createShardMessagesWithSourceReader } from './shard-rpc.mjs?v=1';
import { readAccountStates } from './shard-reader.mjs?v=1';
import { createPublicShardTonRpcProvider } from './public-shard-ton-rpc-provider.mjs?v=1';
import { publicShardAddressBytes, rawAddress } from './shard-address.mjs?v=3';
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
} from './shard-discovery.mjs?v=3';

const PS_KIND_CHANNEL = 0;
const PS_KIND_THREAD = 1;

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
  const readMessagesWithSource = createShardMessagesWithSourceReader(rpc);
  const provider = createPublicShardTonRpcProvider({ transport: { runGetMethod } });

  const readStates = (addresses) => readAccountStates(addresses, { request: statesRequest });
  /** posts of one shard, authenticated: get_page + /messages(+source) matched by commit. */
  const readShardPosts = (address) => provider.readPosts(address, { readMessagesWithSource });

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
        const { posts } = await readShardPosts(bucket.address);
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
    async readChannelPosts(channelWallet, { eraWindow = 3, seqProbe = PUBLIC_SEQ_PROBE } = {}) {
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
        const { posts: shardPosts } = await readShardPosts(state.address);
        for (const p of shardPosts) posts.push({ ...p, channelWallet, channelEpochTag: coord.epochTag, channelShardSeq: coord.seq });
      }
      posts.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
      return posts;
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
     */
    async readThreadComments(channelWallet, channelEpochTag, entryId, { channelShardSeq = 0, threadShardSeq = 0 } = {}) {
      const nowUnix = now();
      const channelPk = await publicChannelPartitionKey(publicWalletHash(channelWallet), channelShardSeq);
      const postUid = await publicPostUid(channelPk, channelEpochTag, entryId);
      const threadPk = await publicThreadPartitionKey(postUid, threadShardSeq);
      const threadTag = publicEpochTag(PS_KIND_THREAD, publicEraOf(PS_KIND_THREAD, nowUnix));
      const address = rawAddress(await publicShardAddressBytes(threadPk, threadTag));
      const live = await readStates([address]);
      if (live.size === 0) return [];   // no thread shard = the post has no comments (the ordinary case)
      const { posts } = await readShardPosts(address);
      return posts;
    },

    /**
     * The RAW avatar parts for a wallet: the message bodies of the wallet's live AVATAR shard, newest-first,
     * unassembled. Assembling them into image bytes and verifying sha256 against the PAID KeyShard pointer is the
     * media slice's job — this only fetches, because how N parts group was not yet measured (surface map §5.2).
     */
    async readAvatarParts(ownerWallet, { eraWindow = 3 } = {}) {
      const nowUnix = now();
      const hash = publicWalletHash(ownerWallet);
      const addresses = await publicAvatarScanAddresses(hash, nowUnix, eraWindow);
      const live = await readStates(addresses);
      for (const [, state] of live) {
        const messages = await readMessagesWithSource(state.address);
        if (messages.length > 0) return { shard: state.address, messages };
      }
      return { shard: null, messages: [] };
    },
  };
}
