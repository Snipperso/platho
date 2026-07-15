import { describe, expect, it } from 'vitest';
import { Cell, Dictionary, beginCell, external, toNano } from '@ton/core';
import { internal } from '@ton/sandbox';

// clean-16 L6/#10: raise the workchain MsgForwardPrices (config param 25) by `factor` to simulate a post-deploy
// TON governance fee increase. Used to prove the batch reject recovers the REAL (risen) import, not the stale pin.
function raiseForwardFeeConfig(blockchain: any, factor: bigint) {
  const dict = Dictionary.loadDirect(Dictionary.Keys.Int(32), Dictionary.Values.Cell(), blockchain.config);
  const s = dict.get(25)!.beginParse();
  const tag = s.loadUint(8);          // 0xea
  const lump = s.loadUintBig(64);
  const bit = s.loadUintBig(64);
  const cell = s.loadUintBig(64);
  const ihr = s.loadUint(32);
  const firstFrac = s.loadUint(16);
  const nextFrac = s.loadUint(16);
  dict.set(25, beginCell()
    .storeUint(tag, 8)
    .storeUint(lump * factor, 64)
    .storeUint(bit * factor, 64)
    .storeUint(cell * factor, 64)
    .storeUint(ihr, 32)
    .storeUint(firstFrac, 16)
    .storeUint(nextFrac, 16)
    .endCell());
  blockchain.setConfig(beginCell().storeDictDirect(dict).endCell());
}
import { CapsuleHubBatchAck } from '../build/Vault/Vault_Vault';
import {
  OP_PUBLISH_BATCH_TO_HUB,
  OP_CAPSULE_HUB_BATCH_ACK,
  OP_PRUNE_BATCH_PUBLISH,
  KIND_PRIVATE,
  ACT_PUBLISH_BATCH,
  RES_PROCESSING,
  RES_CONFIRMED,
  RES_BOUNCED_REFUNDED,
  RES_TOMBSTONED,
  RJ_PART_SHAPE,
  AIRDROP_REWARD_PER_CAPSULE,
  VAULT_PENDING_PUBLISH_STALE_TTL,
  partsList,
  batchExternalBody,
  computeBatchPublishId,
  bounceIdOf,
  bounceTagOf,
  setupVault,
  registerHybrid,
  depositTon,
  vaultTxClean,
  vaultTxExit,
} from './helpers/vpb2';

// VPB2 batch publish — the single publish ABI (part_count = 1 is the only single-capsule path).
// Focus here: the pre-accept gates (floor / nonce / envelope) and the atomic reject-WITH-refund
// invariant. The success leg asserts the Vault->Hub hand-off assembles; the Hub ingest + ACK
// round-trip is covered in the Session 4 integration suite. Wire format + scaffolding: ./helpers/vpb2.

const setup = () => setupVault();
const validPrivatePart = () => partsList(KIND_PRIVATE, 1);

// Sends a valid 1-part private batch and returns its identifiers (publish_id + the pending bounce key/tag).
async function sendOkBatch(blockchain: any, vault: any, user: any, maxCharge = toNano('1')) {
  const nonce = (await vault.getGetUser(user.address)).publish_nonce;
  const partsRoot = validPrivatePart();
  await blockchain.sendMessage(external({ to: vault.address, body: batchExternalBody({
    vaultAddr: vault.address, owner: user.address, maxCharge, partCount: 1n, partsRoot, nonce,
  }) }));
  const publishId = computeBatchPublishId({ owner: user.address, nonce, partsRoot, kind: KIND_PRIVATE, partCount: 1n });
  return { nonce, publishId, bounceId: bounceIdOf(publishId), bounceTag: bounceTagOf(publishId) };
}

describe('Vault VPB2: batch publish path', () => {
  it('BATCH-FLOOR-01: max_charge below BatchChargeFloor is rejected pre-accept (16485), no nonce burned', async () => {
    const { blockchain, vault, user } = await setup();
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;

    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address,
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

    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address,
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

    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address,
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

    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address,
      maxCharge: toNano('1'), partCount: 1n, partsRoot: validPrivatePart(), nonce,
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
    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address,
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

  it('BATCH-REJECT-DRAIN-01 (L6/#10): a post-deploy forward-fee spike is recovered on reject — the pinned floor never drains the Vault', async () => {
    const { blockchain, vault, user } = await setup();
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('5'));

    // Reject a malformed 1-part batch and return the amount the Vault kept (== reject_fee).
    async function rejectAndCharge(maxCharge: bigint): Promise<bigint> {
      const nonce = (await vault.getGetUser(user.address)).publish_nonce;
      const before = (await vault.getGetUser(user.address)).ton_balance;
      const badPart = beginCell().storeUint(0, 100).endCell(); // wrong bit width -> post-accept reject
      await blockchain.sendMessage(external({ to: vault.address, body: batchExternalBody({
        vaultAddr: vault.address, owner: user.address, maxCharge, partCount: 1n, partsRoot: badPart, nonce,
      }) }));
      return before - (await vault.getGetUser(user.address)).ton_balance;
    }

    const maxCharge = toNano('1');
    // At the pinned config the runtime import << floor, so the reject keeps exactly the pinned floor.
    const chargedDefault = await rejectAndCharge(maxCharge);
    expect(chargedDefault).toBeGreaterThan(0n);

    // Simulate a large TON governance forward-fee increase AFTER deploy (the pins are immutable).
    // A large factor so even a small external's runtime import clears the max-size pinned floor.
    const fwdBefore = await vault.getDiagForwardFee(3n, 1000n);
    raiseForwardFeeConfig(blockchain, 2000n);
    const fwdAfter = await vault.getDiagForwardFee(3n, 1000n);
    expect(fwdAfter).toBeGreaterThan(fwdBefore * 1000n); // config really rose (getForwardFee tracks it)

    // #10: the reject now recovers the REAL (risen) import instead of the stale pin — the Vault keeps MORE,
    // so a fee spike can never make a reject net-drain the Vault. Still capped at max_charge (refund >= 0).
    const chargedRaised = await rejectAndCharge(maxCharge);
    expect(chargedRaised).toBeGreaterThan(chargedDefault);       // tracks the real import UP (no drain)
    expect(chargedRaised).toBeGreaterThan(chargedDefault + toNano('0.05')); // materially above the stale pin
    expect(chargedRaised).toBeLessThanOrEqual(maxCharge);        // capped -> refund never negative
  });

  it('BATCH-SUCCESS-01: a valid 1-part private batch hands off to the Hub and leaves the receipt PROCESSING', async () => {
    const { blockchain, vault, user, capsuleHub } = await setup();
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;

    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address,
      maxCharge: toNano('1'), partCount: 1n, partsRoot: validPrivatePart(), nonce,
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
    await blockchain.sendMessage(external({ to: vault.address, body: batchExternalBody({
      vaultAddr: vault.address, owner: user.address,
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
