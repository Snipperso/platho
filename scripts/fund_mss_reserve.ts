// Fund the 60M MarketStabilitySeller genesis reserve (owner-directed). The treasury owner
// (bound reserve_funder) sends 60M ATH -> MSS with notify; the MSS credits reserve_due_ath.
// IRREVERSIBLE: once funded the reserve is locked (no owner-withdrawal; only tranche sales).
// DRY-RUN by default; --broadcast sends. ts-node --compiler-options '{"module":"CommonJS"}'
import { readFileSync } from 'node:fs';
import { Address, beginCell, internal, SendMode, toNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV5R1, WalletContractV4, WalletContractV3R2, TonClient } from '@ton/ton';
import { storeATHTransferRequestWithNotify } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { MarketStabilitySeller } from '../build/MarketStabilitySeller/MarketStabilitySeller_MarketStabilitySeller';

const TREASURY = 'UQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOATH';
const RESERVE_ATOMIC = 60000000000000000n; // 60,000,000 ATH
const NOTIFY_VALUE = 80000000n;
const SEND_VALUE = toNano('0.3');
const DO_BROADCAST = process.argv.includes('--broadcast');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const key = readFileSync('artifacts/local/center.txt', 'utf8').trim();
  const client = new TonClient({ endpoint: 'https://toncenter.com/api/v2/jsonRPC', apiKey: key });
  const A = JSON.parse(readFileSync('artifacts/local/mainnet_final_manifest_draft.json', 'utf8')).manifest.addresses;
  const MSS = Address.parse(A.market_stability_seller);

  const rawSeed = readFileSync('artifacts/local/treasury_owner.secret.txt', 'utf8').replace(/^﻿/, '').trim();
  let words: string[]; try { const jp = JSON.parse(rawSeed); words = Array.isArray(jp) ? jp.map((w: any) => String(w).trim()).filter(Boolean) : rawSeed.split(/\s+/).filter(Boolean); } catch { words = rawSeed.split(/\s+/).filter(Boolean); }
  const kp = await mnemonicToPrivateKey(words);
  const cands = [WalletContractV5R1, WalletContractV4, WalletContractV3R2].map((C: any) => C.create({ workchain: 0, publicKey: kp.publicKey }));
  const wallet = cands.find((c) => c.address.toRawString() === Address.parse(TREASURY).toRawString());
  if (!wallet) throw new Error('treasury_owner seed mismatch');
  const opened = client.open(wallet);

  // treasury owner ATH wallet + balance (master read from the live manifest, not hardcoded)
  const r = await client.runMethod(Address.parse(A.ath_master), 'get_wallet_address', [{ type: 'slice', cell: beginCell().storeAddress(Address.parse(TREASURY)).endCell() }]);
  const treasuryAth = r.stack.readAddress();
  const b = await client.runMethod(treasuryAth, 'get_wallet_data'); const treasuryBal = b.stack.readBigNumber();

  // current MSS reserve state
  const ms = client.open(MarketStabilitySeller.fromAddress(MSS));
  const totals: any = await ms.getGetMarketStabilitySellerTotals();
  const cfg: any = await ms.getGetMarketStabilitySellerConfig();
  const fundedNow = BigInt((totals.reserve_funded_total_ath ?? 0n).toString());

  console.log('SIGNER (reserve_funder = treasury owner):', wallet.address.toString({ bounceable: false }).slice(0, 18));
  console.log('SOURCE treasury owner ATH wallet:', treasuryAth.toString({ bounceable: true }).slice(0, 20), '=', (Number(treasuryBal) / 1e9).toLocaleString(), 'ATH');
  console.log('RECIPIENT = MarketStabilitySeller', MSS.toString({ bounceable: true }));
  console.log('AMOUNT to lock into reserve:', (Number(RESERVE_ATOMIC) / 1e9).toLocaleString(), 'ATH');
  console.log('MSS reserve_funded_total NOW:', (Number(fundedNow) / 1e9).toLocaleString(), '| sealed:', cfg.sealed, '| reserve_funder_bound:', cfg.reserve_funder_bound);

  if (treasuryBal < RESERVE_ATOMIC) throw new Error('ABORT: treasury has < 60M ATH');
  if (fundedNow + RESERVE_ATOMIC > RESERVE_ATOMIC) { if (fundedNow > 0n) throw new Error('ABORT: reserve already partially funded (' + fundedNow + ')'); }

  const body = beginCell().store(storeATHTransferRequestWithNotify({
    $$type: 'ATHTransferRequestWithNotify', query_id: 8001n, amount: RESERVE_ATOMIC,
    recipient: MSS, response_destination: Address.parse(TREASURY), notify_destination: MSS, notify_value: NOTIFY_VALUE,
  })).endCell();

  if (!DO_BROADCAST) { console.log('\nDRY-RUN — nothing sent. Re-run with --broadcast to LOCK 60M into the MSS reserve (irreversible).\n'); return; }

  const seqno = await opened.getSeqno();
  await opened.sendTransfer({ seqno, secretKey: kp.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY, messages: [internal({ to: treasuryAth, value: SEND_VALUE, bounce: true, body })] });
  console.log('\nATHTransferRequestWithNotify sent (seqno ' + seqno + '). waiting for MSS reserve_funded_total -> 60M ...');
  for (let i = 0; i < 25; i++) {
    await sleep(6000);
    try { const t: any = await ms.getGetMarketStabilitySellerTotals(); const f = BigInt((t.reserve_funded_total_ath ?? 0n).toString()); if (f >= RESERVE_ATOMIC) { console.log('  ✅ MSS reserve_funded_total =', (Number(f) / 1e9).toLocaleString(), 'ATH — reserve locked.'); return; } console.log('  ...reserve_funded_total', (Number(f) / 1e9).toLocaleString(), 'ATH (' + ((i + 1) * 6) + 's)'); } catch {}
  }
  console.log('  sent; reserve not yet at 60M — re-check the MSS getter / tonviewer.');
}
main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
