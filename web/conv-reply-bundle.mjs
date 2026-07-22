// conv-reply-bundle — resolve a peer's FULL messaging bundle from their KeyShard, for a CONV send.
//
// A CONV message body is hybrid-sealed to the RECIPIENT's full bundle (x25519 + ML-KEM-768, fresh KEM per message).
// The INITIATOR of a conversation already has the recipient's bundle (they looked the recipient up by wallet/username
// to send the INTRO). The RESPONDER does not: a received INTRO carries only the sender's enc key + the ML-KEM pubkey
// HASH (the keyId binding, Fix A), never the full ML-KEM key nor a wallet in the sealed body. So a reply resolves the
// sender's bundle from their KeyShard, located by the INTRO publish transaction's src (captured as peerWallet).
//
// THE src IS A HINT, NOT AN AUTHORITY. It is verified here: the bundle read from that shard must hash to the SAME
// pairwise keyId the conversation was established under (keyId = H(enc, sha256(mlkem)) binds BOTH the enc key and the
// ML-KEM key). A wrong/hostile src points at a shard whose keyId differs, and the resolve fails closed. This is the
// same guarantee for both directions — the initiator's lookup is verified against the peer's keyId identically.
//
// FORMAT NOTE (measured, load-bearing): a KeyShard get_view returns pq_kem_pubkey as a SNAKE CELL (BoC), not the raw
// 1184 bytes. publicKeyBundleFromVaultKeyRecord expects the raw bytes, so the cell is decoded here first — feeding the
// view straight in would silently build a wrong bundle (the mirrored-declarations trap). readSnakeCellBytes accepts
// the getter's base64 BoC string or a parsed cell. [clean17-private-lane-plan: Y reply-bundle resolution]

import { publicKeyBundleFromVaultKeyRecord, CRYPTO_SUITES } from './crypto/platho-crypto.mjs?v=12';
import { readSnakeCellBytes } from './pwa-contract-transactions.mjs?v=33';

const MLKEM768_PUBLIC_KEY_BYTES = 1184;

/**
 * Build + VERIFY a peer bundle from a KeyShard view (the object createKeyShardTonRpcProvider.getView returns).
 * `peerKeyId` is the base64url keyId the conversation was established under (conv-key-store key). Throws — fail
 * closed — if the shard is unregistered or its bundle does not hash to peerKeyId.
 */
export async function resolvePeerBundleFromKeyShardView(view, peerKeyId) {
  if (!view?.exists) throw new Error('peer KeyShard is not registered — cannot resolve a reply bundle');
  if (typeof peerKeyId !== 'string' || peerKeyId.length === 0) throw new Error('resolvePeerBundleFromKeyShardView requires the conversation peerKeyId');
  // Decode the ML-KEM snake cell to raw bytes BEFORE handing the record to the bundle builder (format trap above).
  const mlKemBytes = readSnakeCellBytes(view.pq_kem_pubkey, { maxBytes: MLKEM768_PUBLIC_KEY_BYTES, name: 'peer pq_kem_pubkey' });
  if (mlKemBytes.length !== MLKEM768_PUBLIC_KEY_BYTES) throw new Error('peer ML-KEM pubkey is not 1184 bytes');
  const keyRecord = {
    exists: true,
    revoked_lt: 0n,
    enc_pubkey: view.enc_pubkey,
    sign_pubkey: view.sign_pubkey,
    // Carry scan_pubkey so the bundle is COMPLETE. A CONV reply seal (createEncryptedConvCapsule) routes by bucketKey
    // and does NOT need it — but the INITIATOR reuses this resolver, and an INTRO seal (createEncryptedIntroCapsule)
    // DOES require the recipient's scan key for the stealth view_tag. Omitting it left a bundle that silently could not
    // seal an INTRO. scan_pubkey is public and sits right in the view (stack idx 7). [conv-reply-bundle review]
    scan_pubkey: view.scan_pubkey,
    crypto_suite_mask: view.crypto_suite_mask,
    pq_kem_pubkey_len: view.pq_kem_pubkey_len,
    pq_kem_pubkey_hash: view.pq_kem_pubkey_hash,
    pq_kem_pubkey: mlKemBytes,
  };
  const bundle = await publicKeyBundleFromVaultKeyRecord(keyRecord, { suite: CRYPTO_SUITES.HYBRID_V1 });
  // THE VERIFICATION: the shard's bundle must reproduce the pairwise keyId. keyId = H(enc, sha256(mlkem)) binds both
  // keys, so this single equality confirms the src pointed at the RIGHT shard and its keys were not swapped.
  if (bundle.keyId !== peerKeyId) {
    throw new Error('peer KeyShard bundle does not match the conversation keyId (wrong/hostile source — reply refused)');
  }
  return bundle;
}

/**
 * Read the peer's KeyShard (by wallet) via the injected provider and resolve their verified reply bundle.
 * `provider` is createKeyShardTonRpcProvider(...). Thin I/O wrapper over the pure resolver above so tests can drive
 * the format/verification logic without a chain.
 */
export async function resolvePeerReplyBundle({ provider, peerWallet, peerKeyId, callOptions = {} }) {
  if (typeof provider?.getView !== 'function') throw new Error('resolvePeerReplyBundle requires a KeyShard provider');
  if (!peerWallet) throw new Error('resolvePeerReplyBundle requires the peer wallet (the INTRO publish source)');
  const view = await provider.getView(peerWallet, callOptions);
  return resolvePeerBundleFromKeyShardView(view, peerKeyId);
}
