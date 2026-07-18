import { beginCell, contractAddress, toNano, Cell } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { RecordShard } from './build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from './build/IntroShard/IntroShard_IntroShard';
import { RecoveryShard } from './build/RecoveryShard/RecoveryShard_RecoveryShard';
import { keyPairFromSeed, sign } from '@ton/crypto';

const RATE = 64962n; // nanoton per cell per year (config-18 from apr-2026, bits free)

function stateStats(code: Cell, data: Cell) {
  const seen = new Map<string, Cell>();
  const walk = (c: Cell) => { const h = c.hash().toString('hex'); if (seen.has(h)) return; seen.set(h, c); for (const r of c.refs) walk(r); };
  walk(code); walk(data);
  let bits = 0; for (const c of seen.values()) bits += c.bits.length;
  return { cells: seen.size, bits };
}

const bufToInt = (b: Buffer): bigint => BigInt('0x' + b.toString('hex'));

// a "realistic" capsule cell tree: n chained cells of 1023 bits
function blob(n: number, seed: number): Cell {
  let c = beginCell().storeUint(BigInt(seed), 32).endCell();
  for (let i = 1; i < n; i++) c = beginCell().storeUint(BigInt(seed + i), 512).storeRef(c).endCell();
  return c;
}

async function main() {
  const bc = await Blockchain.create();
  bc.now = 1_800_000_000;
  const t = await bc.treasury('econ');

  // ---------- gas price in this sandbox ----------
  console.log('=== CONFIG ===');

  // ---------- RecordShard ----------
  const RS_MIN = 2_700_000n;
  const init = await RecordShard.init(0x1234n, 20000n);
  const rs = bc.openContract(new RecordShard(contractAddress(0, init), init));
  const addr = rs.address;

  console.log('\n=== RecordShard: publishes at EXACTLY min_value ===');
  for (let i = 0; i < 12; i++) {
    const res = await rs.send(t.getSender(), { value: RS_MIN, bounce: true }, {
      $$type: 'CapsulePublish', header_0: blob(2, 1000 + i), header_1: blob(2, 2000 + i), body: blob(8, 3000 + i),
    } as any);
    const tx: any = res.transactions.find((x: any) => x.inMessage?.info?.dest?.toString() === addr.toString());
    const cp = tx.description.computePhase;
    const sp = tx.description.storagePhase;
    const ap = tx.description.actionPhase;
    const acc = await bc.getContract(addr);
    const st = acc.account?.account?.storage?.state;
    const s = st?.type === 'active' ? stateStats(st.state.code!, st.state.data!) : { cells: -1, bits: -1 };
    const out = tx.outMessages.get(0);
    console.log(
      `#${i} exit=${cp.exitCode} gasUsed=${cp.gasUsed} gasFees=${cp.gasFees} storFee=${sp?.storageFeesCollected} ` +
      `actOk=${ap?.success} outVal=${out?.info?.value?.coins ?? 0n} bal=${acc.balance} cells=${s.cells} bits=${s.bits} ` +
      `rentYr=${BigInt(s.cells) * RATE} survivalYrs=${(Number(acc.balance) / (s.cells * 64962)).toFixed(2)}`
    );
  }

  // reserve target vs balance
  {
    const v = await rs.getGetView();
    console.log('view:', JSON.stringify(v, (k, val) => typeof val === 'bigint' ? val.toString() : val));
  }

  // ---------- RecordShard: generous funding ----------
  console.log('\n=== RecordShard: FIRST publish with a generous 0.1 TON ===');
  const init2 = await RecordShard.init(0x9999n, 20000n);
  const rs2 = bc.openContract(new RecordShard(contractAddress(0, init2), init2));
  {
    const res = await rs2.send(t.getSender(), { value: toNano('0.1'), bounce: true }, {
      $$type: 'CapsulePublish', header_0: blob(2, 1), header_1: blob(2, 2), body: blob(8, 3),
    } as any);
    const tx: any = res.transactions.find((x: any) => x.inMessage?.info?.dest?.toString() === rs2.address.toString());
    const acc = await bc.getContract(rs2.address);
    const st = acc.account?.account?.storage?.state;
    const s = st?.type === 'active' ? stateStats(st.state.code!, st.state.data!) : { cells: -1, bits: -1 };
    console.log(`exit=${tx.description.computePhase.exitCode} gasUsed=${tx.description.computePhase.gasUsed} bal=${acc.balance} cells=${s.cells} survivalYrs=${(Number(acc.balance) / (s.cells * 64962)).toFixed(2)}`);
  }

  // ---------- IntroShard ----------
  console.log('\n=== IntroShard: publishes at EXACTLY min_value (2_508_000) ===');
  const IS_MIN = 2_508_000n;
  const initI = await IntroShard.init(20000n, 3n);
  const is = bc.openContract(new IntroShard(contractAddress(0, initI), initI));
  for (let i = 0; i < 12; i++) {
    const res = await is.send(t.getSender(), { value: IS_MIN, bounce: true }, {
      $$type: 'IntroPublish', r: BigInt(0xAB00 + i), view_tag: BigInt(i), header_0: blob(2, 4000 + i), body: blob(8, 5000 + i),
    } as any);
    const tx: any = res.transactions.find((x: any) => x.inMessage?.info?.dest?.toString() === is.address.toString());
    const cp = tx.description.computePhase;
    const acc = await bc.getContract(is.address);
    const st = acc.account?.account?.storage?.state;
    const s = st?.type === 'active' ? stateStats(st.state.code!, st.state.data!) : { cells: -1, bits: -1 };
    const out = tx.outMessages.get(0);
    console.log(`#${i} exit=${cp.exitCode} gasUsed=${cp.gasUsed} gasFees=${cp.gasFees} outVal=${out?.info?.value?.coins ?? 0n} bal=${acc.balance} cells=${s.cells} rentYr=${BigInt(s.cells) * RATE} survivalYrs=${(Number(acc.balance) / (s.cells * 64962)).toFixed(3)}`);
  }

  // ---------- RecoveryShard: max blob ----------
  console.log('\n=== RecoveryShard: 79-cell blob at exactly min_value 31_200_000 ===');
  const owner = keyPairFromSeed(Buffer.alloc(32, 0x21));
  const SLOT_DOMAIN = 0x52534C4Bn;
  const slot = bufToInt(beginCell().storeUint(SLOT_DOMAIN, 32).storeUint(bufToInt(owner.publicKey), 256).endCell().hash());
  const initR = await RecoveryShard.init(slot);
  const rc = bc.openContract(new RecoveryShard(contractAddress(0, initR), initR));
  const RECOVERY_DOMAIN = 0x42525331n;
  const h0 = 0x111n, h1 = 0x222n, bh = 0x333n;
  const dg = beginCell().storeUint(RECOVERY_DOMAIN, 32).storeUint(slot, 256).storeUint(1n, 64)
    .storeRef(beginCell().storeUint(h0, 256).storeUint(h1, 256).storeUint(bh, 256).endCell()).endCell().hash();
  const body79 = blob(79, 7);
  const res = await rc.send(t.getSender(), { value: 31_200_000n, bounce: true }, {
    $$type: 'RecoveryStore', owner_pubkey: bufToInt(owner.publicKey), seq: 1n, h0, h1, bh,
    body: body79, owner_sig: beginCell().storeBuffer(sign(dg, owner.secretKey)).endCell(),
  } as any);
  const txr: any = res.transactions.find((x: any) => x.inMessage?.info?.dest?.toString() === rc.address.toString());
  {
    const acc = await bc.getContract(rc.address);
    const st = acc.account?.account?.storage?.state;
    const s = st?.type === 'active' ? stateStats(st.state.code!, st.state.data!) : { cells: -1, bits: -1 };
    console.log(`exit=${txr.description.computePhase.exitCode} gasUsed=${txr.description.computePhase.gasUsed} gasFees=${txr.description.computePhase.gasFees} bal=${acc.balance} cells=${s.cells} rent3yr=${BigInt(s.cells) * RATE * 3n} survivalYrs=${(Number(acc.balance) / (s.cells * 64962)).toFixed(2)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
