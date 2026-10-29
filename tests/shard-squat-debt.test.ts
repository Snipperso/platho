import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { toNano, beginCell, Address } from '@ton/core';
import { deployFeeSink } from './helpers/fee-sink-fixture';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { buildConvPublish } from '../web/publish-builder.mjs';
import { ed25519 } from '@noble/curves/ed25519.js';


const cell = (f: number) => beginCell().storeBuffer(Buffer.alloc(64, f)).endCell();
const CLOCK = 1_790_000_000;
const RS_DEPLOY_MIN_VALUE = 19_100_000n;
const SQUAT_YEARS = 40;
const SQUAT_AGE = SQUAT_YEARS * 31_536_000;

describe('shard squat + storage debt', () => {
  it('SQUAT-DEBT-01: MEASURED — storage debt larger than the whole publish value does not break an admitted publish', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'squat-sink-funder' });

    const squatter = await bc.treasury('squat-squatter');
    const publisher = await bc.treasury('squat-publisher');
    const secret = new Uint8Array(32).fill(7);
    const publicKey = ed25519.getPublicKey(secret);

    const futureEpoch = BigInt(Math.floor((CLOCK + SQUAT_AGE) / 86400));
    const built = await buildConvPublish({
      writePublicKey: publicKey, writeSecret: secret, seq: 1n, epoch: futureEpoch,
      header0: cell(1), header1: cell(2), body: cell(3), value: toNano('0.05'),
    });

    await squatter.send({ to: built.to, value: 1_000_000n, init: built.init, body: beginCell().endCell(), bounce: false } as any);
    const born = await bc.getContract(built.to);
    expect(born.accountState?.type, 'the squat deploys the account').toBe('active');

    bc.now = CLOCK + SQUAT_AGE;
    const beforeBalance = (await bc.getContract(built.to)).balance;

    const res = await publisher.send({
      to: built.to, value: RS_DEPLOY_MIN_VALUE, body: built.body, bounce: true,
    } as any);

    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals?.(built.to));
    const shard = bc.openContract(RecordShard.fromAddress(built.to));
    const view = await shard.getGetView();

    const due = tx?.description?.storagePhase?.storageFeesDue ?? 0n;
    expect(due, 'the squat really did accrue debt').toBeGreaterThan(RS_DEPLOY_MIN_VALUE);

    expect(tx?.description?.computePhase?.exitCode, 'the publish is admitted').toBe(0);
    expect(tx?.description?.aborted, 'and it does NOT abort after being admitted').toBe(false);
    expect(tx?.description?.actionPhase?.resultCode, 'no rc37 behind a green exit code').toBe(0);
    expect(view.record_count, 'the record is stored').toBe(1n);
  }, 300_000);
});
