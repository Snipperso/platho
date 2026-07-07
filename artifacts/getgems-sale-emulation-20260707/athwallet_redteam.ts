// RED-TEAM: ATHWallet.tact custody attacks against BUILT code.
// npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" artifacts/getgems-sale-emulation-20260707/athwallet_redteam.ts
import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { createHash } from 'crypto';
import { ATHWallet } from '../../build/ATHWallet/ATHWallet_ATHWallet';

const A = (tag: string) => new Address(0, createHash('sha256').update(tag).digest());

function phase(tx: any) {
  const d = tx.description;
  const compute = d.computePhase?.type === 'vm' ? d.computePhase.exitCode : d.computePhase?.type;
  const action = d.actionPhase ? d.actionPhase.resultCode : 'none';
  return { compute, action, aborted: d.aborted };
}
function dump(res: any, label: string) {
  console.log(`  [${label}] txs:`);
  for (const tx of res.transactions) {
    const info = tx.inMessage?.info;
    if (info?.type !== 'internal') { continue; }
    const p = phase(tx);
    console.log(`    dest=${info.dest?.toString().slice(0,10)} bounced=${info.bounced} compute=${p.compute} action=${p.action} aborted=${p.aborted} outs=${tx.outMessagesCount}`);
  }
}

async function main() {
  const bc = await Blockchain.create();
  bc.now = 1783000000;

  const MASTER = A('PLATHO.ATH.MASTER');       // real ATHMaster address (simulated as a treasury sender)
  const VICTIM = A('PLATHO.VICTIM.OWNER');      // victim wallet owner
  const ATTACKER = A('PLATHO.ATTACKER.OWNER');  // attacker wallet owner
  const PEER = A('PLATHO.PEER.OWNER');          // some other owner

  // Deploy the VICTIM's ATHWallet with a real balance (say 1000 ATH) using the built init.
  const START_BAL = 1000n;
  const victimInit = await ATHWallet.init(0n, VICTIM, MASTER);
  const victimAddr = contractAddress(0, victimInit);
  // seed its balance field via init(balance=START_BAL) -> but that changes address. Instead deploy with balance in state.
  // Genesis credit path only works from MASTER on a zero-balance wallet, so we credit via that legit path.
  await bc.setShardAccount(victimAddr, createShardAccount({
    address: victimAddr, code: victimInit.code, data: victimInit.data, balance: toNano('5'), workchain: 0,
  }));
  const victim = bc.openContract(new ATHWallet(victimAddr, victimInit));

  // Legit genesis credit from MASTER to give victim START_BAL.
  await victim.send(bc.sender(MASTER), { value: toNano('1'), bounce: true }, {
    $$type: 'ATHGenesisSupplyCredit', query_id: 1n, amount: START_BAL, response_destination: MASTER,
  } as any);
  let wd = await victim.getGetWalletData();
  console.log(`Victim balance after genesis credit: ${wd.balance} (expect ${START_BAL})`);

  const balOf = async () => (await victim.getGetWalletData()).balance;
  const tonOf = async () => (await bc.getContract(victimAddr)).balance;

  // Helper: address of the ATHWallet for a given owner (same master).
  const walletAddrFor = async (owner: Address) => contractAddress(0, await ATHWallet.init(0n, owner, MASTER));

  console.log('\n================ ATTACK (a1): mint from nothing via spoofed JettonInternalTransfer (attacker EOA as sender) ================');
  {
    const before = await balOf();
    // Attacker sends JettonInternalTransfer directly from their OWN address (not a derived wallet).
    const res = await victim.send(bc.sender(ATTACKER), { value: toNano('1'), bounce: true }, {
      $$type: 'JettonInternalTransfer', query_id: 100n, amount: 500n, from: ATTACKER,
      response_address: ATTACKER, forward_ton_amount: 0n, forward_payload: beginCell().endCell().beginParse(),
    } as any);
    dump(res, 'a1');
    const after = await balOf();
    console.log(`  balance ${before} -> ${after}  ${after > before ? 'INFLATED (SUCCEEDED)' : 'unchanged (FAILED)'}`);
  }

  console.log('\n================ ATTACK (a2): spoof from=PEER so guard derives PEER wallet, but send from ATTACKER EOA ================');
  {
    const before = await balOf();
    const res = await victim.send(bc.sender(ATTACKER), { value: toNano('1'), bounce: true }, {
      $$type: 'JettonInternalTransfer', query_id: 101n, amount: 500n, from: PEER,
      response_address: ATTACKER, forward_ton_amount: 0n, forward_payload: beginCell().endCell().beginParse(),
    } as any);
    dump(res, 'a2');
    const after = await balOf();
    console.log(`  balance ${before} -> ${after}  ${after > before ? 'INFLATED (SUCCEEDED)' : 'unchanged (FAILED)'}`);
  }

  console.log('\n================ ATTACK (a3): impersonate the PEER derived wallet address (from=PEER, sender=derive(PEER)) ================');
  {
    // This is the LEGIT credit path — but attacker does NOT control derive(PEER). We simulate as if attacker
    // somehow can send from that address. If they could, it would be a legit incoming transfer (peer really paid).
    // Show that ONLY the true derived wallet passes (this is the intended credit, funded by peer's real balance).
    const peerWalletAddr = await walletAddrFor(PEER);
    const before = await balOf();
    const res = await victim.send(bc.sender(peerWalletAddr), { value: toNano('1'), bounce: true }, {
      $$type: 'JettonInternalTransfer', query_id: 102n, amount: 500n, from: PEER,
      response_address: PEER, forward_ton_amount: 0n, forward_payload: beginCell().endCell().beginParse(),
    } as any);
    dump(res, 'a3');
    const after = await balOf();
    console.log(`  balance ${before} -> ${after}  (this IS the legit credit path; only true derived sender passes)`);
  }

  console.log('\n================ ATTACK (a4): spoof genesis credit AFTER wallet already funded (double-credit) ================');
  {
    const before = await balOf();
    // From MASTER, but balance != 0 -> should throw 14402.
    const res = await victim.send(bc.sender(MASTER), { value: toNano('1'), bounce: true }, {
      $$type: 'ATHGenesisSupplyCredit', query_id: 2n, amount: 9999n, response_destination: MASTER,
    } as any);
    dump(res, 'a4');
    const after = await balOf();
    console.log(`  balance ${before} -> ${after}  ${after > before ? 'DOUBLE-CREDITED (SUCCEEDED)' : 'unchanged (FAILED)'}`);
  }

  console.log('\n================ ATTACK (a5): genesis credit spoofed from non-master ================');
  {
    // Fresh zero-balance wallet, attacker (not master) tries genesis credit.
    const freshInit = await ATHWallet.init(0n, A('FRESH.OWNER'), MASTER);
    const freshAddr = contractAddress(0, freshInit);
    await bc.setShardAccount(freshAddr, createShardAccount({
      address: freshAddr, code: freshInit.code, data: freshInit.data, balance: toNano('5'), workchain: 0,
    }));
    const fresh = bc.openContract(new ATHWallet(freshAddr, freshInit));
    const res = await fresh.send(bc.sender(ATTACKER), { value: toNano('1'), bounce: true }, {
      $$type: 'ATHGenesisSupplyCredit', query_id: 3n, amount: 1000000n, response_destination: ATTACKER,
    } as any);
    dump(res, 'a5');
    const after = (await fresh.getGetWalletData()).balance;
    console.log(`  fresh balance -> ${after}  ${after > 0n ? 'MINTED (SUCCEEDED)' : 'zero (FAILED)'}`);
  }

  console.log('\n================ ATTACK (b): transfer ATH you do not own (sender != owner) ================');
  {
    const before = await balOf();
    const res = await victim.send(bc.sender(ATTACKER), { value: toNano('1'), bounce: true }, {
      $$type: 'ATHTransferRequest', query_id: 200n, amount: 500n, recipient: ATTACKER, response_destination: ATTACKER,
    } as any);
    dump(res, 'b');
    const after = await balOf();
    console.log(`  balance ${before} -> ${after}  ${after < before ? 'STOLEN (SUCCEEDED)' : 'unchanged (FAILED)'}`);
  }
  console.log('\n  (b2): JettonTransfer from attacker');
  {
    const before = await balOf();
    const res = await victim.send(bc.sender(ATTACKER), { value: toNano('1'), bounce: true }, {
      $$type: 'JettonTransfer', query_id: 201n, amount: 500n, destination: ATTACKER, response_destination: ATTACKER,
      custom_payload: null, forward_ton_amount: 0n, forward_payload: beginCell().endCell().beginParse(),
    } as any);
    dump(res, 'b2');
    const after = await balOf();
    console.log(`  balance ${before} -> ${after}  ${after < before ? 'STOLEN (SUCCEEDED)' : 'unchanged (FAILED)'}`);
  }

  console.log('\n================ ATTACK (c): bounced restore MORE than removed (value inflation) ================');
  {
    // Set up a legit outgoing transfer so a pending_outgoing entry exists, then feed a bounce with a larger amount.
    // First victim (owner) does a real ATHTransferRequest to PEER of 300.
    const before = await balOf();
    const recipWallet = await walletAddrFor(PEER);
    const q = 300n;
    const sendRes = await victim.send(bc.sender(VICTIM), { value: toNano('1'), bounce: true }, {
      $$type: 'ATHTransferRequest', query_id: q, amount: 300n, recipient: PEER, response_destination: VICTIM,
    } as any);
    dump(sendRes, 'c-setup outgoing');
    const midBal = await balOf();
    console.log(`  balance after sending 300 out: ${before} -> ${midBal} (pending outgoing recorded)`);

    // Now craft a bounced ATHInternalTransfer claiming amount=999 (more than the 300 that left).
    // A bounced message has op 0xFFFFFFFF prefix + original body (partial). We forge it as sender=recipWallet.
    const bouncedBody = beginCell()
      .storeUint(0xFFFFFFFF, 32)             // bounced flag prefix Tact matches on
      .storeUint(0x41544812, 32)             // ATHInternalTransfer op
      .storeUint(q, 64)                      // query_id
      .storeUint(999n, 128)                  // amount = 999 (inflated)
      .endCell();
    // send raw internal with bounced=true from the recipient wallet address
    const res = await bc.sendMessage({
      info: { type: 'internal', ihrDisabled: true, bounce: false, bounced: true,
        src: recipWallet, dest: victimAddr, value: { coins: toNano('1') },
        ihrFee: 0n, forwardFee: 0n, createdAt: bc.now, createdLt: 50n },
      body: bouncedBody,
    } as any);
    dump(res, 'c-inflated-bounce');
    const after = await balOf();
    console.log(`  balance ${midBal} -> ${after}  (legit restore would be +300 => ${midBal + 300n}); ${after > midBal + 300n ? 'INFLATED (SUCCEEDED)' : 'not inflated (FAILED)'}`);

    // Also try the correct-amount bounce twice (double restore / replay).
    const correctBounce = beginCell()
      .storeUint(0xFFFFFFFF, 32).storeUint(0x41544812, 32).storeUint(q, 64).storeUint(300n, 128).endCell();
    const r1 = await bc.sendMessage({ info: { type: 'internal', ihrDisabled: true, bounce: false, bounced: true,
        src: recipWallet, dest: victimAddr, value: { coins: toNano('1') }, ihrFee: 0n, forwardFee: 0n, createdAt: bc.now, createdLt: 51n }, body: correctBounce } as any);
    const b1 = await balOf();
    const r2 = await bc.sendMessage({ info: { type: 'internal', ihrDisabled: true, bounce: false, bounced: true,
        src: recipWallet, dest: victimAddr, value: { coins: toNano('1') }, ihrFee: 0n, forwardFee: 0n, createdAt: bc.now, createdLt: 52n }, body: correctBounce } as any);
    const b2 = await balOf();
    console.log(`  correct-amount bounce #1 -> ${b1} (restore 300 legit); replay #2 -> ${b2}  ${b2 > b1 ? 'DOUBLE-RESTORE (SUCCEEDED)' : 'replay blocked (FAILED)'}`);
  }

  console.log('\n================ ATTACK (d): drain wallet TON via SendRemainingValue paths / spam ==================');
  {
    // (d1) Spam PruneStaleNotification / ATHTransferAck with no pending entry — do they leak TON out?
    const tonBefore = await tonOf();
    // Unsolicited ATHTransferAck from attacker (no pending) -> should throw 14241, no send.
    const r1 = await victim.send(bc.sender(ATTACKER), { value: toNano('0.5'), bounce: true }, {
      $$type: 'ATHTransferAck', query_id: 777n, amount: 1n,
    } as any);
    // Unsolicited PruneStaleNotification -> 14350
    const r2 = await victim.send(bc.sender(ATTACKER), { value: toNano('0.5'), bounce: true }, {
      $$type: 'PruneStaleNotification', query_id: 777n, sender_key: 5n,
    } as any);
    // AthTransferNotificationAck from non-owner -> 14340
    const r3 = await victim.send(bc.sender(ATTACKER), { value: toNano('0.5'), bounce: true }, {
      $$type: 'AthTransferNotificationAck', query_id: 777n, amount: 1n, sender_key: 5n,
    } as any);
    const tonAfter = await tonOf();
    dump(r1, 'd1-ack'); dump(r2, 'd2-prune'); dump(r3, 'd3-notifack');
    console.log(`  wallet TON ${Number(tonBefore)/1e9} -> ${Number(tonAfter)/1e9}  (attacker-supplied value bounces back; own balance not drained if delta ~ -fees only)`);
    console.log(`  delta = ${Number(tonAfter - tonBefore)/1e9} TON`);
  }

  console.log('\n================ ATTACK (d-empty): empty message must be rejected (no fallback drain) ================');
  {
    const tonBefore = await tonOf();
    const res = await bc.sendMessage({ info: { type: 'internal', ihrDisabled: true, bounce: true, bounced: false,
      src: ATTACKER, dest: victimAddr, value: { coins: toNano('0.5') }, ihrFee: 0n, forwardFee: 0n, createdAt: bc.now, createdLt: 60n },
      body: beginCell().endCell() } as any);
    dump(res, 'd-empty');
    const tonAfter = await tonOf();
    console.log(`  wallet TON ${Number(tonBefore)/1e9} -> ${Number(tonAfter)/1e9}`);
  }

  console.log('\nFINAL victim ATH balance:', (await balOf()).toString(), '(started', START_BAL.toString() + ')');
}
main().catch(e => { console.error(e); process.exit(1); });
