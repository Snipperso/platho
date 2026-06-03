import { describe, expect, it } from 'vitest';
import { Cell } from '@ton/core';
import {
  CRYPTO_SUITES,
  PLATHO_BINARY_HEADER0_BYTES,
  PLATHO_BINARY_HEADER1_BYTES,
  PLATHO_COMPACT_BODY_LAYOUT,
  PLATHO_COMPACT_IMAGE_FORMATS,
  PLATHO_COMPACT_PAYLOAD_PREFIX_BYTES,
  PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES,
  PLATHO_COMPACT_TEXT_BLOCK_BYTES,
  PLATHO_ONCHAIN_BODY_MAX_BYTES,
  PLATHO_ONCHAIN_CELL_LAYOUT,
  createEncryptedPrivateCapsule,
  createMessagingIdentity,
  decodeCompactPayload,
  encodeCompactPayload,
  exportSignedPublicKeyBundle,
  getCompactCapsuleCapacity,
  openEncryptedPrivateCapsule,
  openPrivateCapsuleChainEntry,
  verifyEncryptedPrivateCapsule,
} from '../web/crypto/platho-crypto.mjs';

const NOW = Date.UTC(2026, 0, 4, 12, 0, 0);
const SENDER_WALLET = `0:${'12'.repeat(32)}`;

function bocHashHex(boc: string): string {
  return `0x${Cell.fromBoc(Buffer.from(boc, 'base64'))[0].hash().toString('hex')}`;
}

function indexedCrcBoc(boc: string): string {
  return Cell.fromBoc(Buffer.from(boc, 'base64'))[0].toBoc({ idx: true, crc32: true }).toString('base64');
}

async function signedIdentity(suite: string) {
  const identity = await createMessagingIdentity({ suite });
  const signedBundle = await exportSignedPublicKeyBundle(identity, {
    issuedAt: NOW,
    expiresAt: NOW + 60_000,
    purpose: `compact-layout:${suite}`,
  });
  return { identity, signedBundle };
}

async function compactRoundtrip(suite: string, textBytes: number) {
  const alice = await signedIdentity(suite);
  const bob = await signedIdentity(suite);
  const text = 'a'.repeat(textBytes);
  const capsule = await createEncryptedPrivateCapsule(text, bob.signedBundle, alice.identity, {
    now: NOW,
    createdAt: NOW,
    expiresAt: NOW + 60_000,
    threadId: `thread-${suite}`,
  });
  const opened = await openEncryptedPrivateCapsule(capsule, bob.identity.encryptionKeyPair, {
    now: NOW + 1,
  });
  return { capsule, opened, text };
}

describe('Platho compact byte layout v1', () => {
  it('COMPACT-01: fixes exact useful payload capacity for postquantum capsules', () => {
    const hybrid = getCompactCapsuleCapacity(CRYPTO_SUITES.HYBRID_V1);
    const hybrid32 = getCompactCapsuleCapacity(CRYPTO_SUITES.HYBRID_V1, { sizeClass: 32 });

    expect(PLATHO_BINARY_HEADER0_BYTES).toBe(140);
    expect(PLATHO_BINARY_HEADER1_BYTES).toBe(30);
    expect(hybrid).toMatchObject({
      sizeClass: 1,
      maxChunks: 1,
      maxChunkWireBytes: 4096,
      chunkHeaderBytes: 24,
      onChainBodyCapBytes: PLATHO_ONCHAIN_BODY_MAX_BYTES,
      payloadBlockBytes: PLATHO_COMPACT_TEXT_BLOCK_BYTES,
      payloadPrefixBytes: PLATHO_COMPACT_PAYLOAD_PREFIX_BYTES,
      oneChunkPlaintextBytes: 1056,
      oneChunkBodyBytes: 2228,
      maxBodyBytes: 2228,
      maxEncryptedPayloadBytes: 1056,
      maxUsefulPayloadBytes: 1024,
      maxTextBytes: 1024,
      maxImageBytes: 1024,
      maxPaymentBytes: 82,
    });
    expect(hybrid32).toMatchObject({
      sizeClass: 32,
      maxBodyBytes: 33972,
      maxEncryptedPayloadBytes: 32800,
      maxUsefulPayloadBytes: 32768,
      maxTextBytes: 32768,
      maxImageBytes: 32768,
    });
  });

  it('COMPACT-02: pads each capsule into the smallest supported useful slot', () => {
    const tiny = encodeCompactPayload('Привет');
    const mid = encodeCompactPayload('a'.repeat(500));
    const full = encodeCompactPayload('a'.repeat(1024));
    const twoK = encodeCompactPayload('a'.repeat(1025));

    expect(tiny.length).toBe(1056);
    expect(mid.length).toBe(1056);
    expect(full.length).toBe(1056);
    expect(twoK.length).toBe(2080);
    expect(() => encodeCompactPayload({ type: 'text', text: 'a'.repeat(1025), sizeClass: 1 })).toThrow(/selected capsule size/i);
    expect(decodeCompactPayload(tiny)).toMatchObject({ type: 'text', text: 'Привет' });
  });

  it('COMPACT-03: roundtrips max-size postquantum text inside the on-chain body cap', async () => {
    const capacity = getCompactCapsuleCapacity(CRYPTO_SUITES.HYBRID_V1);
    const { capsule, opened, text } = await compactRoundtrip(CRYPTO_SUITES.HYBRID_V1, capacity.maxTextBytes);

    expect(capsule.body.layout).toBe(PLATHO_COMPACT_BODY_LAYOUT);
    expect(capsule.body.envelope).toBeUndefined();
    expect(capsule.body.byteLength).toBe(2228);
    expect(capsule.body.bodyBytes).toBeTypeOf('string');
    expect(capsule.body.chunks).toBeUndefined();
    expect(capsule.publish.body_cell.layout).toBe(PLATHO_ONCHAIN_CELL_LAYOUT);
    expect(capsule.publish.header_0_cell.bytes).toBe(PLATHO_BINARY_HEADER0_BYTES);
    expect(capsule.header0.profileVersion).toBe(0);
    expect(capsule.header0.avatarHash).toBe(`0x${'00'.repeat(32)}`);
    expect(capsule.publish.header_1_cell.bytes).toBe(PLATHO_BINARY_HEADER1_BYTES);
    expect(capsule.publish.body_cell.bytes).toBe(capsule.body.byteLength);
    expect(bocHashHex(capsule.publish.body_cell.boc)).toBe(capsule.publish.body_hash);
    expect(opened.plaintext).toBe(text);
  });

  it('COMPACT-04: roundtrips max-size postquantum text inside the same useful cap', async () => {
    const capacity = getCompactCapsuleCapacity(CRYPTO_SUITES.HYBRID_V1);
    const { capsule, opened, text } = await compactRoundtrip(CRYPTO_SUITES.HYBRID_V1, capacity.maxTextBytes);

    expect(capsule.body.layout).toBe(PLATHO_COMPACT_BODY_LAYOUT);
    expect(capsule.body.envelope).toBeUndefined();
    expect(capsule.body.byteLength).toBe(2228);
    expect(capsule.body.bodyBytes).toBeTypeOf('string');
    expect(capsule.body.chunks).toBeUndefined();
    expect(capsule.publish.body_cell.layout).toBe(PLATHO_ONCHAIN_CELL_LAYOUT);
    expect(capsule.publish.header_0_cell.bytes).toBe(PLATHO_BINARY_HEADER0_BYTES);
    expect(capsule.publish.header_1_cell.bytes).toBe(PLATHO_BINARY_HEADER1_BYTES);
    expect(capsule.publish.body_cell.bytes).toBe(capsule.body.byteLength);
    expect(bocHashHex(capsule.publish.body_cell.boc)).toBe(capsule.publish.body_hash);
    expect(opened.plaintext).toBe(text);
  });

  it('COMPACT-04B: private header0 carries signed wallet avatar pointer', async () => {
    const alice = await signedIdentity(CRYPTO_SUITES.HYBRID_V1);
    const bob = await signedIdentity(CRYPTO_SUITES.HYBRID_V1);
    const avatarHash = `0x${'51'.repeat(32)}`;
    const capsule = await createEncryptedPrivateCapsule('with avatar pointer', bob.signedBundle, alice.identity, {
      now: NOW,
      createdAt: NOW,
      expiresAt: NOW + 60_000,
      profileVersion: 9,
      avatarHash,
    });
    const verified = await verifyEncryptedPrivateCapsule(capsule, { now: NOW + 1 });

    expect(capsule.publish.header_0_cell.bytes).toBe(PLATHO_BINARY_HEADER0_BYTES);
    expect(verified.capsule.header0.profileVersion).toBe(9);
    expect(verified.capsule.header0.avatarHash).toBe(avatarHash);
  });

  it('COMPACT-04C: encrypted compact payload can carry sender wallet metadata without changing header0', async () => {
    const alice = await signedIdentity(CRYPTO_SUITES.HYBRID_V1);
    const bob = await signedIdentity(CRYPTO_SUITES.HYBRID_V1);
    const capsule = await createEncryptedPrivateCapsule('with sender wallet', bob.signedBundle, alice.identity, {
      now: NOW,
      createdAt: NOW,
      expiresAt: NOW + 60_000,
      senderWallet: SENDER_WALLET,
      senderVaultKeyId: 123n,
    });
    const opened = await openEncryptedPrivateCapsule(capsule, bob.identity.encryptionKeyPair, {
      now: NOW + 1,
    });

    expect(PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES).toBe(69);
    expect(capsule.publish.header_0_cell.bytes).toBe(PLATHO_BINARY_HEADER0_BYTES);
    expect(opened.plaintext).toBe('with sender wallet');
    expect(opened.payload.senderWallet).toBe(SENDER_WALLET);
    expect(opened.payload.senderVaultKeyId).toBe('123');
  });

  it('COMPACT-04D: encrypted compact payload can remain anonymous without sender wallet metadata', async () => {
    const alice = await signedIdentity(CRYPTO_SUITES.HYBRID_V1);
    const bob = await signedIdentity(CRYPTO_SUITES.HYBRID_V1);
    const capsule = await createEncryptedPrivateCapsule('anonymous payload', bob.signedBundle, alice.identity, {
      now: NOW,
      createdAt: NOW,
      expiresAt: NOW + 60_000,
    });
    const opened = await openEncryptedPrivateCapsule(capsule, bob.identity.encryptionKeyPair, {
      now: NOW + 1,
    });

    expect(capsule.publish.header_0_cell.bytes).toBe(PLATHO_BINARY_HEADER0_BYTES);
    expect(opened.plaintext).toBe('anonymous payload');
    expect(opened.payload.senderWallet).toBeUndefined();
    expect(opened.payload.senderVaultKeyId).toBeUndefined();
  });

  it('COMPACT-05: rejects payloads beyond the largest useful cap', async () => {
    const alice = await signedIdentity(CRYPTO_SUITES.HYBRID_V1);
    const bob = await signedIdentity(CRYPTO_SUITES.HYBRID_V1);
    const capacity = getCompactCapsuleCapacity(CRYPTO_SUITES.HYBRID_V1, { sizeClass: 32 });

    await expect(createEncryptedPrivateCapsule(
      'a'.repeat(capacity.maxTextBytes + 1),
      bob.signedBundle,
      alice.identity,
      { now: NOW, createdAt: NOW, expiresAt: NOW + 60_000 },
    )).rejects.toThrow(/largest capsule size/i);
  });

  it('COMPACT-06: encodes image and payment payloads without verbose JSON keys', () => {
    const image = encodeCompactPayload({
      type: 'image',
      format: PLATHO_COMPACT_IMAGE_FORMATS.WEBP,
      bytes: new Uint8Array([1, 2, 3, 4]),
    });
    const decodedImage = decodeCompactPayload(image);
    expect(decodedImage).toMatchObject({
      type: 'image',
      format: PLATHO_COMPACT_IMAGE_FORMATS.WEBP,
    });
    expect([...decodedImage.bytes]).toEqual([1, 2, 3, 4]);

    const payment = encodeCompactPayload({
      type: 'payment',
      asset: 1,
      amount: 123456789n,
      intentId: new Uint8Array(32).fill(7),
      secret32: new Uint8Array(32).fill(9),
    });
    const decodedPayment = decodeCompactPayload(payment);
    expect(decodedPayment).toMatchObject({
      type: 'payment',
      asset: 1,
      amount: 123456789n,
    });
    expect([...decodedPayment.intentId]).toEqual([...new Uint8Array(32).fill(7)]);
    expect([...decodedPayment.secret32]).toEqual([...new Uint8Array(32).fill(9)]);
  });

  it('COMPACT-07: rejects pre-release JSON envelope bodies', async () => {
    const { capsule } = await compactRoundtrip(CRYPTO_SUITES.HYBRID_V1, 32);
    const legacy = {
      ...capsule,
      body: {
        version: 1,
        kind: 'private',
        envelope: { ciphertext: 'not-v1' },
      },
    };

    await expect(verifyEncryptedPrivateCapsule(legacy, { now: NOW + 1 })).rejects.toThrow(/byte-layout\.v1/i);
  });

  it('COMPACT-08: opens private CapsuleHub entries from on-chain BOC cells', async () => {
    const alice = await signedIdentity(CRYPTO_SUITES.HYBRID_V1);
    const bob = await signedIdentity(CRYPTO_SUITES.HYBRID_V1);
    const capsule = await createEncryptedPrivateCapsule('stored on chain', bob.signedBundle, alice.identity, {
      now: NOW,
      createdAt: NOW,
      expiresAt: NOW + 60_000,
    });
    const entry = {
      exists: true,
      entry_id: 7n,
      entry_uid: 77n,
      publish_id: 700n,
      author_wallet: '0:1111111111111111111111111111111111111111111111111111111111111111',
      size_class: BigInt(capsule.publish.size_class),
      crypto_suite: BigInt(capsule.publish.crypto_suite),
      header_0_hash: BigInt(capsule.publish.header_0_hash),
      header_1_hash: BigInt(capsule.publish.header_1_hash),
      body_hash: BigInt(capsule.publish.body_hash),
      header_0_boc: capsule.publish.header_0_cell.boc,
      header_1_boc: capsule.publish.header_1_cell.boc,
      body_boc: capsule.publish.body_cell.boc,
      created_at: BigInt(Math.floor(NOW / 1000)),
    };

    const opened = await openPrivateCapsuleChainEntry(entry, bob.identity.encryptionKeyPair, {
      now: NOW + 120_000,
    });

    expect(opened.plaintext).toBe('stored on chain');
    expect(opened.capsule.id).toBe(capsule.id);
    expect(opened.publish.body_hash).toBe(capsule.publish.body_hash);
    await expect(openPrivateCapsuleChainEntry(entry, alice.identity.encryptionKeyPair, {
      now: NOW + 120_000,
    })).rejects.toThrow(/recipient|decrypt/i);
  });

  it('COMPACT-08A: opens private entries serialized with indexed CRC BOC flags', async () => {
    const alice = await signedIdentity(CRYPTO_SUITES.HYBRID_V1);
    const bob = await signedIdentity(CRYPTO_SUITES.HYBRID_V1);
    const capsule = await createEncryptedPrivateCapsule('indexed boc', bob.signedBundle, alice.identity, {
      now: NOW,
      createdAt: NOW,
      expiresAt: NOW + 60_000,
    });
    const entry = {
      exists: true,
      entry_id: 8n,
      entry_uid: 88n,
      publish_id: 800n,
      author_wallet: '0:1111111111111111111111111111111111111111111111111111111111111111',
      size_class: BigInt(capsule.publish.size_class),
      crypto_suite: BigInt(capsule.publish.crypto_suite),
      header_0_hash: BigInt(capsule.publish.header_0_hash),
      header_1_hash: BigInt(capsule.publish.header_1_hash),
      body_hash: BigInt(capsule.publish.body_hash),
      header_0_boc: indexedCrcBoc(capsule.publish.header_0_cell.boc),
      header_1_boc: indexedCrcBoc(capsule.publish.header_1_cell.boc),
      body_boc: indexedCrcBoc(capsule.publish.body_cell.boc),
      created_at: BigInt(Math.floor(NOW / 1000)),
    };

    const opened = await openPrivateCapsuleChainEntry(entry, bob.identity.encryptionKeyPair, {
      now: NOW + 120_000,
    });

    expect(opened.plaintext).toBe('indexed boc');
    expect(opened.capsule.id).toBe(capsule.id);
  });

});
