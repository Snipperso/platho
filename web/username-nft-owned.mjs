import { computeUsernameNameHash } from './username-ton-rpc-provider.mjs?v=95';
import { parseTonAddress } from './crypto/platho-crypto.mjs?v=31';

const TONAPI_ORIGIN = 'https://tonapi.io';
export const USERNAME_NFT_DISCOVERY_LIMIT = 200;

const rawAddress = (value) => {
  try {
    return parseTonAddress(value).raw;
  } catch {
    return null;
  }
};

export async function discoverUsernameNftAddresses({
  ownerWallet,
  collectionAddress,
  fetchImpl = globalThis.fetch,
  limit = USERNAME_NFT_DISCOVERY_LIMIT,
} = {}) {
  if (!ownerWallet || !collectionAddress) throw new Error('username nft discovery: wallet and collection are required');
  if (typeof fetchImpl !== 'function') throw new Error('username nft discovery: no fetch available');
  const url = `${TONAPI_ORIGIN}/v2/accounts/${encodeURIComponent(ownerWallet)}/nfts`
    + `?collection=${encodeURIComponent(collectionAddress)}&limit=${Number(limit)}&offset=0&indirect_ownership=false`;
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response?.ok) throw new Error(`username nft discovery: indexer answered ${response?.status ?? 'nothing'}`);
  const payload = await response.json();
  const items = Array.isArray(payload?.nft_items) ? payload.nft_items : [];
  const out = [];
  const seen = new Set();
  for (const item of items.slice(0, Number(limit))) {
    const address = rawAddress(item?.address);
    if (!address || seen.has(address)) continue;
    seen.add(address);
    out.push({
      itemAddress: address,
      proposedName: normalizeUsernameLabel(item?.metadata?.name),
      proposedImage: safeInlineImage(item?.metadata?.image_data ?? item?.metadata?.image),
    });
  }
  return out;
}

export function safeInlineImage(value) {
  const text = String(value ?? '').trim();
  if (!text || text.length > 1024 * 1024) return null;
  if (/^data:image\/svg\+xml[;,]/i.test(text)) {
    const comma = text.indexOf(',');
    let svg = null;
    try {
      svg = /;base64$/i.test(text.slice(0, comma)) ? atob(text.slice(comma + 1)) : decodeURIComponent(text.slice(comma + 1));
    } catch {
      return null;
    }
    return svgCarriesPicture(svg) ? null : text;
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return null;
  let head = '';
  try {
    head = atob(text.slice(0, 512)).trimStart().toLowerCase();
  } catch {
    return null;
  }
  if (!head.startsWith('<svg') && !head.startsWith('<?xml')) return null;
  try {
    if (svgCarriesPicture(atob(text))) return null;
  } catch {
    return null;
  }
  return `data:image/svg+xml;base64,${text}`;
}

const SVG_CARRIED_PICTURE = /<\s*(?:[a-z][\w.-]*:)?(?:image|feimage|foreignobject|use)\b|data:/i;
function svgCarriesPicture(svg) {
  return SVG_CARRIED_PICTURE.test(String(svg ?? ''));
}

export function normalizeUsernameLabel(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\.ath$/, '');
}

async function nameHashOrNull(label) {
  try {
    return await computeUsernameNameHash(label);
  } catch {
    return null;
  }
}

export async function usernameNftCandidateFromLabel(label, { registryProvider, callOptions = {} } = {}) {
  const name = normalizeUsernameLabel(label);
  if (!name) return null;
  if (!registryProvider?.getUsernameItemAddress) throw new Error('username nft candidate: registry provider cannot derive item addresses');
  const nameHash = await nameHashOrNull(name);
  if (nameHash === null) return null;
  const itemAddress = await registryProvider.getUsernameItemAddress(nameHash, callOptions);
  return { label: name, nameHash, itemAddress: rawAddress(itemAddress) };
}

export async function collectOwnedUsernameNfts({
  ownerWallet,
  candidateAddresses = [],
  indexerAddresses = null,
  indexerError = null,
  candidateFailures = 0,
  verifyItem,
  stillWanted = null,
  onProgress = null,
} = {}) {
  if (typeof verifyItem !== 'function') throw new Error('username nft collect: verifyItem is required');
  const mine = rawAddress(ownerWallet);
  if (!mine) throw new Error('username nft collect: owner wallet is required');

  const seen = new Map();
  for (const candidate of [...candidateAddresses, ...(indexerAddresses ?? [])]) {
    const raw = rawAddress(candidate?.itemAddress ?? candidate);
    if (!raw) continue;
    const proposed = {
      label: normalizeUsernameLabel(candidate?.label ?? candidate?.proposedName),
      image: safeInlineImage(candidate?.proposedImage),
    };
    if (seen.has(raw)) {
      const held = seen.get(raw);
      if (!held.image && proposed.image) held.image = proposed.image;
      continue;
    }
    seen.set(raw, proposed);
  }

  const owned = [];
  let unverified = 0;
  const transferred = [];
  let stopped = false;
  for (const [itemAddress, { label: proposedLabel, image }] of seen) {
    if (typeof stillWanted === 'function' && !stillWanted()) { stopped = true; break; }
    let record = null;
    try {
      record = await verifyItem(itemAddress);
    } catch {
      unverified += 1;
      continue;
    }
    if (record?.authoritative !== true) continue;
    let label = null;
    if (proposedLabel) {
      const hash = await nameHashOrNull(proposedLabel);
      if (hash !== null && BigInt(hash) === BigInt(record.name_hash ?? 0n)) label = proposedLabel;
    }
    const ownerWalletRaw = rawAddress(record.owner_wallet);
    if (ownerWalletRaw !== mine) {
      if (label && ownerWalletRaw) transferred.push({ itemAddress, nameHash: record.name_hash ?? null, label, ownerWallet: ownerWalletRaw });
      continue;
    }
    owned.push({
      itemAddress,
      nameHash: record.name_hash ?? null,
      label,
      image,
      tier: record.item_state?.tier ?? null,
      usernameLen: record.item_state?.username_len ?? null,
    });
    if (typeof onProgress === 'function') {
      try { onProgress({ owned: owned.slice(), transferred: [], complete: false, stopped: false, capped: false, indexerError: null, unverified, verifyFailures: unverified, candidateFailures: 0 }); } catch { }
    }
  }

  const candidateFailureCount = Math.max(0, Number(candidateFailures) || 0);
  return {
    owned,
    transferred,
    complete: !stopped && indexerError === null && indexerAddresses !== null && unverified === 0 && candidateFailureCount === 0,
    stopped,
    capped: Array.isArray(indexerAddresses) && indexerAddresses.length >= USERNAME_NFT_DISCOVERY_LIMIT,
    indexerError,
    unverified,
    verifyFailures: unverified,
    candidateFailures: candidateFailureCount,
  };
}
