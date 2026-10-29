
export const M21C_VAULT_PUBLISH_OPCODE = 0x4D323143;

export function parseVaultPublishEnvelope(bodyCell, cellReader) {
  if (!bodyCell || typeof cellReader !== 'function') return null;
  try {
    const r = cellReader(bodyCell);
    if (r.remaining() < 32 + 4 + 267) return null;
    if (Number(r.loadUint(32)) !== M21C_VAULT_PUBLISH_OPCODE) return null;
    const coinBytes = Number(r.loadUint(4));
    if (r.remaining() < coinBytes * 8 + 267) return null;
    const feeMemo = coinBytes === 0 ? 0n : r.loadUint(coinBytes * 8);
    if (Number(r.loadUint(2)) !== 0b10) return null;
    if (Number(r.loadUint(1)) !== 0) return null;
    const workchainRaw = Number(r.loadUint(8));
    const workchain = workchainRaw > 127 ? workchainRaw - 256 : workchainRaw;
    const account = r.loadUint(256);
    if (r.refs() < 1) return null;
    const record = r.loadRef();
    if (!record) return null;
    return {
      payer: `${workchain}:${account.toString(16).padStart(64, '0')}`,
      feeMemo,
      record,
    };
  } catch {
    return null;
  }
}
