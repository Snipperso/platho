import {
  createMessagingIdentity,
  createVaultMessagingKeyDraft,
  exportSignedPublicKeyBundle,
  runPlathoCryptoSelfTest,
  verifySignedPublicKeyBundle,
} from '../web/crypto/platho-crypto.mjs';
import { runVaultChainBindingSelfTest } from '../web/vault-chain-provider.mjs';

async function buildVaultChainBindingFixture() {
  const identity = await createMessagingIdentity();
  const walletAddress = `0:${'11'.repeat(32)}`;
  const signedBundle = await exportSignedPublicKeyBundle(identity, {
    issuedAt: 1_700_000_000_000,
    expiresAt: 1_700_003_600_000,
    ownerWallet: walletAddress,
  });
  const verifiedBundle = await verifySignedPublicKeyBundle(signedBundle, { now: 1_700_000_001_000 });
  const vaultDraft = await createVaultMessagingKeyDraft(verifiedBundle.bundle, verifiedBundle.signingPublicKey);
  return {
    signedBundle,
    ownerWallet: walletAddress,
    keyRecord: {
      exists: true,
      owner_wallet: walletAddress,
      key_generation: 0n,
      enc_pubkey: vaultDraft.message.enc_pubkey,
      sign_pubkey: vaultDraft.message.sign_pubkey,
      pq_kem_pubkey_hash: vaultDraft.message.pq_kem_pubkey_hash,
      pq_kem_pubkey_len: vaultDraft.message.pq_kem_pubkey_len,
      pq_kem_pubkey: vaultDraft.message.pq_kem_pubkey,
      crypto_suite_mask: vaultDraft.message.crypto_suite_mask,
      created_at: 1_700_000_000n,
      created_lt: 1n,
      revoked_at: 0n,
      revoked_lt: 0n,
    },
  };
}

const result = await runPlathoCryptoSelfTest();
const vaultChainBinding = await runVaultChainBindingSelfTest(await buildVaultChainBindingFixture());

console.log(JSON.stringify({
  ...result,
  vaultChainBinding,
}, null, 2));
