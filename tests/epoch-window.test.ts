import { describe, expect, it, beforeEach } from 'vitest';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { ed25519 } from '@noble/curves/ed25519.js';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { buildIntroPublish, buildConvPublish } from '../web/publish-builder.mjs';


const cellOf = (fill: number) => beginCell().storeBuffer(Buffer.alloc(64, fill)).endCell();

const exitOf = (res: any, dest: Address): number => Number(res.transactions.find(
  (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString(),
)?.description?.computePhase?.exitCode ?? -999);

describe('EPOCH-WINDOW — a shard is writable only while it is current', () => {
  let blockchain: Blockchain;
  let payer: SandboxContract<TreasuryContract>;
  let today: number;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = 1_790_000_000;
    today = Math.floor(blockchain.now / 86400);
    payer = await blockchain.treasury('ew-payer');
  });

  const sendIntro = async (epoch: number) => {
    const built = await buildIntroPublish({ epoch, bucket: 3n, r: 7n, viewTag: 9n, header0: cellOf(1), body: cellOf(2), value: toNano('0.05') });
    const res = await payer.send({ to: built.to, value: built.value, body: built.body, init: built.init, bounce: true } as any);
    const shard = blockchain.openContract(IntroShard.fromAddress(contractAddress(0, await IntroShard.init(BigInt(epoch), 3n))));
    let live = -1n;
    try { live = (await shard.getGetView()).next_id; } catch { }
    return { exit: exitOf(res, built.to), live };
  };

  const sendConv = async (epoch: number, fill: number) => {
    const secret = new Uint8Array(32).fill(fill);
    const publicKey = ed25519.getPublicKey(secret);
    const built = await buildConvPublish({ writePublicKey: publicKey, writeSecret: secret, seq: 1n, epoch, header0: cellOf(1), header1: cellOf(2), body: cellOf(3), value: toNano('0.05') });
    const res = await payer.send({ to: built.to, value: built.value, body: built.body, init: built.init, bounce: true } as any);
    const shard = blockchain.openContract(RecordShard.fromAddress(built.to));
    let live = -1n;
    try { live = (await shard.getGetView()).record_count; } catch { }
    return { exit: exitOf(res, built.to), live };
  };

  it('EPOCH-01: INTRO accepts the current epoch and its immediate neighbours', async () => {
    for (const delta of [0, -1, +1]) {
      const r = await sendIntro(today + delta);
      expect(r.exit, `epoch today${delta >= 0 ? '+' : ''}${delta} must be accepted`).toBe(0);
      expect(r.live).toBe(1n);
    }
  }, 180_000);

  it('EPOCH-02: INTRO refuses a stale or future epoch (13684) and stores nothing', async () => {
    for (const delta of [-2, -300, +2, +300]) {
      const r = await sendIntro(today + delta);
      expect(r.exit, `epoch today${delta >= 0 ? '+' : ''}${delta} must be refused`).toBe(13684);
      expect(r.live, 'and nothing may be stored').not.toBe(1n);
    }
  }, 180_000);

  it('EPOCH-03: CONV accepts the current epoch and its neighbours, refuses the rest (13656)', async () => {
    let fill = 0x40;
    for (const delta of [0, -1, +1]) {
      const r = await sendConv(today + delta, fill += 1);
      expect(r.exit, `CONV epoch today${delta >= 0 ? '+' : ''}${delta} must be accepted`).toBe(0);
      expect(r.live).toBe(1n);
    }
    for (const delta of [-2, -300, +2, +300]) {
      const r = await sendConv(today + delta, fill += 1);
      expect(r.exit, `CONV epoch today${delta >= 0 ? '+' : ''}${delta} must be refused`).toBe(13656);
      expect(r.live).not.toBe(1n);
    }
  }, 240_000);

  it('EPOCH-04: a finished epoch really is closed — yesterday stops accepting once it is two days old', async () => {
    const epoch = today;
    expect((await sendIntro(epoch)).exit, 'writable while current').toBe(0);

    blockchain.now = blockchain.now! + 86400 * 2 + 60;
    const built = await buildIntroPublish({ epoch, bucket: 3n, r: 11n, viewTag: 13n, header0: cellOf(4), body: cellOf(5), value: toNano('0.05') });
    const res = await payer.send({ to: built.to, value: built.value, body: built.body, init: built.init, bounce: true } as any);
    expect(exitOf(res, built.to), 'a past epoch must refuse new writes').toBe(13684);

    const shard = blockchain.openContract(IntroShard.fromAddress(contractAddress(0, await IntroShard.init(BigInt(epoch), 3n))));
    expect((await shard.getGetView()).next_id, 'its contents are frozen at what it held').toBe(1n);
  }, 180_000);
});
