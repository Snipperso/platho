import { describe, expect, it } from 'vitest';
import {
  createEncryptedPrivateCapsule,
  createMessagingIdentity,
  exportSignedPublicKeyBundle,
} from '../web/crypto/platho-crypto.mjs';
import {
  PLATHO_TRANSPORT_KIND,
  createMemoryTransportStore,
  createPrivateCapsuleTransportPackage,
  createPublicBundleTransportPackage,
  openPrivateCapsuleTransportPackage,
  parseTransportPackage,
  readPrivateCapsuleTransportPackage,
  readPublicBundleTransportPackage,
  serializeTransportPackage,
} from '../web/no-backend-transport.mjs';

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

function replayCache() {
  const seen = new Set<string>();
  return {
    async has(id: string) {
      return seen.has(id);
    },
    async add(id: string) {
      seen.add(id);
    },
  };
}

async function createSignedIdentity(label: string) {
  const identity = await createMessagingIdentity();
  const signedBundle = await exportSignedPublicKeyBundle(identity, {
    issuedAt: NOW,
    purpose: `transport-test:${label}`,
  });
  return { identity, signedBundle };
}

describe('no-backend transport packages', () => {
  it('TRANSPORT-01: imports a signed public bundle without a server lookup', async () => {
    const bob = await createSignedIdentity('bob');
    const pkg = createPublicBundleTransportPackage(bob.signedBundle, {
      createdAt: new Date(NOW).toISOString(),
      label: 'Bob device',
    });
    const parsed = parseTransportPackage(serializeTransportPackage(pkg));
    const imported = await readPublicBundleTransportPackage(parsed, { now: NOW });

    expect(parsed.kind).toBe(PLATHO_TRANSPORT_KIND.PUBLIC_BUNDLE);
    expect(imported.signedBundle.bundle.keyId).toBe(bob.signedBundle.bundle.keyId);
    expect(imported.verifiedBundle.bundle.suite).toBe('hybrid-v1');
  });

  it('TRANSPORT-02: carries an encrypted private capsule that only the recipient can open', async () => {
    const alice = await createSignedIdentity('alice');
    const bob = await createSignedIdentity('bob');
    const capsule = await createEncryptedPrivateCapsule(
      'meet at block 42',
      bob.signedBundle,
      alice.identity,
      {
        now: NOW,
        createdAt: NOW,
        ttlMs: 60_000,
        threadId: 'thread-private',
      },
    );
    const pkg = createPrivateCapsuleTransportPackage(capsule, {
      createdAt: new Date(NOW).toISOString(),
      label: 'thread-private',
    });
    const serialized = serializeTransportPackage(pkg);
    const parsed = parseTransportPackage(serialized);
    const opened = await openPrivateCapsuleTransportPackage(parsed, bob.identity.encryptionKeyPair, {
      now: NOW + 1,
    });

    expect(parsed.kind).toBe(PLATHO_TRANSPORT_KIND.PRIVATE_CAPSULE);
    expect(serialized).not.toContain('meet at block 42');
    expect(opened.plaintext).toBe('meet at block 42');
    await expect(openPrivateCapsuleTransportPackage(parsed, alice.identity.encryptionKeyPair, {
      now: NOW + 1,
    })).rejects.toThrow(/recipient|decrypt/i);
  });

  it('TRANSPORT-03: rejects transport metadata that no longer matches the capsule', async () => {
    const alice = await createSignedIdentity('alice');
    const bob = await createSignedIdentity('bob');
    const capsule = await createEncryptedPrivateCapsule('sealed body', bob.signedBundle, alice.identity, {
      now: NOW,
      createdAt: NOW,
      ttlMs: 60_000,
      threadId: 'thread-private',
    });
    const pkg = createPrivateCapsuleTransportPackage(capsule);
    const tampered = {
      ...pkg,
      recipientKeyId: alice.identity.encryptionKeyPair.keyId,
    };

    await expect(readPrivateCapsuleTransportPackage(tampered, { now: NOW + 1 })).rejects.toThrow(
      /recipient mismatch/i,
    );
  });

  it('TRANSPORT-04: uses caller replay cache to reject duplicate imported capsules', async () => {
    const alice = await createSignedIdentity('alice');
    const bob = await createSignedIdentity('bob');
    const cache = replayCache();
    const capsule = await createEncryptedPrivateCapsule('single use', bob.signedBundle, alice.identity, {
      now: NOW,
      createdAt: NOW,
      ttlMs: 60_000,
      threadId: 'thread-private',
    });
    const pkg = createPrivateCapsuleTransportPackage(capsule);

    await expect(openPrivateCapsuleTransportPackage(pkg, bob.identity.encryptionKeyPair, {
      now: NOW + 1,
      replayCache: cache,
    })).resolves.toMatchObject({ plaintext: 'single use' });
    await expect(openPrivateCapsuleTransportPackage(pkg, bob.identity.encryptionKeyPair, {
      now: NOW + 1,
      replayCache: cache,
    })).rejects.toThrow(/replay/i);
  });

  it('TRANSPORT-05: stores only transport entries in the local transport store', async () => {
    const bob = await createSignedIdentity('bob');
    const pkg = createPublicBundleTransportPackage(bob.signedBundle);
    const store = createMemoryTransportStore();
    const state = store.write({
      peers: [{ keyId: pkg.bundleKeyId, package: pkg }],
      outbox: [],
      inbox: [],
    });

    expect(state.peers).toHaveLength(1);
    expect(JSON.stringify(state)).not.toContain('plaintext');
    expect(JSON.stringify(state)).not.toContain('single use');
  });
});
