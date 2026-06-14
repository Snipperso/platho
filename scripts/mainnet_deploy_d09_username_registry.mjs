#!/usr/bin/env node
/*
 * ONE-OFF GENESIS CEREMONY TOOL — deploy step D09 (UsernameRegistry) only, via the Platho gateway.
 *
 * Why: UsernameRegistry's stateInit is ~56 KB (on-chain SVG NFT art). As a TonConnect message that is ~75 KB
 * base64, which exceeds the TonConnect bridge limit, so the Tonkeeper console hangs forever on D09. The
 * contract is valid on-chain (the deploy external is ~56.5 KB < the 65535-byte network limit); only the
 * TonConnect transport can't carry it. This tool deploys exactly that one step directly.
 *
 * Transport: routes through the Platho gateway (rpc.platho.app), which exposes a curated allowlist
 * (/api/v2/getAddressInformation for balance, /api/v3/message for sending). The toncenter key lives on the
 * gateway, so no API key is handled locally. The signed external message is built OFFLINE.
 *
 * SAFETY:
 *  - Uses the CANONICAL stateInit straight from the dry-run packet and refuses to act unless it hashes to the
 *    packet cell hash AND derives to the packet target (UQBFGzBR...).
 *  - After building the external BOC, it walks the cell tree and refuses unless the verified stateInit cell is
 *    actually embedded — so it can only ever deploy that exact contract to that exact address.
 *  - Auto-detects which wallet version (v5r1/v4r2/v3r2) actually holds the deploy funds.
 *  - DRY-RUN by default; sends ONLY with --broadcast. Mnemonic read from a file (--mnemonic-file), never logged.
 *
 * Usage:
 *   dry run:    node scripts/mainnet_deploy_d09_username_registry.mjs --mnemonic-file artifacts/local/deployer.secret
 *   broadcast:  node scripts/mainnet_deploy_d09_username_registry.mjs --mnemonic-file artifacts/local/deployer.secret --broadcast
 */
import { readFileSync } from 'node:fs';
import { Address, Cell, beginCell, contractAddress, internal, loadStateInit, storeMessage, SendMode } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import * as TonLib from '@ton/ton';

const PACKET_PATH = 'artifacts/local/mainnet_tx_dry_run_packet.json';
const STEP_ID = 'D09';
const EXPECTED_CONTRACT = 'UsernameRegistry';
const GATEWAY = (process.env.PLATHO_GATEWAY || 'https://rpc.platho.app').replace(/\/+$/, '');

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
function die(m) { console.error('\n  ABORT: ' + m + '\n'); process.exit(1); }
const fmtTon = (n) => (Number(n) / 1e9).toFixed(4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gwGetState(addr) {
  const r = await fetch(`${GATEWAY}/api/v2/getAddressInformation?address=${encodeURIComponent(addr)}`, { headers: { accept: 'application/json' } });
  const j = await r.json().catch(() => ({}));
  if (!j || j.ok !== true) throw new Error(`getAddressInformation(${addr}): ${j && j.error ? j.error : 'HTTP ' + r.status}`);
  return j.result;
}
async function gwSendBoc(bocB64) {
  const r = await fetch(`${GATEWAY}/api/v3/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ boc: bocB64 }),
  });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 400) }; }
  return { httpStatus: r.status, ok: r.ok, body };
}
function collectCellHashes(cell, set) { set.add(cell.hash().toString('hex')); for (const ref of cell.refs) collectCellHashes(ref, set); }

async function main() {
  const mnemonicFile = arg('--mnemonic-file');
  const doBroadcast = process.argv.includes('--broadcast');
  if (!mnemonicFile || mnemonicFile === true) die('pass --mnemonic-file <path> (a gitignored file with the 24 words on one line)');

  // 1) Load the canonical D09 step.
  const packet = JSON.parse(readFileSync(PACKET_PATH, 'utf8'));
  const step = (packet.deploy_contracts || []).find((s) => s.id === STEP_ID);
  if (!step) die(`${STEP_ID} not found in ${PACKET_PATH}`);
  if (step.contract !== EXPECTED_CONTRACT) die(`${STEP_ID} is ${step.contract}, expected ${EXPECTED_CONTRACT}`);
  if (step.signer_role !== 'genesis_controller_one_shot') die(`${STEP_ID} signer_role is ${step.signer_role}`);
  if (step.body && step.body.boc_base64) die('D09 unexpectedly has a body; this tool only deploys a bodyless stateInit.');
  const target = Address.parse(step.target_address);
  const value = BigInt(step.value_nanotons_recommended);
  const stateInitCell = Cell.fromBase64(step.state_init.boc_base64);

  // 2) HARD CHECK: canonical stateInit -> packet cell hash AND target address.
  const cellHashHex = stateInitCell.hash().toString('hex');
  if (cellHashHex !== step.state_init.cell_hash_hex) die(`stateInit cell hash ${cellHashHex} != packet ${step.state_init.cell_hash_hex}`);
  const si = loadStateInit(stateInitCell.beginParse());
  if (!contractAddress(0, { code: si.code, data: si.data }).equals(target)) die('stateInit does not derive to the packet target address');

  // 3) Key -> detect the funded deployer wallet version via the gateway (allowed v2 route).
  const words = readFileSync(mnemonicFile, 'utf8').trim().split(/\s+/).filter(Boolean);
  if (words.length !== 24) die(`mnemonic file must contain 24 words (got ${words.length})`);
  const key = await mnemonicToPrivateKey(words);
  const factories = [['v5r1', TonLib.WalletContractV5R1], ['v4r2', TonLib.WalletContractV4], ['v3r2', TonLib.WalletContractV3R2]].filter(([, C]) => C && typeof C.create === 'function');
  const cands = [];
  for (const [name, C] of factories) {
    let w; try { w = C.create({ workchain: 0, publicKey: key.publicKey }); } catch { continue; }
    let st = null; try { st = await gwGetState(w.address.toString()); } catch { /* unreachable */ }
    cands.push({ name, w, balance: st ? BigInt(st.balance || '0') : 0n, state: st ? (st.state || st.account_state || 'unknown') : 'unreachable' });
    await sleep(250);
  }
  const need = value + 60_000_000n;
  const chosen = [...cands].sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0)).find((c) => c.balance >= need);
  if (!chosen) die(`no derived wallet holds enough to deploy (need ~${fmtTon(need)} TON). Fund the deployer first.\n         checked:\n         ${cands.map((c) => `${c.name} ${fmtTon(c.balance)}TON ${c.state} @ ${c.w.address.toString({ urlSafe: true, bounceable: false })}`).join('\n         ')}`);
  const wallet = chosen.w;
  const notDeployed = chosen.state !== 'active';

  // 4) seqno: 0 if the wallet is not deployed yet (the first transfer deploys it); else read via gateway v3.
  let seqno = 0;
  if (!notDeployed) {
    try {
      const r = await fetch(`${GATEWAY}/api/v3/runGetMethod`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: wallet.address.toString(), method: 'seqno', stack: [] }) });
      const j = await r.json();
      const raw = j?.stack?.[0]?.value ?? j?.result?.stack?.[0]?.[1] ?? '0';
      seqno = Number(BigInt(raw));
    } catch (e) { die('could not read seqno of the already-deployed deployer via the gateway: ' + e.message); }
  }

  // 5) Build the signed external message OFFLINE.
  const deployInternal = internal({ to: target, value, bounce: false, init: { code: si.code, data: si.data }, body: beginCell().endCell() });
  const transferBody = wallet.createTransfer({ seqno, secretKey: key.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY, messages: [deployInternal] });
  const extBoc = beginCell().store(storeMessage({
    info: { type: 'external-in', src: null, dest: wallet.address, importFee: 0n },
    init: notDeployed ? wallet.init : null,
    body: transferBody,
  })).endCell();

  // 6) OFFLINE VERIFY: @ton/core inlines the tiny stateInit cell (flags + code/data refs) into the message, so
  //    the standalone stateInit cell hash is not a tree node — but its code + data refs are. Confirm BOTH the
  //    exact UsernameRegistry code AND the exact init data are embedded in the external BOC we will send.
  const hashes = new Set(); collectCellHashes(extBoc, hashes);
  const codeHashHex = si.code.hash().toString('hex');
  const dataHashHex = si.data.hash().toString('hex');
  if (!hashes.has(codeHashHex) || !hashes.has(dataHashHex)) die('SANITY FAIL: the built external BOC does not embed the verified UsernameRegistry code+data. Refusing to send.');
  const extBytes = extBoc.toBoc().length;
  if (extBytes >= 65535) die(`external message is ${extBytes} bytes (>= 65535 network limit); cannot send in one message.`);

  // 7) Plan.
  console.log('\n=== D09 UsernameRegistry direct deploy via gateway — PLAN ===');
  console.log('  gateway        :', GATEWAY, '(toncenter key applied server-side)');
  console.log('  deployer wallet:', wallet.address.toString({ urlSafe: true, bounceable: false }), `(${chosen.name}, ${chosen.state}, seqno=${seqno}, balance=${fmtTon(chosen.balance)} TON)`);
  console.log('  target         :', target.toString({ urlSafe: true, bounceable: false }), '(UsernameRegistry)');
  console.log('  deploy value   :', fmtTon(value), 'TON');
  console.log('  stateInit hash :', cellHashHex, '(== packet, == target account id)');
  console.log('  code hash      :', codeHashHex, '(UsernameRegistry build, embedded in the BOC ✓)');
  console.log('  external BOC   :', extBytes, 'bytes (< 65535 ✓)');

  if (!doBroadcast) { console.log('\n  DRY RUN — nothing sent. Re-run with --broadcast to deploy.\n'); return; }

  // 8) Broadcast via the gateway.
  console.log('\n  POSTing the deploy BOC to ' + GATEWAY + '/api/v3/message ...');
  const res = await gwSendBoc(extBoc.toBoc().toString('base64'));
  console.log('  gateway HTTP', res.httpStatus, '->', JSON.stringify(res.body).slice(0, 400));
  if (!res.ok) die('gateway did not accept the message (see response above). Nothing further sent.');

  console.log('  accepted. Waiting for UsernameRegistry to become ACTIVE on-chain...');
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    let st; try { st = await gwGetState(target.toString()); } catch { continue; }
    const state = st.state || st.account_state || 'unknown';
    if (state === 'active') {
      console.log(`\n  ✅ UsernameRegistry is ACTIVE at ${target.toString({ urlSafe: true, bounceable: false })} (balance ${fmtTon(BigInt(st.balance || '0'))} TON).`);
      console.log('  D09 done. Verify its stop-check, then continue D10 in the console.\n');
      return;
    }
  }
  console.log('\n  Sent, but target not ACTIVE after ~2 min. Check the explorer for ' + target.toString() + ' before any resend (the deploy may still be settling).');
}

main().catch((e) => die(e && e.message ? e.message : String(e)));
