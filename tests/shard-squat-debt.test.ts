import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { toNano, beginCell, Address } from '@ton/core';
import { deployFeeSink } from './helpers/fee-sink-fixture';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { buildConvPublish } from '../web/publish-builder.mjs';
import { ed25519 } from '@noble/curves/ed25519.js';

// Wave-8 LOW #50 — DISPROVEN BY MEASUREMENT, and kept as the guard that keeps it disproven.
//
// The claim was: a publish gate checks context().value, but the fee leg is paid in the ACTION phase out of the
// BALANCE, and the balance has already had accrued storage debt taken out of it — so a shard squatted early (the empty
// `receive()` is a lazy-deploy carrier, and every shard address is publicly computable) would let an attacker choose
// the size of that debt and make an ADMITTED publish fail in ACTION, which does not bounce and would therefore
// swallow the publisher's value in silence. The finding said outright that the decisive steps were not measured.
//
// MEASURED 2026-07-29, dust squat then a first publish funded at exactly RS_DEPLOY_MIN_VALUE (19,100,000):
//     squat age    debt carried    compute exit   aborted   action rc   record stored
//       10 years     11,523,412         0          false        0            yes
//       20 years     23,866,222         0          false        0            yes
//       30 years     36,209,032         0          false        0            yes
//       40 years     48,551,842         0          false        0            yes
// The debt exceeds the whole publish value two and a half times over at the last row and changes nothing. The
// storage phase collects only what the account ALREADY HELD (819,399 in every run — the dust, exactly) and carries
// the rest forward as due_payment; it never competes with the inbound message's value inside the same transaction.
// So the causal step the finding rests on does not hold, and there is nothing to fix on the publish path.
//
// WHAT IS REAL, and named rather than fixed: the squatted shard now carries a large due_payment, so its own rent
// float is pre-spent and it can be collected before its retention window closes — losing records early. That is an
// economic degradation of a squatted shard, not a loss of the publisher's money, and squatting costs the attacker a
// deploy per shard address. Recorded here so a future reader does not re-derive the wrong conclusion from the prose.

const cell = (f: number) => beginCell().storeBuffer(Buffer.alloc(64, f)).endCell();
const CLOCK = 1_790_000_000;
const RS_DEPLOY_MIN_VALUE = 19_100_000n;
const SQUAT_YEARS = 40;                    // the worst age measured; the debt is 2.5x the whole publish value
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

    // The shard for an epoch three years out. Its address is a pure function of (write_pubkey, epoch), both public.
    const futureEpoch = BigInt(Math.floor((CLOCK + SQUAT_AGE) / 86400));
    const built = await buildConvPublish({
      writePublicKey: publicKey, writeSecret: secret, seq: 1n, epoch: futureEpoch,
      header0: cell(1), header1: cell(2), body: cell(3), value: toNano('0.05'),
    });

    // Squat it: the empty receive() is a lazy-deploy carrier, so a stranger can bring it into existence today with
    // dust and let it bleed rent until its epoch opens. Gate 13656 blocks PUBLISHING early, not DEPLOYING early.
    await squatter.send({ to: built.to, value: 1_000_000n, init: built.init, body: beginCell().endCell(), bounce: false } as any);
    const born = await bc.getContract(built.to);
    expect(born.accountState?.type, 'the squat deploys the account').toBe('active');

    // Ten years of rent on an account nobody funds again — the debt is the attacker's choice of how early to squat.
    bc.now = CLOCK + SQUAT_AGE;
    const beforeBalance = (await bc.getContract(built.to)).balance;

    const res = await publisher.send({
      to: built.to, value: RS_DEPLOY_MIN_VALUE, body: built.body, bounce: true,
    } as any);

    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals?.(built.to));
    const shard = bc.openContract(RecordShard.fromAddress(built.to));
    const view = await shard.getGetView();

    // The debt must actually be there, or this test proves nothing about debt. Aimed at the mechanism, not the
    // outcome — a guard whose precondition quietly stopped holding is an ABSENT guard.
    const due = tx?.description?.storagePhase?.storageFeesDue ?? 0n;
    expect(due, 'the squat really did accrue debt').toBeGreaterThan(RS_DEPLOY_MIN_VALUE);

    // THE PROPERTY, whichever way the arithmetic falls: a publish that the gate ACCEPTS must not fail in ACTION,
    // because an ACTION-phase failure returns no bounce and the publisher's value is simply gone.
    expect(tx?.description?.computePhase?.exitCode, 'the publish is admitted').toBe(0);
    expect(tx?.description?.aborted, 'and it does NOT abort after being admitted').toBe(false);
    expect(tx?.description?.actionPhase?.resultCode, 'no rc37 behind a green exit code').toBe(0);
    expect(view.record_count, 'the record is stored').toBe(1n);
  }, 300_000);
});
