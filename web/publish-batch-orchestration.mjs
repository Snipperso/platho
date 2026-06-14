// VPB2 client publish orchestration. PURE batching + a thin batch-external builder, extracted from
// web/app.js so the grouping/build logic is importable in node (no DOM globals) and unit-testable in
// isolation. app.js imports these to drive the SEND leg of its publish/confirm/sync pipeline.
//
// A VPB2 batch external carries ONE signed root with a SINGLE kind (private or public) and 1..MAX_BATCH_PARTS
// parts. The Vault consumes one strictly-sequential nonce per accepted batch and emits ONE PublishBatchToHub
// message; the Hub stores each part under its per-entry EPI1 publish_id. Mixing kinds in one root is illegal,
// so the grouping below never crosses a kind boundary.

import {
  MAX_BATCH_PARTS,
  VAULT_PUBLISH_KIND,
  batchChargeFloor,
  buildBatchPublishExternalBoc,
  buildBatchPublishPartsRoot,
} from './pwa-contract-transactions.mjs?v=27';
import { batchHoldNanotons } from './message-pricing-policy.mjs?v=12';

export { MAX_BATCH_PARTS };

// Normalize an item's publish kind to the 'private' | 'public' label the grouper keys on. An item is the
// per-capsule charge plan the prepare step produced ({ capsuleId, messageType, publish, maxCharge, partIndex }).
export function publishItemKindLabel(item) {
  const publish = item?.publish ?? {};
  const raw = publish.publish_kind ?? publish.publishKind ?? item?.publishKind ?? item?.kind;
  try {
    return BigInt(raw ?? 0n) === VAULT_PUBLISH_KIND.PUBLIC ? 'public' : 'private';
  } catch {
    return 'private';
  }
}

function publishItemKindBigInt(label) {
  return label === 'public' ? VAULT_PUBLISH_KIND.PUBLIC : VAULT_PUBLISH_KIND.PRIVATE;
}

// PURE. Greedily pack the flat per-capsule items into contiguous batches of 1..MAX_BATCH_PARTS items where all
// items in a batch share the same kind. Order is preserved: a batch boundary is forced by a kind change or by
// hitting MAX_BATCH_PARTS. Returns an array of { items, kind, kindLabel, partIndexes } where partIndexes carries
// the ORIGINAL flat position of each item (the part's index within publishState.parts), and the part's index
// WITHIN the batch is its position in `items` (0-based) — that is the EPI1 part_index.
export function groupPublishItemsIntoBatches(items) {
  const flat = (items ?? []).filter(Boolean);
  const batches = [];
  let current = null;
  for (let flatIndex = 0; flatIndex < flat.length; flatIndex += 1) {
    const item = flat[flatIndex];
    const kindLabel = publishItemKindLabel(item);
    const originalIndex = item.partIndex ?? flatIndex;
    const sameKind = current && current.kindLabel === kindLabel;
    const hasRoom = current && current.items.length < MAX_BATCH_PARTS;
    if (sameKind && hasRoom) {
      current.items.push(item);
      current.partIndexes.push(originalIndex);
      continue;
    }
    current = {
      items: [item],
      kind: publishItemKindBigInt(kindLabel),
      kindLabel,
      partIndexes: [originalIndex],
    };
    batches.push(current);
  }
  return batches;
}

// Turn one charge-plan item's `publish` payload into a VPB2 part-cell input. The contract's part frame is
// kind-specific; buildBatchPublishPartCell discriminates on `kind`, so we pass the explicit kind plus the
// header/body hashes + cells the publish object already carries (public uses header_0_* as its single header).
export function publishItemToBatchPart(item, kindLabel = publishItemKindLabel(item)) {
  const publish = item?.publish ?? {};
  if (kindLabel === 'public') {
    return {
      kind: VAULT_PUBLISH_KIND.PUBLIC,
      size_class: publish.size_class ?? publish.sizeClass,
      header_hash: publish.header_hash ?? publish.headerHash ?? publish.header_0_hash ?? publish.header0Hash,
      body_hash: publish.body_hash ?? publish.bodyHash,
      header_cell: publish.header_cell ?? publish.headerCell ?? publish.header_0_cell ?? publish.header0Cell,
      body_cell: publish.body_cell ?? publish.bodyCell,
    };
  }
  return {
    kind: VAULT_PUBLISH_KIND.PRIVATE,
    size_class: publish.size_class ?? publish.sizeClass,
    crypto_suite: publish.crypto_suite ?? publish.cryptoSuite,
    header_0_hash: publish.header_0_hash ?? publish.header0Hash,
    header_1_hash: publish.header_1_hash ?? publish.header1Hash,
    body_hash: publish.body_hash ?? publish.bodyHash,
    header_0_cell: publish.header_0_cell ?? publish.header0Cell,
    header_1_cell: publish.header_1_cell ?? publish.header1Cell,
    body_cell: publish.body_cell ?? publish.bodyCell,
  };
}

// Pull a part's size_class off its charge-plan item (publish payload first, then top-level fallbacks).
function publishItemSizeClass(item) {
  const publish = item?.publish ?? {};
  return publish.size_class ?? publish.sizeClass ?? item?.sizeClass ?? item?.size_class ?? 1;
}

// max_charge the signed batch root must clear. The contract post-accept-rejects RJ_UNDERPRICED (0x16) any
// batch whose max_charge < canonical_total, where canonical_total == SHARED_BASE + Σ perPartHold(kind,size).
// So the hold is the AMORTIZED batch model (SHARED_BASE charged ONCE, not per item) — NOT a sum of per-item
// single-capsule holds, and NOT the stale per-message table. It is then clamped UP to the pre-accept affine
// floor batchChargeFloor(partCount) (the Vault drops a batch whose max_charge < floor before acceptance).
// Since canonical_total >= floor for every honest shape, the clamp is a no-op in practice but keeps the two
// gates consistent. Over-reserving above canonical_total is refunded on the mode-128 ACK, so a conservative
// hold only costs a transient reserve, never a real debit — but it must NEVER be below canonical_total.
export function batchMaxChargeForItems(items) {
  const list = (items ?? []).filter(Boolean);
  const partCount = list.length;
  const hold = batchHoldNanotons(list.map((item) => ({
    kindLabel: publishItemKindLabel(item),
    sizeClass: publishItemSizeClass(item),
  })));
  const floor = batchChargeFloor(partCount);
  return hold > floor ? hold : floor;
}

// Build ONE signed batch external from a grouped batch. ctx carries the owner, the chosen client_nonce, the
// vault address, the deployment manifest hash, and the AUTH secret key (32-byte ed25519 seed). Returns the
// builder's full result ({ boc, batchPublishId, entryPublishIds, bodyCell, signedRoot, ... }) PLUS the
// echoed kind / partCount / maxCharge so the caller can stamp per-part state without re-deriving them.
export async function buildBatchExternalFromPublishItems(batch, ctx = {}) {
  if (!batch?.items?.length) throw new Error('Batch external requires at least one publish item');
  const kindLabel = batch.kindLabel ?? publishItemKindLabel(batch.items[0]);
  const kind = batch.kind ?? publishItemKindBigInt(kindLabel);
  const parts = batch.items.map((item) => publishItemToBatchPart(item, kindLabel));
  const partsRoot = buildBatchPublishPartsRoot(parts);
  const partCount = BigInt(parts.length);
  const maxCharge = batchMaxChargeForItems(batch.items);
  const built = await buildBatchPublishExternalBoc({
    owner_wallet: ctx.owner,
    vaultAddress: ctx.vaultAddress,
    deploymentManifestHash: ctx.manifestHash,
    kind,
    client_nonce: ctx.clientNonce,
    max_charge: maxCharge,
    part_count: partCount,
    partsRoot,
    authSecretKey: ctx.authSecretKey,
  }, { vaultAddress: ctx.vaultAddress });
  return {
    ...built,
    kind,
    kindLabel,
    partCount,
    maxCharge,
    partsRoot,
  };
}
