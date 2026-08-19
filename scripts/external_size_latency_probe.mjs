#!/usr/bin/env node
/*
 * Does the SIZE of an external message change whether it reaches a block?
 *
 * The owner's operational read, across a large number of real sends: small text externals land first time, large
 * ones often never confirm. The app can no longer answer this — it re-broadcasts through three doors and the effect
 * is exactly what that machinery hides. And the one measurement in the codebase argues the other way (inclusion at
 * 2-5s, failures being drops rather than delays), so the two accounts disagree and neither is a controlled test.
 *
 * This is the controlled test. One wallet, one destination, ONE broadcast per attempt through ONE door, no
 * re-sending, nothing from Platho's lanes. The only thing that varies between trials is the payload size, and the
 * trials alternate so "the network was busy that hour" cannot masquerade as a size effect.
 *
 * VERDICT PER TRIAL is the wallet's own seqno: it advances if and only if the external executed. valid_until is
 * held short so a lost external is provably dead quickly and the seqno is free for the next trial — waiting out the
 * default 300s would make the run five times longer for no extra truth.
 *
 * COSTS REAL MONEY on mainnet: each trial spends a wallet transfer's fee. 100 trials is roughly 1.5-4 GRAM. Use a
 * throwaway wallet.
 *
 *   node scripts/external_size_latency_probe.mjs --trials 100 --small 1024 --large 60000
 *
 * The mnemonic is read from a file (artifacts/local/probe-wallet.txt by default), never from the command line —
 * arguments end up in shell history and process listings.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = `file:///${ROOT.replace(/\\/g, '/')}/web`;

const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const TRIALS = Number(arg('trials', 100));            // total, split evenly between the two sizes
const SMALL = Number(arg('small', 1024));
const LARGE = Number(arg('large', 60000));
const VALID_FOR_S = Number(arg('validFor', 60));      // how long a trial's external may still land
const MNEMONIC_FILE = arg('wallet', `${ROOT}/artifacts/local/probe-wallet.txt`);
const OUT = arg('out', `${ROOT}/artifacts/local/external-size-probe.csv`);
const ENDPOINT = 'https://toncenter.com/api/v3';

const KEY_FILE = `${ROOT}/artifacts/local/center.txt`;
const apiKey = (process.env.TONCENTER_API_KEY
  ?? (existsSync(KEY_FILE) ? readFileSync(KEY_FILE, 'utf8') : '')).trim() || null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(path, init) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;
  const res = await fetch(`${ENDPOINT}${path}`, { ...init, headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep the raw text for the error */ }
  return { status: res.status, ok: res.ok, json, text };
}

const { importPlathoWallet, buildPlathoWalletExternalBoc, getPlathoWalletSeqno } =
  await import(`${WEB}/platho-wallet.mjs`);
const { snakeCellFromBytes, serializeBoc, tonCell } = await import(`${WEB}/pwa-contract-transactions.mjs`);

if (!existsSync(MNEMONIC_FILE)) {
  console.error(`No wallet file at ${MNEMONIC_FILE}.\nPut the 24 words of a THROWAWAY funded wallet there.`);
  process.exit(1);
}
const wallet = await importPlathoWallet(readFileSync(MNEMONIC_FILE, 'utf8').trim());
console.error(`wallet: ${wallet.address}`);

// A get-method transport with no caching: a seqno read that returns a stale value would report a landing that did
// not happen, which is the one error this probe cannot survive.
const transport = {
  runGetMethod: async (call) => {
    const r = await rpc('/runGetMethod', {
      method: 'POST',
      body: JSON.stringify({ address: call.address, method: call.method, stack: call.stack ?? [] }),
    });
    if (!r.ok) throw new Error(`runGetMethod ${call.method}: HTTP ${r.status}`);
    // AN UNINIT ACCOUNT ANSWERS 200 WITH exit_code -13 AND GARBAGE ON THE STACK, and the seqno parser does not
    // look at exit codes — it reads stack[0] and believes it. A fresh probe wallet is uninit by definition, so
    // without this the first trial signs against a nonsense seqno and every external after it is refused, silently,
    // for the whole run. This is the same guard the operator console carries; it cost a real send to learn once.
    const exit = Number(r.json?.exit_code ?? 0);
    if (exit !== 0) {
      if (call.method === 'seqno' && (exit === -13 || exit === -256)) return { ...r.json, stack: [['num', '0x0']] };
      throw new Error(`runGetMethod ${call.method}: exit ${exit}`);
    }
    return r.json;
  },
};

/** A self-transfer whose comment payload is exactly `bytes` long — the only thing that differs between trials. */
function trialMessage(bytes) {
  const payload = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i += 1) payload[i] = 65 + (i % 26);
  return {
    address: wallet.address,
    amount: '1',                    // one nanoton to self: the fee is the cost, not the transfer
    payload: tonCell.bytesToBase64(serializeBoc(snakeCellFromBytes(payload, 'probe payload'))),
    bounce: false,
  };
}

const rows = [];
// APPEND AS WE GO. The first run was stopped part-way and everything it had learned went with it, because
// the CSV was written only at the end. A trial costs money and a minute; losing one to a Ctrl+C is not
// acceptable.
writeFileSync(OUT, 'trial,payload_bytes,external_bytes,post_status,landed,latency_ms' + String.fromCharCode(10), 'utf8');
const appendRow = (r) => appendFileSync(OUT,
  [r.i, r.size, r.externalBytes, r.postStatus, r.landed, r.latencyMs ?? ''].join(',') + String.fromCharCode(10), 'utf8');
const half = Math.floor(TRIALS / 2);
const plan = [];
for (let i = 0; i < half; i += 1) { plan.push(SMALL); plan.push(LARGE); }   // alternating, never blocked

console.error(`plan: ${plan.length} trials, alternating ${SMALL}B / ${LARGE}B, valid_until +${VALID_FOR_S}s\n`);

for (let i = 0; i < plan.length; i += 1) {
  const size = plan[i];
  let before;
  try { before = await getPlathoWalletSeqno(wallet, transport); }
  catch (error) { console.error(`[${i}] seqno read failed: ${error.message}`); await sleep(3000); continue; }

  const validUntil = Math.floor(Date.now() / 1000) + VALID_FOR_S;
  let boc;
  try {
    // The builder returns { boc, seqno, wallet } — NOT the base64 string. Reading it as a string posted
    // `undefined` and toncenter answered 422 on every trial, which looked exactly like a lost external.
    ({ boc } = await buildPlathoWalletExternalBoc(wallet, [trialMessage(size)], {
      seqno: before, transport, timeout: validUntil,
    }));
    if (typeof boc !== 'string' || !boc) throw new Error('builder returned no boc string');
  } catch (error) { console.error(`[${i}] build failed at ${size}B: ${error.message}`); continue; }

  const externalBytes = Math.ceil((boc.length * 3) / 4);
  const sentAt = Date.now();
  // ONE POST, one door, no retry. Retrying here would measure the retry, which is precisely what the app already
  // does and precisely why the app cannot answer this question.
  const posted = await rpc('/message', { method: 'POST', body: JSON.stringify({ boc }) });
  if (posted.status >= 400) {
    console.error(`[${i}] POST ${posted.status} — the endpoint refused the external, this trial measures nothing: `
      + `${String(posted.text).slice(0, 160)}`);
    process.exit(1);   // stop at once rather than log a hundred meaningless rows
  }

  let landed = false;
  let latencyMs = null;
  while (Date.now() < validUntil * 1000 + 5000) {
    await sleep(3000);
    let now;
    try { now = await getPlathoWalletSeqno(wallet, transport); } catch { continue; }
    if (now > before) { landed = true; latencyMs = Date.now() - sentAt; break; }
  }

  const row = { i, size, externalBytes, postStatus: posted.status, landed, latencyMs };
  rows.push(row);
  appendRow(row);
  console.error(`[${String(i).padStart(3)}] ${String(externalBytes).padStart(6)}B  POST ${posted.status}  `
    + `${landed ? `landed in ${(latencyMs / 1000).toFixed(1)}s` : 'NEVER LANDED'}`);

  // A lost external still owns its seqno until valid_until passes; starting the next trial early would sign a
  // second external against a slot a live copy can still take.
  if (!landed) {
    const waitMs = validUntil * 1000 + 2000 - Date.now();
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
    + `  median ${median === null ? '—' : `${median.toFixed(1)}s`}`);
};
console.log('');
report(`${SMALL}B`, group(SMALL));
report(`${LARGE}B`, group(LARGE));
console.log(`\ncsv: ${OUT}`);
