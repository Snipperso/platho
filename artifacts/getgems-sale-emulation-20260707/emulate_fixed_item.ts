// E2E-проверка ПОЧИНЕННОГО UsernameNFTItem против реального GetGems put-on-sale флоу:
// новый item-код + live-код деплойера GetGems + реальное тело T1 (адреса переписаны).
// Ожидание: T1 проходит при балансе item 0.0505 (v1 падал action 37), полная цепочка
// листинга, покупка и отмена работают, item никогда не платит из собственного баланса.
// Запуск: npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" artifacts/getgems-sale-emulation-20260707/emulate_fixed_item.ts
import { readFileSync } from 'fs';
import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameNFTItem,
  InitializeUsernameItem,
} from '../../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';

const DIR = 'artifacts/getgems-sale-emulation-20260707';
const ggInfo = JSON.parse(readFileSync(`${DIR}/gg_deployer.json`, 'utf8'));
const cellFromMaybeHex = (s: string) => Cell.fromBoc(Buffer.from(s, /^[0-9a-fA-F]+$/.test(s) ? 'hex' : 'base64'))[0];

const GG_DEPLOYER = Address.parse('0:39d63083e48f46452ff8a04cd0d3733a90c8be299aa5951b62741759b2c17e0e');
const NFT_DNS = Address.parse('0:7e391adb6eb1c2966540d2955a966c89b95b4a1dcf0e8df753bd45a09611db5b');
const DNS_OWNER = Address.parse('0:e022094d465a04582eaa70ae29cae4826337982c4eb893f355ffe14228969919');
const REGISTRY = Address.parse('0:234e74864a149208c8359eb3ddd5cd890d14b0aabc51e716c88312bb7d8d9c92');
const OWNER = new Address(0, createHash('sha256').update('PLATHO.CLEAN15.EMU.OWNER').digest());
const BUYER = new Address(0, createHash('sha256').update('PLATHO.CLEAN15.EMU.BUYER').digest());

const nameHash = (name: string) => BigInt('0x' + beginCell()
  .storeUint(0xC5CC7CD6, 32).storeBuffer(Buffer.from(name, 'ascii')).endCell().hash().toString('hex'));

const cellBits = (c: Cell) => { let s = ''; for (let i = 0; i < c.bits.length; i++) s += c.bits.at(i) ? '1' : '0'; return s; };
const addrBits = (a: Address) => cellBits(beginCell().storeAddress(a).endCell());
function rewrite(cell: Cell, reps: Array<[string, string]>): Cell {
  let bits = cellBits(cell);
  for (const [f, t] of reps) bits = bits.split(f).join(t);
  const b = beginCell();
  for (const ch of bits) b.storeBit(ch === '1');
  for (const r of cell.refs) b.storeRef(rewrite(r, reps));
  return b.endCell();
}

type TxLike = { description: any; inMessage?: any; outMessagesCount: number };
function phase(tx: TxLike) {
  const d = tx.description;
  const compute = d.computePhase?.type === 'vm' ? d.computePhase.exitCode : d.computePhase?.type;
  const action = d.actionPhase ? d.actionPhase.resultCode : 'none';
  return { compute, action, aborted: d.aborted };
}

async function main() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1783000000;

  // новый item, инициализированный "реестром" (live-адрес реестра как коллекция)
  const hash = nameHash('support');
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

  // live-деплойер GetGems
  await blockchain.setShardAccount(GG_DEPLOYER, createShardAccount({
    address: GG_DEPLOYER, code: cellFromMaybeHex(ggInfo.code), data: cellFromMaybeHex(ggInfo.data),
    balance: BigInt(ggInfo.balance), workchain: 0,
  }));

  // синтетический баланс GetGems-пре-флайта
  const contract = await blockchain.getContract(itemAddress);
  const shard = contract.account;
  shard.account!.storage.balance.coins = 50_495_715n;
  await blockchain.setShardAccount(itemAddress, shard);

  const t1 = rewrite(Cell.fromBase64(readFileSync(`${DIR}/t1_body.b64`, 'utf8').trim()), [
    [addrBits(NFT_DNS), addrBits(itemAddress)],
    [addrBits(DNS_OWNER), addrBits(OWNER)],
  ]);

  console.log('=== T1 put-on-sale (0.213/fwd 0.2) @ item balance 0.050495715, FIXED code ===');
  const res = await blockchain.sendMessage({
    info: {
      type: 'internal', ihrDisabled: true, bounce: true, bounced: false,
      src: OWNER, dest: itemAddress, value: { coins: 213_000_000n },
      ihrFee: 0n, forwardFee: 0n, createdAt: blockchain.now, createdLt: 1n,
    },
    body: t1,
  } as any);

  let saleAddress: Address | null = null;
  for (const tx of res.transactions) {
    const info = tx.inMessage?.info;
    if (info?.type !== 'internal') continue;
    const p = phase(tx as any);
    const dest: Address = info.dest;
    const label = dest.equals(itemAddress) ? 'ITEM' : dest.equals(GG_DEPLOYER) ? 'DEPLOYER' : dest.equals(OWNER) ? 'owner' : 'sale?' ;
    if (label === 'sale?' && tx.inMessage?.init) saleAddress = dest;
    console.log(`tx @ ${label} compute=${p.compute} action=${p.action} aborted=${p.aborted} outs=${tx.outMessagesCount}`);
    if (p.aborted && (label === 'ITEM' || label === 'DEPLOYER' || label === 'sale?')) {
      throw new Error(`ABORTED at ${label}`);
    }
  }
  const afterT1 = await blockchain.getContract(itemAddress);
  console.log('item balance after listing:', Number(afterT1.balance) / 1e9, '(started 0.050495715 — must not have dropped)');
  if (afterT1.balance < 50_000_000n) throw new Error('item balance drained');
  if (!saleAddress) throw new Error('sale not deployed');
  const ownerAfterList = (await item.getGetState()).owner_wallet;
  if (!ownerAfterList.equals(saleAddress)) throw new Error('NFT not owned by sale');
  console.log('LISTING OK: NFT owned by sale', saleAddress.toString());

  console.log('\n=== BUY (801 TON) ===');
  const buyRes = await blockchain.sendMessage({
    info: {
      type: 'internal', ihrDisabled: true, bounce: true, bounced: false,
      src: BUYER, dest: saleAddress, value: { coins: 801_000_000_000n },
      ihrFee: 0n, forwardFee: 0n, createdAt: blockchain.now, createdLt: 2n,
    },
    body: beginCell().endCell(),
  } as any);
  for (const tx of buyRes.transactions) {
    const info = tx.inMessage?.info;
    if (info?.type !== 'internal') continue;
    const dest: Address = info.dest;
    if (dest.equals(itemAddress) || dest.equals(saleAddress)) {
      const p = phase(tx as any);
      console.log(`tx @ ${dest.equals(itemAddress) ? 'ITEM' : 'SALE'} compute=${p.compute} action=${p.action} aborted=${p.aborted}`);
      if (p.aborted) throw new Error('BUY aborted');
    }
  }
  if (!(await item.getGetState()).owner_wallet.equals(BUYER)) throw new Error('buyer did not receive NFT');
  console.log('BUY OK: NFT owned by buyer');

  console.log('\n=== CANCEL path (fresh listing, owner cancels, op 3) ===');
  // новый листинг от покупателя (теперь владельца)
  const t1b = rewrite(Cell.fromBase64(readFileSync(`${DIR}/t1_body.b64`, 'utf8').trim()), [
    [addrBits(NFT_DNS), addrBits(itemAddress)],
    [addrBits(DNS_OWNER), addrBits(BUYER)],
  ]);
  const relist = await blockchain.sendMessage({
    info: {
      type: 'internal', ihrDisabled: true, bounce: true, bounced: false,
      src: BUYER, dest: itemAddress, value: { coins: 213_000_000n },
      ihrFee: 0n, forwardFee: 0n, createdAt: blockchain.now, createdLt: 3n,
    },
    body: t1b,
  } as any);
  let sale2: Address | null = null;
  for (const tx of relist.transactions) {
    const info = tx.inMessage?.info;
    if (info?.type === 'internal' && tx.inMessage?.init && !info.dest.equals(itemAddress)) sale2 = info.dest;
  }
  if (!sale2) throw new Error('relist sale not deployed');
  const cancelRes = await blockchain.sendMessage({
    info: {
      type: 'internal', ihrDisabled: true, bounce: true, bounced: false,
      src: BUYER, dest: sale2, value: { coins: 200_000_000n },
      ihrFee: 0n, forwardFee: 0n, createdAt: blockchain.now, createdLt: 4n,
    },
    body: beginCell().storeUint(3, 32).storeUint(0, 64).endCell(),
  } as any);
  for (const tx of cancelRes.transactions) {
    const info = tx.inMessage?.info;
    if (info?.type !== 'internal') continue;
    if (info.dest.equals(itemAddress) || info.dest.equals(sale2)) {
      const p = phase(tx as any);
      if (p.aborted) throw new Error('CANCEL aborted');
    }
  }
  if (!(await item.getGetState()).owner_wallet.equals(BUYER)) throw new Error('cancel did not return NFT');
  console.log('CANCEL OK: NFT returned to owner');

  console.log('\nALL GETGEMS FLOWS PASS ON FIXED CODE');
}

main().catch((e) => { console.error(e); process.exit(1); });
