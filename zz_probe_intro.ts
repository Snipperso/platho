import { beginCell, contractAddress, toNano, Address } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { IntroShard, storeIntroPublish } from './build/IntroShard/IntroShard_IntroShard';

function introBody(r: bigint, viewTag: bigint, h0: any, body: any) {
  return beginCell().store(storeIntroPublish({
    $$type: 'IntroPublish', r, view_tag: viewTag, header_0: h0, body,
  })).endCell();
}

async function main() {
  const bc = await Blockchain.create();
  bc.now = 1_800_000_000;
  const epoch = Math.floor(bc.now / 86400);

  // ATTACKER has NO relationship to anyone. Purely picks (epoch, bucket).
  const attacker = await bc.treasury('attacker', { balance: toNano('20000') });
  const victimSender = await bc.treasury('honest-sender');

  const init = await IntroShard.init(BigInt(epoch), 0n);
  const addr = contractAddress(0, init);
  const shard = bc.openContract(new IntroShard(addr, init));

  const empty = beginCell().endCell();

  // ---- 1. no-auth check: attacker publishes into a shard it has no key for ----
  const first = await attacker.send({
    to: addr, value: toNano('0.0035'), init, bounce: true,
    body: introBody(1n, 1n, empty, empty),
  } as any);
  let v = await shard.getGetView();
  console.log('after 1 attacker publish: live_count =', v.live_count,
              ' min_value =', v.min_value, ' safe_cap =', v.safe_cap);

  // ---- 2. cost floor: find the cheapest value that still passes 13682 and lands ----
  const before = (await bc.getContract(attacker.address)).balance;
  const N = 300;
  for (let i = 0; i < N; i++) {
    await attacker.send({
      to: addr, value: BigInt(v.min_value), bounce: true,
      body: introBody(BigInt(i + 2), 7n, empty, empty),
    } as any);
  }
  const after = (await bc.getContract(attacker.address)).balance;
  v = await shard.getGetView();
  const shardBal = (await bc.getContract(addr)).balance;
  console.log('live_count =', v.live_count);
  console.log('attacker spent for', N, 'publishes:', Number(before - after) / 1e9, 'TON');
  console.log('per publish:', Number(before - after) / N / 1e9, 'TON');
  console.log('shard balance:', Number(shardBal) / 1e9, 'TON');

  // ---- 3. does an honest stranger still get in below the cap? ----
  const ok = await victimSender.send({
    to: addr, value: toNano('0.01'), bounce: true,
    body: introBody(0xDEADn, 0x99n, empty, empty),
  } as any);
  console.log('honest publish below cap exit codes:',
    ok.transactions.map((t: any) => t.description?.computePhase?.exitCode).filter((x: any) => x !== undefined));
}

main();
