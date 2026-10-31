
import { ed25519 } from './vendor/@noble/curves/ed25519.js';
import { buildKeyShardRegisterBrowser18, keyShardRegisterPossessionDigest } from './key-shard-register-browser.mjs?v=46';
import { keyShardAddressBytesFor, rawAddress } from './shard-address.mjs?v=47';
import { serializeBoc, tonCell } from './pwa-contract-transactions.mjs?v=59';
import { sendPlathoWalletTransaction } from './platho-wallet.mjs?v=94';

function bytesToBigInt(bytes) {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function provenSecret(secret, declared, name, gate) {
  if (!(secret instanceof Uint8Array) || secret.length !== 32) {
    throw new Error(`KeyShard register needs the ${name} secret key of this device (gate ${gate}) — the wallet is not unlocked`);
  }
  if (bytesToBigInt(ed25519.getPublicKey(secret)) !== BigInt(declared ?? 0n)) {
    throw new Error(`the ${name} secret key does not match the ${name} key being registered — the contract would refuse it at ${gate}; nothing was signed`);
  }
  return secret;
}

export async function prepareKeyShardRegister({ ownerWallet, profileRegistry, keyRecord, value, signSecretKey, authSecretKey }) {
  if (!keyRecord) throw new Error('publishKeyShardRegister requires the RegisterMessagingKeys keyRecord');
  const signSecret = provenSecret(signSecretKey, keyRecord.sign_pubkey, 'sign', 22140);
  const authSecret = provenSecret(authSecretKey, keyRecord.auth_pubkey, 'auth', 22141);
  const shard = await keyShardAddressBytesFor(18, ownerWallet, profileRegistry);
  const digest = await keyShardRegisterPossessionDigest({ shardAddress: shard, keyRecord });
  const built = await buildKeyShardRegisterBrowser18({
    ownerWallet, profileRegistry, keyRecord, value,
    popSignature: ed25519.sign(digest, signSecret),
    authSignature: ed25519.sign(digest, authSecret),
  });
  if (built.to !== rawAddress(shard)) {
    throw new Error('KeyShard register: the builder addressed a different shard than the possession proof names — nothing was sent');
  }
  const message = {
    address: built.to,
    amount: built.value,
    payload: tonCell.bytesToBase64(serializeBoc(built.body)),
    stateInit: built.init,
    bounce: true,
  };
  return { built, message };
}

export async function publishKeyShardRegister({ wallet, transport, ...registration }, options = {}) {
  if (!wallet) throw new Error('publishKeyShardRegister requires a wallet');
  const { built, message } = await prepareKeyShardRegister(registration);
  const result = await sendPlathoWalletTransaction(wallet, { messages: [message] }, { ...options, transport });
  return { ...built, message, result };
}
