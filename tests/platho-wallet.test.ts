import { describe, expect, it } from 'vitest';
import { Address, Cell, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { WalletContractV4 } from '@ton/ton';
import {
  buildPlathoWalletExternalBoc,
  createPlathoWallet,
  deriveMessagingIdentityFromWallet,
  exportPlathoWalletSeed,
  importPlathoWallet,
} from '../web/platho-wallet.mjs';
import {
  CRYPTO_SUITES,
  createEncryptedPrivateCapsuleFromPublicBundle,
  createVaultMessagingKeyDraft,
  exportSignedPublicKeyBundle,
  openEncryptedPrivateCapsule,
  publicKeyBundleFromVaultKeyRecord,
  verifySignedPublicKeyBundle,
} from '../web/crypto/platho-crypto.mjs';

const seed = Uint8Array.from({ length: 32 }, (_, index) => index);

describe('embedded Platho wallet', () => {
  it('PLATHO-WALLET-01: derives the same v4r2 wallet address as @ton/ton', async () => {
    const wallet = await createPlathoWallet({ seed });
    const reference = WalletContractV4.create({
      workchain: wallet.workchain,
      publicKey: Buffer.from(wallet.walletPublicKey),
      walletId: wallet.walletId,
    });

    expect(wallet.address).toBe(reference.address.toRawString());
    expect(wallet.seedText).toBe(`platho1.${Buffer.from(seed).toString('hex')}`);
  });

  it('PLATHO-WALLET-02: imports the seed and deterministically derives messaging keys', async () => {
    const wallet = await createPlathoWallet({ seed });
    const imported = await importPlathoWallet(exportPlathoWalletSeed(wallet));
    const first = await deriveMessagingIdentityFromWallet(wallet, CRYPTO_SUITES.HYBRID_V1);
    const second = await deriveMessagingIdentityFromWallet(imported, CRYPTO_SUITES.HYBRID_V1);

    expect(imported.address).toBe(wallet.address);
    expect(second.encryptionKeyPair.keyId).toBe(first.encryptionKeyPair.keyId);
    expect(Buffer.from(second.signingPublicKey).toString('hex')).toBe(Buffer.from(first.signingPublicKey).toString('hex'));
  });

  it('PLATHO-WALLET-03: builds parseable wallet external message BoC', async () => {
    const wallet = await createPlathoWallet({ seed });
    const built = await buildPlathoWalletExternalBoc(wallet, {
      address: `0:${'11'.repeat(32)}`,
      amount: '1000000',
      payload: null,
    }, {
      seqno: 0,
      timeout: 1_700_000_000,
    });

    const cells = Cell.fromBoc(Buffer.from(built.boc, 'base64'));
    expect(cells).toHaveLength(1);
    expect(built.wallet).toBe(wallet.address);
    expect(built.seqno).toBe(0);
  });

  it('PLATHO-WALLET-04: sends a real sandbox v4r2 wallet transfer', async () => {
    const blockchain = await Blockchain.create();
    const wallet = await createPlathoWallet({ seed });
    const funder = await blockchain.treasury('platho-wallet-funder');
    const recipient = await blockchain.treasury('platho-wallet-recipient');

    await funder.send({
      to: Address.parseRaw(wallet.address),
      value: toNano('2'),
      bounce: false,
    });

    const before = await recipient.getBalance();
    const built = await buildPlathoWalletExternalBoc(wallet, {
      address: recipient.address.toRawString(),
      amount: toNano('0.1').toString(),
      payload: null,
    }, {
      seqno: 0,
      timeout: Math.floor(Date.now() / 1000) + 300,
    });
    await blockchain.sendMessage(Cell.fromBoc(Buffer.from(built.boc, 'base64'))[0]);
    const after = await recipient.getBalance();

    expect(after - before).toBeGreaterThan(toNano('0.099'));
  });

  it('PLATHO-WALLET-05: encrypts to a recipient Vault key record derived from their wallet seed', async () => {
    const alice = await createPlathoWallet({ seed });
    const bob = await createPlathoWallet({ seed: Uint8Array.from({ length: 32 }, (_, index) => 255 - index) });
    const aliceIdentity = await deriveMessagingIdentityFromWallet(alice, CRYPTO_SUITES.HYBRID_V1);
    const bobIdentity = await deriveMessagingIdentityFromWallet(bob, CRYPTO_SUITES.HYBRID_V1);
    const bobSignedBundle = await exportSignedPublicKeyBundle(bobIdentity, {
      ownerWallet: bob.address,
      vaultAddress: `0:${'44'.repeat(32)}`,
      issuedAt: 1_700_000_000_000,
    });
    const verifiedBobBundle = await verifySignedPublicKeyBundle(bobSignedBundle, { now: 1_700_000_001_000 });
    const draft = await createVaultMessagingKeyDraft(verifiedBobBundle.bundle, verifiedBobBundle.signingPublicKey);
    const keyRecord = {
      exists: true,
      owner_wallet: bob.address,
      key_generation: 0n,
      enc_pubkey: draft.message.enc_pubkey,
      sign_pubkey: draft.message.sign_pubkey,
      pq_kem_pubkey_hash: draft.message.pq_kem_pubkey_hash,
      pq_kem_pubkey_len: draft.message.pq_kem_pubkey_len,
      pq_kem_pubkey: draft.message.pq_kem_pubkey,
      crypto_suite_mask: draft.message.crypto_suite_mask,
      created_at: 1_700_000_000n,
      created_lt: 1n,
      revoked_at: 0n,
      revoked_lt: 0n,
    };

    const recipientBundle = await publicKeyBundleFromVaultKeyRecord(keyRecord, { ownerWallet: bob.address });
    expect(recipientBundle.keyId).toBe(bobIdentity.encryptionKeyPair.keyId);

    const capsule = await createEncryptedPrivateCapsuleFromPublicBundle('hello bob', recipientBundle, aliceIdentity, {
      now: 1_700_000_002_000,
    });
    const opened = await openEncryptedPrivateCapsule(capsule, bobIdentity.encryptionKeyPair, {
      now: 1_700_000_003_000,
      replayCache: new Set(),
    });

    expect(capsule.header0.recipientKeyId).toBe(bobIdentity.encryptionKeyPair.keyId);
    expect(opened.plaintext).toBe('hello bob');
    await expect(publicKeyBundleFromVaultKeyRecord({
      ...keyRecord,
      pq_kem_pubkey_hash: keyRecord.pq_kem_pubkey_hash ^ 1n,
    }, { ownerWallet: bob.address })).rejects.toThrow(/hash/i);
  });
});
