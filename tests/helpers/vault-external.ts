import { Address, beginCell, external } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { keyPairFromSeed, sign } from '@ton/crypto';
import {
  RegisterMessagingKeys,
} from '../../build/Vault/Vault_Vault';
import { hybridMessagingKeyFields } from './vault-hybrid-key';

const VAULT_WITHDRAW_TON_SIGNING_DOMAIN = 0x56545731n;
const VAULT_WITHDRAW_ATH_SIGNING_DOMAIN = 0x56574131n;
const OP_WITHDRAW_TON_FROM_VAULT_BALANCE = 0x7E1F5038n;
const OP_WITHDRAW_ATH_FROM_VAULT_BALANCE = 0x7E1F5039n;

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

export function buildVaultWithdrawTonExternalBody(
  owner: Address,
  nonce: bigint,
  secretKey: Buffer,
  vaultAddress: Address,
  deploymentManifestHash: bigint,
  amount: bigint,
  recipient: Address,
) {
  const actionPayload = beginCell()
    .storeUint(amount, 128)
    .storeAddress(recipient)
    .endCell();

  const signedPayload = beginCell()
    .storeUint(VAULT_WITHDRAW_TON_SIGNING_DOMAIN, 32)
    .storeUint(deploymentManifestHash, 256)
    .storeAddress(vaultAddress)
    .storeAddress(owner)
    .storeUint(nonce, 64)
    .storeRef(actionPayload)
    .endCell();

  return beginCell()
    .storeUint(OP_WITHDRAW_TON_FROM_VAULT_BALANCE, 32)
    .storeAddress(owner)
    .storeBuffer(sign(signedPayload.hash(), secretKey))
    .storeRef(signedPayload)
    .endCell();
}

export async function sendVaultWithdrawTonExternal(
  blockchain: Blockchain,
  vault: any,
  owner: any,
  keyPair: any,
  deploymentManifestHash: bigint,
  amount: bigint,
  recipient: Address,
) {
  const userState = await vault.getGetUser(owner.address);
  return blockchain.sendMessage(external({
    to: vault.address,
    body: buildVaultWithdrawTonExternalBody(
      owner.address,
      userState.publish_nonce,
      keyPair.secretKey,
      vault.address,
      deploymentManifestHash,
      amount,
      recipient,
    ),
  }));
}

export function buildVaultWithdrawAthExternalBody(
  owner: Address,
  nonce: bigint,
  secretKey: Buffer,
  vaultAddress: Address,
  deploymentManifestHash: bigint,
  amount: bigint,
  recipient: Address,
) {
  const actionPayload = beginCell()
    .storeUint(amount, 128)
    .storeAddress(recipient)
    .endCell();

  const signedPayload = beginCell()
    .storeUint(VAULT_WITHDRAW_ATH_SIGNING_DOMAIN, 32)
    .storeUint(deploymentManifestHash, 256)
    .storeAddress(vaultAddress)
    .storeAddress(owner)
    .storeUint(nonce, 64)
    .storeRef(actionPayload)
    .endCell();

  return beginCell()
    .storeUint(OP_WITHDRAW_ATH_FROM_VAULT_BALANCE, 32)
    .storeAddress(owner)
    .storeBuffer(sign(signedPayload.hash(), secretKey))
    .storeRef(signedPayload)
    .endCell();
}

export async function sendVaultWithdrawAthExternal(
  blockchain: Blockchain,
  vault: any,
  owner: any,
  keyPair: any,
  deploymentManifestHash: bigint,
  amount: bigint,
  recipient: Address,
) {
  const userState = await vault.getGetUser(owner.address);
  return blockchain.sendMessage(external({
    to: vault.address,
    body: buildVaultWithdrawAthExternalBody(
      owner.address,
      userState.publish_nonce,
      keyPair.secretKey,
      vault.address,
      deploymentManifestHash,
      amount,
      recipient,
    ),
  }));
}
