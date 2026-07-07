// Red-team: MarketStabilitySeller pricing/theft/brick attacks in @ton/sandbox.
// npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" artifacts/getgems-sale-emulation-20260707/mss_attack.ts
import { Address, beginCell, Cell, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  MarketStabilitySeller,
} from '../../build/MarketStabilitySeller/MarketStabilitySeller_MarketStabilitySeller';
import { ATHWallet } from '../../build/ATHWallet/ATHWallet_ATHWallet';

const TRANCHE_ATH = 3000000000000000n;
const TOTAL_RESERVE = 60000000000000000n;
const ATH_TRANSFER_REQUEST_VALUE = 58000000n;
const BUY_EXEC_RESERVE = 2000000n;

const log = (...a: any[]) => console.log(...a);
const addrHash = (a: Address) => BigInt('0x' + beginCell().storeAddress(a).endCell().hash().toString('hex'));

function ok(txs: any) {
  // returns true if all txs committed (no aborted)
  return txs.every((t: any) => (t.description?.computePhase?.success ?? true) && !(t.description?.aborted));
}

async function main() {
  const bc = await Blockchain.create();
  // Genesis controller = a treasury whose address defines genesis_config_hash
  const controller = await bc.treasury('controller');
  const athMaster = await bc.treasury('athmaster'); // stand-in ATH master (only used to seed genesis credit)
  const reserveFunder = await bc.treasury('reservefunder');
  const treasuryRecv = await bc.treasury('treasuryrecv');
  const attacker = await bc.treasury('attacker');

  const genesisHash = addrHash(controller.address);

  const seller = bc.openContract(await MarketStabilitySeller.fromInit(genesisHash, athMaster.address));
  // deploy
  await seller.send(controller.getSender(), { value: toNano('1') }, null as any).catch(() => {});
  // Force deploy via a top-up (deploy happens on first message; use TopUp)
  await seller.send(controller.getSender(), { value: toNano('1') }, { $$type: 'MarketStabilityTopUpStorageReserve' } as any);

  const sellerAddr = seller.address;
  // The official ATH wallet the seller expects:
  const officialWalletAddr: Address = await seller.getGetOfficialAthWalletAddress();
  log('seller', sellerAddr.toString());
  log('official wallet', officialWalletAddr.toString());

  const manifest = 12345n;

  // --- GENESIS: bind reserve funder, official wallet, treasury ---
  await seller.send(controller.getSender(), { value: toNano('0.2') }, {
    $$type: 'BindMarketStabilityReserveFunder',
    deployment_manifest_hash: manifest,
    reserve_funder_address: reserveFunder.address,
  } as any);
  await seller.send(controller.getSender(), { value: toNano('0.2') }, {
    $$type: 'BindMarketStabilityOfficialAthWallet',
    deployment_manifest_hash: manifest,
    official_ath_wallet_address: officialWalletAddr,
  } as any);
  await seller.send(controller.getSender(), { value: toNano('0.2') }, {
    $$type: 'BindMarketStabilityTreasury',
    deployment_manifest_hash: manifest,
    ton_treasury_receiver_address: treasuryRecv.address,
  } as any);
  // Seal
  await seller.send(controller.getSender(), { value: toNano('0.2') }, {
    $$type: 'SealMarketStabilityGenesis',
    deployment_manifest_hash: manifest,
  } as any);

  let cfg = await seller.getGetMarketStabilitySellerConfig();
  log('sealed', cfg.sealed, 'frozen', cfg.pricing_frozen);

  // --- Fund the reserve: deploy the official ATH wallet with 60M via genesis credit, ---
  // then have it deliver an AthTransferNotification to the seller. But simpler: the seller's
  // AthTransferNotification receiver only checks sender()==official wallet & sender_wallet==funder.
  // We deploy the official ATHWallet(0, seller, athMaster) and seed its balance via ATHGenesisSupplyCredit
  // from athMaster, then drive it to notify the seller. To keep the harness tractable, we instead
  // impersonate the official wallet address by deploying the REAL ATHWallet at that address.

  const officialWallet = bc.openContract(await ATHWallet.fromInit(0n, sellerAddr, athMaster.address));
  if (!officialWallet.address.equals(officialWalletAddr)) {
    log('WALLET ADDR MISMATCH', officialWallet.address.toString());
  }
  // deploy + genesis-credit 60M into it (sender must be athMaster)
  await officialWallet.send(athMaster.getSender(), { value: toNano('0.1') }, {
    $$type: 'ATHGenesisSupplyCredit',
    query_id: 1n,
    amount: TOTAL_RESERVE,
    response_destination: athMaster.address,
  } as any);
  const owData = await officialWallet.getGetWalletData().catch(() => null);
  log('official wallet balance seeded:', owData ? owData.balance?.toString?.() ?? JSON.stringify(owData) : 'n/a');

  // Notify seller of the reserve funding. AthTransferNotification must come FROM the official wallet.
  // We can't easily make the wallet emit it, so send it directly from a treasury impersonating the
  // official wallet is impossible (sender check). Instead: use blockchain.sendMessage with a forged
  // sender? Sandbox doesn't forge sender. So drive it through the wallet's real notify path is complex.
  // SIMPLER: directly poke the seller's AthTransferNotification by having the official wallet send it.
  // The official wallet has no "emit notification to seller" op that matches. So we craft the internal
  // message from the wallet address using bc.sendMessage with `from` = officialWalletAddr.

  // Sandbox lets us send an arbitrary internal message from any address via blockchain.sendMessage.
  const notifBody = beginCell()
    .store((await import('../../build/MarketStabilitySeller/MarketStabilitySeller_MarketStabilitySeller')).storeAthTransferNotification({
      $$type: 'AthTransferNotification',
      query_id: 2n,
      amount: TOTAL_RESERVE,
      sender_key: 0n,
      sender_wallet: reserveFunder.address,
    }))
    .endCell();

  const res = await bc.sendMessage({
    info: {
      type: 'internal',
      ihrDisabled: true,
      bounce: true,
      bounced: false,
      src: officialWalletAddr,
      dest: sellerAddr,
      value: { coins: toNano('0.05') },
      ihrFee: 0n, forwardFee: 0n, createdLt: 0n, createdAt: 0,
    },
    body: notifBody,
  } as any);
  log('reserve notify committed:', ok(res.transactions));

  let st = await seller.getGetMarketStabilitySellerState();
  log('reserve_due_ath after funding:', st.reserve_due_ath.toString(), '(expect 60e15)');

  // --- FREEZE pricing. base_tranche_price = quote for x1 whole tranche. ---
  // Pick base = 3_000_000_000 nanotons = 3 TON for a full x1 tranche (arbitrary).
  const base = 3000000000n;
  await seller.send(controller.getSender(), { value: toNano('0.2') }, {
    $$type: 'FreezeMarketStabilityPricing',
    deployment_manifest_hash: manifest,
    base_tranche_price_nanotons: base,
    evidence_x1_tranche_quote_nanotons: base,
    pricing_evidence_hash: 999n,
  } as any);
  cfg = await seller.getGetMarketStabilitySellerConfig();
  log('frozen', cfg.pricing_frozen, 'base', cfg.base_tranche_price_nanotons.toString());

  return { bc, seller, sellerAddr, officialWalletAddr, attacker, controller, base, st };
}

async function attacks() {
  const env = await main();
  const { bc, seller, sellerAddr, officialWalletAddr, attacker, base } = env;
  const MSSmod = await import('../../build/MarketStabilitySeller/MarketStabilitySeller_MarketStabilitySeller');

  log('\n================ ATTACK (a1): quote rounding at amount=1 ================');
  // quote(1) = ceilDiv(base * multiplier * 1, TRANCHE_ATH). multiplier=2 at start.
  // base=3e9, mult=2, amount=1 => num = 6e9 => ceilDiv(6e9, 3e15) = 1 (rounds up). So 1 nanoTON for 1 nanoATH.
  const q1 = await seller.getGetQuoteTonForAmount(1n);
  log('quote(1 nanoATH) =', q1.toString(), 'nanoTON  (fair fraction would be', (base*2n)/TRANCHE_ATH, '.xxx, ceilDiv ->', q1, ')');
  // Is it EVER 0? ceilDiv returns >=1 for any amount>0 since numerator>0. Confirm.
  log('=> ceilDiv never yields 0 for amount>0; buyer always pays >= 1 nanoTON. NOT free.');

  log('\n================ ATTACK (a2): drain reserve cheaply via 1-unit buys ================');
  // Each buy requires context.value >= price + 58M + 2M = 60_000_001 nanoTON => 0.060000001 TON MINIMUM per buy,
  // regardless of how tiny the ATH amount is. Draining 3e15 nanoATH (one tranche) at 1 nano/buy = 3e15 buys,
  // each costing >=0.06 TON in exec value alone. Economically impossible AND query_id is monotonic (one buy per msg).
  log('per-buy floor value = price + 58M + 2M =', (q1 + ATH_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE).toString(), 'nanoTON');
  log('=> tiny-amount buys cost >=0.06 TON exec each; no cheap drain. Skipping brute-run.');

  log('\n================ ATTACK (a3): underpay a real buy (pay < quote) ================');
  const amount = TRANCHE_ATH; // whole first tranche
  const price = await seller.getGetQuoteTonForAmount(amount);
  log('quote(full tranche) =', price.toString(), 'nanoTON (expect base=3e9)');
  const required = price + ATH_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE;
  // Send with value = required - 1 (one nano short) => must throw 23218.
  const under = await seller.send(attacker.getSender(), { value: required - 1n }, {
    $$type: 'BuyMarketStabilityAth',
    query_id: 1n,
    amount,
    recipient: attacker.address,
  } as any);
  const underAborted = under.transactions.some((t: any) => t.description?.computePhase?.exitCode === 23218 || t.description?.aborted);
  log('underpay by 1 nanoTON aborted?', underAborted, '(expect true, exit 23218)');
  let st = await seller.getGetMarketStabilitySellerState();
  log('phase after underpay =', st.phase.toString(), '(expect 0 IDLE, no reserve moved)');
  log('reserve_due unchanged =', st.reserve_due_ath.toString());

  log('\n================ ATTACK (a4): buy MORE than tranche remaining (23215) ================');
  const over = await seller.send(attacker.getSender(), { value: toNano('5') }, {
    $$type: 'BuyMarketStabilityAth',
    query_id: 1n,
    amount: TRANCHE_ATH + 1n,
    recipient: attacker.address,
  } as any);
  const overAborted = over.transactions.some((t: any) => t.description?.computePhase?.exitCode === 23215 || t.description?.aborted);
  log('buy tranche+1 aborted?', overAborted, '(expect true, exit 23215 amount>remaining)');

  log('\n================ ATTACK (a5): x1 (multiplier 1) price via completed_tranche underflow? ================');
  // currentMultiplier = 2 + completed_tranche_count. Minimum multiplier is 2 (x2). There is NO x1 sale path;
  // x1 is only the pricing evidence anchor. completed_tranche_count is uint8 and only increments. No way to
  // reach multiplier 1. Confirmed by reading currentMultiplier().
  const mult = st.current_multiplier;
  log('current_multiplier =', mult.toString(), '(min is 2; x1 unreachable => cannot buy at x1 floor)');

  log('\n================ ATTACK (a6): valid buy then double-refund / replay same query_id ================');
  // First do a legit full buy at value with big excess to test the refund is single.
  const q = await seller.getGetQuoteTonForAmount(amount);
  const attackerBalBefore = await attacker.getBalance();
  const buyValue = q + ATH_TRANSFER_REQUEST_VALUE + BUY_EXEC_RESERVE + toNano('2'); // 2 TON excess
  const buy1 = await seller.send(attacker.getSender(), { value: buyValue }, {
    $$type: 'BuyMarketStabilityAth',
    query_id: 1n,
    amount,
    recipient: attacker.address,
  } as any);
  log('buy1 tx count:', buy1.transactions.length);
  for (const t of buy1.transactions as any[]) {
    const src = t.inMessage?.info?.src?.toString?.() ?? '?';
    const dst = t.inMessage?.info?.dest?.toString?.() ?? '?';
    const ec = t.description?.computePhase?.exitCode;
    const ab = t.description?.aborted;
    log('  tx', src.slice(0,10), '->', dst.slice(0,10), 'exit', ec, 'aborted', ab, 'out', t.outMessagesCount);
  }
  const tot = await seller.getGetMarketStabilitySellerTotals();
  log('totals: sold_ath', tot.sold_ath_total.toString(), 'treasury_due(next line)');
  st = await seller.getGetMarketStabilitySellerState();
  log('after buy1: phase', st.phase.toString(), 'pending_amount', st.pending_amount_ath.toString(), 'pending_paid', st.pending_paid_ton.toString(), 'treasury_due', st.treasury_due_ton.toString(), 'last_terminal_qid', st.last_terminal_query_id.toString());
  log('  reserve_due now', st.reserve_due_ath.toString(), '(expect 60e15 - 3e15 =', (TOTAL_RESERVE-TRANCHE_ATH).toString(), ')');

  // Try to send a SECOND buy while pending (phase != IDLE) => must throw 23211.
  const buy2 = await seller.send(attacker.getSender(), { value: buyValue }, {
    $$type: 'BuyMarketStabilityAth',
    query_id: 2n,
    amount: 1n,
    recipient: attacker.address,
  } as any);
  const buy2Aborted = buy2.transactions.some((t: any) => t.description?.computePhase?.exitCode === 23211 || t.description?.aborted);
  log('concurrent second buy aborted?', buy2Aborted, '(expect true, 23211 phase not IDLE)');

  // Try forging an ATHTransferAck from the ATTACKER (not the recipient wallet) to finalize & steal.
  const forgedAck = await seller.send(attacker.getSender(), { value: toNano('0.1') }, {
    $$type: 'ATHTransferAck',
    query_id: 1n,
    amount,
  } as any);
  const forgedAborted = forgedAck.transactions.some((t: any) => t.description?.computePhase?.exitCode === 23233 || t.description?.aborted);
  log('forged ATHTransferAck from attacker aborted?', forgedAborted, '(expect true, 23233 wrong sender)');
  st = await seller.getGetMarketStabilitySellerState();
  log('phase still pending after forged ack?', st.phase.toString(), '(expect 1)');

  // Try forging ATHTransferFailed from attacker (not official wallet) to trigger refund AND get ATH.
  const forgedFail = await seller.send(attacker.getSender(), { value: toNano('0.1') }, {
    $$type: 'ATHTransferFailed',
    query_id: 1n,
    amount,
  } as any);
  const forgedFailAborted = forgedFail.transactions.some((t: any) => t.description?.computePhase?.exitCode === 23240 || t.description?.aborted);
  log('forged ATHTransferFailed from attacker aborted?', forgedFailAborted, '(expect true, 23240 wrong sender)');
  st = await seller.getGetMarketStabilitySellerState();
  log('phase still pending after forged fail?', st.phase.toString(), '(expect 1)');
  log('reserve_due still debited (not double-credited)?', st.reserve_due_ath.toString());

  log('\n================ ATTACK (a7): re-run FreezeMarketStabilityPricing (re-price) ================');
  const refreeze = await seller.send(env.controller.getSender(), { value: toNano('0.2') }, {
    $$type: 'FreezeMarketStabilityPricing',
    deployment_manifest_hash: 12345n,
    base_tranche_price_nanotons: 1n, // try to slam price to 1 nanoTON/tranche
    evidence_x1_tranche_quote_nanotons: 1n,
    pricing_evidence_hash: 111n,
  } as any);
  const refreezeAborted = refreeze.transactions.some((t: any) => t.description?.computePhase?.exitCode === 23130 || t.description?.aborted);
  log('re-freeze aborted?', refreezeAborted, '(expect true, 23130 already frozen)');
  const cfg2 = await seller.getGetMarketStabilitySellerConfig();
  log('base price after re-freeze attempt =', cfg2.base_tranche_price_nanotons.toString(), '(expect unchanged 3e9)');

  log('\n================ ATTACK (a8): re-bind treasury after seal (redirect payouts) ================');
  const rebind = await seller.send(env.controller.getSender(), { value: toNano('0.2') }, {
    $$type: 'BindMarketStabilityTreasury',
    deployment_manifest_hash: 12345n,
    ton_treasury_receiver_address: attacker.address,
  } as any);
  const rebindAborted = rebind.transactions.some((t: any) => t.description?.computePhase?.exitCode === 23001 || t.description?.computePhase?.exitCode === 23120 || t.description?.aborted);
  log('re-bind treasury after seal aborted?', rebindAborted, '(expect true, 23001 requireUnsealed / genesis hash zeroed 23004)');
  const cfg3 = await seller.getGetMarketStabilitySellerConfig();
  log('treasury after rebind attempt =', cfg3.ton_treasury_receiver_address.toString());
  log('  attacker addr =', attacker.address.toString());

  log('\n================ ATTACK (a9): pricing overflow — huge amount * base * mult ================');
  // numerator = base * mult * amount. base uint128, amount<=TRANCHE (3e15). At mult=21, max num =
  // base * 21 * 3e15. If base is huge (uint128 max ~3.4e38), product overflows 257-bit? TVM ints are 257-bit.
  // base<=uint128 (~3.4e38), *21*3e15 ~ 2.1e55 << 2^256(~1.16e77). No overflow. Confirm at extreme base.
  log('max numerator at base=uint128max, mult=21, amount=3e15 ~ 2.1e55 << 2^256(~1.16e77): no 257-bit overflow');

  log('\n================ DONE ================');
}

attacks().catch((e) => { console.error('FATAL', e); process.exit(1); });
