
import { normalizeProfileGroupAbout } from './capsule-part-policy.mjs?v=24';
import { parseTonAddress, sha256Sync } from './crypto/platho-crypto.mjs?v=32';
import { parseGroupAskToken, GROUP_ASK_PREFIX } from './group-protocol.mjs?v=32';
import { parsePublicGroupJoinToken } from './public-group-protocol.mjs?v=11';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const bytesToBig = (bytes) => [...bytes].reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n);

export const ASSET_KIND = Object.freeze({ JETTON: 1, COLLECTION: 2, ITEM: 3 });
const ASSET_KINDS = new Set(Object.values(ASSET_KIND));

export const COMMUNITY_ACTION = Object.freeze({ ATTACH: 1, DETACH: 2, HIDE: 3, SHOW: 4 });
const COMMUNITY_ACTIONS = new Set(Object.values(COMMUNITY_ACTION));

export const COMMUNITY_POINTER = Object.freeze({ PUBLIC: 1, PRIVATE: 2 });

export const COMMUNITY_ROW_VERSION = 1;
export const COMMUNITY_POINTER_MAX_BYTES = 1024;
export const COMMUNITY_SPEAKER_MAX = 3;

const UID_DOMAIN = 'PLATHO.ASSET.COMMUNITIES.V1';

export function assetRawAddress(address) {
  try {
    const parsed = parseTonAddress(String(address ?? '').trim());
    return parsed.workchain === 0 ? parsed.raw : null;
  } catch {
    return null;
  }
}

function assetHashOf(address) {
  const raw = assetRawAddress(address);
  if (!raw) throw new TypeError('an asset is a basechain address');
  return parseTonAddress(raw).hash;
}

export function assetCommunitiesUid(address) {
  const hash = assetHashOf(address);
  const domain = encoder.encode(UID_DOMAIN);
  const material = new Uint8Array(domain.length + hash.length);
  material.set(domain, 0);
  material.set(hash, domain.length);
  return bytesToBig(sha256Sync(material));
}

export function walletHashHex(address) {
  try {
    return hex(parseTonAddress(String(address ?? '').trim()).hash);
  } catch {
    return null;
  }
}

export function readCommunityPointer(kind, token) {
  const text = String(token ?? '');
  if (!text || encoder.encode(text).length > COMMUNITY_POINTER_MAX_BYTES) return null;
  if (kind === COMMUNITY_POINTER.PUBLIC) {
    const parsed = parsePublicGroupJoinToken(text);
    if (!parsed) return null;
    return {
      kind, token: text, groupId: hex(parsed.groupId), name: parsed.name ?? null,
      founder: hex(parsed.founder), owner: parsed.owner ? hex(parsed.owner) : null,
    };
  }
  if (kind === COMMUNITY_POINTER.PRIVATE) {
    if (!text.startsWith(GROUP_ASK_PREFIX)) return null;
    const parsed = parseGroupAskToken(text);
    if (!parsed?.groupId || !parsed.wallet) return null;
    return {
      kind, token: text, groupId: String(parsed.groupId).toLowerCase(), name: parsed.name ?? null,
      wallet: parsed.wallet, ...(parsed.ownerWallet ? { ownerWallet: parsed.ownerWallet } : {}), ...(parsed.entryFee ? { entryFee: parsed.entryFee } : {}),
    };
  }
  return null;
}

export function communitySpeakerHash(pointer) {
  if (pointer?.kind === COMMUNITY_POINTER.PUBLIC) return /^[0-9a-f]{64}$/.test(String(pointer.founder ?? '')) ? pointer.founder : null;
  if (pointer?.kind === COMMUNITY_POINTER.PRIVATE) return walletHashHex(pointer.wallet);
  return null;
}

export function encodeCommunityRow({ action, assetKind, asset, pointerKind, token }) {
  if (!COMMUNITY_ACTIONS.has(action)) throw new RangeError('not a community action');
  if (!ASSET_KINDS.has(assetKind)) throw new RangeError('not an asset kind');
  const pointer = readCommunityPointer(pointerKind, token);
  if (!pointer) throw new RangeError('not a group pointer');
  const assetHash = assetHashOf(asset);
  const tokenBytes = encoder.encode(pointer.token);
  const out = new Uint8Array(1 + 1 + 1 + 32 + 1 + 2 + tokenBytes.length);
  out[0] = COMMUNITY_ROW_VERSION;
  out[1] = action;
  out[2] = assetKind;
  out.set(assetHash, 3);
  out[35] = pointerKind;
  out[36] = (tokenBytes.length >> 8) & 0xff;
  out[37] = tokenBytes.length & 0xff;
  out.set(tokenBytes, 38);
  return out;
}

export function decodeCommunityRow(bytesLike) {
  const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike ?? []);
  if (bytes.length < 38 || bytes[0] !== COMMUNITY_ROW_VERSION) return null;
  const action = bytes[1];
  const assetKind = bytes[2];
  if (!COMMUNITY_ACTIONS.has(action) || !ASSET_KINDS.has(assetKind)) return null;
  const length = (bytes[36] << 8) | bytes[37];
  if (length > COMMUNITY_POINTER_MAX_BYTES || bytes.length !== 38 + length) return null;
  const pointer = readCommunityPointer(bytes[35], decoder.decode(bytes.subarray(38)));
  if (!pointer) return null;
  return { action, assetKind, asset: `0:${hex(bytes.subarray(3, 35))}`, pointer };
}

export function foldAssetCommunities(rows, { asset, authority = null } = {}) {
  const assetRaw = assetRawAddress(asset);
  if (!assetRaw) return [];
  const authorityHash = authority ? walletHashHex(authority) : null;
  const ordered = (Array.isArray(rows) ? rows : [])
    .filter((entry) => entry && entry.hidden !== true && entry.row && entry.row.asset === assetRaw)
    .map((entry) => ({ ...entry, publisherHash: walletHashHex(entry.publisher), at: Number(entry.createdAt ?? 0), tie: Number(entry.order ?? 0) }))
    .filter((entry) => entry.publisherHash && Number.isFinite(entry.at))
    .sort((a, b) => (a.at - b.at) || (a.tie - b.tie));
  const attached = new Map();
  const hidden = new Set();
  for (const entry of ordered) {
    const { action, pointer, assetKind } = entry.row;
    const speaker = communitySpeakerHash(pointer);
    const key = `${pointer.groupId}:${speaker}`;
    if (action === COMMUNITY_ACTION.HIDE || action === COMMUNITY_ACTION.SHOW) {
      if (!authorityHash || entry.publisherHash !== authorityHash) continue;
      if (action === COMMUNITY_ACTION.HIDE) hidden.add(key); else hidden.delete(key);
      continue;
    }
    if (speaker !== entry.publisherHash) continue;
    if (action === COMMUNITY_ACTION.DETACH) { attached.delete(key); continue; }
    const held = attached.get(key);
    attached.set(key, { groupId: pointer.groupId, pointer, assetKind, attachedAt: held?.attachedAt ?? entry.at, renewedAt: entry.at, speaker });
  }
  const perSpeaker = new Map();
  const entries = [...attached.entries()]
    .map(([key, value]) => ({ ...value, hiddenByAuthority: hidden.has(key) }))
    .sort((a, b) => a.attachedAt - b.attachedAt)
    .filter((entry) => {
      const count = (perSpeaker.get(entry.speaker) ?? 0) + 1;
      perSpeaker.set(entry.speaker, count);
      return count <= COMMUNITY_SPEAKER_MAX;
    });
  return [...entries.filter((entry) => !entry.hiddenByAuthority), ...entries.filter((entry) => entry.hiddenByAuthority)];
}

export function officialCommunitiesIn(profile, asset) {
  const assetRaw = assetRawAddress(asset);
  if (!assetRaw) return [];
  return (Array.isArray(profile?.groups) ? profile.groups : [])
    .filter((room) => normalizeProfileGroupAbout(room?.about).some((entry) => entry.address === assetRaw));
}

export function profileGroupsWithAbout(groups, groupId, asset, kind, on) {
  const assetRaw = assetRawAddress(asset);
  if (!assetRaw || !ASSET_KINDS.has(kind)) return Array.isArray(groups) ? groups : [];
  return (Array.isArray(groups) ? groups : []).map((room) => {
    if (String(room?.groupId ?? '') !== String(groupId)) return room;
    const held = normalizeProfileGroupAbout(room?.about).filter((entry) => entry.address !== assetRaw);
    const about = normalizeProfileGroupAbout(on ? [...held, { kind, address: assetRaw }] : held);
    const { about: _dropped, ...rest } = room;
    return about.length ? { ...rest, about } : rest;
  });
}
