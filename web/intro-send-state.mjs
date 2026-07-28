// intro-send-state — the pending INTRO send, in a form that survives a reload, and the two questions a retry
// must answer before it is allowed to rebuild anything.
//
// WHY THIS IS ITS OWN MODULE. attemptIntroFirstContactDirect keeps everything the confirm and the K_root adoption
// need on `message.introDirectSend`, and its own comments lean on that state outliving the attempt: the
// idempotent-retry branch re-broadcasts the SAME external instead of minting a new capsule, and the fail-closed
// branch says in as many words that "the send state is retained, so a resend RE-BROADCASTS (no re-mint)". It was
// only ever kept in memory. A reload — or a mobile PWA killed in the background — therefore cost two things at once:
//
//   • the K_root of an INTRO THAT IS ALREADY ON CHAIN. Until the adoption at the very end it lives nowhere else,
//     so the recipient adopts the conversation and sees a first contact while the sender can never open it again.
//   • the guard against re-minting. Retry then publishes a SECOND INTRO under a NEW K_root: a double charge, and
//     per that same comment a possible fork if the two order differently on the two sides.
//
// The CONV half of the lane already persists convDirectSend for exactly this reason. This is the missing symmetry,
// and it lives here rather than in app.js so the codec and the discriminators can be tested at all.

/** Bytes -> lower-case hex. Accepts an already-hex string unchanged, so re-serialising a revived record is safe. */
const toHex = (value) => {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return [...value].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const fromHex = (hex) => {
  const text = String(hex ?? '').trim();
  if (!/^[0-9a-fA-F]+$/.test(text) || text.length % 2 !== 0) throw new Error('intro-send-state: invalid hex');
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
};

/**
 * Encode a pending INTRO send for the encrypted history.
 *
 * A plain JSON clone CANNOT carry it and would fail quietly: kRoot/introNonce/peerKeyId are Uint8Arrays, which
 * JSON turns into objects with numeric keys, and r/viewTag are BigInts, which JSON refuses outright. Handing
 * upsertConversationKRoot a byte-shaped object instead of bytes is worse than having nothing, so every field that
 * is not a plain number or string is converted explicitly here and back in the reviver.
 */
export function serializeIntroDirectSend(send) {
  if (!send) return null;
  const big = (value) => (value == null ? null : String(value));
  return {
    at: Number(send.at) || 0,
    boc: send.boc ?? null,
    kRoot: toHex(send.kRoot),
    introNonce: toHex(send.introNonce),
    peerKeyId: toHex(send.peerKeyId),
    peerWallet: send.peerWallet ?? null,
    epoch: send.epoch == null ? null : Number(send.epoch),
    bucket: send.bucket == null ? null : Number(send.bucket),
    expectedEntryId: big(send.expectedEntryId),
    r: big(send.r),
    viewTag: big(send.viewTag),
  };
}

/**
 * Decode it back. A record that will not decode yields null rather than a half-revived object: a send state with
 * a corrupt K_root would be used as if it were real, and adopting garbage is the failure this guards against.
 */
export function reviveIntroDirectSend(raw) {
  if (!raw) return null;
  try {
    return {
      at: Number(raw.at) || 0,
      boc: raw.boc ?? null,
      kRoot: raw.kRoot ? fromHex(raw.kRoot) : null,
      introNonce: raw.introNonce ? fromHex(raw.introNonce) : null,
      peerKeyId: raw.peerKeyId ? fromHex(raw.peerKeyId) : null,
      peerWallet: raw.peerWallet ?? null,
      epoch: raw.epoch == null ? null : Number(raw.epoch),
      bucket: raw.bucket == null ? null : Number(raw.bucket),
      expectedEntryId: raw.expectedEntryId == null ? null : BigInt(raw.expectedEntryId),
      r: raw.r == null ? null : BigInt(raw.r),
      viewTag: raw.viewTag == null ? null : BigInt(raw.viewTag),
    };
  } catch {
    return null;
  }
}

/**
 * Did this send ever reach the wallet? If it did, rebuilding is FORBIDDEN.
 *
 * Both direct-pay lanes record their send state BEFORE the broadcast can throw: the CONV path always lands in
 * captureConvDeliveryConfirmTarget (publishConvLaneParts attaches error.preparedParts on any throw out of the send,
 * and the capture creates convDirectSend even with a null boc), and the INTRO path assigns introDirectSend before
 * its try. So an ABSENT state means the attempt died earlier than the wallet — bundle resolution, K_root lookup,
 * the affordability check, document building — with nothing signed and nothing on chain. A PRESENT state means the
 * opposite may be true, and a rebuild would re-sign a fresh seq (CONV) or mint a second K_root (INTRO). Those cases
 * belong to the idempotent re-broadcast and the delivery confirm, never to a retry that starts over.
 */
export function directSendReachedWallet(message) {
  return message?.convDirectSend != null || message?.introDirectSend != null;
}

/**
 * Can this message be rebuilt into the SAME message after a reload?
 *
 * privateDraft is persisted deliberately thin — only the reply quote and the shared post; attachment BYTES are not
 * stored and the rebuild falls back to the message text. For a text-only message that reproduces the original
 * exactly. For one carrying images or files it would not: the retry would quietly send the caption without its
 * attachments. Sending something the user did not write is worse than the honest red status they get today, so
 * those keep today's behaviour and stay the user's call.
 */
export function sendContentSurvivesReload(message) {
  if (message?.attachment) return false;
  const blocks = Array.isArray(message?.blocks) ? message.blocks : [];
  return !blocks.some((block) => block?.type === 'image' || block?.type === 'file');
}
