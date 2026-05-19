import { Address, beginCell, Cell, contractAddress } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';

async function main() {
  const treasury = Address.parse('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c');
  const content = beginCell().endCell();
  const masterInit = await ATHMaster.init(treasury, content);
  const masterAddress = contractAddress(0, masterInit);
  const blockchain = await Blockchain.create();
  const master = blockchain.openContract(new ATHMaster(masterAddress, masterInit));
  const owner = Address.parse('EQD__________________________________________0vo');
  const walletInit = await ATHWallet.init(0n, owner, masterAddress);
  const local = contractAddress(0, walletInit);
  console.log('master', masterAddress.toString());
  console.log('local', local.toString());
  const getter = await master.getGetWalletAddress(owner);
  console.log('getter', getter.toString());
}
main().catch(e => { console.error(e); process.exit(1); });
