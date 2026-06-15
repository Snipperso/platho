#!/usr/bin/env ts-node
/*
 * ROUND 2 ProbeCollection deploy input — the DECISIVE SVG-rasterizability test.
 *
 * Round 1 proved tonapi's onchain renderer DOES rasterize a SIMPLE on-chain SVG (200 in all configs).
 * Our live username NFT (complex ~5KB SVG) 404s. Round 2 isolates whether the approved canonical design
 * fails on tonapi and whether the "flatten nested <svg> logo + objectBoundingBox teal gradient" fix clears it.
 *
 * Two items, image_data-only (image_data is the field tonapi's renderer reads; the GetGems `image` side is
 * already proven to render). Kept to 2 full SVGs so the single deploy external stays ~12KB (large externals
 * >~20KB are silently dropped by the gateway/validator).
 *
 *   index 0 (orig-platho)  : image_data = raw approved canonical SVG (artifacts/tmp_username_render/platho.svg)
 *                            -> CONTROL. Expect renderer 404 (reproduces the live blank for the approved design).
 *   index 1 (fixed-platho) : image_data = raw FIXED SVG (artifacts/tmp_username_render/fixed_platho.svg)
 *                            -> Expect renderer 200 if the fix clears the rasterizer failure.
 *
 * Authoritative serialization via the Tact wrapper (ProbeCollection.fromInit). Writes the SAME JSON file the
 * broadcaster reads, so scripts/mainnet_collection_probe_deploy.mjs picks it up unchanged.
 *
 * Run: npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" scripts/probe_collection_deploy_input_round2.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Address, beginCell, Cell, contractAddress, Dictionary, toNano } from '@ton/core';
import { ProbeCollection } from '../build/_probe/ProbeCollection/ProbeCollection_ProbeCollection';
import { ProbeItem } from '../build/_probe/ProbeCollection/ProbeCollection_ProbeItem';

const KEY_NAME        = 0x82a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce89n;
const KEY_DESCRIPTION = 0xc9046f7a37ad0ea7cee73355984fa5428982f8b37c8f7bcec91f7ac71a7cd104n;
const KEY_IMAGE_DATA  = 0xd9a88ccec79eef59c84b671136a20ece4cd00caaad5bc47e2c208829154ee9e4n;

const ORIG_SVG  = 'artifacts/tmp_username_render/platho.svg';
const FIXED_SVG = 'artifacts/tmp_username_render/fixed_platho.svg';
const OWNER_RAW = '0:d293c724d854493a656de212fb1e061759968e785abf5110279772f907d36c02';
const NEXT_INDEX = 2n;
const ITEM_VALUE = toNano('0.05');
const MINT_OPCODE = 0x50524f42;
const OUT_DIR = 'artifacts/local';
const OUT_PATH = join(OUT_DIR, 'probe_collection_deploy_input.json');

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

function onchainContent(entries: [bigint, Cell][]): Cell {
  const dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
  for (const [k, v] of entries) dict.set(k, v);
  return beginCell().storeUint(0, 8).storeDict(dict).endCell();
}

async function main() {
  const origBytes  = readFileSync(ORIG_SVG);
  const fixedBytes = readFileSync(FIXED_SVG);

  const cfgOrig = onchainContent([
    [KEY_NAME, snakeStringCell(Buffer.from('orig-platho', 'utf8'))],
    [KEY_DESCRIPTION, snakeStringCell(Buffer.from('approved canonical SVG (control)', 'utf8'))],
    [KEY_IMAGE_DATA, snakeStringCell(origBytes)],
  ]);
  const cfgFixed = onchainContent([
    [KEY_NAME, snakeStringCell(Buffer.from('fixed-platho', 'utf8'))],
    [KEY_DESCRIPTION, snakeStringCell(Buffer.from('flattened-logo + objectBoundingBox gradient', 'utf8'))],
    [KEY_IMAGE_DATA, snakeStringCell(fixedBytes)],
  ]);

  const contents = Dictionary.empty(Dictionary.Keys.BigUint(64), Dictionary.Values.Cell());
  contents.set(0n, cfgOrig);
  contents.set(1n, cfgFixed);

  const collectionContent = onchainContent([
    [KEY_NAME, snakeStringCell(Buffer.from('Platho render probe r2', 'utf8'))],
    [KEY_DESCRIPTION, snakeStringCell(Buffer.from('orig vs fixed SVG rasterizability', 'utf8'))],
  ]);

  const owner = Address.parseRaw(OWNER_RAW);
  const collection = await ProbeCollection.fromInit(owner, NEXT_INDEX, collectionContent, contents);
  if (!collection.init) throw new Error('wrapper did not return init (code+data)');

  const mintBody = beginCell().storeUint(MINT_OPCODE, 32).storeCoins(ITEM_VALUE).endCell();

  const labels = ['orig-platho (control, expect 404)', 'fixed-platho (expect 200)'];
  const items: { index: number; label: string; raw: string; uq: string; eq: string }[] = [];
  for (let i = 0; i < Number(NEXT_INDEX); i++) {
    const itemInit = await ProbeItem.init(collection.address, BigInt(i), owner);
    const addr = contractAddress(0, itemInit);
    items.push({
      index: i,
      label: labels[i],
      raw: addr.toRawString(),
      uq: addr.toString({ urlSafe: true, bounceable: false }),
      eq: addr.toString({ urlSafe: true, bounceable: true }),
    });
  }

  const out = {
    collectionCodeBocB64: collection.init.code.toBoc().toString('base64'),
    collectionDataBocB64: collection.init.data.toBoc().toString('base64'),
    collectionAddressRaw: collection.address.toRawString(),
    mintBodyBocB64: mintBody.toBoc().toString('base64'),
    ownerRaw: OWNER_RAW,
    nextIndex: Number(NEXT_INDEX),
    itemValueTon: '0.05',
    items,
    round: 2,
    origSvgBytes: origBytes.length,
    fixedSvgBytes: fixedBytes.length,
    generatedAt: new Date().toISOString(),
  };

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');

  console.log('Wrote', OUT_PATH, '(ROUND 2)');
  console.log('  collection UQ :', collection.address.toString({ urlSafe: true, bounceable: false }));
  console.log('  data BOC b64  :', out.collectionDataBocB64.length, 'chars');
  console.log('  orig SVG bytes:', origBytes.length, '| fixed SVG bytes:', fixedBytes.length);
  for (const it of items) console.log(`  item[${it.index}] ${it.label}: ${it.raw} | UQ ${it.uq}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
