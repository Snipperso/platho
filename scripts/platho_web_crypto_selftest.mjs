import { createRequire } from 'node:module';
import {
  createMessagingIdentity,
  createVaultMessagingKeyDraft,
  exportSignedPublicKeyBundle,
  runPlathoCryptoSelfTest,
  verifySignedPublicKeyBundle,
} from '../web/crypto/platho-crypto.mjs';
import { tonStateInitSelfTestFromFixture } from '../web/crypto/ton-wallet-stateinit.mjs';
import { runVaultChainBindingSelfTest } from '../web/vault-chain-provider.mjs';

const require = createRequire(import.meta.url);
const { beginCell } = require('@ton/core');

function makePublicKey(seed) {
  return Buffer.from(Array.from({ length: 32 }, (_, index) => (seed + index * 17) & 0xff));
}

function buildStateInitFixture({ version, publicKeyOffsetBits, dataCell, publicKey, idx }) {
  const code = beginCell()
    .storeUint(0x504c4154484fn, 48)
    .storeUint(publicKeyOffsetBits, 16)
    .endCell();
  const stateInit = beginCell()
    .storeBit(false)
    .storeBit(false)
    .storeMaybeRef(code)
    .storeMaybeRef(dataCell)
    .storeBit(false)
    .endCell();
  const codeHash = code.hash().toString('hex');
  return {
    account: {
      address: `0:${stateInit.hash().toString('hex')}`,
      walletStateInit: stateInit.toBoc({ idx, crc32: true }).toString('base64'),
      publicKey: publicKey.toString('hex'),
    },
    expectedPublicKey: publicKey,
    knownWalletCodeHashes: {
      [codeHash]: { version, publicKeyOffsetBits },
    },
  };
}

function buildV4Fixture() {
  const publicKey = makePublicKey(11);
  const dataCell = beginCell()
    .storeUint(7, 32)
    .storeUint(698983191, 32)
    .storeBuffer(publicKey)
    .storeBit(false)
    .endCell();
  return buildStateInitFixture({
    version: 'fixture-v4',
    publicKeyOffsetBits: 64,
    dataCell,
    publicKey,
    idx: true,
  });
}

function buildV5Fixture() {
  const publicKey = makePublicKey(29);
  const dataCell = beginCell()
    .storeBit(true)
    .storeUint(8, 32)
    .storeUint(0x29a9a317, 32)
    .storeBuffer(publicKey)
    .storeBit(false)
    .endCell();
  return buildStateInitFixture({
    version: 'fixture-v5',
    publicKeyOffsetBits: 65,
    dataCell,
    publicKey,
    idx: false,
  });
}

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
    walletProof: { walletAddress },
    keyRecord: {
      exists: true,
      owner_wallet: walletAddress,
      key_generation: 0n,
      enc_pubkey: vaultDraft.message.enc_pubkey,
      sign_pubkey: vaultDraft.message.sign_pubkey,
      pq_kem_pubkey_hash: vaultDraft.message.pq_kem_pubkey_hash,
      pq_kem_pubkey_len: vaultDraft.message.pq_kem_pubkey_len,
      crypto_suite_mask: vaultDraft.message.crypto_suite_mask,
      created_at: 1_700_000_000n,
      created_lt: 1n,
      revoked_at: 0n,
      revoked_lt: 0n,
    },
  };
}

const result = await runPlathoCryptoSelfTest();
const walletStateInit = await Promise.all([
  tonStateInitSelfTestFromFixture(buildV4Fixture()),
  tonStateInitSelfTestFromFixture(buildV5Fixture()),
]);
const vaultChainBinding = await runVaultChainBindingSelfTest(await buildVaultChainBindingFixture());

console.log(JSON.stringify({
  ...result,
  walletStateInit,
  vaultChainBinding,
}, null, 2));
