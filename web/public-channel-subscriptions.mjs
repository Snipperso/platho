export const PUBLIC_CHANNEL_SUBSCRIPTIONS_VERSION = 1;
export const PUBLIC_CHANNEL_SUBSCRIPTIONS_KEY = 'platho.publicSubscriptions.v1';
export const PUBLIC_CHANNEL_FEED_CACHE_KEY = 'platho.publicChannelFeeds.v1';

export const DEFAULT_PUBLIC_CHANNEL_ID = 'platho.app';

export const DEFAULT_PUBLIC_CHANNELS = Object.freeze([
  Object.freeze({
    id: DEFAULT_PUBLIC_CHANNEL_ID,
    name: 'platho.app',
    avatar: 'P',
    subtitle: 'official read-only channel',
    sourceUrl: './channels/platho.app/feed.json',
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
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function writePublicChannelFeedCache(storage, cache) {
  if (!storage?.setItem) return false;
  try {
    storage.setItem(PUBLIC_CHANNEL_FEED_CACHE_KEY, JSON.stringify(isObject(cache) ? cache : {}));
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
  if (!id || (!text && !imageUrl)) return null;
  return {
    id,
    entryId: nonEmptyString(post.entryId),
    readEntryId: nonEmptyString(post.readEntryId),
    title: nonEmptyString(post.title),
    text,
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
  if (!id || (!text && !imageUrl)) return null;
  return {
    id,
    entryId: nonEmptyString(comment.entryId),
    readEntryId: nonEmptyString(comment.readEntryId),
    parentEntryId: nonEmptyString(comment.parentEntryId),
    parentHash: nonEmptyString(comment.parentHash),
    text,
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
  };
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
    preview: latest?.title ?? latest?.text ?? (latest?.imageUrl ? 'Image' : 'Waiting for public feed'),
    messages: posts.map((post) => ({
      type: 'in',
      text: post.title ? `${post.title}\n${post.text}` : post.text,
      meta: [post.author ?? normalizedChannel.name, shortTime(post.createdAt), post.entryUid ? `uid ${post.entryUid.slice(0, 8)}` : null]
        .filter(Boolean)
        .join(' · '),
      publicPostId: post.id,
      publicPostTitle: post.title,
      publicPostText: post.text,
      publicPostImageUrl: post.imageUrl,
      publicAuthorWallet: post.authorWallet,
      publicProfileVersion: post.profileVersion,
      publicAvatarHash: post.avatarHash,
      publicAvatarImageUrl: post.avatarImageUrl,
      publicChannelId: normalizedChannel.id,
      publicEntryId: post.entryId,
      publicReadEntryId: post.readEntryId,
      publicBodyHash: post.bodyHash,
      publicCommentsAllowed: post.commentsAllowed !== false,
      publicComments: post.comments,
      attachment: post.imageUrl ? { type: 'image', url: post.imageUrl } : null,
    })),
  };
}

export function publicChannelSubscriptionsToThreads(subscriptions, registry = DEFAULT_PUBLIC_CHANNELS, feedCache = {}) {
  return subscribedPublicChannels(subscriptions, registry).map((channel) => {
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

export function publicChannelThreadsToFeedItems(threads) {
  const items = [];
  for (const thread of threads ?? []) {
    const messages = thread.messages ?? [];
    if (messages.length === 0) {
      items.push({
        id: thread.id,
        channelId: thread.publicChannelId,
        meta: [thread.name, thread.state, thread.time].filter(Boolean),
        title: thread.name,
        text: thread.preview,
        comments: [],
        compact: true,
      });
      continue;
    }
    for (const message of messages) {
      items.push({
        id: message.publicPostId,
        channelId: thread.publicChannelId,
        entryId: message.publicEntryId,
        readEntryId: message.publicReadEntryId,
        bodyHash: message.publicBodyHash,
        authorWallet: message.publicAuthorWallet,
        profileVersion: message.publicProfileVersion,
        avatarHash: message.publicAvatarHash,
        avatarImageUrl: message.publicAvatarImageUrl,
        commentsAllowed: message.publicCommentsAllowed !== false,
        meta: [
          thread.name,
          message.meta,
        ].filter(Boolean),
        title: message.publicPostTitle ?? thread.name,
        text: message.publicPostText ?? message.text ?? thread.preview,
        imageUrl: message.publicPostImageUrl ?? message.attachment?.url,
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
