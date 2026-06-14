import { describe, expect, it } from 'vitest';
import { Cell, beginCell, external, toNano } from '@ton/core';
import { storePublishBatchToHub } from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import {
  AUTH_KEY_PAIR,
  MANIFEST_HASH,
  KIND_PRIVATE,
  KIND_PUBLIC,
  DEFAULT_BATCH_PUBLISH_ID,
  partsList,
  publishBatchToHub,
  marketingCell,
  computeEntryPublishId as vpb2ComputeEntryPublishId,
  fixtureAddress,
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
import {
  VAULT_PUBLISH_KIND,
  buildBatchPublishPartsRoot,
  buildBatchPublishExternalBoc,
  computeEntryPublishId as clientComputeEntryPublishId,
  tonCell,
} from '../web/pwa-contract-transactions.mjs';
import {
  parseCapsuleHubBatchMessageBody,
  batchPartCacheRecord,
  createCapsuleHubTonRpcProvider,
} from '../web/capsulehub-ton-rpc-provider.mjs';

// Session 6 step 3 (read-sync-recovery). PROVES the PWA client's CapsuleHub RPC provider recovers capsule BODIES
// from a VPB2 batch (0xA4F862D1 PublishBatchToHub) message: ONE Vault->Hub message carries N part bodies, and the
// Hub stores only header + body_hash per entry under the per-part EPI1 publish_id. The parser walks the `parts`
// linked list, derives each part's EPI1 id, verifies body_cell.hash() === the declared body_hash, and reconnects
// the on-chain entry (whose publish_id IS the EPI1 id) to its off-chain body.

const cellHashInt = async (cell: any) =>
  BigInt(`0x${tonCell.bytesToHex((await tonCell.computeCellHashAndDepth(cell)).hash)}`);
const coreCellHashInt = (cell: Cell) => BigInt(`0x${cell.hash().toString('hex')}`);
const cellBoc = (cell: any) => tonCell.bytesToBase64(tonCell.serializeBoc(cell));

// Serialize a PublishBatchToHub message object (vpb2.ts publishBatchToHub) to the base64 BOC the client parser eats.
function batchMessageBoc(msg: any): string {
  return beginCell().store(storePublishBatchToHub(msg)).endCell().toBoc({ idx: false, crc32: false }).toString('base64');
}

// Walk a built `parts` linked list and pull each part's DECLARED body_hash field + its body-ref cell, so the test
// can cross-check the parser's recovered body against the exact bytes the contract hashes. Mirrors the part frame:
// private = size(8) suite(8) h0(256) h1(256) bh(256) | ref h0,h1,body[,next]; public = size(8) reserved(8) h(256)
// bh(256) | ref header,body[,next].
function walkParts(kind: bigint, head: Cell, count: number): Array<{ bodyHash: bigint; bodyCell: Cell }> {
  const out: Array<{ bodyHash: bigint; bodyCell: Cell }> = [];
  let cursor: Cell = head;
  for (let i = 0; i < count; i += 1) {
    const isLast = i === count - 1;
    const s = cursor.beginParse();
    if (kind === KIND_PRIVATE) {
      s.loadUint(8); s.loadUint(8); s.loadUintBig(256); s.loadUintBig(256);
      const bodyHash = s.loadUintBig(256);
      s.loadRef(); s.loadRef();
      const bodyCell = s.loadRef();
      out.push({ bodyHash, bodyCell });
      cursor = isLast ? head : s.loadRef();
    } else {
      s.loadUint(8); s.loadUint(8); s.loadUintBig(256);
      const bodyHash = s.loadUintBig(256);
      s.loadRef();
      const bodyCell = s.loadRef();
      out.push({ bodyHash, bodyCell });
      cursor = isLast ? head : s.loadRef();
    }
  }
  return out;
}

describe('VPB2 client batch BODY recovery from PublishBatchToHub message history', () => {
  it('WBR-PARSE-PRIVATE: a 3-part PRIVATE batch parses into 3 per-part records under the client EPI1 ids', async () => {
    const author = fixtureAddress('WBR_AUTHOR_PRIV');
    const parts = partsList(KIND_PRIVATE, 3);
    const msg = publishBatchToHub({ parts, authorWallet: author, kind: KIND_PRIVATE, partCount: 3n });
    const boc = batchMessageBoc(msg);

    const raw = parseCapsuleHubBatchMessageBody(boc);
    expect(raw).toHaveLength(3);

    const declared = walkParts(KIND_PRIVATE, parts, 3);
    for (let i = 0; i < 3; i += 1) {
      const record = await batchPartCacheRecord(raw[i]);
      expect(record).not.toBeNull();
      // per-part EPI1 id matches both the client and the vpb2 (contract-mirror) derivation.
      const epi1 = await clientComputeEntryPublishId(DEFAULT_BATCH_PUBLISH_ID, i);
      expect(record!.publish_id).toBe(epi1);
      expect(record!.publish_id).toBe(vpb2ComputeEntryPublishId(DEFAULT_BATCH_PUBLISH_ID, i));
      // declared body_hash field == recovered body cell hash == the original part's body cell hash.
      expect(record!.body_hash).toBe(declared[i].bodyHash);
      expect(record!.body_hash).toBe(coreCellHashInt(declared[i].bodyCell));
      expect(await cellHashInt(record!.body_cell)).toBe(record!.body_hash);
      // body BOC round-trips to the same cell hash.
      const roundTrip = tonCell.parseBocBase64(record!.body_boc);
      expect(await cellHashInt(roundTrip)).toBe(record!.body_hash);
      expect(record!.kind).toBe('private');
      expect(record!.part_index).toBe(i);
    }
  });

  it('WBR-PARSE-PUBLIC: a 2-part PUBLIC batch parses into 2 per-part records under the client EPI1 ids', async () => {
    const author = fixtureAddress('WBR_AUTHOR_PUB');
    const parts = partsList(KIND_PUBLIC, 2);
    const msg = publishBatchToHub({
      parts, authorWallet: author, kind: KIND_PUBLIC, partCount: 2n, marketing: marketingCell(),
    });
    const boc = batchMessageBoc(msg);

    const raw = parseCapsuleHubBatchMessageBody(boc);
    expect(raw).toHaveLength(2);

    const declared = walkParts(KIND_PUBLIC, parts, 2);
    for (let i = 0; i < 2; i += 1) {
      const record = await batchPartCacheRecord(raw[i]);
      expect(record).not.toBeNull();
      const epi1 = await clientComputeEntryPublishId(DEFAULT_BATCH_PUBLISH_ID, i);
      expect(record!.publish_id).toBe(epi1);
      expect(record!.publish_id).toBe(vpb2ComputeEntryPublishId(DEFAULT_BATCH_PUBLISH_ID, i));
      expect(record!.body_hash).toBe(declared[i].bodyHash);
      expect(record!.body_hash).toBe(coreCellHashInt(declared[i].bodyCell));
      expect(await cellHashInt(record!.body_cell)).toBe(record!.body_hash);
      const roundTrip = tonCell.parseBocBase64(record!.body_boc);
      expect(await cellHashInt(roundTrip)).toBe(record!.body_hash);
      expect(record!.kind).toBe('public');
      // The parser returns the raw (workchain:hex) address form, not the user-friendly base64 form.
      expect(record!.author_wallet).toBe(author.toRawString());
    }
  });

  it('WBR-NEGATIVE: a part whose body cell hash != its declared body_hash is NOT served (rejected)', async () => {
    const author = fixtureAddress('WBR_AUTHOR_NEG');
    // Single private part with a real body cell but a corrupted declared body_hash field. The structural parse
    // still succeeds (frame shape is intact), but batchPartCacheRecord must refuse it: the recovered body cell
    // hash will not equal the declared (wrong) body_hash, so no body is cached/served.
    const header0 = finalPrivateHeader0Cell(0x30);
    const header1 = finalPrivateHeader1Cell(0x31);
    const body = finalPrivateBodyCell(1n, 0x40);
    const wrongBodyHash = coreCellHashInt(body) ^ 1n;
    // Build the part with @ton/core directly so the refs are real Cells: a structurally valid private frame whose
    // DECLARED body_hash field is corrupted (real cell hash XOR 1) while the body ref is the real body cell.
    const corruptPart = beginCell()
      .storeUint(1n, 8).storeUint(2n, 8)
      .storeUint(coreCellHashInt(header0), 256)
      .storeUint(coreCellHashInt(header1), 256)
      .storeUint(wrongBodyHash, 256)
      .storeRef(header0).storeRef(header1).storeRef(body)
      .endCell();
    const msg = publishBatchToHub({ parts: corruptPart, authorWallet: author, kind: KIND_PRIVATE, partCount: 1n });
    const boc = batchMessageBoc(msg);

    const raw = parseCapsuleHubBatchMessageBody(boc);
    expect(raw).toHaveLength(1);
    expect(raw[0].body_hash).toBe(wrongBodyHash);
    // The recovered body cell's real hash != the declared (corrupted) hash -> rejected (null), never served.
    const record = await batchPartCacheRecord(raw[0]);
    expect(record).toBeNull();
  });

  it('WBR-ROUNDTRIP-PRIVATE: real bound+sealed pair -> stored Hub entries reconnect to recovered bodies', async () => {
    await runRoundTrip(KIND_PRIVATE, 3);
  });

  it('WBR-ROUNDTRIP-PUBLIC: real bound+sealed pair -> stored Hub entries reconnect to recovered bodies', async () => {
    await runRoundTrip(KIND_PUBLIC, 2);
  });
});

// The AUTH secret the client signs with is the 32-byte ed25519 seed (libsodium keyPairFromSeed layout).
const AUTH_SECRET_KEY = AUTH_KEY_PAIR.secretKey.subarray(0, 32);

function cellPayload(cell: Cell) {
  return { hash: `0x${cell.hash().toString('hex')}`, boc: cell.toBoc({ idx: false, crc32: false }).toString('base64') };
}

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

// Drive a real signed batch through the bound+sealed Vault+Hub, capture the EXACT Vault->Hub PublishBatchToHub
// message body the Hub ingested, feed it through the provider via a stub transport that serves that one message
// from history, then resolve each stored Hub entry's body and assert hash(body) === entry.body_hash.
async function runRoundTrip(kind: bigint, count: number) {
  const env = await deployBoundSealedPair();
  const { blockchain, vault, hub, user, vaultAddress, hubAddress } = env;
  const vaultRaw = vaultAddress.toRawString();
  const ownerRaw = user.address.toRawString();

  await registerHybrid(vault, user);
  await depositTon(vault, user, toNano('3'));

  const nonce = (await vault.getGetUser(user.address)).publish_nonce;
  const parts = Array.from({ length: count }, (_v, i) =>
    kind === KIND_PRIVATE ? privatePartInput(i) : publicPartInput(i));
  const partsRoot = buildBatchPublishPartsRoot(parts);
  const buildParams = {
    owner_wallet: ownerRaw,
    vaultAddress: vaultRaw,
    deploymentManifestHash: `0x${MANIFEST_HASH.toString(16).padStart(64, '0')}`,
    kind,
    client_nonce: nonce,
    max_charge: toNano('1'),
    part_count: BigInt(count),
    partsRoot,
    authSecretKey: AUTH_SECRET_KEY,
  };
  const built = await buildBatchPublishExternalBoc(buildParams, { vaultAddress: vaultRaw });
  const bodyCell = Cell.fromBoc(Buffer.from(tonCell.serializeBoc(built.bodyCell)))[0];
  const res = await blockchain.sendMessage(external({ to: vaultAddress, body: bodyCell }));

  // Capture the Vault->Hub PublishBatchToHub message body the Hub actually received (the on-chain recovery source).
  const toHub = res.transactions.find(
    (t: any) => t.inMessage?.info?.dest?.toString() === hubAddress.toString()
      && t.inMessage?.info?.type === 'internal',
  );
  expect(toHub).toBeDefined();
  const hubMessageBoc = toHub!.inMessage!.body.toBoc({ idx: false, crc32: false }).toString('base64');

  // A stub transport whose runGetMethod is unused (entries come straight from the sandbox getters) and whose
  // getMessages serves the captured batch message for the batch-op (broad) query the provider issues.
  const transport = {
    async runGetMethod() { throw new Error('unexpected runGetMethod'); },
    async getMessages(params: any) {
      if (params.opcode === '0xA4F862D1') {
        return { messages: [{ source: vaultRaw, message_content: { body: hubMessageBoc } }] };
      }
      return { messages: [] };
    },
  };
  const provider = createCapsuleHubTonRpcProvider({ capsuleHubAddress: hubAddress.toString(), transport });

  for (let i = 0; i < count; i += 1) {
    const entryId = BigInt(i);
    if (kind === KIND_PRIVATE) {
      const view = await hub.getGetPrivateEntry(entryId);
      expect(view.exists).toBe(true);
      expect(view.publish_id).toBe(built.entryPublishIds[i]);
      const entry = {
        exists: true,
        entry_id: entryId,
        publish_id: view.publish_id,
        author_wallet: vaultRaw,
        created_at: view.created_at,
        header_0_hash: view.header_0_hash,
        header_1_hash: view.header_1_hash,
        body_hash: view.body_hash,
        header_0_boc: view.header_0.toBoc({ idx: false, crc32: false }).toString('base64'),
        header_1_boc: view.header_1.toBoc({ idx: false, crc32: false }).toString('base64'),
        body_boc: null,
      };
      const resolved = await provider.resolvePrivateEntryBody(entry, { vaultAddress: vaultRaw });
      expect(resolved.body_boc).not.toBeNull();
      const bodyCellResolved = tonCell.parseBocBase64(resolved.body_boc);
      expect(await cellHashInt(bodyCellResolved)).toBe(view.body_hash);
    } else {
      const view = await hub.getGetPublicEntry(entryId);
      expect(view.exists).toBe(true);
      expect(view.publish_id).toBe(built.entryPublishIds[i]);
      const entry = {
        exists: true,
        entry_id: entryId,
        publish_id: view.publish_id,
        author_wallet: view.author_wallet.toString(),
        created_at: view.created_at,
        header_hash: view.header_hash,
        body_hash: view.body_hash,
        header_boc: view.header.toBoc({ idx: false, crc32: false }).toString('base64'),
        body_boc: null,
      };
      const resolved = await provider.resolvePublicEntryBody(entry, { vaultAddress: vaultRaw });
      expect(resolved.body_boc).not.toBeNull();
      const bodyCellResolved = tonCell.parseBocBase64(resolved.body_boc);
      expect(await cellHashInt(bodyCellResolved)).toBe(view.body_hash);
    }
  }
}
