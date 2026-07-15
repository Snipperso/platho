// Empirical STON.fi v2.1 testnet refund-topology probe.
// Sends a deliberately-failing TON->jetton swap (minAskAmount impossibly high) from the
// disposable wallet into a live pool, then observes the SOURCE of the native-TON refund.
// Expected (per static analysis): refund src == router-owned pTON wallet kQBbJjnah... (whitelist slot #1).
import { readFileSync } from 'fs';
import { Address, internal, toNano, beginCell } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { DEX, pTON } from '@ston-fi/sdk';
import { makeTestnetClient, parseEnv, rpc, sleep } from './testnet_rpc.mjs';

const ROUTER = Address.parse('kQALh-JBBIKK7gr0o4AVf9JZnEsFndqO0qTCyT-D-yBsWk0v');
const PTON_MASTER = Address.parse('kQACS30DNoUQ7NfApPvzh7eBmSZ9L4ygJ-lkNWtba8TQT-Px');
const EXPECTED_REFUND_SRC = Address.parse('kQBbJjnahBMGbMUJwhAXLn8BiigcGXMJhSC0l7DBhdYABhG7');
const ASK_JETTON = Address.parse(JSON.parse(readFileSync('artifacts/local/tier2_testnet.json', 'utf8')).athMaster); // MY testnet ATH (own pool)
const OFFER = toNano('1');
const MIN_ASK = 1000000000000000000000n; // 10^21 atomic — impossibly high => min_out failure
const QUERY_ID = 424242;

function fr(a) { return a.toString({ testOnly: true, bounceable: true }); }
const env = parseEnv();
const { client, hasKey } = makeTestnetClient();
const SP = hasKey ? 150 : 1200;

const keyPair = await mnemonicToPrivateKey(env.PLATHO_TESTNET_DEPLOYER_MNEMONIC.split(/\s+/).filter(Boolean));
const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
const opened = client.open(wallet);
console.log('probe wallet:', fr(wallet.address));

// baseline: newest incoming tx lt (to detect the refund arriving after)
async function newestLt() {
  try { const txs = await rpc('tx', () => client.getTransactions(wallet.address, { limit: 1 }), { spacingMs: SP }); return txs[0]?.lt ?? 0n; }
  catch { return 0n; }
}
const baselineLt = await newestLt();

// build the failing swap via the SDK (derives pool + ask jetton wallet + pTON wallet)
const router = client.open(DEX.v2_1.Router.CPI.create(ROUTER));
const proxyTon = pTON.v2_1.create(PTON_MASTER);
const tx = await rpc('buildSwap', () => router.getSwapTonToJettonTxParams({
  userWalletAddress: wallet.address,
  proxyTon,
  offerAmount: OFFER,
  askJettonAddress: ASK_JETTON,
  minAskAmount: MIN_ASK,
  queryId: QUERY_ID,
}), { spacingMs: SP });
console.log('swap tx params: to=' + fr(tx.to) + ' value=' + tx.value.toString());
console.log('  (to == router-owned pTON wallet? ' + (fr(tx.to) === fr(EXPECTED_REFUND_SRC)) + ')');

// send from the (uninit) wallet — provider attaches stateInit on first send
let seqno = 0;
try { seqno = await rpc('seqno', () => opened.getSeqno(), { spacingMs: SP }); } catch { seqno = 0; }
await rpc('send', () => opened.sendTransfer({
  seqno, secretKey: keyPair.secretKey,
  messages: [internal({ to: tx.to, value: tx.value, bounce: true, body: tx.body })],
}), { spacingMs: SP });
console.log('sent swap at seqno ' + seqno + '. waiting for min_out failure + refund...');

// poll for the incoming refund (a new incoming internal message after baselineLt)
let refund = null;
for (let i = 0; i < 30; i++) {
  await sleep(6000);
  let txs;
  try { txs = await rpc('poll', () => client.getTransactions(wallet.address, { limit: 6 }), { spacingMs: SP }); } catch { continue; }
  for (const t of txs) {
    if (t.lt <= baselineLt) continue;
    const inMsg = t.inMessage;
    const src = inMsg?.info?.src;
    const val = inMsg?.info?.value?.coins ?? 0n;
    // the refund is an incoming value-bearing message from a STON.fi contract (not our own out)
    if (src && val > toNano('0.1') && !src.equals(wallet.address)) {
      refund = { src: fr(src), valueTON: (Number(val) / 1e9).toFixed(4), lt: t.lt.toString() };
      break;
    }
  }
  if (refund) break;
  console.log('  ...waiting (' + ((i + 1) * 6) + 's)');
}

const pass = refund && refund.src === fr(EXPECTED_REFUND_SRC);
console.log(JSON.stringify({
  RESULT: refund ? (pass ? 'PASS' : 'MISMATCH') : 'NO_REFUND_OBSERVED',
  refundObserved: refund,
  expectedRefundSrc: fr(EXPECTED_REFUND_SRC),
  match: pass,
  meaning: pass
    ? 'Failed-swap native-TON refund src == router-owned pTON wallet == BuybackBurn whitelist slot #1. Topology CONFIRMED.'
    : (refund ? 'Refund arrived from a DIFFERENT address — investigate as a potential 4th-address slot BEFORE genesis-seal.' : 'No refund seen in the poll window; re-check on testnet.tonviewer.'),
  walletExplorer: 'https://testnet.tonviewer.com/' + fr(wallet.address),
}, null, 2));
