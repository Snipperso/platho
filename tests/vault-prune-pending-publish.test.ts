import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, contractAddress, external, toNano } from '@ton/core';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { createHash } from 'crypto';
import {
  Vault,
  DepositTon,
  RegisterMessagingKeys,
  PrunePendingPublish,
  CapsuleHubPublishAck,
} from '../build/Vault/Vault_Vault';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
} from './helpers/capsule-cells';
import { hybridMessagingKeyFields } from './helpers/vault-hybrid-key';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const KIND_PRIVATE = 1n;
const KIND_PUBLIC = 2n;
const SIZE_STANDARD = 1n;
const SUITE_PUBLIC_NONE = 0n;
const SUITE_HYBRID = 2n;
const BODY_CELL = finalPrivateBodyCell();
const HEADER0_CELL = finalPrivateHeader0Cell();
const HEADER1_CELL = finalPrivateHeader1Cell();
const BODY_HASH = cellHashToBigInt(BODY_CELL);
const HEADER0 = cellHashToBigInt(HEADER0_CELL);
const HEADER1 = cellHashToBigInt(HEADER1_CELL);
const PUBLIC_HEADER_CELL = beginCell().storeBuffer(Buffer.from('PPH1:post')).endCell();
const PUBLIC_BODY_CELL = beginCell().storeBuffer(Buffer.from('public tombstone body')).endCell();
const PUBLIC_HEADER_HASH = cellHashToBigInt(PUBLIC_HEADER_CELL);
const PUBLIC_BODY_HASH = cellHashToBigInt(PUBLIC_BODY_CELL);
const VAULT_PENDING_PUBLISH_STALE_TTL = 86_400;
const VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH = 10_000_000_000n;
const VAULT_PRUNE_PENDING_PUBLISH_EXEC_RESERVE = 2_000_000n;
const VAULT_PENDING_PUBLISH_REFUND_EXEC_RESERVE = 4_200_000n;
const UINT160_MOD = 1n << 160n;
const OP_BOUNCED = 0xffffffff;
const OP_PUBLISH_PRIVATE_FROM_VAULT = 0xa4f862c0;
const OP_PUBLISH_PUBLIC_FROM_VAULT = 0x8c2a76b7;
const VAULT_PUBLISH_SIGNING_DOMAIN = 0x56504231n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function cellHashToBigInt(cell: Cell): bigint {
  return BigInt('0x' + cell.hash().toString('hex'));
}

function addressHash(address: Address): bigint {
  return BigInt('0x' + address.hash.toString('hex'));
}

function computePublishId(owner: Address, nonce: bigint, bodyHash: bigint, publishKind: bigint): bigint {
  return cellHashToBigInt(beginCell()
    .storeUint(GENESIS_HASH, 256)
    .storeAddress(owner)
    .storeUint(nonce, 64)
    .storeUint(bodyHash, 256)
    .storeUint(publishKind, 8)
    .endCell());
}

function computeBounceId(publishId: bigint): bigint {
  return publishId & ((1n << 64n) - 1n);
}

function computeBounceTag(publishId: bigint): bigint {
  return cellHashToBigInt(beginCell().storeUint(publishId, 256).endCell()) % UINT160_MOD;
}

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const user = await blockchain.treasury('vault-prune-user');
  const capsuleHub = await blockchain.treasury('vault-prune-capsulehub');
  const athWallet = await blockchain.treasury('vault-prune-ath-wallet');

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
  return { blockchain, vault, user, capsuleHub };
}

async function registerKeys(vault: any, user: any) {
  const messagingKeyPair = keyPairFromSeed(Buffer.alloc(32, 9));
  const authKeyPair = keyPairFromSeed(Buffer.alloc(32, 79));
  await vault.send(user.getSender(), { value: toNano('0.05') }, {
    $$type: 'RegisterMessagingKeys',
    ...hybridMessagingKeyFields(
      1n,
      BigInt('0x' + messagingKeyPair.publicKey.toString('hex')),
      BigInt('0x' + authKeyPair.publicKey.toString('hex')),
    ),
  } as RegisterMessagingKeys);
  return authKeyPair;
}

async function depositTon(vault: any, user: any, amount: bigint) {
  await vault.send(user.getSender(), { value: amount + 12_000_000n }, {
    $$type: 'DepositTon',
    amount,
  } as DepositTon);
}

function signedPrivatePublishBody(owner: Address, nonce: bigint, maxCharge: bigint, secretKey: Buffer, vaultAddress: Address) {
  const payload = beginCell()
    .storeUint(SIZE_STANDARD, 8)
    .storeUint(SUITE_HYBRID, 8)
    .storeUint(HEADER0, 256)
    .storeUint(HEADER1, 256)
    .storeUint(BODY_HASH, 256)
    .storeRef(HEADER0_CELL)
    .storeRef(HEADER1_CELL)
    .storeRef(BODY_CELL)
    .endCell();
  const signedPayload = beginCell()
    .storeUint(VAULT_PUBLISH_SIGNING_DOMAIN, 32)
    .storeUint(GENESIS_HASH, 256)
    .storeUint(addressHash(vaultAddress), 256)
    .storeUint(KIND_PRIVATE, 8)
    .storeUint(addressHash(owner), 256)
    .storeUint(nonce, 64)
    .storeUint(maxCharge, 128)
    .storeUint(SIZE_STANDARD, 8)
    .storeUint(SUITE_HYBRID, 8)
    .storeRef(payload)
    .endCell();
  return beginCell()
    .storeUint(0x7E1F5031, 32)
    .storeAddress(owner)
    .storeBuffer(sign(signedPayload.hash(), secretKey))
    .storeRef(signedPayload)
    .endCell();
}

function signedPublicPublishBody(owner: Address, nonce: bigint, maxCharge: bigint, secretKey: Buffer, vaultAddress: Address) {
  const payload = beginCell()
    .storeUint(PUBLIC_HEADER_HASH, 256)
    .storeUint(PUBLIC_BODY_HASH, 256)
    .storeRef(PUBLIC_HEADER_CELL)
    .storeRef(PUBLIC_BODY_CELL)
    .endCell();
  const signedPayload = beginCell()
    .storeUint(VAULT_PUBLISH_SIGNING_DOMAIN, 32)
    .storeUint(GENESIS_HASH, 256)
    .storeUint(addressHash(vaultAddress), 256)
    .storeUint(KIND_PUBLIC, 8)
    .storeUint(addressHash(owner), 256)
    .storeUint(nonce, 64)
    .storeUint(maxCharge, 128)
    .storeUint(SIZE_STANDARD, 8)
    .storeUint(SUITE_PUBLIC_NONE, 8)
    .storeRef(payload)
    .endCell();
  return beginCell()
    .storeUint(0x7E1F5032, 32)
    .storeAddress(owner)
    .storeBuffer(sign(signedPayload.hash(), secretKey))
    .storeRef(signedPayload)
    .endCell();
}

async function createPendingPublish() {
  const ctx = await setup();
  const keyPair = await registerKeys(ctx.vault, ctx.user);
  const maxCharge = await ctx.vault.getGetCanonicalPublishCharge(ctx.user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
  await depositTon(ctx.vault, ctx.user, maxCharge * 2n);
  const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
  await ctx.blockchain.sendMessage(external({
    to: ctx.vault.address,
    body: signedPrivatePublishBody(ctx.user.address, beforeUser.publish_nonce, maxCharge, keyPair.secretKey, ctx.vault.address),
  }));
  const publishId = computePublishId(ctx.user.address, beforeUser.publish_nonce, BODY_HASH, KIND_PRIVATE);
  return { ...ctx, publishId, maxCharge, beforeUser };
}

async function createPendingPublicPublish() {
  const ctx = await setup();
  const keyPair = await registerKeys(ctx.vault, ctx.user);
  const maxCharge = await ctx.vault.getGetCanonicalPublishCharge(ctx.user.address, KIND_PUBLIC, SIZE_STANDARD, SUITE_PUBLIC_NONE);
  await depositTon(ctx.vault, ctx.user, maxCharge * 2n);
  const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
  await ctx.blockchain.sendMessage(external({
    to: ctx.vault.address,
    body: signedPublicPublishBody(ctx.user.address, beforeUser.publish_nonce, maxCharge, keyPair.secretKey, ctx.vault.address),
  }));
  const publishId = computePublishId(ctx.user.address, beforeUser.publish_nonce, PUBLIC_BODY_HASH, KIND_PUBLIC);
  return { ...ctx, publishId, maxCharge, beforeUser };
}

describe('Vault milestone 14: stale PendingPublish prune', () => {
  it('VAULT-M14-01/RT-VCAPS-003: stale PendingPublish prune late ACK credits once only', async () => {
    const ctx = await createPendingPublish();
    const afterPendingUser = await ctx.vault.getGetUser(ctx.user.address);
    const beforePruneGlobal = await ctx.vault.getGetGlobal();
    expect(beforePruneGlobal.pending_publish_count).toBe(1n);
    expect(afterPendingUser.ath_balance).toBe(ctx.beforeUser.ath_balance);

    ctx.blockchain.now = 1_700_000_000 + VAULT_PENDING_PUBLISH_STALE_TTL + 1;
    await ctx.vault.send(ctx.user.getSender(), { value: VAULT_PRUNE_PENDING_PUBLISH_EXEC_RESERVE - 1n }, {
      $$type: 'PrunePendingPublish',
      publish_id: ctx.publishId,
    } as PrunePendingPublish);
    expect((await ctx.vault.getGetGlobal()).pending_publish_count).toBe(1n);

    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.05') }, {
      $$type: 'PrunePendingPublish',
      publish_id: ctx.publishId,
    } as PrunePendingPublish);

    const afterPruneUser = await ctx.vault.getGetUser(ctx.user.address);
    const afterPruneGlobal = await ctx.vault.getGetGlobal();
    expect(afterPruneGlobal.pending_publish_count).toBe(0n);
    expect(afterPruneUser.ath_balance).toBe(afterPendingUser.ath_balance);
    expect(afterPruneGlobal.airdrop_remaining_ath).toBe(beforePruneGlobal.airdrop_remaining_ath);

    await ctx.vault.send(ctx.capsuleHub.getSender(), { value: toNano('0.01') }, {
      $$type: 'CapsuleHubPublishAck',
      publish_id: ctx.publishId,
      entry_id: 1n,
      entry_uid: 0xaaaabbbbccccddddn,
    } as CapsuleHubPublishAck);

    const afterLateAckUser = await ctx.vault.getGetUser(ctx.user.address);
    const afterLateAckGlobal = await ctx.vault.getGetGlobal();
    expect(afterLateAckGlobal.pending_publish_count).toBe(0n);
    expect(afterLateAckUser.ath_balance).toBe(afterPendingUser.ath_balance + VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH);
    expect(afterLateAckGlobal.airdrop_remaining_ath).toBe(beforePruneGlobal.airdrop_remaining_ath - VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH);

    await ctx.vault.send(ctx.capsuleHub.getSender(), { value: toNano('0.01') }, {
      $$type: 'CapsuleHubPublishAck',
      publish_id: ctx.publishId,
      entry_id: 1n,
      entry_uid: 0xaaaabbbbccccddddn,
    } as CapsuleHubPublishAck);

    const afterDuplicateAckUser = await ctx.vault.getGetUser(ctx.user.address);
    const afterDuplicateAckGlobal = await ctx.vault.getGetGlobal();
    expect(afterDuplicateAckGlobal.pending_publish_count).toBe(0n);
    expect(afterDuplicateAckUser.ath_balance).toBe(afterLateAckUser.ath_balance);
    expect(afterDuplicateAckGlobal.airdrop_remaining_ath).toBe(afterLateAckGlobal.airdrop_remaining_ath);
  });

  it('VAULT-M14-02: non-stale PendingPublish cannot be pruned and remains pending', async () => {
    const ctx = await createPendingPublish();
    const afterPendingUser = await ctx.vault.getGetUser(ctx.user.address);
    expect((await ctx.vault.getGetGlobal()).pending_publish_count).toBe(1n);

    ctx.blockchain.now = 1_700_000_000 + VAULT_PENDING_PUBLISH_STALE_TTL - 1;
    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.05') }, {
      $$type: 'PrunePendingPublish',
      publish_id: ctx.publishId,
    } as PrunePendingPublish);

    const afterRejectedPruneUser = await ctx.vault.getGetUser(ctx.user.address);
    expect((await ctx.vault.getGetGlobal()).pending_publish_count).toBe(1n);
    expect(afterRejectedPruneUser.ath_balance).toBe(afterPendingUser.ath_balance);
  });

  it('VAULT-M14-03: bounced CapsuleHub publish must match the publish bounce tag, not only the 64-bit bounce_id', async () => {
    const ctx = await createPendingPublish();
    const afterPendingUser = await ctx.vault.getGetUser(ctx.user.address);
    const wrongPublishIdSameBounceSlot = ctx.publishId + (1n << 64n);
    const bounceId = computeBounceId(ctx.publishId);
    const wrongBounceTag = computeBounceTag(wrongPublishIdSameBounceSlot);
    expect(computeBounceId(wrongPublishIdSameBounceSlot)).toBe(bounceId);
    expect(wrongBounceTag).not.toBe(computeBounceTag(ctx.publishId));

    const bouncedBody = beginCell()
      .storeUint(OP_BOUNCED, 32)
      .storeUint(OP_PUBLISH_PRIVATE_FROM_VAULT, 32)
      .storeUint(bounceId, 64)
      .storeUint(wrongBounceTag, 160)
      .endCell();

    await ctx.blockchain.sendMessage(internal({
      from: ctx.capsuleHub.address,
      to: ctx.vault.address,
      value: toNano('0.01'),
      bounced: true,
      bounce: false,
      body: bouncedBody,
    }));

    expect((await ctx.vault.getGetGlobal()).pending_publish_count).toBe(1n);
    expect(await ctx.vault.getGetUser(ctx.user.address)).toMatchObject({
      ath_balance: afterPendingUser.ath_balance,
    });

    await ctx.vault.send(ctx.capsuleHub.getSender(), { value: toNano('0.01') }, {
      $$type: 'CapsuleHubPublishAck',
      publish_id: ctx.publishId,
      entry_id: 1n,
      entry_uid: 0xaaaabbbbccccddddn,
    } as CapsuleHubPublishAck);

    expect((await ctx.vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-M14-04: public tombstone accepts only the matching public bounce body', async () => {
    const ctx = await createPendingPublicPublish();
    const afterPendingUser = await ctx.vault.getGetUser(ctx.user.address);
    expect((await ctx.vault.getGetGlobal()).pending_publish_count).toBe(1n);

    ctx.blockchain.now = 1_700_000_000 + VAULT_PENDING_PUBLISH_STALE_TTL + 1;
    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.05') }, {
      $$type: 'PrunePendingPublish',
      publish_id: ctx.publishId,
    } as PrunePendingPublish);

    expect((await ctx.vault.getGetGlobal()).pending_publish_count).toBe(0n);
    const bounceId = computeBounceId(ctx.publishId);
    const bounceTag = computeBounceTag(ctx.publishId);
    const privateBouncedBody = beginCell()
      .storeUint(OP_BOUNCED, 32)
      .storeUint(OP_PUBLISH_PRIVATE_FROM_VAULT, 32)
      .storeUint(bounceId, 64)
      .storeUint(bounceTag, 160)
      .endCell();

    await ctx.blockchain.sendMessage(internal({
      from: ctx.capsuleHub.address,
      to: ctx.vault.address,
      value: toNano('0.01'),
      bounced: true,
      bounce: false,
      body: privateBouncedBody,
    }));

    expect((await ctx.vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect(await ctx.vault.getGetUser(ctx.user.address)).toMatchObject({
      ath_balance: afterPendingUser.ath_balance,
    });

    const publicBouncedBody = beginCell()
      .storeUint(OP_BOUNCED, 32)
      .storeUint(OP_PUBLISH_PUBLIC_FROM_VAULT, 32)
      .storeUint(bounceId, 64)
      .storeUint(bounceTag, 160)
      .endCell();

    await ctx.blockchain.sendMessage(internal({
      from: ctx.capsuleHub.address,
      to: ctx.vault.address,
      value: toNano('0.01'),
      bounced: true,
      bounce: false,
      body: publicBouncedBody,
    }));

    const afterBounceUser = await ctx.vault.getGetUser(ctx.user.address);
    expect((await ctx.vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect(afterBounceUser.ath_balance).toBe(afterPendingUser.ath_balance);
    expect(afterBounceUser.ton_balance).toBe(afterPendingUser.ton_balance + toNano('0.01') - VAULT_PENDING_PUBLISH_REFUND_EXEC_RESERVE);
  });
});
