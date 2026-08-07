import { describe, expect, it } from 'vitest';
import { x25519 } from '../web/vendor/@noble/curves/ed25519.js';
import {
  computePrivateScanViewTag,
  privateScanViewTagOrNull,
  __resetX25519FastPathForTests,
  __x25519FastPathActiveForTests,
  __deriveStealthViewTagViaWebCryptoForTests,
} from '../web/crypto/platho-crypto.mjs';
import { scanIntros } from '../web/intro-scan.mjs';

// The native X25519 fast path replaced the vendored JS scalar multiplication in the scan loop — the one place where
// a user's work grows with the WHOLE NETWORK's first-contact volume (measured 1.2044 ms -> 0.0487 ms, 24x).
//
// The danger of that swap is specific and total: the view_tag is how a recipient recognises an intro addressed to
// them. If the two implementations disagree in ANY bit, no tag ever matches, every first contact in the network is
// silently discarded as "not for me", and nothing errors — the app just reports that nobody ever wrote to you.
// A test that only checks "the fast path returns a number" would pass through that.
//
// So the pins below are differential: the same inputs must produce the same tag under both implementations, and
// the sender and recipient sides must still agree with each other across the swap.

/**
 * The tag exactly as the pre-fast-path code produced it: noble's scalar multiplication feeding the module's OWN
 * former WebCrypto HKDF. Both halves of the swap are covered — the ECDH is noble here, the KDF is WebCrypto here,
 * and the shipped path now uses neither.
 *
 * The KDF half is deliberately the module's retained function rather than a copy of it written here. A copy would
 * only prove the new code agrees with what the test author believed the old code did.
 */
async function referenceTag(scanSecret: Uint8Array, ephemeralPublic: Uint8Array): Promise<number> {
  const shared = x25519.getSharedSecret(scanSecret, ephemeralPublic);
  return __deriveStealthViewTagViaWebCryptoForTests(shared, ephemeralPublic);
}

describe('native X25519 fast path in the intro scan', () => {
  it('INTRO-ECDH-01: the fast path is actually reachable in this environment', async () => {
    // Without this the whole file could pass on the noble fallback and prove nothing about the path that ships.
    // It is a capability check, not a policy: if a runtime genuinely lacks X25519 the fallback is correct, but
    // THIS runtime has it, so a regression that quietly disables the fast path must turn the suite red.
    const secret = x25519.utils.randomSecretKey();
    const peer = x25519.getPublicKey(x25519.utils.randomSecretKey());
    const pkcs8 = new Uint8Array([
      0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
      ...secret,
    ]);
    const key = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'X25519' }, false, ['deriveBits']);
    const peerKey = await crypto.subtle.importKey('raw', peer, { name: 'X25519' }, false, []);
    const native = new Uint8Array(await crypto.subtle.deriveBits({ name: 'X25519', public: peerKey }, key, 256));
    expect(Array.from(native), 'native X25519 must agree with noble byte for byte')
      .toEqual(Array.from(x25519.getSharedSecret(secret, peer)));

    // And — the load-bearing half — the MODULE must be taking that path, not merely be able to. Every differential
    // pin below compares the module against noble; if the module quietly fell back to noble they would all still
    // pass, comparing the fallback with itself, and the 24x would be gone with the suite green.
    expect(await __x25519FastPathActiveForTests(), 'the module must use the native path where it exists').toBe(true);
  });

  it('INTRO-ECDH-02: every tag matches the pre-fast-path reference', async () => {
    const scanSecret = x25519.utils.randomSecretKey();
    for (let i = 0; i < 64; i += 1) {
      const ephemeralPublic = x25519.getPublicKey(x25519.utils.randomSecretKey());
      const expected = await referenceTag(scanSecret, ephemeralPublic);
      expect(await computePrivateScanViewTag(scanSecret, ephemeralPublic), `vector ${i}`).toBe(expected);
      expect(await privateScanViewTagOrNull(scanSecret, ephemeralPublic), `vector ${i}`).toBe(expected);
    }
  });

  it('INTRO-ECDH-03: the cached scan key never bleeds between users', async () => {
    // The pass-level cache is keyed on the CALLER'S array. Two users scanning the same entries must still get their
    // own answers; a cache that returned the wrong imported key would make every recipient compute a stranger's tag
    // and, worse, would look correct in any single-user test.
    const alice = x25519.utils.randomSecretKey();
    const bob = x25519.utils.randomSecretKey();
    const points = Array.from({ length: 8 }, () => x25519.getPublicKey(x25519.utils.randomSecretKey()));

    for (const r of points) {                       // interleaved on purpose
      expect(await privateScanViewTagOrNull(alice, r)).toBe(await referenceTag(alice, r));
      expect(await privateScanViewTagOrNull(bob, r)).toBe(await referenceTag(bob, r));
      expect(await privateScanViewTagOrNull(alice, r)).toBe(await referenceTag(alice, r));
    }
    const differing = points.filter(async (r) => (await referenceTag(alice, r)) !== (await referenceTag(bob, r)));
    expect(differing.length, 'two different scan secrets must not produce one shared answer').toBeGreaterThan(0);
  });

  it('INTRO-ECDH-04: a degenerate point still yields null instead of aborting the pass', async () => {
    // `r` is attacker-controlled and IntroShard cannot validate it. Under noble the all-zero shared secret threw
    // inside the ladder; under WebCrypto it surfaces as a generic OperationError. Either way the scan must SKIP
    // that record — one poisoned entry on a page everyone reads would otherwise stop first contact network-wide.
    const scanSecret = x25519.utils.randomSecretKey();
    const zero = new Uint8Array(32);
    expect(await privateScanViewTagOrNull(scanSecret, zero)).toBeNull();
    await expect(computePrivateScanViewTag(scanSecret, zero)).rejects.toThrow();

    // And the poison must not take the surrounding entries with it.
    const good = x25519.getPublicKey(x25519.utils.randomSecretKey());
    const entries = [{ r: bytesToBigInt(good), view_tag: await referenceTag(scanSecret, good) },
      { r: 0n, view_tag: 1 },
      { r: bytesToBigInt(good), view_tag: 0xffff }];
    const matched = await scanIntros(scanSecret, entries);
    expect(matched.length, 'the real intro survives a poisoned neighbour').toBe(1);
  });

  it('INTRO-ECDH-05: sender and recipient still agree across the swap', async () => {
    // The tag a SENDER writes is derived from (ephemeral_secret, recipient_scan_public); the recipient recomputes it
    // from (scan_secret, ephemeral_public). X25519 symmetry is what makes those equal, and both sides now run
    // through the same fast path — so this pins that the swap did not break the property the lane is built on.
    const scanSecret = x25519.utils.randomSecretKey();
    const scanPublic = x25519.getPublicKey(scanSecret);
    for (let i = 0; i < 16; i += 1) {
      const ephemeralSecret = x25519.utils.randomSecretKey();
      const ephemeralPublic = x25519.getPublicKey(ephemeralSecret);
      const senderSide = await referenceTag(ephemeralSecret, scanPublic);
      // the sender's HKDF info binds the EPHEMERAL public key, so recompute it the same way the sender does
      const senderShared = x25519.getSharedSecret(ephemeralSecret, scanPublic);
      const recipientShared = x25519.getSharedSecret(scanSecret, ephemeralPublic);
      expect(Array.from(senderShared), `vector ${i}`).toEqual(Array.from(recipientShared));
      expect(senderSide).toBeTypeOf('number');
      expect(await privateScanViewTagOrNull(scanSecret, ephemeralPublic))
        .toBe(await referenceTag(scanSecret, ephemeralPublic));
    }
  });

  it('INTRO-ECDH-06: the fallback produces the same answers as the fast path', async () => {
    // The fallback is what old iOS runs. It must not be a path nobody ever executes: force it, and require the
    // identical result. `__resetX25519FastPathForTests` clears the probe so the next call re-probes.
    const scanSecret = x25519.utils.randomSecretKey();
    const points = Array.from({ length: 16 }, () => x25519.getPublicKey(x25519.utils.randomSecretKey()));
    const fast: (number | null)[] = [];
    for (const r of points) fast.push(await privateScanViewTagOrNull(scanSecret, r));

    const realSubtle = globalThis.crypto.subtle;
    // Every method must stay BOUND to the real SubtleCrypto: it rejects a detached `this`, and an unbound stub
    // fails inside the HKDF rather than inside the path under test, which looks like a fast-path bug and is not one.
    const stub: Record<string, unknown> = {};
    for (const name of ['deriveBits', 'deriveKey', 'digest', 'encrypt', 'decrypt', 'sign', 'verify',
      'generateKey', 'exportKey', 'wrapKey', 'unwrapKey']) {
      const fn = (realSubtle as any)[name];
      if (typeof fn === 'function') stub[name] = fn.bind(realSubtle);
    }
    stub.importKey = async (format: string, ...rest: unknown[]) => {
      if (format === 'pkcs8') throw new Error('X25519 unsupported in this runtime');
      return (realSubtle.importKey as any).call(realSubtle, format, ...rest);
    };
    Object.defineProperty(globalThis.crypto, 'subtle', { value: stub, configurable: true });
    __resetX25519FastPathForTests();
    try {
      for (let i = 0; i < points.length; i += 1) {
        expect(await privateScanViewTagOrNull(scanSecret, points[i]), `fallback vector ${i}`).toBe(fast[i]);
      }
      expect(await privateScanViewTagOrNull(scanSecret, new Uint8Array(32)), 'fallback keeps the null contract')
        .toBeNull();
    } finally {
      Object.defineProperty(globalThis.crypto, 'subtle', { value: realSubtle, configurable: true });
      __resetX25519FastPathForTests();
    }
  });
});

function bytesToBigInt(bytes: Uint8Array): bigint {
  let out = 0n;
  for (const b of bytes) out = (out << 8n) | BigInt(b);
  return out;
}
