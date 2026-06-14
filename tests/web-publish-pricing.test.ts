import { describe, expect, it } from 'vitest';
import { Cell, external, toNano } from '@ton/core';
import {
  AUTH_KEY_PAIR,
  MANIFEST_HASH,
  KIND_PRIVATE,
  KIND_PUBLIC,
  ACT_PUBLISH_BATCH,
  RES_PROCESSING,
  RES_CONFIRMED,
  RJ_UNDERPRICED,
  deployBoundSealedPair,
  registerHybrid,
  depositTon,
} from './helpers/vpb2';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
  finalPublicBodyCell,
  finalPublicHeaderCell,
} from './helpers/capsule-cells';
import { VAULT_PUBLISH_KIND, tonCell } from '../web/pwa-contract-transactions.mjs';
import {
  batchMaxChargeForItems,
  buildBatchExternalFromPublishItems,
  groupPublishItemsIntoBatches,
} from '../web/publish-batch-orchestration.mjs';

// Session 6 client pricing rework — CORRECTNESS GATE.
//
// The contract's floor was lowered BELOW canonical_total, so the stale client max_charge model would have
// stranded honest publishes at RJ_UNDERPRICED (0x16). This suite proves the RE-DERIVED client hold model
// (web/message-pricing-policy.mjs SHARED_BASE + per-part marginal, wired through batchMaxChargeForItems):
//   * compute max_charge via the REAL client path (batchMaxChargeForItems on real per-item charge plans),
//   * build the batch external (buildBatchExternalFromPublishItems), send through the REAL bound+sealed pair,
//   * assert the receipt is RES_PROCESSING/CONFIRMED — NEVER RJ_UNDERPRICED, never pre-accept 16485/16463,
//   * assert each computed hold >= the sandbox-measured canonical_total for that shape (no-underprice invariant),
//   * assert an 8-part batch's per-capsule hold is meaningfully LESS than a 1-part hold (amortization works).

const AUTH_SECRET_KEY = AUTH_KEY_PAIR.secretKey.subarray(0, 32);
const RING = 20n;
const SIZE_CLASSES = [1, 2, 4, 8, 16, 32] as const;
const PART_COUNTS = [1, 8] as const;

// canonical_total measured in the sandbox by binary-searching the RJ_UNDERPRICED -> success boundary
// (see the throwaway harness used to derive the model). Keyed kind|size|parts. The 32K x 8 shape exceeds the
// config-43 external-message ceiling (256KB > 65535 bytes) and is unsendable, so it is omitted from the matrix.
const MEASURED_CANONICAL_TOTAL: Record<string, bigint> = {
  'private|1|1': 151_886_475n, 'private|1|8': 346_856_548n,
  'private|2|1': 152_485_942n, 'private|2|8': 351_652_282n,
  'private|4|1': 153_684_875n, 'private|4|8': 361_243_749n,
  'private|8|1': 156_082_742n, 'private|8|8': 380_426_684n,
  'private|16|1': 160_885_142n, 'private|16|8': 418_845_887n,
  'private|32|1': 170_483_276n,
  'public|1|1': 156_209_342n, 'public|1|8': 381_245_348n,
  'public|2|1': 156_808_808n, 'public|2|8': 386_041_082n,
  'public|4|1': 158_007_742n, 'public|4|8': 395_632_549n,
  'public|8|1': 160_405_609n, 'public|8|8': 414_815_484n,
  'public|16|1': 165_208_009n, 'public|16|8': 453_234_686n,
  'public|32|1': 174_806_143n,
};

function cellPayload(cell: Cell) {
  return { hash: `0x${cell.hash().toString('hex')}`, boc: cell.toBoc({ idx: false, crc32: false }).toString('base64') };
}

// A per-capsule charge-plan item exactly as prepareCapsulesThroughVault produces it (publish payload + maxCharge).
// maxCharge is intentionally a junk value here: the re-derived batchMaxChargeForItems derives the real hold from
// kind+size and IGNORES this field, so the proof depends only on the client pricing model, not the stamp.
function privateItem(fillBase: number, partIndex: number, sizeClass: number) {
  const header0 = finalPrivateHeader0Cell(0x30 + (fillBase % 90));
  const header1 = finalPrivateHeader1Cell(0x31 + (fillBase % 90));
  const body = finalPrivateBodyCell(sizeClass, 0x40 + (fillBase % 90));
  return {
    capsuleId: `priv-${partIndex}`,
    messageType: 'PublishPrivateFromVaultBalance',
    maxCharge: 1n,
    partIndex,
    publish: {
      publish_kind: VAULT_PUBLISH_KIND.PRIVATE,
      size_class: BigInt(sizeClass),
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

function publicItem(fillBase: number, partIndex: number, sizeClass: number) {
  const header = finalPublicHeaderCell(0x50, 8);
  const body = finalPublicBodyCell(0x40 + (fillBase % 90), sizeClass * 1024);
  return {
    capsuleId: `pub-${partIndex}`,
    messageType: 'PublishPublicFromVaultBalance',
    maxCharge: 1n,
    partIndex,
    publish: {
      publish_kind: VAULT_PUBLISH_KIND.PUBLIC,
      size_class: BigInt(sizeClass),
      crypto_suite: 0n,
      header_0_hash: `0x${header.hash().toString('hex')}`,
      body_hash: `0x${body.hash().toString('hex')}`,
      header_0_cell: cellPayload(header),
      body_cell: cellPayload(body),
    },
  };
}

function buildItems(kind: bigint, sizeClass: number, partCount: number) {
  const make = kind === KIND_PRIVATE ? privateItem : publicItem;
  return Array.from({ length: partCount }, (_v, i) => make(i, i, sizeClass));
}

// Sends one client-priced batch through the real Vault+Hub and returns { result, holdSigned, nonce }.
async function sendClientPricedBatch(kind: bigint, sizeClass: number, partCount: number) {
  const env = await deployBoundSealedPair();
  const { blockchain, vault, vaultAddress, user } = env;
  await registerHybrid(vault, user);
  await depositTon(vault, user, toNano('20'));

  const items = buildItems(kind, sizeClass, partCount);
  const batches = groupPublishItemsIntoBatches(items);
  expect(batches).toHaveLength(1);

  // The REAL client max_charge for this batch.
  const holdSigned = batchMaxChargeForItems(items);

  const nonce = (await vault.getGetUser(user.address)).publish_nonce;
  const built = await buildBatchExternalFromPublishItems(batches[0], {
    owner: user.address.toRawString(),
    clientNonce: nonce,
    vaultAddress: vaultAddress.toRawString(),
    manifestHash: `0x${MANIFEST_HASH.toString(16).padStart(64, '0')}`,
    authSecretKey: AUTH_SECRET_KEY,
  });
  // The orchestrator signs exactly the client-priced hold.
  expect(built.maxCharge).toBe(holdSigned);

  const bodyCell = Cell.fromBoc(Buffer.from(tonCell.serializeBoc(built.bodyCell)))[0];
  // Sending must NOT throw a pre-accept failure (16485 floor / 16463 / 16485). A throw == external not accepted.
  await blockchain.sendMessage(external({ to: vaultAddress, body: bodyCell }));

  const slot = (await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % RING));
  return { vault, user, slot, holdSigned, nonce };
}

describe('VPB2 client publish pricing: the re-derived hold never underprices the contract', () => {
  for (const kind of [KIND_PRIVATE, KIND_PUBLIC] as const) {
    const kindLabel = kind === KIND_PRIVATE ? 'private' : 'public';
    for (const sizeClass of SIZE_CLASSES) {
      for (const partCount of PART_COUNTS) {
        const key = `${kindLabel}|${sizeClass}|${partCount}`;
        const canonical = MEASURED_CANONICAL_TOTAL[key];
        if (canonical === undefined) continue; // unsendable shape (e.g. 32K x 8)

        it(`WPP-${kindLabel.toUpperCase()}-${sizeClass}K-x${partCount}: client hold settles (never RJ_UNDERPRICED)`, async () => {
          const { slot, holdSigned } = await sendClientPricedBatch(kind, sizeClass, partCount);

          // The signed client hold is >= the contract's canonical_total for this shape (no-underprice invariant).
          expect(holdSigned).toBeGreaterThanOrEqual(canonical);

          // A receipt slot exists (so the batch was ACCEPTED — no pre-accept 16485/16463 floor rejection).
          expect(slot, 'a receipt slot must exist (batch was accepted, not pre-accept rejected)').toBeDefined();
          expect(slot!.action).toBe(ACT_PUBLISH_BATCH);
          expect(slot!.part_count).toBe(BigInt(partCount));
          // The result is a healthy lifecycle code — NEVER the post-accept underprice reject.
          expect(slot!.result).not.toBe(RJ_UNDERPRICED);
          expect([RES_PROCESSING, RES_CONFIRMED]).toContain(slot!.result);
        }, 30000);
      }
    }
  }

  it('WPP-AMORTIZE: an 8-part batch per-capsule hold is meaningfully below a 1-part hold', () => {
    for (const kind of [KIND_PRIVATE, KIND_PUBLIC] as const) {
      for (const sizeClass of SIZE_CLASSES) {
        const one = batchMaxChargeForItems(buildItems(kind, sizeClass, 1));
        const eight = batchMaxChargeForItems(buildItems(kind, sizeClass, 8));
        const perCapsule8 = eight / 8n;
        // Per-capsule hold drops by at least 25% when batching 8 vs 1 (SHARED_BASE amortizes).
        expect(perCapsule8).toBeLessThan((one * 75n) / 100n);
      }
    }
  });
});
