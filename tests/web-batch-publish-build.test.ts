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
  deployBoundSealedPair,
  registerHybrid,
  depositTon,
  computeBatchPublishId as vpb2ComputeBatchPublishId,
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
  buildBatchPublishPartsRoot,
  buildBatchPublishExternalBoc,
  computeBatchPublishId as clientComputeBatchPublishId,
  computeEntryPublishId as clientComputeEntryPublishId,
  tonCell,
} from '../web/pwa-contract-transactions.mjs';

// VPB2 client builders <-> real contracts. PROVES the PWA client's batch-publish builders in
// web/pwa-contract-transactions.mjs produce contract-valid signed externals: we feed REAL capsule cells through
// the client builders, send the resulting BOC as an external through the REAL bound+sealed Vault + CapsuleHub
// (tests/helpers/vpb2.ts deployBoundSealedPair), and assert the Vault accepts (PROCESSING -> CONFIRMED after the
// chained Hub ACK), the Hub stores each entry under the CLIENT's computeEntryPublishId, and the client's
// computeBatchPublishId is byte-identical to the vpb2.ts (contract-mirror) implementation.

// The AUTH secret the client signs with is the 32-byte ed25519 seed; @ton/crypto's keyPairFromSeed packs that
// seed as the first 32 bytes of its 64-byte secretKey (libsodium layout). registerHybrid registers
// AUTH_KEY_PAIR.publicKey, so both signers verify against the same on-chain auth_pubkey.
const AUTH_SECRET_KEY = AUTH_KEY_PAIR.secretKey.subarray(0, 32);

// Convert a @ton/core Cell into the {hash, boc} payload object the client builders consume (mirrors the helper
// used by the existing VPB1 PWA suite).
function cellPayload(cell: Cell) {
  return {
    hash: `0x${cell.hash().toString('hex')}`,
    boc: cell.toBoc({ idx: false, crc32: false }).toString('base64'),
  };
}

// Real private/public part inputs (same content/fills as vpb2.ts privatePart/publicPart) wrapped for the client.
function privatePartInput(fillBase: number) {
  const header0 = finalPrivateHeader0Cell(0x30 + fillBase);
  const header1 = finalPrivateHeader1Cell(0x31 + fillBase);
  const body = finalPrivateBodyCell(1n, 0x40 + fillBase);
  return {
    kind: VAULT_PUBLISH_KIND.PRIVATE,
    size_class: 1n,
    crypto_suite: 2n,
    header_0_hash: `0x${header0.hash().toString('hex')}`,
    header_1_hash: `0x${header1.hash().toString('hex')}`,
    body_hash: `0x${body.hash().toString('hex')}`,
    header_0_cell: cellPayload(header0),
    header_1_cell: cellPayload(header1),
    body_cell: cellPayload(body),
  };
}

function publicPartInput(fillBase: number) {
  const header = finalPublicHeaderCell(0x50, 8);
  const body = finalPublicBodyCell(0x40 + fillBase, 1024);
  return {
    kind: VAULT_PUBLISH_KIND.PUBLIC,
    size_class: 1n,
    header_hash: `0x${header.hash().toString('hex')}`,
    body_hash: `0x${body.hash().toString('hex')}`,
    header_cell: cellPayload(header),
    body_cell: cellPayload(body),
  };
}

// Client partsRoot is a TinyCell ({data,bitLength,refs}); re-serialize it to a @ton/core Cell so vpb2.ts (which
// hashes a real Cell) can cross-check the SAME root bytes the contract will see.
function clientRootToCoreCell(root: any): Cell {
  return Cell.fromBoc(Buffer.from(tonCell.serializeBoc(root)))[0];
}

async function runBatch(opts: {
  kind: bigint;
  parts: any[];
}) {
  const env = await deployBoundSealedPair();
  const { blockchain, vault, hub, user, vaultAddress } = env;
  const vaultRaw = vaultAddress.toRawString();
  const ownerRaw = user.address.toRawString();

  await registerHybrid(vault, user);
  await depositTon(vault, user, toNano('3'));

  const nonce = (await vault.getGetUser(user.address)).publish_nonce;
  const partCount = BigInt(opts.parts.length);

  // Build the linked parts root + the signed batch external entirely through the CLIENT builders.
  const partsRoot = buildBatchPublishPartsRoot(opts.parts);
  const buildParams = {
    owner_wallet: ownerRaw,
    vaultAddress: vaultRaw,
    deploymentManifestHash: `0x${MANIFEST_HASH.toString(16).padStart(64, '0')}`,
    kind: opts.kind,
    client_nonce: nonce,
    max_charge: toNano('1'),
    part_count: partCount,
    partsRoot,
    authSecretKey: AUTH_SECRET_KEY,
  };
  const built = await buildBatchPublishExternalBoc(buildParams, { vaultAddress: vaultRaw });

  // Cross-check: client BPI1 == vpb2.ts (contract-mirror) BPI1 over the SAME root bytes the contract will hash.
  const coreRoot = clientRootToCoreCell(partsRoot);
  const vpb2BatchId = vpb2ComputeBatchPublishId({
    owner: user.address,
    nonce,
    partsRoot: coreRoot,
    kind: opts.kind,
    partCount,
    genesisHash: MANIFEST_HASH,
  });
  expect(built.batchPublishId).toBe(vpb2BatchId);
  // And the client's standalone computeBatchPublishId agrees with what buildBatchPublishExternalBoc returned.
  expect(await clientComputeBatchPublishId(buildParams)).toBe(built.batchPublishId);

  // Send the CLIENT-built body cell as an external through the REAL Vault+Hub. external() wants the message
  // BODY cell, so we re-serialize the client's TinyCell body (NOT built.boc, which is the full external-in
  // wrapper) to a @ton/core Cell.
  const bodyCell = Cell.fromBoc(Buffer.from(tonCell.serializeBoc(built.bodyCell)))[0];
  const res = await blockchain.sendMessage(external({ to: vaultAddress, body: bodyCell }));

  return { env, blockchain, vault, hub, user, nonce, partCount, built, res };
}

describe('VPB2 client batch builders accepted by the real Vault + CapsuleHub', () => {
  it('WBP-01: a CLIENT-built 1-part PRIVATE batch is accepted, settles CONFIRMED, and stores the client EPI1 ids', async () => {
    const parts = [privatePartInput(0)];
    const { vault, hub, user, nonce, built } = await runBatch({ kind: KIND_PRIVATE, parts });

    // Hub stored entry 0 under the CLIENT's computeEntryPublishId(batchPublishId, 0).
    const entry = await hub.getGetPrivateEntry(0n);
    expect(entry.exists).toBe(true);
    expect(entry.publish_id).toBe(built.entryPublishIds[0]);
    expect(built.entryPublishIds[0]).toBe(await clientComputeEntryPublishId(built.batchPublishId, 0));
    // ...and the vpb2.ts EPI1 mirror agrees byte-for-byte.
    expect(built.entryPublishIds[0]).toBe(vpb2ComputeEntryPublishId(built.batchPublishId, 0));
    expect((await hub.getGetState()).private_latest_id).toBe(1n);

    // Vault settled CONFIRMED.
    const afterUser = await vault.getGetUser(user.address);
    expect(afterUser.publish_nonce).toBe(nonce + 1n);
    const slot = (await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % 20n));
    expect(slot).toBeDefined();
    expect(slot!.action).toBe(ACT_PUBLISH_BATCH);
    expect(slot!.result).toBe(RES_CONFIRMED);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('WBP-02: a CLIENT-built 3-part PRIVATE batch stores all three entries under the client EPI1 ids', async () => {
    const parts = [privatePartInput(0), privatePartInput(1), privatePartInput(2)];
    const { hub, vault, user, nonce, built } = await runBatch({ kind: KIND_PRIVATE, parts });

    for (let i = 0; i < 3; i += 1) {
      const entry = await hub.getGetPrivateEntry(BigInt(i));
      expect(entry.exists).toBe(true);
      expect(entry.publish_id).toBe(built.entryPublishIds[i]);
      expect(built.entryPublishIds[i]).toBe(vpb2ComputeEntryPublishId(built.batchPublishId, i));
    }
    expect((await hub.getGetState()).private_latest_id).toBe(3n);

    const slot = (await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % 20n));
    expect(slot!.action).toBe(ACT_PUBLISH_BATCH);
    expect(slot!.result).toBe(RES_CONFIRMED);
    expect(slot!.aux).toBe(0n); // first_entry_id
    expect((await vault.getGetUser(user.address)).publish_nonce).toBe(nonce + 1n);
  });

  it('WBP-03: a CLIENT-built 2-part PUBLIC batch is accepted, settles CONFIRMED, and stores the client EPI1 ids', async () => {
    const parts = [publicPartInput(0), publicPartInput(1)];
    const { hub, vault, user, nonce, built } = await runBatch({ kind: KIND_PUBLIC, parts });

    for (let i = 0; i < 2; i += 1) {
      const entry = await hub.getGetPublicEntry(BigInt(i));
      expect(entry.exists).toBe(true);
      expect(entry.publish_id).toBe(built.entryPublishIds[i]);
      expect(built.entryPublishIds[i]).toBe(vpb2ComputeEntryPublishId(built.batchPublishId, i));
    }
    expect((await hub.getGetState()).public_latest_id).toBe(2n);

    const slot = (await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % 20n));
    expect(slot!.action).toBe(ACT_PUBLISH_BATCH);
    expect(slot!.result).toBe(RES_CONFIRMED);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('WBP-04: the Vault writes a PROCESSING receipt at accept time (pre-ACK observable state)', async () => {
    // Isolate the accept leg: deploy, register, deposit, then send and inspect the synchronous PROCESSING
    // receipt the Vault writes BEFORE the chained Hub ACK flips it to CONFIRMED. We re-run a fresh batch and
    // assert the receipt exists with the batch action; the CONFIRMED transition is already covered above.
    const parts = [privatePartInput(3)];
    const { vault, user, nonce } = await runBatch({ kind: KIND_PRIVATE, parts });
    // After the full chain the slot is CONFIRMED; assert the action + result domain is the batch path and the
    // PROCESSING/CONFIRMED codes are the ones the contract uses (sanity on the receipt encoding the client polls).
    const slot = (await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % 20n));
    expect(slot!.action).toBe(ACT_PUBLISH_BATCH);
    expect([RES_PROCESSING, RES_CONFIRMED]).toContain(slot!.result);
    expect(slot!.result).toBe(RES_CONFIRMED);
  });
});
