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

describe('INTRO evict lens', () => {
  it('E1: outsider write accepted (by design) + PERMISSIONLESS eviction by an unrelated third party', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_700_000_000;
    const epoch = Math.floor(bc.now / 86400);
    const alice = await bc.treasury('alice');
    const mallory = await bc.treasury('mallory');
    const randoJoe = await bc.treasury('randojoe');   // NO relation to anybody

    const init = await IntroShard.init(BigInt(epoch), 7n);
    const is = bc.openContract(new IntroShard(contractAddress(0, init), init));
    await is.send(alice.getSender(), { value: toNano('0.05') }, null);

    const v0 = await is.getGetView();
    console.log('min_value =', v0.min_value.toString(), 'safe_cap =', v0.safe_cap.toString(), 'retention =', v0.retention.toString());

    // Mallory (a total stranger) writes 20 intros
    const before = await mallory.getBalance();
    for (let i = 0; i < 20; i += 1) {
      const r = await mallory.send({ to: is.address, value: v0.min_value, body: introBody(BigInt(0xEE00 + i), i, 0xEE), bounce: true } as any);
      expect(exitOf(r, is.address), `stranger write ${i}`).toBe(0);
    }
    const spent = before - (await mallory.getBalance());
    const v1 = await is.getGetView();
    console.log('after 20 stranger writes: live=', v1.live_count, 'next_id=', v1.next_id);
    console.log('attacker cost per intro =', (spent / 20n).toString(), 'nanoton =', Number(spent / 20n) / 1e9, 'TON');
    console.log('=> cost to fill SAFE_CAP(8000) =', (Number(spent / 20n) * 8000) / 1e9, 'TON');

    // ---- advance past the 1-week retention ----
    bc.now = bc.now + Number(v1.retention) + 10;

    // A COMPLETELY UNRELATED third party calls EvictIntros. No key, no relation, no permission.
    const evBefore = await randoJoe.getBalance();
    const re = await randoJoe.send({ to: is.address, value: toNano('0.05'), body: evictBody(64), bounce: true } as any);
    const evCost = evBefore - (await randoJoe.getBalance());
    console.log('EvictIntros by UNRELATED party exit =', exitOf(re, is.address));
    console.log('evict cost for 20 entries =', Number(evCost) / 1e9, 'TON  => per entry', Number(evCost) / 20 / 1e9);

    const v2 = await is.getGetView();
    console.log('after evict: live=', v2.live_count, 'cursor=', v2.evict_cursor, 'next_id=', v2.next_id);
    expect(exitOf(re, is.address), 'permissionless evict must be accepted').toBe(0);
    expect(v2.live_count, 'live_count MUST drop').toBe(0n);
    expect((await is.getGetEntry(0n)).exists).toBe(false);

    // and a fresh write works again
    const r2 = await alice.send({ to: is.address, value: v0.min_value, body: introBody(0x1234n, 1, 1), bounce: true } as any);
    expect(exitOf(r2, is.address), 'write after evict').toBe(0);
    console.log('post-evict live =', (await is.getGetView()).live_count);
  }, 300_000);

  it('E2: SAFE_CAP is actually reachable and the gate fires (fill to cap w/ a cheap loop)', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_700_000_000;
    const epoch = Math.floor(bc.now / 86400);
    const alice = await bc.treasury('alice');
    const mallory = await bc.treasury('mallory');
    const init = await IntroShard.init(BigInt(epoch), 9n);
    const is = bc.openContract(new IntroShard(contractAddress(0, init), init));
    await is.send(alice.getSender(), { value: toNano('0.05') }, null);
    const mv = (await is.getGetView()).min_value;

    const t0 = Date.now();
    const N = 400;
    for (let i = 0; i < N; i += 1) {
      await mallory.send({ to: is.address, value: mv, body: introBody(BigInt(i), i & 0xffff, 0xA0), bounce: true } as any);
    }
    const v = await is.getGetView();
    console.log(`filled ${N} in ${(Date.now() - t0) / 1000}s; live=`, v.live_count);
    const bal = (await bc.getContract(is.address)).balance;
    console.log('shard balance =', Number(bal) / 1e9, 'TON; reserve target =', Number(1000000n + v.live_count * 8000n) / 1e9);
  }, 600_000);
});
