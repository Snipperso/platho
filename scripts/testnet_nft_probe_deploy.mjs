#!/usr/bin/env node
/*
 * TEMPORARY PROBE DEPLOY TOOL — testnet only. NOT part of the protocol.
 *
 * Deploys two standalone on-chain-SVG NFT *items* (SvgRenderProbeItem) to TON
 * TESTNET so we can observe how testnet.tonapi.io / Tonkeeper-testnet /
 * GetGems-testnet render fully on-chain TEP-64 SVG metadata in two configs:
 *
 *   Config A: { name, description, image_data: <raw SVG bytes> }   (NO `image` key)
 *   Config B: A + image: "data:image/svg+xml," + percentEncode(SVG)
 *
 * The full TEP-64 dictionary (incl. the ~5 KB chunked snake SVG) is assembled
 * OFFLINE here and embedded into each item's init data, so each config derives
 * to a deterministic address known BEFORE funding.
 *
 * Wallet: WalletContractV4 (workchain 0) derived from the 24-word seed in
 *   artifacts/local/testnet-probe.secret
 * RPC: https://testnet.toncenter.com/api/v2 (keyless; a delay is inserted
 *   between calls to respect the ~1 rps keyless rate limit).
 *
 * DRY-RUN by default: just compute + print both item addresses (raw 0:hex +
 * testnet bounceable kQ / non-bounceable 0Q). Use --broadcast to actually fund-
 * check the wallet and send the two deploy messages (~0.2 TON each).
 *
 * Usage:
 *   dry run:   node scripts/testnet_nft_probe_deploy.mjs
 *   broadcast: node scripts/testnet_nft_probe_deploy.mjs --broadcast
 *
 * Optional flags:
 *   --svg <path>            override the SVG source (default artifacts/tmp_username_render/platho.svg)
 *   --secret <path>         override the seed file (default artifacts/local/testnet-probe.secret)
 *   --value <ton>           per-item deploy value in TON (default 0.2)
 */
import { readFileSync } from 'node:fs';
import { Address, Cell, beginCell, contractAddress, internal, Dictionary, SendMode, toNano, fromNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4, TonClient } from '@ton/ton';

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
const DEFAULT_SVG_PATH = 'artifacts/tmp_username_render/platho.svg';
const DEFAULT_SECRET_PATH = 'artifacts/local/testnet-probe.secret';
const CODE_BOC_PATH = 'build/_probe/SvgRenderProbeItem/SvgRenderProbeItem_SvgRenderProbeItem.code.boc';
const TESTNET_ENDPOINT = 'https://testnet.toncenter.com/api/v2/jsonRPC';
const RATE_DELAY_MS = 1500; // keyless toncenter is ~1 rps; be polite.

// TEP-64 metadata keys = sha256(attribute_name). These match the
// USERNAME_*_METADATA_KEY_* constants in contracts/UsernameRegistry.tact /
// UsernameNFTItem.tact (verified identical).
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
const SECRET_PATH = arg('--secret', DEFAULT_SECRET_PATH);
const PER_ITEM_VALUE = toNano(String(arg('--value', '0.2')));

function die(m) { console.error('\n  ABORT: ' + m + '\n'); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ----------------------------------------------------------------------------
// Snake-string cell builder — matches the contracts' beginTailString() layout:
// leading 0x00 marker byte, then up to 127 bytes per cell (1023 bits), chaining
// to the next chunk via a single ref. Byte-aligned, head-first readable.
// ----------------------------------------------------------------------------
function snakeStringCell(bytes) {
  const MARKER = [0x00];
  const all = Uint8Array.from([...MARKER, ...bytes]);
  // Pack 127 bytes per cell (1016 bits leaves room; 1023-bit cap, byte-aligned).
  const CHUNK = 127;
  const chunks = [];
  for (let i = 0; i < all.length; i += CHUNK) {
    chunks.push(all.slice(i, i + CHUNK));
  }
  if (chunks.length === 0) chunks.push(Uint8Array.from([]));
  // Build tail-first so the head reads first.
  let next = null;
  for (let i = chunks.length - 1; i >= 0; i--) {
    const b = beginCell();
    b.storeBuffer(Buffer.from(chunks[i]));
    if (next) b.storeRef(next);
    next = b.endCell();
  }
  return next;
}

// Percent-encode SVG bytes for a data:image/svg+xml URI. Standard
// encodeURIComponent semantics over the UTF-8 string (matches the
// appendSvgUri* intent: reserved/unsafe chars escaped, the SVG remains
// inline-renderable). encodeURIComponent leaves A-Za-z0-9 -_.!~*'() unescaped.
function percentEncodeSvg(svgText) {
  return encodeURIComponent(svgText);
}

// ----------------------------------------------------------------------------
// Build the TEP-64 metadata dict for a config.
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

// ----------------------------------------------------------------------------
// Replicate Tact 1.6.13 init-data serialization for SvgRenderProbeItem, exactly
// as the generated wrapper's SvgRenderProbeItem_init() does:
//   beginCell()
//     .storeUint(0, 1)              // version/system prefix bit
//     .storeInt(config, 257)        // init-arg ints serialize as 257-bit
//     .storeAddress(owner_address)
//     .storeDict(metadata, BigUint(256), Cell())
// ----------------------------------------------------------------------------
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
    testBounceable: addr.toString({ testOnly: true, bounceable: true, urlSafe: true }),
    testNonBounceable: addr.toString({ testOnly: true, bounceable: false, urlSafe: true }),
  };
}

async function main() {
  // --- inputs ---
  const svgBytes = readFileSync(SVG_PATH);
  const svgText = svgBytes.toString('utf8');
  const codeCell = Cell.fromBoc(readFileSync(CODE_BOC_PATH))[0];

  const words = readFileSync(SECRET_PATH, 'utf8').trim().split(/\s+/).filter(Boolean);
  if (words.length !== 24) die(`seed file ${SECRET_PATH} must contain 24 words (got ${words.length})`);
  const key = await mnemonicToPrivateKey(words);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
  const ownerAddress = wallet.address;

  // --- build both items deterministically ---
  const items = [0, 1].map((config) => {
    const metadata = buildMetadata(config, svgBytes, svgText);
    const data = buildInitData(config, ownerAddress, metadata);
    const address = contractAddress(0, { code: codeCell, data });
    return {
      label: config === 0 ? 'Config A (image_data only, no image)' : 'Config B (image_data + image data-URI)',
      config, metadata, data, address,
      stateInitBytes: beginCell().store((b) => {
        // standard StateInit cell: split_depth?, special?, code?, data?, library?
        b.storeBit(0).storeBit(0).storeBit(1).storeRef(codeCell).storeBit(1).storeRef(data).storeBit(0);
      }).endCell().toBoc().length,
    };
  });

  // --- report ---
  console.log('\n=== SvgRenderProbeItem — testnet on-chain SVG render probe ===');
  console.log('  svg source     :', SVG_PATH, `(${svgBytes.length} bytes)`);
  console.log('  code hash      :', codeCell.hash().toString('hex'));
  console.log('  deployer wallet: WalletContractV4 (wc 0)');
  console.log('    raw          :', ownerAddress.toRawString());
  console.log('    testnet      :', ownerAddress.toString({ testOnly: true, bounceable: false, urlSafe: true }), '(non-bounceable, fund this)');
  console.log('  per-item value :', fromNano(PER_ITEM_VALUE), 'TON');
  for (const it of items) {
    const f = fmtAddr(it.address);
    console.log(`\n  --- ${it.label} ---`);
    console.log('    init data hash :', it.data.hash().toString('hex'));
    console.log('    stateInit BOC  :', it.stateInitBytes, 'bytes');
    console.log('    raw  (0:hex)   :', f.raw);
    console.log('    testnet EQ/kQ  :', f.testBounceable, '(bounceable)');
    console.log('    testnet 0Q     :', f.testNonBounceable, '(non-bounceable)');
  }

  if (!DO_BROADCAST) {
    console.log('\n  DRY RUN — nothing sent. Addresses above are final (derived from stateInit).');
    console.log('  Re-run with --broadcast to fund-check and deploy both items.\n');
    return;
  }

  // --- broadcast path ---
  const client = new TonClient({ endpoint: TESTNET_ENDPOINT });

  const balance = await client.getBalance(ownerAddress);
  await sleep(RATE_DELAY_MS);
  const need = PER_ITEM_VALUE * 2n + toNano('0.1'); // two deploys + fee headroom
  console.log(`\n  wallet balance : ${fromNano(balance)} TON (need ~${fromNano(need)} TON)`);
  if (balance < need) {
    die(`deployer wallet is underfunded. Send testnet TON to:\n         ${ownerAddress.toString({ testOnly: true, bounceable: false, urlSafe: true })}\n         (have ${fromNano(balance)} TON, need ~${fromNano(need)} TON)`);
  }

  const contract = client.open(wallet);
  let seqno = await contract.getSeqno();
  await sleep(RATE_DELAY_MS);

  const messages = items.map((it) => internal({
    to: it.address,
    value: PER_ITEM_VALUE,
    bounce: false,
    init: { code: codeCell, data: it.data },
    body: beginCell().endCell(),
  }));

  console.log('\n  sending two deploy messages from seqno', seqno, '...');
  await contract.sendTransfer({
    seqno,
    secretKey: key.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    messages,
  });

  console.log('  submitted. Waiting for seqno to advance (confirmation)...');
  for (let i = 0; i < 30; i++) {
    await sleep(RATE_DELAY_MS);
    let cur;
    try { cur = await contract.getSeqno(); } catch { continue; }
    if (cur > seqno) {
      console.log(`\n  confirmed (seqno ${seqno} -> ${cur}). Both probe items deployed:`);
      for (const it of items) {
        console.log(`    ${it.label}: ${it.address.toString({ testOnly: true, bounceable: true, urlSafe: true })}`);
      }
      console.log('\n  Open each in testnet.tonapi.io / Tonkeeper-testnet / GetGems-testnet to compare rendering.\n');
      return;
    }
  }
  console.log('\n  Submitted, but seqno did not advance within the wait window. Check the explorer for the wallet and item addresses before any resend.\n');
}

main().catch((e) => die(e && e.message ? e.message : String(e)));
