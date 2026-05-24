import { describe, expect, it } from 'vitest';
import { beginCell, contractAddress, external, toNano } from '@ton/core';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { keyPairFromSeed, sign } from '@ton/crypto';
import {
  DepositTon,
  RegisterMessagingKeys,
  Vault,
} from '../build/Vault/Vault_Vault';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
} from './helpers/capsule-cells';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const KIND_PRIVATE = 1n;
const KIND_PUBLIC = 2n;
const SIZE_STANDARD = 1n;
const SUITE_CLASSICAL = 1n;
const SUITE_PUBLIC_NONE = 0n;
const BODY_CELL = finalPrivateBodyCell();
const HEADER0_CELL = finalPrivateHeader0Cell();
const HEADER1_CELL = finalPrivateHeader1Cell();
const BODY_HASH = BigInt('0x' + BODY_CELL.hash().toString('hex'));
const HEADER0 = BigInt('0x' + HEADER0_CELL.hash().toString('hex'));
const HEADER1 = BigInt('0x' + HEADER1_CELL.hash().toString('hex'));
const OP_REMOVED_DIRECT_PUBLISH_PRIVATE = 0x686694C6;
const OP_PUBLISH_PRIVATE_FROM_VAULT_BALANCE = 0x7E1F5031;
const OP_PUBLISH_PUBLIC_FROM_VAULT_BALANCE = 0x7E1F5032;
const VAULT_PUBLISH_LOCAL_EXEC_RESERVE = 6_000_000n;

function cellHash(cell: any): bigint {
  return BigInt('0x' + cell.hash().toString('hex'));
}

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const user = await blockchain.treasury('vault-balance-publish-user');
  const capsuleHub = await blockchain.treasury('vault-balance-publish-capsulehub');
  const athWallet = await blockchain.treasury('vault-balance-publish-ath-wallet');
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
  return { blockchain, vault, user };
}

async function registerKeys(vault: any, user: any) {
  const keyPair = keyPairFromSeed(Buffer.alloc(32, 8));
  await vault.send(user.getSender(), { value: toNano('0.03') }, {
    $$type: 'RegisterMessagingKeys',
    enc_pubkey: 1n,
    sign_pubkey: BigInt('0x' + keyPair.publicKey.toString('hex')),
    pq_kem_pubkey_hash: 0n,
    pq_kem_pubkey_len: 0n,
    pq_kem_pubkey: beginCell().endCell(),
    crypto_suite_mask: 1n,
  } as RegisterMessagingKeys);
  return keyPair;
}

async function depositTon(vault: any, user: any, amount: bigint) {
  await vault.send(user.getSender(), { value: amount + 12_000_000n }, {
    $$type: 'DepositTon',
    amount,
  } as DepositTon);
}

function signedPrivatePublishBody(
  owner: any,
  nonce: bigint,
  maxCharge: bigint,
  secretKey: Buffer,
  overrides: { bodyHash?: bigint } = {},
) {
  const payload = beginCell()
    .storeUint(SIZE_STANDARD, 8)
    .storeUint(SUITE_CLASSICAL, 8)
    .storeUint(HEADER0, 256)
    .storeUint(HEADER1, 256)
    .storeUint(overrides.bodyHash ?? BODY_HASH, 256)
    .storeRef(HEADER0_CELL)
    .storeRef(HEADER1_CELL)
    .storeRef(BODY_CELL)
    .endCell();
  const signedPayload = beginCell()
    .storeAddress(owner)
    .storeUint(nonce, 64)
    .storeUint(maxCharge, 128)
    .storeRef(payload)
    .endCell();
  return beginCell()
    .storeUint(OP_PUBLISH_PRIVATE_FROM_VAULT_BALANCE, 32)
    .storeAddress(owner)
    .storeBuffer(sign(signedPayload.hash(), secretKey))
    .storeRef(signedPayload)
    .endCell();
}

function signedPublicPublishBody(
  owner: any,
  nonce: bigint,
  maxCharge: bigint,
  secretKey: Buffer,
  overrides: { bodyHash?: bigint; headerCell?: any; bodyCell?: any } = {},
) {
  const headerCell = overrides.headerCell ?? HEADER0_CELL;
  const bodyCell = overrides.bodyCell ?? BODY_CELL;
  const payload = beginCell()
    .storeUint(cellHash(headerCell), 256)
    .storeUint(overrides.bodyHash ?? cellHash(bodyCell), 256)
    .storeRef(headerCell)
    .storeRef(bodyCell)
    .endCell();
  const signedPayload = beginCell()
    .storeAddress(owner)
    .storeUint(nonce, 64)
    .storeUint(maxCharge, 128)
    .storeRef(payload)
    .endCell();
  return beginCell()
    .storeUint(OP_PUBLISH_PUBLIC_FROM_VAULT_BALANCE, 32)
    .storeAddress(owner)
    .storeBuffer(sign(signedPayload.hash(), secretKey))
    .storeRef(signedPayload)
    .endCell();
}

function oversizedPublicBodyCell() {
  let cell = beginCell().storeUint(1n, 8).endCell();
  for (let index = 0; index < 9; index += 1) {
    cell = beginCell().storeUint(1n, 8).storeRef(cell).endCell();
  }
  return cell;
}

function removedDirectPublishBody(maxCharge: bigint) {
  return beginCell()
    .storeUint(OP_REMOVED_DIRECT_PUBLISH_PRIVATE, 32)
    .storeUint(0n, 64)
    .storeUint(maxCharge, 128)
    .storeUint(SIZE_STANDARD, 8)
    .storeUint(SUITE_CLASSICAL, 8)
    .storeUint(HEADER0, 256)
    .storeUint(HEADER1, 256)
    .storeUint(BODY_HASH, 256)
    .storeRef(HEADER0_CELL)
    .storeRef(HEADER1_CELL)
    .storeRef(BODY_CELL)
    .endCell();
}

describe('Vault balance-funded publish gate', () => {
  it('VAULT-BALANCE-PUBLISH-01: signed publish requires activated messaging keys', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = keyPairFromSeed(Buffer.alloc(32, 8));
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    await depositTon(vault, user, maxCharge * 2n);
    const before = await vault.getGetUser(user.address);

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: signedPrivatePublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey),
    }))).rejects.toMatchObject({ exitCode: 16454 });

    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(before.ton_balance);
  });

  it('VAULT-BALANCE-PUBLISH-02: removed direct publish opcode is not handled', async () => {
    const { blockchain, vault, user } = await setup();
    await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);

    await blockchain.sendMessage(internal({
      from: user.address,
      to: vault.address,
      value: maxCharge,
      body: removedDirectPublishBody(maxCharge),
    }));

    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-03: valid signature with underpriced payload only charges local exec reserve', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    await depositTon(vault, user, maxCharge * 2n);
    const before = await vault.getGetUser(user.address);

    await blockchain.sendMessage(external({
      to: vault.address,
      body: signedPrivatePublishBody(user.address, before.publish_nonce, VAULT_PUBLISH_LOCAL_EXEC_RESERVE, keyPair.secretKey),
    }));

    const after = await vault.getGetUser(user.address);
    expect(after.ton_balance).toBe(before.ton_balance - VAULT_PUBLISH_LOCAL_EXEC_RESERVE);
    expect(after.publish_nonce).toBe(before.publish_nonce + 1n);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-04: valid signature with mismatched cell hash only charges local exec reserve', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    await depositTon(vault, user, maxCharge * 2n);
    const before = await vault.getGetUser(user.address);
    const badBody = signedPrivatePublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, {
      bodyHash: BODY_HASH + 1n,
    });

    await blockchain.sendMessage(external({
      to: vault.address,
      body: badBody,
    }));

    const after = await vault.getGetUser(user.address);
    expect(after.ton_balance).toBe(before.ton_balance - VAULT_PUBLISH_LOCAL_EXEC_RESERVE);
    expect(after.publish_nonce).toBe(before.publish_nonce + 1n);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: badBody,
    }))).rejects.toMatchObject({ exitCode: 16453 });
    const replayed = await vault.getGetUser(user.address);
    expect(replayed.ton_balance).toBe(after.ton_balance);
    expect(replayed.publish_nonce).toBe(after.publish_nonce);
  });

  it('VAULT-BALANCE-PUBLISH-05: public signed payload mismatch also advances nonce without pending publish', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PUBLIC, SIZE_STANDARD, SUITE_PUBLIC_NONE);
    await depositTon(vault, user, maxCharge * 2n);
    const before = await vault.getGetUser(user.address);

    await blockchain.sendMessage(external({
      to: vault.address,
      body: signedPublicPublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, {
        bodyHash: BODY_HASH + 1n,
      }),
    }));

    const after = await vault.getGetUser(user.address);
    expect(after.ton_balance).toBe(before.ton_balance - VAULT_PUBLISH_LOCAL_EXEC_RESERVE);
    expect(after.publish_nonce).toBe(before.publish_nonce + 1n);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-BALANCE-PUBLISH-06: public oversized body is rejected before outbound publish', async () => {
    const { blockchain, vault, user } = await setup();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PUBLIC, SIZE_STANDARD, SUITE_PUBLIC_NONE);
    await depositTon(vault, user, maxCharge * 2n);
    const before = await vault.getGetUser(user.address);

    await blockchain.sendMessage(external({
      to: vault.address,
      body: signedPublicPublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, {
        bodyCell: oversizedPublicBodyCell(),
      }),
    }));

    const after = await vault.getGetUser(user.address);
    expect(after.ton_balance).toBe(before.ton_balance - VAULT_PUBLISH_LOCAL_EXEC_RESERVE);
    expect(after.publish_nonce).toBe(before.publish_nonce + 1n);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });
});
