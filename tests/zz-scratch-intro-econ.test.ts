import { describe, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { IntroShard, storeIntroPublish, storeEvictIntros } from '../build/IntroShard/IntroShard_IntroShard';

const exitOf = (res: any, dest: Address): number => {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());
  return Number(tx?.description?.computePhase?.exitCode ?? -999);
};
const gasOf = (res: any, dest: Address) => {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());
  return {
    gasUsed: tx?.description?.computePhase?.gasUsed,
    gasFees: tx?.description?.computePhase?.gasFees,
    totalFees: tx?.totalFees?.coins,
  };
};
const cellOf = (fill: number, len = 64) => beginCell().storeBuffer(Buffer.alloc(len, fill)).endCell();
const introBody = (r: bigint, tag: number, a: number) => beginCell().store(storeIntroPublish({
  $$type: 'IntroPublish', r, view_tag: BigInt(tag), header_0: cellOf(a), body: cellOf(a, 100),
})).endCell();
const evictBody = (n: number) => beginCell().store(storeEvictIntros({
  $$type: 'EvictIntros', max_count: BigInt(n),
})).endCell();

describe('INTRO drain-race economics', () => {
  it('E3: marginal attacker write cost vs marginal defender evict cost', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_700_000_000;
    const epoch = Math.floor(bc.now / 86400);
    const alice = await bc.treasury('alice');
    const mallory = await bc.treasury('mallory');
    const joe = await bc.treasury('joe');
    const init = await IntroShard.init(BigInt(epoch), 11n);
    const is = bc.openContract(new IntroShard(contractAddress(0, init), init));
    await is.send(alice.getSender(), { value: toNano('0.05') }, null);
    const mv = (await is.getGetView()).min_value;

    // warm-up write absorbs the one-time balance sweep; measure the STEADY-STATE marginal cost after it
    await mallory.send({ to: is.address, value: mv, body: introBody(0n, 0, 1), bounce: true } as any);

    const N = 128;
    const b0 = await mallory.getBalance();
    for (let i = 1; i <= N; i += 1) {
      await mallory.send({ to: is.address, value: mv, body: introBody(BigInt(i), i, 0xA0), bounce: true } as any);
    }
    const writeSpend = b0 - (await mallory.getBalance());
    console.log('=== ATTACKER ===');
    console.log('marginal cost per intro write =', Number(writeSpend) / N / 1e9, 'TON');
    console.log('cost to fill SAFE_CAP(8000)  =', (Number(writeSpend) / N) * 8000 / 1e9, 'TON');

    // ---- past retention, evict in 64-batches; measure the TRUE gas burn (not the un-refunded value) ----
    bc.now = bc.now + 604800 + 10;
    const j0 = await joe.getBalance();
    const shardBefore = (await bc.getContract(is.address)).balance;
    let calls = 0;
    for (let k = 0; k < 10; k += 1) {
      const v = await is.getGetView();
      if (v.live_count === 0n) break;
      const r = await joe.send({ to: is.address, value: toNano('0.1'), body: evictBody(64), bounce: true } as any);
      calls += 1;
      if (k === 0) console.log('evict(64) exit =', exitOf(r, is.address), 'gas =', gasOf(r, is.address));
    }
    const joeSpend = j0 - (await joe.getBalance());
    const shardAfter = (await bc.getContract(is.address)).balance;
    const trueBurn = joeSpend - (shardAfter - shardBefore);   // what actually vanished vs what merely moved into the shard
    const v2 = await is.getGetView();
    console.log('=== DEFENDER ===');
    console.log('evict calls =', calls, ' live after =', v2.live_count, ' cursor =', v2.evict_cursor);
    console.log('joe gross outlay =', Number(joeSpend) / 1e9, 'TON (value is NOT refunded by EvictIntros)');
    console.log('joe TRUE burn    =', Number(trueBurn) / 1e9, 'TON  => per entry', Number(trueBurn) / (N + 1) / 1e9);
    console.log('extrapolated TRUE burn to drain a FULL 8000 bucket =', Number(trueBurn) / (N + 1) * 8000 / 1e9, 'TON');
    console.log('extrapolated GROSS outlay to drain 8000 (0.1/call, 125 calls) =', 125 * 0.1, 'TON');
    console.log('shard balance before/after evict =', Number(shardBefore) / 1e9, '/', Number(shardAfter) / 1e9);

    // minimal viable evict value: how little can a caller send?
    await mallory.send({ to: is.address, value: mv, body: introBody(999n, 9, 2), bounce: true } as any);
    bc.now = bc.now + 604800 + 10;
    for (const v of ['0.05', '0.02', '0.01', '0.005']) {
      const rr = await joe.send({ to: is.address, value: toNano(v), body: evictBody(64), bounce: true } as any);
      console.log(`evict with value ${v} -> exit`, exitOf(rr, is.address), 'live =', (await is.getGetView()).live_count);
      if ((await is.getGetView()).live_count === 0n) { await mallory.send({ to: is.address, value: mv, body: introBody(998n, 8, 3), bounce: true } as any); bc.now = bc.now + 604800 + 10; }
    }
  }, 600_000);
});
