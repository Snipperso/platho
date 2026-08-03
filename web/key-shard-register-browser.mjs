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

import { beginCell, snakeCellFromBytes } from './pwa-contract-transactions.mjs?v=35';
import { keyShardAddressBytes, keyShardStateInit, rawAddress } from './shard-address.mjs?v=5';

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
