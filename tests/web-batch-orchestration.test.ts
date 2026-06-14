import { describe, expect, it } from 'vitest';
import { Cell, external, toNano } from '@ton/core';
import {
  AUTH_KEY_PAIR,
  MANIFEST_HASH,
  KIND_PRIVATE,
  KIND_PUBLIC,
  ACT_PUBLISH_BATCH,
  RES_CONFIRMED,
  deployBoundSealedPair,
  registerHybrid,
  depositTon,
  computeEntryPublishId as vpb2ComputeEntryPublishId,
} from './helpers/vpb2';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
  finalPublicBodyCell,
  finalPublicHeaderCell,
} from './helpers/capsule-cells';
import {
  VAULT_PUBLISH_KIND,
  batchChargeFloor,
  computeEntryPublishId as clientComputeEntryPublishId,
  tonCell,
} from '../web/pwa-contract-transactions.mjs';
import {
  MAX_BATCH_PARTS,
  batchMaxChargeForItems,
  buildBatchExternalFromPublishItems,
  groupPublishItemsIntoBatches,
  publishItemKindLabel,
} from '../web/publish-batch-orchestration.mjs';

// Session 6 step 4 (core). PROVES the extracted app.js publish-orchestration helpers:
//  - groupPublishItemsIntoBatches is a pure greedy packer (<=MAX_BATCH_PARTS, contiguous same-kind, order kept);
//  - buildBatchExternalFromPublishItems turns a list of per-capsule charge-plan items into ONE signed batch
//    external that the REAL bound+sealed Vault+CapsuleHub accept, and each item's EPI1 publishId equals the
//    stored Hub entry publish_id (cross-checked against the vpb2.ts contract-mirror EPI1 derivation).

const AUTH_SECRET_KEY = AUTH_KEY_PAIR.secretKey.subarray(0, 32);

function cellPayload(cell: Cell) {
  return { hash: `0x${cell.hash().toString('hex')}`, boc: cell.toBoc({ idx: false, crc32: false }).toString('base64') };
}

// A per-capsule charge-plan item exactly as prepareCapsulesThroughVault produces it (publish payload + maxCharge).
function privateItem(fillBase: number, partIndex: number, maxCharge = toNano('0.3')) {
  const header0 = finalPrivateHeader0Cell(0x30 + fillBase);
  const header1 = finalPrivateHeader1Cell(0x31 + fillBase);
  const body = finalPrivateBodyCell(1n, 0x40 + fillBase);
  return {
    capsuleId: `priv-${partIndex}`,
    messageType: 'PublishPrivateFromVaultBalance',
    maxCharge,
    partIndex,
    publish: {
      publish_kind: VAULT_PUBLISH_KIND.PRIVATE,
      size_class: 1n,
      crypto_suite: 2n,
      header_0_hash: `0x${header0.hash().toString('hex')}`,
      header_1_hash: `0x${header1.hash().toString('hex')}`,
      body_hash: `0x${body.hash().toString('hex')}`,
      header_0_cell: cellPayload(header0),
      header_1_cell: cellPayload(header1),
      body_cell: cellPayload(body),
    },
  };
}

function publicItem(fillBase: number, partIndex: number, maxCharge = toNano('0.3')) {
  const header = finalPublicHeaderCell(0x50, 8);
  const body = finalPublicBodyCell(0x40 + fillBase, 1024);
  return {
    capsuleId: `pub-${partIndex}`,
    messageType: 'PublishPublicFromVaultBalance',
    maxCharge,
    partIndex,
    publish: {
      publish_kind: VAULT_PUBLISH_KIND.PUBLIC,
      size_class: 1n,
      crypto_suite: 0n,
      header_0_hash: `0x${header.hash().toString('hex')}`,
      body_hash: `0x${body.hash().toString('hex')}`,
      header_0_cell: cellPayload(header),
      body_cell: cellPayload(body),
    },
  };
}

describe('VPB2 publish-batch orchestration: grouping + batch-external build', () => {
  it('WBO-GROUP-01: a same-kind run under the cap is a single batch with order preserved', () => {
    const items = [privateItem(0, 0), privateItem(1, 1), privateItem(2, 2)];
    const batches = groupPublishItemsIntoBatches(items);
    expect(batches).toHaveLength(1);
    expect(batches[0].kindLabel).toBe('private');
    expect(batches[0].kind).toBe(VAULT_PUBLISH_KIND.PRIVATE);
    expect(batches[0].items).toHaveLength(3);
    expect(batches[0].partIndexes).toEqual([0, 1, 2]);
  });

  it('WBO-GROUP-02: a kind change forces a contiguous batch boundary (no kind mixing in a root)', () => {
    const items = [privateItem(0, 0), privateItem(1, 1), publicItem(2, 2), privateItem(3, 3)];
    const batches = groupPublishItemsIntoBatches(items);
    expect(batches.map((b) => b.kindLabel)).toEqual(['private', 'public', 'private']);
    expect(batches.map((b) => b.partIndexes)).toEqual([[0, 1], [2], [3]]);
  });

  it('WBO-GROUP-03: a run longer than MAX_BATCH_PARTS splits into greedy max-size batches', () => {
    const count = MAX_BATCH_PARTS + 3;
    const items = Array.from({ length: count }, (_v, i) => privateItem(i % 90, i));
    const batches = groupPublishItemsIntoBatches(items);
    expect(batches).toHaveLength(2);
    expect(batches[0].items).toHaveLength(MAX_BATCH_PARTS);
    expect(batches[1].items).toHaveLength(3);
    // every original part index appears exactly once, in order
    expect(batches.flatMap((b) => b.partIndexes)).toEqual(items.map((_v, i) => i));
  });

  it('WBO-GROUP-04: kind label + batch hold model (SHARED_BASE + per-part marginal, floor clamp)', () => {
    expect(publishItemKindLabel(publicItem(0, 0))).toBe('public');
    expect(publishItemKindLabel(privateItem(0, 0))).toBe('private');
    // VPB2: max_charge is the AMORTIZED batch hold (SHARED_BASE charged once + Σ per-part marginal), derived
    // from each item's kind+size — NOT the sum of the per-item maxCharge fields (the stale model). Item
    // maxCharge is ignored by the orchestrator now, so the result is identical regardless of those values.
    const SHARED_BASE = 127_800_000n;
    const PRIV_1K = 28_700_000n; // private size-1 per-part marginal (message-pricing-policy.mjs)
    const twoPriv1k = [privateItem(0, 0, 1n), privateItem(1, 1, toNano('1'))];
    const expectedHold = SHARED_BASE + 2n * PRIV_1K; // 185.2M
    expect(batchMaxChargeForItems(twoPriv1k)).toBe(expectedHold);
    // The amortized hold comfortably exceeds the affine pre-accept floor for this small shape.
    expect(batchMaxChargeForItems(twoPriv1k)).toBeGreaterThan(batchChargeFloor(2));
    // A 1-part batch pays SHARED_BASE once: its per-capsule hold is far higher than an 8-part batch's.
    const one = batchMaxChargeForItems([privateItem(0, 0)]);
    const eight = batchMaxChargeForItems(Array.from({ length: 8 }, (_v, i) => privateItem(i % 90, i)));
    expect(eight / 8n).toBeLessThan(one); // amortization: per-capsule hold drops with batch size
  });

  async function runOrchestratedBatch(kindItems: any[], kind: bigint) {
    const env = await deployBoundSealedPair();
    const { blockchain, vault, hub, user, vaultAddress } = env;
    const vaultRaw = vaultAddress.toRawString();
    const ownerRaw = user.address.toRawString();

    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('3'));

    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const batches = groupPublishItemsIntoBatches(kindItems);
    expect(batches).toHaveLength(1);

    const built = await buildBatchExternalFromPublishItems(batches[0], {
      owner: ownerRaw,
      clientNonce: nonce,
      vaultAddress: vaultRaw,
      manifestHash: `0x${MANIFEST_HASH.toString(16).padStart(64, '0')}`,
      authSecretKey: AUTH_SECRET_KEY,
    });

    // Send the orchestrator-built body cell as an external through the REAL Vault+Hub.
    const bodyCell = Cell.fromBoc(Buffer.from(tonCell.serializeBoc(built.bodyCell)))[0];
    await blockchain.sendMessage(external({ to: vaultAddress, body: bodyCell }));

    // The Vault accepted and settled CONFIRMED.
    const slot = (await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % 20n));
    expect(slot!.action).toBe(ACT_PUBLISH_BATCH);
    expect(slot!.result).toBe(RES_CONFIRMED);
    expect((await vault.getGetUser(user.address)).publish_nonce).toBe(nonce + 1n);

    // Each item's EPI1 publishId equals the stored Hub entry publish_id (and the vpb2 mirror agrees).
    for (let i = 0; i < kindItems.length; i += 1) {
      const entry = kind === KIND_PRIVATE
        ? await hub.getGetPrivateEntry(BigInt(i))
        : await hub.getGetPublicEntry(BigInt(i));
      expect(entry.exists).toBe(true);
      expect(entry.publish_id).toBe(built.entryPublishIds[i]);
      expect(built.entryPublishIds[i]).toBe(await clientComputeEntryPublishId(built.batchPublishId, i));
      expect(built.entryPublishIds[i]).toBe(vpb2ComputeEntryPublishId(built.batchPublishId, i));
    }
    return built;
  }

  it('WBO-BUILD-PRIVATE: a 3-item PRIVATE batch external is accepted + stores client EPI1 ids', async () => {
    const items = [privateItem(0, 0), privateItem(1, 1), privateItem(2, 2)];
    const built = await runOrchestratedBatch(items, KIND_PRIVATE);
    expect(built.partCount).toBe(3n);
    expect(built.kindLabel).toBe('private');
  });

  it('WBO-BUILD-PUBLIC: a 2-item PUBLIC batch external is accepted + stores client EPI1 ids', async () => {
    const items = [publicItem(0, 0), publicItem(1, 1)];
    const built = await runOrchestratedBatch(items, KIND_PUBLIC);
    expect(built.partCount).toBe(2n);
    expect(built.kindLabel).toBe('public');
  });
});
