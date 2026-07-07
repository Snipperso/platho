// Матрица синтетических transfer-эмуляций против live-состояния support.ath NFT:
// ищем вариант, который падает так, как в ошибке GetGems (exit 0 / balance 0.050495715).
import { readFileSync } from 'node:fs';
import { Blockchain } from '@ton/sandbox';
import { Cell, Address, beginCell } from '@ton/core';

const DIR = 'C:/Users/redacted/AppData/Local/Temp/claude/C--platho/962ed46d-ac7c-4436-9615-a83dddbf955c/scratchpad';
const nftInfo = JSON.parse(readFileSync(`${DIR}/nft_support.json`, 'utf8'));
const cellFromMaybeHex = (s) => Cell.fromBoc(Buffer.from(s, /^[0-9a-fA-F]+$/.test(s) ? 'hex' : 'base64'))[0];

const NFT = Address.parse('0:50f4a53514cdfce329f7f587ff236568a5f5635ca02cbc0b8106beeac2b303fe');
const OWNER = Address.parse('0:d4e3c9bf9d80b5da8a87267286f67044e258c6a546071cb3d2fa8c228fd04438');
const DEST = Address.parse('0:39d63083e48f46452ff8a04cd0d3733a90c8be299aa5951b62741759b2c17e0e');

function transferBody({ respNone = false, forward = 0n, payloadRef = false }) {
  const b = beginCell()
    .storeUint(0x5fcc3d14, 32)
    .storeUint(0n, 64)
    .storeAddress(DEST);
  if (respNone) b.storeUint(0, 2); else b.storeAddress(OWNER);
  b.storeMaybeRef(null);
  b.storeCoins(forward);
  if (payloadRef) b.storeBit(1).storeRef(beginCell().endCell()); else b.storeBit(0);
  return b.endCell();
}

async function freshChain() {
  const bc = await Blockchain.create();
  bc.now = 1783000000;
  await bc.setShardAccount(NFT, {
    account: {
      addr: NFT,
      storage: {
        lastTransLt: 0n,
        balance: { coins: BigInt(nftInfo.balance) },
        state: { type: 'active', state: { code: cellFromMaybeHex(nftInfo.code), data: cellFromMaybeHex(nftInfo.data) } },
      },
      storageStats: { used: { cells: 30n, bits: 8000n }, lastPaid: 1782900000, duePayment: null },
    },
    lastTransactionLt: 0n,
    lastTransactionHash: 0n,
  });
  return bc;
}

const cases = [];
for (const v of [10000000n, 20000000n, 50000000n, 100000000n, 1000000000n]) {
  cases.push({ label: `V=${Number(v)/1e9} fwd=0 resp=owner`, value: v, body: { forward: 0n } });
  cases.push({ label: `V=${Number(v)/1e9} fwd=0 resp=NONE`, value: v, body: { forward: 0n, respNone: true } });
  cases.push({ label: `V=${Number(v)/1e9} fwd=V/2 resp=owner`, value: v, body: { forward: v/2n } });
  cases.push({ label: `V=${Number(v)/1e9} fwd=V resp=owner`, value: v, body: { forward: v } });
}

for (const c of cases) {
  const bc = await freshChain();
  const res = await bc.sendMessage({
    info: {
      type: 'internal', ihrDisabled: true, bounce: true, bounced: false,
      src: OWNER, dest: NFT, value: { coins: c.value }, ihrFee: 0n, forwardFee: 0n,
      createdAt: bc.now, createdLt: 1n,
    },
    body: transferBody(c.body),
  });
  const tx = res.transactions[0];
  const d = tx.description;
  const compute = d.computePhase?.type === 'vm' ? d.computePhase.exitCode : d.computePhase?.type;
  const action = d.actionPhase ? d.actionPhase.resultCode : 'none';
  const endBal = tx.endStatus === 'active' ? (await bc.getContract(NFT)).balance : '?';
  const outs = [];
  for (const om of tx.outMessages.values()) {
    if (om.info.type === 'internal') outs.push(`${Number(om.info.value.coins)/1e9}`);
  }
  console.log(`${c.label.padEnd(30)} compute=${String(compute).padEnd(6)} action=${String(action).padEnd(4)} aborted=${d.aborted} outs=[${outs.join(',')}] nft_end_bal=${Number(endBal)/1e9}`);
}

// --- репро точной GetGems T1 при балансе NFT = 0.050495715 (из текста ошибки) ---
{
  const t1Body = Cell.fromBase64(readFileSync(`${DIR}/t1_body.b64`, 'utf8').trim());
  // адресная замена как в основном репро
  const NFT_DNS = Address.parse('0:7e391adb6eb1c2966540d2955a966c89b95b4a1dcf0e8df753bd45a09611db5b');
  const DNS_OWNER = Address.parse('0:e022094d465a04582eaa70ae29cae4826337982c4eb893f355ffe14228969919');
  const cellBits = (cell) => { let s=''; for (let i=0;i<cell.bits.length;i++) s += cell.bits.at(i)?'1':'0'; return s; };
  const addrBits = (a) => cellBits(beginCell().storeAddress(a).endCell());
  const rewrite = (cell, reps) => {
    let bits = cellBits(cell);
    for (const [f,t] of reps) bits = bits.split(f).join(t);
    const b = beginCell();
    for (const ch of bits) b.storeBit(ch==='1');
    for (const r of cell.refs) b.storeRef(rewrite(r, reps));
    return b.endCell();
  };
  const body = rewrite(t1Body, [[addrBits(NFT_DNS), addrBits(NFT)],[addrBits(DNS_OWNER), addrBits(OWNER)]]);

  for (const bal of [50495715n, 495888798n]) {
    const bc = await Blockchain.create();
    bc.now = 1783000000;
    await bc.setShardAccount(NFT, {
      account: { addr: NFT, storage: { lastTransLt: 0n, balance: { coins: bal },
        state: { type: 'active', state: { code: cellFromMaybeHex(nftInfo.code), data: cellFromMaybeHex(nftInfo.data) } } },
        storageStats: { used: { cells: 30n, bits: 8000n }, lastPaid: 1782900000, duePayment: null } },
      lastTransactionLt: 0n, lastTransactionHash: 0n,
    });
    const res = await bc.sendMessage({
      info: { type: 'internal', ihrDisabled: true, bounce: true, bounced: false,
        src: OWNER, dest: NFT, value: { coins: 213000000n }, ihrFee: 0n, forwardFee: 0n,
        createdAt: bc.now, createdLt: 1n },
      body,
    });
    const tx = res.transactions[0];
    const d = tx.description;
    const compute = d.computePhase?.type === 'vm' ? d.computePhase.exitCode : d.computePhase?.type;
    console.log(`\nGetGems T1 @ NFT balance ${Number(bal)/1e9}: compute=${compute} action=${d.actionPhase ? d.actionPhase.resultCode : 'none'} aborted=${d.aborted} outs=${tx.outMessagesCount}`);
  }
}
