// Boundary probes: (1) can a big forward_payload make the ACTION phase fail (fwd fee > allowance)
// after state was already mutated -> owner flip persists but forward drops (state split)?
// (2) exact excesses conservation across a value sweep — item must NEVER pay from own balance.
import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { UsernameNFTItem, InitializeUsernameItem } from '../../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';

const REGISTRY = new Address(0, createHash('sha256').update('RT.REGISTRY').digest());
const OWNER = new Address(0, createHash('sha256').update('RT.OWNER').digest());
const ATTACKER = new Address(0, createHash('sha256').update('RT.ATTACKER').digest());
const nameHash = (name: string) => BigInt('0x' + beginCell()
  .storeUint(0xC5CC7CD6, 32).storeBuffer(Buffer.from(name, 'ascii')).endCell().hash().toString('hex'));
const NFT_TRANSFER_OP = 0x5FCC3D14;

function phase(tx: any) {
  const d = tx.description;
  const compute = d.computePhase?.type === 'vm' ? d.computePhase.exitCode : d.computePhase?.type;
  const action = d.actionPhase ? d.actionPhase.resultCode : 'none';
  const success = d.computePhase?.success && (d.actionPhase ? d.actionPhase.success : true);
  return { compute, action, aborted: d.aborted, success };
}
function msgValue(tx: any): bigint {
  const i = tx.inMessage?.info; return i?.type === 'internal' ? (i.value?.coins ?? 0n) : 0n;
}
function isFrom(tx: any, src: Address) { const i = tx.inMessage?.info; return i?.type==='internal' && i.src?.equals?.(src); }

async function freshItem(bc: Blockchain, balance: bigint) {
  const init = await UsernameNFTItem.init(REGISTRY, nameHash('victim'));
  const addr = contractAddress(0, init);
  await bc.setShardAccount(addr, createShardAccount({ address: addr, code: init.code, data: init.data, balance, workchain: 0 }));
  const item = bc.openContract(new UsernameNFTItem(addr, init));
  await item.send(bc.sender(REGISTRY), { value: 100_000_000n }, {
    $$type: 'InitializeUsernameItem', owner_wallet: OWNER, username_len: 6n,
    username: beginCell().storeBuffer(Buffer.from('victim','ascii')).endCell().beginParse(),
  } as InitializeUsernameItem);
  return { item, addr };
}
function send(bc: Blockchain, src: Address, dest: Address, value: bigint, body: Cell, lt: bigint) {
  return bc.sendMessage({ info: { type:'internal', ihrDisabled:true, bounce:true, bounced:false,
    src, dest, value:{coins:value}, ihrFee:0n, forwardFee:0n, createdAt: bc.now!, createdLt: lt }, body } as any);
}
// big forward payload: fill many refs/bits so the ownership-assigned forward is expensive
function bigPayloadBody(newOwner: Address, forwardAmount: bigint, depth: number): Cell {
  let ref: Cell = beginCell().storeUint(0xdeadbeef, 32).endCell();
  for (let i=0;i<depth;i++) ref = beginCell().storeUint(0xffffffff,32).storeUint(0xffffffff,32).storeRef(ref).storeRef(ref).endCell();
  return beginCell()
    .storeUint(NFT_TRANSFER_OP,32).storeUint(0n,64)
    .storeAddress(newOwner)
    .storeAddress(OWNER)        // response dest
    .storeBit(false)            // no custom payload
    .storeCoins(forwardAmount)
    .storeBit(true).storeRef(ref) // forward_payload as ref (Either=1)
    .endCell();
}

async function main() {
  const bc = await Blockchain.create();
  bc.now = 1783000000;
  let lt = 100n;

  // ---- Probe 1: huge forward payload, forwardFee real (non-zero) ----
  console.log('=== Probe 1: large forward payload, real forward fees, fat item balance ===');
  const { item, addr } = await freshItem(bc, toNano('10'));
  const balBefore = (await bc.getContract(addr)).balance;
  // Use a real forwardFee on the inbound so readForwardFee() is meaningful, and a deep payload.
  const body = bigPayloadBody(ATTACKER, 50_000_000n, 6); // depth 6 -> large cell tree
  const res = await bc.sendMessage({ info: { type:'internal', ihrDisabled:true, bounce:true, bounced:false,
    src: OWNER, dest: addr, value:{coins: 200_000_000n}, ihrFee:0n, forwardFee: 5_000_000n, createdAt: bc.now, createdLt: lt++ }, body } as any);
  const itemTx = res.transactions.find((t:any)=>t.inMessage?.info?.dest?.equals(addr));
  const p = phase(itemTx);
  const balAfter = (await bc.getContract(addr)).balance;
  const owner = (await item.getGetState()).owner_wallet;
  let paidOut = 0n; for (const tx of res.transactions) if (isFrom(tx, addr)) paidOut += msgValue(tx);
  console.log(`compute=${p.compute} action=${p.action} success=${p.success} aborted=${p.aborted}`);
  console.log(`owner after=${owner.equals(ATTACKER)?'ATTACKER':owner.equals(OWNER)?'OWNER':'?'}`);
  console.log(`item bal ${balBefore} -> ${balAfter}  (drop=${balBefore-balAfter}); paidOut=${paidOut}`);
  console.log(`STATE-SPLIT CHECK: if owner flipped to ATTACKER but action failed -> BAD. success=${p.success}`);
  if (owner.equals(ATTACKER) && !p.success) console.log('!!! STATE SPLIT: ownership moved but action phase failed');
  else console.log('OK: no state split (atomic — action success matches owner flip)');

  // ---- Probe 2: value sweep, verify item balance never decreases (net of gas) ----
  console.log('\n=== Probe 2: inbound value sweep — item must never pay net from own balance ===');
  const sweep = [20_000_000n, 30_000_000n, 50_000_000n, 100_000_000n, 213_000_000n, 500_000_000n, 1_000_000_000n];
  for (const v of sweep) {
    const f = await freshItem(bc, toNano('3'));
    const bB = (await bc.getContract(f.addr)).balance;
    const b = beginCell().storeUint(NFT_TRANSFER_OP,32).storeUint(0n,64)
      .storeAddress(ATTACKER).storeAddress(OWNER).storeBit(false).storeCoins(0n).storeBit(false).endCell();
    const r = await send(bc, OWNER, f.addr, v, b, lt++);
    const tx = r.transactions.find((t:any)=>t.inMessage?.info?.dest?.equals(f.addr));
    const pp = phase(tx);
    const bA = (await bc.getContract(f.addr)).balance;
    const own = (await f.item.getGetState()).owner_wallet;
    const net = bA - bB; // >=0 means item did NOT lose balance
    const flag = (pp.compute===0 && net < -5_000_000n) ? ' <== ITEM LOST BALANCE!' : '';
    console.log(`inbound=${(Number(v)/1e9).toFixed(3)} compute=${pp.compute} owner=${own.equals(ATTACKER)?'ATT':'OWN'} netBalDelta=${net}${flag}`);
  }
  console.log('\nDONE');
}
main().catch(e=>{console.error(e);process.exit(1);});
