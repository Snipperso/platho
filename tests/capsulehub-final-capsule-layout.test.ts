import { describe, expect, it } from 'vitest';
import { Cell, toNano } from '@ton/core';
import {
  CRYPTO_SUITES,
  PLATHO_COMPACT_SENDER_RECOVERY_BYTES,
  createEncryptedPrivateCapsule,
  createMessagingIdentity,
  exportSignedPublicKeyBundle,
} from '../web/crypto/platho-crypto.mjs';
import {
  DEFAULT_BATCH_PUBLISH_ID,
  KIND_PRIVATE,
  computeEntryPublishId,
  hubTxExit,
  privatePartCustom,
  publishBatchToHub,
  setupHub,
} from './helpers/vpb2';

// VPB2 Session 4 migration: this suite used to drive the (removed) single-publish receiver
// PublishPrivateFromVault to prove the PWA's REAL crypto-lib hybrid capsule cells land on-chain with the
// exact final byte layout. Repointed onto the batch ingest path (PublishBatchToHub): the same crypto-lib
// header0/header1/body Cells are wrapped via privatePartCustom into a 1-part private batch and sent
// Hub-direct from the bound Vault to a setupHub() Hub. We still assert the exact source byte sizes (the
// layout claim being protected) AND that the entry is stored at id 0 with the EPI1 per-entry publish_id and
// the stored header hashes equal to the crypto-lib hashes.

function cellFromPayload(payload: { boc: string }): Cell {
  return Cell.fromBoc(Buffer.from(payload.boc, 'base64'))[0];
}

function hashHexToBigInt(hash: string): bigint {
  return BigInt(hash.startsWith('0x') ? hash : `0x${hash}`);
}

describe('CapsuleHub final capsule byte layout (VPB2 batch ingest)', () => {
  it('CAPSULE-FINAL-01: ingests a PWA-generated 1K hybrid capsule (exact final sizes) via the batch path', async () => {
    const { hub, vault } = await setupHub();
    const alice = await createMessagingIdentity({ suite: CRYPTO_SUITES.HYBRID_V1 });
    const bob = await createMessagingIdentity({ suite: CRYPTO_SUITES.HYBRID_V1 });
    const bobBundle = await exportSignedPublicKeyBundle(bob, {
      issuedAt: 1_700_000_000_000,
      expiresAt: 1_700_060_000_000,
      purpose: 'capsulehub-final-layout',
    });
    const encrypted = await createEncryptedPrivateCapsule('final capsule layout', bobBundle, alice, {
      now: 1_700_000_000_000,
      createdAt: 1_700_000_000_000,
      expiresAt: 1_700_060_000_000,
      clientNonce: 'AAAAAAAAAAAAAAAAAAAAAA',
    });

    // The layout claim this suite protects: the crypto-lib emits exactly these final byte sizes.
    expect(BigInt(encrypted.publish.size_class)).toBe(1n);
    expect(encrypted.publish.header_0_cell.bytes).toBe(140);
    expect(encrypted.publish.header_1_cell.bytes).toBe(30);
    expect(encrypted.publish.body_cell.bytes).toBe(2228);

    const h0Cell = cellFromPayload(encrypted.publish.header_0_cell);
    const h1Cell = cellFromPayload(encrypted.publish.header_1_cell);
    const bodyCell = cellFromPayload(encrypted.publish.body_cell);

    const parts = privatePartCustom({ sizeClass: 1n, h0Cell, h1Cell, bodyCell });
    const res = await hub.send(vault.getSender(), { value: toNano('0.1') }, publishBatchToHub({
      parts,
      authorWallet: vault.address,
      kind: KIND_PRIVATE,
      partCount: 1n,
    }));
    expect(hubTxExit(res, hub)).toBe(0);

    const stored = await hub.getGetPrivateEntry(0n);
    expect(stored.exists).toBe(true);
    expect(stored.publish_id).toBe(computeEntryPublishId(DEFAULT_BATCH_PUBLISH_ID, 0));
    // Stored header cells / hashes match the crypto-lib output exactly.
    expect(stored.header_0.hash().toString('hex')).toBe(encrypted.publish.header_0_hash.slice(2));
    expect(stored.header_1.hash().toString('hex')).toBe(encrypted.publish.header_1_hash.slice(2));
    expect(stored.header_0_hash).toBe(hashHexToBigInt(encrypted.publish.header_0_hash));
    expect(stored.header_1_hash).toBe(hashHexToBigInt(encrypted.publish.header_1_hash));
    expect(stored.body_hash).toBe(hashHexToBigInt(encrypted.publish.body_hash));
    expect((stored as any).body).toBeUndefined();
    expect((await hub.getGetState()).private_latest_id).toBe(1n);
  });

  it('CAPSULE-FINAL-02: ingests a PWA-generated 32 KiB hybrid capsule (exact final sizes) via the batch path', async () => {
    const { hub, vault } = await setupHub();
    const alice = await createMessagingIdentity({ suite: CRYPTO_SUITES.HYBRID_V1 });
    const bob = await createMessagingIdentity({ suite: CRYPTO_SUITES.HYBRID_V1 });
    const bobBundle = await exportSignedPublicKeyBundle(bob, {
      issuedAt: 1_700_000_000_000,
      expiresAt: 1_700_060_000_000,
      purpose: 'capsulehub-final-layout-32k',
    });
    const encrypted = await createEncryptedPrivateCapsule(
      'x'.repeat((32 * 1024) - PLATHO_COMPACT_SENDER_RECOVERY_BYTES),
      bobBundle,
      alice,
      {
        now: 1_700_000_000_000,
        createdAt: 1_700_000_000_000,
        expiresAt: 1_700_060_000_000,
        clientNonce: 'BBBBBBBBBBBBBBBBBBBBBB',
        sizeClass: 32,
      },
    );

    expect(BigInt(encrypted.publish.size_class)).toBe(32n);
    expect(encrypted.publish.header_0_cell.bytes).toBe(140);
    expect(encrypted.publish.header_1_cell.bytes).toBe(30);
    expect(encrypted.publish.body_cell.bytes).toBe(33972);

    const h0Cell = cellFromPayload(encrypted.publish.header_0_cell);
    const h1Cell = cellFromPayload(encrypted.publish.header_1_cell);
    const bodyCell = cellFromPayload(encrypted.publish.body_cell);

    const parts = privatePartCustom({ sizeClass: 32n, h0Cell, h1Cell, bodyCell });
    const res = await hub.send(vault.getSender(), { value: toNano('0.1') }, publishBatchToHub({
      parts,
      authorWallet: vault.address,
      kind: KIND_PRIVATE,
      partCount: 1n,
    }));
    expect(hubTxExit(res, hub)).toBe(0);

    const stored = await hub.getGetPrivateEntry(0n);
    expect(stored.exists).toBe(true);
    expect(stored.publish_id).toBe(computeEntryPublishId(DEFAULT_BATCH_PUBLISH_ID, 0));
    expect(stored.header_0.hash().toString('hex')).toBe(encrypted.publish.header_0_hash.slice(2));
    expect(stored.header_1.hash().toString('hex')).toBe(encrypted.publish.header_1_hash.slice(2));
    expect(stored.body_hash).toBe(hashHexToBigInt(encrypted.publish.body_hash));
    expect((stored as any).body).toBeUndefined();
    expect((await hub.getGetState()).private_latest_id).toBe(1n);
  }, 30000);
});
