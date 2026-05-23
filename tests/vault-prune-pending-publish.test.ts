import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  Vault,
  DepositTon,
  SetSession,
  TopUpMessageBudget,
  PrunePendingPublish,
  CapsuleHubPublishAck,
} from '../build/Vault/Vault_Vault';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
} from './helpers/capsule-cells';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const MAGIC = 0x504c5352n;
const VERSION = 1n;
const OP_PRIVATE = 0x686694C6n;
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

function bufToBigInt(buf: Buffer): bigint {
  return BigInt('0x' + buf.toString('hex'));
}

function bigintToBuffer(v: bigint, bytes = 32): Buffer {
  return Buffer.from(v.toString(16).padStart(bytes * 2, '0'), 'hex');
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

async function fundSession(vault: any, user: any, sessionPubkey: bigint, expiresAt: number, budget = toNano('0.2')) {
  await vault.send(user.getSender(), { value: toNano('1.1') }, {
    $$type: 'DepositTon',
    amount: toNano('1'),
  } as DepositTon);
  await vault.send(user.getSender(), { value: toNano('0.1') }, {
    $$type: 'SetSession',
    session_pubkey: sessionPubkey,
    expires_at: BigInt(expiresAt),
  } as SetSession);
  await vault.send(user.getSender(), { value: toNano('0.1') }, {
    $$type: 'TopUpMessageBudget',
    amount: budget,
  } as TopUpMessageBudget);
}

async function buildExternalRequest(params: {
  vault: any;
  owner: Address;
  sessionId: bigint;
  nonce: bigint;
  validUntil: bigint;
  maxCharge: bigint;
  secretKey: Buffer;
}) {
  const sigHash = await params.vault.getGetSessionPublishHash(
    OP_PRIVATE,
    params.owner,
    params.sessionId,
    params.nonce,
    params.validUntil,
    KIND_PRIVATE,
    SIZE_STANDARD,
    SUITE_CLASSICAL,
    params.maxCharge,
    BODY_HASH,
    HEADER0,
    HEADER1,
  );
  const signature = sign(bigintToBuffer(sigHash), params.secretKey);
  const hashesRef = beginCell().storeUint(BODY_HASH, 256).storeUint(HEADER0, 256).storeUint(HEADER1, 256).endCell();
  const signatureRef = beginCell().storeBuffer(signature).endCell();
  const payloadRef = beginCell().storeRef(HEADER0_CELL).storeRef(HEADER1_CELL).storeRef(BODY_CELL).endCell();
  return beginCell()
    .storeUint(MAGIC, 32)
    .storeUint(VERSION, 8)
    .storeUint(OP_PRIVATE, 32)
    .storeAddress(params.owner)
    .storeUint(params.sessionId, 256)
    .storeUint(params.nonce, 64)
    .storeUint(params.validUntil, 32)
    .storeUint(KIND_PRIVATE, 8)
    .storeUint(SIZE_STANDARD, 8)
    .storeUint(SUITE_CLASSICAL, 8)
    .storeUint(params.maxCharge, 128)
    .storeRef(hashesRef)
    .storeRef(signatureRef)
    .storeRef(payloadRef)
    .endCell()
    .beginParse();
}

async function createPendingPublish(seedByte: number) {
  const ctx = await setup();
  const kp = keyPairFromSeed(Buffer.alloc(32, seedByte));
  const now = ctx.blockchain.now ?? 0;
  await fundSession(ctx.vault, ctx.user, bufToBigInt(kp.publicKey), now + 1000);
  const session = await ctx.vault.getGetSession(ctx.user.address);
  const maxCharge = await ctx.vault.getGetCanonicalSessionMaxCharge(ctx.user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
  const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
  const external = await buildExternalRequest({
    vault: ctx.vault,
    owner: ctx.user.address,
    sessionId: session.session_id,
    nonce: 0n,
    validUntil: BigInt(now + 100),
    maxCharge,
    secretKey: kp.secretKey,
  });
  await ctx.vault.sendExternal(external);
  const publishId = computePublishId(ctx.user.address, 0n, BODY_HASH, KIND_PRIVATE);
  return { ...ctx, publishId, maxCharge, beforeUser };
}

describe('Vault milestone 14: stale PendingPublish prune', () => {
  it('VAULT-M14-01: stale PendingPublish prune keeps tombstone so late ACK refunds capped value', async () => {
    const ctx = await createPendingPublish(81);
    const afterPendingUser = await ctx.vault.getGetUser(ctx.user.address);
    const beforePruneGlobal = await ctx.vault.getGetGlobal();
    expect(beforePruneGlobal.pending_publish_count).toBe(1n);
    expect(ctx.beforeUser.message_budget_ton - afterPendingUser.message_budget_ton).toBe(ctx.maxCharge);
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
    expect(afterPruneUser.message_budget_ton).toBe(afterPendingUser.message_budget_ton);
    expect(afterPruneUser.ath_balance).toBe(afterPendingUser.ath_balance);
    expect(afterPruneGlobal.airdrop_remaining_ath).toBe(beforePruneGlobal.airdrop_remaining_ath);
    expect(afterPruneGlobal.airdrop_distributed_ath).toBe(beforePruneGlobal.airdrop_distributed_ath);

    await ctx.vault.send(ctx.capsuleHub.getSender(), { value: toNano('0.01') }, {
      $$type: 'CapsuleHubPublishAck',
      publish_id: ctx.publishId,
      entry_id: 1n,
      entry_uid: 0xaaaabbbbccccddddn,
    } as CapsuleHubPublishAck);

    const afterLateAckUser = await ctx.vault.getGetUser(ctx.user.address);
    const afterLateAckGlobal = await ctx.vault.getGetGlobal();
    expect(afterLateAckGlobal.pending_publish_count).toBe(0n);
    expect(afterLateAckUser.message_budget_ton).toBeGreaterThan(afterPendingUser.message_budget_ton);
    expect(afterLateAckUser.message_budget_ton).toBeLessThanOrEqual(afterPendingUser.message_budget_ton + toNano('0.01'));
    expect(afterLateAckUser.ath_balance).toBe(afterPendingUser.ath_balance + VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH);
    expect(afterLateAckGlobal.airdrop_remaining_ath).toBe(beforePruneGlobal.airdrop_remaining_ath - VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH);
    expect(afterLateAckGlobal.airdrop_distributed_ath).toBe(beforePruneGlobal.airdrop_distributed_ath + VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH);
  });

  it('VAULT-M14-02: non-stale PendingPublish cannot be pruned and remains pending', async () => {
    const ctx = await createPendingPublish(82);
    const afterPendingUser = await ctx.vault.getGetUser(ctx.user.address);
    expect((await ctx.vault.getGetGlobal()).pending_publish_count).toBe(1n);

    ctx.blockchain.now = 1_700_000_000 + VAULT_PENDING_PUBLISH_STALE_TTL - 1;
    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.05') }, {
      $$type: 'PrunePendingPublish',
      publish_id: ctx.publishId,
    } as PrunePendingPublish);

    const afterRejectedPruneUser = await ctx.vault.getGetUser(ctx.user.address);
    expect((await ctx.vault.getGetGlobal()).pending_publish_count).toBe(1n);
    expect(afterRejectedPruneUser.message_budget_ton).toBe(afterPendingUser.message_budget_ton);
  });
});
