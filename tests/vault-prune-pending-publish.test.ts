import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  Vault,
  RegisterMessagingKeys,
  PublishPrivateFromWallet,
  PrunePendingPublish,
  CapsuleHubPublishAck,
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
const BODY_HASH = cellHashToBigInt(BODY_CELL);
const HEADER0 = cellHashToBigInt(HEADER0_CELL);
const HEADER1 = cellHashToBigInt(HEADER1_CELL);
const VAULT_PENDING_PUBLISH_STALE_TTL = 86_400;
const VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH = 10_000_000_000n;
const VAULT_PRUNE_PENDING_PUBLISH_EXEC_RESERVE = 2_000_000n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function cellHashToBigInt(cell: Cell): bigint {
  return BigInt('0x' + cell.hash().toString('hex'));
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

async function createPendingPublish(seedNonce: bigint) {
  const ctx = await setup();
  await registerKeys(ctx.vault, ctx.user);
  const maxCharge = await ctx.vault.getGetCanonicalPublishCharge(ctx.user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
  const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
  await ctx.vault.send(ctx.user.getSender(), { value: maxCharge }, {
    $$type: 'PublishPrivateFromWallet',
    client_nonce: seedNonce,
    max_charge: maxCharge,
    size_class: SIZE_STANDARD,
    crypto_suite: SUITE_CLASSICAL,
    header_0_hash: HEADER0,
    header_1_hash: HEADER1,
    body_hash: BODY_HASH,
    header_0: HEADER0_CELL,
    header_1: HEADER1_CELL,
    body: BODY_CELL,
  } as PublishPrivateFromWallet);
  const publishId = computePublishId(ctx.user.address, seedNonce, BODY_HASH, KIND_PRIVATE);
  return { ...ctx, publishId, maxCharge, beforeUser };
}

describe('Vault milestone 14: stale PendingPublish prune', () => {
  it('VAULT-M14-01: stale PendingPublish prune keeps tombstone so late ACK refunds and credits airdrop', async () => {
    const ctx = await createPendingPublish(0n);
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
  });

  it('VAULT-M14-02: non-stale PendingPublish cannot be pruned and remains pending', async () => {
    const ctx = await createPendingPublish(1n);
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
});
