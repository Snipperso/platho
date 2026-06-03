import { beginCell, Cell } from '@ton/core';

export const HYBRID_PQ_HASH = 0x5000000000000000000000000000000000000000000000000000000000000005n;
export const HYBRID_PQ_LEN = 1184n;
export const HYBRID_CRYPTO_SUITE_MASK = 2n;

export function snakeCell(byteLength: number, fill = 0x5a): Cell {
  let tail: Cell | null = null;
  for (let offset = byteLength; offset > 0;) {
    const start = Math.max(0, offset - 127);
    const builder = beginCell().storeBuffer(Buffer.alloc(offset - start, fill));
    if (tail) builder.storeRef(tail);
    tail = builder.endCell();
    offset = start;
  }
  return tail ?? beginCell().endCell();
}

export const HYBRID_PQ_CELL = snakeCell(Number(HYBRID_PQ_LEN));

function defaultAuthPubkey(signPubkey: bigint) {
  const candidate = signPubkey ^ 1n;
  return candidate === 0n ? 2n : candidate;
}

export function hybridMessagingKeyFields(encPubkey: bigint, signPubkey: bigint, authPubkey: bigint = defaultAuthPubkey(signPubkey)) {
  return {
    enc_pubkey: encPubkey,
    sign_pubkey: signPubkey,
    auth_pubkey: authPubkey,
    pq_kem_pubkey_hash: HYBRID_PQ_HASH,
    pq_kem_pubkey_len: HYBRID_PQ_LEN,
    pq_kem_pubkey: HYBRID_PQ_CELL,
    crypto_suite_mask: HYBRID_CRYPTO_SUITE_MASK,
  };
}
