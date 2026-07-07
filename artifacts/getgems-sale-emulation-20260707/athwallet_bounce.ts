// RED-TEAM part 2: exercise the REAL bounce path via a recipient that rejects, then probe replay/inflation.
import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { ATHWallet } from '../../build/ATHWallet/ATHWallet_ATHWallet';

const A = (t: string) => new Address(0, createHash('sha256').update(t).digest());
function phase(tx: any){const d=tx.description;return{compute:d.computePhase?.type==='vm'?d.computePhase.exitCode:d.computePhase?.type,action:d.actionPhase?d.actionPhase.resultCode:'none',aborted:d.aborted};}
function dump(res:any,l:string){console.log(`  [${l}]`);for(const tx of res.transactions){const i=tx.inMessage?.info;if(i?.type!=='internal')continue;const p=phase(tx);console.log(`    dest=${i.dest?.toString().slice(0,10)} bounced=${i.bounced} compute=${p.compute} action=${p.action} aborted=${p.aborted} outs=${tx.outMessagesCount}`);}}

async function main(){
  const bc=await Blockchain.create(); bc.now=1783000000;
  const MASTER=A('M'); const VICTIM=A('V'); const PEER=A('P');
  const vInit=await ATHWallet.init(0n,VICTIM,MASTER); const vAddr=contractAddress(0,vInit);
  await bc.setShardAccount(vAddr,createShardAccount({address:vAddr,code:vInit.code,data:vInit.data,balance:toNano('10'),workchain:0}));
  const victim=bc.openContract(new ATHWallet(vAddr,vInit));
  await victim.send(bc.sender(MASTER),{value:toNano('1'),bounce:true},{$$type:'ATHGenesisSupplyCredit',query_id:1n,amount:1000n,response_destination:MASTER} as any);
  const bal=async()=>(await victim.getGetWalletData()).balance;
  console.log('start balance',(await bal()).toString());

  // Real outgoing transfer to PEER. PEER wallet is NOT deployed with matching code from a foreign master path;
  // but derive(PEER) uses same code — the internal transfer will be delivered & credited. To force a bounce,
  // we instead send to a recipient whose derived wallet will THROW on ATHInternalTransfer (e.g. insufficient value).
  // Simpler: capture the outgoing ATHInternalTransfer, then hand-craft a Tact-recognized bounce of THAT exact body.
  const q=300n;
  const outRes=await victim.send(bc.sender(VICTIM),{value:toNano('1'),bounce:true},{$$type:'ATHTransferRequest',query_id:q,amount:300n,recipient:PEER,response_destination:VICTIM} as any);
  console.log('after send-out balance',(await bal()).toString(),'(1000-300=700 expected)');
  // Find the outgoing ATHInternalTransfer body sent to derive(PEER).
  const recip=contractAddress(0,await ATHWallet.init(0n,PEER,MASTER));
  let outBody:Cell|null=null;
  for(const tx of outRes.transactions){
    for(const om of tx.outMessages.values()){
      if(om.info.type==='internal'&&om.info.dest.equals(recip)){outBody=om.body;}
    }
  }
  if(!outBody){throw new Error('no outgoing body captured');}
  console.log('captured outgoing body, op=0x'+outBody.beginParse().loadUint(32).toString(16));

  // Craft a REAL bounce: TON bounces prepend 0xFFFFFFFF to (a prefix of) the original body.
  const slice=outBody.beginParse();
  const op=slice.loadUint(32); const bouncedBody=beginCell().storeUint(0xFFFFFFFF,32).storeUint(op,32);
  // copy remaining original bits (query_id+amount fit in bounce prefix by design)
  bouncedBody.storeUint(slice.loadUint(64),64).storeUint(slice.loadUint(128),128);
  const bcell=bouncedBody.endCell();

  console.log('\n--- legit bounce (correct amount 300) ---');
  const b1=await bc.sendMessage({info:{type:'internal',ihrDisabled:true,bounce:false,bounced:true,src:recip,dest:vAddr,value:{coins:toNano('1')},ihrFee:0n,forwardFee:0n,createdAt:bc.now,createdLt:50n},body:bcell} as any);
  dump(b1,'legit-bounce'); console.log('  balance now',(await bal()).toString(),'(expect restored 1000)');

  console.log('\n--- REPLAY same bounce (double restore attempt) ---');
  const b2=await bc.sendMessage({info:{type:'internal',ihrDisabled:true,bounce:false,bounced:true,src:recip,dest:vAddr,value:{coins:toNano('1')},ihrFee:0n,forwardFee:0n,createdAt:bc.now,createdLt:51n},body:bcell} as any);
  dump(b2,'replay-bounce'); console.log('  balance now',(await bal()).toString(),'(inflated if >1000)');

  console.log('\n--- INFLATED bounce (amount 9999 but real pending was 300) ---');
  const infl=beginCell().storeUint(0xFFFFFFFF,32).storeUint(op,32).storeUint(q,64).storeUint(9999n,128).endCell();
  // need a fresh pending first
  const q2=301n;
  await victim.send(bc.sender(VICTIM),{value:toNano('1'),bounce:true},{$$type:'ATHTransferRequest',query_id:q2,amount:200n,recipient:PEER,response_destination:VICTIM} as any);
  console.log('  set up new pending q2=301 amount 200, balance',(await bal()).toString());
  const infl2=beginCell().storeUint(0xFFFFFFFF,32).storeUint(op,32).storeUint(q2,64).storeUint(9999n,128).endCell();
  const b3=await bc.sendMessage({info:{type:'internal',ihrDisabled:true,bounce:false,bounced:true,src:recip,dest:vAddr,value:{coins:toNano('1')},ihrFee:0n,forwardFee:0n,createdAt:bc.now,createdLt:52n},body:infl2} as any);
  dump(b3,'inflated-bounce'); console.log('  balance now',(await bal()).toString(),'(inflated if it restored 9999 instead of 200)');

  console.log('\n--- SPOOFED bounce from WRONG sender (attacker != recipient wallet) ---');
  const spoof=beginCell().storeUint(0xFFFFFFFF,32).storeUint(op,32).storeUint(q2,64).storeUint(200n,128).endCell();
  const ATTACKER=A('ATK');
  const b4=await bc.sendMessage({info:{type:'internal',ihrDisabled:true,bounce:false,bounced:true,src:ATTACKER,dest:vAddr,value:{coins:toNano('1')},ihrFee:0n,forwardFee:0n,createdAt:bc.now,createdLt:53n},body:spoof} as any);
  dump(b4,'spoofed-sender-bounce'); console.log('  balance now',(await bal()).toString(),'(should be unchanged — wrong sender)');
}
main().catch(e=>{console.error(e);process.exit(1);});
