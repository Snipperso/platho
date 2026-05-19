import { describe, expect, it } from 'vitest';
import {
  createMessagingIdentity,
  exportSignedPublicKeyBundle,
} from '../web/crypto/platho-crypto.mjs';
import { createPublicBundleTransportPackage } from '../web/no-backend-transport.mjs';
import {
  canRenderTransportQr,
  createTransportQrSvg,
  createTransportSharePayload,
  parseTransportShareText,
  transportShareFilename,
} from '../web/transport-share.mjs';

const NOW = Date.UTC(2026, 0, 4, 12, 0, 0);

async function publicBundlePackage() {
  const identity = await createMessagingIdentity();
  const signedBundle = await exportSignedPublicKeyBundle(identity, {
    issuedAt: NOW,
    purpose: 'transport-share-test',
  });
  return createPublicBundleTransportPackage(signedBundle, {
    createdAt: new Date(NOW).toISOString(),
    label: 'Share test',
  });
}

describe('transport share UX helpers', () => {
  it('SHARE-01: serializes transport package for clipboard/share without changing import format', async () => {
    const pkg = await publicBundlePackage();
    const payload = createTransportSharePayload(pkg);
    const parsed = parseTransportShareText(payload.text);

    expect(payload.filename).toBe(transportShareFilename(pkg));
    expect(payload.mimeType).toBe('application/json');
    expect(parsed.kind).toBe('platho.public-bundle.v1');
    expect(parsed.bundleKeyId).toBe(pkg.bundleKeyId);
  });

  it('SHARE-02: renders public bundle package as QR SVG when it fits', async () => {
    const pkg = await publicBundlePackage();
    const qr = createTransportQrSvg(pkg);

    expect(canRenderTransportQr(pkg)).toBe(true);
    expect(qr.bytes).toBeGreaterThan(1000);
    expect(qr.moduleCount).toBeGreaterThan(20);
    expect(qr.svg).toContain('<svg');
    expect(qr.svg).toContain('<path');
  });

  it('SHARE-03: refuses oversized QR payloads but keeps share serialization available', () => {
    const largePackage = {
      version: 1,
      kind: 'platho.private-capsule.v1',
      capsuleId: 'large-capsule',
      capsule: { ciphertext: 'x'.repeat(4000) },
    };
    const payload = createTransportSharePayload(largePackage);

    expect(payload.bytes).toBeGreaterThan(2950);
    expect(canRenderTransportQr(largePackage)).toBe(false);
    expect(() => createTransportQrSvg(largePackage)).toThrow(/too large/i);
  });
});
