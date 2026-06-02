#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { URL } from 'node:url';
import { Address } from '@ton/core';

const DEFAULT_PACKET_PATH = 'artifacts/local/mainnet_tx_dry_run_packet.json';
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const DEFAULT_TONCONNECT_MANIFEST_URL = 'https://ton-connect.github.io/demo-dapp-with-react-ui/tonconnect-manifest.json';
const LONG_LINK_WARNING_THRESHOLD = 18000;

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const packetPath = resolve(argValue('--packet', DEFAULT_PACKET_PATH));
const host = argValue('--host', DEFAULT_HOST);
const port = Number(argValue('--port', String(DEFAULT_PORT)));
const tonConnectManifestUrl = argValue('--tonconnect-manifest', DEFAULT_TONCONNECT_MANIFEST_URL);

function parseJsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function nanotonsToTon(value) {
  const raw = BigInt(String(value || '0'));
  const whole = raw / 1000000000n;
  const frac = (raw % 1000000000n).toString().padStart(9, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

function addressToRaw(address) {
  return Address.parse(address).toRawString();
}

function txLabel(tx) {
  if (tx.action) return tx.action;
  if (tx.body?.label) return tx.body.label;
  if (tx.contract) return `Deploy ${tx.contract}`;
  if (tx.id) return tx.id;
  return 'Transaction';
}

function tonkeeperLinks(tx) {
  const target = tx.target_address;
  const params = new URLSearchParams();
  params.set('amount', String(tx.value_nanotons_recommended || tx.value_nanotons || '0'));
  if (tx.body?.boc_base64) params.set('bin', tx.body.boc_base64);
  if (tx.state_init?.boc_base64) params.set('init', tx.state_init.boc_base64);
  const query = params.toString();
  const path = `transfer/${encodeURIComponent(target)}`;
  return {
    https: `https://app.tonkeeper.com/${path}?${query}`,
    ton: `ton://${path}?${query}`,
  };
}

function collectTransactions(packet) {
  const txs = [];
  for (const [group, value] of Object.entries(packet)) {
    if (!Array.isArray(value)) continue;
    value.forEach((item, index) => {
      if (!item || typeof item !== 'object' || !item.target_address || !item.signer_role) return;
      const sequence = txs.length + 1;
      const id = item.id || `${group}-${index + 1}`;
      const valueNanotons = String(item.value_nanotons_recommended || item.value_nanotons || '0');
      const normalized = {
        sequence,
        group,
        id,
        phase: item.phase || group,
        label: txLabel(item),
        signer_role: item.signer_role,
        signer_address: item.signer_address,
        signer_raw_address: addressToRaw(item.signer_address),
        target_address: item.target_address,
        target_raw_address: item.target_raw_address || null,
        value_nanotons_recommended: valueNanotons,
        value_ton: nanotonsToTon(valueNanotons),
        body_hash: item.body?.boc_sha256_hex || null,
        state_init_hash: item.state_init?.cell_hash_hex || item.state_init?.boc_sha256_hex || null,
        body_bits: item.body?.bits ?? null,
        state_init_bits: item.state_init?.bits ?? null,
        safety_check: item.safety_check || null,
        links: tonkeeperLinks(item),
      };
      normalized.link_length = normalized.links.https.length;
      normalized.long_deeplink = normalized.link_length > LONG_LINK_WARNING_THRESHOLD;
      txs.push(normalized);
    });
  }
  return txs;
}

function transactionBySequence(sequence) {
  const packet = parseJsonFile(packetPath);
  let current = 0;
  for (const [group, value] of Object.entries(packet)) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (!item || typeof item !== 'object' || !item.target_address || !item.signer_role) continue;
      current += 1;
      if (current !== sequence) continue;
      const valueNanotons = String(item.value_nanotons_recommended || item.value_nanotons || '0');
      return {
        sequence: current,
        group,
        id: item.id || `${group}-${current}`,
        label: txLabel(item),
        signer_role: item.signer_role,
        signer_address: item.signer_address,
        signer_raw_address: addressToRaw(item.signer_address),
        target_address: item.target_address,
        value_nanotons_recommended: valueNanotons,
        value_ton: nanotonsToTon(valueNanotons),
        body: item.body
          ? {
              label: item.body.label || null,
              boc_base64: item.body.boc_base64 || null,
              boc_sha256_hex: item.body.boc_sha256_hex || null,
              cell_hash_hex: item.body.cell_hash_hex || null,
            }
          : null,
        state_init: item.state_init
          ? {
              boc_base64: item.state_init.boc_base64 || null,
              boc_sha256_hex: item.state_init.boc_sha256_hex || null,
              cell_hash_hex: item.state_init.cell_hash_hex || null,
              code_hash_hex: item.state_init.code_hash_hex || null,
              data_hash_hex: item.state_init.data_hash_hex || null,
            }
          : null,
      };
    }
  }
  return null;
}

function summarize(txs) {
  const bySigner = new Map();
  for (const tx of txs) {
    const key = `${tx.signer_role}|${tx.signer_address}`;
    const existing = bySigner.get(key) || {
      signer_role: tx.signer_role,
      signer_address: tx.signer_address,
      count: 0,
      total_nanotons: 0n,
      total_ton: '0',
    };
    existing.count += 1;
    existing.total_nanotons += BigInt(tx.value_nanotons_recommended);
    existing.total_ton = nanotonsToTon(existing.total_nanotons);
    bySigner.set(key, existing);
  }
  return Array.from(bySigner.values()).map((item) => ({
    ...item,
    total_nanotons: item.total_nanotons.toString(),
  }));
}

function packetPayload() {
  const packet = parseJsonFile(packetPath);
  const txs = collectTransactions(packet);
  return {
    packet_path: packetPath,
    packet_mtime_ms: statSync(packetPath).mtimeMs,
    document: packet.document,
    generated_at: packet.generated_at,
    production_deploy_executed: packet.production_deploy_executed,
    manifest_hash_hex: packet.manifest_hash_hex,
    tonconnect_manifest_url: tonConnectManifestUrl,
    warnings: packet.warnings || [],
    transactions: txs,
    signers: summarize(txs),
  };
}

const html = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Platho Mainnet Tonkeeper Console</title>
  <script src="https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js"></script>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; background: #111614; color: #eef5ef; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #111614; }
    header { position: sticky; top: 0; z-index: 10; padding: 16px 22px; border-bottom: 1px solid #2b3832; background: rgba(17, 22, 20, .96); backdrop-filter: blur(10px); }
    h1 { margin: 0 0 8px; font-size: 20px; font-weight: 720; letter-spacing: 0; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; color: #b6c6bc; font-size: 13px; }
    .pill { border: 1px solid #34443d; border-radius: 6px; padding: 4px 7px; background: #16201c; }
    main { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 0; min-height: calc(100vh - 81px); }
    aside { border-right: 1px solid #2b3832; padding: 18px; background: #131b18; }
    section { padding: 18px 22px 56px; }
    button, a.button { display: inline-flex; align-items: center; justify-content: center; min-height: 34px; border: 1px solid #40554b; border-radius: 6px; padding: 7px 10px; background: #1d2a25; color: #eef5ef; font: inherit; font-size: 13px; text-decoration: none; cursor: pointer; }
    button:hover, a.button:hover { background: #26362f; }
    button.active { border-color: #8fc7a5; background: #284338; }
    button.tonkeeper { background: #1f5b85; border-color: #2e7caf; }
    button.tonkeeper:hover { background: #286d9d; }
    button.tonconnect { background: #2f735c; border-color: #50a181; }
    button.tonconnect:hover { background: #39896e; }
    button:disabled { opacity: .55; cursor: not-allowed; }
    .sender-list { display: grid; gap: 8px; margin: 12px 0 18px; }
    .sender { width: 100%; justify-content: flex-start; text-align: left; display: grid; gap: 4px; }
    .sender b { display: block; font-size: 13px; }
    .sender span { display: block; color: #b6c6bc; font-size: 12px; overflow-wrap: anywhere; }
    .warn { border: 1px solid #6e5132; background: #241d15; color: #f3d5ad; border-radius: 8px; padding: 10px 12px; font-size: 13px; line-height: 1.45; margin: 0 0 12px; }
    .notice { border: 1px solid #335b4f; background: #13251f; color: #bdebd7; border-radius: 8px; padding: 10px 12px; font-size: 13px; line-height: 1.45; margin: 0 0 12px; }
    .muted { color: #b6c6bc; }
    .tx-grid { display: grid; gap: 12px; }
    .tx { border: 1px solid #2f4038; border-radius: 8px; background: #16201c; padding: 14px; display: grid; gap: 11px; }
    .tx.done { opacity: .62; border-color: #2a3932; }
    .tx-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start; }
    .tx-title { margin: 0; font-size: 15px; font-weight: 700; overflow-wrap: anywhere; }
    .tx-sub { margin-top: 3px; color: #b6c6bc; font-size: 12px; overflow-wrap: anywhere; }
    .kv { display: grid; grid-template-columns: 145px minmax(0, 1fr); gap: 5px 10px; font-size: 12.5px; }
    .kv div:nth-child(odd) { color: #9fb0a7; }
    .kv code { color: #eef5ef; overflow-wrap: anywhere; white-space: normal; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .checks { display: flex; align-items: center; gap: 8px; color: #b6c6bc; font-size: 13px; }
    input[type="checkbox"] { width: 18px; height: 18px; accent-color: #8fc7a5; }
    .search { width: 100%; min-height: 36px; border: 1px solid #34443d; background: #0f1513; color: #eef5ef; border-radius: 6px; padding: 8px 10px; }
    @media (max-width: 880px) {
      main { grid-template-columns: 1fr; }
      aside { border-right: 0; border-bottom: 1px solid #2b3832; }
      .kv { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Platho Mainnet Tonkeeper Console</h1>
    <div class="meta" id="meta"></div>
  </header>
  <main>
    <aside>
      <div class="warn">This local page cannot force Tonkeeper to use a sender wallet. Before signing every transaction, select the sender shown here in Tonkeeper and verify target, value, body hash, and StateInit hash.</div>
      <div class="notice">Long deploy StateInit messages may exceed Tonkeeper deeplink limits. Connect Tonkeeper here and use the TonConnect button for those rows. The connect manifest is public HTTPS only so Tonkeeper can load it; transaction target, amount, body hash, and StateInit hash are still taken from this local packet.</div>
      <div id="tonconnect"></div>
      <input id="search" class="search" placeholder="Filter by id, phase, target, hash">
      <div class="sender-list" id="senders"></div>
      <button id="all" class="active">Show all transactions</button>
    </aside>
    <section>
      <div class="tx-grid" id="txs"></div>
    </section>
  </main>
  <script>
    const state = { data: null, sender: 'all', query: '' };
    let tonConnectUI = null;
    const doneKey = (tx) => 'platho-mainnet-tx-done:' + state.data.manifest_hash_hex + ':' + tx.sequence + ':' + tx.id;

    function esc(text) {
      return String(text ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function renderMeta() {
      const d = state.data;
      document.getElementById('meta').innerHTML = [
        '<span class="pill">packet: ' + esc(d.document) + '</span>',
        '<span class="pill">generated: ' + esc(d.generated_at) + '</span>',
        '<span class="pill">manifest: ' + esc(d.manifest_hash_hex) + '</span>',
        '<span class="pill">tx: ' + d.transactions.length + '</span>'
      ].join('');
    }

    function renderSenders() {
      const list = document.getElementById('senders');
      list.innerHTML = state.data.signers.map((s) => {
        const key = s.signer_role + '|' + s.signer_address;
        const active = state.sender === key ? ' active' : '';
        return '<button class="sender' + active + '" data-sender="' + esc(key) + '">' +
          '<b>' + esc(s.signer_role) + ' · ' + s.count + ' tx · ' + esc(s.total_ton) + ' TON</b>' +
          '<span>' + esc(s.signer_address) + '</span>' +
        '</button>';
      }).join('');
      list.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.sender = btn.dataset.sender;
          document.getElementById('all').classList.remove('active');
          render();
        });
      });
      document.getElementById('all').onclick = () => {
        state.sender = 'all';
        document.getElementById('all').classList.add('active');
        render();
      };
    }

    function txMatches(tx) {
      if (state.sender !== 'all' && state.sender !== tx.signer_role + '|' + tx.signer_address) return false;
      const q = state.query.trim().toLowerCase();
      if (!q) return true;
      return [
        tx.id, tx.phase, tx.group, tx.label, tx.signer_role, tx.signer_address,
        tx.target_address, tx.body_hash, tx.state_init_hash
      ].some((v) => String(v || '').toLowerCase().includes(q));
    }

    async function copy(text) {
      await navigator.clipboard.writeText(text);
    }

    function initTonConnect() {
      if (tonConnectUI) return tonConnectUI;
      if (!window.TON_CONNECT_UI?.TonConnectUI) return null;
      tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
        manifestUrl: state.data?.tonconnect_manifest_url || window.location.origin + '/tonconnect-manifest.json',
        buttonRootId: 'tonconnect'
      });
      return tonConnectUI;
    }

    async function sendViaTonConnect(sequence, btn) {
      const ui = initTonConnect();
      if (!ui) {
        alert('TonConnect UI script is not loaded. Check internet access, then refresh this page.');
        return;
      }
      if (!ui.connected) {
        ui.openModal();
        alert('Connect the sender wallet in Tonkeeper first, then click this TonConnect send button again.');
        return;
      }
      const tx = await fetch('/api/tx/' + encodeURIComponent(sequence)).then((r) => r.json());
      if (!tx.ok) {
        alert('Could not load transaction payload: ' + (tx.error || 'unknown error'));
        return;
      }
      const item = tx.transaction;
      const message = {
        address: item.target_address,
        amount: item.value_nanotons_recommended
      };
      if (item.body?.boc_base64) message.payload = item.body.boc_base64;
      if (item.state_init?.boc_base64) message.stateInit = item.state_init.boc_base64;

      const request = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        network: '-239',
        from: item.signer_raw_address || item.signer_address,
        messages: [message]
      };

      const old = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Opening Tonkeeper...';
      try {
        await ui.sendTransaction(request);
        btn.textContent = 'Sent to wallet';
      } catch (error) {
        alert('TonConnect send was not completed: ' + (error?.message || String(error)));
        btn.textContent = old;
      } finally {
        btn.disabled = false;
      }
    }

    function renderTxs() {
      const txs = state.data.transactions.filter(txMatches);
      document.getElementById('txs').innerHTML = txs.map((tx) => {
        const done = localStorage.getItem(doneKey(tx)) === '1';
        const href = tx.links.https;
        const longWarning = tx.long_deeplink
          ? '<div class="warn">Long Tonkeeper deeplink (' + tx.link_length + ' chars). Use TonConnect for this row; the direct deeplink can fail before Tonkeeper opens.</div>'
          : '';
        const primaryButton = tx.long_deeplink
          ? '<button class="tonconnect" data-tonconnect="' + tx.sequence + '">Send via TonConnect</button>'
          : '<button class="tonkeeper" data-open="' + esc(href) + '">Open Tonkeeper</button>';
        return '<article class="tx' + (done ? ' done' : '') + '" data-seq="' + tx.sequence + '">' +
          '<div class="tx-head">' +
            '<div><h2 class="tx-title">#' + tx.sequence + ' · ' + esc(tx.id) + ' · ' + esc(tx.label) + '</h2>' +
            '<div class="tx-sub">' + esc(tx.phase) + ' · ' + esc(tx.group) + '</div></div>' +
            '<label class="checks"><input type="checkbox" ' + (done ? 'checked' : '') + '> signed</label>' +
          '</div>' +
          '<div class="kv">' +
            '<div>Sender role</div><div><code>' + esc(tx.signer_role) + '</code></div>' +
            '<div>Sender wallet</div><div><code>' + esc(tx.signer_address) + '</code></div>' +
            '<div>Target</div><div><code>' + esc(tx.target_address) + '</code></div>' +
            '<div>Value</div><div><code>' + esc(tx.value_ton) + ' TON (' + esc(tx.value_nanotons_recommended) + ' nanotons)</code></div>' +
            '<div>Body hash</div><div><code>' + esc(tx.body_hash || 'none') + '</code></div>' +
            '<div>StateInit hash</div><div><code>' + esc(tx.state_init_hash || 'none') + '</code></div>' +
          '</div>' +
          (tx.safety_check ? '<div class="warn">' + esc(tx.safety_check) + '</div>' : '') +
          longWarning +
          '<div class="actions">' +
            primaryButton +
            (tx.long_deeplink ? '<button data-open="' + esc(href) + '">Try direct deeplink</button>' : '') +
            '<button data-copy="' + esc(href) + '">Copy Tonkeeper link</button>' +
            '<button data-copy="' + esc(tx.links.ton) + '">Copy ton:// link</button>' +
            '<button data-copy="' + esc(tx.target_address) + '">Copy target</button>' +
          '</div>' +
        '</article>';
      }).join('');
      document.querySelectorAll('[data-open]').forEach((btn) => btn.addEventListener('click', () => window.open(btn.dataset.open, '_blank', 'noopener')));
      document.querySelectorAll('[data-tonconnect]').forEach((btn) => btn.addEventListener('click', () => sendViaTonConnect(btn.dataset.tonconnect, btn)));
      document.querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
        await copy(btn.dataset.copy);
        const old = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = old; }, 900);
      }));
      document.querySelectorAll('.tx').forEach((card) => {
        const tx = state.data.transactions.find((item) => String(item.sequence) === card.dataset.seq);
        const input = card.querySelector('input[type="checkbox"]');
        input.addEventListener('change', () => {
          if (input.checked) localStorage.setItem(doneKey(tx), '1');
          else localStorage.removeItem(doneKey(tx));
          renderTxs();
        });
      });
    }

    function render() {
      renderMeta();
      renderSenders();
      renderTxs();
    }

    fetch('/api/packet').then((r) => r.json()).then((data) => {
      state.data = data;
      initTonConnect();
      document.getElementById('search').addEventListener('input', (event) => {
        state.query = event.target.value;
        renderTxs();
      });
      render();
    });
  </script>
</body>
</html>`;

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${host}:${port}`);
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, packetPath }));
    return;
  }
  if (url.pathname === '/api/packet') {
    try {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(packetPayload()));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: error?.message || String(error) }));
    }
    return;
  }
  if (url.pathname.startsWith('/api/tx/')) {
    try {
      const sequence = Number(url.pathname.slice('/api/tx/'.length));
      const transaction = transactionBySequence(sequence);
      if (!transaction) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'transaction not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, transaction }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: error?.message || String(error) }));
    }
    return;
  }
  if (url.pathname === '/tonconnect-manifest.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      url: `http://${host}:${port}/`,
      name: 'Platho Mainnet Deploy Console',
      iconUrl: `http://${host}:${port}/tonconnect-icon.svg`,
      termsOfUseUrl: `http://${host}:${port}/`,
      privacyPolicyUrl: `http://${host}:${port}/`
    }));
    return;
  }
  if (url.pathname === '/tonconnect-icon.svg') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="18" fill="#16201c"/><path d="M24 34h80L64 106 24 34Z" fill="#8fc7a5"/><path d="M38 44h52L64 91 38 44Z" fill="#111614"/></svg>');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(port, host, () => {
  console.log(`Platho Tonkeeper console: http://${host}:${port}/`);
  console.log(`Packet: ${packetPath}`);
});
