// Repro: NftTransfer with a large forward_payload ref tree vs the flat 10M fwd-fee allowance.
// Case A: item balance 0.25 TON -> does the item pay the payload fwd fee from its OWN balance?
// Case B: item balance 0.0505 TON -> does the action phase fail 37 (aborted, owner flip rolled back)?
import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameNFTItem,
  InitializeUsernameItem,
} from '../../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';

const REGISTRY = Address.parse('0:234e74864a149208c8359eb3ddd5cd890d14b0aabc51e716c88312bb7d8d9c92');
const OWNER = new Address(0, createHash('sha256').update('PLATHO.FWDFEE.OWNER').digest());
const NEWOWNER = new Address(0, createHash('sha256').update('PLATHO.FWDFEE.NEW').digest());

function phase(tx: any) {
  const d = tx.description;
  const compute = d.computePhase?.type === 'vm' ? d.computePhase.exitCode : d.computePhase?.type;
  const action = d.actionPhase ? d.actionPhase.resultCode : 'none';
  return { compute, action, aborted: d.aborted };
}

// Build a chain of N cells (each small bits, 1 ref) => fwd fee dominated by cell count (~40k/cell mainnet config).
let treeSeq = 0;
function bigTree(depth: number): Cell {
  // balanced 4-ary tree of UNIQUE cells (BoC dedup would collapse identical subtrees):
  // depth d => (4^(d+1)-1)/3 cells, shallow (max cell depth 512 respected)
  treeSeq += 1;
  if (depth === 0) return beginCell().storeUint(treeSeq, 32).endCell();
  return beginCell().storeUint(treeSeq, 32)
    .storeRef(bigTree(depth - 1)).storeRef(bigTree(depth - 1))
    .storeRef(bigTree(depth - 1)).storeRef(bigTree(depth - 1)).endCell();
}

function transferBody(forwardAmount: bigint, payloadTree: Cell): Cell {
  return beginCell()
    .storeUint(0x5fcc3d14, 32)
    .storeUint(42n, 64)
    .storeAddress(NEWOWNER)          // new_owner
    .storeAddress(OWNER)             // response_destination
    .storeBit(0)                     // custom_payload: none
    .storeCoins(forwardAmount)       // forward_amount
    .storeBit(1).storeRef(payloadTree) // forward_payload: Either right ^Cell
    .endCell();
}

async function runCase(label: string, itemBalance: bigint, cells: number) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1783000000;
  const hash = BigInt('0x' + beginCell().storeUint(0xC5CC7CD6, 32)
    .storeBuffer(Buffer.from('support', 'ascii')).endCell().hash().toString('hex'));
  const itemInit = await UsernameNFTItem.init(REGISTRY, hash);
  const itemAddress = contractAddress(0, itemInit);
  await blockchain.setShardAccount(itemAddress, createShardAccount({
    address: itemAddress, code: itemInit.code, data: itemInit.data, balance: toNano('0.5'), workchain: 0,
  }));
  const item = blockchain.openContract(new UsernameNFTItem(itemAddress, itemInit));
  await item.send(blockchain.sender(REGISTRY), { value: 4_000_000n }, {
    $$type: 'InitializeUsernameItem',
    owner_wallet: OWNER,
    username_len: 7n,
    username: beginCell().storeBuffer(Buffer.from('support', 'ascii')).endCell().beginParse(),
  } as InitializeUsernameItem);
  if (!(await item.getGetState()).initialized) throw new Error('init failed');

  const contract = await blockchain.getContract(itemAddress);
  const shard = contract.account;
  shard.account!.storage.balance.coins = itemBalance;
  await blockchain.setShardAccount(itemAddress, shard);

  const value = 213_000_000n; // same shape as GetGems T1
  const fwd = 1_000_000n;
  const res = await blockchain.sendMessage({
    info: {
      type: 'internal', ihrDisabled: true, bounce: true, bounced: false,
      src: OWNER, dest: itemAddress, value: { coins: value },
      ihrFee: 0n, forwardFee: 0n, createdAt: blockchain.now, createdLt: 10n,
    },
    body: transferBody(fwd, bigTree(cells)),
  } as any);

  console.log(`\n=== ${label}: balance ${Number(itemBalance)/1e9}, payload ${cells} cells, value 0.213, fwd 0.001 ===`);
  let itemTx: any = null;
  for (const tx of res.transactions) {
    const info = tx.inMessage?.info;
    if (info?.type === 'internal' && info.dest.equals(itemAddress)) { itemTx = tx; break; }
  }
  const p = phase(itemTx);
  console.log(`ITEM tx: compute=${p.compute} action=${p.action} aborted=${p.aborted} outs=${itemTx.outMessagesCount}`);
  const after = await blockchain.getContract(itemAddress);
  const delta = after.balance - itemBalance;
  console.log(`item balance after: ${Number(after.balance)/1e9} (delta ${Number(delta)/1e9})`);
  const owner = (await item.getGetState()).owner_wallet;
  console.log(`owner after: ${owner.equals(NEWOWNER) ? 'NEWOWNER (flip committed)' : owner.equals(OWNER) ? 'OWNER (rolled back / unchanged)' : owner.toString()}`);
  // total fwd fees actually charged on outgoing messages
  if (itemTx.description.actionPhase) {
    const ap = itemTx.description.actionPhase;
    console.log(`action phase: totalFwdFees=${ap.totalFwdFees ? Number(ap.totalFwdFees)/1e9 : ap.totalFwdFees} totalActionFees=${ap.totalActionFees ? Number(ap.totalActionFees)/1e9 : ap.totalActionFees} resultCode=${ap.resultCode}`);
  }
}

async function main() {
  // sanity: tiny payload, listing shape вЂ” must be fine
  await runCase('CONTROL small payload (depth 0 = 1 cell)', 50_495_715n, 0);
  // Case A: healthy balance, 1000-cell payload
  await runCase('CASE A big payload (depth 4 = 341 cells), healthy balance', 250_000_000n, 4);
  // Case B: GetGems synthetic low balance, 1000-cell payload
  await runCase('CASE B big payload (depth 5 = 1365 cells), low balance', 50_495_715n, 5);
  await runCase('CASE C huge payload (depth 6 = 5461 cells), healthy balance 0.25', 250_000_000n, 6);
  await runCase('CASE E huge payload (depth 6 = 5461 cells), tiny balance 0.001 -> expect action fail + rollback', 1_000_000n, 6);
}

main().catch((e) => { console.error(e); process.exit(1); });





