#!/usr/bin/env ts-node
/*
 * GENESIS CEREMONY TOOL — upload the on-chain SVG art parts into UsernameRegistry, then SealArt.
 *
 * The full Arimo glyph/static path-`d` set (~46KB) does NOT fit in the registry CODE (the deploy
 * external is bounded by TON's 65535-byte limit; see username-nft-deploy-size-wall-dict-art).
 * So the registry deploys with an EMPTY `art` dict and the genesis controller uploads the 56
 * parts here (batched, each external well under the limit), then SealArt locks them one-way.
 *
 * Order in the ceremony: D09 (deploy registry) -> Bind* -> [THIS: UploadArt x56 + SealArt] -> SealGenesis. That order
 * is ENFORCED: SealGenesis throws 19045 unless art_sealed is already true. It has to be, because the seal does not
 * revoke the genesis controller — skipping SealArt would have left this hot wallet able to rewrite the SVG every .ath
 * NFT renders, forever, in a contract that is otherwise immutable.
 *
 * Transport: routes signed externals through the Platho gateway (rpc.platho.app), like the D09 tool.
 * DRY-RUN by default; --broadcast actually sends. Mnemonic read from a file, never logged.
 *
 * Usage:
 *   dry run:   ts-node scripts/mainnet_upload_username_art.ts --registry <UQ|raw> --mnemonic-file artifacts/local/genesis_controller.secret.txt
 *   upload:    ... --broadcast
 *   + seal:    ... --broadcast --seal
 *
 * [CORRECTED 2026-08-02, mid-ceremony] This line used to name artifacts/local/deployer.secret. UploadArt is gated on
 * requireGenesisController, and the genesis controller's seed is genesis_controller.secret.txt — the mapping the
 * broadcaster uses for every other controller step. An operator following this line would have signed all 56 uploads
 * from the wrong wallet and had each one thrown, on a tool whose whole job is a step that must precede SealGenesis.
 * The twin script, mainnet_upload_collection_meta.ts, already named the right file, which is how the two disagreeing
 * documents were noticed at all.
 */
import { readFileSync, existsSync } from 'node:fs';
import { Address, beginCell, Cell, internal, storeMessage, SendMode, toNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import * as TonLib from '@ton/ton';
import { storeUploadArt, storeSealArt } from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';

// The rpc.platho.app gateway was decommissioned (PWA v468); route through keyed toncenter directly.
// Key from env or artifacts/local/center.txt (gitignored) — required so 56 externals + the seqno/art-count
// polling don't drown in keyless 429s. The key is appended as api_key= on every toncenter call.
const GATEWAY = (process.env.PLATHO_GATEWAY || 'https://toncenter.com').replace(/\/+$/, '');
const TONCENTER_KEY = (process.env.TONCENTER_API_KEY
  || (existsSync('artifacts/local/center.txt') ? readFileSync('artifacts/local/center.txt', 'utf8') : '')).trim();
const TONAPI_KEY = (process.env.TONAPI_KEY || (existsSync('artifacts/local/tonapi.txt') ? readFileSync('artifacts/local/tonapi.txt', 'utf8') : '')).trim();
const KEY_Q = TONCENTER_KEY ? `api_key=${encodeURIComponent(TONCENTER_KEY)}` : '';
const withKey = (url: string) => (KEY_Q ? `${url}${url.includes('?') ? '&' : '?'}${KEY_Q}` : url);
const PAYLOAD_PATH = 'artifacts/username_art_v2/art_payload.json';
// per UploadArt: each part carries its share of the registry's PERMANENT storage reserve.
// 56 x 0.17 = 9.52 TON accumulates in the registry (it retains UploadArt value) -> covers the
// 1302-cell base (code+art, 8.464 TON / 100yr @ mainnet 135 nanotons/cell) for ~112 years in
// the worst case (zero mints); every mint adds +0.097 TON, so with use the reserve only grows.
const ITEM_VALUE = toNano('0.17');
const BATCH = 4;                        // V4/V5 allow up to 4 out-messages per external
const EXT_LIMIT = 65535;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : undefined;
}
function die(m: string): never { console.error('\n  ABORT: ' + m + '\n'); process.exit(1); }
const fmtTon = (n: bigint) => (Number(n) / 1e9).toFixed(4);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Plain Tact-String snake (127-byte chunks + refs, NO 0x00 marker) — what asString() expects.
function plainSnake(s: string): Cell {
  const bytes = Buffer.from(s, 'utf8'); const CHUNK = 127; const chunks: Buffer[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) chunks.push(bytes.subarray(i, i + CHUNK));
  if (chunks.length === 0) chunks.push(Buffer.alloc(0));
  let next: Cell | null = null;
  for (let i = chunks.length - 1; i >= 0; i--) { const b = beginCell().storeBuffer(chunks[i]); if (next) b.storeRef(next); next = b.endCell(); }
  return next!;
}
async function gwGetState(addr: string) {
  const r = await fetch(withKey(`${GATEWAY}/api/v2/getAddressInformation?address=${encodeURIComponent(addr)}`), { headers: { accept: 'application/json' } });
  const j: any = await r.json().catch(() => ({}));
  if (!j || j.ok !== true) throw new Error(`getAddressInformation(${addr}): ${j?.error ?? 'HTTP ' + r.status}`);
  return j.result;
}
async function gwRunGet(addr: string, method: string): Promise<string> {
  // toncenter v2 FIRST: the gateway runGetMethod returns stale/0 for hot registry state.
  try { const r = await fetch(withKey('https://toncenter.com/api/v2/runGetMethod'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addr, method, stack: [] }) }); const j: any = await r.json(); const v = j?.result?.stack?.[0]?.[1]; if (typeof v === 'string') return v; } catch {}
  try { const r = await fetch(withKey(`${GATEWAY}/api/v3/runGetMethod`), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addr, method, stack: [] }) }); const j: any = await r.json(); return j?.stack?.[0]?.value ?? j?.result?.stack?.[0]?.[1] ?? '0'; } catch { return '0'; }
}
async function gwSendBoc(bocB64: string) {
  // tonapi FIRST: toncenter intermittently 500s (and drops large externals); tonapi is the reliable deliverer.
  const parts: string[] = []; let anyOk = false;
  try { const headers: any = { 'content-type': 'application/json', accept: 'application/json' }; if (TONAPI_KEY) headers['Authorization'] = `Bearer ${TONAPI_KEY}`; const r = await fetch('https://tonapi.io/v2/blockchain/message', { method: 'POST', headers, body: JSON.stringify({ boc: bocB64 }) }); parts.push(`tonapi ${r.status}`); if (r.ok) anyOk = true; } catch { parts.push('tonapi ERR'); }
  try { const r = await fetch(withKey('https://toncenter.com/api/v2/sendBoc'), { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ boc: bocB64 }) }); parts.push(`toncenter-v2 ${r.status}`); if (r.ok) anyOk = true; } catch { parts.push('toncenter-v2 ERR'); }
  try { const r = await fetch(withKey(`${GATEWAY}/api/v3/message`), { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ boc: bocB64 }) }); parts.push(`toncenter-v3 ${r.status}`); if (r.ok) anyOk = true; } catch { parts.push('toncenter-v3 ERR'); }
  return { httpStatus: 0, ok: anyOk, body: parts.join(' | ') };
}

async function main() {
  const registryArg = arg('--registry');
  const mnemonicFile = arg('--mnemonic-file');
  const doBroadcast = process.argv.includes('--broadcast');
  const doSeal = process.argv.includes('--seal');
  if (!registryArg) die('pass --registry <UQ|raw>');
  if (!mnemonicFile) die('pass --mnemonic-file <path> (gitignored, 24 words on one line)');
  const registry = registryArg.startsWith('0:') ? Address.parseRaw(registryArg) : Address.parse(registryArg);

  // Build all 56 UploadArt bodies.
  const payload: Record<string, string> = JSON.parse(readFileSync(PAYLOAD_PATH, 'utf8'));
  const keys = Object.keys(payload).map(Number).sort((a, b) => a - b);
  if (keys.length !== 56) die(`expected 56 art parts, got ${keys.length}`);
  const bodies = keys.map((k) => ({
    key: k,
    body: beginCell().store(storeUploadArt({ $$type: 'UploadArt', key: BigInt(k), data: plainSnake(payload[String(k)]) })).endCell(),
  }));

  // Controller wallet (genesis controller). Detect funded version like the D09 tool.
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

  // Batch into externals of <= BATCH messages; verify each external is under the network limit.
  const batches: { key: number; body: Cell }[][] = [];
  for (let i = 0; i < bodies.length; i += BATCH) batches.push(bodies.slice(i, i + BATCH));

  let seqno = Number(BigInt(await gwRunGet(wallet.address.toString(), 'seqno')));
  const alreadyUploaded = Number(BigInt(await gwRunGet(registry.toString(), 'get_art_count'))) === bodies.length;
  console.log('\n=== UploadArt plan ===');
  console.log('  registry :', registry.toString({ urlSafe: true, bounceable: true }));
  console.log('  wallet   :', wallet.address.toString({ urlSafe: true, bounceable: false }), `(${chosen.name}, ${fmtTon(chosen.balance)} TON, seqno=${seqno})`);
  console.log('  parts    :', bodies.length, '| batches:', batches.length, `(<=${BATCH}/external) | seal:`, doSeal);
  const need = (alreadyUploaded ? 0n : ITEM_VALUE * BigInt(bodies.length)) + toNano('0.5');
  if (chosen.balance < need) die(`controller needs ~${fmtTon(need)} TON; has ${fmtTon(chosen.balance)}. Fund it.`);

  // Pre-flight: build + size-check every external (dry).
  const externals: { boc: Buffer; keys: number[]; bytes: number }[] = [];
  let sq = seqno;
  for (const batch of batches) {
    const messages = batch.map((b) => internal({ to: registry, value: ITEM_VALUE, bounce: true, body: b.body }));
    const transfer = wallet.createTransfer({ seqno: sq, secretKey: key.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY, messages, timeout: Math.floor(Date.now() / 1000) + 1800 });
    const ext = beginCell().store(storeMessage({ info: { type: 'external-in', src: null, dest: wallet.address, importFee: 0n }, init: null, body: transfer })).endCell();
    const boc = ext.toBoc();
    if (boc.length >= EXT_LIMIT) die(`external for keys [${batch.map((b) => b.key).join(',')}] is ${boc.length} bytes (>= ${EXT_LIMIT})`);
    externals.push({ boc, keys: batch.map((b) => b.key), bytes: boc.length });
    sq += 1;
  }
  console.log('  external sizes:', externals.map((e) => e.bytes).join(', '), 'bytes (all <', EXT_LIMIT, ')');

  if (!doBroadcast) {
    console.log('\n  DRY RUN — nothing sent. Re-run with --broadcast to upload, add --seal to lock.\n');
    return;
  }

  // Broadcast each external, waiting for seqno to advance before the next (sequential nonce).
  if (alreadyUploaded) { console.log('  registry art_count already == parts — skipping upload, sealing only.'); }
  else for (let i = 0; i < externals.length; i++) {
    const e = externals[i];
    console.log(`  [${i + 1}/${externals.length}] keys [${e.keys.join(',')}] (${e.bytes}B, seqno ${seqno}) ...`);
    let advanced = false;
    for (let attempt = 1; attempt <= 3 && !advanced; attempt++) {
      const res = await gwSendBoc(e.boc.toString('base64'));
      console.log(`      send#${attempt} ${res.ok ? 'OK' : 'REJ'} [${res.body}]`);
      if (!res.ok && attempt === 1) die(`both endpoints rejected batch ${i + 1}: ${res.body}`);
      for (let t = 0; t < 40 && !advanced; t++) { await sleep(3000); const s = Number(BigInt(await gwRunGet(wallet.address.toString(), 'seqno'))); if (s > seqno) { seqno = s; advanced = true; } }
    }
    if (!advanced) die(`batch ${i + 1} did not land after 3 attempts (~6min) — stopping; re-run (idempotent) to resume`);
  }
  if (!alreadyUploaded) {
    let count = 0;
    for (let t = 0; t < 6; t++) { count = Number(BigInt(await gwRunGet(registry.toString(), 'get_art_count'))); if (count === 56) break; await sleep(4000); }
    console.log('  uploaded. registry art_count =', count, '/ 56');
    if (count !== 56) die(`art_count is ${count}, expected 56 — some uploads did not land; re-run (idempotent) before sealing.`);
  } else { console.log('  art_count confirmed 56 at start — proceeding to seal.'); }

  if (doSeal) {
    console.log('  sending SealArt ...');
    const sealBody = beginCell().store(storeSealArt({ $$type: 'SealArt' })).endCell();
    const transfer = wallet.createTransfer({ seqno, secretKey: key.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY, messages: [internal({ to: registry, value: ITEM_VALUE, bounce: true, body: sealBody })], timeout: Math.floor(Date.now() / 1000) + 1800 });
    const ext = beginCell().store(storeMessage({ info: { type: 'external-in', src: null, dest: wallet.address, importFee: 0n }, init: null, body: transfer })).endCell();
    let sealed = false;
    for (let attempt = 1; attempt <= 3 && !sealed; attempt++) {
      const res = await gwSendBoc(ext.toBoc().toString('base64'));
      console.log(`      seal send#${attempt} ${res.ok ? 'OK' : 'REJ'} [${res.body}]`);
      if (!res.ok && attempt === 1) die(`both endpoints rejected SealArt: ${res.body}`);
      for (let t = 0; t < 40 && !sealed; t++) { await sleep(3000); if ((await gwRunGet(registry.toString(), 'get_art_sealed')) !== '0') sealed = true; }
    }
    if (sealed) { console.log('  ✅ art_sealed = true. Art is locked.'); return; }
    console.log('  SealArt sent; art_sealed not yet observed — verify + re-run --seal.');
  } else {
    console.log('  art uploaded but NOT sealed. Re-run with --seal once verified.');
  }
}
main().catch((e) => die(e?.message ?? String(e)));
