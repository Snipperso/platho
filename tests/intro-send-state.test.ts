import { describe, expect, it } from 'vitest';
import {
  serializeIntroDirectSend, reviveIntroDirectSend, directSendReachedWallet,
} from '../web/intro-send-state.mjs';


const bytes = (fill: number, n = 32) => new Uint8Array(n).fill(fill);

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
    for (const keyId of [PEER_KEY_ID, 'abc-_DEF0123456789abcdefghijklmnopqrstuvwxyzA', 'a'.repeat(43)]) {
      const revived = reviveIntroDirectSend(JSON.parse(JSON.stringify(serializeIntroDirectSend({ ...sample(), peerKeyId: keyId }))));
      expect(revived, `a record with peerKeyId ${keyId.slice(0, 8)}… must revive`).not.toBeNull();
      expect(revived!.peerKeyId).toBe(keyId);
      expect([...revived!.kRoot!], 'and the K_root beside it is intact').toEqual([...sample().kRoot]);
    }
    const legacy = reviveIntroDirectSend(JSON.parse(JSON.stringify(serializeIntroDirectSend({ ...sample(), peerKeyId: new Uint8Array([250, 251, 252]) as any }))));
    expect(legacy!.peerKeyId).toBe('-vv8');
    expect(reviveIntroDirectSend(JSON.parse(JSON.stringify(serializeIntroDirectSend({ ...sample(), peerKeyId: null as any }))))!.peerKeyId).toBeNull();
  });

  it('ISS-02: a plain JSON clone would have CORRUPTED it — this is why the codec exists', () => {
    const naive = JSON.parse(JSON.stringify(sample(), (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
    expect(naive.kRoot instanceof Uint8Array, 'a naive clone does NOT preserve the byte type').toBe(false);
    expect(Array.isArray(naive.kRoot)).toBe(false);
    expect(naive.kRoot['0'], 'it degrades into an index-keyed object').toBe(0x5a);
  });

  it('ISS-03: an undecodable record yields null, never a half-revived one', () => {
    expect(reviveIntroDirectSend(null)).toBeNull();
    expect(reviveIntroDirectSend({ ...serializeIntroDirectSend(sample()), kRoot: 'not-hex' })).toBeNull();
    expect(reviveIntroDirectSend({ ...serializeIntroDirectSend(sample()), r: 'not-a-number' })).toBeNull();
    expect(reviveIntroDirectSend({ ...serializeIntroDirectSend(sample()), introNonce: 'abc' })).toBeNull();
  });

  it('ISS-04: re-serialising a revived record is stable, so a reload cannot degrade it further', () => {
    const once = serializeIntroDirectSend(sample());
    const twice = serializeIntroDirectSend(reviveIntroDirectSend(JSON.parse(JSON.stringify(once)))!);
    expect(twice).toEqual(once);
  });

  it('ISS-05: any recorded send state means the wallet was reached — the ONLY safe answer is "do not rebuild"', () => {
    expect(directSendReachedWallet({}), 'nothing recorded: the attempt died before the wallet').toBe(false);
    expect(directSendReachedWallet({ convDirectSend: null, introDirectSend: null })).toBe(false);
    expect(directSendReachedWallet({ convDirectSend: { boc: null, at: 1 } }),
      'a CONV capture with a NULL boc still means the send was attempted').toBe(true);
    expect(directSendReachedWallet({ introDirectSend: { boc: null, at: 1 } }),
      'and so does an INTRO one — this is the case a reload used to erase').toBe(true);
    expect(directSendReachedWallet({ convDirectSend: { boc: 'te6', at: 1 } })).toBe(true);
  });

});
