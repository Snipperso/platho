import { parseTonAddress, verifyVaultKeyRecordBinding } from './crypto/platho-crypto.mjs?v=12';
import { computeVaultMessagingKeyId } from './pwa-contract-transactions.mjs?v=27';

export class VaultChainProviderUnavailableError extends Error {
  constructor(message = 'Vault chain provider is not configured') {
    super(message);
    this.name = 'VaultChainProviderUnavailableError';
  }
}

function uintLikeToBigInt(value, name) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string') {
    if (/^0x[0-9a-fA-F]+$/.test(value)) return BigInt(value);
    if (/^[0-9]+$/.test(value)) return BigInt(value);
  }
  if (value !== null && value !== undefined && typeof value.toString === 'function') {
    const text = value.toString();
    if (/^-?[0-9]+$/.test(text)) return BigInt(text);
  }
  throw new Error(`${name} must be an integer-like value`);
}

function field(record, snakeName, camelName = snakeName) {
  if (record && Object.prototype.hasOwnProperty.call(record, snakeName)) return record[snakeName];
  if (record && Object.prototype.hasOwnProperty.call(record, camelName)) return record[camelName];
  return undefined;
}

function normalizeAddressLike(value, name) {
  if (value === null || value === undefined) throw new Error(`${name} is required`);
  try {
    return parseTonAddress(typeof value === 'string' ? value : value.toString()).raw;
  } catch {
    if (typeof value === 'string' && value.length > 0) return value;
    throw new Error(`${name} must be a TON address`);
  }
}

function normalizeVaultUserView(user) {
  if (!user || field(user, 'exists') !== true) {
    throw new Error('Vault user does not exist');
  }
  const currentKeyId = uintLikeToBigInt(field(user, 'current_key_id', 'currentKeyId'), 'Vault user current_key_id');
  if (currentKeyId === 0n) {
    throw new Error('Vault user has no registered messaging key');
  }
  return {
    ...user,
    current_key_id: currentKeyId,
    auth_pubkey: uintLikeToBigInt(field(user, 'auth_pubkey', 'authPubkey') ?? 0n, 'Vault user auth_pubkey'),
    publish_nonce: uintLikeToBigInt(field(user, 'publish_nonce', 'publishNonce') ?? 0n, 'Vault user publish_nonce'),
  };
}

function normalizeVaultKeyRecordView(record) {
  if (!record || field(record, 'exists') !== true) {
    throw new Error('Vault key record does not exist');
  }
  return {
    ...record,
    exists: true,
    key_generation: uintLikeToBigInt(field(record, 'key_generation', 'keyGeneration'), 'Vault key record key_generation'),
    enc_pubkey: uintLikeToBigInt(field(record, 'enc_pubkey', 'encPubkey'), 'Vault key record enc_pubkey'),
    sign_pubkey: uintLikeToBigInt(field(record, 'sign_pubkey', 'signPubkey'), 'Vault key record sign_pubkey'),
    pq_kem_pubkey_hash: uintLikeToBigInt(field(record, 'pq_kem_pubkey_hash', 'pqKemPubkeyHash'), 'Vault key record pq_kem_pubkey_hash'),
    pq_kem_pubkey_len: uintLikeToBigInt(field(record, 'pq_kem_pubkey_len', 'pqKemPubkeyLen'), 'Vault key record pq_kem_pubkey_len'),
    pq_kem_pubkey: field(record, 'pq_kem_pubkey', 'pqKemPubkey'),
    crypto_suite_mask: uintLikeToBigInt(field(record, 'crypto_suite_mask', 'cryptoSuiteMask'), 'Vault key record crypto_suite_mask'),
    created_at: uintLikeToBigInt(field(record, 'created_at', 'createdAt'), 'Vault key record created_at'),
    created_lt: uintLikeToBigInt(field(record, 'created_lt', 'createdLt'), 'Vault key record created_lt'),
    revoked_at: uintLikeToBigInt(field(record, 'revoked_at', 'revokedAt'), 'Vault key record revoked_at'),
    revoked_lt: uintLikeToBigInt(field(record, 'revoked_lt', 'revokedLt'), 'Vault key record revoked_lt'),
  };
}

async function assertVaultKeyRecordMatchesOwner(ownerWallet, keyRecord, expectedKeyId) {
  const computedKeyId = await computeVaultMessagingKeyId({
    owner_wallet: ownerWallet,
    key_generation: keyRecord.key_generation,
    enc_pubkey: keyRecord.enc_pubkey,
    sign_pubkey: keyRecord.sign_pubkey,
    pq_kem_pubkey_hash: keyRecord.pq_kem_pubkey_hash,
    pq_kem_pubkey_len: keyRecord.pq_kem_pubkey_len,
    crypto_suite_mask: keyRecord.crypto_suite_mask,
  });
  if (computedKeyId !== BigInt(expectedKeyId)) {
    throw new Error('Vault key record does not belong to this wallet');
  }
  return computedKeyId;
}

export function createUnavailableVaultChainProvider(reason) {
  return Object.freeze({
    kind: 'unavailable',
    async getUser() {
      throw new VaultChainProviderUnavailableError(reason);
    },
    async getKeyRecord() {
      throw new VaultChainProviderUnavailableError(reason);
    },
  });
}

export function getConfiguredVaultChainProvider() {
  return globalThis.plathoVaultChainProvider ?? createUnavailableVaultChainProvider();
}

export async function bindVaultRecordFromChain(signedBundle, owner, options = {}) {
  if (!owner?.walletAddress && !owner?.ownerWallet) {
    throw new Error('Platho wallet owner is required before Vault binding');
  }
  const provider = options.provider ?? getConfiguredVaultChainProvider();
  if (typeof provider?.getUser !== 'function' || typeof provider?.getKeyRecord !== 'function') {
    throw new VaultChainProviderUnavailableError();
  }
  const ownerWallet = normalizeAddressLike(owner.walletAddress ?? owner.ownerWallet, 'owner.walletAddress');
  const user = normalizeVaultUserView(await provider.getUser(ownerWallet, {
    vaultAddress: options.vaultAddress ?? owner.vaultAddress ?? null,
  }));
  const keyRecord = normalizeVaultKeyRecordView(await provider.getKeyRecord(user.current_key_id, {
    ownerWallet,
    vaultAddress: options.vaultAddress ?? owner.vaultAddress ?? null,
  }));
  await assertVaultKeyRecordMatchesOwner(ownerWallet, keyRecord, user.current_key_id);
  const binding = await verifyVaultKeyRecordBinding(signedBundle, keyRecord, {
    now: options.now,
    ownerWallet,
    currentKeyId: user.current_key_id,
    recordKeyId: options.recordKeyId ?? user.current_key_id,
  });
  return {
    ...binding,
    user,
    keyRecord,
    providerKind: provider.kind ?? 'custom',
    currentKeyId: user.current_key_id,
    recordKeyId: options.recordKeyId ?? user.current_key_id,
  };
}

export async function runVaultChainBindingSelfTest({ signedBundle, ownerWallet, keyRecord }) {
  const normalizedKeyRecord = normalizeVaultKeyRecordView(keyRecord);
  const keyId = await computeVaultMessagingKeyId({
    owner_wallet: ownerWallet,
    key_generation: normalizedKeyRecord.key_generation,
    enc_pubkey: normalizedKeyRecord.enc_pubkey,
    sign_pubkey: normalizedKeyRecord.sign_pubkey,
    pq_kem_pubkey_hash: normalizedKeyRecord.pq_kem_pubkey_hash,
    pq_kem_pubkey_len: normalizedKeyRecord.pq_kem_pubkey_len,
    crypto_suite_mask: normalizedKeyRecord.crypto_suite_mask,
  });
  const owner = { walletAddress: ownerWallet };
  const provider = {
    kind: 'self-test',
    async getUser(walletAddress) {
      return {
        exists: walletAddress === ownerWallet,
        current_key_id: keyId,
      };
    },
    async getKeyRecord(currentKeyId) {
      if (currentKeyId !== keyId) throw new Error('unexpected key id');
      return normalizedKeyRecord;
    },
  };
  const binding = await bindVaultRecordFromChain(signedBundle, owner, { provider });
  let missingProviderRejected = false;
  try {
    await bindVaultRecordFromChain(signedBundle, owner, {
      provider: createUnavailableVaultChainProvider('self-test unavailable'),
    });
  } catch (error) {
    missingProviderRejected = error instanceof VaultChainProviderUnavailableError;
  }
  if (!missingProviderRejected) {
    throw new Error('Missing Vault chain provider was not rejected');
  }
  return {
    active: binding.active,
    currentKeyId: binding.currentKeyId.toString(),
    missingProviderRejected,
  };
}
