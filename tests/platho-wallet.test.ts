import { describe, expect, it } from 'vitest';
import { Address, Cell, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { WalletContractV5R1 } from '@ton/ton';
import {
  PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER,
  buildPlathoWalletExternalBoc,
  createPlathoWallet,
  derivePlathoWalletFromMnemonic,
  deriveMessagingIdentityFromWallet,
  exportPlathoWalletRecoveryPhrase,
  formatTonUserFriendlyAddress,
  getPlathoWalletSeqno,
  importPlathoWallet,
  sendPlathoWalletTransaction,
  validateTonMnemonic,
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

const mnemonic = [
  'hospital', 'stove', 'relief', 'fringe', 'tongue', 'always', 'charge', 'angry',
  'urge', 'sentence', 'again', 'match', 'nerve', 'inquiry', 'senior', 'coconut',
  'label', 'tumble', 'carry', 'category', 'beauty', 'bean', 'road', 'solution',
];
const mnemonicText = mnemonic.join(' ');
const mnemonicSecretKeyHex = '9d659a6c2234db7f6e4f977e6e8653b9f5946d557163f31034011375d8f3f97d';
const bobMnemonic = [
  'dose', 'ice', 'enrich', 'trigger', 'test', 'dove', 'century', 'still',
  'betray', 'gas', 'diet', 'dune', 'use', 'other', 'base', 'gym', 'mad',
  'law', 'immense', 'village', 'world', 'example', 'praise', 'game',
];

describe('embedded Platho wallet', () => {
  it('PLATHO-WALLET-01: derives the same v5r1 wallet address as @ton/ton', async () => {
    const wallet = await derivePlathoWalletFromMnemonic(mnemonic);
    const reference = WalletContractV5R1.create({
      workchain: wallet.workchain,
      publicKey: Buffer.from(wallet.walletPublicKey),
      walletId: wallet.walletIdSpec,
    });

    expect(wallet.address).toBe(reference.address.toRawString());
    expect(Buffer.from(wallet.walletSecretKey).toString('hex')).toBe(mnemonicSecretKeyHex);
    expect(wallet.seedText).toBe(mnemonicText);
    expect(wallet.friendlyAddress).toBe(formatTonUserFriendlyAddress(wallet.address));
    expect(Address.parse(wallet.friendlyAddress).toRawString()).toBe(wallet.address);
    await expect(validateTonMnemonic(mnemonic)).resolves.toBe(true);
  });

  it('PLATHO-WALLET-02: imports the recovery phrase and deterministically derives messaging keys', async () => {
    const wallet = await createPlathoWallet({ mnemonic });
    const imported = await importPlathoWallet(exportPlathoWalletRecoveryPhrase(wallet));
    const first = await deriveMessagingIdentityFromWallet(wallet, CRYPTO_SUITES.HYBRID_V1);
    const second = await deriveMessagingIdentityFromWallet(imported, CRYPTO_SUITES.HYBRID_V1);

    expect(imported.address).toBe(wallet.address);
    expect(second.encryptionKeyPair.keyId).toBe(first.encryptionKeyPair.keyId);
    expect(Buffer.from(second.signingPublicKey).toString('hex')).toBe(Buffer.from(first.signingPublicKey).toString('hex'));
    await expect(importPlathoWallet(`platho1.${'00'.repeat(32)}`)).rejects.toThrow(/24 words|checksum|word/i);
  });

  it('PLATHO-WALLET-03: builds parseable wallet external message BoC', async () => {
    const wallet = await createPlathoWallet({ mnemonic });
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

  it('PLATHO-WALLET-04: sends a real sandbox v5r1 wallet transfer', async () => {
    const blockchain = await Blockchain.create();
    const wallet = await createPlathoWallet({ mnemonic });
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

  it('PLATHO-WALLET-04B: sends more than four internal messages in one v5r1 transfer', async () => {
    const blockchain = await Blockchain.create();
    const wallet = await createPlathoWallet({ mnemonic });
    const funder = await blockchain.treasury('platho-wallet-multi-funder');
    const recipients = await Promise.all(
      Array.from({ length: 9 }, (_, index) => blockchain.treasury(`platho-wallet-multi-recipient-${index}`)),
    );

    await funder.send({
      to: Address.parseRaw(wallet.address),
      value: toNano('2'),
      bounce: false,
    });

    const before = await Promise.all(recipients.map((recipient) => recipient.getBalance()));
    const built = await buildPlathoWalletExternalBoc(wallet, recipients.map((recipient) => ({
      address: recipient.address.toRawString(),
      amount: toNano('0.01').toString(),
      payload: null,
    })), {
      seqno: 0,
      timeout: Math.floor(Date.now() / 1000) + 300,
    });
    await blockchain.sendMessage(Cell.fromBoc(Buffer.from(built.boc, 'base64'))[0]);
    const after = await Promise.all(recipients.map((recipient) => recipient.getBalance()));

    expect(built.seqno).toBe(0);
    for (let index = 0; index < recipients.length; index += 1) {
      expect(after[index] - before[index]).toBeGreaterThan(toNano('0.009'));
    }
  });

  it('PLATHO-WALLET-04C: splits more than 255 capsules into sequential v5r1 transfers', async () => {
    const wallet = await createPlathoWallet({ mnemonic });
    let seqno = 42;
    const sent: any[] = [];
    const messages = Array.from({ length: PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER + 5 }, (_, index) => ({
      address: `0:${(index + 1).toString(16).padStart(64, '0')}`,
      amount: '1000000',
      payload: null,
    }));
    const transport = {
      async runGetMethod() {
        return { stack: [{ type: 'num', value: `0x${seqno.toString(16)}` }] };
      },
      async sendBoc(input: any) {
        sent.push(input);
        seqno += 1;
        return { ok: true, seqno };
      },
    };

    const result = await sendPlathoWalletTransaction(wallet, { messages, validUntil: 1_700_000_300 }, {
      transport,
      seqnoPollMs: 0,
      seqnoPollAttempts: 2,
    });

    expect(sent).toHaveLength(2);
    expect(result.batchCount).toBe(2);
    expect(result.batches.map((batch: any) => batch.seqno)).toEqual([42, 43]);
    expect(result.batches.map((batch: any) => batch.messageCount)).toEqual([255, 5]);
  });

  it('PLATHO-WALLET-04D: fails closed when RPC seqno cannot be read before signing', async () => {
    const wallet = await createPlathoWallet({ mnemonic });
    const message = {
      address: `0:${'22'.repeat(32)}`,
      amount: '1000000',
      payload: null,
    };
    let sent = false;
    const transport = {
      async runGetMethod() {
        throw new Error('rpc down');
      },
      async sendBoc() {
        sent = true;
        return { ok: true };
      },
    };

    await expect(getPlathoWalletSeqno(wallet, transport)).rejects.toThrow(/seqno read failed|fallback seqno 0/i);
    await expect(buildPlathoWalletExternalBoc(wallet, message, { transport })).rejects.toThrow(/seqno read failed|fallback seqno 0/i);
    await expect(sendPlathoWalletTransaction(wallet, { messages: [message], validUntil: 1_700_000_300 }, {
      transport,
    })).rejects.toThrow(/seqno read failed|fallback seqno 0/i);
    await expect(getPlathoWalletSeqno(wallet, transport, { allowSeqnoFallback: true })).resolves.toBe(0);
    expect(sent).toBe(false);
  });

  it('PLATHO-WALLET-04E: deploys a fresh uninitialized wallet on its first transfer with seqno 0', async () => {
    const wallet = await createPlathoWallet({ mnemonic });
    const message = {
      address: `0:${'33'.repeat(32)}`,
      amount: '1000000',
      payload: null,
    };
    let accountStateCalls = 0;
    let sentBoc: any = null;
    const transport = {
      async runGetMethod() {
        // A never-deployed account aborts the seqno get-method (TON exit_code -13).
        throw new Error('TON RPC get-method exit code -13');
      },
      async getAccountState(input: any) {
        accountStateCalls += 1;
        expect(input?.address).toBe(wallet.address);
        return { ok: true, result: { state: 'uninitialized', balance: '1000000000' } };
      },
      async sendBoc(input: any) {
        sentBoc = input;
        return { ok: true };
      },
    };

    await expect(getPlathoWalletSeqno(wallet, transport)).resolves.toBe(0);

    const built = await buildPlathoWalletExternalBoc(wallet, message, { transport });
    // seqno 0 deterministically attaches the wallet stateInit (deploy-on-first-tx).
    expect(built.seqno).toBe(0);
    expect(Cell.fromBoc(Buffer.from(built.boc, 'base64'))).toHaveLength(1);

    const result = await sendPlathoWalletTransaction(wallet, { messages: [message], validUntil: 1_700_000_300 }, {
      transport,
    });
    expect(result.seqno).toBe(0);
    expect(sentBoc).not.toBeNull();
    expect(accountStateCalls).toBeGreaterThanOrEqual(1);
  });

  it('PLATHO-WALLET-04F: still refuses to sign when a deployed wallet seqno read fails', async () => {
    const wallet = await createPlathoWallet({ mnemonic });
    const message = {
      address: `0:${'44'.repeat(32)}`,
      amount: '1000000',
      payload: null,
    };
    let sent = false;
    const transport = {
      async runGetMethod() {
        throw new Error('rpc down');
      },
      async getAccountState() {
        // The wallet is deployed; the seqno read merely failed (RPC unreachable
        // or lying). Signing with fallback seqno 0 here would be unsafe.
        return { ok: true, result: { state: 'active', balance: '5000000000' } };
      },
      async sendBoc() {
        sent = true;
        return { ok: true };
      },
    };

    await expect(getPlathoWalletSeqno(wallet, transport)).rejects.toThrow(/seqno read failed|fallback seqno 0/i);
    await expect(sendPlathoWalletTransaction(wallet, { messages: [message], validUntil: 1_700_000_300 }, {
      transport,
    })).rejects.toThrow(/seqno read failed|fallback seqno 0/i);
    expect(sent).toBe(false);
  });

  it('PLATHO-WALLET-04G: a structured exit_code -13 resolves to seqno 0 with no account-state read', async () => {
    const wallet = await createPlathoWallet({ mnemonic });
    const message = {
      address: `0:${'55'.repeat(32)}`,
      amount: '1000000',
      payload: null,
    };
    let sentBoc: any = null;
    const transport = {
      async runGetMethod() {
        // A never-deployed account: the toncenter transport surfaces exit_code -13
        // as a structured error.exitCode. No getAccountState on this transport on
        // purpose — the fast path must resolve seqno 0 without one.
        const error: any = new Error('TON RPC get-method exit code -13');
        error.exitCode = -13;
        throw error;
      },
      async sendBoc(input: any) {
        sentBoc = input;
        return { ok: true };
      },
    };

    await expect(getPlathoWalletSeqno(wallet, transport)).resolves.toBe(0);
    const result = await sendPlathoWalletTransaction(wallet, { messages: [message], validUntil: 1_700_000_300 }, {
      transport,
    });
    expect(result.seqno).toBe(0);
    expect(sentBoc).not.toBeNull();
  });

  it('PLATHO-WALLET-05: encrypts to a recipient Vault key record derived from their wallet recovery phrase', async () => {
    const alice = await createPlathoWallet({ mnemonic });
    const bob = await createPlathoWallet({ mnemonic: bobMnemonic });
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
