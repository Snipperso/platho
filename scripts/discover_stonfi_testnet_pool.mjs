// Read-only: discover an ACTIVE STON.fi v2.1 testnet TON/jetton pool by scanning the
// ROUTER's recent counterparties and probing get_pool_data (keyed toncenter, 10rps).
import { Address } from '@ton/core';
import { makeTestnetClient, rpc } from './testnet_rpc.mjs';

const ROUTER = Address.parse('kQALh-JBBIKK7gr0o4AVf9JZnEsFndqO0qTCyT-D-yBsWk0v');
const PTON_WALLET = Address.parse('kQBbJjnahBMGbMUJwhAXLn8BiigcGXMJhSC0l7DBhdYABhG7');
const { client, hasKey } = makeTestnetClient();
const SP = hasKey ? 150 : 1200;

function fr(a) { return a.toString({ testOnly: true, bounceable: true }); }

async function classify(addr) {
  // get_pool_data present => pool. Return the two jetton wallets (token0/token1) if parseable.
  try {
    const res = await rpc('get_pool_data', () => client.runMethod(addr, 'get_pool_data'), { spacingMs: SP });
    const items = res.stack.items ?? res.stack;
    const wallets = [];
    for (const it of items) {
      const cell = it.cell || it.value?.cell;
      if (cell) { try { const a = cell.beginParse().loadAddress(); if (a) wallets.push(fr(a)); } catch {} }
    }
    return { kind: 'pool', wallets };
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (msg.includes('exit_code') || msg.includes('exit code')) return { kind: 'not-pool' };
    return { kind: 'err', msg: msg.slice(0, 50) };
  }
}

const txs = await rpc('getTransactions', () => client.getTransactions(ROUTER, { limit: 40 }), { spacingMs: SP });
const counterparties = new Set();
for (const tx of txs) {
  const inSrc = tx.inMessage?.info?.src; if (inSrc) counterparties.add(fr(inSrc));
  for (const out of tx.outMessages.values()) {
    const dst = out.info?.dest; if (dst) counterparties.add(fr(dst));
  }
}
counterparties.delete(fr(ROUTER));
counterparties.delete(fr(PTON_WALLET));

const pools = [];
let notPool = 0, errs = 0;
for (const cp of counterparties) {
  const c = await classify(Address.parse(cp));
  if (c.kind === 'pool') pools.push({ pool: cp, tokenWallets: c.wallets });
  else if (c.kind === 'not-pool') notPool++;
  else errs++;
}

console.log(JSON.stringify({
  ok: pools.length > 0, hasKey, scannedTxs: txs.length,
  candidates: counterparties.size, poolsFound: pools.length, notPool, errs,
  pools: pools.slice(0, 8),
  ptonWalletForReference: fr(PTON_WALLET),
}, null, 2));
