// Burn the leftover clean-13 (dead-set) ATH sitting in the treasury owner's OLD ATH wallet,
// so it no longer clutters the wallet next to the live clean-14 ATH. Owner-directed.
// DRY-RUN by default; --broadcast sends. Run: ts-node --compiler-options '{"module":"CommonJS"}'
import { readFileSync, existsSync } from 'node:fs';
import { Address, beginCell, internal, storeMessage, SendMode, toNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV5R1, WalletContractV4, WalletContractV3R2, TonClient } from '@ton/ton';
import { storeATHBurn } from '../build/ATHWallet/ATHWallet_ATHWallet';

const TREASURY = 'UQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOATH';
const CLEAN13_ATH_MASTER = 'UQADR4k12eu1jLxYHWaoDsO93GPUSuBupc-naSXquUFs46q-'; // DEAD clean-13 master
const CLEAN14_ATH_MASTER = 'UQAyC-MgeacFW5-FeqHYckzrbI06y40OmloCU5cxBIof6Z8g'; // LIVE — must NOT touch
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

  // derive the treasury owner wallet (match the vanity address)
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

  const c13Wallet = await walletAddr(CLEAN13_ATH_MASTER);
  const c14Wallet = await walletAddr(CLEAN14_ATH_MASTER);
  const c13Bal = await bal(c13Wallet);
  const c14Bal = await bal(c14Wallet);

  // SAFETY: burn target MUST be the clean-13 wallet and MUST differ from the clean-14 wallet.
  if (c13Wallet.equals(c14Wallet)) throw new Error('ABORT: clean-13 and clean-14 wallets resolved equal');
  if (c13Bal <= 0n) throw new Error('ABORT: clean-13 wallet has no balance to burn (' + c13Bal + ')');

  console.log('SIGNER (treasury owner):', wallet.address.toString({ bounceable: false }).slice(0, 18));
  console.log('BURN target  = clean-13 ATH wallet', c13Wallet.toString({ bounceable: true }), '=', (Number(c13Bal) / 1e9).toLocaleString(), 'ATH');
  console.log('KEEP (untouched) = clean-14 ATH wallet', c14Wallet.toString({ bounceable: true }), '=', (Number(c14Bal) / 1e9).toLocaleString(), 'ATH');

  const body = beginCell().store(storeATHBurn({ $$type: 'ATHBurn', query_id: 7001n, amount: c13Bal, response_destination: Address.parse(TREASURY) })).endCell();

  if (!DO_BROADCAST) { console.log('\nDRY-RUN — nothing sent. Re-run with --broadcast to burn the', (Number(c13Bal) / 1e9).toLocaleString(), 'ATH.\n'); return; }

  const seqno = await opened.getSeqno();
  await opened.sendTransfer({ seqno, secretKey: kp.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY, messages: [internal({ to: c13Wallet, value: toNano('0.1'), bounce: true, body })] });
  console.log('\nATHBurn sent (seqno ' + seqno + '). waiting for clean-13 balance -> 0 ...');
  for (let i = 0; i < 20; i++) { await sleep(6000); const b = await bal(c13Wallet); if (b === 0n) { console.log('  clean-13 ATH burned -> balance 0 ✓'); return; } console.log('  ...still', (Number(b) / 1e9).toLocaleString(), 'ATH (' + ((i + 1) * 6) + 's)'); }
  console.log('  burn sent; balance not yet 0 — re-check on tonviewer.');
}
main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
