import { Address, beginCell, external } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { keyPairFromSeed, sign } from '@ton/crypto';
import {
  RegisterMessagingKeys,
} from '../../build/Vault/Vault_Vault';
import { hybridMessagingKeyFields } from './vault-hybrid-key';

export const VAULT_RECEIVE_INTENT_ACTION_CREATE = 1n;
export const VAULT_RECEIVE_INTENT_ACTION_CLAIM = 2n;
export const VAULT_RECEIVE_INTENT_ACTION_CANCEL = 3n;

const VAULT_RECEIVE_INTENT_SIGNING_DOMAIN = 0x56524331n;
const OP_CREATE_RECEIVE_INTENT = 0x7E1F5035n;
const OP_CLAIM_RECEIVE_INTENT = 0x7E1F5036n;
const OP_CANCEL_RECEIVE_INTENT = 0x7E1F5037n;

export type VaultReceiveIntentExternalType = 'CreateReceiveIntent' | 'ClaimReceiveIntent' | 'CancelReceiveIntent';

function addressHash(address: Address): bigint {
  return BigInt('0x' + address.hash.toString('hex'));
}

export async function registerVaultSigningKeys(vault: any, user: any, seedByte: number, keyId = 1n) {
  const messagingKeyPair = keyPairFromSeed(Buffer.alloc(32, seedByte));
  const authKeyPair = keyPairFromSeed(Buffer.alloc(32, seedByte + 64));
  await vault.send(user.getSender(), { value: 50_000_000n }, {
    $$type: 'RegisterMessagingKeys',
    ...hybridMessagingKeyFields(
      keyId,
      BigInt('0x' + messagingKeyPair.publicKey.toString('hex')),
      BigInt('0x' + authKeyPair.publicKey.toString('hex')),
    ),
  } as RegisterMessagingKeys);
  return authKeyPair;
}

export function buildVaultReceiveIntentExternalBody(
  type: VaultReceiveIntentExternalType,
  owner: Address,
  nonce: bigint,
  secretKey: Buffer,
  vaultAddress: Address,
  deploymentManifestHash: bigint,
  fields: any,
) {
  const action = type === 'CreateReceiveIntent'
    ? VAULT_RECEIVE_INTENT_ACTION_CREATE
    : type === 'ClaimReceiveIntent'
      ? VAULT_RECEIVE_INTENT_ACTION_CLAIM
      : VAULT_RECEIVE_INTENT_ACTION_CANCEL;
  const op = type === 'CreateReceiveIntent'
    ? OP_CREATE_RECEIVE_INTENT
    : type === 'ClaimReceiveIntent'
      ? OP_CLAIM_RECEIVE_INTENT
      : OP_CANCEL_RECEIVE_INTENT;

  const actionPayload = beginCell();
  if (type === 'CreateReceiveIntent') {
    actionPayload
      .storeUint(fields.asset, 8)
      .storeUint(fields.amount, 128)
      .storeAddress(fields.recipient_wallet)
      .storeUint(fields.commitment, 256);
  } else if (type === 'ClaimReceiveIntent') {
    actionPayload
      .storeUint(fields.intent_id, 256)
      .storeUint(fields.secret32, 256);
  } else {
    actionPayload.storeUint(fields.intent_id, 256);
  }

  const signedPayload = beginCell()
    .storeUint(VAULT_RECEIVE_INTENT_SIGNING_DOMAIN, 32)
    .storeUint(deploymentManifestHash, 256)
    .storeUint(addressHash(vaultAddress), 256)
    .storeUint(action, 8)
    .storeUint(addressHash(owner), 256)
    .storeUint(nonce, 64)
    .storeRef(actionPayload.endCell())
    .endCell();

  return beginCell()
    .storeUint(op, 32)
    .storeAddress(owner)
    .storeBuffer(sign(signedPayload.hash(), secretKey))
    .storeRef(signedPayload)
    .endCell();
}

export async function sendVaultReceiveIntentExternal(
  blockchain: Blockchain,
  vault: any,
  type: VaultReceiveIntentExternalType,
  owner: any,
  keyPair: any,
  deploymentManifestHash: bigint,
  fields: any,
) {
  const userState = await vault.getGetUser(owner.address);
  await blockchain.sendMessage(external({
    to: vault.address,
    body: buildVaultReceiveIntentExternalBody(
      type,
      owner.address,
      userState.publish_nonce,
      keyPair.secretKey,
      vault.address,
      deploymentManifestHash,
      fields,
    ),
  }));
}
