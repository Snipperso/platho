
export const WALLET_RECORD_KIND = 'platho.wallet.encrypted.mnemonic.v1';
export const CLOUD_WALLET_PREFIX = 'platho_wallet_v2_';
export const DEVICE_WALLETS_MAX = 64;
export const LEGACY_CLOUD_SLOT_KEY = 'platho_wallet_encrypted_v1';
export const DEVICE_OTHER_WALLETS_KEY = 'platho.wallet.previous.v1';
export const CLOUD_RECORD_FIELDS = Object.freeze(['kind', 'version', 'kdf', 'iterations', 'salt', 'cipher', 'iv', 'ciphertext', 'owner', 'seq', 'mac']);
export const SIGNED_FIELDS = Object.freeze(['kind', 'version', 'kdf', 'iterations', 'salt', 'cipher', 'iv', 'ciphertext', 'owner', 'seq']);

const OWNER_TAG = /^o1:[0-9a-f]{32}$/;

export class KeyringFullError extends Error {
  constructor() {
    super(`this device keeps at most ${DEVICE_WALLETS_MAX} wallets`);
    this.code = 'KEYRING_FULL';
  }
}

export function walletRecordOrNull(value) {
  return value && value.kind === WALLET_RECORD_KIND && typeof value.ciphertext === 'string' && value.ciphertext.length > 0 ? value : null;
}
export function recordOwner(record) {
  const owner = record?.owner;
  return typeof owner === 'string' && OWNER_TAG.test(owner) ? owner : '';
}
export const SEQ_CEILING = 4_102_444_800_000;
export function recordSeq(record) {
  const seq = Number(record?.seq);
  return Number.isSafeInteger(seq) && seq >= 0 && seq <= SEQ_CEILING ? seq : 0;
}
export function sealedFieldsText(record) {
  return JSON.stringify(SIGNED_FIELDS.map((field) => (field === 'seq' ? recordSeq(record) : record?.[field] ?? null)));
}
export function isSigned(record) {
  return typeof record?.mac === 'string' && /^[0-9a-f]{64}$/.test(record.mac);
}
export function counted(record) {
  return !record || isSigned(record) || recordSeq(record) === 0 ? record : { ...record, seq: 0 };
}
export function sameSeal(a, b) {
  return Boolean(a && b) && a.ciphertext === b.ciphertext && a.iv === b.iv;
}
export function sameWallet(a, b) {
  if (!a || !b) return false;
  const ownerA = recordOwner(a);
  const ownerB = recordOwner(b);
  if (ownerA && ownerB) return ownerA === ownerB;
  if (a.address && b.address) return String(a.address).toLowerCase() === String(b.address).toLowerCase();
  return sameSeal(a, b);
}
export function newerSeal(a, b) {
  if (!b) return a;
  if (!a) return b;
  if (sameSeal(a, b)) return a;
  const bySeq = recordSeq(a) - recordSeq(b);
  if (bySeq !== 0) return bySeq > 0 ? a : b;
  return String(a.ciphertext) > String(b.ciphertext) ? a : b;
}
export function supersedes(a, b) {
  if (!a || sameSeal(a, b)) return false;
  if (!b) return true;
  if (recordSeq(a) === 0 && recordSeq(b) === 0) return false;
  return newerSeal(a, b) === a;
}
export function nextSeq(...records) {
  return records.flat().filter(Boolean).reduce((max, record) => Math.max(max, recordSeq(record)), 0) + 1;
}
function withLocalFields(record, from) {
  if (!from || record.address || !from.address || !sameWallet(record, from)) return record;
  return { ...record, address: from.address, walletKind: from.walletKind, networkGlobalId: from.networkGlobalId };
}


export function normalizeKeyring({ active = null, others = [] } = {}) {
  const head = walletRecordOrNull(active);
  const kept = [];
  for (const entry of Array.isArray(others) ? others : []) {
    const record = walletRecordOrNull(entry?.record);
    if (!record) continue;
    if (head && sameWallet(head, record)) continue;
    const at = Number(entry.at) || 0;
    const index = kept.findIndex((item) => sameWallet(item.record, record));
    if (index < 0) kept.push({ at, record });
    else if (newerSeal(kept[index].record, record) === record) kept[index] = { at: Math.max(at, kept[index].at), record };
  }
  return { active: head, others: kept };
}
export function keyringRecords(state) {
  return [state.active, ...state.others.map((entry) => entry.record)].filter(Boolean);
}
export function keyringFind(state, record) {
  const owner = recordOwner(record);
  const records = keyringRecords(state);
  return (owner ? records.find((one) => recordOwner(one) === owner) : null) ?? records.find((one) => sameWallet(one, record)) ?? null;
}
export function keyringPut(state, record, { makeActive = false, at = Date.now() } = {}) {
  const incoming = walletRecordOrNull(record);
  if (!incoming) throw new TypeError('not a sealed wallet record');
  const current = normalizeKeyring(state);
  const others = current.others.filter((entry) => !sameWallet(entry.record, incoming));
  const previous = current.active && sameWallet(current.active, incoming) ? current.active
    : current.others.find((entry) => sameWallet(entry.record, incoming))?.record ?? null;
  const placed = withLocalFields(incoming, previous);
  if (makeActive || (current.active && sameWallet(current.active, incoming)) || !current.active) {
    if (current.active && !sameWallet(current.active, incoming)) others.unshift({ at, record: current.active });
    if (others.length > DEVICE_WALLETS_MAX - 1) throw new KeyringFullError();
    return { active: placed, others };
  }
  const index = current.others.findIndex((entry) => sameWallet(entry.record, incoming));
  const next = [...current.others];
  if (index >= 0) next[index] = { at: next[index].at, record: placed };
  else next.unshift({ at, record: placed });
  if (next.length > DEVICE_WALLETS_MAX - 1) throw new KeyringFullError();
  return { active: current.active, others: next };
}
export function keyringWithout(state, record) {
  const current = normalizeKeyring(state);
  return {
    active: current.active && sameSeal(current.active, record) ? null : current.active,
    others: current.others.filter((entry) => !sameSeal(entry.record, record)),
  };
}
export function keyringForget(state, record) {
  const current = normalizeKeyring(state);
  return { active: current.active, others: current.others.filter((entry) => !sameWallet(entry.record, record)) };
}


function hexOfBase64(text, bytes) {
  try {
    const binary = atob(String(text));
    let out = '';
    for (let index = 0; index < Math.min(bytes, binary.length); index += 1) out += binary.charCodeAt(index).toString(16).padStart(2, '0');
    return out;
  } catch { return ''; }
}
export function cloudKeyFor(record) {
  const owner = recordOwner(record);
  if (owner) return `${CLOUD_WALLET_PREFIX}${owner.slice(3)}`;
  const seal = hexOfBase64(record?.ciphertext, 16);
  return seal.length === 32 ? `${CLOUD_WALLET_PREFIX}x${seal}` : null;
}
export function isCloudWalletKey(key) {
  return key === LEGACY_CLOUD_SLOT_KEY || (typeof key === 'string' && /^platho_wallet_v2_x?[0-9a-f]{32}$/.test(key));
}
export function isUntaggedCloudKey(key) {
  return key === LEGACY_CLOUD_SLOT_KEY || (typeof key === 'string' && /^platho_wallet_v2_x[0-9a-f]{32}$/.test(key));
}
export function cloudFormOf(record) {
  const form = {};
  for (const field of CLOUD_RECORD_FIELDS) if (record?.[field] !== undefined) form[field] = record[field];
  return form;
}
export function cloudValueFor(record, sealedName = null) {
  return JSON.stringify({ r: cloudFormOf(record), ...(sealedName?.iv && sealedName?.ct ? { n: { iv: sealedName.iv, ct: sealedName.ct } } : {}) });
}
export function parseCloudValue(json) {
  try {
    const value = JSON.parse(json);
    const record = walletRecordOrNull(value?.r) ?? walletRecordOrNull(value);
    if (!record) return null;
    const name = value.n && typeof value.n.iv === 'string' && typeof value.n.ct === 'string' ? { iv: value.n.iv, ct: value.n.ct } : null;
    return { record: cloudFormOf(record), name };
  } catch { return null; }
}

export function planWalletSync(state, cloud, { at = Date.now() } = {}) {
  let next = normalizeKeyring(state);
  const push = [];
  const retire = [];
  const added = [];
  let full = false;
  const entries = (cloud ?? []).filter((entry) => entry?.key && walletRecordOrNull(entry.record));
  const heldUnder = (key) => entries.find((entry) => entry.key === key)?.record ?? null;
  for (const entry of entries) {
    const record = counted(entry.record);
    const local = keyringFind(next, record);
    if (!local) {
      try { next = keyringPut(next, record, { at }); added.push(record); } catch (error) { if (error?.code === 'KEYRING_FULL') full = true; else throw error; }
      continue;
    }
    const ownKey = recordOwner(local) ? cloudKeyFor(local) : null;
    if (entry.key !== ownKey) {
      const tagged = ownKey ? heldUnder(ownKey) : null;
      if (isUntaggedCloudKey(entry.key) && sameSeal(local, record) && tagged && (sameSeal(tagged, local) || supersedes(counted(tagged), local))) retire.push(entry.key);
      continue;
    }
    if (isSigned(local) && supersedes(local, record)) push.push({ key: entry.key, record: local });
  }
  return { state: next, push, retire, added, full };
}
