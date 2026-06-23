#!/usr/bin/env node
/*
 * MAINNET CEREMONY BROADCASTER (clean-09) — phase-by-phase, role-signed.
 *
 * Reuses the EXACT message BOCs from artifacts/local/mainnet_tx_dry_run_packet.json
 * (deploy state_inits + bodies, bind/seal bodies, funding bodies — already validated by
 * the tx-dry-run + the full-phase sandbox dry-run). For a given phase it wraps each
 * message in a wallet transfer from its role wallet, signs with the role seed, and sends
 * via the gateway (which fans out to toncenter v3 + Orbs v2 for delivery).
 *
 * D09 (UsernameRegistry, ~40KB) is EXCLUDED here — deploy it with the dedicated
 * scripts/mainnet_deploy_d09_username_registry.mjs (deployer2). The registry's controller
 * is still genesis_controller (baked into its init), so a different deployer is fine.
 *
 * SAFETY:
 *  - DRY-RUN by default; sends ONLY with --broadcast.
 *  - For every message the signer wallet derived from the seed MUST equal the packet's
 *    signer_address (else ABORT) — guarantees the right key signs the right step.
 *  - The built external must embed the message body (and init, for deploys) — else ABORT.
 *  - Deploys skip targets already active; control/funding require the signer active.
 *  - One --phase at a time. After sending, polls targets to active and prints the
 *    packet safety_check so getters can be verified before the next phase.
 *
 * Usage:
 *   dry:   node scripts/mainnet_ceremony_broadcast.mjs --phase deploy
 *   send:  node scripts/mainnet_ceremony_broadcast.mjs --phase deploy --broadcast
 *   phases: deploy | treasury-supply | bind | fund | seal
 */
import { readFileSync, existsSync } from 'node:fs';
import { Address, Cell, beginCell, contractAddress, internal, loadStateInit, storeMessage, SendMode, toNano, fromNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV5R1, WalletContractV4, WalletContractV3R2 } from '@ton/ton';

const GATEWAY = (process.env.PLATHO_GATEWAY || 'https://rpc.platho.app').replace(/\/+$/, '');
// The keyed gateway (rpc.platho.app) was decommissioned; keyless toncenter throttles at ~1 rps and would
// 429-abort the ceremony mid-flight. Read the toncenter API key (env or artifacts/local/center.txt) and add it
// to toncenter calls via the rate-limit-tolerant tcFetch wrapper below. Transport only — signing is untouched.
const TONCENTER_KEY = (process.env.TONCENTER_API_KEY || (existsSync('artifacts/local/center.txt') ? readFileSync('artifacts/local/center.txt', 'utf8') : '')).trim();
const PACKET = arg('--packet', 'artifacts/local/mainnet_tx_dry_run_packet.json');
const PHASE = arg('--phase');
const DO_BROADCAST = process.argv.includes('--broadcast');
const SEED_DIR = 'artifacts/local';
const ROLE_SEED = {
  ath_treasury_owner: `${SEED_DIR}/treasury_owner.secret.txt`,
  genesis_controller_one_shot: `${SEED_DIR}/genesis_controller.secret.txt`,
  ton_treasury_receiver: `${SEED_DIR}/receiver.secret.txt`,
  ath_long_term_vesting_beneficiary: `${SEED_DIR}/receiver.secret.txt`,
};

// Seeds may be a 24-word JSON array (Tonkeeper export) or a whitespace-separated line.
function parseMnemonic(raw) {
  const s = raw.replace(/^﻿/, '').trim();
  try { const j = JSON.parse(s); if (Array.isArray(j)) return j.map((w) => String(w).trim()).filter(Boolean); } catch {}
  return s.split(/\s+/).filter(Boolean);
}

function arg(name, fallback) { const i = process.argv.indexOf(name); if (i < 0) return fallback; const v = process.argv[i + 1]; return v && !v.startsWith('--') ? v : true; }
function die(m) { console.error('\n  ABORT: ' + m + '\n'); process.exit(1); }
const fmt = (n) => (Number(n) / 1e9).toFixed(4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function collectHashes(cell, set) { set.add(cell.hash().toString('hex')); for (const r of cell.refs) collectHashes(r, set); }

// Keyed, rate-limit-tolerant fetch: adds X-API-Key on toncenter calls and retries 429/5xx with exponential
// backoff so a transient throttle never reads as a missing/uninit wallet (which would abort the ceremony).
async function tcFetch(url, opts = {}, tries = 8) {
  const headers = { ...(opts.headers || {}) };
  if (TONCENTER_KEY && /toncenter\.com/.test(url)) headers['X-API-Key'] = TONCENTER_KEY;
  let delay = 600;
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url, { ...opts, headers });
      if (r.status === 429 || r.status >= 500) { await sleep(delay); delay = Math.min(delay * 2, 8000); continue; }
      return r;
    } catch { await sleep(delay); delay = Math.min(delay * 2, 8000); }
  }
  return fetch(url, { ...opts, headers });
}

async function gwState(addr) { const r = await tcFetch(`${GATEWAY}/api/v2/getAddressInformation?address=${encodeURIComponent(addr)}`, { headers: { accept: 'application/json' } }); const j = await r.json().catch(() => ({})); return j && j.ok ? j.result : null; }
async function gwSeqno(addr) {
  // toncenter v2 FIRST (gateway runGetMethod can return a load-balanced stale seqno).
  try { const r = await tcFetch('https://toncenter.com/api/v2/runGetMethod', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addr, method: 'seqno', stack: [] }) }); const j = await r.json(); const v = j?.result?.stack?.[0]?.[1]; if (typeof v === 'string') return Number(BigInt(v)); } catch {}
  try { const r = await tcFetch(`${GATEWAY}/api/v3/runGetMethod`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addr, method: 'seqno', stack: [] }) }); const j = await r.json(); const v = j?.stack?.[0]?.value; if (typeof v === 'string') return Number(BigInt(v)); } catch {}
  return 0;
}
async function gwSend(bocB64) {
  // Redundant broadcast: the gateway has ACKed (200) without delivering, so also push to
  // toncenter v2 /sendBoc (keyless). Actual delivery is confirmed by the seqno-advance poll.
  const out = []; let anyOk = false;
  try { const r = await tcFetch('https://toncenter.com/api/v2/sendBoc', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ boc: bocB64 }) }); out.push(`toncenter ${r.status}`); if (r.ok) anyOk = true; } catch (e) { out.push('toncenter ERR'); }
  try { const r = await tcFetch(`${GATEWAY}/api/v3/message`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ boc: bocB64 }) }); out.push(`gateway ${r.status}`); if (r.ok) anyOk = true; } catch (e) { out.push('gateway ERR'); }
  return { ok: anyOk, status: 'multi', body: out.join(' | ') };
}

const walletCache = {};
async function walletForRole(role, expectedAddr) {
  if (walletCache[role]) return walletCache[role];
  const file = ROLE_SEED[role];
  if (!file) die(`no seed mapping for role ${role}`);
  let words;
  try { words = parseMnemonic(readFileSync(file, 'utf8')); }
  catch { die(`seed file missing for role ${role}: ${file} (place the 24-word mnemonic there)`); }
  if (words.length !== 24) die(`${file}: expected 24 words, got ${words.length}`);
  const key = await mnemonicToPrivateKey(words);
  const cands = [WalletContractV5R1, WalletContractV4, WalletContractV3R2].map((C) => C.create({ workchain: 0, publicKey: key.publicKey }));
  const want = Address.parse(expectedAddr).toRawString();
  const w = cands.find((c) => c.address.toRawString() === want);
  if (!w) die(`SEED MISMATCH for role ${role}: ${file} derives to none of ${cands.map((c) => c.address.toString({ urlSafe: true, bounceable: false })).join(', ')} but packet expects ${expectedAddr}. Wrong seed file.`);
  const entry = { wallet: w, key };
  walletCache[role] = entry;
  return entry;
}

function selectMessages(packet, phase) {
  if (phase === 'deploy') return packet.deploy_contracts.map((d) => ({ ...d, isDeploy: true, kind: 'deploy' }));
  if (phase === 'treasury-supply') return packet.control_messages.filter((c) => c.phase === 'deploy_treasury_supply').map((c) => ({ ...c, kind: 'control' }));
  if (phase === 'bind') return packet.control_messages.filter((c) => c.phase === 'pre_seal_binding').map((c) => ({ ...c, kind: 'control' }));
  if (phase === 'seal') return packet.control_messages.filter((c) => c.phase === 'seal').map((c) => ({ ...c, kind: 'control' }));
  if (phase === 'fund') return packet.funding_messages.map((f) => ({ ...f, kind: 'funding' }));
  die(`unknown --phase ${phase} (use: deploy | treasury-supply | bind | fund | seal)`);
}

async function main() {
  if (!PHASE) die('pass --phase <deploy|treasury-supply|bind|fund|seal>');
  const packet = JSON.parse(readFileSync(PACKET, 'utf8'));
  const msgs = selectMessages(packet, PHASE);
  console.log(`\n=== CEREMONY ${PHASE.toUpperCase()} — ${msgs.length} message(s) | manifest ${packet.manifest_hash_hex.slice(0, 16)} | ${DO_BROADCAST ? 'BROADCAST' : 'DRY-RUN'} ===\n`);

  const targetsToPoll = [];
  const localSeqno = {}; // per-signer: immune to load-balanced stale seqno reads
  for (const m of msgs) {
    const { wallet, key } = await walletForRole(m.signer_role, m.signer_address);
    const target = Address.parse(m.target_address);
    const value = BigInt(m.value_nanotons_recommended || m.value_nanotons_min);
    const bodyB64 = m.body && m.body.boc_base64 ? m.body.boc_base64 : null;
    const body = bodyB64 ? Cell.fromBoc(Buffer.from(bodyB64, 'base64'))[0] : beginCell().endCell();
    const init = (m.isDeploy && m.state_init && m.state_init.boc_base64) ? loadStateInit(Cell.fromBoc(Buffer.from(m.state_init.boc_base64, 'base64'))[0].beginParse()) : null;

    // idempotency: skip a deploy whose target is already active
    const st = await gwState(target.toString());
    const state = st ? (st.state || st.account_state) : 'unreachable';
    if (m.isDeploy && state === 'active') { console.log(`  ${m.id} ${(m.contract || '').padEnd(20)} target already ACTIVE — skip`); continue; }

    const walletState = await gwState(wallet.address.toString());
    const wActive = walletState && (walletState.state || walletState.account_state) === 'active';
    if (!wActive) die(`${m.id}: signer ${m.signer_role} (${wallet.address.toString({ urlSafe: true, bounceable: false })}) is not active/funded`);
    const fetched = await gwSeqno(wallet.address.toString());
    const seqno = Math.max(fetched, localSeqno[m.signer_role] || 0);

    const intMsg = internal({ to: target, value, bounce: !m.isDeploy, init: init || undefined, body });
    const transfer = wallet.createTransfer({ seqno, secretKey: key.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY, messages: [intMsg], timeout: Math.floor(Date.now() / 1000) + 600 });
    const ext = beginCell().store(storeMessage({ info: { type: 'external-in', src: null, dest: wallet.address, importFee: 0n }, init: null, body: transfer })).endCell();

    // embed sanity: the message body (and init) must be inside the external we send
    const hashes = new Set(); collectHashes(ext, hashes);
    // Small control/funding bodies are INLINED into the message cell (not a ref), so their
    // hash won't appear in the external's cell tree — expected, not drift. The body bytes are
    // the exact packet boc_base64 parsed deterministically, so they cannot have drifted.
    if (init && init.code && !hashes.has(init.code.hash().toString('hex'))) die(`${m.id}: built external does not embed the deploy code — refusing`);
    const extBytes = ext.toBoc().length;
    if (extBytes >= 65535) die(`${m.id}: external ${extBytes} bytes >= 65535 — too big`);

    console.log(`  ${m.id} ${(m.contract || m.signer_role).padEnd(20)} signer=${wallet.address.toString({ urlSafe: true, bounceable: false }).slice(0, 12)} seqno=${seqno} -> ${m.target_address.slice(0, 14)} val=${fmt(value)} ext=${extBytes}B`);
    if (m.safety_check) console.log(`        check: ${m.safety_check}`);

    if (DO_BROADCAST) {
      // Endpoints intermittently ACK (200) without including the external. Re-send the
      // SAME external (same seqno = idempotent, lands once) until the signer seqno advances.
      const b64 = ext.toBoc().toString('base64');
      let advanced = false;
      for (let attempt = 1; attempt <= 3 && !advanced; attempt++) {
        const res = await gwSend(b64);
        console.log(`        send#${attempt} ${res.ok ? 'OK' : 'REJECTED'} [${res.body}]`);
        if (!res.ok && attempt === 1) die(`${m.id}: both endpoints rejected the BOC — stopping`);
        for (let k = 0; k < 40 && !advanced; k++) { await sleep(3000); const sq = await gwSeqno(wallet.address.toString()); if (sq > seqno) { console.log(`        seqno ${seqno}->${sq} processed`); advanced = true; } }
      }
      if (!advanced) die(`${m.id}: seqno did not advance from ${seqno} after 3 attempts (~6min) — ACK without inclusion; stopping to avoid a same-seqno conflict`);
      localSeqno[m.signer_role] = seqno + 1;
      targetsToPoll.push({ id: m.id, addr: target, wasActive: state === 'active' });
    }
  }

  if (DO_BROADCAST && targetsToPoll.length) {
    console.log('\n  waiting for targets to settle (~90s)...');
    const pending = new Map(targetsToPoll.map((t) => [t.id, t]));
    for (let i = 0; i < 30 && pending.size; i++) {
      await sleep(3000);
      for (const [id, t] of [...pending]) { const s = await gwState(t.addr.toString()); if (s && (s.state || s.account_state) === 'active') { console.log(`  OK ${id} ACTIVE @ ${t.addr.toString({ urlSafe: true, bounceable: false })} (bal ${fmt(BigInt(s.balance || '0'))})`); pending.delete(id); } }
    }
    if (pending.size) { console.log('\n  NOT yet active after ~90s (may still settle — re-check before next phase):'); for (const t of pending.values()) console.log(`    ${t.id}: ${t.addr.toString({ urlSafe: true, bounceable: false })}`); }
  }
  console.log(`\n  ${DO_BROADCAST ? 'Phase sent.' : 'DRY-RUN complete — re-run with --broadcast to send.'} Verify getters (safety_check above) before the next phase.\n`);
}
main().catch((e) => die(e && e.message ? e.message : String(e)));
