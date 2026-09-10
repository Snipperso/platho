// key-shard-register-browser — build a KeyShardRegisterKeys (KSG1) message in the BROWSER, no @ton/core.
//
// This is the clean-17 DIRECT-PAY replacement for the clean-15 Vault RegisterMessagingKeys activation: instead of an
// external to the Vault, the user sends an INTERNAL message FROM THEIR OWN WALLET straight to their KeyShard, which is
// address-committed to (owner_wallet, profile_registry). The shard's sole authorisation is sender() == owner_wallet
// (KeyShard.tact:348), so the wallet IS the identity — no directory, no relay, no auth external. StateInit is attached
// so the shard deploys lazily on this first register.
//
// BYTE-EXACT OR NOTHING. The shard recomputes key_id from the fields it receives and a near-miss stores a bundle the
// recipient's resolve rejects (unscannable / undecryptable — messaging silently breaks). The serialisation split is NOT
// hand-guessed: it mirrors the COMPILED storeKeyShardRegisterKeys (build/KeyShard) exactly —
//   root  : op(32) | enc_pubkey(256) | sign_pubkey(256) | scan_pubkey(256) | ^b1
//   b1    : auth_pubkey(256) | pq_kem_pubkey_hash(256) | pq_kem_pubkey_len(16) | ^pq_kem_pubkey | crypto_suite_mask(16)
// the 5×256 + 16 + 16 inline bits overflow the 1023-bit root, so the compiler spilled auth..mask into a sub-cell.
// tests/key-shard-register.test.ts pins this against the @ton/core store AND a live KeyShard (accepts + get_view reflects).
//
// AUTH KEY IS MANDATORY (fail-closed). KeyShard rejects auth_pubkey == 0 (gate 22118) and auth_pubkey == sign_pubkey
// (22119); registering an auth key you do not control BRICKS the identity permanently (rotation needs a signature under
// it, KeyShard.tact:26). So this refuses to build without a distinct non-zero auth key rather than send a bricking register.

import { beginCell, snakeCellFromBytes, computeCellHashAndDepth } from './pwa-contract-transactions.mjs?v=47';
import { keyShardAddressBytes, keyShardAddressBytesFor, keyShardStateInit, keyShardStateInitFor, rawAddress }
  from './shard-address.mjs?v=29';

const KEYSHARD_REGISTER_OPCODE = 0x4B534731n; // "KSG1"

/**
 * Build the wallet-message form for a KeyShard registration. `ownerWallet`/`profileRegistry` are the raw addresses the
 * KeyShard's address commits to (the SAME registry the client reads from — a wrong one derives an empty live shard).
 * `keyRecord` is the RegisterMessagingKeys draft (createVaultMessagingKeyDraft(...).message): enc/sign/scan/auth pubkeys
 * as bigints, pq_kem_pubkey as bytes, pq_kem_pubkey_hash/len + crypto_suite_mask. `value` is KS_MIN_REGISTER_VALUE
 * (read from the shard's get_view.min_register_value, never a hardcoded mirror). Returns { to, value, body, init }.
 */
export async function buildKeyShardRegisterBrowser({ ownerWallet, profileRegistry, keyRecord, value }) {
  if (!keyRecord) throw new Error('buildKeyShardRegisterBrowser requires the RegisterMessagingKeys keyRecord');
  const auth = BigInt(keyRecord.auth_pubkey ?? 0n);
  const sign = BigInt(keyRecord.sign_pubkey);
  if (auth === 0n) throw new Error('KeyShard register requires a non-zero auth key (gate 22118) — refusing to brick the identity');
  if (auth === sign) throw new Error('KeyShard register requires a distinct auth key (gate 22119)');

  const address = await keyShardAddressBytes(ownerWallet, profileRegistry);
  const pqKemBytes = keyRecord.pq_kem_pubkey instanceof Uint8Array ? keyRecord.pq_kem_pubkey : new Uint8Array(keyRecord.pq_kem_pubkey ?? []);
  const pqKemCell = snakeCellFromBytes(pqKemBytes, 'pq_kem_pubkey chunk');

  // b1 (compiled sub-cell): auth | pq_hash | pq_len | ^pq_kem | mask
  const b1 = beginCell()
    .uint(auth, 256, 'auth_pubkey')
    .uint(BigInt(keyRecord.pq_kem_pubkey_hash ?? 0n), 256, 'pq_kem_pubkey_hash')
    .uint(BigInt(keyRecord.pq_kem_pubkey_len ?? 0n), 16, 'pq_kem_pubkey_len')
    .ref(pqKemCell, 'pq_kem_pubkey')
    .uint(BigInt(keyRecord.crypto_suite_mask ?? 0n), 16, 'crypto_suite_mask')
    .endCell();

  const body = beginCell()
    .uint(KEYSHARD_REGISTER_OPCODE, 32, 'KeyShardRegisterKeys opcode')
    .uint(BigInt(keyRecord.enc_pubkey), 256, 'enc_pubkey')
    .uint(sign, 256, 'sign_pubkey')
    .uint(BigInt(keyRecord.scan_pubkey), 256, 'scan_pubkey')
    .ref(b1, 'auth+pq+mask sub-cell')
    .endCell();

  return {
    to: rawAddress(address),
    addressBytes: address,
    value,
    body,
    pqKemCell,   // exposed so a test can pin the outer split against the compiled serialiser with the same sub-cell
    init: keyShardStateInit(ownerWallet, profileRegistry),
  };
}


// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CLEAN-18: THE SAME REGISTRATION, BUT PROVED.
//
// clean-18's KeyShard will not take a bundle on the registrant's word. It verifies two Ed25519 signatures over a
// payload IT rebuilds from the message fields and its own address, so a wallet can no longer publish somebody
// else's public keys in its own shard. Of the bundle only sign_pubkey and auth_pubkey are Ed25519 — TVM can check
// nothing else — and the whole bundle is bound into what they sign.
//
// SEPARATE FUNCTIONS, not a flag inside the clean-17 one, for the reason shard-address.mjs keeps its ...For
// variants: the live shard is clean-17 and would misparse this body. The live path stays on the builder above
// until the cutover swaps it, and both stay pinned against their own generation's compiled serialiser.
//
// TWO STEPS on purpose. This module owns the byte layout and nothing else — it does not import a signing key or a
// crypto library. The caller builds the payload, signs its hash with the two secrets it already holds
// (localIdentity.signingSecretKey and localVaultAuthKeyPair.secretKey), and hands the signatures back.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const KEYSHARD_REGISTER_POP_DOMAIN = 0x4B535031n;   // "KSP1" — NOT the rotation domain; one cannot be replayed at the other

/**
 * The cell whose hash the registrant signs, byte-identical to KeyShard.registerPossessionPayload(). `shardAddress`
 * is the shard's own address bytes (keyShardAddressBytes output) — it commits to (owner_wallet, profile_registry),
 * which is what stops a signature made for one wallet's shard being replayed into another's.
 * Split across two refs because 6x256 + 32 + 16 + 16 is 1600 bits and a cell holds 1023.
 */
export function keyShardRegisterPossessionPayload({ shardAddress, keyRecord }) {
  const keys = beginCell()
    .uint(BigInt(keyRecord.enc_pubkey), 256, 'enc_pubkey')
    .uint(BigInt(keyRecord.sign_pubkey), 256, 'sign_pubkey')
    .uint(BigInt(keyRecord.scan_pubkey), 256, 'scan_pubkey')
    .endCell();
  const rest = beginCell()
    .uint(BigInt(keyRecord.auth_pubkey ?? 0n), 256, 'auth_pubkey')
    .uint(BigInt(keyRecord.pq_kem_pubkey_hash ?? 0n), 256, 'pq_kem_pubkey_hash')
    .endCell();
  return beginCell()
    .uint(KEYSHARD_REGISTER_POP_DOMAIN, 32, 'KSP1 domain')
    .uint(bytesToBigInt(shardAddress.hash), 256, 'shard address hash')
    .uint(BigInt(keyRecord.pq_kem_pubkey_len ?? 0n), 16, 'pq_kem_pubkey_len')
    .uint(BigInt(keyRecord.crypto_suite_mask ?? 0n), 16, 'crypto_suite_mask')
    .ref(keys, 'enc+sign+scan')
    .ref(rest, 'auth+pq_hash')
    .endCell();
}

/** The 32 bytes to sign: the payload cell's representation hash. */
export async function keyShardRegisterPossessionDigest(args) {
  const { hash } = await computeCellHashAndDepth(keyShardRegisterPossessionPayload(args));
  return hash;
}

function bytesToBigInt(bytes) {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

/**
 * The clean-18 KSG1 body. `popSignature` is Ed25519 over keyShardRegisterPossessionDigest under the SIGN key,
 * `authSignature` the same digest under the AUTH key — 64 bytes each. The layout mirrors the compiled
 * storeKeyShardRegisterKeys: the compiler spills the signatures into their own chain of sub-cells.
 *   root : op(32) | enc(256) | sign(256) | scan(256) | ^b1
 *   b1   : auth(256) | pq_hash(256) | pq_len(16) | ^pq_kem | mask(16) | ^b2
 *   b2   : pop_signature(512) | ^b3
 *   b3   : auth_signature(512)
 */
export async function buildKeyShardRegisterBrowser18({ ownerWallet, profileRegistry, keyRecord, value, popSignature, authSignature }) {
  if (!keyRecord) throw new Error('buildKeyShardRegisterBrowser18 requires the RegisterMessagingKeys keyRecord');
  const auth = BigInt(keyRecord.auth_pubkey ?? 0n);
  const sign = BigInt(keyRecord.sign_pubkey);
  if (auth === 0n) throw new Error('KeyShard register requires a non-zero auth key (gate 22118)');
  if (auth === sign) throw new Error('KeyShard register requires a distinct auth key (gate 22119)');
  if (!(popSignature instanceof Uint8Array) || popSignature.length !== 64) {
    throw new Error('KeyShard register requires a 64-byte pop signature under the sign key (gate 22140)');
  }
  if (!(authSignature instanceof Uint8Array) || authSignature.length !== 64) {
    throw new Error('KeyShard register requires a 64-byte signature under the auth key (gate 22141)');
  }

  // GENERATION 18, NAMED [audit 2026-09-02, adversarial agent facet 2]. `keyShardAddressBytes` defaults its
  // generation to 17, so this builder — whose whole reason to exist is the clean-18 possession proof, two
  // Ed25519 signatures the clean-17 receiver does not read — derived a clean-17 ADDRESS and attached a
  // clean-17 StateInit. Wired at the flip it would have sent the new registration to the old shard:
  // messaging keys and the avatar pointer written where the new registry never looks. Worse, the default
  // is what made the tagged CUTOVER_UPDATE_REQUIRED refusal unreachable here — the seam added for the KEY
  // lane specifically so that asking for a generation this build cannot supply THROWS instead of
  // answering. Asking by name restores it: before web/shard-code-18.mjs ships this refuses loudly.
  const address = await keyShardAddressBytesFor(18, ownerWallet, profileRegistry);
  const pqKemBytes = keyRecord.pq_kem_pubkey instanceof Uint8Array ? keyRecord.pq_kem_pubkey : new Uint8Array(keyRecord.pq_kem_pubkey ?? []);
  const pqKemCell = snakeCellFromBytes(pqKemBytes, 'pq_kem_pubkey chunk');

  const b3 = beginCell().bytesValue(authSignature, 64, 'auth_signature').endCell();
  const b2 = beginCell().bytesValue(popSignature, 64, 'pop_signature').ref(b3, 'auth_signature cell').endCell();
  const b1 = beginCell()
    .uint(auth, 256, 'auth_pubkey')
    .uint(BigInt(keyRecord.pq_kem_pubkey_hash ?? 0n), 256, 'pq_kem_pubkey_hash')
    .uint(BigInt(keyRecord.pq_kem_pubkey_len ?? 0n), 16, 'pq_kem_pubkey_len')
    .ref(pqKemCell, 'pq_kem_pubkey')
    .uint(BigInt(keyRecord.crypto_suite_mask ?? 0n), 16, 'crypto_suite_mask')
    .ref(b2, 'signatures sub-cell')
    .endCell();

  const body = beginCell()
    .uint(KEYSHARD_REGISTER_OPCODE, 32, 'KeyShardRegisterKeys opcode')
    .uint(BigInt(keyRecord.enc_pubkey), 256, 'enc_pubkey')
    .uint(sign, 256, 'sign_pubkey')
    .uint(BigInt(keyRecord.scan_pubkey), 256, 'scan_pubkey')
    .ref(b1, 'auth+pq+mask+signatures sub-cell')
    .endCell();

  return { to: rawAddress(address), addressBytes: address, value, body, pqKemCell,
    init: keyShardStateInitFor(18, ownerWallet, profileRegistry) };
}
