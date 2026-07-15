// Tier-2 Phase 1b: retry DeployTreasurySupply against the already-deployed ATHMaster (which now
// holds a ~1.5 TON buffer), so the downstream ATH-wallet deploy fwd fee is covered from balance.
import { readFileSync, writeFileSync } from 'fs';
import { Address, beginCell, internal, toNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';
import { ATHMaster, storeDeployTreasurySupply } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';

function parseEnv(p = '.env.testnet.local'): Record<string, string> {
  const o: Record<string, string> = {};
  for (const raw of readFileSync(p, 'utf8').split(/\r?\n/)) { const l = raw.trim(); if (!l || l.startsWith('#')) continue; const i = l.indexOf('='); if (i < 0) continue; let v = l.slice(i + 1).trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); o[l.slice(0, i).trim()] = v; }
  return o;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const env = parseEnv();
  const client = new TonClient({ endpoint: env.PLATHO_TON_RPC_ENDPOINT, apiKey: env.PLATHO_TON_RPC_API_KEY || undefined });
  const fr = (a: Address) => a.toString({ testOnly: true, bounceable: true });
  const keyPair = await mnemonicToPrivateKey(env.PLATHO_TESTNET_DEPLOYER_MNEMONIC.split(/\s+/).filter(Boolean));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const opened = client.open(wallet);
  const me = wallet.address;

  const content = beginCell().storeUint(0, 8).endCell();
  const master = await ATHMaster.fromInit(me, content);
  const athWallet = await ATHWallet.fromInit(0n, me, master.address);
  console.log('ATHMaster:', fr(master.address), ' my ATH wallet:', fr(athWallet.address));

  const body = beginCell().store(storeDeployTreasurySupply({ $$type: 'DeployTreasurySupply', query_id: 2n, response_destination: me })).endCell();
  const seqno = await opened.getSeqno();
  await opened.sendTransfer({ seqno, secretKey: keyPair.secretKey, messages: [internal({ to: master.address, value: toNano('0.1'), bounce: true, body })] });
  console.log('retry DeployTreasurySupply sent (value 0.1, no init) seqno', seqno, '- waiting...');

  let bal = 0n;
  for (let i = 0; i < 18; i++) {
    await sleep(6000);
    try { const res = await client.runMethod(athWallet.address, 'get_wallet_data'); bal = res.stack.readBigNumber(); if (bal > 0n) break; } catch {}
    console.log('  ...waiting (' + ((i + 1) * 6) + 's)');
  }

  if (bal > 0n) {
    writeFileSync('artifacts/local/tier2_testnet.json', JSON.stringify({ myWallet: fr(me), athMaster: fr(master.address), myAthWallet: fr(athWallet.address), contentHex: content.toBoc().toString('hex'), mintedAtomic: bal.toString() }, null, 2));
  }
  console.log(JSON.stringify({ RESULT: bal > 0n ? 'MINTED' : 'NO_MINT_YET', athMintedAtomic: bal.toString() }, null, 2));
}
main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
