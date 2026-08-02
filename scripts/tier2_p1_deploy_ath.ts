// Tier-2 Phase 1: deploy a testnet ATHMaster (treasury_owner = my wallet) and mint the full
// supply to my ATH wallet via DeployTreasurySupply. Run: ts-node --compiler-options '{"module":"CommonJS"}'
import { readFileSync, writeFileSync } from 'fs';
import { Address, beginCell, internal, toNano, TupleReader } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';
import { ATHMaster, storeDeployTreasurySupply } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';

function parseEnv(path = '.env.testnet.local'): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('='); if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function sanitize(e: any): Error {
  const status = e?.response?.status ?? e?.status;
  const msg = String(e?.message ?? e).replace(/[a-f0-9]{48,}/gi, '<redacted>').slice(0, 120);
  return new Error(status ? `HTTP ${status}: ${msg}` : msg);
}
async function rpc<T>(fn: () => Promise<T>, spacingMs = 150, tries = 6): Promise<T> {
  let last: any;
  for (let a = 0; a < tries; a++) {
    try { const r = await fn(); await sleep(spacingMs); return r; }
    catch (e: any) { last = sanitize(e); const s = e?.response?.status ?? e?.status; if (s !== 429) throw last; await sleep(1500 + a * 1500); }
  }
  throw last;
}

async function main() {
  const env = parseEnv();
  const client = new TonClient({ endpoint: env.PLATHO_TON_RPC_ENDPOINT, apiKey: env.PLATHO_TON_RPC_API_KEY || undefined });
  const fr = (a: Address) => a.toString({ testOnly: true, bounceable: true });
  const keyPair = await mnemonicToPrivateKey(env.PLATHO_TESTNET_DEPLOYER_MNEMONIC.split(/\s+/).filter(Boolean));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const opened = client.open(wallet);
  const me = wallet.address;
  console.log('my wallet:', fr(me));

  const content = beginCell().storeUint(0, 8).endCell();
  const master = await ATHMaster.fromInit(me, content, 0n);
  const athWallet = await ATHWallet.fromInit(0n, me, master.address);
  console.log('ATHMaster:', fr(master.address));
  console.log('my ATH wallet (derived):', fr(athWallet.address));

  const body = beginCell().store(storeDeployTreasurySupply({ $$type: 'DeployTreasurySupply', query_id: 1n, response_destination: me })).endCell();
  let seqno = 0; try { seqno = await rpc(() => opened.getSeqno()); } catch { seqno = 0; }
  await rpc(() => opened.sendTransfer({
    seqno, secretKey: keyPair.secretKey,
    messages: [internal({ to: master.address, value: toNano('1.5'), bounce: true, init: { code: master.init!.code, data: master.init!.data }, body })],
  }));
  console.log('deploy+mint sent at seqno', seqno, '- waiting...');

  let bal = 0n;
  for (let i = 0; i < 20; i++) {
    await sleep(6000);
    try { const res = await rpc(() => client.runMethod(athWallet.address, 'get_wallet_data')); bal = res.stack.readBigNumber(); if (bal > 0n) break; } catch {}
    console.log('  ...waiting for mint (' + ((i + 1) * 6) + 's)');
  }

  writeFileSync('artifacts/local/tier2_testnet.json', JSON.stringify({
    myWallet: fr(me), athMaster: fr(master.address), myAthWallet: fr(athWallet.address),
    contentHex: content.toBoc().toString('hex'), mintedAtomic: bal.toString(),
  }, null, 2));
  console.log(JSON.stringify({ RESULT: bal > 0n ? 'MINTED' : 'NO_MINT_YET', athMintedAtomic: bal.toString(), athMaster: fr(master.address), myAthWallet: fr(athWallet.address) }, null, 2));
}
main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
