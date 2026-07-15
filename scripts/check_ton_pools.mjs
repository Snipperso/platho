// For candidate jetton masters, derive the router's jetton wallet, then ask the router for the
// TON/jetton pool address, and check the pool is active with reserves. Prints the first usable one.
import { Address, TupleReader, beginCell } from '@ton/core';
import { makeTestnetClient, rpc } from './testnet_rpc.mjs';

const ROUTER = Address.parse('kQALh-JBBIKK7gr0o4AVf9JZnEsFndqO0qTCyT-D-yBsWk0v');
const PTON_WALLET = Address.parse('kQBbJjnahBMGbMUJwhAXLn8BiigcGXMJhSC0l7DBhdYABhG7');
const { client, hasKey } = makeTestnetClient();
const SP = hasKey ? 140 : 1200;
function fr(a) { return a.toString({ testOnly: true, bounceable: true }); }

const CANDIDATES = {
  pGRAM: '0:024b7d03368510ecd7c0a4fbf387b78199267d2f8ca027e964356b5b6bc4d04f',
  TRT: '0:cbbec6689778ee672380546f2d5ac267b4ec5e11958469609b6d28d86a4429b9',
  TBT: '0:7f4ce25207bab7f899b53bcb348ca16da8b1256433e3013b39b891acba3723ce',
  USDT: '0:ec28f4aa5b2c2d829316f3ec3a26ea6ba4e010cc1c9db00dc5f663e5849d7d5d',
};

async function walletAddr(master, owner) {
  const res = await rpc('gwa', () => client.runMethod(master, 'get_wallet_address', [
    { type: 'slice', cell: beginCell().storeAddress(owner).endCell() },
  ]), { spacingMs: SP });
  return new TupleReader(res.stack.items ?? res.stack).readAddress();
}
async function poolAddr(w0, w1) {
  const res = await rpc('gpa', () => client.runMethod(ROUTER, 'get_pool_address', [
    { type: 'slice', cell: beginCell().storeAddress(w0).endCell() },
    { type: 'slice', cell: beginCell().storeAddress(w1).endCell() },
  ]), { spacingMs: SP });
  return new TupleReader(res.stack.items ?? res.stack).readAddress();
}
async function poolActive(p) {
  try { const s = await rpc('st', () => client.getContractState(p), { spacingMs: SP }); return { state: s.state, balTON: (Number(s.balance) / 1e9).toFixed(2) }; }
  catch (e) { return { state: 'err', err: String(e.message).slice(0, 30) }; }
}

const out = [];
for (const [sym, m] of Object.entries(CANDIDATES)) {
  try {
    const jw = await walletAddr(Address.parse(m), ROUTER);
    const p = await poolAddr(PTON_WALLET, jw);
    const st = await poolActive(p);
    out.push({ sym, master: m, jettonWalletOfRouter: fr(jw), pool: fr(p), ...st });
  } catch (e) { out.push({ sym, err: String(e.message).slice(0, 40) }); }
}
console.log(JSON.stringify({ hasKey, candidates: out }, null, 2));
