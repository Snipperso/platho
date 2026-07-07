// Проверка GetGems UI Buy/Cancel при СИНТЕТИЧЕСКОМ балансе NFT ≈0.0505 (как в их серверной эмуляции):
// покупка шлёт нашему NFT transfer с forward_amount = 1 nanoTON, cancel — с forward 0.
// Если обе проходят при 0.0505 — кнопки Buy и Cancel на GetGems работают, красен только листинг.
import { readFileSync } from 'node:fs';
import { Blockchain } from '@ton/sandbox';
import { Cell, Address, beginCell } from '@ton/core';

const DIR = 'C:/platho/artifacts/getgems-sale-emulation-20260707';
const nftInfo = JSON.parse(readFileSync(`${DIR}/nft_support.json`, 'utf8'));
const ggInfo = JSON.parse(readFileSync(`${DIR}/gg_deployer.json`, 'utf8'));
const cellFromMaybeHex = (s) => Cell.fromBoc(Buffer.from(s, /^[0-9a-fA-F]+$/.test(s) ? 'hex' : 'base64'))[0];

const NFT = Address.parse('0:50f4a53514cdfce329f7f587ff236568a5f5635ca02cbc0b8106beeac2b303fe');
const GG_DEPLOYER = Address.parse('0:39d63083e48f46452ff8a04cd0d3733a90c8be299aa5951b62741759b2c17e0e');
const OWNER = Address.parse('0:d4e3c9bf9d80b5da8a87267286f67044e258c6a546071cb3d2fa8c228fd04438');
const NFT_DNS = Address.parse('0:7e391adb6eb1c2966540d2955a966c89b95b4a1dcf0e8df753bd45a09611db5b');
const DNS_OWNER = Address.parse('0:e022094d465a04582eaa70ae29cae4826337982c4eb893f355ffe14228969919');
const SALE = Address.parse('EQBD2pu3PuFNxhQOwKGKucM3YVAJwjIc6rHIU1p_W8L9GwuW');
const BUYER = Address.parse('0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

const cellBits = (cell) => { let s = ''; for (let i = 0; i < cell.bits.length; i++) s += cell.bits.at(i) ? '1' : '0'; return s; };
const addrBits = (a) => cellBits(beginCell().storeAddress(a).endCell());
const rewrite = (cell, reps) => {
  let bits = cellBits(cell);
  for (const [f, t] of reps) bits = bits.split(f).join(t);
  const b = beginCell();
  for (const ch of bits) b.storeBit(ch === '1');
  for (const r of cell.refs) b.storeRef(rewrite(r, reps));
  return b.endCell();
};

function report(label, res, addrName) {
  for (const tx of res.transactions) {
    const d = tx.description;
    const compute = d.computePhase?.type === 'vm' ? d.computePhase.exitCode : d.computePhase?.type;
    const action = d.actionPhase ? d.actionPhase.resultCode : 'none';
    const dest = tx.inMessage.info.dest;
    const name = addrName(dest);
    if (name === null) continue;
    const inOp = (() => { try { const s = tx.inMessage.body.beginParse(); return s.remainingBits >= 32 ? '0x' + s.loadUint(32).toString(16) : '(empty)'; } catch { return '?'; } })();
    console.log(`  ${label} tx @ ${name} op=${inOp} compute=${compute} action=${action} aborted=${d.aborted}`);
  }
}

async function buildChainWithNftBalance(nftBalanceBeforeSale) {
  const bc = await Blockchain.create();
  bc.now = 1783000000;
  const put = (addr, balance, code, data) => bc.setShardAccount(addr, {
    account: { addr, storage: { lastTransLt: 0n, balance: { coins: balance },
      state: { type: 'active', state: { code, data } } },
      storageStats: { used: { cells: 30n, bits: 8000n }, lastPaid: 1782900000, duePayment: null } },
    lastTransactionLt: 0n, lastTransactionHash: 0n,
  });
  await put(NFT, 495888798n, cellFromMaybeHex(nftInfo.code), cellFromMaybeHex(nftInfo.data));
  await put(GG_DEPLOYER, BigInt(ggInfo.balance), cellFromMaybeHex(ggInfo.code), cellFromMaybeHex(ggInfo.data));

  const t1 = rewrite(Cell.fromBase64(readFileSync(`${DIR}/t1_body.b64`, 'utf8').trim()),
    [[addrBits(NFT_DNS), addrBits(NFT)], [addrBits(DNS_OWNER), addrBits(OWNER)]]);
  await bc.sendMessage({
    info: { type: 'internal', ihrDisabled: true, bounce: true, bounced: false,
      src: OWNER, dest: NFT, value: { coins: 213000000n }, ihrFee: 0n, forwardFee: 0n,
      createdAt: bc.now, createdLt: 1n },
    body: t1,
  });
  // листинг готов (NFT у sale). Теперь принудительно ставим балансу NFT «синтетическое» значение.
  const nft = await bc.getContract(NFT);
  const sa = nft.account;
  sa.account.storage.balance.coins = nftBalanceBeforeSale;
  await bc.setShardAccount(NFT, sa);
  return bc;
}

const name = (a) => a.equals(NFT) ? 'NFT' : a.equals(SALE) ? 'SALE' : null;

// BUY при балансе NFT 0.050495715
{
  const bc = await buildChainWithNftBalance(50495715n);
  console.log('\n=== BUY @ NFT balance 0.050495715 ===');
  const res = await bc.sendMessage({
    info: { type: 'internal', ihrDisabled: true, bounce: true, bounced: false,
      src: BUYER, dest: SALE, value: { coins: 801000000000n }, ihrFee: 0n, forwardFee: 0n,
      createdAt: bc.now, createdLt: 20n },
    body: beginCell().endCell(),
  });
  report('buy', res, name);
  const st = await bc.runGetMethod(NFT, 'get_nft_data', []);
  console.log('  owner after buy:', st.stack[3].cell.beginParse().loadAddress().equals(BUYER) ? 'BUYER ✓' : 'NOT BUYER ✗');
}

// CANCEL при балансе NFT 0.050495715 (владелец отменяет: op fix_price_v4_cancel = 0x1fcbd355? — шлём от владельца)
{
  const bc = await buildChainWithNftBalance(50495715n);
  console.log('\n=== CANCEL @ NFT balance 0.050495715 ===');
  // V4R1 cancel: любой authorized (owner/marketplace) шлёт op cancel; проверим op 3 варианта
  for (const op of [3, 1, 2, 555]) {
    const bc2 = await buildChainWithNftBalance(50495715n);
    const res = await bc2.sendMessage({
      info: { type: 'internal', ihrDisabled: true, bounce: true, bounced: false,
        src: OWNER, dest: SALE, value: { coins: 200000000n }, ihrFee: 0n, forwardFee: 0n,
        createdAt: bc2.now, createdLt: 20n },
      body: beginCell().storeUint(op, 32).storeUint(0, 64).endCell(),
    });
    const saleTx = res.transactions[0];
    const d = saleTx.description;
    const compute = d.computePhase?.type === 'vm' ? d.computePhase.exitCode : d.computePhase?.type;
    if (compute === 0) {
      console.log(`  cancel op 0x${op.toString(16)}: sale accepted`);
      report('cancel', res, name);
      const st = await bc2.runGetMethod(NFT, 'get_nft_data', []);
      console.log('  owner after cancel:', st.stack[3].cell.beginParse().loadAddress().equals(OWNER) ? 'OWNER ✓' : 'not owner');
      break;
    } else {
      console.log(`  cancel op 0x${op.toString(16)}: exit ${compute}`);
    }
  }
}
