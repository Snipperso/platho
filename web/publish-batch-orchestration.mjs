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
  buildBatchPublishExternalVariants,
  buildBatchPublishPartsRoot,
} from './pwa-contract-transactions.mjs?v=33';
import { batchHoldNanotons } from './message-pricing-policy.mjs?v=14';

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

// TON validators DROP an inbound external BoC larger than max_ext_msg_size (config-43 = 65535 bytes) BEFORE
// the Vault's external() receiver runs (contracts/Vault.tact EXT_HARD_BITS = 65535*8; the node never even
// bounces it). So a multi-part batch external MUST stay under that ceiling. A private HYBRID body is padded
// to size_class*1024 + ~1204 bytes and carries TWO header cells, so TWO large (size_class 16/32) private
// image capsules packed into one external overflow 65535 and the broadcast is silently lost (parts pinned at
// SENT, submittedCount=0 forever, recipient never receives it). Public/avatar bodies are smaller (variable-
// length, ONE header) — which is exactly why the SAME image published fine as an avatar but not as a private
// message. We therefore bound each batch by an ESTIMATED serialized size and force a new batch before the
// ceiling: large capsules ride ONE part per external (the proven-good single-part path), small capsules
// (text) still amortize up to MAX_BATCH_PARTS. The estimate is anchored on size_class (always present on a
// charge-plan item, the contract's own body-sizing unit), so the HOLD-quote grouping and the SEND grouping
// are byte-for-byte identical and no phantom "Price changed" recheck can fire. buildBatchPublishExternalBoc
// hard-asserts the REAL serialized length as a fail-closed backstop if this estimate is ever too loose.
const MAX_BATCH_EXTERNAL_BYTES = 62000;            // < 65535 hard ceiling; margin for signed root + 64-byte
                                                   // signature + external envelope + BoC cell framing.
const PRIVATE_PART_NONBODY_OVERHEAD_BYTES = 4000;  // ~1204 body padding + two header cells + cell framing.
const PUBLIC_PART_NONBODY_OVERHEAD_BYTES = 1200;   // single header + cell framing.

// PURE. Conservative serialized-byte estimate of one publish item's contribution to its batch external.
// Over-estimates (so the packer over-splits rather than under-splits — the latter would trip the hard guard);
// uses size_class (the on-chain body unit, length <= size_class*1024) so it is identical at quote and send.
export function estimatePublishItemExternalBytes(item) {
  const sizeClass = Number(publishItemSizeClass(item)) || 1;
  const bodyBytes = sizeClass * 1024;
  const overhead = publishItemKindLabel(item) === 'public'
    ? PUBLIC_PART_NONBODY_OVERHEAD_BYTES
    : PRIVATE_PART_NONBODY_OVERHEAD_BYTES;
  return bodyBytes + overhead;
}

// PURE. Greedily pack the flat per-capsule items into contiguous batches of 1..MAX_BATCH_PARTS items where all
// items in a batch share the same kind AND the batch's estimated serialized external stays under
// MAX_BATCH_EXTERNAL_BYTES. Order is preserved: a batch boundary is forced by a kind change, by hitting
// MAX_BATCH_PARTS, or by the byte budget. Returns an array of { items, kind, kindLabel, partIndexes } where
// partIndexes carries the ORIGINAL flat position of each item (the part's index within publishState.parts),
// and the part's index WITHIN the batch is its position in `items` (0-based) — that is the EPI1 part_index.
export function groupPublishItemsIntoBatches(items) {
  const flat = (items ?? []).filter(Boolean);
  const batches = [];
  let current = null;
  for (let flatIndex = 0; flatIndex < flat.length; flatIndex += 1) {
    const item = flat[flatIndex];
    const kindLabel = publishItemKindLabel(item);
    const originalIndex = item.partIndex ?? flatIndex;
    const itemBytes = estimatePublishItemExternalBytes(item);
    const sameKind = current && current.kindLabel === kindLabel;
    const hasRoom = current && current.items.length < MAX_BATCH_PARTS;
    // A lone part always starts its own batch (never split a single capsule); the byte budget only blocks
    // ADDING a further part to an existing batch.
    const fitsBytes = current && (current.bytes + itemBytes) <= MAX_BATCH_EXTERNAL_BYTES;
    if (sameKind && hasRoom && fitsBytes) {
      current.items.push(item);
      current.partIndexes.push(originalIndex);
      current.bytes += itemBytes;
      continue;
    }
    current = {
      items: [item],
      kind: publishItemKindBigInt(kindLabel),
      kindLabel,
      partIndexes: [originalIndex],
      bytes: itemBytes,
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
      // Comment parent (undefined for posts). This mapping DROPPING the field was the root of "comments never
      // land in the contract's public_parent_index": buildBatchPublishPartCell derives parent_link from it
      // (publishPublicParentLink -> parentEntryId+1, 0 when absent), so without it EVERY comment published as a
      // top-level post (author-indexed) and get_public_parent_index stayed empty for every post since genesis.
      parent_entry_id: publish.parent_entry_id ?? publish.parentEntryId,
      // clean-11: SAME drop-bug class — carry is_profile so buildBatchPublishPartCell sets the reserved bit0.
      // Absent/false for normal posts; true only for a gated channel-profile publish.
      is_profile: (publish.is_profile ?? publish.isProfile) === true,
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
  // Pre-signed max_charge VARIANTS (see buildBatchPublishExternalVariants): the keyless retry loop rotates
  // them so every re-broadcast is a REAL broadcast past the network's ~60s same-bytes dedup windows.
  const built = await buildBatchPublishExternalVariants({
    owner_wallet: ctx.owner,
    vaultAddress: ctx.vaultAddress,
    deploymentManifestHash: ctx.manifestHash,
    kind,
    client_nonce: ctx.clientNonce,
    max_charge: maxCharge,
    part_count: partCount,
    partsRoot,
    authSecretKey: ctx.authSecretKey,
  }, { vaultAddress: ctx.vaultAddress }, { variantCount: 16 });
  return {
    ...built,
    kind,
    kindLabel,
    partCount,
    maxCharge,
    partsRoot,
  };
}
