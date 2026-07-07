// Batch 2: replay / bounce-double-credit / cap-inflate / flush-redirect.
import { Address, beginCell, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import * as MSS from '../../build/MarketStabilitySeller/MarketStabilitySeller_MarketStabilitySeller';
import { setup } from './mss_setup';

const log = (...a: any[]) => console.log(...a);
const OFF = 58000000n, EX = 2000000n;

async function main() {
  const env = await setup();
  const { bc, seller, sellerAddr, officialWalletAddr, attacker, reserveFunder } = env;

  log('\n== (b1): replay a COMPLETED query_id ==');
  const amount = 1000000000000n;
  const q = await seller.getGetQuoteTonForAmount(amount);
  const v = q + OFF + EX + 500000000n;
  await seller.send(attacker.getSender(), { value: v }, { $$type:'BuyMarketStabilityAth', query_id:1n, amount, recipient: attacker.address } as any);
  let st = await seller.getGetMarketStabilitySellerState();
  log('after qid1 buy: last_terminal', st.last_terminal_query_id.toString(), 'sold', (await seller.getGetMarketStabilitySellerTotals()).sold_ath_total.toString());
  const replay = await seller.send(attacker.getSender(), { value: v }, { $$type:'BuyMarketStabilityAth', query_id:1n, amount, recipient: attacker.address } as any);
  log('replay qid=1 aborted?', replay.transactions.some((t:any)=> t.description?.computePhase?.exitCode===23013 || t.description?.aborted), '(expect true, 23013)');
  const skip = await seller.send(attacker.getSender(), { value: v }, { $$type:'BuyMarketStabilityAth', query_id:3n, amount, recipient: attacker.address } as any);
  log('skip to qid=3 aborted?', skip.transactions.some((t:any)=> t.description?.computePhase?.exitCode===23013 || t.description?.aborted), '(expect true, 23013)');
  log('sold_ath after replay/skip =', (await seller.getGetMarketStabilitySellerTotals()).sold_ath_total.toString(), '(expect only 1e12)');

  log('\n== (b2): spurious ATHTransferFailed while IDLE (re-credit reserve) ==');
  const failBody = beginCell().store(MSS.storeATHTransferFailed({ $$type:'ATHTransferFailed', query_id: 1n, amount } as any)).endCell();
  const res = await bc.sendMessage({ info:{ type:'internal', ihrDisabled:true, bounce:true, bounced:false, src: officialWalletAddr, dest: sellerAddr, value:{coins: toNano('0.05')}, ihrFee:0n, forwardFee:0n, createdLt:0n, createdAt:0 }, body: failBody } as any);
  log('ATHTransferFailed while IDLE aborted?', res.transactions.some((t:any)=> t.description?.computePhase?.exitCode===23241 || t.description?.aborted), '(expect true, 23241)');
  st = await seller.getGetMarketStabilitySellerState();
  log('reserve_due after spurious fail =', st.reserve_due_ath.toString(), '(must NOT re-credit)');

  log('\n== (b3): spoofed bounce from attacker to re-credit reserve ==');
  const reqBody = beginCell().store(MSS.storeATHTransferRequest({ $$type:'ATHTransferRequest', query_id:1n, amount, recipient: attacker.address, response_destination: sellerAddr } as any)).endCell();
  const spoofBounce = await bc.sendMessage({ info:{ type:'internal', ihrDisabled:true, bounce:false, bounced:true, src: attacker.address, dest: sellerAddr, value:{coins: toNano('0.05')}, ihrFee:0n, forwardFee:0n, createdLt:0n, createdAt:0 }, body: reqBody } as any);
  log('spoofed bounce aborted?', spoofBounce.transactions.some((t:any)=> t.description?.computePhase?.exitCode===23250 || t.description?.computePhase?.exitCode===23251 || t.description?.aborted), '(expect true, 23250/23251)');
  log('reserve_due after spoofed bounce =', (await seller.getGetMarketStabilitySellerState()).reserve_due_ath.toString(), '(unchanged)');

  log('\n== (b5): over-cap reserve notify (inflate past 60M) ==');
  const nb = beginCell().store(MSS.storeAthTransferNotification({ $$type:'AthTransferNotification', query_id: 5n, amount: 1000000000000000n, sender_key: 0n, sender_wallet: reserveFunder.address } as any)).endCell();
  const infl = await bc.sendMessage({ info:{ type:'internal', ihrDisabled:true, bounce:true, bounced:false, src: officialWalletAddr, dest: sellerAddr, value:{coins: toNano('0.05')}, ihrFee:0n, forwardFee:0n, createdLt:0n, createdAt:0 }, body: nb } as any);
  log('over-cap notify aborted?', infl.transactions.some((t:any)=> t.description?.computePhase?.exitCode===23205 || t.description?.aborted), '(expect true, 23205)');
  log('reserve_funded_total =', (await seller.getGetMarketStabilitySellerTotals()).reserve_funded_total_ath.toString(), '(expect 60e15)');

  log('\n== (b6): spoofed AthTransferNotification from attacker (fake reserve funding) ==');
  const nb2 = beginCell().store(MSS.storeAthTransferNotification({ $$type:'AthTransferNotification', query_id: 6n, amount: 1000000n, sender_key: 0n, sender_wallet: reserveFunder.address } as any)).endCell();
  const spoofNotif = await bc.sendMessage({ info:{ type:'internal', ihrDisabled:true, bounce:true, bounced:false, src: attacker.address, dest: sellerAddr, value:{coins: toNano('0.05')}, ihrFee:0n, forwardFee:0n, createdLt:0n, createdAt:0 }, body: nb2 } as any);
  log('spoofed notify aborted?', spoofNotif.transactions.some((t:any)=> t.description?.computePhase?.exitCode===23201 || t.description?.aborted), '(expect true, 23201)');

  log('\n== (b7): flush treasury — over-flush + redirect ==');
  st = await seller.getGetMarketStabilitySellerState();
  log('treasury_due before flush =', st.treasury_due_ton.toString());
  const over = await seller.send(attacker.getSender(), { value: toNano('0.1') }, { $$type:'FlushMarketStabilityTreasuryTon', amount: st.treasury_due_ton + 1n } as any);
  log('over-flush aborted?', over.transactions.some((t:any)=> t.description?.computePhase?.exitCode===23261 || t.description?.aborted), '(expect true, 23261)');
  if (st.treasury_due_ton > 0n) {
    const flush = await seller.send(attacker.getSender(), { value: toNano('0.1') }, { $$type:'FlushMarketStabilityTreasuryTon', amount: st.treasury_due_ton } as any);
    const dests = (flush.transactions as any[]).flatMap(t => (t.outMessages? [...t.outMessages.values()] : [])).map((m:any)=> m.info?.dest?.toString?.()).filter(Boolean);
    log('flush out dests:', JSON.stringify(dests));
    log('  treasury bound =', (await seller.getGetMarketStabilitySellerConfig()).ton_treasury_receiver_address.toString());
    log('  attacker       =', attacker.address.toString(), '(must NOT be a dest)');
  }
  log('\n== DONE2 ==');
}
main().catch((e)=>{ console.error('FATAL2', e); process.exit(1); });
