// Read-only (no funding): derive the STON.fi v2.1 testnet router-owned pTON jetton-wallet
// = ptonMaster.get_wallet_address(router). Per the static analysis this is the EXPECTED
// source address of the failed-swap native-TON refund == BuybackBurn whitelist slot #1.
import { Address, beginCell, TupleReader } from '@ton/core';
import { TonClient } from '@ton/ton';

const ROUTER = Address.parse('kQALh-JBBIKK7gr0o4AVf9JZnEsFndqO0qTCyT-D-yBsWk0v');
const PTON_MASTER = Address.parse('kQACS30DNoUQ7NfApPvzh7eBmSZ9L4ygJ-lkNWtba8TQT-Px');

const client = new TonClient({ endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC' });

async function tryGet(method) {
  const res = await client.runMethod(PTON_MASTER, method, [
    { type: 'slice', cell: beginCell().storeAddress(ROUTER).endCell() },
  ]);
  const reader = new TupleReader(res.stack.items ?? res.stack);
  const addr = reader.readAddress();
  return addr;
}

const candidates = ['get_wallet_address', 'get_pton_wallet_address', 'get_wallet_addr'];
let result = null, usedMethod = null, lastErr = null;
for (const m of candidates) {
  try {
    const addr = await tryGet(m);
    result = addr; usedMethod = m; break;
  } catch (e) {
    lastErr = String(e?.message ?? e);
  }
}

if (!result) {
  console.log(JSON.stringify({ ok: false, error: `no get-method worked: ${lastErr}`, tried: candidates }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  method: usedMethod,
  ptonMaster: PTON_MASTER.toString({ testOnly: true, bounceable: true }),
  router: ROUTER.toString({ testOnly: true, bounceable: true }),
  routerOwnedPtonWallet_bounceable: result.toString({ testOnly: true, bounceable: true }),
  routerOwnedPtonWallet_raw: `${result.workChain}:${result.hash.toString('hex')}`,
  meaning: 'EXPECTED source of the failed-swap native-TON refund == BuybackBurn whitelist slot #1 (stonfi_pton_wallet_address). Empirical testnet run should show refund src == this.',
}, null, 2));
