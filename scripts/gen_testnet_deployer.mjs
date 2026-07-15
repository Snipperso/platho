// One-shot: generate a DISPOSABLE testnet deployer wallet for the STON.fi refund-topology check.
// Writes .env.testnet.local (gitignored). Prints the non-bounceable testnet funding address.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';

const ENV_PATH = '.env.testnet.local';
if (existsSync(ENV_PATH)) {
  console.error(`${ENV_PATH} already exists — refusing to overwrite. Delete it first if you really want a new wallet.`);
  process.exit(1);
}

const mnemonic = await mnemonicNew(24);
const keyPair = await mnemonicToPrivateKey(mnemonic);
const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });

const fundingAddress = wallet.address.toString({ testOnly: true, bounceable: false });   // 0Q... — for funding an uninit wallet
const bounceableAddress = wallet.address.toString({ testOnly: true, bounceable: true });  // kQ...

const template = readFileSync('.env.testnet.example', 'utf8');
const filled = template
  .replace('FILL_WITH_DISPOSABLE_TESTNET_WALLET_MNEMONIC_ONLY_IN_LOCAL_FILE', mnemonic.join(' '))
  .replace('FILL_AFTER_GENERATION', bounceableAddress);

writeFileSync(ENV_PATH, filled);

console.log(JSON.stringify({
  ok: true,
  wroteEnv: ENV_PATH,
  gitignored: true,
  fundingAddressNonBounceable: fundingAddress,
  addressBounceable: bounceableAddress,
  explorer: `https://testnet.tonviewer.com/${fundingAddress}`,
  note: 'DISPOSABLE testnet wallet only. Fund the non-bounceable (0Q...) address from a testnet faucet.',
}, null, 2));
