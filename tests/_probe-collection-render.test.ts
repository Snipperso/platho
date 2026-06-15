import { describe, expect, it } from 'vitest';
import { beginCell, Cell, contractAddress, Dictionary, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { ProbeCollection } from '../build/_probe/ProbeCollection/ProbeCollection_ProbeCollection';
import { ProbeItem } from '../build/_probe/ProbeCollection/ProbeCollection_ProbeItem';

// ============================================================================
// Correctness gate for the tonapi onchain-render probe collection.
//
// Proves, in @ton/sandbox, that:
//   * The collection self-initializes and mints all 4 content-less items in ONE
//     deploy external (body = ProbeMintAll), with no failed compute phase.
//   * get_collection_data().next_item_index == 4.
//   * For each i in 0..3: get_nft_address_by_index(i) == the address the mint
//     actually deployed (item active), and the item's get_nft_data returns
//     collection_address == collection AND index == i.
//   * get_nft_content(i, anyCell) returns the EXACT config-i content: the right
//     sha256 metadata keys present/absent (image_data vs image), correct names.
//
// The 4 content cells + collection_content + the contents dict are built OFFLINE
// here with the same helpers/sha256 keys the deploy script uses, then baked into
// the collection via the Tact-generated wrapper (authoritative serialization).
// ============================================================================

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// --- sha256(attribute_name) metadata keys (== scripts/mainnet_nft_probe_deploy.mjs) ---
const KEY_NAME        = 0x82a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce89n; // sha256("name")
const KEY_DESCRIPTION = 0xc9046f7a37ad0ea7cee73355984fa5428982f8b37c8f7bcec91f7ac71a7cd104n; // sha256("description")
const KEY_IMAGE       = 0x6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3dn; // sha256("image")
const KEY_IMAGE_DATA  = 0xd9a88ccec79eef59c84b671136a20ece4cd00caaad5bc47e2c208829154ee9e4n; // sha256("image_data")

// Self-check the hard-coded keys against a live sha256 so a future copy/paste typo can't slip through.
function sha256Key(field: string): bigint {
  return BigInt('0x' + createHash('sha256').update(field).digest('hex'));
}

const SVG_PATH = 'artifacts/tmp_username_render/platho.svg';
const TRIVIAL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#30d5b0"/></svg>';

// --- snake-string cell: 0x00 marker, 127 bytes/cell, chained via ref (== deploy script) ---
function snakeStringCell(bytes: Buffer | Uint8Array): Cell {
  const all = Uint8Array.from([0x00, ...bytes]);
  const CHUNK = 127;
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < all.length; i += CHUNK) chunks.push(all.slice(i, i + CHUNK));
  if (chunks.length === 0) chunks.push(Uint8Array.from([]));
  let next: Cell | null = null;
  for (let i = chunks.length - 1; i >= 0; i--) {
    const b = beginCell().storeBuffer(Buffer.from(chunks[i]));
    if (next) b.storeRef(next);
    next = b.endCell();
  }
  return next!;
}

const percentEncodeSvg = (svgText: string): string => encodeURIComponent(svgText);

function readSnakeText(cell: Cell): string {
  let current: Cell | null = cell;
  let first = true;
  const chunks: Buffer[] = [];
  while (current) {
    const slice = current.beginParse();
    if (first) { expect(slice.loadUint(8)).toBe(0); first = false; }
    chunks.push(slice.loadBuffer(Math.floor(slice.remainingBits / 8)));
    current = slice.remainingRefs > 0 ? slice.loadRef() : null;
  }
  return Buffer.concat(chunks).toString('utf8');
}

// TEP-64 on-chain content cell: 0x00 marker byte + storeDict(metadataDict).
function onchainContent(entries: Map<bigint, Cell>): Cell {
  const dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
  for (const [k, v] of entries) dict.set(k, v);
  return beginCell().storeUint(0, 8).storeDict(dict).endCell();
}

// Build the 4 config content cells (keys 0..3) exactly as the deploy will bake them.
function buildContents(svgBytes: Buffer): { contents: Dictionary<bigint, Cell>; rawFullSvg: Buffer } {
  const svgText = svgBytes.toString('utf8');
  const trivialBytes = Buffer.from(TRIVIAL_SVG, 'utf8');

  // Config A (index 0): image_data = full SVG, NO image.
  const cfgA = onchainContent(new Map<bigint, Cell>([
    [KEY_NAME, snakeStringCell(Buffer.from('probe-A', 'utf8'))],
    [KEY_DESCRIPTION, snakeStringCell(Buffer.from('image_data full SVG', 'utf8'))],
    [KEY_IMAGE_DATA, snakeStringCell(svgBytes)],
  ]));

  // Config B (index 1): image_data = trivial SVG, NO image.
  const cfgB = onchainContent(new Map<bigint, Cell>([
    [KEY_NAME, snakeStringCell(Buffer.from('probe-B', 'utf8'))],
    [KEY_DESCRIPTION, snakeStringCell(Buffer.from('image_data trivial SVG', 'utf8'))],
    [KEY_IMAGE_DATA, snakeStringCell(trivialBytes)],
  ]));

  // Config C (index 2): image = base64 data-uri, NO image_data.
  const base64Uri = 'data:image/svg+xml;base64,' + svgBytes.toString('base64');
  const cfgC = onchainContent(new Map<bigint, Cell>([
    [KEY_NAME, snakeStringCell(Buffer.from('probe-C', 'utf8'))],
    [KEY_DESCRIPTION, snakeStringCell(Buffer.from('image base64 data-uri', 'utf8'))],
    [KEY_IMAGE, snakeStringCell(Buffer.from(base64Uri, 'utf8'))],
  ]));

  // Config D (index 3): image = percent-encoded data-uri, NO image_data.
  const percentUri = 'data:image/svg+xml,' + percentEncodeSvg(svgText);
  const cfgD = onchainContent(new Map<bigint, Cell>([
    [KEY_NAME, snakeStringCell(Buffer.from('probe-D', 'utf8'))],
    [KEY_DESCRIPTION, snakeStringCell(Buffer.from('image percent data-uri', 'utf8'))],
    [KEY_IMAGE, snakeStringCell(Buffer.from(percentUri, 'utf8'))],
  ]));

  const contents = Dictionary.empty(Dictionary.Keys.BigUint(64), Dictionary.Values.Cell());
  contents.set(0n, cfgA);
  contents.set(1n, cfgB);
  contents.set(2n, cfgC);
  contents.set(3n, cfgD);
  return { contents, rawFullSvg: svgBytes };
}

function collectionContentCell(): Cell {
  return onchainContent(new Map<bigint, Cell>([
    [KEY_NAME, snakeStringCell(Buffer.from('Platho render probe', 'utf8'))],
    [KEY_DESCRIPTION, snakeStringCell(Buffer.from('tonapi onchain SVG render probe', 'utf8'))],
  ]));
}

// Parse a TEP-64 on-chain content cell -> set of present sha256 keys + name text.
function parseContent(cell: Cell): { keys: Set<bigint>; dict: Dictionary<bigint, Cell> } {
  const slice = cell.beginParse();
  expect(slice.loadUint(8)).toBe(0); // on-chain marker
  const dict = slice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
  return { keys: new Set(dict.keys()), dict };
}

describe('ProbeCollection onchain-render probe', () => {
  it('PROBE-00: hard-coded sha256 metadata keys match a live digest', () => {
    expect(KEY_NAME).toBe(sha256Key('name'));
    expect(KEY_DESCRIPTION).toBe(sha256Key('description'));
    expect(KEY_IMAGE).toBe(sha256Key('image'));
    expect(KEY_IMAGE_DATA).toBe(sha256Key('image_data'));
  });

  it('PROBE-01: collection mints all 4 content-less items on deploy and serves the right per-config content', async () => {
    const svgBytes = readFileSync(SVG_PATH);
    const { contents } = buildContents(svgBytes);
    const collectionContent = collectionContentCell();

    const blockchain = await Blockchain.create();
    const deployer = await blockchain.treasury('probe-deployer'); // == owner

    const collection = blockchain.openContract(
      await ProbeCollection.fromInit(deployer.address, 4n, collectionContent, contents),
    );

    // Mint-on-deploy: the deploy external carries body = ProbeMintAll, value ~0.4 TON,
    // each item funded with 0.05 TON.
    const itemValue = toNano('0.05');
    const deployResult = await collection.send(
      deployer.getSender(),
      { value: toNano('0.4') },
      { $$type: 'ProbeMintAll', item_value: itemValue },
    );

    // (4) Mint tx succeeded: collection deploy+ProbeMintAll has a clean compute phase (exit 0), did not OOG.
    const mintTx = findTransaction(deployResult.transactions, {
      from: deployer.address,
      to: collection.address,
    });
    expect(mintTx).toBeDefined();
    const mintDesc = mintTx!.description;
    expect(mintDesc.type).toBe('generic');
    if (mintDesc.type === 'generic') {
      // clean compute phase (success, exit 0) and the action phase did not bounce/fail.
      expect(mintDesc.computePhase.type).toBe('vm');
      if (mintDesc.computePhase.type === 'vm') {
        expect(mintDesc.computePhase.success).toBe(true);
        expect(mintDesc.computePhase.exitCode).toBe(0);
      }
      expect(mintDesc.actionPhase?.success).toBe(true);
      // 4 outbound deploys actually left the collection.
      expect(mintDesc.actionPhase?.totalActions).toBe(4);
    }

    // (1) Collection is active.
    const collState = (await blockchain.getContract(collection.address)).accountState?.type;
    expect(collState).toBe('active');

    // (2) get_collection_data().next_item_index == 4; owner + collection_content round-trip.
    const cd = await collection.getGetCollectionData();
    expect(cd.next_item_index).toBe(4n);
    expect(cd.owner_address.equals(deployer.address)).toBe(true);
    expect(cd.collection_content.equals(collectionContent)).toBe(true);

    // Expected per-config key presence.
    const expectedConfig: Record<number, { name: string; present: bigint[]; absent: bigint[] }> = {
      0: { name: 'probe-A', present: [KEY_NAME, KEY_DESCRIPTION, KEY_IMAGE_DATA], absent: [KEY_IMAGE] },
      1: { name: 'probe-B', present: [KEY_NAME, KEY_DESCRIPTION, KEY_IMAGE_DATA], absent: [KEY_IMAGE] },
      2: { name: 'probe-C', present: [KEY_NAME, KEY_DESCRIPTION, KEY_IMAGE], absent: [KEY_IMAGE_DATA] },
      3: { name: 'probe-D', present: [KEY_NAME, KEY_DESCRIPTION, KEY_IMAGE], absent: [KEY_IMAGE_DATA] },
    };

    for (let i = 0; i < 4; i++) {
      const idx = BigInt(i);

      // (3a) get_nft_address_by_index(i) == the address the mint actually deployed.
      const reported = await collection.getGetNftAddressByIndex(idx);
      const itemInit = await ProbeItem.init(collection.address, idx, deployer.address);
      const derived = contractAddress(0, itemInit);
      expect(reported.equals(derived)).toBe(true);

      // The mint deployed an internal message to this exact address.
      const itemDeployTx = findTransaction(deployResult.transactions, {
        from: collection.address,
        to: derived,
      });
      expect(itemDeployTx).toBeDefined();

      // Item is active on-chain.
      const itemAcc = await blockchain.getContract(derived);
      expect(itemAcc.accountState?.type).toBe('active');

      // (3b) item get_nft_data: collection_address == collection AND index == i.
      const item = blockchain.openContract(ProbeItem.fromAddress(derived));
      const nd = await item.getGetNftData();
      expect(nd.init).toBe(true);
      expect(nd.index).toBe(idx);
      expect(nd.collection_address.equals(collection.address)).toBe(true);
      expect(nd.owner_address.equals(deployer.address)).toBe(true);

      // (3c) get_nft_content(i, anyCell) == exactly config-i content (right keys present/absent).
      const anyCell = beginCell().storeUint(0, 8).storeUint(0, 1).endCell();
      const served = await collection.getGetNftContent(idx, anyCell);
      const { keys, dict } = parseContent(served);
      const exp = expectedConfig[i];
      for (const k of exp.present) expect(keys.has(k)).toBe(true);
      for (const k of exp.absent) expect(keys.has(k)).toBe(false);
      expect(keys.size).toBe(exp.present.length); // exactly these keys, nothing extra
      expect(readSnakeText(dict.get(KEY_NAME)!)).toBe(exp.name);
    }

    // Config A's image_data must be the full SVG; Config C's image must be the base64 data-uri.
    const cA = parseContent(await collection.getGetNftContent(0n, beginCell().endCell()));
    expect(readSnakeText(cA.dict.get(KEY_IMAGE_DATA)!).startsWith('<svg')).toBe(true);
    const cC = parseContent(await collection.getGetNftContent(2n, beginCell().endCell()));
    expect(readSnakeText(cC.dict.get(KEY_IMAGE)!).startsWith('data:image/svg+xml;base64,')).toBe(true);
    const cD = parseContent(await collection.getGetNftContent(3n, beginCell().endCell()));
    expect(readSnakeText(cD.dict.get(KEY_IMAGE)!).startsWith('data:image/svg+xml,')).toBe(true);
  });
});
