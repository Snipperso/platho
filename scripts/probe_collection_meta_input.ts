#!/usr/bin/env ts-node
/*
 * ProbeCollection deploy input — ON-CHAIN COLLECTION METADATA probe (avatar + banner + description).
 *
 * Goal: prove a FULLY ON-CHAIN GetGems collection page (avatar + banner + description) using the Meridian recipe
 * (data-URI STRING in `image`/`cover_image`, NOT image_data raw bytes). Our SVGs use `#` colors + url(#id)
 * gradients, so base64 is the robust primary; items A/B the other encodings so one deploy maps the whole boundary.
 *
 * COLLECTION content: name + description + image=base64(avatar) + cover_image=base64(banner).
 * ITEMS (avatar encoding matrix, rendered via get_nft_content override):
 *   0 b64       : image = data:image/svg+xml;base64,<b64>            (matches collection — positive)
 *   1 utf8-pct  : image = data:image/svg+xml;utf8,<svg #->%23>       (does the ;utf8 form percent-decode?)
 *   2 plain-pct : image = data:image/svg+xml,<svg #->%23>           (standard percent form — must decode)
 *   3 imgdata   : image_data = raw SVG bytes                         (the OLD GetGems-placeholder path — control)
 *
 * Run: npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" scripts/probe_collection_meta_input.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { Address, beginCell, Cell, contractAddress, Dictionary, toNano } from '@ton/core';
import { ProbeCollection } from '../build/_probe/ProbeCollection/ProbeCollection_ProbeCollection';
import { ProbeItem } from '../build/_probe/ProbeCollection/ProbeCollection_ProbeItem';

const key = (s: string): bigint => BigInt('0x' + createHash('sha256').update(s).digest('hex'));
const KEY_NAME = key('name');
const KEY_DESCRIPTION = key('description');
const KEY_IMAGE = key('image');
const KEY_COVER_IMAGE = key('cover_image');
const KEY_IMAGE_DATA = key('image_data');

const AVATAR_SVG = 'artifacts/getgems-collection/platho-usernames-avatar-512.svg';
const BANNER_SVG = 'artifacts/getgems-collection/platho-usernames-banner-2500x650.svg';
const OWNER_RAW = '0:d293c724d854493a656de212fb1e061759968e785abf5110279772f907d36c02';
const NEXT_INDEX = 4n;
const ITEM_VALUE = toNano('0.05');
const MINT_OPCODE = 0x50524f42;
const OUT_DIR = 'artifacts/local';
const OUT_PATH = join(OUT_DIR, 'probe_collection_meta_input.json');

const DESCRIPTION =
  'Platho Usernames are your identity on Platho — a fully decentralized, post-quantum encrypted messenger that lives entirely on the TON blockchain. No backend, no central server, no platform permission.\n\n' +
  'Each NFT is a unique .ath username: a human-readable name bound to your wallet and your chats. Own it, move it, sell it — your identity travels with you, on-chain. Shorter names are scarcer: 4-letter names are the rarest, 5-letter rare, and 6+ characters common.\n\n' +
  'Mint and use your name right inside the app at platho.app. One name, one wallet, your keys.';

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
const snake = (s: string): Cell => snakeStringCell(Buffer.from(s, 'utf8'));

function onchainContent(entries: [bigint, Cell][]): Cell {
  const dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
  for (const [k, v] of entries) dict.set(k, v);
  return beginCell().storeUint(0, 8).storeDict(dict).endCell();
}

// Minify SVG (collapse inter-tag + repeated whitespace) — smaller on-chain, no newline hazards in a data-URI.
const svgMin = (svg: string): string =>
  svg.replace(/>\s+</g, '><').replace(/[\t\n\r]+/g, ' ').replace(/ {2,}/g, ' ').trim();
// Minimal URI-safe percent-encoding for the ;utf8, / plain data-URI forms: encode % first, then # (the fragment
// delimiter that would otherwise truncate the URI). `<>"` are left raw (Meridian does).
const pct = (s: string): string => s.replace(/%/g, '%25').replace(/#/g, '%23');
const b64uri = (svg: string): string => 'data:image/svg+xml;base64,' + Buffer.from(svgMin(svg), 'utf8').toString('base64');
const utf8uri = (svg: string): string => 'data:image/svg+xml;utf8,' + pct(svgMin(svg));
const plainuri = (svg: string): string => 'data:image/svg+xml,' + pct(svgMin(svg));

async function main() {
  const avatar = readFileSync(AVATAR_SVG, 'utf8');
  const banner = readFileSync(BANNER_SVG, 'utf8');

  const collectionContent = onchainContent([
    [KEY_NAME, snake('Platho Usernames — onchain-meta probe')],
    [KEY_DESCRIPTION, snake(DESCRIPTION)],
    [KEY_IMAGE, snake(b64uri(avatar))],
    [KEY_COVER_IMAGE, snake(b64uri(banner))],
  ]);

  const itemContent = (name: string, extra: [bigint, Cell]): Cell => onchainContent([
    [KEY_NAME, snake(name)],
    [KEY_DESCRIPTION, snake('avatar encoding probe: ' + name)],
    extra,
  ]);
  const items = [
    { label: 'b64', content: itemContent('avatar b64', [KEY_IMAGE, snake(b64uri(avatar))]) },
    { label: 'utf8-pct', content: itemContent('avatar utf8-pct', [KEY_IMAGE, snake(utf8uri(avatar))]) },
    { label: 'plain-pct', content: itemContent('avatar plain-pct', [KEY_IMAGE, snake(plainuri(avatar))]) },
    { label: 'imgdata', content: itemContent('avatar image_data', [KEY_IMAGE_DATA, snake(svgMin(avatar))]) },
  ];

  const contents = Dictionary.empty(Dictionary.Keys.BigUint(64), Dictionary.Values.Cell());
  items.forEach((it, i) => contents.set(BigInt(i), it.content));

  const owner = Address.parseRaw(OWNER_RAW);
  const collection = await ProbeCollection.fromInit(owner, NEXT_INDEX, collectionContent, contents);
  if (!collection.init) throw new Error('wrapper did not return init (code+data)');
  const mintBody = beginCell().storeUint(MINT_OPCODE, 32).storeCoins(ITEM_VALUE).endCell();

  const itemOut: { index: number; label: string; raw: string; uq: string; eq: string }[] = [];
  for (let i = 0; i < Number(NEXT_INDEX); i++) {
    const itemInit = await ProbeItem.init(collection.address, BigInt(i), owner);
    const addr = contractAddress(0, itemInit);
    itemOut.push({ index: i, label: items[i].label, raw: addr.toRawString(), uq: addr.toString({ urlSafe: true, bounceable: false }), eq: addr.toString({ urlSafe: true, bounceable: true }) });
  }

  const out = {
    collectionCodeBocB64: collection.init.code.toBoc().toString('base64'),
    collectionDataBocB64: collection.init.data.toBoc().toString('base64'),
    collectionAddressRaw: collection.address.toRawString(),
    mintBodyBocB64: mintBody.toBoc().toString('base64'),
    ownerRaw: OWNER_RAW,
    nextIndex: Number(NEXT_INDEX),
    itemValueTon: '0.05',
    items: itemOut,
    svgPath: AVATAR_SVG,
    svgBytes: Buffer.byteLength(avatar),
    generatedAt: new Date().toISOString(),
  };
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');

  console.log('Wrote', OUT_PATH);
  console.log('  collection UQ :', collection.address.toString({ urlSafe: true, bounceable: false }));
  console.log('  collection EQ :', collection.address.toString({ urlSafe: true, bounceable: true }));
  console.log('  data BOC b64  :', out.collectionDataBocB64.length, 'chars (~', Math.round(out.collectionDataBocB64.length * 0.75 / 1024), 'KB cell data)');
  console.log('  avatar bytes  :', Buffer.byteLength(avatar), '| banner bytes:', Buffer.byteLength(banner));
  console.log('  base64 avatar uri len:', b64uri(avatar).length, '| base64 banner uri len:', b64uri(banner).length);
  for (const it of itemOut) console.log(`  item[${it.index}] ${it.label}: UQ ${it.uq}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
