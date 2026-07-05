#!/usr/bin/env ts-node
/*
 * GENESIS CEREMONY TOOL — upload the on-chain COLLECTION metadata into UsernameRegistry, then SealCollectionMeta.
 *
 * clean-11 gives the username NFT collection a real GetGems page: name + description + avatar (image) + banner
 * (cover_image), all ON-CHAIN. Base64 data-URIs in image/cover_image are proven to render on GetGems (the mainnet
 * probe 2026-07-04). Like `art`, the metadata does NOT fit the deploy external, so the registry deploys with an
 * EMPTY `meta` dict and the genesis controller uploads the 3 parts here, then SealCollectionMeta locks them one-way.
 *
 * CRITICAL: each part is a COMPLETE TEP-64 snake VALUE cell (0x00 marker + 127-byte chunks), NOT the plain-snake the
 * art tool uses. metaCell() in the contract serves the uploaded cell VERBATIM as the collection_content dict value,
 * so the 0x00 marker + the exact ref chain must be built here (a multi-cell banner would truncate under asString()).
 * The content bytes are BYTE-IDENTICAL to the GetGems-proven probe (scripts/probe_collection_meta_input.ts).
 *
 * Order in the ceremony: D09 (deploy registry) -> Bind* -> [UploadArt x56 + SealArt] -> [THIS: UploadCollectionMeta
 * x3 + SealCollectionMeta] -> SealGenesis. Genesis verify asserts meta_sealed == true.
 *
 * DRY-RUN by default (also runs a byte-for-byte round-trip self-check); --broadcast sends; --seal locks.
 *
 * Usage:
 *   dry run: ts-node scripts/mainnet_upload_collection_meta.ts --registry <UQ|raw> --mnemonic-file artifacts/local/genesis_controller.secret.txt
 *   upload:  ... --broadcast
 *   + seal:  ... --broadcast --seal
 */
import { readFileSync, existsSync } from 'node:fs';
import { Address, beginCell, Cell, internal, storeMessage, SendMode, toNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import * as TonLib from '@ton/ton';
import { storeUploadCollectionMeta, storeSealCollectionMeta } from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';

const GATEWAY = (process.env.PLATHO_GATEWAY || 'https://toncenter.com').replace(/\/+$/, '');
const TONCENTER_KEY = (process.env.TONCENTER_API_KEY
  || (existsSync('artifacts/local/center.txt') ? readFileSync('artifacts/local/center.txt', 'utf8') : '')).trim();
const TONAPI_KEY = (process.env.TONAPI_KEY
  || (existsSync('artifacts/local/tonapi.txt') ? readFileSync('artifacts/local/tonapi.txt', 'utf8') : '')).trim();
const KEY_Q = TONCENTER_KEY ? `api_key=${encodeURIComponent(TONCENTER_KEY)}` : '';
const withKey = (url: string) => (KEY_Q ? `${url}${url.includes('?') ? '&' : '?'}${KEY_Q}` : url);

const AVATAR_SVG = 'artifacts/getgems-collection/platho-usernames-avatar-512.svg';
const BANNER_SVG = 'artifacts/getgems-collection/platho-usernames-banner-2500x650.svg';
// clean-11 meta-dict keys (uint16), mirroring USERNAME_META_KEY_* in UsernameRegistry.tact.
const META_KEY_DESCRIPTION = 1n;
const META_KEY_IMAGE = 2n;
const META_KEY_COVER_IMAGE = 3n;
// Per UploadCollectionMeta: carries a share of the registry's PERMANENT storage reserve for the 3 never-pruned parts.
const ITEM_VALUE = toNano('0.2');
const EXT_LIMIT = 65535;

// BYTE-IDENTICAL to scripts/probe_collection_meta_input.ts (the GetGems-proven text) — immutable once sealed.
const DESCRIPTION =
  'Platho Usernames are your identity on Platho — a fully decentralized, post-quantum encrypted messenger that lives entirely on the TON blockchain. No backend, no central server, no platform permission.\n\n' +
  'Each NFT is a unique .ath username: a human-readable name bound to your wallet and your chats. Own it, move it, sell it — your identity travels with you, on-chain. Shorter names are scarcer: 4-letter names are the rarest, 5-letter rare, and 6+ characters common.\n\n' +
  'Mint and use your name right inside the app. One name, one wallet, your keys.\n\n' +
  'https://platho.app';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : undefined;
}
function die(m: string): never { console.error('\n  ABORT: ' + m + '\n'); process.exit(1); }
const fmtTon = (n: bigint) => (Number(n) / 1e9).toFixed(4);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// A get-method Bool: false = "0"/"0x0", true = "-1"/"-0x1"/"0xf..f". String-check (BigInt("-0x1") THROWS).
const truthy = (s: string) => { const t = (s || '').trim(); return t !== '' && t !== '0' && t !== '0x0' && t !== '0x00'; };

// COMPLETE TEP-64 snake VALUE cell: 0x00 marker + 127-byte chunks chained by ref. Identical to the probe builder.
export function snakeStringCell(bytes: Buffer | Uint8Array): Cell {
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
export const snake = (s: string): Cell => snakeStringCell(Buffer.from(s, 'utf8'));
// Decode a snake VALUE cell back to its string (skip the 0x00 marker), following refs — the round-trip self-check.
export function readSnakeString(cell: Cell): string {
  const bufs: Buffer[] = [];
  let cur: Cell | null = cell;
  let first = true;
  while (cur) {
    const s = cur.beginParse();
    let bits = s.remainingBits;
    if (first) { s.loadUint(8); bits -= 8; first = false; } // drop the 0x00 marker
    const bytes = Math.floor(bits / 8);
    if (bytes > 0) bufs.push(s.loadBuffer(bytes));
    cur = s.remainingRefs > 0 ? s.loadRef() : null;
  }
  return Buffer.concat(bufs).toString('utf8');
}

const svgMin = (svg: string): string =>
  svg.replace(/>\s+</g, '><').replace(/[\t\n\r]+/g, ' ').replace(/ {2,}/g, ' ').trim();
const b64uri = (svg: string): string => 'data:image/svg+xml;base64,' + Buffer.from(svgMin(svg), 'utf8').toString('base64');

export interface MetaPart { key: bigint; label: string; content: string; cell: Cell; }
// The canonical 3 collection-metadata parts (description + avatar image + banner cover_image), each a COMPLETE
// 0x00-snake value cell exactly as UploadCollectionMeta stores + metaCell() serves. Shared by the uploader and its
// sandbox round-trip test so the immutable bytes are single-sourced.
export function buildMetaParts(): MetaPart[] {
  const avatar = readFileSync(AVATAR_SVG, 'utf8');
  const banner = readFileSync(BANNER_SVG, 'utf8');
  return [
    { key: META_KEY_DESCRIPTION, label: 'description', content: DESCRIPTION },
    { key: META_KEY_IMAGE, label: 'image (avatar)', content: b64uri(avatar) },
    { key: META_KEY_COVER_IMAGE, label: 'cover_image (banner)', content: b64uri(banner) },
  ].map((p) => ({ ...p, cell: snake(p.content) }));
}

async function gwGetState(addr: string) {
  const r = await fetch(withKey(`${GATEWAY}/api/v2/getAddressInformation?address=${encodeURIComponent(addr)}`), { headers: { accept: 'application/json' } });
  const j: any = await r.json().catch(() => ({}));
  if (!j || j.ok !== true) throw new Error(`getAddressInformation(${addr}): ${j?.error ?? 'HTTP ' + r.status}`);
  return j.result;
}
async function gwRunGet(addr: string, method: string): Promise<string> {
  // Guard on exit_code 0: an UNDEPLOYED/erroring contract must read as '0', never leak a garbage stack value
  // (e.g. the method id) that could false-trip the already-sealed / count-reached checks.
  try { const r = await fetch(withKey('https://toncenter.com/api/v2/runGetMethod'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addr, method, stack: [] }) }); const j: any = await r.json(); if (j?.ok === true && j?.result?.exit_code === 0) { const v = j.result.stack?.[0]?.[1]; if (typeof v === 'string') return v; } } catch {}
  try { const r = await fetch(withKey(`${GATEWAY}/api/v3/runGetMethod`), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addr, method, stack: [] }) }); const j: any = await r.json(); if (j?.exit_code === 0 || j?.result?.exit_code === 0) { const v = j?.stack?.[0]?.value ?? j?.result?.stack?.[0]?.[1]; if (typeof v === 'string') return v; } } catch {}
  return '0';
}
async function gwSendBoc(bocB64: string) {
  // tonapi FIRST: toncenter/gateway silently DROP large externals (the banner part is ~6KB). tonapi delivers.
  const parts: string[] = []; let anyOk = false;
  try { const headers: any = { 'content-type': 'application/json', accept: 'application/json' }; if (TONAPI_KEY) headers['Authorization'] = `Bearer ${TONAPI_KEY}`; const r = await fetch('https://tonapi.io/v2/blockchain/message', { method: 'POST', headers, body: JSON.stringify({ boc: bocB64 }) }); parts.push(`tonapi ${r.status}`); if (r.ok) anyOk = true; } catch { parts.push('tonapi ERR'); }
  try { const r = await fetch(withKey('https://toncenter.com/api/v2/sendBoc'), { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ boc: bocB64 }) }); parts.push(`toncenter ${r.status}`); if (r.ok) anyOk = true; } catch { parts.push('toncenter ERR'); }
  return { ok: anyOk, body: parts.join(' | ') };
}

async function main() {
  const registryArg = arg('--registry');
  const mnemonicFile = arg('--mnemonic-file');
  const doBroadcast = process.argv.includes('--broadcast');
  const doSeal = process.argv.includes('--seal');
  if (!registryArg) die('pass --registry <UQ|raw>');
  if (!mnemonicFile) die('pass --mnemonic-file <path> (gitignored, 24 words)');
  const registry = registryArg.startsWith('0:') ? Address.parseRaw(registryArg) : Address.parse(registryArg);

  // The 3 parts. content strings are the EXACT bytes the contract will serve into collection_content.
  const parts = buildMetaParts();

  // ROUND-TRIP self-check (immutable safety): the built 0x00-snake cell must decode BYTE-FOR-BYTE to the source.
  console.log('\n=== round-trip self-check ===');
  for (const p of parts) {
    const back = readSnakeString(p.cell);
    const ok = back === p.content;
    console.log(`  key ${p.key} ${p.label.padEnd(22)} ${p.content.length}B  marker=0x${p.cell.beginParse().loadUint(8).toString(16).padStart(2, '0')}  round-trip=${ok ? 'OK' : 'MISMATCH'}`);
    if (!ok) die(`round-trip MISMATCH for ${p.label} — refusing to build an immutable upload`);
  }

  const bodies = parts.map((p) => ({
    key: p.key, label: p.label,
    body: beginCell().store(storeUploadCollectionMeta({ $$type: 'UploadCollectionMeta', key: p.key, data: p.cell })).endCell(),
  }));

  // Controller wallet (genesis controller) — auto-detect the funded version, like the art/D09 tools.
  const rawSeed = readFileSync(mnemonicFile, 'utf8').replace(/^﻿/, '').trim();
  let words: string[];
  try { const jp = JSON.parse(rawSeed); words = Array.isArray(jp) ? jp.map((w: any) => String(w).trim()).filter(Boolean) : rawSeed.split(/\s+/).filter(Boolean); } catch { words = rawSeed.split(/\s+/).filter(Boolean); }
  if (words.length !== 24) die(`mnemonic file must contain 24 words (got ${words.length})`);
  const key = await mnemonicToPrivateKey(words);
  const factories = ([['v5r1', (TonLib as any).WalletContractV5R1], ['v4r2', TonLib.WalletContractV4], ['v3r2', TonLib.WalletContractV3R2]] as [string, any][]).filter(([, C]) => C && typeof C.create === 'function');
  let chosen: any = null;
  for (const [name, C] of factories) {
    let w: any; try { w = C.create({ workchain: 0, publicKey: key.publicKey }); } catch { continue; }
    let st: any = null; try { st = await gwGetState(w.address.toString()); } catch {}
    const bal = st ? BigInt(st.balance || '0') : 0n;
    if (st && (st.state || st.account_state) === 'active' && (!chosen || bal > chosen.balance)) chosen = { name, w, balance: bal };
    await sleep(150);
  }
  if (!chosen) die('no active funded controller wallet derived from the mnemonic');
  const wallet = chosen.w;

  let seqno = Number(BigInt(await gwRunGet(wallet.address.toString(), 'seqno')));
  const startCount = Number(BigInt(await gwRunGet(registry.toString(), 'get_meta_count')));
  const alreadySealed = truthy(await gwRunGet(registry.toString(), 'get_meta_sealed'));
  console.log('\n=== UploadCollectionMeta plan ===');
  console.log('  registry :', registry.toString({ urlSafe: true, bounceable: true }));
  console.log('  wallet   :', wallet.address.toString({ urlSafe: true, bounceable: false }), `(${chosen.name}, ${fmtTon(chosen.balance)} TON, seqno=${seqno})`);
  console.log('  parts    :', bodies.length, '(1 external each) | meta_count on-chain:', startCount, '| meta_sealed:', alreadySealed, '| seal:', doSeal);
  const need = (startCount >= 3 ? 0n : ITEM_VALUE * BigInt(bodies.length)) + toNano('0.3');
  if (chosen.balance < need) die(`controller needs ~${fmtTon(need)} TON; has ${fmtTon(chosen.balance)}. Fund it.`);
  if (alreadySealed) die('meta already sealed on-chain — nothing to do.');

  // Pre-flight: build + size-check every external (dry). 1 UploadCollectionMeta per external (banner isolated).
  const externals: { boc: Buffer; label: string; bytes: number }[] = [];
  let sq = seqno;
  for (const b of bodies) {
    const transfer = wallet.createTransfer({ seqno: sq, secretKey: key.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY, messages: [internal({ to: registry, value: ITEM_VALUE, bounce: true, body: b.body })], timeout: Math.floor(Date.now() / 1000) + 1800 });
    const ext = beginCell().store(storeMessage({ info: { type: 'external-in', src: null, dest: wallet.address, importFee: 0n }, init: null, body: transfer })).endCell();
    const boc = ext.toBoc();
    if (boc.length >= EXT_LIMIT) die(`external for ${b.label} is ${boc.length} bytes (>= ${EXT_LIMIT})`);
    externals.push({ boc, label: b.label, bytes: boc.length });
    sq += 1;
  }
  console.log('  external sizes:', externals.map((e) => `${e.label}=${e.bytes}B`).join(', '), `(all < ${EXT_LIMIT})`);

  if (!doBroadcast) {
    console.log('\n  DRY RUN — nothing sent. Re-run with --broadcast to upload, add --seal to lock.\n');
    return;
  }

  for (let i = 0; i < externals.length; i++) {
    const e = externals[i];
    console.log(`  [${i + 1}/${externals.length}] ${e.label} (${e.bytes}B, seqno ${seqno}) ...`);
    let advanced = false;
    for (let attempt = 1; attempt <= 3 && !advanced; attempt++) {
      const res = await gwSendBoc(e.boc.toString('base64'));
      console.log(`      send#${attempt} ${res.ok ? 'OK' : 'REJ'} [${res.body}]`);
      if (!res.ok && attempt === 1) die(`all endpoints rejected ${e.label}: ${res.body}`);
      for (let t = 0; t < 40 && !advanced; t++) { await sleep(3000); const s = Number(BigInt(await gwRunGet(wallet.address.toString(), 'seqno'))); if (s > seqno) { seqno = s; advanced = true; } }
    }
    if (!advanced) die(`${e.label} did not land after 3 attempts (~6min) — stopping; re-run (idempotent) to resume`);
  }
  let count = 0;
  for (let t = 0; t < 6; t++) { count = Number(BigInt(await gwRunGet(registry.toString(), 'get_meta_count'))); if (count === 3) break; await sleep(4000); }
  console.log('  uploaded. registry meta_count =', count, '/ 3');
  if (count !== 3) die(`meta_count is ${count}, expected 3 — some uploads did not land; re-run (idempotent) before sealing.`);

  if (doSeal) {
    console.log('  sending SealCollectionMeta ...');
    const sealBody = beginCell().store(storeSealCollectionMeta({ $$type: 'SealCollectionMeta' })).endCell();
    const transfer = wallet.createTransfer({ seqno, secretKey: key.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY, messages: [internal({ to: registry, value: ITEM_VALUE, bounce: true, body: sealBody })], timeout: Math.floor(Date.now() / 1000) + 1800 });
    const ext = beginCell().store(storeMessage({ info: { type: 'external-in', src: null, dest: wallet.address, importFee: 0n }, init: null, body: transfer })).endCell();
    let sealed = false;
    for (let attempt = 1; attempt <= 3 && !sealed; attempt++) {
      const res = await gwSendBoc(ext.toBoc().toString('base64'));
      console.log(`      seal send#${attempt} ${res.ok ? 'OK' : 'REJ'} [${res.body}]`);
      if (!res.ok && attempt === 1) die(`all endpoints rejected SealCollectionMeta: ${res.body}`);
      for (let t = 0; t < 40 && !sealed; t++) { await sleep(3000); if (truthy(await gwRunGet(registry.toString(), 'get_meta_sealed'))) sealed = true; }
    }
    if (sealed) { console.log('  ✅ meta_sealed = true. Collection metadata is locked.'); return; }
    console.log('  SealCollectionMeta sent; meta_sealed not yet observed — verify + re-run --seal.');
  } else {
    console.log('  meta uploaded but NOT sealed. Re-run with --seal once verified (get_collection_data reverts 19360 until sealed).');
  }
}
if (require.main === module) main().catch((e) => die(e?.message ?? String(e)));
