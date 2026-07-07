// Burn the leftover clean-14 (dead-set, superseded by clean-15) ATH sitting in the treasury
// owner's OLD ATH wallet, so it no longer clutters the wallet next to the live clean-15 ATH.
// Owner-directed. DRY-RUN by default; --broadcast sends. Run: ts-node --compiler-options '{"module":"CommonJS"}'
//
// SCOPE: only the treasury owner's own dead clean-14 ATH wallet is burnable here. The Vault/Vesting/MSS
// clean-14 allocations are locked inside the now-dead clean-14 contracts (owned by those contracts, no
// burn-to-signer path) and are permanently orphaned — inert, no market/pool/app points at clean-14 ATH.
import { readFileSync } from 'node:fs';
import { Address, beginCell, internal, SendMode, toNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV5R1, WalletContractV4, WalletContractV3R2, TonClient } from '@ton/ton';
import { storeATHBurn } from '../build/ATHWallet/ATHWallet_ATHWallet';

const TREASURY = 'UQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOATH';
const DEAD_ATH_MASTER = 'UQAyC-MgeacFW5-FeqHYckzrbI06y40OmloCU5cxBIof6Z8g';  // DEAD clean-14 master (superseded)
const LIVE_ATH_MASTER = 'UQAMx3PgZCEDrGtsOcfK82wONP8RkMRHSR-4DDTUuEIFcF6b';  // LIVE clean-15 — must NOT touch
const DO_BROADCAST = process.argv.includes('--broadcast');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const key = readFileSync('artifacts/local/center.txt', 'utf8').trim();
  const client = new TonClient({ endpoint: 'https://toncenter.com/api/v2/jsonRPC', apiKey: key });
  const rawSeed = readFileSync('artifacts/local/treasury_owner.secret.txt', 'utf8').replace(/^﻿/, '').trim();
  let words: string[];
  try { const jp = JSON.parse(rawSeed); words = Array.isArray(jp) ? jp.map((w: any) => String(w).trim()).filter(Boolean) : rawSeed.split(/\s+/).filter(Boolean); } catch { words = rawSeed.split(/\s+/).filter(Boolean); }
  if (words.length !== 24) throw new Error('expected 24 words, got ' + words.length);
  const kp = await mnemonicToPrivateKey(words);

  const cands = [WalletContractV5R1, WalletContractV4, WalletContractV3R2].map((C: any) => C.create({ workchain: 0, publicKey: kp.publicKey }));
  const want = Address.parse(TREASURY).toRawString();
  const wallet = cands.find((c) => c.address.toRawString() === want);
  if (!wallet) throw new Error('treasury_owner seed does not derive to ' + TREASURY);
  const opened = client.open(wallet);

  async function walletAddr(master: string) {
    const r = await client.runMethod(Address.parse(master), 'get_wallet_address', [{ type: 'slice', cell: beginCell().storeAddress(Address.parse(TREASURY)).endCell() }]);
    return r.stack.readAddress();
  }
  async function bal(a: Address) { try { const r = await client.runMethod(a, 'get_wallet_data'); return r.stack.readBigNumber(); } catch { return -1n; } }

  const deadWallet = await walletAddr(DEAD_ATH_MASTER);
  const liveWallet = await walletAddr(LIVE_ATH_MASTER);
  const deadBal = await bal(deadWallet);
  const liveBal = await bal(liveWallet);

  // SAFETY: burn target MUST be the dead clean-14 wallet and MUST differ from the live clean-15 wallet.
  if (deadWallet.equals(liveWallet)) throw new Error('ABORT: dead and live wallets resolved equal');
  if (deadBal <= 0n) throw new Error('ABORT: dead clean-14 wallet has no balance to burn (' + deadBal + ')');

  console.log('SIGNER (treasury owner):', wallet.address.toString({ bounceable: false }).slice(0, 18));
  console.log('BURN target  = clean-14 (DEAD) ATH wallet', deadWallet.toString({ bounceable: true }), '=', (Number(deadBal) / 1e9).toLocaleString(), 'ATH');
  console.log('KEEP (untouched) = clean-15 (LIVE) ATH wallet', liveWallet.toString({ bounceable: true }), '=', (Number(liveBal) / 1e9).toLocaleString(), 'ATH');

  const body = beginCell().store(storeATHBurn({ $$type: 'ATHBurn', query_id: 7014n, amount: deadBal, response_destination: Address.parse(TREASURY) })).endCell();

  if (!DO_BROADCAST) { console.log('\nDRY-RUN — nothing sent. Re-run with --broadcast to burn the', (Number(deadBal) / 1e9).toLocaleString(), 'ATH.\n'); return; }

  const seqno = await opened.getSeqno();
  await opened.sendTransfer({ seqno, secretKey: kp.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY, messages: [internal({ to: deadWallet, value: toNano('0.1'), bounce: true, body })] });
  console.log('\nATHBurn sent (seqno ' + seqno + '). waiting for clean-14 balance -> 0 ...');
  for (let i = 0; i < 20; i++) { await sleep(6000); const b = await bal(deadWallet); if (b === 0n) { console.log('  clean-14 ATH burned -> balance 0 ✓'); return; } console.log('  ...still', (Number(b) / 1e9).toLocaleString(), 'ATH (' + ((i + 1) * 6) + 's)'); }
  console.log('  burn sent; balance not yet 0 — re-check on tonviewer.');
}
main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
