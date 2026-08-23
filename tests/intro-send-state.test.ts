import { describe, expect, it } from 'vitest';
import {
  serializeIntroDirectSend, reviveIntroDirectSend, directSendReachedWallet, sendContentSurvivesReload,
} from '../web/intro-send-state.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTRO-SEND-STATE — what a reload must not cost a first contact.
//
// attemptIntroFirstContactDirect keeps the K_root, the intro nonce and the stealth fields on the message while it
// waits for the contract's created_at, and its own comments lean on that state outliving the attempt: the retry
// branch re-broadcasts the SAME external instead of minting a new capsule, and the fail-closed branch says "the
// send state is retained, so a resend RE-BROADCASTS (no re-mint)". It was memory-only, so a reload cost:
//   • the K_root of an INTRO ALREADY ON CHAIN — the recipient sees the conversation, the sender never can;
//   • the anti-re-mint guard — Retry publishes a SECOND INTRO under a NEW K_root: double charge, possible fork.
//
// The two things these tests hold down are the two ways the fix could be worse than the defect: a codec that
// looks like it worked while corrupting the K_root, and a resume that rebuilds a send which actually went out.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const bytes = (fill: number, n = 32) => new Uint8Array(n).fill(fill);

// peerKeyId is what the app stores: bundle.keyId — computeHybridKeyId's base64url STRING (43 characters, with '-' and
// '_' in its alphabet), never bytes. The first version of this fixture used 32 bytes here, which is exactly what hid
// the defect ISS-07 pins: the hex codec passed a string out unchanged and then refused it on the way back in.
const PEER_KEY_ID = 'Qm9iS2V5SWQtMjAyNl8wOF8yM19iYXNlNjR1cmxfU1RS';

const sample = () => ({
  at: 1_790_000_000_000,
  boc: 'te6ccgEBAQEAAgAAAA==',
  kRoot: bytes(0x5a),
  introNonce: bytes(0x11, 16),
  peerKeyId: PEER_KEY_ID,
  seqno: 41,
  seqnoConsumedAt: 0,
  peerWallet: 'EQBOSbFHf8Iqe390MhsuN8RywBimRbzTwq8dtnN9fN4MyZOP',
  epoch: 20_717,
  bucket: 391,
  expectedEntryId: 7n,
  r: 0x9f2c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091an,
  viewTag: 41_235n,
});

describe('INTRO-SEND-STATE', () => {
  it('ISS-01: the send state survives the JSON round-trip the encrypted history puts it through', () => {
    const original = sample();
    // The history is JSON: what goes to disk is stringified and parsed back, so the test must do the same rather
    // than hand the reviver the serializer's live object.
    const stored = JSON.parse(JSON.stringify(serializeIntroDirectSend(original)));
    const revived = reviveIntroDirectSend(stored);

    expect(revived!.kRoot, 'the K_root comes back as BYTES').toBeInstanceOf(Uint8Array);
    expect([...revived!.kRoot!]).toEqual([...original.kRoot]);
    expect([...revived!.introNonce!]).toEqual([...original.introNonce]);
    expect(revived!.peerKeyId, 'the peer key id comes back as the SAME STRING (it is compared to bundle.keyId as a string)').toBe(original.peerKeyId);
    expect(revived!.seqno, 'the seqno the external was signed for survives').toBe(41);
    expect(revived!.seqnoConsumedAt).toBe(0);
    expect(revived!.r, 'the stealth R stays a BigInt of the same value').toBe(original.r);
    expect(revived!.viewTag).toBe(original.viewTag);
    expect(revived!.expectedEntryId).toBe(original.expectedEntryId);
    expect(revived!.boc).toBe(original.boc);
    expect(revived!.peerWallet).toBe(original.peerWallet);
    expect(revived!.epoch).toBe(original.epoch);
    expect(revived!.bucket).toBe(original.bucket);
  });

  it('ISS-07: a REAL key id (base64url string) survives the round-trip — the hex codec nulled the whole record', () => {
    // FOUND IN THE DESIGN-INTEGRATION REVIEW (2026-08-22/23): attemptIntroFirstContactDirect stores peerKeyId =
    // bundle.keyId, a 43-char base64url string; the old serializer passed it through toHex unchanged and the reviver
    // ran fromHex on it, which throws (not hex, odd length) — and the catch turned the WHOLE record into null. So no
    // INTRO send ever survived a reload, and a retry after reload minted a second INTRO (double charge, possible
    // fork) — the very failure this module exists to prevent.
    for (const keyId of [PEER_KEY_ID, 'abc-_DEF0123456789abcdefghijklmnopqrstuvwxyzA', 'a'.repeat(43)]) {
      const revived = reviveIntroDirectSend(JSON.parse(JSON.stringify(serializeIntroDirectSend({ ...sample(), peerKeyId: keyId }))));
      expect(revived, `a record with peerKeyId ${keyId.slice(0, 8)}… must revive`).not.toBeNull();
      expect(revived!.peerKeyId).toBe(keyId);
      expect([...revived!.kRoot!], 'and the K_root beside it is intact').toEqual([...sample().kRoot]);
    }
    // A legacy record that somehow carried bytes is revived as the string every consumer expects (base64url of them).
    const legacy = reviveIntroDirectSend(JSON.parse(JSON.stringify(serializeIntroDirectSend({ ...sample(), peerKeyId: new Uint8Array([250, 251, 252]) as any }))));
    expect(legacy!.peerKeyId).toBe('-vv8');
    // And an absent one stays absent rather than becoming the string "null".
    expect(reviveIntroDirectSend(JSON.parse(JSON.stringify(serializeIntroDirectSend({ ...sample(), peerKeyId: null as any }))))!.peerKeyId).toBeNull();
  });

  it('ISS-02: a plain JSON clone would have CORRUPTED it — this is why the codec exists', () => {
    // The mutation this module is the fix for. safeJsonClone handles BigInt but not Uint8Array: the bytes come
    // back as an object with numeric keys, which upsertConversationKRoot would accept as a K_root and store as
    // garbage. A silent wrong key is worse than a missing one, so the failure is pinned rather than assumed.
    const naive = JSON.parse(JSON.stringify(sample(), (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
    expect(naive.kRoot instanceof Uint8Array, 'a naive clone does NOT preserve the byte type').toBe(false);
    expect(Array.isArray(naive.kRoot)).toBe(false);
    expect(naive.kRoot['0'], 'it degrades into an index-keyed object').toBe(0x5a);
  });

  it('ISS-03: an undecodable record yields null, never a half-revived one', () => {
    expect(reviveIntroDirectSend(null)).toBeNull();
    expect(reviveIntroDirectSend({ ...serializeIntroDirectSend(sample()), kRoot: 'not-hex' })).toBeNull();
    expect(reviveIntroDirectSend({ ...serializeIntroDirectSend(sample()), r: 'not-a-number' })).toBeNull();
    // Odd-length hex is the subtle one: it parses byte-by-byte without complaint if the length is not checked.
    expect(reviveIntroDirectSend({ ...serializeIntroDirectSend(sample()), introNonce: 'abc' })).toBeNull();
  });

  it('ISS-04: re-serialising a revived record is stable, so a reload cannot degrade it further', () => {
    const once = serializeIntroDirectSend(sample());
    const twice = serializeIntroDirectSend(reviveIntroDirectSend(JSON.parse(JSON.stringify(once)))!);
    expect(twice).toEqual(once);
  });

  it('ISS-05: any recorded send state means the wallet was reached — the ONLY safe answer is "do not rebuild"', () => {
    // Both lanes record BEFORE the broadcast can throw, so presence is the conservative signal on purpose: a
    // rebuild past this point re-signs a fresh seq (CONV) or mints a second K_root (INTRO).
    expect(directSendReachedWallet({}), 'nothing recorded: the attempt died before the wallet').toBe(false);
    expect(directSendReachedWallet({ convDirectSend: null, introDirectSend: null })).toBe(false);
    expect(directSendReachedWallet({ convDirectSend: { boc: null, at: 1 } }),
      'a CONV capture with a NULL boc still means the send was attempted').toBe(true);
    expect(directSendReachedWallet({ introDirectSend: { boc: null, at: 1 } }),
      'and so does an INTRO one — this is the case a reload used to erase').toBe(true);
    expect(directSendReachedWallet({ convDirectSend: { boc: 'te6', at: 1 } })).toBe(true);
  });

  it('ISS-06: only a message that reproduces exactly may be resent unattended', () => {
    expect(sendContentSurvivesReload({ text: 'привет', blocks: [{ type: 'text', text: 'привет' }] })).toBe(true);
    expect(sendContentSurvivesReload({ text: 'привет' }), 'no blocks at all is text-only').toBe(true);
    // A reply quote and a shared post ARE persisted, so they rebuild faithfully.
    expect(sendContentSurvivesReload({ blocks: [{ type: 'reply' }, { type: 'share' }, { type: 'text' }] })).toBe(true);
    // Bytes are not. Resending the caption without its picture is sending something the user never wrote.
    expect(sendContentSurvivesReload({ blocks: [{ type: 'text' }, { type: 'image', bytes: [1, 2] }] })).toBe(false);
    expect(sendContentSurvivesReload({ blocks: [{ type: 'file', name: 'a.pdf' }] })).toBe(false);
    expect(sendContentSurvivesReload({ attachment: { name: 'legacy' } })).toBe(false);
  });
});
