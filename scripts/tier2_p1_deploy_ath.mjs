// Tier-2 Phase 1: deploy a testnet ATHMaster (treasury_owner = my wallet) and mint the
// full supply to my ATH wallet via DeployTreasurySupply. Persists addresses to a scratch file.
import { writeFileSync } from 'fs';
import { Address, beginCell, internal, toNano, TupleReader } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { ATHMaster, storeDeployTreasurySupply } from '../build/ATHMaster/ATHMaster_ATHMaster.js';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet.js';
import { makeTestnetClient, parseEnv, rpc, sleep } from './testnet_rpc.mjs';

const env = parseEnv();
const { client, hasKey } = makeTestnetClient();
const SP = hasKey ? 150 : 1200;
const fr = (a) => a.toString({ testOnly: true, bounceable: true });

const keyPair = await mnemonicToPrivateKey(env.PLATHO_TESTNET_DEPLOYER_MNEMONIC.split(/\s+/).filter(Boolean));
const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
const opened = client.open(wallet);
const me = wallet.address;
console.log('my wallet:', fr(me));

// minimal onchain-ish content cell (ATHMaster init only stores it; STON.fi reads wallet mechanics, not metadata)
const content = beginCell().storeUint(0, 8).endCell();
const master = await ATHMaster.fromInit(me, content);
const masterAddr = master.address;
console.log('ATHMaster (to deploy):', fr(masterAddr));

// derive my ATH wallet
const athWallet = await ATHWallet.fromInit(0n, me, masterAddr);
console.log('my ATH wallet (derived):', fr(athWallet.address));

// deploy + mint in one message: stateInit deploys ATHMaster, body = DeployTreasurySupply
const body = beginCell().store(storeDeployTreasurySupply({
  $$type: 'DeployTreasurySupply', query_id: 1n, response_destination: me,
})).endCell();

let seqno = 0;
try { seqno = await rpc('seqno', () => opened.getSeqno(), { spacingMs: SP }); } catch { seqno = 0; }
await rpc('deploy', () => opened.sendTransfer({
  seqno, secretKey: keyPair.secretKey,
  messages: [internal({ to: masterAddr, value: toNano('1.5'), bounce: true, init: { code: master.init.code, data: master.init.data }, body })],
}), { spacingMs: SP });
console.log('deploy+mint sent at seqno', seqno, '- waiting...');

// poll my ATH wallet for the minted balance
let bal = 0n;
for (let i = 0; i < 20; i++) {
  await sleep(6000);
  try {
    const res = await rpc('wd', () => client.runMethod(athWallet.address, 'get_wallet_data'), { spacingMs: SP });
    bal = new TupleReader(res.stack.items ?? res.stack).readBigNumber();
    if (bal > 0n) break;
  } catch {}
  console.log('  ...waiting for mint (' + ((i + 1) * 6) + 's)');
}

writeFileSync('artifacts/local/tier2_testnet.json', JSON.stringify({
  myWallet: fr(me), athMaster: fr(masterAddr), athMasterRaw: masterAddr.workChain + ':' + masterAddr.hash.toString('hex'),
  myAthWallet: fr(athWallet.address), myAthWalletRaw: athWallet.address.workChain + ':' + athWallet.address.hash.toString('hex'),
  contentHex: content.toBoc().toString('hex'), mintedAtomic: bal.toString(),
}, null, 2));

console.log(JSON.stringify({ RESULT: bal > 0n ? 'MINTED' : 'NO_MINT_YET', athMintedAtomic: bal.toString(), athMaster: fr(masterAddr), myAthWallet: fr(athWallet.address) }, null, 2));
