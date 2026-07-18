import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { ed25519 } from '@noble/curves/ed25519.js';
import { RecordShard } from './RS_head';
// @ts-ignore
import { buildConvPublish } from '../web/publish-builder.mjs';

const exitOf = (res: any, dest: Address): number => {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());
  return Number(tx?.description?.computePhase?.exitCode ?? -999);
};
const cellOf = (fill: number, len = 64) => beginCell().storeBuffer(Buffer.alloc(len, fill)).endCell();

describe('SKEPTIC: modern client vs STALE HEAD-committed shard', () => {
  it('does the real publish-builder message parse on the stale contract?', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_700_000_000;
    const epoch = Math.floor(bc.now / 86400);
    const alice = await bc.treasury('alice');
    const mallory = await bc.treasury('mallory');

    const sec = new Uint8Array(32).fill(0x5a);
    const pub = ed25519.getPublicKey(sec);
    const pubBig = BigInt('0x' + Buffer.from(pub).toString('hex'));

    // Stale contract's init arg is bucket_key; the client derives the address from write_pubkey. Same slot either way.
    const init = await RecordShard.init(pubBig, BigInt(epoch));
    const rs = bc.openContract(new RecordShard(contractAddress(0, init), init));
    await rs.send(alice.getSender(), { value: toNano('0.05') }, null);

    const msg = await buildConvPublish({
      writePublicKey: pub, writeSecret: sec, seq: 1, epoch,
      header0: cellOf(1), header1: cellOf(2), body: cellOf(3, 100), value: toNano('0.02'),
    });
    const r = await alice.send({ to: rs.address, value: toNano('0.02'), body: msg.body, bounce: true } as any);
    const e = exitOf(r, rs.address);
    console.log('>>> LEGIT client publish onto STALE contract, exit =', e);

    // Now a stranger forging the same wire shape with THEIR OWN key
    const badSec = new Uint8Array(32).fill(0x7b);
    const badPub = ed25519.getPublicKey(badSec);
    const bad = await buildConvPublish({
      writePublicKey: badPub, writeSecret: badSec, seq: 2, epoch,
      header0: cellOf(0x70), header1: cellOf(0x80), body: cellOf(0x90, 100), value: toNano('0.02'),
    });
    const r2 = await mallory.send({ to: rs.address, value: toNano('0.02'), body: bad.body, bounce: true } as any);
    const e2 = exitOf(r2, rs.address);
    console.log('>>> STRANGER forged publish onto STALE contract, exit =', e2);

    const v: any = await (rs as any).getGetView();
    console.log('>>> record_count =', v.record_count, 'live_count =', v.live_count);
    expect(true).toBe(true);
  }, 60000);
});
