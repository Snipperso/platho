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

import { publicKeyBundleFromVaultKeyRecord, CRYPTO_SUITES } from './crypto/platho-crypto.mjs?v=15';
import { readSnakeCellBytes } from './pwa-contract-transactions.mjs?v=37';

const MLKEM768_PUBLIC_KEY_BYTES = 1184;

/**
 * Build a full messaging bundle from a KeyShard view (the object createKeyShardTonRpcProvider.getView returns), WITHOUT
 * an identity gate. The keyId is an OUTPUT here, computed from the keys. This is the INITIATOR's resolve: they pick a
 * recipient by wallet, and the KeyShard is ADDRESS-BOUND to that wallet (deriveKeyShardRawAddress — only that wallet's
 * own send can register it), so the keys are authentic by construction and the resolved keyId DEFINES the conversation.
 * The RESPONDER, who resolves by an UNTRUSTED INTRO src, must NOT use this directly — it must go through the gated
 * wrapper below, which refuses a shard whose keyId differs from the one the conversation was already established under.
 */
export async function resolveBundleFromKeyShardView(view) {
  if (!view?.exists) throw new Error('peer KeyShard is not registered — cannot resolve a bundle');
  // Decode the ML-KEM snake cell to raw bytes BEFORE handing the record to the bundle builder (format trap above).
  const mlKemBytes = readSnakeCellBytes(view.pq_kem_pubkey, { maxBytes: MLKEM768_PUBLIC_KEY_BYTES, name: 'peer pq_kem_pubkey' });
  if (mlKemBytes.length !== MLKEM768_PUBLIC_KEY_BYTES) throw new Error('peer ML-KEM pubkey is not 1184 bytes');
  const keyRecord = {
    exists: true,
    revoked_lt: 0n,
    enc_pubkey: view.enc_pubkey,
    sign_pubkey: view.sign_pubkey,
    // Carry scan_pubkey so the bundle is COMPLETE. A CONV seal (createEncryptedConvCapsule) routes by bucketKey and
    // does NOT need it — but an INTRO seal (createEncryptedIntroCapsule) DOES require the recipient's scan key for the
    // stealth view_tag. Omitting it left a bundle that silently could not seal an INTRO. scan_pubkey is public and
    // sits right in the view (stack idx 7). [conv-reply-bundle review]
    scan_pubkey: view.scan_pubkey,
    crypto_suite_mask: view.crypto_suite_mask,
    pq_kem_pubkey_len: view.pq_kem_pubkey_len,
    pq_kem_pubkey_hash: view.pq_kem_pubkey_hash,
    pq_kem_pubkey: mlKemBytes,
  };
  return publicKeyBundleFromVaultKeyRecord(keyRecord, { suite: CRYPTO_SUITES.HYBRID_V1 });
}

/**
 * Build + VERIFY a peer bundle from a KeyShard view. `peerKeyId` is the base64url keyId the conversation was already
 * established under (conv-key-store key). Throws — fail closed — if the shard is unregistered or its bundle does not
 * hash to peerKeyId. keyId = H(enc, sha256(mlkem)) binds BOTH keys, so this single equality confirms the (untrusted)
 * src pointed at the RIGHT shard and its keys were not swapped.
 */
export async function resolvePeerBundleFromKeyShardView(view, peerKeyId) {
  if (typeof peerKeyId !== 'string' || peerKeyId.length === 0) throw new Error('resolvePeerBundleFromKeyShardView requires the conversation peerKeyId');
  const bundle = await resolveBundleFromKeyShardView(view);
  if (bundle.keyId !== peerKeyId) {
    throw new Error('peer KeyShard bundle does not match the conversation keyId (wrong/hostile source — reply refused)');
  }
  return bundle;
}

/**
 * INITIATOR path: read the recipient's KeyShard (by a wallet the initiator chose — from the thread / username) via the
 * injected provider and build their bundle. No gate: the wallet was chosen, the shard is address-bound to it, and the
 * resolved bundle.keyId becomes the conversation's peerKeyId. `provider` is createKeyShardTonRpcProvider(...).
 */
export async function resolveRecipientBundleByWallet({ provider, wallet, callOptions = {} }) {
  if (typeof provider?.getView !== 'function') throw new Error('resolveRecipientBundleByWallet requires a KeyShard provider');
  if (!wallet) throw new Error('resolveRecipientBundleByWallet requires the recipient wallet');
  let view;
  try {
    view = await provider.getView(wallet, callOptions);
  } catch (error) {
    // A KeyShard THAT WAS NEVER DEPLOYED is not a failure — it is the answer: this wallet has published no
    // messaging keys, so there is nothing to encrypt to and no retry will conjure one. Reported to the owner
    // 2026-08-20 as `not sent: TON RPC get-method exit code -13` on a real send, twice, after composing an image.
    //
    // -13 is what mainnet returns for a codeless account and -256 is what @ton/sandbox returns for the same
    // thing; both mean absence. HTTP 404 DELIBERATELY DOES NOT: that is any proxy having a bad moment, and
    // calling it "this person does not exist" would be a confident lie about a live account.
    if (isKeyShardAbsentError(error)) {
      const absent = new Error('the recipient has not published Platho messaging keys yet');
      absent.code = RECIPIENT_NOT_ACTIVATED;
      absent.cause = error;
      throw absent;
    }
    throw error;
  }
  return resolveBundleFromKeyShardView(view);
}

/** The one code the UI matches on, exported so no caller has to spell it. */
export const RECIPIENT_NOT_ACTIVATED = 'PLATHO_RECIPIENT_NOT_ACTIVATED';

/** Absence, per the project-wide rule: exit -13 (mainnet) or -256 (sandbox). Never a transport status. */
export function isKeyShardAbsentError(error) {
  const exitCode = Number(error?.exitCode);
  if (exitCode === -13 || exitCode === -256) return true;
  // The exit code rides the error object, but a transport that only carried it in prose must not slip past —
  // matched narrowly enough that "404" or a timeout can never satisfy it.
  return /get-method exit code -(?:13|256)\b/.test(String(error?.message ?? ''));
}

/**
 * RESPONDER path: read the peer's KeyShard (by the INTRO publish src wallet) via the injected provider and resolve
 * their VERIFIED reply bundle. `provider` is createKeyShardTonRpcProvider(...). Thin I/O wrapper over the gated resolver
 * above so tests can drive the format/verification logic without a chain.
 */
export async function resolvePeerReplyBundle({ provider, peerWallet, peerKeyId, callOptions = {} }) {
  if (typeof provider?.getView !== 'function') throw new Error('resolvePeerReplyBundle requires a KeyShard provider');
  if (!peerWallet) throw new Error('resolvePeerReplyBundle requires the peer wallet (the INTRO publish source)');
  const view = await provider.getView(peerWallet, callOptions);
  return resolvePeerBundleFromKeyShardView(view, peerKeyId);
}
