import { describe, expect, it } from 'vitest';
import { Cell, beginCell, contractAddress, external, toNano } from '@ton/core';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { Vault, RegisterMessagingKeys, CapsuleHubBatchAck } from '../build/Vault/Vault_Vault';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
} from './helpers/capsule-cells';

// VPB2 batch publish — the single publish ABI (part_count = 1 is the only single-capsule path).
// Focus here: the pre-accept gates (floor / nonce / envelope) and the atomic reject-WITH-refund
// invariant. The success leg asserts the Vault->Hub hand-off assembles; the Hub ingest + ACK
// round-trip is covered in the Session 4 integration suite.

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const AUTH_KEY_PAIR = keyPairFromSeed(Buffer.alloc(32, 0x66));

const OP_PUBLISH_BATCH = 0x7e1f5041n;
const OP_PUBLISH_BATCH_TO_HUB = 0xa4f862d1n;
const OP_CAPSULE_HUB_BATCH_ACK = 0x874e5771n;
const OP_PRUNE_BATCH_PUBLISH = 0x720bdd6en;
const VAULT_BATCH_PUBLISH_SIGNING_DOMAIN = 0x56504232n;
const KIND_PRIVATE = 1n;
const VPB2_VERSION = 1n;
const SUITE_HYBRID = 2n;
const SIZE_1K = 1n;

const ACT_PUBLISH_BATCH = 7n;
const RES_PROCESSING = 0n;
const RES_CONFIRMED = 0x01n;
const RES_BOUNCED_REFUNDED = 0x02n;
const RES_TOMBSTONED = 0x03n;
const RJ_PART_SHAPE = 0x11n;
const AUX_BATCH_LEVEL = 0xffffffffffffffffn;

const VAULT_BATCH_PUBLISH_ID_DOMAIN = 0x42504931n; // "BPI1"
const AIRDROP_REWARD_PER_CAPSULE = 10_000_000_000n; // 10 ATH
const VAULT_PENDING_PUBLISH_STALE_TTL = 86400n;
const UINT64_MOD = 1n << 64n;
const UINT160_MOD = 1n << 160n;

const ENC_0 = 0x1000000000000000000000000000000000000000000000000000000000000001n;
const SIG_0 = 0x2000000000000000000000000000000000000000000000000000000000000002n;
const AUTH_0 = BigInt('0x' + AUTH_KEY_PAIR.publicKey.toString('hex'));
const PQ_HASH = 0x5000000000000000000000000000000000000000000000000000000000000005n;

function snakeCell(byteLength: number, fill = 0x5a): Cell {
  let tail: Cell | null = null;
  for (let offset = byteLength; offset > 0;) {
    const start = Math.max(0, offset - 127);
    const builder = beginCell().storeBuffer(Buffer.alloc(offset - start, fill));
    if (tail) builder.storeRef(tail);
    tail = builder.endCell();
    offset = start;
  }
  return tail ?? beginCell().endCell();
}
const PQ_CELL = snakeCell(1184);

function addressHash(address: any): bigint {
  return BigInt('0x' + address.hash.toString('hex'));
}
function cellHash(cell: Cell): bigint {
  return BigInt('0x' + cell.hash().toString('hex'));
}

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const user = await blockchain.treasury('vault-batch-user');
  const athWallet = await blockchain.treasury('vault-batch-ath');
  const capsuleHub = await blockchain.treasury('vault-batch-hub');
  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, GENESIS_HASH, true, true, 0n);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address, code: init.code, data: init.data, balance: toNano('3'), workchain: address.workChain,
  }));
  const vault = blockchain.openContract(new Vault(address, init));
  return { blockchain, vault, user, capsuleHub };
}

async function registerHybrid(vault: any, user: any) {
  await vault.send(user.getSender(), { value: toNano('0.1') }, {
    $$type: 'RegisterMessagingKeys',
    enc_pubkey: ENC_0, sign_pubkey: SIG_0, auth_pubkey: AUTH_0,
    pq_kem_pubkey_hash: PQ_HASH, pq_kem_pubkey_len: 1184n, pq_kem_pubkey: PQ_CELL,
    crypto_suite_mask: 2n,
  } as RegisterMessagingKeys);
}
async function depositTon(vault: any, user: any, amount: bigint) {
  await vault.send(user.getSender(), { value: amount + 2_000_000n }, { $$type: 'DepositTon', amount } as any);
}

// A valid 1K/hybrid private part (last in the list — 3 refs, no successor).
function validPrivatePart(): { cell: Cell } {
  const header0 = finalPrivateHeader0Cell();
  const header1 = finalPrivateHeader1Cell();
  const body = finalPrivateBodyCell(SIZE_1K);
  const cell = beginCell()
    .storeUint(SIZE_1K, 8)
    .storeUint(SUITE_HYBRID, 8)
    .storeUint(cellHash(header0), 256)
    .storeUint(cellHash(header1), 256)
    .storeUint(cellHash(body), 256)
    .storeRef(header0)
    .storeRef(header1)
    .storeRef(body)
    .endCell();
  return { cell };
}

interface BatchOpts {
  kind?: bigint;
  maxCharge: bigint;
  partCount: bigint;
  partsRoot: Cell;
  nonce: bigint;
  domain?: bigint;
  version?: bigint;
  trailerRef?: Cell;       // extra envelope ref (drain vector)
}

function batchExternalBody(vault: any, owner: any, opts: BatchOpts): Cell {
  const root = beginCell()
    .storeUint(opts.domain ?? VAULT_BATCH_PUBLISH_SIGNING_DOMAIN, 32)
    .storeUint(GENESIS_HASH, 256)
    .storeUint(addressHash(vault.address), 256)
    .storeUint(opts.kind ?? KIND_PRIVATE, 8)
    .storeUint(addressHash(owner.address), 256)
    .storeUint(opts.nonce, 64)
    .storeUint(opts.maxCharge, 128)
    .storeUint(opts.partCount, 8)
    .storeUint(opts.version ?? VPB2_VERSION, 8)
    .storeRef(opts.partsRoot)
    .endCell();
  const sig = sign(root.hash(), AUTH_KEY_PAIR.secretKey);
  const env = beginCell()
    .storeUint(OP_PUBLISH_BATCH, 32)
    .storeAddress(owner.address)
    .storeBuffer(sig)
    .storeRef(root);
  if (opts.trailerRef) env.storeRef(opts.trailerRef);
  return env.endCell();
}

// Replicates the contract's BPI1 publish_id derivation (computeBatchPublishId) so the test can construct the
// matching Hub ACK / bounce for a pending entry.
function computeBatchPublishId(owner: any, nonce: bigint, partsRoot: Cell, kind: bigint, partCount: bigint): bigint {
  return cellHash(beginCell()
    .storeUint(VAULT_BATCH_PUBLISH_ID_DOMAIN, 32)
    .storeUint(GENESIS_HASH, 256)
    .storeAddress(owner.address)
    .storeUint(nonce, 64)
    .storeUint(cellHash(partsRoot), 256)
    .storeUint(kind, 8)
    .storeUint(partCount, 8)
    .endCell());
}
const bounceIdOf = (publishId: bigint): bigint => publishId % UINT64_MOD;
const bounceTagOf = (publishId: bigint): bigint =>
  cellHash(beginCell().storeUint(publishId, 256).endCell()) % UINT160_MOD;

// Sends a valid 1-part private batch and returns its identifiers (publish_id + the pending bounce key/tag).
async function sendOkBatch(blockchain: any, vault: any, user: any, maxCharge = toNano('1')) {
  const nonce = (await vault.getGetUser(user.address)).publish_nonce;
  const partsRoot = validPrivatePart().cell;
  await blockchain.sendMessage(external({ to: vault.address, body: batchExternalBody(vault, user, {
    maxCharge, partCount: 1n, partsRoot, nonce,
  }) }));
  const publishId = computeBatchPublishId(user, nonce, partsRoot, KIND_PRIVATE, 1n);
  return { nonce, publishId, bounceId: bounceIdOf(publishId), bounceTag: bounceTagOf(publishId) };
}

function vaultTxClean(res: any, vault: any): boolean {
  const vtx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === vault.address.toString());
  const cp: any = vtx?.description?.computePhase;
  return vtx !== undefined && (cp?.type !== 'vm' || cp.exitCode === 0);
}
function vaultTxExit(res: any, vault: any): number {
  const vtx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === vault.address.toString());
  const cp: any = vtx?.description?.computePhase;
  return cp?.type === 'vm' ? cp.exitCode : 0;
}

describe('Vault VPB2: batch publish path', () => {
  it('BATCH-FLOOR-01: max_charge below BatchChargeFloor is rejected pre-accept (16485), no nonce burned', async () => {
    const { blockchain, vault, user } = await setup();
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;

    const body = batchExternalBody(vault, user, {
      maxCharge: 1000n, partCount: 1n, partsRoot: beginCell().endCell(), nonce,
    });
    await expect(blockchain.sendMessage(external({ to: vault.address, body }))).rejects.toThrow(/16485/);
    // Pre-accept rejection: the nonce is untouched and no receipt was written.
    expect((await vault.getGetUser(user.address)).publish_nonce).toBe(nonce);
    expect((await vault.getGetUserReceipts(user.address)).receipts.size).toBe(0);
  });

  it('BATCH-BALANCE-01: a floor-clearing charge above the vault balance is rejected pre-accept (16463)', async () => {
    const { blockchain, vault, user } = await setup();
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('0.05')); // tiny balance, below any real charge
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;

    const body = batchExternalBody(vault, user, {
      maxCharge: toNano('1'), partCount: 1n, partsRoot: beginCell().endCell(), nonce,
    });
    await expect(blockchain.sendMessage(external({ to: vault.address, body }))).rejects.toThrow(/16463/);
    expect((await vault.getGetUser(user.address)).publish_nonce).toBe(nonce);
  });

  it('BATCH-NONCE-01: a stale/forward nonce is rejected pre-accept (16453)', async () => {
    const { blockchain, vault, user } = await setup();
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;

    const body = batchExternalBody(vault, user, {
      maxCharge: toNano('1'), partCount: 1n, partsRoot: beginCell().endCell(), nonce: nonce + 5n,
    });
    await expect(blockchain.sendMessage(external({ to: vault.address, body }))).rejects.toThrow(/16453/);
    expect((await vault.getGetUser(user.address)).publish_nonce).toBe(nonce);
  });

  it('BATCH-ENVELOPE-01: an extra ref appended outside the signed envelope is rejected pre-accept (16901)', async () => {
    const { blockchain, vault, user } = await setup();
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;

    const body = batchExternalBody(vault, user, {
      maxCharge: toNano('1'), partCount: 1n, partsRoot: validPrivatePart().cell, nonce,
      trailerRef: beginCell().storeUint(0xdead, 16).endCell(),
    });
    await expect(blockchain.sendMessage(external({ to: vault.address, body }))).rejects.toThrow(/16901/);
    expect((await vault.getGetUser(user.address)).publish_nonce).toBe(nonce);
  });

  it('BATCH-REJECT-01: a malformed part triggers an ATOMIC reject — nonce burned, receipt RJ_PART_SHAPE, refund', async () => {
    const { blockchain, vault, user } = await setup();
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const balanceBefore = (await vault.getGetUser(user.address)).ton_balance;
    const maxCharge = toNano('0.5'); // clears the floor; well under the balance

    // A part cell with the wrong bit width (not 784) — fails the very first shape gate.
    const badPart = beginCell().storeUint(0, 100).endCell();
    const body = batchExternalBody(vault, user, {
      maxCharge, partCount: 1n, partsRoot: badPart, nonce,
    });
    await blockchain.sendMessage(external({ to: vault.address, body })); // accepted, then atomically rejected

    const afterUser = await vault.getGetUser(user.address);
    expect(afterUser.publish_nonce).toBe(nonce + 1n); // nonce IS burned (post-accept)

    const receipts = await vault.getGetUserReceipts(user.address);
    const slot = receipts.receipts.get(Number(nonce % 20n));
    expect(slot).toBeDefined();
    expect(slot!.nonce).toBe(nonce);
    expect(slot!.action).toBe(ACT_PUBLISH_BATCH);
    expect(slot!.result).toBe(RJ_PART_SHAPE);
    expect(slot!.aux).toBe(0n);          // failing part index 0
    expect(slot!.part_count).toBe(1n);

    // Refund invariant: the user was charged only reject_fee (<= floor), NOT the full max_charge.
    const charged = balanceBefore - afterUser.ton_balance;
    expect(charged).toBeGreaterThan(0n);
    expect(charged).toBeLessThan(maxCharge);
  });

  it('BATCH-SUCCESS-01: a valid 1-part private batch hands off to the Hub and leaves the receipt PROCESSING', async () => {
    const { blockchain, vault, user, capsuleHub } = await setup();
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;

    const body = batchExternalBody(vault, user, {
      maxCharge: toNano('1'), partCount: 1n, partsRoot: validPrivatePart().cell, nonce,
    });
    const res = await blockchain.sendMessage(external({ to: vault.address, body }));

    // The Vault forwarded a PublishBatchToHub to the configured Hub.
    const hubTx = res.transactions.find((tx: any) =>
      tx.inMessage?.info?.type === 'internal' &&
      tx.inMessage.info.dest?.toString() === capsuleHub.address.toString());
    expect(hubTx).toBeDefined();
    expect(hubTx!.inMessage!.body.beginParse().loadUint(32)).toBe(Number(OP_PUBLISH_BATCH_TO_HUB));

    // Nonce burned; the receipt is PROCESSING (the ACK will later confirm it).
    const afterUser = await vault.getGetUser(user.address);
    expect(afterUser.publish_nonce).toBe(nonce + 1n);
    const slot = (await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % 20n));
    expect(slot).toBeDefined();
    expect(slot!.action).toBe(ACT_PUBLISH_BATCH);
    expect(slot!.result).toBe(RES_PROCESSING);
    expect(slot!.part_count).toBe(1n);

    // The outstanding-pending-publish counter is incremented for the live pending_batch_publishes entry
    // (decremented later by the Group D ACK/bounce/prune settlement).
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(1n);
  });

  it('BATCH-PENDING-COUNT-01: a rejected batch does NOT increment the pending-publish counter', async () => {
    const { blockchain, vault, user } = await setup();
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;

    const badPart = beginCell().storeUint(0, 100).endCell(); // wrong shape → atomic reject
    await blockchain.sendMessage(external({ to: vault.address, body: batchExternalBody(vault, user, {
      maxCharge: toNano('0.5'), partCount: 1n, partsRoot: badPart, nonce,
    }) }));

    expect((await vault.getGetUser(user.address)).publish_nonce).toBe(nonce + 1n); // nonce burned (post-accept)
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);            // but no pending entry created
  });
});

describe('Vault VPB2: batch settlement (Group D)', () => {
  it('SETTLE-ACK-01: a Hub ACK confirms the batch — refund + per-capsule airdrop + receipt CONFIRMED + pending cleared', async () => {
    const { blockchain, vault, user, capsuleHub } = await setup();
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));
    const { nonce, publishId, bounceId } = await sendOkBatch(blockchain, vault, user);

    expect((await vault.getGetGlobal()).pending_publish_count).toBe(1n);
    expect((await vault.getGetPendingBatchPublish(bounceId)).exists).toBe(true);
    const balBefore = (await vault.getGetUser(user.address)).ton_balance;

    await vault.send(capsuleHub.getSender(), { value: toNano('0.1') }, {
      $$type: 'CapsuleHubBatchAck', publish_id: publishId, first_entry_id: 100n, part_count: 1n, batch_uid: 0n,
    } as CapsuleHubBatchAck);

    const afterUser = await vault.getGetUser(user.address);
    expect(afterUser.ath_balance).toBe(AIRDROP_REWARD_PER_CAPSULE);      // 10 ATH for 1 capsule (Q2)
    expect(afterUser.ton_balance).toBeGreaterThan(balBefore);            // over-hold refunded to the ledger
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n); // pending cleared + count decremented
    expect((await vault.getGetPendingBatchPublish(bounceId)).exists).toBe(false);
    const slot = (await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % 20n));
    expect(slot!.result).toBe(RES_CONFIRMED);
    expect(slot!.aux).toBe(100n); // first_entry_id
  });

  it('SETTLE-ACK-02: an ACK from a non-Hub sender is rejected (16550); pending + airdrop untouched', async () => {
    const { blockchain, vault, user } = await setup();
    const attacker = await blockchain.treasury('vault-batch-attacker');
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));
    const { publishId, bounceId } = await sendOkBatch(blockchain, vault, user);

    // Internal messages don't reject in JS — the throw is recorded on the tx; assert the exit code there.
    const res = await blockchain.sendMessage(internal({
      from: attacker.address, to: vault.address, value: toNano('0.1'), bounce: true,
      body: beginCell().storeUint(OP_CAPSULE_HUB_BATCH_ACK, 32).storeUint(publishId, 256)
        .storeUint(1n, 64).storeUint(1n, 8).storeUint(0n, 256).endCell(),
    }));
    expect(vaultTxExit(res, vault)).toBe(16550);
    expect((await vault.getGetPendingBatchPublish(bounceId)).exists).toBe(true);
    expect((await vault.getGetUser(user.address)).ath_balance).toBe(0n);
  });

  it('SETTLE-BOUNCE-01: a Hub bounce refunds the call value + receipt BOUNCED_REFUNDED + pending cleared (no airdrop)', async () => {
    const { blockchain, vault, user, capsuleHub } = await setup();
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));
    const { nonce, bounceId, bounceTag } = await sendOkBatch(blockchain, vault, user);
    const balBefore = (await vault.getGetUser(user.address)).ton_balance;

    await blockchain.sendMessage(internal({
      from: capsuleHub.address, to: vault.address, value: toNano('0.3'), bounced: true, bounce: false,
      body: beginCell().storeUint(0xffffffff, 32).storeUint(OP_PUBLISH_BATCH_TO_HUB, 32)
        .storeUint(bounceId, 64).storeUint(bounceTag, 160).endCell(),
    }));

    expect((await vault.getGetUser(user.address)).ton_balance).toBeGreaterThan(balBefore); // refunded
    expect((await vault.getGetUser(user.address)).ath_balance).toBe(0n);                    // NO airdrop on bounce
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await vault.getGetPendingBatchPublish(bounceId)).exists).toBe(false);
    const slot = (await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % 20n));
    expect(slot!.result).toBe(RES_BOUNCED_REFUNDED);
  });

  it('SETTLE-BOUNCE-02: a forged bounce (wrong tag) is silently absorbed — handler never throws, pending stays live', async () => {
    const { blockchain, vault, user, capsuleHub } = await setup();
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));
    const { bounceId } = await sendOkBatch(blockchain, vault, user);

    const res = await blockchain.sendMessage(internal({
      from: capsuleHub.address, to: vault.address, value: toNano('0.1'), bounced: true, bounce: false,
      body: beginCell().storeUint(0xffffffff, 32).storeUint(OP_PUBLISH_BATCH_TO_HUB, 32)
        .storeUint(bounceId, 64).storeUint(0xdeadn, 160).endCell(), // wrong bounce_tag
    }));

    expect(vaultTxClean(res, vault)).toBe(true);                                  // fail-closed: did NOT throw
    expect((await vault.getGetPendingBatchPublish(bounceId)).exists).toBe(true);  // pending still live
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(1n);          // not settled
  });

  it('SETTLE-PRUNE-01: a stale pending tombstones (count down, receipt TOMBSTONED); a late ACK in-window still settles', async () => {
    const { blockchain, vault, user, capsuleHub } = await setup();
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));
    const { nonce, publishId, bounceId } = await sendOkBatch(blockchain, vault, user);

    const pruneBody = beginCell().storeUint(OP_PRUNE_BATCH_PUBLISH, 32).storeUint(publishId, 256).endCell();
    // not yet stale -> prune is rejected (16562)
    const early = await blockchain.sendMessage(internal({
      from: user.address, to: vault.address, value: toNano('0.01'), bounce: true, body: pruneBody,
    }));
    expect(vaultTxExit(early, vault)).toBe(16562);
    expect((await vault.getGetPendingBatchPublish(bounceId)).tombstone).toBe(false); // untouched

    blockchain.now = 1_700_000_000 + Number(VAULT_PENDING_PUBLISH_STALE_TTL) + 10; // now stale
    await blockchain.sendMessage(internal({
      from: user.address, to: vault.address, value: toNano('0.01'), bounce: true, body: pruneBody,
    }));

    const pending = await vault.getGetPendingBatchPublish(bounceId);
    expect(pending.exists).toBe(true);
    expect(pending.tombstone).toBe(true);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n); // tombstone decremented the lane
    expect((await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % 20n))!.result).toBe(RES_TOMBSTONED);

    // tombstone-window ACK still settles: airdrop credited, receipt overwritten to CONFIRMED, pending deleted,
    // count stays 0 (already decremented at prune — no double decrement).
    await vault.send(capsuleHub.getSender(), { value: toNano('0.1') }, {
      $$type: 'CapsuleHubBatchAck', publish_id: publishId, first_entry_id: 7n, part_count: 1n, batch_uid: 0n,
    } as CapsuleHubBatchAck);
    expect((await vault.getGetUser(user.address)).ath_balance).toBe(AIRDROP_REWARD_PER_CAPSULE);
    expect((await vault.getGetPendingBatchPublish(bounceId)).exists).toBe(false);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % 20n))!.result).toBe(RES_CONFIRMED);
  });
});
