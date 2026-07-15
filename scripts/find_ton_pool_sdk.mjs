// Use the STON.fi SDK's own derivation to find a live TON/jetton pool (NO deploy):
// router.getPoolAddressByJettonMinters(pTON, jettonMaster) -> Pool.getPoolData() -> reserves.
import { Address } from '@ton/core';
import { DEX, pTON } from '@ston-fi/sdk';
import { makeTestnetClient, sleep } from './testnet_rpc.mjs';

const ROUTER = Address.parse('kQALh-JBBIKK7gr0o4AVf9JZnEsFndqO0qTCyT-D-yBsWk0v');
const PTON_MASTER = Address.parse('kQACS30DNoUQ7NfApPvzh7eBmSZ9L4ygJ-lkNWtba8TQT-Px');
const { client } = makeTestnetClient();
const router = client.open(DEX.v2_1.Router.CPI.create(ROUTER));
const proxyTon = pTON.v2_1.create(PTON_MASTER);
function fr(a) { return a.toString ? a.toString({ testOnly: true, bounceable: true }) : String(a); }

const CANDIDATES = {
  pGRAM: '0:024b7d03368510ecd7c0a4fbf387b78199267d2f8ca027e964356b5b6bc4d04f',
  TRT: '0:cbbec6689778ee672380546f2d5ac267b4ec5e11958469609b6d28d86a4429b9',
  TBT: '0:7f4ce25207bab7f899b53bcb348ca16da8b1256433e3013b39b891acba3723ce',
  GOOSE: '0:5d6a5b46acf5903a5ec5537998d6be2ee6fabc7bbdeb33f60fc5cd8a26a0c69d',
};

const out = [];
for (const [sym, m] of Object.entries(CANDIDATES)) {
  try {
    const poolAddr = await router.getPoolAddressByJettonMinters({
      token0: proxyTon.address, token1: Address.parse(m),
    });
    await sleep(200);
    const pool = client.open(DEX.v2_1.Pool.create(poolAddr));
    let reserves = null, poolType = null;
    try { const d = await pool.getPoolData(); reserves = { r0: d.reserve0?.toString?.() ?? String(d.reserve0), r1: d.reserve1?.toString?.() ?? String(d.reserve1) }; }
    catch (e) { reserves = 'getPoolData ERR: ' + String(e.message).slice(0, 40); }
    out.push({ sym, master: m, pool: fr(poolAddr), reserves });
  } catch (e) { out.push({ sym, err: String(e.message).slice(0, 60) }); }
  await sleep(200);
}
console.log(JSON.stringify(out, null, 2));
