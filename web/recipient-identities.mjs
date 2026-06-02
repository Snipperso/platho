export const RECIPIENT_IDENTITY_TYPES = Object.freeze({
  WALLET_ADDRESS: 'wallet_address',
  TON_DNS: 'ton_dns',
  PLATHO_NFT: 'platho_nft',
});

export const RECIPIENT_IDENTITY_META = Object.freeze({
  [RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS]: Object.freeze({
    label: 'Wallet address',
    tone: 'wallet',
  }),
  [RECIPIENT_IDENTITY_TYPES.TON_DNS]: Object.freeze({
    label: 'TON DNS',
    tone: 'ton',
  }),
  [RECIPIENT_IDENTITY_TYPES.PLATHO_NFT]: Object.freeze({
    label: 'Platho NFT',
    tone: 'platho',
  }),
});

const FRIENDLY_TON_ADDRESS_RE = /^[A-Za-z0-9_-]{48}$/;
const RAW_TON_ADDRESS_RE = /^-?\d+:[0-9a-fA-F]{64}$/;
const TON_DNS_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+ton$/;
const PLATHO_NFT_RE = /^[a-z0-9_-]{4,16}\.ath$/;

function normalizeInput(value) {
  return String(value ?? '').trim();
}

function normalizeName(value) {
  return normalizeInput(value).toLowerCase();
}

function isWalletAddress(value) {
  return FRIENDLY_TON_ADDRESS_RE.test(value) || RAW_TON_ADDRESS_RE.test(value);
}

function isTonDns(value) {
  return TON_DNS_RE.test(value);
}

function isPlathoNft(value) {
  return PLATHO_NFT_RE.test(value);
}

function avatarFromLabel(label) {
  const first = String(label ?? '').replace(/^@/, '').slice(0, 1).toUpperCase();
  return first || 'P';
}

export function parseRecipientIdentity(input) {
  const raw = normalizeInput(input);
  if (!raw) {
    return { ok: false, error: 'Enter a wallet address, .ton, or .ath name.' };
  }

  if (raw.startsWith('@')) {
    return { ok: false, error: 'Use a full suffix: xxxx.ton or xxxx.ath.' };
  }

  if (isWalletAddress(raw)) {
    return {
      ok: true,
      identity: {
        type: RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS,
        value: raw,
        label: raw,
        entered: raw,
      },
    };
  }

  const normalized = normalizeName(raw);
  if (isTonDns(normalized)) {
    return {
      ok: true,
      identity: {
        type: RECIPIENT_IDENTITY_TYPES.TON_DNS,
        value: normalized,
        label: normalized,
        entered: raw,
      },
    };
  }

  if (isPlathoNft(normalized)) {
    return {
      ok: true,
      identity: {
        type: RECIPIENT_IDENTITY_TYPES.PLATHO_NFT,
        value: normalized,
        label: normalized,
        entered: raw,
      },
    };
  }

  if (/\.platho$/i.test(raw)) {
    return { ok: false, error: 'Use .ath for Platho NFT names.' };
  }

  return { ok: false, error: 'Use a full wallet address, xxxx.ton, or xxxx.ath.' };
}

export function identityTone(identity) {
  return RECIPIENT_IDENTITY_META[identity?.type]?.tone ?? 'wallet';
}

export function identityTypeLabel(identity) {
  return RECIPIENT_IDENTITY_META[identity?.type]?.label ?? 'Wallet address';
}

export function normalizeRecipientIdentity(input) {
  if (!input) return null;
  if (typeof input === 'string') {
    const parsed = parseRecipientIdentity(input);
    return parsed.ok ? parsed.identity : null;
  }

  const raw = normalizeInput(input.value ?? input.label ?? input.entered);
  if (!raw) return null;

  if (input.type === RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS && isWalletAddress(raw)) {
    return {
      type: RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS,
      value: raw,
      label: input.label ?? raw,
      entered: input.entered ?? raw,
    };
  }

  const normalized = normalizeName(raw);
  if (input.type === RECIPIENT_IDENTITY_TYPES.TON_DNS && isTonDns(normalized)) {
    return {
      type: RECIPIENT_IDENTITY_TYPES.TON_DNS,
      value: normalized,
      label: input.label ?? normalized,
      entered: input.entered ?? raw,
    };
  }

  if (input.type === RECIPIENT_IDENTITY_TYPES.PLATHO_NFT && isPlathoNft(normalized)) {
    return {
      type: RECIPIENT_IDENTITY_TYPES.PLATHO_NFT,
      value: normalized,
      label: input.label ?? normalized,
      entered: input.entered ?? raw,
    };
  }

  const parsed = parseRecipientIdentity(raw);
  return parsed.ok ? parsed.identity : null;
}

export function identityKey(identity) {
  const normalized = normalizeRecipientIdentity(identity);
  return normalized ? `${normalized.type}:${normalized.value}` : null;
}

export function normalizeIdentityVariants(items) {
  const variants = [];
  const seen = new Set();
  for (const item of items ?? []) {
    const identity = normalizeRecipientIdentity(item);
    const key = identityKey(identity);
    if (!identity || !key || seen.has(key)) continue;
    seen.add(key);
    variants.push(identity);
  }
  return variants;
}

export function preferredInboundIdentity(items) {
  const variants = normalizeIdentityVariants(items);
  for (const type of [
    RECIPIENT_IDENTITY_TYPES.PLATHO_NFT,
    RECIPIENT_IDENTITY_TYPES.TON_DNS,
    RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS,
  ]) {
    const identity = variants.find((item) => item.type === type);
    if (identity) return identity;
  }
  return variants[0] ?? null;
}

export function recipientThreadId(identity) {
  return `dm:${identity.type}:${encodeURIComponent(identity.value)}`;
}

export function createRecipientThread(input, options = {}) {
  const parsed = parseRecipientIdentity(input);
  if (!parsed.ok) return parsed;
  const { identity } = parsed;
  const localLabel = normalizeInput(options.localLabel);
  const name = localLabel || identity.label;
  return {
    ok: true,
    thread: {
      id: recipientThreadId(identity),
      name,
      avatar: avatarFromLabel(name),
      subtitle: localLabel ? `${identityTypeLabel(identity)} - ${identity.label}` : identityTypeLabel(identity),
      localLabel,
      time: options.time ?? 'new',
      state: options.state ?? 'route',
      preview: options.preview ?? 'No messages yet',
      identity,
      identityVariants: [identity],
      messages: [],
    },
  };
}

export function recipientIdentityFromThreadId(threadId) {
  const match = /^dm:([^:]+):(.+)$/.exec(String(threadId ?? ''));
  if (!match) return null;
  const [, type, encodedValue] = match;
  let value = null;
  try {
    value = decodeURIComponent(encodedValue);
  } catch {
    return null;
  }
  if (!Object.values(RECIPIENT_IDENTITY_TYPES).includes(type)) return null;
  return {
    type,
    value,
    label: value,
    entered: value,
  };
}

function shortPeerId(value) {
  return String(value ?? '').replace(/[^a-z0-9_-]/gi, '').slice(0, 8) || 'unknown';
}

export function createInboundPeerThread(input = {}, options = {}) {
  const variants = normalizeIdentityVariants([
    input.identity,
    ...(input.identityVariants ?? []),
    input.label,
    input.ownerWallet
      ? { type: RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS, value: input.ownerWallet, label: input.ownerWallet }
      : null,
  ]);
  const identity = preferredInboundIdentity(variants);
  const label = identity?.label ?? input.label ?? `peer ${shortPeerId(input.senderKeyId ?? input.keyId)}`;
  return {
    id: identity ? recipientThreadId(identity) : `peer:${encodeURIComponent(shortPeerId(input.senderKeyId ?? input.keyId))}`,
    name: label,
    avatar: avatarFromLabel(label),
    subtitle: identity ? identityTypeLabel(identity) : 'Peer',
    time: options.time ?? 'now',
    state: options.state ?? 'sealed',
    preview: options.preview ?? 'No messages yet',
    identity,
    identityVariants: variants,
    messages: [],
  };
}

export function primaryThreadIdentity(thread) {
  const displayIdentity = normalizeRecipientIdentity(thread?.displayIdentity);
  if (displayIdentity) return displayIdentity;
  const identity = normalizeRecipientIdentity(thread?.identity);
  if (identity) return identity;
  const fromId = recipientIdentityFromThreadId(thread?.id);
  if (fromId) return fromId;
  return null;
}

export function threadIdentityVariants(thread) {
  return normalizeIdentityVariants([
    thread?.displayIdentity,
    thread?.identity,
    recipientIdentityFromThreadId(thread?.id),
    ...(thread?.identityVariants ?? []),
  ]);
}

export function findThreadByIdentityVariants(threads = [], variants = []) {
  const keys = new Set(normalizeIdentityVariants(variants).map(identityKey).filter(Boolean));
  if (keys.size === 0) return null;
  return (threads ?? []).find((thread) => (
    threadIdentityVariants(thread).some((identity) => keys.has(identityKey(identity)))
  )) ?? null;
}

export function threadIdentitySearchText(thread) {
  return threadIdentityVariants(thread)
    .map((item) => `${item.label} ${identityTypeLabel(item)}`)
    .join(' ');
}
