
const toHex = (value) => {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return [...value].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const base64urlOfBytes = (bytes) => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    out += B64URL[a >> 2] + B64URL[((a & 3) << 4) | ((b ?? 0) >> 4)]
      + (b === undefined ? '' : B64URL[((b & 15) << 2) | ((c ?? 0) >> 6)])
      + (c === undefined ? '' : B64URL[c & 63]);
  }
  return out;
};

const fromHex = (hex) => {
  const text = String(hex ?? '').trim();
  if (!/^[0-9a-fA-F]+$/.test(text) || text.length % 2 !== 0) throw new Error('intro-send-state: invalid hex');
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
};

export function serializeIntroDirectSend(send) {
  if (!send) return null;
  const big = (value) => (value == null ? null : String(value));
  return {
    at: Number(send.at) || 0,
    boc: send.boc ?? null,
    kRoot: toHex(send.kRoot),
    introNonce: toHex(send.introNonce),
    peerKeyId: send.peerKeyId == null ? null : (typeof send.peerKeyId === 'string' ? send.peerKeyId : base64urlOfBytes(send.peerKeyId)),
    peerWallet: send.peerWallet ?? null,
    epoch: send.epoch == null ? null : Number(send.epoch),
    bucket: send.bucket == null ? null : Number(send.bucket),
    expectedEntryId: big(send.expectedEntryId),
    r: big(send.r),
    viewTag: big(send.viewTag),
    seqno: send.seqno == null ? null : Number(send.seqno),
    seqnoConsumedAt: Number(send.seqnoConsumedAt) || 0,
    validUntil: Number(send.validUntil) > 0 ? Number(send.validUntil) : null,
  };
}

export function reviveIntroDirectSend(raw) {
  if (!raw) return null;
  try {
    return {
      at: Number(raw.at) || 0,
      boc: raw.boc ?? null,
      kRoot: raw.kRoot ? fromHex(raw.kRoot) : null,
      introNonce: raw.introNonce ? fromHex(raw.introNonce) : null,
      peerKeyId: raw.peerKeyId == null || raw.peerKeyId === '' ? null : String(raw.peerKeyId),
      peerWallet: raw.peerWallet ?? null,
      epoch: raw.epoch == null ? null : Number(raw.epoch),
      bucket: raw.bucket == null ? null : Number(raw.bucket),
      expectedEntryId: raw.expectedEntryId == null ? null : BigInt(raw.expectedEntryId),
      r: raw.r == null ? null : BigInt(raw.r),
      viewTag: raw.viewTag == null ? null : BigInt(raw.viewTag),
      seqno: raw.seqno == null ? null : Number(raw.seqno),
      seqnoConsumedAt: Number(raw.seqnoConsumedAt) || 0,
      validUntil: Number(raw.validUntil) > 0 ? Number(raw.validUntil) : null,
    };
  } catch {
    return null;
  }
}

export function directSendReachedWallet(message) {
  return message?.convDirectSend != null || message?.introDirectSend != null;
}
