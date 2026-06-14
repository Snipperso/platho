import { describe, expect, it } from 'vitest';
import { Dictionary, beginCell, external, toNano } from '@ton/core';
import { internal } from '@ton/sandbox';
import { CapsuleHubBatchAck, dictValueParserReceiptSlot } from '../build/Vault/Vault_Vault';
import {
  OP_PUBLISH_BATCH_TO_HUB,
  OP_PRUNE_BATCH_PUBLISH,
  KIND_PRIVATE,
  VAULT_PENDING_PUBLISH_STALE_TTL,
  partsList,
  batchExternalBody,
  computeBatchPublishId,
  bounceIdOf,
  bounceTagOf,
  setupVault,
  registerHybrid,
  depositTon,
} from './helpers/vpb2';
import {
  interpretBatchPublishReceipt,
  readBatchPublishReceipt,
  decodeVaultUserReceiptsViewStack,
  BATCH_PUBLISH_RECEIPT_STATUS,
  ACT_PUBLISH_BATCH,
  RES_PROCESSING,
  RES_CONFIRMED,
  RES_BOUNCED_REFUNDED,
  RES_TOMBSTONED,
  RJ_PART_SHAPE,
  AUX_BATCH_LEVEL,
  RECEIPT_RING_K,
} from '../web/vault-ton-rpc-provider.mjs';

// Session 6 step 2 (send-confirm). PROVES the PWA client's batch-publish CONFIRMATION layer reads the
// Vault receipt ring correctly for every batch outcome. We drive the REAL sandbox SETTLE scenarios
// (mirroring tests/vault-batch-publish.test.ts: accept -> Hub ACK / bounce / prune / atomic reject),
// read the on-chain receipt via the sandbox getter vault.getGetUserReceipts(owner), convert each slot
// into the exact shape web/vault-ton-rpc-provider.mjs's decoder/reader produces (camelCase, all
// bigints), and assert interpretBatchPublishReceipt classifies the status the client UI will act on.

// The @ton/core getter returns ReceiptSlot fields as snake_case bigints; the provider's stack decoder
// (decodeVaultUserReceiptsViewStack) yields { nonce, action, result, aux, partCount, at }. Mirror that
// projection so the pure interpreter sees byte-identical inputs to the production read path.
function toReaderSlot(slot: any) {
  if (!slot) return null;
  return {
    nonce: slot.nonce,
    action: slot.action,
    result: slot.result,
    aux: slot.aux,
    partCount: slot.part_count,
    at: slot.at,
  };
}

// Read the receipt ring through the sandbox getter and project the slot at nonce % K into reader shape.
async function readSlot(vault: any, owner: any, nonce: bigint) {
  const view = await vault.getGetUserReceipts(owner);
  return toReaderSlot(view.receipts.get(Number(nonce % BigInt(RECEIPT_RING_K))));
}

const validPrivatePart = () => partsList(KIND_PRIVATE, 1);

// Sends a valid 1-part private batch (mirrors vault-batch-publish.test.ts sendOkBatch) and returns ids.
async function sendOkBatch(blockchain: any, vault: any, user: any) {
  const nonce = (await vault.getGetUser(user.address)).publish_nonce;
  const partsRoot = validPrivatePart();
  await blockchain.sendMessage(external({ to: vault.address, body: batchExternalBody({
    vaultAddr: vault.address, owner: user.address, maxCharge: toNano('1'), partCount: 1n, partsRoot, nonce,
  }) }));
  const publishId = computeBatchPublishId({ owner: user.address, nonce, partsRoot, kind: KIND_PRIVATE, partCount: 1n });
  return { nonce, publishId, bounceId: bounceIdOf(publishId), bounceTag: bounceTagOf(publishId) };
}

async function freshVault(deposit = toNano('2'), balance?: bigint) {
  const env = await setupVault(balance === undefined ? {} : { balance });
  await registerHybrid(env.vault, env.user);
  await depositTon(env.vault, env.user, deposit);
  return env;
}

describe('VPB2 client batch-publish confirmation reader vs real Vault receipt ring', () => {
  it('WBC-CONFIRMED: a Hub ACK flips the receipt to confirmed; firstEntryId matches the ACK first_entry_id', async () => {
    const { blockchain, vault, user, capsuleHub } = await freshVault();
    const { nonce, publishId } = await sendOkBatch(blockchain, vault, user);

    await vault.send(capsuleHub.getSender(), { value: toNano('0.1') }, {
      $$type: 'CapsuleHubBatchAck', publish_id: publishId, first_entry_id: 100n, part_count: 1n, batch_uid: 0n,
    } as CapsuleHubBatchAck);

    const slot = await readSlot(vault, user.address, nonce);
    // Sanity: the on-chain slot is the batch action in CONFIRMED state.
    expect(slot!.action).toBe(BigInt(ACT_PUBLISH_BATCH));
    expect(slot!.result).toBe(BigInt(RES_CONFIRMED));

    const interp = interpretBatchPublishReceipt(slot, nonce);
    expect(interp.status).toBe(BATCH_PUBLISH_RECEIPT_STATUS.CONFIRMED);
    expect(interp.firstEntryId).toBe(100n);
    expect(interp.partCount).toBe(1);
    expect(interp.rejectCode).toBeUndefined();
  });

  it('WBC-PROCESSING: a 1-part batch with no ACK yet reads as processing', async () => {
    const { blockchain, vault, user } = await freshVault();
    const { nonce } = await sendOkBatch(blockchain, vault, user);

    const slot = await readSlot(vault, user.address, nonce);
    expect(slot!.result).toBe(BigInt(RES_PROCESSING));

    const interp = interpretBatchPublishReceipt(slot, nonce);
    expect(interp.status).toBe(BATCH_PUBLISH_RECEIPT_STATUS.PROCESSING);
    expect(interp.firstEntryId).toBeUndefined();
    expect(interp.partCount).toBe(1);
  });

  it('WBC-REJECTED: a malformed-part batch reads as rejected (RJ_PART_SHAPE, failPartIndex 0)', async () => {
    const { blockchain, vault, user } = await freshVault();
    const nonce = (await vault.getGetUser(user.address)).publish_nonce;

    // A part cell with the wrong bit width — fails the first shape gate, atomic reject WITH refund.
    const badPart = beginCell().storeUint(0, 100).endCell();
    await blockchain.sendMessage(external({ to: vault.address, body: batchExternalBody({
      vaultAddr: vault.address, owner: user.address, maxCharge: toNano('0.5'), partCount: 1n, partsRoot: badPart, nonce,
    }) }));

    const slot = await readSlot(vault, user.address, nonce);
    expect(slot!.result).toBe(BigInt(RJ_PART_SHAPE));
    expect(slot!.aux).toBe(0n);

    const interp = interpretBatchPublishReceipt(slot, nonce);
    expect(interp.status).toBe(BATCH_PUBLISH_RECEIPT_STATUS.REJECTED);
    expect(interp.rejectCode).toBe(RJ_PART_SHAPE);
    expect(interp.failPartIndex).toBe(0n);
    expect(interp.firstEntryId).toBeUndefined();
  });

  it('WBC-REJECTED-BATCHLEVEL: a batch-level aux (AUX_BATCH_LEVEL) maps failPartIndex to null', async () => {
    // The on-chain RJ_PART_SHAPE case carries a real part index (0). Batch-level rejects store
    // AUX_BATCH_LEVEL instead; assert the pure interpreter nulls failPartIndex for that sentinel
    // (the contract uses it for binding/underpriced/id/collision rejects).
    const slot = {
      nonce: 5n, action: BigInt(ACT_PUBLISH_BATCH), result: 0x16n /* RJ_UNDERPRICED */,
      aux: AUX_BATCH_LEVEL, partCount: 3n, at: 0n,
    };
    const interp = interpretBatchPublishReceipt(slot, 5n);
    expect(interp.status).toBe(BATCH_PUBLISH_RECEIPT_STATUS.REJECTED);
    expect(interp.rejectCode).toBe(0x16);
    expect(interp.failPartIndex).toBeNull();
    expect(interp.partCount).toBe(3);
  });

  it('WBC-BOUNCED: a Hub bounce reads as bounced', async () => {
    const { blockchain, vault, user, capsuleHub } = await freshVault();
    const { nonce, bounceId, bounceTag } = await sendOkBatch(blockchain, vault, user);

    await blockchain.sendMessage(internal({
      from: capsuleHub.address, to: vault.address, value: toNano('0.3'), bounced: true, bounce: false,
      body: beginCell().storeUint(0xffffffff, 32).storeUint(OP_PUBLISH_BATCH_TO_HUB, 32)
        .storeUint(bounceId, 64).storeUint(bounceTag, 160).endCell(),
    }));

    const slot = await readSlot(vault, user.address, nonce);
    expect(slot!.result).toBe(BigInt(RES_BOUNCED_REFUNDED));

    const interp = interpretBatchPublishReceipt(slot, nonce);
    expect(interp.status).toBe(BATCH_PUBLISH_RECEIPT_STATUS.BOUNCED);
    expect(interp.firstEntryId).toBeUndefined();
  });

  it('WBC-TOMBSTONED: a stale prune reads as tombstoned', async () => {
    const { blockchain, vault, user } = await freshVault();
    const { nonce, publishId, bounceId } = await sendOkBatch(blockchain, vault, user);

    const pruneBody = beginCell().storeUint(OP_PRUNE_BATCH_PUBLISH, 32).storeUint(publishId, 256).endCell();
    blockchain.now = 1_700_000_000 + Number(VAULT_PENDING_PUBLISH_STALE_TTL) + 10; // now stale
    await blockchain.sendMessage(internal({
      from: user.address, to: vault.address, value: toNano('0.01'), bounce: true, body: pruneBody,
    }));
    expect((await vault.getGetPendingBatchPublish(bounceId)).tombstone).toBe(true);

    const slot = await readSlot(vault, user.address, nonce);
    expect(slot!.result).toBe(BigInt(RES_TOMBSTONED));

    const interp = interpretBatchPublishReceipt(slot, nonce);
    expect(interp.status).toBe(BATCH_PUBLISH_RECEIPT_STATUS.TOMBSTONED);
  });

  it('WBC-EVICTED-MISSING: reading a slot for a nonce that was never used reads as evicted', async () => {
    const { vault, user } = await freshVault();
    // No batch sent for this owner -> the ring is empty; the slot is missing.
    const slot = await readSlot(vault, user.address, 0n);
    expect(slot).toBeNull();
    expect(interpretBatchPublishReceipt(slot, 0n).status).toBe(BATCH_PUBLISH_RECEIPT_STATUS.EVICTED);
  });

  it('WBC-EVICTED-OVERWRITTEN: a slot overwritten by a later nonce reads as evicted for the old nonce', async () => {
    // 21 sequential 1-TON-charge batches drain the ledger; fund the vault + deposit generously.
    const { blockchain, vault, user } = await freshVault(toNano('40'), toNano('60'));
    // Send two batches into the SAME ring slot K nonces apart so the second evicts the first.
    const first = await sendOkBatch(blockchain, vault, user);
    // Drive nonces forward by RECEIPT_RING_K so nonce+K collides with `first` in the ring.
    let lastNonce = first.nonce;
    for (let i = 0; i < RECEIPT_RING_K; i += 1) {
      lastNonce = (await vault.getGetUser(user.address)).publish_nonce;
      await sendOkBatch(blockchain, vault, user);
    }
    expect(lastNonce % BigInt(RECEIPT_RING_K)).toBe(first.nonce % BigInt(RECEIPT_RING_K));

    // The slot now reports the NEWER nonce; reading it for the original (evicted) nonce is 'evicted'.
    const slot = await readSlot(vault, user.address, lastNonce);
    expect(slot!.nonce).toBe(lastNonce);
    expect(interpretBatchPublishReceipt(slot, first.nonce).status).toBe(BATCH_PUBLISH_RECEIPT_STATUS.EVICTED);
    // ...but reading it for the nonce it actually reports is a normal (processing) status.
    expect(interpretBatchPublishReceipt(slot, lastNonce).status).toBe(BATCH_PUBLISH_RECEIPT_STATUS.PROCESSING);
  });

  it('WBC-READER: readBatchPublishReceipt drives a provider stub through getUserReceipts end to end', async () => {
    const { blockchain, vault, user, capsuleHub } = await freshVault();
    const { nonce, publishId } = await sendOkBatch(blockchain, vault, user);
    await vault.send(capsuleHub.getSender(), { value: toNano('0.1') }, {
      $$type: 'CapsuleHubBatchAck', publish_id: publishId, first_entry_id: 42n, part_count: 1n, batch_uid: 0n,
    } as CapsuleHubBatchAck);

    // A minimal provider that returns the same { exists, publishNonce, receipts: Map } shape the
    // RPC provider's decodeVaultUserReceiptsViewStack produces — proving the reader's slot selection
    // (nonce % K) + interpretation wiring without standing up a toncenter transport.
    const view = await vault.getGetUserReceipts(user.address);
    const receipts = new Map<number, any>();
    for (const [key, slot] of view.receipts) receipts.set(Number(key), toReaderSlot(slot));
    const provider = {
      async getUserReceipts() {
        return { exists: view.exists, publishNonce: view.publish_nonce, receipts };
      },
    };

    const interp = await readBatchPublishReceipt(provider, vault.address.toString(), user.address.toString(), nonce);
    expect(interp.status).toBe(BATCH_PUBLISH_RECEIPT_STATUS.CONFIRMED);
    expect(interp.firstEntryId).toBe(42n);
  });

  it('WBC-DECODER: decodeVaultUserReceiptsViewStack parses a real getter BOC into the reader shape', async () => {
    // Cross-check the stack decoder against the @ton/core getter: serialize the on-chain dictionary
    // to a BOC exactly as a toncenter runGetMethod stack would carry it (a `cell` item), feed it
    // through the provider's decoder, and assert the decoded slot equals the @ton/core slot. This
    // exercises the hashmap-direct parser + ReceiptSlot cell decode the production read path uses.
    const { blockchain, vault, user, capsuleHub } = await freshVault();
    const { nonce, publishId } = await sendOkBatch(blockchain, vault, user);
    await vault.send(capsuleHub.getSender(), { value: toNano('0.1') }, {
      $$type: 'CapsuleHubBatchAck', publish_id: publishId, first_entry_id: 77n, part_count: 1n, batch_uid: 0n,
    } as CapsuleHubBatchAck);

    const view = await vault.getGetUserReceipts(user.address);
    const expected = toReaderSlot(view.receipts.get(Number(nonce % BigInt(RECEIPT_RING_K))))!;

    // Re-serialize the receipts dictionary to the directly-stored BOC a getter tuple returns
    // (storeDirect, no leading present bit), and synthesize the runGetMethod stack the RPC decoder
    // consumes: [exists(num), publish_nonce(num), receipts(cell)].
    const dictBoc = beginCell()
      .storeDictDirect(view.receipts, Dictionary.Keys.Uint(8), dictValueParserReceiptSlot())
      .endCell()
      .toBoc({ idx: false, crc32: false })
      .toString('base64');

    const decoded = decodeVaultUserReceiptsViewStack({
      stack: [
        { type: 'num', value: '0x1' },
        { type: 'num', value: `0x${(view.publish_nonce as bigint).toString(16)}` },
        { type: 'cell', value: dictBoc },
      ],
    });
    expect(decoded.exists).toBe(true);
    expect(decoded.publishNonce).toBe(view.publish_nonce);
    const decodedSlot = decoded.receipts.get(Number(nonce % BigInt(RECEIPT_RING_K)))!;
    expect(decodedSlot.nonce).toBe(expected.nonce);
    expect(decodedSlot.action).toBe(expected.action);
    expect(decodedSlot.result).toBe(expected.result);
    expect(decodedSlot.aux).toBe(expected.aux);
    expect(decodedSlot.partCount).toBe(expected.partCount);
    expect(decodedSlot.at).toBe(expected.at);

    // ...and interpreting the DECODED slot agrees with interpreting the @ton/core slot.
    expect(interpretBatchPublishReceipt(decodedSlot, nonce).status).toBe(BATCH_PUBLISH_RECEIPT_STATUS.CONFIRMED);
    expect(interpretBatchPublishReceipt(decodedSlot, nonce).firstEntryId).toBe(77n);
  });
});
