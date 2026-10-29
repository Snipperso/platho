import { describe, expect, it } from 'vitest';
import {
  createHybridKeyPair,
  exportPublicKeyBundle,
  encryptText,
  decryptText,
  __resetX25519FastPathForTests,
  __x25519FastPathActiveForTests,
} from '../web/crypto/platho-crypto.mjs';


async function withFallback<T>(fn: () => Promise<T>): Promise<T> {
  const realSubtle = globalThis.crypto.subtle;
  const stub: Record<string, unknown> = {};
  for (const name of ['deriveBits', 'deriveKey', 'digest', 'encrypt', 'decrypt', 'sign', 'verify',
    'generateKey', 'exportKey', 'wrapKey', 'unwrapKey']) {
    const method = (realSubtle as any)[name];
    if (typeof method === 'function') stub[name] = method.bind(realSubtle);
  }
  stub.importKey = async (format: string, ...rest: unknown[]) => {
    if (format === 'pkcs8') throw new Error('X25519 unsupported in this runtime');
    return (realSubtle.importKey as any).call(realSubtle, format, ...rest);
  };
  Object.defineProperty(globalThis.crypto, 'subtle', { value: stub, configurable: true });
  __resetX25519FastPathForTests();
  try {
    return await fn();
  } finally {
    Object.defineProperty(globalThis.crypto, 'subtle', { value: realSubtle, configurable: true });
    __resetX25519FastPathForTests();
  }
}

describe('native X25519 on the message path stays wire-compatible with the JS fallback', () => {
  it('MSG-ECDH-01: the fast path is live here, so the crossings below are real', async () => {
    expect(await __x25519FastPathActiveForTests()).toBe(true);
  });

  it('MSG-ECDH-02: sealed natively, opened by the JS fallback', async () => {
    const recipient = await createHybridKeyPair();
    const bundle = exportPublicKeyBundle(recipient);
    const text = 'сообщение через границу реализаций — 🔐 — 1234567890';

    const envelope = await encryptText(text, bundle);
    const opened = await withFallback(() => decryptText(envelope, recipient));
    expect(opened.plaintext ?? opened.text ?? opened).toBeTruthy();
    expect(JSON.stringify(opened)).toContain('сообщение через границу');
  });

  it('MSG-ECDH-03: sealed by the JS fallback, opened natively', async () => {
    const recipient = await createHybridKeyPair();
    const bundle = exportPublicKeyBundle(recipient);
    const text = 'the other direction, which is the one an old phone actually sends';

    const envelope = await withFallback(() => encryptText(text, bundle));
    const opened = await decryptText(envelope, recipient);
    expect(JSON.stringify(opened)).toContain('the other direction');
  });

  it('MSG-ECDH-04: many messages to ONE recipient all open — the imported key is cached per secret', async () => {
    const recipient = await createHybridKeyPair();
    const bundle = exportPublicKeyBundle(recipient);
    for (let i = 0; i < 12; i += 1) {
      const envelope = await encryptText(`batch message ${i}`, bundle);
      const opened = await decryptText(envelope, recipient);
      expect(JSON.stringify(opened), `message ${i}`).toContain(`batch message ${i}`);
    }
  });

  it('MSG-ECDH-05: two recipients never receive each other\'s plaintext', async () => {
    const alice = await createHybridKeyPair();
    const bob = await createHybridKeyPair();
    const forAlice = await encryptText('for alice only', exportPublicKeyBundle(alice));
    const forBob = await encryptText('for bob only', exportPublicKeyBundle(bob));

    expect(JSON.stringify(await decryptText(forAlice, alice))).toContain('for alice only');
    expect(JSON.stringify(await decryptText(forBob, bob))).toContain('for bob only');
    await expect(decryptText(forAlice, bob)).rejects.toThrow();
    await expect(decryptText(forBob, alice)).rejects.toThrow();
  });
});
