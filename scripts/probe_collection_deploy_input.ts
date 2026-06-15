#!/usr/bin/env ts-node
/*
 * Build the AUTHORITATIVE ProbeCollection deploy input via the Tact-generated wrapper.
 *
 * This NEVER hand-guesses the init-data layout: it calls ProbeCollection.fromInit(...) so the
 * code+data BOCs and the derived collection address come straight from the compiler's serializer.
 * It writes everything the broadcaster (.mjs) needs to a gitignored JSON file:
 *
 *   artifacts/local/probe_collection_deploy_input.json = {
 *     collectionCodeBocB64, collectionDataBocB64, collectionAddressRaw, mintBodyBocB64,
 *     ownerRaw, nextIndex, itemValueTon, svgBytes
 *   }
 *
 * The 4 per-config content cells + collection_content are assembled OFFLINE here with the same
 * snake-string helper + sha256 metadata keys as scripts/mainnet_nft_probe_deploy.mjs, and baked
 * into the collection's `contents` map (keys 0..3) — exactly what the sandbox correctness gate
 * (tests/_probe-collection-render.test.ts) proved.
 *
 * Run:  npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" scripts/probe_collection_deploy_input.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Address, beginCell, Cell, contractAddress, Dictionary, toNano } from '@ton/core';
import { ProbeCollection } from '../build/_probe/ProbeCollection/ProbeCollection_ProbeCollection';
import { ProbeItem } from '../build/_probe/ProbeCollection/ProbeCollection_ProbeItem';

// --- sha256(attribute_name) metadata keys (== scripts/mainnet_nft_probe_deploy.mjs) ---
const KEY_NAME        = 0x82a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce89n; // sha256("name")
const KEY_DESCRIPTION = 0xc9046f7a37ad0ea7cee73355984fa5428982f8b37c8f7bcec91f7ac71a7cd104n; // sha256("description")
const KEY_IMAGE       = 0x6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3dn; // sha256("image")
const KEY_IMAGE_DATA  = 0xd9a88ccec79eef59c84b671136a20ece4cd00caaad5bc47e2c208829154ee9e4n; // sha256("image_data")

// Compact (~520 byte) representative SVG: gradient + rounded card + circle + Arial text.
// Using a small SVG keeps the single deploy external well under the size at which the
// gateway/validator silently drops large externals (the full ~5.3KB SVG baked into all 4
// configs produced a ~23KB external that was consistently dropped). The renderer FORMAT
// question (base64-data-URI vs percent-data-URI vs raw-image_data) is identical regardless
// of SVG size; the full-complex-SVG-in-image_data 404 is already confirmed live on platho.ath.
const SVG_PATH = 'artifacts/tmp_username_render/probe_small.svg';
const TRIVIAL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#30d5b0"/></svg>';
const OWNER_RAW = '0:d293c724d854493a656de212fb1e061759968e785abf5110279772f907d36c02';
const NEXT_INDEX = 4n;
const ITEM_VALUE = toNano('0.05');
const MINT_OPCODE = 0x50524f42; // "PROB"
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

const percentEncodeSvg = (svgText: string): string => encodeURIComponent(svgText);

function onchainContent(entries: [bigint, Cell][]): Cell {
  const dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
  for (const [k, v] of entries) dict.set(k, v);
  return beginCell().storeUint(0, 8).storeDict(dict).endCell();
}

async function main() {
  const svgBytes = readFileSync(SVG_PATH);
  const svgText = svgBytes.toString('utf8');
  const trivialBytes = Buffer.from(TRIVIAL_SVG, 'utf8');

  // Config A (0): image_data full SVG, no image.
  const cfgA = onchainContent([
    [KEY_NAME, snakeStringCell(Buffer.from('probe-A', 'utf8'))],
    [KEY_DESCRIPTION, snakeStringCell(Buffer.from('image_data full SVG', 'utf8'))],
    [KEY_IMAGE_DATA, snakeStringCell(svgBytes)],
  ]);
  // Config B (1): image_data trivial SVG, no image.
  const cfgB = onchainContent([
    [KEY_NAME, snakeStringCell(Buffer.from('probe-B', 'utf8'))],
    [KEY_DESCRIPTION, snakeStringCell(Buffer.from('image_data trivial SVG', 'utf8'))],
    [KEY_IMAGE_DATA, snakeStringCell(trivialBytes)],
  ]);
  // Config C (2): image base64 data-uri, no image_data.
  const cfgC = onchainContent([
    [KEY_NAME, snakeStringCell(Buffer.from('probe-C', 'utf8'))],
    [KEY_DESCRIPTION, snakeStringCell(Buffer.from('image base64 data-uri', 'utf8'))],
    [KEY_IMAGE, snakeStringCell(Buffer.from('data:image/svg+xml;base64,' + svgBytes.toString('base64'), 'utf8'))],
  ]);
  // Config D (3): image percent data-uri, no image_data.
  const cfgD = onchainContent([
    [KEY_NAME, snakeStringCell(Buffer.from('probe-D', 'utf8'))],
    [KEY_DESCRIPTION, snakeStringCell(Buffer.from('image percent data-uri', 'utf8'))],
    [KEY_IMAGE, snakeStringCell(Buffer.from('data:image/svg+xml,' + percentEncodeSvg(svgText), 'utf8'))],
  ]);

  const contents = Dictionary.empty(Dictionary.Keys.BigUint(64), Dictionary.Values.Cell());
  contents.set(0n, cfgA);
  contents.set(1n, cfgB);
  contents.set(2n, cfgC);
  contents.set(3n, cfgD);

  const collectionContent = onchainContent([
    [KEY_NAME, snakeStringCell(Buffer.from('Platho render probe', 'utf8'))],
    [KEY_DESCRIPTION, snakeStringCell(Buffer.from('tonapi onchain SVG render probe', 'utf8'))],
  ]);

  const owner = Address.parseRaw(OWNER_RAW);

  // AUTHORITATIVE: code + data BOCs and address come from the Tact wrapper, not a hand layout.
  const collection = await ProbeCollection.fromInit(owner, NEXT_INDEX, collectionContent, contents);
  if (!collection.init) throw new Error('wrapper did not return init (code+data)');

  // mintBody = beginCell().storeUint(0x50524f42,32).storeCoins(toNano('0.05')).endCell()
  const mintBody = beginCell().storeUint(MINT_OPCODE, 32).storeCoins(ITEM_VALUE).endCell();

  // AUTHORITATIVE item addresses: derived from the Tact ProbeItem wrapper init the SAME way the
  // collection's get_nft_address_by_index does — contractAddress(0, ProbeItem(collection, i, owner)).
  const items: { index: number; raw: string; uq: string; eq: string }[] = [];
  for (let i = 0; i < Number(NEXT_INDEX); i++) {
    const itemInit = await ProbeItem.init(collection.address, BigInt(i), owner);
    const addr = contractAddress(0, itemInit);
    items.push({
      index: i,
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
    svgPath: SVG_PATH,
    svgBytes: svgBytes.length,
    generatedAt: new Date().toISOString(),
  };

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');

  console.log('Wrote', OUT_PATH);
  console.log('  collection address (raw):', out.collectionAddressRaw);
  console.log('  collection UQ (mainnet)  :', collection.address.toString({ urlSafe: true, bounceable: false }));
  console.log('  collection EQ (mainnet)  :', collection.address.toString({ urlSafe: true, bounceable: true }));
  console.log('  code BOC b64 bytes       :', out.collectionCodeBocB64.length);
  console.log('  data BOC b64 bytes       :', out.collectionDataBocB64.length);
  console.log('  mint body b64            :', out.mintBodyBocB64);
  console.log('  owner (raw)              :', out.ownerRaw);
  console.log('  next_index / item_value  :', out.nextIndex, '/', out.itemValueTon, 'TON');
  for (const it of items) console.log(`  item[${it.index}] raw           :`, it.raw, '| UQ', it.uq);
}

main().catch((e) => { console.error(e); process.exit(1); });
