import { describe, it, expect } from 'vitest';
import {
  createMessagingIdentity,
  exportPublicKeyBundle,
  encryptCompactPayloadBytes,
  MLKEM768_CIPHERTEXT_BYTES,
} from '../web/crypto/platho-crypto.mjs';
import { ml_kem768 } from '../web/vendor/@noble/post-quantum/ml-kem.js';

const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');
// body prefix layout: magic(4)+meta(4)+messageId(16)+nonce(12)+E(32) = 68, then ML-KEM ciphertext(1088)
const KEM_CT_OFFSET = 68;
// header0/header1 hashes bind into the AEAD AAD; dummy hex values suffice for isolating the KEM-encapsulation option.
const HASHES = { header0Hash: `0x${'11'.repeat(32)}`, header1Hash: `0x${'22'.repeat(32)}` };

describe('encryptCompactPayloadBytes — mlKemEncapsulation option (INTRO transcript enabler)', () => {
  it('MLKEM-OPT-01: a supplied encapsulation is threaded into the body verbatim', async () => {
    const b: any = await createMessagingIdentity();
    const bundle = exportPublicKeyBundle(b.encryptionKeyPair);
    const kem = ml_kem768.encapsulate(b.encryptionKeyPair.mlKem768PublicKey);

    const body = await encryptCompactPayloadBytes(new Uint8Array([1, 2, 3]), bundle, {
      hashes: HASHES,
      mlKemEncapsulation: { cipherText: kem.cipherText, sharedSecret: kem.sharedSecret },
    });
    expect(hex(body.subarray(KEM_CT_OFFSET, KEM_CT_OFFSET + MLKEM768_CIPHERTEXT_BYTES))).toBe(hex(kem.cipherText as Uint8Array));
  });

  it('MLKEM-OPT-02: without the option a FRESH encapsulation is generated (default path unchanged)', async () => {
    const b: any = await createMessagingIdentity();
    const bundle = exportPublicKeyBundle(b.encryptionKeyPair);
    const kem = ml_kem768.encapsulate(b.encryptionKeyPair.mlKem768PublicKey);

    const body = await encryptCompactPayloadBytes(new Uint8Array([1, 2, 3]), bundle, { hashes: HASHES });
    expect(hex(body.subarray(KEM_CT_OFFSET, KEM_CT_OFFSET + MLKEM768_CIPHERTEXT_BYTES))).not.toBe(hex(kem.cipherText as Uint8Array));
  });

  it('MLKEM-OPT-03: a malformed supplied ciphertext is rejected fail-closed', async () => {
    const b: any = await createMessagingIdentity();
    const bundle = exportPublicKeyBundle(b.encryptionKeyPair);
    const kem = ml_kem768.encapsulate(b.encryptionKeyPair.mlKem768PublicKey);
    await expect(encryptCompactPayloadBytes(new Uint8Array([1, 2, 3]), bundle, {
      hashes: HASHES,
      mlKemEncapsulation: { cipherText: new Uint8Array(10), sharedSecret: kem.sharedSecret },
    })).rejects.toThrow(/mlKemEncapsulation\.cipherText|1088 bytes/i);
  });
});
