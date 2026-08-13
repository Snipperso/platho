// The words this module puts on screen are PROSE, so they are translated here rather than shipped in English and
// hoped over. Importing the i18n engine into a data module is safe in both runtimes: it holds the active locale in
// a module variable, touches the DOM only inside try/catch, and falls back to English when initI18n never ran —
// which is exactly what the Node tests get, unchanged.
import { t, tPlural } from './i18n.mjs?v=68';
import { messagePreviewText } from './message-plain-text.mjs?v=1';

export const PUBLIC_CHANNEL_SUBSCRIPTIONS_VERSION = 1;
export const PUBLIC_CHANNEL_SUBSCRIPTIONS_KEY = 'platho.publicSubscriptions.v1';
export const PUBLIC_CHANNEL_FEED_CACHE_KEY = 'platho.publicChannelFeeds.v1';
// Per-author channel PROFILE cache (description + tags), keyed by the channel author's wallet address. Small text
// only (no media), so localStorage-safe. Populated opportunistically during the feed walk (profile posts are
// diverted from the visible feed and captured here) and on-demand by resolveChannelProfile for cold channels.
export const PUBLIC_CHANNEL_PROFILE_CACHE_KEY = 'platho.publicChannelProfiles.v1';

export const DEFAULT_PUBLIC_CHANNEL_ID = 'platho.app';
export const DEFAULT_PUBLIC_CHANNEL_AUTHOR_WALLET = 'UQDU48m_nYC12oqHJnKG9nBE4ljGpUYHHLPS-owij9BEOATH';

export const DEFAULT_PUBLIC_CHANNELS = Object.freeze([
  Object.freeze({
    id: DEFAULT_PUBLIC_CHANNEL_ID,
    name: 'platho',
    avatar: 'P',
    subtitle: 'official read-only channel',
    authorWallet: DEFAULT_PUBLIC_CHANNEL_AUTHOR_WALLET,
  }),
]);

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function safeClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeRegistryChannel(channel) {
  if (!isObject(channel)) return null;
  const id = nonEmptyString(channel.id);
  const sourceUrl = nonEmptyString(channel.sourceUrl);
  const authorWallet = nonEmptyString(channel.authorWallet ?? channel.author_wallet);
  if (!id || (!sourceUrl && !authorWallet)) return null;
  return {
    id,
    name: nonEmptyString(channel.name) ?? id,
    avatar: (nonEmptyString(channel.avatar) ?? id.slice(0, 1) ?? 'P').slice(0, 2).toUpperCase(),
    subtitle: nonEmptyString(channel.subtitle) ?? 'read-only public channel',
    sourceUrl,
    authorWallet,
  };
}

export function normalizePublicChannelRegistry(registry = DEFAULT_PUBLIC_CHANNELS) {
  const channels = [];
  const seen = new Set();
  for (const item of registry ?? []) {
    const channel = normalizeRegistryChannel(item);
    if (!channel || seen.has(channel.id)) continue;
    seen.add(channel.id);
    channels.push(channel);
  }
  return channels.length > 0 ? channels : DEFAULT_PUBLIC_CHANNELS.map((item) => ({ ...item }));
}

export function createDefaultPublicChannelSubscriptions(registry = DEFAULT_PUBLIC_CHANNELS) {
  const channels = normalizePublicChannelRegistry(registry).map((channel) => ({
    id: channel.id,
    subscribed: channel.id === DEFAULT_PUBLIC_CHANNEL_ID,
  }));
  const activeChannelId = channels.find((channel) => channel.subscribed)?.id ?? channels[0]?.id ?? DEFAULT_PUBLIC_CHANNEL_ID;
  return {
    version: PUBLIC_CHANNEL_SUBSCRIPTIONS_VERSION,
    activeChannelId,
    channels,
  };
}

export function normalizePublicChannelSubscriptions(value, registry = DEFAULT_PUBLIC_CHANNELS) {
  const defaults = createDefaultPublicChannelSubscriptions(registry);
  if (!isObject(value) || value.version !== PUBLIC_CHANNEL_SUBSCRIPTIONS_VERSION) return defaults;

  const storedById = new Map();
  for (const item of Array.isArray(value.channels) ? value.channels : []) {
    if (!isObject(item)) continue;
    const id = nonEmptyString(item.id);
    if (!id) continue;
    storedById.set(id, {
      id,
      subscribed: item.subscribed === true,
    });
  }

  const channels = normalizePublicChannelRegistry(registry).map((channel) => {
    const stored = storedById.get(channel.id);
    return {
      id: channel.id,
      subscribed: stored ? stored.subscribed : channel.id === DEFAULT_PUBLIC_CHANNEL_ID,
    };
  });

  const activeCandidate = nonEmptyString(value.activeChannelId);
  const activeChannelId = channels.some((channel) => channel.id === activeCandidate && channel.subscribed)
    ? activeCandidate
    : channels.find((channel) => channel.subscribed)?.id ?? defaults.activeChannelId;

  return {
    version: PUBLIC_CHANNEL_SUBSCRIPTIONS_VERSION,
    activeChannelId,
    channels,
  };
}

export function subscribedPublicChannels(subscriptions, registry = DEFAULT_PUBLIC_CHANNELS) {
  const normalized = normalizePublicChannelSubscriptions(subscriptions, registry);
  const registryById = new Map(normalizePublicChannelRegistry(registry).map((channel) => [channel.id, channel]));
  return normalized.channels
    .filter((channel) => channel.subscribed)
    .map((channel) => registryById.get(channel.id))
    .filter(Boolean);
}

export function readPublicChannelSubscriptions(storage, registry = DEFAULT_PUBLIC_CHANNELS) {
  if (!storage?.getItem) return createDefaultPublicChannelSubscriptions(registry);
  try {
    return normalizePublicChannelSubscriptions(JSON.parse(storage.getItem(PUBLIC_CHANNEL_SUBSCRIPTIONS_KEY) ?? 'null'), registry);
  } catch {
    return createDefaultPublicChannelSubscriptions(registry);
  }
}

export function writePublicChannelSubscriptions(storage, subscriptions) {
  if (!storage?.setItem) return false;
  try {
    storage.setItem(PUBLIC_CHANNEL_SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions));
    return true;
  } catch {
    return false;
  }
}

export function readPublicChannelFeedCache(storage) {
  if (!storage?.getItem) return {};
  try {
    const parsed = JSON.parse(storage.getItem(PUBLIC_CHANNEL_FEED_CACHE_KEY) ?? '{}');
    return isObject(parsed) ? stripStoredPublicFeedVerification(parsed) : {};
  } catch {
    return {};
  }
}

// Heavy base64 media (post/avatar image data URLs + image-block urls) must NEVER be persisted to localStorage.
// On iOS WebKit a large localStorage store makes EVERY synchronous setItem re-serialize the WHOLE store, so a
// feed cache bloated with image data URLs turned the Vault tab's handful of crumb/state setItems into a
// multi-second main-thread freeze — engine/storage-bound, so it froze even on an iPhone 16 Pro Max and only
// on WebKit (Blink/V8 do not re-serialize the whole store per write). The media re-derives from the chain on
// the next sync; only the light text/metadata is cached. (Private message history is in IndexedDB, unaffected.)
function omitHeavyFeedMediaForPersist(key, value) {
  if (key === 'imageUrl' || key === 'avatarImageUrl' || key === 'url') return undefined;
  // A retained signed external (publicDirectSend.boc) is kept for the idempotent re-broadcast of an ambiguous
  // publish, and it stays IN MEMORY ONLY. It can run to tens of KB for a media post, and this whole cache is one
  // localStorage value whose write FAILS SILENTLY on quota — so persisting it would trade an unconfirmed post for
  // the loss of the entire cached feed. The re-broadcast therefore covers the case it can (focus/visibility while
  // the tab lives, which is exactly when a 200-without-delivery surfaces); after a reload the record falls back to
  // the no-progress deadline terminal, as before.
  if (key === 'boc') return undefined;
  return value;
}

export function writePublicChannelFeedCache(storage, cache) {
  if (!storage?.setItem) return false;
  try {
    storage.setItem(PUBLIC_CHANNEL_FEED_CACHE_KEY, JSON.stringify(isObject(cache) ? cache : {}, omitHeavyFeedMediaForPersist));
    return true;
  } catch {
    return false;
  }
}

function normalizeFeedPost(post) {
  if (!isObject(post)) return null;
  const id = nonEmptyString(post.id);
  const text = nonEmptyString(post.text) ?? '';
  const imageUrl = nonEmptyString(post.imageUrl);
  const blocks = normalizeFeedBlocks(post.blocks);
  if (!id || (!text && !imageUrl && blocks.length === 0)) return null;
  return {
    id,
    entryId: nonEmptyString(post.entryId),
    readEntryId: nonEmptyString(post.readEntryId),
    title: nonEmptyString(post.title),
    text,
    blocks,
    imageUrl,
    createdAt: nonEmptyString(post.createdAt),
    author: nonEmptyString(post.author),
    authorWallet: nonEmptyString(post.authorWallet ?? post.author_wallet),
    profileVersion: Number.isSafeInteger(Number(post.profileVersion ?? post.profile_version))
      ? Number(post.profileVersion ?? post.profile_version)
      : 0,
    avatarHash: nonEmptyString(post.avatarHash ?? post.avatar_hash),
    avatarImageUrl: nonEmptyString(post.avatarImageUrl ?? post.avatar_image_url),
    bodyHash: nonEmptyString(post.bodyHash),
    entryUid: nonEmptyString(post.entryUid),
    chainVerified: post.chainVerified === true,
    publishStatus: nonEmptyString(post.publishStatus),
    publishState: isObject(post.publishState) ? safeClone(post.publishState) : null,
    commentsAllowed: post.commentsAllowed !== false,
    comments: (Array.isArray(post.comments) ? post.comments : [])
      .map(normalizeFeedComment)
      .filter(Boolean),
  };
}

function normalizeFeedComment(comment) {
  if (!isObject(comment)) return null;
  const id = nonEmptyString(comment.id);
  const text = nonEmptyString(comment.text) ?? '';
  const imageUrl = nonEmptyString(comment.imageUrl);
  const blocks = normalizeFeedBlocks(comment.blocks);
  if (!id || (!text && !imageUrl && blocks.length === 0)) return null;
  return {
    id,
    entryId: nonEmptyString(comment.entryId),
    readEntryId: nonEmptyString(comment.readEntryId),
    parentEntryId: nonEmptyString(comment.parentEntryId),
    parentHash: nonEmptyString(comment.parentHash),
    text,
    blocks,
    imageUrl,
    createdAt: nonEmptyString(comment.createdAt),
    author: nonEmptyString(comment.author),
    authorWallet: nonEmptyString(comment.authorWallet ?? comment.author_wallet),
    profileVersion: Number.isSafeInteger(Number(comment.profileVersion ?? comment.profile_version))
      ? Number(comment.profileVersion ?? comment.profile_version)
      : 0,
    avatarHash: nonEmptyString(comment.avatarHash ?? comment.avatar_hash),
    avatarImageUrl: nonEmptyString(comment.avatarImageUrl ?? comment.avatar_image_url),
    bodyHash: nonEmptyString(comment.bodyHash),
    entryUid: nonEmptyString(comment.entryUid),
    chainVerified: comment.chainVerified === true,
    publishStatus: nonEmptyString(comment.publishStatus),
    publishState: isObject(comment.publishState) ? safeClone(comment.publishState) : null,
  };
}

function normalizeFeedBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((block) => {
    if (!isObject(block)) return null;
    if (block.type === 'text') {
      const text = nonEmptyString(block.text);
      return text ? { type: 'text', text } : null;
    }
    if (block.type === 'image') {
      const url = nonEmptyString(block.url);
      return url ? { type: 'image', url } : null;
    }
    // Reply quote (v646): small strings, safe for localStorage — keep it so a quoted comment's strip survives a
    // reload (and a comment whose only surviving block is the quote isn't dropped as empty).
    if (block.type === 'reply') {
      const refEntryId = nonEmptyString(String(block.refEntryId ?? ''));
      return refEntryId
        ? { type: 'reply', refEntryId, author: String(block.author ?? ''), snippet: String(block.snippet ?? '') }
        : null;
    }
    // Shared public post (v766): all-string snapshot, localStorage-safe like the reply quote — keeps the embed
    // across reloads (and a share-only post isn't dropped as empty).
    if (block.type === 'share') {
      const entryId = nonEmptyString(String(block.entryId ?? ''));
      const authorWallet = nonEmptyString(block.authorWallet);
      return entryId && authorWallet
        ? {
          type: 'share',
          entryId,
          bodyHash: String(block.bodyHash ?? ''),
          authorWallet,
          author: String(block.author ?? ''),
          title: String(block.title ?? ''),
          snippet: String(block.snippet ?? ''),
          hasImage: block.hasImage === true,
          textTruncated: block.textTruncated === true,
        }
        : null;
    }
    return null;
  }).filter(Boolean);
}

// The first TEXT block, verbatim — this feeds the rendered article body as well as the card, so the formatting
// markers must survive here (the renderer parses them). Stripping happens at the PREVIEW call site, which is the
// only reader that wants words without their grammar.
function feedBlocksPreview(blocks) {
  const text = (blocks ?? []).find((block) => block?.type === 'text' && nonEmptyString(block.text))?.text;
  if (text) return text;
  const imageCount = (blocks ?? []).filter((block) => block?.type === 'image').length;
  if (imageCount > 0) return tPlural('chat.previewImages', imageCount);
  if ((blocks ?? []).some((block) => block?.type === 'share')) return t('chat.previewSharedPost');
  return null;
}

/** The one line a channel card shows: a title, else the first text, else a media word — never raw markup. */
function publicChannelPreviewLine(latest) {
  const title = nonEmptyString(latest?.title);
  if (title) return messagePreviewText(title);
  const fromBlocks = feedBlocksPreview(latest?.blocks);
  if (fromBlocks) return messagePreviewText(fromBlocks);
  const text = nonEmptyString(latest?.text);
  if (text) return messagePreviewText(text);
  return latest?.imageUrl ? t('chat.previewImage') : t('public.previewWaitingFeed');
}

function stripStoredPublicFeedVerification(cache) {
  const cloned = safeClone(cache);
  for (const record of Object.values(cloned)) {
    const feed = record?.feed ?? record;
    if (!Array.isArray(feed?.posts)) continue;
    for (const post of feed.posts) {
      post.chainVerified = false;
      if (!Array.isArray(post.comments)) continue;
      for (const comment of post.comments) comment.chainVerified = false;
    }
  }
  return cloned;
}

export function normalizePublicChannelFeed(value, expectedChannelId) {
  if (!isObject(value) || value.version !== 1) throw new Error('Unsupported public channel feed version');
  const channelId = nonEmptyString(value.channelId);
  if (!channelId) throw new Error('Public channel feed must include channelId');
  if (expectedChannelId && channelId !== expectedChannelId) {
    throw new Error('Public channel feed channel mismatch');
  }
  const posts = (Array.isArray(value.posts) ? value.posts : [])
    .map(normalizeFeedPost)
    .filter(Boolean);
  return {
    version: 1,
    channelId,
    updatedAt: nonEmptyString(value.updatedAt),
    posts,
  };
}

export function publicChannelThreadId(channelId) {
  return `public:${channelId}`;
}

function shortTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function publicChannelFeedToThread(channel, feed) {
  const normalizedChannel = normalizeRegistryChannel(channel);
  if (!normalizedChannel) throw new Error('Invalid public channel');
  const posts = feed?.posts ?? [];
  const latest = posts[posts.length - 1] ?? null;
  return {
    id: publicChannelThreadId(normalizedChannel.id),
    publicChannelId: normalizedChannel.id,
    publicChannelAuthorWallet: normalizedChannel.authorWallet,
    readOnly: true,
    name: normalizedChannel.name,
    avatar: normalizedChannel.avatar,
    avatarImageUrl: latest?.avatarImageUrl,
    subtitle: normalizedChannel.subtitle,
    time: shortTime(latest?.createdAt) ?? 'public',
    state: posts.length > 0 ? 'channel' : 'syncing',
    preview: publicChannelPreviewLine(latest),
    messages: posts.map((post) => ({
      type: 'in',
      text: post.title ? `${post.title}\n${post.text}` : (feedBlocksPreview(post.blocks) ?? post.text),
      blocks: post.blocks,
      // The author/channel name is shown once by the feed item (thread.name); keep only the DATE here so a wallet
      // post does not repeat the name. publishStatus is intentionally NOT included: buildPublicFeedArticle renders it
      // as a separate LIVE .public-publish-status badge (updated in place, retry-wired) — putting it here too printed
      // the status TWICE (a static stale copy in the meta line + the live badge). The technical entry uid was dropped.
      meta: shortTime(post.createdAt) ?? '',
      publicPostId: post.id,
      publicPostTitle: post.title,
      publicPostText: post.text,
      publicPostBlocks: post.blocks,
      publicPostImageUrl: post.imageUrl,
      publicAuthorWallet: post.authorWallet,
      publicProfileVersion: post.profileVersion,
      publicAvatarHash: post.avatarHash,
      publicAvatarImageUrl: post.avatarImageUrl,
      publicChannelId: normalizedChannel.id,
      publicEntryId: post.entryId,
      publicReadEntryId: post.readEntryId,
      publicBodyHash: post.bodyHash,
      publicChainVerified: post.chainVerified === true,
      publicPublishStatus: post.publishStatus,
      publicPublishState: post.publishState,
      publicCommentsAllowed: post.commentsAllowed !== false,
      publicComments: post.comments,
      attachment: post.blocks?.length ? null : (post.imageUrl ? { type: 'image', url: post.imageUrl } : null),
    })),
  };
}

// Build feed threads from an EXPLICIT channel list (the feed source may be the subscribed set UNIONED with
// the user's own wallet channel, so own posts show without auto-subscribing — see feedSourcePublicChannels).
export function publicChannelsToThreads(channels, feedCache = {}) {
  return (channels ?? []).map((channel) => {
    let feed = null;
    try {
      const cached = feedCache?.[channel.id]?.feed ?? feedCache?.[channel.id] ?? null;
      feed = cached ? normalizePublicChannelFeed(cached, channel.id) : null;
    } catch {
      feed = null;
    }
    return publicChannelFeedToThread(channel, feed);
  });
}

export function publicChannelSubscriptionsToThreads(subscriptions, registry = DEFAULT_PUBLIC_CHANNELS, feedCache = {}) {
  return publicChannelsToThreads(subscribedPublicChannels(subscriptions, registry), feedCache);
}

export function publicChannelThreadsToFeedItems(threads) {
  const items = [];
  for (const thread of threads ?? []) {
    const messages = thread.messages ?? [];
    // [OWNER 2026-08-09] A followed channel with NO posts contributes nothing to the feed. It used to render a
    // placeholder card reading "waiting for public feed", which is a row that says nothing, cannot be opened and
    // cannot be commented on — an empty seat held for a channel that may never publish.
    //
    // The SUBSCRIPTION is untouched: it lives in publicChannelSubscriptions, not here, so the channel stays
    // followed, keeps its place in the registry, and starts appearing the moment it has a post. Unfollowing it
    // meanwhile is still possible from the channel's own view, which carries its own follow toggle.
    if (messages.length === 0) continue;
    for (const message of messages) {
      items.push({
        id: message.publicPostId,
        channelId: thread.publicChannelId,
        entryId: message.publicEntryId,
        readEntryId: message.publicReadEntryId,
        bodyHash: message.publicBodyHash,
        chainVerified: message.publicChainVerified === true,
        publishStatus: message.publicPublishStatus,
        publishState: message.publicPublishState,
        authorWallet: message.publicAuthorWallet,
        profileVersion: message.publicProfileVersion,
        avatarHash: message.publicAvatarHash,
        avatarImageUrl: message.publicAvatarImageUrl,
        commentsAllowed: message.publicCommentsAllowed !== false,
        meta: [
          thread.name,
          message.meta,
        ].filter(Boolean),
        // Only a real post title; do NOT fall back to the channel name (it is already the meta author).
        title: message.publicPostTitle ?? null,
        text: feedBlocksPreview(message.publicPostBlocks) ?? message.publicPostText ?? message.text ?? thread.preview,
        blocks: message.publicPostBlocks,
        imageUrl: message.publicPostBlocks?.length ? null : (message.publicPostImageUrl ?? message.attachment?.url),
        comments: message.publicComments ?? [],
        compact: false,
      });
    }
  }
  return items.reverse();
}

export function clonePublicChannelSubscriptions(value) {
  return safeClone(value);
}

// A cached channel profile: description (may be empty = explicitly cleared) + normalized tags, plus the source
// entryId/createdAt for latest-wins reconciliation and a fetchedAt so a cached empty ("no description yet") is
// distinguishable from "never fetched". Returns null only for non-objects.
export function normalizeChannelProfile(value) {
  if (!isObject(value)) return null;
  const description = typeof value.description === 'string' ? value.description : '';
  const tags = (Array.isArray(value.tags) ? value.tags : [])
    .map((tag) => nonEmptyString(tag))
    .filter(Boolean)
    .slice(0, 32);
  const toInt = (n) => (Number.isSafeInteger(Number(n)) ? Number(n) : 0);
  return {
    description,
    tags,
    entryId: nonEmptyString(String(value.entryId ?? '')),
    createdAtSec: toInt(value.createdAtSec ?? value.created_at_sec),
    fetchedAt: toInt(value.fetchedAt),
    // ownerUsername = the self-declared .ath CLAIM from the profile block (never displayed on its own).
    // verifiedUsername = the claim AFTER on-chain registry proof (owner == author wallet) — the only one shown.
    ownerUsername: typeof value.ownerUsername === 'string' ? value.ownerUsername : '',
    verifiedUsername: typeof value.verifiedUsername === 'string' ? value.verifiedUsername : '',
  };
}

export function readPublicChannelProfileCache(storage) {
  if (!storage?.getItem) return {};
  try {
    const parsed = JSON.parse(storage.getItem(PUBLIC_CHANNEL_PROFILE_CACHE_KEY) ?? '{}');
    if (!isObject(parsed)) return {};
    const out = {};
    for (const [wallet, profile] of Object.entries(parsed)) {
      const normalized = normalizeChannelProfile(profile);
      if (normalized) out[wallet] = normalized;
    }
    return out;
  } catch {
    return {};
  }
}

export function writePublicChannelProfileCache(storage, cache) {
  if (!storage?.setItem) return false;
  try {
    storage.setItem(PUBLIC_CHANNEL_PROFILE_CACHE_KEY, JSON.stringify(isObject(cache) ? cache : {}));
    return true;
  } catch {
    return false;
  }
}

// Phase 3 public eviction floor (pure, BigInt). clean-10 public eviction is strictly bottom-FIFO and gapless, and
// entryIds are 0-INDEXED while public_latest_id is the NEXT id (highest live id = latest - 1; total ever = latest).
// So the live id range is [latest - live_count, latest - 1] and the oldest-live id (the floor) is EXACTLY
// latest - live_count (= the contract's public_oldest_live_id). live_count 0 → nothing live (floor = latest).
export function publicEvictionFloor(latestId, liveCount) {
  const latest = BigInt(latestId ?? 0n);
  const live = BigInt(liveCount ?? 0n);
  return live > 0n ? (latest - live) : latest;
}

// Drop cache posts/comments evicted on-chain (entryId STRICTLY below the FIFO floor). A post below the floor is
// evicted → dropped with its comments; a live post keeps only its still-live comments. A local-pending post
// (non-numeric/absent entryId) is NOT on-chain → never pruned. floor <= 0 → nothing evicted → returned unchanged.
export function prunePublicPostsBelowFloor(posts, floor) {
  if (!(floor > 0n)) return posts;
  const kept = [];
  for (const post of posts ?? []) {
    let id = null;
    try { id = post?.entryId === undefined || post?.entryId === null ? null : BigInt(post.entryId); } catch { id = null; }
    if (id !== null && id < floor) continue;
    const comments = post.comments ?? [];
    const liveComments = comments.filter((comment) => {
      try { return comment?.entryId === undefined || comment?.entryId === null ? true : BigInt(comment.entryId) >= floor; } catch { return true; }
    });
    kept.push(liveComments.length === comments.length ? post : { ...post, comments: liveComments });
  }
  return kept;
}
