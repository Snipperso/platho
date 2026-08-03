import { describe, expect, it } from 'vitest';
import { createMemoryConvKeyStore } from '../web/conv-key-store.mjs';
import { conversationOrder, base64urlDecode } from '../web/crypto/conv-routing.mjs';

// A keyId's canonical STRING form is base64url: computeHybridKeyId emits it, the intro capsule header carries it
// (platho-crypto base64urlEncode), introKeyIdString renders it, and conv-routing decodes it that way. conv-key-store
// hex-decoded instead — so the one identifier the two modules hand each other had two incompatible string forms, and
// every real first contact died on `peerKeyId must be 32-byte hex` AFTER the INTRO was paid for and already on chain.
// Both live paths hit it: the sender adopting a confirmed INTRO, and the recipient adopting an incoming one.
//
// It survived the suite because every existing test feeds this store raw Uint8Arrays, which skip the string branch.
// So this file drives the PRODUCTION form specifically.
const SELF = Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff);
const PEER = Uint8Array.from({ length: 32 }, (_, i) => (i * 11 + 5) & 0xff);
const b64url = (b: Uint8Array) => Buffer.from(b).toString('base64url');
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const candidate = (peerKeyId: unknown) => ({
  kRoot: new Uint8Array(32).fill(9),
  createdAt: 1785693962,
  introNonce: new Uint8Array(16).fill(4),
  peerKeyId,
  peerEncPublicKey: null,
  peerWallet: null,
});

describe('KEYID-FORM — the two modules must accept the same string form', () => {
  it('KEYFORM-01: conv-routing decodes base64url, and routes a string key exactly like its bytes', () => {
    expect([...base64urlDecode(b64url(SELF))]).toEqual([...SELF]);
    expect(conversationOrder(b64url(SELF), b64url(PEER))).toEqual(conversationOrder(SELF, PEER));
  });

  it('KEYFORM-02: the store adopts a K_root in the base64url form both live paths pass', async () => {
    const store: any = createMemoryConvKeyStore();
    // Exactly the production shape: the base64url string in BOTH the argument and the candidate field.
    expect(await store.upsertConversationKRoot(b64url(SELF), b64url(PEER), candidate(b64url(PEER)))).toBe('created');
    const record = store.getConversation(b64url(SELF), b64url(PEER));
    expect([...record.peerKeyId]).toEqual([...PEER]);
    // and the same conversation is found when the caller holds bytes — one conversation, not two.
    expect(store.getConversation(SELF, PEER)).toBe(record);
  });

  it('KEYFORM-03: hex still works, so records written before the fix keep loading', async () => {
    const store: any = createMemoryConvKeyStore();
    expect(await store.upsertConversationKRoot(SELF, PEER, candidate(hex(PEER)))).toBe('created');
    expect([...store.getConversation(SELF, PEER).peerKeyId]).toEqual([...PEER]);
  });

  it('KEYFORM-04: garbage is still refused — this widened the accepted forms, it did not remove the check', async () => {
    // The counter-case. Without it "accept base64url too" could drift into "accept anything", and a malformed peer key
    // would be adopted into a conversation instead of rejected. NOTE: upsert overrides candidate.peerKeyId with its
    // own argument, so the bad value has to go in BOTH to reach the validator — a shape worth pinning in its own right.
    const store: any = createMemoryConvKeyStore();
    const bad = (v: unknown) => store.upsertConversationKRoot(SELF, v, candidate(v));
    await expect(bad('nope')).rejects.toThrow();
    await expect(bad(b64url(new Uint8Array(31)))).rejects.toThrow();       // right alphabet, wrong length
    await expect(bad(hex(new Uint8Array(33)))).rejects.toThrow();
  });
});
