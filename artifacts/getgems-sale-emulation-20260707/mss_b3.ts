import { beginCell, toNano } from '@ton/core';
import * as MSS from '../../build/MarketStabilitySeller/MarketStabilitySeller_MarketStabilitySeller';
import { setup } from './mss_setup';
const log = (...a: any[]) => console.log(...a);
async function main() {
  const env = await setup();
  const { bc, seller, sellerAddr, officialWalletAddr, attacker } = env;
  const before = (await seller.getGetMarketStabilitySellerState()).reserve_due_ath;
  log('reserve_due before =', before.toString());

  // b3a: spoofed bounce from ATTACKER (wrong sender) while IDLE
  const reqBody = beginCell().store(MSS.storeATHTransferRequest({ $$type:'ATHTransferRequest', query_id:1n, amount:1000000000000n, recipient: attacker.address, response_destination: sellerAddr } as any)).endCell();
  const r1 = await bc.sendMessage({ info:{ type:'internal', ihrDisabled:true, bounce:false, bounced:true, src: attacker.address, dest: sellerAddr, value:{coins: toNano('0.05')}, ihrFee:0n, forwardFee:0n, createdLt:0n, createdAt:0 }, body: reqBody } as any);
  log('--- b3a spoofed bounce from attacker (IDLE) ---');
  for (const t of r1.transactions as any[]) {
    log('  tx dest', t.inMessage?.info?.dest?.toString?.()?.slice(0,10), 'bounced', t.inMessage?.info?.bounced, 'exit', t.description?.computePhase?.exitCode, 'aborted', t.description?.aborted, 'actionResult', t.description?.actionPhase?.resultCode);
  }
  log('reserve_due after b3a =', (await seller.getGetMarketStabilitySellerState()).reserve_due_ath.toString());

  // b3b: spoofed bounce from OFFICIAL WALLET while IDLE (correct sender, but phase IDLE => 23251)
  const r2 = await bc.sendMessage({ info:{ type:'internal', ihrDisabled:true, bounce:false, bounced:true, src: officialWalletAddr, dest: sellerAddr, value:{coins: toNano('0.05')}, ihrFee:0n, forwardFee:0n, createdLt:0n, createdAt:0 }, body: reqBody } as any);
  log('--- b3b spoofed bounce from official wallet (IDLE) ---');
  for (const t of r2.transactions as any[]) {
    log('  tx dest', t.inMessage?.info?.dest?.toString?.()?.slice(0,10), 'bounced', t.inMessage?.info?.bounced, 'exit', t.description?.computePhase?.exitCode, 'aborted', t.description?.aborted);
  }
  log('reserve_due after b3b =', (await seller.getGetMarketStabilitySellerState()).reserve_due_ath.toString(), '(must be unchanged =', before.toString(), ')');
}
main().catch(e=>{console.error(e);process.exit(1);});
