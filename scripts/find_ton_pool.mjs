// Find a real STON.fi v2.1 testnet TON/jetton pool: the router-owned pTON wallet is the
// TON side of every TON pool, so its counterparties tagged stonfi_pool_v2 are TON pools.
// Then read the pool's jetton-side wallet -> its jetton master (usable as SDK askJettonAddress).
import { Address } from '@ton/core';
import { makeTestnetClient, rpc } from './testnet_rpc.mjs';

const ROUTER = Address.parse('kQALh-JBBIKK7gr0o4AVf9JZnEsFndqO0qTCyT-D-yBsWk0v');
const PTON_WALLET = Address.parse('kQBbJjnahBMGbMUJwhAXLn8BiigcGXMJhSC0l7DBhdYABhG7');
const SCAN = ROUTER;
const { client, hasKey } = makeTestnetClient();
const SP = hasKey ? 140 : 1200;
function fr(a) { return a.toString({ testOnly: true, bounceable: true }); }
function raw(a) { return a.workChain + ':' + a.hash.toString('hex'); }

async function tonapiInterfaces(addrs) {
  const map = {};
  for (const addr of addrs) {
    try {
      const res = await fetch('https://testnet.tonapi.io/v2/accounts/' + encodeURIComponent(addr));
      const j = await res.json();
      map[addr] = j.interfaces || [];
    } catch { map[addr] = []; }
    await new Promise(r => setTimeout(r, 120));
  }
  return map;
}

const txs = await rpc('scanTxs', () => client.getTransactions(SCAN, { limit: 48 }), { spacingMs: SP });
const cps = new Set();
for (const tx of txs) {
  const s = tx.inMessage?.info?.src; if (s) cps.add(raw(s));
  for (const o of tx.outMessages.values()) { const d = o.info?.dest; if (d) cps.add(raw(d)); }
}
cps.delete(raw(SCAN)); cps.delete(raw(PTON_WALLET));
const ifaces = await tonapiInterfaces([...cps]);
const pools = Object.entries(ifaces).filter(([, v]) => v.includes('stonfi_pool_v2')).map(([a]) => a);

const found = [];
for (const p of pools.slice(0, 4)) {
  try {
    const pd = await rpc('poolData', () => client.runMethod(Address.parse(p), 'get_pool_data'), { spacingMs: SP });
    // find the two token wallets in the returned tuple (address-typed cells)
    const wallets = [];
    for (const it of (pd.stack.items ?? pd.stack)) {
      const cell = it.cell || it.value?.cell;
      if (cell) { try { const a = cell.beginParse().loadAddress(); if (a) wallets.push(a); } catch {} }
    }
    const jettonSide = wallets.find(w => raw(w) !== raw(PTON_WALLET));
    let jettonMaster = null;
    if (jettonSide) {
      const wd = await rpc('walletData', () => client.runMethod(jettonSide, 'get_wallet_data'), { spacingMs: SP });
      const items = wd.stack.items ?? wd.stack;
      for (const it of items) { const cell = it.cell || it.value?.cell; if (cell) { try { const a = cell.beginParse().loadAddress(); if (a && raw(a) !== raw(jettonSide)) jettonMaster = a; } catch {} } }
    }
    found.push({ pool: fr(Address.parse(p)), tonSideIsPtonWallet: wallets.some(w => raw(w) === raw(PTON_WALLET)), jettonWallet: jettonSide ? fr(jettonSide) : null, jettonMaster: jettonMaster ? raw(jettonMaster) : null });
  } catch (e) { found.push({ pool: p, err: String(e.message).slice(0, 40) }); }
}

console.log(JSON.stringify({ hasKey, poolsSeen: pools.length, found }, null, 2));
