#!/usr/bin/env node
/*
 * Does the SIZE of an external message change whether it reaches a block?
 * SECOND IMPLEMENTATION — every byte we sign is built by the official TON SDK.
 *
 * The first implementation (scripts/external_size_latency_probe.mjs) uses this project's own wallet, cell and BOC
 * code. That is a fair objection to any result it produces: a reader can say the serializer is wrong and stop
 * reading. So this one takes the wallet contract, the cell builder, the message serializer and the signature from
 * @ton/ton, @ton/core and @ton/crypto — libraries the TON team maintains. What remains ours is only "make a payload
 * of N bytes" and "POST it once".
 *
 * Run BOTH. Agreement means the effect is real and none of it is our code. Disagreement means the bug is ours, and
 * it is much better to learn that here than from someone else after sending them a claim.
 *
 * METHOD, identical in both:
 *   - one wallet, one destination (itself), so the only variable between trials is payload size;
 *   - sizes ALTERNATE, so a busy half-hour cannot masquerade as a size effect;
 *   - ONE broadcast per trial, to ONE endpoint, never re-sent — re-sending is what the app does and precisely
 *     what hides this;
 *   - the verdict is the wallet's own seqno, which advances if and only if the external executed;
 *   - seqno is polled every 250ms for the first 15s and every 3s after that, so a fast landing is measured
 *     rather than rounded up to the tick, without firing hundreds of reads at a trial that will time out;
 *   - valid_until is held short, so a lost external is provably dead and frees the seqno for the next trial.
 *
 * COSTS REAL MONEY on mainnet. Use a throwaway wallet.
 *
 *   node scripts/external_size_probe_official_sdk.mjs --dryRun          # builds only, sends nothing, costs nothing
 *   node scripts/external_size_probe_official_sdk.mjs --trials 50 --validFor 180
 *
 * The mnemonic is read from a file (--wallet, default artifacts/local/probe-wallet.txt) and never from the
 * command line, since arguments land in shell history. The API key is asked for at startup if the
 * environment, --key and that file do not supply one.
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

const TRIALS = Number(arg('trials', 50));
const SMALL = Number(arg('small', 1024));
const LARGE = Number(arg('large', 60000));
const VALID_FOR_S = Number(arg('validFor', 180));
// TWO-SPEED POLLING. A flat 3s tick put a floor under every latency it measured: small externals all reported
// 3.2-3.4s, which is the tick, not the network. A flat 250ms tick would instead fire ~700 reads at every trial that
// runs the full window, and a rate-limited read is exactly the confound this probe must not have. So: fine while an
// answer is plausible, coarse afterwards.
const FINE_MS = Number(arg('fineMs', 250));
const FINE_WINDOW_MS = Number(arg('fineForMs', 15000));
const COARSE_MS = Number(arg('coarseMs', 3000));
const pollDelay = (elapsedMs) => {
  const fine = apiKey ? FINE_MS : Math.max(FINE_MS, 1200);   // keyless toncenter is ~1 rps
  const coarse = apiKey ? COARSE_MS : Math.max(COARSE_MS, 3000);
  return elapsedMs < FINE_WINDOW_MS ? fine : coarse;
};
const MNEMONIC_FILE = arg('wallet', `${ROOT}/artifacts/local/probe-wallet.txt`);
const OUT = arg('out', `${ROOT}/artifacts/local/external-size-probe-sdk.csv`);
const ENDPOINT = 'https://toncenter.com/api/v3';
const DRY = has('dryRun');


/**
 * The TON Center key, in order of preference. It is ASKED FOR if nothing supplies it, so this file can be handed to
 * someone else and run as-is: a path into another project's local artifacts means nothing to a stranger.
 *
 * Without a key the anonymous endpoint allows roughly one request per second, and the fine polling below would
 * spend the run collecting rate-limit errors instead of latencies — so a keyless run slows itself down and says so.
 */
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
    'TON Center API key (free from @toncenter in Telegram), or Enter to run keyless: ')).trim();
  rl.close();
  return answer || null;
}
const apiKey = DRY ? null : await resolveApiKey();
if (!apiKey && !DRY) {
  console.error('running WITHOUT a key: the anonymous endpoint is ~1 rps, so polling is slowed to match.');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(path, init) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;
  const res = await fetch(`${ENDPOINT}${path}`, { ...init, headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep the raw text for the error message */ }
  return { status: res.status, ok: res.ok, json, text };
}

if (!existsSync(MNEMONIC_FILE) && !DRY) {
  console.error(`No wallet file at ${MNEMONIC_FILE}. Put the 24 words of a THROWAWAY funded wallet there.`);
  process.exit(1);
}

const words = existsSync(MNEMONIC_FILE)
  ? readFileSync(MNEMONIC_FILE, 'utf8').trim().split(/\s+/)
  : null;
const keyPair = words
  ? await mnemonicToPrivateKey(words)
  : await mnemonicToPrivateKey('abandon '.repeat(23).split(' ').slice(0, 23).concat(['art']));
const wallet = WalletContractV5R1.create({ workchain: 0, publicKey: keyPair.publicKey });
console.error(`wallet: ${wallet.address.toRawString()}`);
console.error(`        ${wallet.address.toString({ bounceable: false, urlSafe: true })}`);

/** A payload cell of exactly `bytes` bytes, as a snake chain — the one thing that differs between trials. */
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

/** The signed external, exactly as the SDK serializes it — nothing of ours touches these bytes. */
function buildExternal(seqno, size) {
  const body = wallet.createTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    timeout: Math.floor(Date.now() / 1000) + VALID_FOR_S,
    messages: [internal({
      to: wallet.address,
      value: 1n,                                // one nanoton to self: the fee is the cost, not the transfer
      bounce: false,
      body: payloadCell(size),
    })],
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
  console.log('\ndry run: nothing was signed against a real seqno and nothing was sent.');
  process.exit(0);
}

async function readSeqno() {
  const r = await rpc('/runGetMethod', {
    method: 'POST',
    body: JSON.stringify({ address: wallet.address.toRawString(), method: 'seqno', stack: [] }),
  });
  if (!r.ok) throw new Error(`seqno: HTTP ${r.status}`);
  const exit = Number(r.json?.exit_code ?? 0);
  // An account with no code aborts the get-method with -13 and leaves GARBAGE on the stack; a reader that trusts
  // stack[0] here signs against nonsense and every external afterwards is refused. A fresh probe wallet is uninit
  // by definition, so this is the normal first case, not an edge one.
  if (exit === -13 || exit === -256) return 0;
  if (exit !== 0) throw new Error(`seqno: exit ${exit}`);
  const first = r.json?.stack?.[0];
  const raw = Array.isArray(first) ? first[1] : (first?.value ?? first);
  return Number(BigInt(raw ?? 0));
}

writeFileSync(OUT, 'trial,payload_bytes,external_bytes,post_status,landed,latency_ms,read_errors\n', 'utf8');
const rows = [];
const half = Math.floor(TRIALS / 2);
const plan = [];
for (let i = 0; i < half; i += 1) { plan.push(SMALL); plan.push(LARGE); }
console.error(`plan: ${plan.length} trials, alternating ${SMALL}B / ${LARGE}B, valid_until +${VALID_FOR_S}s\n`);

for (let i = 0; i < plan.length; i += 1) {
  const size = plan[i];
  let before;
  try { before = await readSeqno(); }
  catch (error) { console.error(`[${i}] seqno read failed: ${error.message}`); await sleep(3000); continue; }

  const built = buildExternal(before, size);
  const deadline = Date.now() + VALID_FOR_S * 1000 + 5000;
  const sentAt = Date.now();
  const posted = await rpc('/message', { method: 'POST', body: JSON.stringify({ boc: built.boc }) });
  if (posted.status >= 400) {
    console.error(`[${i}] POST ${posted.status} — the endpoint refused the external, this trial measures nothing: `
      + `${String(posted.text).slice(0, 160)}`);
    process.exit(1);
  }

  let landed = false;
  let latencyMs = null;
  let readErrors = 0;                 // recorded so "we were not allowed to look" is visible in the data
  while (Date.now() < deadline) {
    await sleep(pollDelay(Date.now() - sentAt));
    try {
      const now = await readSeqno();
      if (now > before) { landed = true; latencyMs = Date.now() - sentAt; break; }
    } catch { readErrors += 1; }
  }
  // ABSENCE MUST BE PROVEN. Before recording a loss, confirm with fresh reads: a run of failed reads at the end of
  // the window would otherwise be written down as a lost message.
  if (!landed) {
    for (let attempt = 0; attempt < 4 && !landed; attempt += 1) {
      await sleep(2000);
      try {
        const now = await readSeqno();
        if (now > before) { landed = true; latencyMs = Date.now() - sentAt; }
      } catch { readErrors += 1; }
    }
  }

  const row = { i, size, externalBytes: built.bytes, postStatus: posted.status, landed, latencyMs, readErrors };
  rows.push(row);
  appendFileSync(OUT, `${row.i},${row.size},${row.externalBytes},${row.postStatus},${row.landed},`
    + `${row.latencyMs ?? ''},${row.readErrors}\n`, 'utf8');
  console.error(`[${String(i).padStart(3)}] ${String(built.bytes).padStart(6)}B  POST ${posted.status}  `
    + `${landed ? `landed in ${(latencyMs / 1000).toFixed(1)}s` : 'NEVER LANDED'}`
    + `${readErrors ? `  (${readErrors} read errors)` : ''}`);

  if (!landed) {
    const waitMs = deadline - Date.now();
    if (waitMs > 0) await sleep(waitMs);
  }
}

const group = (size) => rows.filter((r) => r.size === size);
const report = (label, set) => {
  const ok = set.filter((r) => r.landed);
  const lat = ok.map((r) => r.latencyMs).sort((a, b) => a - b);
  const median = lat.length ? lat[Math.floor(lat.length / 2)] / 1000 : null;
  console.log(`${label.padEnd(10)} sent ${String(set.length).padStart(3)}  landed ${String(ok.length).padStart(3)}`
    + `  lost ${String(set.length - ok.length).padStart(3)}`
    + `  (${set.length ? Math.round((1 - ok.length / set.length) * 100) : 0}% lost)`
    + `  median ${median === null ? '—' : `${median.toFixed(1)}s`}`
    + `  read errors ${set.reduce((n, r) => n + r.readErrors, 0)}`);
};
console.log('');
report(`${SMALL}B`, group(SMALL));
report(`${LARGE}B`, group(LARGE));
console.log(`\ncsv: ${OUT}`);
