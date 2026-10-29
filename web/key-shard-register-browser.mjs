
import { beginCell, snakeCellFromBytes, computeCellHashAndDepth } from './pwa-contract-transactions.mjs?v=59';
import { keyShardAddressBytes, keyShardAddressBytesFor, keyShardStateInit, keyShardStateInitFor, rawAddress }
  from './shard-address.mjs?v=47';

const KEYSHARD_REGISTER_OPCODE = 0x4B534731n;

export async function buildKeyShardRegisterBrowser({ ownerWallet, profileRegistry, keyRecord, value }) {
  if (!keyRecord) throw new Error('buildKeyShardRegisterBrowser requires the RegisterMessagingKeys keyRecord');
  const auth = BigInt(keyRecord.auth_pubkey ?? 0n);
  const sign = BigInt(keyRecord.sign_pubkey);
  if (auth === 0n) throw new Error('KeyShard register requires a non-zero auth key (gate 22118) — refusing to brick the identity');
  if (auth === sign) throw new Error('KeyShard register requires a distinct auth key (gate 22119)');

  const address = await keyShardAddressBytes(ownerWallet, profileRegistry, 17);
  const pqKemBytes = keyRecord.pq_kem_pubkey instanceof Uint8Array ? keyRecord.pq_kem_pubkey : new Uint8Array(keyRecord.pq_kem_pubkey ?? []);
  const pqKemCell = snakeCellFromBytes(pqKemBytes, 'pq_kem_pubkey chunk');

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
    pqKemCell,
    init: keyShardStateInit(ownerWallet, profileRegistry, 17),
  };
}



const KEYSHARD_REGISTER_POP_DOMAIN = 0x4B535031n;

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

export async function keyShardRegisterPossessionDigest(args) {
  const { hash } = await computeCellHashAndDepth(keyShardRegisterPossessionPayload(args));
  return hash;
}

function bytesToBigInt(bytes) {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

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
