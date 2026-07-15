// Tier-2 Phase 2: create a TON/ATH pool by providing two-sided initial liquidity via the SDK.
import { readFileSync } from 'fs';
import { Address, internal, toNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { DEX, pTON } from '@ston-fi/sdk';
import { makeTestnetClient, parseEnv, rpc, sleep } from './testnet_rpc.mjs';

const ROUTER = Address.parse('kQALh-JBBIKK7gr0o4AVf9JZnEsFndqO0qTCyT-D-yBsWk0v');
const PTON_MASTER = Address.parse('kQACS30DNoUQ7NfApPvzh7eBmSZ9L4ygJ-lkNWtba8TQT-Px');
const TON_LIQ = toNano('3');
const ATH_LIQ = 3000000000000000n; // 3,000,000 ATH atomic (10^9/ATH)

const t2 = JSON.parse(readFileSync('artifacts/local/tier2_testnet.json', 'utf8'));
const ATH_MASTER = Address.parse(t2.athMaster);
const env = parseEnv();
const { client, hasKey } = makeTestnetClient();
const SP = hasKey ? 150 : 1200;
const fr = (a) => a.toString({ testOnly: true, bounceable: true });

const keyPair = await mnemonicToPrivateKey(env.PLATHO_TESTNET_DEPLOYER_MNEMONIC.split(/\s+/).filter(Boolean));
const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
const opened = client.open(wallet);
const me = wallet.address;

const router = client.open(DEX.v2_1.Router.CPI.create(ROUTER));
const proxyTon = pTON.v2_1.create(PTON_MASTER);

async function send(label, tx) {
  const seqno = await rpc('seqno', () => opened.getSeqno(), { spacingMs: SP });
  await rpc('send', () => opened.sendTransfer({ seqno, secretKey: keyPair.secretKey, messages: [internal({ to: tx.to, value: tx.value, bounce: true, body: tx.body })] }), { spacingMs: SP });
  console.log(label + ' sent -> to=' + fr(tx.to) + ' value=' + tx.value.toString() + ' seqno=' + seqno);
  // wait for seqno to advance
  for (let i = 0; i < 20; i++) { await sleep(3000); const s = await rpc('sq', () => opened.getSeqno(), { spacingMs: SP }); if (s > seqno) return; }
}

// TON side
const tonTx = await rpc('lpTon', () => router.getProvideLiquidityTonTxParams({
  userWalletAddress: me, proxyTon, otherTokenAddress: ATH_MASTER, sendAmount: TON_LIQ, minLpOut: 1n, bothPositive: true,
}), { spacingMs: SP });
await send('LP TON side', tonTx);

// jetton (ATH) side
const jetTx = await rpc('lpJet', () => router.getProvideLiquidityJettonTxParams({
  userWalletAddress: me, sendTokenAddress: ATH_MASTER, otherTokenAddress: proxyTon.address, sendAmount: ATH_LIQ, minLpOut: 1n,
}), { spacingMs: SP });
await send('LP ATH side', jetTx);

console.log('both LP sides sent. waiting ~30s for pool creation...');
await sleep(30000);

// try to read the pool
let poolInfo = 'unknown';
try {
  const poolAddr = await rpc('pa', () => router.getPoolAddressByJettonMinters({ token0: proxyTon.address, token1: ATH_MASTER }), { spacingMs: SP });
  const pool = client.open(DEX.v2_1.Pool.create(poolAddr));
  try { const d = await rpc('pd', () => pool.getPoolData(), { spacingMs: SP }); poolInfo = { pool: fr(poolAddr), reserve0: String(d.reserve0), reserve1: String(d.reserve1) }; }
  catch (e) { poolInfo = { pool: fr(poolAddr), getPoolData: 'ERR ' + String(e.message).slice(0, 40) }; }
} catch (e) { poolInfo = 'getPoolAddress ERR ' + String(e.message).slice(0, 40); }

console.log(JSON.stringify({ RESULT: 'LP_SENT', pool: poolInfo, athMaster: fr(ATH_MASTER) }, null, 2));
