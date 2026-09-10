import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import {
  createDeviceSecretSealKey,
  sealDeviceSecret,
  openDeviceSecret,
  createSealedSecretStore,
} from '../web/device-secret-store.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE NODE API KEY IS SEALED AT REST.
//
// It used to be `localStorage['platho.toncenter.apiKey.v1']` in ordinary text — handed over verbatim by any
// inspection of the browser profile or a backup of it. The first repair here was to correct the privacy policy,
// which had claimed the password protected it. [decided 2026-08-29] So the value is sealed under a non-extractable device key, the
// same model encrypted-message-store and conv-key-persist use, and the policy says what that does and does not buy.
//
// The seal is deliberately NOT bound to the vault password: the key is needed before unlock (the public feed and
// every boot read go through the transport it configures), and a keyed transport that only starts working after
// unlock would penalise exactly the users who supplied a key.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

const app = readFileSync('web/app.js', 'utf8');

function memoryBackend() {
  let blob: any = null;
  return {
    readBlob: async () => blob,
    writeBlob: async (record: any) => { blob = record; },
    deleteBlob: async () => { blob = null; },
    peek: () => blob,
  };
}

describe('DEVSECRET — a device-sealed named secret', () => {
  it('DEVSECRET-01: the value round-trips, and what is stored is ciphertext', async () => {
    const key = await createDeviceSecretSealKey();
    const backend = memoryBackend();
    const store = await createSealedSecretStore({ key, id: 'toncenter-api-key-v1', ...backend });

    expect(await store.read(), 'a device with no secret has none').toBe(null);
    await store.write('a1b2c3-secret-key');
    expect(await store.read()).toBe('a1b2c3-secret-key');

    const record = backend.peek();
    expect(record.alg).toBe('AES-256-GCM');
    // The point of the exercise: the stored bytes must not contain the value in any readable form.
    const stored = JSON.stringify(record);
    expect(stored).not.toContain('a1b2c3-secret-key');
    expect(Buffer.from(record.ciphertext, 'base64').toString('utf8')).not.toContain('a1b2c3');
    // A fresh nonce per write, or two writes of the same value would be distinguishable from each other.
    const first = backend.peek().nonce;
    await store.write('a1b2c3-secret-key');
    expect(backend.peek().nonce).not.toBe(first);
  });

  it('DEVSECRET-02: the seal key is NON-EXTRACTABLE, which is the whole difference from storing text', async () => {
    const key = await createDeviceSecretSealKey();
    expect(key.extractable, 'an exportable key beside its own ciphertext protects nothing').toBe(false);
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    await expect(globalThis.crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('DEVSECRET-03: a record cannot be moved to another named secret', async () => {
    // The id is inside the AAD, not only in the record key, so whoever can WRITE the database cannot promote one
    // secret into another's slot and have the open accept it.
    const key = await createDeviceSecretSealKey();
    const record = await sealDeviceSecret(key, 'toncenter-api-key-v1', 'a1b2c3-secret-key');
    await expect(openDeviceSecret(key, 'some-other-secret-v1', record)).rejects.toThrow();
    expect(await openDeviceSecret(key, 'toncenter-api-key-v1', record)).toBe('a1b2c3-secret-key');
  });

  it('DEVSECRET-04: another device key cannot open it, and a missing record is not an error', async () => {
    const mine = await createDeviceSecretSealKey();
    const theirs = await createDeviceSecretSealKey();
    const record = await sealDeviceSecret(mine, 'toncenter-api-key-v1', 'a1b2c3-secret-key');
    await expect(openDeviceSecret(theirs, 'toncenter-api-key-v1', record)).rejects.toThrow();
    // A device that has never stored one just has nothing — that is not a failure and must not read as tampering.
    expect(await openDeviceSecret(mine, 'toncenter-api-key-v1', null)).toBe(null);
    expect(await openDeviceSecret(mine, 'toncenter-api-key-v1', { version: 99, alg: 'AES-256-GCM', ciphertext: 'x' })).toBe(null);
  });

  it('DEVSECRET-05: clearing removes the record rather than sealing an empty one', async () => {
    const key = await createDeviceSecretSealKey();
    const backend = memoryBackend();
    const store = await createSealedSecretStore({ key, id: 'toncenter-api-key-v1', ...backend });
    await store.write('a1b2c3-secret-key');
    await store.write('   ');
    expect(backend.peek()).toBe(null);
    expect(await store.read()).toBe(null);
  });

  it('DEVSECRET-06: the app writes the key ONLY sealed, and migrates the plain-text one off', () => {
    // The plain-text store may now be READ (once, to adopt it) and REMOVED. It may never be written again.
    const writes = [...app.matchAll(/localStorage\?\.setItem\(TONCENTER_API_KEY_STORAGE_KEY/g)];
    expect(writes, 'the API key must never be written as text again').toHaveLength(0);
    expect(app).toContain('async function loadSealedToncenterApiKey()');
    expect(app).toContain("        try { globalThis.localStorage?.removeItem(TONCENTER_API_KEY_STORAGE_KEY); } catch { /* ignore */ }");
    expect(app).toContain("  try { globalThis.localStorage?.removeItem(TONCENTER_API_KEY_STORAGE_KEY); } catch { /* ignore storage errors */ }");
    // Neither synchronous reader may fall back to the plain-text store any more — including the wallet-key backup,
    // which would otherwise silently start omitting the key.
    expect([...app.matchAll(/localStorage\?\.getItem\(TONCENTER_API_KEY_STORAGE_KEY\)/g)],
      'exactly one read remains: the migration').toHaveLength(1);
    // [[clear-local-data-must-wipe-every-platho-db]]
    expect(app).toContain("  'platho-device-secrets-v1',         // device-scoped sealed settings");
  });

  it('DEVSECRET-07: the boot load starts AFTER the module is initialised', () => {
    // installConfiguredTonRuntime runs during module evaluation, hundreds of lines above the sealed store's own
    // constants. Calling into it directly threw `Cannot access... before initialization` INSIDE A PROMISE: the app
    // booted looking perfectly fine and never picked the key up, with the whole suite green over it. Fixing the
    // first binding only moved the throw to the second — the ordering was the defect, so the call is deferred.
    expect(app).toContain('queueMicrotask(() => { void loadSealedToncenterApiKey(); });');
    const boot = app.indexOf('queueMicrotask(() => { void loadSealedToncenterApiKey(); });');
    const decl = app.indexOf("const TONCENTER_API_KEY_SECRET_ID = 'toncenter-api-key-v1';");
    expect(boot, 'the call really does sit above the declarations it needs').toBeLessThan(decl);
  });
});
