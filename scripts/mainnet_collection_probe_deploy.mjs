#!/usr/bin/env node
/*
 * ONE-OFF PROBE DEPLOY TOOL — deploy the ProbeCollection (TEP-62 NFT collection + 4 content-less items)
 * to TON MAINNET via the gateway, to probe how tonapi's ONCHAIN image renderer treats four on-chain
 * TEP-64 content configs (one item per config). tonapi does NOT index collection-less items, so this is a
 * real collection that supplies each item's full on-chain content via get_nft_content:
 *
 *   item index 0 (Config A): { name, description, image_data: <raw full SVG bytes> }      (no `image`)
 *   item index 1 (Config B): { name, description, image_data: <trivial SVG bytes> }       (no `image`)
 *   item index 2 (Config C): { name, description, image: "data:image/svg+xml;base64,..." }(no `image_data`)
 *   item index 3 (Config D): { name, description, image: "data:image/svg+xml,<percent>" } (no `image_data`)
 *
 * Authoritative inputs (code/data/address/mint body/item addresses) are produced by the Tact wrapper in
 * scripts/probe_collection_deploy_input.ts and read from artifacts/local/probe_collection_deploy_input.json.
 * This tool does NOT re-derive the init layout; it only transports the proven cells.
 *
 * The collection + ALL FOUR items deploy in ONE external: a single internal message from the V4 wallet to
 * the collection address carries init:{code,data} (deploys the collection) AND body = ProbeMintAll, which
 * loops and deploys each content-less item. Proven GREEN in tests/_probe-collection-render.test.ts.
 *
 * Transport: Platho gateway (rpc.platho.app) — /api/v2/getAddressInformation (balance/state),
 * /api/v3/runGetMethod (seqno), /api/v3/message (send). The toncenter key lives on the gateway.
 *
 * Deployer == owner == signer: WalletContractV4 (workchain 0), derived from the 24-word seed in
 * artifacts/local/testnet-probe.secret (override with --deployer-secret). The collection's owner (baked
 * into the init data by the TS step) MUST equal this V4 wallet; the tool HARD-CHECKS that.
 *
 * SAFETY:
 *  - The collection address from the JSON is recomputed locally from the JSON's code+data BOCs and
 *    refused unless it matches collectionAddressRaw (so the cells can't have drifted from the address).
 *  - The owner baked into the data must equal the derived V4 wallet (else the items deploy under a
 *    different collection address than the items expect) — refused otherwise.
 *  - After building the external BOC, it walks the cell tree and refuses unless the collection code +
 *    data refs are actually embedded — so it can only ever deploy that exact collection.
 *  - DRY-RUN by default; sends ONLY with --broadcast. Fund check requires >= 0.5 TON (broadcast only).
 *
 * Usage:
 *   dry run:    node scripts/mainnet_collection_probe_deploy.mjs
 *   broadcast:  node scripts/mainnet_collection_probe_deploy.mjs --broadcast
 *
 * Optional flags:
 *   --input <path>            override the JSON input (default artifacts/local/probe_collection_deploy_input.json)
 *   --deployer-secret <path>  override the V4 deployer/owner seed (default artifacts/local/testnet-probe.secret)
 *   --value <ton>             collection deploy message value in TON (default 0.4)
 */
import { readFileSync } from 'node:fs';
import { Address, Cell, beginCell, contractAddress, internal, storeMessage, SendMode, toNano, fromNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
const DEFAULT_INPUT_PATH = 'artifacts/local/probe_collection_deploy_input.json';
const DEFAULT_DEPLOYER_SECRET_PATH = 'artifacts/local/testnet-probe.secret';
const GATEWAY = (process.env.PLATHO_GATEWAY || 'https://rpc.platho.app').replace(/\/+$/, '');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
const DO_BROADCAST = process.argv.includes('--broadcast');
const INPUT_PATH = arg('--input', DEFAULT_INPUT_PATH);
const DEPLOYER_SECRET_PATH = arg('--deployer-secret', DEFAULT_DEPLOYER_SECRET_PATH);
const DEPLOY_VALUE = toNano(String(arg('--value', '0.4')));
const MIN_BALANCE = toNano(String(arg('--min-balance', '0.5'))); // collection deploy + wallet fee headroom; lower via --min-balance for small probes.

function die(m) { console.error('\n  ABORT: ' + m + '\n'); process.exit(1); }
const fmtTon = (n) => (Number(n) / 1e9).toFixed(4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ----------------------------------------------------------------------------
// Gateway helpers (mirror scripts/mainnet_nft_probe_deploy.mjs)
// ----------------------------------------------------------------------------
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
async function gwSeqno(addr) {
  const r = await fetch(`${GATEWAY}/api/v3/runGetMethod`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addr, method: 'seqno', stack: [] }) });
  const j = await r.json();
  if (typeof j?.exit_code === 'number' && j.exit_code !== 0) throw new Error(`seqno get-method exit_code ${j.exit_code}`);
  const v = j?.stack?.[0]?.value;
  if (typeof v !== 'string' || !/^-?(0x)?[0-9a-fA-F]+$/.test(v)) throw new Error(`seqno: unexpected stack ${JSON.stringify(j?.stack)}`);
  return Number(BigInt(v));
}
function collectCellHashes(cell, set) { set.add(cell.hash().toString('hex')); for (const ref of cell.refs) collectCellHashes(ref, set); }

function fmtAddr(addr) {
  return {
    raw: addr.toRawString(),
    uq: addr.toString({ urlSafe: true, bounceable: false }),
    eq: addr.toString({ urlSafe: true, bounceable: true }),
  };
}

async function main() {
  // --- read the authoritative deploy input produced by the Tact wrapper (TS step) ---
  let input;
  try { input = JSON.parse(readFileSync(INPUT_PATH, 'utf8')); }
  catch (e) { die(`could not read deploy input ${INPUT_PATH}: ${e.message}\n         Run: npx ts-node --compiler-options "{\\"module\\":\\"CommonJS\\"}" scripts/probe_collection_deploy_input.ts`); }

  const collectionCode = Cell.fromBoc(Buffer.from(input.collectionCodeBocB64, 'base64'))[0];
  const collectionData = Cell.fromBoc(Buffer.from(input.collectionDataBocB64, 'base64'))[0];
  const mintBody = Cell.fromBoc(Buffer.from(input.mintBodyBocB64, 'base64'))[0];
  const expectedCollection = Address.parseRaw(input.collectionAddressRaw);
  const ownerFromJson = Address.parseRaw(input.ownerRaw);

  // --- recompute the collection address from the JSON cells; refuse on drift ---
  const recomputed = contractAddress(0, { code: collectionCode, data: collectionData });
  if (!recomputed.equals(expectedCollection)) {
    die(`collection address drift: JSON code+data derive to ${recomputed.toRawString()} but JSON address is ${expectedCollection.toRawString()}. Regenerate the input.`);
  }

  // --- deployer == owner: the proven WalletContractV4 from the testnet-probe seed ---
  const words = readFileSync(DEPLOYER_SECRET_PATH, 'utf8').trim().split(/\s+/).filter(Boolean);
  if (words.length !== 24) die(`deployer-secret file ${DEPLOYER_SECRET_PATH} must contain 24 words (got ${words.length})`);
  const key = await mnemonicToPrivateKey(words);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });

  // --- HARD-CHECK: the collection's baked owner must equal the V4 deployer/owner ---
  if (!wallet.address.equals(ownerFromJson)) {
    die(`owner mismatch: V4 wallet ${wallet.address.toRawString()} != collection owner ${ownerFromJson.toRawString()}.\n` +
        `         The JSON was built for a different owner. Either fund/sign with that owner's seed, or regenerate the\n` +
        `         input (scripts/probe_collection_deploy_input.ts) with OWNER_RAW = this V4 wallet. Refusing to proceed.`);
  }

  // --- read the V4 wallet's on-chain state via the gateway ---
  let walletState = null;
  try { walletState = await gwGetState(wallet.address.toString()); } catch { /* unreachable / not yet indexed */ }
  const walletBalance = walletState ? BigInt(walletState.balance || '0') : 0n;
  const walletStateName = walletState ? (walletState.state || walletState.account_state || 'unknown') : 'unreachable';
  const seqnoVal = (() => { try { return walletState ? null : 0; } catch { return null; } })();

  // --- derive the 4 item addresses straight from the JSON (authoritative, written by the TS step) ---
  const items = (input.items || []).map((it) => ({ index: it.index, address: Address.parseRaw(it.raw) }));
  if (items.length !== input.nextIndex) die(`JSON has ${items.length} item addresses but nextIndex=${input.nextIndex}.`);

  // --- read live seqno (if the wallet is active) for the plan output ---
  let seqno = 0;
  if (walletStateName === 'active') {
    try { seqno = await gwSeqno(wallet.address.toString()); }
    catch (e) { console.warn('  (could not read seqno via gateway: ' + e.message + ' — will treat as 0)'); seqno = 0; }
  }

  // --- report / plan ---
  const cf = fmtAddr(expectedCollection);
  console.log('\n=== ProbeCollection — MAINNET on-chain SVG render probe (PLAN) ===');
  console.log('  gateway        :', GATEWAY, '(toncenter key applied server-side)');
  console.log('  input          :', INPUT_PATH, `(svg ${input.svgBytes} bytes, generated ${input.generatedAt})`);
  console.log('  collection code:', collectionCode.hash().toString('hex'));
  console.log('  collection data:', collectionData.hash().toString('hex'));
  console.log('  deployer/owner :', `WalletContractV4 (wc 0, ${walletStateName}) — owner + signs/broadcasts/pays`);
  console.log('    UQ (mainnet) :', wallet.address.toString({ urlSafe: true, bounceable: false }));
  console.log('    raw          :', wallet.address.toRawString());
  console.log('    balance      :', fmtTon(walletBalance), 'TON');
  console.log('    seqno        :', walletStateName === 'active' ? seqno : '(wallet not deployed -> 0)');
  console.log('    seed file    :', DEPLOYER_SECRET_PATH);
  console.log('  deploy value   :', fromNano(DEPLOY_VALUE), 'TON (collection internal msg; mint funds 4 items @ 0.05 each)');
  console.log('\n  --- ProbeCollection ---');
  console.log('    raw  (0:hex) :', cf.raw);
  console.log('    mainnet UQ   :', cf.uq, '(non-bounceable)');
  console.log('    mainnet EQ   :', cf.eq, '(bounceable)');
  for (const it of items) {
    const f = fmtAddr(it.address);
    console.log(`\n  --- ProbeItem index ${it.index} (Config ${'ABCD'[it.index] || '?'}) ---`);
    console.log('    raw  (0:hex) :', f.raw);
    console.log('    mainnet UQ   :', f.uq, '(non-bounceable)');
    console.log('    mainnet EQ   :', f.eq, '(bounceable)');
  }

  // --- build the deploy external (collection init + ProbeMintAll body) ---
  const deployMsg = internal({
    to: expectedCollection,
    value: DEPLOY_VALUE,
    bounce: false,
    init: { code: collectionCode, data: collectionData },
    body: mintBody,
  });

  if (!DO_BROADCAST) {
    // Build the external offline anyway so the cell-embed sanity check runs in dry-run too.
    const dryWithInit = walletStateName !== 'active';
    const dryBody = wallet.createTransfer({ seqno: dryWithInit ? 0 : seqno, secretKey: key.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY, messages: [deployMsg] });
    const dryExt = beginCell().store(storeMessage({
      info: { type: 'external-in', src: null, dest: wallet.address, importFee: 0n },
      init: dryWithInit ? wallet.init : null,
      body: dryBody,
    })).endCell();
    const hashes = new Set(); collectCellHashes(dryExt, hashes);
    const embedsCode = hashes.has(collectionCode.hash().toString('hex'));
    const embedsData = hashes.has(collectionData.hash().toString('hex'));
    const extBytes = dryExt.toBoc().length;
    console.log('\n  offline cell-embed check : code', embedsCode ? 'OK' : 'MISSING', '| data', embedsData ? 'OK' : 'MISSING');
    console.log('  external BOC size        :', extBytes, 'bytes', extBytes >= 65535 ? '(>= 65535 LIMIT — TOO BIG!)' : '(< 65535 ok)');
    if (!embedsCode || !embedsData) console.log('  WARNING: collection code/data not embedded — broadcast would be refused.');
    console.log('\n  DRY RUN — nothing sent. Addresses above are final (derived from the Tact-built stateInit).');
    console.log('  Re-run with --broadcast to fund-check and deploy the collection + 4 items in one external.\n');
    return;
  }

  // --- broadcast path ---
  if (walletBalance < MIN_BALANCE) {
    die(`V4 deployer is underfunded: have ${fmtTon(walletBalance)} TON, need >= ${fmtTon(MIN_BALANCE)} TON.\n` +
        `         Fund the V4 deployer/owner at:\n         ${wallet.address.toString({ urlSafe: true, bounceable: false })}`);
  }

  // If the collection is already active, do not re-send (that would just top it up / re-mint).
  let collState = null; try { collState = await gwGetState(expectedCollection.toString()); } catch { /* not deployed */ }
  if (collState && (collState.state || collState.account_state) === 'active') {
    console.log('\n  Collection already ACTIVE on-chain — nothing to broadcast.');
    console.log(`    ${expectedCollection.toString({ urlSafe: true, bounceable: false })}`);
    return;
  }

  const notDeployed = walletStateName !== 'active';
  let sendSeqno = notDeployed ? 0 : seqno;

  const transferBody = wallet.createTransfer({ seqno: sendSeqno, secretKey: key.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY, messages: [deployMsg] });
  const extBoc = beginCell().store(storeMessage({
    info: { type: 'external-in', src: null, dest: wallet.address, importFee: 0n },
    init: notDeployed ? wallet.init : null,
    body: transferBody,
  })).endCell();

  // OFFLINE VERIFY: the collection code + data must be embedded in the BOC we send.
  const hashes = new Set(); collectCellHashes(extBoc, hashes);
  if (!hashes.has(collectionCode.hash().toString('hex'))) die('SANITY FAIL: built external BOC does not embed the collection code. Refusing to send.');
  if (!hashes.has(collectionData.hash().toString('hex'))) die('SANITY FAIL: built external BOC does not embed the collection data. Refusing to send.');
  const extBytes = extBoc.toBoc().length;
  if (extBytes >= 65535) die(`external message is ${extBytes} bytes (>= 65535 network limit); cannot send in one message.`);

  console.log(`\n  POSTing collection deploy + mint (seqno ${sendSeqno}, ${extBytes} bytes) to ${GATEWAY}/api/v3/message ...`);
  const res = await gwSendBoc(extBoc.toBoc().toString('base64'));
  console.log('  gateway HTTP', res.httpStatus, '->', JSON.stringify(res.body).slice(0, 400));
  if (!res.ok) die('gateway did not accept the message (see response above). Nothing further sent.');

  // --- poll the collection + 4 items until active (or ~120s) ---
  console.log('\n  accepted. Waiting for the collection + 4 items to become ACTIVE on-chain (~120s timeout)...');
  const pending = new Map();
  pending.set('collection', { label: 'ProbeCollection', address: expectedCollection });
  for (const it of items) pending.set(`item${it.index}`, { label: `ProbeItem ${it.index} (Config ${'ABCD'[it.index]})`, address: it.address });
  for (let i = 0; i < 40 && pending.size > 0; i++) {
    await sleep(3000);
    for (const [k, e] of [...pending]) {
      let st; try { st = await gwGetState(e.address.toString()); } catch { continue; }
      const state = st.state || st.account_state || 'unknown';
      if (state === 'active') {
        console.log(`  OK ${e.label} is ACTIVE @ ${e.address.toString({ urlSafe: true, bounceable: false })} (balance ${fmtTon(BigInt(st.balance || '0'))} TON).`);
        pending.delete(k);
      }
    }
  }
  console.log('');
  if (pending.size === 0) {
    console.log('  Collection + all 4 items ACTIVE. Open the collection + each item in tonapi.io / Tonkeeper / GetGems to compare rendering.');
    console.log(`    collection: ${expectedCollection.toString({ urlSafe: true, bounceable: true })}`);
    for (const it of items) console.log(`    item ${it.index} (Config ${'ABCD'[it.index]}): ${it.address.toString({ urlSafe: true, bounceable: true })}`);
  } else {
    console.log('  Sent, but the following are not ACTIVE after ~120s (may still be settling — check the explorer):');
    for (const e of pending.values()) console.log(`    ${e.label}: ${e.address.toString({ urlSafe: true, bounceable: false })}`);
  }
  console.log('');
}

main().catch((e) => die(e && e.message ? e.message : String(e)));
