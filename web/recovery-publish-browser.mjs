
import { beginCell, computeCellHashAndDepth } from './pwa-contract-transactions.mjs?v=59';
import { recoveryShardAddressBytes, recoveryShardStateInit, rawAddress } from './shard-address.mjs?v=47';
import { recoveryOwnerSlotKey } from './shard-discovery.mjs?v=104';
import { recoveryOwnerSecret, recoveryOwnerPublicKey } from './crypto/conv-routing.mjs?v=9';
import { ed25519 } from './vendor/@noble/curves/ed25519.js';

const RECOVERY_DOMAIN = 0x42525331n;
const RECOVERY_STORE_OPCODE = 0x52435631n;

const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

async function cellHashBig(cell) {
  const { hash } = await computeCellHashAndDepth(cell);
  return bytesToBig(hash);
}

export async function buildRecoveryPublishBrowser({ seed, slotIndex, seq, h0, h1, body, value }) {
  const ownerSecret = await recoveryOwnerSecret(seed, slotIndex);
  const ownerPub = await recoveryOwnerPublicKey(seed, slotIndex);
  const slotKey = await recoveryOwnerSlotKey(ownerPub, slotIndex);
  const address = await recoveryShardAddressBytes(slotKey);
  const bh = await cellHashBig(body);

  const digestCell = beginCell()
    .uint(RECOVERY_DOMAIN, 32, 'RECOVERY_DOMAIN')
    .address(rawAddress(address), 'shard address')
    .uint(slotKey, 256, 'slotKey')
    .uint(BigInt(seq), 64, 'seq')
    .ref(beginCell().uint(BigInt(h0), 256, 'h0').uint(BigInt(h1), 256, 'h1').uint(bh, 256, 'bh').endCell(), 'blob hashes')
    .endCell();
  const { hash: digest } = await computeCellHashAndDepth(digestCell);
  const sig = ed25519.sign(digest, ownerSecret);

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
