#!/usr/bin/env node
/*
 * Is the large-external effect a property of TON, or of one RPC provider?
 *
 * scripts/external_size_probe_official_sdk.mjs measured it and found it: 1252B externals land 50/50 with a 2.2s
 * median, 62161B externals land 29/49 with a 24.7s median and a 100.2s worst case. But every one of those went out
 * through toncenter, so the result is strictly "toncenter accepted small externals and often did not accept large
 * ones". That is not the same claim as "TON does", and the difference decides who the finding should go to.
 *
 * This script is that script with ONE thing changed: which door the external is broadcast through. TON has several
 * independent public ones, run by different companies over different lite-servers:
 *
 *   toncenter   https://toncenter.com/api/v3/message
 *   tonapi      https://tonapi.io/v2/blockchain/message
 *   tonhub      https://mainnet-v4.tonhubapi.com/send
 *
 * If large externals are lost through all three, the provider is exonerated and the behaviour is the network's. If
 * they are lost through one, the finding belongs to that provider and nowhere else.
 *
 * SEQNO IS STILL READ THROUGH TONCENTER, deliberately. Reading and broadcasting are separate concerns, and moving
 * both at once would leave a disagreement unattributable. The door is the only variable.
 *
 * NEEDS: Node 20+, `npm i @ton/ton @ton/core @ton/crypto`, a funded THROWAWAY mainnet wallet, and optionally a free
 * TON Center API key (from @toncenter in Telegram) which is used only to poll seqno faster.
 *
 *   node scripts/external_size_probe_doors.mjs --dryRun               # builds only, sends nothing, costs nothing
 *   node scripts/external_size_probe_doors.mjs --door tonhub --trials 40
 *   node scripts/external_size_probe_doors.mjs --door rotate --trials 60   # all three, interleaved in time
 *
 * COSTS REAL MONEY on mainnet: roughly 0.09 GRAM per large trial that lands.
 *
 * The mnemonic is read from a file (--wallet, default artifacts/local/probe-wallet.txt) and never from the command
 * line, since arguments land in shell history.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV5R1 } from '@ton/ton';
import { beginCell, external, internal, storeMessage, SendMode } from '@ton/core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);

const DOORS = {
  toncenter: 'https://toncenter.com/api/v3/message',
  tonapi: 'https://tonapi.io/v2/blockchain/message',
  tonhub: 'https://mainnet-v4.tonhubapi.com/send',
};
const DOOR = String(arg('door', 'tonhub')).toLowerCase();
if (DOOR !== 'rotate' && !DOORS[DOOR]) {
  console.error(`unknown --door ${DOOR}; expected one of ${Object.keys(DOORS).join(', ')} or rotate`);
  process.exit(1);
}

const TRIALS = Number(arg('trials', 40));
// --largeOnly drops the small trials. They are nearly free (about 0.005 GRAM and two seconds each), and what they
// buy is a control: if every door turns out to lose large externals, interleaved small ones are the evidence that
// the network was healthy while it happened, rather than the whole run landing in one bad hour. Dropping them is
// only safe because the size question is already settled — 50/50 small landings against 29/49 large, same wallet,
// same sizes, one run earlier.
const LARGE_ONLY = has('largeOnly');
const SMALL = Number(arg('small', 1024));
const LARGE = Number(arg('large', 60000));
const VALID_FOR_S = Number(arg('validFor', 180));
const FINE_MS = Number(arg('fineMs', 250));
const FINE_WINDOW_MS = Number(arg('fineForMs', 15000));
const COARSE_MS = Number(arg('coarseMs', 3000));
const MNEMONIC_FILE = arg('wallet', `${ROOT}/artifacts/local/probe-wallet.txt`);
const OUT = arg('out', `${ROOT}/artifacts/local/external-size-probe-doors.csv`);
const READ_ENDPOINT = 'https://toncenter.com/api/v3';
const DRY = has('dryRun');

const KEY_FILE = `${ROOT}/artifacts/local/center.txt`;
async function resolveApiKey() {
  const fromEnv = (process.env.TONCENTER_API_KEY ?? '').trim();
  if (fromEnv) return fromEnv;
  const fromArg = String(arg('key', '')).trim();
  if (fromArg) return fromArg;
  const fromFile = existsSync(KEY_FILE) ? readFileSync(KEY_FILE, 'utf8').trim() : '';
  if (fromFile) return fromFile;
  if (!process.stdin.isTTY) return null;
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = (await rl.question(
    'TON Center API key for READING seqno (free from @toncenter in Telegram), or Enter to run keyless: ')).trim();
  rl.close();
  return answer || null;
}
const apiKey = DRY ? null : await resolveApiKey();
if (!apiKey && !DRY) console.error('reading WITHOUT a key: ~1 rps, so seqno polling is slowed to match.');

// Fine while an answer is plausible, coarse afterwards: a flat 3s tick put a 3.2s floor under every latency the
// earlier run measured, and a flat 250ms tick would fire ~700 reads at every trial that runs the full window.
const pollDelay = (elapsedMs) => (elapsedMs < FINE_WINDOW_MS
  ? (apiKey ? FINE_MS : Math.max(FINE_MS, 1200))
  : (apiKey ? COARSE_MS : Math.max(COARSE_MS, 3000)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readRpc(path, init) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;
  const res = await fetch(`${READ_ENDPOINT}${path}`, { ...init, headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep the raw text for the error message */ }
  return { status: res.status, ok: res.ok, json, text };
}

/** Broadcast through one door. No API key is sent: every door here accepts anonymous POSTs, and a key on the
 *  broadcast path would be one more difference between the doors than the experiment is allowed to have. */
async function broadcast(doorId, boc) {
  const res = await fetch(DOORS[doorId], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ boc }),
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, text };
}

if (!existsSync(MNEMONIC_FILE) && !DRY) {
  console.error(`No wallet file at ${MNEMONIC_FILE}. Put the 24 words of a THROWAWAY funded wallet there.`);
  process.exit(1);
}
const words = existsSync(MNEMONIC_FILE) ? readFileSync(MNEMONIC_FILE, 'utf8').trim().split(/\s+/) : null;
const keyPair = words
  ? await mnemonicToPrivateKey(words)
  : await mnemonicToPrivateKey('abandon '.repeat(23).split(' ').slice(0, 23).concat(['art']));
const wallet = WalletContractV5R1.create({ workchain: 0, publicKey: keyPair.publicKey });
console.error(`wallet: ${wallet.address.toRawString()}`);
console.error(`        ${wallet.address.toString({ bounceable: false, urlSafe: true })}`);

/** A payload cell of exactly `bytes` bytes, as a snake chain — the one thing that differs between sizes. */
function payloadCell(bytes) {
  const data = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i += 1) data[i] = 65 + (i % 26);
  const CHUNK = 127 - 4;                       // leave room for the op prefix in the head cell
  const chunks = [];
  for (let off = 0; off < data.length; off += CHUNK) chunks.push(data.subarray(off, off + CHUNK));
  let tail = beginCell().endCell();
  for (let i = chunks.length - 1; i >= 1; i -= 1) {
    tail = beginCell().storeBuffer(chunks[i]).storeRef(tail).endCell();
  }
  const head = beginCell().storeUint(0, 32);   // text-comment opcode, so the payload is a plain comment
  if (chunks.length) head.storeBuffer(chunks[0]);
  if (chunks.length > 1) head.storeRef(tail);
  return head.endCell();
}

/** The signed external, exactly as the official SDK serializes it. */
function buildExternal(seqno, size) {
  const body = wallet.createTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    timeout: Math.floor(Date.now() / 1000) + VALID_FOR_S,
    messages: [internal({ to: wallet.address, value: 1n, bounce: false, body: payloadCell(size) })],
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
  });
  const message = external({ to: wallet.address, init: seqno === 0 ? wallet.init : undefined, body });
  const boc = beginCell().store(storeMessage(message)).endCell().toBoc();
  return { boc: boc.toString('base64'), bytes: boc.length };
}

if (DRY) {
  for (const size of [SMALL, LARGE]) {
    const built = buildExternal(1, size);
    console.log(`payload ${String(size).padStart(6)}B -> external ${String(built.bytes).padStart(6)}B`
      + `${built.bytes > 65535 ? '  OVER max_ext_msg_size (65535)' : ''}`);
  }
  console.log(`\ndoors: ${DOOR === 'rotate' ? Object.keys(DOORS).join(', ') : DOOR}`);
  console.log('dry run: nothing was signed against a real seqno and nothing was sent.');
  process.exit(0);
}

async function readSeqno() {
  const r = await readRpc('/runGetMethod', {
    method: 'POST',
    body: JSON.stringify({ address: wallet.address.toRawString(), method: 'seqno', stack: [] }),
  });
  if (!r.ok) throw new Error(`seqno: HTTP ${r.status}`);
  const exit = Number(r.json?.exit_code ?? 0);
  // An account with no code aborts the get-method with -13 and leaves GARBAGE on the stack; a reader that trusts
  // stack[0] here signs against nonsense and every external afterwards is refused, silently, for the whole run.
  if (exit === -13 || exit === -256) return 0;
  if (exit !== 0) throw new Error(`seqno: exit ${exit}`);
  const first = r.json?.stack?.[0];
  const raw = Array.isArray(first) ? first[1] : (first?.value ?? first);
  return Number(BigInt(raw ?? 0));
}

// Sizes alternate so a busy half-hour cannot masquerade as a size effect; under --door rotate the doors advance one
// size-pair at a time, so every door meets both sizes across the whole run rather than owning one stretch of it.
const doorPlan = DOOR === 'rotate' ? Object.keys(DOORS) : [DOOR];
const plan = [];
if (LARGE_ONLY) {
  for (let i = 0; i < TRIALS; i += 1) plan.push({ size: LARGE, door: doorPlan[i % doorPlan.length] });
} else {
  for (let pair = 0; pair < Math.floor(TRIALS / 2); pair += 1) {
    const door = doorPlan[pair % doorPlan.length];
    plan.push({ size: SMALL, door });
    plan.push({ size: LARGE, door });
  }
}
const SIZES = LARGE_ONLY ? [LARGE] : [SMALL, LARGE];

writeFileSync(OUT, 'trial,door,payload_bytes,external_bytes,post_status,refused,landed,latency_ms,read_errors\n', 'utf8');
const rows = [];
console.error(`plan: ${plan.length} trials, ${LARGE_ONLY ? `${LARGE}B only` : `alternating ${SMALL}B / ${LARGE}B`}, `
  + `door ${DOOR === 'rotate' ? doorPlan.join(' / ') : DOOR}, valid_until +${VALID_FOR_S}s\n`);

for (let i = 0; i < plan.length; i += 1) {
  const { size, door } = plan[i];
  let before;
  try { before = await readSeqno(); }
  catch (error) { console.error(`[${i}] seqno read failed: ${error.message}`); await sleep(3000); continue; }

  const built = buildExternal(before, size);
  const deadline = Date.now() + VALID_FOR_S * 1000 + 5000;
  const sentAt = Date.now();
  let posted;
  try { posted = await broadcast(door, built.boc); }
  catch (error) { posted = { status: 0, ok: false, text: `fetch failed: ${error.message}` }; }
  const refused = !posted.ok;
  if (refused) {
    // NOT counted as a lost message: the door said no, so the network was never asked. The window is still waited
    // out below, because a refusal can arrive after the external was already forwarded, and signing a second one
    // against the same seqno would quietly invalidate the next trial.
    console.error(`[${String(i).padStart(3)}] ${door} POST ${posted.status} refused: `
      + `${String(posted.text).slice(0, 120)}`);
  }

  let landed = false;
  let latencyMs = null;
  let readErrors = 0;
  while (Date.now() < deadline) {
    await sleep(pollDelay(Date.now() - sentAt));
    try {
      const now = await readSeqno();
      if (now > before) { landed = true; latencyMs = Date.now() - sentAt; break; }
    } catch { readErrors += 1; }
  }
  // ABSENCE MUST BE PROVEN: a run of failed reads at the end of the window would otherwise be written down as a
  // lost message.
  if (!landed) {
    for (let attempt = 0; attempt < 4 && !landed; attempt += 1) {
      await sleep(2000);
      try {
        const now = await readSeqno();
        if (now > before) { landed = true; latencyMs = Date.now() - sentAt; }
      } catch { readErrors += 1; }
    }
  }

  const row = {
    i, door, size, externalBytes: built.bytes, postStatus: posted.status, refused, landed, latencyMs, readErrors,
  };
  rows.push(row);
  appendFileSync(OUT, `${row.i},${row.door},${row.size},${row.externalBytes},${row.postStatus},${row.refused},`
    + `${row.landed},${row.latencyMs ?? ''},${row.readErrors}\n`, 'utf8');
  console.error(`[${String(i).padStart(3)}] ${door.padEnd(9)} ${String(built.bytes).padStart(6)}B  `
    + `POST ${posted.status}  ${landed ? `landed in ${(latencyMs / 1000).toFixed(1)}s` : 'NEVER LANDED'}`
    + `${refused ? '  (door refused)' : ''}${readErrors ? `  (${readErrors} read errors)` : ''}`);

  if (!landed) {
    const waitMs = deadline - Date.now();
    if (waitMs > 0) await sleep(waitMs);
  }
}

console.log('');
console.log('door       payload   sent  refused  landed  lost   lost%   min    p50    p90    max');
for (const door of doorPlan) {
  for (const size of SIZES) {
    const set = rows.filter((r) => r.door === door && r.size === size);
    if (!set.length) continue;
    const asked = set.filter((r) => !r.refused);              // refusals never reached the network
    const ok = asked.filter((r) => r.landed);
    const lat = ok.map((r) => r.latencyMs).sort((a, b) => a - b);
    const at = (p) => (lat.length
      ? `${(lat[Math.min(lat.length - 1, Math.floor(lat.length * p))] / 1000).toFixed(1)}s`
      : '—');
    console.log(`${door.padEnd(11)}${String(size).padStart(6)}B  ${String(set.length).padStart(4)}`
      + `  ${String(set.length - asked.length).padStart(7)}  ${String(ok.length).padStart(6)}`
      + `  ${String(asked.length - ok.length).padStart(4)}`
      + `  ${(asked.length ? `${Math.round((1 - ok.length / asked.length) * 100)}%` : '—').padStart(5)}`
      + `  ${at(0).padStart(5)}  ${at(0.5).padStart(5)}  ${at(0.9).padStart(5)}  ${at(1).padStart(5)}`);
  }
}
console.log(`\ncsv: ${OUT}`);
