
import { publicKeyBundleFromVaultKeyRecord, CRYPTO_SUITES } from './crypto/platho-crypto.mjs?v=32';
import { readSnakeCellBytes } from './pwa-contract-transactions.mjs?v=60';
import { signKeyHex } from './conv-key-store.mjs?v=35';

const MLKEM768_PUBLIC_KEY_BYTES = 1184;

export async function resolveBundleFromKeyShardView(view) {
  if (!view?.exists) {
    const unregistered = new Error('the recipient has not published Platho messaging keys yet — their KeyShard is not registered');
    unregistered.code = RECIPIENT_NOT_ACTIVATED;
    throw unregistered;
  }
  const mlKemBytes = readSnakeCellBytes(view.pq_kem_pubkey, { maxBytes: MLKEM768_PUBLIC_KEY_BYTES, name: 'peer pq_kem_pubkey' });
  if (mlKemBytes.length !== MLKEM768_PUBLIC_KEY_BYTES) throw new Error('peer ML-KEM pubkey is not 1184 bytes');
  const keyRecord = {
    exists: true,
    revoked_lt: 0n,
    enc_pubkey: view.enc_pubkey,
    sign_pubkey: view.sign_pubkey,
    scan_pubkey: view.scan_pubkey,
    crypto_suite_mask: view.crypto_suite_mask,
    pq_kem_pubkey_len: view.pq_kem_pubkey_len,
    pq_kem_pubkey_hash: view.pq_kem_pubkey_hash,
    pq_kem_pubkey: mlKemBytes,
  };
  return publicKeyBundleFromVaultKeyRecord(keyRecord, { suite: CRYPTO_SUITES.HYBRID_V1 });
}

export async function resolvePeerBundleFromKeyShardView(view, peerKeyId, peerSignKey = null) {
  if (typeof peerKeyId !== 'string' || peerKeyId.length === 0) throw new Error('resolvePeerBundleFromKeyShardView requires the conversation peerKeyId');
  const bundle = await resolveBundleFromKeyShardView(view);
  if (bundle.keyId !== peerKeyId) {
    throw new Error('peer KeyShard bundle does not match the conversation keyId (wrong/hostile source — reply refused)');
  }
  const kept = signKeyHex(peerSignKey);
  if (kept && signKeyHex(view?.sign_pubkey) !== kept) {
    const copied = new Error('this KeyShard carries the peer\'s encryption keys under another signing key (a copy — refused)');
    copied.code = PEER_KEYS_COPIED;
    throw copied;
  }
  return bundle;
}

export const PEER_KEYS_COPIED = 'PLATHO_PEER_KEYS_COPIED';

export function peerKeysCopiedError(cause = null) {
  const error = new Error('the wallet has published no Platho messaging keys of its own');
  error.code = RECIPIENT_NOT_ACTIVATED;
  if (cause) error.cause = cause;
  return error;
}

export async function resolveRecipientBundleByWallet({ provider, wallet, callOptions = {} }) {
  return (await resolveRecipientByWallet({ provider, wallet, callOptions })).bundle;
}

export async function resolveRecipientByWallet({ provider, wallet, callOptions = {} }) {
  if (typeof provider?.getView !== 'function') throw new Error('resolveRecipientBundleByWallet requires a KeyShard provider');
  if (!wallet) throw new Error('resolveRecipientBundleByWallet requires the recipient wallet');
  let view;
  try {
    view = await provider.getView(wallet, callOptions);
  } catch (error) {
    if (isKeyShardAbsentError(error)) {
      const absent = new Error('the recipient has not published Platho messaging keys yet');
      absent.code = RECIPIENT_NOT_ACTIVATED;
      absent.cause = error;
      throw absent;
    }
    throw error;
  }
  return { bundle: await resolveBundleFromKeyShardView(view), signKey: signKeyHex(view?.sign_pubkey) };
}

export async function heldPeerShardSignKey({ provider, wallets, peerKeyId, callOptions = {} }) {
  if (typeof provider?.getView !== 'function') throw new Error('heldPeerShardSignKey requires a KeyShard provider');
  for (const wallet of [...new Set((Array.isArray(wallets) ? wallets : []).filter(Boolean).map((w) => String(w)))]) {
    let view;
    try {
      view = await provider.getView(wallet, callOptions);
    } catch (error) {
      if (!isKeyShardAbsentError(error)) throw error;
      continue;
    }
    let bundle = null;
    try { bundle = await resolveBundleFromKeyShardView(view); } catch { bundle = null; }
    if (bundle?.keyId === peerKeyId) return signKeyHex(view?.sign_pubkey);
  }
  return null;
}

export const RECIPIENT_NOT_ACTIVATED = 'PLATHO_RECIPIENT_NOT_ACTIVATED';

export function isKeyShardAbsentError(error) {
  const exitCode = Number(error?.exitCode);
  if (exitCode === -13 || exitCode === -256) return true;
  return /get-method exit code -(?:13|256)\b/.test(String(error?.message ?? ''));
}

export async function resolvePeerReplyBundle({ provider, peerWallet, peerKeyId, callOptions = {}, peerWalletCandidates = [], onVerifiedWallet = null, peerSignKey = null }) {
  if (typeof provider?.getView !== 'function') throw new Error('resolvePeerReplyBundle requires a KeyShard provider');
  if (!peerWallet && !(Array.isArray(peerWalletCandidates) && peerWalletCandidates.length > 0)) throw new Error('resolvePeerReplyBundle requires the peer wallet (the INTRO publish source)');
  const wallets = [...new Set([peerWallet, ...(Array.isArray(peerWalletCandidates) ? peerWalletCandidates : [])].filter(Boolean).map((w) => String(w)))];
  let lastError = null;
  let copied = null;
  for (const wallet of wallets) {
    let view;
    try {
      view = await provider.getView(wallet, callOptions);
    } catch (error) {
      if (!isKeyShardAbsentError(error)) throw error;
      lastError = error;
      continue;
    }
    try {
      const bundle = await resolvePeerBundleFromKeyShardView(view, peerKeyId, peerSignKey);
      if (typeof onVerifiedWallet === 'function') { try { await onVerifiedWallet(wallet); } catch { } }
      return bundle;
    } catch (error) {
      if (error?.code === PEER_KEYS_COPIED) copied = error;
      lastError = error;
    }
  }
  if (copied) throw peerKeysCopiedError(copied);
  if (isKeyShardAbsentError(lastError)) {
    const absent = new Error('the recipient has not published Platho messaging keys yet');
    absent.code = RECIPIENT_NOT_ACTIVATED;
    absent.cause = lastError;
    throw absent;
  }
  throw lastError ?? new Error('resolvePeerReplyBundle: no wallet resolved the peer bundle');
}
