// Sandbox-репро GetGems put-on-sale для support.ath username NFT.
// Live code+data нашего NFT и деплойера GetGems + реальное тело T1 (transfer с sale-инструкциями)
// из успешной продажи TON DNS, адаптированное под наш NFT побитовой заменой адресов.
import { readFileSync } from 'node:fs';
import { Blockchain } from '@ton/sandbox';
import { Cell, Address, beginCell, Slice, loadMessage } from '@ton/core';

const DIR = 'C:/Users/redacted/AppData/Local/Temp/claude/C--platho/962ed46d-ac7c-4436-9615-a83dddbf955c/scratchpad';

function readJson(name) { return JSON.parse(readFileSync(`${DIR}/${name}`, 'utf8')); }
function cellFromMaybeHex(s) {
  const isHex = /^[0-9a-fA-F]+$/.test(s);
  return Cell.fromBoc(Buffer.from(s, isHex ? 'hex' : 'base64'))[0];
}

const nftInfo = readJson('nft_support.json');
const ggInfo = readJson('gg_deployer.json');
const t1BodyOrig = Cell.fromBase64(readFileSync(`${DIR}/t1_body.b64`, 'utf8').trim());

const NFT_SUPPORT = Address.parse('0:50f4a53514cdfce329f7f587ff236568a5f5635ca02cbc0b8106beeac2b303fe');
const NFT_DNS = Address.parse('0:7e391adb6eb1c2966540d2955a966c89b95b4a1dcf0e8df753bd45a09611db5b');
const GG_DEPLOYER = Address.parse('0:39d63083e48f46452ff8a04cd0d3733a90c8be299aa5951b62741759b2c17e0e');
const DNS_OWNER = Address.parse('0:e022094d465a04582eaa70ae29cae4826337982c4eb893f355ffe14228969919');
const OUR_OWNER = Address.parse('0:d4e3c9bf9d80b5da8a87267286f67044e258c6a546071cb3d2fa8c228fd04438');

// --- побитовая замена адресов в дереве ячеек ---
function addrBits(addr) {
  // addr_std$10 anycast:(Maybe) 0 wc:int8 addr:bits256 → '100' + 8 бит wc + 256 бит hash
  const c = beginCell().storeAddress(addr).endCell();
  return cellBits(c);
}
function cellBits(cell) {
  let s = '';
  const bs = cell.bits;
  for (let i = 0; i < bs.length; i++) s += bs.at(i) ? '1' : '0';
  return s;
}
function bitsToBuilder(bits, b) {
  for (const ch of bits) b.storeBit(ch === '1');
  return b;
}
function rewriteCell(cell, replacements) {
  let bits = cellBits(cell);
  for (const [from, to] of replacements) {
    if (from.length !== to.length) throw new Error('len mismatch');
    bits = bits.split(from).join(to);
  }
  const b = beginCell();
  bitsToBuilder(bits, b);
  for (const ref of cell.refs) b.storeRef(rewriteCell(ref, replacements));
  return b.endCell();
}

const replacements = [
  [addrBits(NFT_DNS), addrBits(NFT_SUPPORT)],
  [addrBits(DNS_OWNER), addrBits(OUR_OWNER)],
  // и голые 256-битные хеши без address-префикса (на случай сырых uint256 в данных)
  [cellBits(beginCell().storeBuffer(NFT_DNS.hash).endCell()), cellBits(beginCell().storeBuffer(NFT_SUPPORT.hash).endCell())],
];
const t1Body = rewriteCell(t1BodyOrig, replacements);

// разбор T1 для контроля
{
  const s = t1Body.beginParse();
  const op = s.loadUint(32); const qid = s.loadUintBig(64);
  const newOwner = s.loadAddress(); const respDest = s.loadAddress();
  const custom = s.loadMaybeRef(); const fwd = s.loadCoins();
  console.log('T1: op', op.toString(16), 'new_owner', newOwner.toString(), '\n    resp_dest', respDest.toString(), 'custom?', !!custom, 'forward', fwd.toString());
}

const blockchain = await Blockchain.create();
blockchain.now = Math.floor(1783000000); // фиксированное "сейчас" позже live-стейтов

async function putAccount(addr, info) {
  await blockchain.setShardAccount(addr, {
    account: {
      addr,
      storage: {
        lastTransLt: 0n,
        balance: { coins: BigInt(info.balance) },
        state: {
          type: 'active',
          state: { code: cellFromMaybeHex(info.code), data: cellFromMaybeHex(info.data) },
        },
      },
      storageStats: { used: { cells: 30n, bits: 8000n }, lastPaid: Math.floor(1782900000), duePayment: null },
    },
    lastTransactionLt: 0n,
    lastTransactionHash: 0n,
  });
}
await putAccount(NFT_SUPPORT, nftInfo);
await putAccount(GG_DEPLOYER, ggInfo);

function fmt(addr) {
  const a = addr.toString();
  if (addr.equals(NFT_SUPPORT)) return 'NFT(support.ath)';
  if (addr.equals(GG_DEPLOYER)) return 'GG_DEPLOYER';
  if (addr.equals(OUR_OWNER)) return 'OWNER';
  return 'sale/other:' + a.slice(0, 8) + '…' + a.slice(-6);
}

async function runTransfer(label, { value, body }) {
  console.log(`\n=== ${label} ===`);
  const res = await blockchain.sendMessage({
    info: {
      type: 'internal', ihrDisabled: true, bounce: true, bounced: false,
      src: OUR_OWNER, dest: NFT_SUPPORT,
      value: { coins: value }, ihrFee: 0n, forwardFee: 0n, createdAt: blockchain.now, createdLt: 1n,
    },
    body,
  });
  for (const tx of res.transactions) {
    const d = tx.description;
    const compute = d.computePhase?.type === 'vm' ? d.computePhase.exitCode : d.computePhase?.type;
    const action = d.actionPhase ? d.actionPhase.resultCode : 'none';
    const inV = tx.inMessage?.info?.type === 'internal' ? tx.inMessage.info.value.coins : 'ext';
    const inOp = (() => { try { const s = tx.inMessage.body.beginParse(); return s.remainingBits >= 32 ? '0x' + s.loadUint(32).toString(16) : '(empty)'; } catch { return '?'; } })();
    console.log(`tx @ ${fmt(tx.inMessage.info.dest)} in_op=${inOp} in_val=${inV} compute=${compute} action=${action} aborted=${d.aborted} outs=${tx.outMessagesCount}`);
    if (d.aborted) {
      console.log('  !! ABORTED. bounce?', d.bouncePhase?.type ?? 'no');
    }
  }
  return res;
}

// A: реальная GetGems-транзакция put-on-sale (value 0.213, forward 0.2, payload с sale stateInit)
const resA = await runTransfer('A: real GetGems put-on-sale T1 (0.213 TON)', { value: 213000000n, body: t1Body });

// владелец NFT после цепочки
{
  const st = await blockchain.runGetMethod(NFT_SUPPORT, 'get_nft_data', []);
  const owner = st.stack[3];
  console.log('\nfinal get_nft_data owner slice type:', owner.type);
  if (owner.type === 'slice') {
    console.log('final owner:', owner.cell.beginParse().loadAddress().toString());
  }
}

// баланс NFT после полной успешной цепочки
{
  const c = await blockchain.getContract(NFT_SUPPORT);
  console.log('NFT balance after full chain:', c.balance.toString(), '=', Number(c.balance)/1e9, 'TON');
}

// разбор данных задеплоенного sale (fix-price v4)
{
  const SALE = Address.parse('EQBD2pu3PuFNxhQOwKGKucM3YVAJwjIc6rHIU1p_W8L9GwuW');
  for (const m of ['get_fix_price_data_v4', 'get_sale_data', 'get_fix_price_data']) {
    try {
      const r = await blockchain.runGetMethod(SALE, m, []);
      console.log('\n', m, 'exit', r.exitCode);
      if (r.exitCode === 0) {
        r.stack.forEach((it, i) => {
          if (it.type === 'int') console.log(`  [${i}] int ${it.value}`);
          else if (it.type === 'slice') { try { console.log(`  [${i}] addr ${it.cell.beginParse().loadAddress()}`); } catch { console.log(`  [${i}] slice`); } }
          else if (it.type === 'cell') console.log(`  [${i}] cell bits=${it.cell.bits.length} refs=${it.cell.refs.length}`);
          else console.log(`  [${i}]`, it.type);
        });
        break;
      }
    } catch (e) { console.log(m, 'error', String(e).slice(0,80)); }
  }
}

// ЭМУЛЯЦИЯ ПОКУПКИ: покупатель шлёт full_price + 1 TON газа на sale
{
  const SALE = Address.parse('EQBD2pu3PuFNxhQOwKGKucM3YVAJwjIc6rHIU1p_W8L9GwuW');
  const BUYER = Address.parse('0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  const res = await blockchain.sendMessage({
    info: { type: 'internal', ihrDisabled: true, bounce: true, bounced: false,
      src: BUYER, dest: SALE, value: { coins: 801000000000n }, ihrFee: 0n, forwardFee: 0n,
      createdAt: blockchain.now, createdLt: 2n },
    body: beginCell().endCell(),
  });
  console.log('\n=== BUY (801 TON to sale) ===');
  for (const tx of res.transactions) {
    const d = tx.description;
    const compute = d.computePhase?.type === 'vm' ? d.computePhase.exitCode : d.computePhase?.type;
    const action = d.actionPhase ? d.actionPhase.resultCode : 'none';
    const inV = tx.inMessage?.info?.type === 'internal' ? Number(tx.inMessage.info.value.coins)/1e9 : 'ext';
    const inOp = (() => { try { const s = tx.inMessage.body.beginParse(); return s.remainingBits >= 32 ? '0x' + s.loadUint(32).toString(16) : '(empty)'; } catch { return '?'; } })();
    console.log(`tx @ ${fmt(tx.inMessage.info.dest)} in_op=${inOp} in_val=${inV} compute=${compute} action=${action} aborted=${d.aborted} outs=${tx.outMessagesCount}`);
    for (const om of tx.outMessages.values()) {
      if (om.info.type === 'internal') console.log(`    -> ${fmt(om.info.dest)} ${Number(om.info.value.coins)/1e9} TON`);
    }
  }
  const st = await blockchain.runGetMethod(NFT_SUPPORT, 'get_nft_data', []);
  console.log('owner after buy:', st.stack[3].cell.beginParse().loadAddress().toString());
  console.log('(buyer =', BUYER.toString(), ')');
  const c = await blockchain.getContract(NFT_SUPPORT);
  console.log('NFT balance after buy:', Number(c.balance)/1e9, 'TON');
}
