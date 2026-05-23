import { describe, expect, it } from 'vitest';
import { beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import {
  Vault,
  RegisterMessagingKeys,
  PublishPrivateFromWallet,
} from '../build/Vault/Vault_Vault';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
} from './helpers/capsule-cells';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const KIND_PRIVATE = 1n;
const SIZE_STANDARD = 1n;
const SUITE_CLASSICAL = 1n;
const BODY_CELL = finalPrivateBodyCell();
const HEADER0_CELL = finalPrivateHeader0Cell();
const HEADER1_CELL = finalPrivateHeader1Cell();
const BODY_HASH = BigInt('0x' + BODY_CELL.hash().toString('hex'));
const HEADER0 = BigInt('0x' + HEADER0_CELL.hash().toString('hex'));
const HEADER1 = BigInt('0x' + HEADER1_CELL.hash().toString('hex'));

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const user = await blockchain.treasury('wallet-publish-user');
  const capsuleHub = await blockchain.treasury('wallet-publish-capsulehub');
  const athWallet = await blockchain.treasury('wallet-publish-ath-wallet');
  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, GENESIS_HASH, true, true, 0n);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('2'),
    workchain: address.workChain,
  }));
  const vault = blockchain.openContract(new Vault(address, init));
  return { vault, user };
}

async function registerKeys(vault: any, user: any) {
  await vault.send(user.getSender(), { value: toNano('0.03') }, {
    $$type: 'RegisterMessagingKeys',
    enc_pubkey: 1n,
    sign_pubkey: 2n,
    pq_kem_pubkey_hash: 0n,
    pq_kem_pubkey_len: 0n,
    pq_kem_pubkey: beginCell().endCell(),
    crypto_suite_mask: 1n,
  } as RegisterMessagingKeys);
}

function publishMessage(maxCharge: bigint, overrides: Partial<PublishPrivateFromWallet> = {}): PublishPrivateFromWallet {
  return {
    $$type: 'PublishPrivateFromWallet',
    client_nonce: 0n,
    max_charge: maxCharge,
    size_class: SIZE_STANDARD,
    crypto_suite: SUITE_CLASSICAL,
    header_0_hash: HEADER0,
    header_1_hash: HEADER1,
    body_hash: BODY_HASH,
    header_0: HEADER0_CELL,
    header_1: HEADER1_CELL,
    body: BODY_CELL,
    ...overrides,
  };
}

describe('Vault wallet-funded publish gate', () => {
  it('VAULT-WALLET-PUBLISH-01: publish requires activated wallet keys', async () => {
    const { vault, user } = await setup();
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);

    await vault.send(user.getSender(), { value: maxCharge }, publishMessage(maxCharge));

    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-WALLET-PUBLISH-02: too-low max_charge rejects before pending publish creation', async () => {
    const { vault, user } = await setup();
    await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);

    await vault.send(user.getSender(), { value: maxCharge }, publishMessage(maxCharge - 1n, { max_charge: maxCharge - 1n }));

    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-WALLET-PUBLISH-03: cell hash mismatch rejects before pending publish creation', async () => {
    const { vault, user } = await setup();
    await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);

    await vault.send(user.getSender(), { value: maxCharge }, publishMessage(maxCharge, { body_hash: BODY_HASH + 1n }));

    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });
});
