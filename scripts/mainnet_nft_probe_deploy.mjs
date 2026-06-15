#!/usr/bin/env node
/*
 * ONE-OFF PROBE DEPLOY TOOL — deploy the two already-built SVG render-probe NFT items to MAINNET, via the gateway.
 *
 * What: deploys two standalone on-chain-SVG NFT *items* (SvgRenderProbeItem) to TON MAINNET so we can observe
 * how tonapi.io / Tonkeeper / GetGems render fully on-chain TEP-64 SVG metadata in two configs:
 *
 *   Config A: { name, description, image_data: <raw SVG bytes> }   (NO `image` key)
 *   Config B: A + image: "data:image/svg+xml," + percentEncode(SVG)
 *
 * The full TEP-64 dictionary (incl. the ~5 KB chunked snake SVG) is assembled OFFLINE here and embedded into each
 * item's init data, so each config derives to a deterministic address known BEFORE funding. The item addresses
 * are network-agnostic and MUST match the values verified on testnet:
 *
 *   Config A = 0:11f3ab146dcad5e16adac57306128487a5ee28d4949b746601f743b79890e33d
 *   Config B = 0:6840b440307863e7edbde4d8a58766f9c56556a2feb327cb8f90f10ba2e4d6f7
 *
 * Transport: routes through the Platho gateway (rpc.platho.app), which exposes a curated allowlist
 * (/api/v2/getAddressInformation for balance/state, /api/v3/runGetMethod for seqno, /api/v3/message for sending).
 * The toncenter key lives on the gateway, so no API key is handled locally. The signed external is built OFFLINE.
 *
 * Deployer == owner: WalletContractV4 (workchain 0), derived from the 24-word seed in
 * artifacts/local/testnet-probe.secret (override with --deployer-secret). This is the SAME proven V4 wallet that
 * already deployed these byte-identical probe items on TESTNET, and it is ALSO the items' NFT owner (its address is
 * baked into each deterministic item stateInit). So it serves as owner, signer, payer and broadcaster all at once.
 *
 * WHY V4 (not the v5r1 burner): the old artifacts/local/deployer.secret burner is v5r1, and its externals get
 * ACCEPTED by the gateway (HTTP 200) but silently DROPPED by the validator — seqno never advances, nothing deploys.
 * The V4 wallet is the proven path (it is exactly what testnet_nft_probe_deploy.mjs uses), so we use it for both
 * owner and deployer. The v5r1 auto-detection is gone. Mnemonic never logged.
 *
 * SAFETY:
 *  - Each item's stateInit is rebuilt from the canonical code BOC + the platho SVG + the owner, and is REFUSED
 *    unless it derives to the known address above — so the tool can only ever deploy those two exact items.
 *  - After building the external BOC, it walks the cell tree and refuses unless the targeted items' code + data
 *    refs are actually embedded — so it can only ever deploy those exact contracts to those exact addresses.
 *  - DRY-RUN by default; sends ONLY with --broadcast. Fund check requires >= ~0.55 TON.
 *
 * Usage:
 *   dry run:    node scripts/mainnet_nft_probe_deploy.mjs
 *   broadcast:  node scripts/mainnet_nft_probe_deploy.mjs --broadcast
 *
 * Optional flags:
 *   --svg <path>              override the SVG source (default artifacts/tmp_username_render/platho.svg)
 *   --deployer-secret <path>  override the V4 deployer/owner seed (default artifacts/local/testnet-probe.secret)
 *   --value <ton>             per-item deploy value in TON (default 0.2)
 */
import { readFileSync } from 'node:fs';
import { Address, Cell, beginCell, contractAddress, internal, storeMessage, Dictionary, SendMode, toNano, fromNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
const DEFAULT_SVG_PATH = 'artifacts/tmp_username_render/platho.svg';
const DEFAULT_DEPLOYER_SECRET_PATH = 'artifacts/local/testnet-probe.secret';
const CODE_BOC_PATH = 'build/_probe/SvgRenderProbeItem/SvgRenderProbeItem_SvgRenderProbeItem.code.boc';
const GATEWAY = (process.env.PLATHO_GATEWAY || 'https://rpc.platho.app').replace(/\/+$/, '');

// Network-agnostic item addresses (verified on testnet); HARD-CHECKED below.
const EXPECTED = {
  A: Address.parseRaw('0:11f3ab146dcad5e16adac57306128487a5ee28d4949b746601f743b79890e33d'),
  B: Address.parseRaw('0:6840b440307863e7edbde4d8a58766f9c56556a2feb327cb8f90f10ba2e4d6f7'),
};

// TEP-64 metadata keys = sha256(attribute_name). Identical to the testnet probe tool.
const KEY_NAME        = 0x82a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce89n; // sha256("name")
const KEY_DESCRIPTION = 0xc9046f7a37ad0ea7cee73355984fa5428982f8b37c8f7bcec91f7ac71a7cd104n; // sha256("description")
const KEY_IMAGE       = 0x6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3dn; // sha256("image")
const KEY_IMAGE_DATA  = 0xd9a88ccec79eef59c84b671136a20ece4cd00caaad5bc47e2c208829154ee9e4n; // sha256("image_data")

const NAME_VALUE = 'platho.ath';
const DESCRIPTION_VALUE = 'Platho username NFT testnet probe';

// ----------------------------------------------------------------------------
// CLI args
// ----------------------------------------------------------------------------
function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
const DO_BROADCAST = process.argv.includes('--broadcast');
const SVG_PATH = arg('--svg', DEFAULT_SVG_PATH);
const DEPLOYER_SECRET_PATH = arg('--deployer-secret', DEFAULT_DEPLOYER_SECRET_PATH);
const PER_ITEM_VALUE = toNano(String(arg('--value', '0.2')));
const MIN_BALANCE = toNano('0.55'); // two deploys (~0.4) + wallet deploy/fee headroom.

function die(m) { console.error('\n  ABORT: ' + m + '\n'); process.exit(1); }
const fmtTon = (n) => (Number(n) / 1e9).toFixed(4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ----------------------------------------------------------------------------
// Gateway helpers (mirror mainnet_deploy_d09_username_registry.mjs)
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
  // toncenter v3 runGetMethod returns { exit_code, stack: [{type:'num', value:'0x..'}] }. An uninitialized wallet
  // (no code) returns a non-zero exit_code / no usable stack -> throw so callers treat it as not-yet-deployed.
  // (The old `?? j?.result?.stack?.[0]?.[1]` fallback could latch onto an unrelated number like a block seqno.)
  if (typeof j?.exit_code === 'number' && j.exit_code !== 0) throw new Error(`seqno get-method exit_code ${j.exit_code}`);
  const v = j?.stack?.[0]?.value;
  if (typeof v !== 'string' || !/^-?(0x)?[0-9a-fA-F]+$/.test(v)) throw new Error(`seqno: unexpected stack ${JSON.stringify(j?.stack)}`);
  return Number(BigInt(v));
}
function collectCellHashes(cell, set) { set.add(cell.hash().toString('hex')); for (const ref of cell.refs) collectCellHashes(ref, set); }

// ----------------------------------------------------------------------------
// Snake-string cell builder — leading 0x00 marker, 127 bytes/cell, chained via ref.
// ----------------------------------------------------------------------------
function snakeStringCell(bytes) {
  const all = Uint8Array.from([0x00, ...bytes]);
  const CHUNK = 127;
  const chunks = [];
  for (let i = 0; i < all.length; i += CHUNK) chunks.push(all.slice(i, i + CHUNK));
  if (chunks.length === 0) chunks.push(Uint8Array.from([]));
  let next = null;
  for (let i = chunks.length - 1; i >= 0; i--) {
    const b = beginCell();
    b.storeBuffer(Buffer.from(chunks[i]));
    if (next) b.storeRef(next);
    next = b.endCell();
  }
  return next;
}

const percentEncodeSvg = (svgText) => encodeURIComponent(svgText);

// ----------------------------------------------------------------------------
// TEP-64 metadata dict per config:
//   config 0 (A): name + description + image_data (raw SVG)        — no image
//   config 1 (B): A + image: "data:image/svg+xml," + percentEncode(SVG)
// ----------------------------------------------------------------------------
function buildMetadata(config, svgBytes, svgText) {
  const dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
  dict.set(KEY_NAME, snakeStringCell(Buffer.from(NAME_VALUE, 'utf8')));
  dict.set(KEY_DESCRIPTION, snakeStringCell(Buffer.from(DESCRIPTION_VALUE, 'utf8')));
  dict.set(KEY_IMAGE_DATA, snakeStringCell(svgBytes));
  if (config === 1) {
    const dataUri = 'data:image/svg+xml,' + percentEncodeSvg(svgText);
    dict.set(KEY_IMAGE, snakeStringCell(Buffer.from(dataUri, 'utf8')));
  }
  return dict;
}

// Tact 1.6.13 init-data serialization for SvgRenderProbeItem (matches the generated wrapper).
function buildInitData(config, ownerAddress, metadata) {
  return beginCell()
    .storeUint(0, 1)
    .storeInt(BigInt(config), 257)
    .storeAddress(ownerAddress)
    .storeDict(metadata, Dictionary.Keys.BigUint(256), Dictionary.Values.Cell())
    .endCell();
}

function fmtAddr(addr) {
  return {
    raw: addr.toRawString(),
    uq: addr.toString({ urlSafe: true, bounceable: false }), // mainnet non-bounceable
    eq: addr.toString({ urlSafe: true, bounceable: true }),  // mainnet bounceable
  };
}

async function main() {
  // --- inputs ---
  const svgBytes = readFileSync(SVG_PATH);
  const svgText = svgBytes.toString('utf8');
  const codeCell = Cell.fromBoc(readFileSync(CODE_BOC_PATH))[0];

  // --- deployer == owner: the proven WalletContractV4 from the testnet-probe seed ---
  const words = readFileSync(DEPLOYER_SECRET_PATH, 'utf8').trim().split(/\s+/).filter(Boolean);
  if (words.length !== 24) die(`deployer-secret file ${DEPLOYER_SECRET_PATH} must contain 24 words (got ${words.length})`);
  const key = await mnemonicToPrivateKey(words);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
  const ownerAddress = wallet.address; // V4 wallet is BOTH deployer and item owner.

  // --- read the V4 wallet's on-chain state via the gateway (allowed v2 route) ---
  let walletState = null;
  try { walletState = await gwGetState(wallet.address.toString()); } catch { /* unreachable / not yet indexed */ }
  const walletBalance = walletState ? BigInt(walletState.balance || '0') : 0n;
  const walletStateName = walletState ? (walletState.state || walletState.account_state || 'unknown') : 'unreachable';
  const notDeployed = walletStateName !== 'active';

  // --- build both items deterministically and HARD-CHECK their addresses ---
  const want = [
    { key: 'A', config: 0, label: 'Config A (image_data only, no image)', expected: EXPECTED.A },
    { key: 'B', config: 1, label: 'Config B (image_data + image data-URI)', expected: EXPECTED.B },
  ];
  const items = want.map(({ key: k, config, label, expected }) => {
    const metadata = buildMetadata(config, svgBytes, svgText);
    const data = buildInitData(config, ownerAddress, metadata);
    const address = contractAddress(0, { code: codeCell, data });
    if (!address.equals(expected)) {
      die(`Config ${k} rebuilt to ${address.toRawString()} but expected ${expected.toRawString()}.\n` +
          `         The owner address, SVG, or code BOC differs from the testnet build. Refusing to proceed.`);
    }
    return { key: k, config, label, data, address, matches: true };
  });

  // --- fund check (skipped in dry-run: the wallet may still be funding) ---
  if (DO_BROADCAST && walletBalance < MIN_BALANCE) {
    die(`V4 deployer is underfunded: have ${fmtTon(walletBalance)} TON, need >= ${fmtTon(MIN_BALANCE)} TON.\n` +
        `         Fund the V4 deployer/owner at:\n         ${wallet.address.toString({ urlSafe: true, bounceable: false })}`);
  }

  // --- report / plan ---
  const totalCost = PER_ITEM_VALUE * 2n;
  console.log('\n=== SvgRenderProbeItem — MAINNET on-chain SVG render probe (PLAN) ===');
  console.log('  gateway        :', GATEWAY, '(toncenter key applied server-side)');
  console.log('  svg source     :', SVG_PATH, `(${svgBytes.length} bytes)`);
  console.log('  code hash      :', codeCell.hash().toString('hex'));
  console.log('  deployer/owner :', `WalletContractV4 (wc 0, ${walletStateName}) — owner + signs/broadcasts/pays`);
  console.log('    UQ (mainnet) :', wallet.address.toString({ urlSafe: true, bounceable: false }));
  console.log('    raw          :', wallet.address.toRawString());
  console.log('    balance      :', fmtTon(walletBalance), 'TON');
  console.log('    seed file    :', DEPLOYER_SECRET_PATH);
  console.log('  per-item value :', fromNano(PER_ITEM_VALUE), 'TON');
  console.log('  total cost     :', fromNano(totalCost), 'TON (+ network fees)');
  for (const it of items) {
    const f = fmtAddr(it.address);
    console.log(`\n  --- ${it.label} ---`);
    console.log('    init data hash :', it.data.hash().toString('hex'));
    console.log('    raw  (0:hex)   :', f.raw);
    console.log('    mainnet UQ     :', f.uq, '(non-bounceable)');
    console.log('    mainnet EQ     :', f.eq, '(bounceable)');
    console.log('    address match  :', it.matches ? 'OK (== known testnet address)' : 'MISMATCH');
  }

  if (!DO_BROADCAST) {
    console.log('\n  DRY RUN — nothing sent. Addresses above are final (derived from stateInit, == testnet).');
    console.log('  Re-run with --broadcast to fund-check and deploy both items via the gateway.\n');
    return;
  }

  // --- broadcast path ---
  // Query each item's current on-chain state; only deploy items that are NOT already active. Re-running after a
  // partial deploy must NOT re-send a live item (that would just waste its per-item value topping it up).
  for (const it of items) {
    let st = null; try { st = await gwGetState(it.address.toString()); } catch { /* unreachable -> treat as not deployed */ }
    it.onchainState = st ? (st.state || st.account_state || 'unknown') : 'unreachable';
    it.alreadyActive = it.onchainState === 'active';
    if (it.alreadyActive) console.log(`\n  ${it.label}: already ACTIVE on-chain — skipping (no re-deploy).`);
  }
  const toDeploy = items.filter((it) => !it.alreadyActive);
  if (toDeploy.length === 0) {
    console.log('\n  Both probe items are already ACTIVE. Nothing to broadcast.');
    for (const it of items) console.log(`    ${it.label}: ${it.address.toString({ urlSafe: true, bounceable: true })}`);
    console.log('');
    return;
  }

  const deployMsg = (it) => internal({
    to: it.address,
    value: PER_ITEM_VALUE,
    bounce: false,
    init: { code: codeCell, data: it.data },
    body: beginCell().endCell(),
  });

  // seqno: 0 if the V4 wallet is not deployed yet (first transfer carries wallet.init and deploys it); else read via gateway v3.
  let seqno = 0;
  if (!notDeployed) {
    try { seqno = await gwSeqno(wallet.address.toString()); }
    catch (e) { die('could not read seqno of the already-deployed V4 wallet via the gateway: ' + e.message); }
  }

  // Helper: build + verify + send ONE single-message external deploying `item` (the proven @ton/ton V4 one-msg-per-ext path).
  async function sendExternal(item, seqnoForExt, withInit, labelForLog) {
    const transferBody = wallet.createTransfer({ seqno: seqnoForExt, secretKey: key.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY, messages: [deployMsg(item)] });
    const extBoc = beginCell().store(storeMessage({
      info: { type: 'external-in', src: null, dest: wallet.address, importFee: 0n },
      init: withInit ? wallet.init : null,
      body: transferBody,
    })).endCell();

    // OFFLINE VERIFY: confirm THIS item's code + data refs are embedded in the BOC we will send.
    const hashes = new Set(); collectCellHashes(extBoc, hashes);
    if (!hashes.has(codeCell.hash().toString('hex'))) die('SANITY FAIL: built external BOC does not embed the probe item code. Refusing to send.');
    if (!hashes.has(item.data.hash().toString('hex'))) die(`SANITY FAIL: built external BOC does not embed ${item.label} init data. Refusing to send.`);
    const extBytes = extBoc.toBoc().length;
    if (extBytes >= 65535) die(`external message is ${extBytes} bytes (>= 65535 network limit); cannot send in one message.`);

    console.log(`\n  POSTing ${labelForLog} (1 deploy msg, seqno ${seqnoForExt}, ${extBytes} bytes) to ${GATEWAY}/api/v3/message ...`);
    const res = await gwSendBoc(extBoc.toBoc().toString('base64'));
    console.log('  gateway HTTP', res.httpStatus, '->', JSON.stringify(res.body).slice(0, 400));
    if (!res.ok) die('gateway did not accept the message (see response above). Nothing further sent.');
  }

  // Deploy each pending item as its own single-message external, waiting for the wallet seqno to advance between sends.
  // The first external carries wallet.init ONLY if the V4 wallet itself is still uninitialized.
  for (let idx = 0; idx < toDeploy.length; idx++) {
    const it = toDeploy[idx];
    const withInit = notDeployed && idx === 0;
    await sendExternal(it, seqno, withInit, `${it.key} (item ${idx + 1}/${toDeploy.length})`);
    if (idx < toDeploy.length - 1) {
      console.log('  waiting for the V4 wallet seqno to advance before sending the next external...');
      const target = seqno + 1;
      let advanced = false;
      for (let i = 0; i < 20; i++) {
        await sleep(3000);
        let s; try { s = await gwSeqno(wallet.address.toString()); } catch { continue; }
        if (s >= target) { seqno = s; advanced = true; console.log(`  V4 wallet seqno advanced to ${s}; sending the next external.`); break; }
      }
      if (!advanced) die(`V4 wallet seqno did not advance past ${seqno} within ~60s; the previous deploy may have been dropped. Refusing to continue. Check the explorer.`);
    }
  }

  // --- poll both items until active (or ~90s) ---
  console.log('\n  accepted. Waiting for both probe items to become ACTIVE on-chain (~90s timeout)...');
  const pending = new Map(items.map((it) => [it.key, it]));
  for (let i = 0; i < 30 && pending.size > 0; i++) {
    await sleep(3000);
    for (const [k, it] of [...pending]) {
      let st; try { st = await gwGetState(it.address.toString()); } catch { continue; }
      const state = st.state || st.account_state || 'unknown';
      if (state === 'active') {
        console.log(`  ✅ ${it.label} is ACTIVE @ ${it.address.toString({ urlSafe: true, bounceable: false })} (balance ${fmtTon(BigInt(st.balance || '0'))} TON).`);
        pending.delete(k);
      }
    }
  }
  console.log('');
  if (pending.size === 0) {
    console.log('  Both probe items are ACTIVE. Open each in tonapi.io / Tonkeeper / GetGems to compare rendering.');
    for (const it of items) console.log(`    ${it.label}: ${it.address.toString({ urlSafe: true, bounceable: true })}`);
  } else {
    console.log('  Sent, but the following item(s) are not ACTIVE after ~90s (may still be settling — check the explorer):');
    for (const it of pending.values()) console.log(`    ${it.label}: ${it.address.toString({ urlSafe: true, bounceable: false })}`);
  }
  console.log('');
}

main().catch((e) => die(e && e.message ? e.message : String(e)));
