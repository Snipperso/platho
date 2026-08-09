// username-nft-owned — which .ath names does this wallet actually own.
//
// THERE IS NO ON-CHAIN ANSWER TO THAT QUESTION, and that is a property of the design rather than a gap. The
// collection is UNORDERED (`next_item_index` = -1) and UsernameRegistry keeps ZERO bytes per name — which is exactly
// what removed the 13 076-profile ceiling. An item's address is a pure function of the name, so the chain can always
// answer "who owns THIS name" and can never answer "what names does this wallet hold".
//
// So the list is assembled from two sources of DIFFERENT trust, and the whole point of this module is that they are
// treated differently:
//
//   1. LOCAL CANDIDATES — names this device already knows (the linked name, names minted here, names the user typed).
//      Complete for the ordinary case, blind to a name somebody TRANSFERRED to this wallet.
//   2. AN INDEXER (tonapi) — sees transfers too, and can be down, wrong, or hostile.
//
// NEITHER SOURCE IS BELIEVED. Both only ever propose an item address; ownership is then established on chain by
// resolveAuthoritativeUsernameItemOwnership, which derives the item's address from the name_hash the item claims and
// rejects it unless the derivation lands on the account just read. An indexer can therefore add a name to the list
// only if the chain agrees, and can never remove one — the local floor is the floor.
//
// THE FAILURE MODE IS THE WHOLE REASON FOR THAT SHAPE. An indexer that answers with an empty array looks identical
// to "you own nothing", and this list is a statement about somebody's PROPERTY. A down indexer must degrade to "here
// is what I can prove, the list may be incomplete" and never to silence — `complete` carries that, and a caller that
// ignores it will show a list that lies.
import { computeUsernameNameHash } from './username-ton-rpc-provider.mjs?v=59';
import { parseTonAddress } from './crypto/platho-crypto.mjs?v=15';

/** Public indexer, read-only. Already reachable under the production CSP as a broadcast door; this reads. */
const TONAPI_ORIGIN = 'https://tonapi.io';
/** Bound on what an indexer may propose in one answer. It is untrusted input; an unbounded list is a free DoS. */
export const USERNAME_NFT_DISCOVERY_LIMIT = 200;

const rawAddress = (value) => {
  try {
    return parseTonAddress(value).raw;
  } catch {
    return null;
  }
};

/**
 * Ask the indexer which items of OUR collection this wallet holds.
 *
 * Returns an address and, where the indexer offered one, a PROPOSED name — never a believed one. Ownership is
 * settled on chain, and the name is settled by hashing: a proposal is displayed only if its hash equals the
 * name_hash the item itself carries, so a wrong or hostile string fails arithmetic rather than being trusted. That
 * is what makes it safe to render an indexer's metadata at all; everything else in the response (owner, collection,
 * verification flags) is dropped, because the chain has already been asked.
 */
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
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!response?.ok) throw new Error(`username nft discovery: indexer answered ${response?.status ?? 'nothing'}`);
  const payload = await response.json();
  const items = Array.isArray(payload?.nft_items) ? payload.nft_items : [];
  const out = [];
  const seen = new Set();
  for (const item of items.slice(0, Number(limit))) {
    const address = rawAddress(item?.address);
    if (!address || seen.has(address)) continue;
    seen.add(address);
    out.push({ itemAddress: address, proposedName: normalizeUsernameLabel(item?.metadata?.name) });
  }
  return out;
}

/**
 * `Platho.ATH` and `platho` are the same name. COSMETIC ONLY — what counts as a legal name (charset, length) is
 * decided by normalizeUsername inside the hash function, and copying that rule here would be a second copy of a
 * derived truth: the day the registry's charset changes, one of the two copies starts silently rejecting names the
 * chain accepts. Anything this returns is still proposed, never trusted — the hash check settles it.
 */
export function normalizeUsernameLabel(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\.ath$/, '');
}

/** The name's hash, or null when the string is not a legal name at all. The provider's rule is the only rule. */
async function nameHashOrNull(label) {
  try {
    return await computeUsernameNameHash(label);
  } catch {
    return null;
  }
}

/**
 * Turn a name into the pair the verifier needs. Kept separate because the LOCAL half of the list starts from names
 * (a label the device remembers) while the indexer half starts from addresses, and the two have to meet.
 */
export async function usernameNftCandidateFromLabel(label, { registryProvider, callOptions = {} } = {}) {
  const name = normalizeUsernameLabel(label);
  if (!name) return null;
  if (!registryProvider?.getUsernameItemAddress) throw new Error('username nft candidate: registry provider cannot derive item addresses');
  const nameHash = await nameHashOrNull(name);
  if (nameHash === null) return null;
  const itemAddress = await registryProvider.getUsernameItemAddress(nameHash, callOptions);
  return { label: name, nameHash, itemAddress: rawAddress(itemAddress) };
}

/**
 * The owned list, chain-verified.
 *
 * `verifyItem(itemAddress)` must return the authoritative-ownership record for that account — in the app that is
 * resolveAuthoritativeUsernameItemOwnership bound to a fresh item provider. An item is included only when the record
 * is authoritative AND its owner is this wallet; everything else is dropped without comment, because "an account we
 * were pointed at is not yours" is not news the user needs.
 *
 * `complete` is false when the indexer could not be asked or refused. It is not cosmetic: the caller must say so.
 */
export async function collectOwnedUsernameNfts({
  ownerWallet,
  candidateAddresses = [],
  indexerAddresses = null,
  indexerError = null,
  verifyItem,
} = {}) {
  if (typeof verifyItem !== 'function') throw new Error('username nft collect: verifyItem is required');
  const mine = rawAddress(ownerWallet);
  if (!mine) throw new Error('username nft collect: owner wallet is required');

  // The local floor goes in FIRST, so a name this device can name keeps its label even when the indexer also
  // returns it — a proposal never displaces something we already know.
  const seen = new Map();
  for (const candidate of [...candidateAddresses, ...(indexerAddresses ?? [])]) {
    const raw = rawAddress(candidate?.itemAddress ?? candidate);
    if (!raw || seen.has(raw)) continue;
    seen.set(raw, normalizeUsernameLabel(candidate?.label ?? candidate?.proposedName));
  }

  const owned = [];
  for (const [itemAddress, proposedLabel] of seen) {
    // SEQUENTIALLY. Concurrent chain reads are the iOS run-loop stall this codebase has paid for repeatedly, and a
    // wallet with a dozen names is not worth re-learning it.
    let record = null;
    try {
      record = await verifyItem(itemAddress);
    } catch {
      // A read that failed proves nothing either way, so the name is neither shown nor denied — it simply leaves the
      // list incomplete, which the caller already has to handle for the indexer.
      continue;
    }
    if (record?.authoritative !== true) continue;
    if (rawAddress(record.owner_wallet) !== mine) continue;
    // THE NAME IS SETTLED BY ARITHMETIC, not by whoever proposed it. The item carries a name_hash; a label is shown
    // only when hashing it reproduces that number. So a local label proves itself the same way an indexer's does,
    // and a name nobody could prove is shown as what it honestly is — an item at an address.
    let label = null;
    if (proposedLabel) {
      const hash = await nameHashOrNull(proposedLabel);
      if (hash !== null && BigInt(hash) === BigInt(record.name_hash ?? 0n)) label = proposedLabel;
    }
    owned.push({
      itemAddress,
      nameHash: record.name_hash ?? null,
      label,
      tier: record.item_state?.tier ?? null,
      usernameLen: record.item_state?.username_len ?? null,
    });
  }

  return { owned, complete: indexerError === null && indexerAddresses !== null, indexerError };
}
