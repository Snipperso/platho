import { describe, expect, it } from 'vitest';
import { x25519 } from '@noble/curves/ed25519.js';
import { computePrivateScanViewTag } from '../web/crypto/platho-crypto.mjs';
import { scanIntros, scanIntroIndices } from '../web/intro-scan.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTRO-SCAN — the recipient finds THEIR first contacts among all intros, leak-free, without revealing themselves.
//
// The sender wrote a stealth view_tag = f(X25519(eph_sec, recipient_scan_pub), eph_pub). By X25519 symmetry the
// recipient reproduces it as computePrivateScanViewTag(scan_sec, eph_pub). So the recipient can identify their own
// intros from the compact (r, view_tag) alone — no on-chain link to them, no secret leaving the client. These tests
// prove the scan finds the recipient's intro and (essentially) ignores everyone else's.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const bufToInt = (b: Uint8Array): bigint => BigInt('0x' + Buffer.from(b).toString('hex'));

// Build the on-chain intro entry a sender would publish TO `recipientScanPub`, using an ephemeral `eph`.
// The stored view_tag equals what the recipient will recompute (X25519 symmetry), so we derive it via the
// recipient-side primitive against the recipient's OWN secret — exactly what the contract stored.
async function introFor(recipientScanSec: Uint8Array, eph: { sec: Uint8Array; pub: Uint8Array }, commit: bigint) {
  const view_tag = BigInt(await computePrivateScanViewTag(recipientScanSec, bufToInt(eph.pub)));
  return { r: bufToInt(eph.pub), view_tag, body_commit: commit };
}

function x25519Key() {
  const sec = x25519.utils.randomSecretKey();
  return { sec, pub: x25519.getPublicKey(sec) };
}

describe('INTRO-SCAN — recipient finds their own intros, leak-free', () => {
  it('SCAN-01: the scan finds the intro addressed to the recipient', async () => {
    const me = x25519Key();
    const eph = x25519Key();
    const entry = await introFor(me.sec, eph, 0xAAAAn);
    const found = await scanIntros(me.sec, [entry]);
    expect(found.length).toBe(1);
    expect(found[0].body_commit).toBe(0xAAAAn);
  });

  it('SCAN-02: the recipient picks out their intro among many decoys addressed to OTHER recipients', async () => {
    const me = x25519Key();
    const mine = await introFor(me.sec, x25519Key(), 0x1234n);

    // 200 decoys, each addressed to a DIFFERENT random recipient (their view_tags derive from other scan keys).
    const entries: any[] = [];
    for (let i = 0; i < 100; i++) entries.push(await introFor(x25519Key().sec, x25519Key(), BigInt(i)));
    entries.push(mine);
    for (let i = 100; i < 200; i++) entries.push(await introFor(x25519Key().sec, x25519Key(), BigInt(i)));

    const idx = await scanIntroIndices(me.sec, entries);
    // mine (at index 100) must be found; false positives are ~1/65536 per decoy, so with 200 decoys the expected
    // number of spurious matches is ~0.003 — assert mine is present and the candidate set is tiny.
    expect(idx).toContain(100);
    expect(idx.length).toBeLessThanOrEqual(2);   // mine + at most a rare 16-bit collision
    // stage 2 (full decrypt) would drop any collision; here we just confirm the cheap filter is selective.
  }, 60_000);

  it('SCAN-03: an intro addressed to someone else is (essentially always) not a candidate for me', async () => {
    const me = x25519Key();
    const someoneElse = x25519Key();
    const theirIntro = await introFor(someoneElse.sec, x25519Key(), 0x9999n);
    const found = await scanIntros(me.sec, [theirIntro]);
    // 16-bit tag -> ~1/65536 chance of a spurious match; overwhelmingly this is empty. (Stage-2 decrypt would drop it.)
    expect(found.length).toBe(0);
  });
});
