// recovery-publish-browser — build a RECOVERY store (the K_root durability record) in the BROWSER, no @ton/core.
//
// The reference builder (web/publish-builder.mjs buildRecoveryPublish) speaks the compiled Tact serialiser and does
// not load in a browser. This is the SAME message on the client's own primitives, for the clean-17 direct-pay
// RECOVERY lane: the user publishes an encrypted blob of their conversation K_roots into their OWN slot so a fresh
// device can restore them from the seed alone.
//
// AUTHORISATION IS AN OWNER SIGNATURE bound to THIS deployment's address. The slot key is H(seed-derived owner key ‖
// slot_index), so only the seed-holder can name any slot (gate 13575); the owner signature over (address ‖ slotKey ‖
// seq ‖ blob-hashes) stops both a stranger writing the slot AND a captured record being replayed into the same slot
// of a FUTURE code generation — the address is in the signed preimage. seq is an anti-rollback marker the shard keeps
// even across eviction, so the shard must NOT self-destruct (unlike CONV/INTRO).
//
// tests/recovery-publish-browser.test.ts pins the message against the @ton/core reference AND against a live RecoveryShard.

import { beginCell, computeCellHashAndDepth } from './pwa-contract-transactions.mjs?v=35';
import { recoveryShardAddressBytes, recoveryShardStateInit, rawAddress } from './shard-address.mjs?v=5';
import { recoveryOwnerSlotKey } from './shard-discovery.mjs?v=4';
import { recoveryOwnerSecret, recoveryOwnerPublicKey } from './crypto/conv-routing.mjs?v=2';
import { ed25519 } from './vendor/@noble/curves/ed25519.js';

// MUST equal the RecoveryShard.tact constants; mirrored here (not imported) so this browser builder is the
// independent check the reference derivation is pinned against.
const RECOVERY_DOMAIN = 0x42525331n;        // "BRS1"
const RECOVERY_STORE_OPCODE = 0x52435631n;  // "RCV1" — message(0x52435631) RecoveryStore

const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

async function cellHashBig(cell) {
  const { hash } = await computeCellHashAndDepth(cell);
  return bytesToBig(hash);
}

/**
 * Everything a wallet needs to publish a RECOVERY record direct-pay. `seed` derives the owner keypair + slot key;
 * `slotIndex` picks one of 256 slots; `seq` must strictly exceed the slot's stored seq (anti-rollback); `h0`/`h1`
 * are the blob's header hashes (bigints) and `body` is the encrypted K_root blob cell. `bh` is DERIVED from the body
 * (gate 13557 requires body.hash() == bh) so it is never passed. FUNDING: pass the RECOVERY deploy figure.
 */
export async function buildRecoveryPublishBrowser({ seed, slotIndex, seq, h0, h1, body, value }) {
  const ownerSecret = await recoveryOwnerSecret(seed, slotIndex);   // W1-015: per-slot key
  const ownerPub = await recoveryOwnerPublicKey(seed, slotIndex);
  const slotKey = await recoveryOwnerSlotKey(ownerPub, slotIndex);
  const address = await recoveryShardAddressBytes(slotKey);
  const bh = await cellHashBig(body);

  // digest = H(RECOVERY_DOMAIN ‖ shard_address ‖ slotKey ‖ seq ‖ ^(h0 ‖ h1 ‖ bh)) — mirrors RecoveryShard.recoveryDigest.
  const digestCell = beginCell()
    .uint(RECOVERY_DOMAIN, 32, 'RECOVERY_DOMAIN')
    .address(rawAddress(address), 'shard address')
    .uint(slotKey, 256, 'slotKey')
    .uint(BigInt(seq), 64, 'seq')
    .ref(beginCell().uint(BigInt(h0), 256, 'h0').uint(BigInt(h1), 256, 'h1').uint(bh, 256, 'bh').endCell(), 'blob hashes')
    .endCell();
  const { hash: digest } = await computeCellHashAndDepth(digestCell);
  const sig = ed25519.sign(digest, ownerSecret);

  // body: op | owner_pubkey | slot_index | seq | h0 | h1 | ^(bh | ^body | ^owner_sig) — exact compiled storeRecoveryStore
  // split (bh overflowed the 1023-bit root into a sub-cell with body + owner_sig).
  const sigCell = beginCell().bytesValue(sig, 64, 'owner_sig').endCell();
  const tail = beginCell().uint(bh, 256, 'bh').ref(body, 'body').ref(sigCell, 'owner_sig').endCell();
  const msgBody = beginCell()
    .uint(RECOVERY_STORE_OPCODE, 32, 'RecoveryStore opcode')
    .uint(bytesToBig(ownerPub), 256, 'owner_pubkey')
    .uint(BigInt(slotIndex), 32, 'slot_index')
    .uint(BigInt(seq), 64, 'seq')
    .uint(BigInt(h0), 256, 'h0')
    .uint(BigInt(h1), 256, 'h1')
    .ref(tail, 'bh+body+owner_sig sub-cell')
    .endCell();

  return {
    to: rawAddress(address),
    addressBytes: address,
    value,
    body: msgBody,
    init: recoveryShardStateInit(slotKey),
    slotKey,
    slotIndex,
    ownerPublicKey: ownerPub,
  };
}
