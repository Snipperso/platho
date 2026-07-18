import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { IntroShard, storeIntroPublish, storeEvictIntros } from '../build/IntroShard/IntroShard_IntroShard';

const exitOf = (res: any, dest: Address): number => {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());
  return Number(tx?.description?.computePhase?.exitCode ?? -999);
};
const cellOf = (fill: number, len = 64) => beginCell().storeBuffer(Buffer.alloc(len, fill)).endCell();
const introBody = (r: bigint, tag: number, a: number) => beginCell().store(storeIntroPublish({
  $$type: 'IntroPublish', r, view_tag: BigInt(tag), header_0: cellOf(a), body: cellOf(a, 100),
})).endCell();
const evictBody = (n: number) => beginCell().store(storeEvictIntros({
  $$type: 'EvictIntros', max_count: BigInt(n),
})).endCell();

describe('INTRO full-cap brick test', () => {
  it('E4: fill to SAFE_CAP 8000, prove lockout, then prove a permissionless FULL DRAIN un-bricks it', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_700_000_000;
    const epoch = Math.floor(bc.now / 86400);
    const alice = await bc.treasury('alice');
    const mallory = await bc.treasury('mallory');
    const joe = await bc.treasury('joe');
    const init = await IntroShard.init(BigInt(epoch), 42n);
    const is = bc.openContract(new IntroShard(contractAddress(0, init), init));
    await is.send(alice.getSender(), { value: toNano('0.05') }, null);
    const mv = (await is.getGetView()).min_value;

    const t0 = Date.now();
    const b0 = await mallory.getBalance();
    for (let i = 0; i < 8000; i += 1) {
      await mallory.send({ to: is.address, value: mv, body: introBody(BigInt(i), i & 0xffff, 0xA0), bounce: true } as any);
    }
    const attackCost = b0 - (await mallory.getBalance());
    const v1 = await is.getGetView();
    console.log(`FILLED to cap in ${((Date.now() - t0) / 1000).toFixed(0)}s; live=`, v1.live_count, 'next_id=', v1.next_id);
    console.log('TOTAL ATTACK COST to brick one (epoch,bucket) =', Number(attackCost) / 1e9, 'TON');
    expect(v1.live_count).toBe(8000n);

    // a LEGIT first contact is now refused — the 13680 SAFE-CAP gate
    const rBlocked = await alice.send({ to: is.address, value: mv, body: introBody(0xBEEFn, 1, 1), bounce: true } as any);
    console.log('legit intro while full -> exit', exitOf(rBlocked, is.address), '(expect 13680)');
    expect(exitOf(rBlocked, is.address)).toBe(13680);

    // ---- is it bricked FOREVER? advance past retention and let an UNRELATED party drain it ----
    bc.now = bc.now + 604800 + 10;
    const j0 = await joe.getBalance();
    const shardBefore = (await bc.getContract(is.address)).balance;
    let calls = 0;
    while (calls < 200) {
      const v = await is.getGetView();
      if (v.live_count === 0n) break;
      const r = await joe.send({ to: is.address, value: toNano('0.04'), body: evictBody(64), bounce: true } as any);
      if (exitOf(r, is.address) !== 0) { console.log('EVICT FAILED at call', calls, 'exit', exitOf(r, is.address)); break; }
      calls += 1;
    }
    const joeSpend = j0 - (await joe.getBalance());
    const shardAfter = (await bc.getContract(is.address)).balance;
    const v2 = await is.getGetView();
    console.log('=== DRAIN ===');
    console.log('calls =', calls, 'live after =', v2.live_count, 'cursor =', v2.evict_cursor);
    console.log('joe gross outlay =', Number(joeSpend) / 1e9, 'TON; true burn =', Number(joeSpend - (shardAfter - shardBefore)) / 1e9, 'TON');
    console.log('defender:attacker cost ratio =', (Number(joeSpend - (shardAfter - shardBefore)) / Number(attackCost)).toFixed(3));
    expect(v2.live_count, 'FULL bucket must be fully drainable by an unrelated party').toBe(0n);

    // the bucket is usable again
    const rOk = await alice.send({ to: is.address, value: mv, body: introBody(0xC0FFEEn, 2, 2), bounce: true } as any);
    console.log('legit intro after drain -> exit', exitOf(rOk, is.address));
    expect(exitOf(rOk, is.address), 'bucket must be usable again -> NOT bricked forever').toBe(0);
  }, 900_000);
});
